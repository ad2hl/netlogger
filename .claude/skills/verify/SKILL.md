---
name: verify
description: How to run and drive NetLogger locally to verify changes end-to-end without Firebase credentials or login.
---

# Verifying NetLogger changes

## Launch without Firebase

Desktop mode swaps Firebase for Dexie (IndexedDB) and auto-signs-in a `local-user` — no login, no App Check:

```bash
NEXT_PUBLIC_DESKTOP_MODE=true npx next dev -p 3111
```

The app lands on `/sessions`. All data lives in the browser profile's IndexedDB, so use a **persistent** browser profile if state must survive across driver runs.

## Drive with Playwright (Python)

`playwright` for Python is installed (`~/Library/Python/3.12/bin/playwright`). Use
`p.chromium.launch_persistent_context(profile_dir, headless=True)` so IndexedDB persists between script invocations. Grant `clipboard-read`/`clipboard-write` to verify Copy buttons via `page.evaluate("navigator.clipboard.readText()")`.

## Gotchas

- **New Session modal** requires Net Name AND Start Time (`input[type=time]`) before OK enables navigation to `/net`.
- **Print/Plain buttons** open a blob-URL PDF via `window.open` — headless Chromium can't render the PDF viewer, so `wait_for_load_state` on the popup hangs. Instead monkeypatch `window.open` to capture the URL, `fetch` it to base64 in-page, save the bytes, and extract text with `pypdf`.
- Radiogram form fields have `name` attributes (`number`, `precedence`, `stationOfOrigin`, `check`, `placeOfOrigin`, `date`, `address`, `signature`); the Text word grid inputs are `form .grid.grid-cols-5 input`; book entry boxes are `form div.border.border-slate-200.rounded.p-2`.
- Console shows two benign 404s on load (optional content endpoints).

## Flows worth driving

Create session → New Radiogram → fill/save → reopen (round-trip) → check the /radiograms table. For books: Book checkbox → count → entries → save → Split into Messages.
