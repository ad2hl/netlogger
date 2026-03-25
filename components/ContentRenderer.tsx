'use client';

import ReactMarkdown from 'react-markdown';

interface Props {
  content: string;
  type: 'html' | 'md';
}

export default function ContentRenderer({ content, type }: Props) {
  if (type === 'html') {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }
  return <ReactMarkdown>{content}</ReactMarkdown>;
}
