-- KAIRO Online Shop: Stok produk (Okt 2026).
-- Menambah kolom stok di master produk (package_masters) + trigger otomatis:
--   * order disimpan  -> stok produk di order itu berkurang sebanyak qty
--   * order dihapus   -> stok kembali (Batal). Retur (tercatat di order_returns) TIDAK dikembalikan otomatis.
--   * order lebih tua dari 90 hari tidak mengembalikan stok (supaya penghapusan data lama tidak mengacaukan stok)
-- stock_qty kosong (NULL) = produk tidak dilacak, tidak ada yang berubah. Add-on tidak dilacak.
-- Trigger dibuat tahan-gagal: kalau ada error di perhitungan stok, penjualan tetap tersimpan.
-- Aman diulang (if not exists / create or replace / drop trigger if exists). Tidak mengubah data transaksi.
-- Disarankan menjalankan 2026-10-online-shop-returns.sql dulu (untuk aturan Retur), tapi tidak wajib.

alter table public.package_masters add column if not exists stock_qty integer;
alter table public.package_masters add column if not exists stock_min integer;

create or replace function public.kairo_stock_apply(p_ws uuid, p_items jsonb, p_sign integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  it jsonb;
  v_qty integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    begin
      v_qty := greatest(coalesce((it->>'qty')::integer, 0), 0);
      if v_qty > 0 and (it->>'id') is not null then
        update public.package_masters
           set stock_qty = stock_qty + p_sign * v_qty
         where workspace_id = p_ws and id::text = (it->>'id') and stock_qty is not null;
      end if;
    exception when others then
      null;
    end;
  end loop;
end $$;

create or replace function public.kairo_stock_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.kairo_stock_apply(new.workspace_id, new.order_items, -1);
  exception when others then
    null;
  end;
  return new;
end $$;

create or replace function public.kairo_stock_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retur boolean := false;
begin
  begin
    if old.created_at is not null and old.created_at < now() - interval '90 days' then
      return old;
    end if;
    if to_regclass('public.order_returns') is not null then
      execute 'select exists (select 1 from public.order_returns r where r.workspace_id = $1 and r.transaction_id = $2 and r.kind = ''retur'')'
        into v_retur using old.workspace_id, old.id::text;
    end if;
    if not coalesce(v_retur, false) then
      perform public.kairo_stock_apply(old.workspace_id, old.order_items, 1);
    end if;
  exception when others then
    null;
  end;
  return old;
end $$;

revoke all on function public.kairo_stock_apply(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.kairo_stock_after_insert() from public, anon, authenticated;
revoke all on function public.kairo_stock_after_delete() from public, anon, authenticated;

drop trigger if exists kairo_stock_ins on public.transactions;
create trigger kairo_stock_ins after insert on public.transactions
  for each row execute function public.kairo_stock_after_insert();

drop trigger if exists kairo_stock_del on public.transactions;
create trigger kairo_stock_del after delete on public.transactions
  for each row execute function public.kairo_stock_after_delete();

-- Cek: harus 3 baris "ok".
select 'kolom stok produk' as cek,
       case when (select count(*) from information_schema.columns
                  where table_schema = 'public' and table_name = 'package_masters'
                    and column_name in ('stock_qty', 'stock_min')) = 2 then 'ok' else 'PERIKSA' end as hasil
union all
select 'trigger stok saat order disimpan',
       case when exists (select 1 from pg_trigger where tgname = 'kairo_stock_ins' and not tgisinternal) then 'ok' else 'PERIKSA' end
union all
select 'trigger stok saat order dihapus',
       case when exists (select 1 from pg_trigger where tgname = 'kairo_stock_del' and not tgisinternal) then 'ok' else 'PERIKSA' end;
