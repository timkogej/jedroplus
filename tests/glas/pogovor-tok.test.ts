// Potek pogovora z lažnimi Soniox žetoni: konec govora po vsebini, nadaljevanje med
// razmišljanjem, prekinitev z glasom, odmev, lokalni konec, napake (lib/glas/odjemalec/pogovor.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pogovor, type StanjePogovora } from '@/lib/glas/odjemalec/pogovor';
import { CAKANJE } from '@/lib/glas/odjemalec/tok';

type Zeton = { text: string; is_final?: boolean; start_ms?: number; end_ms?: number };

class LazniWS {
  static vse: LazniWS[] = [];
  readyState = 0;
  poslano: unknown[] = [];
  binaryType = '';
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    LazniWS.vse.push(this);
  }
  send(x: unknown) {
    this.poslano.push(x);
  }
  close() {
    this.readyState = 3;
  }
  odpri() {
    this.readyState = 1;
    this.onopen?.();
  }
  sporoci(m: unknown) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
  json() {
    return this.poslano.filter((x): x is string => typeof x === 'string').map((x) => JSON.parse(x));
  }
}

class LazniAC {
  currentTime = 0;
  destination = {};
  audioWorklet = { addModule: async () => {} };
  resume = async () => {};
  close = async () => {};
  createMediaStreamSource = () => ({ connect: () => {} });
  createGain = () => ({ gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect() {} }) });
  createOscillator = () => ({ type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect() {} }), start() {}, stop() {} });
  createBuffer = (_k: number, n: number, hz: number) => ({ duration: n / hz, getChannelData: () => new Float32Array(n) });
  createBufferSource = () => ({ buffer: null, connect() {}, start() {}, stop() {}, onended: null });
}

let mikrofon: ((e: { data: ArrayBuffer }) => void) | null = null;
class LazniWorklet {
  port = {
    set onmessage(f: (e: { data: ArrayBuffer }) => void) {
      mikrofon = f;
    },
  };
  connect() {}
}

const SEJA = {
  ok: true,
  jezik: 'sl',
  veljaS: 300,
  stt: { url: 'wss://stt', kljuc: 'k', model: 'm', namigi: [], najdaljsiKonecMs: 1000 },
  tts: { url: 'wss://tts', kljuc: 'k', model: 'm', glas: 'Nina', hitrost: 1 },
};

/** Zahteve na /api/glas/ukaz: telo in razrešitev (test odloči, kdaj pride odgovor). */
let ukazi: { telo: { besedilo: string }; signal: AbortSignal; odgovori: (j: unknown) => void; napaka: (e: unknown) => void }[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  LazniWS.vse = [];
  ukazi = [];
  mikrofon = null;
  vi.stubGlobal('window', { AudioContext: LazniAC });
  vi.stubGlobal('document', { head: { appendChild() {} }, createElement: () => ({}) });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
  vi.stubGlobal('AudioWorkletNode', LazniWorklet);
  vi.stubGlobal('WebSocket', LazniWS);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: { body?: string; signal?: AbortSignal }) => {
      if (url === '/api/glas/seja') return Promise.resolve({ status: 200, json: async () => SEJA } as unknown as Response);
      if (url === '/api/glas/ukaz') {
        return new Promise((resolve, reject) => {
          const signal = init!.signal!;
          signal.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError')));
          ukazi.push({
            telo: JSON.parse(init!.body!),
            signal,
            odgovori: (j) => resolve({ status: 200, json: async () => j } as unknown as Response),
            napaka: reject,
          });
        });
      }
      return Promise.resolve({ status: 200, json: async () => ({ ok: true }) } as unknown as Response);
    })
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const stt = () => LazniWS.vse.find((w) => w.url === 'wss://stt')!;
const tts = () => LazniWS.vse.find((w) => w.url === 'wss://tts')!;
const korak = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

/** Okvir mikrofona 100 ms z dano glasnostjo (0–1). */
const okvir = (glasnost: number) => new Int16Array(1600).fill(Math.round(glasnost * 0x7fff)).buffer;

async function zagnan() {
  const stanja: StanjePogovora[] = [];
  const izjave: string[] = [];
  const napake: string[] = [];
  const p = new Pogovor({
    stanje: (s) => stanja.push(s),
    slisano: () => {},
    izjava: (x) => izjave.push(x),
    odgovor: () => {},
    potrditev: () => {},
    napaka: (x) => napake.push(x),
    meritev: () => {},
  });
  const z = p.zacni();
  await korak();
  stt().odpri();
  await z;
  tts().odpri();
  await korak();
  return { p, stanja, izjave, napake };
}

