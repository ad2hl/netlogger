import { NextRequest, NextResponse } from 'next/server';
import { readContent } from '@/lib/content';
import { verifyAppCheck } from '@/lib/appcheck-api';

export async function GET(request: NextRequest) {
  const appCheckResult = await verifyAppCheck(request);
  if (appCheckResult !== true) return appCheckResult;

  const file = request.nextUrl.searchParams.get('file') ?? '';

  // Only allow plain .md filenames — no path separators or traversal
  if (!file.endsWith('.md') || file.includes('/') || file.includes('\\') || file.includes('..')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const content = await readContent(file);
  if (content === null) {
    return NextResponse.json({ content: null }, { status: 404 });
  }
  return NextResponse.json({ content });
}
