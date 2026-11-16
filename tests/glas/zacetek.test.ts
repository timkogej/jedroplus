// Hiter začetek pogovora: seja vnaprej, poslušanje takoj, zvok se hrani do povezave.
// Brskalniške API-je (mikrofon, AudioContext, WebSocket, fetch) nadomestimo z lažnimi.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pogovor, type StanjePogovora } from '@/lib/glas/odjemalec/pogovor';

type Lazni = { poslano: unknown[]; odpri(): void; readyState: number; url: string };
let vticnice: Lazni[] = [];
let sejeKlicev = 0;
let mikrofon: ((e: { data: ArrayBuffer }) => void) | null = null;

const SEJA = {
  ok: true,
  jezik: 'sl',
  veljaS: 300,
  stt: { url: 'wss://stt', kljuc: 'k-stt', model: 'm', namigi: ['Ana'], najdaljsiKonecMs: 1000 },
  tts: { url: 'wss://tts', kljuc: 'k-tts', model: 'm', glas: 'Nina', hitrost: 1 },
};

class LazniWS {
  readyState = 0;
  poslano: unknown[] = [];
  binaryType = '';
  onopen: (() => void) | null = null;
  onmessage: ((e: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    vticnice.push(this as unknown as Lazni);
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
}

class LazniAC {
  currentTime = 0;
  destination = {};
  audioWorklet = { addModule: async () => {} };
  resume = async () => {};
  close = async () => {};
  createMediaStreamSource = () => ({ connect: () => {} });
  createGain = () => ({ gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect() {} }) });
  createOscillator = () => ({ frequency: { value: 0 }, connect: () => ({ connect() {} }), start() {}, stop() {} });
}

class LazniWorklet {
  port = {
    set onmessage(f: (e: { data: ArrayBuffer }) => void) {
      mikrofon = f;
    },
  };
  connect() {}
}

const okvir = (n: number) => new Uint8Array([n]).buffer;

function pogovor() {
  const stanja: StanjePogovora[] = [];
  const zacetki: { doPoslusanja: number; doPovezave: number; sejaVnaprej: boolean }[] = [];
  const p = new Pogovor({
    stanje: (s) => stanja.push(s),
    slisano: () => {},
    izjava: () => {},
    odgovor: () => {},
    potrditev: () => {},
    napaka: () => {},
    meritev: () => {},
    zacetek: (m) => zacetki.push(m),
  });
  return { p, stanja, zacetki };
}

beforeEach(() => {
  vticnice = [];
  sejeKlicev = 0;
  mikrofon = null;
  vi.stubGlobal('window', { AudioContext: LazniAC });
  vi.stubGlobal('document', { head: { appendChild() {} }, createElement: () => ({}) });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
  vi.stubGlobal('AudioWorkletNode', LazniWorklet);
  vi.stubGlobal('WebSocket', LazniWS);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/glas/seja') sejeKlicev++;
      return { status: 200, json: async () => SEJA } as unknown as Response;
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

const pocakaj = () => new Promise((r) => setTimeout(r, 0));

describe('hiter začetek pogovora', () => {
  it('pripravljena seja se ob tapu ne nalaga znova; dvojna priprava = en klic', async () => {
    const { p, zacetki } = pogovor();
    p.pripravi();
    p.pripravi();
    await pocakaj();
    expect(sejeKlicev).toBe(1);

    const z = p.zacni();
    await pocakaj();
    await pocakaj();
    vticnice.find((v) => v.url === 'wss://stt')!.odpri();
    await z;
    expect(sejeKlicev).toBe(1);
    expect(zacetki[0].sejaVnaprej).toBe(true);
    p.ustavi();
  });

  it('posluša takoj; zvok med povezovanjem gre v razpoznavo za nastavitvami, v vrstnem redu', async () => {
    const { p, stanja } = pogovor();
    const z = p.zacni();
    await pocakaj();
    await pocakaj();
    expect(stanja.at(-1)).toBe('poslusam'); // pred povezavo razpoznave
    mikrofon!({ data: okvir(1) });
    mikrofon!({ data: okvir(2) });

    const stt = vticnice.find((v) => v.url === 'wss://stt')!;
    expect(stt.poslano).toHaveLength(0);
    stt.odpri();
    await z;
    mikrofon!({ data: okvir(3) });

    expect(typeof stt.poslano[0]).toBe('string'); // nastavitve najprej
    expect(JSON.parse(stt.poslano[0] as string).api_key).toBe('k-stt');
    expect(stt.poslano.slice(1).map((b) => new Uint8Array(b as ArrayBuffer)[0])).toEqual([1, 2, 3]);
    p.ustavi();
  });

  it('glas (TTS) ne zadržuje poslušanja', async () => {
    const { p, zacetki } = pogovor();
    const z = p.zacni();
    await pocakaj();
    await pocakaj();
    vticnice.find((v) => v.url === 'wss://stt')!.odpri();
    await z; // TTS vtičnica se ni odprla, začetek je vseeno končan
    expect(zacetki).toHaveLength(1);
    expect(vticnice.find((v) => v.url === 'wss://tts')!.readyState).toBe(0);
    p.ustavi();
  });
});
