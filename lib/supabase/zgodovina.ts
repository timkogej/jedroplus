import { supabase } from '@/lib/supabaseClient';

export interface LogZgodovinaParams {
  idPodjetja: string;
  tipEntitete: 'termin' | 'stranka';
  idEntitete: string;
  akcija: string;
  spremembe?: { prej: Record<string, unknown>; potem: Record<string, unknown> };
  izvedel?: string;
  izvedel_tip?: 'owner' | 'admin' | 'staff' | 'stranka' | 'sistem';
  idTermina?: string;
  idStranke?: string;
}

export async function logZgodovina(params: LogZgodovinaParams): Promise<void> {
  const {
    idPodjetja,
    tipEntitete,
    idEntitete,
    akcija,
    spremembe,
    izvedel,
    izvedel_tip,
    idTermina,
    idStranke,
  } = params;

  const { error } = await supabase.from('zgodovina').insert({
    'ID podjetja': idPodjetja,
    tip_entitete: tipEntitete,
    'ID entitete': idEntitete,
    akcija,
    spremembe: spremembe ?? null,
    izvedel: izvedel ?? null,
    izvedel_tip: izvedel_tip ?? null,
    'ID termina': idTermina ?? null,
    'ID stranke': idStranke ?? null,
  });

  if (error) {
    console.error('[logZgodovina] insert failed:', error.message);
  }
}
