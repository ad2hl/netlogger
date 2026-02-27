'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Radiogram, UserProfile, DEFAULT_DISPOSITION_METHODS, DEFAULT_RECEIVED_METHODS } from '@/types';
import { formatRadiogramAsText } from '@/lib/radiogram';
import { printRadiogram } from '@/lib/radiogramPrint';

interface RadiogramFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (radiogram: Radiogram) => void;
  onDelete?: (id: string) => void;
  existingRadiogram?: Radiogram | null;
  netName?: string;
  dispositionMethods?: string[];
  receivedMethods?: string[];
  userProfile?: UserProfile;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Filter to only allow A-Z, 0-9, and /
function filterRadiogramChars(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9/]/g, '');
}

// Allow A-Z, 0-9, /, and space
function filterRadiogramCharsWithSpaces(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9/ ]/g, '');
}

// Allow A-Z, 0-9, /, space, and newlines
function filterRadiogramCharsWithSpacesAndNewlines(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9/ \n]/g, '');
}

// Allow phone number characters: digits, spaces, +, -, (, )
function filterPhoneChars(value: string): string {
  return value.replace(/[^0-9() +\-]/g, '');
}

// Fields that allow spaces
const FIELDS_WITH_SPACES = ['netName', 'placeOfOrigin', 'timeFiled', 'date', 'address', 'addressOpNote', 'signature', 'signatureOpNote', 'receivedDestination', 'dispositionDestination'];

const WORDS_PER_LINE = 5;
const INITIAL_LINES = 5;

// Parse the CHECK field value: handles plain numbers and ARLnn (e.g. "ARL5")
function parseCheck(check: string): number {
  const arlMatch = check.match(/^ARL(\d+)$/i);
  if (arlMatch) return parseInt(arlMatch[1], 10);
  return parseInt(check, 10);
}

