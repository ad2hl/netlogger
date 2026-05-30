import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDocs,
  Timestamp,
  limit,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import { Station, NetSession, CheckIn, NetReport, UserProfile, Radiogram } from '@/types';
import type { NetLoggerDB } from './interface';

class FirebaseDB implements NetLoggerDB {
  async getStation(uid: string, callsign: string): Promise<Station | null> {
    try {
      const stationRef = doc(getFirebaseDb(), 'users', uid, 'stations', callsign.toUpperCase());
      const stationDoc = await getDoc(stationRef);
      if (stationDoc.exists()) {
        return stationDoc.data() as Station;
      }
      return null;
    } catch (error) {
      console.error('Error getting station:', error);
      return null;
    }
  }

  async saveStation(uid: string, station: Station): Promise<boolean> {
    try {
      const stationRef = doc(getFirebaseDb(), 'users', uid, 'stations', station.callsign.toUpperCase());
      await setDoc(stationRef, {
        ...station,
        callsign: station.callsign.toUpperCase(),
        lastSeen: Timestamp.now(),
      });
      return true;
    } catch (error) {
      console.error('Error saving station:', error);
      return false;
    }
  }

  async updateStationNickname(uid: string, callsign: string, nickname: string | null): Promise<boolean> {
    try {
      const stationRef = doc(getFirebaseDb(), 'users', uid, 'stations', callsign.toUpperCase());
      await updateDoc(stationRef, { nickname });
      return true;
    } catch (error) {
      console.error('Error updating station nickname:', error);
      return false;
    }
  }

  async updateStationLocation(uid: string, callsign: string, city: string | null, state: string | null): Promise<boolean> {
    try {
      const stationRef = doc(getFirebaseDb(), 'users', uid, 'stations', callsign.toUpperCase());
      await updateDoc(stationRef, { city, state });
      return true;
    } catch (error) {
      console.error('Error updating station location:', error);
      return false;
    }
  }

  async updateStationNote(uid: string, callsign: string, note: string | null): Promise<boolean> {
    try {
      const stationRef = doc(getFirebaseDb(), 'users', uid, 'stations', callsign.toUpperCase());
      await updateDoc(stationRef, { note });
      return true;
    } catch (error) {
      console.error('Error updating station note:', error);
      return false;
    }
  }

  async updateStationFields(uid: string, callsign: string, fields: { nickname?: string | null; note?: string | null; city?: string | null; state?: string | null }): Promise<boolean> {
    try {
      const stationRef = doc(getFirebaseDb(), 'users', uid, 'stations', callsign.toUpperCase());
      await updateDoc(stationRef, fields);
      return true;
    } catch (error) {
      console.error('Error updating station fields:', error);
      return false;
    }
  }

  async deleteStation(uid: string, callsign: string): Promise<boolean> {
    try {
      const stationRef = doc(getFirebaseDb(), 'users', uid, 'stations', callsign.toUpperCase());
      await deleteDoc(stationRef);
      return true;
    } catch (error) {
      console.error('Error deleting station:', error);
      return false;
    }
  }

