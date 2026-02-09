'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import PrivacyPolicySummary from './PrivacyPolicySummary';

export default function Footer() {
  const [aboutContent, setAboutContent] = useState<string | null>(null);
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const [fullPolicyContent, setFullPolicyContent] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    fetch('/api/about')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setAboutContent(data.content); })
      .catch(() => {});
    fetch('/api/privacy-policy-summary')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setSummaryContent(data.content); })
      .catch(() => {});
    fetch('/api/privacy-policy')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setFullPolicyContent(data.content); })
      .catch(() => {});
  }, []);

  return (
    <>
      <footer className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-4 text-sm">
          <span className="text-gray-600">
            Created and maintained by{' '}
            <a
              href="https://www.qrz.com/db/AD2HL"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              AD2HL
            </a>
          </span>
          {aboutContent && (
            <button
              onClick={() => setShowAbout(true)}
              className="text-blue-600 hover:text-blue-800"
            >
              About this website
            </button>
          )}
          {summaryContent && (
            <button
              onClick={() => setShowPrivacy(true)}
              className="text-blue-600 hover:text-blue-800"
            >
              Privacy Policy
            </button>
          )}
        </div>
      </footer>

      {showAbout && aboutContent && (
        <AboutModal content={aboutContent} onClose={() => setShowAbout(false)} />
      )}
      {showPrivacy && summaryContent && (
        <PrivacyPolicySummary
          content={summaryContent}
          fullPolicyContent={fullPolicyContent ?? undefined}
          onClose={() => setShowPrivacy(false)}
        />
      )}
    </>
  );
}

function AboutModal({ content, onClose }: { content: string; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">About this website</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto prose prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
