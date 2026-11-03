# Settings Help

## Your Information

- **Your Callsign** — used as the station of origin on net reports.
- **Your Name** — appears in the signature block of radiogram PDFs.
- **Location** — your place of origin (e.g., BALTIMORE MD), included in net reports.
- **Default Net Manager Callsign** — pre-filled as the addressee on net reports.

## Receiving Station

These fields populate the **This Radio Message Was Received At** section of the ARRL radiogram PDF form. They are separate from your operator information above.

- **Name** — the receiving station operator's name.
- **Phone / Address / City / State / ZIP** — contact and location for the receiving station.

## Callsign Lookup

Choose which free lookup service — Callook.info or HamDB.org — NetLogger uses to automatically look up operator names and locations when stations check in. No account or credentials are required for either service.

## Sent Methods

Customize the list of methods shown in the Sent dropdown on radiogram forms (e.g., Phone, Email, Radio). Use the text fields to edit existing entries, or type a new method and click **Add**.

## Received Methods

Customize the list of methods shown in the Received dropdown on radiogram forms. Same editing controls as Sent Methods.

## Saving

Click **Save Settings** at the bottom of the page to apply all changes.

## Changing Your Password

If you signed up with email/password (not Google), a **Change Password** form appears below the main settings. Enter your current password and your new password to update it.

## Export & Import Data

Use this section to back up your data, or to copy it between the web and desktop versions of NetLogger.

- **Export Data** saves all of your settings, stations, sessions and radiograms to a JSON text file named `netlogger-export-YYYY-MM-DD.json`. It's plain text, so you can open it in a text editor if you ever need to.
- **Import Data** loads an export file. Before anything changes, NetLogger shows what the file contains and asks you to confirm. Importing:
  - **replaces** your settings with the ones in the file
  - **adds** the file's sessions and radiograms, keeping the ones you already have. Importing the same file twice gives you two copies of each session and radiogram.
  - **adds or updates** stations. A station you already have is updated with any details from the file; it isn't duplicated.

To **restore a backup** without creating duplicates, check **Delete all existing data first** before clicking **Delete and Import**. Every station, session and radiogram you have now is deleted, and then the file is imported. This can't be undone, so if you might want your current data back, use the **export your current data** link in the warning to save a copy first.
