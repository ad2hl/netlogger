import { BookEntry, CheckIn, NetSession, CustomTag, Radiogram, isStatusTag } from '@/types';

export function generateRadiogramId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

interface RadiogramData {
  session: NetSession;
  userCallsign: string;
  userName: string;
  userLocation: string;
  addresseeCallsign: string;
  messageNumber?: string;
  customTags?: CustomTag[];
}

function getCallsignPrefix(callsign: string): string {
  const match = callsign.match(/^([A-Z]+\d+)/);
  return match ? match[1] : callsign;
}

function getCallsignSuffix(callsign: string): string {
  const prefix = getCallsignPrefix(callsign);
  return callsign.slice(prefix.length);
}

export function compressCallsigns(callsigns: string[]): string[] {
  if (callsigns.length === 0) return [];

  const sorted = [...callsigns].sort();
  const result: string[] = [];
  let currentPrefix = '';

  for (const callsign of sorted) {
    const prefix = getCallsignPrefix(callsign);
    const suffix = getCallsignSuffix(callsign);

    if (prefix === currentPrefix && result.length > 0) {
      result.push(suffix);
    } else {
      result.push(callsign);
      currentPrefix = prefix;
    }
  }

  return result;
}

function formatCallsignWithTags(callsign: string, tags: string[], statusOnlyTags: Set<string>): string {
  // Include all tags except built-in status tags and custom tags marked as status-only
  const reportTags = tags.filter(t => !isStatusTag(t) && !statusOnlyTags.has(t));
  if (reportTags.length === 0) {
    return callsign;
  }
  return `${callsign}/${reportTags.join('/')}`;
}

function formatCheckInsForReport(
  checkIns: CheckIn[],
  statusOnlyTags: Set<string>
): string[] {
  // Order: NC first, then ANC, then liaisons (in check-in order), then regular stations (alphabetized & compressed)
  const ncStations: string[] = [];
  const ancStations: string[] = [];
  const liaisonStations: string[] = [];
  const regularStations: string[] = [];

  // A tag is a liaison tag if it's multi-letter (except NC, ANC, IO) and not marked status-only
  const isLiaisonTag = (t: string) =>
    t.length > 1 && t !== 'NC' && t !== 'ANC' && t !== 'IO' && !statusOnlyTags.has(t);

  for (const checkIn of checkIns) {
    const callsign = checkIn.callsign.toUpperCase();
    const tags = checkIn.tags || [];
    const callsignWithTags = formatCallsignWithTags(callsign, tags, statusOnlyTags);

    if (tags.includes('NC')) {
      ncStations.push(callsignWithTags);
    } else if (tags.includes('ANC')) {
      ancStations.push(callsignWithTags);
    } else if (tags.some(isLiaisonTag)) {
      liaisonStations.push(callsignWithTags);
    } else {
      regularStations.push(callsign);
    }
  }

  // Only regular stations get sorted and compressed
  const compressedRegular = compressCallsigns(regularStations.sort());

  return [
    ...ncStations,           // NC first (check-in order, typically just one)
    ...ancStations,          // ANC next (check-in order)
    ...liaisonStations,      // Liaisons in check-in order
    ...compressedRegular,    // Regular stations alphabetized and compressed
  ];
}

function formatWordsPerLine(words: string[], wordsPerLine: number = 5): string {
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(' '));
  }
  return lines.join('\n');
}

function getMonthName(date: Date): string {
  const months = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  return months[date.getMonth()];
}

function calculateElapsedTime(startTime: string, endTime: string): string {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  return totalMinutes.toString();
}

export interface RadiogramResult {
  text: string;
  wordCount: number;
  parts: {
    number: string;
    precedence: string;
    stationOfOrigin: string;
    check: string;
    placeOfOrigin: string;
    date: string;
    addressee: string;
    bodyWords: string[];
    signature: string;
  };
}

