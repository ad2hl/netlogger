#!/usr/bin/env python3
"""
One-shot migration (issue #292): convert stored local dates/times to UTC.

NetLogger now stores all dates and times in UTC and converts them to the
user's chosen zone (Settings → Dates & Times) for display. This rewrites a
user's existing Firestore data, which was stored in local time:

  sessions/{id}
    date        Timestamp at local midnight  → Timestamp at UTC midnight of the UTC start date
    startTime   "HH:MM" local                → "HH:MM" UTC
    endTime     "HH:MM" local                → "HH:MM" UTC
    report.parts.dispositionDate/Time        → UTC
  radiograms/{id}
    receivedDate/receivedTime                → UTC
    dispositionDate/dispositionTime          → UTC

All entries are assumed to be in the single time zone given by --tz.
A time that already ends in "Z" is assumed to be UTC and is left unchanged.
A date without a time is left unchanged (it can't be shifted meaningfully);
a time without a date is converted using the radiogram's saved date for
the DST offset.

Not converted: radiogram preamble Time Filed / Date (message content),
and Firestore Timestamps that are already absolute instants (check-in
times, lastSeen, createdAt/savedAt, report.startDateTime).

The script is idempotent and safe to re-run, including after a partial
failure, because each document carries its own "already UTC" marker and is
updated in a single write together with that marker:

  - Sessions: a `date` of exactly midnight UTC. The app has stored session
    dates that way since issue #292, and this script writes them that way.
  - Radiograms: `timesUtc: true`. The app sets it on every radiogram it
    creates, and this script sets it on every radiogram it examines.

Run it soon after deploying the issue #292 code. A pre-migration session or
radiogram whose dates/times are edited in the app before it is migrated
gets a mix of local and UTC values that this script can't untangle.

Usage:
    python scripts/migrate_to_utc.py <user_uid> --tz America/New_York [--dry-run]

Requires a service account JSON file in the project root. Set the filename
with the SERVICE_ACCOUNT environment variable (default: service-account.json).
"""

import argparse
import os
import re
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import firebase_admin
from firebase_admin import credentials, firestore

DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")


def parse_date(s):
    m = DATE_RE.match(s or "")
    return date(int(m[1]), int(m[2]), int(m[3])) if m else None


def parse_time(s):
    m = TIME_RE.match(s or "")
    if not m:
        return None
    h, mi = int(m[1]), int(m[2])
    return time(h, mi) if h < 24 and mi < 60 else None


def is_utc_already(s):
    return isinstance(s, str) and s.strip().upper().endswith("Z")


def to_utc(d, t, tz):
    """Local date + time in tz → aware UTC datetime."""
    return datetime.combine(d, t, tzinfo=tz).astimezone(timezone.utc)


def convert_pair(date_str, time_str, tz, fallback_date):
    """Convert a stored (date, time) string pair from local to UTC.

    Returns the new (date_str, time_str). Times ending in Z, unparseable
    times, and bare dates are returned unchanged.
    """
    if not time_str or is_utc_already(time_str):
        return date_str, time_str
    t = parse_time(time_str)
    if t is None:
        return date_str, time_str
    d = parse_date(date_str)
    if date_str and d is None:
        # Unparseable date: leave the whole pair alone
        return date_str, time_str
    u = to_utc(d or fallback_date, t, tz)
    new_date = u.strftime("%Y-%m-%d") if date_str else date_str
    return new_date, u.strftime("%H:%M")


def is_utc_midnight(ts):
    ts = ts.astimezone(timezone.utc)
    return ts.hour == 0 and ts.minute == 0 and ts.second == 0 and ts.microsecond == 0


