-- KAIRO Admin v2 (Okt 2026): kapasitas server, deteksi masalah user, catatan request paket Custom.
-- Jalankan sekali di Supabase › SQL Editor (aman diulang). Tidak mengubah/menghapus data lama.
-- Semua fungsi admin menolak akun yang bukan platform admin (memakai public.is_platform_admin()).

-- ── 1. KAPASITAS SERVER ───────────────────────────────────────────────────────
create or replace function public.platform_admin_server_health()
returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare r jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  select jsonb_build_object(
    'db_size_bytes',      pg_database_size(current_database()),
    'connections_total',  (select count(*) from pg_stat_activity where datname = current_database()),
    'connections_active', (select count(*) from pg_stat_activity where datname = current_database() and state = 'active'),
    'max_connections',    current_setting('max_connections')::int,
    'cache_hit_pct',      (select round(100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0), 2)
                             from pg_stat_database where datname = current_database()),
    'auth_users',         (select count(*) from auth.users),
    'active_users_24h',   (select count(*) from auth.users where last_sign_in_at > now() - interval '24 hours'),
    'transactions_24h',   (select count(*) from public.transactions where created_at > now() - interval '24 hours'),
    'top_tables',         (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                             select c.relname as name, pg_total_relation_size(c.oid) as bytes, greatest(c.reltuples, 0)::bigint as rows
                             from pg_class c join pg_namespace n on n.oid = c.relnamespace
                             where n.nspname = 'public' and c.relkind = 'r'
                             order by pg_total_relation_size(c.oid) desc limit 8) t),
    'checked_at',         now()
  ) into r;
  return r;
end $$;

-- ── 2. DETEKSI MASALAH: aktivitas per workspace ──────────────────────────────
create or replace function public.platform_admin_workspace_activity()
returns table (workspace_id uuid, workspace_created_at timestamptz, last_tx_at timestamptz, tx_30d bigint,
               owner_last_sign_in timestamptz, requested_variant text, owner_phone text)
language plpgsql security definer
set search_path = public, pg_catalog
as $$
#variable_conflict use_column
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  return query
  select w.id, w.created_at,
         (select max(t.created_at) from public.transactions t where t.workspace_id = w.id),
         (select count(*) from public.transactions t where t.workspace_id = w.id and t.created_at > now() - interval '30 days'),
         u.last_sign_in_at,
         u.raw_user_meta_data ->> 'requested_variant',
         u.raw_user_meta_data ->> 'phone'
  from public.workspaces w
  left join lateral (
    select wm.user_id from public.workspace_members wm
    where wm.workspace_id = w.id and lower(wm.role) = 'owner' limit 1) o on true
  left join auth.users u on u.id = o.user_id;
end $$;

-- ── 3. DETEKSI MASALAH: error yang dialami user di aplikasi ───────────────────
-- Pesan error, lokasi file/baris/kolom, stack trace, halaman, versi app, browser. Tidak menyimpan isi form/data transaksi.
create table if not exists public.platform_client_errors (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  user_id      uuid,
  workspace_id uuid,
  page         text,
  message      text not null,
  source       text,
  line         int,
  user_agent   text
);
-- kolom tambahan untuk analisa (stack trace, kolom, versi app)
alter table public.platform_client_errors add column if not exists col int;
alter table public.platform_client_errors add column if not exists stack text;
alter table public.platform_client_errors add column if not exists app_version text;
create index if not exists platform_client_errors_created_idx on public.platform_client_errors (created_at desc);
alter table public.platform_client_errors enable row level security;   -- tanpa policy: tidak bisa dibaca/ditulis langsung

drop function if exists public.report_client_error(uuid, text, text, text, int, text);
create or replace function public.report_client_error(p_workspace_id uuid, p_page text, p_message text,
                                                      p_source text, p_line int, p_user_agent text,
                                                      p_col int default null, p_stack text default null,
                                                      p_app_version text default null)
