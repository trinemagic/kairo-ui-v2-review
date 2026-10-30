# Identitas visual Kairo: dua navy, satu turquoise

Identitas visual KAIRO Workspaces yang sudah ada berdiri di atas **dua lapisan warna yang tidak sama persis**. Lapisan pertama adalah kit logo resmi (navy `#1F305E`, gold `#E8B04B`, biru muda `#E8F5FC`). Lapisan kedua adalah token CSS landing/app (delft `#173a59`, turquoise `#25b9b0`, gold `#dfa94a`, off-white `#fbfcf8`). Navy dan gold di dua lapisan itu mirip, tapi hex-nya beda. Turquoise, warna tombol utama, malah sama sekali tidak ada di kit logo. Tipografinya cuma satu keluarga, **Plus Jakarta Sans self-host** (variable 200-800). Judulnya tebal 800 dengan tracking negatif rapat. Copy-nya Bahasa Indonesia santai ("kamu", "-mu") dicampur kata produk bahasa Inggris (order, customer, workspace). Owner melarang hype gaya AI, badge eyebrow, klaim fitur yang belum ada, dan huruf di bawah 12px. Landing adalah situs statis tanpa build di GitHub Pages (`main` → kairoworkspaces.my.id) dengan CSP ketat, jadi font, gambar, dan animasi baru harus self-host. Untuk redesign hero, artinya begini: pakai token CSS yang sudah ada untuk UI, pakai warna kit hanya di logo, splash, dan mockup HP, lalu putuskan dulu bersama owner apakah dua navy ini mau disatukan. Semua angka di dokumen ini diambil dari file repo. Situs live tidak bisa dibuka dari sandbox, jadi belum ada yang dibandingkan dengan versi live.

> Catatan sumber: path relatif ke root repo. Nomor baris diambil dari branch kerja (HEAD `218164d`, 25 Okt 2026) dan bisa bergeser kalau file diedit.

## Palet: kit logo dan CSS memakai hex berbeda

### Warna kit logo (`assets/brand/`)

| Token usulan | Hex | Sumber | Peran |
|---|---|---|---|
| `--brand-logo-navy` | `#1F305E` | `assets/brand/kairo-horizontal-color.svg` (26 path), `kairo-app-icon.svg` (`<rect rx="57.6">`), `favicon.svg` | Simbol "k" + seluruh wordmark, latar ikon app |
| `--brand-logo-gold` | `#E8B04B` | `kairo-horizontal-color.svg` (2 path: lingkaran ikon + titik "i"), `kairo-app-icon.svg`, `favicon.svg` | Lingkaran/titik khas logo |
| `--brand-logo-ice` | `#E8F5FC` | `kairo-app-icon.svg` (2 path); `favicon.svg` pada `prefers-color-scheme: dark` | Simbol versi terang di atas navy |
| `--brand-splash-bg` | `#1F305E` | `index.html:103`, `manifest.webmanifest` (`background_color`) | Latar splash/PWA |
| `--brand-splash-sub` | `#a9bddc` | `index.html:109` | Teks "WORKSPACES" di splash |

Ketiga SVG tidak memakai stroke atau gradient. Hanya ada `fill` dengan tiga warna di atas.

### Warna UI/CSS landing (`assets/kairo-v3.css`, blok `html.kairo-v3`)

