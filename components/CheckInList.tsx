'use client';

import React, { useRef, useEffect } from 'react';
import { CheckIn, Station } from '@/types';
import StationCard from './StationCard';

interface CheckInListProps {
  checkIns: CheckIn[];
  stations: Map<string, Station>;
  onRemove: (callsign: string) => void;
  onUpdateNickname: (callsign: string, nickname: string | null) => void;
  onUpdateNote: (callsign: string, note: string | null) => void;
  lastAcknowledged?: string | null;
  onSetLastAcknowledged?: (callsign: string) => void;
}

export default function CheckInList({
  checkIns,
  stations,
  onRemove,
  onUpdateNickname,
  onUpdateNote,
  lastAcknowledged,
  onSetLastAcknowledged,
}: CheckInListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new stations are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [checkIns.length]);

  if (checkIns.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        No stations checked in yet. Add a callsign above to get started.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">
          Checked In Stations ({checkIns.length})
        </h2>
      </div>

      <div
        ref={scrollRef}
        className="divide-y divide-gray-100 max-h-96 overflow-y-auto"
      >
        {checkIns.map((checkIn) => (
          <StationCard
            key={checkIn.callsign}
            checkIn={checkIn}
            station={stations.get(checkIn.callsign.toUpperCase())}
            onRemove={onRemove}
            onUpdateNickname={onUpdateNickname}
            onUpdateNote={onUpdateNote}
            isBookmarked={lastAcknowledged?.toUpperCase() === checkIn.callsign.toUpperCase()}
            onSetBookmark={onSetLastAcknowledged ? () => onSetLastAcknowledged(checkIn.callsign) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
