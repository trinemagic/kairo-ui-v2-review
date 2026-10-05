-- KAIRO: retensi data paket Gratis (Okt 2026, sesuai S&K: data Gratis > 12 bulan dapat dihapus, pemberitahuan >= 30 hari).
-- 1) Kolom workspace_branding.data_retention (jsonb): {notice_at, through, count} = pemberitahuan yang sedang berjalan;
--    {last_purge_at, last_through} = penghapusan terakhir.
-- 2) Fungsi kairo_retention_apply: dipanggil dashboard pemilik workspace Gratis setelah 30 hari pemberitahuan.
--    Dalam SATU transaksi database (gagal = tidak ada yang terhapus):
--      - hapus transaksi / pencairan / pengeluaran & pemasukan kas / sesi Open Store sebelum tanggal p_through
--        (kecuali transaksi di p_keep_tx: langganan seller yang masih aktif),
--      - simpan baris "Saldo awal" (p_rows, dihitung dashboard) supaya saldo partner & Kas tidak berubah.
--    Ditolak bila: bukan pemilik, workspace masih Pro aktif, pemberitahuan belum 30 hari, atau tanggal < 12 bulan.
-- Aman diulang.

alter table public.workspace_branding add column if not exists data_retention jsonb;

drop function if exists public.kairo_retention_apply(uuid, date, text[], jsonb);

create function public.kairo_retention_apply(
  p_workspace_id uuid,
  p_through date,
  p_keep_tx text[] default '{}',
  p_rows jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare
  v_ret jsonb;
  v_sub record;
  v_cols text[];
  v_end text;
  v_end_at timestamptz;
  v_pro boolean := false;
  v_counts jsonb := '{}'::jsonb;
  v_n int;
  v_tbl text;
  v_datecol text;
  v_row jsonb;
  v_keys text[];
begin
  -- Pemilik aktif workspace ini saja.
  if not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid() and lower(m.role) = 'owner' and m.status = 'active'
  ) then raise exception 'Akses ditolak' using errcode = '42501'; end if;

  -- Workspace Pro yang masih aktif tidak boleh dihapus datanya.
  select array_agg(column_name::text) into v_cols from information_schema.columns
  where table_schema = 'public' and table_name = 'workspace_subscriptions';
  v_end := case when 'current_period_end' = any(v_cols) then 'current_period_end' when 'valid_until' = any(v_cols) then 'valid_until'
                when 'expires_at' = any(v_cols) then 'expires_at' when 'end_date' = any(v_cols) then 'end_date' end;
  select * into v_sub from public.workspace_subscriptions where workspace_id = p_workspace_id limit 1;
  if found and lower(coalesce(v_sub.plan, '')) in ('pro', 'plus', 'custom', 'enterprise')
     and lower(coalesce(v_sub.status, 'active')) not in ('canceled', 'cancelled', 'inactive', 'expired') then
    v_pro := true;
    if v_end is not null then
      execute format('select (%I)::timestamptz from public.workspace_subscriptions where workspace_id = $1 limit 1', v_end) into v_end_at using p_workspace_id;
      if v_end_at is not null and v_end_at < now() then v_pro := false; end if;
    end if;
  end if;
  if v_pro then raise exception 'Workspace Pro aktif: data tidak dihapus'; end if;

  -- Pemberitahuan sudah >= 30 hari dan tanggal batas sesuai pemberitahuan & aturan 12 bulan.
  select data_retention into v_ret from public.workspace_branding where workspace_id = p_workspace_id;
  if v_ret is null or (v_ret->>'notice_at') is null or (v_ret->>'notice_at')::timestamptz > now() - interval '30 days' then
    raise exception 'Pemberitahuan 30 hari belum lewat';
  end if;
  if p_through is null or p_through > (v_ret->>'through')::date or p_through > (current_date - interval '12 months')::date + 1 then
    raise exception 'Tanggal batas tidak sesuai aturan 12 bulan';
  end if;

  -- 1) Hapus data lama.
  execute 'delete from public.transactions where workspace_id = $1 and transaction_date::date < $2 and not (id::text = any($3))'
    using p_workspace_id, p_through, coalesce(p_keep_tx, '{}');
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('transactions', v_n);
  foreach v_tbl in array array['payouts', 'cash_expenses', 'cash_injections', 'reading_shifts'] loop
    v_datecol := case v_tbl when 'payouts' then 'payout_date' when 'cash_expenses' then 'expense_date'
                            when 'cash_injections' then 'injection_date' else 'opened_at' end;
    if to_regclass('public.' || v_tbl) is not null then
      execute format('delete from public.%I where workspace_id = $1 and (%I)::date < $2', v_tbl, v_datecol) using p_workspace_id, p_through;
      get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object(v_tbl, v_n);
    end if;
  end loop;

  -- 2) Simpan baris "Saldo awal" (hanya kolom yang memang ada di tabel; workspace_id dipaksa).
  foreach v_tbl in array array['transactions', 'payouts', 'cash_expenses', 'cash_injections'] loop
    for v_row in select * from jsonb_array_elements(coalesce(p_rows->v_tbl, '[]'::jsonb)) loop
      v_row := (v_row - 'id' - 'created_at' - 'updated_at') || jsonb_build_object('workspace_id', p_workspace_id);
      select array_agg(c.column_name::text) into v_keys from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = v_tbl and v_row ? c.column_name;
      execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1)',
        v_tbl, (select string_agg(quote_ident(k), ', ') from unnest(v_keys) k)) using v_row;
    end loop;
  end loop;

  -- 3) Pemberitahuan selesai.
  update public.workspace_branding
     set data_retention = jsonb_build_object('last_purge_at', now(), 'last_through', p_through, 'deleted', v_counts)
   where workspace_id = p_workspace_id;
  return v_counts;
end $$;

revoke all on function public.kairo_retention_apply(uuid, date, text[], jsonb) from public, anon;
grant execute on function public.kairo_retention_apply(uuid, date, text[], jsonb) to authenticated;

-- Cek: kolom & fungsi sudah ada (2 baris).
select 'kolom data_retention' as cek from information_schema.columns
 where table_schema = 'public' and table_name = 'workspace_branding' and column_name = 'data_retention'
union all
select 'fungsi kairo_retention_apply' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'kairo_retention_apply';
