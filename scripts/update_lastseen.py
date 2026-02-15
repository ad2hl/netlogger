#!/usr/bin/env python3
"""
Update station lastSeen timestamps from session check-in data.

Reads all sessions for a user, determines the most recent check-in time
for each station, and updates the station's lastSeen field.

Usage:
    python scripts/update_lastseen.py <user_uid> [--dry-run]

Requires a service account JSON file in the project root. Set the filename
with the SERVICE_ACCOUNT environment variable (default: service-account.json).
"""

import os
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore


def main():
    dry_run = "--dry-run" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if len(args) != 1:
        print(f"Usage: {sys.argv[0]} <user_uid> [--dry-run]")
        sys.exit(1)

    user_uid = args[0]

    # Find service account file
    project_root = Path(__file__).parent.parent
    sa_filename = os.environ.get("SERVICE_ACCOUNT", "service-account.json")
    service_account_path = project_root / sa_filename

    if not service_account_path.exists():
        print(f"Error: Service account file not found: {service_account_path}")
        print("Set SERVICE_ACCOUNT env var or place service-account.json in project root")
        sys.exit(1)

    # Initialize Firebase
    cred = credentials.Certificate(str(service_account_path))
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    user_ref = db.collection("users").document(user_uid)

    # Read all sessions and find the latest check-in time per callsign
    print("Reading sessions...")
    sessions = user_ref.collection("sessions").stream()

    latest = {}  # callsign -> latest timestamp
    session_count = 0
    checkin_count = 0

    for session_doc in sessions:
        session = session_doc.to_dict()
        session_count += 1
        check_ins = session.get("checkIns", [])

        for ci in check_ins:
            checkin_count += 1
            callsign = ci.get("callsign", "").upper()
            timestamp = ci.get("timestamp")

            if not callsign or not timestamp:
                continue

            if callsign not in latest or timestamp > latest[callsign]:
                latest[callsign] = timestamp

    print(f"Scanned {session_count} sessions, {checkin_count} check-ins")
    print(f"Found {len(latest)} unique callsigns")

    # Update station documents
    stations_ref = user_ref.collection("stations")
    updated = 0
    skipped = 0
    not_found = 0

    for callsign, timestamp in sorted(latest.items()):
        doc_ref = stations_ref.document(callsign)
        doc = doc_ref.get()

        if not doc.exists:
            print(f"  {callsign}: no station doc (skipped)")
            not_found += 1
            continue

        existing = doc.to_dict()
        existing_last_seen = existing.get("lastSeen")

        if existing_last_seen and existing_last_seen >= timestamp:
            skipped += 1
            continue

        if dry_run:
            print(f"  {callsign}: would update lastSeen to {timestamp}")
        else:
            doc_ref.update({"lastSeen": timestamp})
            print(f"  {callsign}: updated lastSeen to {timestamp}")
        updated += 1

    action = "Would update" if dry_run else "Updated"
    print(f"\n{action}: {updated}, Already current: {skipped}, No station doc: {not_found}")


if __name__ == "__main__":
    main()
