#!/usr/bin/env node
// Turns a UIL football alignment CSV into SQL for the schools and school_seasons tables.
//
//   node scripts/import-alignment.mjs data/alignment-2026.csv 2026 2026-28 > supabase/seed.sql
//
// Needs migration 0002 (unique school names).
// Columns: name,classification,division,district,region,six_man and optionally mascot,city,colors,tea_campus_id
// colors is "primary|secondary". division is I, II or blank (6A). Re-running is safe: schools are
// matched by UIL name and their season row is replaced.
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
for (const need of ['name', 'classification', 'district', 'region']) {
  if (!(need in col)) throw new Error(`missing column ${need}`);
}

const errors = [];
const schools = [];
const seasons = [];
rows.forEach((r, i) => {
  const v = (k) => (k in col ? r[col[k]] ?? '' : '');
  const cls = v('classification').toUpperCase();
  if (!/^[1-6]A$/.test(cls)) errors.push(`row ${i + 2}: bad classification "${cls}"`);
  if (!/^\d+$/.test(v('district'))) errors.push(`row ${i + 2}: bad district "${v('district')}"`);
  if (!/^[1-4]$/.test(v('region'))) errors.push(`row ${i + 2}: bad region "${v('region')}"`);
  const div = v('division').toUpperCase();
  if (div && div !== 'I' && div !== 'II') errors.push(`row ${i + 2}: bad division "${div}"`);
  const colors = v('colors') ? `array[${v('colors').split('|').map(q).join(',')}]` : "'{}'::text[]";
  schools.push(`(${q(v('name'))}, ${q(v('mascot'))}, ${q(v('city'))}, ${colors}, ${q(v('tea_campus_id'))})`);
  seasons.push(`(${q(v('name'))}, ${q(cls)}, ${q(div)}, ${Number(v('district'))}, ${Number(v('region'))}, ${v('six_man') === 'true'})`);
});
const lines = [
  'begin;',
  `insert into seasons (year, alignment_cycle) values (${Number(year)}, ${q(cycle)})
  on conflict (year) do update set alignment_cycle = excluded.alignment_cycle;`,
  // Blank mascot/city/colors in the CSV never wipe values already filled in.
  `insert into schools (name, mascot, city, colors, tea_campus_id) values
${schools.join(',\n')}
on conflict (name) do update set
  mascot = coalesce(excluded.mascot, schools.mascot),
  city = coalesce(excluded.city, schools.city),
  colors = case when excluded.colors = '{}' then schools.colors else excluded.colors end,
  tea_campus_id = coalesce(excluded.tea_campus_id, schools.tea_campus_id);`,
  `insert into school_seasons (school_id, season_year, classification, division, district, region, six_man)
select s.id, ${Number(year)}, v.classification::classification, v.division, v.district, v.region, v.six_man
from (values
${seasons.join(',\n')}
) as v(name, classification, division, district, region, six_man)
join schools s on s.name = v.name
on conflict (school_id, season_year) do update set classification = excluded.classification, division = excluded.division,
  district = excluded.district, region = excluded.region, six_man = excluded.six_man;`,
];
lines.push('commit;');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(lines.join('\n'));
console.error(`${rows.length} schools`);
