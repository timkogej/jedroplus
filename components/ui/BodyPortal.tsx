'use client';

// Renders children straight into <body>. Modals opened inside a container
// that creates its own stacking context (e.g. the calendar's `isolate` +
// `z-10` wrapper) otherwise stay below the app bar and sidebar: the bar
// covers the top of the modal and the backdrop dims only the page area.

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function BodyPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return <>{children}</>;
  return createPortal(children, document.body);
}
