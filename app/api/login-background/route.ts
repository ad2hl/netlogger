import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { verifyAppCheck } from '@/lib/appcheck-api';

const EXTENSIONS = ['png', 'jpg', 'jpeg'];
const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export async function GET(request: NextRequest) {
  const appCheckResult = await verifyAppCheck(request);
  if (appCheckResult !== true) return appCheckResult;

  const base = join(process.cwd(), 'content');

  for (const dir of ['local', 'default']) {
    for (const ext of EXTENSIONS) {
      try {
        const data = await readFile(join(base, dir, `login-background.${ext}`));
        return new NextResponse(data, {
          headers: { 'Content-Type': CONTENT_TYPES[ext] },
        });
      } catch {
        // Not found, try next
      }
    }
  }

  return new NextResponse(null, { status: 404 });
}
