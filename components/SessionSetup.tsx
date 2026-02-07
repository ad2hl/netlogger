'use client';

import React, { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { NetSession } from '@/types';

interface SessionSetupProps {
  onCreateSession: (session: Omit<NetSession, 'id'>) => void;
  existingSession?: NetSession | null;
  onUpdateSession?: (updates: Partial<NetSession>) => void;
  onShowReport?: () => void;
}

export default function SessionSetup({
  onCreateSession,
  existingSession,
  onUpdateSession,
  onShowReport,
}: SessionSetupProps) {
  const [netName, setNetName] = useState(existingSession?.netName || '');
  const [date, setDate] = useState(() => {
    if (existingSession?.date) {
      return existingSession.date.toDate().toISOString().split('T')[0];
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [startTime, setStartTime] = useState(existingSession?.startTime || '');
  const [endTime, setEndTime] = useState(existingSession?.endTime || '');

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
        radiograms: [],
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Net Name
            </label>
            <input
              type="text"
              value={netName}
              onChange={(e) => setNetName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., SDN"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className={`grid gap-2 ${existingSession ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <button
            type="submit"
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {existingSession ? 'Update Session' : 'Start Session'}
          </button>

          {existingSession && (
            <>
              {!existingSession.endTime ? (
                <button
                  type="button"
                  onClick={handleEndNet}
                  className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  End Session
                </button>
              ) : (
                <div></div>
              )}
              <button
                type="button"
                onClick={onShowReport}
                className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
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
