-- KAIRO - sinkron transaksi bertahap (owner Okt 2026). Aman diulang, hanya MENAMBAH (kolom, fungsi trigger, trigger, index).
-- Tujuan: aplikasi tidak perlu mengunduh ulang SEMUA transaksi tiap data disegarkan; cukup baris yang berubah sejak sinkron terakhir.
-- Dijalankan Claude via Supabase MCP (satu statement per panggilan).

-- 1) Kolom waktu perubahan. Baris lama otomatis berisi waktu migrasi ini (cukup: aplikasi memuat penuh sekali, lalu hanya mengambil yang lebih baru).
alter table public.transactions add column if not exists updated_at timestamptz not null default now();

-- 2) Fungsi trigger: isi updated_at dengan waktu sebenarnya (clock_timestamp) tiap insert/update, jadi selalu naik walau satu transaksi DB lama.
--    Pengecualian untuk pengisian awal (langkah 5): set_config('kairo.skip_touch','1',true) di transaksi yang sama mempertahankan nilai yang diberikan.
create or replace function public.kairo_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('kairo.skip_touch', true), '') = '1' then
    return new;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- 3) Pasang trigger (BEFORE, jadi tidak mengganggu trigger stok yang AFTER INSERT/DELETE).
drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at
  before insert or update on public.transactions
  for each row execute function public.kairo_touch_updated_at();

-- 4) Index untuk permintaan "baris berubah sejak ...".
create index if not exists transactions_ws_updated_idx on public.transactions (workspace_id, updated_at);

-- 5) Pengisian awal: baris lama diberi updated_at = created_at (bukan waktu migrasi), supaya "baris berubah sejak ..." tidak menarik seluruh tabel.
--    Dijalankan Claude per 120 baris (satu UPDATE untuk seluruh tabel sempat time out 60 dtk di MCP); ulangi sampai tidak ada baris tersisa.
--    do $$ begin
--      perform set_config('kairo.skip_touch', '1', true);
--      update public.transactions set updated_at = coalesce(created_at, now() - interval '1 day')
--        where id in (select id from public.transactions where updated_at = '<waktu migrasi>' limit 120);
--    end $$;
