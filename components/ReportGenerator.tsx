'use client';

import React, { useState, useMemo } from 'react';
import { NetSession, Station, UserProfile } from '@/types';
import { generateRadiogram } from '@/lib/radiogram';

interface ReportGeneratorProps {
  session: NetSession | null;
  stations: Map<string, Station>;
  profile: UserProfile | null;
}

export default function ReportGenerator({
  session,
  stations,
  profile,
}: ReportGeneratorProps) {
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    if (radiogram) {
      await navigator.clipboard.writeText(radiogram.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
        <button
          onClick={handleCopy}
          className="bg-blue-600 text-white py-1 px-3 rounded-md hover:bg-blue-700 text-sm"
        >
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
      </div>

      {radiogram && (
        <>
          <div className="mb-2 text-sm text-gray-600">
            Word Count: {radiogram.wordCount}
          </div>
          <pre className="bg-gray-100 p-4 rounded-md font-mono text-sm whitespace-pre-wrap overflow-x-auto">
            {radiogram.text}
          </pre>
        </>
      )}
    </div>
  );
}
