# TxHS Football: plan

A phone app (iOS and Android) for Texas high school football: live fan-reported scores,
fan boards, and stats, records and standings. Launch scope is every UIL public school, 1A to 6A
(including six-man). Private schools (TAPPS, SPC) can be added later; the schema already has an
`is_private` flag so they slot in without a migration rewrite.

## Stack

- **App:** Expo (React Native + TypeScript), one codebase for iOS and Android.
- **Backend:** Supabase: Postgres, auth (email one-time code), Realtime for live scores,
  and one Edge Function (`report-score`) that is the only path for writing scores.
- **Demo mode:** with no Supabase keys the app runs on built-in made-up data, so it can be
  tried in Expo Go today.

## Screens

| Tab / screen | What it does |
| --- | --- |
| Scores | This week's games grouped Live / Upcoming / Final, filter by 1A to 6A, switch weeks. Updates live. |
| Game | Big scoreboard, quarter, how trustworthy the score is, "Report the score" button. |
| Report score | Steppers with +1/+2/+3/+6/+7 buttons and a quarter picker. Pre-filled with the current score. |
| School | Colors, classification/district, record, schedule and results, the school's fan board. |
| Standings | Pick classification and district; district and overall records, points for/against. |
| Boards | General board plus a board per school; threads and replies. |
| Account | Sign in with an emailed code. |

Later: favorites and push notifications for your team, game-day chat per game, player stats,
playoff brackets, records book, private schools.

## Data model (supabase/migrations/0001_init.sql)

- `schools` (name, mascot, city, colors, TEA campus id) and `school_seasons` (classification,
  division, district, region, six-man) per season, because UIL realigns every two years.
- `games` with the **consensus** score fields (score, quarter, confidence, pending score).
- `score_reports`: every fan report, kept forever for auditing and reputation.
- `profiles`: display name, favorite school, role (fan / trusted / school official / moderator),
  reputation, ban.
- `forum_threads`, `forum_posts`, `content_flags`.
- `standings` view computed from confirmed final games, so standings never drift out of sync.

Row-level security: everyone can read; users can only post as themselves; nobody can write scores
or promote themselves from the app (checked against a local Postgres).

## Fan score reporting

1. A signed-in fan at the game taps **Report the score** and enters what the scoreboard shows.
   Reporting opens 30 minutes before kickoff.
2. The `report-score` function rejects junk (negative, over 120, not whole numbers, more than one
   report per person per 30 seconds, banned users) and saves the report with the reporter's weight.
3. It recomputes the consensus (`src/lib/consensus.ts`, covered by unit tests):
   - Each person counts once (their latest report); live reports older than 15 minutes drop out.
   - Matching reports are pooled by weight: fan 1 (up to 1.5 with good reputation), trusted fan
     or moderator 2, school official 5 (only for their own school's games).
   - The heaviest score wins. Shown as **Unconfirmed** with one fan, **Fan confirmed** at weight 2+,
     **Official** if a school official agrees.
   - A lone report that jumps the score by more than 21 points is held back.
   - A newer higher score from a single fan shows as "pending" until someone confirms it.
   - Once anyone reports FINAL, only final reports count, and they never expire.
4. The game row updates and every open app gets it over Realtime.
5. After the game, reports that matched the final raise the reporter's reputation; repeat bad
   reports get flagged for moderators. (Reputation job not built yet.)

Recruiting school officials (sports information directors, stat keepers, band or booster
volunteers) as verified reporters is the single biggest lever on score quality.

## Where the school list comes from

- **UIL football alignment** for 2026-28 (released Feb 2, 2026) gives classification,
  division, district and region for every public school. UIL publishes it on uiltexas.org as
  district listings; it needs one-time conversion to CSV. News coverage of the release:
  [KCBD](https://www.kcbd.com/2026/02/02/deeper-look-uils-2026-28-realignments-impact-across-south-plains/),
  [Austin Sports Journal](https://austinsportsjournal.com/2026/02/02/austin-san-antonio-uil-districts-2026-28/).
- **TEA school directory (AskTED)** gives the official campus id, address and city, so schools can
  be matched across sources.
- **Mascots and colors** are not in either; fill from school sites or let fans submit them for review.
- `scripts/import-alignment.mjs` turns that CSV into SQL and is safe to re-run each realignment.
- **Schedules** have no public feed either: seed from district schedules, then let school officials
  and moderators add or fix games.

I could not open uiltexas.org or the TEA site from this workspace (the network blocks them), so the
exact file formats there are unverified.

## Next steps

1. Create a Supabase project, run the migration, deploy `report-score`, put the URL and anon key in `.env`.
2. Build the 2026-28 alignment CSV and import it.
3. Add schedules, then favorites and push notifications.
4. Moderation tools (flag queue, bans, promote trusted reporters) and the reputation job.
5. App Store / Play Store builds with EAS.
