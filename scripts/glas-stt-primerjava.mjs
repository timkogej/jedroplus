#!/usr/bin/env node
// scripts/glas-stt-primerjava.mjs
//
// Primerjava ponudnikov STT na slovenskih posnetkih iz salona.
//
//   ELEVENLABS_API_KEY=… OPENAI_API_KEY=… \
//     node scripts/glas-stt-primerjava.mjs posnetki/ [--namigi namigi.txt] [--ponudniki elevenlabs,openai]
//
// Meri: WER (napaka po besedah), pravilna imena strank, pravilni odtenki barv
// (6.3, 7.1 …), zakasnitev (mediana, p90) in okviren strošek na ukaz.
// Rezultat izpiše kot tabelo in shrani v <mapa>/stt-rezultat-<datum>.json.
//
// Ključi samo iz okolja; v izpisih in datoteki z rezultati jih ni.
// Posnetki se pošljejo ponudnikom — uporabljajte posnetke brez pravih osebnih podatkov
// ali z izrecnim soglasjem.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TU = path.dirname(fileURLToPath(import.meta.url));

// ───────────────── argumenti ─────────────────
const args = process.argv.slice(2);
const mapa = args.find((a) => !a.startsWith('--'));
const opcija = (ime) => {
  const i = args.indexOf(`--${ime}`);
  return i >= 0 ? args[i + 1] : null;
};

// Cene (USD na uro zvoka) — preverite na straneh ponudnikov; uporabljene samo za oceno.
const CENA_NA_URO = { elevenlabs: 0.4, 'elevenlabs+namigi': 0.48, openai: 0.18, 'openai+namigi': 0.18 };

// ───────────────── poenotenje besedila ─────────────────
const STEVILA = {
  nic: 0, nula: 0, ena: 1, en: 1, eno: 1, dva: 2, dve: 2, tri: 3, stiri: 4, pet: 5, sest: 6, sedem: 7, osem: 8, devet: 9,
  deset: 10, enajst: 11, dvanajst: 12, trinajst: 13, stirinajst: 14, petnajst: 15, sestnajst: 16, sedemnajst: 17,
  osemnajst: 18, devetnajst: 19, dvajset: 20, trideset: 30, stirideset: 40, petdeset: 50, sestdeset: 60,
  sedemdeset: 70, osemdeset: 80, devetdeset: 90, sto: 100,
};
const ENICE = { ena: 1, en: 1, dva: 2, tri: 3, stiri: 4, pet: 5, sest: 6, sedem: 7, osem: 8, devet: 9 };
const DESETICE = { dvajset: 20, trideset: 30, stirideset: 40, petdeset: 50, sestdeset: 60, sedemdeset: 70, osemdeset: 80, devetdeset: 90 };
const DECIMALKA = new Set(['pika', 'cela', 'celih', 'cele', 'celo']);
const MASILA = new Set(['uh', 'uhm', 'eee', 'ee', 'hm', 'mhm', 'aaa']);
const brezSumnikov = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

function besedaVStevilo(b) {
  if (b in STEVILA) return String(STEVILA[b]);
  const m = b.match(/^([a-z]+?)in([a-z]+)$/); // petinstirideset → 45
  if (m && m[1] in ENICE && m[2] in DESETICE) return String(ENICE[m[1]] + DESETICE[m[2]]);
  return b;
}

/**
 * Poenoti zapis, da primerjamo vsebino, ne pravopisa:
 * "šest pika tri" / "6,3" / "6/3" → "6.3"; "sedem cela štiri tri" → "7.43";
 * "petinštirideset" → "45"; "%"/"procente" → "procentov"; mašila (uh, hm) izpuščena.
 */
