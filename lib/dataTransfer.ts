// Export and import of a user's whole database as a JSON text file (issue #331),
// primarily to copy data between the web and desktop versions of the app.
//
// Export writes the settings profile, stations, sessions and radiograms with all
// timestamps as ISO 8601 strings, so the file can be read and edited by hand.
//
// By default import never deletes anything:
//   - settings are replaced by the file's settings
//   - sessions and radiograms are always added as new records with new IDs (an
//     imported session identical to an existing one becomes a second session);
//     session ↔ radiogram links are re-pointed at the new IDs
//   - stations are added, or merged into an existing station with the same
//     callsign (the file's non-empty fields win; the later lastSeen is kept)
// With { replaceExisting: true } all existing stations, sessions and radiograms
// are deleted first, so restoring a backup doesn't create duplicates.
import { Timestamp } from 'firebase/firestore';
import { db } from './db/index';
import { getBaseCallsign } from './callsign';
import { generateRadiogramId } from './radiogram';
import { Station, NetSession, Radiogram, UserProfile, CheckIn, NetReport } from '@/types';

export const EXPORT_FORMAT = 'netlogger-export';
export const EXPORT_VERSION = 1;

// JSON-safe form of a record: Timestamps and Dates become ISO strings
type Plain<T> = T extends Timestamp | Date
  ? string
  : T extends (infer U)[]
    ? Plain<U>[]
    : T extends object
      ? { [K in keyof T]: Plain<T[K]> }
      : T;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  source: 'web' | 'desktop';
  settings: UserProfile | null;
  stations: Plain<Station>[];
  sessions: Plain<NetSession>[];
  radiograms: Plain<Radiogram>[];
}

export interface ImportSummary {
  hasSettings: boolean;
  stations: number;
  sessions: number;
  radiograms: number;
  exportedAt?: string;
  source?: string;
}

export interface ImportOptions {
  replaceExisting?: boolean;
}

export interface ImportResult {
  existingDeleted: boolean;
  settingsReplaced: boolean;
  stationsAdded: number;
  stationsUpdated: number;
  sessionsAdded: number;
  radiogramsAdded: number;
  failures: number;
}

function isTimestampLike(value: unknown): value is { toDate(): Date } {
  return typeof value === 'object' && value !== null && typeof (value as { toDate?: unknown }).toDate === 'function';
}

// Recursively converts Timestamps/Dates to ISO strings and drops undefined values
function toPlain(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (isTimestampLike(value)) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = toPlain(v);
    }
    return out;
  }
  return value;
}

// Removes undefined properties (Firestore rejects them) from plain objects,
// leaving Timestamps and Dates intact
function dropUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(dropUndefined) as T;
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = dropUndefined(v);
    }
    return out as T;
  }
  return value;
}

export async function exportDatabase(uid: string): Promise<string> {
  const [settings, stations, sessions, radiograms] = await Promise.all([
    db.getUserProfile(uid),
    db.getAllStations(uid),
    db.getAllSessions(uid),
    db.getAllRadiograms(uid),
  ]);
  const file: ExportFile = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    source: process.env.NEXT_PUBLIC_DESKTOP_MODE === 'true' ? 'desktop' : 'web',
    settings: settings ? (toPlain(settings) as UserProfile) : null,
    stations: toPlain(stations) as Plain<Station>[],
    sessions: toPlain(sessions) as Plain<NetSession>[],
    radiograms: toPlain(radiograms) as Plain<Radiogram>[],
  };
  return JSON.stringify(file, null, 2) + '\n';
}