| Token usulan | Token asli | Hex | Sumber | Peran |
|---|---|---|---|---|
| `--brand-ink` | `--kairo-delft` | `#173a59` | `kairo-v3.css:2224` | Teks dasar, h1/h2, latar kartu Pro & panel CTA |
| `--brand-ink-soft` | `--kairo-delft-soft` | `#31556f` | `:2225` | Link nav |
| `--brand-primary` | `--kairo-turquoise` | `#25b9b0` | `:2226` | Latar tombol utama, garis bawah nav |
| `--brand-primary-hover` | (hardcode) | `#31c7bd` | `:2526` | Hover tombol utama |
| `--brand-on-primary` | (hardcode) | `#082f3b` | `:2521` | Teks di atas turquoise (bukan putih) |
| `--brand-highlight` | `--kairo-turquoise-dark` | `#168f8a` | `:2227`, dipakai `:2592-2596` | Teks `<mark>` di judul (latar terang) |
| `--brand-highlight-on-ink` | (hardcode) | `#75d9d2` | `:3623-3625` | `<mark>` di h2 panel CTA (latar delft) |
| `--brand-gold` | `--kairo-gold` | `#dfa94a` | `:2231` | Badge harga, chip trial |
| `--brand-gold-soft` | `--kairo-gold-050` | `#fff5d7` | `:2232` | Latar tag Pro, titik gradien hero |
| `--brand-on-gold` | (hardcode) | `#503b12` | `:3477`, `:5266` | Teks di atas gold/krem |
| `--brand-pro-tag-text` | (hardcode) | `#7a5410` | `:4463` | Teks tag "Pro" |
| `--brand-sky-050` | `--kairo-sky-050` | `#f3fafb` | `:2228` | Latar lembut |
| `--brand-sky-100` | `--kairo-sky-100` | `#dceff4` | `:2229` | Latar lembut, titik gradien hero |
| `--brand-sky-200` | `--kairo-sky-200` | `#b8dfe9` | `:2230` | Garis/aksen lembut |
| `--brand-warm-050` | `--kairo-warm-050` | `#fff9e9` | `:2233` | Latar hangat (2 pemakaian) |
| `--brand-bg` | `--kairo-off-white` | `#fbfcf8` | `:2234` | Latar landing & dasar hero |
| `--brand-surface` | `--kairo-white` | `#ffffff` | `:2235` | Kartu, tombol secondary |
| `--brand-line` | `--kairo-entry-line` | `#d9e9ed` | `:2236` | Border kartu/tombol/footer |
| `--brand-muted` | `--kairo-entry-muted` | `#4b6174` | `:2237` | Paragraf hero, footer |
| `--brand-teal-text` | (hardcode) | `#0f7a75` | `:5230`, `:5289` | Teks kecil teal (label langkah Daftar) |
| `--brand-shadow` | `--kairo-entry-shadow` | `rgba(23,58,89,.12)` / `.08` | `:2238-2239` | Bayangan (turunan delft) |

Latar hero sekarang terdiri dari dua radial-gradient, `rgba(255,245,215,.96)` (gold-soft) dan `rgba(220,239,244,.9)` (sky-100), di atas `#fbfcf8`, plus lingkaran dekoratif `rgba(37,185,176,.16)` (`kairo-v3.css:2549-2564`). Token app `--v3-*` memakai nilai yang identik untuk ink/primary/gold/line (`kairo-v3.css:24-41`). Tombol Reset warna workspace juga kembali ke `#25B9B0` / `#173A59`. Jadi landing dan dashboard masih satu keluarga warna.

### Ketidakcocokan navy dan gold

**Logo navy `#1F305E` ≠ delft UI `#173a59`**. Kontras keduanya cuma 1,09:1, jadi di mata hampir sama tapi secara hex tidak konsisten. **Logo gold `#E8B04B` ≠ gold UI `#dfa94a`.** Dua navy bahkan muncul berdampingan di `manifest.webmanifest`: `background_color:#1F305E` tapi `theme_color:#173a59` (sama dengan `index.html:15`). **Turquoise `#25b9b0` tidak ada di kit logo.** Turquoise adalah warna aksi UI, bukan warna logo. Tidak satu pun token CSS memakai warna kit. Repo juga tidak menyimpan dokumen brand guide asli, jadi tidak jelas mana yang dianggap "resmi". Rekomendasi: **jangan buat hex baru**. Untuk hero, pakai token CSS. Pakai `#1F305E`/`#E8B04B` hanya untuk aset logo dan splash. Keputusan menyatukan navy diserahkan ke owner.

## Kontras: hampir semua lolos AA, highlight turquoise cuma lolos untuk teks besar

Rasio di bawah dihitung dari nilai CSS dengan rumus luminans WCAG 2.x, belum dari render piksel.

