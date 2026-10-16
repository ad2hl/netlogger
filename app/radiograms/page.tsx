'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import {
  getAllSessions,
  getAllRadiograms,
  addRadiogram,
  updateRadiogram,
  deleteRadiogram,
  splitBookRadiogram,
  updateSession,
  updateUserProfile,
} from '@/lib/firestore';
import { NetSession, Radiogram, NetReport } from '@/types';
import { Timestamp, deleteField } from 'firebase/firestore';
import ReadOnlyRadiogram from '@/components/ReadOnlyRadiogram';
import RadiogramForm from '@/components/RadiogramForm';
import HeaderBanner from '@/components/HeaderBanner';
import NavMenu from '@/components/NavMenu';
import { formatDate, formatTime } from '@/lib/time';

interface RadiogramListItem {
  type: 'Radiogram' | 'Book' | 'Net Report';
  sessionId: string;
  sortDate: Date;
  displayDate: string;
  netName: string;
  number: string;
  stationOfOrigin: string;
  addresseePreview: string;
  disposition: string;
  radiogram?: Radiogram;
  netReport?: NetReport;
}

type SortColumn = 'date' | 'netName' | 'type' | 'number' | 'stationOfOrigin' | 'addressee' | 'disposition';

function formatDisplayDate(date: Date, utc: boolean): string {
  return formatDate(date, utc) + ' ' + formatTime(date, utc);
}

function buildItems(radiograms: Radiogram[], sessions: NetSession[], utc: boolean): RadiogramListItem[] {
  const items: RadiogramListItem[] = [];

  // User-created radiograms from the independent collection
  for (const radiogram of radiograms) {
    const itemDate = (radiogram.createdAt ?? radiogram.savedAt)?.toDate() ?? new Date();
    const displayDate = formatDisplayDate(itemDate, utc);

    items.push({
      type: radiogram.isBook ? 'Book' : 'Radiogram',
      sessionId: radiogram.sessionId || '',
      sortDate: itemDate,
      displayDate,
      netName: radiogram.sessionNetName ?? '',
      number: radiogram.isBook ? `Book of ${radiogram.number}` : radiogram.number,
      stationOfOrigin: radiogram.stationOfOrigin,
      addresseePreview: ((radiogram.isBook ? radiogram.bookEntries?.[0]?.address : radiogram.address) || '').split('\n')[0],
      disposition: radiogram.dispositionMethod || '',
      radiogram,
    });
  }

  // Net reports (still embedded in sessions)
  for (const session of sessions) {
    if (session.report) {
      const report = session.report;
      const reportDate = report.savedAt
        ? report.savedAt.toDate()
        : report.startDateTime.toDate();
      const displayDate = formatDisplayDate(reportDate, utc);

      let number: string;
      let stationOfOrigin: string;
      let addresseePreview: string;
      let disposition = '';

      if (report.parts) {
        number = report.parts.number;
        stationOfOrigin = report.parts.stationOfOrigin;
        addresseePreview = report.parts.addressee;
        disposition = report.parts.dispositionMethod || '';
      } else {
        // Fallback: parse from text for old reports without parts
        const lines = report.radiogram.split('\n');
        addresseePreview = lines[1] || '';
        const preambleParts = (lines[0] || '').split(/\s+/);
        number = preambleParts[0] || '';
        stationOfOrigin = preambleParts[2] || '';
      }

      items.push({
        type: 'Net Report',
        sessionId: session.id || '',
        sortDate: reportDate,
        displayDate,
        netName: session.netName,
        number,
        stationOfOrigin,
        addresseePreview,
        disposition,
        netReport: report,
      });
    }
  }

  return items;
}

