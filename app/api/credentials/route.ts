import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';

export async function POST(request: NextRequest) {
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
