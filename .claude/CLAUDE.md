# KAIRO Workspaces — instruksi kerja untuk Claude

File ini dibaca otomatis di setiap sesi Claude Code. Isinya aturan kerja dari owner,
peta arsitektur, dan catatan teknis yang sudah terbukti penting. **Baca sampai habis
sebelum mengubah apa pun.** Update file ini setiap ada keputusan atau temuan baru
yang akan berguna di sesi berikutnya.

Folder `.claude/` tidak ikut ditayangkan GitHub Pages (Jekyll mengabaikan folder
yang diawali titik). Tetap: **jangan pernah menulis rahasia di sini.**

---

## 1. Aturan kerja dari owner (wajib)

- **Bahasa:** Indonesia santai, singkat, jelas. Owner bukan developer — jelaskan
  penyebab dan dampak dengan bahasa awam, istilah teknis seperlunya.
- **Inspect dulu, baru ubah.** Cari penyebab sebenarnya (baca kode, reproduksi di
  browser) sebelum menulis fix. Jelaskan singkat temuan + rencana.
- **Perubahan paling kecil dan aman.** Hanya sentuh komponen yang diminta. Jangan
  mengganggu struktur, tombol, ID, atau fitur lain yang sudah berjalan.
- **Replace, jangan duplicate.** Kalau mengganti sesuatu, hapus yang lama (markup,
  JS, CSS, rule media query) — jangan menumpuk override di atas kode mati.
- **Perubahan layout/visual besar → kirim PREVIEW dulu** (screenshot sebelum/sesudah
  dari branch, belum merge) dan tunggu owner bilang oke. Owner pernah minta ini
  eksplisit supaya tidak bolak-balik revisi.
- **Sketsa/gambar referensi dari owner**: perhatikan orientasi yang owner sebutkan
  (contoh: sketsa Open Store harus diputar 90° ke kiri dulu sebelum dianalisis).
- **Referensi komponen React/shadcn/Tailwind** (mis. dari 21st.dev): project ini
  BUKAN React. Tiru tampilannya dengan HTML/CSS/JS yang ada; jelaskan ke owner.
- **Berlaku untuk semua paket** (BASIC / PLUS / PRO) kecuali owner bilang lain —
  uji ketiganya bila perubahannya bisa terpengaruh paket.
- **Laporan akhir** selalu memisahkan **sudah dicek** vs **belum dicek** dengan jujur
  (mis. Safari, Supabase asli, login sungguhan). Jangan klaim sesuatu sudah jalan
  kalau belum diuji.
- **Rahasia:** jangan minta password/token lewat chat. Kredensial test → environment
  variable di pengaturan environment. Key Supabase di `kairo-app.js` adalah
  `sb_publishable_…` (memang publik, dilindungi RLS). Tidak boleh ada `service_role`
  atau secret key di repo.

### Git, PR, merge
- Kerja di branch sesi yang ditentukan sistem (format `claude/...`). Jangan push ke
  `main` langsung.
- Setelah PR sebelumnya di-merge, mulai lagi dari `main` terbaru:
  `git fetch origin main && git checkout -B <branch> origin/main`, lalu
  `git push --force-with-lease -u origin <branch>`.
- Commit terpisah per item/kelompok perubahan, pesan commit menjelaskan *kenapa*.
- Owner sudah memberi wewenang membuka PR **dan** merge sendiri. Merge ketika owner
  bilang "merge"/"langsung merge"/minta perbaikan bug yang jelas; untuk perubahan
  layout besar, preview dulu. Kalau merge tanpa kata "merge" eksplisit, katakan
  terus terang dan ingatkan tombol Revert.
- **Catatan rollback wajib** setelah setiap merge: pesan merge commit berisi SHA
  `main` sebelum merge + commit perubahan + daftar file; lalu satu komentar di PR
  dengan tabel commit, file, cara revert (`git revert -m 1 <merge-sha>`), dan data
  localStorage baru (jika ada). Pola ini sudah dipakai di PR #1–#14.
- GitHub Pages deploy otomatis dari `main` (± 1–2 menit). Ingatkan owner hard
  refresh (Cmd+Shift+R).

---

## 2. Arsitektur

Situs statis di GitHub Pages: **tanpa build, tanpa package.json, tanpa React.**
URL live: `https://trinemagic.github.io/kairo-ui-v2-review/`

