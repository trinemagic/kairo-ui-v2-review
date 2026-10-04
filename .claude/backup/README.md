# Backup & keep-alive Supabase KAIRO (paket gratis)

Satu workflow GitHub Actions (`backup.yml`) yang jalan tiap hari 02.10 WIB:

1. **Keep-alive** - memanggil API Supabase (`is_username_available`) + konek ke database,
   jadi proyek gratis tidak di-pause karena 7 hari tanpa aktivitas.
2. **Backup** - dump roles, schema, data (cara resmi Supabase CLI), dikompres dan dikunci
   AES-256 dengan passphrase:
   - harian: artifact 7 hari
   - mingguan (Minggu): artifact 35 hari
   - bulanan (tanggal 1): file permanen di folder `monthly/`

**Wajib di repo PRIVATE** (mis. `trinemagic/kairo-backups`). Artifact repo publik bisa diunduh orang lain.

## Pasang (owner)
1. GitHub > New repository > nama `kairo-backups` > **Private** > centang "Add a README" > Create.
2. Supabase > project > tombol **Connect** > Connection string > pilih **Session pooler**
   (bukan Direct: server GitHub tidak bisa IPv6) > salin, ganti `[YOUR-PASSWORD]` dengan password database.
   Lupa password: Project Settings > Database > Reset database password (aplikasi KAIRO tidak terpengaruh,
   app memakai key publik, bukan password database).
3. Repo `kairo-backups` > Settings > Secrets and variables > Actions > New repository secret, isi 4:
   `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (lihat kepala `backup.yml`).
   Simpan `BACKUP_PASSPHRASE` juga di password manager - tanpa itu backup tidak bisa dibuka.
4. Add file > Create new file > `.github/workflows/backup.yml` > tempel isi `backup.yml` > Commit.
5. Actions > kairo-backup > **Run workflow** > tunggu centang hijau > buka run-nya > Artifacts `daily-...`.

Jangan pernah kirim connection string / password / passphrase lewat chat.

## Cek rutin
- GitHub mengirim email kalau run gagal. Sebulan sekali lihat Actions masih hijau.
- Supabase juga mengirim email peringatan sebelum pause - kalau datang, berarti keep-alive gagal.

## Restore
Unduh file `.tar.gz.gpg`, lalu buka: `gpg -d kairo-YYYY-MM-DD.tar.gz.gpg | tar -xz` (minta passphrase)
-> `roles.sql`, `schema.sql`, `data.sql`. Pemulihan ke database dilakukan bersama Claude (ikuti panduan
"Backup and restore using the CLI" Supabase), jangan sendirian ke database produksi.
