import { NextRequest, NextResponse } from 'next/server';
import { readContent } from '@/lib/content';

const PAGE_FILES: Record<string, string> = {
  net: 'help-net.md',
  overview: 'help-overview.md',
  sessions: 'help-sessions.md',
  radiograms: 'help-radiograms.md',
  settings: 'help-settings.md',
};

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get('page');
  const filename = page ? PAGE_FILES[page] : undefined;
  if (!filename) {
    return NextResponse.json({ error: 'Unknown page' }, { status: 400 });
  }

  const content = await readContent(filename);
  if (content === null) {
    return NextResponse.json({ content: null }, { status: 404 });
  }
  return NextResponse.json({ content });
}
