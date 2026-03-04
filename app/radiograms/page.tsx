'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getAllSessions, updateSession } from '@/lib/firestore';
import { NetSession, Radiogram, NetReport } from '@/types';
import { Timestamp, deleteField } from 'firebase/firestore';
import ReadOnlyRadiogram from '@/components/ReadOnlyRadiogram';
import RadiogramForm from '@/components/RadiogramForm';
import HeaderBanner from '@/components/HeaderBanner';
import ProfileMenu from '@/components/ProfileMenu';

interface RadiogramListItem {
  type: 'Radiogram' | 'Net Report';
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

function buildItems(sessions: NetSession[]): RadiogramListItem[] {
  const items: RadiogramListItem[] = [];

  for (const session of sessions) {
    // User-created radiograms
    if (session.radiograms) {
      for (const radiogram of session.radiograms) {
        const itemDate = radiogram.savedAt
          ? radiogram.savedAt.toDate()
          : session.date.toDate();
        const displayDate = itemDate.toLocaleDateString() + ' ' +
          itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        items.push({
          type: 'Radiogram',
          sessionId: session.id || '',
          sortDate: itemDate,
          displayDate,
          netName: radiogram.sessionNetName ?? '',
          number: radiogram.number,
          stationOfOrigin: radiogram.stationOfOrigin,
          addresseePreview: (radiogram.address || '').split('\n')[0],
          disposition: radiogram.dispositionMethod || '',
          radiogram,
        });
      }
    }

    // Net reports
    if (session.report) {
      const report = session.report;
      const reportDate = report.savedAt
        ? report.savedAt.toDate()
        : report.startDateTime.toDate();
      const displayDate = reportDate.toLocaleDateString() + ' ' +
        reportDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
  const { user, profile, loading, emailVerified, photoURL } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<NetSession[]>([]);
  const [fetching, setFetching] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedItem, setSelectedItem] = useState<RadiogramListItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RadiogramListItem | null>(null);


  useEffect(() => {
    if (!loading && (!user || !emailVerified)) {
      router.push('/');
    }
  }, [user, loading, emailVerified, router]);

  useEffect(() => {
    if (user) {
      getAllSessions(user.uid).then((s) => {
        setSessions(s);
        setFetching(false);
      });
    }
  }, [user]);

  const items = useMemo(() => buildItems(sessions), [sessions]);

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
    if (!user || !item.sessionId) return;

    const session = sessions.find(s => s.id === item.sessionId);
    if (!session) return;

    if (item.type === 'Radiogram' && item.radiogram) {
      const updatedRadiograms = (session.radiograms || []).map(r =>
        r.id === item.radiogram!.id ? { ...r, ...disposition } : r
      );
      const success = await updateSession(user.uid, item.sessionId, { radiograms: updatedRadiograms });
      if (success) {
        setSessions(prev => prev.map(s =>
          s.id === item.sessionId ? { ...s, radiograms: updatedRadiograms } : s
        ));
      }
    } else if (item.type === 'Net Report' && session.report?.parts) {
      const updatedReport = {
        ...session.report,
        parts: { ...session.report.parts, ...disposition },
      };
      const success = await updateSession(user.uid, item.sessionId, { report: updatedReport });
      if (success) {
        setSessions(prev => prev.map(s =>
          s.id === item.sessionId ? { ...s, report: updatedReport } : s
        ));
      }
    }
  };

  const handleUpdateAddress = async (item: RadiogramListItem, address: string) => {
    if (!user || !item.sessionId || !item.radiogram) return;
    const session = sessions.find(s => s.id === item.sessionId);
    if (!session) return;
    const updatedRadiograms = (session.radiograms || []).map(r =>
      r.id === item.radiogram!.id ? { ...r, address } : r
    );
    const success = await updateSession(user.uid, item.sessionId, { radiograms: updatedRadiograms });
    if (success) {
      setSessions(prev => prev.map(s =>
        s.id === item.sessionId ? { ...s, radiograms: updatedRadiograms } : s
      ));
    }
  };

  const handleDeleteItem = async () => {
    if (!user || !deleteTarget) return;

    const session = sessions.find((s) => s.id === deleteTarget.sessionId);
    if (!session) return;

    if (deleteTarget.type === 'Radiogram' && deleteTarget.radiogram) {
      const updatedRadiograms = (session.radiograms || []).filter(
        (r) => r.id !== deleteTarget.radiogram!.id
      );
      const success = await updateSession(user.uid, deleteTarget.sessionId, {
        radiograms: updatedRadiograms,
      });
      if (success) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === deleteTarget.sessionId ? { ...s, radiograms: updatedRadiograms } : s
          )
        );
      }
    } else if (deleteTarget.type === 'Net Report') {
      const success = await updateSession(user.uid, deleteTarget.sessionId, {
        report: deleteField(),
      } as unknown as Partial<NetSession>);
      if (success) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === deleteTarget.sessionId ? { ...s, report: undefined } : s
          )
        );
      }
    }

    setDeleteTarget(null);
  };

  const handleSaveRadiogram = async (radiogram: Radiogram) => {
    if (!user || sessions.length === 0) return;

    const mostRecentSession = sessions[0];
    if (!mostRecentSession.id) return;

    const radiogramWithTimestamp = { ...radiogram, savedAt: Timestamp.now() };
    const currentRadiograms = mostRecentSession.radiograms || [];
    const updatedRadiograms = [...currentRadiograms, radiogramWithTimestamp];

    const success = await updateSession(user.uid, mostRecentSession.id, {
      radiograms: updatedRadiograms,
    });

    if (success) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === mostRecentSession.id
            ? { ...s, radiograms: updatedRadiograms }
            : s
        )
      );
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
            <Link href="/home" className="text-xl font-bold text-slate-900 hover:text-cyan-700 transition-colors">AD2HL Net Logger</Link>
            <HeaderBanner />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sessions" className="text-cyan-700 hover:text-cyan-900 text-sm">Sessions</Link>
            <Link href="/radiograms" className="text-cyan-700 hover:text-cyan-900 text-sm">Radiograms</Link>
            <Link href="/stations" className="text-cyan-700 hover:text-cyan-900 text-sm">Stations</Link>
            <a href="/help?page=radiograms" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-900 text-sm">Help</a>
            <ProfileMenu photoURL={photoURL} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Radiograms</h2>
          <button
            onClick={() => setIsFormOpen(true)}
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
                    onClick={() => setSelectedItem(item)}
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
          radiogram={selectedItem.radiogram}
          netReport={selectedItem.netReport}
          onClose={() => setSelectedItem(null)}
          onUpdateDisposition={
            // Net reports without parts can't store disposition
            selectedItem.netReport && !selectedItem.netReport.parts
              ? undefined
              : (d) => handleUpdateDisposition(selectedItem, d)
          }
          onUpdateAddress={
            selectedItem.radiogram
              ? (address) => handleUpdateAddress(selectedItem, address)
              : undefined
          }
          dispositionMethods={profile?.dispositionMethods}
          userProfile={profile ?? undefined}
        />
      )}

      <RadiogramForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveRadiogram}
        dispositionMethods={profile?.dispositionMethods}
        userProfile={profile ?? undefined}
      />

      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Delete {deleteTarget.type}?
            </h2>
            <p className="text-gray-600 mb-6">
              This will permanently delete {deleteTarget.type === 'Radiogram' ? 'radiogram' : 'net report'}{' '}
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
