import { Timestamp } from 'firebase/firestore';

export const DEFAULT_DISPOSITION_METHODS = ['VHF', 'SSB', 'CW', 'Digital', 'Delivered'];

export interface UserProfile {
  callsign: string;
  name: string;
  location: string;
  netManagerCall: string;
  qrzUsername: string;
  qrzPassword: string;
  dispositionMethods?: string[];
}

export interface Station {
  callsign: string;
  firstName: string | null;
  nickname: string | null;
  city: string | null;
  state: string | null;
  note: string | null;  // Persistent note text (e.g., "Assistant Net Manager")
  lastSeen: Timestamp;
}

export function formatLastSeen(lastSeen: Timestamp | null): string | null {
  if (!lastSeen) return null;

  const now = new Date();
  const then = lastSeen.toDate();

  // Calculate calendar days difference (not 24-hour periods)
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thenDate = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const diffDays = Math.floor((nowDate.getTime() - thenDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return null; // Don't show for today
  } else if (diffDays === 1) {
    return '1 day';
  } else if (diffDays < 7) {
    return `${diffDays} days`;
  } else if (diffDays < 14) {
    return '1 week';
  } else if (diffDays < 30) {
    const weeks = Math.round(diffDays / 7);
    return `${weeks} weeks`;
  } else if (diffDays < 45) {
    return '1 month';
  } else if (diffDays < 330) {
    const months = Math.round(diffDays / 30);
    return `${months} month${months === 1 ? '' : 's'}`;
  } else if (diffDays < 540) {
    return '1 year';
  } else {
    const years = Math.round(diffDays / 365);
    return `${years} years`;
  }
}

export interface CheckIn {
  callsign: string;
  tags: string[];  // NC, ANC, T, A, or liaison net names (e.g., OC, HVN)
  timestamp: Date;
}

export interface NetReport {
  netName: string;
  startDateTime: Timestamp;
  radiogram: string;
  savedAt?: Timestamp;
  parts?: {
    number: string;
    precedence: string;
    stationOfOrigin: string;
    check: string;
    placeOfOrigin: string;
    date: string;
    addressee: string;
    bodyWords: string[];
    signature: string;
    dispositionMethod?: string;
    dispositionDestination?: string;
    dispositionDate?: string;
    dispositionTime?: string;
  };
}

// ARRL Standard Radiogram
export interface Radiogram {
  id: string;
  // Preamble
  number: string;
  precedence: string;
  handlingInstructions: string;
  stationOfOrigin: string;
  check: string;
  placeOfOrigin: string;
  timeFiled: string;
  date: string;
  // Address (5 lines)
  address: string;
  addressOpNote: string;
  // Text (array of words, displayed 5 per line)
  textWords: string[];
  // Signature
  signature: string;
  signatureOpNote: string;
  // Disposition
  dispositionMethod?: string;
  dispositionDestination?: string;
  dispositionDate?: string;
  dispositionTime?: string;
  // Metadata
  savedAt?: Timestamp;
  sessionNetName?: string;
}

// Traffic item for the checklist (e.g., KM2I -> WM2C)
export interface TrafficItem {
  id: string;
  fromCallsign: string;
  toDestination: string;
  checked: boolean;
}

export interface NetSession {
  id?: string;
  netName: string;
  date: Timestamp;
  startTime: string;
  endTime: string | null;
  trafficReported: number;
  trafficCleared: number;
  checkIns: CheckIn[];
  radiograms: Radiogram[];
  report?: NetReport;
  lastAcknowledged?: string | null; // Callsign of last acknowledged station
  // Checklist data
  trafficItems?: TrafficItem[];
  checkedAnnouncements?: string[]; // Callsigns that have been checked off
  checkedSecure?: string[]; // Callsigns requesting to secure that have been checked off
}

export interface QRZLookupResult {
  callsign: string;
  firstName: string;
  lastName: string;
  nickname: string;
  city: string;
  state: string;
  country: string;
  error?: string;
}

export interface QRZSessionResponse {
  sessionKey: string;
  error?: string;
}

// Special tags with defined meanings
export const SPECIAL_TAGS: Record<string, string> = {
  NC: 'Net Control',
  ANC: 'Alternate NC',
  T: 'Traffic',
  A: 'Announcement',
  S: 'Secure',
  IO: 'In & Out',
};

// Urgent status tags that get pulsing animation
export const URGENT_TAGS = ['T', 'A', 'S', 'IO'];

// Check if a tag is a status tag (excluded from report callsign)
// Status tags are: T, A, S, IO, or any single letter (M, P, E, D, etc.)
export function isStatusTag(tag: string): boolean {
  if (URGENT_TAGS.includes(tag)) return true;
  // Single letters (except those in role tags) are status tags
  return tag.length === 1 && tag !== 'NC' && tag !== 'ANC';
}

export function getTagLabel(tag: string): string {
  if (tag in SPECIAL_TAGS) {
    return SPECIAL_TAGS[tag];
  }
  // Single letters are status indicators
  if (tag.length === 1) {
    return tag;  // Just show the letter
  }
  return `${tag} Liaison`;  // Multi-letter tags are liaisons
}
