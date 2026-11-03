'use client';

import { useRef, useState } from 'react';
import {
  exportDatabase,
  exportFileName,
  parseExportFile,
  summarizeExportFile,
  importDatabase,
  ExportFile,
} from '@/lib/dataTransfer';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

interface Props {
  uid: string;
  // Called after an import so the page can reload the (replaced) settings
  onImported: () => Promise<void> | void;
}

// Export / import of the user's whole database as a JSON text file (issue #331)
export default function DataTransfer({ uid, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [pending, setPending] = useState<{ name: string; file: ExportFile } | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = async () => {
    setBusy('export');
    setMessage(null);
    try {
      const text = await exportDatabase(uid);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Error exporting data:', error);
      setMessage({ type: 'error', text: 'Export failed. Please try again.' });
    }
    setBusy(null);
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (!chosen) return;
    setMessage(null);
    try {
      setPending({ name: chosen.name, file: parseExportFile(await chosen.text()) });
      setReplaceExisting(false);
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    }
  };

  const handleImport = async () => {
    if (!pending) return;
    setBusy('import');
    setMessage(null);
    try {
      const r = await importDatabase(uid, pending.file, { replaceExisting });
      await onImported();
      const parts = [
        r.existingDeleted ? 'existing stations, sessions and radiograms deleted' : null,
        r.settingsReplaced ? 'settings replaced' : null,
        `${plural(r.sessionsAdded, 'session')} added`,
        `${plural(r.radiogramsAdded, 'radiogram')} added`,
        `${plural(r.stationsAdded, 'station')} added`,
        `${plural(r.stationsUpdated, 'station')} updated`,
      ].filter(Boolean);
      const text = `Import complete: ${parts.join(', ')}.`;
      setMessage(r.failures > 0
        ? { type: 'error', text: `${text} ${plural(r.failures, 'record')} could not be imported; see the browser console for details.` }
        : { type: 'success', text });
    } catch (error) {
      console.error('Error importing data:', error);
      setMessage({ type: 'error', text: (error as Error).message || 'Import failed. Please try again.' });
    }
    setPending(null);
    setBusy(null);
  };

  const summary = pending ? summarizeExportFile(pending.file) : null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-1">Export &amp; Import Data</h2>
      <p className="text-sm text-slate-600 mb-4">
        Export saves all of your settings, stations, sessions and radiograms to a text (JSON) file.
        Import loads such a file, for example to copy your data between the web and desktop versions of NetLogger.
        Importing replaces your settings, adds the file&rsquo;s sessions and radiograms, and adds or updates stations.
        By default it deletes nothing, so sessions and radiograms already here are kept even if the file contains copies of them.
        To restore a backup without creating duplicates, choose &ldquo;Delete all existing data first&rdquo; when importing.
      </p>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleExport}
          disabled={busy !== null}
          className="bg-cyan-700 text-white px-4 py-2 rounded-md hover:bg-cyan-900 text-sm disabled:opacity-50"
        >
          {busy === 'export' ? 'Exporting...' : 'Export Data'}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy !== null}
          className="bg-slate-200 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-300 text-sm disabled:opacity-50"
        >
          Import Data...
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json,text/plain"
          onChange={handleFileChosen}
          className="hidden"
        />
      </div>

      {pending && summary && (
        <div className="mt-4 p-4 rounded-md border border-amber-300 bg-amber-50 text-sm text-slate-800">
          <p className="font-medium mb-2">Import {pending.name}?</p>
          {summary.exportedAt && !isNaN(Date.parse(summary.exportedAt)) && (
            <p className="mb-2 text-slate-600">
              Exported {new Date(summary.exportedAt).toLocaleString()}
              {summary.source ? ` from the ${summary.source} version` : ''}.
            </p>
          )}
          <ul className="list-disc ml-5 mb-3 space-y-0.5">
            {replaceExisting && (
              <li className="text-red-700 font-medium">All existing stations, sessions and radiograms will be deleted</li>
            )}
            <li>{summary.hasSettings ? 'Your settings will be replaced' : 'No settings (your settings are kept)'}</li>
            <li>{plural(summary.sessions, 'session')} will be added</li>
            <li>{plural(summary.radiograms, 'radiogram')} will be added</li>
            <li>{plural(summary.stations, 'station')} will be {replaceExisting ? 'added' : 'added or updated'}</li>
          </ul>
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              disabled={busy !== null}
              className="rounded"
            />
            Delete all existing data first (restore a backup)
          </label>
          {replaceExisting && (
            <p className="mb-3 p-3 rounded-md bg-red-50 text-red-800">
              This permanently deletes every station, session and radiogram you have now and cannot be undone.
              If you might want them back,{' '}
              <button type="button" onClick={handleExport} disabled={busy !== null} className="underline font-medium disabled:opacity-50">
                export your current data
              </button>{' '}
              before importing.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={busy !== null}
              className={`${replaceExisting ? 'bg-red-700 hover:bg-red-900' : 'bg-cyan-700 hover:bg-cyan-900'} text-white px-4 py-2 rounded-md text-sm disabled:opacity-50`}
            >
              {busy === 'import' ? 'Importing...' : replaceExisting ? 'Delete and Import' : 'Import'}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={busy !== null}
              className="bg-slate-200 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-300 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={`mt-4 p-4 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
