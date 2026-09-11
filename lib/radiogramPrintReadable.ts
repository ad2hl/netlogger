// Readable ("plain") radiogram print format.
// Produces a full 8.5×11 page PDF optimised for reading over the air,
// not for delivery to the recipient. Unlike radiogramPrint.ts, this
// generator writes directly to a blank page (no ARRL form template),
// supports arbitrary numbers of address/signature lines, and includes
// the addressee and signature Op Notes that the template cannot show.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { Radiogram, UserProfile } from '@/types';
import { isBookEntryEmpty } from '@/lib/radiogram';

// ── Page geometry (72 pt = 1 inch) ──────────────────────────────────────────
const PW = 612;  // 8.5"
const PH = 792;  // 11"
const ML = 54;   // left margin (0.75")
const MR = 54;   // right margin (0.75")
const MT = 50;   // top margin
const MB = 48;   // bottom margin

// ── Colors ───────────────────────────────────────────────────────────────────
const DARK  = rgb(0.10, 0.10, 0.10);
const GRAY  = rgb(0.42, 0.42, 0.42);
const LGRAY = rgb(0.65, 0.65, 0.65);

// ── Internal context ─────────────────────────────────────────────────────────
interface Ctx {
  doc: PDFDocument;
  pages: PDFPage[];
  rf: PDFFont;   // Helvetica
  bf: PDFFont;   // Helvetica-Bold
  y: number;     // cursor: distance from the top of the current page
}

function cur(ctx: Ctx): PDFPage {
  return ctx.pages[ctx.pages.length - 1];
}

// pdf-lib uses bottom-origin coordinates; convert from "from top" cursor.
function py(fromTop: number): number {
  return PH - fromTop;
}

function newPage(ctx: Ctx): void {
  ctx.pages.push(ctx.doc.addPage([PW, PH]));
  ctx.y = MT;
}

// Ensure at least `h` points remain above the bottom margin; break page if not.
function ensure(ctx: Ctx, h: number): void {
  if (ctx.y + h > PH - MB) newPage(ctx);
}

// Draw text at an absolute (x, fromTop) position. Does NOT advance the cursor.
function txt(
  ctx: Ctx,
  s: string,
  x: number,
  fromTop: number,
  font: PDFFont,
  size: number,
  color = DARK,
): void {
  if (!s) return;
  cur(ctx).drawText(s, { x, y: py(fromTop), font, size, color });
}

// Draw a horizontal rule at the current cursor y.
function hrule(ctx: Ctx, thickness = 0.4): void {
  cur(ctx).drawLine({
    start: { x: ML,      y: py(ctx.y) },
    end:   { x: PW - MR, y: py(ctx.y) },
    thickness,
    color: rgb(0.78, 0.78, 0.78),
  });
}

// Draw a section label + thin rule and advance the cursor.
function section(ctx: Ctx, label: string): void {
  ensure(ctx, 28);
  txt(ctx, label, ML, ctx.y, ctx.bf, 8, LGRAY);
  ctx.y += 5;
  hrule(ctx);
  ctx.y += 14;
}

// Draw one body line and advance the cursor.
function bodyLine(
  ctx: Ctx,
  s: string,
  size = 13,
  font?: PDFFont,
  color = DARK,
): void {
  ensure(ctx, size + 8);
  txt(ctx, s, ML, ctx.y, font ?? ctx.rf, size, color);
  ctx.y += size + 8;
}

// Advance the cursor without drawing.
function gap(ctx: Ctx, h = 14): void {
  ctx.y += h;
}

// Greedily wrap `text` on whitespace so each line fits within `maxWidth`
// at the given font/size. A single word wider than maxWidth is kept whole
// (not broken mid-word) rather than dropped.
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

// Draw an "Op Note: ..." line, wrapping it across multiple body lines so it
// never runs past the right margin (issue #286).
function opNoteLines(ctx: Ctx, note: string): void {
  const maxWidth = PW - ML - MR;
  for (const l of wrapText(`Op Note: ${note}`, ctx.rf, 11, maxWidth)) {
    bodyLine(ctx, l, 11, ctx.rf, GRAY);
  }
}

// ── Content renderer ─────────────────────────────────────────────────────────

function renderTitle(ctx: Ctx, title: string): void {
  ensure(ctx, 36);
  txt(ctx, title, ML, ctx.y, ctx.bf, 15, DARK);
  ctx.y += 7;
  hrule(ctx, 2);
  ctx.y += 16;
}

