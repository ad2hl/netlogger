'use client';

import React, { useState } from 'react';
import { Radiogram } from '@/types';
import RadiogramForm from './RadiogramForm';

interface RadiogramListProps {
  radiograms: Radiogram[];
  onSave: (radiogram: Radiogram) => void;
  onDelete: (id: string) => void;
  dispositionMethods?: string[];
}

export default function RadiogramList({
  radiograms,
  onSave,
  onDelete,
  dispositionMethods,
}: RadiogramListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRadiogram, setEditingRadiogram] = useState<Radiogram | null>(null);

  const handleNewRadiogram = () => {
    setEditingRadiogram(null);
    setIsFormOpen(true);
  };

  const handleEditRadiogram = (radiogram: Radiogram) => {
    setEditingRadiogram(radiogram);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditingRadiogram(null);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-3">Radiograms</h2>

      <button
        onClick={handleNewRadiogram}
        className="w-full bg-indigo-700 text-white py-2 px-4 rounded-md hover:bg-indigo-800 text-sm mb-3"
      >
        New Radiogram
      </button>

      {radiograms.length > 0 && (
        <div className="space-y-1">
          {radiograms.map((radiogram) => (
            <button
              key={radiogram.id}
              onClick={() => handleEditRadiogram(radiogram)}
              className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded text-sm flex items-center gap-2"
            >
              <span className="font-mono font-semibold text-slate-700 flex-shrink-0">
                {radiogram.number}
              </span>
              <span className="font-mono text-slate-600 flex-shrink-0">
                {radiogram.stationOfOrigin}
              </span>
              <span className="font-mono text-slate-600 truncate">
                {radiogram.address.split('\n')[0]}
              </span>
            </button>
          ))}
        </div>
      )}

      <RadiogramForm
        isOpen={isFormOpen}
        onClose={handleClose}
        onSave={onSave}
        onDelete={onDelete}
        existingRadiogram={editingRadiogram}
        dispositionMethods={dispositionMethods}
      />
    </div>
  );
}
