'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BookEntry, Radiogram, UserProfile, DEFAULT_DISPOSITION_METHODS, DEFAULT_RECEIVED_METHODS } from '@/types';
import { explodeBook, formatRadiogramAsText, generateRadiogramId, isBookEntryEmpty, parseDtnRadiogram } from '@/lib/radiogram';
import { printRadiogram } from '@/lib/radiogramPrint';
import { printRadiogramReadable } from '@/lib/radiogramPrintReadable';

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
  onAssignNumber?: () => Promise<string>;
  onAssignNumbers?: (count: number) => Promise<string[]>;
  onSplit?: (book: Radiogram, splitRadiograms: Radiogram[]) => Promise<void>;
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

function trimTrailingEmpty(words: string[]): string[] {
  const result = [...words];
  while (result.length > 0 && result[result.length - 1] === '') result.pop();
  return result;
}

const MAX_BOOK_ENTRIES = 99;

function createEmptyBookEntry(): BookEntry {
  return { number: '', address: '', addressOpNote: '', otherVariables: '' };
}

// Grow by appending empty entries; shrink only by removing trailing empty ones
function resizeBookEntries(entries: BookEntry[], count: number): BookEntry[] {
  if (!Number.isInteger(count) || count < 0) return entries;
  const target = Math.min(count, MAX_BOOK_ENTRIES);
  const result = [...entries];
  while (result.length < target) result.push(createEmptyBookEntry());
  while (result.length > target && isBookEntryEmpty(result[result.length - 1])) result.pop();
  return result;
}

function trimTrailingEmptyEntries(entries: BookEntry[]): BookEntry[] {
  const result = [...entries];
  while (result.length > 0 && isBookEntryEmpty(result[result.length - 1])) result.pop();
  return result;
}

// Fields that allow spaces
const FIELDS_WITH_SPACES = ['placeOfOrigin', 'timeFiled', 'date', 'address', 'addressOpNote', 'signature', 'signatureOpNote', 'receivedDestination', 'dispositionDestination'];

const WORDS_PER_LINE = 5;
const INITIAL_LINES = 5;

