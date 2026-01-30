'use client';

import React, { useState } from 'react';
import { CheckIn, TrafficItem } from '@/types';

interface ChecklistProps {
  checkIns: CheckIn[];
  trafficItems: TrafficItem[];
  checkedAnnouncements: string[];
  onAddTrafficItem: (fromCallsign: string, toDestination: string) => void;
  onToggleTrafficItem: (id: string) => void;
  onDeleteTrafficItem: (id: string) => void;
  onToggleAnnouncement: (callsign: string) => void;
}

export default function Checklist({
  checkIns,
  trafficItems,
  checkedAnnouncements,
  onAddTrafficItem,
  onToggleTrafficItem,
  onDeleteTrafficItem,
  onToggleAnnouncement,
}: ChecklistProps) {
  const [addingTrafficFor, setAddingTrafficFor] = useState<string | null>(null);
  const [newDestination, setNewDestination] = useState('');

  // Get stations with /T tag
  const stationsWithTraffic = checkIns
    .filter(c => c.tags.includes('T'))
    .map(c => c.callsign.toUpperCase());

  // Get stations with /A tag
  const stationsWithAnnouncements = checkIns
    .filter(c => c.tags.includes('A'))
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
    setAddingTrafficFor(callsign);
    setNewDestination('');
  };

  const handleAddSubmit = (callsign: string) => {
    if (newDestination.trim()) {
      onAddTrafficItem(callsign, newDestination.trim().toUpperCase());
      setNewDestination('');
      setAddingTrafficFor(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, callsign: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubmit(callsign);
    } else if (e.key === 'Escape') {
      setAddingTrafficFor(null);
      setNewDestination('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-3">Checklist</h2>

      {/* Traffic Section */}
      {stationsWithTraffic.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
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
                      className="text-blue-600 hover:text-blue-800 text-xs px-1"
                      title="Add traffic destination"
                    >
                      [+]
                    </button>
                  </div>

                  {addingTrafficFor === callsign && (
                    <div className="flex items-center gap-2 ml-4 mt-1">
                      <span className="text-gray-500">→</span>
                      <input
                        type="text"
                        value={newDestination}
                        onChange={(e) => setNewDestination(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, callsign)}
                        placeholder="Destination"
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => handleAddSubmit(callsign)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setAddingTrafficFor(null)}
                        className="text-gray-500 hover:text-gray-700 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

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
                            <span className={item.checked ? 'line-through text-gray-400' : ''}>
                              <span className="font-mono">{item.fromCallsign}</span>
                              <span className="text-gray-500 mx-1">→</span>
                              <span>{item.toDestination}</span>
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Announcements Section */}
      {stationsWithAnnouncements.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">
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
                  <span className={`font-mono ${isChecked ? 'line-through text-gray-400' : ''}`}>
                    {callsign}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {stationsWithTraffic.length === 0 && stationsWithAnnouncements.length === 0 && (
        <p className="text-sm text-gray-500">No traffic or announcements.</p>
      )}
    </div>
  );
}
