-- KAIRO Kasir / POS: Open Bill (pesanan ditahan, bisa ditambah lalu dibayar nanti) + nomor struk (Okt 2026).
-- Hanya menambah: tabel pos_open_bills (RLS per anggota workspace) dan kolom transactions.receipt_no (boleh kosong).
-- Template lain tidak memakainya. Aman diulang (if not exists / drop policy if exists).

create table if not exists public.pos_open_bills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  label text,
  order_type text,
  table_no text,
  customer_name text,
  items jsonb not null default '[]'::jsonb,
  addons jsonb not null default '[]'::jsonb,
  note text,
  discount_mode text,
  discount_value numeric not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pos_open_bills_ws_idx on public.pos_open_bills (workspace_id, created_at);

alter table public.pos_open_bills enable row level security;

drop policy if exists "pos_open_bills_member_select" on public.pos_open_bills;
drop policy if exists "pos_open_bills_member_insert" on public.pos_open_bills;
drop policy if exists "pos_open_bills_member_update" on public.pos_open_bills;
drop policy if exists "pos_open_bills_member_delete" on public.pos_open_bills;

create policy "pos_open_bills_member_select" on public.pos_open_bills for select to authenticated
  using (exists (select 1 from public.workspace_members wm where wm.workspace_id = pos_open_bills.workspace_id and wm.user_id = auth.uid()));
create policy "pos_open_bills_member_insert" on public.pos_open_bills for insert to authenticated
  with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = pos_open_bills.workspace_id and wm.user_id = auth.uid()));
create policy "pos_open_bills_member_update" on public.pos_open_bills for update to authenticated
  using (exists (select 1 from public.workspace_members wm where wm.workspace_id = pos_open_bills.workspace_id and wm.user_id = auth.uid()))
  with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = pos_open_bills.workspace_id and wm.user_id = auth.uid()));
create policy "pos_open_bills_member_delete" on public.pos_open_bills for delete to authenticated
  using (exists (select 1 from public.workspace_members wm where wm.workspace_id = pos_open_bills.workspace_id and wm.user_id = auth.uid()));

revoke all on public.pos_open_bills from anon;
grant select, insert, update, delete on public.pos_open_bills to authenticated;

-- Nomor struk berurutan per workspace (diisi aplikasi Kasir; kosong untuk template lain).
alter table public.transactions add column if not exists receipt_no integer;
create index if not exists transactions_ws_receipt_idx on public.transactions (workspace_id, receipt_no);

select 'pos_open_bills + RLS' as cek,
       case when exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                         where n.nspname = 'public' and c.relname = 'pos_open_bills' and c.relrowsecurity)
            then 'ok' else 'PERIKSA' end as hasil
union all
select 'transactions.receipt_no',
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='transactions' and column_name='receipt_no') then 'ok' else 'PERIKSA' end;
