'use client';

import { useEffect, useState } from 'react';
import ContentRenderer from '@/components/ContentRenderer';
import { apiFetch } from '@/lib/api-fetch';

export default function HeaderBanner() {
  const [banner, setBanner] = useState<{ content: string; type: 'html' | 'md' } | null>(null);

  useEffect(() => {
    apiFetch('/api/header-message')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.content) setBanner({ content: data.content.trim(), type: data.type ?? 'md' });
      })
      .catch(() => {});
  }, []);

  if (!banner) return null;

  return (
    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 inline-flex items-center [&_p]:m-0 translate-y-px">
      <ContentRenderer content={banner.content} type={banner.type} />
    </span>
  );
}
