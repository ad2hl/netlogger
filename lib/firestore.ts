// This file is a compatibility shim. All implementations live in lib/db/.
// The correct implementation (Firebase or Dexie) is selected at build time
// by NEXT_PUBLIC_DESKTOP_MODE.
import { db } from './db/index';
import { Station, NetSession, CheckIn, NetReport, UserProfile, Radiogram } from '@/types';

export const getStation = (uid: string, callsign: string) => db.getStation(uid, callsign);
export const saveStation = (uid: string, station: Station) => db.saveStation(uid, station);
export const updateStationNickname = (uid: string, callsign: string, nickname: string | null) => db.updateStationNickname(uid, callsign, nickname);
export const updateStationLocation = (uid: string, callsign: string, city: string | null, state: string | null) => db.updateStationLocation(uid, callsign, city, state);
export const updateStationNote = (uid: string, callsign: string, note: string | null) => db.updateStationNote(uid, callsign, note);
export const updateStationFields = (uid: string, callsign: string, fields: { nickname?: string | null; note?: string | null; city?: string | null; state?: string | null; grantDate?: string | null }) => db.updateStationFields(uid, callsign, fields);
export const deleteStation = (uid: string, callsign: string) => db.deleteStation(uid, callsign);
export const getAllStations = (uid: string) => db.getAllStations(uid);
export const getStations = (uid: string, callsigns: string[]) => db.getStations(uid, callsigns);

export const createSession = (uid: string, session: Omit<NetSession, 'id'>) => db.createSession(uid, session);
export const getSession = (uid: string, sessionId: string) => db.getSession(uid, sessionId);
export const updateSession = (uid: string, sessionId: string, updates: Partial<NetSession>) => db.updateSession(uid, sessionId, updates);
export const getAllSessions = (uid: string) => db.getAllSessions(uid);
export const getRecentSessions = (uid: string, count?: number) => db.getRecentSessions(uid, count);
export const getActiveSession = (uid: string) => db.getActiveSession(uid);
export const deleteSession = (uid: string, sessionId: string) => db.deleteSession(uid, sessionId);
export const saveReport = (uid: string, sessionId: string, report: NetReport) => db.saveReport(uid, sessionId, report);

export const addCheckIn = (uid: string, sessionId: string, checkIn: CheckIn, currentCheckIns: CheckIn[]) => db.addCheckIn(uid, sessionId, checkIn, currentCheckIns);
export const updateCheckInTags = (uid: string, sessionId: string, callsign: string, newTags: string[], currentCheckIns: CheckIn[]) => db.updateCheckInTags(uid, sessionId, callsign, newTags, currentCheckIns);
export const removeCheckIn = (uid: string, sessionId: string, callsign: string, currentCheckIns: CheckIn[]) => db.removeCheckIn(uid, sessionId, callsign, currentCheckIns);

export const addRadiogram = (uid: string, radiogram: Radiogram) => db.addRadiogram(uid, radiogram);
export const getRadiogram = (uid: string, radiogramId: string) => db.getRadiogram(uid, radiogramId);
export const updateRadiogram = (uid: string, radiogramId: string, updates: Partial<Radiogram>) => db.updateRadiogram(uid, radiogramId, updates);
export const deleteRadiogram = (uid: string, radiogramId: string) => db.deleteRadiogram(uid, radiogramId);
export const getAllRadiograms = (uid: string) => db.getAllRadiograms(uid);
export const getRadiogramsBySession = (uid: string, sessionId: string) => db.getRadiogramsBySession(uid, sessionId);

// Profile functions (also used in settings page and auth provider)
export const getUserProfile = (uid: string) => db.getUserProfile(uid);
export const updateUserProfile = (uid: string, profile: Partial<UserProfile>) => db.updateUserProfile(uid, profile);
