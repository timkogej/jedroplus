// scripts/glas-meritve/konec-govora.mjs
//
// Zaznava konca govora (Soniox stt-rt-v5) s sintetičnim govorom (Nina) in premori sredi stavka.
//   set -a; . ./.env.local; set +a; node scripts/glas-meritve/konec-govora.mjs
// Ključ samo iz okolja; ne izpiše se. Sintetičen glas brez šuma: v pravem prostoru bo zaznava malo drugačna.
const K = process.env.SONIOX_API_KEY;
const HZ = 16000;
async function tts(texts) {
  const ws = new WebSocket('wss://tts-rt.soniox.com/tts-websocket');
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const out = new Map(); const cak = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); const c = cak.get(m.stream_id); if (!c) return;
    if (m.audio) c.kosi.push(Buffer.from(m.audio, 'base64'));
    if (m.error_code) { c.res(); console.error('tts napaka', m.error_code); }
    if (m.terminated) c.res(); };
  let i = 0;
  for (const t of texts) { const id = 'x' + i++; const c = { kosi: [] }; const p = new Promise((res) => (c.res = res)); cak.set(id, c);
    ws.send(JSON.stringify({ api_key: K, model: 'tts-rt-v2', language: 'sl', voice: 'Nina', audio_format: 'pcm_s16le', sample_rate: HZ, speed: 1.04, stream_id: id }));
    ws.send(JSON.stringify({ stream_id: id, text: t })); ws.send(JSON.stringify({ stream_id: id, text_end: true }));
    await p; out.set(t, Buffer.concat(c.kosi)); }
  ws.close(); return out;
}
// Odreži tišino na koncu sintetiziranega zvoka (da je "premor" res naš premor).
function obrezi(b) { let n = b.length / 2; while (n > 0 && Math.abs(b.readInt16LE((n - 1) * 2)) < 300) n--; return b.subarray(0, n * 2); }
const tisina = (ms) => Buffer.alloc(Math.round(HZ * ms / 1000) * 2);

const SCENARIJI = [
  { ime: 'cel: kaj imam jutri', deli: ['Kaj imam jutri?'] },
  { ime: 'cel: kdo je naslednji', deli: ['Kdo je naslednji?'] },
  { ime: 'cel: ja', deli: ['Ja.'] },
  { ime: 'cel: shrani', deli: ['Shrani.'] },
  { ime: 'cel: vpiši Ano', deli: ['Vpiši Ano Novak jutri ob desetih na barvanje pri Tini.'] },
  { ime: 'premor po "ob"', deli: ['Zapiši nov termin za Anjo Novak ob', 1200, 'desetih zjutraj.'] },
  { ime: 'premor po "na"', deli: ['Prestavi Matejo na', 1500, 'petek ob enajstih.'] },
  { ime: 'premor po vejici', deli: ['Vpiši Ano Novak jutri,', 1000, 'na barvanje pri Tini.'] },
  { ime: 'premor po "in"', deli: ['Zapiši termin za Anjo Novak in', 1300, 'Mojco Kranjc.'] },
  { ime: 'uh na začetku', deli: ['Uh,', 900, 'kaj imam jutri?'] },
  { ime: 'premor po "za"', deli: ['Zapiši termin za', 1800, 'Ano Novak.'] },
];
const KONF = { d500: 500, d1000: 1000, d1500: 1500, d2000: 2000 };

