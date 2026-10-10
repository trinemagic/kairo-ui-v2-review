-- KAIRO Kasir / POS: riwayat penyesuaian stok (Hitung Stok / stock opname + ubah stok manual), Okt 2026.
-- Hanya menambah: tabel stock_adjustments (RLS per anggota workspace; hanya baca + tambah, tidak bisa diubah/dihapus dari browser).
-- Aman diulang. Jalankan satu statement per panggilan bila lewat Supabase MCP (batas waktu 60 dtk).

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  product_id uuid,
  product_name text,
  unit text,
  before_qty integer,
  after_qty integer,
  diff integer,
  note text,
  source text not null default 'opname',   -- opname | manual
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists stock_adjustments_ws_idx on public.stock_adjustments (workspace_id, created_at desc);
alter table public.stock_adjustments enable row level security;
drop policy if exists "stock_adjustments_member_select" on public.stock_adjustments;
drop policy if exists "stock_adjustments_member_insert" on public.stock_adjustments;
create policy "stock_adjustments_member_select" on public.stock_adjustments for select to authenticated
  using (exists (select 1 from public.workspace_members wm where wm.workspace_id = stock_adjustments.workspace_id and wm.user_id = auth.uid()));
create policy "stock_adjustments_member_insert" on public.stock_adjustments for insert to authenticated
  with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = stock_adjustments.workspace_id and wm.user_id = auth.uid()));
revoke all on public.stock_adjustments from anon;
revoke update, delete, truncate, references, trigger on public.stock_adjustments from authenticated;
grant select, insert on public.stock_adjustments to authenticated;
