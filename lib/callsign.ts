// A bare digit appended to a callsign with a slash (e.g. W1AW/2) is the
// operating call-area designator hams use when signing outside their home
// call area -- it's part of the callsign, not a status/role/liaison tag
// (issue #283).

/** True if `part` (one "/"-separated segment) is a call-area digit. */
export function isCallAreaDigit(part: string): boolean {
  return /^\d$/.test(part);
}

/**
 * Strips a trailing call-area digit, e.g. "W1AW/2" -> "W1AW". Station identity
 * -- QRZ/callook lookups, nicknames, notes, and check-in history -- stays keyed
 * to the underlying station regardless of which call area was used to sign in.
 */
export function getBaseCallsign(callsign: string): string {
  return callsign.replace(/\/\d$/, '');
}
