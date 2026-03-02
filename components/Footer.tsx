'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import PrivacyPolicySummary from './PrivacyPolicySummary';
import { apiFetch } from '@/lib/api-fetch';

export default function Footer() {
  const [aboutContent, setAboutContent] = useState<string | null>(null);
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const [fullPolicyContent, setFullPolicyContent] = useState<string | null>(null);
  const [footerCredit, setFooterCredit] = useState<string | null>(null);
  const [localModalContent, setLocalModalContent] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    apiFetch('/api/about')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setAboutContent(data.content); })
      .catch(() => {});
    apiFetch('/api/privacy-policy-summary')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setSummaryContent(data.content); })
      .catch(() => {});
    apiFetch('/api/privacy-policy')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setFullPolicyContent(data.content); })
      .catch(() => {});
    apiFetch('/api/footer-credit')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setFooterCredit(data.content); })
      .catch(() => {});
  }, []);

  return (
    <>
      <footer className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-4 text-sm">
          {footerCredit && (
            <span className="text-slate-600">
              <ReactMarkdown
                urlTransform={(url) => url}
                components={{
                  p: ({ children }) => <>{children}</>,
                  a: ({ href, children }) => {
                    if (href?.startsWith('local:')) {
                      const file = href.slice('local:'.length);
                      return (
                        <button
                          onClick={() => {
                            apiFetch(`/api/local-content?file=${encodeURIComponent(file)}`)
                              .then(res => res.ok ? res.json() : null)
                              .then(data => { if (data?.content) setLocalModalContent(data.content); })
                              .catch(() => {});
                          }}
                          className="text-cyan-700 hover:text-cyan-900 underline"
                        >
                          {children}
                        </button>
                      );
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-900">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {footerCredit}
              </ReactMarkdown>
            </span>
          )}
          {aboutContent && (
            <button
              onClick={() => setShowAbout(true)}
              className="text-cyan-700 hover:text-cyan-900"
            >
              About this website
            </button>
          )}
          {summaryContent && (
            <button
              onClick={() => setShowPrivacy(true)}
              className="text-cyan-700 hover:text-cyan-900"
            >
              Privacy Policy
            </button>
          )}
        </div>
      </footer>

      {localModalContent && (
        <AboutModal content={localModalContent} onClose={() => setLocalModalContent(null)} />
      )}
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-4 text-slate-400 hover:text-slate-600 text-2xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
        <div className="px-6 pt-4 pb-4 overflow-y-auto prose prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
