// lib/glas/odjemalec/pogovor.ts
//
// Sprotni glasovni pogovor v brskalniku (faza 1, arhitektura A iz
// docs/glasovni-asistent-faza0.md):
//
//   gumb → /api/glas/seja (pravice, kvota, kratkotrajna Soniox ključa, namigi)
//        → mikrofon → Soniox STT (WebSocket, neposredno) → konec govora
//        → /api/glas/ukaz (besedilo; AI in podatki z uporabnikovo sejo, RLS)
//        → `govor` → Soniox TTS (WebSocket, glas Nina) → zvočnik
//        → spet posluša (nadaljevanje pogovora), po tišini se zapre.
//
// Zvok ne gre prek našega strežnika. Pisanje gre vedno prek predloga z žetonom;
// glasovni "ja" samo pokliče isto /api/glas/potrdi kot gumb.
//
// Polovični dupleks: med razmišljanjem in govorom gre v STT tišina, da asistent
// ne sliši samega sebe (odmev iz zvočnika). Prekinitev = dotik gumba.
// Ne zapisuje prepisov v konzolo (osebni podatki).

import { izberiMoznost, jePotrditev, jeZavrnitev, pcmVFloat, SestavljalecIzjave, type SonioxZeton } from './besede';

export type StanjePogovora = 'mirovanje' | 'povezujem' | 'poslusam' | 'razmisljam' | 'govorim';

export interface PredlogOdjemalec {
  id: string;
  zeton: string;
  orodje: string;
  povzetek: string;
  podrobnosti: { oznaka: string; vrednost: string }[];
  potece: string;
  sporocil: number;
}
export interface VprasanjeOdjemalec {
  besedilo: string;
  moznosti?: { id: string; oznaka: string }[];
}
export interface OdgovorOdjemalec {
  ok: boolean;
  ukazId?: string;
  status?: 'odgovor' | 'predlog' | 'vprasanje';
  prepis?: string;
  odgovor?: string;
  govor?: string;
  predlog?: PredlogOdjemalec;
  vprasanje?: VprasanjeOdjemalec;
  /** Stran v aplikaciji (brez jezika), ki jo je asistent predlagal odpreti. */
  pojdi?: string;
  /** Obrazec, ki naj se odpre izpolnjen (shraniObrazec pred premikom na `pojdi`). */
  obrazec?: { vrsta: 'nov_termin' | 'prestavi_termin' | 'odsotnost' | 'nova_stranka'; polja: Record<string, string> };
  opozorilo?: string | null;
  sporocilo?: string;
  koda?: string;
}

export interface Meritev {
  /** Od zaznanega konca govora do odgovora strežnika. */
  doOdgovora: number;
  /** Od zaznanega konca govora do prvega zvoka (null = brez glasu). */
  doZvoka: number | null;
}

export interface DogodkiPogovora {
  stanje(s: StanjePogovora): void;
  /** Sproten prepis tega, kar uporabnik govori. */
  slisano(besedilo: string): void;
  /** Izjava je zaključena in poslana. */
  izjava(besedilo: string): void;
  odgovor(o: OdgovorOdjemalec): void;
  /** Rezultat potrditve ali zavrnitve predloga. */
  potrditev(o: { ok: boolean; sporocilo: string }): void;
  /** Napaka, ki jo mora uporabnik videti (in jo tudi sliši, če glas deluje). */
  napaka(sporocilo: string): void;
  meritev(m: Meritev): void;
  /**
   * Izjavo lahko obdela vmesnik sam, brez strežnika (npr. "shrani" v obrazcu,
   * ki ga je odprl asistent). Vrne besedilo odgovora ali null (gre na strežnik).
   */
  lokalno?(izjava: string): string | null;
}

interface Seja {
  ok: boolean;
  sporocilo?: string;
  jezik: string;
  stt: { url: string; kljuc: string; model: string; namigi: string[]; najdaljsiKonecMs: number };
  tts: { url: string; kljuc: string; model: string; glas: string; hitrost: number };
  opozorilo?: string | null;
}

/** Po odgovoru posluša še toliko časa, nato se pogovor zapre. */
const TISINA_PO_ODGOVORU_MS = 8000;
const TISINA_NA_ZACETKU_MS = 12000;
/** Če uporabnik po zaznanem koncu takoj nadaljuje (premor sredi nareka), izjavi združimo. */
const POCAKAJ_PO_KONCU_MS = 250;
const ZAHTEVA_TIMEOUT_MS = 20000;
/** TTS ključ se preveri ob vsakem govoru in velja 60 s: obnavljamo ga v ozadju. */
const TTS_KLJUC_OBNOVI_MS = 40000;
const TTS_HZ = 24000;

