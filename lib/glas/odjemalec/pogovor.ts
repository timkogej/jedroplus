// lib/glas/odjemalec/pogovor.ts
//
// Sprotni glasovni pogovor v brskalniku (arhitektura A iz docs/glasovni-asistent-faza0.md):
//
//   gumb → /api/glas/seja (pravice, kvota, kratkotrajna Soniox ključa, namigi)
//        → mikrofon → Soniox STT (WebSocket, neposredno) → konec govora
//        → /api/glas/ukaz (besedilo; AI in podatki z uporabnikovo sejo, RLS)
//        → `govor` → Soniox TTS (WebSocket, glas Nina) → zvočnik
//        → spet posluša (nadaljevanje pogovora), po tišini se zapre.
//
// Zvok ne gre prek našega strežnika. Pisanje gre vedno prek predloga z žetonom
// ali obrazca, ki ga uporabnik shrani; glasovni "ja" samo pokliče isto pot kot gumb.
//
// Poln dupleks (docs/glasovni-asistent-pogovor.md): mikrofon gre v STT ves čas.
//   * Konec izjave: Soniox <end> + čakanje po vsebini (tok.cakanjePoKoncu).
//   * Med razmišljanjem: če uporabnik nadaljuje, se zahteva prekliče, izjavi se združita.
//   * Med govorom: prava prekinitev (tok.jePrekinitev) asistenta utiša; lasten odmev ne.
//   * Kar Soniox prepiše iz zvoka med govorom asistenta (+ kratek rep), ne gre v izjavo.
// Ne zapisuje prepisov v konzolo (osebni podatki).

import { izberiMoznost, jePotrditev, jeZavrnitev, pcmVFloat, SestavljalecIzjave, type SonioxZeton } from './besede';
import {
  besedeGovora,
  cakanjePoKoncu,
  jeNadaljevanje,
  jePrekinitev,
  lokalniOdziv,
  NAMIGI_CAKANJA,
  napakaZaGovor,
  odstraniOdmev,
  rms,
} from './tok';

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

/** Izjavo obdela vmesnik sam (npr. "shrani" v obrazcu): izgovori `govor` ali počaka na izid. */
export type LokalniOdziv = { govor: string } | { caka: true };

export interface DogodkiPogovora {
  stanje(s: StanjePogovora): void;
  /** Sproten prepis tega, kar uporabnik govori. */
  slisano(besedilo: string): void;
  /** Izjava je zaključena in poslana. Ob nadaljevanju pride znova, daljša (vsebuje prejšnjo). */
  izjava(besedilo: string): void;
  odgovor(o: OdgovorOdjemalec): void;
  /** Rezultat potrditve ali zavrnitve predloga. */
  potrditev(o: { ok: boolean; sporocilo: string }): void;
  /** Napaka, ki jo mora uporabnik videti (in jo tudi sliši, če glas deluje). */
  napaka(sporocilo: string): void;
  meritev(m: Meritev): void;
  /** Čas zagona: do poslušanja (mikrofon prižgan) in do povezave z razpoznavo. */
  zacetek?(m: { doPoslusanja: number; doPovezave: number; sejaVnaprej: boolean }): void;
  /** Lokalno obdelana izjava (shrani/prekliči v obrazcu); null = gre na strežnik. */
  lokalno?(izjava: string): LokalniOdziv | string | null;
  /** Asistent je izgovoril besedilo, ki ni odgovor strežnika (izid shranjevanja, "Prosim."). */
  obvestilo?(besedilo: string): void;
}

interface Seja {
  ok: boolean;
  sporocilo?: string;
  jezik: string;
  stt: { url: string; kljuc: string; model: string; namigi: string[]; najdaljsiKonecMs: number };
  tts: { url: string; kljuc: string; model: string; glas: string; hitrost: number };
  opozorilo?: string | null;
  /** Veljavnost ključev v sekundah (strežnik; privzeto 60). */
  veljaS?: number;
}

