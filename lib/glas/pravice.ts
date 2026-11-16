// lib/glas/pravice.ts
//
// Kdo sme kaj z glasom. Isto pravilo kot SQL funkcija jp_ima_pravico_clana
// (migracija 1793500000): owner/admin vse; staff po staff_role_permissions;
// brez vrstice velja isto kot v vmesniku (`?? true`), razen za glas (strožje: ne).
//
// Obstoječe poti (n8n prek /api/webhook) teh pravic na strežniku ne preverjajo;
// asistent jih zato preveri sam — ob predlogu IN znova ob potrditvi.

import type { Kontekst, Pravica } from './tipi';

export function imaPravico(k: Pick<Kontekst, 'vloga' | 'pravice'>, pravica: Pravica): boolean {
  // Številke salona: samo lastnik — ne admin, ne zaposleni, ne glede na can_view_analytics.
  if (pravica === 'analitika.lastnik') return k.vloga === 'owner';
  if (k.vloga === 'owner' || k.vloga === 'admin') return true;
  if (k.vloga !== 'staff') return false;
  const p = k.pravice;
  switch (pravica) {
    case 'glas.uporaba':
      return p?.can_access_asistent_plus === true;
    case 'stranke.branje':
      return p?.can_view_clients ?? true;
    case 'stranke.urejanje':
      return p?.can_edit_clients ?? true;
    case 'stranke.ustvarjanje':
      return p?.can_create_clients ?? true;
    case 'termini.branje':
      return (p?.can_view_all_appointments ?? true) || p?.can_view_only_own_appointments === true;
    case 'termini.urejanje':
    case 'sporocila.stranke':
      return (p?.can_edit_all_appointments ?? true) || p?.can_edit_only_own_appointments === true;
    case 'termini.ustvarjanje':
      return p?.can_create_appointments ?? true;
    default:
      return false;
  }
}

/**
 * Ali zaposleni vidi samo svoje termine. Isto kot fetchAppointmentsData.server.ts
 * (resolveViewScope): staff && (only_own === true || view_all === false).
 */
export function samoSvojiTermini(k: Pick<Kontekst, 'vloga' | 'pravice'>): boolean {
  if (k.vloga !== 'staff') return false;
  return k.pravice?.can_view_only_own_appointments === true || k.pravice?.can_view_all_appointments === false;
}