/** Soniox: končni žetoni (besede s časi v zvoku) in po želji <end>. */
function recem(besedilo: string, odMs: number, konec = true) {
  const besede = besedilo.split(' ');
  const z: Zeton[] = besede.map((b, i) => ({ text: (i ? ' ' : '') + b, is_final: true, start_ms: odMs + i * 300, end_ms: odMs + i * 300 + 250 }));
  if (konec) z.push({ text: '<end>', is_final: true });
  stt().sporoci({ tokens: z });
}

describe('konec govora po vsebini', () => {
  it('premor po "ob" ne odreže stavka; nadaljevanje gre v isto izjavo', async () => {
    const { izjave } = await zagnan();
    recem('Zapiši nov termin za Anjo Novak ob.', 0);
    await korak(CAKANJE.obicajno + 500);
    expect(ukazi).toHaveLength(0); // čaka, ker se konča z "ob"
    recem('desetih.', 3000);
    await korak(CAKANJE.obicajno + 10);
    expect(ukazi).toHaveLength(1);
    expect(ukazi[0].telo.besedilo).toBe('Zapiši nov termin za Anjo Novak ob. desetih.');
    expect(izjave).toEqual(['Zapiši nov termin za Anjo Novak ob. desetih.']);
  });

  it('kratek "ja" gre takoj, navaden stavek po kratkem čakanju', async () => {
    await zagnan();
    recem('Kaj imam jutri?', 0);
    await korak(CAKANJE.kratko + 10);
    expect(ukazi).toHaveLength(1);
  });

  it('samo "uh" ni izjava, dokler uporabnik ne nadaljuje', async () => {
    await zagnan();
    recem('Uh.', 0);
    await korak(2000);
    expect(ukazi).toHaveLength(0);
    recem('kdo je naslednji?', 2500);
    await korak(CAKANJE.obicajno + 10);
    expect(ukazi[0].telo.besedilo).toBe('Uh. kdo je naslednji?');
  });
});

describe('nadaljevanje med razmišljanjem', () => {
  it('uporabnik nadaljuje → zahteva preklicana, izjavi združeni, ena nova zahteva', async () => {
    const { stanja } = await zagnan();
    recem('Vpiši Ano Novak jutri ob desetih.', 0);
    await korak(CAKANJE.obicajno + 10);
    expect(ukazi).toHaveLength(1);
    expect(stanja.at(-1)).toBe('razmisljam');

    recem('na barvanje pri Tini.', 4000, false);
    await korak();
    expect(ukazi[0].signal.aborted).toBe(true);
    expect(stanja.at(-1)).toBe('poslusam');

    stt().sporoci({ tokens: [{ text: '<end>', is_final: true }] });
    await korak(CAKANJE.obicajno + 10);
    expect(ukazi).toHaveLength(2);
    expect(ukazi[1].telo.besedilo).toBe('Vpiši Ano Novak jutri ob desetih. na barvanje pri Tini.');
  });

  it('mašilo med razmišljanjem ne prekliče zahteve', async () => {
    await zagnan();
    recem('Kdo je naslednji?', 0);
    await korak(CAKANJE.kratko + 10);
    recem('uh', 3000, false);
    await korak();
    expect(ukazi[0].signal.aborted).toBe(false);
  });
});

/** Pripelje pogovor do govora asistenta z besedilom `govor`. */
async function govori(govor: string) {
  const o = await zagnan();
  recem('Kaj imam jutri?', 0);
  await korak(CAKANJE.kratko + 10);
  ukazi[0].odgovori({ ok: true, ukazId: 'u1', status: 'odgovor', odgovor: govor, govor });
  await korak();
  const id = tts().json().filter((m) => m.text === govor)[0]?.stream_id as string;
  expect(id).toBeTruthy();
  expect(o.stanja.at(-1)).toBe('govorim');
  return { ...o, id };
}

