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

## Dates & Times

Choose whether dates and times are entered and displayed in your **Local** time zone or in **UTC**. NetLogger always stores times in UTC, so you can switch at any time and your existing sessions and radiograms keep the correct times.

- **Local** — times use your computer's time zone and its usual clock format.
- **UTC** — times use a 24-hour clock and are shown and printed with a trailing "Z" (e.g., 1024Z). Time fields become a four-digit HHMM box instead of a time picker.

The preamble **Time Filed** and **Date** of a radiogram are part of the message itself and are never converted.

## Message Numbering

**Next Message Number** is the number filled in when you click **Assign Next** on a radiogram form. Each time you use it, the number goes up by one. For a book, Assign Next numbers the entries in sequence. Change the value here to start a new series or to match your log.

## Sent Methods

Customize the list of methods shown in the Sent dropdown on radiogram forms (e.g., Phone, Email, Radio). Use the text fields to edit existing entries, or type a new method and click **Add**.

## Received Methods

Customize the list of methods shown in the Received dropdown on radiogram forms. Same editing controls as Sent Methods.

## Quick Tag Buttons

Add buttons for liaison nets or other tags you use often. They appear in the check-in bar next to NC, ANC, T and A, and clicking one adds that tag to the station you're checking in.

- **Acronym** — the tag itself (e.g., OC), up to 8 characters. The built-in tags NC, ANC, T, A, S and IO can't be redefined.
- **Label** — the description shown when you hover over the button or tag (e.g., Orange County Net).
- **In report** — when checked, the tag is shown with the station's callsign in the net report, as for a liaison. Uncheck it for tags that only mark a station's status during the net.

Type an acronym and label and click **Add**, edit existing tags in place, or click **Remove** to delete one.

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
