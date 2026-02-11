'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface PrivacyPolicySummaryProps {
  content: string;
  fullPolicyContent?: string;
  onClose: () => void;
}

export default function PrivacyPolicySummary({ content, fullPolicyContent, onClose }: PrivacyPolicySummaryProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showFullPolicy, setShowFullPolicy] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div className={`bg-white rounded-lg shadow-xl w-full max-h-[80vh] flex flex-col ${showFullPolicy ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-900">
            {showFullPolicy ? 'Privacy Policy' : 'Privacy Policy Summary'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto prose prose-sm max-w-none">
          <ReactMarkdown>{showFullPolicy ? fullPolicyContent! : content}</ReactMarkdown>
          {showFullPolicy ? (
            <button
              onClick={() => setShowFullPolicy(false)}
              className="mt-4 text-indigo-700 hover:text-indigo-800 text-sm font-medium"
            >
              &larr; Back to Summary
            </button>
          ) : fullPolicyContent ? (
            <button
              onClick={() => setShowFullPolicy(true)}
              className="mt-4 text-indigo-700 hover:text-indigo-800 text-sm font-medium"
            >
              View Full Privacy Policy &rarr;
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
