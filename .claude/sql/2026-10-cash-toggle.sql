-- KAIRO: saklar "Pakai Kas" per workspace (Okt 2026).
-- Menambah kolom cash_enabled di workspace_branding. Default true = semua workspace tetap seperti sekarang.
-- Aman diulang. Tidak mengubah data lain.
alter table public.workspace_branding add column if not exists cash_enabled boolean not null default true;
