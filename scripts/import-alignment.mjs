#!/usr/bin/env node
// Turns a UIL football alignment CSV into SQL for the schools and school_seasons tables.
//
//   node scripts/import-alignment.mjs data/alignment-2026.csv 2026 2026-28 > supabase/seed.sql
//
// Columns: name,mascot,city,classification,division,district,region,six_man,colors,tea_campus_id
// colors is "primary|secondary". division is I, II or blank. Re-running is safe: schools are
// matched by name + city and their season row is replaced.
import { readFileSync } from 'node:fs';

const [file, year, cycle] = process.argv.slice(2);
if (!file || !year || !cycle) {
  console.error('usage: import-alignment.mjs <csv> <season year> <alignment cycle, e.g. 2026-28>');
  process.exit(1);
}

// Minimal CSV parser that handles quoted fields with commas.
function parse(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const out = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    rows.push(out.map((s) => s.trim()));
  }
  return rows;
}

const q = (s) => (s === '' || s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const [header, ...rows] = parse(readFileSync(file, 'utf8'));
const col = Object.fromEntries(header.map((h, i) => [h, i]));
for (const need of ['name', 'mascot', 'city', 'classification', 'district', 'region']) {
  if (!(need in col)) throw new Error(`missing column ${need}`);
}

const errors = [];
const lines = [
  'begin;',
  `insert into seasons (year, alignment_cycle) values (${Number(year)}, ${q(cycle)}) on conflict (year) do update set alignment_cycle = excluded.alignment_cycle;`,
];
rows.forEach((r, i) => {
  const v = (k) => (k in col ? r[col[k]] ?? '' : '');
  const cls = v('classification').toUpperCase();
  if (!/^[1-6]A$/.test(cls)) errors.push(`row ${i + 2}: bad classification "${cls}"`);
  if (!/^\d+$/.test(v('district'))) errors.push(`row ${i + 2}: bad district "${v('district')}"`);
  const div = v('division').toUpperCase();
  if (div && div !== 'I' && div !== 'II') errors.push(`row ${i + 2}: bad division "${div}"`);
  const colors = v('colors') ? `array[${v('colors').split('|').map(q).join(',')}]` : "'{}'";
  lines.push(
    `with s as (
  insert into schools (name, mascot, city, colors, tea_campus_id)
  select ${q(v('name'))}, ${q(v('mascot'))}, ${q(v('city'))}, ${colors}, ${q(v('tea_campus_id'))}
  where not exists (select 1 from schools where name = ${q(v('name'))} and city = ${q(v('city'))})
  returning id
), target as (select id from s union all select id from schools where name = ${q(v('name'))} and city = ${q(v('city'))})
insert into school_seasons (school_id, season_year, classification, division, district, region, six_man)
select id, ${Number(year)}, ${q(cls)}, ${q(div)}, ${Number(v('district'))}, ${Number(v('region'))}, ${v('six_man') === 'true'} from target limit 1
on conflict (school_id, season_year) do update set classification = excluded.classification, division = excluded.division,
  district = excluded.district, region = excluded.region, six_man = excluded.six_man;`,
  );
});
lines.push('commit;');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(lines.join('\n'));
console.error(`${rows.length} schools`);
