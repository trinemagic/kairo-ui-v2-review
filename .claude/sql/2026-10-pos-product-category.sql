-- KAIRO Kasir / POS: kategori produk (Okt 2026). Kolom teks boleh kosong; dipakai tab kategori di layar Kasir.
alter table public.package_masters add column if not exists category text;
