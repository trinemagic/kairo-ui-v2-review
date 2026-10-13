-- KAIRO — perbaikan pengecekan saldo Kas di database (owner Okt 2026). Aman diulang.
--
-- Masalah lama: trigger prevent_cash_overdraw (BEFORE INSERT/UPDATE cash_expenses, SECURITY DEFINER) menjumlah
-- transactions & cash_injections SEMUA workspace (tanpa filter workspace_id) dan memakai Kas 5% tetap.
-- Akibatnya batas pengeluaran kas di server tidak sama dengan Saldo Kas yang tampil di aplikasi.
--
-- Sekarang: dihitung per workspace dengan aturan yang sama seperti kairo-app.js (cashEntitlementFromTransactions):
--   per transaksi: HPP = Σ cost_subtotal (atau cost_price × qty) item + add-on; laba = max(0, total − HPP);
--   nominal manual per produk (profit_share_mode='manual') diskalakan bila melebihi laba; Kas = bagian manual Kas
--   + (laba − total manual) × % Kas versi pembagian yang berlaku saat transaksi dibuat (fallback: baris Kas di
--   profit_share_rules, lalu 0). Kas dimatikan (cash_enabled=false + versi cash_off) = nominal manual Kas diabaikan
--   sejak tanggal itu. Waktu versi pembagian (timestamp tanpa zona) dibaca sebagai waktu Asia/Jakarta, sama seperti
--   browser pengguna.
-- Sengaja tidak mengecek paket (Gratis = Kas 0 di aplikasi): server hanya jaring pengaman dan tidak boleh lebih ketat
-- dari aplikasi. Toleransi Rp1 untuk pembulatan.

