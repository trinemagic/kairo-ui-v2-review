-- KAIRO: login dengan username tanpa membocorkan email (Okt 2026). Aman diulang.
--
-- Masalah: login pakai username memanggil get_login_email(username) SEBELUM login, dan fungsi itu bisa dipanggil
-- siapa pun. Orang iseng bisa menebak username (nama toko) dan mendapatkan email pemilik akun.
-- Perbaikan:
--   1) Fungsi baru kairo_login_email(username, password): email HANYA dikembalikan bila password benar.
--      Username salah dan password salah memberi jawaban yang sama (null), jadi tidak bisa dipakai menebak.
--   2) Pembatasan percobaan: maks 8 percobaan gagal per username dan 40 percobaan per alamat IP dalam 15 menit.
--   3) get_login_email tidak bisa lagi dipanggil dari browser (dipakai di dalam fungsi baru saja).
--   4) Tabel paket (workspace_subscriptions, saas_plan_entitlements) tidak bisa ditulis dari browser - paket Pro
--      hanya bisa diubah lewat fungsi admin (platform_admin_*). Dashboard memang hanya membaca tabel ini.
-- Kode dashboard sudah mendukung fungsi baru sejak kairo-app.js v20.10.196 (sebelum SQL ini dijalankan, dashboard
-- otomatis tetap memakai cara lama, jadi urutan aman: kode dulu, lalu SQL).

create table if not exists public.kairo_login_attempts (
  key text not null,
  failed boolean not null default true,
  at timestamptz not null default now()
);
create index if not exists kairo_login_attempts_key_at on public.kairo_login_attempts (key, at);
alter table public.kairo_login_attempts enable row level security;   -- tanpa policy: tidak bisa dibaca dari browser
revoke all on public.kairo_login_attempts from anon, authenticated;

create or replace function public.kairo_login_email(p_username text, p_password text)
returns text
language plpgsql security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_user text := lower(trim(coalesce(p_username, '')));
  v_hdr json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_ip text := trim(split_part(coalesce(v_hdr ->> 'cf-connecting-ip', v_hdr ->> 'x-forwarded-for', v_hdr ->> 'x-real-ip', 'unknown'), ',', 1));
  v_raw jsonb;
  v_email text;
  v_hash text;
begin
  if v_user = '' or coalesce(p_password, '') = '' then return null; end if;

  delete from public.kairo_login_attempts where at < now() - interval '1 day';
  if (select count(*) from public.kairo_login_attempts where key = 'u:' || v_user and failed and at > now() - interval '15 minutes') >= 8
     or (select count(*) from public.kairo_login_attempts where key = 'ip:' || v_ip and at > now() - interval '15 minutes') >= 40 then
    raise exception 'Terlalu banyak percobaan masuk. Coba lagi 15 menit lagi.' using errcode = 'P0429';
  end if;
  insert into public.kairo_login_attempts (key, failed) values ('ip:' || v_ip, false);

  -- Pakai pemetaan username -> email yang sudah ada (bentuk hasilnya bisa teks atau objek {email}).
  v_raw := to_jsonb(public.get_login_email(v_user));
  v_email := case jsonb_typeof(v_raw) when 'string' then v_raw #>> '{}' when 'object' then v_raw ->> 'email' end;
  if v_email is not null then
    select u.encrypted_password into v_hash from auth.users u where lower(u.email) = lower(v_email) limit 1;
  end if;

  if v_hash is null or v_hash = '' or extensions.crypt(p_password, v_hash) <> v_hash then
    insert into public.kairo_login_attempts (key) values ('u:' || v_user);
    return null;
  end if;
  return v_email;
end $$;

revoke all on function public.kairo_login_email(text, text) from public;
grant execute on function public.kairo_login_email(text, text) to anon, authenticated;

-- Fungsi lama tidak bisa dipanggil langsung lagi (fungsi baru di atas tetap memakainya dari dalam).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'get_login_email' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Paket hanya bisa diubah lewat fungsi admin.
do $$
declare t text;
begin
  foreach t in array array['workspace_subscriptions', 'saas_plan_entitlements'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Cek: hasil harus 3 baris "ok".
select 'fungsi kairo_login_email' as cek, case when to_regprocedure('public.kairo_login_email(text,text)') is not null then 'ok' else 'GAGAL' end as hasil
union all
select 'get_login_email tertutup untuk pengunjung',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'get_login_email' and has_function_privilege('anon', p.oid, 'execute'))
            then 'GAGAL' else 'ok' end
union all
select 'paket tidak bisa ditulis dari browser',
       case when exists (select 1 from information_schema.role_table_grants g
                         where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
                           and g.table_name in ('workspace_subscriptions', 'saas_plan_entitlements')
                           and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
            then 'GAGAL' else 'ok' end;
