-- KAIRO - Trial Pro 14 hari, satu kali per akun (owner Okt 2026). Aman diulang, hanya menambah (tabel + fungsi baru).
-- Dijalankan Claude via Supabase MCP (satu statement per panggilan).

-- 1) Catatan trial yang sudah dipakai. Kunci = akun login (user_id), tanpa foreign key supaya catatan tetap ada
--    walau workspace dihapus. RLS aktif TANPA policy: hanya fungsi di bawah (SECURITY DEFINER) yang bisa membaca/menulis.
create table if not exists public.kairo_trials (
  user_id uuid primary key,
  workspace_id uuid,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);

alter table public.kairo_trials enable row level security;

-- 2) Mulai trial untuk akun yang sedang login. Syarat: login, punya workspace sebagai owner, belum pernah trial,
--    dan workspace masih Gratis tanpa riwayat masa aktif. Hasil: workspace_subscriptions = pro / trialing sampai 14 hari ke depan.
--    Setelah tanggal berakhir, aplikasi otomatis membaca workspace sebagai Gratis (effectiveSubscriptionPlan); data tidak dihapus.
create or replace function public.kairo_start_trial()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_ws uuid;
  v_end timestamptz := now() + interval '14 days';
begin
  if v_uid is null then raise exception 'Belum login' using errcode = '42501'; end if;
  select workspace_id into v_ws from public.workspace_members
    where user_id = v_uid and role = 'owner' order by created_at limit 1;
  if v_ws is null then raise exception 'Workspace tidak ditemukan' using errcode = 'P0002'; end if;
  if exists (select 1 from public.kairo_trials where user_id = v_uid) then
    raise exception 'Trial Pro hanya bisa dipakai satu kali per akun' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.workspace_subscriptions
      where workspace_id = v_ws and (plan <> 'basic' or current_period_end is not null)) then
    raise exception 'Workspace ini sudah pernah memakai paket Pro' using errcode = 'P0001';
  end if;
  insert into public.kairo_trials (user_id, workspace_id, started_at, ends_at) values (v_uid, v_ws, now(), v_end);
  insert into public.workspace_subscriptions (workspace_id, plan, status, current_period_start, current_period_end)
    values (v_ws, 'pro', 'trialing', now(), v_end)
  on conflict (workspace_id) do update
    set plan = 'pro', status = 'trialing', current_period_start = now(), current_period_end = v_end, updated_at = now();
  return v_end;
end;
$$;

revoke all on function public.kairo_start_trial() from public, anon;
grant execute on function public.kairo_start_trial() to authenticated;
