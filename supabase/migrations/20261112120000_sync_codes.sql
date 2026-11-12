-- ============================================================================================
-- Mathesis Reader: sync codes, in place of signing in, for the private texts.
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query), after 20261013120000_private_translations.sql
-- (in _old-reference/supabase/migrations).
--
-- The new reader asks for no email and no password. A device that holds a sync code can read the private texts;
-- a device without one sees nothing. A code is made here, in the SQL editor, and typed once on each device.
--
-- Security model
--   * A code is 20 characters from Crockford's base 32 (0-9 and A-Z without I, L, O, U): 100 random bits, too many
--     to guess. The database keeps only its SHA-256, never the code, so a copy of the table gives no code away.
--   * The browser (role anon) gets no right on any table. It may call two functions, private_texts and private_text,
--     which check the code before reading anything, and raise error 28000 for a code they do not know.
--   * Making a code (new_sync_code) is for the SQL editor alone. Removing a code's row stops it working on every
--     device that holds it.
--   * The old app's moderator policies on private_translations are untouched: its admin page works as before.
-- ============================================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

create table public.sync_codes (
  code_hash bytea primary key,           -- sha256 of the code without its hyphens
  note      text,                        -- whatever helps you tell codes apart ("phone", "2026 laptop")
  made_at   timestamptz not null default now()
);
alter table public.sync_codes enable row level security;
revoke all on table public.sync_codes from public, anon, authenticated;

create function public.sync_code_ok(code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sync_codes s where s.code_hash = sha256(convert_to(code, 'UTF8')));
$$;

-- The private texts as the library lists them: a few fields of each document, newest first.
create function public.private_texts(code text) returns table (id text, title text, author text, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sync_code_ok(code) then raise exception 'unknown sync code' using errcode = '28000'; end if;
  return query
    select t.id, t.doc ->> 'title', t.doc ->> 'author', t.doc ->> 'status'
    from public.private_translations t order by t.updated_at desc;
end $$;

-- One private text's document, or null when there is none with that id.
create function public.private_text(code text, text_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sync_code_ok(code) then raise exception 'unknown sync code' using errcode = '28000'; end if;
  return (select t.doc from public.private_translations t where t.id = text_id);
end $$;

-- Makes a code, keeps its hash, and returns it once, as XXXX-XXXX-XXXX-XXXX-XXXX. Copy it then: it cannot be shown again.
create function public.new_sync_code(note text default null) returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea := extensions.gen_random_bytes(20);
  code text := '';
begin
  for i in 0..19 loop
    code := code || substr(alphabet, get_byte(bytes, i) % 32 + 1, 1);   -- 256 is a multiple of 32, so every letter is as likely
  end loop;
  insert into public.sync_codes (code_hash, note) values (sha256(convert_to(code, 'UTF8')), note);
  return concat_ws('-', substr(code, 1, 4), substr(code, 5, 4), substr(code, 9, 4), substr(code, 13, 4), substr(code, 17, 4));
end $$;

-- A new function may be run by anyone until told otherwise, so every right is written here.
revoke execute on function public.sync_code_ok(text), public.private_texts(text), public.private_text(text, text),
  public.new_sync_code(text) from public, anon, authenticated;
grant execute on function public.private_texts(text), public.private_text(text, text) to anon, authenticated;

commit;

-- ------------------------------------------------------------------------------ to use
-- Make a code:              select public.new_sync_code('phone');
-- See which codes exist:    select note, made_at from public.sync_codes order by made_at;
-- Stop one working:         delete from public.sync_codes where note = 'phone';
