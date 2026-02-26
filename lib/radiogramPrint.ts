import { PDFDocument } from 'pdf-lib';
import { Radiogram, UserProfile } from '@/types';

const WORDS_PER_FORM = 25;

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

function setField(form: ReturnType<PDFDocument['getForm']>, name: string, value: string): void {
  if (!value) return;
  try {
    form.getTextField(name).setText(value);
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
  suffix: 'Top' | 'Bottom',
  data: HalfData,
): void {
  // Preamble
  setField(form, `Number - ${suffix}`, data.number ?? '');
  setField(form, `Station Of Origin - ${suffix}`, data.stationOfOrigin ?? '');
  setField(form, `Check - ${suffix}`, data.check ?? '');
  setField(form, `Place Of Origin - ${suffix}`, data.placeOfOrigin ?? '');
  setField(form, `Time Filed - ${suffix}`, data.timeFiled ?? '');
  setField(form, `Date Filed - ${suffix}`, data.dateFiled ?? '');
  setField(form, `HX - ${suffix}`, data.hx ?? '');
  // The bottom form has a typo in the original PDF field name
  if (suffix === 'Top') {
    setField(form, 'Precedence - Top', data.precedence ?? '');
  } else {
    setField(form, 'Precidence - Bottom', data.precedence ?? '');
  }

  // Addressee
  setField(form, `Recipient Name / Call - ${suffix}`, data.recipientNameCall ?? '');
  setField(form, `Recipient Address - ${suffix}`, data.recipientAddress ?? '');
  setField(form, `Recipient City, State, & ZIP - ${suffix}`, data.recipientCityStateZip ?? '');
  setField(form, `Recipient Phone - ${suffix}`, data.recipientPhone ?? '');

  // Message words
  for (let i = 0; i < WORDS_PER_FORM; i++) {
    const num = String(i + 1).padStart(2, '0');
    setField(form, `Word ${num} - ${suffix}`, data.words[i] ?? '');
  }

  // Signature (last form only)
  setField(form, `Signature - ${suffix}`, data.signature ?? '');

  // REC'D / SENT (last form only)
  setField(form, `Received From - ${suffix}`, data.receivedFrom ?? '');
  setField(form, `Date Received - ${suffix}`, data.dateReceived ?? '');
  setField(form, `Time Received - ${suffix}`, data.timeReceived ?? '');
  setField(form, `Sent To - ${suffix}`, data.sentTo ?? '');
  setField(form, `Date Sent - ${suffix}`, data.dateSent ?? '');
  setField(form, `Time Sent - ${suffix}`, data.timeSent ?? '');

  // Receiving station info (first form only)
  setField(form, `Receiving Station - ${suffix}`, data.receivingStation ?? '');
  setField(form, `Receiving Phone - ${suffix}`, data.receivingPhone ?? '');
  setField(form, `Receiving Name - ${suffix}`, data.receivingName ?? '');
  setField(form, `Receiving Address - ${suffix}`, data.receivingAddress ?? '');
  // City/state/zip field name has slightly different punctuation between Top and Bottom in the PDF
  if (suffix === 'Top') {
    setField(form, 'Receiving City, State & ZIP - Top', data.receivingCityStateZip ?? '');
  } else {
    setField(form, 'Receiving City, State, & ZIP - Bottom', data.receivingCityStateZip ?? '');
  }
}

export async function printRadiogram(radiogram: Radiogram, userProfile?: UserProfile): Promise<void> {
  const words = radiogram.textWords.filter(w => w.length > 0);

  // Parse addressee lines into the form's separate fields
  const addressLines = radiogram.address.split('\n').map(l => l.trim()).filter(Boolean);
  const recipientNameCall = addressLines[0] ?? '';
  const recipientAddress = addressLines[1] ?? '';
  const recipientCityStateZip = addressLines.slice(2).join(' ') ?? '';

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
    const form = pdfDoc.getForm();

    fillHalf(form, 'Top', pageData.top);
    if (pageData.bottom) fillHalf(form, 'Bottom', pageData.bottom);

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
