-- KAIRO Kasir / POS: Sesi Kasir lengkap (Okt 2026). Menambah kolom kas ke tabel sesi lama reading_shifts (Open/Close Store).
-- Semua kolom boleh kosong; sesi lama dan template lain tidak berubah. Aman diulang (if not exists).
alter table public.reading_shifts add column if not exists opening_cash numeric;     -- modal awal laci
alter table public.reading_shifts add column if not exists cash_out numeric;         -- uang keluar dari laci selama sesi
alter table public.reading_shifts add column if not exists counted_cash numeric;     -- uang fisik yang dihitung saat tutup
alter table public.reading_shifts add column if not exists expected_cash numeric;    -- modal awal + tunai masuk - uang keluar
alter table public.reading_shifts add column if not exists cash_difference numeric;  -- counted - expected (minus = kurang)
alter table public.reading_shifts add column if not exists close_note text;
