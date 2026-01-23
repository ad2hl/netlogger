import { NextRequest, NextResponse } from 'next/server';
import { getQRZSession, lookupCallsign } from '@/lib/qrz';

const sessionCache = new Map<string, { key: string; expiry: number }>();

async function getOrCreateSession(username: string, password: string): Promise<string | null> {
  const cacheKey = `${username}:${password}`;
  const cached = sessionCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.key;
  }

  const result = await getQRZSession(username, password);

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
      sessionCache.delete(`${username}:${password}`);
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
          firstName: 'Unknown',
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