create or replace function public.kairo_js_num(v jsonb)
returns numeric language sql immutable set search_path = '' as $$
  -- Meniru Number(x||0) di JavaScript untuk nilai jsonb: null/kosong/bukan angka = 0.
  select case
    when v is null or jsonb_typeof(v) = 'null' then 0
    when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric
    when jsonb_typeof(v) = 'string' and btrim(v #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then btrim(v #>> '{}')::numeric
    else 0 end
$$;

create or replace function public.kairo_cash_entitlement(p_workspace uuid, p_through date)
returns numeric language sql stable security definer set search_path = '' as $$
  with kas as (
    select r.id, coalesce(r.percentage, 0) as pct
    from public.profit_share_rules r
    where r.workspace_id = p_workspace and r.is_active and lower(r.partner_name) = 'kas'
    order by r.partner_name limit 1
  ),
  off_since as (
    select max(v.effective_from) as at
    from public.profit_share_versions v
    where v.workspace_id = p_workspace
      and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v.rules) = 'array' then v.rules else '[]'::jsonb end) x
                  where lower(coalesce(x->>'partner_name', '')) = 'kas' and (x->>'cash_off') = 'true')
      and exists (select 1 from public.workspace_branding b where b.workspace_id = p_workspace and b.cash_enabled = false)
  ),
  tx as (
    select t.id, coalesce(t.total_price, 0) as total,
           (t.created_at at time zone 'Asia/Jakarta') as ts,
           (case when jsonb_typeof(t.order_items) = 'array' then t.order_items else '[]'::jsonb end)
           || (case when jsonb_typeof(t.order_addons) = 'array' then t.order_addons else '[]'::jsonb end) as items
    from public.transactions t
    where t.workspace_id = p_workspace and t.transaction_date <= p_through
  ),
  item as (
    select tx.id, x, greatest(0, public.kairo_js_num(x->'qty')) as qty
    from tx cross join lateral jsonb_array_elements(tx.items) x
  ),
  hpp as (
    select id, sum(case when x ? 'cost_subtotal' and (jsonb_typeof(x->'cost_subtotal') in ('number', 'null')
                         or (jsonb_typeof(x->'cost_subtotal') = 'string' and btrim(x->>'cost_subtotal') ~ '^-?[0-9]*(\.[0-9]+)?$'))
                        then greatest(0, public.kairo_js_num(x->'cost_subtotal'))
                        else greatest(0, public.kairo_js_num(x->'cost_price')) * qty end) as hpp
    from item group by id
  ),
  manual as (
    select i.id,
           sum(greatest(0, public.kairo_js_num(r->'amount')) * i.qty) as raw_total,
           sum(case when (lower(coalesce(r->>'partner_name', '')) = 'kas'
                          or (r->>'partner_id') = (select id::text from kas))
                    then greatest(0, public.kairo_js_num(r->'amount')) * i.qty else 0 end) as raw_kas
    from item i
    join tx on tx.id = i.id
    cross join lateral jsonb_array_elements(case when jsonb_typeof(i.x->'manual_profit_split') = 'array' then i.x->'manual_profit_split' else '[]'::jsonb end) r
    where coalesce(nullif(i.x->>'profit_share_mode', ''), 'percentage') = 'manual'
      and greatest(0, public.kairo_js_num(r->'amount')) * i.qty > 0
      and not ((select at from off_since) is not null and tx.ts >= (select at from off_since)
               and lower(coalesce(r->>'partner_name', '')) = 'kas')
    group by i.id
  ),
  calc as (
    select tx.id,
           greatest(0, tx.total - coalesce(h.hpp, 0)) as dist,
           coalesce(m.raw_total, 0) as raw_total,
           coalesce(m.raw_kas, 0) as raw_kas,
           coalesce((
             select coalesce(public.kairo_js_num(k->'percentage'), 0)
             from (select v.rules from public.profit_share_versions v
                   where v.workspace_id = p_workspace and v.effective_from <= tx.ts
                   order by v.effective_from desc limit 1) av
             cross join lateral (select k from jsonb_array_elements(case when jsonb_typeof(av.rules) = 'array' then av.rules else '[]'::jsonb end)
                                   with ordinality e(k, n)
                                 where lower(coalesce(k->>'partner_name', '')) = 'kas' order by n limit 1) kk
           ), (select pct from kas), 0) as rate
    from tx left join hpp h on h.id = tx.id left join manual m on m.id = tx.id
  )
  select coalesce(sum(
           (case when raw_total > dist and raw_total > 0 then dist / raw_total else 1 end) * raw_kas
           + greatest(0, dist - (case when raw_total > dist and raw_total > 0 then dist else raw_total end)) * rate
         ), 0)
  from calc
$$;

-- Hanya untuk dipakai trigger (SECURITY DEFINER); jangan bisa dipanggil lewat API untuk workspace orang lain.
revoke all on function public.kairo_cash_entitlement(uuid, date) from public, anon, authenticated;

create or replace function public.prevent_cash_overdraw()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  earned numeric := 0;
  injected numeric := 0;
  spent numeric := 0;
  available numeric := 0;
begin
  perform pg_advisory_xact_lock(hashtext('kairo_cash_expense_guard:' || new.workspace_id::text));

  earned := public.kairo_cash_entitlement(new.workspace_id, new.expense_date);

  select coalesce(sum(i.amount), 0) into injected
  from public.cash_injections i
  where i.workspace_id = new.workspace_id and i.injection_date <= new.expense_date;

  select coalesce(sum(c.amount), 0) into spent
  from public.cash_expenses c
  where c.workspace_id = new.workspace_id and c.expense_date <= new.expense_date
    and c.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  available := earned + injected - spent;

  if new.amount > greatest(available, 0) + 1 then
    raise exception 'Pengeluaran kas melebihi saldo kas tersedia. Saldo tersedia: Rp%, pengeluaran: Rp%',
      round(greatest(available, 0)), new.amount
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Cek (hanya baca): saldo Kas per workspace sampai hari ini.
-- select w.name, round(public.kairo_cash_entitlement(w.id, current_date)) from public.workspaces w;
