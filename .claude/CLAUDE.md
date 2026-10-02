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

**Cache key:** setiap mengubah file aset, naikkan `?v=` di `index.html`.
Versi terakhir: `kairo.css?v=20.10.156`, `kairo-v3.css?v=3.23.0`,
`kairo-v3.js?v=3.19.0`, `kairo-app.js?v=20.10.171`; template seller dimuat dari kairo-app.js
(`seller-app-premium.js?v=20.10.148`, `.css?v=20.10.150`) — naikkan juga bila file template diubah.

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
  `assets/og/kairo-og.jpg` (1200×630), URL absolut github.io (ganti bila pindah domain).
  Badge kuning kecil di atas judul section (`.kairo-lp-eyebrow`) sudah dihapus semua (owner) — jangan
  ditambah lagi. `#masuk` = langsung form login. Badge "kini hadir…" sudah dihapus (owner: jangan
  wording khas AI).
  Copy landing ditulis untuk pelanggan: **jangan** ada catatan internal/teknis (Supabase,
  tenant, auth, "belum final"). Pricing Gratis (Rp0) / Pro / Custom dengan daftar fitur; tombol
  Pro/Custom membuka form daftar dengan paket terpilih (`data-signup-plan` → `window.__kairoSignupPlan`).
  Harga Pro (owner Okt 2026): **Rp43.000/bulan**; paket 6 bulan harga normal Rp258.000 dicoret →
  **Rp238.000** (tanpa badge "Hemat" — owner) — tampil di Pricing landing, kartu Pro halaman Daftar, FAQ 03.
  Belum ada pilihan durasi saat daftar (dibahas via WA). Kontak WA, testimoni, S&K/Privasi masih
  menunggu data owner. FAQ 8 poin fokus fitur
  unggulan (tanpa poin dark mode — owner). Jangan klaim fitur yang belum ada (mis. "Owner Menu
  Lock" hanya baris tabel, belum ada fiturnya).
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
- **Pop-up alert (`showToast`)**: tumpukan kartu di kanan atas, `position:fixed` (ikut layar saat
  scroll), tepat di bawah header desktop yang sticky (`--kairo-toast-top` dihitung tiap muncul;
  HP 16px). Ikon + judul per jenis (Berhasil/Info/Perhatian/Gagal), pesan, tombol X; maks 4,
  semua hilang sendiri dalam **5 dtk** (owner), jeda saat hover/fokus. Signature lama tetap:
  `showToast(msg, error)`; `error` boleh juga 'success'|'info'|'warning'|'error'. Pesan kunci paket
  (`tersedia mulai/di/untuk paket`, `Upgrade ke paket`) yang dikirim sebagai error otomatis jadi warning. Gaya lama
  `.toast` di kairo.css sudah dihapus; elemen `#toast` = wadah `.kairo-toast-stack`.
- **Notifikasi** (lonceng di samping dark mode): order On Progress ≥5 menit
  (24 jam terakhir), ≥30 menit merah. Seen: `kairo_notif_seen_v1_<workspace>`.
- **Dark mode:** sudah diaudit 0 temuan kontras (juga template seller: menu, keranjang Orders,
  Settings › Produk, dialog riwayat customer, hover); transisi tema pakai View Transitions.
  Warna status seller di dark (badge expired/H-x/Aktif, "Sisa Rp…", Tersinkron) di-override
  di `kairo-v3.css`; tombol teal seller pakai teks `--v3-on-primary` seperti `.btn-green`.
- **Performance:** semua mengikuti filter tanggal utama (`getRange()`).
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
  scratchpad (route `**/supabase-js@2*` dan `**/chart.umd.min.js`). Cache `admin.css?v=1.3.0`, `admin.js?v=1.3.0`.
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
  SQL panjang: kirim sebagai file + link raw GitHub, bukan blok kode di chat (owner: tampilan chat pecah).
- **Admin › Template (owner Okt 2026):** daftar template usaha dari form daftar (`TEMPLATES` di admin.js — **perbarui
  bila ada template baru**): Seller App Premium (`digital_subscription`, tampilan khusus), Jasa Online
  (`service_consultation`, tampilan dasar), Online Shop & Digital Product (belum ada tampilan khusus → user melihat
  tampilan Jasa Online). Jumlah workspace/Pro/aktif per template dari `business_template` di
  `platform_admin_workspace_activity` (SQL `.claude/sql/2026-10-admin-templates.sql`). Preview dashboard
  `admin/previews/*.webp` dibuat ulang dengan `.claude/testing/shoot-templates.js`. Cache admin `?v=1.3.0`.
- **Laporan error user** (kairo-app.js, di atas `showToast`): `reportClientError()` mengirim pesan error script
  (file sendiri saja) + toast merah "Gagal" (bukan pesan kunci paket) ke RPC `report_client_error` beserta
  baris/kolom, stack trace (toast: stack pemanggil `showToast`) dan versi `kairo-app.js?v=`; maks 10/sesi, tanpa data
  form. Sebelum SQL v2 dijalankan, panggilan gagal diam-diam.
- **Salin untuk dianalisa (owner Okt 2026):** di admin › Perlu Perhatian, masalah **Tinggi selain subscription/pembayaran**
  (error aplikasi, server) punya tombol **Salin**, plus "Salin semua yang urgent"; tiap baris tabel error juga.
  Teksnya (`errorReport()`/`serverReport()`) = pesan, lokasi file:baris:kolom, halaman, versi app, jumlah kejadian,
  workspace, browser, stack trace. Owner menempelkannya ke chat → cari baris itu di versi `kairo-app.js` yang
  disebut (cek `git log` untuk versi tersebut bila sudah berubah).

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
- Template seller: `SELLER=1 node audit-contrast.js …` / `SELLER=1 node audit-hover.js`, plus
  `node audit-seller.js [dark|light]` (keranjang Orders, Settings › Produk, dialog customer, hover).
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
- Performa (audit Okt 2026): idle di luar Dashboard 0 re-layout; di Dashboard 1×/detik (jam).
  Header Dashboard hanya ditulis ulang bila nama/workspace/tanggal berubah (dulu tiap
  perubahan class body); jam berhenti saat tidak terlihat; cek notifikasi dilewati saat tab
  tersembunyi. Ukur dengan CDP `Performance.getMetrics` (LayoutCount/TaskDuration).
- Light mode bottom nav: label abu-abu 3,8 dan label aktif pink 2,0 (warna lama kairo.css) —
  belum diubah, ikut keputusan light mode.
- Kriteria notifikasi (24 jam, seen per perangkat) adalah keputusan Claude — owner
  boleh minta ubah.
