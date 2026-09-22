'use client';

import { useEffect } from 'react';
import { useRolePermissions } from '@/app/role-permission-context';
import { useOptionalTour } from './TourProvider';

/**
 * Starts the staff tour once on a staff member's first dashboard visit.
 * Must render inside ProtectedLayout (where TourProvider lives).
 */
export default function StaffTourStarter() {
  const { role } = useRolePermissions();
  const tour = useOptionalTour();

  useEffect(() => {
    if (role !== 'staff' || !tour) return;
    const timer = window.setTimeout(() => {
      if (document.querySelector('[role="dialog"]')) return;
      tour.startTourOnce('staff');
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [role, tour]);

  return null;
}