export default function RadiogramForm({
  isOpen,
  onClose,
  onSave,
  onDelete,
  existingRadiogram,
  netName,
  dispositionMethods,
  receivedMethods,
  userProfile,
}: RadiogramFormProps) {
  const sentMethods = dispositionMethods ?? DEFAULT_DISPOSITION_METHODS;
  const rcvdMethods = receivedMethods ?? DEFAULT_RECEIVED_METHODS;
  const createEmptyWords = (lines: number) => Array(lines * WORDS_PER_LINE).fill('');

  const emptyForm: Omit<Radiogram, 'id'> = {
    netName: netName || '',
    number: '',
    precedence: '',
    handlingInstructions: '',
    stationOfOrigin: '',
    check: '',
    placeOfOrigin: '',
    timeFiled: '',
    date: '',
    address: '',
    addressPhone: '',
    addressOpNote: '',
    textWords: createEmptyWords(INITIAL_LINES),
    signature: '',
    signatureOpNote: '',
    receivedMethod: '',
    receivedDestination: '',
    receivedDate: '',
    receivedTime: '',
    dispositionMethod: '',
    dispositionDestination: '',
    dispositionDate: '',
    dispositionTime: '',
  };

  const [formData, setFormData] = useState<Omit<Radiogram, 'id'>>(emptyForm);
  const [copied, setCopied] = useState(false);
  const wordInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const signatureRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (existingRadiogram) {
      const { id, ...rest } = existingRadiogram;
      // Ensure textWords has at least INITIAL_LINES worth of words
      const minWords = INITIAL_LINES * WORDS_PER_LINE;
      const textWords = rest.textWords || [];
      while (textWords.length < minWords) {
        textWords.push('');
      }
      setFormData({ ...rest, textWords });
    } else {
      setFormData({ ...emptyForm, netName: netName || '' });
    }
  }, [existingRadiogram, isOpen]);

  // Calculate word count from textWords for comparison with check
  const wordCount = formData.textWords.filter(w => w.length > 0).length;
  const numLines = Math.ceil(formData.textWords.length / WORDS_PER_LINE);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const el = e.target;
    const cursorPos = el.selectionStart;
    const isTextarea = e.target.tagName === 'TEXTAREA';
    const isPhone = name === 'addressPhone';
    const allowsSpaces = FIELDS_WITH_SPACES.includes(name);

    let filtered: string;
    if (isPhone) {
      filtered = filterPhoneChars(value);
    } else if (isTextarea && allowsSpaces) {
      filtered = filterRadiogramCharsWithSpacesAndNewlines(value);
    } else if (allowsSpaces) {
      filtered = filterRadiogramCharsWithSpaces(value);
    } else {
      filtered = filterRadiogramChars(value);
    }

    // Filter the text before the cursor to find the correct cursor position
    let adjustedCursor: number | null = null;
    if (cursorPos !== null) {
      const beforeCursor = value.slice(0, cursorPos);
      if (isPhone) {
        adjustedCursor = filterPhoneChars(beforeCursor).length;
      } else if (isTextarea && allowsSpaces) {
        adjustedCursor = filterRadiogramCharsWithSpacesAndNewlines(beforeCursor).length;
      } else if (allowsSpaces) {
        adjustedCursor = filterRadiogramCharsWithSpaces(beforeCursor).length;
      } else {
        adjustedCursor = filterRadiogramChars(beforeCursor).length;
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: filtered,
    }));

    // Restore cursor position after React re-renders
    requestAnimationFrame(() => {
      if (adjustedCursor !== null) {
        el.setSelectionRange(adjustedCursor, adjustedCursor);
      }
    });
  };

  const handleWordChange = (index: number, value: string, el: HTMLInputElement) => {
    const cursorPos = el.selectionStart;
    const filtered = filterRadiogramChars(value);

    const adjustedCursor = cursorPos !== null
      ? filterRadiogramChars(value.slice(0, cursorPos)).length
      : null;

    setFormData(prev => {
      const newWords = [...prev.textWords];
      newWords[index] = filtered;
      return { ...prev, textWords: newWords };
    });

    requestAnimationFrame(() => {
      if (adjustedCursor !== null) {
        el.setSelectionRange(adjustedCursor, adjustedCursor);
      }
    });
  };

  const handleWordKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Tab' && !e.shiftKey) || e.key === ' ') {
      const isLastWordOfLastLine = index === formData.textWords.length - 1;
      if (isLastWordOfLastLine) {
        e.preventDefault();
        // Add a new line
        setFormData(prev => ({
          ...prev,
          textWords: [...prev.textWords, ...Array(WORDS_PER_LINE).fill('')],
        }));
        // Focus the first word of the new line after state updates
        setTimeout(() => {
          const newIndex = index + 1;
          wordInputRefs.current[newIndex]?.focus();
        }, 0);
      } else if (e.key === ' ') {
        // For spacebar, manually move to next field
        e.preventDefault();
        wordInputRefs.current[index + 1]?.focus();
      }
      // For Tab, let default behavior work (unless last word)
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Move to signature
      signatureRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Trim empty words from the end
    const trimmedWords = [...formData.textWords];
    while (trimmedWords.length > 0 && trimmedWords[trimmedWords.length - 1] === '') {
      trimmedWords.pop();
    }
    const radiogram: Radiogram = {
      ...formData,
      textWords: trimmedWords,
      id: existingRadiogram?.id || generateId(),
    };
    onSave(radiogram);
    onClose();
  };

  const handleDelete = () => {
    if (existingRadiogram && onDelete) {
      onDelete(existingRadiogram.id);
      onClose();
    }
  };

  const handleCopy = async () => {
    const trimmedWords = [...formData.textWords];
    while (trimmedWords.length > 0 && trimmedWords[trimmedWords.length - 1] === '') {
      trimmedWords.pop();
    }
    const radiogram: Radiogram = {
      ...formData,
      textWords: trimmedWords,
      id: existingRadiogram?.id || '',
    };
    await navigator.clipboard.writeText(formatRadiogramAsText(radiogram));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = async () => {
    const trimmedWords = [...formData.textWords];
    while (trimmedWords.length > 0 && trimmedWords[trimmedWords.length - 1] === '') {
      trimmedWords.pop();
    }
    const radiogram: Radiogram = {
      ...formData,
      textWords: trimmedWords,
      id: existingRadiogram?.id || '',
    };
    await printRadiogram(radiogram, userProfile);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Render word grid
  const renderWordGrid = () => {
    const rows = [];
    for (let line = 0; line < numLines; line++) {
      const cols = [];
      for (let col = 0; col < WORDS_PER_LINE; col++) {
        const index = line * WORDS_PER_LINE + col;
        cols.push(
          <div key={index} className="relative">
            <span className="absolute top-0 left-0.5 text-[10px] text-slate-400 leading-none">
              {index + 1}
            </span>
            <input
              type="text"
              value={formData.textWords[index] || ''}
              onChange={(e) => handleWordChange(index, e.target.value, e.target)}
              onKeyDown={(e) => handleWordKeyDown(index, e)}
              ref={(el) => { wordInputRefs.current[index] = el; }}
              className="w-full px-2 pt-3 pb-1 border border-slate-300 rounded text-sm uppercase"
            />
          </div>
        );
      }
      rows.push(
        <div key={line} className="grid grid-cols-5 gap-2">
          {cols}
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-4 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            {existingRadiogram ? 'Edit Radiogram' : 'New Radiogram'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-xl px-2"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Net Name */}
          <div className="border-b pb-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Net Name</label>
            <input
              type="text"
              name="netName"
              value={formData.netName || ''}
              onChange={handleChange}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
            />
          </div>

          {/* Preamble Section */}
          <div className="border-b pb-3">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Number
                </label>
                <input
                  type="text"
                  name="number"
                  value={formData.number}
                  onChange={handleChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Precedence
                </label>
                <input
                  type="text"
                  name="precedence"
                  value={formData.precedence}
                  onChange={handleChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  HX
                </label>
                <input
                  type="text"
                  name="handlingInstructions"
                  value={formData.handlingInstructions}
                  onChange={handleChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Station of Origin
                </label>
                <input
                  type="text"
                  name="stationOfOrigin"
                  value={formData.stationOfOrigin}
                  onChange={handleChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Check
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    name="check"
                    value={formData.check}
                    onChange={handleChange}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                    required
                  />
                  {formData.check && (
                    <>
                      <span className={`text-xl italic leading-none select-none ml-1 ${wordCount === parseCheck(formData.check) ? 'text-green-600' : 'hidden'}`}>✓</span>
                      <span className={`text-xl italic leading-none select-none ml-1 ${wordCount !== parseCheck(formData.check) ? 'text-red-600' : 'hidden'}`}>✗</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3 mt-2">
              <div className="col-span-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Place of Origin
                </label>
                <input
                  type="text"
                  name="placeOfOrigin"
                  value={formData.placeOfOrigin}
                  onChange={handleChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Time
                </label>
                <input
                  type="text"
                  name="timeFiled"
                  value={formData.timeFiled}
                  onChange={handleChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                />
              </div>
              <div className="col-span-6">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Date
                </label>
                <input
                  type="text"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                  required
                />
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div className="border-b pb-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-1">Addressee</h3>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input
                    type="text"
                    name="addressPhone"
                    value={formData.addressPhone || ''}
                    onChange={handleChange}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="e.g., 555-867-5309"
                  />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Op Note</h3>
                <textarea
                  name="addressOpNote"
                  value={formData.addressOpNote}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                />
              </div>
            </div>
          </div>

          {/* Text Section */}
          <div className="border-b pb-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Text</h3>
            <div className="space-y-2">
              {renderWordGrid()}
            </div>
            <p className={`text-xs mt-2 ${formData.check && wordCount !== parseCheck(formData.check) ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
              Word count: {wordCount}
              {formData.check && wordCount !== parseCheck(formData.check) && ' (does not match check)'}
            </p>
          </div>

          {/* Signature Section */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Signature</h3>
                <textarea
                  ref={signatureRef}
                  name="signature"
                  value={formData.signature}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                  required
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Op Note</h3>
                <textarea
                  name="signatureOpNote"
                  value={formData.signatureOpNote}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                />
              </div>
            </div>
          </div>

          {/* Received Section */}
          <div className="border-t pt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Received</h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
                <select
                  value={formData.receivedMethod || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, receivedMethod: e.target.value }))}
                  className="w-full px-2 border border-slate-300 rounded text-sm h-[30px]"
                >
                  <option value=""></option>
                  {rcvdMethods.map((m) => (
                    <option key={m} value={m.toUpperCase()}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
                <input
                  type="text"
                  name="receivedDestination"
                  value={formData.receivedDestination || ''}
                  onChange={handleChange}
                  className="w-full px-2 border border-slate-300 rounded text-sm uppercase h-[30px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.receivedDate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, receivedDate: e.target.value }))}
                  className="w-full px-2 border border-slate-300 rounded text-sm h-[30px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                <input
                  type="time"
                  value={formData.receivedTime || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, receivedTime: e.target.value }))}
                  className="w-full px-2 border border-slate-300 rounded text-sm h-[30px]"
                />
              </div>
            </div>
          </div>

          {/* Sent Section */}
          <div className="border-t pt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Sent</h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
                <select
                  value={formData.dispositionMethod || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, dispositionMethod: e.target.value }))}
                  className="w-full px-2 border border-slate-300 rounded text-sm h-[30px]"
                >
                  <option value=""></option>
                  {sentMethods.map((m) => (
                    <option key={m} value={m.toUpperCase()}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
                <input
                  type="text"
                  name="dispositionDestination"
                  value={formData.dispositionDestination || ''}
                  onChange={handleChange}
                  className="w-full px-2 border border-slate-300 rounded text-sm uppercase h-[30px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.dispositionDate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, dispositionDate: e.target.value }))}
                  className="w-full px-2 border border-slate-300 rounded text-sm h-[30px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                <input
                  type="time"
                  value={formData.dispositionTime || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, dispositionTime: e.target.value }))}
                  className="w-full px-2 border border-slate-300 rounded text-sm h-[30px]"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-between pt-3">
            <div>
              {existingRadiogram && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 text-sm"
              >
                Print
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 text-sm"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-300 text-slate-700 py-2 px-4 rounded-md hover:bg-slate-400 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 text-sm"
              >
                OK
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
