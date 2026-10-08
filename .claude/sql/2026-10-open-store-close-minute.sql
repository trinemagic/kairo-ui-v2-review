-- KAIRO: pulihkan order yang terlepas dari sesi Open Store karena jam Close Store dibulatkan ke menit (Okt 2026). Aman diulang.
--
-- Masalah: jam tutup diisi per menit (10:47 = 10:47:00). Order yang disimpan di menit yang sama tapi lewat beberapa detik
-- (mis. 10:47:30) dilepas dari sesi -> omzet Riwayat Open Store kurang (contoh: Rp174.000, seharusnya Rp694.000).
-- Kode sudah diperbaiki (kairo-app.js v20.10.201: tutup = akhir menit). SQL ini memperbaiki sesi LAMA saja:
--   - hanya sesi yang sudah ditutup dengan jam tepat :00 detik (ciri bug ini),
--   - hanya order TANPA sesi yang waktunya di dalam menit tutup itu,
--   - lalu jam tutup sesi digeser ke akhir menit itu.
-- Order di sesi lain tidak disentuh. Tidak ada data yang dihapus.

-- 1) Lihat dulu (tidak mengubah apa pun): order yang akan dikembalikan ke sesinya.
select s.workspace_id, s.id as shift_id, s.opened_at, s.closed_at, t.id as transaction_id, t.reading_started_at, t.total_price
from public.reading_shifts s
join public.transactions t
  on t.workspace_id = s.workspace_id and t.shift_id is null
 and t.reading_started_at >= s.closed_at and t.reading_started_at < s.closed_at + interval '1 minute'
where s.closed_at is not null and date_trunc('minute', s.closed_at) = s.closed_at
order by s.closed_at desc;

-- 2) Perbaiki.
with fix as (
  select s.id as shift_id, t.id as tx_id
  from public.reading_shifts s
  join public.transactions t
    on t.workspace_id = s.workspace_id and t.shift_id is null
   and t.reading_started_at >= s.closed_at and t.reading_started_at < s.closed_at + interval '1 minute'
  where s.closed_at is not null and date_trunc('minute', s.closed_at) = s.closed_at
), upd_tx as (
  update public.transactions t set shift_id = f.shift_id from fix f where t.id = f.tx_id returning t.id
)
update public.reading_shifts s
set closed_at = s.closed_at + interval '59.999 seconds'
where s.id in (select distinct shift_id from fix);

-- 3) Cek: harus 0 baris.
select count(*) as sisa_order_terlepas
from public.reading_shifts s
join public.transactions t
  on t.workspace_id = s.workspace_id and t.shift_id is null
 and t.reading_started_at >= s.closed_at and t.reading_started_at < s.closed_at + interval '1 minute'
where s.closed_at is not null and date_trunc('minute', s.closed_at) = s.closed_at;
