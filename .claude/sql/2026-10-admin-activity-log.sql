-- KAIRO Admin: Log Aktivitas (Okt 2026).
-- Fungsi platform_admin_activity tidak pernah ada di database, jadi Log Aktivitas selalu kosong dan admin
-- menampilkan "Sebagian data gagal dimuat". File ini membuat tabel log + 2 fungsi. Aman diulang, tidak mengubah data lain.
-- Admin panel mencatat sendiri setiap aksi yang berhasil (ubah paket, status, penjualan, hapus workspace, dll).

create table if not exists public.platform_admin_activity_log (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  actor_id       uuid default auth.uid(),
  workspace_id   uuid,            -- sengaja tanpa foreign key: log tetap ada walau workspace dihapus
  workspace_name text,
  action         text not null,
  detail         text
);
create index if not exists platform_admin_activity_log_created_idx on public.platform_admin_activity_log (created_at desc);
alter table public.platform_admin_activity_log enable row level security;  -- hanya lewat fungsi di bawah
revoke all on public.platform_admin_activity_log from anon, authenticated;

drop function if exists public.platform_admin_activity(integer);
create or replace function public.platform_admin_activity(p_limit integer default 100)
returns table (id bigint, created_at timestamptz, workspace_id uuid, workspace_name text, action text, detail text)
language plpgsql security definer
set search_path = public, pg_catalog
as $$
#variable_conflict use_column
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  return query
  select l.id, l.created_at, l.workspace_id, l.workspace_name, l.action, l.detail
  from public.platform_admin_activity_log l
  order by l.created_at desc, l.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 1000));
end $$;
revoke all on function public.platform_admin_activity(integer) from public, anon;
grant execute on function public.platform_admin_activity(integer) to authenticated;

drop function if exists public.platform_admin_log_activity(text, uuid, text, text);
create or replace function public.platform_admin_log_activity(p_action text, p_workspace_id uuid default null,
                                                              p_workspace_name text default null, p_detail text default null)
returns void
language plpgsql security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  insert into public.platform_admin_activity_log (workspace_id, workspace_name, action, detail)
  values (p_workspace_id, left(p_workspace_name, 200), left(coalesce(nullif(trim(p_action), ''), 'aksi admin'), 120), left(p_detail, 500));
  -- simpan 5000 catatan terakhir saja
  delete from public.platform_admin_activity_log
  where id < (select min(id) from (select id from public.platform_admin_activity_log order by id desc limit 5000) t);
end $$;
revoke all on function public.platform_admin_log_activity(text, uuid, text, text) from public, anon;
grant execute on function public.platform_admin_log_activity(text, uuid, text, text) to authenticated;