const SPOROCILA = {
  mikrofon: 'Dostop do mikrofona ni dovoljen. Dovolite mikrofon za to stran v nastavitvah brskalnika.',
  brezMikrofona: 'Ta brskalnik ne podpira snemanja zvoka.',
  povezava: 'Povezava ni uspela. Nič ni bilo spremenjeno. Poskusite znova.',
  razpoznava: 'Razpoznava govora se je prekinila. Tapnite gumb za nov pogovor.',
  casovna: 'Asistent se ni odzval pravočasno. Nič ni bilo spremenjeno.',
  nerazumljiv: 'Neveljaven odgovor strežnika. Nič ni bilo spremenjeno.',
};

export class Pogovor {
  private s: StanjePogovora = 'mirovanje';
  private seja: Seja | null = null;
  private sejaCas = 0;
  private tok: MediaStream | null = null;
  private vhod: AudioContext | null = null;
  private izhod: AudioContext | null = null;
  private stt: WebSocket | null = null;
  private tts: WebSocket | null = null;
  private ttsZiv: ReturnType<typeof setInterval> | null = null;
  private ttsObnova: ReturnType<typeof setInterval> | null = null;
  private tisina: ReturnType<typeof setTimeout> | null = null;
  private cakanje: ReturnType<typeof setTimeout> | null = null;
  private sestavljalec = new SestavljalecIzjave();
  private cakajoca: string | null = null;
  private tKonec = 0;
  private sekundeZvoka = 0;
  private zadnjiUkaz: string | null = null;
  private predlog: PredlogOdjemalec | null = null;
  private vprasanje: VprasanjeOdjemalec | null = null;
  private govorId: string | null = null;
  private viri: AudioBufferSourceNode[] = [];
  private naslednjiCas = 0;
  private koncajGovor: (() => void) | null = null;
  private zahteva: AbortController | null = null;

  /** Koliko časa po odgovoru še posluša (daljše, ko je odprt obrazec za pregled). */
  tisinaPoOdgovoru = TISINA_PO_ODGOVORU_MS;

  constructor(private d: DogodkiPogovora) {}

  get stanje() {
    return this.s;
  }

  get aktiven() {
    return this.s !== 'mirovanje';
  }

  /** Mora biti klicano iz dotika/klika (iOS dovoli zvok samo takrat). */
  async zacni(): Promise<void> {
    if (this.aktiven) return;
    this.nastavi('povezujem');
    // Zvočna konteksta ustvarimo takoj, še v dotiku (iOS Safari).
    const AC: typeof AudioContext | undefined =
      typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!AC || !navigator.mediaDevices?.getUserMedia) {
      this.koncaj(SPOROCILA.brezMikrofona);
      return;
    }
    this.izhod = new AC();
    this.vhod = new AC();
    void this.izhod.resume();
    void this.vhod.resume();

