-- KAIRO Online Shop: catatan Batal & Retur (Okt 2026).
-- Dipakai kartu "Batal & Retur" di Performance. Dicatat saat order dihapus lewat Aksi > Hapus/Cancel
-- (user memilih Batal atau Retur + alasan). Order tetap dihapus dari omzet seperti sebelumnya;
-- tabel ini hanya menyimpan catatannya. Tanpa tabel ini kartu tersembunyi dan hapus order tetap jalan.
-- Aman diulang (if not exists / drop policy if exists). Tidak mengubah data lain.

create table if not exists public.order_returns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  transaction_id text,
  transaction_date date,
  kind text not null default 'batal' check (kind in ('batal','retur')),
  reason text,
  platform text,
  customer_name text,
  total_price numeric not null default 0,
  hpp numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_returns_ws_date_idx on public.order_returns (workspace_id, transaction_date);

alter table public.order_returns enable row level security;

drop policy if exists "order_returns_member_select" on public.order_returns;
drop policy if exists "order_returns_member_insert" on public.order_returns;
drop policy if exists "order_returns_member_delete" on public.order_returns;

create policy "order_returns_member_select" on public.order_returns for select to authenticated
  using (exists (select 1 from public.workspace_members wm where wm.workspace_id = order_returns.workspace_id and wm.user_id = auth.uid()));
create policy "order_returns_member_insert" on public.order_returns for insert to authenticated
  with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = order_returns.workspace_id and wm.user_id = auth.uid()));
create policy "order_returns_member_delete" on public.order_returns for delete to authenticated
  using (exists (select 1 from public.workspace_members wm where wm.workspace_id = order_returns.workspace_id and wm.user_id = auth.uid()));

revoke all on public.order_returns from anon;
grant select, insert, delete on public.order_returns to authenticated;

-- Cek: harus 1 baris "ok".
select 'tabel order_returns + RLS' as cek,
       case when exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                         where n.nspname = 'public' and c.relname = 'order_returns' and c.relrowsecurity)
            then 'ok' else 'PERIKSA' end as hasil;
