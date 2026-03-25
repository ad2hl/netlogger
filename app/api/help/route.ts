import { NextRequest, NextResponse } from 'next/server';
import { readContentWithType } from '@/lib/content';

const PAGE_FILES: Record<string, string> = {
  net: 'help-net',
  overview: 'help-overview',
  sessions: 'help-sessions',
  radiograms: 'help-radiograms',
  settings: 'help-settings',
};

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get('page');
  const basename = page ? PAGE_FILES[page] : undefined;
  if (!basename) {
    return NextResponse.json({ error: 'Unknown page' }, { status: 400 });
  }

  const result = await readContentWithType(basename);
  if (result === null) {
    return NextResponse.json({ content: null }, { status: 404 });
  }
  return NextResponse.json({ content: result.content, type: result.type });
}
