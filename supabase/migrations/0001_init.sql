-- TxHS Football initial schema.
-- Clients read almost everything; clients never write scores directly.
-- Score reports go through the report-score Edge Function, which validates them,
-- stores them with the service role, and rewrites the game's consensus score.

create type classification as enum ('1A', '2A', '3A', '4A', '5A', '6A');
create type game_status as enum ('scheduled', 'live', 'final');
create type game_period as enum ('Q1', 'Q2', 'HALF', 'Q3', 'Q4', 'OT', 'FINAL');
create type score_confidence as enum ('none', 'unconfirmed', 'confirmed', 'official');
create type reporter_role as enum ('fan', 'trusted', 'school_official', 'moderator');

-- Schools ------------------------------------------------------------------

create table schools (
  id uuid primary key default gen_random_uuid(),
  tea_campus_id text unique,          -- TEA county-district-campus number, for matching data sources
  name text not null,
  mascot text not null,
  city text not null,
  colors text[] not null default '{}',
  is_private boolean not null default false  -- room for TAPPS/SPC later
);

create table seasons (
  year int primary key,               -- 2026 = the fall 2026 season
  alignment_cycle text not null       -- '2026-28'
);

-- Classification and district change every two years at UIL realignment,
-- so they live per season, not on the school.
create table school_seasons (
  school_id uuid references schools on delete cascade,
  season_year int references seasons,
  classification classification not null,
  division text check (division in ('I', 'II')),
  district int not null,
  region int not null,
  six_man boolean not null default false,
  primary key (school_id, season_year)
);
create index on school_seasons (season_year, classification, division, district);

-- Games --------------------------------------------------------------------

create table games (
  id uuid primary key default gen_random_uuid(),
  season_year int not null references seasons,
  week int not null,
  kickoff timestamptz not null,
  home_school_id uuid not null references schools,
  away_school_id uuid not null references schools,
  is_district_game boolean not null default false,
  venue text,
  -- Consensus, written only by the Edge Function.
  status game_status not null default 'scheduled',
  home_score int,
  away_score int,
  period game_period,
  confidence score_confidence not null default 'none',
  pending_home_score int,
  pending_away_score int,
  score_updated_at timestamptz,
  check (home_school_id <> away_school_id)
);
create index on games (kickoff);
create index on games (season_year, week);

-- People -------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  favorite_school_id uuid references schools,
  role reporter_role not null default 'fan',
  -- For school_official: which school they may report officially for.
  official_school_id uuid references schools,
  reputation int not null default 0,
  banned_until timestamptz,
  created_at timestamptz not null default now()
);

-- Score reports --------------------------------------------------------------

create table score_reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games on delete cascade,
  reporter_id uuid not null references profiles,
  home_score int not null check (home_score between 0 and 120),
  away_score int not null check (away_score between 0 and 120),
  period game_period not null,
  weight numeric not null,
  created_at timestamptz not null default now(),
  -- Set after the game when compared against the final score; feeds reputation.
  matched_final boolean
);
create index on score_reports (game_id, created_at desc);
create index on score_reports (reporter_id, game_id, created_at desc);

-- Forums -------------------------------------------------------------------

create table forum_threads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools on delete cascade,
  game_id uuid references games on delete cascade,
  author_id uuid not null references profiles,
  title text not null check (char_length(title) between 3 and 120),
  reply_count int not null default 0,
  last_post_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  hidden boolean not null default false,
  check (num_nonnulls(school_id, game_id) <= 1)  -- both null = general board
);
create index on forum_threads (school_id, last_post_at desc);
create index on forum_threads (game_id);

create table forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references forum_threads on delete cascade,
  author_id uuid not null references profiles,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  hidden boolean not null default false
);
create index on forum_posts (thread_id, created_at);

create table content_flags (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles,
  post_id uuid references forum_posts on delete cascade,
  thread_id uuid references forum_threads on delete cascade,
  score_report_id uuid references score_reports on delete cascade,
  reason text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function bump_thread() returns trigger language plpgsql security definer as $$
begin
  update forum_threads set reply_count = reply_count + 1, last_post_at = new.created_at where id = new.thread_id;
  return new;
end $$;
create trigger forum_posts_bump after insert on forum_posts for each row execute function bump_thread();

-- Standings ----------------------------------------------------------------
-- Derived from final games, so there is nothing to keep in sync by hand.

create view standings with (security_invoker = true) as
with results as (
  select g.season_year, g.home_school_id as school_id, g.is_district_game,
         g.home_score as pf, g.away_score as pa
  from games g where g.status = 'final' and g.confidence in ('confirmed', 'official')
  union all
  select g.season_year, g.away_school_id, g.is_district_game, g.away_score, g.home_score
  from games g where g.status = 'final' and g.confidence in ('confirmed', 'official')
)
select ss.season_year, ss.school_id, ss.classification, ss.division, ss.district,
  count(*) filter (where r.is_district_game and r.pf > r.pa) as district_wins,
  count(*) filter (where r.is_district_game and r.pf < r.pa) as district_losses,
  count(*) filter (where r.pf > r.pa) as overall_wins,
  count(*) filter (where r.pf < r.pa) as overall_losses,
  coalesce(sum(r.pf), 0) as points_for,
  coalesce(sum(r.pa), 0) as points_against
from school_seasons ss
left join results r on r.school_id = ss.school_id and r.season_year = ss.season_year
group by ss.season_year, ss.school_id, ss.classification, ss.division, ss.district;

-- Row level security ---------------------------------------------------------

alter table schools enable row level security;
alter table seasons enable row level security;
alter table school_seasons enable row level security;
alter table games enable row level security;
alter table profiles enable row level security;
alter table score_reports enable row level security;
alter table forum_threads enable row level security;
alter table forum_posts enable row level security;
alter table content_flags enable row level security;

create policy "public read" on schools for select using (true);
create policy "public read" on seasons for select using (true);
create policy "public read" on school_seasons for select using (true);
create policy "public read" on games for select using (true);
create policy "public read" on profiles for select using (true);
create policy "public read" on score_reports for select using (true);
-- No insert/update policies on games or score_reports: only the Edge Function (service role) writes them.

create policy "own profile insert" on profiles for insert with check (auth.uid() = id and role = 'fan' and reputation = 0);
create policy "own profile update" on profiles for update using (auth.uid() = id);
-- Stop users promoting themselves: role, reputation and bans are not client-editable.
revoke update on profiles from authenticated;
grant update (display_name, favorite_school_id) on profiles to authenticated;

create or replace function not_banned() returns boolean language sql stable security definer as $$
  select coalesce((select banned_until is null or banned_until < now() from profiles where id = auth.uid()), false)
$$;

create policy "read visible" on forum_threads for select using (not hidden);
create policy "create thread" on forum_threads for insert with check (auth.uid() = author_id and not_banned());
create policy "read visible" on forum_posts for select using (not hidden);
create policy "create post" on forum_posts for insert with check (auth.uid() = author_id and not_banned());
create policy "flag content" on content_flags for insert with check (auth.uid() = reporter_id);

-- Live score updates reach the app over Supabase Realtime.
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table forum_posts;
