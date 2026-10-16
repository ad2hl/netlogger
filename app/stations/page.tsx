'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { getAllStations, getAllSessions, updateStationFields, deleteStation, saveStation, getStation } from '@/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import HeaderBanner from '@/components/HeaderBanner';
import NavMenu from '@/components/NavMenu';
import { useUtc } from '@/lib/useUtc';
import { formatDate } from '@/lib/time';

interface StationRow {
  callsign: string;
  firstName: string;
  nickname: string;
  city: string;
  state: string;
  location: string;
  note: string;
  lastSeen: Date | null;
  checkIns: number;
}

type SortColumn = 'callsign' | 'firstName' | 'nickname' | 'location' | 'note' | 'lastSeen' | 'checkIns';

export default function StationsPage() {
  const { user, loading, emailVerified } = useAuth();
  const router = useRouter();
  const utc = useUtc();
  const [rows, setRows] = useState<StationRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('callsign');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = useState('');
  const [editTarget, setEditTarget] = useState<StationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StationRow | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Edit modal fields
  const [editNickname, setEditNickname] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');

  // Add modal fields
  const [addCallsign, setAddCallsign] = useState('');
  const [addFirstName, setAddFirstName] = useState('');
  const [addNickname, setAddNickname] = useState('');
  const [addNote, setAddNote] = useState('');
  const [addCity, setAddCity] = useState('');
  const [addState, setAddState] = useState('');
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !emailVerified)) {
      router.push('/');
    }
  }, [user, loading, emailVerified, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getAllStations(user.uid), getAllSessions(user.uid)]).then(([stations, sessions]) => {
      const countMap = new Map<string, number>();
      for (const session of sessions) {
        for (const checkIn of session.checkIns) {
          const key = checkIn.callsign.toUpperCase();
          countMap.set(key, (countMap.get(key) || 0) + 1);
        }
      }
      setRows(stations.map((s) => ({
        callsign: s.callsign,
        firstName: s.firstName || '',
        nickname: s.nickname || '',
        city: s.city || '',
        state: s.state || '',
        location: [s.city, s.state].filter(Boolean).join(', '),
        note: s.note || '',
        lastSeen: s.lastSeen ? s.lastSeen.toDate() : null,
        checkIns: countMap.get(s.callsign.toUpperCase()) || 0,
      })));
      setFetching(false);
    });
  }, [user]);

  useEffect(() => {
    if (!editTarget && !deleteTarget && !isAddOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditTarget(null);
        setDeleteTarget(null);
        setIsAddOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editTarget, deleteTarget, isAddOpen]);

  const openAdd = () => {
    setAddCallsign('');
    setAddFirstName('');
    setAddNickname('');
    setAddNote('');
    setAddCity('');
    setAddState('');
    setAddError('');
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const callsign = addCallsign.trim().toUpperCase();
    if (!callsign) {
      setAddError('Callsign is required.');
      return;
    }
    if (rows.some((r) => r.callsign.toUpperCase() === callsign)) {
      setAddError(`${callsign} already exists.`);
      return;
    }
    setAddSaving(true);
    setAddError('');
    const exists = await getStation(user.uid, callsign);
    if (exists) {
      setAddError(`${callsign} already exists.`);
      setAddSaving(false);
      return;
    }
    const station = {
      callsign,
      firstName: addFirstName.trim() || null,
      nickname: addNickname.trim() || null,
      city: addCity.trim() || null,
      state: addState.trim() || null,
      note: addNote.trim() || null,
      lastSeen: Timestamp.now(),
    };
    const success = await saveStation(user.uid, station);
    if (success) {
      const location = [station.city, station.state].filter(Boolean).join(', ');
      setRows((prev) => [...prev, {
        callsign,
        firstName: station.firstName || '',
        nickname: station.nickname || '',
        city: station.city || '',
        state: station.state || '',
        location,
        note: station.note || '',
        lastSeen: null,
        checkIns: 0,
      }]);
      setIsAddOpen(false);
    } else {
      setAddError('Failed to save. Please try again.');
    }
    setAddSaving(false);
  };

  const openEdit = (row: StationRow) => {
    setEditNickname(row.nickname);
    setEditNote(row.note);
    setEditCity(row.city);
    setEditState(row.state);
    setEditTarget(row);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editTarget) return;
    const fields = {
      nickname: editNickname.trim() || null,
      note: editNote.trim() || null,
      city: editCity.trim() || null,
      state: editState.trim() || null,
    };
    const success = await updateStationFields(user.uid, editTarget.callsign, fields);
    if (success) {
      const location = [fields.city, fields.state].filter(Boolean).join(', ');
      setRows((prev) => prev.map((r) =>
        r.callsign === editTarget.callsign
          ? { ...r, nickname: fields.nickname || '', note: fields.note || '', city: fields.city || '', state: fields.state || '', location }
          : r
      ));
    }
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!user || !deleteTarget) return;
    const success = await deleteStation(user.uid, deleteTarget.callsign);
    if (success) {
      setRows((prev) => prev.filter((r) => r.callsign !== deleteTarget.callsign));
    }
    setDeleteTarget(null);
  };

  const filteredRows = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      r.callsign.toLowerCase().includes(needle) ||
      r.firstName.toLowerCase().includes(needle) ||
      r.nickname.toLowerCase().includes(needle) ||
      r.location.toLowerCase().includes(needle) ||
      r.note.toLowerCase().includes(needle)
    );
  }, [rows, filterText]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'callsign':  cmp = a.callsign.localeCompare(b.callsign); break;
        case 'firstName': cmp = a.firstName.localeCompare(b.firstName); break;
        case 'nickname':  cmp = a.nickname.localeCompare(b.nickname); break;
        case 'location':  cmp = a.location.localeCompare(b.location); break;
        case 'note':      cmp = a.note.localeCompare(b.note); break;
        case 'lastSeen':  cmp = (a.lastSeen?.getTime() ?? 0) - (b.lastSeen?.getTime() ?? 0); break;
        case 'checkIns':  cmp = a.checkIns - b.checkIns; break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortArrow = (column: SortColumn) =>
    column !== sortColumn ? null : sortDirection === 'asc' ? ' \u2191' : ' \u2193';

  if (loading || !user) return null;

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
            <NavMenu helpPage="stations" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3 gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900 whitespace-nowrap">
              Stations{!fetching && ` (${rows.length})`}
            </h2>
            {!fetching && rows.length > 0 && (
              <div className="relative w-48">
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter..."
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 pr-7"
                  aria-label="Filter stations"
                />
                {filterText && (
                  <button
                    type="button"
                    onClick={() => setFilterText('')}
                    className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 hover:text-slate-600"
                    aria-label="Clear filter"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={openAdd}
            className="px-3 py-1.5 text-sm font-medium text-white bg-cyan-700 hover:bg-cyan-900 rounded-md"
          >
            Add Station
          </button>
        </div>

        {fetching ? (
          <p className="text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500">No stations found.</p>
        ) : sortedRows.length === 0 ? (
          <p className="text-slate-500">No stations match &ldquo;{filterText.trim()}&rdquo;.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('callsign')}>
                    Callsign{sortArrow('callsign')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('firstName')}>
                    Name{sortArrow('firstName')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('nickname')}>
                    Nickname{sortArrow('nickname')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('location')}>
                    Location{sortArrow('location')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('note')}>
                    Note{sortArrow('note')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('lastSeen')}>
                    Last Seen{sortArrow('lastSeen')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap text-right" onClick={() => handleSort('checkIns')}>
                    Check-ins{sortArrow('checkIns')}
                  </th>
                  <th className="py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.callsign} className="border-b hover:bg-slate-50 group">
                    <td className="py-2 pr-4 whitespace-nowrap">{row.callsign}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{row.firstName}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{row.nickname}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{row.location}</td>
                    <td className="py-2 pr-4 italic text-slate-500">{row.note}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{row.lastSeen ? formatDate(row.lastSeen, utc) : ''}</td>
                    <td className="py-2 pr-4 text-right">{row.checkIns || ''}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(row)}
                          className="text-slate-400 hover:text-cyan-700 p-1"
                          title="Edit station"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Delete station"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit <span className="font-mono">{editTarget.callsign}</span>
              </h2>
              <button
                onClick={() => setEditTarget(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nickname</label>
                <input
                  type="text"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value.toUpperCase())}
                    maxLength={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-cyan-700 hover:bg-cyan-900 rounded-md text-sm font-medium"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add station modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Station</h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Callsign <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={addCallsign}
                  onChange={(e) => { setAddCallsign(e.target.value.toUpperCase()); setAddError(''); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono uppercase"
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={addFirstName}
                  onChange={(e) => setAddFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nickname</label>
                <input
                  type="text"
                  value={addNickname}
                  onChange={(e) => setAddNickname(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={addCity}
                    onChange={(e) => setAddCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={addState}
                    onChange={(e) => setAddState(e.target.value.toUpperCase())}
                    maxLength={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              {addError && (
                <p className="text-sm text-red-600">{addError}</p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="px-4 py-2 text-white bg-cyan-700 hover:bg-cyan-900 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {addSaving ? 'Saving…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Delete station?</h2>
            <p className="text-gray-600 mb-6">
              This will permanently delete{' '}
              <span className="font-mono font-semibold">{deleteTarget.callsign}</span>
              {deleteTarget.firstName && ` (${deleteTarget.firstName})`} from your station memory.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
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