def migrate_session(data, tz):
    """Return a dict of field updates for a session, or None if already UTC."""
    stored_date = data.get("date")
    if stored_date is None or is_utc_midnight(stored_date):
        return None

    local_date = stored_date.astimezone(tz).date()
    start = data.get("startTime") or ""
    end = data.get("endTime")
    updates = {}

    start_t = None if is_utc_already(start) else parse_time(start)
    if start_t is not None:
        start_utc = to_utc(local_date, start_t, tz)
        updates["startTime"] = start_utc.strftime("%H:%M")
        utc_date = start_utc.date()
    else:
        # Start already UTC or unparseable: keep it, keep the calendar date
        utc_date = local_date
    updates["date"] = datetime.combine(utc_date, time(0, 0), tzinfo=timezone.utc)

    end_t = None if (not end or is_utc_already(end)) else parse_time(end)
    if end_t is not None:
        end_date = local_date
        if start_t is not None and end_t < start_t:
            end_date += timedelta(days=1)  # net ran past local midnight
        updates["endTime"] = to_utc(end_date, end_t, tz).strftime("%H:%M")

    parts = (data.get("report") or {}).get("parts")
    if parts and parts.get("dispositionTime"):
        d, t = convert_pair(parts.get("dispositionDate"), parts.get("dispositionTime"), tz, local_date)
        if (d, t) != (parts.get("dispositionDate"), parts.get("dispositionTime")):
            updates["report.parts.dispositionDate"] = d
            updates["report.parts.dispositionTime"] = t

    return updates


def migrate_radiogram(data, tz):
    """Return a dict of field updates for a radiogram, or None if already UTC.

    The updates always include the `timesUtc` marker, even when no times
    needed converting, so later runs skip the radiogram.
    """
    if data.get("timesUtc"):
        return None
    saved = data.get("createdAt") or data.get("savedAt")
    fallback = saved.astimezone(tz).date() if saved else datetime.now(tz).date()
    updates = {}
    for date_key, time_key in (("receivedDate", "receivedTime"), ("dispositionDate", "dispositionTime")):
        old = (data.get(date_key) or "", data.get(time_key) or "")
        new = convert_pair(old[0], old[1], tz, fallback)
        if new != old:
            updates[date_key], updates[time_key] = new
    updates["timesUtc"] = True
    return updates


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("user_uid")
    ap.add_argument("--tz", required=True, help="IANA time zone the data was entered in, e.g. America/New_York")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    tz = ZoneInfo(args.tz)

    project_root = Path(__file__).parent.parent
    sa_filename = os.environ.get("SERVICE_ACCOUNT", "service-account.json")
    service_account_path = project_root / sa_filename
    if not service_account_path.exists():
        print(f"Error: Service account file not found: {service_account_path}")
        print("Set SERVICE_ACCOUNT env var or place service-account.json in project root")
        sys.exit(1)

    firebase_admin.initialize_app(credentials.Certificate(str(service_account_path)))
    db = firestore.client()
    user_ref = db.collection("users").document(args.user_uid)

    prefix = "[dry run] " if args.dry_run else ""
    batch = db.batch()
    pending = 0

    # Each document's conversion and its "already UTC" marker go in one
    # update, so a batch that never commits leaves its documents for a re-run
    def queue(ref, updates):
        nonlocal batch, pending
        if args.dry_run:
            return
        batch.update(ref, updates)
        pending += 1
        if pending >= 400:
            batch.commit()
            batch = db.batch()
            pending = 0

    # Sessions
    s_total = s_changed = 0
    for doc in user_ref.collection("sessions").stream():
        s_total += 1
        data = doc.to_dict()
        updates = migrate_session(data, tz)
        if not updates:
            continue
        s_changed += 1
        old = f"{data['date'].astimezone(tz).date()} {data.get('startTime')}-{data.get('endTime')}"
        new = f"{updates['date'].date()} {updates.get('startTime', data.get('startTime'))}-{updates.get('endTime', data.get('endTime'))}Z"
        print(f"{prefix}session {doc.id} {data.get('netName', '')}: {old} → {new}")
        queue(doc.reference, updates)

    # Radiograms
    r_total = r_changed = r_marked = 0
    for doc in user_ref.collection("radiograms").stream():
        r_total += 1
        data = doc.to_dict()
        updates = migrate_radiogram(data, tz)
        if updates is None:
            continue
        r_marked += 1
        changes = {k: v for k, v in updates.items() if k != "timesUtc"}
        if changes:
            r_changed += 1
            desc = ", ".join(f"{k}: {data.get(k)!r} → {v!r}" for k, v in changes.items())
            print(f"{prefix}radiogram {doc.id} #{data.get('number', '')}: {desc}")
        queue(doc.reference, updates)

    if not args.dry_run and pending:
        batch.commit()

    print(f"\n{prefix}Sessions: {s_changed} of {s_total} converted")
    print(f"{prefix}Radiograms: {r_changed} of {r_total} converted ({r_marked} marked as UTC)")


if __name__ == "__main__":
    main()
