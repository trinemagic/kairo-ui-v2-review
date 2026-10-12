-- KAIRO - Harga Pro per template + pengaturan promo trial, diatur dari admin panel (owner Okt 2026).
-- Aman diulang, hanya menambah (tabel + fungsi baru) dan mengganti kairo_start_trial() agar membaca pengaturan.
-- Dijalankan Claude via Supabase MCP (satu statement per panggilan).

-- 1) Harga Pro per template. Boleh DIBACA siapa saja (landing publik); TIDAK ada policy tulis -> hanya fungsi admin di bawah yang bisa mengubah.
create table if not exists public.kairo_pro_prices (
  template_key text primary key,
  price_month integer not null check (price_month > 0),
  price_semiannual integer not null check (price_semiannual > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.kairo_pro_prices enable row level security;

drop policy if exists kairo_pro_prices_read on public.kairo_pro_prices;
create policy kairo_pro_prices_read on public.kairo_pro_prices for select to anon, authenticated using (true);

-- Data awal = harga yang sekarang tertulis di landing (6 bulan = 6 x bulanan - Rp20.000).
insert into public.kairo_pro_prices (template_key, price_month, price_semiannual) values
  ('digital_subscription', 30000, 160000),
  ('service_consultation', 53000, 298000),
  ('online_shop', 84000, 484000),
  ('pos_kasir', 98000, 568000)
on conflict (template_key) do nothing;

-- 2) Pengaturan promo trial (satu baris saja, id = 1).
create table if not exists public.kairo_promo_settings (
  id smallint primary key default 1 check (id = 1),
  trial_enabled boolean not null default true,
  trial_days integer not null default 14 check (trial_days between 1 and 90),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.kairo_promo_settings enable row level security;

drop policy if exists kairo_promo_settings_read on public.kairo_promo_settings;
create policy kairo_promo_settings_read on public.kairo_promo_settings for select to anon, authenticated using (true);

insert into public.kairo_promo_settings (id, trial_enabled, trial_days) values (1, true, 14) on conflict (id) do nothing;

-- 3) Riwayat perubahan harga & promo. RLS aktif TANPA policy: hanya fungsi admin (SECURITY DEFINER) yang bisa membaca/menulis.
create table if not exists public.kairo_pricing_history (
  id bigint generated always as identity primary key,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  changed_by_email text,
  kind text not null,
  item text not null,
  old_value jsonb,
  new_value jsonb
);

alter table public.kairo_pricing_history enable row level security;

-- 4) Satu panggilan untuk landing/form Daftar/admin: {prices:{<template>:{m,s}}, trial:{enabled,days}}.
--    SECURITY INVOKER: tunduk pada policy baca di atas, bukan fungsi berhak istimewa.
create or replace function public.kairo_public_pricing()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'prices', coalesce((select jsonb_object_agg(template_key, jsonb_build_object('m', price_month, 's', price_semiannual)) from public.kairo_pro_prices), '{}'::jsonb),
    'trial', coalesce((select jsonb_build_object('enabled', trial_enabled, 'days', trial_days) from public.kairo_promo_settings where id = 1), jsonb_build_object('enabled', true, 'days', 14))
  );
$$;

revoke all on function public.kairo_public_pricing() from public;
grant execute on function public.kairo_public_pricing() to anon, authenticated;

