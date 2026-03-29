'use client';

import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { NetSession } from '@/types';

interface SessionSetupProps {
  onCreateSession: (session: Omit<NetSession, 'id'>) => void;
  existingSession?: NetSession | null;
  onUpdateSession?: (updates: Partial<NetSession>) => void;
  onShowReport?: () => void;
  defaults?: { netName: string; startTime: string };
}

export default function SessionSetup({
  onCreateSession,
  existingSession,
  onUpdateSession,
  onShowReport,
  defaults,
}: SessionSetupProps) {
  const [netName, setNetName] = useState(existingSession?.netName || defaults?.netName || '');
  const [date, setDate] = useState(() => {
    if (existingSession?.date) {
      return existingSession.date.toDate().toISOString().split('T')[0];
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [startTime, setStartTime] = useState(existingSession?.startTime || defaults?.startTime || '');
  const [endTime, setEndTime] = useState(existingSession?.endTime || '');

  // Sync state when existingSession loads or changes (e.g. navigating from /sessions)
  useEffect(() => {
    if (existingSession) {
      setNetName(existingSession.netName || '');
      setDate(existingSession.date.toDate().toISOString().split('T')[0]);
      setStartTime(existingSession.startTime || '');
      setEndTime(existingSession.endTime || '');
    }
  }, [existingSession]);

  // Apply defaults from most recent session (when no existing session)
  useEffect(() => {
    if (!existingSession && defaults) {
      setNetName((prev) => prev || defaults.netName);
      setStartTime((prev) => prev || defaults.startTime);
    }
  }, [existingSession, defaults]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse date as local time (not UTC) to avoid off-by-one day errors
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    if (existingSession && onUpdateSession) {
      onUpdateSession({
        netName,
        date: Timestamp.fromDate(localDate),
        startTime,
        endTime: endTime || null,
      });
    } else {
      onCreateSession({
        netName,
        date: Timestamp.fromDate(localDate),
        startTime,
        endTime: endTime || null,
        trafficReported: 0,
        trafficCleared: 0,
        checkIns: [],
        radiogramIds: [],
      });
    }
  };

  const handleEndNet = () => {
    if (onUpdateSession) {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setEndTime(timeStr);
      onUpdateSession({ endTime: timeStr });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-3">
      <h2 className="text-lg font-semibold mb-2">
        {existingSession ? 'Net Session' : 'Start New Net Session'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Net Name
            </label>
            <input
              type="text"
              value={netName}
              onChange={(e) => setNetName(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="e.g., SDN"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Start
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              End
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className={`grid gap-2 ${existingSession ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <button
            type="submit"
            className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {existingSession ? 'Update Session' : 'Start Session'}
          </button>

          {existingSession && (
            <>
              {!existingSession.endTime ? (
                <button
                  type="button"
                  onClick={handleEndNet}
                  className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  End Session
                </button>
              ) : (
                <div></div>
              )}
              <button
                type="button"
                onClick={onShowReport}
                className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                Show Report
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