| Teks | Latar | Dipakai di | Rasio | Status |
|---|---|---|---|---|
| `#173a59` | `#fbfcf8` / `#ffffff` | Judul, teks dasar | 11,41 / 11,76 | Lolos AAA |
| `#31556f` | `#fbfcf8` | Link nav | 7,66 | Lolos AAA |
| `#4b6174` | `#fbfcf8` / `#fff` / `#f3fafb` / `#dceff4` | Paragraf, footer | 6,25 / 6,44 / 6,10 / 5,43 | Lolos AA |
| `#082f3b` | `#25b9b0` (hover `#31c7bd`) | Tombol utama | 5,84 (6,78) | Lolos AA |
| `#ffffff` / `#eef5f8` / `#c6d5de` | `#173a59` | Kartu Pro, panel CTA | 11,76 / 10,67 / 7,82 | Lolos AAA |
| `#75d9d2` | `#173a59` | `<mark>` di CTA | 7,06 | Lolos AAA |
| `#b4c7d4` | `#173a59` | Harga coret | 6,75 | Lolos AA |
| `#503b12` | `#dfa94a` / `#fdf3d6` | Badge harga / strip trial | 5,02 / 9,60 | Lolos AA / AAA |
| `#7a5410` | `#fff5d7` | Tag Pro | 6,22 | Lolos AA |
| `#0f7a75` | `#ffffff` / `#e6f6f4` | Label teal kecil | 5,17 / 4,64 | Lolos AA |
| `#ffffff` / `#a9bddc` | `#1F305E` | Teks splash | 12,78 / 6,70 | Lolos AAA / AA |
| **`#168f8a`** | `#fbfcf8` / `#fff5d7` / `#dceff4` | `<mark>` judul hero | **3,82 / 3,62 / 3,32** | **Lolos AA Large saja, gagal untuk teks kecil** |
| **`#ffffff`** | `#25b9b0` | (jangan dipakai) | **≈2,4** | **Gagal**. Karena itu tombol memakai teks gelap |
| **`#25b9b0`** | `#fbfcf8` | Garis bawah nav (dekoratif) | **2,36** | **Gagal 3:1** kalau dipakai sebagai teks/ikon |
| **`#E8B04B`** (logo gold) | `#fbfcf8` | Lingkaran logo di header | **1,90** | **Di bawah 3:1** (grafis). Jangan dipakai untuk teks |

Untuk hero: **`#168f8a` hanya aman di judul besar.** Di area paling biru pada gradien hero rasionya turun ke sekitar 3,3:1. Turquoise dan gold juga jangan dipakai sebagai warna teks di latar terang.

## Tipografi: satu keluarga, tebal dan rapat

Fontnya **Plus Jakarta Sans**, self-host, lisensi SIL OFL 1.1. Ada dua file WOFF2 variable (latin 27 KB, latin-ext 22 KB) dengan sumbu berat **200-800**, hanya gaya normal, dan `font-display:swap` (`kairo-v3.css:4-21`). File latin di-preload (`index.html:55`). Stack di landing: `"Plus Jakarta Sans", Arial, sans-serif` (`kairo-v3.css:2375-2387`). Splash memakai fallback `system-ui, -apple-system, "Segoe UI"` (`index.html:103`). **Tidak ada file italic**, jadi italic akan disintesis browser. Berat 900 akan dirender sebagai 800. Aturan owner: **jangan kembali ke Google Fonts** (`.claude/CLAUDE.md`, tabel arsitektur). Ke-13 font di `assets/fonts/receipt/` khusus untuk struk dan tidak dipakai di landing.

