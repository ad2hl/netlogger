import { firebaseDb } from './firebase-impl';
import { dexieDb } from './dexie-impl';
import type { NetLoggerDB } from './interface';

// Select the right implementation at build time based on NEXT_PUBLIC_DESKTOP_MODE.
// Next.js inlines NEXT_PUBLIC_ vars as constants, enabling dead-code elimination
// for the unused branch.
export const db: NetLoggerDB =
  process.env.NEXT_PUBLIC_DESKTOP_MODE === 'true' ? dexieDb : firebaseDb;
