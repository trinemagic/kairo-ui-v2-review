-- KAIRO — satu workspace hanya untuk akun owner-nya (Okt 2026)
-- Jalankan di Supabase › SQL Editor, LANGKAH DEMI LANGKAH (blok per blok), bukan sekaligus.
-- Tabel yang dipakai app: public.workspace_members (workspace_id, user_id, role, status).

-- ── LANGKAH 1 — CEK DULU (tidak mengubah apa pun) ─────────────────────────────
-- 1a. Anggota yang BUKAN owner (akan kehilangan akses setelah langkah 2).
select w.name as workspace, wm.user_id, wm.role, wm.status
from public.workspace_members wm
join public.workspaces w on w.id = wm.workspace_id
where lower(coalesce(wm.role, '')) <> 'owner'
order by w.name;

-- 1b. Workspace yang punya LEBIH DARI SATU owner aktif (perlu diputuskan manual).
select w.name as workspace, count(*) as jumlah_owner
from public.workspace_members wm
join public.workspaces w on w.id = wm.workspace_id
where lower(wm.role) = 'owner' and wm.status = 'active'
group by w.name
having count(*) > 1;

-- 1c. Workspace aktif yang TIDAK punya owner sama sekali (jangan sampai terkunci).
select w.id, w.name
from public.workspaces w
where w.status = 'active'
  and not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = w.id and lower(wm.role) = 'owner' and wm.status = 'active'
  );

-- ── LANGKAH 2 — CABUT AKSES SELAIN OWNER ──────────────────────────────────────
-- Jalankan HANYA setelah hasil 1a sudah dicek dan 1c kosong.
delete from public.workspace_members
where lower(coalesce(role, '')) <> 'owner';

-- ── LANGKAH 3 — KUNCI SUPAYA KE DEPAN HANYA ADA ROLE OWNER ────────────────────
-- Gagal kalau langkah 2 belum dijalankan (masih ada role lain) — itu disengaja.
alter table public.workspace_members drop constraint if exists workspace_members_owner_only;
alter table public.workspace_members
  add constraint workspace_members_owner_only check (lower(role) = 'owner');