// nrValue: the message number, or "Book of N" for a book
function renderPreamble(ctx: Ctx, rad: Radiogram, nrValue: string): void {
  const { rf, bf } = ctx;

  // Reserve space for label + two rows before starting
  ensure(ctx, 90);
  section(ctx, 'PREAMBLE');

  // Row 1: Nr | Prec | HX | Station of Origin | Ck
  const r1lbl = ctx.y;
  const r1val = ctx.y + 13;
  const prow1: Array<{ lbl: string; val: string; x: number }> = [
    { lbl: 'Nr',                val: nrValue,                  x: ML },
    { lbl: 'Prec',              val: rad.precedence,            x: ML + 72 },
    { lbl: 'HX',                val: rad.handlingInstructions,  x: ML + 140 },
    { lbl: 'Station of Origin', val: rad.stationOfOrigin,       x: ML + 215 },
    { lbl: 'Ck',                val: rad.check,                 x: ML + 390 },
  ];
  for (const f of prow1) {
    txt(ctx, f.lbl,          f.x, r1lbl, bf, 7.5, LGRAY);
    txt(ctx, f.val || '—', f.x, r1val, rf, 13, DARK);
  }
  ctx.y = r1val + 16;

  // Row 2: Place of Origin | Time Filed | Date
  const r2lbl = ctx.y;
  const r2val = ctx.y + 13;
  const prow2: Array<{ lbl: string; val: string; x: number }> = [
    { lbl: 'Place of Origin', val: rad.placeOfOrigin, x: ML },
    { lbl: 'Time Filed',      val: rad.timeFiled,     x: ML + 265 },
    { lbl: 'Date',            val: rad.date,           x: ML + 360 },
  ];
  for (const f of prow2) {
    txt(ctx, f.lbl,          f.x, r2lbl, bf, 7.5, LGRAY);
    txt(ctx, f.val || '—', f.x, r2val, rf, 13, DARK);
  }
  ctx.y = r2val + 16;
  gap(ctx);
}

// TEXT — words numbered 5 per line with a small grey number in the gutter
function renderTextSection(ctx: Ctx, rad: Radiogram): void {
  const { rf } = ctx;
  const words = rad.textWords.filter(w => w.length > 0);
  section(ctx, `TEXT — ${words.length} WORD GROUP${words.length !== 1 ? 'S' : ''}`);

  if (words.length === 0) {
    bodyLine(ctx, '(no text)', 12, rf, LGRAY);
  } else {
    const NUM_W = 22;  // gutter width; number is right-aligned inside it
    const NUM_G = 6;   // gap between gutter and first word
    const WPER  = 5;

    for (let i = 0; i < words.length; i += WPER) {
      ensure(ctx, 22);
      const numStr = String(i + 1);
      const numPx  = rf.widthOfTextAtSize(numStr, 8.5);
      txt(ctx, numStr, ML + NUM_W - numPx, ctx.y, rf, 8.5, LGRAY);
      txt(ctx, words.slice(i, i + WPER).join('  '), ML + NUM_W + NUM_G, ctx.y, rf, 13, DARK);
      ctx.y += 20;
    }
  }
  gap(ctx);
}

function renderSignatureSection(ctx: Ctx, rad: Radiogram): void {
  section(ctx, 'SIGNATURE');
  const sigLines = rad.signature.split('\n').map(l => l.trim()).filter(Boolean);
  if (sigLines.length === 0) {
    bodyLine(ctx, '—', 13, ctx.rf, LGRAY);
  } else {
    for (const l of sigLines) bodyLine(ctx, l);
  }
  if (rad.signatureOpNote) {
    gap(ctx, 4);
    opNoteLines(ctx, rad.signatureOpNote);
  }
}

function renderContent(ctx: Ctx, rad: Radiogram, up?: UserProfile): void {
  renderTitle(ctx, 'ARRL RADIOGRAM');
  renderPreamble(ctx, rad, rad.number);

  // TO
  section(ctx, 'TO');
  const addrLines = rad.address.split('\n').map(l => l.trim()).filter(Boolean);
  for (const l of addrLines) bodyLine(ctx, l);
  if (rad.addressPhone) bodyLine(ctx, rad.addressPhone); // legacy field — phone is now an address line
  if (rad.addressOpNote) {
    gap(ctx, 4);
    opNoteLines(ctx, rad.addressOpNote);
  }
  gap(ctx);

  renderTextSection(ctx, rad);
  renderSignatureSection(ctx, rad);
  renderRelayAndReceivedAt(ctx, rad, up);
}

