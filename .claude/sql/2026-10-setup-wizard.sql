-- KAIRO: Setup Wizard untuk user Pro (Okt 2026).
-- 1) Kolom setup_state di workspace_branding: status wizard per workspace
--    (selesai / "Nanti saja" / sudah berapa kali banner pengingat tampil).
-- 2) Workspace yang SUDAH Pro saat ini ditandai selesai, supaya wizard hanya muncul untuk Pro baru.
-- 3) Tempat simpan logo (Storage bucket "workspace-branding"): bisa dibaca publik, hanya pemilik workspace
--    yang bisa upload/ganti/hapus logo di folder workspace-nya sendiri. Maks 1 MB, hanya gambar.
-- Aman diulang (if not exists / on conflict / drop policy if exists). Tidak menghapus data apa pun.

-- 1) Kolom status wizard
alter table public.workspace_branding add column if not exists setup_state jsonb;

-- 2) Pro yang sudah ada = selesai (wizard tidak muncul). Workspace tanpa baris branding dibuatkan barisnya.
insert into public.workspace_branding (workspace_id, setup_state)
select s.workspace_id, jsonb_build_object('completed_at', now(), 'source', 'existing_pro')
from public.workspace_subscriptions s
where lower(coalesce(s.plan, '')) in ('pro', 'plus', 'custom', 'enterprise')
group by s.workspace_id
on conflict (workspace_id) do update
  set setup_state = coalesce(public.workspace_branding.setup_state, excluded.setup_state);

-- 3) Storage logo
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-branding', 'workspace-branding', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kairo_logo_owner_select" on storage.objects;
drop policy if exists "kairo_logo_owner_insert" on storage.objects;
drop policy if exists "kairo_logo_owner_update" on storage.objects;
drop policy if exists "kairo_logo_owner_delete" on storage.objects;

-- Folder pertama = id workspace; hanya akun owner aktif workspace itu.
create policy "kairo_logo_owner_select" on storage.objects for select to authenticated
using (bucket_id = 'workspace-branding' and exists (
  select 1 from public.workspace_members m
  where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    and m.workspace_id::text = (storage.foldername(name))[1]));

create policy "kairo_logo_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'workspace-branding' and exists (
  select 1 from public.workspace_members m
  where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    and m.workspace_id::text = (storage.foldername(name))[1]));

create policy "kairo_logo_owner_update" on storage.objects for update to authenticated
using (bucket_id = 'workspace-branding' and exists (
  select 1 from public.workspace_members m
  where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    and m.workspace_id::text = (storage.foldername(name))[1]));

create policy "kairo_logo_owner_delete" on storage.objects for delete to authenticated
using (bucket_id = 'workspace-branding' and exists (
  select 1 from public.workspace_members m
  where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    and m.workspace_id::text = (storage.foldername(name))[1]));

-- Cek hasil: jumlah workspace Pro yang ditandai selesai + pengaturan bucket logo.
select count(*) as pro_ditandai_selesai from public.workspace_branding where setup_state ? 'completed_at';
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'workspace-branding';
