-- KAIRO - Admin panel wajib kode 2 langkah (MFA TOTP) + akun admin dipisah dari akun workspace (owner Okt 2026).
-- JANGAN dijalankan sebelum akun admin baru berhasil masuk lewat admin/ dan memasang kode 2 langkah (urutan di bawah),
-- kalau tidak, semua fungsi admin menolak (is_platform_admin() = false) dan tidak ada yang bisa membuka panel.
-- Aman diulang. Dijalankan Claude via Supabase MCP (satu statement per panggilan).

-- LANGKAH 1 (sebelum enforce): daftarkan akun admin baru. Ganti email dengan akun yang dibuat lewat form Daftar biasa.
-- insert into public.platform_admins (user_id)
-- select u.id from auth.users u
-- where lower(u.email) = lower('GANTI_DENGAN_EMAIL_ADMIN_BARU')
--   and not exists (select 1 from public.platform_admins pa where pa.user_id = u.id);

-- LANGKAH 2 (setelah admin baru berhasil masuk + pasang kode 2 langkah): enforce aal2.
-- Claim `aal` ada di JWT Supabase: aal1 = baru password, aal2 = password + kode 2 langkah sudah diverifikasi.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.platform_admins pa
      where pa.user_id = auth.uid() and pa.status = 'active'
    );
$$;

-- LANGKAH 3 (setelah langkah 2 teruji): cabut hak admin dari akun workspace Trine Magic (bukan hapus akun/data; status diubah, bisa dikembalikan).
-- update public.platform_admins set status = 'inactive'
-- where user_id = 'f505bd9a-3696-4401-b9f4-838f4f71c5aa';

-- Kembalikan (darurat, lewat Supabase SQL Editor): jalankan LANGKAH 2 dengan baris pertama kondisi aal2 dihapus,
-- dan  update public.platform_admins set status = 'active' where user_id = '<id>';