export function generateRadiogram(data: RadiogramData): RadiogramResult {
  const { session, userCallsign, userName, userLocation, addresseeCallsign, messageNumber } = data;

  const sessionDate = session.date.toDate();
  const dayOfMonth = sessionDate.getDate();
  const month = getMonthName(sessionDate);

  const statusOnlyTags = new Set(
    (data.customTags ?? []).filter(ct => ct.inReport === false).map(ct => ct.acronym)
  );
  const formattedCallsigns = formatCheckInsForReport(session.checkIns, statusOnlyTags);

  const stationCount = session.checkIns.length;
  const trafficStr = `${session.trafficReported}/${session.trafficCleared}`;
  const elapsedTime = session.endTime
    ? calculateElapsedTime(session.startTime, session.endTime)
    : 'ONGOING';

  // Body: netname, day of month, month, station count, traffic, elapsed time, callsigns
  const bodyWords: string[] = [
    session.netName.toUpperCase().replace(/\s+/g, ''),
    dayOfMonth.toString(),
    month,
    stationCount.toString(),
    trafficStr,
    elapsedTime,
    ...formattedCallsigns,
  ];

  const wordCount = bodyWords.length;
  const number = messageNumber || 'XXX';

  // Preamble: NUMBER R CALLSIGN CHECK LOCATION DATE
  const preamble = `${number} R ${userCallsign.toUpperCase()} ${wordCount} ${userLocation.toUpperCase()} ${month} ${dayOfMonth}`;

  // Addressee
  const addressee = addresseeCallsign.toUpperCase();

  // Body formatted 5 words per line
  const bodyFormatted = formatWordsPerLine(bodyWords);

  // Signature
  const signature = `${userName.toUpperCase()} ${userCallsign.toUpperCase()}`;

  // Full radiogram with BT separators (no blank lines)
  const fullRadiogram = [
    preamble,
    addressee,
    'BT',
    bodyFormatted,
    'BT',
    signature,
  ].join('\n');

  return {
    text: fullRadiogram,
    wordCount,
    parts: {
      number,
      precedence: 'R',
      stationOfOrigin: userCallsign.toUpperCase(),
      check: wordCount.toString(),
      placeOfOrigin: userLocation.toUpperCase(),
      date: `${month} ${dayOfMonth}`,
      addressee,
      bodyWords,
      signature,
    },
  };
}

export function formatRadiogramAsText(radiogram: Radiogram): string {
  if (radiogram.isBook) return formatBookAsText(radiogram);

  const preamble = [
    radiogram.number,
    radiogram.precedence,
    radiogram.handlingInstructions || '',
    radiogram.stationOfOrigin,
    radiogram.check,
    radiogram.placeOfOrigin,
    radiogram.timeFiled,
    radiogram.date,
  ].filter(Boolean).join(' ');

  const bodyFormatted = formatWordsPerLine(radiogram.textWords);

  // addressPhone is legacy — phone is now an address line, but old documents may still have it
  const address = [radiogram.address, radiogram.addressPhone].filter(Boolean).join('\n');
  const addressLines = withOpNoteLine(address, radiogram.addressOpNote);
  const signatureLines = withOpNoteLine(radiogram.signature, radiogram.signatureOpNote);

  return [
    preamble,
    ...addressLines,
    'BT',
    bodyFormatted,
    'BT',
    ...signatureLines,
  ].join('\n');
}

// Op Notes get their own "OP NOTE <text>" line — never parenthesized (issue #277).
function withOpNoteLine(base: string, opNote: string | undefined): string[] {
  const lines = base ? base.split('\n') : [];
  return opNote ? [...lines, `OP NOTE ${opNote}`] : lines;
}

export function isBookEntryEmpty(entry: BookEntry): boolean {
  return !entry.number && !entry.address &&
    !entry.addressOpNote && !entry.otherVariables;
}

// Book text format (ARRL MPG 2.3.4): fixed parts once, then each message's
// variable parts, e.g.
//   BK 2 R HXG AD2HL 2 HARTSDALE NY MARCH 22 / BT / <text> / BT / <signature>
//   / BT / 123 / <address> / BT / 124 / <address> / AR
export function formatBookAsText(book: Radiogram): string {
  const preamble = [
    `BK ${book.number}`,
    book.precedence,
    book.handlingInstructions || '',
    book.stationOfOrigin,
    book.check,
    book.placeOfOrigin,
    book.timeFiled,
    book.date,
  ].filter(Boolean).join(' ');

  const signatureLines = withOpNoteLine(book.signature, book.signatureOpNote);

  const lines: string[] = [
    preamble,
    'BT',
    formatWordsPerLine(book.textWords),
    'BT',
    ...signatureLines,
  ];

  for (const entry of (book.bookEntries ?? []).filter(e => !isBookEntryEmpty(e))) {
    lines.push('BT');
    lines.push(entry.number);
    if (entry.address) lines.push(entry.address);
    if (entry.addressOpNote) lines.push(`OP NOTE ${entry.addressOpNote}`);
    if (entry.otherVariables) lines.push(entry.otherVariables);
  }
  lines.push('AR');

  return lines.join('\n');
}

