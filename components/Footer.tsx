'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import ContentRenderer from '@/components/ContentRenderer';
import { apiFetch } from '@/lib/api-fetch';

type TypedContent = { content: string; type: 'html' | 'md' };

export default function Footer() {
  const [aboutContent, setAboutContent] = useState<TypedContent | null>(null);
  const [summaryContent, setSummaryContent] = useState<TypedContent | null>(null);
  const [footerCredit, setFooterCredit] = useState<TypedContent | null>(null);
  const [localModalContent, setLocalModalContent] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    apiFetch('/api/about')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setAboutContent({ content: data.content, type: data.type ?? 'md' }); })
      .catch(() => {});
    apiFetch('/api/privacy-policy-summary')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setSummaryContent({ content: data.content, type: data.type ?? 'md' }); })
      .catch(() => {});
    apiFetch('/api/footer-credit')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.content) setFooterCredit({ content: data.content, type: data.type ?? 'md' }); })
      .catch(() => {});
  }, []);

  return (
    <>
      <footer className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-4 text-sm">
          {footerCredit && (
            <span className="text-slate-600">
              {footerCredit.type === 'html' ? (
                <div dangerouslySetInnerHTML={{ __html: footerCredit.content }} />
              ) : (
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
                  {footerCredit.content}
                </ReactMarkdown>
              )}
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
            <a
              href="/privacy-policy"
              className="text-cyan-700 hover:text-cyan-900"
            >
              Privacy Policy
            </a>
          )}
        </div>
      </footer>

      {localModalContent && (
        <AboutModal content={localModalContent} type="md" onClose={() => setLocalModalContent(null)} />
      )}
      {showAbout && aboutContent && (
        <AboutModal content={aboutContent.content} type={aboutContent.type} onClose={() => setShowAbout(false)} />
      )}
    </>
  );
}

function AboutModal({ content, type, onClose }: { content: string; type: 'html' | 'md'; onClose: () => void }) {
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
          <ContentRenderer content={content} type={type} />
        </div>
      </div>
    </div>
  );
}
