import { NextRequest, NextResponse } from 'next/server';
import { verifyAppCheck } from '@/lib/appcheck-api';

export async function GET(request: NextRequest) {
  const appCheckResult = await verifyAppCheck(request);
  if (appCheckResult !== true) return appCheckResult;

  const callsign = request.nextUrl.searchParams.get('callsign');
  if (!callsign || !/^[A-Z0-9]{1,2}[0-9][A-Z]{1,3}$/i.test(callsign)) {
    return NextResponse.json({ error: 'Invalid callsign' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://callook.info/${encodeURIComponent(callsign.toUpperCase())}/xml`
    );
    const xml = await response.text();

    if (!xml.includes('<status>VALID</status>')) {
      return NextResponse.json({ grantDate: null });
    }

    // callook returns dates as MM/DD/YYYY
    const match = xml.match(/<grantdate>([\d/]+)<\/grantdate>/);
    if (!match) {
      return NextResponse.json({ grantDate: null });
    }

    const parts = match[1].split('/');
    if (parts.length !== 3) {
      return NextResponse.json({ grantDate: null });
    }
    const [month, day, year] = parts;
    const grantDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return NextResponse.json({ grantDate });
  } catch (error) {
    console.error('Callook lookup error:', error);
    return NextResponse.json({ grantDate: null });
  }
}
