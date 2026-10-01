/* KAIRO UI V3 — presentation only. No database or business-logic writes. */
(() => {
  'use strict';
  let queuedLoginSubmit = false;
  let loginReturnFocus = null;
  let pendingRemember = null;
  const REMEMBER_KEY = 'kairo_remember_username_v1';

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function rememberedUsername() {
    try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch (_) { return ''; }
  }

  function setRememberedUsername(value) {
    try {
      if (value) localStorage.setItem(REMEMBER_KEY, value);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch (_) {}
  }

  // "Ingat saya": stores only the username on this device; password and session are never stored.
  function applyRememberedUsername() {
    const saved = rememberedUsername();
    const box = q('#kairo-remember-me');
    const input = q('#login-username');
    if (box) box.checked = Boolean(saved);
    if (!saved || !input || input.value) return;
    input.value = saved;
    if (document.activeElement === input || document.activeElement === document.body) focusLoginField();
  }

  function openLogin(event) {
    window.__kairoEnsureRuntime?.().catch(() => {});
    const dialog = q('#kairo-login-dialog');
    if (!dialog) return;
    loginReturnFocus = event?.currentTarget || document.activeElement;
    dialog.hidden = false;
    document.body.classList.add('kairo-dialog-open');
    requestAnimationFrame(() => {
      dialog.classList.add('is-open');
      applyRememberedUsername();
      focusLoginField();
    });
  }

  function focusLoginField() {
    const dialog = q('#kairo-login-dialog');
    if (!dialog || dialog.hidden) return;
    const username = q('#login-username', dialog);
    (username?.value ? q('#login-password', dialog) : username)?.focus({ preventScroll: true });
  }

  function closeLogin({ restoreFocus = true } = {}) {
    const dialog = q('#kairo-login-dialog');
    if (!dialog || dialog.hidden) return;
    dialog.classList.remove('is-open');
    document.body.classList.remove('kairo-dialog-open');
    dialog.hidden = true;
    if (q('#kairo-entry')?.dataset.page === 'masuk' && document.body.classList.contains('auth-locked')) {
      location.hash = 'home';
      return;
    }
    if (restoreFocus && loginReturnFocus instanceof HTMLElement) loginReturnFocus.focus({ preventScroll: true });
  }

  async function openSignup() {
    closeLogin({ restoreFocus: false });
    try { await window.__kairoEnsureRuntime?.(); } catch (_) { return; }
    const started = Date.now();
    while (typeof window.__kairoOpenAccountPage !== 'function' && Date.now() - started < 10000) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (typeof window.__kairoOpenAccountPage === 'function') window.__kairoOpenAccountPage('signup');
  }

  function mobileMenu(open) {
    const nav = q('#kairo-entry-nav');
    const toggle = q('#kairo-menu-toggle');
    if (!nav || !toggle) return;
    nav.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  function bindLandingReveal(root) {
    const items = qa('[data-kairo-reveal]', root);
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach(item => item.classList.add('is-visible'));
      return;
    }
    document.body.classList.add('kairo-reveal-ready');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });
    items.forEach(item => observer.observe(item));
  }

  const landingPages = ['home', 'features', 'solutions', 'pricing', 'about', 'masuk'];

  function showLandingPage(root) {
    const hash = location.hash.slice(1);
    const page = landingPages.includes(hash) ? hash : 'home';
    const wasLogin = root.dataset.page === 'masuk';
    root.dataset.page = page;
    if (page === 'masuk') openLogin();
    else if (wasLogin) closeLogin({ restoreFocus: false });
    qa('#kairo-entry-nav .kairo-nav-links a', root).forEach(link => {
      if (link.getAttribute('href') === `#${page}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }

  function bindLandingPages(root) {
    showLandingPage(root);
    if (!location.hash && rememberedUsername()) openLogin();
    // kairo-app.js wraps the password field (show/hide eye) during boot, which drops focus
    // from a dialog that is already open. Restore it once the wrapper is in place.
    const form = q('#login-form', root);
    if (form && !q('.kairo-password-wrap', form)) {
      const watcher = new MutationObserver(() => {
        if (!q('.kairo-password-wrap', form)) return;
        watcher.disconnect();
        if (document.activeElement === document.body) focusLoginField();
      });
      watcher.observe(form, { childList: true, subtree: true });
      setTimeout(() => watcher.disconnect(), 15000);
    }
    window.addEventListener('hashchange', () => {
      if (document.body.classList.contains('auth-locked')) showLandingPage(root);
    });
    qa('[data-kairo-top]', root).forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }

  function bindLanding(root) {
    bindLandingPages(root);
    qa('[data-v3-login]', root).forEach(button => button.addEventListener('click', openLogin));
    qa('[data-v3-signup]', root).forEach(button => button.addEventListener('click', openSignup));
    qa('[data-login-close]', root).forEach(button => button.addEventListener('click', () => closeLogin()));
    q('#kairo-remember-me', root)?.addEventListener('change', event => {
      if (!event.target.checked) setRememberedUsername('');
    });
    qa('#kairo-entry-nav a', root).forEach(link => link.addEventListener('click', () => mobileMenu(false)));
    q('#kairo-menu-toggle', root)?.addEventListener('click', event => {
      const open = event.currentTarget.getAttribute('aria-expanded') !== 'true';
      mobileMenu(open);
    });
    bindLandingReveal(root);
    root.addEventListener('keydown', event => {
      const dialog = q('#kairo-login-dialog');
      if (!dialog || dialog.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLogin();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = qa('button:not([disabled]), input:not([disabled]), a[href]', dialog).filter(el => !el.hidden && el.tabIndex !== -1);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }

  function openTab(tab) {
    if (tab === 'settings') q('#saas-settings-btn')?.click();
    else q(`#saas-sidebar .tab[data-tab="${tab}"], .v19-nav .tab[data-tab="${tab}"]`)?.click();
  }

  function workspaceName() {
    const label = q('#saas-workspace-pill')?.textContent?.trim();
    return label || 'Workspace';
  }

  const statPresentation = {
    'kpi-revenue': {
      tone: 'primary',
      caption: 'Pendapatan sesuai periode aktif',
      icon: '<path d="M4 7h16v10H4z"/><path d="M8 11h8M8 14h5"/>'
    },
    'seller-kpi-profit': {
      tone: 'gold',
      caption: 'Pendapatan setelah modal produk',
      icon: '<path d="M5 16 10 11l3 3 6-7"/><path d="M14 7h5v5"/>'
    },
    'kpi-tx': {
      tone: 'sky',
      caption: 'Order pada periode aktif',
      icon: '<path d="M6 5h12v14H6z"/><path d="M9 9h6M9 13h6"/>'
    },
    'kpi-best': {
      tone: 'gold',
      caption: 'Produk paling sering terjual',
      icon: '<path d="M6 4h12v16H6z"/><path d="m9 10 2 2 4-4"/>'
    },
    'kpi-cash': {
      tone: 'primary',
      caption: 'Saldo operasional tercatat',
      icon: '<path d="M4 7h16v11H4z"/><path d="M16 11h4v3h-4z"/>'
    },
    'kpi-rights': {
      tone: 'sky',
      caption: 'Ringkasan bulan berjalan',
      icon: '<path d="M5 5h14v14H5z"/><path d="M8 3v4M16 3v4M8 11h3M13 11h3M8 15h3"/>'
    }
  };

  function decorateStatCards() {
    qa('#dashboard .kpi').forEach(card => {
      const value = q('.kpi-value', card);
      if (!value) return;
      const config = statPresentation[value.id] || {
        tone: 'sky',
        caption: 'Ringkasan workspace aktif',
        icon: '<circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/>'
      };
      card.classList.add('kairo-stat-card');
      card.dataset.v3Tone = config.tone;
      if (!q('.kairo-stat-icon', card)) {
        const icon = document.createElement('span');
        icon.className = 'kairo-stat-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = `<svg viewBox="0 0 24 24">${config.icon}</svg>`;
        card.prepend(icon);
      }
      let caption = q('.kairo-stat-caption', card);
      if (!caption) {
        caption = document.createElement('small');
        caption.className = 'kairo-stat-caption';
        card.append(caption);
      }
      if (caption.textContent !== config.caption) caption.textContent = config.caption;
    });
  }

  function enhanceDashboardFoundation() {
    q('#app-shell main.container > .toolbar')?.classList.add('kairo-page-header');
    q('#transaction-history-card')?.classList.add('kairo-list-card');
    q('#seller-dashboard-history-card')?.classList.add('kairo-list-card');
    q('#seller-expiry-card')?.classList.add('kairo-information-card');
    q('#seller-outstanding-card')?.classList.add('kairo-information-card');
    q('#dashboard .shift-card')?.classList.add('kairo-information-card');
    decorateStatCards();
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
    enhanceDashboardFoundation();
    [120, 600, 1600].forEach(delay => setTimeout(enhanceDashboardFoundation, delay));
  }

  // Riwayat Transaksi: kairo-app.js renders 12 cells per row; kairo-v3.css hides
  // Qty, Topic, Add On, Tip and Pembayaran, which are shown here instead.
  const TX_DETAIL_FIELDS = [['Paket', 4], ['Qty', 5], ['Topic', 6], ['Add On', 7], ['Tip', 8], ['Total', 9], ['Pembayaran', 10]];
  let txDetailReturnFocus = null;

  function txDetailDialog() {
    let dialog = q('#kairo-tx-detail');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.id = 'kairo-tx-detail';
    dialog.className = 'kairo-tx-detail';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'kairo-tx-detail-title');
    dialog.hidden = true;
    dialog.innerHTML = '<button class="kairo-tx-detail-backdrop" type="button" tabindex="-1" aria-label="Tutup detail transaksi"></button><div class="kairo-tx-detail-card"><button class="kairo-tx-detail-close" type="button" aria-label="Tutup detail transaksi">×</button><h3 id="kairo-tx-detail-title"></h3><p></p><dl></dl></div>';
    qa('.kairo-tx-detail-backdrop, .kairo-tx-detail-close', dialog).forEach(button => button.addEventListener('click', closeTxDetail));
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeTxDetail(); }
      if (event.key === 'Tab') { event.preventDefault(); q('.kairo-tx-detail-close', dialog)?.focus(); }
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function openTxDetail(row, trigger) {
    const cells = row.children;
    const text = index => cells[index]?.textContent.replace(/\s+/g, ' ').trim() || '-';
    const dialog = txDetailDialog();
    q('h3', dialog).textContent = text(2);
    q('p', dialog).textContent = `${text(0)} · Start ${text(1)} · ${text(3)}`;
    const list = q('dl', dialog);
    list.replaceChildren(...TX_DETAIL_FIELDS.flatMap(([label, index]) => {
      const term = document.createElement('dt');
      const value = document.createElement('dd');
      term.textContent = label;
      value.textContent = text(index);
      return [term, value];
    }));
    txDetailReturnFocus = trigger;
    dialog.hidden = false;
    q('.kairo-tx-detail-close', dialog)?.focus();
  }

  function closeTxDetail() {
    const dialog = q('#kairo-tx-detail');
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    if (txDetailReturnFocus?.isConnected) txDetailReturnFocus.focus();
  }

  function enhanceHistoryRows() {
    qa('#tx-table-body > tr').forEach(row => {
      if (row.children.length < 12) return;
      const actions = q('div', row.children[11]) || row.children[11];
      if (q('[data-v3-tx-detail]', actions)) return;
      const packageBadge = q('.badge', row.children[4]);
      if (packageBadge) packageBadge.title = packageBadge.textContent.trim();
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kairo-tx-detail-btn';
      button.dataset.v3TxDetail = '';
      button.textContent = 'Detail';
      button.addEventListener('click', () => openTxDetail(row, button));
      actions.prepend(button);
    });
  }

  function boot() {
    const landing = q('#kairo-entry');
    if (landing) bindLanding(landing);
    mountDashboardHeader();
    const historyBody = q('#tx-table-body');
    if (historyBody) {
      enhanceHistoryRows();
      new MutationObserver(enhanceHistoryRows).observe(historyBody, { childList: true });
    }
    new MutationObserver(() => {
      if (document.body.classList.contains('authenticated')) {
        if (pendingRemember) {
          setRememberedUsername(pendingRemember.remember ? pendingRemember.username : '');
          pendingRemember = null;
        }
        closeLogin({ restoreFocus: false });
        mountDashboardHeader();
      } else if (document.body.classList.contains('auth-locked')) {
        applyRememberedUsername();
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  document.addEventListener('submit', event => {
    if (event.target?.id !== 'login-form') return;
    pendingRemember = {
      remember: Boolean(q('#kairo-remember-me')?.checked),
      username: q('#login-username')?.value.trim() || ''
    };
    if (!window.__KAIRO_APP_READY__) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (queuedLoginSubmit) return;
      queuedLoginSubmit = true;
      const button = q('#login-button');
      const error = q('#auth-error');
      if (button) { button.disabled = true; button.textContent = 'Menyiapkan KAIRO...'; }
      const started = Date.now();
      const waitForApp = setInterval(() => {
        if (window.__KAIRO_APP_READY__) {
          clearInterval(waitForApp);
          queuedLoginSubmit = false;
          if (button) { button.disabled = false; button.textContent = 'Masuk'; }
          event.target.requestSubmit();
        } else if (Date.now() - started > 20000) {
          clearInterval(waitForApp);
          queuedLoginSubmit = false;
          if (button) { button.disabled = false; button.textContent = 'Masuk'; }
          if (error) { error.textContent = 'Aplikasi belum berhasil dimuat. Periksa koneksi lalu refresh halaman.'; error.style.display = 'block'; }
        }
      }, 100);
      return;
    }
    setTimeout(mountDashboardHeader, 700);
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-tab="dashboard"], [data-mobile-tab="dashboard"], #saas-side-home')) {
      setTimeout(mountDashboardHeader, 60);
      setTimeout(enhanceDashboardFoundation, 220);
    }
    if (!event.target.closest('#kairo-entry-nav')) mobileMenu(false);
  }, true);
})();
