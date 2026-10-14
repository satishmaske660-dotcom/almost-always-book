-- Run this in the Supabase SQL Editor for the Almost, Always reader review feature.
create table if not exists public.reader_reviews (
  id bigint generated always as identity primary key,
  reader_name text not null check (char_length(trim(reader_name)) between 1 and 60),
  rating integer not null check (rating between 1 and 5),
  review_text text not null check (char_length(trim(review_text)) between 1 and 2000),
  approved boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.reader_reviews enable row level security;

drop policy if exists "Anyone can read approved reviews" on public.reader_reviews;
create policy "Anyone can read approved reviews"
on public.reader_reviews for select
to anon, authenticated
using (approved = true);

drop policy if exists "Anyone can submit a reader review" on public.reader_reviews;
create policy "Anyone can submit a reader review"
on public.reader_reviews for insert
to anon, authenticated
with check (
  approved = true
  and char_length(trim(reader_name)) between 1 and 60
  and rating between 1 and 5
  and char_length(trim(review_text)) between 1 and 2000
);

grant select, insert on public.reader_reviews to anon, authenticated;
grant usage, select on sequence public.reader_reviews_id_seq to anon, authenticated;


-- Enable live review updates in Supabase Realtime (safe to run more than once).
do $
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reader_reviews'
  ) then
    alter publication supabase_realtime add table public.reader_reviews;
  end if;
end $;

-- Optional moderation: set the default to false, then approve reviews from the Supabase dashboard.
alter table public.reader_reviews alter column approved set default true;
