import { readContentWithType } from '@/lib/content';
import ReactMarkdown from 'react-markdown';

export const metadata = {
  title: 'Terms of Service',
};

export default async function TermsOfServicePage() {
  const result = await readContentWithType('terms-of-service');

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {result === null ? (
        <p className="text-slate-500">Terms of service not available.</p>
      ) : result.type === 'html' ? (
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: result.content }}
        />
      ) : (
        <div className="prose prose-slate max-w-none">
          <ReactMarkdown>{result.content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
