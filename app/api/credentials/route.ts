import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { verifyAuth } from '@/lib/auth-api';
import { verifyAppCheck } from '@/lib/appcheck-api';

export async function POST(request: NextRequest) {
  const appCheckResult = await verifyAppCheck(request);
  if (appCheckResult !== true) return appCheckResult;

  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    const encrypted = encrypt(password);
    return NextResponse.json({ encrypted });
  } catch (error) {
    console.error('Encryption error:', error);
    return NextResponse.json(
      { error: 'Failed to encrypt credentials' },
      { status: 500 }
    );
  }
}
