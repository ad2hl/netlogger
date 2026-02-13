'use client';

import React from 'react';

interface SessionSummaryProps {
  stationCount: number;
  reported: number;
  cleared: number;
  onReportedChange: (value: number) => void;
  onClearedChange: (value: number) => void;
  startTime: string | null;
  endTime: string | null;
  ncCallsign: string | null;
  ancCallsigns: string[];
}

function formatDuration(startTime: string | null, endTime: string | null): string {
  if (!startTime || !endTime) return '—';
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes < 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function SessionSummary({
  stationCount,
  reported,
  cleared,
  onReportedChange,
  onClearedChange,
  startTime,
  endTime,
  ncCallsign,
  ancCallsigns,
}: SessionSummaryProps) {
  return (
    <div className="bg-white rounded-lg shadow p-3 h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-auto">Session Summary</h2>

      {/* NC / ANC row */}
      {(ncCallsign || ancCallsigns.length > 0) && (
        <div className="flex items-center gap-4 text-sm mt-4 mb-3">
          {ncCallsign && (
            <span>
              <span className="font-medium text-slate-600">NC:</span>{' '}
              <span className="font-mono font-bold">{ncCallsign}</span>
            </span>
          )}
          {ancCallsigns.length > 0 && (
            <span>
              <span className="font-medium text-slate-600">ANC:</span>{' '}
              <span className="font-mono font-bold">{ancCallsigns.join(', ')}</span>
            </span>
          )}
        </div>
      )}

      <div className="space-y-3">
        {/* Stations row */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Stations</span>
          <span className="text-base font-mono font-bold">{stationCount}</span>
        </div>

        {/* Traffic row */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Traffic</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onReportedChange(Math.max(0, reported - 1))}
              className="w-7 h-7 bg-slate-200 rounded text-sm font-bold hover:bg-slate-300 disabled:opacity-40"
              disabled={reported <= 0}
            >
              −
            </button>
            <span className="w-8 text-center text-base font-mono font-bold">{reported}</span>
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
            <span className="w-8 text-center text-base font-mono font-bold">{cleared}</span>
            <button
              onClick={() => onClearedChange(cleared + 1)}
              className="w-7 h-7 bg-slate-200 rounded text-sm font-bold hover:bg-slate-300"
            >
              +
            </button>
          </div>
        </div>

        {/* Duration row */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Duration</span>
          <span className="text-base font-mono font-bold">
            {formatDuration(startTime, endTime)}
          </span>
        </div>
      </div>
    </div>
  );
}
