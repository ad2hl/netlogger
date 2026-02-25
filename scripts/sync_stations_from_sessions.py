#!/usr/bin/env python3
"""
Sync station records from session check-in history.

Reads all sessions for a user and ensures a station document exists for
every callsign that has ever checked in. For new stations, creates a
document with firstName/city/state populated from QRZ.com lookups, and
lastSeen set to the most recent check-in timestamp. For existing stations,
updates lastSeen if the session data has a more recent timestamp.

Does not overwrite firstName, nickname, city, state, or note on existing
station documents.

QRZ credentials are read from the user's Firestore profile (qrzUsername /
qrzPassword). If the stored password is encrypted, set QRZ_ENCRYPTION_KEY
to the 64-character hex key used by the app server. You can also override
credentials directly with the QRZ_USERNAME and QRZ_PASSWORD env vars.

Usage:
    python scripts/sync_stations_from_sessions.py <user_uid> [--dry-run] [--delete-orphans]

Flags:
    --dry-run         Show what would change without writing to Firestore.
    --delete-orphans  Also delete station documents for callsigns that have
                      never appeared in any session check-in.

Requires a service account JSON file in the project root. Set the filename
with the SERVICE_ACCOUNT environment variable (default: service-account.json).
"""

import os
import sys
import time
import urllib.request
import urllib.parse
from xml.etree import ElementTree
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

QRZ_API_URL = "https://xmldata.qrz.com/xml/current/"


# ---------------------------------------------------------------------------
# QRZ helpers
# ---------------------------------------------------------------------------

def is_encrypted(value: str) -> bool:
    """Return True if value looks like an AES-GCM encrypted string (iv:ct:tag)."""
    parts = value.split(":")
    if len(parts) != 3:
        return False
    iv, _, auth_tag = parts
    return (
        len(iv) == 24       # 12 bytes * 2 hex chars
        and len(auth_tag) == 32  # 16 bytes * 2 hex chars
        and all(c in "0123456789abcdefABCDEF" for c in iv + auth_tag)
    )


def decrypt_password(encrypted: str) -> str | None:
    """Decrypt an AES-256-GCM password. Returns None if key missing or decryption fails."""
    key_hex = os.environ.get("QRZ_ENCRYPTION_KEY")
    if not key_hex:
        return None
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        iv_hex, ct_hex, tag_hex = encrypted.split(":")
        aesgcm = AESGCM(bytes.fromhex(key_hex))
        plaintext = aesgcm.decrypt(
            bytes.fromhex(iv_hex),
            bytes.fromhex(ct_hex) + bytes.fromhex(tag_hex),
            None,
        )
        return plaintext.decode("utf-8")
    except Exception as e:
        print(f"Warning: Failed to decrypt QRZ password: {e}")
        return None


def _qrz_fetch(params: dict) -> ElementTree.Element:
    url = QRZ_API_URL + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=10) as resp:
        return ElementTree.fromstring(resp.read())


def _qrz_tag(root: ElementTree.Element, tag: str) -> str:
    """Find a tag anywhere in a QRZ XML response tree, ignoring namespaces."""
    for el in root.iter():
        if el.tag.split("}")[-1] == tag:
            return (el.text or "").strip()
    return ""


class QRZClient:
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self._key: str | None = None

    def _login(self) -> bool:
        try:
            root = _qrz_fetch({"username": self.username, "password": self.password, "agent": "NetLogger/1.0"})
            error = _qrz_tag(root, "Error")
            if error:
                print(f"  QRZ login failed: {error}")
                return False
            self._key = _qrz_tag(root, "Key") or None
            return self._key is not None
        except Exception as e:
            print(f"  QRZ login error: {e}")
            return False

    def lookup(self, callsign: str) -> dict | None:
        """Return {'firstName', 'city', 'state'} from QRZ, or None on failure."""
        if not self._key and not self._login():
            return None
        try:
            root = _qrz_fetch({"s": self._key, "callsign": callsign})
            error = _qrz_tag(root, "Error")
            if error:
                if "Session Timeout" in error or "Invalid session" in error:
                    self._key = None
                    if not self._login():
                        return None
                    root = _qrz_fetch({"s": self._key, "callsign": callsign})
                    error = _qrz_tag(root, "Error")
                if error:
                    return None  # Callsign not found or unrecoverable error
            fname = _qrz_tag(root, "fname")
            nickname = _qrz_tag(root, "nickname")
            return {
                "firstName": nickname or fname or None,
                "city": _qrz_tag(root, "addr2") or None,
                "state": _qrz_tag(root, "state") or None,
            }
        except Exception as e:
            print(f"  QRZ lookup error for {callsign}: {e}")
            return None


