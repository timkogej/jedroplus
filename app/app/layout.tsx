import type { ReactNode } from 'react';
import { LegacyRouteProviders } from '@/app/legacy-route-providers';

export default function AppLegacyLayout({ children }: { children: ReactNode }) {
  return <LegacyRouteProviders>{children}</LegacyRouteProviders>;
}
