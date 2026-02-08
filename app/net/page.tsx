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
  updateCheckInTags,
  getStation,
  saveStation,
  updateStationNickname,
  updateStationNote,
  getActiveSession,
  getStations,
  getAllStations,
  saveReport,
} from '@/lib/firestore';
import { NetSession, CheckIn, Station, NetReport, Radiogram, TrafficItem } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { generateRadiogram } from '@/lib/radiogram';
import SessionSetup from '@/components/SessionSetup';
import CheckInForm from '@/components/CheckInForm';
import CheckInList from '@/components/CheckInList';
import TrafficCounter from '@/components/TrafficCounter';
import RadiogramList from '@/components/RadiogramList';
import Checklist from '@/components/Checklist';
import ReportGenerator from '@/components/ReportGenerator';
import PrivacyPolicySummary from '@/components/PrivacyPolicySummary';

export default function NetPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<NetSession | null>(null);
  const [stations, setStations] = useState<Map<string, Station>>(new Map());
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const [fullPolicyContent, setFullPolicyContent] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    fetch('/api/privacy-policy-summary')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setSummaryContent(data.content); })
      .catch(() => {});
    fetch('/api/privacy-policy')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setFullPolicyContent(data.content); })
      .catch(() => {});
  }, []);

  // Load all stations for lookup on mount
  useEffect(() => {
    const loadAllStations = async () => {
      if (!user || loading) return;
      const stations = await getAllStations(user.uid);
      setAllStations(stations);
    };
    loadAllStations();
  }, [user, loading]);

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
          firstName: 'Unknown',
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
          firstName: data.nickname || data.firstName || 'Unknown',
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

    const currentRadiograms = session.radiograms || [];
    const existingIndex = currentRadiograms.findIndex(r => r.id === radiogram.id);
    let updatedRadiograms: Radiogram[];

    if (existingIndex >= 0) {
      // Update existing radiogram
      updatedRadiograms = [...currentRadiograms];
      updatedRadiograms[existingIndex] = radiogram;
    } else {
      // Add new radiogram
      updatedRadiograms = [...currentRadiograms, radiogram];
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

    const success = await updateSession(user.uid, session.id, {
      trafficItems: updatedItems,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, trafficItems: updatedItems } : null
      );
    }
  };

  const handleToggleTrafficItem = async (id: string) => {
    if (!user || !session?.id) return;

    const currentItems = session.trafficItems || [];
    const updatedItems = currentItems.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );

    const success = await updateSession(user.uid, session.id, {
      trafficItems: updatedItems,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, trafficItems: updatedItems } : null
      );
    }
  };

  const handleDeleteTrafficItem = async (id: string) => {
    if (!user || !session?.id) return;

    const currentItems = session.trafficItems || [];
    const updatedItems = currentItems.filter((item) => item.id !== id);

    const success = await updateSession(user.uid, session.id, {
      trafficItems: updatedItems,
    });

    if (success) {
      setSession((prev) =>
        prev ? { ...prev, trafficItems: updatedItems } : null
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
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">NetLogger</h1>
          <div className="flex items-center gap-4">
            {profile?.callsign && (
              <span className="font-mono text-gray-600">
                {profile.callsign}
              </span>
            )}
            <Link
              href="/radiograms"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Radiograms
            </Link>
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
            {summaryContent && (
              <button
                onClick={() => setShowPrivacy(true)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Privacy Policy
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

      <main className="max-w-7xl mx-auto px-4 py-3">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-2">
            <SessionSetup
              onCreateSession={handleCreateSession}
              existingSession={session}
              onUpdateSession={handleUpdateSession}
              onShowReport={() => setShowReport(true)}
            />

            {session && (
              <>
                <CheckInForm
                  onCheckIn={handleCheckIn}
                  disabled={isLookingUp}
                  allStations={allStations}
                />
                <CheckInList
                  checkIns={session.checkIns}
                  stations={stations}
                  onRemove={handleRemoveCheckIn}
                  onUpdateCallsign={handleUpdateCallsign}
                  onUpdateNickname={handleUpdateNickname}
                  onUpdateNote={handleUpdateNote}
                  lastAcknowledged={session.lastAcknowledged}
                  onSetLastAcknowledged={handleSetLastAcknowledged}
                />
              </>
            )}
          </div>

          {session && (
            <div className="space-y-4">
              <TrafficCounter
                reported={session.trafficReported}
                cleared={session.trafficCleared}
                onReportedChange={handleTrafficReportedChange}
                onClearedChange={handleTrafficClearedChange}
              />
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
              />
              <RadiogramList
                radiograms={session.radiograms || []}
                onSave={handleSaveRadiogram}
                onDelete={handleDeleteRadiogram}
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
      {showPrivacy && summaryContent && (
        <PrivacyPolicySummary content={summaryContent} fullPolicyContent={fullPolicyContent ?? undefined} onClose={() => setShowPrivacy(false)} />
      )}
    </div>
  );
}