describe('prekinitev z glasom', () => {
  const GOVOR = 'Jutri imate štiri stranke. Prva je Mateja Kovačič ob devetih.';

  it('lasten odmev (glasen, iste besede) ne prekine', async () => {
    const { stanja } = await govori(GOVOR);
    for (let i = 0; i < 3; i++) mikrofon!({ data: okvir(0.2) });
    stt().sporoci({ tokens: [{ text: 'Jutri imate štiri stranke prva je', is_final: false, start_ms: 2000, end_ms: 3500 }] });
    await korak();
    expect(stanja.at(-1)).toBe('govorim');
  });

  it('tuje besede pri dovolj glasnem mikrofonu prekinejo; začetek nove izjave ostane', async () => {
    const { stanja, id } = await govori(GOVOR);
    for (let i = 0; i < 3; i++) mikrofon!({ data: okvir(0.1) });
    stt().sporoci({ tokens: [{ text: 'Prva je počakaj prestavi', is_final: false, start_ms: 2000, end_ms: 3500 }] });
    await korak();
    expect(stanja.at(-1)).toBe('poslusam');
    expect(tts().json().some((m) => m.stream_id === id && m.cancel === true)).toBe(true);

    // Uporabnik konča stavek: izjava vsebuje besede, s katerimi je prekinil (brez odmeva).
    stt().sporoci({
      tokens: [
        { text: 'Prva je počakaj prestavi', is_final: true, start_ms: 2000, end_ms: 3500 },
        { text: ' Ano na petek.', is_final: true, start_ms: 3600, end_ms: 4400 },
        { text: '<end>', is_final: true },
      ],
    });
    await korak(CAKANJE.obicajno + 10);
    expect(ukazi.at(-1)!.telo.besedilo).toBe('počakaj prestavi Ano na petek.');
  });

  it('tih mikrofon (ostanek odmeva) ne prekine niti s tujimi besedami', async () => {
    const { stanja } = await govori(GOVOR);
    for (let i = 0; i < 6; i++) mikrofon!({ data: okvir(0.003) });
    stt().sporoci({ tokens: [{ text: 'prestavi Ano', is_final: false, start_ms: 2000, end_ms: 2600 }] });
    await korak();
    expect(stanja.at(-1)).toBe('govorim');
  });

  it('odmev konca govora po govoru ne postane izjava', async () => {
    const { stanja, id } = await govori(GOVOR);
    // Asistent je predvajal ~2 s zvoka (24 kHz), mikrofon je poslal 10 okvirjev.
    for (let i = 0; i < 10; i++) mikrofon!({ data: okvir(0.001) });
    tts().sporoci({ stream_id: id, audio: btoa(String.fromCharCode(...new Uint8Array(96000))) });
    tts().sporoci({ stream_id: id, terminated: true });
    await korak(2500);
    expect(stanja.at(-1)).toBe('poslusam');
    const prej = ukazi.length;
    // Zapozneli prepis odmeva (iz časa govora) + <end>.
    stt().sporoci({ tokens: [{ text: 'devetih.', is_final: true, start_ms: 2400, end_ms: 2900 }, { text: '<end>', is_final: true }] });
    await korak(CAKANJE.nedokoncano + 100);
    expect(ukazi.length).toBe(prej);
  });
});

