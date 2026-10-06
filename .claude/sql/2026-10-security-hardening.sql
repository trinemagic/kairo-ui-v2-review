-- KAIRO: pengamanan lanjutan dari hasil audit database (Okt 2026). Aman diulang. Tidak menghapus data.
--
-- Hasil audit (2026-10-security-audit.sql) menunjukkan "pintu" yang terbuka lebih lebar dari perlu. Saat ini masih tertahan
-- RLS dan pengecekan admin di dalam fungsi, tapi ditutup supaya tidak bergantung pada satu lapis saja:
--   1) Fungsi admin (platform_admin_*) dan update_my_username tidak bisa dipanggil pengunjung tanpa login.
--      Akun yang login tetap bisa memanggil; fungsi admin tetap menolak siapa pun yang bukan platform admin.
--   2) Tabel internal admin (platform_*, termasuk daftar admin) tidak bisa ditulis langsung dari browser.
--      Panel admin hanya menulis lewat fungsi platform_admin_*, jadi tidak terpengaruh.
--   3) Policy Settings › Produk seller hanya berlaku untuk akun yang login (sebelumnya "public" = termasuk pengunjung).
-- Di akhir ada daftar fungsi admin yang TIDAK memeriksa is_platform_admin di dalamnya - kirim hasilnya bila ada barisnya.

-- 1) Fungsi admin & ganti username: wajib login.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'platform\_admin\_%' or p.proname = 'update_my_username')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- 2) Tabel internal admin: tidak bisa ditulis langsung dari browser (tetap bisa lewat fungsi admin).
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and (c.relname like 'platform\_%' or c.relname = 'platform_admins')
  loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t.relname);
  end loop;
end $$;

-- 3) Policy seller_product_settings hanya untuk akun login.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'seller_product_settings' and 'public' = any(roles) loop
    execute format('alter policy %I on public.seller_product_settings to authenticated', pol.policyname);
  end loop;
end $$;

-- Cek. Baris "ok" = sudah aman. Baris "PERIKSA" = kirim screenshot ke Claude.
select 'fungsi admin tertutup untuk pengunjung' as cek,
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname like 'platform\_admin\_%'
                           and has_function_privilege('anon', p.oid, 'execute')) then 'GAGAL' else 'ok' end as hasil
union all
select 'tabel admin tidak bisa ditulis dari browser',
       case when exists (select 1 from information_schema.role_table_grants g
                         where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
                           and g.table_name like 'platform\_%' and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
            then 'GAGAL' else 'ok' end
union all
select 'policy produk seller hanya untuk akun login',
       case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seller_product_settings'
                         and 'public' = any(roles)) then 'GAGAL' else 'ok' end
union all
select 'PERIKSA: fungsi admin tanpa cek is_platform_admin', p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'platform\_admin\_%'
  and p.prosrc not ilike '%is_platform_admin%'
order by 1;
