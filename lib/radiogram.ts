import { CheckIn, NetSession, Station, isStatusTag } from '@/types';

interface RadiogramData {
  session: NetSession;
  stations: Map<string, Station>;
  userCallsign: string;
  userName: string;
  userLocation: string;
  addresseeCallsign: string;
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

function formatCallsignWithTags(callsign: string, tags: string[]): string {
  // Include all tags except status tags (single letters like T, A, M, P, S, E, D, etc. and IO)
  const reportTags = tags.filter(t => !isStatusTag(t));
  if (reportTags.length === 0) {
    return callsign;
  }
  return `${callsign}/${reportTags.join('/')}`;
}

function formatCheckInsForReport(
  checkIns: CheckIn[]
): string[] {
  // Order: NC first, then ANC, then liaisons (in check-in order), then regular stations (alphabetized & compressed)
  const ncStations: string[] = [];
  const ancStations: string[] = [];
  const liaisonStations: string[] = [];
  const regularStations: string[] = [];

  for (const checkIn of checkIns) {
    const callsign = checkIn.callsign.toUpperCase();
    const tags = checkIn.tags || [];
    const callsignWithTags = formatCallsignWithTags(callsign, tags);

    // A tag is a liaison tag if it's multi-letter (except NC, ANC)
    const isLiaisonTag = (t: string) => t.length > 1 && t !== 'NC' && t !== 'ANC' && t !== 'IO';

    if (tags.includes('NC')) {
      ncStations.push(callsignWithTags);
    } else if (tags.includes('ANC')) {
      ancStations.push(callsignWithTags);
    } else if (tags.some(isLiaisonTag)) {
      // Has a liaison tag (multi-letter, not NC/ANC/IO)
      liaisonStations.push(callsignWithTags);
    } else {
      regularStations.push(callsign); // No tags for regular stations
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

export function generateRadiogram(data: RadiogramData): { text: string; wordCount: number } {
  const { session, userCallsign, userName, userLocation, addresseeCallsign } = data;

  const sessionDate = session.date.toDate();
  const dayOfMonth = sessionDate.getDate();
  const month = getMonthName(sessionDate);

  const formattedCallsigns = formatCheckInsForReport(session.checkIns);

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

  // Preamble: XXX R CALLSIGN CHECK LOCATION DATE
  const preamble = `XXX R ${userCallsign.toUpperCase()} ${wordCount} ${userLocation.toUpperCase()} ${month} ${dayOfMonth}`;

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

  return { text: fullRadiogram, wordCount };
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
