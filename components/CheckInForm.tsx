'use client';

import React, { useState, useRef } from 'react';
import { CheckIn } from '@/types';
import { parseCallsignInput } from '@/lib/radiogram';

interface CheckInFormProps {
  onCheckIn: (checkIn: CheckIn) => void;
  disabled?: boolean;
}

export default function CheckInForm({ onCheckIn, disabled }: CheckInFormProps) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting) return;

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
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h2 className="text-lg font-semibold mb-3">Check In Station</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="e.g., W1AW/NC/T or K3ABC/OC/HVN"
              disabled={disabled || isSubmitting}
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>

          <button
            type="submit"
            disabled={disabled || isSubmitting || !input.trim()}
            className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '...' : 'Add'}
          </button>
        </div>

        <p className="text-sm text-gray-500">
          /NC /ANC /T /A /M /P /S /IO /xxx (liaison)
        </p>
      </form>
    </div>
  );
}
