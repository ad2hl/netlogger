import { Timestamp } from 'firebase/firestore';

// All dates and times are stored in UTC (issue #292). Date strings are
// "YYYY-MM-DD", time strings are 24-hour "HH:MM". The user's Settings choice
// (local or UTC) decides only how they are entered and displayed; the
// conversion between the stored and displayed forms happens at the UI edge.

export interface DateTimeParts {
  date: string;
  time: string;
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

function partsOf(d: Date, utc: boolean): DateTimeParts {
  return utc
    ? {
        date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
        time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`,
      }
    : {
        date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
      };
}

function parseDate(date: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function parseTime(time: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

// The instant named by a date + time pair in the given zone. A missing date
// falls back to today (it only matters for the DST offset).
function instantOf({ date, time }: DateTimeParts, utc: boolean): Date | null {
  const t = parseTime(time);
  if (!t) return null;
  const [y, mo, d] = parseDate(date) ?? (() => {
    const today = partsOf(new Date(), utc).date;
    return parseDate(today)!;
  })();
  return utc ? new Date(Date.UTC(y, mo - 1, d, t[0], t[1])) : new Date(y, mo - 1, d, t[0], t[1]);
}

// Convert a date + time pair between local and UTC. A pair without a valid
// time is returned unchanged (a bare date can't be shifted meaningfully); a
// time without a date converts the time alone.
function convert(parts: DateTimeParts, fromUtc: boolean): DateTimeParts {
  const instant = instantOf(parts, fromUtc);
  if (!instant) return parts;
  const out = partsOf(instant, !fromUtc);
  return { date: parts.date ? out.date : '', time: out.time };
}

// Stored (UTC) → displayed form
export function toDisplay(parts: DateTimeParts, utc: boolean): DateTimeParts {
  return utc ? parts : convert(parts, true);
}

// Displayed form → stored (UTC)
export function toStored(parts: DateTimeParts, utc: boolean): DateTimeParts {
  return utc ? parts : convert(parts, false);
}

// Current date and time in the displayed zone
export function nowParts(utc: boolean): DateTimeParts {
  return partsOf(new Date(), utc);
}

// --- Radiogram received/sent fields ---------------------------------------

interface RadiogramTimes {
  receivedDate?: string;
  receivedTime?: string;
  dispositionDate?: string;
  dispositionTime?: string;
}

function mapRadiogramTimes<T extends RadiogramTimes>(
  r: T,
  fn: (p: DateTimeParts) => DateTimeParts,
): T {
  const rcvd = fn({ date: r.receivedDate || '', time: r.receivedTime || '' });
  const sent = fn({ date: r.dispositionDate || '', time: r.dispositionTime || '' });
  return {
    ...r,
    receivedDate: rcvd.date,
    receivedTime: rcvd.time,
    dispositionDate: sent.date,
    dispositionTime: sent.time,
  };
}

export function radiogramTimesToDisplay<T extends RadiogramTimes>(r: T, utc: boolean): T {
  return utc ? r : mapRadiogramTimes(r, (p) => toDisplay(p, false));
}

export function radiogramTimesToStored<T extends RadiogramTimes>(r: T, utc: boolean): T {
  return utc ? r : mapRadiogramTimes(r, (p) => toStored(p, false));
}

// --- Sessions ---------------------------------------------------------------
// A session stores `date` as midnight UTC of its UTC start date, and
// `startTime`/`endTime` as UTC "HH:MM" strings.

interface SessionTimes {
  date: Timestamp;
  startTime: string;
  endTime: string | null;
}

export interface SessionDisplayTimes {
  date: string;
  startTime: string;
  endTime: string;
}

function storedSessionDate(date: Timestamp): string {
  return partsOf(date.toDate(), true).date;
}

export function sessionToDisplay(session: SessionTimes, utc: boolean): SessionDisplayTimes {
  const utcDate = storedSessionDate(session.date);
  const start = toDisplay({ date: utcDate, time: session.startTime }, utc);
  const end = session.endTime ? toDisplay({ date: utcDate, time: session.endTime }, utc).time : '';
  return { date: start.date, startTime: start.time, endTime: end };
}

export function sessionToStored(
  display: { date: string; startTime: string; endTime?: string | null },
  utc: boolean,
): SessionTimes {
  const start = toStored({ date: display.date, time: display.startTime }, utc);
  const end = display.endTime ? toStored({ date: display.date, time: display.endTime }, utc).time : null;
  const [y, m, d] = parseDate(start.date) ?? parseDate(nowParts(true).date)!;
  return {
    date: Timestamp.fromDate(new Date(Date.UTC(y, m - 1, d))),
    startTime: start.time,
    endTime: end,
  };
}

// The session's start as an instant
export function sessionStart(session: SessionTimes): Date {
  return instantOf({ date: storedSessionDate(session.date), time: session.startTime }, true)
    ?? session.date.toDate();
}

// --- Formatting ---------------------------------------------------------------

// Format a "YYYY-MM-DD" calendar date (already in the displayed zone)
export function formatDateString(date: string, options?: Intl.DateTimeFormatOptions, locale?: string): string {
  const p = parseDate(date);
  if (!p) return date;
  return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(locale, options);
}

// Format an "HH:MM" time (already in the displayed zone): "1024Z" in UTC
// mode, otherwise unchanged
export function formatTimeString(time: string, utc: boolean): string {
  const t = parseTime(time);
  if (!t || !utc) return time;
  return `${pad2(t[0])}${pad2(t[1])}Z`;
}

// Format an instant's date in the displayed zone
export function formatDate(d: Date, utc: boolean, options?: Intl.DateTimeFormatOptions, locale?: string): string {
  return d.toLocaleDateString(locale, utc ? { ...options, timeZone: 'UTC' } : options);
}

// Format an instant's time in the displayed zone
export function formatTime(d: Date, utc: boolean): string {
  return utc
    ? formatTimeString(partsOf(d, true).time, true)
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// "HH:MM" → "HHMM" for printed forms, with a trailing Z in UTC mode
export function formatPrintTime(time: string | undefined, utc: boolean): string {
  if (!time) return '';
  const compact = time.replace(':', '');
  return utc && /^\d{4}$/.test(compact) ? `${compact}Z` : compact;
}

// Calendar date of an instant in the displayed zone, as "YYYY-MM-DD"
export function dateStringOf(d: Date, utc: boolean): string {
  return partsOf(d, utc).date;
}
