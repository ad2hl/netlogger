'use client';

import { useEffect, useRef, useState } from 'react';
import ContentRenderer from '@/components/ContentRenderer';

interface PrivacyPolicySummaryProps {
  content: string;
  contentType?: 'html' | 'md';
  fullPolicyContent?: string;
  fullPolicyType?: 'html' | 'md';
  onClose: () => void;
}

export default function PrivacyPolicySummary({ content, contentType = 'md', fullPolicyContent, fullPolicyType = 'md', onClose }: PrivacyPolicySummaryProps) {
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
      <div className={`bg-white rounded-lg shadow-xl w-full max-h-[80vh] flex flex-col relative ${showFullPolicy ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <button
          onClick={onClose}
          className="absolute top-2 right-4 text-slate-400 hover:text-slate-600 text-2xl leading-none z-10"
          aria-label="Close"
        >
          &times;
        </button>
        <div className="px-6 pt-4 pb-4 overflow-y-auto prose prose-sm max-w-none">
          {showFullPolicy && fullPolicyContent ? (
            <ContentRenderer content={fullPolicyContent} type={fullPolicyType} />
          ) : (
            <ContentRenderer content={content} type={contentType} />
          )}
          {showFullPolicy ? (
            <button
              onClick={() => setShowFullPolicy(false)}
              className="mt-4 text-cyan-700 hover:text-cyan-900 text-sm font-medium"
            >
              &larr; Back to Summary
            </button>
          ) : fullPolicyContent ? (
            <button
              onClick={() => setShowFullPolicy(true)}
              className="mt-4 text-cyan-700 hover:text-cyan-900 text-sm font-medium"
            >
              View Full Privacy Policy &rarr;
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
