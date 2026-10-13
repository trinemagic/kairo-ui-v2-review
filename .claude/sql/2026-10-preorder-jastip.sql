-- KAIRO — template custom "Pre-Order & Jastip" (business_template = 'preorder_jastip'), owner Okt 2026. Aman diulang.
-- Template TIDAK dibuka untuk umum: akun dibuat admin (admin › Buat Akun), harga & masa aktif sesuai kesepakatan.
-- Hanya menambah: nilai template baru, 3 kolom nullable di transactions, 3 kolom nullable di customers, 2 tabel baru.
-- Template lain mengabaikan semua kolom/tabel ini. Jalankan satu statement per panggilan bila lewat Supabase MCP
-- (multi-statement DDL di sini sempat timeout/cancelled; tabel jadi dulu TANPA RLS -> langsung aktifkan RLS).
-- Tanpa foreign key ke workspaces (sama seperti stock_adjustments): admin › Hapus workspace menghapus semua tabel ber-workspace_id.
-- SUDAH DIJALANKAN Claude via MCP 13 Okt 2026.

-- 1) Nilai template baru di daftar yang diizinkan.
alter table public.workspace_business_profiles drop constraint if exists workspace_business_profiles_business_template_check;
alter table public.workspace_business_profiles add constraint workspace_business_profiles_business_template_check
  check (business_template = any (array['general','digital_subscription','digital_product','service_consultation','online_shop','pos_kasir','preorder_jastip']));

-- 2) Pembuat workspace: kenali 'preorder_jastip' (dulu jatuh ke 'general') + kategori barang awal. Isi fungsi lain tidak diubah
--    (diganti lewat replace teks pada definisi yang sedang aktif).
do $$
declare d text := pg_get_functiondef('public.provision_kairo_workspace_for_user'::regproc);
begin
  if position('preorder_jastip' in d) = 0 then
    d := replace(d, $q$'online_shop','pos_kasir') then$q$, $q$'online_shop','pos_kasir','preorder_jastip') then$q$);
    d := replace(d, $q$  return v_workspace_id;
end;$q$, $q$  if to_regclass('public.topic_masters') is not null and v_template='preorder_jastip' then
    insert into public.topic_masters(workspace_id,name,is_active) values
      (v_workspace_id,'Fashion',true),(v_workspace_id,'Tas & Aksesoris',true),(v_workspace_id,'Skincare & Kosmetik',true),
      (v_workspace_id,'Elektronik',true),(v_workspace_id,'Makanan & Snack',true),(v_workspace_id,'Lainnya',true)
    on conflict do nothing;
  end if;

  return v_workspace_id;
end;$q$);
    execute d;
  end if;
end $$;

-- 3) Order pre-order: status barang, perkiraan tiba, skema bayar (null untuk template lain).
alter table public.transactions add column if not exists po_status text;
alter table public.transactions add column if not exists po_eta date;
alter table public.transactions add column if not exists po_scheme text;

-- 4) Customer: kategori minat (id topic_masters), catatan.
alter table public.customers add column if not exists interest_topic_ids jsonb;
alter table public.customers add column if not exists notes text;

-- 5) Buku uang (satu sumber untuk pembayaran customer, talangan partner, pengembalian talangan, biaya order,
--    pemasukan/pengeluaran lain, refund). Hanya bisa dibaca + ditambah dari browser; koreksi = entri 'reversal'.
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  entry_date date not null,
  kind text not null check (kind in ('customer_payment','refund','partner_advance','advance_repayment','order_cost','other_income','operating_expense','reversal')),
  amount numeric not null check (amount > 0),
  currency text not null default 'IDR',
  amount_foreign numeric,
  fx_rate numeric,
  category text,
  partner_id uuid,
  partner_name text,
  transaction_id uuid,
  customer_id uuid,
  method text,
  note text,
  recorded_by text,
  reverses_id uuid unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint ledger_entries_reversal_ref check ((kind = 'reversal') = (reverses_id is not null)),
  constraint ledger_entries_partner_ref check (kind not in ('partner_advance','advance_repayment') or partner_name is not null)
);
create index if not exists ledger_entries_ws_date_idx on public.ledger_entries (workspace_id, entry_date desc);
create index if not exists ledger_entries_tx_idx on public.ledger_entries (transaction_id) where transaction_id is not null;
alter table public.ledger_entries enable row level security;
drop policy if exists "ledger_entries_member_select" on public.ledger_entries;
drop policy if exists "ledger_entries_member_insert" on public.ledger_entries;
create policy "ledger_entries_member_select" on public.ledger_entries for select to authenticated
  using (exists (select 1 from public.workspace_members wm where wm.workspace_id = ledger_entries.workspace_id and wm.user_id = (select auth.uid())));
create policy "ledger_entries_member_insert" on public.ledger_entries for insert to authenticated
  with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = ledger_entries.workspace_id and wm.user_id = (select auth.uid())));
revoke all on public.ledger_entries from anon;
revoke update, delete, truncate, references, trigger on public.ledger_entries from authenticated;
grant select, insert on public.ledger_entries to authenticated;

-- 6) Jadwal cicilan per order, berversi (ubah jadwal = versi baru; versi terbesar yang berlaku). Status cicilan TIDAK disimpan:
--    dihitung dari pembayaran di ledger_entries.
create table if not exists public.installment_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  transaction_id uuid not null,
  version integer not null default 1,
  frequency text not null check (frequency in ('weekly','monthly','once')),
  items jsonb not null,
  reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (transaction_id, version)
);
create index if not exists installment_schedules_ws_idx on public.installment_schedules (workspace_id, transaction_id);
alter table public.installment_schedules enable row level security;
drop policy if exists "installment_schedules_member_select" on public.installment_schedules;
drop policy if exists "installment_schedules_member_insert" on public.installment_schedules;
create policy "installment_schedules_member_select" on public.installment_schedules for select to authenticated
  using (exists (select 1 from public.workspace_members wm where wm.workspace_id = installment_schedules.workspace_id and wm.user_id = (select auth.uid())));
create policy "installment_schedules_member_insert" on public.installment_schedules for insert to authenticated
  with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = installment_schedules.workspace_id and wm.user_id = (select auth.uid())));
revoke all on public.installment_schedules from anon;
revoke update, delete, truncate, references, trigger on public.installment_schedules from authenticated;
grant select, insert on public.installment_schedules to authenticated;