def get_qrz_client(db, user_uid: str) -> QRZClient | None:
    """Return a QRZClient using env vars or the user's Firestore profile credentials."""
    username = os.environ.get("QRZ_USERNAME")
    password = os.environ.get("QRZ_PASSWORD")

    if not (username and password):
        profile_doc = db.collection("users").document(user_uid).get()
        if profile_doc.exists:
            profile = profile_doc.to_dict()
            username = username or profile.get("qrzUsername") or None
            stored_pw = profile.get("qrzPassword") or ""
            if stored_pw and is_encrypted(stored_pw):
                password = decrypt_password(stored_pw)
                if not password:
                    print(
                        "Warning: QRZ password is encrypted but decryption failed.\n"
                        "         Set QRZ_ENCRYPTION_KEY or QRZ_PASSWORD to enable QRZ lookups."
                    )
            else:
                password = password or stored_pw or None

    if username and password:
        print(f"QRZ credentials found for {username}. Will look up new stations.")
        return QRZClient(username, password)

    print("No QRZ credentials available. New stations will be created without name/location.")
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    dry_run = "--dry-run" in sys.argv
    delete_orphans = "--delete-orphans" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if len(args) != 1:
        print(f"Usage: {sys.argv[0]} <user_uid> [--dry-run] [--delete-orphans]")
        sys.exit(1)

    user_uid = args[0]

    project_root = Path(__file__).parent.parent
    sa_filename = os.environ.get("SERVICE_ACCOUNT", "service-account.json")
    service_account_path = project_root / sa_filename

    if not service_account_path.exists():
        print(f"Error: Service account file not found: {service_account_path}")
        print("Set SERVICE_ACCOUNT env var or place service-account.json in project root")
        sys.exit(1)

    cred = credentials.Certificate(str(service_account_path))
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    qrz = get_qrz_client(db, user_uid)

    user_ref = db.collection("users").document(user_uid)

    # Read all sessions and find the latest check-in timestamp per callsign
    print("\nReading sessions...")
    sessions = user_ref.collection("sessions").stream()

    latest = {}  # callsign -> latest timestamp
    session_count = 0
    checkin_count = 0

    for session_doc in sessions:
        session = session_doc.to_dict()
        session_count += 1

        for ci in session.get("checkIns", []):
            checkin_count += 1
            callsign = ci.get("callsign", "").upper()
            timestamp = ci.get("timestamp")

            if not callsign or not timestamp:
                continue

            if callsign not in latest or timestamp > latest[callsign]:
                latest[callsign] = timestamp

    print(f"Scanned {session_count} sessions, {checkin_count} check-ins")
    print(f"Found {len(latest)} unique callsigns")

    if not latest:
        print("Nothing to do.")
        return

    # Create or update station documents
    stations_ref = user_ref.collection("stations")
    created = 0
    updated = 0
    skipped = 0

    for callsign, timestamp in sorted(latest.items()):
        doc_ref = stations_ref.document(callsign)
        doc = doc_ref.get()

        if not doc.exists:
            # Look up in QRZ (even for dry-run so we show what would be created)
            qrz_data = qrz.lookup(callsign) if qrz else None
            if qrz:
                time.sleep(0.5)  # Be polite to QRZ

            station = {
                "callsign": callsign,
                "firstName": (qrz_data or {}).get("firstName"),
                "nickname": None,
                "city": (qrz_data or {}).get("city"),
                "state": (qrz_data or {}).get("state"),
                "note": None,
                "lastSeen": timestamp,
            }

            info = ", ".join(
                f"{k}={v}"
                for k, v in [("firstName", station["firstName"]), ("city", station["city"]), ("state", station["state"])]
                if v
            ) or "no QRZ data"

            if dry_run:
                print(f"  {callsign}: would create ({info})")
            else:
                doc_ref.set(station)
                print(f"  {callsign}: created ({info})")
            created += 1
            continue

        existing_last_seen = doc.to_dict().get("lastSeen")
        if existing_last_seen and existing_last_seen >= timestamp:
            skipped += 1
            continue

        if dry_run:
            print(f"  {callsign}: would update lastSeen to {timestamp}")
        else:
            doc_ref.update({"lastSeen": timestamp})
            print(f"  {callsign}: updated lastSeen to {timestamp}")
        updated += 1

    print(
        f"\n{'Would create' if dry_run else 'Created'}: {created}, "
        f"{'Would update' if dry_run else 'Updated'}: {updated}, "
        f"Already current: {skipped}"
    )

    # Optionally delete stations not seen in any session
    if delete_orphans:
        print("\nChecking for orphaned station documents...")
        all_station_docs = stations_ref.stream()
        deleted = 0

        for station_doc in all_station_docs:
            callsign = station_doc.id
            if callsign not in latest:
                if dry_run:
                    print(f"  {callsign}: would delete (never checked in)")
                else:
                    station_doc.reference.delete()
                    print(f"  {callsign}: deleted (never checked in)")
                deleted += 1

        if deleted == 0:
            print("  No orphaned stations found.")
        else:
            print(f"\n{'Would delete' if dry_run else 'Deleted'}: {deleted} orphaned station(s)")


if __name__ == "__main__":
    main()