| Elemen | Ukuran | Berat | Tracking / line-height | Sumber |
|---|---|---|---|---|
| Hero h1 | `clamp(44px, 5.4vw, 70px)`; ≤700px `clamp(38px, 12vw, 54px)` | 800 | -0,058em / 1,04, max-width 660px | `kairo-v3.css:2582-2590`, `4044-4047` |
| Section h2 | `clamp(30px, 4.1vw, 48px)`; HP `clamp(29px, 9vw, 40px)` | 800 | -0,048em / 1,13 | `:3077-3086`, `:4132-4135` |
| Showcase h3 | `clamp(22px, 2.4vw, 30px)` | — | -0,03em / 1,2 | `:4478` |
| Paragraf hero | 16px (HP 15px / 1,65) | — | lh 1,75, warna muted | `:2598-2604` |
| Lead section | 15px | — | lh 1,72 | `:3088-3096` |
| Link nav | 14,5px (≤900 14px, ≤380 13px) | 750 | — | `:2461-2490` |
| Tombol nav / dasar / besar | 13,5 / 12 / 13px | 800 | radius 13-15px, tinggi min 42/50px | `:2494-2545` |
| Trust chip | 12,5px | 700 | — | `:2613-2636` |
| Footer | 12-13px | 700 (link) | — | `:3698-3714` |

Batas minimum dari owner: **teks landing tidak boleh di bawah 12px**. Ada dua pelanggaran yang masih tersisa. Badge harga `.kairo-lp-price-badge` berukuran **8px**/900 (`:3478-3480`). Mockup dashboard di hero memakai teks 5-11px (`:2692-3041`), tapi mockup itu dekoratif.

## Logo: hanya versi warna untuk latar terang, wordmark jangan diketik ulang

| File | Isi | Pakai di |
|---|---|---|
| `assets/brand/kairo-horizontal-color.svg` (viewBox 687×256) | Simbol + wordmark "kairo / workspaces", semuanya berupa path (tanpa `<text>`) | Header (`index.html:200`), footer (`:600`), dialog Masuk (`:619`) |
| `assets/brand/kairo-app-icon.svg` (256×256) | Kotak navy `rx=57.6`, simbol `#E8F5FC`, titik gold | Dashboard, sidebar, header HP, admin, splash |
| `assets/brand/favicon.svg` / `.ico` | Simbol tanpa latar, otomatis terang di dark mode | Tab browser |
| `pwa-192/512.png`, `pwa-maskable-512.png`, `assets/og/apple-touch-icon.png` | Turunan app icon | PWA / iOS |

Aturan pakainya diambil dari `.claude/CLAUDE.md` (tabel arsitektur, baris `assets/brand/`) dan komentar CSS di `kairo-v3.css:2437-2442`. Logo horizontal hanya untuk **latar terang** dengan **lebar minimal 120px**. **Wordmark itu gambar, jangan diketik ulang pakai font.** Logo lama `assets/kairo-mark.svg` sudah dihapus. **Kit tidak punya versi horizontal putih/terbalik.** Satu-satunya aset terang-di-atas-gelap adalah app icon, yang cuma berisi simbol. Kalau hero atau mockup butuh logo di latar gelap, pilihannya ada dua. Pertama, pakai app icon saja. Kedua, buat varian putih dengan mewarnai ulang `#1F305E` jadi `#E8F5FC`, dan ini **wajib disetujui owner dulu** karena mengubah kit resmi.

Ada dua ketegangan yang perlu dicatat. Pertama, tinggi lockup 46px menghasilkan lebar sekitar 123px, tapi di ≤700px (40px) lebarnya sekitar 107px dan di ≤380px (34px) sekitar 91px. Keduanya **di bawah minimum 120px** (`kairo-v3.css:4035-4038`, `5204-5206`). Kedua, splash, template OG, dan mockup hero memasangkan ikon dengan teks ketik "KAIRO"/"WORKSPACES" huruf besar (`index.html:193`, `:245`). Itu nama yang diketik, bukan wordmark gambar, jadi bertentangan dengan aturan "jangan diketik ulang".

## Splash: komposisi siap pakai untuk mockup HP

Lokasinya `#kairo-splash` di `index.html:101-135` (CSS + skrip) dan markup-nya di `:193`. Splash ini hanya muncul dalam mode standalone (PWA) dan tidak muncul di `#demo*`. Rinciannya:

