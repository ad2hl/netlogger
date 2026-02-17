import { NextRequest, NextResponse } from 'next/server';
import { getAppCheck } from 'firebase-admin/app-check';
import { getAdminApp } from './firebase-admin';

export async function verifyAppCheck(request: NextRequest): Promise<true | NextResponse> {
  const token = request.headers.get('X-Firebase-AppCheck');
  if (!token) {
    return NextResponse.json({ error: 'Missing App Check token' }, { status: 401 });
  }

  try {
    await getAppCheck(getAdminApp()).verifyToken(token);
    return true;
  } catch (error) {
    console.error('App Check verification failed:', error);
    return NextResponse.json({ error: 'Invalid App Check token' }, { status: 401 });
  }
}
