'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CheckIn, TrafficItem } from '@/types';

interface ChecklistProps {
  checkIns: CheckIn[];
  trafficItems: TrafficItem[];
  checkedAnnouncements: string[];
  checkedSecure: string[];
  onAddTrafficItem: (fromCallsign: string, toDestination: string) => void;
  onToggleTrafficItem: (id: string) => void;
  onDeleteTrafficItem: (id: string) => void;
  onToggleAnnouncement: (callsign: string) => void;
  onToggleSecure: (callsign: string) => void;
  addingTrafficFor: string | null;
  onAddingTrafficForChange: (callsign: string | null) => void;
  onTrafficEntryDone: () => void;
}

export default function Checklist({
  checkIns,
  trafficItems,
  checkedAnnouncements,
  checkedSecure,
  onAddTrafficItem,
  onToggleTrafficItem,
  onDeleteTrafficItem,
  onToggleAnnouncement,
  onToggleSecure,
  addingTrafficFor,
  onAddingTrafficForChange,
  onTrafficEntryDone,
}: ChecklistProps) {
  const [newDestination, setNewDestination] = useState('');
  const destinationInputRef = useRef<HTMLInputElement>(null);

  // Focus destination input when addingTrafficFor changes to a station
  useEffect(() => {
    if (addingTrafficFor) {
      setNewDestination('');
      // Use setTimeout to ensure the input is rendered before focusing
      setTimeout(() => destinationInputRef.current?.focus(), 0);
    }
  }, [addingTrafficFor]);

  // Get stations with /T tag
  const stationsWithTraffic = checkIns
    .filter(c => c.tags.includes('T'))
    .map(c => c.callsign.toUpperCase());

  // Get stations with /A tag
  const stationsWithAnnouncements = checkIns
    .filter(c => c.tags.includes('A'))
    .map(c => c.callsign.toUpperCase());

  // Get stations with /S or /IO tag (request to secure)
  const stationsRequestingSecure = checkIns
    .filter(c => c.tags.includes('S') || c.tags.includes('IO'))
    .map(c => c.callsign.toUpperCase());

  // Group traffic items by fromCallsign
  const trafficByStation = new Map<string, TrafficItem[]>();
  for (const item of trafficItems) {
    const callsign = item.fromCallsign.toUpperCase();
    if (!trafficByStation.has(callsign)) {
      trafficByStation.set(callsign, []);
    }
    trafficByStation.get(callsign)!.push(item);
  }

  const handleAddClick = (callsign: string) => {
    onAddingTrafficForChange(callsign);
    setNewDestination('');
  };

  const handleAddSubmit = (callsign: string) => {
    if (newDestination.trim()) {
      onAddTrafficItem(callsign, newDestination.trim().toUpperCase());
      setNewDestination('');
      // Keep form open for same station (don't close)
    }
  };

  const findNextStationNeedingTraffic = (afterCallsign: string | null): string | null => {
    // Build set of stations that already have traffic items
    const stationsWithItems = new Set<string>();
    for (const item of trafficItems) {
      stationsWithItems.add(item.fromCallsign.toUpperCase());
    }

    // Find stations with /T tag that have no traffic items
    const needingTraffic = stationsWithTraffic.filter(cs => !stationsWithItems.has(cs));

    if (needingTraffic.length === 0) return null;

    if (!afterCallsign) return needingTraffic[0];

    // Find next station after the current one
    const currentIndex = needingTraffic.indexOf(afterCallsign.toUpperCase());
    if (currentIndex >= 0 && currentIndex < needingTraffic.length - 1) {
      return needingTraffic[currentIndex + 1];
    }
    // If current is last or not found, check if there are any remaining
    const afterCurrentInFull = stationsWithTraffic.indexOf(afterCallsign.toUpperCase());
    for (let i = afterCurrentInFull + 1; i < stationsWithTraffic.length; i++) {
      if (!stationsWithItems.has(stationsWithTraffic[i])) {
        return stationsWithTraffic[i];
      }
    }
    return null;
  };

  const handleAdvanceOrDone = (callsign: string) => {
    const next = findNextStationNeedingTraffic(callsign);
    if (next) {
      onAddingTrafficForChange(next);
      setNewDestination('');
    } else {
      onAddingTrafficForChange(null);
      onTrafficEntryDone();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, callsign: string) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (newDestination.trim()) {
        handleAddSubmit(callsign);
      } else {
        // Empty destination — advance to next station or done
        handleAdvanceOrDone(callsign);
      }
    } else if (e.key === 'Escape') {
      onAddingTrafficForChange(null);
      setNewDestination('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-3">Checklist</h2>

      {/* Request to Secure Section */}
      {stationsRequestingSecure.length > 0 && (
        <div className="mb-4 pb-4 border-b border-slate-200">
          <h3 className="text-sm font-medium mb-2">
            Request to secure ({stationsRequestingSecure.filter(c => !checkedSecure.includes(c)).length})
          </h3>
          <div className="space-y-1">
            {stationsRequestingSecure.map(callsign => {
              const isChecked = checkedSecure.includes(callsign);
              return (
                <label key={callsign} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleSecure(callsign)}
                    className="rounded"
                  />
                  <span className={`font-mono ${isChecked ? 'line-through text-slate-400' : ''}`}>
                    {callsign}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Traffic Section */}
      {stationsWithTraffic.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">
            Traffic ({trafficItems.filter(item => !item.checked).length})
          </h3>
          <div className="space-y-2">
            {stationsWithTraffic.map(callsign => {
              const items = trafficByStation.get(callsign) || [];
              return (
                <div key={callsign} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{callsign}</span>
                    <button
                      onClick={() => handleAddClick(callsign)}
                      className="text-cyan-700 hover:text-cyan-900 text-xs px-1"
                      title="Add traffic destination"
                    >
                      [+]
                    </button>
                  </div>

                  {items.length > 0 && (
                    <div className="ml-4 mt-1 space-y-1">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 group">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => onToggleTrafficItem(item.id)}
                              className="rounded"
                            />
                            <span className={item.checked ? 'line-through text-slate-400' : ''}>
                              <span className="font-mono">{item.fromCallsign}</span>
                              <span className="text-slate-500 mx-1">→</span>
                              <span className="font-mono">{item.toDestination}</span>
                            </span>
                          </label>
                          <button
                            onClick={() => onDeleteTrafficItem(item.id)}
                            className="text-red-500 hover:text-red-700 text-xs opacity-0 group-hover:opacity-100"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingTrafficFor === callsign && (
                    <div className="flex items-center gap-2 ml-4 mt-1">
                      <span className="text-slate-500">→</span>
                      <input
                        ref={destinationInputRef}
                        type="text"
                        value={newDestination}
                        onChange={(e) => setNewDestination(e.target.value.toUpperCase())}
                        onKeyDown={(e) => handleKeyDown(e, callsign)}
                        placeholder="Destination"
                        className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                        autoFocus
                      />
                      <button
                        onClick={() => handleAddSubmit(callsign)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => onAddingTrafficForChange(null)}
                        className="text-slate-500 hover:text-slate-700 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Announcements Section */}
      {stationsWithAnnouncements.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">
            Announcements ({stationsWithAnnouncements.filter(c => !checkedAnnouncements.includes(c)).length})
          </h3>
          <div className="space-y-1">
            {stationsWithAnnouncements.map(callsign => {
              const isChecked = checkedAnnouncements.includes(callsign);
              return (
                <label key={callsign} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleAnnouncement(callsign)}
                    className="rounded"
                  />
                  <span className={`font-mono ${isChecked ? 'line-through text-slate-400' : ''}`}>
                    {callsign}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {stationsWithTraffic.length === 0 && stationsWithAnnouncements.length === 0 && stationsRequestingSecure.length === 0 && (
        <p className="text-sm text-slate-500">No traffic or announcements.</p>
      )}
    </div>
  );
}
