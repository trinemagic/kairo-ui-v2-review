-- KAIRO: tema tampilan workspace untuk Seller App Premium (Okt 2026).
-- Menambah satu kolom tampilan di workspace_branding. Tidak mengubah data lain.
-- Kosong (null) = tampilan KAIRO bawaan. Aman diulang.

alter table public.workspace_branding add column if not exists theme text;

alter table public.workspace_branding drop constraint if exists workspace_branding_theme_check;
alter table public.workspace_branding add constraint workspace_branding_theme_check
  check (theme is null or theme in ('girlie', 'wood', 'cloudy', 'pinky'));

-- Cek hasil: kolom theme sudah ada.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'workspace_branding' and column_name = 'theme';
