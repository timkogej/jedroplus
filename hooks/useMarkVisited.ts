'use client';

import { useEffect } from 'react';
import { useAuth } from '@/app/auth-context';
import { markVisited, type VisitKey } from '@/lib/guide/progress';

/** Records that the user opened a page the getting-started checklist cares about. */
export function useMarkVisited(key: VisitKey) {
  const { user } = useAuth();
  useEffect(() => {
    markVisited(user?.id, key);
  }, [user?.id, key]);
}
