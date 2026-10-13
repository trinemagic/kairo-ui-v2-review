-- KAIRO (owner 13 Okt 2026): workspace template Pre-Order & Jastip TIDAK ikut aturan hapus data Gratis > 12 bulan.
-- Alasan: buku uang Pre-Order (ledger_entries, installment_schedules) tidak ikut diringkas, jadi menghapus order lama
-- membuat Pembukuan tidak cocok lagi. Aplikasi (kairo-app.js maybeRunDataRetention) juga sudah melewati template ini;
-- fungsi ini menjadi penjaga kedua bila dipanggil langsung.
-- Aman diulang: menyisipkan satu pengecekan ke kairo_retention_apply hanya bila belum ada. Tidak mengubah data.
do $patch$
declare
  v_def text := pg_get_functiondef('public.kairo_retention_apply(uuid, date, text[], jsonb)'::regprocedure);
  v_marker text := '  -- Workspace Pro yang masih aktif tidak boleh dihapus datanya.';
  v_guard text := '  -- Template Pre-Order & Jastip: data tidak pernah diringkas/dihapus (buku uang tidak ikut diringkas).
  if exists (select 1 from public.workspace_business_profiles b
             where b.workspace_id = p_workspace_id and b.business_template = ''preorder_jastip'') then
    raise exception ''Template Pre-Order: data tidak dihapus'';
  end if;

';
begin
  if position('preorder_jastip' in v_def) > 0 then
    raise notice 'Sudah terpasang, dilewati.';
    return;
  end if;
  if position(v_marker in v_def) = 0 then
    raise exception 'Penanda tidak ditemukan; fungsi berubah, periksa manual.';
  end if;
  execute replace(v_def, v_marker, v_guard || v_marker);
end
$patch$;

-- Cek: harus true.
select position('preorder_jastip' in pg_get_functiondef('public.kairo_retention_apply(uuid, date, text[], jsonb)'::regprocedure)) > 0 as guard_ok;
