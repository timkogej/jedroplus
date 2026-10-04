// Checks messages/<locale>/*.json against messages/en: same files, same keys,
// same {placeholders} and <tags>. Usage: node scripts/check-messages.mjs de
import fs from 'fs';
import path from 'path';

const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/check-messages.mjs <locale>');
  process.exit(2);
}
const base = 'messages/en';
let problems = 0;
const report = (msg) => { problems++; console.log(msg); };

function flat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flat(v, key, out);
    else out[key] = String(v);
  }
  return out;
}
// Top-level ICU argument names ({count}, {name, plural, …}); nested plural
// branches are free text and not compared.
function args(text) {
  const names = new Set();
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{') {
      if (depth === 0 && text[i + 1] !== '{') {
        const m = /^\{\s*([A-Za-z0-9_]+)\s*[,}]/.exec(text.slice(i));
        if (m) names.add(m[1]);
      }
      depth++;
    } else if (c === '}') depth--;
  }
  return [...names].sort().join(',');
}
const tags = (t) => [...t.matchAll(/<\/?([a-zA-Z0-9]+)>/g)].map((m) => m[0]).sort().join('');
const vars = (t) => [...t.matchAll(/\{\{[a-z_]+\}\}/g)].map((m) => m[0]).sort().join('');

for (const file of fs.readdirSync(base)) {
  const tp = path.join('messages', target, file);
  if (!fs.existsSync(tp)) { report(`missing file ${tp}`); continue; }
  const en = flat(JSON.parse(fs.readFileSync(path.join(base, file), 'utf8')));
  const tr = flat(JSON.parse(fs.readFileSync(tp, 'utf8')));
  for (const key of Object.keys(en)) {
    if (!(key in tr)) { report(`${file}: missing ${key}`); continue; }
    if (args(en[key]) !== args(tr[key])) report(`${file}: ${key} placeholders ${args(en[key])} ≠ ${args(tr[key])}`);
    if (tags(en[key]) !== tags(tr[key])) report(`${file}: ${key} tags differ`);
    if (vars(en[key]) !== vars(tr[key])) report(`${file}: ${key} {{variables}} differ`);
    if (tr[key].trim() === '' && en[key].trim() !== '') report(`${file}: ${key} empty`);
    // ICU treats ' before < { } # as the start of quoted text (swallows tags/args):
    // write a typographic apostrophe (’) there instead.
    if (/'[<{}#]/.test(tr[key])) report(`${file}: ${key} has ' before a tag or placeholder (use ’)`);
  }
  for (const key of Object.keys(tr)) if (!(key in en)) report(`${file}: extra ${key}`);
}
console.log(problems ? `${problems} problem(s)` : `messages/${target} OK`);
process.exit(problems ? 1 : 0);
