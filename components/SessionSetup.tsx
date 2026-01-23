'use client';

import React, { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { NetSession } from '@/types';

interface SessionSetupProps {
  onCreateSession: (session: Omit<NetSession, 'id'>) => void;
  existingSession?: NetSession | null;
  onUpdateSession?: (updates: Partial<NetSession>) => void;
}

export default function SessionSetup({
  onCreateSession,
  existingSession,
  onUpdateSession,
}: SessionSetupProps) {
  const [netName, setNetName] = useState(existingSession?.netName || '');
  const [date, setDate] = useState(() => {
    if (existingSession?.date) {
      return existingSession.date.toDate().toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });
  const [startTime, setStartTime] = useState(existingSession?.startTime || '');
  const [endTime, setEndTime] = useState(existingSession?.endTime || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (existingSession && onUpdateSession) {
      onUpdateSession({
        netName,
        date: Timestamp.fromDate(new Date(date)),
        startTime,
        endTime: endTime || null,
      });
    } else {
      onCreateSession({
        netName,
        date: Timestamp.fromDate(new Date(date)),
        startTime,
        endTime: endTime || null,
        trafficReported: 0,
        trafficCleared: 0,
        checkIns: [],
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
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h2 className="text-lg font-semibold mb-3">
        {existingSession ? 'Net Session' : 'Start New Net Session'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Net Name
          </label>
          <input
            type="text"
            value={netName}
            onChange={(e) => setNetName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., MDARC Net"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
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
              Start Time
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
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {existingSession ? 'Update Session' : 'Start Session'}
          </button>

          {existingSession && !existingSession.endTime && (
            <button
              type="button"
              onClick={handleEndNet}
              className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              End Net
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
