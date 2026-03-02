import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from './firebase-admin';

export async function verifyAuth(request: NextRequest): Promise<string | NextResponse> {
  // Desktop mode: single local user, no auth token needed
  if (process.env.NEXT_PUBLIC_DESKTOP_MODE === 'true') return 'local-user';

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    console.error('Token verification failed:', error);
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}
