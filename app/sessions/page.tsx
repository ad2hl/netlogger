'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getAllSessions } from '@/lib/firestore';
import { NetSession } from '@/types';

type SortColumn = 'date' | 'startTime' | 'endTime' | 'netName' | 'duration' | 'stations' | 'trafficReported' | 'trafficCleared';

function computeDurationMinutes(session: NetSession): number {
  const [startH, startM] = session.startTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;

  if (session.endTime) {
    const [endH, endM] = session.endTime.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    return endMinutes >= startMinutes ? endMinutes - startMinutes : (1440 - startMinutes) + endMinutes;
  }

  // Active session: compute from start to now
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= startMinutes ? nowMinutes - startMinutes : (1440 - startMinutes) + nowMinutes;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function SessionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<NetSession[]>([]);
  const [fetching, setFetching] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

  const sortedSessions = useMemo(() => {
    const sorted = [...sessions];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'date':
          cmp = a.date.toDate().getTime() - b.date.toDate().getTime();
          if (cmp === 0) cmp = a.startTime.localeCompare(b.startTime);
          if (cmp === 0) cmp = a.netName.localeCompare(b.netName);
          // For date, desc means newest first for both date and startTime
          return sortDirection === 'asc' ? cmp : -cmp;
        case 'startTime':
          cmp = a.startTime.localeCompare(b.startTime);
          break;
        case 'endTime': {
          const aEnd = a.endTime || '';
          const bEnd = b.endTime || '';
          cmp = aEnd.localeCompare(bEnd);
          break;
        }
        case 'netName':
          cmp = a.netName.localeCompare(b.netName);
          break;
        case 'duration':
          cmp = computeDurationMinutes(a) - computeDurationMinutes(b);
          break;
        case 'stations':
          cmp = a.checkIns.length - b.checkIns.length;
          break;
        case 'trafficReported':
          cmp = a.trafficReported - b.trafficReported;
          break;
        case 'trafficCleared':
          cmp = a.trafficCleared - b.trafficCleared;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [sessions, sortColumn, sortDirection]);

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
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
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
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Sessions</h2>

        {fetching ? (
          <p className="text-gray-500">Loading...</p>
        ) : sortedSessions.length === 0 ? (
          <p className="text-gray-500">No sessions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('date')}
                  >
                    Date{sortArrow('date')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('startTime')}
                  >
                    Start Time{sortArrow('startTime')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('endTime')}
                  >
                    End Time{sortArrow('endTime')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('netName')}
                  >
                    Net Name{sortArrow('netName')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('duration')}
                  >
                    Duration{sortArrow('duration')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('stations')}
                  >
                    Stations{sortArrow('stations')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('trafficReported')}
                  >
                    Traffic Rptd{sortArrow('trafficReported')}
                  </th>
                  <th
                    className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort('trafficCleared')}
                  >
                    Traffic Clrd{sortArrow('trafficCleared')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/net?session=${s.id}`)}
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {s.date.toDate().toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{s.startTime}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {s.endTime || 'Active'}
                    </td>
                    <td className="py-2 pr-4">{s.netName}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {formatDuration(computeDurationMinutes(s))}
                    </td>
                    <td className="py-2 pr-4">{s.checkIns.length}</td>
                    <td className="py-2 pr-4">{s.trafficReported}</td>
                    <td className="py-2 pr-4">{s.trafficCleared}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
