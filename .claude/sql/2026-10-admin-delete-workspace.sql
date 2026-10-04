-- KAIRO Admin: hapus workspace + akun owner dari admin panel (Okt 2026).
-- Jalankan sekali di Supabase > SQL Editor (aman diulang). Membuat 2 fungsi, TIDAK menghapus apa pun saat dijalankan.
--
-- platform_admin_delete_preview(workspace)  -> daftar tabel + jumlah baris yang akan terhapus (untuk layar peringatan)
-- platform_admin_delete_workspace(workspace, ketikan) -> hapus permanen. Ketikan harus sama dengan username owner,
--   slug, atau nama workspace. Semua atau tidak sama sekali: kalau ada satu langkah gagal, tidak ada yang terhapus.
-- Pengaman: hanya platform admin; workspace Trine Magic, workspace milik platform admin, dan workspace milik
-- akun yang sedang login tidak bisa dihapus.

create or replace function public.kairo_delete_guard(p_workspace_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare v_owner uuid; v_is_admin boolean := false;
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  if p_workspace_id is null or not exists (select 1 from public.workspaces where id = p_workspace_id) then
    raise exception 'Workspace tidak ditemukan';
  end if;
  if p_workspace_id = 'e43c8ee6-f4a7-4e10-8d00-dc34fdaf1dc2'::uuid then
    raise exception 'Workspace Trine Magic tidak bisa dihapus';
  end if;
  select wm.user_id into v_owner from public.workspace_members wm
   where wm.workspace_id = p_workspace_id and lower(wm.role) = 'owner' limit 1;
  if v_owner is not null and v_owner = auth.uid() then
    raise exception 'Tidak bisa menghapus workspace milik akun yang sedang login';
  end if;
  if v_owner is not null and to_regclass('public.platform_admins') is not null then
    execute 'select exists (select 1 from public.platform_admins where user_id = $1)' into v_is_admin using v_owner;
    if v_is_admin then raise exception 'Workspace milik platform admin tidak bisa dihapus'; end if;
  end if;
  return v_owner;
end $$;
revoke all on function public.kairo_delete_guard(uuid) from public, anon, authenticated;

drop function if exists public.platform_admin_delete_preview(uuid);
create or replace function public.platform_admin_delete_preview(p_workspace_id uuid)
returns table (table_name text, row_count bigint)
language plpgsql security definer
set search_path = public, pg_catalog
as $$
#variable_conflict use_column
declare r record; n bigint; v_owner uuid;
begin
  v_owner := public.kairo_delete_guard(p_workspace_id);
  for r in
    select c.table_name as t from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'workspace_id' and c.table_name <> 'workspaces'
    order by c.table_name
  loop
    execute format('select count(*) from public.%I where workspace_id = $1', r.t) into n using p_workspace_id;
    if n > 0 then table_name := r.t; row_count := n; return next; end if;
  end loop;
  table_name := 'akun login owner';
  row_count := case when v_owner is not null and not exists (
      select 1 from public.workspace_members where user_id = v_owner and workspace_id <> p_workspace_id) then 1 else 0 end;
  return next;
end $$;
revoke all on function public.platform_admin_delete_preview(uuid) from public, anon;
grant execute on function public.platform_admin_delete_preview(uuid) to authenticated;

drop function if exists public.platform_admin_delete_workspace(uuid, text);
create or replace function public.platform_admin_delete_workspace(p_workspace_id uuid, p_confirm text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare
  v_owner uuid; v_ok boolean; v_tables text[]; v_left text[]; v_t text; v_n bigint; v_total bigint := 0;
  v_pass int; v_auth_deleted boolean := false; v_note text := null; r record;
begin
  v_owner := public.kairo_delete_guard(p_workspace_id);

  -- Ketikan konfirmasi harus cocok dengan username owner, slug, atau nama workspace.
  select lower(trim(coalesce(p_confirm, ''))) <> '' and lower(trim(p_confirm)) in (
           lower(coalesce(to_jsonb(w) ->> 'slug', '')), lower(coalesce(w.name, '')),
           lower(coalesce((select u.raw_user_meta_data ->> 'username' from auth.users u where u.id = v_owner), '')))
    into v_ok from public.workspaces w where w.id = p_workspace_id;
  if not coalesce(v_ok, false) then raise exception 'Konfirmasi tidak cocok. Tidak ada yang dihapus.'; end if;

  -- Hapus semua baris workspace ini. Urutan antar tabel tidak diketahui (foreign key), jadi diulang beberapa putaran.
  select array_agg(c.table_name::text order by c.table_name) into v_tables
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and c.column_name = 'workspace_id' and c.table_name <> 'workspaces';
  v_tables := coalesce(v_tables, '{}');
  -- Tabel "anak" tanpa kolom workspace_id (mis. detail milik transaksi) dibersihkan lewat foreign key-nya.
  for r in
    select c.conrelid::regclass as child, ca.attname as child_col, c.confrelid::regclass as parent, pa.attname as parent_col
    from pg_constraint c
    join pg_attribute ca on ca.attrelid = c.conrelid and ca.attnum = c.conkey[1]
    join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
    where c.contype = 'f' and cardinality(c.conkey) = 1 and c.connamespace = 'public'::regnamespace
      and c.confrelid::regclass::text in (select 'public.' || x from unnest(v_tables) x union select x from unnest(v_tables) x)
      and not exists (select 1 from information_schema.columns ic where ic.table_schema = 'public'
                      and ic.table_name = (select relname from pg_class where oid = c.conrelid) and ic.column_name = 'workspace_id')
  loop
    execute format('delete from %s where %I in (select %I from %s where workspace_id = $1)', r.child, r.child_col, r.parent_col, r.parent)
      using p_workspace_id;
    get diagnostics v_n = row_count; v_total := v_total + v_n;
  end loop;
  for v_pass in 1..8 loop
    v_left := '{}';
    foreach v_t in array v_tables loop
      begin
        execute format('delete from public.%I where workspace_id = $1', v_t) using p_workspace_id;
        get diagnostics v_n = row_count; v_total := v_total + v_n;
      exception when foreign_key_violation then v_left := v_left || v_t;
      end;
    end loop;
    v_tables := v_left;
    exit when cardinality(v_tables) = 0;
  end loop;
  if cardinality(v_tables) > 0 then
    raise exception 'Gagal menghapus tabel: % (masih dipakai tabel lain). Tidak ada yang dihapus.', array_to_string(v_tables, ', ');
  end if;
  delete from public.workspaces where id = p_workspace_id;

  -- Akun login owner ikut dihapus bila tidak punya workspace lain.
  if v_owner is not null and not exists (select 1 from public.workspace_members where user_id = v_owner) then
    for r in
      select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.connamespace = 'public'::regnamespace
    loop
      execute format('delete from %s where %I = $1', r.tbl, r.col) using v_owner;
    end loop;
    begin
      delete from auth.users where id = v_owner;
      v_auth_deleted := found;
    exception when insufficient_privilege then
      v_note := 'Workspace terhapus, tapi akun login belum: hapus manual di Supabase > Authentication > Users.';
    end;
  end if;

  return jsonb_build_object('deleted_rows', v_total, 'auth_user_deleted', v_auth_deleted, 'note', v_note);
end $$;
revoke all on function public.platform_admin_delete_workspace(uuid, text) from public, anon;
grant execute on function public.platform_admin_delete_workspace(uuid, text) to authenticated;
