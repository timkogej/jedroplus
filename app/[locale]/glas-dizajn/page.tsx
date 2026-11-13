import { notFound } from 'next/navigation';
import { GlasDizajn } from './GlasDizajn';

/**
 * Testna stran za videz Asistent+ (lažna stanja, brez prijave in brez podatkov).
 * Samo za razvoj: na produkciji je ni.
 */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <GlasDizajn />;
}
