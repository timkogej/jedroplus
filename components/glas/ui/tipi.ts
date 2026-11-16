/** Vrstica pogovora, kot jo pokaže vmesnik (zadnji dve izjavi, starejše zbledijo). */
export type Vrstica = { kdo: 'jaz' | 'asistent' | 'napaka' | 'uspeh'; besedilo: string };

export interface Moznost {
  id: string;
  oznaka: string;
}