returns void
language plpgsql security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or coalesce(trim(p_message), '') = '' then return; end if;
  -- maksimal 30 laporan per user per jam (anti-spam)
  if (select count(*) from public.platform_client_errors
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then return; end if;
  insert into public.platform_client_errors (user_id, workspace_id, page, message, source, line, user_agent, col, stack, app_version)
  values (auth.uid(),
          case when exists (select 1 from public.workspace_members wm
                            where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid())
               then p_workspace_id end,
          left(p_page, 40), left(p_message, 500), left(p_source, 200), p_line, left(p_user_agent, 200),
          p_col, left(p_stack, 2000), left(p_app_version, 40));
  delete from public.platform_client_errors where created_at < now() - interval '30 days';
end $$;

drop function if exists public.platform_admin_client_errors(int);
create or replace function public.platform_admin_client_errors(p_hours int default 72)
returns table (message text, source text, line int, page text, occurrences bigint, users bigint,
               workspace_names text[], first_seen timestamptz, last_seen timestamptz,
               col int, stack text, app_versions text[], user_agents text[])
language plpgsql security definer
set search_path = public, pg_catalog
as $$
#variable_conflict use_column
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  return query
  select e.message, e.source, e.line, e.page, count(*), count(distinct e.user_id),
         array_remove(array_agg(distinct w.name), null), min(e.created_at), max(e.created_at),
         max(e.col),
         (array_remove(array_agg(e.stack order by e.created_at desc), null))[1],
         array_remove(array_agg(distinct e.app_version), null),
         (array_remove(array_agg(distinct e.user_agent), null))[1:3]
  from public.platform_client_errors e
  left join public.workspaces w on w.id = e.workspace_id
  where e.created_at > now() - make_interval(hours => greatest(p_hours, 1))
  group by e.message, e.source, e.line, e.page
  order by max(e.created_at) desc
  limit 200;
end $$;

-- ── 4. REQUEST PAKET CUSTOM + CHECKLIST ───────────────────────────────────────
create table if not exists public.platform_custom_requests (
  id            bigserial primary key,
  workspace_id  uuid references public.workspaces(id) on delete set null,
  customer_name text,
  contact       text,
  title         text not null,
  detail        text,
  price         numeric not null default 0,
  status        text not null default 'pending' check (status in ('pending', 'on_progress', 'success')),
  start_date    date,
  due_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create table if not exists public.platform_custom_request_items (
  id          bigserial primary key,
  request_id  bigint not null references public.platform_custom_requests(id) on delete cascade,
  label       text not null,
  status      text not null default 'pending' check (status in ('pending', 'on_progress', 'success')),
  note        text,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists platform_custom_request_items_req_idx on public.platform_custom_request_items (request_id);
alter table public.platform_custom_requests enable row level security;
alter table public.platform_custom_request_items enable row level security;

create or replace function public.platform_admin_custom_requests()
returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(r) || jsonb_build_object(
             'workspace_name', w.name,
             'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.sort, i.id)
                                from public.platform_custom_request_items i where i.request_id = r.id), '[]'::jsonb))
           order by r.updated_at desc)
    from public.platform_custom_requests r
    left join public.workspaces w on w.id = r.workspace_id), '[]'::jsonb);
end $$;

create or replace function public.platform_admin_save_custom_request(
  p_id bigint, p_workspace_id uuid, p_customer_name text, p_contact text, p_title text, p_detail text,
  p_price numeric, p_status text, p_start_date date, p_due_date date)
returns bigint
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare v_id bigint;
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Judul request wajib diisi'; end if;
  if p_id is null then
    insert into public.platform_custom_requests (workspace_id, customer_name, contact, title, detail, price, status, start_date, due_date)
    values (p_workspace_id, p_customer_name, p_contact, trim(p_title), p_detail, coalesce(p_price, 0),
            coalesce(nullif(p_status, ''), 'pending'), p_start_date, p_due_date)
    returning id into v_id;
  else
    update public.platform_custom_requests set
      workspace_id = p_workspace_id, customer_name = p_customer_name, contact = p_contact, title = trim(p_title),
      detail = p_detail, price = coalesce(p_price, 0), status = coalesce(nullif(p_status, ''), status),
      start_date = p_start_date, due_date = p_due_date, updated_at = now()
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.platform_admin_delete_custom_request(p_id bigint)
returns void
language plpgsql security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  delete from public.platform_custom_requests where id = p_id;
end $$;