export function exportFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `netlogger-export-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

// Parses and validates an export file; throws an Error with a user-facing message
export function parseExportFile(text: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`The file is not valid JSON: ${(error as Error).message}`);
  }
  if (typeof data !== 'object' || data === null || (data as { format?: unknown }).format !== EXPORT_FORMAT) {
    throw new Error('The file is not a NetLogger export file.');
  }
  const file = data as Partial<ExportFile>;
  if (typeof file.version !== 'number' || file.version > EXPORT_VERSION) {
    throw new Error(`Unsupported export file version ${file.version}. Update NetLogger and try again.`);
  }
  for (const key of ['stations', 'sessions', 'radiograms'] as const) {
    if (file[key] === undefined) file[key] = [];
    if (!Array.isArray(file[key])) throw new Error(`"${key}" in the file must be a list.`);
  }
  if (file.settings !== undefined && file.settings !== null && typeof file.settings !== 'object') {
    throw new Error('"settings" in the file must be an object.');
  }
  file.stations!.forEach((s, i) => {
    if (!s || typeof s.callsign !== 'string' || !s.callsign.trim()) {
      throw new Error(`Station ${i + 1} in the file has no callsign.`);
    }
  });
  file.sessions!.forEach((s, i) => {
    if (!s || typeof s.date !== 'string' || isNaN(Date.parse(s.date))) {
      throw new Error(`Session ${i + 1} in the file has a missing or invalid date.`);
    }
  });
  file.radiograms!.forEach((r, i) => {
    if (!r || typeof r !== 'object') throw new Error(`Radiogram ${i + 1} in the file is not an object.`);
  });
  return file as ExportFile;
}

export function summarizeExportFile(file: ExportFile): ImportSummary {
  return {
    hasSettings: !!file.settings,
    stations: file.stations.length,
    sessions: file.sessions.length,
    radiograms: file.radiograms.length,
    exportedAt: file.exportedAt,
    source: file.source,
  };
}

function toTimestamp(value: unknown): Timestamp | undefined {
  if (typeof value !== 'string') return undefined;
  const ms = Date.parse(value);
  return isNaN(ms) ? undefined : Timestamp.fromMillis(ms);
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

function stationFromFile(s: Plain<Station>): Station {
  return dropUndefined({
    callsign: getBaseCallsign(s.callsign.trim().toUpperCase()),
    firstName: str(s.firstName),
    nickname: str(s.nickname),
    city: str(s.city),
    state: str(s.state),
    note: str(s.note),
    lastSeen: toTimestamp(s.lastSeen) ?? Timestamp.now(),
    grantDate: s.grantDate,
  });
}

// The file's non-empty fields win over the existing station's
function mergeStation(existing: Station, imported: Station): Station {
  const pick = (k: 'firstName' | 'nickname' | 'city' | 'state' | 'note') => imported[k] ?? existing[k];
  return dropUndefined({
    ...existing,
    firstName: pick('firstName'),
    nickname: pick('nickname'),
    city: pick('city'),
    state: pick('state'),
    note: pick('note'),
    lastSeen: imported.lastSeen.toMillis() > (existing.lastSeen?.toMillis?.() ?? 0) ? imported.lastSeen : existing.lastSeen,
    grantDate: imported.grantDate !== undefined && imported.grantDate !== null ? imported.grantDate : existing.grantDate,
  });
}

function reportFromFile(r: Plain<NetReport> | undefined): NetReport | undefined {
  if (!r || typeof r !== 'object') return undefined;
  return {
    ...(r as unknown as NetReport),
    startDateTime: toTimestamp(r.startDateTime) ?? Timestamp.now(),
    savedAt: toTimestamp(r.savedAt),
  };
}

function sessionFromFile(s: Plain<NetSession>, radiogramIds: string[]): Omit<NetSession, 'id'> {
  const { id: _id, ...rest } = s;
  const checkIns: CheckIn[] = (Array.isArray(s.checkIns) ? s.checkIns : []).map((c) => ({
    ...c,
    tags: Array.isArray(c.tags) ? c.tags : [],
    timestamp: c.timestamp && !isNaN(Date.parse(c.timestamp)) ? new Date(c.timestamp) : new Date(),
  }));
  return dropUndefined({
    ...(rest as unknown as Omit<NetSession, 'id'>),
    netName: s.netName ?? '',
    date: toTimestamp(s.date)!,
    startTime: s.startTime ?? '',
    endTime: s.endTime ?? null,
    trafficReported: s.trafficReported ?? 0,
    trafficCleared: s.trafficCleared ?? 0,
    checkIns,
    radiogramIds,
    report: reportFromFile(s.report),
  });
}

function radiogramFromFile(r: Plain<Radiogram>, id: string, sessionId: string | undefined): Radiogram {
  const createdAt = toTimestamp(r.createdAt);
  const { sessionId: _oldSessionId, ...rest } = r;
  return dropUndefined({
    ...(rest as unknown as Radiogram),
    id,
    number: r.number ?? '',
    precedence: r.precedence ?? '',
    handlingInstructions: r.handlingInstructions ?? '',
    stationOfOrigin: r.stationOfOrigin ?? '',
    check: r.check ?? '',
    placeOfOrigin: r.placeOfOrigin ?? '',
    timeFiled: r.timeFiled ?? '',
    date: r.date ?? '',
    address: r.address ?? '',
    addressOpNote: r.addressOpNote ?? '',
    textWords: Array.isArray(r.textWords) ? r.textWords : [],
    signature: r.signature ?? '',
    signatureOpNote: r.signatureOpNote ?? '',
    createdAt,
    // savedAt is required for radiograms to appear in date-ordered lists
    savedAt: toTimestamp(r.savedAt) ?? createdAt ?? Timestamp.now(),
    sessionId,
  });
}

// Runs tasks with limited concurrency; returns the number that failed
async function runAll(tasks: (() => Promise<boolean>)[], concurrency = 20): Promise<number> {
  let failures = 0;
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      if (!(await task())) failures++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return failures;
}

export async function importDatabase(uid: string, file: ExportFile, options: ImportOptions = {}): Promise<ImportResult> {
  const result: ImportResult = {
    existingDeleted: false,
    settingsReplaced: false,
    stationsAdded: 0,
    stationsUpdated: 0,
    sessionsAdded: 0,
    radiogramsAdded: 0,
    failures: 0,
  };

  if (options.replaceExisting) {
    // Stop before importing anything if the delete fails, rather than mixing
    // a partially deleted database with the imported data
    if (!(await db.deleteAllData(uid))) {
      throw new Error('Deleting the existing data failed, so nothing was imported. Some existing data may already have been deleted; import the file again to restore it.');
    }
    result.existingDeleted = true;
  }

  // Settings
  if (file.settings) {
    const profile = dropUndefined({
      ...file.settings,
      callsign: file.settings.callsign ?? '',
      name: file.settings.name ?? '',
      location: file.settings.location ?? '',
      netManagerCall: file.settings.netManagerCall ?? '',
    });
    if (await db.replaceUserProfile(uid, profile)) result.settingsReplaced = true;
    else result.failures++;
  }

  // Stations — merge duplicates within the file as well as with existing stations
  const existing = new Map((await db.getAllStations(uid)).map((s) => [s.callsign.toUpperCase(), s]));
  const toWrite = new Map<string, { station: Station; isNew: boolean }>();
  for (const raw of file.stations) {
    const imported = stationFromFile(raw);
    const prior = toWrite.get(imported.callsign)?.station ?? existing.get(imported.callsign);
    toWrite.set(imported.callsign, {
      station: prior ? mergeStation(prior, imported) : imported,
      isNew: !existing.has(imported.callsign),
    });
  }
  result.failures += await runAll(
    [...toWrite.values()].map(({ station, isNew }) => async () => {
      const ok = await db.importStation(uid, station);
      if (ok) {
        if (isNew) result.stationsAdded++;
        else result.stationsUpdated++;
      }
      return ok;
    })
  );

  // Radiograms get fresh IDs so importing never overwrites an existing radiogram
  const newIds = file.radiograms.map(() => generateRadiogramId());
  const newRadiogramId = new Map<string, string>();
  const radiogramsBySession = new Map<string, string[]>();
  file.radiograms.forEach((r, i) => {
    const newId = newIds[i];
    if (typeof r.id === 'string') newRadiogramId.set(r.id, newId);
    if (typeof r.sessionId === 'string') {
      radiogramsBySession.set(r.sessionId, [...(radiogramsBySession.get(r.sessionId) ?? []), newId]);
    }
  });

  // Sessions, each linked to the new IDs of its radiograms (from either side of
  // the bidirectional link)
  const newSessionId = new Map<string, string>();
  for (const s of file.sessions) {
    const linked = new Set<string>(radiogramsBySession.get(s.id ?? '') ?? []);
    for (const oldId of Array.isArray(s.radiogramIds) ? s.radiogramIds : []) {
      const id = newRadiogramId.get(oldId);
      if (id) linked.add(id);
    }
    const id = await db.createSession(uid, sessionFromFile(s, [...linked]));
    if (id) {
      result.sessionsAdded++;
      if (s.id) newSessionId.set(s.id, id);
    } else {
      result.failures++;
    }
  }

  // Radiograms whose session isn't in the file (or failed to import) become standalone
  const sessionOf = new Map<string, string>();
  for (const s of file.sessions) {
    const sid = s.id ? newSessionId.get(s.id) : undefined;
    if (!sid) continue;
    for (const oldId of Array.isArray(s.radiogramIds) ? s.radiogramIds : []) sessionOf.set(oldId, sid);
  }
  result.failures += await runAll(
    file.radiograms.map((r, i) => async () => {
      const oldId = typeof r.id === 'string' ? r.id : undefined;
      const id = newIds[i];
      const sessionId = (typeof r.sessionId === 'string' && newSessionId.get(r.sessionId)) ||
        (oldId && sessionOf.get(oldId)) || undefined;
      const ok = await db.importRadiogram(uid, radiogramFromFile(r, id, sessionId));
      if (ok) result.radiogramsAdded++;
      return ok;
    })
  );

  return result;
}