| File | Peran | Catatan |
|---|---|---|
| `index.html` | Landing (`#kairo-entry`) + app (`#app-shell`) + dialog | Satu dokumen. Pernah ter-duplikasi (2× `</html>`) — cek dobel setelah edit besar. |
| `assets/kairo-app.js` | Logika app lama (~5000 baris): auth Supabase, data, render | Banyak blok `/* ---- KAIRO SCRIPT BOUNDARY ---- */` yang membungkus/menimpa fungsi lama. `let` top-level (mis. `historyTransactions`, `currentShift`, `activeWorkspacePlan`) bisa diakses script lain. Ubah **hanya** bila perlu & sudah diminta; minimal dan terarah. |
| `assets/kairo.css` | CSS lama (~3000 rule, banyak `!important`, `#id`, `:has(#id)`) | Hampir tidak disentuh. Rule-nya sering menang specificity → override di v3 butuh selector setara/lebih kuat. |
| `assets/kairo-v3.css` | Lapisan presentasi baru, semua rule di-scope `html.kairo-v3` | Tempat utama perubahan UI. Token warna `--v3-*` (light) dan override `body.saas-dark`. |
| `assets/kairo-v3.js` | Helper presentasi (IIFE) | Landing pages, login dialog, Ingat saya, history table, notifikasi, warna layout, jam. |
| `assets/fonts/` | Plus Jakarta Sans self-hosted (OFL) | Jangan kembali ke Google Fonts. |
| `assets/kairo-runtime.js` | Lazy loader lama | Tidak dimuat oleh `index.html` saat ini. |

**Cache key:** setiap mengubah file aset, naikkan `?v=` di `index.html`.
Versi terakhir: `kairo.css?v=20.10.149`, `kairo-v3.css?v=3.14.1`,
`kairo-v3.js?v=3.14.0`, `kairo-app.js?v=20.10.154`.

**Halaman app** = `main.container > section.section` dengan id:
`dashboard`, `performance`, `input` (Orders), `customers`, `promo` (dibuat via JS),
`payout` (Withdraw), `cash` (Petty Cash), `settings`. Pindah halaman:
`openAppPage(tab)`; muat data: `loadPageData(tab,{force})` (per halaman — kalau ada
kartu yang tidak ter-update, cek cabang tab-nya di sini).

---

## 3. Yang sudah dibangun (jangan dirusak)

- **Landing:** Home (Hero+CTA+FAQ), halaman hash `#features #solutions #pricing #about`,
  `#masuk` = langsung form login. Badge "kini hadir…" sudah dihapus (owner: jangan
  wording khas AI).
- **Login:** "Ingat saya" menyimpan **username saja** (`kairo_remember_username_v1`);
  `persistSession:false` sengaja (wajib login tiap buka) — jangan diubah tanpa izin.
- **Riwayat Transaksi:** 7 kolom (Tanggal, Start Reading, Nama, Status, Paket=kode,
  Total, Aksi); Detail dialog + menu **Aksi** (Struk, Hapus/Cancel) yang meng-klik
  tombol asli app; mobile = kartu. Kolom lain tetap di DOM (disembunyikan CSS).
- **Open Store:** desktop 2 kolom (kontrol+statistik kiri, riwayat kanan, tinggi
  riwayat = kolom kiri, scroll di dalam); mobile kartu; minimize = sesi hari ini.
  Teks "Store aktif sejak…" sudah dihapus beserta kodenya.
- **Sidebar mini** 76px (`--sidebar-mini:96px`), ikon tidak bergeser saat transisi.
- **Toolbar:** Orders/Customers/Promo/Petty Cash/Settings hanya tombol Refresh (CSS `:has`).
- **Dashboard:** "Halo, {display_name}!" (`window.kairoDisplayName`), jam real-time,
  quick access sudah dihapus.
- **Kartu statistik Dashboard (compact):** ikon kiri + label & angka bertumpuk, tanpa
  caption di bawah angka (owner: biar clean). 4 kolom ≥1241px, 2 kolom di bawahnya;
  ≤520px angka pakai lebar penuh kartu supaya tidak patah. Kartu "Paket Terlaris"
  (`kpi-best`) sudah dihapus beserta hitungannya di `renderDashboard()`.
  Template seller (`body.seller-app-premium`, 5 kartu + Profit): desktop 3 atas + 2
  lebar bawah (grid 6 kolom), ≤1240px 2 kolom dengan kartu ganjil terakhir selebar penuh.
  Tes seller: suntik `assets/templates/seller-app-premium.css/js` setelah `bootApp`.