function enTek(zvok, mejeMs, delay) {
  return new Promise((resolve) => {
    const ws = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket');
    const konci = []; let koncno = ''; let zadnjaBesedaMs = 0; let zac = 0;
    const timer = setTimeout(() => { try { ws.close(); } catch {} resolve({ napaka: 'timeout' }); }, 40000);
    ws.onopen = async () => {
      ws.send(JSON.stringify({ api_key: K, model: 'stt-rt-v5', audio_format: 'pcm_s16le', sample_rate: HZ, num_channels: 1, language_hints: ['sl'], enable_endpoint_detection: true, max_endpoint_delay_ms: delay, context: { terms: ['Ana Novak', 'Anja Novak', 'Mateja', 'Tina', 'Mojca Kranjc', 'barvanje'] } }));
      zac = performance.now();
      const kos = 3200;
      for (let i = 0; i < zvok.length; i += kos) {
        if (ws.readyState !== 1) break;
        ws.send(zvok.subarray(i, i + kos));
        const cilj = zac + ((i + kos) / (HZ * 2)) * 1000; const d = cilj - performance.now(); if (d > 0) await new Promise((r) => setTimeout(r, d));
      }
      if (ws.readyState === 1) ws.send('');
    };
    ws.onmessage = (e) => { const m = JSON.parse(e.data);
      if (m.error_code) { clearTimeout(timer); resolve({ napaka: m.error_code }); return; }
      for (const t of m.tokens ?? []) { if (!t.is_final) continue;
        if (t.text === '<end>') { konci.push({ zvokMs: Math.round(performance.now() - zac), poBesedi: Math.round(performance.now() - zac - zadnjaBesedaMs), besedilo: koncno.trim() }); continue; }
        koncno += t.text; if (t.text.trim()) zadnjaBesedaMs = t.end_ms; }
      if (m.finished) { clearTimeout(timer); try { ws.close(); } catch {} resolve({ konci, koncno: koncno.trim() }); } };
    ws.onerror = () => { clearTimeout(timer); resolve({ napaka: 'ws' }); };
  });
}

const besedila = SCENARIJI.flatMap((s) => s.deli.filter((d) => typeof d === 'string'));
const zvoki = await tts([...new Set(besedila)]);
const rez = [];
const opravila = [];
for (const s of SCENARIJI) {
  const deli = []; const meje = []; let ms = 0;
  for (const d of s.deli) { const b = typeof d === 'number' ? tisina(d) : obrezi(zvoki.get(d)); deli.push(b); ms += b.length / 32; meje.push(Math.round(ms)); }
  deli.push(tisina(3500));
  const zvok = Buffer.concat(deli);
  for (const [k, delay] of Object.entries(KONF)) opravila.push({ s, k, delay, zvok, meje });
}
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (i < opravila.length) { const o = opravila[i++];
  const r = await enTek(o.zvok, o.meje, o.delay);
  const govorKonec = o.meje[o.meje.length - 1];
  const predcasni = (r.konci ?? []).filter((x) => x.zvokMs < govorKonec - 50);
  const koncni = (r.konci ?? []).find((x) => x.zvokMs >= govorKonec - 50);
  rez.push({ scen: o.s.ime, konf: o.k, predcasni: predcasni.map((x) => x.besedilo), konecPoGovoru: koncni ? koncni.zvokMs - govorKonec : null, poBesedi: koncni?.poBesedi ?? null, prepis: r.koncno, napaka: r.napaka });
} }));
rez.sort((a, b) => a.scen.localeCompare(b.scen) || a.konf.localeCompare(b.konf));
for (const r of rez) console.log(`${r.scen.padEnd(22)} ${r.konf.padEnd(6)} konec+${String(r.konecPoGovoru).padStart(5)}ms  predčasno:${r.predcasni.length ? JSON.stringify(r.predcasni) : '-'}  ${r.napaka ?? ''}`);
console.log('\nPOVZETEK');
for (const k of Object.keys(KONF)) { const x = rez.filter((r) => r.konf === k); const cel = x.filter((r) => r.scen.startsWith('cel')).map((r) => r.konecPoGovoru).filter((v) => v != null).sort((a, b) => a - b);
  console.log(k, 'celi stavki: mediana', cel[Math.floor(cel.length / 2)], 'max', cel.at(-1), '| predčasni rezi v stavkih s premorom:', x.filter((r) => !r.scen.startsWith('cel') && r.predcasni.length).length, '/', x.filter((r) => !r.scen.startsWith('cel')).length); }
