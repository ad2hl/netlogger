'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getAllSessions, updateSession } from '@/lib/firestore';
import { NetSession, Radiogram, NetReport } from '@/types';
import { Timestamp } from 'firebase/firestore';
import ReadOnlyRadiogram from '@/components/ReadOnlyRadiogram';
import RadiogramForm from '@/components/RadiogramForm';

interface RadiogramListItem {
  type: 'Radiogram' | 'Net Report';
  sessionId: string;
  sortDate: Date;
  displayDate: string;
  number: string;
  stationOfOrigin: string;
  addresseePreview: string;
  disposition: string;
  radiogram?: Radiogram;
  netReport?: NetReport;
}

type SortColumn = 'date' | 'type' | 'number' | 'stationOfOrigin' | 'addressee' | 'disposition';

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
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<NetSession[]>([]);
  const [fetching, setFetching] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedItem, setSelectedItem] = useState<RadiogramListItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

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
          <h1 className="text-xl font-bold text-gray-900">NetLogger</h1>
          <Link
            href="/net"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Back to Net
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Radiograms</h2>
          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-blue-600 text-white py-1 px-3 rounded-md hover:bg-blue-700 text-sm"
          >
            New Radiogram
          </button>
        </div>

        {fetching ? (
          <p className="text-gray-500">Loading...</p>
        ) : sortedItems.length === 0 ? (
          <p className="text-gray-500">No radiograms or net reports found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('date')}
                  >
                    Date/Time{sortArrow('date')}
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
                    Disposition{sortArrow('disposition')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">{item.displayDate}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{item.type}</td>
                    <td className="py-2 pr-4 font-mono">{item.number}</td>
                    <td className="py-2 pr-4 font-mono">{item.stationOfOrigin}</td>
                    <td className="py-2 pr-4 truncate max-w-xs">{item.addresseePreview}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{item.disposition}</td>
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
          dispositionMethods={profile?.dispositionMethods}
        />
      )}

      <RadiogramForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveRadiogram}
        dispositionMethods={profile?.dispositionMethods}
      />
    </div>
  );
}