// Expand a book into the individual radiograms it represents (ARRL MPG 2.3.4).
// Timestamps are left unset; the db layer stamps them at write time.
export function explodeBook(book: Radiogram): Radiogram[] {
  return (book.bookEntries ?? [])
    .filter(e => !isBookEntryEmpty(e))
    .map(entry => ({
      ...book,
      id: generateRadiogramId(),
      number: entry.number,
      address: entry.address,
      addressPhone: '',
      addressOpNote: entry.addressOpNote,
      bookVariable: entry.otherVariables || '',
      isBook: false,
      bookEntries: [],
      createdAt: undefined,
      savedAt: undefined,
    }));
}

const MONTH_NAMES = new Set([
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]);

function parsePreambleLine(line: string): {
  number: string;
  precedence: string;
  handlingInstructions: string;
  stationOfOrigin: string;
  check: string;
  placeOfOrigin: string;
  timeFiled: string;
  date: string;
} {
  const tokens = line.toUpperCase().trim().split(/\s+/);
  let i = 0;

  // Skip non-digit prefix tokens (e.g., "NR", "NBR", "MSG NBR")
  while (i < tokens.length && !/^\d+$/.test(tokens[i])) i++;

  const number = tokens[i++] ?? '';
  const precedence = tokens[i++] ?? '';

  // Optional handling instructions (token starting with HX)
  let handlingInstructions = '';
  if (i < tokens.length && tokens[i].startsWith('HX')) {
    handlingInstructions = tokens[i++];
  }

  const stationOfOrigin = tokens[i++] ?? '';
  const check = tokens[i++] ?? '';

  // Remaining: PLACE_OF_ORIGIN [TIME] MONTH DAY
  const remaining = tokens.slice(i);
  let placeEnd = remaining.length;
  let date = '';
  let timeFiled = '';

  if (remaining.length >= 2) {
    const last = remaining[remaining.length - 1];
    const secondLast = remaining[remaining.length - 2];
    if (/^\d{1,2}$/.test(last) && MONTH_NAMES.has(secondLast)) {
      date = `${secondLast} ${last}`;
      placeEnd = remaining.length - 2;
      // Optional TIME (4-digit HHMM) immediately before month
      if (placeEnd > 0 && /^\d{4}$/.test(remaining[placeEnd - 1])) {
        timeFiled = remaining[placeEnd - 1];
        placeEnd--;
      }
    }
  }

  return {
    number,
    precedence,
    handlingInstructions,
    stationOfOrigin,
    check,
    placeOfOrigin: remaining.slice(0, placeEnd).join(' '),
    timeFiled,
    date,
  };
}

function parseAddressBlock(lines: string[]): {
  address: string;
  addressOpNote: string;
} {
  // All lines go into address verbatim (phone/email are just address lines).
  // Nothing is separated into addressOpNote.
  return {
    address: lines.join('\n').toUpperCase(),
    addressOpNote: '',
  };
}

export function parseDtnRadiogram(raw: string): Partial<Omit<import('@/types').Radiogram, 'id'>> {
  const lines = raw.trim().split(/\r?\n/).map(l => l.trim());

  const btIndices: number[] = [];
  lines.forEach((l, i) => { if (l.toUpperCase() === 'BT') btIndices.push(i); });

  if (btIndices.length < 2) {
    throw new Error('Could not find two BT separators in the pasted text.');
  }

  const [bt1, bt2] = btIndices;
  const preamble = parsePreambleLine(lines[0]);
  const { address, addressOpNote } = parseAddressBlock(lines.slice(1, bt1));
  const textWords = lines.slice(bt1 + 1, bt2)
    .flatMap(l => l.toUpperCase().split(/\s+/).filter(Boolean));
  const signature = lines.slice(bt2 + 1).filter(l => l.length > 0).join('\n').toUpperCase().trim();

  return {
    ...preamble,
    address,
    addressOpNote,
    textWords,
    signature,
    signatureOpNote: '',
  };
}

export function parseCallsignInput(input: string): {
  callsign: string;
  tags: string[];
} {
  const trimmed = input.trim().toUpperCase();
  const parts = trimmed.split('/');

  // First part is the callsign
  const callsign = parts[0].trim();

  // Remaining parts are tags (NC, ANC, T, A, or liaison net names)
  const tags = parts.slice(1)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  return { callsign, tags };
}
