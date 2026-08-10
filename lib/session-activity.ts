/**
 * Idle-session tracking.
 *
 * AuthProvider expires a session after SESSION_TIMEOUT_HOURS. That clock has to
 * be driven by observed user activity rather than by `User.metadata.lastSignInTime`:
 * during a popup sign-in Firebase delivers a user object whose lastSignInTime
 * still describes the *previous* login, so a returning operator was being signed
 * out by the very sign-in that had just authenticated them (issue #214).
 *
 * Activity is recorded in localStorage so it survives the page load that follows
 * a sign-in redirect and is shared across tabs.
 */

const ACTIVITY_KEY = 'netlogger:lastActivity';

/**
 * Records "the operator is here right now". Safe to call frequently — callers
 * throttle their own writes.
 */
export function markActivity(when: number = Date.now()): void {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(when));
  } catch {
    // Storage unavailable (private mode, blocked cookies). Falling through means
    // getLastActivity() returns null and the session never expires, which is the
    // right failure direction — better than logging an operator out mid-net.
  }
}

/** Last recorded activity time, or null if nothing has been recorded yet. */
export function getLastActivity(): number | null {
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearActivity(): void {
  try {
    window.localStorage.removeItem(ACTIVITY_KEY);
  } catch {
    // Nothing to do — see markActivity.
  }
}
