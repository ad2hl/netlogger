import Dexie, { Table } from 'dexie';
import { Timestamp } from 'firebase/firestore';
import { Station, NetSession, CheckIn, NetReport, Radiogram, UserProfile } from '@/types';
import { getBaseCallsign } from '../callsign';
import type { NetLoggerDB } from './interface';

// Internal storage types — dates stored as ISO strings or Date objects
interface StoredStation {
  callsign: string;
  firstName: string | null;
  nickname: string | null;
  city: string | null;
  state: string | null;
  note: string | null;
  lastSeen: string; // ISO string
  grantDate?: string | null;
}

interface StoredSession {
  id: string;
  netName: string;
  date: string; // ISO string for indexing
  startTime: string;
  endTime: string | null;
  trafficReported: number;
  trafficCleared: number;
  checkIns: CheckIn[];
  radiogramIds: string[];
  report?: StoredNetReport;
  lastAcknowledged?: string | null;
  trafficItems?: NetSession['trafficItems'];
  checkedAnnouncements?: string[];
  checkedSecure?: string[];
}

interface StoredRadiogram extends Omit<Radiogram, 'createdAt' | 'savedAt'> {
  createdAt?: string; // ISO string
  savedAt?: string; // ISO string
  sessionId?: string;
}

interface StoredNetReport extends Omit<NetReport, 'startDateTime' | 'savedAt'> {
  startDateTime: string; // ISO string
  savedAt?: string; // ISO string
}

interface StoredProfile extends UserProfile {
  id: string; // always 'local-user'
}

class NetLoggerDexie extends Dexie {
  stations!: Table<StoredStation, string>;
  sessions!: Table<StoredSession, string>;
  profile!: Table<StoredProfile, string>;
  radiograms!: Table<StoredRadiogram, string>;

  constructor() {
    super('netlogger-desktop');
    this.version(1).stores({
      stations: 'callsign, lastSeen',
      sessions: 'id, date',
      profile: 'id',
    });
    this.version(2).stores({
      stations: 'callsign, lastSeen',
      sessions: 'id, date',
      profile: 'id',
      radiograms: 'id, sessionId, savedAt',
    }).upgrade(async (tx) => {
      // Migrate embedded radiograms out of session documents
      const allSessions = await tx.table('sessions').toArray();
      for (const s of allSessions) {
        const oldRadiograms: StoredRadiogram[] = (s as Record<string, unknown>).radiograms as StoredRadiogram[] | undefined ?? [];
        if (oldRadiograms.length > 0 && !s.radiogramIds) {
          for (const r of oldRadiograms) {
            await tx.table('radiograms').put({
              ...r,
              sessionId: s.id,
              sessionNetName: s.netName,
              savedAt: r.savedAt || new Date().toISOString(),
            });
          }
        }
        await tx.table('sessions').update(s.id, {
          radiogramIds: s.radiogramIds ?? oldRadiograms.map((r) => r.id),
          radiograms: undefined,
        });
      }
    });
    this.version(3).stores({
      stations: 'callsign, lastSeen',
      sessions: 'id, date',
      profile: 'id',
      radiograms: 'id, sessionId, savedAt, createdAt',
    });
  }
}

const dexieInstance = typeof window !== 'undefined' ? new NetLoggerDexie() : null;

function getDb(): NetLoggerDexie {
  if (!dexieInstance) throw new Error('Dexie is only available in the browser');
  return dexieInstance;
}

// Generate a random ID similar to Firestore auto-IDs
function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Convert a Timestamp or Date to ISO string for storage
function toIso(value: Timestamp | Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return value.toDate().toISOString();
}

// Convert an ISO string to a Firestore Timestamp for the interface
function toTimestamp(iso: string | null | undefined): Timestamp {
  const date = iso ? new Date(iso) : new Date();
  return Timestamp.fromDate(date);
}

// Convert stored station to Station type
function stationFromStored(s: StoredStation): Station {
  return {
    ...s,
    lastSeen: toTimestamp(s.lastSeen),
  };
}

