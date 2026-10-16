'use client';

import { useAuth } from '@/components/AuthProvider';

// True when the user has chosen UTC for date/time entry and display (issue #292)
export function useUtc(): boolean {
  return useAuth().profile?.timeZone === 'utc';
}
