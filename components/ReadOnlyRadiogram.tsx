'use client';

import React, { useState } from 'react';
import { Radiogram, NetReport, DEFAULT_DISPOSITION_METHODS } from '@/types';
import { formatRadiogramAsText } from '@/lib/radiogram';

interface DispositionFields {
  dispositionMethod: string;
  dispositionDestination: string;
  dispositionDate: string;
  dispositionTime: string;
}

interface ReadOnlyRadiogramProps {
  radiogram?: Radiogram;
  netReport?: NetReport;
  onClose: () => void;
  onUpdateDisposition?: (disposition: DispositionFields) => Promise<void> | void;
  dispositionMethods?: string[];
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

function WordGrid({ words }: { words: string[] }) {
  const numLines = Math.ceil(words.length / WORDS_PER_LINE);
  return (
    <div className="space-y-2">
      {Array.from({ length: numLines }, (_, line) => (
        <div key={line} className="grid grid-cols-5 gap-2">
          {Array.from({ length: WORDS_PER_LINE }, (_, col) => {
            const index = line * WORDS_PER_LINE + col;
            const word = words[index] || '';
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
  );
}

function parseNetReportText(text: string): {
  number: string;
  precedence: string;
  hx: string;
  stationOfOrigin: string;
  check: string;
  placeOfOrigin: string;
  timeFiled: string;
  date: string;
  addressee: string;
  bodyWords: string[];
  signature: string;
} {
  const lines = text.split('\n');

  // Line 1: preamble — NUMBER PRECEDENCE [HX] STATION CHECK PLACE DATE
  const preambleLine = lines[0] || '';
  const preambleParts = preambleLine.split(/\s+/);

  const number = preambleParts[0] || '';
  const precedence = preambleParts[1] || '';
  // The rest: STATION CHECK PLACE MONTH DAY
  const stationOfOrigin = preambleParts[2] || '';
  const check = preambleParts[3] || '';
  // Place and date are the remaining parts
  // Format: PLACE MONTH DAY
  const placeOfOrigin = preambleParts[4] || '';
  const date = preambleParts.slice(5).join(' ');

  // Line 2: addressee
  const addressee = lines[1] || '';

  // Find BT markers
  const btIndices: number[] = [];
  for (let i = 2; i < lines.length; i++) {
    if (lines[i].trim() === 'BT') {
      btIndices.push(i);
    }
  }

  // Between first and second BT: body words
  let bodyWords: string[] = [];
  if (btIndices.length >= 2) {
    const bodyLines = lines.slice(btIndices[0] + 1, btIndices[1]);
    bodyWords = bodyLines.join(' ').split(/\s+/).filter(Boolean);
  }

  // After last BT: signature
  const signature = btIndices.length >= 2
    ? lines.slice(btIndices[1] + 1).join(' ').trim()
    : '';

  return {
    number,
    precedence,
    hx: '',
    stationOfOrigin,
    check,
    placeOfOrigin,
    timeFiled: '',
    date,
    addressee,
    bodyWords,
    signature,
  };
}

function RadiogramFormView({ fields, dispositionSection }: {
  fields: {
    number: string;
    precedence: string;
    hx: string;
    stationOfOrigin: string;
    check: string;
    placeOfOrigin: string;
    timeFiled: string;
    date: string;
    addressee: string;
    addressOpNote?: string;
    bodyWords: string[];
    signature: string;
    signatureOpNote?: string;
  };
  dispositionSection?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {/* Preamble */}
      <div className="border-b pb-3">
        <div className="grid grid-cols-12 gap-3">
          <ReadOnlyField label="Number" value={fields.number} className="col-span-2" />
          <ReadOnlyField label="Precedence" value={fields.precedence} className="col-span-2" />
          <ReadOnlyField label="HX" value={fields.hx} className="col-span-2" />
          <ReadOnlyField label="Station of Origin" value={fields.stationOfOrigin} className="col-span-3" />
          <ReadOnlyField label="Check" value={fields.check} className="col-span-2" />
        </div>
        <div className="grid grid-cols-12 gap-3 mt-2">
          <ReadOnlyField label="Place of Origin" value={fields.placeOfOrigin} className="col-span-4" />
          <ReadOnlyField label="Time Filed" value={fields.timeFiled} className="col-span-2" />
          <ReadOnlyField label="Date" value={fields.date} className="col-span-6" />
        </div>
      </div>

      {/* Addressee */}
      <div className="border-b pb-3">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Addressee</h3>
        <div className="w-full px-2 py-1 border border-slate-200 rounded text-sm uppercase bg-slate-50 text-slate-700 whitespace-pre-line">
          {fields.addressee || '\u00A0'}
        </div>
        {fields.addressOpNote && (
          <div className="mt-1 text-xs text-slate-500">Op Note: {fields.addressOpNote}</div>
        )}
      </div>

      {/* Text */}
      <div className="border-b pb-3">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Text</h3>
        <WordGrid words={fields.bodyWords} />
        <p className="text-xs mt-2 text-slate-500">
          Word count: {fields.bodyWords.length}
        </p>
      </div>

      {/* Signature */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Signature</h3>
        <div className="w-full px-2 py-1 border border-slate-200 rounded text-sm uppercase bg-slate-50 text-slate-700">
          {fields.signature || '\u00A0'}
        </div>
        {fields.signatureOpNote && (
          <div className="mt-1 text-xs text-slate-500">Op Note: {fields.signatureOpNote}</div>
        )}
      </div>

      {dispositionSection}
    </div>
  );
}

function EditableDisposition({ disposition, onChange, onSave, onCancel, dispositionMethods }: {
  disposition: DispositionFields;
  onChange: (d: DispositionFields) => void;
  onSave: () => void;
  onCancel: () => void;
  dispositionMethods?: string[];
}) {
  const methods = dispositionMethods ?? DEFAULT_DISPOSITION_METHODS;
  const inputClass = "w-full px-2 border border-slate-300 rounded text-sm h-[30px]";
  return (
    <div className="border-t pt-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Disposition</h3>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
          <select
            value={disposition.dispositionMethod}
            onChange={(e) => onChange({ ...disposition, dispositionMethod: e.target.value })}
            className={inputClass}
          >
            <option value=""></option>
            {methods.map((m) => (
              <option key={m} value={m.toUpperCase()}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Destination</label>
          <input
            type="text"
            value={disposition.dispositionDestination}
            onChange={(e) => onChange({ ...disposition, dispositionDestination: e.target.value.toUpperCase() })}
            className={`${inputClass} uppercase`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={disposition.dispositionDate}
            onChange={(e) => onChange({ ...disposition, dispositionDate: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
          <input
            type="time"
            value={disposition.dispositionTime}
            onChange={(e) => onChange({ ...disposition, dispositionTime: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1 text-sm text-white bg-indigo-700 rounded-md hover:bg-indigo-800"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function ReadOnlyDisposition({ disposition }: { disposition: DispositionFields }) {
  if (!disposition.dispositionMethod && !disposition.dispositionDestination &&
      !disposition.dispositionDate && !disposition.dispositionTime) {
    return null;
  }
  return (
    <div className="border-t pt-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Disposition</h3>
      <div className="grid grid-cols-4 gap-3">
        <ReadOnlyField label="Method" value={disposition.dispositionMethod} />
        <ReadOnlyField label="Destination" value={disposition.dispositionDestination} />
        <ReadOnlyField label="Date" value={disposition.dispositionDate} />
        <ReadOnlyField label="Time" value={disposition.dispositionTime} />
      </div>
    </div>
  );
}

export default function ReadOnlyRadiogram({ radiogram, netReport, onClose, onUpdateDisposition, dispositionMethods }: ReadOnlyRadiogramProps) {
  const [copied, setCopied] = useState(false);

  const initDisposition = (): DispositionFields => {
    if (radiogram) {
      return {
        dispositionMethod: radiogram.dispositionMethod || '',
        dispositionDestination: radiogram.dispositionDestination || '',
        dispositionDate: radiogram.dispositionDate || '',
        dispositionTime: radiogram.dispositionTime || '',
      };
    }
    if (netReport?.parts) {
      return {
        dispositionMethod: netReport.parts.dispositionMethod || '',
        dispositionDestination: netReport.parts.dispositionDestination || '',
        dispositionDate: netReport.parts.dispositionDate || '',
        dispositionTime: netReport.parts.dispositionTime || '',
      };
    }
    return { dispositionMethod: '', dispositionDestination: '', dispositionDate: '', dispositionTime: '' };
  };

  const [disposition, setDisposition] = useState<DispositionFields>(initDisposition);

  const handleSaveDisposition = async () => {
    if (onUpdateDisposition) {
      await onUpdateDisposition(disposition);
    }
    onClose();
  };

  const handleCopy = async () => {
    let text = '';
    if (radiogram) {
      text = formatRadiogramAsText(radiogram);
    } else if (netReport) {
      text = netReport.radiogram;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const title = netReport ? 'Net Report' : 'Radiogram';

  let fields;
  if (radiogram) {
    fields = {
      number: radiogram.number,
      precedence: radiogram.precedence,
      hx: radiogram.handlingInstructions,
      stationOfOrigin: radiogram.stationOfOrigin,
      check: radiogram.check,
      placeOfOrigin: radiogram.placeOfOrigin,
      timeFiled: radiogram.timeFiled,
      date: radiogram.date,
      addressee: radiogram.address,
      addressOpNote: radiogram.addressOpNote,
      bodyWords: radiogram.textWords,
      signature: radiogram.signature,
      signatureOpNote: radiogram.signatureOpNote,
    };
  } else if (netReport) {
    if (netReport.parts) {
      fields = {
        number: netReport.parts.number,
        precedence: netReport.parts.precedence,
        hx: '',
        stationOfOrigin: netReport.parts.stationOfOrigin,
        check: netReport.parts.check,
        placeOfOrigin: netReport.parts.placeOfOrigin,
        timeFiled: '',
        date: netReport.parts.date,
        addressee: netReport.parts.addressee,
        bodyWords: netReport.parts.bodyWords,
        signature: netReport.parts.signature,
      };
    } else {
      fields = parseNetReportText(netReport.radiogram);
    }
  }

  const dispositionSection = onUpdateDisposition
    ? <EditableDisposition disposition={disposition} onChange={setDisposition} onSave={handleSaveDisposition} onCancel={onClose} dispositionMethods={dispositionMethods} />
    : <ReadOnlyDisposition disposition={disposition} />;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-4 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="bg-indigo-700 text-white py-1 px-3 rounded-md hover:bg-indigo-800 text-sm"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 text-xl px-2"
            >
              ×
            </button>
          </div>
        </div>
        {fields && <RadiogramFormView fields={fields} dispositionSection={dispositionSection} />}
      </div>
    </div>
  );
}
