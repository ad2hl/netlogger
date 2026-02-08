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
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { Station, NetSession, CheckIn, NetReport } from '@/types';

export async function getStation(
  uid: string,
  callsign: string
): Promise<Station | null> {
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

export async function saveStation(
  uid: string,
  station: Station
): Promise<boolean> {
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

export async function updateStationNickname(
  uid: string,
  callsign: string,
  nickname: string | null
): Promise<boolean> {
  try {
    const stationRef = doc(getFirebaseDb(), 'users', uid, 'stations', callsign.toUpperCase());
    await updateDoc(stationRef, { nickname });
    return true;
  } catch (error) {
    console.error('Error updating station nickname:', error);
    return false;
  }
}

export async function updateStationNote(
  uid: string,
  callsign: string,
  note: string | null
): Promise<boolean> {
  try {
    const stationRef = doc(getFirebaseDb(), 'users', uid, 'stations', callsign.toUpperCase());
    await updateDoc(stationRef, { note });
    return true;
  } catch (error) {
    console.error('Error updating station note:', error);
    return false;
  }
}

export async function createSession(
  uid: string,
  session: Omit<NetSession, 'id'>
): Promise<string | null> {
  try {
    const sessionsRef = collection(getFirebaseDb(), 'users', uid, 'sessions');
    const docRef = await addDoc(sessionsRef, session);
    return docRef.id;
  } catch (error) {
    console.error('Error creating session:', error);
    return null;
  }
}

export async function getSession(
  uid: string,
  sessionId: string
): Promise<NetSession | null> {
  try {
    const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);
    if (sessionDoc.exists()) {
      return { id: sessionDoc.id, ...sessionDoc.data() } as NetSession;
    }
    return null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

export async function updateSession(
  uid: string,
  sessionId: string,
  updates: Partial<NetSession>
): Promise<boolean> {
  try {
    const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
    await updateDoc(sessionRef, updates);
    return true;
  } catch (error) {
    console.error('Error updating session:', error);
    return false;
  }
}

export async function addCheckIn(
  uid: string,
  sessionId: string,
  checkIn: CheckIn,
  currentCheckIns: CheckIn[]
): Promise<boolean> {
  try {
    const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      checkIns: [...currentCheckIns, checkIn],
    });
    return true;
  } catch (error) {
    console.error('Error adding check-in:', error);
    return false;
  }
}

export async function updateCheckInTags(
  uid: string,
  sessionId: string,
  callsign: string,
  newTags: string[],
  currentCheckIns: CheckIn[]
): Promise<CheckIn[] | null> {
  try {
    const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
    const upperCallsign = callsign.toUpperCase();

    // Find existing check-in and merge tags
    const existingCheckIn = currentCheckIns.find(
      (c) => c.callsign.toUpperCase() === upperCallsign
    );

    if (!existingCheckIn) return null;

    // Merge tags (avoid duplicates)
    const mergedTags = Array.from(new Set([...existingCheckIn.tags, ...newTags]));

    // Remove from current position and add to end with merged tags
    const updatedCheckIns = currentCheckIns.filter(
      (c) => c.callsign.toUpperCase() !== upperCallsign
    );
    const updatedCheckIn: CheckIn = {
      ...existingCheckIn,
      tags: mergedTags,
      timestamp: new Date(),
    };
    updatedCheckIns.push(updatedCheckIn);

    await updateDoc(sessionRef, { checkIns: updatedCheckIns });
    return updatedCheckIns;
  } catch (error) {
    console.error('Error updating check-in tags:', error);
    return null;
  }
}

export async function removeCheckIn(
  uid: string,
  sessionId: string,
  callsign: string,
  currentCheckIns: CheckIn[]
): Promise<boolean> {
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

export async function getRecentSessions(
  uid: string,
  count: number = 10
): Promise<NetSession[]> {
  try {
    const sessionsRef = collection(getFirebaseDb(), 'users', uid, 'sessions');
    const q = query(sessionsRef, orderBy('date', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as NetSession[];
  } catch (error) {
    console.error('Error getting recent sessions:', error);
    return [];
  }
}

export async function getAllSessions(
  uid: string
): Promise<NetSession[]> {
  try {
    const sessionsRef = collection(getFirebaseDb(), 'users', uid, 'sessions');
    const q = query(sessionsRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as NetSession[];
  } catch (error) {
    console.error('Error getting all sessions:', error);
    return [];
  }
}

export async function deleteSession(
  uid: string,
  sessionId: string
): Promise<boolean> {
  try {
    const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
    await deleteDoc(sessionRef);
    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
}

export async function getActiveSession(
  uid: string
): Promise<NetSession | null> {
  try {
    const sessions = await getRecentSessions(uid, 5);
    // Find the most recent session without an endTime
    const activeSession = sessions.find((s) => !s.endTime);
    return activeSession || null;
  } catch (error) {
    console.error('Error getting active session:', error);
    return null;
  }
}

export async function getAllStations(uid: string): Promise<Station[]> {
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

export async function getStations(
  uid: string,
  callsigns: string[]
): Promise<Map<string, Station>> {
  const stationMap = new Map<string, Station>();
  try {
    await Promise.all(
      callsigns.map(async (callsign) => {
        const station = await getStation(uid, callsign);
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

export async function saveReport(
  uid: string,
  sessionId: string,
  report: NetReport
): Promise<boolean> {
  try {
    const sessionRef = doc(getFirebaseDb(), 'users', uid, 'sessions', sessionId);
    await updateDoc(sessionRef, { report });
    return true;
  } catch (error) {
    console.error('Error saving report:', error);
    return false;
  }
}