// Convert stored session to NetSession type
function sessionFromStored(s: StoredSession): NetSession {
  let report: NetReport | undefined;
  if (s.report) {
    report = {
      ...s.report,
      startDateTime: toTimestamp(s.report.startDateTime),
      savedAt: s.report.savedAt ? toTimestamp(s.report.savedAt) : undefined,
    };
  }

  return {
    id: s.id,
    netName: s.netName,
    date: toTimestamp(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    trafficReported: s.trafficReported,
    trafficCleared: s.trafficCleared,
    checkIns: s.checkIns || [],
    radiogramIds: s.radiogramIds || [],
    report,
    lastAcknowledged: s.lastAcknowledged,
    trafficItems: s.trafficItems,
    checkedAnnouncements: s.checkedAnnouncements,
    checkedSecure: s.checkedSecure,
  };
}

// Convert NetSession to stored format
function sessionToStored(id: string, session: Omit<NetSession, 'id'>): StoredSession {
  let report: StoredNetReport | undefined;
  if (session.report) {
    report = {
      ...session.report,
      startDateTime: toIso(session.report.startDateTime),
      savedAt: session.report.savedAt ? toIso(session.report.savedAt) : undefined,
    };
  }

  return {
    id,
    netName: session.netName,
    date: toIso(session.date),
    startTime: session.startTime,
    endTime: session.endTime,
    trafficReported: session.trafficReported,
    trafficCleared: session.trafficCleared,
    checkIns: session.checkIns || [],
    radiogramIds: session.radiogramIds || [],
    report,
    lastAcknowledged: session.lastAcknowledged,
    trafficItems: session.trafficItems,
    checkedAnnouncements: session.checkedAnnouncements,
    checkedSecure: session.checkedSecure,
  };
}

class DexieDB implements NetLoggerDB {
  // uid is ignored in desktop mode — all data belongs to 'local-user'

  async getStation(_uid: string, callsign: string): Promise<Station | null> {
    try {
      const stored = await getDb().stations.get(getBaseCallsign(callsign.toUpperCase()));
      return stored ? stationFromStored(stored) : null;
    } catch (error) {
      console.error('Error getting station:', error);
      return null;
    }
  }

  async saveStation(_uid: string, station: Station): Promise<boolean> {
    try {
      const stored: StoredStation = {
        callsign: getBaseCallsign(station.callsign.toUpperCase()),
        firstName: station.firstName,
        nickname: station.nickname,
        city: station.city,
        state: station.state,
        note: station.note,
        lastSeen: new Date().toISOString(),
      };
      await getDb().stations.put(stored);
      return true;
    } catch (error) {
      console.error('Error saving station:', error);
      return false;
    }
  }

  async updateStationNickname(_uid: string, callsign: string, nickname: string | null): Promise<boolean> {
    try {
      await getDb().stations.update(getBaseCallsign(callsign.toUpperCase()), { nickname });
      return true;
    } catch (error) {
      console.error('Error updating station nickname:', error);
      return false;
    }
  }

  async updateStationLocation(_uid: string, callsign: string, city: string | null, state: string | null): Promise<boolean> {
    try {
      await getDb().stations.update(getBaseCallsign(callsign.toUpperCase()), { city, state });
      return true;
    } catch (error) {
      console.error('Error updating station location:', error);
      return false;
    }
  }

  async updateStationNote(_uid: string, callsign: string, note: string | null): Promise<boolean> {
    try {
      await getDb().stations.update(getBaseCallsign(callsign.toUpperCase()), { note });
      return true;
    } catch (error) {
      console.error('Error updating station note:', error);
      return false;
    }
  }

  async updateStationFields(_uid: string, callsign: string, fields: { nickname?: string | null; note?: string | null; city?: string | null; state?: string | null; grantDate?: string | null }): Promise<boolean> {
    try {
      await getDb().stations.update(getBaseCallsign(callsign.toUpperCase()), fields);
      return true;
    } catch (error) {
      console.error('Error updating station fields:', error);
      return false;
    }
  }

  async deleteStation(_uid: string, callsign: string): Promise<boolean> {
    try {
      await getDb().stations.delete(getBaseCallsign(callsign.toUpperCase()));
      return true;
    } catch (error) {
      console.error('Error deleting station:', error);
      return false;
    }
  }

  async getAllStations(_uid: string): Promise<Station[]> {
    try {
      const stored = await getDb().stations.orderBy('lastSeen').reverse().toArray();
      return stored.map(stationFromStored);
    } catch (error) {
      console.error('Error getting all stations:', error);
      return [];
    }
  }

  async getStations(_uid: string, callsigns: string[]): Promise<Map<string, Station>> {
    const stationMap = new Map<string, Station>();
    try {
      await Promise.all(
        callsigns.map(async (callsign) => {
          const station = await this.getStation(_uid, callsign);
          if (station) {
            stationMap.set(callsign.toUpperCase(), station);
          }
        })
      );
      return stationMap;
    } catch (error) {
      console.error('Error getting stations:', error);
      return stationMap;
    }
  }

  async createSession(_uid: string, session: Omit<NetSession, 'id'>): Promise<string | null> {
    try {
      const id = generateId();
      const stored = sessionToStored(id, session);
      await getDb().sessions.put(stored);
      return id;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  async getSession(_uid: string, sessionId: string): Promise<NetSession | null> {
    try {
      const stored = await getDb().sessions.get(sessionId);
      return stored ? sessionFromStored(stored) : null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async updateSession(_uid: string, sessionId: string, updates: Partial<NetSession>): Promise<boolean> {
    try {
      const existing = await getDb().sessions.get(sessionId);
      if (!existing) return false;

      const merged = { ...existing };

      // Apply updates, converting Timestamps as needed
      if (updates.netName !== undefined) merged.netName = updates.netName;
      if (updates.date !== undefined) merged.date = toIso(updates.date);
      if (updates.startTime !== undefined) merged.startTime = updates.startTime;
      if (updates.endTime !== undefined) merged.endTime = updates.endTime;
      if (updates.trafficReported !== undefined) merged.trafficReported = updates.trafficReported;
      if (updates.trafficCleared !== undefined) merged.trafficCleared = updates.trafficCleared;
      if (updates.lastAcknowledged !== undefined) merged.lastAcknowledged = updates.lastAcknowledged;
      if (updates.trafficItems !== undefined) merged.trafficItems = updates.trafficItems;
      if (updates.checkedAnnouncements !== undefined) merged.checkedAnnouncements = updates.checkedAnnouncements;
      if (updates.checkedSecure !== undefined) merged.checkedSecure = updates.checkedSecure;
      if (updates.checkIns !== undefined) merged.checkIns = updates.checkIns;
      if (updates.radiogramIds !== undefined) merged.radiogramIds = updates.radiogramIds;

      if (updates.report !== undefined) {
        if (updates.report) {
          merged.report = {
            ...updates.report,
            startDateTime: toIso(updates.report.startDateTime),
            savedAt: updates.report.savedAt ? toIso(updates.report.savedAt) : undefined,
          };
        } else {
          merged.report = undefined;
        }
      }

      await getDb().sessions.put(merged);
      return true;
    } catch (error) {
      console.error('Error updating session:', error);
      return false;
    }
  }

  async getAllSessions(_uid: string): Promise<NetSession[]> {
    try {
      const stored = await getDb().sessions.orderBy('date').reverse().toArray();
      return stored.map(sessionFromStored);
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return [];
    }
  }

  async getRecentSessions(_uid: string, count: number = 10): Promise<NetSession[]> {
    try {
      const stored = await getDb().sessions.orderBy('date').reverse().limit(count).toArray();
      return stored.map(sessionFromStored);
    } catch (error) {
      console.error('Error getting recent sessions:', error);
      return [];
    }
  }

  async getActiveSession(uid: string): Promise<NetSession | null> {
    try {
      const sessions = await this.getRecentSessions(uid, 5);
      const activeSession = sessions.find((s) => !s.endTime);
      return activeSession || null;
    } catch (error) {
      console.error('Error getting active session:', error);
      return null;
    }
  }

  async deleteSession(_uid: string, sessionId: string): Promise<boolean> {
    try {
      await getDb().sessions.delete(sessionId);
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  async saveReport(_uid: string, sessionId: string, report: NetReport): Promise<boolean> {
    try {
      const existing = await getDb().sessions.get(sessionId);
      if (!existing) return false;
      const storedReport: StoredNetReport = {
        ...report,
        startDateTime: toIso(report.startDateTime),
        savedAt: report.savedAt ? toIso(report.savedAt) : undefined,
      };
      await getDb().sessions.update(sessionId, { report: storedReport });
      return true;
    } catch (error) {
      console.error('Error saving report:', error);
      return false;
    }
  }

  async addCheckIn(_uid: string, sessionId: string, checkIn: CheckIn, currentCheckIns: CheckIn[]): Promise<boolean> {
    try {
      await getDb().sessions.update(sessionId, {
        checkIns: [...currentCheckIns, checkIn],
      });

      // Update lastSeen on the station
      await getDb().stations.update(getBaseCallsign(checkIn.callsign.toUpperCase()), {
        lastSeen: new Date().toISOString(),
      }).catch(() => {
        // Station doc may not exist yet — ignore
      });

      return true;
    } catch (error) {
      console.error('Error adding check-in:', error);
      return false;
    }
  }

  async updateCheckInTags(_uid: string, sessionId: string, callsign: string, newTags: string[], currentCheckIns: CheckIn[]): Promise<CheckIn[] | null> {
    try {
      const upperCallsign = callsign.toUpperCase();

      const existingCheckIn = currentCheckIns.find(
        (c) => c.callsign.toUpperCase() === upperCallsign
      );

      if (!existingCheckIn) return null;

      const updatedCheckIns = currentCheckIns.map((c) =>
        c.callsign.toUpperCase() === upperCallsign
          ? { ...existingCheckIn, tags: newTags }
          : c
      );

      await getDb().sessions.update(sessionId, { checkIns: updatedCheckIns });
      return updatedCheckIns;
    } catch (error) {
      console.error('Error updating check-in tags:', error);
      return null;
    }
  }

  async removeCheckIn(_uid: string, sessionId: string, callsign: string, currentCheckIns: CheckIn[]): Promise<boolean> {
    try {
      const updatedCheckIns = currentCheckIns.filter(
        (c) => c.callsign.toUpperCase() !== callsign.toUpperCase()
      );
      await getDb().sessions.update(sessionId, { checkIns: updatedCheckIns });
      return true;
    } catch (error) {
      console.error('Error removing check-in:', error);
      return false;
    }
  }

  async addRadiogram(_uid: string, radiogram: Radiogram): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const stored: StoredRadiogram = {
        ...radiogram,
        createdAt: now,
        savedAt: now,
      };
      await getDb().radiograms.put(stored);
      if (radiogram.sessionId) {
        await getDb().sessions.where('id').equals(radiogram.sessionId).modify((s) => {
          s.radiogramIds = Array.from(new Set([...(s.radiogramIds || []), radiogram.id]));
        });
      }
      return true;
    } catch (error) {
      console.error('Error adding radiogram:', error);
      return false;
    }
  }

  async getRadiogram(_uid: string, radiogramId: string): Promise<Radiogram | null> {
    try {
      const stored = await getDb().radiograms.get(radiogramId);
      if (!stored) return null;
      return {
        ...stored,
        createdAt: stored.createdAt ? toTimestamp(stored.createdAt) : undefined,
        savedAt: stored.savedAt ? toTimestamp(stored.savedAt) : undefined,
      };
    } catch (error) {
      console.error('Error getting radiogram:', error);
      return null;
    }
  }

  async updateRadiogram(_uid: string, radiogramId: string, updates: Partial<Radiogram>): Promise<boolean> {
    try {
      const { savedAt, createdAt: _createdAt, ...rest } = updates;
      const storedUpdates: Partial<StoredRadiogram> = {
        ...rest,
        ...(savedAt ? { savedAt: toIso(savedAt) } : {}),
      };
      await getDb().radiograms.update(radiogramId, storedUpdates);
      return true;
    } catch (error) {
      console.error('Error updating radiogram:', error);
      return false;
    }
  }

  async deleteRadiogram(_uid: string, radiogramId: string): Promise<boolean> {
    try {
      const stored = await getDb().radiograms.get(radiogramId);
      if (stored?.sessionId) {
        await getDb().sessions.where('id').equals(stored.sessionId).modify((s) => {
          s.radiogramIds = (s.radiogramIds || []).filter((id) => id !== radiogramId);
        });
      }
      await getDb().radiograms.delete(radiogramId);
      return true;
    } catch (error) {
      console.error('Error deleting radiogram:', error);
      return false;
    }
  }

  async splitBookRadiogram(_uid: string, bookId: string, newRadiograms: Radiogram[]): Promise<boolean> {
    try {
      await getDb().transaction('rw', [getDb().radiograms, getDb().sessions], async () => {
        const book = await getDb().radiograms.get(bookId);
        if (!book) throw new Error('Book radiogram not found');
        const now = new Date().toISOString();
        const stored: StoredRadiogram[] = newRadiograms.map((r) => ({
          ...r,
          createdAt: now,
          savedAt: now,
        }));
        await getDb().radiograms.bulkPut(stored);
        if (book.sessionId) {
          await getDb().sessions.where('id').equals(book.sessionId).modify((s) => {
            s.radiogramIds = [...(s.radiogramIds || []), ...newRadiograms.map((r) => r.id)];
          });
        }
      });
      return true;
    } catch (error) {
      console.error('Error splitting book radiogram:', error);
      return false;
    }
  }

  async getAllRadiograms(_uid: string): Promise<Radiogram[]> {
    try {
      const stored = await getDb().radiograms.orderBy('savedAt').reverse().toArray();
      return stored.map((r) => ({
        ...r,
        createdAt: r.createdAt ? toTimestamp(r.createdAt) : undefined,
        savedAt: r.savedAt ? toTimestamp(r.savedAt) : undefined,
      }));
    } catch (error) {
      console.error('Error getting all radiograms:', error);
      return [];
    }
  }

  async getRadiogramsBySession(_uid: string, sessionId: string): Promise<Radiogram[]> {
    try {
      const stored = await getDb().radiograms.where('sessionId').equals(sessionId).sortBy('savedAt');
      return stored.map((r) => ({
        ...r,
        createdAt: r.createdAt ? toTimestamp(r.createdAt) : undefined,
        savedAt: r.savedAt ? toTimestamp(r.savedAt) : undefined,
      }));
    } catch (error) {
      console.error('Error getting radiograms by session:', error);
      return [];
    }
  }

  async getUserProfile(_uid: string): Promise<UserProfile | null> {
    try {
      const stored = await getDb().profile.get('local-user');
      if (!stored) return null;
      const { id: _id, ...profile } = stored;
      return profile as UserProfile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  async updateUserProfile(_uid: string, profile: Partial<UserProfile>): Promise<boolean> {
    try {
      const existing = await getDb().profile.get('local-user');
      const merged: StoredProfile = {
        callsign: '',
        name: '',
        location: '',
        netManagerCall: '',
        lookupService: 'callook',
        ...existing,
        ...profile,
        id: 'local-user',
      };
      await getDb().profile.put(merged);
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  }

  async replaceUserProfile(_uid: string, profile: UserProfile): Promise<boolean> {
    try {
      await getDb().profile.put({ ...profile, id: 'local-user' });
      return true;
    } catch (error) {
      console.error('Error replacing user profile:', error);
      return false;
    }
  }

  async importStation(_uid: string, station: Station): Promise<boolean> {
    try {
      const stored: StoredStation = {
        ...station,
        callsign: getBaseCallsign(station.callsign.toUpperCase()),
        lastSeen: toIso(station.lastSeen),
      };
      await getDb().stations.put(stored);
      return true;
    } catch (error) {
      console.error('Error importing station:', error);
      return false;
    }
  }

  async importRadiogram(_uid: string, radiogram: Radiogram): Promise<boolean> {
    try {
      const stored: StoredRadiogram = {
        ...radiogram,
        createdAt: radiogram.createdAt ? toIso(radiogram.createdAt) : undefined,
        savedAt: toIso(radiogram.savedAt),
      };
      await getDb().radiograms.put(stored);
      return true;
    } catch (error) {
      console.error('Error importing radiogram:', error);
      return false;
    }
  }
}

export const dexieDb = new DexieDB();
