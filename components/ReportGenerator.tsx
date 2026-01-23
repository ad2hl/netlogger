'use client';

import React, { useState, useMemo } from 'react';
import { NetSession, Station, UserProfile } from '@/types';
import { generateRadiogram } from '@/lib/radiogram';

interface ReportGeneratorProps {
  session: NetSession | null;
  stations: Map<string, Station>;
  profile: UserProfile | null;
  onSaveReport?: () => Promise<boolean | undefined>;
}

export default function ReportGenerator({
  session,
  stations,
  profile,
  onSaveReport,
}: ReportGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const radiogram = useMemo(() => {
    if (!session || !profile?.callsign) return null;

    return generateRadiogram({
      session,
      stations,
      userCallsign: profile.callsign,
      userName: profile.name,
      userLocation: profile.location,
      addresseeCallsign: profile.netManagerCall || '',
    });
  }, [session, stations, profile]);

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
    await onSaveReport();
    setSaving(false);
  };

  if (!session) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Net Report</h2>
        <p className="text-gray-500">Start a session to generate a report.</p>
      </div>
    );
  }

  if (!profile?.callsign || !profile?.netManagerCall) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Net Report</h2>
        <p className="text-gray-500">
          Please set up your callsign and net manager callsign in Settings to generate reports.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
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
          <button
            onClick={handleCopy}
            className="bg-blue-600 text-white py-1 px-3 rounded-md hover:bg-blue-700 text-sm"
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>

      {radiogram && (
        <>
          <div className="mb-2 text-sm text-gray-600">
            Word Count: {radiogram.wordCount}
            {session?.report && !reportChanged && (
              <span className="ml-2 text-green-600">✓ Saved</span>
            )}
            {reportChanged && (
              <span className="ml-2 text-orange-600">• Unsaved changes</span>
            )}
          </div>
          <pre className="bg-gray-100 p-4 rounded-md font-mono text-sm whitespace-pre-wrap overflow-x-auto">
            {radiogram.text}
          </pre>
        </>
      )}
    </div>
  );
}
