'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';

interface Props {
  content: string;
  type: 'html' | 'md';
  // Enables GFM (tables etc.) and a table of contents under a "Contents" or
  // "Table of Contents" heading, with heading anchors for its links.
  toc?: boolean;
}

export default function ContentRenderer({ content, type, toc = false }: Props) {
  if (type === 'html') {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }
  if (toc) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkToc]} rehypePlugins={[rehypeSlug]}>
        {content}
      </ReactMarkdown>
    );
  }
  return <ReactMarkdown>{content}</ReactMarkdown>;
}
