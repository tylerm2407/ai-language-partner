-- Chat history persistence: sessions and messages
-- Allows users to resume conversations and review past practice sessions.

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_key text not null,
  target_language text not null,
  level text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chat_sessions_user on public.chat_sessions(user_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  correction text,
  audio_url text,
  created_at timestamptz not null default now()
);

create index idx_chat_messages_session on public.chat_messages(session_id, created_at asc);

-- RLS
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy "Users can manage own chat sessions"
  on public.chat_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own chat messages"
  on public.chat_messages for all
  using (
    session_id in (
      select id from public.chat_sessions where user_id = auth.uid()
    )
  )
  with check (
    session_id in (
      select id from public.chat_sessions where user_id = auth.uid()
    )
  );
