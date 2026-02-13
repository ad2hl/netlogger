import { NextResponse } from 'next/server';
import { readContent } from '@/lib/content';

export async function GET() {
  const content = await readContent('header-message.md');
  if (content === null) {
    return NextResponse.json({ content: null }, { status: 404 });
  }
  return NextResponse.json({ content });
}
