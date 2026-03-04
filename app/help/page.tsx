'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

export default function HelpPageWrapper() {
  return (
    <Suspense fallback={null}>
      <HelpPage />
    </Suspense>
  );
}

function HelpPage() {
  const searchParams = useSearchParams();
  const page = searchParams.get('page');
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!page) {
      setError(true);
      return;
    }
    fetch(`/api/help?page=${encodeURIComponent(page)}`)
      .then((res) => {
        if (!res.ok) { setError(true); return null; }
        return res.json();
      })
      .then((data) => {
        if (data?.content) setContent(data.content);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [page]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {error ? (
        <p className="text-slate-500">Help content not available.</p>
      ) : content === null ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <div className="prose prose-slate prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
