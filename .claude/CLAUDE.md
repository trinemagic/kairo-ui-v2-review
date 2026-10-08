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
- **Berlaku untuk semua paket** (Gratis / Pro) kecuali owner bilang lain —
  uji keduanya (+ template seller) bila perubahannya bisa terpengaruh paket.
- **Laporan akhir** selalu memisahkan **sudah dicek** vs **belum dicek** dengan jujur
  (mis. Safari, Supabase asli, login sungguhan). Jangan klaim sesuatu sudah jalan
  kalau belum diuji.
- **Rahasia:** jangan minta password/token lewat chat. Kredensial test → environment
  variable di pengaturan environment. Key Supabase di `kairo-app.js` adalah
  `sb_publishable_…` (memang publik, dilindungi RLS). Tidak boleh ada `service_role`
  atau secret key di repo.

- **Perubahan Supabase (owner Okt 2026):** Claude tidak mengubah database. Kalau perlu tabel/kolom/
  RLS/data baru, tulis **SQL siap tempel** (aman diulang: `if not exists`, `on conflict`) + penjelasan
  singkat; owner yang menjalankan di SQL Editor Supabase. Jangan pernah minta key/password.

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
  Deploy bisa macet (PR #28: langkah "Deploy to GitHub Pages" >8 menit). Kalau owner bilang
  fix belum jalan, cek dulu status run `pages build and deployment` (actions_list) sebelum
  mencari bug lain. `index.html` di-cache browser ±10 menit oleh GitHub Pages.
  Okt 2026 (PR #53/#54): run Pages macet di status "queued" >12 jam; "re-run" dari API ikut macet dan run yang
  belum masuk antrean tidak bisa di-cancel (409). Yang berhasil memicu deploy baru: merge perubahan baru ke `main`
  (deploy baru membawa semua commit sebelumnya).

---

## 2. Arsitektur

Situs statis di GitHub Pages: **tanpa build, tanpa package.json, tanpa React.**
URL live: **`https://kairoworkspaces.my.id/`** (domain sendiri via file `CNAME`, dipasang owner Okt 2026;
alamat lama `trinemagic.github.io/kairo-ui-v2-review/` dialihkan GitHub ke domain ini). localStorage per domain - pindah
domain = pengguna login ulang & pengaturan browser (Ingat saya, dark mode) mulai dari awal sekali.

| File | Peran | Catatan |
|---|---|---|
| `index.html` | Landing (`#kairo-entry`) + app (`#app-shell`) + dialog | Satu dokumen. Pernah ter-duplikasi (2× `</html>`) — cek dobel setelah edit besar. |
| `assets/kairo-app.js` | Logika app lama (~5000 baris): auth Supabase, data, render | Banyak blok `/* ---- KAIRO SCRIPT BOUNDARY ---- */` yang membungkus/menimpa fungsi lama. `let` top-level (mis. `historyTransactions`, `currentShift`, `activeWorkspacePlan`) bisa diakses script lain. Ubah **hanya** bila perlu & sudah diminta; minimal dan terarah. |
| `assets/kairo.css` | CSS lama (~3000 rule, banyak `!important`, `#id`, `:has(#id)`) | Hampir tidak disentuh. Rule-nya sering menang specificity → override di v3 butuh selector setara/lebih kuat. |
| `assets/kairo-v3.css` | Lapisan presentasi baru, semua rule di-scope `html.kairo-v3` | Tempat utama perubahan UI. Token warna `--v3-*` (light) dan override `body.saas-dark`. |
| `assets/kairo-v3.js` | Helper presentasi (IIFE) | Landing pages, login dialog, Ingat saya, history table, notifikasi, warna layout, jam. |
| `assets/fonts/` | Plus Jakarta Sans self-hosted (OFL) | Jangan kembali ke Google Fonts. |
| `assets/brand/` | Logo resmi KAIRO Workspaces (kit dari owner, Okt 2026) | `kairo-horizontal-color.svg` = landing (header, footer, dialog Masuk; latar terang, min. lebar 120px); `kairo-app-icon.svg` = logo default dashboard (`KAIRO_LOGO`, sidebar, header HP, preview Settings, admin) sampai user upload logo sendiri; `favicon.svg/.ico`; `assets/og/apple-touch-icon.png` dari kit. Wordmark digambar - jangan diketik ulang pakai font. `assets/kairo-mark.svg` (logo lama) sudah dihapus. |

**Cache key:** setiap mengubah file aset, naikkan `?v=` di `index.html`.
Versi terakhir: `kairo.css?v=20.10.158`, `kairo-v3.css?v=3.35.1`,
`kairo-v3.js?v=3.28.2`, `kairo-app.js?v=20.10.203`, `kairo-themes.css?v=1.0.0`/`.js?v=1.0.1`; template seller dimuat dari kairo-app.js
(`seller-app-premium.js?v=20.10.160`, `.css?v=20.10.157`) — naikkan juga bila file template diubah.
Setup Wizard dimuat dari `loadSetupWizard()` di kairo-app.js (`kairo-setup-wizard.js/.css?v=1.0.4`, satu konstanta `v`).
Panduan dimuat dari `window.kairoOpenGuide()` di kairo-v3.js (`kairo-guide.js/.css?v=` konstanta `GUIDE_V`='1.0.1'; gambar `assets/guide/*.webp?v=` `SHOT_V` di kairo-guide.js).
Admin: `admin.js?v=1.11.0`, `admin.css?v=1.8.1`. Library CDN dikunci versi + SRI: supabase-js 2.117.2 (index.html & admin), Chart.js 4.4.4 `dist/chart.umd.js`
(`ensureChartLibrary`, admin), xlsx-js-style 1.2.0. **Ganti versi = hitung ulang SRI** (`npm pack` lalu `openssl dgst -sha384 -binary f | openssl base64 -A`).

**Halaman app** = `main.container > section.section` dengan id:
`dashboard`, `performance`, `input` (Orders), `customers`, `promo` (dibuat via JS),
`payout` (Withdraw), `cash` (Petty Cash), `settings`. Pindah halaman:
`openAppPage(tab)`; muat data: `loadPageData(tab,{force})` (per halaman — kalau ada
kartu yang tidak ter-update, cek cabang tab-nya di sini).

---

## 3. Yang sudah dibangun (jangan dirusak)

- **Landing:** Home (Hero + `#home-highlights` "Kenapa KAIRO" 4 kartu `.kairo-lp-feature-list` +
  `#home-plans` ringkasan Gratis/Pro + CTA + FAQ), halaman hash `#features #solutions #pricing #about`,
  `#features` = showcase screenshot asli (`assets/landing/*.webp`, data contoh nama netral "Toko Demo",
  dibuat ulang dengan `.claude/testing/shoot-landing.js`; contoh **toko online umum** — Kaos/Totebag, label struk
  Tanggal/Produk/Kategori; owner: **jangan** pakai contoh jasa tarot / kolom "Start Reading"; screenshot Orders
  dipotong sebelum field Topik) + "Fitur lainnya"; label `.kairo-lp-pro-tag`
  untuk fitur Pro. Meta SEO/Open Graph + favicon di `<head>`; gambar preview link
  `assets/og/kairo-og.jpg` (1200×630), URL absolut `https://kairoworkspaces.my.id/` (ganti bila pindah domain lagi).
  Badge kuning kecil di atas judul section (`.kairo-lp-eyebrow`) sudah dihapus semua (owner) — jangan
  ditambah lagi. `#masuk` = langsung form login. Badge "kini hadir…" sudah dihapus (owner: jangan
  wording khas AI).
  Copy landing ditulis untuk pelanggan: **jangan** ada catatan internal/teknis (Supabase,
  tenant, auth, "belum final"). Pricing Gratis (Rp0) / Pro / Custom dengan daftar fitur; tombol
  Pro/Custom membuka form daftar dengan paket terpilih (`data-signup-plan` → `window.__kairoSignupPlan`).
  Harga Pro (owner Okt 2026): **Rp43.000/bulan**; paket 6 bulan harga normal Rp258.000 dicoret →
  **Rp238.000** (tanpa badge "Hemat" — owner) — tampil di Pricing landing, kartu Pro halaman Daftar, FAQ 03.
  **Pilihan durasi Pro saat daftar (owner Okt 2026):** kotak "Durasi paket Pro" (`.kairo-pp-period`, hanya saat Pro
  dipilih): 1 bulan Rp43.000 / 6 bulan ~~Rp258.000~~ Rp238.000 → `#kairo-selected-period` → metadata signup
  `requested_period` ('monthly'|'semiannual', sama dengan billing_period admin) + disebut di pesan WA konfirmasi. Halaman **`#syarat` (S&K) & `#privasi`** (`.kairo-lp-legal`, berlaku 5 Okt 2026) +
  footer berisi link keduanya, WhatsApp 0877-9454-5507, ©. Headline hero: "Pencatatan usaha yang rapi untuk seller & jasa
  online." Belum ada: testimoni, medsos, kebijakan refund (menunggu owner). FAQ 8 poin fokus fitur
  unggulan (tanpa poin dark mode — owner). Jangan klaim fitur yang belum ada ("Owner Menu
  Lock" dibatalkan owner Okt 2026 - tidak akan dibuat; "Auto Lock dashboard" itu fitur lain yang memang ada).
- **Riwayat paket Gratis = 60 hari (owner Okt 2026, opsi "Gabungan"):** fitur `full_history` (min `pro`, bisa di-override
  `saas_plan_entitlements`). `historyCutoff()`/`clampHistoryFrom()` di kairo-app.js: `getRange()` (Dashboard, Performance, Withdraw,
  Petty Cash periode), `fetchHistoryTransactions()` dan `renderCashHistoryTable()` tidak menampilkan data < hari ini-59. **Ringkasan saldo**
  (`fetchFinancialSnapshot`, perbandingan bulanan, notifikasi) tetap dari semua data - saldo Gratis = Pro. `historyAllTransactions`
  = riwayat tanpa potongan 60 hari, dipakai template seller untuk **Akan Expired & Piutang** (`reminderTransactions()`), supaya langganan
  3/6 bulan lama tetap diingatkan. Notice `.kairo-history-limit` ("N catatan lebih lama... Upgrade ke Pro") hanya muncul bila memang
  ada data tersembunyi (Riwayat Transaksi, riwayat seller, Petty Cash). Copy: pricing/home/daftar/FAQ 03/S&K/Privasi.
  **Fase 2 (hapus data Gratis >12 bulan) dibuat Okt 2026:** `maybeRunDataRetention()` (kairo-app.js, tiap login, hanya Gratis): bila ada data
  yang 30 hari lagi berumur >12 bulan -> simpan pemberitahuan `workspace_branding.data_retention {notice_at, through, count}` + banner
  `#kairo-retention-notice` di atas `#kairo-upgrade-hint`. >=30 hari kemudian -> data sebelum `through` diringkas `buildRetentionRollup()` jadi
  baris "Saldo awal" (transaksi `package_code='KAIRO_ROLLUP'` dengan `manual_profit_split` = hak tiap partner + Kas + `__lainnya`; pencairan per
  partner & kas berawalan `[Saldo awal]`) lalu RPC `kairo_retention_apply` menghapus + menyisipkan dalam SATU transaksi DB (cek pemilik, bukan
  Pro aktif, 30 hari, 12 bulan). Saldo partner/Kas/omzet total TERUJI sama sebelum & sesudah (juga saat ringkasan lama diringkas ulang).
  Pro/Trine Magic = pemberitahuan dibatalkan. Langganan seller yang berakhir >= 30 hari lalu disimpan (`window.kairoSellerTxActiveUntil`).
  Baris ringkasan disembunyikan dari daftar (`isRollupTx/isRollupRow`: riwayat, periode, customer, penjualan per produk, notice 60 hari).
  SQL `.claude/sql/2026-10-free-data-retention.sql` (**sudah dijalankan owner Okt 2026**). Keterbatasan: workspace yang tidak pernah
  login tidak dihapus; hak partner nonaktif masuk `__lainnya`; Kas dari data lama mengikuti aturan Gratis (0) saat diringkas.
- **Kas / Petty Cash (owner Okt 2026):** fitur `petty_cash` = Pro. `cashActive()` = Pro && `workspace_branding.cash_enabled!==false`
  (saklar "Pakai Kas" di Settings › Pembagian Omzet; SQL `.claude/sql/2026-10-cash-toggle.sql`, default true). Kas tidak aktif:
  `cashShareRateForDate`=0, `shareRuleFor` menormalisasi partner non-Kas jadi 100%, nominal manual Kas per produk diabaikan
  (masuk ke bagian persentase) -> 100% laba ke Withdraw. Kartu Saldo Kas `hidden` (grid 3 kolom / seller 2x2 via `body.kairo-no-cash`),
  menu Petty Cash: Gratis = terkunci (decorateLocks), Pro mati = disembunyikan. Pro yang sudah ada TIDAK diubah. **Kas Modal**
  (Petty Cash): total HPP penjualan per tanggal (`renderCapitalCash`), ikut filter riwayat kas, terpisah dari Saldo Kas.
  **Mematikan Kas** (owner Okt 2026): saklar off membuka panel `#kairo-cash-off-panel` "berlaku mulai" (tanggal+jam) -> versi
  pembagian baru (Kas `cash_off:true`, 0%, partner lain diskalakan ke 100%) + `cash_enabled=false`. Saldo Kas yang sudah terkumpul tetap
  (kartu & Petty Cash tetap tampil selama saldo ≠ 0, `cashVisible()`); transaksi setelah tanggal itu tidak menambah Kas (`kasOffSince()`).
  Gratis: editor partner (`#profit-share-editor-form`, Tambah Partner) disembunyikan - laba bersih setelah HPP tetap tampil.
  Default Kas 0% untuk user Pro baru (owner Okt 2026): `DEFAULT_CASH_SHARE_RATE`=0 (dulu `LEGACY_CASH_SHARE_RATE`=5% bila workspace tidak
  punya baris Kas). Saldo Kas dihitung ulang dari SEMUA transaksi, jadi Pro lama tanpa baris Kas (mis. TOKO SEMPA 60/35) dikunci 5% lewat
  `.claude/sql/2026-10-kas-default-zero.sql` - SQL ini WAJIB jalan sebelum kode 0% dipasang.
- **HPP & pembagian per produk (owner Okt 2026):** kategori Settings `profit` dibuka untuk Gratis (termasuk mode manual).
- **Masa aktif (owner Okt 2026):** `effectiveSubscriptionPlan()` - Pro lewat tanggal berakhir (current_period_end/expires_at/end_date/
  valid_until, akhir hari) atau status canceled/inactive/expired dibaca Gratis (data aman), toast sekali per workspace; Trine Magic
  selalu Pro; Pro tanpa tanggal = Pro selamanya (admin › Perlu Perhatian: "Pro tanpa masa aktif").
- **Performance › Penjualan per Produk:** kartu `#product-sales-card` (produk + periode sendiri; seller = per aplikasi; hanya produk utama, add-on tidak masuk daftar — owner Okt 2026).
- **Paket (keputusan owner Okt 2026):** hanya **Gratis** dan **Pro**. `canonicalPlan()`/`planLabel()`
  (kairo-app.js): DB `basic`/`free` → internal `basic`, tampil "GRATIS"; `plus`/`custom`/`enterprise`
  → `pro`, tampil "PRO". `PLAN_RANK={basic:1,pro:2}`, fitur eks-PLUS sekarang min `pro`. Daftar
  akun: tabel Gratis/Pro/Custom; pilih Custom → `requested_plan:'pro'`, `requested_variant:'custom'`.
  Entitlement DB dibaca dari baris `plan='basic'|'pro'` (baris `plus` tidak dipakai lagi).
- **Halaman Daftar (`#kairo-account-page`):** latar terang gaya landing. Pilih paket = 3 kartu
  `.kairo-pp-card` (Gratis putih / Pro delft + badge gold / Custom putih, `[data-kairo-plan]`,
  centang saat dipilih) + "Bandingkan paket": tabel fitur pembeda, 6 baris dulu (`VISIBLE_ROWS`),
  tombol tengah "Lihat semua fitur" membuka sisa baris + "Sudah termasuk di semua paket" (owner:
  jangan menuhin layar). HP: kartu paket yang tidak dipilih cuma nama+harga+1 baris, poin hanya di
  kartu terpilih; Jenis Usaha jadi baris ringkas. Data `PLANS/INCLUDED/ROWS` di blok plan-compare
  kairo-app.js harus sesuai `FEATURE_MIN_PLAN` (jangan tulis fitur yang belum ada). Nilai
  terpilih tetap di `#kairo-selected-plan`. Tabel compare lama & latar gelap sudah dihapus.
- **Autofill Orders di HP:** dulu menu muncul di luar layar (transform sisa animasi `sectionIn`
  + `top` desktop). Fix: `animation-fill-mode:backwards` untuk section aktif. Menu Manual/Autofill di HP
  sekarang dropdown tepat di bawah tombol seperti desktop (bukan sheet `position:fixed` di atas
  bottom nav — owner lapor tidak bisa ganti ke Autofill di HP; dugaan Safari). Tombol yang terkunci paket pakai `aria-disabled`, bukan `disabled`
  (tombol disabled menelan klik → pesan "tersedia di paket Pro" tidak muncul).
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
  Refresh & Export pakai ikon SVG (`.kairo-btn-icon`; jangan glyph ⬇ — iOS jadi emoji).
  Mobile: filter tanggal 4 kolom + Refresh/Export 2 kolom, semua tinggi 42px.
- **Refresh:** `kairoManualRefresh(btn)` (kairo-app.js) = reset masters + `refreshAll()` +
  event `kairo:refreshed` + toast "Data diperbarui", ikon berputar. **Jangan** `location.reload()`:
  `persistSession:false` → reload = logout. Promo ikut lewat `loadPageData('promo')`
  (`window.kairoRenderPromos`).
- **Bottom nav mobile (semua template):** Dashboard · History · Orders (tombol tengah besar,
  `kairo-mobile-orders-main` + `data-mobile-tab="input"`, dipakai loader seller) · Notifikasi ·
  More (Performance, Customer Database, Promo, Withdraw, Petty Cash, Settings). History = halaman
  Dashboard dengan `body.kairo-mobile-history` (CSS hanya tampilkan kartu riwayat; riwayat
  disembunyikan dari Dashboard mobile). Notifikasi mobile = sheet `#kairo-mobile-notif-sheet`,
  isi/dot/seen dari `window.kairoNotifications` (kairo-v3.js), sama dengan lonceng desktop.
  Sheet "Tambah" (quick actions) sudah dihapus.
- **Dashboard:** "Halo, {display_name}!" (`window.kairoDisplayName`), jam real-time,
  quick access sudah dihapus.
- **Kartu statistik Dashboard (compact):** ikon kiri + label & angka bertumpuk, tanpa
  caption di bawah angka (owner: biar clean). 4 kolom ≥1241px, 2 kolom di bawahnya;
  ≤520px angka pakai lebar penuh kartu supaya tidak patah. Kartu "Paket Terlaris"
  (`kpi-best`) sudah dihapus beserta hitungannya di `renderDashboard()`.
  Template seller (`body.seller-app-premium`, 5 kartu + Profit): desktop 3 atas + 2
  lebar bawah (grid 6 kolom), ≤1240px 2 kolom dengan kartu ganjil terakhir selebar penuh.
  Tes seller: `bootApp(b,{template:'seller', seed:require('./seed-seller.js')})`.
- **Seller App Premium (owner Okt 2026):** template dimuat begitu user login (MutationObserver class `authenticated` di loader
  kairo-app.js; dulu baru saat Orders diklik -> kartu Akan Expired tidak muncul di awal). **Piutang dihapus total** (kartu, field DP,
  Tandai Lunas, info di riwayat/struk). Menu **Tracker Langganan** (`section#subscriptions`, tombol sidebar setelah Orders + item More,
  dibuat seller JS): 1 baris per pelanggan+produk+plan (perpanjangan menggantikan), filter ≤7 hari/Aktif/Expired/Semua, cari, WhatsApp
  (dari `tx.whatsapp`), Perpanjang -> Orders dengan nama terisi. Lonceng seller = `window.kairoSellerNotifications` (expired ≤3 hari s/d
  lewat 7 hari + order Baru/Diproses ≥5 mnt, merah ≥30 mnt/expired); judul panel "Pengingat", tanpa "Start Reading".
- **Tema workspace (owner Okt 2026):** Lavender / Kayu / Awan / Mawar (id tetap girlie/wood/cloudy/pinky;
  nama lama dari referensi owner diganti Okt 2026), **semua template usaha** + Pro (`workspace_theme:'pro'`; dulu seller saja,
  dibuka untuk semua Okt 2026). Lapisan tampilan saja: `html[data-ws-theme]`, semua token tema di `assets/kairo-themes.css`
  (dimuat index.html, selector `body.authenticated` = kekuatan sama dengan `body.seller-app-premium` dulu; loader seller menyisipkan
  CSS seller SEBELUM `#kairo-themes-css` supaya tema tetap menang) dan diturunkan dari `--v3-primary/--v3-accent` (warna workspace) lewat `color-mix`, jadi warna yang diubah
  user ikut ke sidebar/kartu/ornamen. `WORKSPACE_THEMES` (kairo-app.js) = warna bawaan tiap tema; bila warna tersimpan masih bawaan lama
  (#696F41/#EA97A9) warna tema yang dipakai. Disimpan di `workspace_branding.theme` (SQL `.claude/sql/2026-10-workspace-theme.sql`,
  **sudah dijalankan owner Okt 2026**) + cache `kairo_ws_theme_v1` per workspace. Settings › Identitas: kartu "Tema Workspace" (`#kairo-theme-picker`,
  klik = pratinjau langsung, Simpan Pengaturan = simpan); tombol Reset warna kembali ke warna tema (bukan teal KAIRO). Anti-kedip: loader
  seller memberi `html.kairo-template-pending` (app disembunyikan + spinner) sampai event `kairo:seller-mounted` (failsafe 5 dtk).
  Mode gelap tiap tema punya token sendiri. **Ikon per tema (owner Okt 2026):** `assets/kairo-themes.js` (`SETS`, `SLOTS`)
  mengganti isi `<svg>` menu sidebar, bottom nav HP, menu More dan ikon kartu statistik Dashboard dengan bentuk khusus tema (class `kti`,
  ikon asli dipulihkan bila tema dilepas; dipicu MutationObserver `data-ws-theme` + DOM). Kelas di dalam ikon: `.b` isian lembut,
  `.k` aksen (hati/bintang), `.f/.n` isi penuh, `.p` pasak, `.ko/.kl` = potongan -> dijadikan `<mask>` (tembus ke latar apa pun).
  Kartu statistik: Omset=performance, Profit=profit, Transaksi=input(Orders), Saldo Kas=cash, Omzet Bulan Ini=subscriptions.
  Ikon judul kartu (`.title-svg-icon`) tetap set lama, hanya dicat per tema. Mockup sumber: scratchpad (bukan repo). Ornamen = 1 SVG
  mask kecil di kartu sapaan Dashboard (`#kairo-v3-dashboard-head::after`), disembunyikan ≤900px. Tidak menambah kartu/fitur.
  Tahap 2 (Setup Wizard) sudah dibuat, lihat poin berikut.
- **Setup Wizard (owner Okt 2026, tahap 2):** `assets/kairo-setup-wizard.js/.css`, dimuat lazy oleh `maybeStartSetupWizard()`
  (dipanggil sekali per login setelah `init()`) hanya bila paket efektif Pro, bukan Trine Magic, dan
  `workspace_branding.setup_state` belum `completed_at`. Kolom belum ada = wizard diam (aman). SQL `.claude/sql/2026-10-setup-wizard.sql`
  (**sudah dijalankan owner Okt 2026**, sukses)
  (kolom `setup_state` jsonb + Pro lama ditandai selesai + bucket Storage `workspace-branding` publik, maks 1 MB, policy owner per folder
  workspace). Semua template: seller = Tema&warna · Produk (pilih aplikasi, disimpan di setup_state.products, tidak memfilter Orders; tombol "Pilih
  semua" = semua yang tampil di filter; "Produk sendiri" = `kairoSellerCatalog.addCustom` -> `saveCustomSellerProduct()` yang sama dengan
  Settings › Tambah Produk, tersimpan permanen di `seller_product_settings`; produk tanpa file logo tampil ikon huruf awal) ·
  Harga&modal (`seller_product_settings` via `window.kairoSellerCatalog.saveMany`) · Kas&omzet · Struk · Logo; template lain = Tema&warna · Paket&harga
  (`package_masters`, termasuk `cost_price`) · Kas&omzet · Struk · Logo. Kas&omzet = versi pembagian baru mulai sekarang (sama dengan
  Settings; partner lama yang tidak dipilih tetap aktif 0%, Kas mati = `cash_off` + `cash_enabled=false`; Kas 0% ditampilkan "mati").
  "Nanti saja"/tutup = `dismissed_at`, lalu banner `#kairo-setup-banner` (di bawah `#kairo-upgrade-hint`) di 3 login berikutnya
  (`banner_logins`), setelah itu hilang. Jembatan ke kode lama: `window.kairoThemeSetup`, `kairoReceiptSetup` (saveLayout({quiet:true})),
  `kairoLogoSetup`. **Logo dikompres otomatis** (juga crop di Settings): WebP 384px turun kualitas/ukuran sampai <=60 KB, fallback PNG 256
  bila browser tidak bisa WebP; file `<workspace>/logo.webp` (logo.png lama dihapus). Dialog wizard selalu solid (tema Cloudy surface-nya
  transparan). Buka ulang: Settings › Identitas Workspace › "Panduan setup toko" (`#kairo-setup-entry`, Pro, `syncSetupEntry()`),
  membaca setup_state tersimpan jadi status selesai tidak hilang.
- **Layout konsisten (owner Okt 2026):** semua judul kartu satu gaya (sans 15,5px/800; Wood memakai serif), subjudul kartu sans tidak
  miring, toolbar di dalam kartu tanpa padding atas (dulu judul turun 22px), Performance 2 kolom 1,6:1 dan kartu sendirian selebar penuh,
  Settings kolom kanan rata atas/bawah, Promo 2 kolom sama lebar, angka Petty Cash/Customer tidak patah, panel pesanan seller selebar form
  dengan kategori 5 kolom rata, Ringkasan Pesanan selebar form. Judul halaman Promo & Tracker Langganan dulu tertulis "Orders".
- **Ukuran Teks (owner Okt 2026):** Settings › Workspace & Branding, slider 4 level (Kecil 0,9 / Normal 1 / Besar 1,1 / Ekstra 1,2),
  per perangkat (`kairo_font_scale_v1`), hanya saat login (`html[data-kfs]` + `--kfs`). kairo-v3.js menyalin SETIAP aturan CSS yang punya
  font-size jadi `html[data-kfs] <selector>{font-size:calc(<asli> * var(--kfs))}` (sheet `#kairo-font-scale`, dibuat ulang saat CSS baru
  dimuat; em/% dilewati) -> hanya huruf yang membesar, lebar/padding/grid tetap. Grafik: `chartFontSize()`. Pengecualian/batas: angka 1 baris
  kartu Petty Cash/Customer maks 1,1; label sidebar maks 1,1 + boleh 2 baris; label slider tetap 12,5px. Penyesuaian Harga (Orders) kolomnya
  `min-width:0` (dulu bikin halaman HP melebar). Aturan baru dengan font-size di CSS otomatis ikut; nilai yang mengandung `kfs` tidak disalin.
  Tes: scratchpad `fs/fs.js` (geometri kartu/tabel 100% vs 120% + overflow).
- **Panduan (owner Okt 2026):** tombol ikon buku `#kairo-guide-btn` di samping lonceng (desktop, `mountGuideButton()` kairo-v3.js) + item
  "Panduan" `#kairo-guide-more-item` di menu More HP (`buildMore()`). Isi `assets/kairo-guide.js` (teks statis, menyesuaikan template seller/dasar
  & paket; bagian halaman aktif terbuka otomatis; cari; "Buka <menu>" meng-klik tombol sidebar yang sama - Tracker Langganan hanya terisi lewat
  menunya). Tiap bagian punya contoh tampilan `assets/guide/{base,seller}-{tab}.webp` (data "Toko Demo", dibuat ulang `.claude/testing/shoot-guide.js`,
  lazy di dalam `<details>`, pencet = perbesar). Jangan klaim fitur yang belum ada; tandai Pro sesuai `FEATURE_MIN_PLAN`.
- **Alur penjualan Pro (owner Okt 2026, manual):** daftar di landing (paket + durasi) -> pesan WA konfirmasi -> transfer -> admin › Perlu Perhatian
  "Daftar Pro, pembayaran belum dicatat" -> Catat Penjualan / Simpan Subscription -> Pro aktif sampai tanggal berakhir. Dashboard: kartu
  `#kairo-upgrade-hint` punya 3 mode (`data-sub-state` di `<html>` dari `loadWorkspaceSaasContext()`): Gratis = ajakan upgrade (X 7 hari);
  `renew` = Pro tinggal <=7 hari, "Paket Pro berakhir <tgl>" (X sampai besok, `kairo_renew_hint_hidden_until_v1_<ws>`); `lapsed` = Pro habis.
  Tombol -> `kairoRequestUpgrade()` = WA berisi username dashboard, nama workspace, pilihan durasi. Paket hanya bisa diubah fungsi admin
  (SQL secure-login mencabut izin tulis `workspace_subscriptions`/`saas_plan_entitlements` dari browser).
- **Keamanan (audit Okt 2026):** XSS dinamis (semua field teks diisi `<img onerror>` di semua halaman dasar/seller/admin, desktop & HP) = 0 tereksekusi.
  CSP `<meta>` di index.html & admin (script hanya self + cdn.jsdelivr, connect hanya project Supabase; img `https:` karena logo bisa URL luar) -
  **tambah domain baru ke CSP bila memakai layanan luar**. Anti-iframe (clickjacking) di awal kairo-v3.js & admin.js. Login username:
  `kairo_login_email(username,password)` hanya memberi email bila password benar + batas 8 gagal/username & 40/IP per 15 mnt
  (SQL `.claude/sql/2026-10-secure-login.sql`, **sudah dijalankan owner Okt 2026**, 3 cek ok; `get_login_email` tertutup untuk browser).
  Hasil audit DB (Okt 2026): semua tabel public sudah RLS; temuan = fungsi `platform_admin_*`/`update_my_username` bisa dipanggil anon,
  tabel `platform_*` punya izin tulis bawaan untuk anon/authenticated (masih tertahan RLS), policy `seller_product_settings` roles=public ->
  ditutup lewat `.claude/sql/2026-10-security-hardening.sql` (**sudah dijalankan owner Okt 2026**, 3 cek ok). Baris "PERIKSA" untuk
  `platform_admin_delete_preview/_delete_workspace` = alarm palsu: keduanya memanggil `kairo_delete_guard()` yang mengecek `is_platform_admin()`. Yang memang disengaja: `kairo_login_email` &
  `is_username_available` untuk anon, bucket `workspace-branding` publik (1 MB, gambar saja), `saas_plan_entitlements` dibaca semua user login,
  fungsi trigger (tidak bisa dipanggil lewat RPC).
  `isTrineMagicWorkspace()` hanya lewat ID (dulu nama "Trine Magic" = Pro selamanya). Audit DB hanya-baca: `.claude/sql/2026-10-security-audit.sql`.
- **Warna layout:** `kairo-v3.js` memetakan `--brand-primary/--brand-accent` ke token
  v3. Default lama `#696F41/#EA97A9` = "belum diatur" (tetap tampilan KAIRO).
  Reset = `#25B9B0` / `#173A59`.
- **Living Origami (latar app):** gradient + origami terbang (kairo.css + `mountOrigami()` di
  kairo-app.js) dinyalakan lagi di v3 (dulu `display:none` sejak upload 20–21 Sep). Warna ikut
  `--v3-primary`/`--v3-accent` (token baru, diisi `syncLayoutColors()` dari warna aksen
  workspace; default navy), dicampur ±30–45% dengan warna canvas biar soft (owner). Opacity 0,5
  (dark 0,4; HP 0,4/0,32), gradient blob 8–14%, skala 0,55–1, tanpa
  drop-shadow, 9/6/4 burung (desktop/lite/HP kecil). Jalur terbang pakai Web Animations API
  (`d._drift`) dengan transform pasti — **jangan** kembali ke keyframes ber-`var()` (memaksa
  recalc style tiap frame). Pause saat tab tersembunyi; diam bila prefers-reduced-motion.
  Biaya terukur: +0,3% CPU desktop, +0,9% CPU HP (CPU 4× lambat). Kartu tembus pandang sudah
  dicoba & ditolak (kontras light turun).
- **Pop-up alert (`showToast`)**: latar diwarnai tipis sesuai jenis (`--toast-tone`, 9% light / 16% dark) + garis aksen kiri 4px supaya beda dari kartu menu (owner Okt 2026; admin sama). Tumpukan kartu di kanan atas, `position:fixed` (ikut layar saat
  scroll), tepat di bawah header desktop yang sticky (`--kairo-toast-top` dihitung tiap muncul;
  HP 16px). Ikon + judul per jenis (Berhasil/Info/Perhatian/Gagal), pesan, tombol X; maks 4,
  semua hilang sendiri dalam **5 dtk** (owner), jeda saat hover/fokus. Signature lama tetap:
  `showToast(msg, error)`; `error` boleh juga 'success'|'info'|'warning'|'error'. Pesan kunci paket
  (`tersedia mulai/di/untuk paket`, `Upgrade ke paket`) yang dikirim sebagai error otomatis jadi warning. Gaya lama
  `.toast` di kairo.css sudah dihapus; elemen `#toast` = wadah `.kairo-toast-stack`.
- **Notifikasi** (lonceng di samping dark mode): order On Progress ≥5 menit, ≥30 menit merah. **Tanpa batas
  waktu** (owner Okt 2026): tetap tampil sampai order dicentang selesai; titik merah (berdenyut, `.is-urgent`) tidak
  hilang selama ada order ≥30 menit walau daftar sudah dibuka. ≥24 jam ditulis "X hari Y jam".
  Seen (untuk order <30 menit): `kairo_notif_seen_v1_<workspace>`.
- **Dark mode:** sudah diaudit 0 temuan kontras (juga template seller: menu, keranjang Orders,
  Settings › Produk, dialog riwayat customer, hover); transisi tema pakai View Transitions.
  Warna status seller di dark (badge expired/H-x/Aktif, "Sisa Rp…", Tersinkron) di-override
  di `kairo-v3.css`; tombol teal seller pakai teks `--v3-on-primary` seperti `.btn-green`.
- **Performance:** semua mengikuti filter tanggal utama (`getRange()`). Redesign Okt 2026 (owner setuju 5 poin): kartu judul
  "Performance" diganti baris ringkasan `#perf-kpis` (Omzet, Transaksi, Rata-rata per order, Produk terlaris; `renderPerformanceKpis`);
  Penjualan Harian = batang mulai Rp0, tiap hari terisi (0 bila kosong), label "6 Sep", >92 hari digabung per bulan (`dailySalesSeries`);
  Paket & Topik = batang horizontal 5 teratas + "Lainnya" dengan angka & persen (`chartRankBars`, plugin `chartBarValues`);
  Bulan ini vs bulan lalu = tanggal yang sama (1–5 Okt vs 1–5 Sep); warna dari `chartBrandColors()` = `--v3-primary` (periode ini) &
  `--v3-accent` (pembanding, dicerahkan di dark), satu warna per seri; grafik digambar ulang saat ganti tema. Gratis tetap hanya
  ringkasan + Penjualan per Produk + tabel harian v83.
- **Petty Cash › Riwayat Pengeluaran & Riwayat Pemasukan:** satu filter tanggal bersama
  (`cashHistoryFilter`; dropdown `[data-cash-filter]` di atas tiap tabel, selalu sinkron, termasuk
  tanggal `[data-cash-from]/[data-cash-to]`): Semua, Hari ini, Kemarin, 7 hari, Bulan ini, Bulan
  lalu, Pilih tanggal + ringkasan "N catatan · Total". `renderCashHistories()` membaca
  `allCashExpenses()/allCashInjections()`, tidak ikut filter Dashboard (tersembunyi di halaman
  ini). `cashExpenses/cashInjections` tetap ikut periode karena dipakai Export Excel.
- **Dark mode `.history-filter-date`** (Riwayat Transaksi & Petty Cash) di-override di v3 —
  dulu latar putih + teks terang (kontras 1,1).
- **Orders:** setelah simpan berhasil, form kosong total termasuk Platform & Metode
  Pembayaran (owner: user wajib pilih ulang tiap order). `tx-payment` punya opsi
  kosong "-- Pilih Metode Pembayaran --" + `required`, jadi tidak jatuh ke QRIS.
- **Orders — saran nama customer:** `renderCustomerMatches()` membaca `customerDirectory`, yang
  sekarang dimuat juga di `loadPageData('input')` (dulu cuma di halaman Customers → di Orders
  kosong, saran tidak muncul; paket Gratis tidak pernah dapat).
- **Orders — data wajib terlewat:** `invalid` (capture) di `#tx-form` → scroll ke field pertama,
  fokus, getar `.kairo-field-shake` + outline merah `.kairo-field-missing` (hilang saat diisi), toast
  kuning "Lengkapi dulu: …" (menggantikan yang lama, bukan menumpuk). Package/Topik kosong dicek
  lewat `calculateTotal()` sebelum handler app (kairo-v3.js). Juga jalan di template seller.
- **Kontras light mode (owner Okt 2026):** blok di akhir `kairo-v3.css` (`body:not(.saas-dark)`): `--muted #526175`,
  `--v3-muted #4e6475`, `--danger/--btn-danger #a3384a`, tombol `.btn-gold` (Export Excel) digelapkan, teks pill/badge
  & menu aktif = warna brand dicampur gelap (brand tetap dipakai), placeholder select, bottom nav HP (label 6,3+), plus
  template seller (status, "Lihat Semua", total keranjang). Audit light & dark, dasar & seller: 0 temuan.
- **Dark mode hover tabel:** sorotan gelap solid (`--v3-sky`) — jangan biarkan
  `tr:hover` dari `kairo.css` (latar hampir putih) tembus.

---

- **Akses workspace (owner Okt 2026): 1 workspace = 1 akun owner.** Tidak ada role admin/staff lagi.
  `loadActiveWorkspaceForUser()` hanya memakai keanggotaan `role='owner'`; akun lain ditolak dengan
  pesan "Workspace hanya bisa dibuka dengan akun pemiliknya…" lalu sign out. Semua cek/tampilan role
  (pill OWNER, "Role Kamu", catatan Staff, `requireWorkspaceRole`, `isWorkspaceAdmin`) sudah dihapus.
  Tim yang ikut mencatat memakai akun owner (FAQ 05). SQL sisi DB: `.claude/sql/2026-10-owner-only-workspaces.sql`
  (**sudah dijalankan owner Okt 2026**: anggota non-owner dihapus + constraint `workspace_members_owner_only`).
- **Ajakan upgrade (Gratis):** `#kairo-upgrade-hint` di Dashboard di bawah kartu statistik (menggantikan
  carousel paket lama yang tersembunyi). Tombol → `window.kairoRequestUpgrade()` (WhatsApp bila
  `WA_BUSINESS` diisi, kalau belum: toast info). X = sembunyi 7 hari per workspace
  (`kairo_upgrade_hint_hidden_until_v1_<workspace>`). Kartu header "Siap melangkah lebih jauh?/Paket Pro
  aktif" (`kairo-basic-header-upgrade-v83`) dan kembarannya di HP (`#kairo-mobile-plan-card`) sudah
  dihapus (owner) — banner ini satu-satunya ajakan upgrade.
- **Sidebar** membuat tombol menunya sendiri di `buildSidebar()` (header lama "TRINE MAGIC" + tab bar
  `.v19-nav`, tombol `#saas-settings-btn`, info paket sidebar `.saas-side-meta`, kotak
  `#kairo-basic-upgrade` sudah dihapus). Settings = `#saas-settings-side-btn` → `openWorkspaceSettings()`.
- **`#settings-category-select` (tersembunyi) JANGAN dihapus:** dia "mesin" perpindahan kategori
  Settings (submenu sidebar, template seller, kunci paket semua lewat `change` di select ini).
- Dibersihkan Okt 2026: CSS/JS layar login & daftar lama (`#auth-screen`, `.auth-card`, form
  `#signup-form`), carousel paket, `kairo-runtime.js`, file sampah `app-logos/.../a`.
- **Tombol "KAIRO Admin"** (`ensureKairoAppSwitcher()`): hanya di workspace Trine Magic
  (`TRINE_MAGIC_WORKSPACE_ID`, atau nama "Trine Magic" + `is_platform_admin`). Desktop: di bawah
  Settings di sidebar (`#kairo-app-switcher`); HP: menu More (`#kairo-admin-more-item`). Klik → buka `admin/`
  di tab baru (langsung, supaya tidak diblokir pop-up blocker Safari).
- **Admin panel (`admin/`)**: `index.html` + `admin.css` + `admin.js` (tanpa build). Gaya diadaptasi dari template
  Light Blue (flatlogic) dengan palet KAIRO, dark saja: sidebar bergrup (drawer di HP), topbar (cari workspace,
  refresh, keluar), widget kaca. Logika & RPC `platform_admin_*` sama persis dengan admin lama di repo
  `trinemagic/trine-magic-dashboard/admin` (yang lama tidak diubah). Tombol keluar = tutup tab admin. Paket tampil Gratis/Pro
  (`plus` dll dihitung Pro; pilihan paket di modal hanya basic/pro; harga `plus` disembunyikan). Tabel jadi kartu di
  ≤640px (label kolom otomatis dari `thead`, `labelCells()`). Tes: stub `window.supabase` + data contoh di
  scratchpad (route `**/supabase-js@2*` dan `**/chart.umd.min.js`). Cache: lihat bagian 2.
  **Buat Akun (owner Okt 2026):** tombol di Workspaces → modal `#accountModal`: akun dibuat lewat `auth.signUp` + metadata yang sama
  dengan form daftar landing (workspace dibuat database), memakai klien Supabase TERPISAH (`storageKey` sendiri, tanpa simpan sesi) supaya
  sesi admin tidak tersentuh; `requested_plan:'basic'`. Pro = `platform_admin_update_subscription` langsung (tanpa catatan penjualan).
  Password acak bisa dibuat, info login tampil sekali + tombol Salin. Log Aktivitas "Buat akun". Cocok untuk akun tes (hapus lewat modal
  Workspace > Hapus). **Okt 2026: `platform_admin_update_subscription` ternyata tidak ada di DB asli** (Simpan Subscription & Pro di
  Buat Akun gagal) -> `.claude/sql/2026-10-admin-update-subscription.sql` (deteksi kolom tanggal berakhir otomatis + query cek fungsi
  admin lain yang belum ada). **Sudah dijalankan owner Okt 2026**, sukses. Query cek menemukan 1 lagi: `platform_admin_update_workspace_status`
  (Aktifkan/Suspend/Arsipkan) -> `.claude/sql/2026-10-admin-workspace-status.sql` (menolak Trine Magic & workspace akun sendiri). **Sudah dijalankan owner Okt 2026**, sukses. Semua fungsi admin kini lengkap. **Log Aktivitas (Okt 2026):** fungsi `platform_admin_activity` tidak pernah ada di DB asli -> dibuat lewat `.claude/sql/2026-10-admin-activity-log.sql` (tabel `platform_admin_activity_log` tanpa FK, RLS tanpa policy, maks 5000 baris; `platform_admin_log_activity`). admin.js membungkus `db.rpc`: aksi di `LOG_ACTIONS` yang sukses otomatis dicatat (nama workspace diambil sebelum aksi). Pop-up admin (`toast(msg, true|'success'|'info'|'warning'|'error')`) = gaya dashboard: kartu bertumpuk kanan atas di bawah topbar, ikon+judul, X, 5 dtk, jeda saat hover. "Sebagian data gagal dimuat" kuning + menyebut fungsi & pesan error DB (juga di console). Modal Workspace membaca baris dari daftar (`all`), bukan RPC `platform_admin_workspace_detail` (tidak ada di DB asli).
  **Akses (owner Okt 2026): tanpa form login.** admin/ hanya jalan bila dibuka dari tombol KAIRO Admin di dashboard
  Trine Magic: `openKairoAdmin()` membuka tab (tanpa `noopener`), admin minta token lewat `postMessage`
  (`kairo-admin-token-request` → `kairo-admin-token`, cek origin + window yang dibuka), dashboard hanya menjawab bila
  `activePlatformAdmin && isKairoAdminWorkspace()`. Admin memakai opsi supabase-js `accessToken` (tidak pegang refresh
  token → tidak bentrok rotasi sesi dashboard). Buka langsung / dashboard logout → layar terkunci. Kode tetap terlihat di
  repo publik (tidak ada rahasia di dalamnya); data dilindungi `is_platform_admin` di setiap fungsi SQL.
  Menu v2: **Perlu Perhatian** (deteksi otomatis di `computeIssues()`: telat bayar, Pro habis/hampir habis tanpa
  follow-up, belum pernah transaksi >3 hari, tidak ada transaksi 14+ hari, daftar Custom belum dicatat, pending >3 hari,
  error aplikasi user, kapasitas server), **Request Custom** (papan Pending/On progress/Success + checklist per poin;
  status request dihitung SQL dari poinnya), **Kapasitas Server** (ukuran DB vs batas paket — pilihan batas disimpan
  `kairo_admin_db_limit_mb` di localStorage, koneksi, cache hit, waktu respons, tabel terbesar; CPU/RAM/bandwidth hanya
  di laporan Supabase). SQL: `.claude/sql/2026-10-admin-panel-v2.sql` (**sudah dijalankan owner Okt 2026**, sukses).
  **Durasi Pro saat daftar** (`requestedPro()`): tabel Workspaces menulis "Daftar Pro 6 bulan" di bawah badge Gratis, Perlu
  Perhatian "Daftar Pro, pembayaran belum dicatat" (tombol Catat = Catat Penjualan terisi Pro + durasi + nominal). Butuh SQL
  `.claude/sql/2026-10-admin-requested-period.sql` (**sudah dijalankan owner Okt 2026**).
  **Hapus akun & workspace (owner Okt 2026):** modal Workspace > "Hapus..." > layar peringatan (isi yang akan hilang dari
  `platform_admin_delete_preview`, akun login ikut terhapus), ketik username owner/slug/nama, tombol aktif setelah 5 detik + confirm()
  terakhir > `platform_admin_delete_workspace(id, ketikan)`. SQL `.claude/sql/2026-10-admin-delete-workspace.sql` (**sudah dijalankan owner Okt 2026**): semua tabel public
  ber-`workspace_id` + tabel anak via foreign key, diulang per putaran; atomik (gagal = tidak ada yang terhapus); server cek ulang
  ketikan; menolak Trine Magic, workspace milik platform admin (`platform_admins`), dan workspace akun yang login. Owner auth user dihapus
  bila tidak punya workspace lain (kalau Supabase menolak: pesan "hapus manual di Authentication"). Catatan penjualan admin untuk
  workspace itu ikut terhapus (terlihat di daftar peringatan).
  SQL panjang: kirim sebagai file + link raw GitHub, bukan blok kode di chat (owner: tampilan chat pecah).
- **Perlu Perhatian: checkbox "sudah di-fix"** (per browser, `kairo_admin_resolved_v1`): masalah hilang dari daftar & hitungan,
  muncul lagi bila sidik jari berubah (error: last_seen; lainnya: since/valid_until/detail).
- **Admin › Template (owner Okt 2026):** daftar template usaha dari form daftar (`TEMPLATES` di admin.js — **perbarui
  bila ada template baru**): Seller App Premium (`digital_subscription`, tampilan khusus), Jasa Online
  (`service_consultation`, tampilan dasar), Online Shop (istilah toko, lihat poin berikut) & Digital Product (belum ada tampilan khusus → user melihat
  tampilan Jasa Online). Jumlah workspace/Pro/aktif per template dari `business_template` di
  `platform_admin_workspace_activity` (SQL `.claude/sql/2026-10-admin-templates.sql`, **sudah dijalankan owner Okt 2026**). Preview dashboard
  `admin/previews/*.webp` dibuat ulang dengan `.claude/testing/shoot-templates.js`. Cache admin: lihat di atas.
- **Laporan error user** (kairo-app.js, di atas `showToast`): `reportClientError()` mengirim pesan error script
  (file sendiri saja) + toast merah "Gagal" (bukan pesan kunci paket) ke RPC `report_client_error` beserta
  baris/kolom, stack trace (toast: stack pemanggil `showToast`) dan versi `kairo-app.js?v=`; maks 10/sesi, tanpa data
  form. Sebelum SQL v2 dijalankan, panggilan gagal diam-diam.
- **Salin untuk dianalisa (owner Okt 2026):** di admin › Perlu Perhatian, masalah **Tinggi selain subscription/pembayaran**
  (error aplikasi, server) punya tombol **Salin**, plus "Salin semua yang urgent"; tiap baris tabel error juga.
  Teksnya (`errorReport()`/`serverReport()`) = pesan, lokasi file:baris:kolom, halaman, versi app, jumlah kejadian,
  workspace, browser, stack trace. Owner menempelkannya ke chat → cari baris itu di versi `kairo-app.js` yang
  disebut (cek `git log` untuk versi tersebut bila sudah berubah).

- **WhatsApp bisnis (owner Okt 2026, sementara):** `WA_BUSINESS='6287794545507'` (0877-9454-5507) di kairo-app.js,
  juga diisi ke `window.__KAIRO_BUSINESS_WA` untuk tombol konfirmasi setelah daftar.
  Tombol sidebar "Ada masukan/keluhan? Tell us" membuka WA dengan `feedbackMessage()` (owner Okt 2026): ditulis dari sisi
  user ("Halo admin Kairo Workspaces! ..."), Nama Pengguna Dashboard (`window.kairoUsername`, diisi saat login) & Nama
  Workspaces terisi otomatis, user tinggal isi Keluhan/Masukan; sebelum penutup ada pengingat "Sertakan bukti screenshot
  halaman/notifikasi error di dashboard kalau ada".
  Di HP (tombol sidebar disembunyikan ≤900px) ada item **"Masukan / Keluhan"** di menu More (`#kairo-feedback-more-item`,
  dibuat di `buildMore()`), memanggil `window.kairoOpenFeedback()` yang sama.
- Repo lama `trinemagic/trine-magic-dashboard` sudah dijadikan **private** oleh owner (Okt 2026) - website lamanya offline.
- **Backup + keep-alive Supabase (owner Okt 2026: belum mau upgrade Pro):** `.claude/backup/backup.yml` + README.
  Dipasang owner di repo PRIVATE terpisah (secrets: SUPABASE_DB_URL session pooler, BACKUP_PASSPHRASE, SUPABASE_URL,
  SUPABASE_ANON_KEY). Harian 7 hari / mingguan 35 hari / bulanan 90 hari (semua artifact; owner Okt 2026: tidak ada yang permanen supaya
  permintaan hapus data terpenuhi - Kebijakan Privasi menyebut 90 hari), terenkripsi
  gpg AES-256. Keep-alive memanggil RPC `is_username_available` - jangan hapus/ubah fungsi itu tanpa update workflow.
  **Terpasang Okt 2026** di repo private `trinemagic/kairo-backups` (4 secrets diisi owner); run pertama 4 Okt 2026 sukses
  (data.sql ±540 KB, file terkunci ±116 KB). Status run bisa dicek via actions_list repo itu.

- **Kolom nominal Rupiah (owner Okt 2026):** Tip & Penyesuaian Harga (mode Nominal) di Orders, `payout-amount`, `cash-expense-amount`,
  `cash-injection-amount` tampil "Rp150.000" saat mengetik (blok terakhir kairo-v3.js). Elemennya tetap sama: properti `value` di-override
  per elemen -> mengembalikan angka murni, jadi `Number(el.value)`/reset/template seller tidak berubah. `type` jadi text (min/max dicek JS).
  Mode Persentase tidak diformat (koma desimal diterima). Kolom nominal baru: tambahkan id-nya ke `IDS`.
- **Daftar akun (Okt 2026):** `submitSignup` memakai klien Supabase terpisah (`signupClient()`, tanpa simpan sesi) untuk signUp + login tes;
  dulu login tes di klien utama memicu `handleAuthSession` yang selesai SETELAH logout -> dashboard setengah terbuka tanpa sesi.
  `handleAuthSession` kini mengabaikan hasil panggilan yang bukan terakhir (`authSessionSeq`). "Kembali ke Masuk" = `backToLogin()`:
  tutup halaman Daftar + buka form Masuk (`window.kairoOpenLogin`, kairo-v3.js) dengan username terisi.
- **Loader template** (kairo-app.js, `maybeBootSellerTemplate`) mengecek template SEKALI per login (`templateChecked`, reset saat logout);
  dulu diulang tiap class `<body>` berubah (spinner sekejap + pratinjau tema dibatalkan). Cat awal tema hanya bila belum ada tema terpasang.

- **Template Online Shop (owner Okt 2026, produk fisik):** kerangka tampilan dasar + istilah toko. Loader template (`maybeBootSellerTemplate`)
  memberi `html[data-business-template=online_shop]` + event `kairo:template-ready`. Istilah: Start Reading -> **Waktu Order**, Paket/Package -> **Produk**,
  Topik -> **Kategori** (default `defaultTopicLabel()`; user tetap bisa mengganti di Settings, `__topic_label`). Kode: helper `isShopWorkspace()/startLabel()`
  (kairo-app.js: detail, struk default, toast), lapisan teks statis di akhir kairo-v3.js (tabel riwayat, form Orders, Performance, Customers, notifikasi),
  Setup Wizard (Produk & harga). Belum diganti: Settings "Package & Harga" (dicari lewat teks di beberapa fungsi), opsi Platform Media Sosial.
  Tes: `bootApp(b,{template:'shop'})` (mock `window.__mockSession` -> lewat loader asli).
  **Analitik toko (owner Okt 2026):** `assets/templates/online-shop.js/.css` (`?v=1.1.0`, dimuat loader HANYA untuk online_shop; owner: tampilan harus bersih, tanpa kalimat insight/legenda panjang - tabel + angka standar saja). Dashboard: kartu **Profit** (laba kotor
  = total - HPP, ikut filter periode, id `shop-kpi-profit`, grid 3+2 seperti seller). Performance (setelah Penjualan per Produk): **Laba per Produk** (3 angka ringkas + tabel omzet/laba/margin/kontribusi laba + kelas **ABC** Pareto 80/15/5, min. 3 produk),
  **Performa Channel** (order, omzet, laba, margin, rata-rata/order, porsi omzet; sebelum komisi channel), **Batal & Retur** (tabel `order_returns`, SQL
  `.claude/sql/2026-10-online-shop-returns.sql` - **belum dijalankan owner**; tanpa tabel kartu tersembunyi). Hapus order di template ini membuka dialog Batal/Retur +
  alasan (`deleteCancelledTransaction(..., {skipConfirm:true})`). Channel Penjualan: daftar bisa diatur di Settings › Kategori (`receipt_labels.__platforms`, tanpa SQL),
  bawaan Shopee/Tokopedia/TikTok Shop/Lazada/WhatsApp/Instagram/Toko Offline/Lainnya; mengisi `#tx-platform`. Belum: stok (butuh SQL), biaya admin/komisi per channel.
  Tes: `seed-shop.js` + `bootApp(b,{template:'shop',seed:require('./seed-shop.js')})`.

## 4. Jebakan yang sudah pernah terjadi

- Teks `\n` literal di CSS membuat browser membuang satu blok `@media` utuh (pernah terjadi di
  kairo.css v20.10.82). Setelah edit CSS lewat skrip, cek `grep -c '\\n' assets/*.css` = 0.
- Membersihkan CSS lama: pakai pemindai aturan yang paham `@media` + komentar, lalu pastikan setiap
  aturan yang hilang memang menyebut class/ID yang sudah tidak ada di HTML/JS.

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
- Realtime Supabase (`startRealtimeSync`): `db.removeChannel()` memicu callback status `CLOSED` secara sinkron. Dulu
  callback itu memanggil `removeChannel` lagi -> berulang ribuan kali -> "Maximum call stack size exceeded" (laporan error
  Safari iPhone/Mac Okt 2026, saat koneksi putus/tab tidur). Sekarang: kosongkan `realtimeChannel` dulu, baru hapus; callback
  mengabaikan channel yang bukan `realtimeChannel` aktif. Jangan balik ke pola lama.
- Tombol yang mengganti `innerHTML`-nya sendiri saat diklik (mis. `.kpi-eye` lewat `updateKpiEyeButtons()`): saat event sampai ke
  `document` (bubble) target `<svg>` sudah lepas dari halaman -> `closest()` gagal. Pakai listener capture (`true`). Tes klik dengan
  koordinat/tap di ikon, bukan `el.click()` (yang targetnya tombol) - bug ikon mata Profit seller Okt 2026 lolos karena itu.
- Topik: tabel `topic_masters` mungkin tidak punya kolom `code`; simpan topik sudah
  retry tanpa `code`. Belum diverifikasi di DB asli.

---

- **Animasi tak berujung hanya boleh `transform`/`opacity`** (dijalankan GPU). Denyut titik notifikasi dulu `box-shadow`
  -> CPU menghitung ulang tiap frame selama ada order terlambat (~2-4% CPU terus). Sekarang lingkaran `::after` di belakang titik
  (`isolation:isolate` di tombol). Cek animasi baru dengan CDP `RecalcStyleCount` saat idle (harus ~0 selain jam Dashboard).
- **Link ke situs luar dari JS:** `window.open(url,'_blank','noopener')` (WhatsApp). Pengecualian: tab admin (butuh `opener` untuk
  serah token lewat `postMessage`).

## 5. Cara menguji

Sandbox memblokir CDN (jsdelivr, Google Fonts), Supabase, dan `github.io`. Uji
dengan Chromium + Playwright dan **mock Supabase** di `.claude/testing/`:

```bash
cd /home/user/kairo-ui-v2-review && python3 -m http.server 8123 &   # sajikan repo
cd .claude/testing && node example.js                                # lihat README
```

- Playwright: `/opt/node22/lib/node_modules/playwright`, Chromium sudah terpasang
  (jangan `playwright install`). Tidak ada WebKit → **Safari tidak bisa diuji**.
- Chart.js untuk halaman Performance: `npm pack chart.js@4.4.4` ke `.claude/testing/chartjs` (boot.js me-route `**/chart.js@*/**` ke
  `package/dist/chart.umd.js`; versi harus sama dengan SRI). boot.js membuang atribut SRI supabase di index.html supaya mock bisa dimuat.
- Template seller: `SELLER=1 node audit-contrast.js …` / `SELLER=1 node audit-hover.js`, plus
  `node audit-seller.js [dark|light]` (keranjang Orders, Settings › Produk, dialog customer, hover).
- `pixaudit.js` = audit kontras berbasis PIKSEL (`pixAudit(page, rootSel, skipSel, {viewport})`; `viewport:true` untuk dialog
  `position:fixed` — screenshot fullPage menggeser dialog — dan melewati teks yang ter-scroll/tertutup): membaca warna asli di belakang teks, jadi gradasi,
  kartu transparan, dan ornamen ikut terhitung. Pakai ini untuk tema seller. (Okt 2026: versi awal salah membaca `color(srgb 0-1)`.)
- `audit-contrast.js` = audit kontras WCAG per menu (dark/light);
  `audit-hover.js` = kontras baris tabel saat di-hover (dark);
  `test-order-form.js` = alur simpan penjualan Orders.
- `mockdb.js`: upsert menimpa baris sesuai `onConflict` (dulu menambah baris), ada tiruan Storage (`__db.storage`). Mock tidak punya
  `workspace_subscriptions`: tes yang memanggil `loadWorkspaceSaasContext()` (mis. simpan struk) harus seed baris Pro, kalau tidak paket
  jatuh ke Gratis. Seed `percentage` partner ditulis 40 (persen), DB asli pakai pecahan 0,4 — bagi 100 di tes pembagian.
- Uji desktop 1440 & mobile 390, light & dark, dan kirim screenshot ke owner.

---

- **Bersihkan CSS mati:** pindai class di CSS yang tidak muncul di HTML/JS (abaikan class rakitan `receipt-field-*`, `receipt-scene-*`,
  `receipt-template-*`, `is-*`), hapus selector-nya saja (rule ikut hilang bila semua selector mati), lalu bandingkan computed style
  SEMUA elemen versi baru vs `main` (git worktree di port lain) per halaman/paket/template/ukuran/tema. Okt 2026: 0 class mati tersisa.

## 6. Belum selesai / perlu dicek owner

- Semua perubahan belum diuji di **Safari** dan dengan **Supabase/login asli**.
- Penyebab "tidak bisa tambah topik" di DB asli belum terkonfirmasi.
- Performa (audit Okt 2026): idle di luar Dashboard 0 re-layout; di Dashboard 1×/detik (jam).
  Header Dashboard hanya ditulis ulang bila nama/workspace/tanggal berubah (dulu tiap
  perubahan class body); jam berhenti saat tidak terlihat; cek notifikasi dilewati saat tab
  tersembunyi. Ukur dengan CDP `Performance.getMetrics` (LayoutCount/TaskDuration).
