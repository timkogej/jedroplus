// Sprotni Soniox STT na Timovih posnetkih: zvok se pošilja v realnem času, merimo čas od konca
// zvoka do zaznanega konca govora (<end>) in do končnega besedila; WER/imena/odtenki kot prej.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const W = process.argv[2]; const S = process.argv[3];
const { wer, imePravilno, odtenkiVPrepisu } = await import(path.join(W, 'scripts/glas-stt-primerjava.mjs'));
const md = fs.readFileSync(path.join(W, 'scripts/glas-stt-stavki.md'), 'utf8').split('<!-- stavki:zacetek -->')[1].split('<!-- stavki:konec -->')[0];
const ref = new Map();
for (const v of md.split('\n')) { const d = v.split('|').map((x) => x.trim()); if (d.length < 4 || !/^\d+$/.test(d[0])) continue;
  const sez = (x, o) => x.replace(`${o}:`, '').split(/[;,]/).map((y) => y.trim()).filter(Boolean);
  ref.set(d[0], { besedilo: d[1], imena: sez(d[2], 'imena'), odtenki: d[3].replace('odtenki:', '').split(',').map((y) => y.trim()).filter(Boolean) }); }
const namigi = fs.readFileSync(path.join(W, 'posnetki/namigi.txt'), 'utf8').split('\n').map((x) => x.trim()).filter(Boolean);
const datoteke = ['tim-brez-hrupa', 'tim-z-glasbo'].flatMap((m) => fs.readdirSync(path.join(W, 'posnetki', m)).filter((f) => f.endsWith('.m4a')).map((f) => path.join(W, 'posnetki', m, f)));
const KONF = { a: { max_endpoint_delay_ms: 1000 }, b: { max_endpoint_delay_ms: 500, endpoint_latency_adjustment_level: 3 } };

function pcm(f) { return execFileSync('ffmpeg', ['-v', 'quiet', '-i', f, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { maxBuffer: 50e6 }); }
function enPosnetek(f, ime) {
  return new Promise((resolve) => {
    const zvok = pcm(f); const tisina = Buffer.alloc(16000 * 2 * 3); const vse = Buffer.concat([zvok, tisina]);
    const ws = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket');
    let konecZvoka = 0, tEnd = 0, predcasni = 0, zacW = 0, zadnjaBeseda = 0; const konci = []; let tZadnjiFinal = 0, koncno = ""; const t0 = performance.now(); let odprto = 0;
    const timer = setTimeout(() => { try { ws.close(); } catch {} resolve({ napaka: 'timeout' }); }, 30000);
    ws.onopen = async () => {
      odprto = performance.now() - t0;
      ws.send(JSON.stringify({ api_key: process.env.SONIOX_API_KEY, model: 'stt-rt-v5', audio_format: 'pcm_s16le', sample_rate: 16000, num_channels: 1,
        language_hints: ['sl'], enable_endpoint_detection: true, context: { terms: namigi }, ...KONF[ime] }));
      const kos = 3200; // 100 ms
      const zac = performance.now(); zacW = zac;
      for (let i = 0; i < vse.length; i += kos) {
        if (ws.readyState !== 1) break;
        ws.send(vse.subarray(i, i + kos));
        if (i + kos >= zvok.length && !konecZvoka) konecZvoka = performance.now();
        const cilj = zac + ((i + kos) / 32000) * 1000; const d = cilj - performance.now(); if (d > 0) await new Promise((r) => setTimeout(r, d));
      }
      if (ws.readyState === 1) ws.send('');
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.error_code) { clearTimeout(timer); resolve({ napaka: m.error_code + ' ' + m.error_message }); try { ws.close(); } catch {} return; }
      for (const t of m.tokens ?? []) {
        if (!t.is_final) continue;
        if (t.text === '<end>') { konci.push({ wall: performance.now(), poBesedi: zadnjaBeseda, nBesedila: koncno.length }); continue; }
        koncno += t.text; tZadnjiFinal = performance.now(); if (t.text.trim()) zadnjaBeseda = t.end_ms;
      }
      if (m.finished) { clearTimeout(timer); try { ws.close(); } catch {}
        const zadnji = konci.filter((x) => x.nBesedila >= koncno.trimEnd().length).at(0); const vmes = konci.filter((x) => x.nBesedila < koncno.trimEnd().length).length;
        resolve({ predcasni: vmes, prepis: koncno.trim(), end_ms: zadnji ? Math.round(zadnji.wall - (zacW + zadnji.poBesedi)) : null, final_ms: Math.round(tZadnjiFinal - konecZvoka), odpiranje_ms: Math.round(odprto), sekunde: zvok.length / 32000 }); }
    };
    ws.onerror = () => { clearTimeout(timer); resolve({ napaka: 'ws' }); };
  });
}
const rez = [];
const opravila = datoteke.flatMap((f) => Object.keys(KONF).map((k) => ({ f, k })));
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (i < opravila.length) { const { f, k } = opravila[i++]; const st = path.basename(f, '.m4a');
  const r = await enPosnetek(f, k); const rf = ref.get(st);
  if (!r.napaka && rf) { r.wer = wer(rf.besedilo, r.prepis); r.imena = rf.imena.map((x) => imePravilno(x, r.prepis)); const od = odtenkiVPrepisu(r.prepis); r.odtenki = rf.odtenki.map((x) => od.includes(x)); }
  rez.push({ st, mapa: path.basename(path.dirname(f)), konf: k, ...r }); } }));
fs.writeFileSync(path.join(S, 'stt-soniox.json'), JSON.stringify(rez, null, 1));
for (const k of Object.keys(KONF)) { const r = rez.filter((x) => x.konf === k && !x.napaka); const med = (a) => { a = a.filter((v) => v != null).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; }; const p90 = (a) => { a = a.filter((v) => v != null).sort((x, y) => x - y); return a[Math.floor(a.length * 0.9)]; };
  const im = r.flatMap((x) => x.imena ?? []), od = r.flatMap((x) => x.odtenki ?? []);
  console.log(k, JSON.stringify(KONF[k]), 'n', r.length, 'napak', rez.filter((x) => x.konf === k && x.napaka).length, 'WER', (r.reduce((a, x) => a + x.wer, 0) / r.length * 100).toFixed(1) + '%', 'imena', im.filter(Boolean).length + '/' + im.length, 'odtenki', od.filter(Boolean).length + '/' + od.length,
    'end med', med(r.map((x) => x.end_ms)), 'p90', p90(r.map((x) => x.end_ms)), 'brez end', r.filter((x) => x.end_ms == null).length, 'final med', med(r.map((x) => x.final_ms)), 'odpiranje med', med(r.map((x) => x.odpiranje_ms)), 'predcasnih konca (posnetkov)', r.filter((x) => x.predcasni).length); }
for (const x of rez.filter((x) => x.napaka)) console.log('NAPAKA', x.st, x.konf, x.napaka);
