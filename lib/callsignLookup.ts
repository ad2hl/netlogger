import { CallsignLookupResult, LookupService } from '@/types';

function emptyResult(callsign: string, error: string): CallsignLookupResult {
  return {
    callsign: callsign.toUpperCase(),
    firstName: '',
    lastName: '',
    nickname: '',
    city: '',
    state: '',
    country: '',
    error,
  };
}

// callook.info address.line2 looks like "HARTSDALE, NY 10530"
function parseCityState(line2: string): { city: string; state: string } {
  const match = line2.match(/^(.*),\s*([A-Z]{2})\s+\d{5}(-\d{4})?$/);
  if (!match) return { city: '', state: '' };
  return { city: match[1].trim(), state: match[2] };
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: '', lastName: '' };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: '' };
  return { firstName: tokens[0], lastName: tokens[tokens.length - 1] };
}

async function lookupCallook(callsign: string): Promise<CallsignLookupResult> {
  const response = await fetch(`https://callook.info/${encodeURIComponent(callsign)}/json`);
  const data = await response.json();

  if (data.status !== 'VALID') {
    return emptyResult(callsign, 'NOT_FOUND');
  }

  const { firstName, lastName } = splitName(data.name || '');
  const { city, state } = parseCityState(data.address?.line2 || '');

  return {
    callsign: data.current?.callsign || callsign.toUpperCase(),
    firstName,
    lastName,
    nickname: '',
    city,
    state,
    country: 'United States',
  };
}

async function lookupHamdb(callsign: string): Promise<CallsignLookupResult> {
  const response = await fetch(`https://api.hamdb.org/${encodeURIComponent(callsign)}/json/netlogger`);
  const data = await response.json();
  const entry = data?.hamdb?.callsign;

  if (!entry || entry.call === 'NOT_FOUND' || data?.hamdb?.messages?.status !== 'OK') {
    return emptyResult(callsign, 'NOT_FOUND');
  }

  return {
    callsign: entry.call || callsign.toUpperCase(),
    firstName: entry.fname || '',
    lastName: entry.name || '',
    nickname: '',
    city: entry.addr2 || '',
    state: entry.state || '',
    country: entry.country || '',
  };
}

export async function lookupCallsign(
  service: LookupService,
  callsign: string
): Promise<CallsignLookupResult> {
  const upper = callsign.toUpperCase();
  try {
    return service === 'hamdb' ? await lookupHamdb(upper) : await lookupCallook(upper);
  } catch (error) {
    console.error(`${service} lookup error:`, error);
    return emptyResult(upper, 'LOOKUP_FAILED');
  }
}
