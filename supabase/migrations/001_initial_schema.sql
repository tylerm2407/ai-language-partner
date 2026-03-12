-- languageAI initial schema
-- Run this migration via: npx supabase db push
-- DO NOT run this directly — use Supabase CLI or Dashboard

-- ─── User Profiles ──────────────────────────────────────────────

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null default '',
  native_language text not null default 'en',
  target_language text not null default 'es',
  level text not null default 'beginner'
    check (level in ('beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced')),
  daily_goal_minutes int not null default 10,
  streak int not null default 0,
  longest_streak int not null default 0,
  streak_freezes int not null default 0,
  total_xp int not null default 0,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Courses ────────────────────────────────────────────────────

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  source_language text not null,
  target_language text not null,
  title text not null,
  description text not null default '',
  image_url text,
  total_units int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─── Units ──────────────────────────────────────────────────────

create table public.units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  description text not null default '',
  order_index int not null default 0,
  total_lessons int not null default 0
);

-- ─── Lessons ────────────────────────────────────────────────────

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references public.units(id) on delete cascade not null,
  title text not null,
  description text not null default '',
  order_index int not null default 0,
  estimated_minutes int not null default 5,
  xp_reward int not null default 10
);

-- ─── Cards (vocabulary items, phrases, sentences) ───────────────

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  unit_id uuid references public.units(id) on delete set null,
  native_text text not null,
  target_text text not null,
  audio_url text,
  image_url text,
  example_sentence text,
  example_sentence_translation text,
  part_of_speech text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── Exercises ──────────────────────────────────────────────────

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  type text not null
    check (type in ('multiple_choice', 'listening_choice', 'listening_type', 'translate_to_target', 'translate_to_native', 'speaking', 'fill_blank', 'free_production')),
  order_index int not null default 0,
  prompt text not null,
  prompt_audio_url text,
  correct_answer text not null,
  accepted_answers text[] not null default '{}',
  options text[], -- for multiple choice
  hint_text text,
  card_id uuid references public.cards(id) on delete set null
);

-- ─── Review Items (SRS state per user per card) ─────────────────

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references public.cards(id) on delete cascade not null,
  ease_factor real not null default 2.5,
  interval int not null default 0,
  repetitions int not null default 0,
  next_due timestamptz not null default now(),
  last_reviewed_at timestamptz,
  status text not null default 'new'
    check (status in ('new', 'learning', 'review', 'graduated', 'leech')),
  unique(user_id, card_id)
);

-- ─── Review Logs ────────────────────────────────────────────────

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references public.cards(id) on delete cascade not null,
  review_item_id uuid references public.review_items(id) on delete cascade not null,
  rating smallint not null check (rating between 0 and 5),
  response_time_ms int not null default 0,
  user_answer text not null default '',
  was_correct boolean not null,
  reviewed_at timestamptz not null default now()
);

-- ─── Daily Stats ────────────────────────────────────────────────

create table public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  lessons_completed int not null default 0,
  cards_reviewed int not null default 0,
  cards_learned int not null default 0,
  minutes_practiced real not null default 0,
  speaking_minutes real not null default 0,
  listening_minutes real not null default 0,
  xp_earned int not null default 0,
  accuracy real not null default 0,
  unique(user_id, date)
);

-- ─── Practice Sessions (AI conversations) ───────────────────────

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  topic text not null default '',
  target_language text not null,
  level text not null default 'beginner',
  messages jsonb not null default '[]',
  duration_minutes real not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- ─── Subscriptions ──────────────────────────────────────────────

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  tier text not null default 'free'
    check (tier in ('free', 'pro', 'premium')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  is_active boolean not null default false
);

-- ─── Indexes ────────────────────────────────────────────────────

create index idx_review_items_user_due on public.review_items(user_id, next_due);
create index idx_review_items_status on public.review_items(user_id, status);
create index idx_review_logs_user on public.review_logs(user_id, reviewed_at);
create index idx_daily_stats_user_date on public.daily_stats(user_id, date);
create index idx_cards_course on public.cards(course_id);
create index idx_exercises_lesson on public.exercises(lesson_id);
create index idx_units_course on public.units(course_id, order_index);
create index idx_lessons_unit on public.lessons(unit_id, order_index);

-- ─── RLS Policies (stubs — configure in Supabase Dashboard) ─────
-- TODO: Enable RLS on all tables and add policies:
-- alter table public.user_profiles enable row level security;
-- create policy "Users can read/update own profile"
--   on public.user_profiles for all using (auth.uid() = user_id);
-- Repeat for review_items, review_logs, daily_stats, practice_sessions, subscriptions.
-- Courses, units, lessons, cards, exercises: read-only for authenticated users.