export function poenoti(s) {
  let t = brezSumnikov(String(s).toLowerCase());
  t = t.replace(/(\d)(?:[,/]|\s\/\s)(\d)/g, '$1.$2'); // "6,3" in "6/3", ne pa "7.1, 30 g"
  t = t.replace(/\s*%/g, ' procentov').replace(/\bodstot\w*|\bprocent\w*/g, 'procentov');
  t = t.replace(/[^\p{L}\p{N}.\s]/gu, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ');
  const besede = t.split(/\s+/).filter((b) => b && !MASILA.has(b)).map(besedaVStevilo);
  const stevka = (x) => /^\d$/.test(x ?? '');
  const out = [];
  for (let i = 0; i < besede.length; i++) {
    const b = besede[i];
    if (DECIMALKA.has(b) && /^\d+$/.test(out.at(-1) ?? '') && /^\d+$/.test(besede[i + 1] ?? '')) {
      let dec = besede[++i];
      // "štiri tri" po decimalki = 43 (odtenki imajo do dve decimalki)
      if (stevka(dec) && stevka(besede[i + 1])) dec += besede[++i];
      out[out.length - 1] = `${out.at(-1)}.${dec}`;
    } else if (b === 'in' && /^\d0$/.test(besede[i + 1] ?? '') && stevka(out.at(-1))) {
      out[out.length - 1] = String(Number(besede[++i]) + Number(out.at(-1))); // "pet in štirideset"
    } else {
      out.push(b);
    }
  }
  return out;
}

/** Word error rate (Levenshtein po besedah). */
export function wer(referenca, hipoteza) {
  const r = poenoti(referenca);
  const h = poenoti(hipoteza);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  let prej = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) {
    const zdaj = [i];
    for (let j = 1; j <= h.length; j++) {
      zdaj[j] = Math.min(prej[j] + 1, zdaj[j - 1] + 1, prej[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
    prej = zdaj;
  }
  return prej[h.length] / r.length;
}

/** Ime je pravilno, če so vse njegove besede v prepisu (sklon do 2 črki razlike na koncu). */
export function imePravilno(ime, hipoteza) {
  const h = poenoti(hipoteza);
  return poenoti(ime).every((del) => {
    const koren = del.length > 4 ? del.slice(0, del.length - 2) : del.slice(0, Math.max(2, del.length - 1));
    return h.some((b) => b.startsWith(koren) && Math.abs(b.length - del.length) <= 2);
  });
}

export function odtenkiVPrepisu(hipoteza) {
  return poenoti(hipoteza).filter((b) => /^\d{1,2}\.\d{1,2}$/.test(b));
}

// ───────────────── stavki ─────────────────
async function preberiStavke(pot) {
  const md = await readFile(pot, 'utf8');
  const blok = md.split('<!-- stavki:zacetek -->')[1]?.split('<!-- stavki:konec -->')[0] ?? '';
  const stavki = new Map();
  for (const vrstica of blok.split('\n')) {
    const deli = vrstica.split('|').map((x) => x.trim());
    if (deli.length < 4 || !/^\d+$/.test(deli[0])) continue;
    const seznam = (d, oznaka) => d.replace(`${oznaka}:`, '').split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    stavki.set(Number(deli[0]), {
      besedilo: deli[1],
      imena: seznam(deli[2], 'imena'),
      odtenki: seznam(deli[3], 'odtenki').map((o) => o.replace(',', '.')),
    });
  }
  return stavki;
}

// ───────────────── ponudniki ─────────────────
const MIME = { '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

async function klic(url, init, poskusov = 2) {
  for (let i = 0; ; i++) {
    const t0 = performance.now();
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    const ms = performance.now() - t0;
    if (res.ok) return { json: await res.json(), ms };
    if (i + 1 >= poskusov || (res.status < 500 && res.status !== 429)) {
      throw new Error(`HTTP ${res.status}`); // telesa odgovora ne izpisujemo
    }
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
}

const PONUDNIKI = {
  async elevenlabs(zvok, ime, namigi) {
    const kljuc = process.env.ELEVENLABS_API_KEY;
    const f = new FormData();
    f.append('model_id', process.env.GLAS_ELEVENLABS_MODEL || 'scribe_v2');
    f.append('file', zvok, ime);
    f.append('language_code', 'sl');
    f.append('tag_audio_events', 'false');
    for (const n of namigi.slice(0, 100)) f.append('keyterms', n);
    const { json, ms } = await klic('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': kljuc }, body: f });
    return { besedilo: json.text ?? '', sekunde: Number(json.audio_duration_secs ?? 0), ms };
  },
  async openai(zvok, ime, namigi) {
    const kljuc = process.env.OPENAI_API_KEY;
    const f = new FormData();
    f.append('model', process.env.GLAS_OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe');
    f.append('file', zvok, ime);
    f.append('language', 'sl');
    f.append('response_format', 'json');
    if (namigi.length) f.append('prompt', `Salon. Izrazi: ${namigi.slice(0, 100).join(', ')}.`);
    const { json, ms } = await klic('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${kljuc}` }, body: f });
    return { besedilo: json.text ?? '', sekunde: 0, ms };
  },
};
const KLJUCI = { elevenlabs: 'ELEVENLABS_API_KEY', openai: 'OPENAI_API_KEY' };

// ───────────────── glavno ─────────────────
const percentil = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

/** Oceni prepise glede na pričakovane stavke (tudi za ponovno točkovanje shranjenih rezultatov). */
function oceni(rezultati, stavki) {
  // OpenAI ne vrne trajanja: vzamemo ga iz drugega ponudnika za isti posnetek.
  const trajanje = new Map();
  for (const x of rezultati) if (x.sekunde) trajanje.set(x.stavek, x.sekunde);
  return rezultati.map((x) => {
    if (x.napaka) return x;
    const ref = stavki.get(x.stavek);
    const najdeni = odtenkiVPrepisu(x.prepis);
    return {
      ...x,
      sekunde: x.sekunde || trajanje.get(x.stavek) || 0,
      wer: wer(ref.besedilo, x.prepis),
      imena: ref.imena.map((i) => ({ ime: i, ok: imePravilno(i, x.prepis) })),
      odtenki: ref.odtenki.map((o) => ({ odtenek: o, ok: najdeni.includes(o) })),
    };
  });
}

function izpisi(rezultati) {
  const imenaVariant = [...new Set(rezultati.map((x) => x.ponudnik))];
  const povzetek = imenaVariant.map((ime) => {
    const r = rezultati.filter((x) => x.ponudnik === ime && !x.napaka);
    const imena = r.flatMap((x) => x.imena);
    const odtenki = r.flatMap((x) => x.odtenki);
    const sekunde = r.reduce((a, x) => a + (x.sekunde || 0), 0);
    const cena = CENA_NA_URO[ime] ?? 0;
    return {
      ponudnik: ime,
      posnetkov: r.length,
      napak: rezultati.filter((x) => x.ponudnik === ime && x.napaka).length,
      wer: r.length ? r.reduce((a, x) => a + x.wer, 0) / r.length : null,
      imena: imena.length ? imena.filter((x) => x.ok).length / imena.length : null,
      odtenki: odtenki.length ? odtenki.filter((x) => x.ok).length / odtenki.length : null,
      mediana_ms: percentil(r.map((x) => x.ms), 50),
      p90_ms: percentil(r.map((x) => x.ms), 90),
      centov_na_ukaz: r.length && sekunde ? ((sekunde / 3600) * cena * 100) / r.length : null,
    };
  });

  const pct = (v) => (v === null ? '—' : `${(v * 100).toFixed(1)} %`);
  console.table(
    povzetek.map((p) => ({
      ponudnik: p.ponudnik, posnetkov: p.posnetkov, napak: p.napak, WER: pct(p.wer), imena: pct(p.imena), odtenki: pct(p.odtenki),
      'mediana ms': Math.round(p.mediana_ms), 'p90 ms': Math.round(p.p90_ms),
      'centov/ukaz': p.centov_na_ukaz === null ? '—' : p.centov_na_ukaz.toFixed(3),
    }))
  );
  console.log('Najslabši stavki (WER) po ponudniku:');
  for (const ime of imenaVariant) {
    const naj = rezultati.filter((x) => x.ponudnik === ime && !x.napaka).sort((a, b) => b.wer - a.wer).slice(0, 3);
    for (const x of naj) console.log(`  ${ime} #${x.stavek} WER ${pct(x.wer)}: „${x.prepis}“`);
  }
  const zgresenaImena = rezultati.filter((x) => !x.napaka).flatMap((x) => x.imena.filter((i) => !i.ok).map((i) => `${x.ponudnik} #${x.stavek} ${i.ime}`));
  const zgreseniOdtenki = rezultati.filter((x) => !x.napaka).flatMap((x) => x.odtenki.filter((o) => !o.ok).map((o) => `${x.ponudnik} #${x.stavek} ${o.odtenek}`));
  if (zgresenaImena.length) console.log(`\nZgrešena imena:\n  ${zgresenaImena.join('\n  ')}`);
  if (zgreseniOdtenki.length) console.log(`\nZgrešeni odtenki:\n  ${zgreseniOdtenki.join('\n  ')}`);
  return povzetek;
}

async function main() {
  const stavki = await preberiStavke(opcija('stavki') ?? path.join(TU, 'glas-stt-stavki.md'));

  // Ponovno točkovanje brez klicev ponudnikov: --ponovno <stt-rezultat-….json>
  if (opcija('ponovno')) {
    const shranjeno = JSON.parse(await readFile(opcija('ponovno'), 'utf8'));
    const rezultati = oceni(shranjeno.rezultati, stavki);
    const povzetek = izpisi(rezultati);
    await writeFile(opcija('ponovno'), JSON.stringify({ povzetek, rezultati }, null, 2));
    return;
  }

  if (!mapa) {
    console.error('Uporaba: node scripts/glas-stt-primerjava.mjs <mapa-s-posnetki> [--namigi namigi.txt] [--ponudniki elevenlabs,openai] [--stavki pot.md]\n       node scripts/glas-stt-primerjava.mjs --ponovno <stt-rezultat.json>');
    process.exit(1);
  }
  const namigi = opcija('namigi')
    ? (await readFile(opcija('namigi'), 'utf8')).split('\n').map((x) => x.trim()).filter((x) => x && x.length <= 50)
    : [];
  const zeleni = (opcija('ponudniki') ?? 'elevenlabs,openai').split(',').map((x) => x.trim());
  const ponudniki = zeleni.filter((p) => {
    if (!PONUDNIKI[p]) return console.warn(`Neznan ponudnik: ${p}`), false;
    if (!process.env[KLJUCI[p]]) return console.warn(`Preskočen ${p}: ni ${KLJUCI[p]}`), false;
    return true;
  });
  if (!ponudniki.length) {
    console.error('Ni ponudnika s ključem. Nastavite ELEVENLABS_API_KEY in/ali OPENAI_API_KEY.');
    process.exit(1);
  }

  const datoteke = (await readdir(mapa)).filter((d) => MIME[path.extname(d).toLowerCase()] && /^\d+/.test(d)).sort();
  if (!datoteke.length) {
    console.error(`V ${mapa} ni posnetkov (01.m4a, 02.m4a …).`);
    process.exit(1);
  }

  const variante = ponudniki.flatMap((p) => (namigi.length ? [[p, []], [`${p}+namigi`, namigi]] : [[p, []]]));
  const surovi = [];
  for (const d of datoteke) {
    const st = Number(d.match(/^\d+/)[0]);
    if (!stavki.has(st)) {
      console.warn(`Preskočen ${d}: stavka ${st} ni v seznamu.`);
      continue;
    }
    const buf = await readFile(path.join(mapa, d));
    const zvok = new Blob([buf], { type: MIME[path.extname(d).toLowerCase()] });
    for (const [ime, n] of variante) {
      const p = ime.split('+')[0];
      try {
        const r = await PONUDNIKI[p](zvok, d, n);
        surovi.push({ stavek: st, ponudnik: ime, prepis: r.besedilo, ms: Math.round(r.ms), sekunde: r.sekunde });
        process.stdout.write('.');
      } catch (e) {
        surovi.push({ stavek: st, ponudnik: ime, napaka: e instanceof Error ? e.message : 'napaka' });
        process.stdout.write('x');
      }
    }
  }
  console.log('\n');

  const rezultati = oceni(surovi, stavki);
  const povzetek = izpisi(rezultati);
  const izhod = path.join(mapa, `stt-rezultat-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
  await writeFile(izhod, JSON.stringify({ povzetek, rezultati }, null, 2));
  console.log(`\nPodrobnosti: ${izhod}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
