'use client';

import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { CheckIn, Station, CustomTag } from '@/types';
import { parseCallsignInput } from '@/lib/radiogram';
import { searchStations } from '@/lib/stationSearch';
import StationLookupDropdown from './StationLookupDropdown';

const WHITMAN_IMG = 'https://upload.wikimedia.org/wikipedia/commons/8/85/Walt_Whitman_-_Brady-Handy_restored.png';


interface CheckInFormProps {
  onCheckIn: (checkIn: CheckIn) => void;
  disabled?: boolean;
  allStations?: Station[];
  onTabToTraffic?: () => void;
  customTags?: CustomTag[];
}

const CheckInForm = forwardRef<HTMLInputElement, CheckInFormProps>(function CheckInForm({ onCheckIn, disabled, allStations = [], onTabToTraffic, customTags = [] }, ref) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showWhitman, setShowWhitman] = useState(false);
  const whitmanArmed = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => inputRef.current!);

  // A trailing ? turns the input into a station search, e.g. "AW?" (issue #333)
  const isSearchMode = input.endsWith('?');
  const searchQuery = isSearchMode ? input.slice(0, -1) : '';
  const searchResults = isSearchMode ? searchStations(allStations, searchQuery) : [];

  const { callsign: enteredCallsign, tags: enteredTags } = parseCallsignInput(input);
  // Trailing /<digit> is a call-area designator (e.g. W1AW/2), not a tag (issue #283)
  const hasValidCallsign = /^[A-Z0-9]{1,2}[0-9][A-Z]{1,3}(\/\d)?$/.test(enteredCallsign);
  const hasTag = (tag: string) => enteredTags.includes(tag.toUpperCase());

  // Re-focus input when it becomes enabled after a lookup
  useEffect(() => {
    if (!disabled && !isSubmitting) {
      inputRef.current?.focus();
    }
  }, [disabled, isSubmitting]);

  // Reset selection when search results change
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setSelectedIndex(0);
  }

  // Handle click outside to cancel search mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        if (isSearchMode) {
          setInput('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearchMode]);

  const handleSelectStation = (station: Station) => {
    setInput(station.callsign);
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isSearchMode) {
      if (e.key === 'Tab' && onTabToTraffic) {
        e.preventDefault();
        onTabToTraffic();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (searchResults.length > 0) {
          handleSelectStation(searchResults[selectedIndex]);
        }
        break;
      case 'Tab':
        if (searchResults.length > 0) {
          e.preventDefault();
          handleSelectStation(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setInput('');
        break;
    }
  };

  useEffect(() => {
    if (!showWhitman) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowWhitman(false); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showWhitman]);

  const appendTag = (tag: string) => {
    const upper = tag.toUpperCase().trim();
    if (!upper) return;
    setInput(prev => prev + '/' + upper);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleTagClick = (tag: string) => {
    if (tag === 'NC' && hasTag('ANC')) {
      setInput(prev => prev.split('/').map(p => p === 'ANC' ? 'NC' : p).join('/'));
    } else if (tag === 'ANC' && hasTag('NC')) {
      setInput(prev => prev.split('/').map(p => p === 'NC' ? 'ANC' : p).join('/'));
    } else {
      appendTag(tag);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting || isSearchMode) return;

    const { callsign, tags } = parseCallsignInput(input);

    if (callsign.toUpperCase() === 'P0ET' && !whitmanArmed.current) {
      whitmanArmed.current = true;
      setShowWhitman(true);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    whitmanArmed.current = false;
    setIsSubmitting(true);

    if (callsign) {
      const checkIn: CheckIn = {
        callsign: callsign.toUpperCase(),
        tags,
        timestamp: new Date(),
      };

      await onCheckIn(checkIn);
      setInput('');
    }

    setIsSubmitting(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <>
    <div ref={formRef} className="bg-white rounded-lg shadow p-3">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Station</span>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                if (val !== 'P0ET') whitmanArmed.current = false;
                setInput(val);
              }}
              onKeyDown={handleKeyDown}
              className="w-[20ch] px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm"
              placeholder="CALL? to search"
              disabled={disabled || isSubmitting}
              autoComplete="off"
              autoCapitalize="characters"
            />
            {isSearchMode && (
              <StationLookupDropdown
                stations={searchResults}
                selectedIndex={selectedIndex}
                onSelect={handleSelectStation}
                query={searchQuery}
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => handleTagClick('NC')}
            disabled={disabled || isSubmitting || !hasValidCallsign || hasTag('NC')}
            title="Net Control"
            className="ml-2 px-1.5 py-1 text-xs font-semibold rounded border border-purple-300 bg-purple-100 text-purple-800 hover:bg-purple-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            NC
          </button>

          <button
            type="button"
            onClick={() => handleTagClick('ANC')}
            disabled={disabled || isSubmitting || !hasValidCallsign || hasTag('ANC')}
            title="Alternate Net Control"
            className="px-1.5 py-1 text-xs font-semibold rounded border border-violet-300 bg-violet-100 text-violet-800 hover:bg-violet-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ANC
          </button>

          <button
            type="button"
            onClick={() => handleTagClick('T')}
            disabled={disabled || isSubmitting || !hasValidCallsign || hasTag('T')}
            title="Traffic"
            className="px-1.5 py-1 text-xs font-bold rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            T
          </button>

          <button
            type="button"
            onClick={() => handleTagClick('A')}
            disabled={disabled || isSubmitting || !hasValidCallsign || hasTag('A')}
            title="Announcement"
            className="px-1.5 py-1 text-xs font-bold rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            A
          </button>

          {customTags.map((ct) => (
            <button
              key={ct.acronym}
              type="button"
              onClick={() => handleTagClick(ct.acronym)}
              disabled={disabled || isSubmitting || !hasValidCallsign || hasTag(ct.acronym)}
              title={ct.label}
              className={`px-1.5 py-1 text-xs font-semibold rounded disabled:opacity-40 disabled:cursor-not-allowed ${
                ct.acronym.length === 1
                  ? 'bg-sky-100 text-sky-800 border border-sky-300 hover:bg-sky-200'
                  : 'bg-teal-100 text-teal-800 border border-teal-300 hover:bg-teal-200'
              }`}
            >
              {ct.acronym}
            </button>
          ))}

          <button
            type="submit"
            disabled={disabled || isSubmitting || !hasValidCallsign || isSearchMode}
            className="ml-auto bg-cyan-700 text-white py-1 px-3 rounded-md hover:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
          >
            {isSubmitting ? '...' : 'Add'}
          </button>
        </div>
      </form>
    </div>

    {showWhitman && (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="relative">
          <button
            onClick={() => setShowWhitman(false)}
            className="absolute -top-3 -right-3 bg-white rounded-full p-1 text-gray-500 hover:text-gray-800 shadow"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
          {/* Remote one-off easter-egg image; next/image would need a remotePatterns entry */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WHITMAN_IMG}
            alt="Walt Whitman"
            className="max-h-[80vh] max-w-[80vw] rounded shadow-xl"
          />
        </div>
      </div>
    )}
    </>
  );
});

export default CheckInForm;
