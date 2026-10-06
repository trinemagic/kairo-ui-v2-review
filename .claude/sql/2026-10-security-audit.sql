-- KAIRO: audit keamanan database (Okt 2026). HANYA MEMBACA - tidak mengubah apa pun, aman dijalankan kapan saja.
-- Jalankan di Supabase > SQL Editor, lalu kirim screenshot hasilnya. Setiap baris = satu temuan; kosong = tidak ada temuan.
-- Kolom "risiko": TINGGI = harus ditutup, CEK = perlu dilihat apakah memang disengaja.

with
-- 1) Tabel di schema public yang RLS-nya mati: siapa pun yang punya izin tabel bisa baca/tulis SEMUA baris (semua workspace).
no_rls as (
  select 'TINGGI'::text as risiko, 'RLS mati'::text as cek, c.relname::text as objek,
         'Row Level Security belum aktif: data workspace lain bisa terbaca/ubah'::text as detail
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
),
-- 2) Policy yang berlaku untuk anon/public (orang yang belum login).
anon_policies as (
  select case when p.cmd in ('INSERT','UPDATE','DELETE','ALL') then 'TINGGI' else 'CEK' end,
         'Policy untuk pengunjung tanpa login', p.tablename::text,
         p.policyname || ' (' || p.cmd || ') roles=' || array_to_string(p.roles, ',')
  from pg_policies p
  where p.schemaname = 'public' and (p.roles && array['anon','public']::name[])
),
-- 3) Policy "true" (berlaku untuk semua baris) untuk user login: bisa membuka data workspace lain.
open_policies as (
  select 'CEK', 'Policy terbuka (semua baris)', p.tablename::text,
         p.policyname || ' (' || p.cmd || ') using=' || coalesce(p.qual, '-') || ' check=' || coalesce(p.with_check, '-')
  from pg_policies p
  where p.schemaname = 'public'
    and (coalesce(p.qual, '') in ('true', '(true)') or coalesce(p.with_check, '') in ('true', '(true)'))
),
-- 4) Tabel paket/penjualan yang bisa DITULIS langsung dari browser (harus hanya lewat fungsi admin).
plan_writes as (
  select 'TINGGI', 'Paket bisa diubah dari browser', g.table_name::text,
         g.grantee || ' punya izin ' || string_agg(g.privilege_type, ',')
  from information_schema.role_table_grants g
  where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
    and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    and (g.table_name in ('workspace_subscriptions', 'saas_plan_entitlements', 'platform_admins')
         or g.table_name like 'platform\_%')
  group by g.grantee, g.table_name
),
-- 5) Fungsi SECURITY DEFINER (melewati RLS) yang bisa dipanggil pengunjung tanpa login.
anon_definer as (
  select case when p.proname in ('is_username_available') then 'CEK' else 'TINGGI' end,
         'Fungsi tanpa login (melewati RLS)', p.proname::text,
         pg_get_function_identity_arguments(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
),
-- 6) Fungsi SECURITY DEFINER tanpa search_path tetap (bisa dibajak lewat objek palsu).
no_search_path as (
  select 'CEK', 'Fungsi tanpa search_path', p.proname::text, pg_get_function_identity_arguments(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
),
-- 7) Bucket Storage publik (file bisa dibuka siapa pun yang tahu alamatnya).
public_buckets as (
  select 'CEK', 'Bucket Storage publik', b.id::text,
         'maks ' || coalesce((b.file_size_limit / 1024)::text || ' KB', 'tanpa batas') || ', tipe ' || coalesce(array_to_string(b.allowed_mime_types, ','), 'semua')
  from storage.buckets b where b.public
)
select * from no_rls
union all select * from anon_policies
union all select * from open_policies
union all select * from plan_writes
union all select * from anon_definer
union all select * from no_search_path
union all select * from public_buckets
order by 1 desc, 2, 3;
