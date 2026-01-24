#!/usr/bin/env python3
"""
Import station callsigns and nicknames from CSV into Firestore.

Usage:
    python scripts/import_stations.py <csv_file> <user_uid>

The CSV file should have callsign in column 1 and nickname in column 2.
Requires service-account.json in the project root.
"""

import sys
import csv
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <csv_file> <user_uid>")
        print("  csv_file: Path to CSV with callsign (col 1) and nickname (col 2)")
        print("  user_uid: Your Firebase user UID")
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    user_uid = sys.argv[2]

    if not csv_path.exists():
        print(f"Error: CSV file not found: {csv_path}")
        sys.exit(1)

    # Find service account file
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    service_account_path = project_root / "service-account.json"

    if not service_account_path.exists():
        print(f"Error: Service account file not found: {service_account_path}")
        print("Download it from Firebase Console > Project Settings > Service Accounts")
        sys.exit(1)

    # Initialize Firebase
    cred = credentials.Certificate(str(service_account_path))
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Read CSV and import
    stations_ref = db.collection("users").document(user_uid).collection("stations")

    imported = 0
    skipped = 0

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue

            callsign = row[0].strip().upper()
            nickname = row[1].strip() or None

            if not callsign:
                continue

            # Check if station already exists
            doc_ref = stations_ref.document(callsign)
            doc = doc_ref.get()

            if doc.exists:
                # Update nickname only if not already set
                existing = doc.to_dict()
                if existing.get("nickname") is None and nickname:
                    doc_ref.update({"nickname": nickname})
                    print(f"Updated {callsign}: nickname = {nickname}")
                    imported += 1
                else:
                    skipped += 1
            else:
                # Create new station
                doc_ref.set({
                    "callsign": callsign,
                    "firstName": "Unknown",
                    "nickname": nickname,
                    "city": None,
                    "state": None,
                    "note": None,
                    "lastSeen": firestore.SERVER_TIMESTAMP,
                })
                print(f"Created {callsign}: nickname = {nickname}")
                imported += 1

    print(f"\nDone. Imported/updated: {imported}, Skipped (already set): {skipped}")


if __name__ == "__main__":
    main()
