/* KAIRO — Panduan pemakaian dashboard (owner Okt 2026).
   Dimuat lazy oleh tombol Panduan (ikon buku) di header desktop / item "Panduan" di menu More HP (kairo-v3.js).
   Isi menyesuaikan template (Seller App Premium vs tampilan dasar) dan paket (Gratis/Pro).
   Teks statis; tidak ada data user yang ditulis sebagai HTML. */
(function () {
  'use strict';
  if (window.kairoGuide) return;

  const ICON = {
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8M8 10.5h6"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  const SHOT_V = '1';
  const isSeller = () => document.documentElement.dataset.businessTemplate === 'digital_subscription';
  const guideKind = () => (isSeller() ? 'seller' : document.documentElement.dataset.businessTemplate === 'pos_kasir' ? 'kasir' : 'base');
  const tplName = () => (isSeller() ? 'Seller App Premium' : document.documentElement.dataset.businessTemplate === 'pos_kasir' ? 'Kasir / POS' : 'Dashboard usaha');
  const isPro = () => String(document.documentElement.dataset.workspacePlan || 'basic').toLowerCase() === 'pro';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  // tab = halaman yang dibuka tombol "Buka menu"; only = 'seller' | 'base'; pro = fitur paket Pro.
  function baseSections() {
    const seller = isSeller();
    const shop = document.documentElement.dataset.businessTemplate === 'online_shop';
    return [
      {
        id: 'start', title: 'Mulai cepat', intro: 'Lima langkah supaya workspace siap dipakai mencatat penjualan.',
        steps: [
          'Buka <b>Settings › Workspace &amp; Branding</b>: isi nama usaha, warna, dan logo. Logo default KAIRO dipakai sampai kamu upload logo sendiri.',
          seller ? 'Buka <b>Settings › Produk</b>: atur harga jual dan modal (HPP) tiap aplikasi, atau tambah produk sendiri.'
                 : shop ? 'Buka <b>Settings › Produk &amp; Harga</b>: isi produk, harga, modal (HPP), dan <b>stok</b>. Atur juga <b>Platform Penjualan</b> dan <b>Metode Pembayaran</b> di Settings › Kategori.'
                 : 'Buka <b>Settings › Package &amp; Harga</b> (dan Add-on/Topik bila dipakai): isi daftar paket beserta harga dan modal.',
          'Buka <b>Settings › Pembagian Omzet</b>: tentukan pembagian laba ke partner (paket Pro bisa lebih dari satu partner dan memakai Kas).',
          'Catat order pertama di menu <b>Orders</b>, lalu simpan.',
          'Pantau hasilnya di <b>Dashboard</b>: penjualan, profit, dan riwayat transaksi hari ini.'
        ],
        tips: ['Paket Pro mendapat <b>Panduan setup toko</b> otomatis setelah login pertama; bisa dibuka lagi di Settings › Workspace &amp; Branding.']
      },
      {
        id: 'dashboard', tab: 'dashboard', title: 'Dashboard',
        intro: 'Ringkasan usaha: kartu statistik, riwayat transaksi, dan pengingat.',
        steps: [
          'Pilih periode di atas: <b>Hari Ini</b>, <b>7 Hari</b>, <b>30 Hari</b>, atau <b>Kustom</b>. Kartu statistik ikut periode itu.',
          'Pencet <b>ikon mata</b> di kartu mana pun untuk menyembunyikan/menampilkan semua nominal (aman kalau layar dilihat orang lain).',
          'Pencet <b>Refresh</b> untuk mengambil data terbaru tanpa keluar dari akun.',
          seller ? 'Kartu <b>Akan Expired</b> menampilkan langganan customer yang segera habis.'
                 : document.documentElement.dataset.businessTemplate === 'online_shop' ? 'Tabel <b>Stok Produk</b> menampilkan sisa stok dan produk yang menipis atau habis.'
                 : 'Panel <b>Open Store</b> mencatat sesi buka-tutup toko (paket Pro).',
          'Di HP, menu <b>History</b> di bawah membuka riwayat transaksi.'
        ],
        tips: ['Lonceng di kanan atas berisi pengingat order yang belum selesai' + (seller ? ' dan langganan yang hampir/ sudah expired.' : '.')]
      },
      seller ? {
        id: 'input', tab: 'input', title: 'Orders (buat pesanan)', intro: 'Catat penjualan aplikasi premium pakai keranjang.',
        steps: [
          'Pilih <b>kategori</b> atau ketik nama aplikasi di kolom cari.',
          'Pilih <b>produk</b>, lalu <b>Plan/Varian</b> dan <b>Durasi</b>. Harga muncul otomatis dari Settings › Produk.',
          'Pencet <b>+ Tambah ke Pesanan</b>. Ulangi bila customer membeli lebih dari satu produk.',
          'Isi data customer (nama, nomor WhatsApp), platform, dan metode pembayaran.',
          'Simpan. Status order bisa diubah Baru → Diproses → Selesai dari riwayat.'
        ],
        tips: ['Nomor WhatsApp customer dipakai tombol WhatsApp di Tracker Langganan untuk mengingatkan perpanjangan.']
      } : {
        id: 'input', tab: 'input', title: 'Orders (catat penjualan)', intro: 'Catat setiap penjualan beserta paket, add-on, dan topik.',
        steps: [
          'Ketik nama customer. Nama yang pernah tercatat muncul sebagai saran.',
          shop ? 'Pilih platform, lalu <b>klik kartu produk</b>: tiap klik menambah 1, tombol <b>−</b> di label jumlah mengurangi. Produk yang stoknya habis atau kurang tidak bisa dipilih.'
               : 'Pilih platform, lalu <b>klik kartu Package</b> (tiap klik menambah 1, tombol <b>−</b> mengurangi). Pilih juga Add-on dan Topik bila ada.',
          'Pilih metode pembayaran' + (shop ? ' (daftarnya bisa kamu atur sendiri di Settings)' : '') + '. Gunakan <b>Penyesuaian Harga</b> bila ada diskon atau harga khusus.',
          'Simpan. Struk bisa dilihat dan disimpan sebagai gambar.',
          'Order berstatus <b>On Progress</b> muncul di lonceng setelah 5 menit; centang selesai bila sudah dikerjakan.'
        ],
        tips: ['<b>Autofill</b> (paket Pro): tempel teks pesanan dari chat, form terisi otomatis.']
      },
      seller ? {
        id: 'subscriptions', tab: 'subscriptions', title: 'Tracker Langganan', intro: 'Pantau masa aktif langganan tiap customer.',
        steps: [
          'Pakai filter <b>≤7 hari</b>, <b>Aktif</b>, <b>Expired</b>, atau <b>Semua</b>, dan kolom cari.',
          'Pencet <b>WhatsApp</b> untuk menghubungi customer yang langganannya hampir habis.',
          'Pencet <b>Perpanjang</b>: halaman Orders terbuka dengan nama customer sudah terisi.'
        ]
      } : null,
      {
        id: 'customers', tab: 'customers', title: 'Customer Database', pro: true,
        intro: 'Daftar customer beserta riwayat belanjanya.',
        steps: ['Cari customer berdasarkan nama.', 'Pencet nama untuk melihat riwayat transaksinya.', 'Data customer hanya bisa dilihat akun pemilik workspace ini.']
      },
      {
        id: 'promo', tab: 'promo', title: 'Promo', pro: true,
        intro: 'Diskon otomatis saat mencatat order.',
        steps: ['Isi nama promo dan target: semua paket, paket tertentu, topik, atau kata kunci paket.', 'Pilih diskon persen atau nominal, lalu tanggal mulai dan berakhir.', 'Simpan. Promo aktif langsung terpakai di Orders.']
      },
      {
        id: 'performance', tab: 'performance', title: 'Performance',
        intro: 'Analisa penjualan sesuai periode yang dipilih.',
        steps: ['Lihat ringkasan omzet, jumlah transaksi, rata-rata per order, dan produk terlaris.', 'Kartu <b>Penjualan per Produk</b> punya pilihan produk dan periode sendiri.', 'Grafik harian, perbandingan bulan, dan peringkat paket tersedia di paket Pro.']
          .concat(shop ? ['<b>Laba per Produk</b> dan <b>Performa Platform</b> menunjukkan produk dan platform yang paling menguntungkan. Pencet tombol panah untuk melihat tabelnya.', '<b>Batal &amp; Retur</b> mencatat order yang dibatalkan atau diretur beserta alasannya.'] : [])
      },
      {
        id: 'payout', tab: 'payout', title: 'Withdraw',
        intro: 'Catat pencairan hak tiap partner dari hasil penjualan.',
        steps: ['Lihat saldo hak tiap partner.', 'Catat nominal yang dicairkan beserta tanggal dan catatan.', 'Saldo partner langsung berkurang sesuai pencairan.']
      },
      {
        id: 'cash', tab: 'cash', title: 'Petty Cash (Kas)', pro: true,
        intro: 'Kas usaha dari potongan penjualan, plus pengeluaran dan pemasukan kas.',
        steps: ['Aktifkan/matikan Kas di Settings › Pembagian Omzet (<b>Pakai Kas</b>).', 'Catat pengeluaran (mis. iklan) dan pemasukan kas dari luar.', 'Pakai filter tanggal di atas tabel riwayat. <b>Kas Modal</b> menampilkan total HPP penjualan per tanggal.']
      },
      {
        id: 'settings', tab: 'settings', title: 'Settings',
        intro: 'Semua pengaturan workspace.',
        steps: [
          '<b>Workspace &amp; Branding</b>: nama, warna, logo, <b>Ukuran Teks</b> (Kecil sampai Ekstra), dan <b>PIN Login</b>. Ukuran Teks dan PIN berlaku di perangkat ini.',
          seller ? '<b>Produk</b>: harga jual dan modal tiap plan/durasi, tambah produk sendiri.'
                 : shop ? '<b>Produk &amp; Harga</b>: harga, modal, dan stok (kosongkan stok bila tidak dilacak; batas menipis memunculkan notifikasi di lonceng). <b>Platform Penjualan</b>: daftar platform, dan saklar komisi per platform (perkiraan dari persen yang kamu isi). <b>Metode Pembayaran</b>: daftar yang muncul di Orders.'
                 : '<b>Package, Add-on, Topik</b>: daftar yang muncul di Orders.',
          '<b>Pembagian Omzet</b>: persentase partner dan Kas; perubahan berlaku mulai tanggal yang dipilih.',
          '<b>Struk</b> (paket Pro): desain, label, dan logo struk.',
          '<b>Tema Workspace</b> (paket Pro): Lavender, Kayu, Awan, atau Mawar.'
        ].filter(Boolean)
      },
      {
        id: 'plan', title: 'Paket &amp; perpanjangan',
        intro: 'Gratis untuk mulai, Pro untuk semua fitur.',
        steps: [
          '<b>Gratis</b>: riwayat yang tampil 60 hari terakhir; data lebih dari 12 bulan diringkas setelah pemberitahuan 30 hari (saldo tidak berubah).',
          '<b>Pro</b>: Rp43.000/bulan atau Rp238.000/6 bulan. Membuka Customer Database, Promo, Petty Cash, Export Excel, Autofill, Open Store, Struk, dan riwayat lengkap.',
          'Upgrade/perpanjang: pencet <b>Upgrade ke Pro</b> / <b>Perpanjang Pro</b> di Dashboard. Pesan WhatsApp ke admin terisi otomatis; setelah transfer dikonfirmasi admin, Pro aktif.',
          '7 hari sebelum masa Pro berakhir muncul pengingat di Dashboard. Bila lewat, workspace kembali ke Gratis dan data tetap aman.'
        ]
      },
      {
        id: 'security', title: 'Keamanan akun',
        intro: 'Kebiasaan kecil supaya data usaha tetap aman.',
        steps: [
          'Masuk dengan username atau email. Demi keamanan kamu perlu login setiap membuka dashboard; <b>Ingat saya</b> hanya menyimpan username.',
          'Jangan bagikan password. Tim yang ikut mencatat memakai akun pemilik dengan izinmu.',
          '<b>PIN Login</b> (Settings › Workspace &amp; Branding): buat PIN 6 angka untuk masuk lebih cepat di perangkat pribadi. Salah 5 kali, PIN dihapus dan kamu masuk lagi dengan password. Password tidak disimpan.',
          'Atur <b>Auto Lock</b> di kanan atas supaya layar terkunci saat ditinggal.',
          'Selalu <b>Keluar</b> setelah memakai perangkat bersama/umum.'
        ]
      },
      {
        id: 'help', title: 'Butuh bantuan?',
        intro: 'Ada kendala atau masukan?',
        steps: ['Pencet <b>Ada masukan/keluhan?</b> di sidebar (HP: menu More › Masukan / Keluhan). Pesan WhatsApp terisi nama akun dan workspace.', 'Sertakan screenshot halaman atau pesan error supaya cepat ditangani.']
      }
    ].filter(Boolean);
  }

  // Kasir / POS: bagian khusus menggantikan bagian dasar yang beda (Orders -> Kasir, dst.); Promo tidak ditampilkan karena belum dipakai di layar Kasir.
  function kasirSections(base) {
    const mine = {
      start: {
        id: 'start', title: 'Mulai cepat', intro: 'Enam langkah supaya kasir siap dipakai jualan.',
        steps: [
          'Buka <b>Settings › Workspace &amp; Branding</b>: isi nama usaha, warna, dan logo (tampil di struk).',
          'Buka menu <b>Produk</b>, tekan <b>Tambah Produk</b>: foto, nama, harga jual, modal, dan stok. Untung per produk langsung terhitung.',
          'Buka <b>Settings › Kategori</b>: atur <b>Tipe Pesanan</b>, <b>Metode Pembayaran</b>, dan <b>Service &amp; Pajak</b> bila dipakai.',
          'Buka <b>Settings › Pembagian Omzet</b>: tentukan pembagian untung ke partner (paket Pro).',
          'Di Dashboard tekan <b>Buka Kasir</b> dan isi uang modal di laci.',
          'Buka menu <b>Kasir</b>, pilih produk, lalu <b>Bayar &amp; Cetak Struk</b>.'
        ],
        tips: ['Paket Pro mendapat <b>Panduan setup toko</b> otomatis setelah login pertama; bisa dibuka lagi di Settings › Workspace &amp; Branding.']
      },
      dashboard: {
        id: 'dashboard', tab: 'dashboard', title: 'Dashboard',
        intro: 'Ringkasan hari ini: penjualan, untung, jumlah struk, dan uang di laci.',
        steps: [
          'Pilih periode di atas: <b>Hari Ini</b>, <b>7 Hari</b>, <b>30 Hari</b>, atau <b>Kustom</b>.',
          'Kartu <b>Kas Tunai di Laci</b> = modal awal + uang tunai masuk di sesi yang sedang berjalan.',
          'Grafik <b>Penjualan per Jam</b> menandai jam paling ramai. Di bawahnya ada Produk Terlaris, Metode Pembayaran, dan Tipe Pesanan.',
          'Kartu <b>Stok Produk</b> menampilkan produk yang habis atau hampir habis. Pencet <b>Kelola Produk</b> untuk mengisi ulang.',
          'Pencet <b>ikon mata</b> di kartu untuk menyembunyikan semua nominal.'
        ],
        tips: ['Lonceng di kanan atas memberi tahu stok yang menipis atau habis.']
      },
      session: {
        id: 'session', tab: 'dashboard', noShot: true, title: 'Sesi Kasir (buka &amp; tutup)',
        intro: 'Satu sesi = satu shift jaga. Dipakai untuk mencocokkan uang di laci.',
        steps: [
          'Di Dashboard tekan <b>Buka Kasir</b>, isi <b>modal awal laci</b>.',
          'Saat shift selesai tekan <b>Tutup Kasir</b>: lihat rekap (jumlah struk, penjualan per metode, tunai masuk), isi <b>uang keluar</b> bila ada, lalu hitung dan isi <b>uang fisik</b> di laci.',
          'KAIRO menghitung <b>seharusnya</b> (modal + tunai masuk − uang keluar) dan <b>selisih</b>: hijau = pas, kuning = lebih, merah = kurang.',
          'Rekap sesi bisa dicetak. Tombol <b>Riwayat Sesi</b> menampilkan 30 sesi terakhir.'
        ],
        tips: ['Kalau Kasir belum dibuka, pembayaran tetap tersimpan, hanya tidak masuk hitungan sesi.']
      },
      products: {
        id: 'products', tab: 'pos-products', title: 'Produk', intro: 'Semua urusan produk di satu tempat: foto, harga, modal, stok, dan pembagian untung.',
        steps: [
          'Tekan <b>Tambah Produk</b>. Langkah 1: <b>Ambil Foto</b> (HP membuka kamera, komputer memakai webcam) atau <b>Dari Galeri</b>. Boleh dilewati; produk tanpa foto tampil kotak berhuruf awal.',
          'Isi <b>nama</b>, pilih <b>kategori</b> dan <b>satuan</b>. Kode/barcode boleh kosong (dibuat otomatis); kalau pakai scanner, scan di kolom itu.',
          'Isi <b>harga jual</b> dan <b>modal</b>. Kotak hijau menunjukkan untung per produk.',
          'Nyalakan <b>Hitung stok</b> bila produk perlu dihitung. Atur stok dengan tombol − / + atau ketik angkanya, dan tentukan batas <b>ingatkan saya kalau sisa</b>.',
          '<b>Pembagian untung</b>: pilih <b>Ikut aturan umum</b>, atau <b>Atur sendiri untuk produk ini</b> (persen per partner, atau tombol Bagi rata / Semua ke satu partner).',
          'Tab <b>Tambahan</b> dipakai untuk add-on (mis. extra shot). Hapus produk dari lembar ubah; riwayat penjualan lama tetap aman.'
        ],
        tips: ['Stok berkurang otomatis setiap ada penjualan. Produk berstok 0 tidak bisa dijual sampai stoknya diisi.']
      },
      input: {
        id: 'input', tab: 'input', title: 'Kasir (jualan)', intro: 'Layar utama untuk mencatat penjualan dengan cepat.',
        steps: [
          'Cari produk di kolom cari, atau <b>scan barcode</b> (scanner keyboard) lalu Enter. Tab kategori menyaring produk.',
          'Pencet kartu produk untuk menambah 1. Tambahkan <b>tambahan cepat</b> bila ada. Ubah jumlah dengan tombol + / − di struk.',
          'Pilih <b>tipe pesanan</b> (mis. Dine In, Take Away), isi nomor meja atau nama pelanggan bila perlu.',
          'Pakai <b>Diskon</b> (% atau Rp). Service dan pajak ikut terhitung bila diaktifkan di Settings.',
          'Pilih <b>metode bayar</b>. Untuk <b>Tunai</b>, isi uang diterima: kembalian muncul otomatis (ada tombol nominal cepat).',
          'Tekan <b>Bayar &amp; Cetak Struk</b>. Struk bisa dicetak (kertas 58 mm).',
          '<b>Simpan Bill</b> menahan pesanan yang belum dibayar (mis. meja yang masih makan). Buka lagi dari daftar bill, tambah item, lalu bayar.'
        ],
        tips: ['Di HP, tombol <b>Lihat Struk</b> di bawah membawa kamu ke ringkasan pesanan.']
      },
      performance: {
        id: 'performance', tab: 'performance', title: 'Performance', intro: 'Analisa penjualan sesuai periode yang dipilih.',
        steps: [
          'Lihat ringkasan omzet, jumlah struk, rata-rata per struk, dan produk terlaris.',
          'Kartu <b>Jam Ramai</b>, <b>Kategori Terlaris</b>, <b>Metode Pembayaran</b>, dan <b>Tipe Pesanan</b> menunjukkan kebiasaan pembeli.',
          '<b>Laba per Produk</b> menunjukkan produk paling menguntungkan. <b>Rekap Sesi Kasir</b> menampilkan selisih uang laci tiap sesi.',
          'Pencet tombol <b>Tabel</b> di tiap kartu untuk melihat angka lengkapnya. Grafik lengkap tersedia di paket Pro.'
        ]
      },
      settings: {
        id: 'settings', tab: 'settings', title: 'Settings', intro: 'Semua pengaturan workspace.',
        steps: [
          '<b>Workspace &amp; Branding</b>: nama, warna, logo, <b>Ukuran Teks</b>, dan <b>PIN Login</b>.',
          '<b>Kategori</b>: daftar kategori produk, serta kartu <b>Pengaturan Kasir</b> (Tipe Pesanan, Metode Pembayaran, Service &amp; Pajak). Pajak tidak dihitung sebagai untung.',
          '<b>Pembagian Omzet</b>: persentase partner dan Kas.',
          '<b>Struk</b>: desain dan label struk. Pilihan <b>Standar</b> cocok untuk printer kasir.',
          '<b>Tema Workspace</b> (paket Pro): Lavender, Kayu, Awan, atau Mawar.',
          'Produk, harga, dan stok diatur di menu <b>Produk</b>, bukan di Settings.'
        ]
      }
    };
    const out = [];
    for (const b of base) {
      if (b.id === 'promo') continue;
      if (mine[b.id]) {
        if (b.id === 'input') out.push(mine.products);
        out.push(mine[b.id]);
        if (b.id === 'dashboard') out.push(mine.session);
      } else out.push(b);
    }
    return out;
  }
  function sections() {
    const base = baseSections();
    return document.documentElement.dataset.businessTemplate === 'pos_kasir' ? kasirSections(base) : base;
  }

  function currentTab() {
    const active = document.querySelector('main.container > section.section.active');
    return active ? active.id : 'dashboard';
  }

  function render(panel, query) {
    const list = panel.querySelector('.kairo-guide-list');
    const q = String(query || '').trim().toLowerCase();
    const pro = isPro(), tab = currentTab();
    const items = sections().filter(s => !q || (s.title + ' ' + s.intro + ' ' + s.steps.join(' ') + ' ' + (s.tips || []).join(' ')).replace(/<[^>]+>/g, '').toLowerCase().includes(q));
    list.innerHTML = items.length ? items.map(s => {
      const proTag = s.pro ? '<span class="kairo-guide-pro">Pro</span>' : '';
      const lock = s.pro && !pro ? '<p class="kairo-guide-lock">Fitur ini ada di paket Pro. <button type="button" data-guide-upgrade>Upgrade ke Pro</button></p>' : '';
      const open = s.tab ? `<button type="button" class="kairo-guide-go" data-guide-tab="${esc(s.tab)}">Buka ${s.title.replace(/ \(.*\)$/, '')}${ICON.arrow}</button>` : '';
      const isOpen = q || s.tab === tab || (!s.tab && s.id === 'start' && tab === 'dashboard');
      // Contoh tampilan (data contoh "Toko Demo", dibuat ulang dengan .claude/testing/shoot-guide.js). <img loading=lazy>
      // di dalam <details> tertutup tidak diunduh sampai bagiannya dibuka.
      const shot = s.tab && !s.noShot ? `<button type="button" class="kairo-guide-shot" data-guide-zoom aria-label="Perbesar contoh tampilan ${esc(s.title.replace(/<[^>]+>/g, ''))}"><img loading="lazy" decoding="async" src="assets/guide/${guideKind()}-${esc(s.tab)}.webp?v=${SHOT_V}" alt="Contoh tampilan ${esc(s.title.replace(/<[^>]+>/g, ''))}" width="900" height="697"><span>Contoh tampilan · pencet untuk memperbesar</span></button>` : '';
      return `<details class="kairo-guide-item" data-guide-id="${esc(s.id)}"${isOpen ? ' open' : ''}><summary><span>${s.title}</span>${proTag}</summary>
        <div class="kairo-guide-body"><p class="kairo-guide-intro">${s.intro}</p>${lock}${shot}<ol>${s.steps.map(t => `<li>${t}</li>`).join('')}</ol>
        ${(s.tips || []).map(t => `<p class="kairo-guide-tip">${t}</p>`).join('')}${open}</div></details>`;
    }).join('') : '<p class="kairo-guide-empty">Tidak ada panduan yang cocok. Coba kata lain.</p>';
  }

  let panel = null, lastFocus = null;
  function build() {
    panel = document.createElement('div');
    panel.id = 'kairo-guide';
    panel.hidden = true;
    panel.innerHTML = `<div class="kairo-guide-backdrop" data-guide-close></div>
      <section class="kairo-guide-panel" role="dialog" aria-modal="true" aria-labelledby="kairo-guide-title">
        <header class="kairo-guide-head"><span class="kairo-guide-icon">${ICON.book}</span><div><h2 id="kairo-guide-title">Panduan KAIRO</h2><p>${tplName()} · paket ${isPro() ? 'Pro' : 'Gratis'}</p></div>
          <button type="button" class="kairo-guide-close" data-guide-close aria-label="Tutup panduan">${ICON.close}</button></header>
        <label class="kairo-guide-search">${ICON.search}<input type="search" placeholder="Cari panduan, mis. struk, promo, kas" aria-label="Cari panduan"></label>
        <div class="kairo-guide-list"></div>
      </section>
      <div class="kairo-guide-zoom" hidden><button type="button" class="kairo-guide-zoom-close" data-guide-unzoom aria-label="Tutup gambar">${ICON.close}</button><img alt=""></div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      if (e.target.closest('[data-guide-close]')) return close();
      const zoom = panel.querySelector('.kairo-guide-zoom');
      const shot = e.target.closest('[data-guide-zoom]');
      if (shot) { const img = shot.querySelector('img'); zoom.querySelector('img').src = img.currentSrc || img.src; zoom.querySelector('img').alt = img.alt; zoom.hidden = false; zoom.querySelector('button').focus(); return; }
      if (e.target.closest('[data-guide-unzoom]') || e.target.classList.contains('kairo-guide-zoom')) { zoom.hidden = true; return; }
      const go = e.target.closest('[data-guide-tab]');
      if (go) {
        const tab = go.dataset.guideTab;
        close();
        // Lewat tombol menu yang sama dengan yang dipencet user (mis. Tracker Langganan baru terisi lewat menunya).
        const menu = tab === 'settings' ? document.getElementById('saas-settings-side-btn') : document.querySelector(`#saas-sidebar .tab[data-tab="${tab}"]`);
        if (menu) menu.click(); else if (typeof window.openAppPage === 'function') window.openAppPage(tab);
        return;
      }
      if (e.target.closest('[data-guide-upgrade]')) { close(); window.kairoRequestUpgrade?.(); }
    });
    const input = panel.querySelector('input');
    input.addEventListener('input', () => render(panel, input.value));
    panel.addEventListener('keydown', e => {
      if (e.key === 'Escape') { const z = panel.querySelector('.kairo-guide-zoom'); if (!z.hidden) { z.hidden = true; return; } return close(); }
      if (e.key !== 'Tab') return;
      const f = [...panel.querySelectorAll('button, input, summary')].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
  }

  function open() {
    if (!panel) build();
    panel.querySelector('.kairo-guide-head p').textContent = `${tplName()} · paket ${isPro() ? 'Pro' : 'Gratis'}`;
    const input = panel.querySelector('input');
    input.value = '';
    render(panel, '');
    lastFocus = document.activeElement;
    panel.hidden = false;
    document.body.classList.add('kairo-guide-open');
    document.getElementById('kairo-guide-btn')?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      panel.classList.add('is-open');
      const cur = panel.querySelector('details[open]');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
      panel.querySelector('.kairo-guide-close').focus();
    });
  }
  function close() {
    if (!panel || panel.hidden) return;
    panel.classList.remove('is-open');
    panel.hidden = true;
    document.body.classList.remove('kairo-guide-open');
    document.getElementById('kairo-guide-btn')?.setAttribute('aria-expanded', 'false');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  window.kairoGuide = { open, close };
})();
