// Applies corrections from a filled-in translation review sheet
// (jedroplus-prevod-<locale>.xlsx) to messages/<locale>/*.json.
// Usage: node scripts/apply-translation-review.mjs <locale> <file.xlsx>
// Reads the second sheet: column D = "<namespace>:<key.path>", column I = correction.
// Rows with an empty correction are left as they are. Run check-messages afterwards.
import fs from 'fs';
import * as XLSX from 'xlsx';

const [locale, file] = process.argv.slice(2);
if (!locale || !file) {
  console.error('usage: node scripts/apply-translation-review.mjs <locale> <file.xlsx>');
  process.exit(2);
}
const wb = XLSX.read(fs.readFileSync(file));
const sheet = wb.Sheets[wb.SheetNames[1]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }).slice(1);

const files = {};
let applied = 0;
for (const row of rows) {
  const id = String(row[3] ?? '').trim();
  const fix = String(row[8] ?? '').trim();
  if (!id || !fix) continue;
  const [ns, path] = id.split(':');
  const target = `messages/${locale}/${ns}.json`;
  if (!fs.existsSync(target)) { console.warn(`skip ${id}: no ${target}`); continue; }
  files[target] ??= JSON.parse(fs.readFileSync(target, 'utf8'));
  const keys = path.split('.');
  let node = files[target];
  for (const k of keys.slice(0, -1)) node = node?.[k];
  const last = keys.at(-1);
  if (node == null || !(last in node)) { console.warn(`skip ${id}: key not found`); continue; }
  if (node[last] !== fix) { node[last] = fix; applied++; }
}
for (const [target, data] of Object.entries(files)) {
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
}
console.log(`${applied} correction(s) applied to messages/${locale}. Now run: node scripts/check-messages.mjs ${locale}`);
