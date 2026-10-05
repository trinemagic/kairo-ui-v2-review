-- KAIRO: potongan Kas bawaan 0% untuk user Pro baru (Okt 2026).
-- Selama ini workspace Pro yang TIDAK punya baris "Kas" di profit_share_rules otomatis dipotong 5% oleh aplikasi.
-- Aplikasi versi baru memakai 0% sebagai bawaan. Supaya user Pro yang SUDAH ADA tidak berubah (saldo Kas dihitung
-- ulang dari semua transaksi), file ini menuliskan 5% itu secara eksplisit sebagai baris "Kas" untuk mereka.
-- Jalankan SEBELUM versi aplikasi baru dipasang. Aman diulang: workspace yang sudah punya baris Kas aktif dilewati.

insert into public.profit_share_rules (workspace_id, partner_name, percentage, is_active)
select s.workspace_id, 'Kas', 0.05, true
from public.workspace_subscriptions s
where lower(coalesce(s.plan, '')) in ('pro', 'plus', 'custom', 'enterprise')
  and not exists (
    select 1 from public.profit_share_rules r
    where r.workspace_id = s.workspace_id
      and lower(r.partner_name) = 'kas'
      and r.is_active = true
  )
group by s.workspace_id;

-- Cek hasil: setiap workspace Pro sekarang punya baris Kas aktif.
select w.name, s.plan, r.partner_name, r.percentage, r.is_active
from public.profit_share_rules r
join public.workspaces w on w.id = r.workspace_id
left join public.workspace_subscriptions s on s.workspace_id = w.id
where lower(r.partner_name) = 'kas'
order by w.name;