-- Simpan 1 poin checklist; status request ikut dihitung ulang dari semua poinnya.
create or replace function public.platform_admin_save_custom_item(
  p_id bigint, p_request_id bigint, p_label text, p_status text, p_note text)
returns bigint
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare v_id bigint; v_req bigint; v_total int; v_done int; v_pending int;
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  if p_id is null then
    if coalesce(trim(p_label), '') = '' then raise exception 'Isi poin checklist dulu'; end if;
    insert into public.platform_custom_request_items (request_id, label, status, note, sort)
    values (p_request_id, trim(p_label), coalesce(nullif(p_status, ''), 'pending'), p_note,
            coalesce((select max(sort) + 1 from public.platform_custom_request_items where request_id = p_request_id), 0))
    returning id, request_id into v_id, v_req;
  else
    update public.platform_custom_request_items set
      label = coalesce(nullif(trim(p_label), ''), label), status = coalesce(nullif(p_status, ''), status),
      note = coalesce(p_note, note), updated_at = now()
    where id = p_id returning id, request_id into v_id, v_req;
  end if;
  select count(*), count(*) filter (where status = 'success'), count(*) filter (where status = 'pending')
    into v_total, v_done, v_pending
    from public.platform_custom_request_items where request_id = v_req;
  update public.platform_custom_requests set
    status = case when v_total > 0 and v_done = v_total then 'success'
                  when v_pending = v_total then 'pending' else 'on_progress' end,
    updated_at = now()
  where id = v_req;
  return v_id;
end $$;

create or replace function public.platform_admin_delete_custom_item(p_id bigint)
returns void
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare v_req bigint; v_total int; v_done int; v_pending int;
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  delete from public.platform_custom_request_items where id = p_id returning request_id into v_req;
  if v_req is null then return; end if;
  select count(*), count(*) filter (where status = 'success'), count(*) filter (where status = 'pending')
    into v_total, v_done, v_pending
    from public.platform_custom_request_items where request_id = v_req;
  update public.platform_custom_requests set
    status = case when v_total > 0 and v_done = v_total then 'success'
                  when v_pending = v_total then 'pending' else 'on_progress' end,
    updated_at = now()
  where id = v_req;
end $$;

-- ── 5. HAK AKSES FUNGSI ──────────────────────────────────────────────────────
revoke all on function public.platform_admin_server_health() from public, anon;
revoke all on function public.platform_admin_workspace_activity() from public, anon;
revoke all on function public.report_client_error(uuid, text, text, text, int, text, int, text, text) from public, anon;
revoke all on function public.platform_admin_client_errors(int) from public, anon;
revoke all on function public.platform_admin_custom_requests() from public, anon;
revoke all on function public.platform_admin_save_custom_request(bigint, uuid, text, text, text, text, numeric, text, date, date) from public, anon;
revoke all on function public.platform_admin_delete_custom_request(bigint) from public, anon;
revoke all on function public.platform_admin_save_custom_item(bigint, bigint, text, text, text) from public, anon;
revoke all on function public.platform_admin_delete_custom_item(bigint) from public, anon;
grant execute on function public.platform_admin_server_health() to authenticated;
grant execute on function public.platform_admin_workspace_activity() to authenticated;
grant execute on function public.report_client_error(uuid, text, text, text, int, text, int, text, text) to authenticated;
grant execute on function public.platform_admin_client_errors(int) to authenticated;
grant execute on function public.platform_admin_custom_requests() to authenticated;
grant execute on function public.platform_admin_save_custom_request(bigint, uuid, text, text, text, text, numeric, text, date, date) to authenticated;
grant execute on function public.platform_admin_delete_custom_request(bigint) to authenticated;
grant execute on function public.platform_admin_save_custom_item(bigint, bigint, text, text, text) to authenticated;
grant execute on function public.platform_admin_delete_custom_item(bigint) to authenticated;
