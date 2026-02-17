import { NextRequest, NextResponse } from 'next/server';
import { readContent } from '@/lib/content';
import { verifyAppCheck } from '@/lib/appcheck-api';

export async function GET(request: NextRequest) {
  const appCheckResult = await verifyAppCheck(request);
  if (appCheckResult !== true) return appCheckResult;

  const content = await readContent('privacy-policy-summary.md');
  if (content === null) {
    return NextResponse.json({ content: null }, { status: 404 });
  }
  return NextResponse.json({ content });
}
