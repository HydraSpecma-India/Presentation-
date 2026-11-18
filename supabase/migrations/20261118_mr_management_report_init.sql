-- Applied to the Supabase project on 2026-11-18 (migration "mr_management_report_init").
-- Management Report Builder: all objects are prefixed mr_ because the project is shared with
-- other apps. Access is decided here (row-level security), not in the browser.

create table public.mr_members (
  email text primary key check (email = lower(email) and email like '%@hydraspecma.com'),
  role text not null default 'editor' check (role in ('viewer', 'editor', 'admin')),
  added_by text,
  created_at timestamptz not null default now()
);
comment on table public.mr_members is 'Management Report Builder: who may use the app. Only @hydraspecma.com addresses.';

create table public.mr_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  data jsonb not null,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.mr_reports is 'Management Report Builder: one row per report (slides as JSON, images in storage bucket mr-images).';
create index mr_reports_updated_at_idx on public.mr_reports (updated_at desc);

-- Role of the signed-in user (null = no access). Email comes from the verified JWT.
create or replace function public.mr_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.mr_members m
  where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.mr_has_role(minimum text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (case public.mr_role() when 'admin' then 3 when 'editor' then 2 when 'viewer' then 1 else 0 end)
    >= (case minimum when 'admin' then 3 when 'editor' then 2 else 1 end),
    false)
$$;

-- Server-side audit stamps: clients cannot fake who created or changed a report.
create or replace function public.mr_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by_email := lower(auth.jwt() ->> 'email');
  if tg_op = 'INSERT' then
    new.created_by_email := new.updated_by_email;
    new.created_at := now();
  else
    new.created_by_email := old.created_by_email;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

create trigger mr_reports_touch before insert or update on public.mr_reports
for each row execute function public.mr_touch();

alter table public.mr_members enable row level security;
alter table public.mr_reports enable row level security;

create policy mr_members_read on public.mr_members for select to authenticated
  using (public.mr_has_role('admin') or email = lower(auth.jwt() ->> 'email'));
create policy mr_members_admin_insert on public.mr_members for insert to authenticated
  with check (public.mr_has_role('admin'));
create policy mr_members_admin_update on public.mr_members for update to authenticated
  using (public.mr_has_role('admin')) with check (public.mr_has_role('admin'));
create policy mr_members_admin_delete on public.mr_members for delete to authenticated
  using (public.mr_has_role('admin') and email <> lower(auth.jwt() ->> 'email'));

create policy mr_reports_read on public.mr_reports for select to authenticated
  using (public.mr_has_role('viewer'));
create policy mr_reports_insert on public.mr_reports for insert to authenticated
  with check (public.mr_has_role('editor'));
create policy mr_reports_update on public.mr_reports for update to authenticated
  using (public.mr_has_role('editor')) with check (public.mr_has_role('editor'));
create policy mr_reports_delete on public.mr_reports for delete to authenticated
  using (public.mr_has_role('admin'));

revoke all on public.mr_members, public.mr_reports from anon;
revoke execute on function public.mr_role(), public.mr_has_role(text) from anon, public;
grant execute on function public.mr_role(), public.mr_has_role(text) to authenticated;

-- Private image bucket: <report id>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mr-images', 'mr-images', false, 10485760, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

create policy mr_images_read on storage.objects for select to authenticated
  using (bucket_id = 'mr-images' and public.mr_has_role('viewer'));
create policy mr_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'mr-images' and public.mr_has_role('editor'));
create policy mr_images_update on storage.objects for update to authenticated
  using (bucket_id = 'mr-images' and public.mr_has_role('editor'));
create policy mr_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'mr-images' and public.mr_has_role('editor'));

-- First admin. Further members are managed on the /members page.
insert into public.mr_members (email, role, added_by)
values ('manigandan.parthasarathi@hydraspecma.com', 'admin', 'setup');
