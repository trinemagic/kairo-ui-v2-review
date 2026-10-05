-- KAIRO Admin: fungsi ubah paket/subscription dari admin (Okt 2026).
-- Dipakai tombol "Simpan Subscription" / +30 hari di modal Workspace dan "Buat Akun" (paket Pro).
-- Fungsi ini belum ada di database (error: Could not find the function public.platform_admin_update_subscription).
-- Kolom tanggal berakhir dideteksi otomatis (current_period_end / valid_until / expires_at / end_date), jadi aman
-- walau nama kolom di tabel workspace_subscriptions berbeda. Tidak membuat catatan penjualan. Aman diulang.

drop function if exists public.platform_admin_update_subscription(uuid, text, text, timestamptz);

create function public.platform_admin_update_subscription(
  p_workspace_id uuid,
  p_plan text,
  p_status text default 'active',
  p_valid_until timestamptz default null
) returns void
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare
  v_cols text[];
  v_end text;
  v_set text;
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  if p_plan not in ('basic', 'pro') then raise exception 'Paket harus basic atau pro'; end if;
  if not exists (select 1 from public.workspaces where id = p_workspace_id) then raise exception 'Workspace tidak ditemukan'; end if;

  select array_agg(column_name::text) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'workspace_subscriptions';

  v_end := case
    when 'current_period_end' = any(v_cols) then 'current_period_end'
    when 'valid_until' = any(v_cols) then 'valid_until'
    when 'expires_at' = any(v_cols) then 'expires_at'
    when 'end_date' = any(v_cols) then 'end_date'
  end;

  if not exists (select 1 from public.workspace_subscriptions where workspace_id = p_workspace_id) then
    insert into public.workspace_subscriptions (workspace_id, plan) values (p_workspace_id, p_plan);
  end if;

  v_set := 'plan = $1';
  if 'status' = any(v_cols) then v_set := v_set || ', status = $2'; end if;
  if v_end is not null then v_set := v_set || format(', %I = $3', v_end); end if;
  if 'plan_code' = any(v_cols) then v_set := v_set || ', plan_code = $1'; end if;
  if 'updated_at' = any(v_cols) then v_set := v_set || ', updated_at = now()'; end if;

  execute format('update public.workspace_subscriptions set %s where workspace_id = $4', v_set)
  using p_plan, coalesce(nullif(p_status, ''), 'active'), p_valid_until, p_workspace_id;
end;
$$;

revoke all on function public.platform_admin_update_subscription(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.platform_admin_update_subscription(uuid, text, text, timestamptz) to authenticated;

-- Cek: fungsi yang dipakai dashboard & admin tapi BELUM ada di database (hasil kosong = semua lengkap).
select f as fungsi_belum_ada
from unnest(array[
  'is_platform_admin','is_username_available','update_my_username','report_client_error',
  'platform_admin_activity','platform_admin_analytics','platform_admin_business_overview','platform_admin_client_errors',
  'platform_admin_create_followup','platform_admin_crm_rows','platform_admin_custom_requests','platform_admin_delete_custom_item',
  'platform_admin_delete_custom_request','platform_admin_delete_expense','platform_admin_delete_preview','platform_admin_delete_workspace',
  'platform_admin_expenses','platform_admin_followups','platform_admin_get_settings','platform_admin_log_activity',
  'platform_admin_overview','platform_admin_plan_performance','platform_admin_plan_prices','platform_admin_record_expense',
  'platform_admin_record_sale','platform_admin_renewal_queue','platform_admin_revenue_series','platform_admin_sales',
  'platform_admin_save_custom_item','platform_admin_save_custom_request','platform_admin_save_settings','platform_admin_save_workspace_meta',
  'platform_admin_server_health','platform_admin_set_followup_status','platform_admin_update_plan_price','platform_admin_update_sale_status',
  'platform_admin_update_subscription','platform_admin_update_workspace_status','platform_admin_workspace_activity','platform_admin_workspaces'
]) as f
where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f);