    try {
      const [seja, tok] = await Promise.all([
        this.pridobiSejo(),
        navigator.mediaDevices
          .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
          .catch((e: unknown) => {
            throw new NapakaPogovora(e instanceof DOMException && e.name === 'NotAllowedError' ? SPOROCILA.mikrofon : SPOROCILA.brezMikrofona);
          }),
        this.vhod.audioWorklet.addModule('/glas/mikrofon-worklet.js'),
      ]);
      if (!this.aktiven) {
        tok.getTracks().forEach((t) => t.stop());
        return;
      }
      this.tok = tok;
      await Promise.all([this.odpriStt(seja), this.odpriTts(seja)]);
      this.povezMikrofon(tok);
      this.ttsObnova = setInterval(() => void this.obnoviTtsKljuc(), TTS_KLJUC_OBNOVI_MS);
      this.ton(880);
      this.poslusaj(TISINA_NA_ZACETKU_MS);
      if (seja.opozorilo) this.d.napaka(seja.opozorilo);
    } catch (e) {
      this.koncaj(e instanceof NapakaPogovora ? e.message : SPOROCILA.povezava);
    }
  }

  /** Konec pogovora (gumb ali tišina). */
  ustavi() {
    this.koncaj(null);
  }

  /** Med govorom: utihni in poslušaj. */
  prekini() {
    if (this.s === 'govorim') {
      this.utisaj();
      this.poslusaj(this.tisinaPoOdgovoru);
    }
  }

  /** Besedilni vnos gre po isti poti kot govor (brez STT). */
  async besedilo(t: string) {
    const b = t.trim();
    if (!b) return;
    if (this.s === 'govorim') this.utisaj();
    this.tKonec = performance.now();
    await this.obdelaj(b);
  }

  /** Klik na možnost (več strank z istim imenom). */
  async izberi(m: { id: string; oznaka: string }) {
    if (this.s === 'govorim') this.utisaj();
    this.tKonec = performance.now();
    await this.obdelaj(m.oznaka, m);
  }

  async potrdiPredlog() {
    if (this.predlog) await this.potrdi(this.predlog);
  }

  async zavrniPredlog() {
    if (this.predlog) await this.zavrni(this.predlog);
  }

  // ───────────────────────────── povezave ─────────────────────────────

  private async pridobiSejo(): Promise<Seja> {
    let r: Response;
    try {
      r = await fetch('/api/glas/seja', { method: 'POST', cache: 'no-store' });
    } catch {
      throw new NapakaPogovora(SPOROCILA.povezava);
    }
    const j = (await r.json().catch(() => null)) as Seja | null;
    if (!j) throw new NapakaPogovora(SPOROCILA.nerazumljiv);
    if (!j.ok) throw new NapakaPogovora(j.sporocilo ?? SPOROCILA.povezava);
    this.seja = j;
    this.sejaCas = performance.now();
    return j;
  }

  /** Nov ključ za glas (stari po 60 s ne velja več za nov govor). */
  private async obnoviTtsKljuc(): Promise<boolean> {
    try {
      const r = await fetch('/api/glas/seja', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ samo: 'tts' }), cache: 'no-store' });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; tts?: { kljuc?: string } } | null;
      if (!j?.ok || !j.tts?.kljuc || !this.seja) return false;
      this.seja.tts.kljuc = j.tts.kljuc;
      this.sejaCas = performance.now();
      return true;
    } catch {
      return false;
    }
  }

  private odpriStt(seja: Seja): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(seja.stt.url);
      ws.binaryType = 'arraybuffer';
      const t = setTimeout(() => reject(new NapakaPogovora(SPOROCILA.povezava)), 6000);
      ws.onopen = () => {
        clearTimeout(t);
        ws.send(
          JSON.stringify({
            api_key: seja.stt.kljuc,
            model: seja.stt.model,
            audio_format: 'pcm_s16le',
            sample_rate: 16000,
            num_channels: 1,
            language_hints: [seja.jezik],
            enable_endpoint_detection: true,
            max_endpoint_delay_ms: seja.stt.najdaljsiKonecMs,
            context: { terms: seja.stt.namigi },
          })
        );
        resolve();
      };
      ws.onmessage = (e) => this.sttSporocilo(e.data);
      ws.onerror = () => {
        clearTimeout(t);
        reject(new NapakaPogovora(SPOROCILA.povezava));
      };
      ws.onclose = () => {
        if (this.stt === ws && this.aktiven) this.koncaj(SPOROCILA.razpoznava);
      };
      this.stt = ws;
    });
  }

  private odpriTts(seja: Seja): Promise<void> {
    return new Promise((resolve) => {
      const ws = new WebSocket(seja.tts.url);
      // Glas ni nujen: brez njega je odgovor še vedno na zaslonu.
      const t = setTimeout(() => resolve(), 6000);
      ws.onopen = () => {
        clearTimeout(t);
        this.ttsZiv = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ keep_alive: true })), 5000);
        resolve();
      };
      ws.onmessage = (e) => this.ttsSporocilo(e.data);
      ws.onerror = () => {
        clearTimeout(t);
        resolve();
      };
      ws.onclose = () => {
        if (this.tts === ws) this.tts = null;
        if (this.s === 'govorim') this.koncajGovor?.();
      };
      this.tts = ws;
    });
  }

  private povezMikrofon(tok: MediaStream) {
    const ctx = this.vhod!;
    const vir = ctx.createMediaStreamSource(tok);
    const node = new AudioWorkletNode(ctx, 'glas-mikrofon');
    const nic = ctx.createGain();
    nic.gain.value = 0;
    vir.connect(node);
    node.connect(nic);
    nic.connect(ctx.destination); // brez tega nekateri brskalniki ne poganjajo worklet-a
    const tisina = new ArrayBuffer(3200);
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (!this.stt || this.stt.readyState !== 1) return;
      // Polovični dupleks: asistent ne sme slišati sebe.
      this.stt.send(this.s === 'poslusam' ? e.data : tisina);
      this.sekundeZvoka += 0.1;
    };
  }

  // ───────────────────────────── poslušanje ─────────────────────────────

  private sttSporocilo(podatki: unknown) {
    if (typeof podatki !== 'string') return;
    let m: { tokens?: SonioxZeton[]; error_code?: number; error_message?: string; finished?: boolean };
    try {
      m = JSON.parse(podatki);
    } catch {
      return;
    }
    if (m.error_code) {
      this.koncaj(SPOROCILA.razpoznava);
      return;
    }
    if (!m.tokens?.length) return;
    if (this.s !== 'poslusam') {
      // Kar pride med razmišljanjem/govorom (tišina, zakasnjeni žetoni), zavržemo.
      this.sestavljalec.dodaj(m.tokens);
      this.sestavljalec.pocisti();
      return;
    }
    const r = this.sestavljalec.dodaj(m.tokens);
    if (r.imaGovor) {
      this.ustaviTisino();
      if (this.cakanje) {
        clearTimeout(this.cakanje); // nadaljuje po kratkem premoru
        this.cakanje = null;
      }
      const prej = this.cakajoca ? `${this.cakajoca} ` : '';
      this.d.slisano(`${prej}${this.sestavljalec.trenutno}`.trim());
    }
    if (r.izjava) {
      this.tKonec = performance.now();
      this.cakajoca = this.cakajoca ? `${this.cakajoca} ${r.izjava}` : r.izjava;
      if (this.cakanje) clearTimeout(this.cakanje);
      this.cakanje = setTimeout(() => {
        this.cakanje = null;
        const izjava = this.cakajoca;
        this.cakajoca = null;
        if (izjava && this.s === 'poslusam') void this.obdelaj(izjava);
      }, POCAKAJ_PO_KONCU_MS);
    }
  }

  private poslusaj(tisinaMs: number) {
    if (!this.aktiven) return;
    this.sestavljalec.pocisti();
    this.cakajoca = null;
    this.nastavi('poslusam');
    this.ustaviTisino();
    this.tisina = setTimeout(() => {
      if (this.s === 'poslusam' && !this.cakajoca) this.koncaj(null);
    }, tisinaMs);
  }

  private ustaviTisino() {
    if (this.tisina) clearTimeout(this.tisina);
    this.tisina = null;
  }

  // ───────────────────────────── ukaz ─────────────────────────────

  private async obdelaj(izjava: string, izbira?: { id: string; oznaka: string }) {
    this.ustaviTisino();
    this.d.izjava(izjava);
    this.nastavi('razmisljam');
    this.ton(660);

    // Odprt predlog: kratek "ja"/"ne" ga potrdi/zavrne; vse drugo je nov ukaz.
    const p = this.predlog;
    if (p && !izbira) {
      if (jePotrditev(izjava)) return this.potrdi(p);
      if (jeZavrnitev(izjava)) return this.zavrni(p);
    }
    this.predlog = null;
    if (!izbira) {
      const lokalno = this.d.lokalno?.(izjava);
      if (lokalno) {
        this.vprasanje = null;
        this.d.odgovor({ ok: true, status: 'odgovor', odgovor: lokalno });
        await this.povej(lokalno, performance.now());
        return;
      }
    }
    const moznost = izbira ?? (this.vprasanje?.moznosti?.length ? izberiMoznost(izjava, this.vprasanje.moznosti) : null);

    const sekunde = Math.round(this.sekundeZvoka * 10) / 10;
    this.sekundeZvoka = 0;
    const odgovor = await this.zahtevaj<OdgovorOdjemalec>('/api/glas/ukaz', {
      besedilo: izjava,
      prejsnji: this.zadnjiUkaz,
      izbira: moznost,
      stt: this.stt ? { sekunde } : undefined,
      glas: Boolean(this.tts),
    });
    const tOdgovor = performance.now();
    if (!odgovor.ok) {
      this.vprasanje = null;
      this.d.napaka(odgovor.sporocilo ?? SPOROCILA.povezava);
      await this.povej(odgovor.sporocilo ?? SPOROCILA.povezava, tOdgovor);
      return;
    }
    this.zadnjiUkaz = odgovor.ukazId ?? null;
    this.predlog = odgovor.status === 'predlog' ? (odgovor.predlog ?? null) : null;
    this.vprasanje = odgovor.status === 'vprasanje' ? (odgovor.vprasanje ?? null) : null;
    this.d.odgovor(odgovor);
    await this.povej(odgovor.govor ?? odgovor.odgovor ?? '', tOdgovor);
  }

  private async potrdi(p: PredlogOdjemalec) {
    this.nastavi('razmisljam');
    this.predlog = null;
    const r = await this.zahtevaj<{ ok: boolean; sporocilo?: string }>('/api/glas/potrdi', { predlog: p.id, zeton: p.zeton });
    const sporocilo = r.sporocilo ?? (r.ok ? 'Shranjeno.' : 'Ni uspelo. Nič ni bilo spremenjeno.');
    this.d.potrditev({ ok: r.ok, sporocilo });
    await this.povej(sporocilo, performance.now());
  }

  private async zavrni(p: PredlogOdjemalec) {
    this.predlog = null;
    void this.zahtevaj('/api/glas/zavrni', { predlog: p.id });
    const sporocilo = 'Preklicano. Nič ni bilo spremenjeno.';
    this.d.potrditev({ ok: true, sporocilo });
    await this.povej(sporocilo, performance.now());
  }

  private async zahtevaj<T extends { ok: boolean; sporocilo?: string }>(url: string, telo: unknown): Promise<T> {
    this.zahteva?.abort();
    const ctrl = new AbortController();
    this.zahteva = ctrl;
    const t = setTimeout(() => ctrl.abort(), ZAHTEVA_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
        signal: ctrl.signal,
      });
      const j = (await r.json().catch(() => null)) as T | null;
      if (!j) return { ok: false, sporocilo: `${SPOROCILA.nerazumljiv} (${r.status})` } as T;
      return j;
    } catch (e) {
      const casovna = e instanceof DOMException && e.name === 'AbortError';
      return { ok: false, sporocilo: casovna ? SPOROCILA.casovna : SPOROCILA.povezava } as T;
    } finally {
      clearTimeout(t);
      if (this.zahteva === ctrl) this.zahteva = null;
    }
  }

  // ───────────────────────────── govor ─────────────────────────────

  private async povej(besedilo: string, tOdgovor: number) {
    const tKonec = this.tKonec;
    const meri = (zvok: number | null) => this.d.meritev({ doOdgovora: Math.round(tOdgovor - tKonec), doZvoka: zvok === null ? null : Math.round(zvok - tKonec) });
    if (!this.aktiven) {
      meri(null);
      return;
    }
    if (!besedilo || !this.tts || this.tts.readyState !== 1 || !this.izhod || !this.seja) {
      meri(null);
      // Brez odprtega pogovora (besedilni vnos, gumb) ni kaj poslušati.
      if (this.stt) this.poslusaj(this.tisinaPoOdgovoru);
      else this.nastavi('mirovanje');
      return;
    }
    // Varovalka, če obnova v ozadju ni uspela (npr. zaspan zavihek).
    if (performance.now() - this.sejaCas > 55000 && !(await this.obnoviTtsKljuc())) {
      meri(null);
      this.poslusaj(this.tisinaPoOdgovoru);
      return;
    }
    const seja = this.seja!;
    this.nastavi('govorim');
    const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.govorId = id;
    this.naslednjiCas = 0;
    let izmerjeno = false;
    await new Promise<void>((resolve) => {
      let koncano = false;
      this.koncajGovor = () => {
        if (koncano) return;
        koncano = true;
        this.koncajGovor = null;
        if (!izmerjeno) meri(null);
        resolve();
      };
      this.prviZvok = () => {
        if (!izmerjeno) {
          izmerjeno = true;
          meri(performance.now());
        }
      };
      this.tts!.send(
        JSON.stringify({
          api_key: seja.tts.kljuc,
          model: seja.tts.model,
          language: seja.jezik,
          voice: seja.tts.glas,
          audio_format: 'pcm_s16le',
          sample_rate: TTS_HZ,
          speed: seja.tts.hitrost,
          stream_id: id,
        })
      );
      this.tts!.send(JSON.stringify({ stream_id: id, text: besedilo }));
      this.tts!.send(JSON.stringify({ stream_id: id, text_end: true }));
      // Varovalka: govor nikoli ne obvisi (npr. izgubljen "terminated").
      setTimeout(() => {
        if (this.govorId === id) this.koncajGovor?.();
      }, 30000);
    });
    if (this.s === 'govorim') this.poslusaj(this.tisinaPoOdgovoru);
  }

  private prviZvok: (() => void) | null = null;

  private ttsSporocilo(podatki: unknown) {
    if (typeof podatki !== 'string') return;
    let m: { stream_id?: string; audio?: string; terminated?: boolean; error_code?: number };
    try {
      m = JSON.parse(podatki);
    } catch {
      return;
    }
    if (!m.stream_id || m.stream_id !== this.govorId) return;
    if (m.error_code) {
      this.koncajGovor?.();
      return;
    }
    if (m.audio && this.izhod) {
      const bin = atob(m.audio);
      const bajti = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bajti[i] = bin.charCodeAt(i);
      const vzorci = pcmVFloat(bajti);
      if (vzorci.length) {
        const buf = this.izhod.createBuffer(1, vzorci.length, TTS_HZ);
        buf.getChannelData(0).set(vzorci);
        const vir = this.izhod.createBufferSource();
        vir.buffer = buf;
        vir.connect(this.izhod.destination);
        const zacetek = Math.max(this.izhod.currentTime + 0.02, this.naslednjiCas);
        vir.start(zacetek);
        this.naslednjiCas = zacetek + buf.duration;
        this.viri.push(vir);
        vir.onended = () => {
          this.viri = this.viri.filter((x) => x !== vir);
        };
        this.prviZvok?.();
      }
    }
    if (m.terminated) {
      // Počakamo, da se predvaja do konca (+ kratek rep, da odmev utihne).
      const ostane = this.izhod ? Math.max(0, this.naslednjiCas - this.izhod.currentTime) : 0;
      setTimeout(() => {
        if (this.govorId === m.stream_id) this.koncajGovor?.();
      }, ostane * 1000 + 200);
    }
  }

  private utisaj() {
    if (this.govorId && this.tts?.readyState === 1) this.tts.send(JSON.stringify({ stream_id: this.govorId, cancel: true }));
    this.govorId = null;
    for (const v of this.viri) {
      try {
        v.stop();
      } catch {
        /* že ustavljen */
      }
    }
    this.viri = [];
    this.koncajGovor?.();
  }

  /** Kratek ton (začetek poslušanja, slišal sem). */
  private ton(hz: number) {
    const ctx = this.izhod;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.1);
    } catch {
      /* ton ni nujen */
    }
  }

  // ───────────────────────────── konec ─────────────────────────────

  private nastavi(s: StanjePogovora) {
    this.s = s;
    this.d.stanje(s);
  }

  private koncaj(napaka: string | null) {
    const bilAktiven = this.aktiven;
    this.ustaviTisino();
    if (this.cakanje) clearTimeout(this.cakanje);
    this.cakanje = null;
    this.zahteva?.abort();
    if (this.ttsZiv) clearInterval(this.ttsZiv);
    this.ttsZiv = null;
    if (this.ttsObnova) clearInterval(this.ttsObnova);
    this.ttsObnova = null;
    this.utisaj();
    const stt = this.stt;
    const tts = this.tts;
    this.stt = null;
    this.tts = null;
    try {
      if (stt?.readyState === 1) stt.send('');
      stt?.close();
    } catch {
      /* zapiramo */
    }
    try {
      tts?.close();
    } catch {
      /* zapiramo */
    }
    this.tok?.getTracks().forEach((t) => t.stop());
    this.tok = null;
    void this.vhod?.close().catch(() => {});
    this.vhod = null;
    const izhod = this.izhod;
    this.izhod = null;
    // Izhod zapremo malo kasneje, da se zadnji ton ne odreže.
    setTimeout(() => void izhod?.close().catch(() => {}), 300);
    this.seja = null;
    this.predlog = null;
    this.vprasanje = null;
    this.sekundeZvoka = 0;
    this.sestavljalec.pocisti();
    this.cakajoca = null;
    this.nastavi('mirovanje');
    if (napaka && (bilAktiven || napaka)) this.d.napaka(napaka);
  }
}

class NapakaPogovora extends Error {}
