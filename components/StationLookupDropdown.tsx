'use client';

import React, { useEffect, useRef } from 'react';
import { Station } from '@/types';

interface StationLookupDropdownProps {
  stations: Station[];
  selectedIndex: number;
  onSelect: (station: Station) => void;
  query: string;
}

export default function StationLookupDropdown({
  stations,
  selectedIndex,
  onSelect,
  query,
}: StationLookupDropdownProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (stations.length === 0) {
    return (
      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg">
        <div className="px-3 py-2 text-slate-500 text-sm">
          {query ? 'No stations found' : 'Type to search stations...'}
        </div>
      </div>
    );
  }

  return (
    <ul
      ref={listRef}
      className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-auto"
    >
      {stations.map((station, index) => {
        const displayName = station.nickname || station.firstName || '';
        const location = [station.city, station.state].filter(Boolean).join(', ');

        return (
          <li
            key={station.callsign}
            className={`px-3 py-2 cursor-pointer flex items-center gap-3 ${
              index === selectedIndex
                ? 'bg-sky-100'
                : 'hover:bg-slate-100'
            }`}
            onClick={() => onSelect(station)}
          >
            <span className="font-mono font-semibold text-slate-900 w-20">
              {station.callsign}
            </span>
            <span className="text-slate-700 flex-1 truncate">
              {displayName}
            </span>
            {location && (
              <span className="text-slate-500 text-sm truncate max-w-32">
                {location}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
