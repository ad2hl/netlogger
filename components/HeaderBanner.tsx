'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export default function HeaderBanner() {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/header-message')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.content) setContent(data.content.trim());
      })
      .catch(() => {});
  }, []);

  if (!content) return null;

  return (
    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 inline-flex items-center [&_p]:m-0">
      <ReactMarkdown>{content}</ReactMarkdown>
    </span>
  );
}
