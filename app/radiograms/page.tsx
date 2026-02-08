'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getAllSessions } from '@/lib/firestore';
import { NetSession, Radiogram, NetReport } from '@/types';
import ReadOnlyRadiogram from '@/components/ReadOnlyRadiogram';

interface RadiogramListItem {
  type: 'Radiogram' | 'Net Report';
  sortDate: Date;
  displayDate: string;
  number: string;
  stationOfOrigin: string;
  addresseePreview: string;
  radiogram?: Radiogram;
  netReport?: NetReport;
}

type SortColumn = 'date' | 'type' | 'number' | 'stationOfOrigin' | 'addressee';

function buildItems(sessions: NetSession[]): RadiogramListItem[] {
  const items: RadiogramListItem[] = [];

  for (const session of sessions) {
    // User-created radiograms
    if (session.radiograms) {
      for (const radiogram of session.radiograms) {
        const sessionDate = session.date.toDate();
        const displayDate = radiogram.date && radiogram.timeFiled
          ? `${radiogram.date} ${radiogram.timeFiled}`
          : radiogram.date || sessionDate.toLocaleDateString();

        items.push({
          type: 'Radiogram',
          sortDate: sessionDate,
          displayDate,
          number: radiogram.number,
          stationOfOrigin: radiogram.stationOfOrigin,
          addresseePreview: (radiogram.address || '').split('\n')[0],
          radiogram,
        });
      }
    }

    // Net reports
    if (session.report) {
      const report = session.report;
      const reportDate = report.startDateTime.toDate();
      const displayDate = reportDate.toLocaleDateString() + ' ' +
        reportDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let number: string;
      let stationOfOrigin: string;
      let addresseePreview: string;

      if (report.parts) {
        number = report.parts.number;
        stationOfOrigin = report.parts.stationOfOrigin;
        addresseePreview = report.parts.addressee;
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
        sortDate: reportDate,
        displayDate,
        number,
        stationOfOrigin,
        addresseePreview,
        netReport: report,
      });
    }
  }

  return items;
}

export default function RadiogramsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<NetSession[]>([]);
  const [fetching, setFetching] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedItem, setSelectedItem] = useState<RadiogramListItem | null>(null);

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

  if (loading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen">
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
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Radiograms</h2>

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
        />
      )}
    </div>
  );
}