| Bagian | Nilai |
|---|---|
| Latar | `#1F305E` penuh layar, teks `#fff`, fade-out 0,4s |
| Wadah `.ks-in` | grid, gap 18px, animasi `ks-rise` 0,6s (translateY 8px → 0) |
| Logo `.ks-logo` | `assets/brand/kairo-app-icon.svg`, 104×104. Kotak navy ikon menyatu dengan latar, jadi yang terlihat hanya simbol terang |
| Nama `.ks-name b` | "KAIRO", 30px / 800 / tracking .14em / lh 1,1, putih |
| Sub `.ks-name span` | "Workspaces", 15px / 600 / tracking .2em / uppercase / `#a9bddc` |
| Spinner `.ks-spin` | 22px, border 2,5px `rgba(255,255,255,.28)`, ujung atas `#fff`, putaran linear 0,8s |
| Reduced motion | rise dimatikan, spinner melambat jadi 1,8s |
| Waktu tampil | min 0,9 dtk, maks 8 dtk |

Versi statisnya ada 12 PNG di `assets/splash/ios-*.png` (640×1136 sampai 1320×2868, tanpa spinner), dibuat dengan `.claude/testing/make-splash.js`. Ada dua cara memakainya di mockup HP. (a) Salin markup `.ks-in` ke dalam frame dengan **nama class baru**, karena `#kairo-splash` hanya tampil di bawah `html.kairo-standalone`, lalu skalakan, misalnya ikon 64px dan teks 20/12px, dan tetap hormati `prefers-reduced-motion`. (b) Pakai `ios-1179x2556.png` (rasio 19.5:9) sebagai `<img>` statis.

## Navigasi dan copy: mana yang boleh dipakai, mana yang usang

**Navigasi** (`index.html:197-216`) terdiri dari logo → `#home`, lima link **Features · Solutions · Pricing · About · Demo**, lalu tombol **Masuk** (secondary) dan **Coba Gratis** (primary). Halaman landing dibuat lewat hash route di satu dokumen (`kairo-v3.js:124-138`). Di ≤900px **tidak ada hamburger**: baris 1 berisi logo + tombol, baris 2 berisi link yang selalu terlihat (`kairo-v3.css:2183`). Redesign **wajib mempertahankan hook atribut** `data-v3-login`, `data-v3-signup`, `data-kairo-demo`, `data-signup-plan`, plus penanda harga/trial `data-kp`, `data-trial-days`, `data-trial-only`, `data-trial-off`. Event dipasang lewat atribut-atribut ini.

**Copy yang boleh dipakai (verbatim, `index.html`):**

| Tempat | Teks |
|---|---|
| H1 hero (headline resmi owner, `:222`) | "Pencatatan usaha yang rapi untuk <mark>seller & jasa online.</mark>" |
| Paragraf hero (`:223`) | "Catat order, pantau omzet, kelola customer dan langganan, sampai buat struk profesional. Semua dari satu workspace di browser, tanpa sistem yang ribet." |
| CTA hero (`:225-227`) | "Coba KAIRO Gratis" · "Coba Demo" · "Lihat Cara Kerjanya ↓" |
| Trust chip (`:230-232`) | "✓ Tanpa instalasi" · "✓ Satu workspace" · "✓ Siap dipakai dari browser" |
| Kartu mini hero | "Order hari ini · 28 · 6 perlu diproses" · "Struk siap · Download & bagikan" |
| Highlight (`:293-305`) | "Order lebih teratur" · "Struk siap dibagikan" · "Angka lebih terbaca" · "Customer tersimpan rapi" |
| Paket (`:315`) | "Mulai gratis, <mark>upgrade saat siap.</mark>"; Pro "mulai Rp30.000/bulan" (lewat `data-kp`) |
| Alur (`:387-403`) | 01 "Order dicatat" · 02 "Customer terhubung" · 04 "Struk disiapkan" |
| About (`:398`) | "Satu tempat untuk kerja yang <mark>lebih tenang.</mark>" |
| CTA (`:494`) | "Bisnismu sudah jalan. Sekarang waktunya workspace-mu ikut <mark>tertata.</mark>" |
| Footer (`:602`) | "Workspace yang lebih rapi untuk bisnis yang terus bergerak." |
| Meta title (`:13`) | "KAIRO Workspaces — Order, Kas & Struk dalam Satu Dashboard" |
| Template demo (`assets/demo/demo-entry.js:25-42`) | Seller App Premium · Jasa Online · Online Shop · Kasir / POS |

