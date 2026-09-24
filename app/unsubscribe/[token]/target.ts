import { cache } from 'react';
import { loadUnsubscribeTarget } from '@/lib/marketingConsent.server';

/** One lookup per request, shared by the layout and the page. */
export const loadUnsubscribeTargetCached = cache(loadUnsubscribeTarget);
