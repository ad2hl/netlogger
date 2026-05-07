'use client';

import React, { useState } from 'react';
import { CheckIn, Station, CustomTag, getTagLabel, formatLastSeen, URGENT_TAGS, isNewHam } from '@/types';


interface StationCardProps {
  checkIn: CheckIn;
  station?: Station | null;
  number: number;
  onRemove: (callsign: string) => void;
  onUpdateCallsign: (oldCallsign: string, newCallsign: string) => void;
  onUpdateNickname: (callsign: string, nickname: string | null) => void;
  onUpdateNote: (callsign: string, note: string | null) => void;
  onUpdateLocation: (callsign: string, city: string | null, state: string | null) => void;
  isBookmarked?: boolean;
  onSetBookmark?: () => void;
  customTags?: CustomTag[];
}

export default function StationCard({
  checkIn,
  station,
  number,
  onRemove,
  onUpdateCallsign,
  onUpdateNickname,
  onUpdateNote,
  onUpdateLocation,
  isBookmarked,
  onSetBookmark,
  customTags = [],
}: StationCardProps) {
  const [editingField, setEditingField] = useState<'callsign' | 'name' | 'note' | 'location' | null>(null);
  const [callsign, setCallsign] = useState(checkIn.callsign);
  const [nickname, setNickname] = useState(station?.nickname || '');
  const [note, setNote] = useState(station?.note || '');
  const [editLocation, setEditLocation] = useState('');

  const displayName = station?.nickname || station?.firstName || '';
  const lastSeenText = station?.lastSeen ? formatLastSeen(station.lastSeen) : null;
  const location = [station?.city, station?.state].filter(Boolean).join(', ');

  const handleSaveCallsign = () => {
    const trimmed = callsign.trim().toUpperCase();
    if (trimmed && trimmed !== checkIn.callsign.toUpperCase()) {
      onUpdateCallsign(checkIn.callsign, trimmed);
    }
    setEditingField(null);
  };

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

  const handleSaveLocation = () => {
    const trimmed = editLocation.trim();
    if (!trimmed) {
      onUpdateLocation(checkIn.callsign, null, null);
    } else {
      const lastComma = trimmed.lastIndexOf(',');
      if (lastComma >= 0) {
        const city = trimmed.slice(0, lastComma).trim() || null;
        const state = trimmed.slice(lastComma + 1).trim() || null;
        onUpdateLocation(checkIn.callsign, city, state);
      } else {
        onUpdateLocation(checkIn.callsign, trimmed, null);
      }
    }
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
      case 'NC':  return 'bg-purple-100 text-purple-800 border border-purple-300';
      case 'ANC': return 'bg-violet-100 text-violet-800 border border-violet-300';
      case 'T':   return 'bg-red-500 text-white font-bold animate-pulse';
      case 'A':   return 'bg-orange-500 text-white font-bold animate-pulse';
      case 'S':
      case 'IO':  return 'bg-amber-500 text-white font-bold animate-pulse';
      default:
        if (tag.length === 1) return 'bg-sky-100 text-sky-800 border border-sky-300';
        return 'bg-teal-100 text-teal-800 border border-teal-300';
    }
  };

  const tags = checkIn.tags || [];
  const hasUrgentTag = tags.some(t => URGENT_TAGS.includes(t));
  const roleTag = tags.find(t => t === 'NC' || t === 'ANC') ?? null;
  const rightTags = tags.filter(t => t !== 'NC' && t !== 'ANC');

  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded group ${hasUrgentTag ? 'bg-yellow-50' : 'hover:bg-slate-50'}`}>
      <div className="w-8 flex-shrink-0 flex items-center justify-center">
        {roleTag ? (
          <span className={`text-xs px-1 py-0.5 rounded font-semibold ${getTagStyle(roleTag)}`} title={getTagLabel(roleTag)}>
            {roleTag}
          </span>
        ) : onSetBookmark ? (
          <button
            onClick={onSetBookmark}
            className={`w-4 text-center transition-opacity ${
              isBookmarked
                ? 'text-cyan-700 opacity-100'
                : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-sky-500'
            }`}
            title={isBookmarked ? 'Last acknowledged' : 'Mark as last acknowledged'}
          >
            ▶
          </button>
        ) : null}
      </div>
      <span className="text-sm text-slate-400 w-6 flex-shrink-0 text-right">
        {number}
      </span>
      {editingField === 'callsign' ? (
        <input
          type="text"
          value={callsign}
          onChange={(e) => setCallsign(e.target.value.toUpperCase())}
          onBlur={handleSaveCallsign}
          onKeyDown={(e) => handleKeyDown(e, handleSaveCallsign, () => {
            setCallsign(checkIn.callsign);
            setEditingField(null);
          })}
          className="font-mono font-semibold text-sm w-20 flex-shrink-0 px-1 border-b border-sky-500 focus:outline-none bg-transparent"
          autoFocus
        />
      ) : (
        <span
          onClick={() => setEditingField('callsign')}
          className="font-mono font-semibold text-sm w-20 flex-shrink-0 cursor-pointer hover:text-cyan-700"
          title="Click to edit callsign"
        >
          {checkIn.callsign}
        </span>
      )}

      {isNewHam(station?.grantDate) && (
        <span className="text-xs px-1 py-0.5 rounded bg-green-100 text-green-800 border border-green-300 font-medium flex-shrink-0" title="Newly licensed ham (within the past month)">
          NEW
        </span>
      )}

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
          className="text-sm text-slate-600 w-24 px-1 border-b border-sky-500 focus:outline-none bg-transparent"
          placeholder={station?.firstName || 'Name'}
          autoFocus
        />
      ) : (
        <span
          onClick={() => setEditingField('name')}
          className="text-sm text-slate-600 w-24 truncate cursor-pointer hover:text-cyan-700 flex-shrink-0"
          title={displayName ? `Click to edit: ${displayName}` : 'Click to add name'}
        >
          {displayName || '—'}
        </span>
      )}

      {editingField === 'location' ? (
        <input
          type="text"
          value={editLocation}
          onChange={(e) => setEditLocation(e.target.value)}
          onBlur={handleSaveLocation}
          onKeyDown={(e) => handleKeyDown(e, handleSaveLocation, () => {
            setEditLocation(location);
            setEditingField(null);
          })}
          className="text-sm text-slate-400 w-32 flex-shrink-0 px-1 border-b border-sky-500 focus:outline-none bg-transparent"
          placeholder="City, ST"
          autoFocus
        />
      ) : (
        <span
          onClick={() => {
            setEditLocation(location);
            setEditingField('location');
          }}
          className={`text-sm w-32 truncate cursor-pointer hover:text-cyan-700 flex-shrink-0 ${location ? 'text-slate-400' : 'text-slate-300'}`}
          title={location ? `Click to edit: ${location}` : 'Click to add location'}
        >
          {location || '—'}
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
          className="text-sm text-slate-500 italic flex-1 min-w-0 px-1 border-b border-sky-500 focus:outline-none bg-transparent"
          placeholder="Note..."
          autoFocus
        />
      ) : (
        <span
          onClick={() => setEditingField('note')}
          className={`text-sm italic flex-1 min-w-0 truncate cursor-pointer hover:text-cyan-700 ${station?.note ? 'text-slate-500' : 'text-slate-300'}`}
          title={station?.note ? `Click to edit: ${station.note}` : 'Click to add note'}
        >
          {station?.note || '(note)'}
        </span>
      )}

      <div className="flex items-center gap-1 flex-shrink-0">
        {rightTags.map((tag) => (
          <span
            key={tag}
            className={`text-xs px-1.5 py-0.5 rounded ${getTagStyle(tag)}`}
            title={customTags.find(c => c.acronym === tag)?.label ?? getTagLabel(tag)}
          >
            {tag}
          </span>
        ))}
      </div>

      {lastSeenText && (
        <span className="text-xs text-slate-400 flex-shrink-0" title="Time since last check-in">
          {lastSeenText}
        </span>
      )}

      <button
        onClick={() => onRemove(checkIn.callsign)}
        className="text-slate-400 hover:text-red-500 p-0.5 flex-shrink-0"
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