**Copy dan konten yang usang, jangan dipakai ulang:**

| Item | Lokasi | Alasan |
|---|---|---|
| Stat **"Piutang"** (Rp720 rb / 3 customer) di mockup hero | `index.html:237-280` | Piutang sudah dihapus total dari Seller App Premium (CLAUDE.md) |
| Alur 03 "Pembayaran dipantau / Kas, omzet, dan **piutang**" | `:387-403` | Sama, menyebut fitur yang sudah dihapus |
| Baris order **"Canva Pro · Netflix · Spotify"** di mockup | `:237-280` | Contoh merek pihak ketiga. Owner ingin contoh toko online umum ("Toko Demo", Kaos/Totebag) |
| **"Promo"** sebagai fitur Pro di FAQ 03 | `:511` | Menu Promo dihapus 13 Okt 2026 |
| Contoh **tarot / "Start Reading"** di visual | — | Dilarang owner untuk screenshot landing |
| Angka **"14 hari"** yang ditulis langsung di HTML baru | — | Wajib lewat `data-trial-days` (trial diatur dari admin) |

## Aturan nada dan desain dari owner

Semua aturan berikut diambil dari `.claude/CLAUDE.md` §1 dan §3 (Landing). Pertama, copy ditulis untuk pelanggan. **Tidak boleh ada catatan internal atau teknis** (Supabase, tenant, auth, "belum final"). **Jangan pakai wording khas AI**: badge "kini hadir…" sudah dihapus. **Badge eyebrow kuning di atas judul (`.kairo-lp-eyebrow`) sudah dihapus semua dan jangan ditambah lagi.** **Jangan klaim fitur yang belum ada.** Contohnya "Owner Menu Lock" dibatalkan, sedangkan "Auto Lock dashboard" memang ada. Fitur Pro ditandai `.kairo-lp-pro-tag` sesuai `FEATURE_MIN_PLAN`. Huruf minimal 12px. Landing **selalu terang**: dark mode hanya berlaku setelah login, dan aturan `body.saas-dark` tidak boleh bocor ke landing. Animasi yang berjalan terus hanya boleh memakai `transform`/`opacity` (§4). Animasi reveal yang ada sekarang (opacity + translateY 14px, 0,52s) sudah menghormati `prefers-reduced-motion` (`kairo-v3.js:106-122`, `kairo-v3.css:3719-3728`, `4244-4253`). Kartu tembus pandang pernah dicoba di app dan **ditolak karena kontras light mode turun**. Ini sinyal hati-hati kalau mau membuat hero "glassy".

Proses kerjanya: inspect dulu, buat perubahan sekecil mungkin, ganti jangan menumpuk (replace, not duplicate). Perubahan layout besar **wajib dikirim preview sebelum/sesudah dan menunggu oke dari owner sebelum merge**. Referensi React/shadcn/Tailwind harus dibuat ulang dengan HTML/CSS/JS biasa. Laporan akhir harus memisahkan apa yang sudah dicek dan apa yang belum.

## Stack dan deploy: statis, tanpa build, CSP ketat

