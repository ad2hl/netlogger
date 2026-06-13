import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { Radiogram, UserProfile } from '@/types';

const WORDS_PER_FORM = 25;

const FONT_SIZE_WORDS = 11;   // message text words only
const FONT_SIZE_ADDRESS = 10; // addressee name/address lines
const FONT_SIZE_OTHER = 9;    // preamble, signature, RECEIVED AT, REC'D/SENT

function formatPrintDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
  return dateStr;
}

function formatPrintTime(timeStr: string | undefined): string {
  if (!timeStr) return '';
  return timeStr.replace(':', '');
}

function setField(
  form: ReturnType<PDFDocument['getForm']>,
  font: PDFFont,
  name: string,
  value: string,
  fontSize: number,
): void {
  if (!value) return;
  try {
    const field = form.getTextField(name);
    field.setText(value);
    field.setFontSize(fontSize);
    field.updateAppearances(font);
  } catch {
    // Field doesn't exist in this PDF — ignore
  }
}

interface HalfData {
  // Preamble (first form only)
  number?: string;
  precedence?: string;
  hx?: string;
  stationOfOrigin?: string;
  check?: string;
  placeOfOrigin?: string;
  timeFiled?: string;
  dateFiled?: string;
  // Addressee (first form only)
  recipientNameCall?: string;
  recipientAddress?: string;
  recipientCityStateZip?: string;
  recipientLine4?: string;  // 4th address line — drawn as free text after flatten
  recipientLine5?: string;  // 5th address line — drawn below line 4 if space permits
  // Message words for this form (up to 25)
  words: string[];
  // Signature (last form only)
  signature?: string;
  // REC'D / SENT (last form only)
  receivedFrom?: string;
  dateReceived?: string;
  timeReceived?: string;
  sentTo?: string;
  dateSent?: string;
  timeSent?: string;
  // Receiving station info (first form only)
  receivingStation?: string;
  receivingPhone?: string;
  receivingName?: string;
  receivingAddress?: string;
  receivingCityStateZip?: string;
}

function fillHalf(
  form: ReturnType<PDFDocument['getForm']>,
  font: PDFFont,
  suffix: 'Top' | 'Bottom',
  data: HalfData,
): void {
  const set = (name: string, value: string, fontSize = FONT_SIZE_OTHER) =>
    setField(form, font, name, value, fontSize);

  // Preamble
  set(`Number - ${suffix}`, data.number ?? '');
  set(`Station Of Origin - ${suffix}`, data.stationOfOrigin ?? '');
  set(`Check - ${suffix}`, data.check ?? '');
  set(`Place Of Origin - ${suffix}`, data.placeOfOrigin ?? '');
  set(`Time Filed - ${suffix}`, data.timeFiled ?? '');
  set(`Date Filed - ${suffix}`, data.dateFiled ?? '');
  set(`HX - ${suffix}`, data.hx ?? '');
  // The bottom form has a typo in the original PDF field name
  if (suffix === 'Top') {
    set('Precedence - Top', data.precedence ?? '');
  } else {
    set('Precidence - Bottom', data.precedence ?? '');
  }

  // Addressee — one line per field (lines 4-5 are drawn as free text after flatten)
  set(`Recipient Name / Call - ${suffix}`, data.recipientNameCall ?? '', FONT_SIZE_ADDRESS);
  set(`Recipient Address - ${suffix}`, data.recipientAddress ?? '', FONT_SIZE_ADDRESS);
  set(`Recipient City, State, & ZIP - ${suffix}`, data.recipientCityStateZip ?? '', FONT_SIZE_ADDRESS);

  // Message words — larger font
  for (let i = 0; i < WORDS_PER_FORM; i++) {
    const num = String(i + 1).padStart(2, '0');
    set(`Word ${num} - ${suffix}`, data.words[i] ?? '', FONT_SIZE_WORDS);
  }

  // Signature (last form only)
  set(`Signature - ${suffix}`, data.signature ?? '');

  // REC'D / SENT (last form only)
  set(`Received From - ${suffix}`, data.receivedFrom ?? '');
  set(`Date Received - ${suffix}`, data.dateReceived ?? '');
  set(`Time Received - ${suffix}`, data.timeReceived ?? '');
  set(`Sent To - ${suffix}`, data.sentTo ?? '');
  set(`Date Sent - ${suffix}`, data.dateSent ?? '');
  set(`Time Sent - ${suffix}`, data.timeSent ?? '');

  // Receiving station info (first form only)
  set(`Receiving Station - ${suffix}`, data.receivingStation ?? '');
  set(`Receiving Phone - ${suffix}`, data.receivingPhone ?? '');
  set(`Receiving Name - ${suffix}`, data.receivingName ?? '');
  set(`Receiving Address - ${suffix}`, data.receivingAddress ?? '');
  // City/state/zip field name has slightly different punctuation between Top and Bottom in the PDF
  if (suffix === 'Top') {
    set('Receiving City, State & ZIP - Top', data.receivingCityStateZip ?? '');
  } else {
    set('Receiving City, State, & ZIP - Bottom', data.receivingCityStateZip ?? '');
  }
}

