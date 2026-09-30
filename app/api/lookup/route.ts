import { NextRequest, NextResponse } from 'next/server';
import { lookupCallsign } from '@/lib/callsignLookup';
import { verifyAppCheck } from '@/lib/appcheck-api';
import { LookupService } from '@/types';

export async function GET(request: NextRequest) {
  const appCheckResult = await verifyAppCheck(request);
  if (appCheckResult !== true) return appCheckResult;

  const callsign = request.nextUrl.searchParams.get('callsign');
  if (!callsign || !/^[A-Z0-9]{1,2}[0-9][A-Z]{1,3}$/i.test(callsign)) {
    return NextResponse.json({ error: 'Invalid callsign' }, { status: 400 });
  }

  const serviceParam = request.nextUrl.searchParams.get('service');
  const service: LookupService = serviceParam === 'hamdb' ? 'hamdb' : 'callook';

  const result = await lookupCallsign(service, callsign);
  return NextResponse.json(result);
}
