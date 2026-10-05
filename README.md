# TxHS Football

Phone app for Texas high school football: fan-reported live scores, fan boards, standings.
See [docs/PLAN.md](docs/PLAN.md) for the plan.

## Run it

```bash
npm install
npx expo start      # scan the QR code with Expo Go on your phone
```

With no `.env` the app runs on made-up demo data. To use a real backend, copy `.env.example`
to `.env` and fill in your Supabase project's URL and anon key.

## Checks

```bash
npm run typecheck
npm test            # score consensus rules
```

## Backend

- `supabase/migrations/0001_init.sql`: tables, standings view, row-level security.
- `supabase/functions/report-score`: the only way scores get written.
- `scripts/import-alignment.mjs`: UIL alignment CSV to SQL (`data/alignment.sample.csv` shows the format).