// PDF coordinates (y increases upward) for the phone-row area in each half.
// The "TELEPHONE NUMBER" label occupies x=[addrX, phoneX) in the same row as the
// Recipient Phone form field. We cover both with white and draw lines 4-5 as free text.
const PHONE_AREA = {
  Top:    { addrX: 63.3, phoneY: 609.2, phoneH: 15.7, addrW: 262.4 },
  Bottom: { addrX: 63.2, phoneY: 222.4, phoneH: 15.7, addrW: 262.4 },
} as const;

// When both line 4 and line 5 are present, extend the cover area downward so
// line 5 text (baseline below phoneY) is on a white background.
const LINE5_DROP = 4.7; // pts below phoneY for line-5 baseline

function drawAddressLines45(
  page: PDFPage,
  font: PDFFont,
  suffix: 'Top' | 'Bottom',
  line4: string,
  line5: string,
): void {
  if (!line4 && !line5) return;

  const { addrX, phoneY, phoneH, addrW } = PHONE_AREA[suffix];
  const white = rgb(1, 1, 1);
  const black = rgb(0, 0, 0);

  // White rectangle covers: label area + phone field + (if line5) gap below
  const coverY = line5 ? phoneY - LINE5_DROP : phoneY;
  page.drawRectangle({ x: addrX, y: coverY, width: addrW, height: phoneY + phoneH - coverY, color: white, borderWidth: 0 });

  if (line4) {
    // With two lines: position line 4 near the top of the phone field.
    // With one line: vertically centre it in the field.
    const baseline4 = line5
      ? phoneY + phoneH - 7.5   // caps top ≈ phoneY + phoneH - 0.2
      : phoneY + phoneH - 12;   // caps top ≈ phoneY + phoneH - 4.7
    page.drawText(line4, { x: addrX + 1, y: baseline4, size: FONT_SIZE_ADDRESS, font, color: black });
  }

  if (line5) {
    // Line 5 baseline just below the phone field; caps ascenders land inside the
    // covered (white) area so they don't bleed onto other form content.
    page.drawText(line5, { x: addrX + 1, y: phoneY - LINE5_DROP, size: FONT_SIZE_ADDRESS, font, color: black });
  }
}

