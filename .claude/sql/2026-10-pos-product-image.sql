-- Foto produk Kasir/POS (aman diulang, hanya menambah kolom nullable).
-- File fotonya disimpan di Storage bucket workspace-branding/<workspace_id>/products/<id>.webp
set lock_timeout='8s';
alter table public.package_masters add column if not exists image_url text;

-- Satuan produk Kasir/POS (pcs, porsi, potong, ...), hanya tampilan.
alter table public.package_masters add column if not exists unit text;
