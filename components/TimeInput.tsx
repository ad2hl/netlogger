'use client';

import { useEffect, useState } from 'react';

interface TimeInputProps {
  value: string;              // "HH:MM" (24-hour) or ''
  onChange: (value: string) => void;
  utc: boolean;
  className?: string;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
}

const toCompact = (v: string) => v.replace(':', '');

// Parse "1024", "10:24", or "924" into "HH:MM"; null if not a valid 24-hour time
function parse(text: string): string | null {
  const digits = text.replace(/[:\sZz]/g, '');
  if (!/^\d{3,4}$/.test(digits)) return null;
  const padded = digits.padStart(4, '0');
  const h = Number(padded.slice(0, 2));
  const m = Number(padded.slice(2));
  if (h > 23 || m > 59) return null;
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

// Time entry field. In local mode it's the browser's native time picker; in
// UTC mode it's a 24-hour HHMM text field (no AM/PM) followed by "Z".
export default function TimeInput({ value, onChange, utc, className, required, autoFocus, id }: TimeInputProps) {
  const [text, setText] = useState(toCompact(value));

  useEffect(() => {
    if (parse(text) !== value) setText(toCompact(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!utc) {
    return (
      <input
        type="time"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        required={required}
        autoFocus={autoFocus}
      />
    );
  }

  const invalid = text !== '' && parse(text) === null;

  return (
    <div className="relative">
      <input
        type="text"
        id={id}
        inputMode="numeric"
        maxLength={5}
        placeholder="HHMM"
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (next === '') onChange('');
          else {
            const parsed = parse(next);
            if (parsed) onChange(parsed);
          }
        }}
        onBlur={() => { if (parse(text)) setText(toCompact(parse(text)!)); }}
        className={`${className ?? ''} pr-6 ${invalid ? 'border-red-500' : ''}`}
        required={required}
        autoFocus={autoFocus}
        pattern="([01]?[0-9]|2[0-3]):?[0-5][0-9]"
        title="24-hour UTC time, e.g. 1024"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">Z</span>
    </div>
  );
}
