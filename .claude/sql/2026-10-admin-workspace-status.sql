-- KAIRO Admin: fungsi ubah status workspace (Okt 2026).
-- Dipakai tombol Aktifkan / Suspend / Arsipkan di modal Workspace admin. Fungsi ini belum ada di database.
-- Workspace yang tidak 'active' tidak bisa dibuka pemiliknya (dashboard hanya menerima workspace aktif); data tidak dihapus.
-- Pengaman: hanya platform admin; Trine Magic dan workspace milik akun yang sedang login tidak bisa di-suspend/arsip.
-- Aman diulang.

drop function if exists public.platform_admin_update_workspace_status(uuid, text);

create function public.platform_admin_update_workspace_status(p_workspace_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare v_owner uuid;
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  if p_status not in ('active', 'suspended', 'archived') then raise exception 'Status harus active, suspended, atau archived'; end if;
  if p_workspace_id is null or not exists (select 1 from public.workspaces where id = p_workspace_id) then
    raise exception 'Workspace tidak ditemukan';
  end if;
  if p_status <> 'active' then
    if p_workspace_id = 'e43c8ee6-f4a7-4e10-8d00-dc34fdaf1dc2'::uuid then
      raise exception 'Workspace Trine Magic tidak bisa di-suspend atau diarsipkan';
    end if;
    select wm.user_id into v_owner from public.workspace_members wm
     where wm.workspace_id = p_workspace_id and lower(wm.role) = 'owner' limit 1;
    if v_owner is not null and v_owner = auth.uid() then
      raise exception 'Tidak bisa menonaktifkan workspace milik akun yang sedang login';
    end if;
  end if;
  update public.workspaces set status = p_status where id = p_workspace_id;
end $$;

revoke all on function public.platform_admin_update_workspace_status(uuid, text) from public, anon;
grant execute on function public.platform_admin_update_workspace_status(uuid, text) to authenticated;

-- Cek: fungsi sudah ada (1 baris).
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'platform_admin_update_workspace_status';
