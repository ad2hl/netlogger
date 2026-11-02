import { Station, NetSession, CheckIn, NetReport, UserProfile, Radiogram } from '@/types';

export interface NetLoggerDB {
  // Stations
  getStation(uid: string, callsign: string): Promise<Station | null>;
  saveStation(uid: string, station: Station): Promise<boolean>;
  updateStationNickname(uid: string, callsign: string, nickname: string | null): Promise<boolean>;
  updateStationLocation(uid: string, callsign: string, city: string | null, state: string | null): Promise<boolean>;
  updateStationNote(uid: string, callsign: string, note: string | null): Promise<boolean>;
  updateStationFields(uid: string, callsign: string, fields: { nickname?: string | null; note?: string | null; city?: string | null; state?: string | null; grantDate?: string | null }): Promise<boolean>;
  deleteStation(uid: string, callsign: string): Promise<boolean>;
  getAllStations(uid: string): Promise<Station[]>;
  getStations(uid: string, callsigns: string[]): Promise<Map<string, Station>>;

  // Sessions
  createSession(uid: string, session: Omit<NetSession, 'id'>): Promise<string | null>;
  getSession(uid: string, sessionId: string): Promise<NetSession | null>;
  updateSession(uid: string, sessionId: string, updates: Partial<NetSession>): Promise<boolean>;
  getAllSessions(uid: string): Promise<NetSession[]>;
  getRecentSessions(uid: string, count?: number): Promise<NetSession[]>;
  getActiveSession(uid: string): Promise<NetSession | null>;
  deleteSession(uid: string, sessionId: string): Promise<boolean>;
  saveReport(uid: string, sessionId: string, report: NetReport): Promise<boolean>;

  // Check-ins (operate on session arrays)
  addCheckIn(uid: string, sessionId: string, checkIn: CheckIn, currentCheckIns: CheckIn[]): Promise<boolean>;
  updateCheckInTags(uid: string, sessionId: string, callsign: string, newTags: string[], currentCheckIns: CheckIn[]): Promise<CheckIn[] | null>;
  removeCheckIn(uid: string, sessionId: string, callsign: string, currentCheckIns: CheckIn[]): Promise<boolean>;

  // Radiograms (independent collection)
  addRadiogram(uid: string, radiogram: Radiogram): Promise<boolean>;
  getRadiogram(uid: string, radiogramId: string): Promise<Radiogram | null>;
  updateRadiogram(uid: string, radiogramId: string, updates: Partial<Radiogram>): Promise<boolean>;
  deleteRadiogram(uid: string, radiogramId: string): Promise<boolean>;
  getAllRadiograms(uid: string): Promise<Radiogram[]>;
  getRadiogramsBySession(uid: string, sessionId: string): Promise<Radiogram[]>;
  // Atomically create a book radiogram's individual messages, keeping the book
  splitBookRadiogram(uid: string, bookId: string, newRadiograms: Radiogram[]): Promise<boolean>;

  // Profile
  getUserProfile(uid: string): Promise<UserProfile | null>;
  updateUserProfile(uid: string, profile: Partial<UserProfile>): Promise<boolean>;

  // Data import (issue #331) — write records exactly as given, preserving their
  // timestamps, instead of stamping them with the current time
  replaceUserProfile(uid: string, profile: UserProfile): Promise<boolean>;
  importStation(uid: string, station: Station): Promise<boolean>;
  // Writes the radiogram document only; the caller sets the session's radiogramIds
  importRadiogram(uid: string, radiogram: Radiogram): Promise<boolean>;
}