// Parse the CHECK field value: handles plain numbers and ARLnn (e.g. "ARL5")
function parseCheck(check: string): number {
  const correctedMatch = check.match(/^\d+\/(\d+)$/);
  if (correctedMatch) return parseInt(correctedMatch[1], 10);
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
  onAssignNumber,
  onAssignNumbers,
  onSplit,
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
    isBook: false,
    bookEntries: [],
    bookVariable: '',
  };

  const [formData, setFormData] = useState<Omit<Radiogram, 'id'>>(emptyForm);
  const [copied, setCopied] = useState(false);
  const [showCountWarning, setShowCountWarning] = useState(false);
  const [showBookCountWarning, setShowBookCountWarning] = useState(false);
  const [showSplitConfirm, setShowSplitConfirm] = useState(false);
  const [expandedVariables, setExpandedVariables] = useState<Set<number>>(new Set());
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
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
      setFormData({
        ...rest,
        textWords,
        // Legacy radiograms stored the phone separately; fold it into the address
        // as an additional line (the separate field was removed — issue #258)
        address: rest.addressPhone
          ? [rest.address, rest.addressPhone].filter(Boolean).join('\n')
          : rest.address,
        addressPhone: '',
        isBook: rest.isBook ?? false,
        bookEntries: rest.bookEntries ?? [],
        bookVariable: rest.bookVariable ?? '',
      });
    } else {
      setFormData({ ...emptyForm, netName: netName || '' });
    }
    setExpandedVariables(new Set());
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
    const allowsSpaces = FIELDS_WITH_SPACES.includes(name);

    let filtered: string;
    if (isTextarea && allowsSpaces) {
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
      if (isTextarea && allowsSpaces) {
        adjustedCursor = filterRadiogramCharsWithSpacesAndNewlines(beforeCursor).length;
      } else if (allowsSpaces) {
        adjustedCursor = filterRadiogramCharsWithSpaces(beforeCursor).length;
      } else {
        adjustedCursor = filterRadiogramChars(beforeCursor).length;
      }
    }

    setFormData(prev => {
      const next = { ...prev, [name]: filtered };
      // In book mode the Number field holds the message count and drives the entry rows
      if (name === 'number' && prev.isBook) {
        next.bookEntries = resizeBookEntries(prev.bookEntries ?? [], parseInt(filtered, 10));
      }
      return next;
    });

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

  const buildRadiogram = (id: string): Radiogram => ({
    ...formData,
    textWords: trimTrailingEmpty(formData.textWords),
    isBook: !!formData.isBook,
    bookEntries: formData.isBook ? trimTrailingEmptyEntries(formData.bookEntries ?? []) : [],
    bookVariable: formData.bookVariable || '',
    id,
  });

  const doSave = () => {
    onSave(buildRadiogram(existingRadiogram?.id || generateRadiogramId()));
    onClose();
  };

  const bookEntryCount = (formData.bookEntries ?? []).filter(e => !isBookEntryEmpty(e)).length;
  const bookCountMismatch = !!formData.isBook && parseInt(formData.number, 10) !== bookEntryCount;

  const continueAfterCheckWarning = () => {
    if (bookCountMismatch) {
      setShowBookCountWarning(true);
      return;
    }
    doSave();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.check && wordCount !== parseCheck(formData.check)) {
      setShowCountWarning(true);
      return;
    }
    continueAfterCheckWarning();
  };

  const handleDelete = () => {
    if (existingRadiogram && onDelete) {
      onDelete(existingRadiogram.id);
      onClose();
    }
  };

  const buildCurrentRadiogram = (): Radiogram => buildRadiogram(existingRadiogram?.id || '');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatRadiogramAsText(buildCurrentRadiogram()));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = async () => {
    await printRadiogram(buildCurrentRadiogram(), userProfile);
  };

  const handlePrintPlain = async () => {
    await printRadiogramReadable(buildCurrentRadiogram(), userProfile);
  };

  const isFormEmpty = () =>
    !formData.number && !formData.precedence && !formData.stationOfOrigin &&
    !formData.check && !formData.placeOfOrigin && !formData.date &&
    !formData.address && !formData.signature &&
    formData.textWords.every(w => !w) &&
    (formData.bookEntries ?? []).every(isBookEntryEmpty);

  const handleImportConfirm = () => {
    try {
      const parsed = parseDtnRadiogram(importText);
      const minWords = INITIAL_LINES * WORDS_PER_LINE;
      const textWords = [...(parsed.textWords ?? [])];
      while (textWords.length < minWords) textWords.push('');
      setFormData(prev => ({
        ...emptyForm,
        netName: prev.netName,
        ...parsed,
        textWords,
      }));
      setShowImportDialog(false);
      setImportText('');
      setImportError('');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Failed to parse radiogram.');
    }
  };

  const handleAssignNumber = async () => {
    if (!onAssignNumber) return;
    const num = await onAssignNumber();
    if (num) setFormData(prev => ({ ...prev, number: num }));
  };

  const handleBookToggle = (checked: boolean) => {
    setFormData(prev => {
      const next = { ...prev, isBook: checked };
      if (checked) {
        next.bookEntries = resizeBookEntries(prev.bookEntries ?? [], parseInt(prev.number, 10));
      }
      return next;
    });
  };

  const handleEntryChange = (
    index: number,
    field: keyof BookEntry,
    value: string,
    el: HTMLInputElement | HTMLTextAreaElement
  ) => {
    const filter =
      field === 'address' ? filterRadiogramCharsWithSpacesAndNewlines :
      field === 'addressOpNote' ? filterRadiogramCharsWithSpaces :
      field === 'number' ? filterRadiogramChars :
      (v: string) => v; // otherVariables: verbatim, unfiltered
    const cursorPos = el.selectionStart;
    const filtered = filter(value);
    const adjustedCursor = cursorPos !== null ? filter(value.slice(0, cursorPos)).length : null;

    setFormData(prev => {
      const entries = [...(prev.bookEntries ?? [])];
      entries[index] = { ...entries[index], [field]: filtered };
      return { ...prev, bookEntries: entries };
    });

    requestAnimationFrame(() => {
      if (adjustedCursor !== null) {
        el.setSelectionRange(adjustedCursor, adjustedCursor);
      }
    });
  };

  const handleAddEntry = () => {
    setFormData(prev => {
      const entries = [...(prev.bookEntries ?? []), createEmptyBookEntry()];
      return { ...prev, bookEntries: entries, number: String(entries.length) };
    });
  };

  const handleRemoveEntry = (index: number) => {
    setFormData(prev => {
      const entries = (prev.bookEntries ?? []).filter((_, i) => i !== index);
      return { ...prev, bookEntries: entries, number: String(entries.length) };
    });
    setExpandedVariables(new Set());
  };

  const entriesNeedingNumbers = (formData.bookEntries ?? []).filter(
    e => e.number.trim() === '' || e.number.toUpperCase() === 'XXX'
  ).length;

  const handleAssignEntryNumbers = async () => {
    if (!onAssignNumbers) return;
    const entries = formData.bookEntries ?? [];
    const targets = entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.number.trim() === '' || e.number.toUpperCase() === 'XXX')
      .map(({ i }) => i);
    if (targets.length === 0) return;
    const nums = await onAssignNumbers(targets.length);
    setFormData(prev => {
      const updated = [...(prev.bookEntries ?? [])];
      targets.forEach((idx, j) => {
        if (nums[j] && updated[idx]) updated[idx] = { ...updated[idx], number: nums[j] };
      });
      return { ...prev, bookEntries: updated };
    });
  };

  // In book mode, Assign Next fills the entries' numbers sequentially (N, N+1, ...)
  const assignBtnDisabled = formData.isBook
    ? (!onAssignNumbers || entriesNeedingNumbers === 0)
    : (!onAssignNumber ||
       (formData.number.trim() !== '' && formData.number.toUpperCase() !== 'XXX'));

  const handleSplitConfirm = async () => {
    if (!existingRadiogram || !onSplit) return;
    const book = buildRadiogram(existingRadiogram.id);
    await onSplit(book, explodeBook(book));
    setShowSplitConfirm(false);
    onClose();
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

  // Render the per-message variable parts of a book
  const renderBookEntries = () => (
    (formData.bookEntries ?? []).map((entry, i) => {
      const showVariables = !!entry.otherVariables || expandedVariables.has(i);
      return (
        <div key={i} className="border border-slate-200 rounded p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">Message {i + 1}</span>
            <button
              type="button"
              onClick={() => handleRemoveEntry(i)}
              className="text-slate-400 hover:text-red-600 text-lg leading-none px-1"
              title="Remove message"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Number</label>
                <input
                  type="text"
                  value={entry.number}
                  onChange={(e) => handleEntryChange(i, 'number', e.target.value, e.target)}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Op Note</label>
                <input
                  type="text"
                  value={entry.addressOpNote}
                  onChange={(e) => handleEntryChange(i, 'addressOpNote', e.target.value, e.target)}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Addressee</label>
              <textarea
                value={entry.address}
                onChange={(e) => handleEntryChange(i, 'address', e.target.value, e.target)}
                rows={4}
                className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
              />
            </div>
          </div>
          {showVariables ? (
            <div className="mt-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Other variable parts (non-standard) — transcribe verbatim
              </label>
              <textarea
                value={entry.otherVariables || ''}
                onChange={(e) => handleEntryChange(i, 'otherVariables', e.target.value, e.target)}
                rows={2}
                className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-mono"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpandedVariables(prev => new Set(prev).add(i))}
              className="text-xs text-slate-500 underline mt-1"
            >
              + Other variable parts (non-standard)
            </button>
          )}
        </div>
      );
    })
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-4 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            {formData.isBook
              ? (existingRadiogram ? 'Edit Book' : 'New Book')
              : (existingRadiogram ? 'Edit Radiogram' : 'New Radiogram')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImportDialog(true)}
              className="text-sm bg-slate-100 text-slate-700 px-3 py-1 rounded hover:bg-slate-200"
            >
              Import
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 text-xl px-2"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Net Name - only shown when in a net session */}
          {netName !== undefined && (
            <div className="border-b pb-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Net Name</label>
              <div className="w-full px-2 py-1 border border-slate-200 rounded text-sm uppercase bg-slate-50 text-slate-700">
                {formData.netName || '\u00A0'}
              </div>
            </div>
          )}

          {/* Unresolved book variable parts (on a radiogram split out of a book) */}
          {!formData.isBook && formData.bookVariable && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">Unresolved variable parts from book — incorporate into the fields below, then clear:</p>
                  <pre className="whitespace-pre-wrap font-mono text-xs mt-1">{formData.bookVariable}</pre>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, bookVariable: '' }))}
                  className="shrink-0 text-xs font-medium bg-amber-700 text-white px-2 py-1 rounded hover:bg-amber-900"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Preamble Section */}
          <div className="border-b pb-3">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">
                    {formData.isBook ? 'Book of' : 'Number'}
                  </label>
                  <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!formData.isBook}
                      onChange={(e) => handleBookToggle(e.target.checked)}
                    />
                    Book
                  </label>
                </div>
                <input
                  type="text"
                  name="number"
                  value={formData.number}
                  onChange={handleChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                  required
                />
              </div>
              <div className="col-span-2 flex flex-col justify-end">
                <button
                  type="button"
                  onClick={formData.isBook ? handleAssignEntryNumbers : handleAssignNumber}
                  disabled={assignBtnDisabled}
                  className="w-full px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Assign Next
                </button>
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
              <div className="col-span-2">
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

          {/* Address Section — per-message in book mode */}
          {!formData.isBook && (
          <div className="border-b pb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Addressee</h3>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm uppercase"
                  required
                />
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
          )}

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

          {/* Book Messages Section — the variable parts of each message in the book */}
          {formData.isBook && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  Book Messages
                  {bookCountMismatch && (
                    <span className="ml-2 text-xs font-normal text-red-600">
                      ({bookEntryCount} entered, book of {formData.number || '?'})
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={handleAddEntry}
                  className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300 rounded hover:bg-slate-200"
                >
                  + Add Message
                </button>
              </div>
              <div className="space-y-2">
                {renderBookEntries()}
                {(formData.bookEntries ?? []).length === 0 && (
                  <p className="text-xs text-slate-500">
                    Enter the number of messages in the &quot;Book of&quot; field above, or click + Add Message.
                  </p>
                )}
              </div>
            </div>
          )}

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
            <div className="flex gap-2">
              {existingRadiogram && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
              )}
              {existingRadiogram?.isBook && formData.isBook && onSplit && (
                <button
                  type="button"
                  onClick={() => setShowSplitConfirm(true)}
                  disabled={bookEntryCount === 0}
                  className="bg-amber-700 text-white py-2 px-4 rounded-md hover:bg-amber-900 text-sm disabled:opacity-50"
                >
                  Split into Messages
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {!formData.isBook && (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 text-sm"
                >
                  Print
                </button>
              )}
              <button
                type="button"
                onClick={handlePrintPlain}
                className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 text-sm"
              >
                Plain
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

      {showImportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Import DTN Radiogram</h3>
            {!isFormEmpty() && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                Importing will clear the current form contents.
              </p>
            )}
            <textarea
              value={importText}
              onChange={e => { setImportText(e.target.value); setImportError(''); }}
              rows={10}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-mono"
              placeholder="Paste raw DTN radiogram here..."
              autoFocus
            />
            {importError && (
              <p className="text-sm text-red-600 mt-2">{importError}</p>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => { setShowImportDialog(false); setImportText(''); setImportError(''); }}
                className="bg-slate-300 text-slate-700 py-2 px-4 rounded-md hover:bg-slate-400 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportConfirm}
                disabled={!importText.trim()}
                className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 text-sm disabled:opacity-50"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {showCountWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Word Count Mismatch</h3>
            <p className="text-sm text-slate-700 mb-4">
              The actual word count ({wordCount}) does not match the check field ({formData.check}). Do you want to go back and fix it, or save the radiogram as-is?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCountWarning(false)}
                className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 text-sm"
              >
                Go Back
              </button>
              <button
                onClick={() => { setShowCountWarning(false); continueAfterCheckWarning(); }}
                className="bg-slate-300 text-slate-700 py-2 px-4 rounded-md hover:bg-slate-400 text-sm"
              >
                Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {showBookCountWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Book Count Mismatch</h3>
            <p className="text-sm text-slate-700 mb-4">
              The book count ({formData.number || '?'}) does not match the number of messages entered ({bookEntryCount}). Do you want to go back and fix it, or save the book as-is?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBookCountWarning(false)}
                className="bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 text-sm"
              >
                Go Back
              </button>
              <button
                onClick={() => { setShowBookCountWarning(false); doSave(); }}
                className="bg-slate-300 text-slate-700 py-2 px-4 rounded-md hover:bg-slate-400 text-sm"
              >
                Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {showSplitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Split Book</h3>
            <p className="text-sm text-slate-700 mb-2">
              This will create {bookEntryCount} individual radiogram{bookEntryCount === 1 ? '' : 's'} and delete the book. This cannot be undone.
            </p>
            {(formData.bookEntries ?? []).some(e => !isBookEntryEmpty(e) && !e.number.trim()) && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                Some messages are missing a number.
              </p>
            )}
            {bookCountMismatch && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                The book count ({formData.number || '?'}) does not match the number of messages entered ({bookEntryCount}).
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowSplitConfirm(false)}
                className="bg-slate-300 text-slate-700 py-2 px-4 rounded-md hover:bg-slate-400 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSplitConfirm}
                className="bg-amber-700 text-white py-2 px-4 rounded-md hover:bg-amber-900 text-sm"
              >
                Split
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
