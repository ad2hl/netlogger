'use client';

import React, { useState } from 'react';
import { CheckIn, Station, getTagLabel, formatLastSeen } from '@/types';

interface StationCardProps {
  checkIn: CheckIn;
  station?: Station | null;
  onRemove: (callsign: string) => void;
  onUpdateNickname: (callsign: string, nickname: string | null) => void;
  onUpdateNote: (callsign: string, note: string | null) => void;
}

export default function StationCard({
  checkIn,
  station,
  onRemove,
  onUpdateNickname,
  onUpdateNote,
}: StationCardProps) {
  const [editingField, setEditingField] = useState<'name' | 'note' | null>(null);
  const [nickname, setNickname] = useState(station?.nickname || '');
  const [note, setNote] = useState(station?.note || '');

  const displayName = station?.nickname || station?.firstName || '';
  const lastSeenText = station?.lastSeen ? formatLastSeen(station.lastSeen) : null;

  const handleSaveNickname = () => {
    const trimmed = nickname.trim();
    onUpdateNickname(checkIn.callsign, trimmed || null);
    setEditingField(null);
  };

  const handleSaveNote = () => {
    const trimmed = note.trim();
    onUpdateNote(checkIn.callsign, trimmed || null);
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, save: () => void, cancel: () => void) => {
    if (e.key === 'Enter') {
      save();
    } else if (e.key === 'Escape') {
      cancel();
    }
  };

  const getTagStyle = (tag: string) => {
    switch (tag) {
      case 'NC':
        return 'bg-purple-100 text-purple-800 border border-purple-300';
      case 'ANC':
        return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
      case 'T':
        return 'bg-red-500 text-white font-bold animate-pulse';
      case 'A':
        return 'bg-orange-500 text-white font-bold animate-pulse';
      case 'S':
      case 'IO':
        return 'bg-amber-500 text-white font-bold animate-pulse';
      case 'M':
        return 'bg-sky-100 text-sky-800 border border-sky-300';
      case 'P':
        return 'bg-lime-100 text-lime-800 border border-lime-300';
      default:
        return 'bg-teal-100 text-teal-800 border border-teal-300';
    }
  };

  const tags = checkIn.tags || [];
  const hasUrgentTag = tags.some(t => ['T', 'A', 'S', 'IO'].includes(t));

  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded ${hasUrgentTag ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
      <span className="font-mono font-semibold text-sm w-20 flex-shrink-0">
        {checkIn.callsign}
      </span>

      {editingField === 'name' ? (
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onBlur={handleSaveNickname}
          onKeyDown={(e) => handleKeyDown(e, handleSaveNickname, () => {
            setNickname(station?.nickname || '');
            setEditingField(null);
          })}
          className="text-sm text-gray-600 w-24 px-1 border-b border-blue-400 focus:outline-none bg-transparent"
          placeholder={station?.firstName || 'Name'}
          autoFocus
        />
      ) : (
        <span
          onClick={() => setEditingField('name')}
          className="text-sm text-gray-600 w-24 truncate cursor-pointer hover:text-blue-600 flex-shrink-0"
          title={displayName ? `Click to edit: ${displayName}` : 'Click to add name'}
        >
          {displayName || '—'}
        </span>
      )}

      {editingField === 'note' ? (
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleSaveNote}
          onKeyDown={(e) => handleKeyDown(e, handleSaveNote, () => {
            setNote(station?.note || '');
            setEditingField(null);
          })}
          className="text-sm text-gray-500 italic flex-1 min-w-0 px-1 border-b border-blue-400 focus:outline-none bg-transparent"
          placeholder="Note..."
          autoFocus
        />
      ) : (
        <span
          onClick={() => setEditingField('note')}
          className={`text-sm italic flex-1 min-w-0 truncate cursor-pointer hover:text-blue-600 ${station?.note ? 'text-gray-500' : 'text-gray-300'}`}
          title={station?.note ? `Click to edit: ${station.note}` : 'Click to add noteduction'}
        >
          {station?.note || '(note)'}
        </span>
      )}

      <div className="flex items-center gap-1 flex-shrink-0">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`text-xs px-1.5 py-0.5 rounded ${getTagStyle(tag)}`}
            title={getTagLabel(tag)}
          >
            {tag}
          </span>
        ))}
      </div>

      {lastSeenText && (
        <span className="text-xs text-gray-400 flex-shrink-0" title="Time since last check-in">
          {lastSeenText}
        </span>
      )}

      <button
        onClick={() => onRemove(checkIn.callsign)}
        className="text-gray-400 hover:text-red-500 p-0.5 flex-shrink-0"
        title="Remove"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
