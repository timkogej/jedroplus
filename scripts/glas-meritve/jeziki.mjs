// Okvirni preizkus razpoznave v drugih jezikih: Soniox TTS (Nina) → Soniox STT z namigi. Sintetičen glas = optimistično.
const { wer, imePravilno } = await import(process.argv[2] + '/scripts/glas-stt-primerjava.mjs');
const namigi = ['Mateja Kovačič', 'Ana Novak', 'Špela Žagar', 'Tina', 'Urška', 'Luka Horvat', 'balayage', 'oksidant'];
const S = {
  de: ['Was habe ich morgen?', 'Wann war Mateja Kovačič zuletzt hier?', 'Wer ist heute als Nächstes dran?', 'Notiere bei Ana Novak Farbe 6.3, 30 Gramm, Oxidant 6 Prozent.', 'Verschiebe Špela Žagar auf Freitag um zehn.', 'Wer arbeitet am Samstag?'],
  it: ['Cosa ho domani?', 'Quando è venuta l\'ultima volta Mateja Kovačič?', 'Chi è il prossimo oggi?', 'Annota per Ana Novak colore 6.3, 30 grammi, ossidante 6 per cento.', 'Sposta Špela Žagar a venerdì alle dieci.', 'Chi lavora sabato?'],
  hr: ['Što imam sutra?', 'Kada je Mateja Kovačič zadnji put bila kod nas?', 'Tko je danas sljedeći?', 'Zapiši kod Ane Novak boja 6.3, 30 grama, oksidant 6 posto.', 'Pomakni Špelu Žagar na petak u deset.', 'Tko radi u subotu?'],
  en: ['What do I have tomorrow?', 'When was Mateja Kovačič last here?', 'Who is next today?', 'Note for Ana Novak colour 6.3, 30 grams, developer 6 percent.', 'Move Špela Žagar to Friday at ten.', 'Who is working on Saturday?'],
};
const imena = ['Mateja Kovačič', 'Ana Novak', 'Špela Žagar'];
async function tts(jezik, text) {
  const r = await fetch('https://tts-rt.soniox.com/tts', { method: 'POST', headers: { Authorization: `Bearer ${process.env.SONIOX_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-rt-v2', language: jezik, voice: 'Nina', audio_format: 'pcm_s16le', sample_rate: 16000, text }) });
  if (!r.ok) throw new Error('tts ' + r.status); return Buffer.from(await r.arrayBuffer());
}
function stt(jezik, zvok) {
  return new Promise((res) => { const ws = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket'); let t = '';
    ws.onopen = () => { ws.send(JSON.stringify({ api_key: process.env.SONIOX_API_KEY, model: 'stt-rt-v5', audio_format: 'pcm_s16le', sample_rate: 16000, num_channels: 1, language_hints: [jezik], context: { terms: namigi } }));
      for (let i = 0; i < zvok.length; i += 32000) ws.send(zvok.subarray(i, i + 32000)); ws.send(Buffer.alloc(32000)); ws.send(''); };
    ws.onmessage = (e) => { const m = JSON.parse(e.data); for (const k of m.tokens ?? []) if (k.is_final && k.text !== '<end>') t += k.text; if (m.finished || m.error_code) { ws.close(); res(m.error_code ? 'NAPAKA ' + m.error_message : t.trim()); } }; });
}
for (const [j, stavki] of Object.entries(S)) {
  let w = 0, ok = 0, n = 0; const slabi = [];
  for (const s of stavki) { const p = await stt(j, await tts(j, s)); const e = wer(s, p); w += e; if (e > 0.1) slabi.push(`${s} → ${p}`);
    for (const ime of imena) if (s.includes(ime.split(' ')[0].slice(0, 3))) { n++; if (imePravilno(ime, p)) ok++; } }
  console.log(j, 'WER', (w / stavki.length * 100).toFixed(1) + '%', 'imena', ok + '/' + n); for (const x of slabi) console.log('   ', x);
}
