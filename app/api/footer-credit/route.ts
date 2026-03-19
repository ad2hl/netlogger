import { NextResponse } from 'next/server';
import { readContentWithType } from '@/lib/content';

export async function GET() {
  const result = await readContentWithType('footer-credit');
  if (result === null) {
    return NextResponse.json({ content: null }, { status: 404 });
  }
  return NextResponse.json({ content: result.content, type: result.type });
}