/** Po odgovoru posluša še toliko časa, nato se pogovor zapre. */
const TISINA_PO_ODGOVORU_MS = 8000;
const TISINA_NA_ZACETKU_MS = 12000;
/** Po "hvala" je pogovor verjetno končan: zapre se prej. */
const TISINA_PO_ZAHVALI_MS = 4000;
/** Zgodovina pogovora: zadnjih toliko ukazov, če je od zadnjega manj kot 5 minut (enako preverja strežnik). */
const ZGODOVINA_NAJVEC = 6;
const ZGODOVINA_VELJA_MS = 5 * 60_000;
const ZAHTEVA_TIMEOUT_MS = 20000;
/** Če odgovor zamuja toliko, asistent reče "Moment." (pripravljeno vnaprej). */
const NAMIG_PO_MS = 2500;
/** Med dvema namigoma čakanja vsaj toliko (da ne zveni kot posnetek). */
const NAMIG_PREMOR_MS = 20_000;
/** Vmesnik javi izid lokalnega dejanja (npr. shranjevanja obrazca) v tem času. */
const LOKALNO_CAKA_MS = 15_000;
/** Seja (ključa) mora imeti ob uporabi še vsaj toliko veljavnosti. */
const SEJA_REZERVA_MS = 60_000;
/** Po neuspeli pripravi vnaprej (npr. izklopljeno) ne poskušamo znova toliko časa. */
const PRIPRAVA_PREMOR_MS = 60_000;
/** Največ toliko zvoka (okvirji po 100 ms) hranimo, dokler se razpoznava ne poveže. */
const NAJVEC_CAKAJOCEGA_ZVOKA = 150;
/** Okvir mikrofona = 100 ms zvoka (public/glas/mikrofon-worklet.js). */
const OKVIR_MS = 100;
/** Prepis zvoka do toliko po koncu asistentovega govora je odmev (zvočnik → mikrofon). */
const REP_ODMEVA_MS = 350;
/** Glasnost za prekinitev: največja v zadnjih toliko okvirjih. */
const GLASNOST_OKVIRJEV = 6;
/** Razpoznava se ob prekinitvi poveže znova največ tolikokrat na minuto. */
const NAJVEC_OBNOV_STT = 2;
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
  /** Seja, pripravljena vnaprej (ključa veljata več minut, isti ključ odpre več povezav). */
  private zaloga: { seja: Seja; cas: number; ttsCas: number } | null = null;
  private nalaganje: Promise<Seja> | null = null;
  private pripravaNeuspelaDo = 0;
  /** Zvok, posnet preden je razpoznava povezana (uporabnik lahko govori takoj). */
  private zvokCaka: ArrayBuffer[] = [];
  private tok: MediaStream | null = null;
  private vhod: AudioContext | null = null;
  private izhod: AudioContext | null = null;
  private stt: WebSocket | null = null;
  private tts: WebSocket | null = null;
  private ttsOdpiranje: Promise<void> | null = null;
  private ttsZiv: ReturnType<typeof setInterval> | null = null;
  private ttsObnova: ReturnType<typeof setInterval> | null = null;
  private tisina: ReturnType<typeof setTimeout> | null = null;
  private cakanje: ReturnType<typeof setTimeout> | null = null;
  private namigCasovnik: ReturnType<typeof setTimeout> | null = null;
  private lokalnoCasovnik: ReturnType<typeof setTimeout> | null = null;
  private sestavljalec = new SestavljalecIzjave();
  /** Kar Soniox prepiše med asistentovim govorom (odmev ali prekinitev). */
  private medGovorom = new SestavljalecIzjave();
  private cakajoca: string | null = null;
  /** Zadnja poslana izjava (za združitev, če uporabnik med razmišljanjem nadaljuje). */
  private zadnjaIzjava: string | null = null;
  private tKonec = 0;
  private sekundeZvoka = 0;
  /** Položaj v zvoku trenutne STT povezave (ms; Soniox `end_ms` je v isti časovnici). */
  private polozajMs = 0;
  /** Žetoni, ki se končajo pred tem položajem, so odmev asistentovega glasu. */
  private odmevDo = 0;
  private zadnjiKonecZetona = 0;
  private glasnosti: number[] = [];
  private govorBesede: Set<string> = new Set();
  private obnoveStt: number[] = [];
  /** ID-ji zadnjih ukazov tega pogovora (strežnik iz njih sestavi zgodovino). */
  private zgodovina: string[] = [];
  private zadnjiCas = 0;
  private predlog: PredlogOdjemalec | null = null;
  private vprasanje: VprasanjeOdjemalec | null = null;
  private govorId: string | null = null;
  private viri: AudioBufferSourceNode[] = [];
  /** Samo za vmesnik (utrip krogca): glasnost asistentovega glasu. Ne vpliva na zvok. */
  private analiza: AnalyserNode | null = null;
  private analizaVzorci: Float32Array<ArrayBuffer> | null = null;
  private naslednjiCas = 0;
  private koncajGovor: (() => void) | null = null;
  private zahteva: AbortController | null = null;
  /** Namigi čakanja ("Moment."), sintetizirani enkrat na pogovor-objekt. */
  private namigi: Float32Array[] = [];
  private namigiPriprava = new Map<string, Float32Array[]>();
  private namigiZahtevani = false;
  private zadnjiNamig = 0;
  private namigIndeks = 0;

  /** Koliko časa po odgovoru še posluša (daljše, ko je odprt obrazec za pregled). */
  tisinaPoOdgovoru = TISINA_PO_ODGOVORU_MS;
  /** Obrazec, ki ga je odprl asistent in je še odprt (nastavi vmesnik). */
  kontekstObrazca: { vrsta: string; polja: Record<string, string> } | null = null;

  constructor(private d: DogodkiPogovora) {}

  get stanje() {
    return this.s;
  }

  get aktiven() {
    return this.s !== 'mirovanje';
  }

  /**
   * Glasnost za vmesnik (0–~0,3 RMS): `vhod` = mikrofon (zadnji okvir 100 ms),
   * `izhod` = asistentov glas. Samo branje; na pogovor ne vpliva.
   */
  glasnost(): { vhod: number; izhod: number } {
    const vhod = this.glasnosti.length ? this.glasnosti[this.glasnosti.length - 1] : 0;
    let izhod = 0;
    const a = this.analiza;
    if (a && this.analizaVzorci && this.viri.length) {
      a.getFloatTimeDomainData(this.analizaVzorci);
      let v = 0;
      for (let i = 0; i < this.analizaVzorci.length; i++) v += this.analizaVzorci[i] * this.analizaVzorci[i];
      izhod = Math.sqrt(v / this.analizaVzorci.length);
    }
    return { vhod, izhod };
  }

  /**
   * Pripravi sejo vnaprej (ključa, namigi), da je pogovor ob tapu takoj pripravljen.
   * Kliče jo vmesnik, ko se gumb pokaže, ob prihodu miške in na dotik. Brez mikrofona.
   */
  pripravi(): void {
    if (this.svezaZaloga() || this.nalaganje || Date.now() < this.pripravaNeuspelaDo) return;
    this.pridobiSejo().catch(() => {
      this.pripravaNeuspelaDo = Date.now() + PRIPRAVA_PREMOR_MS;
    });
    ogrejPovezave();
  }

  /** Mora biti klicano iz dotika/klika (iOS dovoli zvok samo takrat). */
  async zacni(): Promise<void> {
    if (this.aktiven) return;
    const t0 = performance.now();
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
    this.pripraviAnalizo(this.izhod);
    void this.izhod.resume();
    void this.vhod.resume();

    const sejaVnaprej = Boolean(this.svezaZaloga());
    const sejaP = this.vzemiSejo();
    sejaP.catch(() => {}); // obravnavano spodaj
    try {
      // Mikrofon in zvočni modul; seja (če ni pripravljena) se nalaga vzporedno.
      const [tok] = await Promise.all([
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
      // Poslušamo takoj: zvok se hrani, dokler se razpoznava ne poveže, nato gre v
      // celoti naprej. Uporabniku ni treba čakati na povezavo.
      this.tok = tok;
      this.zvokCaka = [];
      this.povezMikrofon(tok);
      this.mehakNamig();
      this.poslusaj(TISINA_NA_ZACETKU_MS);
      const doPoslusanja = Math.round(performance.now() - t0);

      const seja = await sejaP;
      if (!this.aktiven) return;
      this.seja = seja;
      await this.odpriStt(seja);
      if (!this.aktiven) return;
      this.d.zacetek?.({ doPoslusanja, doPovezave: Math.round(performance.now() - t0), sejaVnaprej });
      // Glas ni nujen za poslušanje: odpre se v ozadju.
      void this.odpriTts(seja);
      const veljaMs = (seja.veljaS ?? 60) * 1000;
      this.ttsObnova = setInterval(() => void this.obnoviTtsKljuc(), Math.max(30_000, veljaMs - SEJA_REZERVA_MS));
      if (seja.opozorilo) this.d.napaka(seja.opozorilo);
    } catch (e) {
      // Uporabnik je medtem sam končal: brez sporočila o napaki.
      if (this.aktiven) this.koncaj(e instanceof NapakaPogovora ? e.message : SPOROCILA.povezava);
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

  /**
   * Vmesnik pove nekaj sam (izid shranjevanja obrazca, "Obvestim stranko?"), nato
   * asistent posluša naprej. Ne prekine uporabnika, ki ravno govori.
   */
  async povejObvestilo(besedilo: string, tisinaMs?: number) {
    if (!this.aktiven || !besedilo) return;
    if (this.s === 'poslusam' && (this.cakajoca || this.sestavljalec.trenutno)) return;
    this.pocistiLokalno();
    if (this.s === 'govorim') this.utisaj();
    this.d.obvestilo?.(besedilo);
    this.tKonec = performance.now();
    await this.povej(besedilo, performance.now(), tisinaMs);
  }

  // ───────────────────────────── povezave ─────────────────────────────

  private svezaZaloga(): Seja | null {
    const z = this.zaloga;
    if (!z) return null;
    const veljaMs = (z.seja.veljaS ?? 60) * 1000;
    return Date.now() - z.cas < veljaMs - SEJA_REZERVA_MS ? z.seja : null;
  }

  /** Pripravljena seja, seja, ki se že nalaga, ali nova. */
  private vzemiSejo(): Promise<Seja> {
    const z = this.svezaZaloga();
    if (z) return Promise.resolve(z);
    return this.nalaganje ?? this.pridobiSejo();
  }

  private pridobiSejo(): Promise<Seja> {
    const p = this.naloziSejo().finally(() => {
      if (this.nalaganje === p) this.nalaganje = null;
    });
    this.nalaganje = p;
    return p;
  }

  private async naloziSejo(): Promise<Seja> {
    let r: Response;
    try {
      r = await fetch('/api/glas/seja', { method: 'POST', cache: 'no-store' });
    } catch {
      throw new NapakaPogovora(SPOROCILA.povezava);
    }
    const j = (await r.json().catch(() => null)) as Seja | null;
    if (!j) throw new NapakaPogovora(SPOROCILA.nerazumljiv);
    if (!j.ok) throw new NapakaPogovora(j.sporocilo ?? SPOROCILA.povezava);
    this.zaloga = { seja: j, cas: Date.now(), ttsCas: Date.now() };
    this.pripravaNeuspelaDo = 0;
    return j;
  }

  /** Nov ključ za glas (stari po 60 s ne velja več za nov govor). */
  private async obnoviTtsKljuc(): Promise<boolean> {
    try {
      const r = await fetch('/api/glas/seja', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ samo: 'tts' }), cache: 'no-store' });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; tts?: { kljuc?: string } } | null;
      if (!j?.ok || !j.tts?.kljuc || !this.seja) return false;
      this.seja.tts.kljuc = j.tts.kljuc;
      if (this.zaloga?.seja === this.seja) this.zaloga.ttsCas = Date.now();
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
        // Nova povezava = nova časovnica zvoka (Soniox end_ms začne pri 0).
        this.polozajMs = 0;
        this.odmevDo = 0;
        this.zadnjiKonecZetona = 0;
        // Zvok, posnet med povezovanjem, gre naprej v pravem vrstnem redu.
        for (const okvir of this.zvokCaka) {
          ws.send(okvir);
          this.polozajMs += OKVIR_MS;
        }
        this.sekundeZvoka += this.zvokCaka.length * 0.1;
        this.zvokCaka = [];
        resolve();
      };
      ws.onmessage = (e) => this.sttSporocilo(e.data);
      ws.onerror = () => {
        clearTimeout(t);
        reject(new NapakaPogovora(SPOROCILA.povezava));
      };
      ws.onclose = () => {
        if (this.stt === ws && this.aktiven) void this.obnoviStt();
      };
      this.stt = ws;
    });
  }

  /**
   * Razpoznava se je prekinila (omrežje, Soniox): poveži znova, pogovor teče naprej.
   * Zvok se med tem hrani. Po več neuspehih v minuti se pogovor zapre.
   */
  private async obnoviStt() {
    const zdaj = Date.now();
    this.obnoveStt = this.obnoveStt.filter((t) => zdaj - t < 60_000);
    const stara = this.stt;
    this.stt = null;
    try {
      stara?.close();
    } catch {
      /* že zaprta */
    }
    if (this.obnoveStt.length >= NAJVEC_OBNOV_STT) {
      this.koncaj(SPOROCILA.razpoznava);
      return;
    }
    this.obnoveStt.push(zdaj);
    this.sestavljalec.pocisti();
    this.medGovorom.pocisti();
    try {
      const seja = this.svezaZaloga() ?? (await this.pridobiSejo());
      if (!this.aktiven) return;
      if (!this.seja) this.seja = seja;
      await this.odpriStt(seja);
    } catch {
      if (this.aktiven) this.koncaj(SPOROCILA.razpoznava);
    }
  }

  private odpriTts(seja: Seja): Promise<void> {
    if (this.ttsOdpiranje) return this.ttsOdpiranje;
    const p = new Promise<void>((resolve) => {
      const ws = new WebSocket(seja.tts.url);
      // Glas ni nujen: brez njega je odgovor še vedno na zaslonu.
      const t = setTimeout(() => resolve(), 6000);
      ws.onopen = () => {
        clearTimeout(t);
        if (this.ttsZiv) clearInterval(this.ttsZiv);
        this.ttsZiv = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ keep_alive: true })), 5000);
        this.pripraviNamige();
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
    }).finally(() => {
      this.ttsOdpiranje = null;
    });
    this.ttsOdpiranje = p;
    return p;
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
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      // Glasnost (za prekinitev): samo zadnjih nekaj okvirjev.
      this.glasnosti.push(rms(new Int16Array(e.data, 0, Math.floor(e.data.byteLength / 2))));
      if (this.glasnosti.length > GLASNOST_OKVIRJEV) this.glasnosti.shift();
      if (!this.stt || this.stt.readyState !== 1) {
        // Razpoznava se (znova) povezuje: hrani zvok.
        if (this.aktiven && this.zvokCaka.length < NAJVEC_CAKAJOCEGA_ZVOKA) this.zvokCaka.push(e.data);
        return;
      }
      // Poln dupleks: mikrofon gre v STT tudi med govorom (prekinitev z glasom);
      // odmev loči logika v sttSporocilo.
      this.stt.send(e.data);
      this.polozajMs += OKVIR_MS;
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
      void this.obnoviStt();
      return;
    }
    if (!m.tokens?.length) return;
    for (const z of m.tokens) if (z.end_ms && z.end_ms > this.zadnjiKonecZetona) this.zadnjiKonecZetona = z.end_ms;

    if (this.s === 'govorim') {
      this.medGovorom.dodaj(m.tokens);
      const slisano = this.medGovorom.trenutno;
      const glasnost = Math.max(0, ...this.glasnosti);
      if (slisano && jePrekinitev({ slisano, govor: this.govorBesede, glasnost })) this.prekiniZGlasom(slisano);
      return;
    }
    if (this.s !== 'poslusam' && this.s !== 'razmisljam') return;

    // Odmev konca asistentovega govora (in namiga "Moment.") ne gre v izjavo.
    const zetoni = m.tokens.filter((z) => z.text === '<end>' || z.end_ms === undefined || z.end_ms > this.odmevDo);
    const r = this.sestavljalec.dodaj(zetoni);

    if (this.s === 'razmisljam') {
      // Uporabnik nadaljuje, preden je asistent spregovoril: preklic in združitev.
      if (this.zahteva && this.zadnjaIzjava && jeNadaljevanje(this.sestavljalec.trenutno)) {
        this.nadaljujIzjavo();
      } else {
        this.sestavljalec.pocisti();
        return;
      }
    }

    if (r.imaGovor) {
      this.ustaviTisino();
      if (this.cakanje) {
        clearTimeout(this.cakanje); // nadaljuje po premoru
        this.cakanje = null;
      }
      const prej = this.cakajoca ? `${this.cakajoca} ` : '';
      this.d.slisano(`${prej}${this.sestavljalec.trenutno}`.trim());
    }
    if (r.izjava) {
      this.tKonec = performance.now();
      this.cakajoca = this.cakajoca ? `${this.cakajoca} ${r.izjava}` : r.izjava;
      if (this.cakanje) clearTimeout(this.cakanje);
      // Po vsebini: "… ob" počaka dlje, "ja" skoraj takoj (docs/glasovni-asistent-pogovor.md).
      this.cakanje = setTimeout(() => {
        this.cakanje = null;
        const izjava = this.cakajoca;
        this.cakajoca = null;
        if (izjava && this.s === 'poslusam') void this.obdelaj(izjava);
      }, cakanjePoKoncu(this.cakajoca));
    }
  }

  /** Med razmišljanjem je uporabnik nadaljoval: zahteva se prekliče, izjava se nadaljuje. */
  private nadaljujIzjavo() {
    this.zahteva?.abort();
    this.zahteva = null;
    this.ustaviNamig();
    this.cakajoca = this.zadnjaIzjava;
    this.zadnjaIzjava = null;
    this.nastavi('poslusam');
  }

  /** Uporabnik je asistenta prekinil z glasom: utihni, njegove besede so začetek nove izjave. */
  private prekiniZGlasom(slisano: string) {
    const govor = this.govorBesede;
    this.utisaj();
    this.poslusaj(this.tisinaPoOdgovoru);
    // Kar je že prepisano, je obdelano; nove besede gredo v izjavo.
    this.odmevDo = this.zadnjiKonecZetona;
    const zacetek = odstraniOdmev(slisano, govor);
    this.sestavljalec.nastavi(zacetek);
    if (zacetek) {
      this.ustaviTisino();
      this.d.slisano(zacetek);
    }
  }

  private poslusaj(tisinaMs: number) {
    if (!this.aktiven) return;
    this.sestavljalec.pocisti();
    this.medGovorom.pocisti();
    this.cakajoca = null;
    this.nastavi('poslusam');
    this.ustaviTisino();
    this.tisina = setTimeout(() => {
      if (this.s === 'poslusam' && !this.cakajoca && !this.sestavljalec.trenutno) this.koncaj(null);
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
    this.zadnjaIzjava = null;

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
        const o: LokalniOdziv = typeof lokalno === 'string' ? { govor: lokalno } : lokalno;
        if ('caka' in o) {
          // Vmesnik izid sporoči s povejObvestilo (npr. "Shranjeno."); varovalka za vsak primer.
          this.lokalnoCasovnik = setTimeout(() => {
            this.lokalnoCasovnik = null;
            if (this.s === 'razmisljam') this.poslusaj(this.tisinaPoOdgovoru);
          }, LOKALNO_CAKA_MS);
          return;
        }
        this.d.odgovor({ ok: true, status: 'odgovor', odgovor: o.govor });
        await this.povej(o.govor, performance.now());
        return;
      }
      const kratko = lokalniOdziv(izjava);
      if (kratko) {
        this.d.obvestilo?.(kratko.govor);
        await this.povej(kratko.govor, performance.now(), kratko.vrsta === 'zahvala' ? TISINA_PO_ZAHVALI_MS : undefined);
        if (kratko.vrsta === 'konec') this.koncaj(null);
        return;
      }
    }
    const moznost = izbira ?? (this.vprasanje?.moznosti?.length ? izberiMoznost(izjava, this.vprasanje.moznosti) : null);

    const sekunde = Math.round(this.sekundeZvoka * 10) / 10;
    this.sekundeZvoka = 0;
    // Če uporabnik nadaljuje, preden pride odgovor, se ta zahteva prekliče (nadaljujIzjavo).
    if (!izbira) this.zadnjaIzjava = izjava;
    this.zacniNamig();
    const odgovor = await this.zahtevaj<OdgovorOdjemalec>('/api/glas/ukaz', {
      besedilo: izjava,
      prejsnji: Date.now() - this.zadnjiCas < ZGODOVINA_VELJA_MS ? this.zgodovina : [],
      obrazec: this.kontekstObrazca ?? undefined,
      izbira: moznost,
      stt: this.stt ? { sekunde } : undefined,
      glas: Boolean(this.tts),
    });
    // Preklicano zaradi nadaljevanja (ali konca pogovora): odgovor ne velja več.
    if (odgovor.koda === 'preklicano' || this.s !== 'razmisljam') return;
    this.zadnjaIzjava = null;
    this.ustaviNamig();
    const tOdgovor = performance.now();
    if (!odgovor.ok) {
      this.vprasanje = null;
      const sporocilo = odgovor.sporocilo ?? SPOROCILA.povezava;
      this.d.napaka(sporocilo);
      // Kratko in posluša naprej (pogovor se ne zapre).
      await this.povej(napakaZaGovor(sporocilo), tOdgovor);
      return;
    }
    if (Date.now() - this.zadnjiCas >= ZGODOVINA_VELJA_MS) this.zgodovina = [];
    if (odgovor.ukazId) this.zgodovina = [...this.zgodovina, odgovor.ukazId].slice(-ZGODOVINA_NAJVEC);
    this.zadnjiCas = Date.now();
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
    await this.povej(r.ok ? sporocilo : napakaZaGovor(sporocilo), performance.now());
  }

  private async zavrni(p: PredlogOdjemalec) {
    this.predlog = null;
    void this.zahtevaj('/api/glas/zavrni', { predlog: p.id });
    this.d.potrditev({ ok: true, sporocilo: 'Preklicano. Nič ni bilo spremenjeno.' });
    await this.povej('Prav, preklicano.', performance.now());
  }

  private async zahtevaj<T extends { ok: boolean; sporocilo?: string; koda?: string }>(url: string, telo: unknown): Promise<T> {
    this.zahteva?.abort();
    const ctrl = new AbortController();
    this.zahteva = ctrl;
    let casovna = false;
    const t = setTimeout(() => {
      casovna = true;
      ctrl.abort();
    }, ZAHTEVA_TIMEOUT_MS);
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
      const prekinjeno = e instanceof DOMException && e.name === 'AbortError';
      if (prekinjeno && !casovna) return { ok: false, koda: 'preklicano' } as T;
      return { ok: false, sporocilo: prekinjeno ? SPOROCILA.casovna : SPOROCILA.povezava } as T;
    } finally {
      clearTimeout(t);
      if (this.zahteva === ctrl) this.zahteva = null;
    }
  }

  // ───────────────────────────── govor ─────────────────────────────

  private async povej(besedilo: string, tOdgovor: number, tisinaMs = this.tisinaPoOdgovoru) {
    const tKonec = this.tKonec;
    const meri = (zvok: number | null) => this.d.meritev({ doOdgovora: Math.round(tOdgovor - tKonec), doZvoka: zvok === null ? null : Math.round(zvok - tKonec) });
    if (!this.aktiven) {
      meri(null);
      return;
    }
    // Glas se je vmes zaprl (omrežje, spanje zavihka): poskusi znova.
    if (besedilo && this.seja && (!this.tts || this.tts.readyState !== 1)) await this.odpriTts(this.seja);
    if (!this.aktiven) return;
    if (!besedilo || !this.tts || this.tts.readyState !== 1 || !this.izhod || !this.seja) {
      meri(null);
      // Brez odprtega pogovora (besedilni vnos, gumb) ni kaj poslušati.
      if (this.stt) this.poslusaj(tisinaMs);
      else this.nastavi('mirovanje');
      return;
    }
    // Varovalka, če obnova v ozadju ni uspela (npr. zaspan zavihek).
    const ttsCas = this.zaloga?.seja === this.seja ? this.zaloga.ttsCas : 0;
    if (Date.now() - ttsCas > (this.seja.veljaS ?? 60) * 1000 - 5000 && !(await this.obnoviTtsKljuc())) {
      meri(null);
      this.poslusaj(tisinaMs);
      return;
    }
    const seja = this.seja!;
    this.medGovorom.pocisti();
    this.govorBesede = besedeGovora(besedilo);
    this.nastavi('govorim');
    const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.govorId = id;
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
    if (this.s === 'govorim') this.poslusaj(tisinaMs);
  }

  private prviZvok: (() => void) | null = null;

  /** Analizator glasnosti za vmesnik: vir → analizator → zvočnik (zvok ostane enak). */
  private pripraviAnalizo(ctx: AudioContext) {
    this.analiza = null;
    try {
      if (typeof ctx.createAnalyser !== 'function') return;
      const a = ctx.createAnalyser();
      a.fftSize = 512;
      a.connect(ctx.destination);
      this.analiza = a;
      this.analizaVzorci = new Float32Array(new ArrayBuffer(a.fftSize * 4));
    } catch {
      this.analiza = null;
    }
  }

  /** Predvaja vzorce (24 kHz) za že načrtovanim zvokom; podaljša okno odmeva. */
  private predvajaj(vzorci: Float32Array) {
    const ctx = this.izhod;
    if (!ctx || !vzorci.length) return;
    const buf = ctx.createBuffer(1, vzorci.length, TTS_HZ);
    buf.getChannelData(0).set(vzorci);
    const vir = ctx.createBufferSource();
    vir.buffer = buf;
    vir.connect(this.analiza ?? ctx.destination);
    const zacetek = Math.max(ctx.currentTime + 0.02, this.naslednjiCas);
    vir.start(zacetek);
    this.naslednjiCas = zacetek + buf.duration;
    this.viri.push(vir);
    vir.onended = () => {
      this.viri = this.viri.filter((x) => x !== vir);
    };
    // Kar mikrofon ujame do konca tega zvoka (+ rep), je odmev.
    const doKonca = (this.naslednjiCas - ctx.currentTime) * 1000;
    this.odmevDo = Math.max(this.odmevDo, this.polozajMs + doKonca + REP_ODMEVA_MS);
  }

  private ttsSporocilo(podatki: unknown) {
    if (typeof podatki !== 'string') return;
    let m: { stream_id?: string; audio?: string; terminated?: boolean; error_code?: number };
    try {
      m = JSON.parse(podatki);
    } catch {
      return;
    }
    if (!m.stream_id) return;
    // Namigi čakanja se sintetizirajo enkrat in hranijo.
    const namig = this.namigiPriprava.get(m.stream_id);
    if (namig) {
      if (m.audio) namig.push(pcmVFloat(b64(m.audio)));
      if (m.terminated || m.error_code) {
        this.namigiPriprava.delete(m.stream_id);
        const n = namig.reduce((a, x) => a + x.length, 0);
        if (n && !m.error_code) {
          const vse = new Float32Array(n);
          let i = 0;
          for (const x of namig) {
            vse.set(x, i);
            i += x.length;
          }
          this.namigi.push(vse);
        }
      }
      return;
    }
    if (m.stream_id !== this.govorId) return;
    if (m.error_code) {
      this.koncajGovor?.();
      return;
    }
    if (m.audio && this.izhod) {
      const vzorci = pcmVFloat(b64(m.audio));
      if (vzorci.length) {
        this.predvajaj(vzorci);
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
    this.naslednjiCas = 0;
    // Zvok je utihnil: odmev se konča skoraj takoj.
    this.odmevDo = Math.min(this.odmevDo, this.polozajMs + 150);
    this.koncajGovor?.();
  }

  // ───────────────────────────── namigi ─────────────────────────────

  /** Enkrat na objekt: sintetiziraj "Moment." ipd., da se ob zamudi predvaja brez čakanja. */
  private pripraviNamige() {
    if (this.namigiZahtevani || !this.tts || this.tts.readyState !== 1 || !this.seja) return;
    this.namigiZahtevani = true;
    const seja = this.seja;
    NAMIGI_CAKANJA.forEach((besedilo, i) => {
      const id = `n${i}${Math.random().toString(36).slice(2, 6)}`;
      this.namigiPriprava.set(id, []);
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
    });
  }

  /** Če odgovor zamuja, asistent reče "Moment." (ne pogosteje kot na 20 s). */
  private zacniNamig() {
    this.ustaviNamig();
    this.namigCasovnik = setTimeout(() => {
      this.namigCasovnik = null;
      if (this.s !== 'razmisljam' || !this.namigi.length || Date.now() - this.zadnjiNamig < NAMIG_PREMOR_MS) return;
      this.zadnjiNamig = Date.now();
      this.predvajaj(this.namigi[this.namigIndeks++ % this.namigi.length]);
    }, NAMIG_PO_MS);
  }

  private ustaviNamig() {
    if (this.namigCasovnik) clearTimeout(this.namigCasovnik);
    this.namigCasovnik = null;
  }

  private pocistiLokalno() {
    if (this.lokalnoCasovnik) clearTimeout(this.lokalnoCasovnik);
    this.lokalnoCasovnik = null;
  }

  /** Komaj slišen namig ob začetku poslušanja (namesto piska). */
  private mehakNamig() {
    const ctx = this.izhod;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(520, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.018, ctx.currentTime + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.2);
    } catch {
      /* namig ni nujen */
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
    this.ustaviNamig();
    this.pocistiLokalno();
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
    this.analiza = null;
    // Izhod zapremo malo kasneje, da se zadnji zvok ne odreže.
    setTimeout(() => void izhod?.close().catch(() => {}), 300);
    this.seja = null;
    this.zvokCaka = [];
    this.predlog = null;
    this.vprasanje = null;
    this.sekundeZvoka = 0;
    this.sestavljalec.pocisti();
    this.medGovorom.pocisti();
    this.cakajoca = null;
    this.zadnjaIzjava = null;
    this.glasnosti = [];
    this.obnoveStt = [];
    // Pripravljeni namigi (vzorci) ostanejo za naslednji pogovor; nedokončani se pripravijo znova.
    if (!this.namigi.length) this.namigiZahtevani = false;
    this.namigiPriprava.clear();
    this.nastavi('mirovanje');
    if (napaka && (bilAktiven || napaka)) this.d.napaka(napaka);
  }
}

class NapakaPogovora extends Error {}

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const bajti = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bajti[i] = bin.charCodeAt(i);
  return bajti;
}

/**
 * DNS in TLS do Soniox vnaprej (preconnect), da prva povezava ob tapu ne čaka
 * na rokovanje; zvočni modul mikrofona v predpomnilnik brskalnika.
 */
let ogreto = false;
function ogrejPovezave() {
  if (ogreto || typeof document === 'undefined') return;
  ogreto = true;
  for (const izvor of ['https://stt-rt.soniox.com', 'https://tts-rt.soniox.com']) {
    const l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = izvor;
    l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }
  void fetch('/glas/mikrofon-worklet.js', { cache: 'force-cache' }).catch(() => {});
}