  async getAllStations(uid: string): Promise<Station[]> {
    try {
      const stationsRef = collection(getFirebaseDb(), 'users', uid, 'stations');
      const q = query(stationsRef, orderBy('lastSeen', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => doc.data() as Station);
    } catch (error) {
      console.error('Error getting all stations:', error);
      return [];
    }
  }

  async getStations(uid: string, callsigns: string[]): Promise<Map<string, Station>> {
    const stationMap = new Map<string, Station>();
    try {
      await Promise.all(
        callsigns.map(async (callsign) => {
          const station = await this.getStation(uid, callsign);
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

  async createSession(uid: string, session: Omit<NetSession, 'id'>): Promise<string | null> {
    try {
      const sessionsRef = collection(getFirebaseDb(), 'users', uid, 'sessions');
      const docRef = await addDoc(sessionsRef, session);
      return docRef.id;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  // Normalizes raw Firestore session data to the current NetSession shape.
  // Handles old format (radiograms: Radiogram[]) by deriving radiogramIds from it.
  private normalizeSession(rawData: Record<string, unknown>, id: string): NetSession {
    const { radiograms: oldRadiograms, ...rest } = rawData as { radiograms?: Radiogram[] } & Record<string, unknown>;
    const radiogramIds = (rest.radiogramIds as string[] | undefined) ??
      (oldRadiograms?.map((r) => r.id) ?? []);
    return { id, ...rest, radiogramIds } as NetSession;
  }

  // Migrates a session that still has the old embedded radiograms array.
  // Writes each radiogram to its own document and updates the session atomically.
  private async migrateSessionIfNeeded(
    uid: string,
    rawData: Record<string, unknown>,
    sessionId: string
  ): Promise<void> {
    const oldRadiograms = rawData.radiograms as Radiogram[] | undefined;
    if (!oldRadiograms || rawData.radiogramIds !== undefined) return;

    const db = getFirebaseDb();
    const batch = writeBatch(db);
    for (const r of oldRadiograms) {
      const radRef = doc(db, 'users', uid, 'radiograms', r.id);
      batch.set(radRef, { ...r, sessionId, sessionNetName: rawData.netName ?? '' });
    }
    batch.update(doc(db, 'users', uid, 'sessions', sessionId), {
      radiogramIds: oldRadiograms.map((r) => r.id),
      radiograms: deleteField(),
    });
    await batch.commit();
  }

  async getSession(uid: string, sessionId: string): Promise<NetSession | null> {
    try {
      const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
      const sessionDoc = await getDoc(sessionRef);
      if (!sessionDoc.exists()) return null;
      const rawData = sessionDoc.data() as Record<string, unknown>;
      await this.migrateSessionIfNeeded(uid, rawData, sessionId);
      return this.normalizeSession(rawData, sessionDoc.id);
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async updateSession(uid: string, sessionId: string, updates: Partial<NetSession>): Promise<boolean> {
    try {
      const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
      await updateDoc(sessionRef, updates);
      return true;
    } catch (error) {
      console.error('Error updating session:', error);
      return false;
    }
  }

  async getAllSessions(uid: string): Promise<NetSession[]> {
    try {
      const sessionsRef = collection(getFirebaseDb(), 'users', uid, 'sessions');
      const q = query(sessionsRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const pairs = snapshot.docs.map((d) => ({ id: d.id, raw: d.data() as Record<string, unknown> }));
      await Promise.all(pairs.map((p) => this.migrateSessionIfNeeded(uid, p.raw, p.id)));
      return pairs.map((p) => this.normalizeSession(p.raw, p.id));
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return [];
    }
  }

  async getRecentSessions(uid: string, count: number = 10): Promise<NetSession[]> {
    try {
      const sessionsRef = collection(getFirebaseDb(), 'users', uid, 'sessions');
      const q = query(sessionsRef, orderBy('date', 'desc'), limit(count));
      const snapshot = await getDocs(q);
      const pairs = snapshot.docs.map((d) => ({ id: d.id, raw: d.data() as Record<string, unknown> }));
      await Promise.all(pairs.map((p) => this.migrateSessionIfNeeded(uid, p.raw, p.id)));
      return pairs.map((p) => this.normalizeSession(p.raw, p.id));
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

  async deleteSession(uid: string, sessionId: string): Promise<boolean> {
    try {
      const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
      await deleteDoc(sessionRef);
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  async saveReport(uid: string, sessionId: string, report: NetReport): Promise<boolean> {
    try {
      const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
      await updateDoc(sessionRef, { report });
      return true;
    } catch (error) {
      console.error('Error saving report:', error);
      return false;
    }
  }

  async addCheckIn(uid: string, sessionId: string, checkIn: CheckIn, currentCheckIns: CheckIn[]): Promise<boolean> {
    try {
      const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
      await updateDoc(sessionRef, {
        checkIns: [...currentCheckIns, checkIn],
      });

      const stationRef = doc(getFirebaseDb(), 'users', uid, 'stations', checkIn.callsign.toUpperCase());
      await updateDoc(stationRef, { lastSeen: Timestamp.now() }).catch(() => {
        // Station doc may not exist yet — ignore
      });

      return true;
    } catch (error) {
      console.error('Error adding check-in:', error);
      return false;
    }
  }

  async updateCheckInTags(uid: string, sessionId: string, callsign: string, newTags: string[], currentCheckIns: CheckIn[]): Promise<CheckIn[] | null> {
    try {
      const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
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

      await updateDoc(sessionRef, { checkIns: updatedCheckIns });
      return updatedCheckIns;
    } catch (error) {
      console.error('Error updating check-in tags:', error);
      return null;
    }
  }

  async removeCheckIn(uid: string, sessionId: string, callsign: string, currentCheckIns: CheckIn[]): Promise<boolean> {
    try {
      const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
      const updatedCheckIns = currentCheckIns.filter(
        (c) => c.callsign.toUpperCase() !== callsign.toUpperCase()
      );
      await updateDoc(sessionRef, { checkIns: updatedCheckIns });
      return true;
    } catch (error) {
      console.error('Error removing check-in:', error);
      return false;
    }
  }

  async addRadiogram(uid: string, radiogram: Radiogram): Promise<boolean> {
    try {
      const db = getFirebaseDb();
      const batch = writeBatch(db);
      const radRef = doc(db, 'users', uid, 'radiograms', radiogram.id);
      const now = Timestamp.now();
      batch.set(radRef, { ...radiogram, createdAt: now, savedAt: now });
      if (radiogram.sessionId) {
        const sessionRef = doc(db, 'users', uid, 'sessions', radiogram.sessionId);
        batch.update(sessionRef, { radiogramIds: arrayUnion(radiogram.id) });
      }
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error adding radiogram:', error);
      return false;
    }
  }

  async getRadiogram(uid: string, radiogramId: string): Promise<Radiogram | null> {
    try {
      const radRef = doc(getFirebaseDb(), 'users', uid, 'radiograms', radiogramId);
      const snap = await getDoc(radRef);
      return snap.exists() ? (snap.data() as Radiogram) : null;
    } catch (error) {
      console.error('Error getting radiogram:', error);
      return null;
    }
  }

  async updateRadiogram(uid: string, radiogramId: string, updates: Partial<Radiogram>): Promise<boolean> {
    try {
      const radRef = doc(getFirebaseDb(), 'users', uid, 'radiograms', radiogramId);
      await updateDoc(radRef, updates);
      return true;
    } catch (error) {
      console.error('Error updating radiogram:', error);
      return false;
    }
  }

  async deleteRadiogram(uid: string, radiogramId: string): Promise<boolean> {
    try {
      const db = getFirebaseDb();
      const radRef = doc(db, 'users', uid, 'radiograms', radiogramId);
      const snap = await getDoc(radRef);
      if (!snap.exists()) return true;
      const radiogram = snap.data() as Radiogram;
      const batch = writeBatch(db);
      batch.delete(radRef);
      if (radiogram.sessionId) {
        const sessionRef = doc(db, 'users', uid, 'sessions', radiogram.sessionId);
        batch.update(sessionRef, { radiogramIds: arrayRemove(radiogramId) });
      }
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error deleting radiogram:', error);
      return false;
    }
  }

  async getAllRadiograms(uid: string): Promise<Radiogram[]> {
    try {
      const radRef = collection(getFirebaseDb(), 'users', uid, 'radiograms');
      const q = query(radRef, orderBy('savedAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as Radiogram);
    } catch (error) {
      console.error('Error getting all radiograms:', error);
      return [];
    }
  }

  async getRadiogramsBySession(uid: string, sessionId: string): Promise<Radiogram[]> {
    try {
      const radRef = collection(getFirebaseDb(), 'users', uid, 'radiograms');
      const q = query(radRef, where('sessionId', '==', sessionId), orderBy('savedAt', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as Radiogram);
    } catch (error) {
      console.error('Error getting radiograms by session:', error);
      return [];
    }
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDocRef = doc(getFirebaseDb(), 'users', uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  async updateUserProfile(uid: string, profile: Partial<UserProfile>): Promise<boolean> {
    try {
      const userDocRef = doc(getFirebaseDb(), 'users', uid);
      await setDoc(userDocRef, profile, { merge: true });
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  }
}

export const firebaseDb = new FirebaseDB();
