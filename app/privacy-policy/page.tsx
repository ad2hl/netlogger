import { readContentWithType } from '@/lib/content';
import ReactMarkdown from 'react-markdown';

export const metadata = {
  title: 'Privacy Policy',
};

export default async function PrivacyPolicyPage() {
  const result = await readContentWithType('privacy-policy');

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {result === null ? (
        <p className="text-slate-500">Privacy policy not available.</p>
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
