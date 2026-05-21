import { NextResponse } from 'next/server';
import { readContentWithType } from '@/lib/content';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await readContentWithType('terms-of-service');
  if (result === null) {
    return NextResponse.json({ content: null }, { status: 404 });
  }
  return NextResponse.json({ content: result.content, type: result.type });
}