describe('lokalni odzivi in napake', () => {
  it('med tipkanjem se pogovor ne zapre; ko neha tipkati, se po 30 s zapre', async () => {
    const { p, stanja } = await zagnan();
    await korak(5000);
    p.tipkam();
    await korak(15_000); // začetna tišina (12 s) je mimo, a tipka
    expect(stanja.at(-1)).toBe('poslusam');
    p.tipkam();
    await korak(29_000);
    expect(stanja.at(-1)).toBe('poslusam');
    await korak(2_000);
    expect(stanja.at(-1)).toBe('mirovanje');
  });

  it('"hvala, to je vse" konča pogovor brez strežnika', async () => {
    const { stanja } = await zagnan();
    recem('Hvala, to je vse.', 0);
    await korak(CAKANJE.obicajno + 10);
    expect(ukazi).toHaveLength(0);
    // Pove kratek pozdrav, nato se zapre.
    const id = tts().json().find((m) => m.text === 'Prav. Lep dan.')?.stream_id;
    expect(id).toBeTruthy();
    expect(stanja.at(-1)).toBe('govorim');
    tts().sporoci({ stream_id: id, terminated: true });
    await korak(300);
    expect(stanja.at(-1)).toBe('mirovanje');
  });

  it('napaka strežnika: asistent jo pove in posluša naprej (pogovor se ne zapre)', async () => {
    const { stanja, napake } = await zagnan();
    recem('Kaj imam jutri?', 0);
    await korak(CAKANJE.kratko + 10);
    ukazi[0].napaka(new TypeError('omrežje'));
    await korak();
    expect(napake).toHaveLength(1);
    expect(tts().json().some((m) => m.text === 'Povezava ni uspela.')).toBe(true);
    expect(stanja).not.toContain('mirovanje');
  });

  it('prekinjena razpoznava se poveže znova, pogovor teče', async () => {
    const { stanja } = await zagnan();
    const prva = stt();
    prva.readyState = 3;
    prva.onclose?.();
    await korak();
    const druga = LazniWS.vse.filter((w) => w.url === 'wss://stt').at(-1)!;
    expect(druga).not.toBe(prva);
    druga.odpri();
    await korak();
    expect(stanja.at(-1)).toBe('poslusam');
  });

  it('"shrani" v obrazcu: lokalno, brez strežnika; vmesnik pove izid', async () => {
    const obvestila: string[] = [];
    const p = new Pogovor({
      stanje: () => {},
      slisano: () => {},
      izjava: () => {},
      odgovor: () => {},
      potrditev: () => {},
      napaka: () => {},
      meritev: () => {},
      obvestilo: (x) => obvestila.push(x),
      lokalno: (x) => (x.startsWith('Ja') ? { caka: true } : null),
    });
    const z = p.zacni();
    await korak();
    stt().odpri();
    await z;
    tts().odpri();
    await korak();
    recem('Ja.', 0);
    await korak(CAKANJE.kratko + 10);
    expect(ukazi).toHaveLength(0);
    expect(p.stanje).toBe('razmisljam');
    void p.povejObvestilo('Shranjeno.');
    await korak();
    expect(obvestila).toEqual(['Shranjeno.']);
    expect(tts().json().some((m) => m.text === 'Shranjeno.')).toBe(true);
  });
});

describe('ponovi in počasneje (lokalno, brez strežnika)', () => {
  const GOVOR = 'Telefon: nič štiri ena, dve tri štiri, pet šest sedem.';
  const nastavitve = () => tts().json().filter((m) => 'speed' in m);
  const besedila = () => tts().json().filter((m) => typeof m.text === 'string').map((m) => m.text);

  it('"ponovi" izgovori zadnji odgovor znova, enako hitro', async () => {
    const { id } = await govori(GOVOR);
    tts().sporoci({ stream_id: id, terminated: true });
    await korak(300);
    recem('Ponovi, prosim.', 5000);
    await korak(CAKANJE.kratko + 10);
    expect(ukazi).toHaveLength(1); // samo prvi ukaz
    expect(besedila().filter((x) => x === GOVOR)).toHaveLength(2);
    expect(nastavitve().at(-1).speed).toBe(1);
  });

  it('"počasneje" ponovi počasneje in hitrost ostane do konca pogovora', async () => {
    const { id } = await govori(GOVOR);
    tts().sporoci({ stream_id: id, terminated: true });
    await korak(300);
    recem('Počasneje.', 5000);
    await korak(CAKANJE.kratko + 10);
    expect(ukazi).toHaveLength(1);
    expect(besedila().at(-1)).toBe(GOVOR);
    expect(nastavitve().at(-1).speed).toBe(0.85);
    const id2 = nastavitve().at(-1).stream_id;
    tts().sporoci({ stream_id: id2, terminated: true });
    await korak(300);
    recem('Bolj počasi.', 9000);
    await korak(CAKANJE.kratko + 10);
    expect(nastavitve().at(-1).speed).toBe(0.75);
  });

  it('brez prejšnjega odgovora: "Nimam česa ponoviti."', async () => {
    await zagnan();
    recem('Ponovi.', 0);
    await korak(CAKANJE.kratko + 10);
    expect(ukazi).toHaveLength(0);
    expect(besedila()).toContain('Nimam česa ponoviti.');
  });
});

describe('čas za branje', () => {
  it('kratek odgovor: običajna tišina; dolg samo na zaslonu: dlje, največ 90 s', async () => {
    const { tisinaZaBranje } = await import('@/lib/glas/odjemalec/pogovor');
    expect(tisinaZaBranje('Termin je shranjen.', 'Termin je shranjen.', 8000)).toBe(8000);
    expect(tisinaZaBranje('x'.repeat(320), 'Številke so na zaslonu.', 8000)).toBe(8000 + (320 - 23) * 60);
    expect(tisinaZaBranje('x'.repeat(5000), '', 8000)).toBe(90_000);
  });
});
