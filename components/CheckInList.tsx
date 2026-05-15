'use client';

import React, { useRef, useEffect } from 'react';
import { CheckIn, Station, CustomTag } from '@/types';
import StationCard from './StationCard';

interface CheckInListProps {
  checkIns: CheckIn[];
  stations: Map<string, Station>;
  onRemove: (callsign: string) => void;
  onUpdateCallsign: (oldCallsign: string, newCallsign: string) => void;
  onUpdateNickname: (callsign: string, nickname: string | null) => void;
  onUpdateNote: (callsign: string, note: string | null) => void;
  onUpdateLocation: (callsign: string, city: string | null, state: string | null) => void;
  lastAcknowledged?: string | null;
  onSetLastAcknowledged?: (callsign: string) => void;
  customTags?: CustomTag[];
  sessionActive?: boolean;
}

export default function CheckInList({
  checkIns,
  stations,
  onRemove,
  onUpdateCallsign,
  onUpdateNickname,
  onUpdateNote,
  onUpdateLocation,
  lastAcknowledged,
  onSetLastAcknowledged,
  customTags,
  sessionActive = true,
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
      <div className="bg-white rounded-lg shadow p-6 text-center text-slate-500">
        No stations checked in yet. Add a callsign above to get started.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          Checked In Stations ({checkIns.length})
        </h2>
      </div>

      <div
        ref={scrollRef}
        className="divide-y divide-slate-100 overflow-y-auto max-h-96 lg:min-h-[calc(100vh-14rem)] lg:max-h-[calc(100vh-14rem)]"
      >
        {[
          ...checkIns.filter(c => c.tags.includes('NC')),
          ...checkIns.filter(c => !c.tags.includes('NC') && c.tags.includes('ANC')),
          ...checkIns.filter(c => !c.tags.includes('NC') && !c.tags.includes('ANC')),
        ].map((checkIn, index) => (
          <StationCard
            key={checkIn.callsign}
            checkIn={checkIn}
            station={stations.get(checkIn.callsign.toUpperCase())}
            number={index + 1}
            onRemove={onRemove}
            onUpdateCallsign={onUpdateCallsign}
            onUpdateNickname={onUpdateNickname}
            onUpdateNote={onUpdateNote}
            onUpdateLocation={onUpdateLocation}
            isBookmarked={lastAcknowledged?.toUpperCase() === checkIn.callsign.toUpperCase()}
            onSetBookmark={onSetLastAcknowledged ? () => onSetLastAcknowledged(checkIn.callsign) : undefined}
            customTags={customTags}
            sessionActive={sessionActive}
          />
        ))}
      </div>
    </div>
  );
}
