import { QRZLookupResult, QRZSessionResponse } from '@/types';

const QRZ_API_URL = 'https://xmldata.qrz.com/xml/current/';

function parseXMLValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] : '';
}

export async function getQRZSession(
  username: string,
  password: string
): Promise<QRZSessionResponse> {
  const params = new URLSearchParams({
    username,
    password,
    agent: 'NetLogger/1.0',
  });

  const response = await fetch(`${QRZ_API_URL}?${params.toString()}`);
  const xml = await response.text();

  const error = parseXMLValue(xml, 'Error');
  if (error) {
    return { sessionKey: '', error };
  }

  const sessionKey = parseXMLValue(xml, 'Key');
  if (!sessionKey) {
    return { sessionKey: '', error: 'No session key returned' };
  }

  return { sessionKey };
}

export async function lookupCallsign(
  sessionKey: string,
  callsign: string
): Promise<QRZLookupResult> {
  const params = new URLSearchParams({
    s: sessionKey,
    callsign: callsign.toUpperCase(),
  });

  const response = await fetch(`${QRZ_API_URL}?${params.toString()}`);
  const xml = await response.text();

  const error = parseXMLValue(xml, 'Error');
  if (error) {
    if (error.includes('Session Timeout') || error.includes('Invalid session')) {
      return {
        callsign: callsign.toUpperCase(),
        firstName: '',
        lastName: '',
        nickname: '',
        city: '',
        state: '',
        country: '',
        error: 'SESSION_EXPIRED'
      };
    }
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

  return {
    callsign: parseXMLValue(xml, 'call') || callsign.toUpperCase(),
    firstName: parseXMLValue(xml, 'fname'),
    lastName: parseXMLValue(xml, 'name'),
    nickname: parseXMLValue(xml, 'nickname'),
    city: parseXMLValue(xml, 'addr2'),
    state: parseXMLValue(xml, 'state'),
    country: parseXMLValue(xml, 'country'),
  };
}
