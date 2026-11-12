// @ts-nocheck — merilna skripta (faza 0), ni del aplikacije.
// Meritev LLM: zdajšnji način (brez pretakanja, privzeti effort) proti pretakanju + effort low,
// in "en krog" (podatki že v pozivu, odgovor se pretaka kot govor).
import Anthropic from '@anthropic-ai/sdk';
import { SISTEM } from '@/lib/glas/jedro';
import { VSA_ORODJA } from '@/lib/glas/orodja/registry';

const c = new Anthropic({ maxRetries: 0, timeout: 20000 });
const model = 'claude-haiku-5-5';
const tools = VSA_ORODJA.filter((o) => o.omogoceno !== false).map((o) => ({ name: o.ime, description: o.opis, input_schema: o.shema as Anthropic.Tool.InputSchema, strict: true }));
const uvod = (u: string) => `Danes je danes, četrtek, 12. 11. (2026-11-12), ura 10:00. Uporabnik: owner, ima svoj koledar.\n<ukaz>${u}</ukaz>`;
const PODATKI = `<podatki>Jutri, petek 13. 11.: 09:00–10:30 Mateja Kovačič (Barvanje, Tina); 11:00–11:30 Ana Novak (Moško striženje, Urška); 13:00–14:30 Petra Zupan (Pramenri, Tina); 15:00–15:45 Jure Kralj (Moško striženje, Urška).</podatki>`;

async function enKlic(nacin: string, ukaz: string, opts: { stream: boolean; effort?: 'low'; podatki?: boolean }) {
  const t0 = performance.now();
  let prvi = 0;
  const body: any = {
    model, max_tokens: 400, thinking: { type: 'disabled' },
    system: [{ type: 'text', text: opts.podatki ? SISTEM + '\nOdgovori takoj iz podatkov, kot bi govoril (brez seznamov).' : SISTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: (opts.podatki ? PODATKI + '\n' : '') + uvod(ukaz) }],
    ...(opts.podatki ? {} : { tools, tool_choice: { type: 'auto' } }),
    ...(opts.effort ? { output_config: { effort: opts.effort } } : {}),
  };
  let izhod = '';
  if (opts.stream) {
    const s = c.messages.stream(body);
    s.on('streamEvent', (e: any) => { if (!prvi && e.type === 'content_block_start') prvi = performance.now() - t0; });
    s.on('text', (t) => { izhod += t; });
    const m = await s.finalMessage();
    if (!izhod) izhod = JSON.stringify(m.content.find((b: any) => b.type === 'tool_use')?.name ?? '');
    return { nacin, prvi: Math.round(prvi), skupaj: Math.round(performance.now() - t0), izhod: izhod.slice(0, 90), vhod: m.usage.input_tokens + (m.usage.cache_read_input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0) };
  }
  const m = await c.messages.create(body);
  const tu = m.content.find((b: any) => b.type === 'tool_use') as any;
  const tx = m.content.find((b: any) => b.type === 'text') as any;
  return { nacin, prvi: null, skupaj: Math.round(performance.now() - t0), izhod: (tu ? 'orodje:' + tu.name : tx?.text ?? '').slice(0, 90), vhod: m.usage.input_tokens + (m.usage.cache_read_input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0) };
}

const ukazi = ['Kdaj je bila Mateja Kovačič nazadnje pri nas?', 'Kdo je jutri prvi?', 'Zapiši pri Ani Novak barvo 6.3, 30 gramov.'];
const rez: any[] = [];
// hladen prvi klic
rez.push({ ...(await enKlic('hladen (zdaj)', ukazi[0], { stream: false })) });
for (let i = 0; i < 4; i++) {
  for (const u of ukazi) {
    rez.push(await enKlic('zdaj', u, { stream: false }));
    rez.push(await enKlic('stream+low', u, { stream: true, effort: 'low' }));
  }
  rez.push(await enKlic('en krog (podatki v pozivu) stream+low', 'Kdo je jutri prvi in kdo zadnji?', { stream: true, effort: 'low', podatki: true }));
  rez.push(await enKlic('en krog (podatki v pozivu) stream', 'Kdo je jutri prvi in kdo zadnji?', { stream: true, podatki: true }));
}
console.log(JSON.stringify(rez));
