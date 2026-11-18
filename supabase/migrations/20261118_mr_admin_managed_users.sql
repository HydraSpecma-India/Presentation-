-- Applied 2026-11-18 (migration "mr_admin_managed_users").
-- No self sign-up for this app: admins create accounts with a temporary password.

alter table public.mr_members add column if not exists must_change_password boolean not null default false;

-- Creates a login for a new @hydraspecma.com user, or only grants access when the person already
-- has a login from another app in this shared Supabase project (their password is not touched).
create or replace function public.mr_admin_create_user(p_email text, p_full_name text, p_role text, p_temp_password text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_admin text := lower(auth.jwt() ->> 'email');
begin
  if not public.mr_has_role('admin') then raise exception 'Only administrators can create users'; end if;
  if v_email !~ '^[^\s@]+@hydraspecma\.com$' then raise exception 'Only @hydraspecma.com addresses can be added'; end if;
  if p_role not in ('viewer', 'editor', 'admin') then raise exception 'Invalid role'; end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    insert into public.mr_members (email, role, added_by)
    values (v_email, p_role, v_admin)
    on conflict (email) do update set role = excluded.role;
    return 'existing';
  end if;

  if length(coalesce(p_temp_password, '')) < 8 then raise exception 'Temporary password must be at least 8 characters'; end if;

  uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_super_admin, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_temp_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', coalesce(nullif(trim(p_full_name), ''), split_part(v_email, '@', 1)), 'app_name', 'management-report'),
    '', '', '', '', false, false, false
  );
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now());

  insert into public.mr_members (email, role, added_by, must_change_password)
  values (v_email, p_role, v_admin, true)
  on conflict (email) do update set role = excluded.role, must_change_password = true;
  return 'created';
end $$;

-- Only for accounts this app created: logins shared with other apps are never touched here.
create or replace function public.mr_admin_reset_password(p_email text, p_temp_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.mr_has_role('admin') then raise exception 'Only administrators can reset passwords'; end if;
  if length(coalesce(p_temp_password, '')) < 8 then raise exception 'Temporary password must be at least 8 characters'; end if;
  if not exists (select 1 from public.mr_members where email = v_email) then raise exception 'Not a member of this app'; end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_temp_password, extensions.gen_salt('bf')), updated_at = now()
   where lower(email) = v_email and raw_user_meta_data ->> 'app_name' = 'management-report';
  if not found then
    raise exception 'This login is shared with another HydraSpecma app. The user can reset it with "Forgot password" on the sign-in page.';
  end if;
  update public.mr_members set must_change_password = true where email = v_email;
end $$;

-- Called by the signed-in user after choosing their own password.
create or replace function public.mr_password_changed()
returns void
language sql
security definer
set search_path = public
as $$
  update public.mr_members set must_change_password = false
  where email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

revoke execute on function public.mr_admin_create_user(text, text, text, text), public.mr_admin_reset_password(text, text), public.mr_password_changed() from anon, public;
grant execute on function public.mr_admin_create_user(text, text, text, text), public.mr_admin_reset_password(text, text), public.mr_password_changed() to authenticated;
