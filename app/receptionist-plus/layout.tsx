import type { ReactNode } from 'react';
import { LegacyRouteProviders } from '@/app/legacy-route-providers';

export default function ReceptionistPlusLegacyLayout({ children }: { children: ReactNode }) {
  return <LegacyRouteProviders>{children}</LegacyRouteProviders>;
}