Landing adalah **satu dokumen `index.html`** (landing `#kairo-entry` + app `#app-shell`) di **GitHub Pages dari `main`**, dengan domain `kairoworkspaces.my.id` (`CNAME`). Tidak ada build, `package.json`, React, atau folder `.github/`. Logika landing ada di `assets/kairo-v3.js` (IIFE: `bindLandingPages`, `bindPricingPicker`, `bindLandingReveal`, `kairo-v3.js:228-237`). Gaya landing ada di `assets/kairo-v3.css` dengan scope `html.kairo-v3` (token di sekitar `:2215-2241`, hero di sekitar `:2582+`). **Setiap aset yang diubah wajib naik `?v=`-nya di `index.html`.** Index saat ini memuat `kairo-v3.css?v=3.44.15` (`:188`), sementara CLAUDE.md menulis versi yang lebih lama, jadi patokannya `index.html`. Alur kerjanya: branch `claude/...` → PR → merge. Deploy berjalan sekitar 1-2 menit. GitHub Pages meng-cache `index.html` sekitar 10 menit (perlu hard refresh). Deploy pernah macet di status "queued" lebih dari 12 jam.

CSP (`index.html:9`): `style-src 'self' 'unsafe-inline'`, `font-src 'self' data:`, `img-src 'self' data: blob: https:`, `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`, `default-src 'self'`. Artinya **font dan stylesheet luar diblokir**, gambar https boleh, dan **video hero dari luar diblokir** (ikut `default-src`) kecuali di-self-host. Di `<head>` ada beberapa skrip inline yang perlu diperhatikan. Skrip prefetch harga menahan angka lewat `html[data-pricing-wait]` (`:58-86`). Skrip redirect user yang diingat menyembunyikan landing dan pindah ke `#masuk` lewat `html[data-kairo-masuk]` (`:93-100`). Lalu ada skrip splash (`:101-136`). Pengujian dilakukan dengan Playwright Chromium + mock Supabase di `python3 -m http.server 8123` (`.claude/testing/`). Tidak ada WebKit.

## Belum dicek

Bagian ini sengaja dipisah supaya jelas mana yang belum terbukti. **Situs live `kairoworkspaces.my.id` tidak bisa dibuka dari sandbox** (curl kode 000). Jadi belum ada perbandingan antara file branch dan `main` yang ter-deploy, dan status run Pages juga belum dicek. **Kontras dihitung dari nilai CSS, bukan audit piksel.** Latar gradien, transparansi, serta state hover/fokus (kecuali tombol utama) belum diukur dengan `pixaudit.js`. Ukuran tipografi diambil dari source CSS, belum diukur di browser yang merender. Fungsi beberapa hex kecil (`#f4d48d`, `#edf1f2`, `#7a8a94`, `#f9faf9`, `#f8fbfc`) di mockup hero belum dipetakan per elemen. Piksel PNG (PWA icon, splash iOS) belum dicek. Splash belum diuji di iPhone asli, dan Safari belum diuji sama sekali. Versi Plus Jakarta Sans di file WOFF2 belum diverifikasi. Screenshot `assets/landing/*.webp` bertanggal sekitar 8 Okt 2026 dan mungkin sudah tidak sama dengan UI terbaru. Terakhir, **brand guide asli dari kit logo tidak ada di repo**, jadi aturan clear-space, nama warna resmi, dan apakah `#1F305E` atau `#173a59` yang "benar" harus ditanyakan ke owner.

## Kesimpulan

Masalah identitas visual KAIRO yang sebenarnya bukan kekurangan warna, tapi **tidak adanya satu sumber kebenaran**. Kit logo dan CSS berkembang terpisah. Hasilnya dua navy dan dua gold yang hampir kembar, ditambah turquoise yang jadi warna aksi tapi tidak pernah masuk kit. Redesign hero adalah momen yang pas untuk membekukan token `--brand-*` di atas, dengan nilai CSS yang ada untuk UI dan nilai kit untuk logo/splash. Penyatuan navy cukup ditanyakan ke owner, tidak perlu menebak hex baru.

Dari sisi konten, risiko terbesar hero sekarang bukan desain, melainkan **mockup yang ketinggalan zaman**. Mockup itu masih menampilkan Piutang dan contoh Netflix/Spotify yang bertentangan dengan keputusan owner. Komposisi splash navy yang sudah ada adalah bahan mockup HP yang paling siap pakai dan paling "on-brand", asalkan logo di latar gelap memakai app icon atau varian putih yang sudah disetujui owner.
