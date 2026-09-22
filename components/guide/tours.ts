// components/guide/tours.ts
//
// Guided tours: each step points at an element marked with data-tour="…".
// Steps whose element isn't on screen (e.g. the sidebar on mobile, or a module
// the plan doesn't show) are skipped automatically. Text lives in
// messages/*/layout.json under guide.tours.<tour>.<step>.

import type { TourId } from '@/lib/guide/progress';

export type Placement = 'right' | 'bottom' | 'left' | 'top' | 'center';

export interface TourStep {
  /** Translation key under guide.tours.<tour>. */
  key: string;
  /** CSS selector of the element to highlight; omit for a centred intro. */
  target?: string;
  placement?: Placement;
}

const nav = (href: string): string => `[data-tour="nav-${href}"]`;

export const TOURS: Record<TourId, TourStep[]> = {
  dashboard: [
    { key: 'welcome', placement: 'center' },
    { key: 'newAppointment', target: '[data-tour="new-appointment"]', placement: 'bottom' },
    { key: 'calendar', target: nav('koledar'), placement: 'right' },
    { key: 'appointments', target: nav('termini'), placement: 'right' },
    { key: 'clients', target: nav('clients'), placement: 'right' },
    { key: 'services', target: nav('storitve'), placement: 'right' },
    { key: 'staff', target: nav('staff'), placement: 'right' },
    { key: 'reminders', target: nav('reminders'), placement: 'right' },
    { key: 'settings', target: nav('nastavitve'), placement: 'right' },
    { key: 'gettingStarted', target: '[data-tour="getting-started"]', placement: 'bottom' },
    { key: 'userMenu', target: '[data-tour="user-menu"]', placement: 'bottom' },
  ],
  // First login for invited staff: their day, not the owner's setup.
  staff: [
    { key: 'welcome', placement: 'center' },
    { key: 'calendar', target: nav('koledar'), placement: 'right' },
    { key: 'newAppointment', target: '[data-tour="new-appointment"]', placement: 'bottom' },
    { key: 'appointments', target: nav('termini'), placement: 'right' },
    { key: 'clients', target: nav('clients'), placement: 'right' },
    { key: 'userMenu', target: '[data-tour="user-menu"]', placement: 'bottom' },
  ],
  calendar: [
    { key: 'grid', target: '[data-tour="calendar-grid"]', placement: 'center' },
    { key: 'newAppointment', target: '[data-tour="calendar-new"]', placement: 'bottom' },
    { key: 'views', target: '[data-tour="calendar-views"]', placement: 'bottom' },
    { key: 'filters', target: '[data-tour="calendar-filters"]', placement: 'bottom' },
  ],
};
