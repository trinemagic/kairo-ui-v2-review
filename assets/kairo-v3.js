/* KAIRO UI V3 — presentation only. No database or business-logic writes. */
(() => {
  'use strict';

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function openLogin() {
    window.__kairoEnsureRuntime?.().catch(() => {});
    const card = q('#auth-screen .auth-card');
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => q('#login-username')?.focus({ preventScroll: true }), 350);
  }

  async function openSignup() {
    try { await window.__kairoEnsureRuntime?.(); } catch (_) { return; }
    if (typeof window.__kairoOpenAccountPage === 'function') window.__kairoOpenAccountPage('signup');
  }

  function mobileMenu(open) {
    const nav = q('#kairo-v3-nav');
    const toggle = q('#kairo-v3-menu-toggle');
    if (!nav || !toggle) return;
    nav.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  function bindLanding(root) {
    qa('[data-v3-login]', root).forEach(button => button.addEventListener('click', openLogin));
    qa('[data-v3-signup]', root).forEach(button => button.addEventListener('click', openSignup));
    qa('#kairo-v3-nav a', root).forEach(link => link.addEventListener('click', () => mobileMenu(false)));
    q('[data-v3-home]', root)?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    q('#kairo-v3-menu-toggle', root)?.addEventListener('click', event => {
      const open = event.currentTarget.getAttribute('aria-expanded') !== 'true';
      mobileMenu(open);
    });
  }

  function mountLanding() {
    const screen = q('#auth-screen');
    const heroHost = q('.auth-plans-panel', screen);
    if (!screen || !heroHost || screen.dataset.kairoV3Mounted === '1') return;
    screen.dataset.kairoV3Mounted = '1';

    heroHost.setAttribute('aria-label', 'Perkenalan KAIRO Workspaces');
    heroHost.innerHTML = `
      <div class="v3-hero">
        <span class="v3-announce">KAIRO Workspaces kini hadir untuk seller digital</span>
        <h1>Kelola bisnismu dalam satu workspace yang lebih rapi.</h1>
        <p>Catat order, pantau omzet, kelola customer, subscription, dan buat struk profesional tanpa sistem yang ribet.</p>
        <div class="v3-cta">
          <button type="button" data-v3-signup>Coba KAIRO Gratis</button>
          <a href="#kairo-v3-how">Lihat Cara Kerjanya ↓</a>
        </div>
        <div class="v3-mock" aria-label="Preview dashboard KAIRO">
          <div class="v3-mock-top"><b>K</b><span>KAIRO Dashboard</span><i></i></div>
          <div class="v3-mock-body">
            <aside><i></i><i></i><i></i><i></i></aside>
            <div class="v3-mock-main">
              <div class="v3-mock-welcome"></div>
              <div class="v3-mock-kpis"><i></i><i></i><i></i><i></i></div>
              <div class="v3-mock-chart"><i></i><i></i><i></i><i></i><i></i></div>
            </div>
          </div>
        </div>
      </div>`;

    const nav = document.createElement('nav');
    nav.id = 'kairo-v3-nav';
    nav.setAttribute('aria-label', 'Navigasi KAIRO');
    nav.innerHTML = `
      <button type="button" class="v3-brand" data-v3-home aria-label="Kembali ke atas">
        <span class="v3-brand-mark">K</span><span><b>KAIRO</b><small>WORKSPACES</small></span>
      </button>
      <button type="button" id="kairo-v3-menu-toggle" class="v3-menu-toggle" aria-expanded="false" aria-controls="kairo-v3-menu"><span></span><span></span><span></span><b>Menu</b></button>
      <div id="kairo-v3-menu" class="v3-menu">
        <div class="v3-nav-links"><a href="#kairo-v3-features">Features</a><a href="#kairo-v3-solutions">Solutions</a><a href="#kairo-v3-pricing">Pricing</a><a href="#kairo-v3-footer">About</a></div>
        <div class="v3-nav-actions"><button type="button" class="v3-login" data-v3-login>Masuk</button><button type="button" class="v3-trial" data-v3-signup>Coba Gratis</button></div>
      </div>`;
    screen.prepend(nav);

    const marketing = document.createElement('main');
    marketing.id = 'kairo-v3-marketing';
    marketing.innerHTML = `
      <section class="v3-section" id="kairo-v3-features">
        <span class="v3-kicker">SATU WORKSPACE, LEBIH RAPI</span>
        <h2>Kerjaan penting bisnis nggak lagi tercecer.</h2>
        <p>KAIRO menyatukan operasional harian tanpa terasa seperti aplikasi akuntansi yang kompleks.</p>
        <div class="v3-cap-grid">
          <article><span>↗</span><h3>Order & customer</h3><p>Catat pesanan, simpan histori, dan kenali customer yang kembali.</p></article>
          <article><span>◌</span><h3>Kas & performa</h3><p>Pantau omzet, pengeluaran, piutang, dan arah bisnis dari satu layar.</p></article>
          <article><span>✦</span><h3>Struk profesional</h3><p>Preview, unduh, bagikan, dan cetak ulang struk dengan identitas bisnismu.</p></article>
        </div>
      </section>
      <section class="v3-section v3-solution" id="kairo-v3-solutions">
        <div><span class="v3-kicker">DIBUAT UNTUK BISNIS DIGITAL</span><h2>Sesuai cara jualanmu yang nyata.</h2><p>Kelola seller app premium, produk digital, jasa online, dan kebutuhan workspace lain tanpa alur yang berbelit.</p><button type="button" data-v3-signup>Coba KAIRO Gratis</button></div>
        <div class="v3-solution-art" aria-hidden="true">K</div>
      </section>
      <section class="v3-section v3-how" id="kairo-v3-how">
        <span class="v3-kicker">CARA KERJANYA</span><h2>Mulai rapi dalam tiga langkah.</h2>
        <div class="v3-steps"><article><b>01</b><h3>Atur workspace</h3><p>Masukkan identitas dan kebutuhan dasar bisnis.</p></article><article><b>02</b><h3>Catat order</h3><p>Gunakan alur order yang sesuai cara kamu berjualan.</p></article><article><b>03</b><h3>Pantau & lanjutkan</h3><p>Lihat omzet, follow-up, dan bukti transaksi kapan pun.</p></article></div>
      </section>
      <section class="v3-section v3-price" id="kairo-v3-pricing">
        <span class="v3-kicker">PAKET KAIRO</span><h2>Pilih ruang yang pas buat bisnismu.</h2>
        <div class="v3-price-grid"><article><small>BASIC</small><h3>Mulai & catat</h3><p>Pencatatan inti untuk memulai operasional.</p><button type="button" data-v3-signup>Mulai Basic</button></article><article class="featured"><small>PLUS</small><h3>Operate & grow</h3><p>Workflow praktis untuk bisnis yang berkembang.</p><button type="button" data-v3-signup>Pilih Plus</button></article><article><small>PRO</small><h3>Understand & scale</h3><p>Insight dan kontrol bisnis yang lebih dalam.</p><button type="button" data-v3-signup>Pilih Pro</button></article></div>
      </section>
      <footer id="kairo-v3-footer"><div><b>KAIRO WORKSPACES</b><p>Every step, from the start.</p></div><button type="button" class="v3-login" data-v3-login>Masuk ke workspace →</button></footer>`;
    screen.appendChild(marketing);
    bindLanding(screen);
  }

  function openTab(tab) {
    if (tab === 'settings') q('#saas-settings-btn')?.click();
    else q(`#saas-sidebar .tab[data-tab="${tab}"], .v19-nav .tab[data-tab="${tab}"]`)?.click();
  }

  function workspaceName() {
    const label = q('#saas-workspace-pill')?.textContent?.trim();
    return label || 'Workspace';
  }

  function mountDashboardHeader() {
    if (!document.body.classList.contains('authenticated')) return;
    const dashboard = q('#dashboard');
    if (!dashboard) return;
    let header = q('#kairo-v3-dashboard-head');
    if (!header) {
      header = document.createElement('section');
      header.id = 'kairo-v3-dashboard-head';
      dashboard.prepend(header);
    }
    const date = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    header.innerHTML = `<div><small>WORKSPACE HARI INI</small><h2>Halo, siap rapihin bisnismu?</h2><p>${escapeHtml(workspaceName())} · ${escapeHtml(date)}</p></div><div class="v3-quick" aria-label="Aksi cepat"><button type="button" data-v3-tab="input">＋ Tambah Order</button><button type="button" data-v3-tab="customers">Tambah Customer</button><button type="button" data-v3-tab="cash">Catat Pengeluaran</button><button type="button" data-v3-tab="promo">Buat Promo</button></div>`;
    qa('[data-v3-tab]', header).forEach(button => button.addEventListener('click', () => openTab(button.dataset.v3Tab)));
  }

  function boot() {
    mountLanding();
    mountDashboardHeader();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  document.addEventListener('submit', event => {
    if (event.target?.id === 'login-form') setTimeout(mountDashboardHeader, 700);
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-tab="dashboard"], [data-mobile-tab="dashboard"], #saas-side-home')) setTimeout(mountDashboardHeader, 60);
    if (!event.target.closest('#kairo-v3-nav')) mobileMenu(false);
  }, true);
})();
