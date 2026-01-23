'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { signOut } from '@/lib/auth';
import {
  createSession,
  updateSession,
  addCheckIn,
  removeCheckIn,
  getStation,
  saveStation,
  updateStationNickname,
  updateStationNote,
  getActiveSession,
  getStations,
  saveReport,
} from '@/lib/firestore';
import { NetSession, CheckIn, Station, NetReport } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { generateRadiogram } from '@/lib/radiogram';
import SessionSetup from '@/components/SessionSetup';
import CheckInForm from '@/components/CheckInForm';
import CheckInList from '@/components/CheckInList';
import TrafficCounter from '@/components/TrafficCounter';
import ReportGenerator from '@/components/ReportGenerator';

export default function NetPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<NetSession | null>(null);
  const [stations, setStations] = useState<Map<string, Station>>(new Map());
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Check for active session on load
  useEffect(() => {
    const loadActiveSession = async () => {
      if (!user || loading || session) return;

      const activeSession = await getActiveSession(user.uid);
      if (activeSession) {
        setSession(activeSession);

        // Load stations for all checked-in callsigns
        const callsigns = activeSession.checkIns.map((c) => c.callsign);
        if (callsigns.length > 0) {
          const stationMap = await getStations(user.uid, callsigns);
          setStations(stationMap);
        }
      }
    };

    loadActiveSession();
  }, [user, loading, session]);

  const handleCreateSession = async (newSession: Omit<NetSession, 'id'>) => {
    if (!user) return;

    const sessionId = await createSession(user.uid, newSession);
    if (sessionId) {
      setSession({ ...newSession, id: sessionId });
    }
  };

  const handleUpdateSession = async (updates: Partial<NetSession>) => {
    if (!user || !session?.id) return;

    const success = await updateSession(user.uid, session.id, updates);
    if (success) {
      const updatedSession = { ...session, ...updates };
      setSession(updatedSession);

      // Auto-save report when net ends
      if (updates.endTime && !session.endTime && profile) {
        handleSaveReport(updatedSession);
      }
    }
  };

  const handleSaveReport = async (currentSession?: NetSession) => {
    const sess = currentSession || session;
    if (!user || !sess?.id || !profile?.callsign) return;

    const radiogram = generateRadiogram({
      session: sess,
      stations,
      userCallsign: profile.callsign,
      userName: profile.name,
      userLocation: profile.location,
      addresseeCallsign: profile.netManagerCall || '',
    });

    // Combine date and startTime into a single timestamp
    const sessionDate = sess.date.toDate();
    const [hours, minutes] = sess.startTime.split(':').map(Number);
    sessionDate.setHours(hours, minutes, 0, 0);

    const report: NetReport = {
      netName: sess.netName,
      startDateTime: Timestamp.fromDate(sessionDate),
      radiogram: radiogram.text,
    };

    const success = await saveReport(user.uid, sess.id, report);
    if (success) {
      setSession((prev) => (prev ? { ...prev, report } : null));
    }
    return success;
  };

  const lookupCallsign = useCallback(
    async (callsign: string): Promise<Station | null> => {
      if (!user || !profile) return null;

      const cachedStation = await getStation(user.uid, callsign);
      if (cachedStation) {
        return cachedStation;
      }

      if (!profile.qrzUsername || !profile.qrzPassword) {
        const station: Station = {
          callsign: callsign.toUpperCase(),
          firstName: 'Unknown',
          nickname: null,
          note: null,
          lastSeen: null as any,
        };
        await saveStation(user.uid, station);
        return station;
      }

      try {
        const response = await fetch('/api/qrz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callsign,
            username: profile.qrzUsername,
            password: profile.qrzPassword,
          }),
        });

        const data = await response.json();

        if (data.error) {
          console.error('QRZ lookup error:', data.error);
          const station: Station = {
            callsign: callsign.toUpperCase(),
            firstName: 'Unknown',
            nickname: null,
            note: null,
            lastSeen: null as any,
          };
          await saveStation(user.uid, station);
          return station;
        }

        const station: Station = {
          callsign: data.callsign,
          firstName: data.nickname || data.firstName || 'Unknown',
          nickname: null,
          note: null,
          lastSeen: null as any,
        };
        await saveStation(user.uid, station);
        return station;
      } catch (error) {
        console.error('QRZ lookup failed:', error);
        return null;
      }
    },
    [user, profile]
  );

  const handleCheckIn = async (checkIn: CheckIn) => {
    if (!user || !session?.id) return;

    const existingCheckIn = session.checkIns.find(
      (c) => c.callsign.toUpperCase() === checkIn.callsign.toUpperCase()
    );
    if (existingCheckIn) {
      return;
    }

    setIsLookingUp(true);

    const station = await lookupCallsign(checkIn.callsign);
    if (station) {
      setStations((prev) => new Map(prev).set(station.callsign, station));
    }

    const success = await addCheckIn(
      user.uid,
      session.id,
      checkIn,
      session.checkIns
    );

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, checkIns: [...prev.checkIns, checkIn] } : null
      );
    }

    setIsLookingUp(false);
  };

  const handleRemoveCheckIn = async (callsign: string) => {
    if (!user || !session?.id) return;

    const success = await removeCheckIn(
      user.uid,
      session.id,
      callsign,
      session.checkIns
    );

    if (success) {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              checkIns: prev.checkIns.filter(
                (c) => c.callsign.toUpperCase() !== callsign.toUpperCase()
              ),
            }
          : null
      );
    }
  };

  const handleUpdateNickname = async (
    callsign: string,
    nickname: string | null
  ) => {
    if (!user) return;

    const success = await updateStationNickname(user.uid, callsign, nickname);

    if (success) {
      setStations((prev) => {
        const newMap = new Map(prev);
        const station = newMap.get(callsign.toUpperCase());
        if (station) {
          newMap.set(callsign.toUpperCase(), { ...station, nickname });
        }
        return newMap;
      });
    }
  };

  const handleUpdateNote = async (
    callsign: string,
    note: string | null
  ) => {
    if (!user) return;

    const success = await updateStationNote(user.uid, callsign, note);

    if (success) {
      setStations((prev) => {
        const newMap = new Map(prev);
        const station = newMap.get(callsign.toUpperCase());
        if (station) {
          newMap.set(callsign.toUpperCase(), { ...station, note });
        }
        return newMap;
      });
    }
  };

  const handleTrafficReportedChange = async (value: number) => {
    if (!user || !session?.id) return;

    const success = await updateSession(user.uid, session.id, {
      trafficReported: value,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, trafficReported: value } : null
      );
    }
  };

  const handleTrafficClearedChange = async (value: number) => {
    if (!user || !session?.id) return;

    const success = await updateSession(user.uid, session.id, {
      trafficCleared: value,
    });

    if (success) {
      setSession((prev) => (prev ? { ...prev, trafficCleared: value } : null));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleNewSession = () => {
    setSession(null);
    setStations(new Map());
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">NetLogger</h1>
          <div className="flex items-center gap-4">
            {profile?.callsign && (
              <span className="font-mono text-gray-600">
                {profile.callsign}
              </span>
            )}
            <Link
              href="/settings"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Settings
            </Link>
            {session && (
              <button
                onClick={handleNewSession}
                className="text-gray-600 hover:text-gray-800 text-sm"
              >
                New Session
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {!profile?.callsign && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800">
              Please{' '}
              <Link href="/settings" className="underline font-medium">
                configure your settings
              </Link>{' '}
              to set your callsign and QRZ credentials.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <SessionSetup
              onCreateSession={handleCreateSession}
              existingSession={session}
              onUpdateSession={handleUpdateSession}
            />

            {session && (
              <>
                <CheckInForm
                  onCheckIn={handleCheckIn}
                  disabled={isLookingUp}
                />
                <CheckInList
                  checkIns={session.checkIns}
                  stations={stations}
                  onRemove={handleRemoveCheckIn}
                  onUpdateNickname={handleUpdateNickname}
                  onUpdateNote={handleUpdateNote}
                />
              </>
            )}
          </div>

          <div className="space-y-4">
            {session && (
              <TrafficCounter
                reported={session.trafficReported}
                cleared={session.trafficCleared}
                onReportedChange={handleTrafficReportedChange}
                onClearedChange={handleTrafficClearedChange}
              />
            )}

            <ReportGenerator
              session={session}
              stations={stations}
              profile={profile}
              onSaveReport={handleSaveReport}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
