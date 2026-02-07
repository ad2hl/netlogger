#!/usr/bin/env python3
"""
Delete all personal data for a station, for privacy policy compliance.

Takes two callsigns:
  - The net control operator whose collections contain the data
  - The target station whose personal data should be removed

Deletes from the NC operator's data:
  - Station memory about the target (users/{ncUid}/stations/{targetCallsign})
    This contains firstName, nickname, city, state, and notes.

If the target station also has their own NetLogger account:
  - Deletes their profile document (users/{targetUid})
  - Deletes all their station memory (users/{targetUid}/stations/*)
  - Deletes all their net sessions (users/{targetUid}/sessions/*)
  - Deletes their Firebase Authentication account

Preserves:
  - The target's callsign where it appears in session check-in lists,
    net reports, or radiograms (these are just callsign strings with
    no personal information)

Requires:
  - pip install firebase-admin
  - A service-account.json file in the project root

Usage:
  python scripts/delete_user_data.py --ncs AD2HL --target N2INJ
  python scripts/delete_user_data.py --ncs AD2HL --target N2INJ --dry-run
"""

import argparse
import os
import sys

import firebase_admin
from firebase_admin import auth, credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter


def init_firebase():
    """Initialize Firebase Admin SDK with service account credentials."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    cred_path = os.path.join(project_root, "service-account.json")

    if not os.path.exists(cred_path):
        print(f"Error: {cred_path} not found.")
        print("Place your Firebase service account JSON file in the project root.")
        sys.exit(1)

    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    return firestore.client()


def find_user_by_callsign(db, callsign):
    """Find a user document whose callsign field matches the given callsign."""
    users_ref = db.collection("users")
    query = users_ref.where(filter=FieldFilter("callsign", "==", callsign)).limit(1)
    results = list(query.stream())

    if not results:
        return None, None

    doc = results[0]
    return doc.id, doc.to_dict()


def delete_subcollection(parent_ref, subcollection_name, dry_run=False):
    """Delete all documents in a subcollection. Returns count of deleted docs."""
    count = 0
    docs = parent_ref.collection(subcollection_name).stream()

    for doc in docs:
        count += 1
        if not dry_run:
            doc.reference.delete()

    return count


def delete_station_record(db, owner_uid, target_callsign, dry_run=False):
    """Delete a station record from a user's stations subcollection."""
    station_ref = (
        db.collection("users")
        .document(owner_uid)
        .collection("stations")
        .document(target_callsign)
    )
    station_doc = station_ref.get()

    if not station_doc.exists:
        return None

    data = station_doc.to_dict()
    if not dry_run:
        station_ref.delete()
    return data


def delete_auth_account(uid, dry_run=False):
    """Delete the Firebase Authentication account."""
    try:
        auth.get_user(uid)
    except auth.UserNotFoundError:
        print(f"  Auth account for UID {uid} not found (already deleted?)")
        return False

    if not dry_run:
        auth.delete_user(uid)
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Delete all personal data for a station, for privacy policy compliance."
    )
    parser.add_argument(
        "--ncs",
        required=True,
        help="Callsign of the net control operator whose data contains the records",
    )
    parser.add_argument(
        "--target",
        required=True,
        help="Callsign of the station whose personal data should be deleted",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without making changes",
    )
    args = parser.parse_args()

    nc_callsign = args.ncs.upper()
    target_callsign = args.target.upper()
    dry_run = args.dry_run

    if dry_run:
        print("=== DRY RUN — no changes will be made ===\n")

    db = init_firebase()
    action = "Would delete" if dry_run else "Deleted"

    # --- Part 1: Remove target's station record from NC operator's data ---

    nc_uid, nc_profile = find_user_by_callsign(db, nc_callsign)
    if not nc_uid:
        print(f"No user found with callsign {nc_callsign}.")
        sys.exit(1)

    print(f"NC operator: {nc_callsign} (UID={nc_uid})")

    station_data = delete_station_record(db, nc_uid, target_callsign, dry_run)
    if station_data:
        print(f"  {action} station record for {target_callsign}:")
        print(f"    firstName: {station_data.get('firstName', '')}")
        print(f"    nickname:  {station_data.get('nickname', '')}")
        print(f"    city:      {station_data.get('city', '')}")
        print(f"    state:     {station_data.get('state', '')}")
        print(f"    note:      {station_data.get('note', '')}")
    else:
        print(f"  No station record found for {target_callsign}")

    # --- Part 2: Delete target's own account if they have one ---

    target_uid, target_profile = find_user_by_callsign(db, target_callsign)
    if target_uid:
        print(f"\n{target_callsign} has a NetLogger account (UID={target_uid})")

        target_ref = db.collection("users").document(target_uid)

        station_count = delete_subcollection(target_ref, "stations", dry_run)
        print(f"  {action} {station_count} station record(s) owned by {target_callsign}")

        session_count = delete_subcollection(target_ref, "sessions", dry_run)
        print(f"  {action} {session_count} session(s) owned by {target_callsign}")

        print(f"  {action} user profile document")
        if not dry_run:
            target_ref.delete()

        auth_deleted = delete_auth_account(target_uid, dry_run)
        if auth_deleted:
            print(f"  {action} Firebase Auth account")
    else:
        print(f"\n{target_callsign} does not have a NetLogger account")

    print()
    if dry_run:
        print("Dry run complete. Re-run without --dry-run to execute.")
    else:
        print(f"All personal data for {target_callsign} has been deleted.")


if __name__ == "__main__":
    main()
