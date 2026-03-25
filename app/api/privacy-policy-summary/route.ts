import { NextResponse } from 'next/server';
import { readContentWithType } from '@/lib/content';

export async function GET() {
  const result = await readContentWithType('privacy-policy-summary');
  if (result === null) {
    return NextResponse.json({ content: null }, { status: 404 });
  }
  return NextResponse.json({ content: result.content, type: result.type });
}
