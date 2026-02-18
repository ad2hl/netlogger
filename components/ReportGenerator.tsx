'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { NetSession, Station, UserProfile } from '@/types';
import { generateRadiogram, RadiogramResult } from '@/lib/radiogram';

interface ReportGeneratorProps {
  session: NetSession | null;
  stations: Map<string, Station>;
  profile: UserProfile | null;
  onSaveReport?: (messageNumber?: string) => Promise<boolean | undefined>;
  isOpen: boolean;
  onClose: () => void;
}

const WORDS_PER_LINE = 5;

function ReadOnlyField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="w-full px-2 py-1 border border-slate-200 rounded text-sm uppercase bg-slate-50 text-slate-700">
        {value || '\u00A0'}
      </div>
    </div>
  );
}

function FormattedRadiogram({ radiogram, messageNumber, onMessageNumberChange }: {
  radiogram: RadiogramResult;
  messageNumber: string;
  onMessageNumberChange: (value: string) => void;
}) {
  const { parts } = radiogram;
  const numLines = Math.ceil(parts.bodyWords.length / WORDS_PER_LINE);

  return (
    <div className="space-y-3">
      {/* Preamble */}
      <div className="border-b pb-3">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Number</label>
            <input
              type="text"
              value={messageNumber}
              onChange={(e) => onMessageNumberChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="XXX"
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
            />
          </div>
          <ReadOnlyField label="Precedence" value={parts.precedence} className="col-span-2" />
          <div className="col-span-2" /> {/* HX - empty for net reports */}
          <ReadOnlyField label="Station of Origin" value={parts.stationOfOrigin} className="col-span-3" />
          <ReadOnlyField label="Check" value={parts.check} className="col-span-2" />
        </div>
        <div className="grid grid-cols-12 gap-3 mt-2">
          <ReadOnlyField label="Place of Origin" value={parts.placeOfOrigin} className="col-span-4" />
          <div className="col-span-2" /> {/* Time - not used for net reports */}
          <ReadOnlyField label="Date" value={parts.date} className="col-span-6" />
        </div>
      </div>

      {/* Addressee */}
      <div className="border-b pb-3">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Addressee</h3>
        <div className="w-full px-2 py-1 border border-slate-200 rounded text-sm uppercase bg-slate-50 text-slate-700">
          {parts.addressee || '\u00A0'}
        </div>
      </div>

      {/* Text - word grid */}
      <div className="border-b pb-3">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Text</h3>
        <div className="space-y-2">
          {Array.from({ length: numLines }, (_, line) => (
            <div key={line} className="grid grid-cols-5 gap-2">
              {Array.from({ length: WORDS_PER_LINE }, (_, col) => {
                const index = line * WORDS_PER_LINE + col;
                const word = parts.bodyWords[index] || '';
                return (
                  <div key={index} className="relative">
                    <span className="absolute top-0 left-0.5 text-[10px] text-slate-400 leading-none">
                      {index + 1}
                    </span>
                    <div className="w-full px-2 pt-3 pb-1 border border-slate-200 rounded text-sm uppercase bg-slate-50 text-slate-700">
                      {word || '\u00A0'}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-xs mt-2 text-slate-500">
          Word count: {radiogram.wordCount}
        </p>
      </div>

      {/* Signature */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Signature</h3>
        <div className="w-full px-2 py-1 border border-slate-200 rounded text-sm uppercase bg-slate-50 text-slate-700">
          {parts.signature || '\u00A0'}
        </div>
      </div>
    </div>
  );
}

export default function ReportGenerator({
  session,
  stations,
  profile,
  onSaveReport,
  isOpen,
  onClose,
}: ReportGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageNumber, setMessageNumber] = useState('');

  const radiogram = useMemo(() => {
    if (!session || !profile?.callsign) return null;

    return generateRadiogram({
      session,
      stations,
      userCallsign: profile.callsign,
      userName: profile.name,
      userLocation: profile.location,
      addresseeCallsign: profile.netManagerCall || '',
      messageNumber: messageNumber || undefined,
    });
  }, [session, stations, profile, messageNumber]);

  // Check if report has changed from saved version
  const reportChanged = useMemo(() => {
    if (!session?.endTime || !radiogram) return false;
    if (!session.report) return true; // Not saved yet
    return session.report.radiogram !== radiogram.text;
  }, [session, radiogram]);

  const handleCopy = async () => {
    if (radiogram) {
      await navigator.clipboard.writeText(radiogram.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveReport = async () => {
    if (!onSaveReport) return;
    setSaving(true);
    await onSaveReport(messageNumber || undefined);
    setSaving(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let content: React.ReactNode;

  if (!session) {
    content = <p className="text-slate-500">Start a session to generate a report.</p>;
  } else if (!profile?.callsign || !profile?.netManagerCall) {
    content = (
      <p className="text-slate-500">
        Please set up your callsign and net manager callsign in Settings to generate reports.
      </p>
    );
  } else if (radiogram) {
    content = (
      <>
        {session?.report && !reportChanged && (
          <div className="mb-2 text-sm text-green-600">✓ Saved</div>
        )}
        {reportChanged && (
          <div className="mb-2 text-sm text-orange-600">• Unsaved changes</div>
        )}
        <FormattedRadiogram
          radiogram={radiogram}
          messageNumber={messageNumber}
          onMessageNumberChange={setMessageNumber}
        />
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-4 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Net Report (Radiogram)</h2>
          <div className="flex items-center gap-2">
            {reportChanged && onSaveReport && (
              <button
                onClick={handleSaveReport}
                disabled={saving}
                className="bg-green-600 text-white py-1 px-3 rounded-md hover:bg-green-700 text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Update Report'}
              </button>
            )}
            {radiogram && (
              <button
                onClick={handleCopy}
                className="bg-cyan-700 text-white py-1 px-3 rounded-md hover:bg-cyan-900 text-sm"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 text-xl px-2"
            >
              ×
            </button>
          </div>
        </div>
        {content}
      </div>
    </div>
  );
}
