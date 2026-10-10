-- KAIRO - perbaikan temuan advisor keamanan Supabase (Okt 2026). Aman diulang, tidak menyentuh data.
-- Dijalankan Claude via Supabase MCP (satu statement per panggilan).

-- 1) View saas_plan_features: SECURITY DEFINER -> SECURITY INVOKER.
--    View ini hanya daftar nilai tetap (VALUES), tidak membaca tabel mana pun, dan tidak dipakai kode app,
--    jadi hasilnya sama persis; hanya status "ERROR" di advisor hilang.
alter view public.saas_plan_features set (security_invoker = true);

-- 2) Fungsi kairo_email_domain_allowed: kunci search_path.
--    Fungsi hanya memeriksa teks (lower/trim/split_part/regex dari pg_catalog), tidak memakai tabel/objek schema lain.
alter function public.kairo_email_domain_allowed(text) set search_path = '';
