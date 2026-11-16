import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

/** Testna stran asistenta (faza 1) je samo za razvoj: na produkciji je ni. */
export default function Layout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return children;
}
