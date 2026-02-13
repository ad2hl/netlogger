'use client';

import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { CheckIn, Station } from '@/types';
import { parseCallsignInput } from '@/lib/radiogram';
import { searchStations } from '@/lib/stationSearch';
import StationLookupDropdown from './StationLookupDropdown';

interface CheckInFormProps {
  onCheckIn: (checkIn: CheckIn) => void;
  disabled?: boolean;
  allStations?: Station[];
  onTabToTraffic?: () => void;
}

const CheckInForm = forwardRef<HTMLInputElement, CheckInFormProps>(function CheckInForm({ onCheckIn, disabled, allStations = [], onTabToTraffic }, ref) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => inputRef.current!);

  const isSearchMode = input.startsWith('?');
  const searchQuery = isSearchMode ? input.slice(1) : '';
  const searchResults = isSearchMode ? searchStations(allStations, searchQuery) : [];

  // Re-focus input when it becomes enabled after a lookup
  useEffect(() => {
    if (!disabled && !isSubmitting) {
      inputRef.current?.focus();
    }
  }, [disabled, isSubmitting]);

  // Reset selection when search results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

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
        if (searchResults.length > 0 && selectedIndex >= 0) {
          handleSelectStation(searchResults[selectedIndex]);
        }
        break;
      case 'Tab':
        if (searchResults.length > 0 && selectedIndex >= 0) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting || isSearchMode) return;

    setIsSubmitting(true);

    const { callsign, tags } = parseCallsignInput(input);

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
    <div ref={formRef} className="bg-white rounded-lg shadow p-3">
      <h2 className="text-lg font-semibold mb-2">Check In Station</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              placeholder="e.g., AD2HL/NC/T or ?2HL to search"
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
            type="submit"
            disabled={disabled || isSubmitting || !input.trim() || isSearchMode}
            className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '...' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
});

export default CheckInForm;
