// Soniox TTS prek stalne WebSocket povezave: čas od poslanega besedila do prvega zvoka.
const st = { sl: 'Jutri imate štiri stranke. Prva je Mateja Kovačič ob devetih.', de: 'Morgen haben Sie vier Kundinnen.', it: 'Domani ha quattro clienti.', hr: 'Sutra imate četiri klijentice.', en: 'Tomorrow you have four clients.' };
const ws = new WebSocket('wss://tts-rt.soniox.com/tts-websocket');
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const cak = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); const c = cak.get(m.stream_id); if (!c) return;
  if (m.error_code) { c.res({ napaka: m.error_code + ' ' + m.error_message }); cak.delete(m.stream_id); return; }
  if (m.audio && !c.prvi) c.prvi = performance.now() - c.t0;
  if (m.terminated) { c.res({ prvi: Math.round(c.prvi), skupaj: Math.round(performance.now() - c.t0) }); cak.delete(m.stream_id); } };
const rez = [];
for (let i = 0; i < 4; i++) for (const [jezik, text] of Object.entries(st)) {
  const id = `s${i}${jezik}`;
  const p = new Promise((res) => cak.set(id, { res, t0: performance.now(), prvi: 0 }));
  ws.send(JSON.stringify({ api_key: process.env.SONIOX_API_KEY, model: 'tts-rt-v2', language: jezik, voice: 'Nina', audio_format: 'pcm_s16le', sample_rate: 24000, speed: 1.04, stream_id: id }));
  ws.send(JSON.stringify({ stream_id: id, text })); ws.send(JSON.stringify({ stream_id: id, text_end: true }));
  rez.push({ jezik, ...(await p) });
}
ws.close();
const prvi = rez.filter((x) => x.prvi).map((x) => x.prvi).sort((a, b) => a - b);
console.log('napak', rez.filter((x) => x.napaka).map((x) => x.napaka), 'prvi zvok med', prvi[Math.floor(prvi.length / 2)], 'min', prvi[0], 'max', prvi.at(-1));
