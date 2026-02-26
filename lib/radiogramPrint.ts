import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { Radiogram, UserProfile } from '@/types';

const WORDS_PER_FORM = 25;

const FONT_SIZE_WORDS = 11;   // message text words only
const FONT_SIZE_ADDRESS = 10; // addressee name/address/phone
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
  recipientPhone?: string;
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

  // Addressee — Recipient Address is multiline to accommodate street + apt/suite lines
  set(`Recipient Name / Call - ${suffix}`, data.recipientNameCall ?? '', FONT_SIZE_ADDRESS);
  try { form.getTextField(`Recipient Address - ${suffix}`).enableMultiline(); } catch { /* ignore */ }
  set(`Recipient Address - ${suffix}`, data.recipientAddress ?? '', FONT_SIZE_ADDRESS);
  set(`Recipient City, State, & ZIP - ${suffix}`, data.recipientCityStateZip ?? '', FONT_SIZE_ADDRESS);
  set(`Recipient Phone - ${suffix}`, data.recipientPhone ?? '', FONT_SIZE_ADDRESS);

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

export async function printRadiogram(radiogram: Radiogram, userProfile?: UserProfile): Promise<void> {
  const words = radiogram.textWords.filter(w => w.length > 0);

  // Parse addressee lines into the form's separate fields.
  // Line 0 → Name/Call; last line → City/State/ZIP; middle lines → Address (multiline).
  const addressLines = radiogram.address.split('\n').map(l => l.trim()).filter(Boolean);
  const recipientNameCall = addressLines[0] ?? '';
  const recipientAddress = addressLines.length >= 3 ? addressLines.slice(1, -1).join('\n') : (addressLines[1] ?? '');
  const recipientCityStateZip = addressLines.length >= 3 ? (addressLines[addressLines.length - 1] ?? '') : '';

  // Receiving station info from user profile
  const receivingCityStateZip = [userProfile?.city, userProfile?.state, userProfile?.zip]
    .filter(Boolean)
    .join(', ');

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
    recipientPhone: radiogram.addressPhone,
    receivingStation: userProfile?.callsign,
    receivingPhone: userProfile?.phone,
    receivingName: userProfile?.receivingStationName,
    receivingAddress: userProfile?.streetAddress,
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

    // Flatten so the output contains static text, not interactive fields
    form.flatten();

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
