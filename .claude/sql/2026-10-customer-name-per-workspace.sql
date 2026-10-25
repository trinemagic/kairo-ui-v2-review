-- Nama customer unik PER WORKSPACE (owner 25 Okt 2026)
--
-- Masalah: indeks unik lama `customers_normalized_name_unique` hanya di kolom
-- normalized_name (= lower(btrim(display_name))) untuk SEMUA workspace. Akibatnya
-- customer "dea" di workspace A membuat workspace B tidak bisa menyimpan customer
-- "dea" ("duplicate key value violates unique constraint ...").
-- Perbaikan: unik per (workspace_id, normalized_name). Tidak ada data yang diubah.
-- Aman diulang.

set lock_timeout = '8s';

create unique index if not exists customers_workspace_normalized_name_uidx
  on public.customers (workspace_id, normalized_name);

drop index if exists public.customers_normalized_name_unique;

-- Cek:
-- select indexname, indexdef from pg_indexes where tablename = 'customers';

-- Sesi Open Store / Kasir: aturan "hanya satu sesi terbuka" dulu juga GLOBAL
-- (reading_shifts_only_one_open pada (true)), jadi sesi terbuka di satu workspace
-- menghalangi workspace lain membuka sesi. Diganti satu sesi terbuka PER workspace.
create unique index if not exists reading_shifts_one_open_per_workspace
  on public.reading_shifts (workspace_id) where (closed_at is null);

drop index if exists public.reading_shifts_only_one_open;