-- 5) Simpan harga & promo (hanya platform admin). Validasi: harga > 0, 6 bulan harus lebih murah dari 6 x bulanan, trial 1-90 hari.
--    Hanya template yang sudah ada di kairo_pro_prices yang bisa diubah. Tiap perubahan dicatat ke riwayat.
create or replace function public.platform_admin_save_pricing(p_prices jsonb, p_trial_enabled boolean, p_trial_days integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  k text;
  v jsonb;
  v_m integer;
  v_s integer;
  o public.kairo_pro_prices%rowtype;
  t public.kairo_promo_settings%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  select email into v_email from auth.users where id = v_uid;

  if p_prices is not null and jsonb_typeof(p_prices) = 'object' then
    for k, v in select * from jsonb_each(p_prices) loop
      select * into o from public.kairo_pro_prices where template_key = k;
      if not found then raise exception 'Template % tidak dikenal', k using errcode = 'P0001'; end if;
      begin
        v_m := (v->>'m')::integer; v_s := (v->>'s')::integer;
      exception when others then
        raise exception 'Harga template % harus berupa angka bulat', k using errcode = 'P0001';
      end;
      if v_m is null or v_s is null or v_m <= 0 or v_s <= 0 then raise exception 'Harga template % harus lebih dari 0', k using errcode = 'P0001'; end if;
      if v_m > 100000000 or v_s > 600000000 then raise exception 'Harga template % terlalu besar', k using errcode = 'P0001'; end if;
      if v_s >= v_m * 6 then raise exception 'Harga 6 bulan template % harus lebih murah dari 6 x harga bulanan', k using errcode = 'P0001'; end if;
      if v_m <> o.price_month or v_s <> o.price_semiannual then
        update public.kairo_pro_prices set price_month = v_m, price_semiannual = v_s, updated_at = now(), updated_by = v_uid where template_key = k;
        insert into public.kairo_pricing_history (changed_by, changed_by_email, kind, item, old_value, new_value)
        values (v_uid, v_email, 'price', k, jsonb_build_object('m', o.price_month, 's', o.price_semiannual), jsonb_build_object('m', v_m, 's', v_s));
      end if;
    end loop;
  end if;

  if p_trial_enabled is not null or p_trial_days is not null then
    select * into t from public.kairo_promo_settings where id = 1;
    if p_trial_days is not null and (p_trial_days < 1 or p_trial_days > 90) then raise exception 'Durasi trial harus 1-90 hari' using errcode = 'P0001'; end if;
    if coalesce(p_trial_enabled, t.trial_enabled) <> t.trial_enabled or coalesce(p_trial_days, t.trial_days) <> t.trial_days then
      update public.kairo_promo_settings
        set trial_enabled = coalesce(p_trial_enabled, trial_enabled), trial_days = coalesce(p_trial_days, trial_days), updated_at = now(), updated_by = v_uid
        where id = 1;
      insert into public.kairo_pricing_history (changed_by, changed_by_email, kind, item, old_value, new_value)
      values (v_uid, v_email, 'trial', 'trial', jsonb_build_object('enabled', t.trial_enabled, 'days', t.trial_days),
        jsonb_build_object('enabled', coalesce(p_trial_enabled, t.trial_enabled), 'days', coalesce(p_trial_days, t.trial_days)));
    end if;
  end if;

  return public.kairo_public_pricing();
end;
$$;

revoke all on function public.platform_admin_save_pricing(jsonb, boolean, integer) from public, anon;
grant execute on function public.platform_admin_save_pricing(jsonb, boolean, integer) to authenticated;

-- 6) Baca riwayat perubahan (hanya platform admin), terbaru dulu.
create or replace function public.platform_admin_pricing_history(p_limit integer default 50)
returns table (id bigint, changed_at timestamptz, changed_by_email text, kind text, item text, old_value jsonb, new_value jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_platform_admin() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  return query
    select h.id, h.changed_at, h.changed_by_email, h.kind, h.item, h.old_value, h.new_value
    from public.kairo_pricing_history h order by h.id desc limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

revoke all on function public.platform_admin_pricing_history(integer) from public, anon;
grant execute on function public.platform_admin_pricing_history(integer) to authenticated;

-- 7) Trial membaca pengaturan promo (aktif/mati + durasi hari) alih-alih 14 hari tetap.
create or replace function public.kairo_start_trial()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_ws uuid;
  v_on boolean;
  v_days integer;
  v_end timestamptz;
begin
  if v_uid is null then raise exception 'Belum login' using errcode = '42501'; end if;
  select trial_enabled, trial_days into v_on, v_days from public.kairo_promo_settings where id = 1;
  if not coalesce(v_on, true) then raise exception 'Promo trial Pro sedang tidak tersedia' using errcode = 'P0001'; end if;
  v_end := now() + make_interval(days => coalesce(v_days, 14));
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
