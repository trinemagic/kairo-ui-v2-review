-- KAIRO - Pendaftaran Kasir/POS dikenali + topik awal "Umum" untuk akun baru (owner Okt 2026). Aman diulang.
-- Dijalankan Claude via Supabase MCP (satu statement per panggilan).
-- Temuan: provision_kairo_workspace_for_user() mengubah template yang tidak dikenal (termasuk pos_kasir) menjadi 'general', dan
-- tabel workspace_business_profiles menolak 'pos_kasir'. Akun baru juga tidak punya topik, padahal Orders mewajibkan minimal 1.
-- Perubahan: (1) 'pos_kasir' diizinkan di fungsi + constraint (hanya melebarkan daftar nilai), (2) workspace BARU untuk template
-- general / service_consultation / online_shop mendapat 1 topik "Umum" (bisa diubah/dihapus user). Workspace yang sudah ada TIDAK disentuh.

-- 1) Constraint: tambah 'pos_kasir' ke daftar template yang diizinkan.
alter table public.workspace_business_profiles drop constraint if exists workspace_business_profiles_business_template_check;
alter table public.workspace_business_profiles add constraint workspace_business_profiles_business_template_check
  check (business_template = any (array['general','digital_subscription','digital_product','service_consultation','online_shop','pos_kasir']));

-- 2) Fungsi pembuat workspace (isi sama seperti sebelumnya + 'pos_kasir' + topik awal).
create or replace function public.provision_kairo_workspace_for_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  u auth.users%rowtype;
  v_username text;
  v_display_name text;
  v_workspace_name text;
  v_slug text;
  v_workspace_id uuid;
  v_template text;
  v_requested_plan text;
