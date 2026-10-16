'use client';

import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { NetSession } from '@/types';
import { useUtc } from '@/lib/useUtc';
import { sessionToDisplay, sessionToStored, formatDateString, formatTimeString } from '@/lib/time';
import TimeInput from '@/components/TimeInput';

interface SessionSummaryProps {
  netName: string;
  date: Timestamp;          // stored (UTC) session date
  stationCount: number;
  reported: number;
  cleared: number;
  onReportedChange: (value: number) => void;
  onClearedChange: (value: number) => void;
  startTime: string;        // stored (UTC) "HH:MM"
  endTime: string | null;
  ncCallsign: string | null;
  ancCallsigns: string[];
  onUpdateSession: (updates: Partial<NetSession>) => void;
}

function formatDuration(startTime: string | null, endTime: string | null): string {
  if (!startTime || !endTime) return '—';
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;  // net ran past midnight
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function SessionSummary({
  netName,
  date,
  stationCount,
  reported,
  cleared,
  onReportedChange,
  onClearedChange,
  startTime,
  endTime,
  ncCallsign,
  ancCallsigns,
  onUpdateSession,
}: SessionSummaryProps) {
  const utc = useUtc();
  const shown = sessionToDisplay({ date, startTime, endTime }, utc);
  const shownDate = formatDateString(shown.date, { month: 'long', day: 'numeric', year: 'numeric' }, 'en-US');
  const shownDateNumeric = formatDateString(shown.date, { month: '2-digit', day: '2-digit', year: 'numeric' }, 'en-US');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNetName, setEditNetName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  useEffect(() => {
    if (!showEditModal) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowEditModal(false); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showEditModal]);

  const openEditModal = () => {
    setEditNetName(netName);
    setEditDate(shown.date);
    setEditStartTime(shown.startTime);
    setEditEndTime(shown.endTime);
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = sessionToStored({ date: editDate, startTime: editStartTime, endTime: editEndTime }, utc);
    const updates: Partial<NetSession> = {
      netName: editNetName,
      date: stored.date,
      startTime: stored.startTime,
    };
    if (endTime !== null) {
      updates.endTime = stored.endTime;
    }
    onUpdateSession(updates);
    setShowEditModal(false);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Session Summary</h2>
          <button
            onClick={openEditModal}
            className="text-sm text-cyan-700 hover:text-cyan-900 font-medium"
          >
            Edit
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Net Name</span>
            <span className="text-base font-mono font-semibold">{netName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Date</span>
            <span className="text-base font-mono font-semibold text-right">
                <span className="block">{shownDate}</span>
                <span className="block text-sm font-normal text-slate-500">{shownDateNumeric}</span>
              </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Start</span>
            <span className="text-base font-mono font-semibold">{shown.startTime ? formatTimeString(shown.startTime, utc) : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">End</span>
            <span className="text-base font-mono font-semibold">{shown.endTime ? formatTimeString(shown.endTime, utc) : '—'}</span>
          </div>
        </div>

        {(ncCallsign || ancCallsigns.length > 0) && (
          <>
            <hr className="border-slate-200 mt-4" />
            <div className="grid grid-cols-3 mt-3 mb-1">
              {ncCallsign && (
                <div className="col-start-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">NC</span>
                  <span className="text-base font-mono font-semibold">{ncCallsign}</span>
                </div>
              )}
              {ancCallsigns.length > 0 && (
                <div className="col-start-2 col-span-2 flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">ANC</span>
                  <span className="text-base font-mono font-semibold">{ancCallsigns.join(', ')}</span>
                </div>
              )}
            </div>
          </>
        )}

        <div className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Stations</span>
            <span className="text-base font-mono font-semibold">{stationCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600 whitespace-nowrap">Traffic Rptd/Clrd</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onReportedChange(Math.max(0, reported - 1))}
                className="w-7 h-7 bg-slate-200 rounded text-sm font-bold hover:bg-slate-300 disabled:opacity-40"
                disabled={reported <= 0}
              >
                −
              </button>
              <span className="w-8 text-center text-base font-mono font-semibold">{reported}</span>
              <button
                onClick={() => onReportedChange(reported + 1)}
                className="w-7 h-7 bg-slate-200 rounded text-sm font-bold hover:bg-slate-300"
              >
                +
              </button>
              <span className="text-slate-400 mx-1">/</span>
              <button
                onClick={() => onClearedChange(Math.max(0, cleared - 1))}
                className="w-7 h-7 bg-slate-200 rounded text-sm font-bold hover:bg-slate-300 disabled:opacity-40"
                disabled={cleared <= 0}
              >
                −
              </button>
              <span className="w-8 text-center text-base font-mono font-semibold">{cleared}</span>
              <button
                onClick={() => onClearedChange(cleared + 1)}
                className="w-7 h-7 bg-slate-200 rounded text-sm font-bold hover:bg-slate-300"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Duration</span>
            <span className="text-base font-mono font-semibold">
              {formatDuration(startTime, endTime)}
            </span>
          </div>
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Session</h2>
              <button
                onClick={() => setShowEditModal(false)}
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Net Name</label>
                <input
                  type="text"
                  value={editNetName}
                  onChange={(e) => setEditNetName(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                <TimeInput
                  utc={utc}
                  value={editStartTime}
                  onChange={setEditStartTime}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
              {endTime !== null && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                  <TimeInput
                    utc={utc}
                    value={editEndTime}
                    onChange={setEditEndTime}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
    </>
  );
}
