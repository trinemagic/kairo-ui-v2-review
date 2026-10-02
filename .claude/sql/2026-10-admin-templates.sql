-- KAIRO Admin: jumlah workspace per template (Okt 2026).
-- Menambah kolom business_template ke fungsi aktivitas workspace yang sudah ada.
-- Jalankan sekali di Supabase > SQL Editor (aman diulang). Tidak mengubah data.

drop function if exists public.platform_admin_workspace_activity();
create or replace function public.platform_admin_workspace_activity()
returns table (workspace_id uuid, workspace_created_at timestamptz, last_tx_at timestamptz, tx_30d bigint,
               owner_last_sign_in timestamptz, requested_variant text, owner_phone text, business_template text)
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
         u.raw_user_meta_data ->> 'phone',
         u.raw_user_meta_data ->> 'business_template'
  from public.workspaces w
  left join lateral (
    select wm.user_id from public.workspace_members wm
    where wm.workspace_id = w.id and lower(wm.role) = 'owner' limit 1) o on true
  left join auth.users u on u.id = o.user_id;
end $$;

revoke all on function public.platform_admin_workspace_activity() from public, anon;
grant execute on function public.platform_admin_workspace_activity() to authenticated;