export default function RadiogramsPage() {
  const { user, profile, loading, emailVerified, refreshProfile } = useAuth();
  const router = useRouter();
  const utc = profile?.timeZone === 'utc';
  const [radiograms, setRadiograms] = useState<Radiogram[]>([]);
  const [sessions, setSessions] = useState<NetSession[]>([]);
  const [fetching, setFetching] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedItem, setSelectedItem] = useState<RadiogramListItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRadiogram, setEditingRadiogram] = useState<Radiogram | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RadiogramListItem | null>(null);


  useEffect(() => {
    if (!loading && (!user || !emailVerified)) {
      router.push('/');
    }
  }, [user, loading, emailVerified, router]);

  useEffect(() => {
    if (user) {
      Promise.all([
        getAllRadiograms(user.uid),
        getAllSessions(user.uid),
      ]).then(([rads, sess]) => {
        setRadiograms(rads);
        setSessions(sess);
        setFetching(false);
      });
    }
  }, [user]);

  const items = useMemo(() => buildItems(radiograms, sessions, utc), [radiograms, sessions, utc]);

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'date':
          cmp = a.sortDate.getTime() - b.sortDate.getTime();
          break;
        case 'netName':
          cmp = a.netName.localeCompare(b.netName);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'number':
          cmp = a.number.localeCompare(b.number);
          break;
        case 'stationOfOrigin':
          cmp = a.stationOfOrigin.localeCompare(b.stationOfOrigin);
          break;
        case 'addressee':
          cmp = a.addresseePreview.localeCompare(b.addresseePreview);
          break;
        case 'disposition':
          cmp = a.disposition.localeCompare(b.disposition);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [items, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortArrow = (column: SortColumn) => {
    if (column !== sortColumn) return null;
    return sortDirection === 'asc' ? ' \u2191' : ' \u2193';
  };

  const handleUpdateDisposition = async (item: RadiogramListItem, disposition: {
    dispositionMethod: string;
    dispositionDestination: string;
    dispositionDate: string;
    dispositionTime: string;
  }) => {
    if (!user || item.type !== 'Net Report' || !item.sessionId) return;
    const session = sessions.find((s) => s.id === item.sessionId);
    if (!session?.report?.parts) return;
    const updatedReport = {
      ...session.report,
      parts: { ...session.report.parts, ...disposition },
    };
    const success = await updateSession(user.uid, item.sessionId, { report: updatedReport });
    if (success) {
      setSessions((prev) => prev.map((s) =>
        s.id === item.sessionId ? { ...s, report: updatedReport } : s
      ));
    }
  };

  const handleDeleteItem = async () => {
    if (!user || !deleteTarget) return;

    if (deleteTarget.type !== 'Net Report' && deleteTarget.radiogram) {
      const success = await deleteRadiogram(user.uid, deleteTarget.radiogram.id);
      if (success) {
        setRadiograms((prev) => prev.filter((r) => r.id !== deleteTarget.radiogram!.id));
      }
    } else if (deleteTarget.type === 'Net Report') {
      const success = await updateSession(user.uid, deleteTarget.sessionId, {
        report: deleteField(),
      } as unknown as Partial<NetSession>);
      if (success) {
        setSessions((prev) => prev.map((s) =>
          s.id === deleteTarget.sessionId ? { ...s, report: undefined } : s
        ));
      }
    }

    setDeleteTarget(null);
  };

  const handleAssignMessageNumber = async (): Promise<string> => {
    const nextNum = profile?.nextMessageNumber ?? 1;
    if (user) {
      await updateUserProfile(user.uid, { nextMessageNumber: nextNum + 1 });
      await refreshProfile();
    }
    return String(nextNum);
  };

  const handleAssignMessageNumbers = async (count: number): Promise<string[]> => {
    const nextNum = profile?.nextMessageNumber ?? 1;
    if (user) {
      await updateUserProfile(user.uid, { nextMessageNumber: nextNum + count });
      await refreshProfile();
    }
    return Array.from({ length: count }, (_, i) => String(nextNum + i));
  };

  const handleSplitRadiogram = async (book: Radiogram, splitRadiograms: Radiogram[]) => {
    if (!user) return;
    const withMeta = splitRadiograms.map((r) => ({ ...r, savedAt: Timestamp.now() }));
    const success = await splitBookRadiogram(user.uid, book.id, withMeta);
    if (success) {
      setRadiograms((prev) => [...withMeta, ...prev]);
    }
  };

  const handleSaveRadiogram = async (radiogram: Radiogram) => {
    if (!user) return;
    const radiogramWithTimestamp = { ...radiogram, savedAt: Timestamp.now() };
    const isExisting = radiograms.some((r) => r.id === radiogram.id);
    if (isExisting) {
      const success = await updateRadiogram(user.uid, radiogram.id, radiogramWithTimestamp);
      if (success) {
        setRadiograms((prev) => prev.map((r) => r.id === radiogram.id ? radiogramWithTimestamp : r));
      }
    } else {
      const success = await addRadiogram(user.uid, radiogramWithTimestamp);
      if (success) {
        setRadiograms((prev) => [radiogramWithTimestamp, ...prev]);
      }
    }
  };

  const handleDeleteRadiogram = async (id: string) => {
    if (!user) return;
    const success = await deleteRadiogram(user.uid, id);
    if (success) {
      setRadiograms((prev) => prev.filter((r) => r.id !== id));
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div>
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/home" className="flex items-center gap-2 text-xl font-bold text-slate-900 hover:text-cyan-700 transition-colors">
              <Image src="/icon.png" alt="NetLogger logo" width={28} height={28} />
              AD2HL Net Logger
            </Link>
            <HeaderBanner />
          </div>
          <div className="flex items-center gap-4">
            <NavMenu helpPage="radiograms" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Radiograms</h2>
          <button
            onClick={() => { setEditingRadiogram(null); setIsFormOpen(true); }}
            className="bg-amber-700 text-white py-1 px-3 rounded-md hover:bg-amber-900 text-sm"
          >
            New Radiogram
          </button>
        </div>

        {fetching ? (
          <p className="text-slate-500">Loading...</p>
        ) : sortedItems.length === 0 ? (
          <p className="text-slate-500">No radiograms or net reports found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('date')}
                  >
                    Date/Time{sortArrow('date')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('netName')}
                  >
                    Net Name{sortArrow('netName')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('type')}
                  >
                    Type{sortArrow('type')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('number')}
                  >
                    Number{sortArrow('number')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('stationOfOrigin')}
                  >
                    Station of Origin{sortArrow('stationOfOrigin')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('addressee')}
                  >
                    Addressee{sortArrow('addressee')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('disposition')}
                  >
                    Sent{sortArrow('disposition')}
                  </th>
                  <th className="py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      if (item.type !== 'Net Report') {
                        setEditingRadiogram(item.radiogram ?? null);
                        setIsFormOpen(true);
                      } else {
                        setSelectedItem(item);
                      }
                    }}
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">{item.displayDate}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{item.netName}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{item.type}</td>
                    <td className="py-2 pr-4">{item.number}</td>
                    <td className="py-2 pr-4">{item.stationOfOrigin}</td>
                    <td className="py-2 pr-4 truncate max-w-xs">{item.addresseePreview}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{item.disposition}</td>
                    <td className="py-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title={`Delete ${item.type.toLowerCase()}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selectedItem && (
        <ReadOnlyRadiogram
          netReport={selectedItem.netReport}
          onClose={() => setSelectedItem(null)}
          onUpdateDisposition={
            // Net reports without parts can't store disposition
            selectedItem.netReport && !selectedItem.netReport.parts
              ? undefined
              : (d) => handleUpdateDisposition(selectedItem, d)
          }
          dispositionMethods={profile?.dispositionMethods}
          userProfile={profile ?? undefined}
        />
      )}

      <RadiogramForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingRadiogram(null); }}
        onSave={handleSaveRadiogram}
        onDelete={handleDeleteRadiogram}
        existingRadiogram={editingRadiogram}
        dispositionMethods={profile?.dispositionMethods}
        receivedMethods={profile?.receivedMethods}
        userProfile={profile ?? undefined}
        onAssignNumber={handleAssignMessageNumber}
        onAssignNumbers={handleAssignMessageNumbers}
        onSplit={handleSplitRadiogram}
      />

      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Delete {deleteTarget.type}?
            </h2>
            <p className="text-gray-600 mb-6">
              This will permanently delete {deleteTarget.type === 'Book' ? '' : deleteTarget.type === 'Radiogram' ? 'radiogram ' : 'net report '}
              <strong>{deleteTarget.number}</strong> from <strong>{deleteTarget.stationOfOrigin}</strong>.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
