import { NextRequest, NextResponse } from 'next/server';
import { getQRZSession, lookupCallsign } from '@/lib/qrz';
import { decrypt, isEncrypted } from '@/lib/crypto';
import { verifyAuth } from '@/lib/auth-api';
import { verifyAppCheck } from '@/lib/appcheck-api';

const sessionCache = new Map<string, { key: string; expiry: number }>();

function decryptPassword(password: string): string {
  if (isEncrypted(password)) {
    return decrypt(password);
  }
  return password;
}

async function getOrCreateSession(username: string, password: string): Promise<string | null> {
  const plaintextPassword = decryptPassword(password);
  const cacheKey = `${username}:${plaintextPassword}`;
  const cached = sessionCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.key;
  }

  const result = await getQRZSession(username, plaintextPassword);

  if (result.error) {
    console.error('QRZ session error:', result.error);
    return null;
  }

  sessionCache.set(cacheKey, {
    key: result.sessionKey,
    expiry: Date.now() + 23 * 60 * 60 * 1000,
  });

  return result.sessionKey;
}

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DESKTOP_MODE === 'true') {
    return NextResponse.json({ error: 'Use IPC in desktop mode' }, { status: 400 });
  }

  const appCheckResult = await verifyAppCheck(request);
  if (appCheckResult !== true) return appCheckResult;

  const authResult = await verifyAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { callsign, username, password } = body;

    if (!callsign) {
      return NextResponse.json(
        { error: 'Callsign is required' },
        { status: 400 }
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: 'QRZ credentials are required' },
        { status: 400 }
      );
    }

    let sessionKey = await getOrCreateSession(username, password);

    if (!sessionKey) {
      return NextResponse.json(
        { error: 'Failed to authenticate with QRZ' },
        { status: 401 }
      );
    }

    let result = await lookupCallsign(sessionKey, callsign);

    if (result.error === 'SESSION_EXPIRED') {
      const plaintextPassword = decryptPassword(password);
      sessionCache.delete(`${username}:${plaintextPassword}`);
      sessionKey = await getOrCreateSession(username, password);

      if (!sessionKey) {
        return NextResponse.json(
          { error: 'Failed to re-authenticate with QRZ' },
          { status: 401 }
        );
      }

      result = await lookupCallsign(sessionKey, callsign);
    }

    if (result.error && result.error !== 'SESSION_EXPIRED') {
      return NextResponse.json(
        {
          callsign: result.callsign,
          firstName: null,
          error: result.error,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      callsign: result.callsign,
      firstName: result.firstName,
      lastName: result.lastName,
      nickname: result.nickname,
      city: result.city,
      state: result.state,
      country: result.country,
    });
  } catch (error) {
    console.error('QRZ API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