export async function printRadiogram(radiogram: Radiogram, userProfile?: UserProfile): Promise<void> {
  const words = radiogram.textWords.filter(w => w.length > 0);

  // Map address lines to the 4 addressee fields on the ARRL form.
  // The 4th field occupies the space that was formerly labelled TELEPHONE NUMBER.
  const addressLines = radiogram.address.split('\n').map(l => l.trim()).filter(Boolean);

  const recipientNameCall = addressLines[0] ?? '';
  const recipientAddress = addressLines[1] ?? '';
  const recipientCityStateZip = addressLines[2] ?? '';
  const recipientLine4 = addressLines[3] ?? '';
  const recipientLine5 = addressLines[4] ?? '';

  // Receiving station info from user profile.
  // Skip if the local station is the originator — they sent it, not received it.
  const isOriginator = userProfile?.callsign &&
    radiogram.stationOfOrigin.toUpperCase() === userProfile.callsign.toUpperCase();

  const receivingCityStateZip = isOriginator
    ? undefined
    : [userProfile?.city, userProfile?.state, userProfile?.zip].filter(Boolean).join(', ') || undefined;

  // Preamble data — appears on first form only
  const preambleData = {
    number: radiogram.number,
    precedence: radiogram.precedence,
    hx: radiogram.handlingInstructions,
    stationOfOrigin: radiogram.stationOfOrigin,
    check: radiogram.check,
    placeOfOrigin: radiogram.placeOfOrigin,
    timeFiled: radiogram.timeFiled,
    dateFiled: radiogram.date,
    recipientNameCall,
    recipientAddress,
    recipientCityStateZip,
    recipientLine4,
    recipientLine5,
    receivingStation: isOriginator ? undefined : userProfile?.callsign,
    receivingPhone: isOriginator ? undefined : userProfile?.phone,
    receivingName: isOriginator ? undefined : userProfile?.receivingStationName,
    receivingAddress: isOriginator ? undefined : userProfile?.streetAddress,
    receivingCityStateZip,
  };

  // Disposition data — appears on last form only
  const dispositionData = {
    receivedFrom: radiogram.receivedDestination,
    dateReceived: formatPrintDate(radiogram.receivedDate),
    timeReceived: formatPrintTime(radiogram.receivedTime),
    sentTo: radiogram.dispositionDestination,
    dateSent: formatPrintDate(radiogram.dispositionDate),
    timeSent: formatPrintTime(radiogram.dispositionTime),
  };

  // Split words into 25-word chunks, one chunk per form half
  const chunks: string[][] = [];
  if (words.length === 0) {
    chunks.push([]);
  } else {
    for (let i = 0; i < words.length; i += WORDS_PER_FORM) {
      chunks.push(words.slice(i, i + WORDS_PER_FORM));
    }
  }

  // Build a HalfData for each chunk
  const halves: HalfData[] = chunks.map((chunk, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === chunks.length - 1;
    return {
      ...(isFirst ? preambleData : {}),
      words: chunk,
      signature: isLast ? radiogram.signature : undefined,
      ...(isLast ? dispositionData : {}),
    };
  });

  // Pair halves into physical pages (Top + Bottom per page).
  // If there is only one half, only the Top form is filled; Bottom is left blank.
  const pages: Array<{ top: HalfData; bottom: HalfData | null }> = [];
  for (let i = 0; i < halves.length; i += 2) {
    pages.push({ top: halves[i], bottom: halves[i + 1] ?? null });
  }

  // Fetch the blank form PDF
  const response = await fetch('/radiogram-form.pdf');
  const formBytes = await response.arrayBuffer();

  // Build the output PDF one page at a time.
  // Each page is filled, flattened, then copied into the final document to
  // avoid field-name conflicts across pages.
  let finalDoc: PDFDocument | null = null;

  for (const pageData of pages) {
    const pdfDoc = await PDFDocument.load(formBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const form = pdfDoc.getForm();

    fillHalf(form, font, 'Top', pageData.top);
    if (pageData.bottom) fillHalf(form, font, 'Bottom', pageData.bottom);

    // Flatten first so form-field appearances are baked into the page stream,
    // then draw lines 4-5 on top (white cover + free text overrides the label).
    form.flatten();

    const page = pdfDoc.getPages()[0];
    drawAddressLines45(page, font, 'Top', pageData.top.recipientLine4 ?? '', pageData.top.recipientLine5 ?? '');
    if (pageData.bottom) {
      drawAddressLines45(page, font, 'Bottom', pageData.bottom.recipientLine4 ?? '', pageData.bottom.recipientLine5 ?? '');
    }

    const flatBytes = await pdfDoc.save();
    const flatDoc = await PDFDocument.load(flatBytes);

    if (!finalDoc) {
      finalDoc = flatDoc;
    } else {
      const [page] = await finalDoc.copyPages(flatDoc, [0]);
      finalDoc.addPage(page);
    }
  }

  if (!finalDoc) return;

  const pdfBytes = await finalDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