begin
  select * into u from auth.users where id=p_user_id;
  if not found then raise exception 'Auth user tidak ditemukan.'; end if;

  -- If this account already owns/belongs to an active workspace, preserve it exactly as-is.
  select wm.workspace_id into v_workspace_id
  from public.workspace_members wm
  where wm.user_id=p_user_id and wm.status='active'
  limit 1;
  if v_workspace_id is not null then return v_workspace_id; end if;

  v_username := lower(trim(coalesce(u.raw_user_meta_data->>'username','')));
  if v_username='' then
    v_username := lower(regexp_replace(split_part(coalesce(u.email,''),'@',1),'[^a-z0-9._-]','','g'));
    if length(v_username)<3 then v_username := 'user'||substr(replace(p_user_id::text,'-',''),1,8); end if;
    v_username := left(v_username,32);
  end if;

  if v_username !~ '^[a-z0-9._-]{3,32}$' then
    raise exception 'Username metadata tidak valid untuk user %.',p_user_id;
  end if;

  if exists(select 1 from public.user_login_profiles where lower(username)=v_username and user_id<>p_user_id) then
    raise exception 'Username % sudah digunakan user lain.',v_username;
  end if;

  insert into public.user_login_profiles(user_id,username)
  values(p_user_id,v_username)
  on conflict(user_id) do update set username=excluded.username;

  v_display_name := coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''),v_username);
  insert into public.profiles(id,display_name,created_at,updated_at)
  values(p_user_id,v_display_name,now(),now())
  on conflict(id) do update set
    display_name=coalesce(nullif(excluded.display_name,''),public.profiles.display_name),
    updated_at=now();

  v_workspace_name := coalesce(nullif(trim(u.raw_user_meta_data->>'workspace_name'),''),'Bisnis '||v_display_name);
  v_template := lower(trim(coalesce(u.raw_user_meta_data->>'business_template','general')));
  if v_template not in ('general','digital_subscription','digital_product','service_consultation','online_shop','pos_kasir') then
    v_template := 'general';
  end if;

  v_requested_plan := lower(trim(coalesce(u.raw_user_meta_data->>'requested_plan','basic')));
  if v_requested_plan not in ('basic','plus','pro') then v_requested_plan := 'basic'; end if;

  v_slug := lower(regexp_replace(v_workspace_name,'[^a-zA-Z0-9]+','-','g'));
  v_slug := trim(both '-' from v_slug);
  if length(v_slug)<2 then v_slug:='workspace'; end if;
  v_slug := left(v_slug,40)||'-'||substr(replace(p_user_id::text,'-',''),1,8);

  insert into public.workspaces(name,slug,owner_user_id,status,created_at,updated_at)
  values(v_workspace_name,v_slug,p_user_id,'active',now(),now())
  returning id into v_workspace_id;

  insert into public.workspace_members(workspace_id,user_id,role,status,joined_at,created_at)
  values(v_workspace_id,p_user_id,'owner','active',now(),now());

  -- Self-service signup always starts BASIC; requested PLUS/PRO remains recorded for activation.
  insert into public.workspace_subscriptions(workspace_id,plan,status,created_at,updated_at)
  values(v_workspace_id,'basic','active',now(),now());

  insert into public.workspace_branding(workspace_id,primary_color,accent_color,remove_platform_branding,updated_at)
  values(v_workspace_id,'#696F41','#EA97A9',false,now());

  insert into public.workspace_business_profiles(workspace_id,business_template,onboarding_status,requested_plan)
  values(v_workspace_id,v_template,'ready',v_requested_plan)
  on conflict(workspace_id) do update set
    business_template=excluded.business_template,
    requested_plan=excluded.requested_plan,
    updated_at=now();

  if to_regclass('public.profit_share_rules') is not null then
    insert into public.profit_share_rules(workspace_id,partner_name,percentage,is_active)
    values(v_workspace_id,'Owner',1.0,true);
  end if;

  if to_regclass('public.package_masters') is not null then
    if v_template='digital_subscription' then
      insert into public.package_masters(workspace_id,code,name,price,is_active) values
      (v_workspace_id,'1M','1 Bulan',0,true),
      (v_workspace_id,'3M','3 Bulan',0,true),
      (v_workspace_id,'6M','6 Bulan',0,true),
      (v_workspace_id,'12M','12 Bulan',0,true);
    elsif v_template='service_consultation' then
      insert into public.package_masters(workspace_id,code,name,price,is_active) values
      (v_workspace_id,'BASIC-SVC','Layanan Basic',0,true),
      (v_workspace_id,'PLUS-SVC','Layanan Plus',0,true),
      (v_workspace_id,'PREMIUM-SVC','Layanan Premium',0,true);
    end if;
  end if;

  -- Topik/Kategori awal: Orders mewajibkan minimal 1, jadi akun baru dibekali satu pilihan netral (bisa diubah/dihapus user).
  if to_regclass('public.topic_masters') is not null and v_template in ('general','service_consultation','online_shop') then
    insert into public.topic_masters(workspace_id,name,is_active) values (v_workspace_id,'Umum',true) on conflict do nothing;
  end if;

  if to_regclass('public.addon_masters') is not null and v_template='digital_subscription' then
    insert into public.addon_masters(workspace_id,code,name,price,is_active) values
    (v_workspace_id,'PRIVATE','Private',0,true),
    (v_workspace_id,'SHARING','Sharing',0,true),
    (v_workspace_id,'FAMILY','Family / Invite',0,true);
  end if;

  if to_regclass('public.profit_share_versions') is not null then
    insert into public.profit_share_versions(workspace_id,effective_from,rules,created_by)
    select v_workspace_id,date '1900-01-01',
      jsonb_agg(jsonb_build_object(
        'partner_id',r.id::text,
        'partner_name',r.partner_name,
        'percentage',r.percentage
      ) order by r.partner_name),
      p_user_id
    from public.profit_share_rules r
    where r.workspace_id=v_workspace_id and coalesce(r.is_active,true)=true
    on conflict(workspace_id,effective_from) do nothing;
  end if;

  return v_workspace_id;
end;
$function$;