// Booked radiogram: fixed parts once, then each message's variable parts
function renderBookContent(ctx: Ctx, rad: Radiogram, up?: UserProfile): void {
  const { rf, bf } = ctx;

  renderTitle(ctx, `ARRL RADIOGRAM — BOOK OF ${rad.number || '?'}`);
  renderPreamble(ctx, rad, `Book of ${rad.number || '?'}`);
  renderTextSection(ctx, rad);
  renderSignatureSection(ctx, rad);
  gap(ctx);

  section(ctx, 'MESSAGES');
  const entries = (rad.bookEntries ?? []).filter(e => !isBookEntryEmpty(e));
  if (entries.length === 0) {
    bodyLine(ctx, '(no messages)', 12, rf, LGRAY);
  }
  for (const entry of entries) {
    // Nr — same label/value style as the preamble fields
    ensure(ctx, 34);
    txt(ctx, 'Nr', ML, ctx.y, bf, 7.5, LGRAY);
    txt(ctx, entry.number || '—', ML, ctx.y + 13, rf, 13, DARK);
    ctx.y += 29;

    // TO — same label as the single-radiogram address section
    ensure(ctx, 20);
    txt(ctx, 'TO', ML, ctx.y, bf, 8, LGRAY);
    ctx.y += 14;
    const addrLines = entry.address.split('\n').map(l => l.trim()).filter(Boolean);
    for (const l of addrLines) bodyLine(ctx, l);
    if (entry.addressOpNote) {
      gap(ctx, 4);
      opNoteLines(ctx, entry.addressOpNote);
    }
    if (entry.otherVariables) {
      gap(ctx, 4);
      for (const l of entry.otherVariables.split('\n').filter(Boolean)) {
        bodyLine(ctx, l, 11, rf, GRAY);
      }
    }
    // Rule after each message; the last one sets END BOOK apart
    gap(ctx, 2);
    ensure(ctx, 10);
    hrule(ctx);
    gap(ctx, 12);
  }
  bodyLine(ctx, 'END BOOK', 13, rf);

  renderRelayAndReceivedAt(ctx, rad, up);
}

function renderRelayAndReceivedAt(ctx: Ctx, rad: Radiogram, up?: UserProfile): void {
  const { rf, bf } = ctx;

  // RECEIVED / SENT — relay chain
  const recParts: string[] = [];
  if (rad.receivedMethod)      recParts.push(`Via: ${rad.receivedMethod}`);
  if (rad.receivedDestination) recParts.push(`From: ${rad.receivedDestination}`);
  if (rad.receivedDate)        recParts.push(`Date: ${rad.receivedDate}`);
  if (rad.receivedTime)        recParts.push(`Time: ${rad.receivedTime}`);

  const sentParts: string[] = [];
  if (rad.dispositionMethod)      sentParts.push(`Via: ${rad.dispositionMethod}`);
  if (rad.dispositionDestination) sentParts.push(`To: ${rad.dispositionDestination}`);
  if (rad.dispositionDate)        sentParts.push(`Date: ${rad.dispositionDate}`);
  if (rad.dispositionTime)        sentParts.push(`Time: ${rad.dispositionTime}`);

  if (recParts.length > 0 || sentParts.length > 0) {
    gap(ctx);
    section(ctx, 'RECEIVED / SENT');

    const relayRow = (label: string, parts: string[]) => {
      if (!parts.length) return;
      ensure(ctx, 21);
      txt(ctx, label, ML, ctx.y, bf, 9, GRAY);
      txt(ctx, parts.join('    '), ML + 46, ctx.y, rf, 12, DARK);
      ctx.y += 20;
    };

    relayRow("Rec'd", recParts);
    relayRow('Sent',  sentParts);
  }

  // RECEIVED AT — skip if this station is the originator
  const isOriginator = up?.callsign &&
    rad.stationOfOrigin.toUpperCase() === up.callsign.toUpperCase();

  if (!isOriginator && up) {
    const cityStateZip = [up.city, up.state, up.zip].filter(Boolean).join(', ');
    const raLines = [
      up.callsign,
      up.receivingStationName,
      up.streetAddress,
      cityStateZip || undefined,
      up.phone,
    ].filter((x): x is string => Boolean(x));

    if (raLines.length > 0) {
      gap(ctx);
      section(ctx, 'RECEIVED AT');
      for (const l of raLines) bodyLine(ctx, l, 12);
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function printRadiogramReadable(
  radiogram: Radiogram,
  userProfile?: UserProfile,
): Promise<void> {
  const doc = await PDFDocument.create();
  const rf  = await doc.embedFont(StandardFonts.Helvetica);
  const bf  = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = { doc, pages: [], rf, bf, y: MT };
  newPage(ctx);
  if (radiogram.isBook) {
    renderBookContent(ctx, radiogram, userProfile);
  } else {
    renderContent(ctx, radiogram, userProfile);
  }

  // Add "Page X of Y" in the top-right margin when the radiogram spans
  // multiple pages.
  const total = ctx.pages.length;
  if (total > 1) {
    for (let i = 0; i < total; i++) {
      const label = `Page ${i + 1} of ${total}`;
      const lw    = rf.widthOfTextAtSize(label, 8.5);
      ctx.pages[i].drawText(label, {
        x:     PW - MR - lw,
        y:     py(MT - 18),
        font:  rf,
        size:  8.5,
        color: LGRAY,
      });
    }
  }

  const bytes = await doc.save();
  const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url   = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