- **Warna layout:** `kairo-v3.js` memetakan `--brand-primary/--brand-accent` ke token
  v3. Default lama `#696F41/#EA97A9` = "belum diatur" (tetap tampilan KAIRO).
  Reset = `#25B9B0` / `#173A59`.
- **Notifikasi** (lonceng di samping dark mode): order On Progress ≥5 menit
  (24 jam terakhir), ≥30 menit merah. Seen: `kairo_notif_seen_v1_<workspace>`.
- **Dark mode:** sudah diaudit 0 temuan kontras; transisi tema pakai View Transitions.
- **Performance:** semua mengikuti filter tanggal utama (`getRange()`).
- **Orders:** setelah simpan berhasil, form kosong total termasuk Platform & Metode
  Pembayaran (owner: user wajib pilih ulang tiap order). `tx-payment` punya opsi
  kosong "-- Pilih Metode Pembayaran --" + `required`, jadi tidak jatuh ke QRIS.
- **Dark mode hover tabel:** sorotan gelap solid (`--v3-sky`) — jangan biarkan
  `tr:hover` dari `kairo.css` (latar hampir putih) tembus.

---

## 4. Jebakan yang sudah pernah terjadi

- `body.auth-locked` dari `kairo.css` menyembunyikan semua `header`/`main` → konten
  landing butuh override di `#kairo-entry`. `#app-shell` disembunyikan saat locked.
- Safari menghitung grid/flex berbeda dari Chromium (contoh: tombol Open Store
  melar). Hindari `flex-wrap` kolom di dalam area grid; tulis grid line eksplisit.
- `kairo-app.js` `wireEyes()` membungkus field password saat boot → fokus hilang;
  sudah dipulihkan di `kairo-v3.js`.
- Kunci paket (`decorate()`) dulu tidak pernah membuka kunci setelah paket asli
  termuat — logika paket harus dihitung ulang tiap render, bukan sekali kunci.
- `kairo.css` memberi latar putih/zebra ke `td`/`.table-wrap` dengan specificity
  tinggi (`:has(#history-date-filter)`, `tr:nth-child(2n) td`) — cek dark mode.
- Audit kontras statis tidak menangkap state **hover/fokus** — selalu uji juga dengan
  `audit-hover.js`. Warna dari `color-mix` muncul sebagai `color(srgb …)`.
- `form.reset()` tidak memicu `change`, sedangkan select kustom (`.sh-select-*`)
  hanya memperbarui label saat `change` → setelah reset, dispatch `change`.
- Saat tes, `document.querySelector('.btn-green')` pertama adalah tombol login di
  dialog, bukan Refresh — pakai selector yang spesifik.
- Topik: tabel `topic_masters` mungkin tidak punya kolom `code`; simpan topik sudah
  retry tanpa `code`. Belum diverifikasi di DB asli.

---

## 5. Cara menguji

Sandbox memblokir CDN (jsdelivr, Google Fonts), Supabase, dan `github.io`. Uji
dengan Chromium + Playwright dan **mock Supabase** di `.claude/testing/`:

```bash
cd /home/user/kairo-ui-v2-review && python3 -m http.server 8123 &   # sajikan repo
cd .claude/testing && node example.js                                # lihat README
```

- Playwright: `/opt/node22/lib/node_modules/playwright`, Chromium sudah terpasang
  (jangan `playwright install`). Tidak ada WebKit → **Safari tidak bisa diuji**.
- Chart.js untuk halaman Performance: `npm pack chart.js@4` lalu route
  `**/npm/chart.js` ke `package/dist/chart.umd.min.js` (registry npm bisa diakses).
- `audit-contrast.js` = audit kontras WCAG per menu (dark/light);
  `audit-hover.js` = kontras baris tabel saat di-hover (dark);
  `test-order-form.js` = alur simpan penjualan Orders.
- Uji desktop 1440 & mobile 390, light & dark, dan kirim screenshot ke owner.

---

## 6. Belum selesai / perlu dicek owner

- Semua perubahan belum diuji di **Safari** dan dengan **Supabase/login asli**.
- Penyebab "tidak bisa tambah topik" di DB asli belum terkonfirmasi.
- Bila Open/Close Store masih terkunci untuk PRO: cek tabel `saas_plan_entitlements`
  (`plan='pro'`, `feature_key='open_close_store'`, `enabled`).
- Light mode: beberapa teks abu-abu kontras ±4.0 (sedikit di bawah 4.5) — belum
  diubah, tunggu keputusan owner.
- Kriteria notifikasi (24 jam, seen per perangkat) adalah keputusan Claude — owner
  boleh minta ubah.
