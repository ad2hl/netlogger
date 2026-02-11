'use client';

import React from 'react';

interface TrafficCounterProps {
  reported: number;
  cleared: number;
  onReportedChange: (value: number) => void;
  onClearedChange: (value: number) => void;
}

export default function TrafficCounter({
  reported,
  cleared,
  onReportedChange,
  onClearedChange,
}: TrafficCounterProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h2 className="text-lg font-semibold mb-3">Traffic Count</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Reported
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onReportedChange(Math.max(0, reported - 1))}
              className="w-10 h-10 bg-slate-200 rounded-md hover:bg-slate-300 text-xl font-bold"
              disabled={reported <= 0}
            >
              -
            </button>
            <span className="w-12 text-center text-2xl font-mono font-bold">
              {reported}
            </span>
            <button
              onClick={() => onReportedChange(reported + 1)}
              className="w-10 h-10 bg-slate-200 rounded-md hover:bg-slate-300 text-xl font-bold"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Cleared
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onClearedChange(Math.max(0, cleared - 1))}
              className="w-10 h-10 bg-slate-200 rounded-md hover:bg-slate-300 text-xl font-bold"
              disabled={cleared <= 0}
            >
              -
            </button>
            <span className="w-12 text-center text-2xl font-mono font-bold">
              {cleared}
            </span>
            <button
              onClick={() => onClearedChange(cleared + 1)}
              className="w-10 h-10 bg-slate-200 rounded-md hover:bg-slate-300 text-xl font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 text-sm text-slate-600">
        Traffic: {reported}/{cleared}
      </div>
    </div>
  );
}
