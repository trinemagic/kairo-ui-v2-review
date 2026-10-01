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

  // Real-time clock in the dashboard greeting card, in the device's own time zone.
  let liveClockTimer = null;

  function tickLiveClock() {
    const time = q('[data-kairo-clock-time]');
    if (!time || document.hidden) return;
    const now = new Date();
    time.textContent = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
    const zone = q('[data-kairo-clock-zone]');
    if (zone) {
      const part = new Intl.DateTimeFormat('id-ID', { timeZoneName: 'short' }).formatToParts(now).find(item => item.type === 'timeZoneName');
      zone.textContent = part?.value || Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    }
  }

  function startLiveClock() {
    if (liveClockTimer) return;
    liveClockTimer = setInterval(tickLiveClock, 1000);
    document.addEventListener('visibilitychange', tickLiveClock);
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
    const name = String(window.kairoDisplayName || '').trim();
    header.innerHTML = `<div><small>WORKSPACE HARI INI</small><h2>${name ? `Halo, ${escapeHtml(name)}!` : 'Halo!'}</h2><p>${escapeHtml(workspaceName())} · ${escapeHtml(date)}</p></div><div class="kairo-live-clock"><strong data-kairo-clock-time></strong><span data-kairo-clock-zone></span></div>`;
    tickLiveClock();
    startLiveClock();
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
    const packageBadge = q('.badge', cells[4]);
    const dialog = txDetailDialog();
    q('h3', dialog).textContent = text(2);
    q('p', dialog).textContent = `${text(0)} · Start ${text(1)} · ${text(3)}`;
    const list = q('dl', dialog);
    list.replaceChildren(...TX_DETAIL_FIELDS.flatMap(([label, index]) => {
      const term = document.createElement('dt');
      const value = document.createElement('dd');
      term.textContent = label;
      value.textContent = index === 4 && packageBadge?.dataset.fullName ? packageBadge.dataset.fullName : text(index);
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

  function historyTransaction(row) {
    const onclick = q('button[onclick*="openSavedReceipt"]', row)?.getAttribute('onclick') || '';
    const id = onclick.match(/openSavedReceipt\('([^']*)'\)/)?.[1];
    // historyTransactions is a top-level `let` in kairo-app.js (shared global scope).
    const rows = typeof historyTransactions !== 'undefined' && Array.isArray(historyTransactions) ? historyTransactions : [];
    return id ? rows.find(tx => String(tx.id) === id) : null;
  }

  // Show package codes (e.g. "TR3 × 1") instead of full names to keep the column narrow.
  function packageCodes(tx) {
    const items = Array.isArray(tx?.order_items) && tx.order_items.length ? tx.order_items : null;
    if (items) return items.map(item => `${item.code || item.name || '-'} × ${Number(item.qty || 1)}`).join(', ');
    if (tx?.package_code) return `${tx.package_code} × ${Number(tx.package_qty || 1)}`;
    return '';
  }

  // One "Aksi" menu holds Struk and Hapus / Cancel; it clicks the original
  // kairo-app.js buttons (kept hidden in the row) so their logic is unchanged.
  let txMenuTrigger = null;

  function txActionMenu() {
    let menu = q('#kairo-tx-menu');
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = 'kairo-tx-menu';
    menu.className = 'kairo-tx-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    menu.addEventListener('keydown', event => {
      const items = qa('button', menu);
      const index = items.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); closeTxMenu(true); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
      else if (event.key === 'Tab') closeTxMenu(false);
    });
    document.body.appendChild(menu);
    document.addEventListener('click', event => {
      if (menu.hidden || menu.contains(event.target) || event.target.closest('[data-v3-tx-menu]')) return;
      closeTxMenu(false);
    }, true);
    window.addEventListener('resize', () => closeTxMenu(false));
    window.addEventListener('scroll', () => closeTxMenu(false), { passive: true });
    q('#transaction-history-card .history-table-wrap')?.addEventListener('scroll', () => closeTxMenu(false), { passive: true });
    return menu;
  }

  function openTxMenu(trigger, actions) {
    const menu = txActionMenu();
    if (!menu.hidden && txMenuTrigger === trigger) { closeTxMenu(true); return; }
    closeTxMenu(false);
    menu.replaceChildren(...actions.map(({ label, target, danger }) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.textContent = label;
      if (danger) item.classList.add('is-danger');
      item.addEventListener('click', () => { closeTxMenu(false); target.click(); });
      return item;
    }));
    menu.hidden = false;
    const rect = trigger.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const below = rect.bottom + 6 + height <= window.innerHeight - 8;
    menu.style.left = `${left}px`;
    menu.style.top = `${below ? rect.bottom + 6 : Math.max(8, rect.top - height - 6)}px`;
    txMenuTrigger = trigger;
    trigger.setAttribute('aria-expanded', 'true');
    q('button', menu)?.focus({ preventScroll: true });
  }

  function closeTxMenu(restoreFocus) {
    const menu = q('#kairo-tx-menu');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    txMenuTrigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && txMenuTrigger?.isConnected) txMenuTrigger.focus();
    txMenuTrigger = null;
  }

  function enhanceHistoryRows() {
    qa('#tx-table-body > tr').forEach(row => {
      if (row.children.length < 12) return;
      const actions = q('div', row.children[11]) || row.children[11];
      if (q('[data-v3-tx-detail]', actions)) return;
      const packageBadge = q('.badge', row.children[4]);
      if (packageBadge) {
        const fullName = packageBadge.textContent.trim();
        const codes = packageCodes(historyTransaction(row));
        packageBadge.dataset.fullName = fullName;
        packageBadge.title = fullName;
        if (codes) packageBadge.textContent = codes;
      }

      const receipt = q('button[onclick*="openSavedReceipt"]', actions);
      const cancel = q('.tx-delete-btn', actions);
      const menuActions = [
        receipt && { label: 'Struk', target: receipt },
        cancel && { label: 'Hapus / Cancel', target: cancel, danger: true }
      ].filter(Boolean);
      if (menuActions.length) {
        menuActions.forEach(action => action.target.classList.add('kairo-tx-original-action'));
        const menuButton = document.createElement('button');
        menuButton.type = 'button';
        menuButton.className = 'kairo-tx-menu-btn';
        menuButton.dataset.v3TxMenu = '';
        menuButton.setAttribute('aria-haspopup', 'menu');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.innerHTML = 'Aksi <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
        menuButton.addEventListener('click', () => openTxMenu(menuButton, menuActions));
        actions.prepend(menuButton);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kairo-tx-detail-btn';
      button.dataset.v3TxDetail = '';
      button.textContent = 'Detail';
      button.addEventListener('click', () => openTxDetail(row, button));
      actions.prepend(button);
    });
  }

  // Layout colours: the v3 tokens (buttons, period filter, sidebar accents) follow the
  // workspace brand colours that kairo-app.js writes to --brand-primary/--brand-accent.
  // The legacy defaults count as "not customised" and keep the KAIRO identity.
  const KAIRO_IDENTITY = { primary: '#25B9B0', accent: '#173A59' };
  const LEGACY_BRAND = ['#696F41', '#EA97A9'];
  const LAYOUT_TOKENS = ['--v3-primary', '--v3-primary-dark', '--v3-primary-soft', '--v3-on-primary', '--v3-sky', '--v3-sky-strong'];

  function brandHex(name) {
    const value = document.documentElement.style.getPropertyValue(name).trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(value) && !LEGACY_BRAND.includes(value) ? value : '';
  }

  function readableOn(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.36 ? '#0b2533' : '#ffffff';
  }

  function syncLayoutColors() {
    const root = document.documentElement;
    const primary = brandHex('--brand-primary');
    const accent = brandHex('--brand-accent');
    const next = {};
    if (primary) {
      next['--v3-primary'] = primary;
      next['--v3-primary-dark'] = `color-mix(in srgb, ${primary} 72%, #000)`;
      next['--v3-primary-soft'] = `color-mix(in srgb, ${primary} 13%, #fff)`;
      next['--v3-on-primary'] = readableOn(primary);
    }
    if (accent) {
      next['--v3-sky'] = `color-mix(in srgb, ${accent} 7%, #fff)`;
      next['--v3-sky-strong'] = `color-mix(in srgb, ${accent} 30%, #fff)`;
    }
    LAYOUT_TOKENS.forEach(token => {
      const value = next[token] || '';
      if (root.style.getPropertyValue(token).trim() === value) return;
      if (value) root.style.setProperty(token, value);
      else root.style.removeProperty(token);
    });
  }

  function bindLayoutColorReset() {
    q('#settings-color-reset')?.addEventListener('click', () => {
      if (typeof window.canManageSettings === 'function' && !window.canManageSettings()) return;
      [['#settings-primary-text', '#settings-primary-color', KAIRO_IDENTITY.primary], ['#settings-accent-text', '#settings-accent-color', KAIRO_IDENTITY.accent]]
        .forEach(([textSel, colorSel, value]) => {
          const text = q(textSel);
          const color = q(colorSel);
          if (color) color.value = value;
          if (text) { text.value = value; text.dispatchEvent(new Event('input', { bubbles: true })); }
        });
      if (typeof window.showToast === 'function') window.showToast('Warna dikembalikan ke identitas KAIRO. Klik Simpan Pengaturan untuk menerapkan.');
    });
  }

  function boot() {
    const landing = q('#kairo-entry');
    if (landing) bindLanding(landing);
    mountDashboardHeader();
    syncLayoutColors();
    new MutationObserver(syncLayoutColors).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    bindLayoutColorReset();
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
