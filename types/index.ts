import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  callsign: string;
  name: string;
  location: string;
  netManagerCall: string;
  qrzUsername: string;
  qrzPassword: string;
}

export interface Station {
  callsign: string;
  firstName: string;
  nickname: string | null;
  note: string | null;  // Persistent noteduction text (e.g., "Assistant Net Manager")
  lastSeen: Timestamp;
}

export function formatLastSeen(lastSeen: Timestamp | null): string | null {
  if (!lastSeen) return null;

  const now = new Date();
  const then = lastSeen.toDate();
  const diffMs = now.getTime() - then.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) {
    return null; // Don't show for today
  } else if (diffDays < 1.5) {
    return '1 day';
  } else if (diffDays < 7) {
    return `${Math.round(diffDays)} days`;
  } else if (diffDays < 10) {
    return '1 week';
  } else if (diffDays < 30) {
    const weeks = Math.round(diffDays / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
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

export interface NetSession {
  id?: string;
  netName: string;
  date: Timestamp;
  startTime: string;
  endTime: string | null;
  trafficReported: number;
  trafficCleared: number;
  checkIns: CheckIn[];
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
export const SPECIAL_TAGS = {
  NC: 'Net Control',
  ANC: 'Alternate NC',
  T: 'Traffic',
  A: 'Announcement',
  M: 'Mobile',
  P: 'Portable',
  S: 'Secure',
  IO: 'In & Out',
} as const;

// Tags that are excluded from the report callsign (status tags, not role tags)
export const STATUS_TAGS = ['T', 'A', 'M', 'P', 'S', 'IO'];

export function getTagLabel(tag: string): string {
  if (tag in SPECIAL_TAGS) {
    return SPECIAL_TAGS[tag as keyof typeof SPECIAL_TAGS];
  }
  return `${tag} Liaison`;  // Anything else is a liaison
}
