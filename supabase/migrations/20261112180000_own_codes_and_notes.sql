-- ============================================================================================
-- Mathesis Reader: each sync code is its own, and notes are kept under it.
-- Run once in the Supabase SQL editor, after 20261112120000_sync_codes.sql.
--
-- What changes
--   * Anyone can make a code on the Sync page (make_sync_code). A new code starts empty: it holds only the notes made with it.
--   * The private texts open only for a code marked as the owner's. Mark yours once, here:
--       select public.make_owner('XXXX-XXXX-XXXX-XXXX-XXXX');
--     Any other code, made by anyone, gets an empty list of private texts.
--   * Notes: one row per note, under the hash of the code that made it. The browser reads and writes them only through
--     notes_list and notes_save, which check the code first. A note is at most 20,000 characters of JSON, a code holds at most
--     5,000 notes, and the site makes at most 200 new codes an hour, so nobody can fill the database through the page.
-- ============================================================================================

begin;

alter table public.sync_codes add column owner boolean not null default false;

create function public.sync_code_hash(code text) returns bytea
language sql immutable set search_path = '' as $$
  select sha256(convert_to(upper(replace(replace(code, '-', ''), ' ', '')), 'UTF8'));
$$;

create function public.sync_code_owner(code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.owner from public.sync_codes s where s.code_hash = public.sync_code_hash(code)), false);
$$;

create or replace function public.private_texts(code text) returns table (id text, title text, author text, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sync_code_ok(code) then raise exception 'unknown sync code' using errcode = '28000'; end if;
  if not public.sync_code_owner(code) then return; end if;
  return query
    select t.id, t.doc ->> 'title', t.doc ->> 'author', t.doc ->> 'status'
    from public.private_translations t order by t.updated_at desc;
end $$;

create or replace function public.private_text(code text, text_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sync_code_ok(code) then raise exception 'unknown sync code' using errcode = '28000'; end if;
  if not public.sync_code_owner(code) then return null; end if;
  return (select t.doc from public.private_translations t where t.id = text_id);
end $$;

-- The Sync page's "Make a new code": the same code new_sync_code makes, returned once and kept only as a hash.
create function public.make_sync_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select count(*) from public.sync_codes s where s.made_at > now() - interval '1 hour') >= 200 then
    raise exception 'too many new codes this hour, try again later' using errcode = '54000';
  end if;
  return public.new_sync_code(null);
end $$;

-- For the SQL editor: mark your own code as the owner's, so it opens the private texts. Says whether the code was found.
create function public.make_owner(code text) returns boolean
language plpgsql volatile set search_path = '' as $$
begin
  update public.sync_codes s set owner = true where s.code_hash = public.sync_code_hash(code);
  return found;
end $$;

create table public.notes (
  code_hash  bytea not null references public.sync_codes (code_hash) on delete cascade,
  id         text not null check (id ~ '^[a-z0-9-]{1,40}$'),
  note       jsonb not null check (length(note::text) <= 20000),
  updated    bigint not null,             -- the note's own time, in ms, set by the device that changed it last
  primary key (code_hash, id)
);
alter table public.notes enable row level security;
revoke all on table public.notes from public, anon, authenticated;

create function public.notes_list(code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.sync_code_ok(code) then raise exception 'unknown sync code' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(n.note) from public.notes n where n.code_hash = public.sync_code_hash(code)), '[]'::jsonb);
end $$;

-- Keeps each note given, unless the database already has a newer copy of it (the later change wins, on every device).
create function public.notes_save(code text, notes jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  h bytea := public.sync_code_hash(code);
begin
  if not public.sync_code_ok(code) then raise exception 'unknown sync code' using errcode = '28000'; end if;
  if jsonb_typeof(notes) <> 'array' or jsonb_array_length(notes) > 500 then
    raise exception 'notes must be a list of at most 500' using errcode = '22023';
  end if;
  insert into public.notes as n (code_hash, id, note, updated)
    select h, x ->> 'id', x, (x ->> 'updated')::bigint from jsonb_array_elements(notes) x
    on conflict (code_hash, id) do update set note = excluded.note, updated = excluded.updated
    where n.updated < excluded.updated;
  if (select count(*) from public.notes n where n.code_hash = h) > 5000 then
    raise exception 'a code holds at most 5,000 notes' using errcode = '54000';
  end if;
end $$;

revoke execute on function public.sync_code_hash(text), public.sync_code_owner(text), public.make_sync_code(),
  public.make_owner(text), public.notes_list(text), public.notes_save(text, jsonb) from public, anon, authenticated;
grant execute on function public.make_sync_code(), public.notes_list(text), public.notes_save(text, jsonb) to anon, authenticated;

commit;
