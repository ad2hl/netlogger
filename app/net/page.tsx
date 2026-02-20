'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { signOut } from '@/lib/auth';
import {
  createSession,
  updateSession,
  addCheckIn,
  removeCheckIn,
  updateCheckInTags,
  getStation,
  saveStation,
  updateStationNickname,
  updateStationLocation,
  updateStationNote,
  getActiveSession,
  getSession,
  getStations,
  getAllStations,
  saveReport,
  deleteSession,
  getRecentSessions,
} from '@/lib/firestore';
import { NetSession, CheckIn, Station, NetReport, Radiogram, TrafficItem } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { generateRadiogram } from '@/lib/radiogram';
import HeaderBanner from '@/components/HeaderBanner';
import SessionSetup from '@/components/SessionSetup';
import CheckInForm from '@/components/CheckInForm';
import CheckInList from '@/components/CheckInList';
import SessionSummary from '@/components/SessionSummary';
import RadiogramList from '@/components/RadiogramList';
import Checklist from '@/components/Checklist';
import ReportGenerator from '@/components/ReportGenerator';
import { apiFetch } from '@/lib/api-fetch';


export default function NetPageWrapper() {
  return (
    <Suspense fallback={null}>
      <NetPage />
    </Suspense>
  );
}

function NetPage() {
  const { user, profile, loading, emailVerified, photoURL } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('session');

  const [session, setSession] = useState<NetSession | null>(null);
  const [stations, setStations] = useState<Map<string, Station>>(new Map());
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [addingTrafficFor, setAddingTrafficFor] = useState<string | null>(null);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [sessionDefaults, setSessionDefaults] = useState<{ netName: string; startTime: string } | undefined>();
  const checkInFormRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!loading && (!user || !emailVerified)) {
      router.push('/');
    }
  }, [user, loading, emailVerified, router]);
  useEffect(() => {
    if (!showAbandonModal) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAbandonModal(false); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAbandonModal]);

  // Load all stations for lookup on mount
  useEffect(() => {
    const loadAllStations = async () => {
      if (!user || loading) return;
      const stations = await getAllStations(user.uid);
      setAllStations(stations);
    };
    loadAllStations();
  }, [user, loading]);

  // Check for active session on load (or load specific session from URL)
  useEffect(() => {
    const loadSession = async () => {
      if (!user || loading || session) return;

      let loadedSession: NetSession | null = null;

      if (sessionIdParam) {
        loadedSession = await getSession(user.uid, sessionIdParam);
      } else {
        loadedSession = await getActiveSession(user.uid);
      }

      if (loadedSession) {
        setSession(loadedSession);

        // Load stations for all checked-in callsigns
        const callsigns = loadedSession.checkIns.map((c) => c.callsign);
        if (callsigns.length > 0) {
          const stationMap = await getStations(user.uid, callsigns);
          setStations(stationMap);
        }
      } else {
        // No active session — pre-fill defaults from most recent session
        const recent = await getRecentSessions(user.uid, 1);
        if (recent.length > 0) {
          setSessionDefaults({
            netName: recent[0].netName || '',
            startTime: recent[0].startTime || '',
          });
        }
      }
    };

    loadSession();
  }, [user, loading, session, sessionIdParam]);

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
        handleSaveReport(undefined, updatedSession);
      }
    }
  };

  const handleSaveReport = async (messageNumber?: string, currentSession?: NetSession) => {
    const sess = currentSession || session;
    if (!user || !sess?.id || !profile?.callsign) return;

    const radiogram = generateRadiogram({
      session: sess,
      stations,
      userCallsign: profile.callsign,
      userName: profile.name,
      userLocation: profile.location,
      addresseeCallsign: profile.netManagerCall || '',
      messageNumber,
    });

    // Combine date and startTime into a single timestamp
    const sessionDate = sess.date.toDate();
    const [hours, minutes] = sess.startTime.split(':').map(Number);
    sessionDate.setHours(hours, minutes, 0, 0);

    const report: NetReport = {
      netName: sess.netName,
      startDateTime: Timestamp.fromDate(sessionDate),
      radiogram: radiogram.text,
      savedAt: Timestamp.now(),
      parts: radiogram.parts,
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

      // Return cached station if it has location data, or if no QRZ credentials
      if (cachedStation && (cachedStation.city || !profile.qrzUsername || !profile.qrzPassword)) {
        return cachedStation;
      }

      if (!profile.qrzUsername || !profile.qrzPassword) {
        const station: Station = {
          callsign: callsign.toUpperCase(),
          firstName: null,
          nickname: null,
          city: null,
          state: null,
          note: null,
          lastSeen: null as any,
        };
        await saveStation(user.uid, station);
        return station;
      }

      try {
        const token = await user.getIdToken();
        const response = await apiFetch('/api/qrz', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
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
            firstName: null,
            nickname: null,
            city: null,
            state: null,
            note: null,
            lastSeen: null as any,
          };
          await saveStation(user.uid, station);
          return station;
        }

        const station: Station = {
          callsign: data.callsign,
          firstName: data.nickname || data.firstName || null,
          nickname: cachedStation?.nickname || null,
          city: data.city || null,
          state: data.state || null,
          note: cachedStation?.note || null,
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

    // If station already checked in, merge new tags and move to end
    if (existingCheckIn) {
      // Only update if there are new tags to add
      if (checkIn.tags.length === 0) return;

      const updatedCheckIns = await updateCheckInTags(
        user.uid,
        session.id,
        checkIn.callsign,
        checkIn.tags,
        session.checkIns
      );

      if (updatedCheckIns) {
        setSession((prev) =>
          prev ? { ...prev, checkIns: updatedCheckIns } : null
        );
      }
      return;
    }

    setIsLookingUp(true);

    const station = await lookupCallsign(checkIn.callsign);
    if (station) {
      setStations((prev) => new Map(prev).set(station.callsign, station));
      // Update allStations for search lookup
      setAllStations((prev) => {
        const existingIndex = prev.findIndex(
          (s) => s.callsign.toUpperCase() === station.callsign.toUpperCase()
        );
        if (existingIndex >= 0) {
          // Update existing station (move to front since it's most recent)
          const updated = [...prev];
          updated.splice(existingIndex, 1);
          return [station, ...updated];
        }
        // Add new station at the front (most recent)
        return [station, ...prev];
      });
    }

    const success = await addCheckIn(
      user.uid,
      session.id,
      checkIn,
      session.checkIns
    );

    if (success) {
      const isFirstCheckIn = session.checkIns.length === 0;
      setSession((prev) =>
        prev ? {
          ...prev,
          checkIns: [...prev.checkIns, checkIn],
          // Auto-set bookmark on first check-in
          lastAcknowledged: isFirstCheckIn ? checkIn.callsign.toUpperCase() : prev.lastAcknowledged,
        } : null
      );

      // Persist bookmark for first check-in
      if (isFirstCheckIn) {
        await updateSession(user.uid, session.id, {
          lastAcknowledged: checkIn.callsign.toUpperCase(),
        });
      }
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
      // Check if we're removing the bookmarked station
      const isRemovingBookmarked =
        session.lastAcknowledged?.toUpperCase() === callsign.toUpperCase();

      let newLastAcknowledged = session.lastAcknowledged;

      if (isRemovingBookmarked) {
        // Find the index of the station being removed
        const removedIndex = session.checkIns.findIndex(
          (c) => c.callsign.toUpperCase() === callsign.toUpperCase()
        );

        // Move bookmark to previous station, or null if none
        if (removedIndex > 0) {
          newLastAcknowledged = session.checkIns[removedIndex - 1].callsign.toUpperCase();
        } else if (session.checkIns.length > 1) {
          // If removing first station and there are others, move to the new first
          newLastAcknowledged = session.checkIns[1].callsign.toUpperCase();
        } else {
          newLastAcknowledged = null;
        }

        // Persist the bookmark change
        await updateSession(user.uid, session.id, {
          lastAcknowledged: newLastAcknowledged,
        });
      }

      setSession((prev) =>
        prev
          ? {
              ...prev,
              checkIns: prev.checkIns.filter(
                (c) => c.callsign.toUpperCase() !== callsign.toUpperCase()
              ),
              lastAcknowledged: newLastAcknowledged,
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

  const handleUpdateLocation = async (
    callsign: string,
    city: string | null,
    state: string | null
  ) => {
    if (!user) return;

    const success = await updateStationLocation(user.uid, callsign, city, state);

    if (success) {
      setStations((prev) => {
        const newMap = new Map(prev);
        const station = newMap.get(callsign.toUpperCase());
        if (station) {
          newMap.set(callsign.toUpperCase(), { ...station, city, state });
        }
        return newMap;
      });
    }
  };

  const handleUpdateCallsign = async (oldCallsign: string, newCallsign: string) => {
    if (!user || !session?.id) return;

    const normalizedOld = oldCallsign.toUpperCase();
    const normalizedNew = newCallsign.toUpperCase();

    // Update the checkIn in the session
    const updatedCheckIns = session.checkIns.map((c) =>
      c.callsign.toUpperCase() === normalizedOld
        ? { ...c, callsign: normalizedNew }
        : c
    );

    const success = await updateSession(user.uid, session.id, {
      checkIns: updatedCheckIns,
      // Update bookmark if it was pointing to the old callsign
      lastAcknowledged:
        session.lastAcknowledged?.toUpperCase() === normalizedOld
          ? normalizedNew
          : session.lastAcknowledged,
    });

    if (success) {
      // Look up the new callsign
      const station = await lookupCallsign(normalizedNew);

      setStations((prev) => {
        const newMap = new Map(prev);
        // Remove old station entry
        newMap.delete(normalizedOld);
        // Add new station entry
        if (station) {
          newMap.set(normalizedNew, station);
        }
        return newMap;
      });

      setSession((prev) =>
        prev
          ? {
              ...prev,
              checkIns: updatedCheckIns,
              lastAcknowledged:
                prev.lastAcknowledged?.toUpperCase() === normalizedOld
                  ? normalizedNew
                  : prev.lastAcknowledged,
            }
          : null
      );
    }
  };

  const handleSetLastAcknowledged = async (callsign: string) => {
    if (!user || !session?.id) return;

    const success = await updateSession(user.uid, session.id, {
      lastAcknowledged: callsign.toUpperCase(),
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, lastAcknowledged: callsign.toUpperCase() } : null
      );
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

  const handleSaveRadiogram = async (radiogram: Radiogram) => {
    if (!user || !session?.id) return;

    const radiogramWithTimestamp = { ...radiogram, savedAt: Timestamp.now(), sessionNetName: session.netName };
    const currentRadiograms = session.radiograms || [];
    const existingIndex = currentRadiograms.findIndex(r => r.id === radiogram.id);
    let updatedRadiograms: Radiogram[];

    if (existingIndex >= 0) {
      // Update existing radiogram
      updatedRadiograms = [...currentRadiograms];
      updatedRadiograms[existingIndex] = radiogramWithTimestamp;
    } else {
      // Add new radiogram
      updatedRadiograms = [...currentRadiograms, radiogramWithTimestamp];
    }

    const success = await updateSession(user.uid, session.id, {
      radiograms: updatedRadiograms,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, radiograms: updatedRadiograms } : null
      );
    }
  };

  const handleDeleteRadiogram = async (id: string) => {
    if (!user || !session?.id) return;

    const currentRadiograms = session.radiograms || [];
    const updatedRadiograms = currentRadiograms.filter(r => r.id !== id);

    const success = await updateSession(user.uid, session.id, {
      radiograms: updatedRadiograms,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, radiograms: updatedRadiograms } : null
      );
    }
  };

  const handleAddTrafficItem = async (fromCallsign: string, toDestination: string) => {
    if (!user || !session?.id) return;

    const newItem: TrafficItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      fromCallsign: fromCallsign.toUpperCase(),
      toDestination: toDestination.toUpperCase(),
      checked: false,
    };

    const currentItems = session.trafficItems || [];
    const updatedItems = [...currentItems, newItem];
    const updatedReported = session.trafficReported + 1;

    const success = await updateSession(user.uid, session.id, {
      trafficItems: updatedItems,
      trafficReported: updatedReported,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, trafficItems: updatedItems, trafficReported: updatedReported } : null
      );
    }
  };

  const handleToggleTrafficItem = async (id: string) => {
    if (!user || !session?.id) return;

    const currentItems = session.trafficItems || [];
    const item = currentItems.find((i) => i.id === id);
    if (!item) return;

    const updatedItems = currentItems.map((i) =>
      i.id === id ? { ...i, checked: !i.checked } : i
    );
    const updatedCleared = item.checked
      ? session.trafficCleared - 1
      : session.trafficCleared + 1;

    const success = await updateSession(user.uid, session.id, {
      trafficItems: updatedItems,
      trafficCleared: updatedCleared,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, trafficItems: updatedItems, trafficCleared: updatedCleared } : null
      );
    }
  };

  const handleDeleteTrafficItem = async (id: string) => {
    if (!user || !session?.id) return;

    const currentItems = session.trafficItems || [];
    const item = currentItems.find((i) => i.id === id);
    if (!item) return;

    const updatedItems = currentItems.filter((i) => i.id !== id);
    const updatedReported = session.trafficReported - 1;
    const updatedCleared = item.checked
      ? session.trafficCleared - 1
      : session.trafficCleared;

    const success = await updateSession(user.uid, session.id, {
      trafficItems: updatedItems,
      trafficReported: updatedReported,
      trafficCleared: updatedCleared,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, trafficItems: updatedItems, trafficReported: updatedReported, trafficCleared: updatedCleared } : null
      );
    }
  };

  const handleToggleAnnouncement = async (callsign: string) => {
    if (!user || !session?.id) return;

    const currentChecked = session.checkedAnnouncements || [];
    const isCurrentlyChecked = currentChecked.includes(callsign);
    const updatedChecked = isCurrentlyChecked
      ? currentChecked.filter((c) => c !== callsign)
      : [...currentChecked, callsign];

    const success = await updateSession(user.uid, session.id, {
      checkedAnnouncements: updatedChecked,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, checkedAnnouncements: updatedChecked } : null
      );
    }
  };

  const handleToggleSecure = async (callsign: string) => {
    if (!user || !session?.id) return;

    const currentChecked = session.checkedSecure || [];
    const isCurrentlyChecked = currentChecked.includes(callsign);
    const updatedChecked = isCurrentlyChecked
      ? currentChecked.filter((c) => c !== callsign)
      : [...currentChecked, callsign];

    const success = await updateSession(user.uid, session.id, {
      checkedSecure: updatedChecked,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, checkedSecure: updatedChecked } : null
      );
    }
  };

  const handleTabToTraffic = useCallback(() => {
    if (!session) return;

    const trafficItems = session.trafficItems || [];
    const stationsWithItems = new Set(trafficItems.map(i => i.fromCallsign.toUpperCase()));

    const stationsWithTrafficTag = session.checkIns
      .filter(c => c.tags.includes('T'))
      .map(c => c.callsign.toUpperCase());

    const firstNeedingTraffic = stationsWithTrafficTag.find(cs => !stationsWithItems.has(cs));

    if (firstNeedingTraffic) {
      setAddingTrafficFor(firstNeedingTraffic);
    }
  }, [session]);

  const handleTrafficEntryDone = useCallback(() => {
    setAddingTrafficFor(null);
    setTimeout(() => checkInFormRef.current?.focus(), 0);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleEndSession = async () => {
    if (!session?.id || session.endTime) return;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    await handleUpdateSession({ endTime: timeStr });
  };

  const handleNewSession = () => {
    if (session && !session.report) {
      setShowAbandonModal(true);
    } else {
      setSession(null);
      setStations(new Map());
    }
  };

  const handleConfirmAbandon = async () => {
    if (!user || !session?.id) return;

    // Move radiograms to the most recent other session
    const radiograms = session.radiograms || [];
    if (radiograms.length > 0) {
      const recentSessions = await getRecentSessions(user.uid, 10);
      const otherSession = recentSessions.find((s) => s.id !== session.id);
      if (otherSession?.id) {
        const existingRadiograms = otherSession.radiograms || [];
        await updateSession(user.uid, otherSession.id!, {
          radiograms: [...existingRadiograms, ...radiograms],
        });
      }
    }

    // Delete the abandoned session from Firestore
    await deleteSession(user.uid, session.id);

    // Clear local state
    setSession(null);
    setStations(new Map());
    setShowAbandonModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div>
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">NetLogger</h1>
            <HeaderBanner />
          </div>
          <div className="flex items-center gap-4">
            {profile?.callsign && (
              <span className="font-mono text-slate-600">
                {profile.callsign}
              </span>
            )}
            <Link
              href="/sessions"
              className="text-cyan-700 hover:text-cyan-900 text-sm"
            >
              Sessions
            </Link>
            <Link
              href="/radiograms"
              className="text-cyan-700 hover:text-cyan-900 text-sm"
            >
              Radiograms
            </Link>
            <Link
              href="/stations"
              className="text-cyan-700 hover:text-cyan-900 text-sm"
            >
              Stations
            </Link>
            {session && (
              <button
                onClick={handleNewSession}
                className="text-slate-600 hover:text-slate-800 text-sm"
              >
                New Session
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="text-slate-600 hover:text-slate-800 text-sm"
            >
              Sign Out
            </button>
            <Link href="/settings" title="Settings">
              <img
                src={photoURL || '/profile-head.png'}
                alt="Settings"
                className="w-7 h-7 rounded-full object-cover border border-slate-200"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.src = '/profile-head.png'; }}
              />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-3">
        {!profile?.callsign && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800">
              Please{' '}
              <Link href="/settings" className="underline font-medium">
                configure your settings
              </Link>{' '}
              to set your callsign.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Row 1: Session form (no session) or Session Summary (session active) */}
          {!session && (
            <div className="lg:col-span-2">
              <SessionSetup
                onCreateSession={handleCreateSession}
                defaults={sessionDefaults}
              />
            </div>
          )}

          {session && (
            <div className="lg:col-span-2 space-y-2">
              <CheckInForm
                ref={checkInFormRef}
                onCheckIn={handleCheckIn}
                disabled={isLookingUp}
                allStations={allStations}
                onTabToTraffic={handleTabToTraffic}
              />
              <CheckInList
                checkIns={session.checkIns}
                stations={stations}
                onRemove={handleRemoveCheckIn}
                onUpdateCallsign={handleUpdateCallsign}
                onUpdateNickname={handleUpdateNickname}
                onUpdateNote={handleUpdateNote}
                onUpdateLocation={handleUpdateLocation}
                lastAcknowledged={session.lastAcknowledged}
                onSetLastAcknowledged={handleSetLastAcknowledged}
              />
            </div>
          )}

          {session && (
            <div className="lg:col-start-3 space-y-4">
              <div className="space-y-2">
                <SessionSummary
                  netName={session.netName}
                  date={session.date.toDate()}
                  stationCount={session.checkIns.length}
                  reported={session.trafficReported}
                  cleared={session.trafficCleared}
                  onReportedChange={handleTrafficReportedChange}
                  onClearedChange={handleTrafficClearedChange}
                  startTime={session.startTime}
                  endTime={session.endTime}
                  ncCallsign={session.checkIns.find(c => c.tags.includes('NC'))?.callsign ?? null}
                  ancCallsigns={session.checkIns.filter(c => c.tags.includes('ANC')).map(c => c.callsign)}
                  onUpdateSession={handleUpdateSession}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEndSession}
                    disabled={!!session.endTime}
                    className="flex-1 bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    End Session
                  </button>
                  <button
                    onClick={() => setShowReport(true)}
                    disabled={!session.endTime}
                    className="flex-1 bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Show Report
                  </button>
                </div>
              </div>
              <Checklist
                checkIns={session.checkIns}
                trafficItems={session.trafficItems || []}
                checkedAnnouncements={session.checkedAnnouncements || []}
                checkedSecure={session.checkedSecure || []}
                onAddTrafficItem={handleAddTrafficItem}
                onToggleTrafficItem={handleToggleTrafficItem}
                onDeleteTrafficItem={handleDeleteTrafficItem}
                onToggleAnnouncement={handleToggleAnnouncement}
                onToggleSecure={handleToggleSecure}
                addingTrafficFor={addingTrafficFor}
                onAddingTrafficForChange={setAddingTrafficFor}
                onTrafficEntryDone={handleTrafficEntryDone}
              />
              <RadiogramList
                radiograms={session.radiograms || []}
                onSave={handleSaveRadiogram}
                onDelete={handleDeleteRadiogram}
                dispositionMethods={profile?.dispositionMethods}
              />
            </div>
          )}
        </div>
      </main>

      <ReportGenerator
        session={session}
        stations={stations}
        profile={profile}
        onSaveReport={handleSaveReport}
        isOpen={showReport}
        onClose={() => setShowReport(false)}
      />

      {showAbandonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Abandon Session?</h2>
            <p className="text-gray-600 mb-6">
              The current session will be ended and deleted. Any radiograms will be preserved. Station information will not be affected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAbandonModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAbandon}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium"
              >
                Abandon Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
