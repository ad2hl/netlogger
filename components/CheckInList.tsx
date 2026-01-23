'use client';

import React from 'react';
import { CheckIn, Station } from '@/types';
import StationCard from './StationCard';

interface CheckInListProps {
  checkIns: CheckIn[];
  stations: Map<string, Station>;
  onRemove: (callsign: string) => void;
  onUpdateNickname: (callsign: string, nickname: string | null) => void;
  onUpdateNote: (callsign: string, intro: string | null) => void;
}

export default function CheckInList({
  checkIns,
  stations,
  onRemove,
  onUpdateNickname,
  onUpdateNote,
}: CheckInListProps) {

  if (checkIns.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        No stations checked in yet. Add a callsign above to get started.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          Checked In Stations ({checkIns.length})
        </h2>
      </div>

      <div className="divide-y divide-gray-100">
        {checkIns.map((checkIn) => (
          <StationCard
            key={checkIn.callsign}
            checkIn={checkIn}
            station={stations.get(checkIn.callsign.toUpperCase())}
            onRemove={onRemove}
            onUpdateNickname={onUpdateNickname}
            onUpdateNote={onUpdateNote}
          />
        ))}
      </div>
    </div>
  );
}
