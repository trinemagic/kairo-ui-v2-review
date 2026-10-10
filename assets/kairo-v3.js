// Anti-clickjacking (Okt 2026): GitHub Pages tidak bisa mengirim header X-Frame-Options, jadi halaman menolak
// ditampilkan di dalam iframe situs lain (tombol bisa "dipencet tanpa sadar" lewat lapisan transparan).
if (window.top !== window.self) {
  try { window.top.location.replace(window.location.href); } catch (_e) { document.documentElement.innerHTML = ''; }
}

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

  window.kairoOpenLogin = openLogin; // dipakai kairo-app.js setelah daftar akun ("Kembali ke Masuk")

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

  async function openSignup(event) {
    // Pricing buttons preselect a plan in the signup table (data-signup-plan="pro" | "custom").
    window.__kairoSignupPlan = event?.currentTarget?.dataset?.signupPlan || 'basic';
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

  const landingPages = ['home', 'features', 'solutions', 'pricing', 'about', 'masuk', 'syarat', 'privasi'];

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
    // "Ingat saya": open the login form straight away on the home page. Phones usually reopen the
    // last address with "#home" (from the landing menu), so that counts as home too.
    if (rememberedUsername() && ['', '#', '#home'].includes(location.hash)) openLogin();
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
      icon: '<path d="M4 7h16v10H4z"/><path d="M8 11h8M8 14h5"/>'
    },
    'shop-kpi-profit': {
      tone: 'gold',
      icon: '<path d="M5 16 10 11l3 3 6-7"/><path d="M14 7h5v5"/>'
    },
    'seller-kpi-profit': {
      tone: 'gold',
      icon: '<path d="M5 16 10 11l3 3 6-7"/><path d="M14 7h5v5"/>'
    },
    'kpi-tx': {
      tone: 'sky',
      icon: '<path d="M6 5h12v14H6z"/><path d="M9 9h6M9 13h6"/>'
    },
    'kpi-cash': {
      tone: 'primary',
      icon: '<path d="M4 7h16v11H4z"/><path d="M16 11h4v3h-4z"/>'
    },
    'kpi-rights': {
      tone: 'sky',
      icon: '<path d="M5 5h14v14H5z"/><path d="M8 3v4M16 3v4M8 11h3M13 11h3M8 15h3"/>'
    }
  };

  function decorateStatCards() {
    qa('#dashboard .kpi').forEach(card => {
      const value = q('.kpi-value', card);
      if (!value) return;
      const config = statPresentation[value.id] || {
        tone: 'sky',
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
    });
  }

  function enhanceDashboardFoundation() {
    q('#app-shell main.container > .toolbar')?.classList.add('kairo-page-header');
    q('#transaction-history-card')?.classList.add('kairo-list-card');
    q('#seller-dashboard-history-card')?.classList.add('kairo-list-card');
    q('#seller-expiry-card')?.classList.add('kairo-information-card');
    q('#dashboard .shift-card')?.classList.add('kairo-information-card');
    decorateStatCards();
  }

  // Real-time clock in the dashboard greeting card, in the device's own time zone.
  let liveClockTimer = null;
  const clockFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const zoneFormat = new Intl.DateTimeFormat('id-ID', { timeZoneName: 'short' });

  function tickLiveClock() {
    const time = q('[data-kairo-clock-time]');
    // Only tick while the clock is on screen (Dashboard open, not the mobile History view).
    if (!time || document.hidden || time.offsetParent === null) return;
    const now = new Date();
    time.textContent = clockFormat.format(now);
    const zone = q('[data-kairo-clock-zone]');
    if (zone && !zone.textContent) {
      const part = zoneFormat.formatToParts(now).find(item => item.type === 'timeZoneName');
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
    // Rebuild only when the greeting, workspace or date changed: this runs on every body class
    // change (sheets, theme, History), and rewriting it each time forced needless re-layouts.
    const key = `${name}|${workspaceName()}|${date}`;
    if (header.dataset.kairoKey !== key) {
      header.dataset.kairoKey = key;
      header.innerHTML = `<div><small>WORKSPACE HARI INI</small><h2>${name ? `Halo, ${escapeHtml(name)}!` : 'Halo!'}</h2><p>${escapeHtml(workspaceName())} · ${escapeHtml(date)}</p></div><div class="kairo-live-clock"><strong data-kairo-clock-time></strong><span data-kairo-clock-zone></span></div>`;
      tickLiveClock();
    }
    startLiveClock();
    enhanceDashboardFoundation();
    // Late cards (e.g. the seller Profit card) are decorated by these cheap follow-up passes.
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
  const LAYOUT_TOKENS = ['--v3-primary', '--v3-primary-dark', '--v3-primary-soft', '--v3-on-primary', '--v3-sky', '--v3-sky-strong', '--v3-accent', '--kairo-on-accent'];

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
      next['--v3-accent'] = accent;
      next['--v3-sky'] = `color-mix(in srgb, ${accent} 7%, #fff)`;
      next['--v3-sky-strong'] = `color-mix(in srgb, ${accent} 30%, #fff)`;
    }
    // Text on accent-coloured buttons (.btn-pink) for any accent, legacy pink included.
    const rawAccent = document.documentElement.style.getPropertyValue('--brand-accent').trim();
    if (/^#[0-9a-f]{6}$/i.test(rawAccent)) next['--kairo-on-accent'] = readableOn(rawAccent.toUpperCase());
    LAYOUT_TOKENS.forEach(token => {
      const value = next[token] || '';
      if (root.style.getPropertyValue(token).trim() === value) return;
      if (value) root.style.setProperty(token, value);
      else root.style.removeProperty(token);
    });
  }

  function bindLayoutColorReset() {
    q('#settings-color-reset')?.addEventListener('click', () => {
      // A workspace with a theme resets to that theme's colours, not to the KAIRO identity.
      const theme = (window.KAIRO_WORKSPACE_THEMES || {})[q('#settings-theme')?.value || ''];
      const base = theme || KAIRO_IDENTITY;
      [['#settings-primary-text', '#settings-primary-color', base.primary], ['#settings-accent-text', '#settings-accent-color', base.accent]]
        .forEach(([textSel, colorSel, value]) => {
          const text = q(textSel);
          const color = q(colorSel);
          if (color) color.value = value;
          if (text) { text.value = value; text.dispatchEvent(new Event('input', { bubbles: true })); }
        });
      if (typeof window.showToast === 'function') window.showToast(theme ? `Warna dikembalikan ke warna tema ${theme.name}. Klik Simpan Pengaturan untuk menerapkan.` : 'Warna dikembalikan ke identitas KAIRO. Klik Simpan Pengaturan untuk menerapkan.');
    });
  }

  // Notifications: orders still "On Progress" 5+ minutes after Start Reading. They stay listed
  // (red after 30 minutes) until the order is marked done - no time limit (owner, Okt 2026).
  // Reads the app's cached transactions (kept fresh by its realtime sync); no extra queries.
  const NOTIFY_AFTER_MIN = 5;
  const NOTIFY_URGENT_MIN = 30;
  let notifyItems = [];

  function notifySeenKey() {
    const wid = typeof activeWorkspaceId !== 'undefined' ? activeWorkspaceId : '';
    return `kairo_notif_seen_v1_${wid || 'default'}`;
  }

  function notifySeen() {
    try { return new Set(JSON.parse(localStorage.getItem(notifySeenKey()) || '[]')); } catch (_) { return new Set(); }
  }

  function notifyStage(item) { return `${item.id}:${item.urgent ? 'u' : 'n'}`; }

  async function collectNotifications() {
    if (!document.body.classList.contains('authenticated') || typeof allTransactions !== 'function') return [];
    // Seller App Premium: akun pelanggan yang akan/sudah expired + order Baru/Diproses (seller-app-premium.js).
    if (document.body.classList.contains('seller-app-premium') && typeof window.kairoSellerNotifications === 'function') {
      try { const items = await window.kairoSellerNotifications(); if (items) return items; } catch (_) { return notifyItems; }
    }
    let rows = [];
    try { rows = await allTransactions(); } catch (_) { return notifyItems; }
    const now = Date.now();
    const stockItems = ['online_shop', 'pos_kasir'].includes(document.documentElement.dataset.businessTemplate) && typeof window.kairoShopStockNotifications === 'function' ? window.kairoShopStockNotifications() : [];
    return stockItems.concat(rows.filter(tx => (tx.reading_status || 'done') !== 'done' && tx.reading_started_at)
      .map(tx => ({ tx, minutes: Math.floor((now - new Date(tx.reading_started_at).getTime()) / 60000) }))
      .filter(({ minutes }) => minutes >= NOTIFY_AFTER_MIN)
      .sort((a, b) => b.minutes - a.minutes)
      .map(({ tx, minutes }) => ({
        id: String(tx.id),
        name: tx.customer_name || '-',
        pkg: packageCodes(tx) || tx.package_code || '-',
        minutes,
        urgent: minutes >= NOTIFY_URGENT_MIN
      })));
  }

  function notifyAge(minutes) {
    if (minutes < 60) return `${minutes} menit`;
    const h = Math.floor(minutes / 60);
    if (h >= 24) return `${Math.floor(h / 24)} hari ${h % 24} jam`;
    return `${h} jam ${minutes % 60} menit`;
  }

  // Renders into the desktop bell (#kairo-notif-btn/#kairo-notif-list) and the mobile
  // bottom-nav button + sheet (#kairo-mobile-notif-btn/#kairo-mobile-notif-list) alike.
  function renderNotifications() {
    const seen = notifySeen();
    // The red dot stays while any order is 30+ minutes On Progress, even after the list was opened.
    const urgent = notifyItems.some(item => item.urgent);
    const unseen = urgent || notifyItems.some(item => !seen.has(notifyStage(item)));
    const seller = document.body.classList.contains('seller-app-premium');
    const shop = ['online_shop', 'pos_kasir'].includes(document.documentElement.dataset.businessTemplate);
    const label = notifyItems.length ? `Notifikasi: ${notifyItems.length} ${seller || shop ? 'pengingat' : 'order belum tuntas'}` : 'Notifikasi';
    qa('#kairo-notif-btn, #kairo-mobile-notif-btn').forEach(btn => {
      const dot = q('.kairo-notif-dot', btn);
      if (dot) { dot.hidden = !unseen; dot.classList.toggle('is-urgent', urgent); }
      btn.setAttribute('aria-label', label);
    });
    const html = notifyItems.length
      ? notifyItems.map(item => `<div class="kairo-notif-item${item.urgent ? ' is-urgent' : ''}"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.pkg)}</span></div><em>${item.note ? escapeHtml(item.note) : `${item.status ? `${escapeHtml(item.status)} · ` : ''}${item.urgent ? 'Lewat 30 menit · ' : ''}${escapeHtml(notifyAge(item.minutes))}`}</em></div>`).join('')
      : `<div class="kairo-notif-empty">${seller ? 'Tidak ada akun yang akan expired dan semua order sudah selesai.' : shop ? 'Semua order selesai dan stok aman.' : 'Semua order sudah ditandai selesai.'}</div>`;
    qa('#kairo-notif-list, #kairo-mobile-notif-list').forEach(list => { if (list.innerHTML !== html) list.innerHTML = html; });
    // Judul panel ikut jenis usaha: seller tidak memakai istilah "Start Reading".
    const [title, sub] = seller ? ['Pengingat', 'Akun pelanggan yang akan expired & order belum selesai'] : shop ? ['Pengingat', 'Order belum tuntas dan stok menipis'] : ['Order belum tuntas', 'Lebih dari 5 menit sejak ' + (document.documentElement.dataset.businessTemplate === 'online_shop' ? 'Waktu Order' : 'Start Reading')];
    qa('.kairo-notif-head strong, #kairo-mobile-notif-sheet .kairo-mobile-sheet-head strong').forEach(el => { if (el.textContent !== title) el.textContent = title; });
    qa('.kairo-notif-head span, #kairo-mobile-notif-sheet .kairo-mobile-sheet-head small').forEach(el => { if (el.textContent !== sub) el.textContent = sub; });
  }

  window.kairoNotifications = {
    render: renderNotifications,
    refresh: refreshNotifications,
    open: () => refreshNotifications().then(markNotificationsSeen)
  };

  let notifyRefreshTimer = null;

  async function refreshNotifications() {
    // Keep the bell right next to the dark-mode toggle (the auto-lock control is inserted later).
    const theme = q('#saas-theme-toggle');
    const wrap = q('.kairo-notif');
    if (theme && wrap && theme.previousElementSibling !== wrap) theme.before(wrap);
    notifyItems = await collectNotifications();
    renderNotifications();
  }

  function scheduleNotificationRefresh() {
    clearTimeout(notifyRefreshTimer);
    notifyRefreshTimer = setTimeout(refreshNotifications, 300);
  }

  function markNotificationsSeen() {
    try { localStorage.setItem(notifySeenKey(), JSON.stringify(notifyItems.map(notifyStage))); } catch (_) {}
    renderNotifications();
  }

  function toggleNotifications(open) {
    const panel = q('#kairo-notif-panel');
    const btn = q('#kairo-notif-btn');
    if (!panel || !btn) return;
    const next = typeof open === 'boolean' ? open : panel.hidden;
    panel.hidden = !next;
    btn.setAttribute('aria-expanded', String(next));
    if (next) refreshNotifications().then(markNotificationsSeen);
  }

  // Panduan pemakaian (owner Okt 2026): tombol buku di samping lonceng (desktop) + item "Panduan" di menu More (HP).
  // Isi & gaya ada di assets/kairo-guide.js/.css, baru dimuat saat pertama kali dibuka supaya dashboard tetap ringan.
  const GUIDE_V = '1.1.1';
  let guideLoader = null;
  window.kairoOpenGuide = function () {
    if (!guideLoader) {
      guideLoader = new Promise((resolve, reject) => {
        if (window.kairoGuide) return resolve(window.kairoGuide);
        const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `assets/kairo-guide.css?v=${GUIDE_V}`; document.head.appendChild(css);
        const js = document.createElement('script'); js.src = `assets/kairo-guide.js?v=${GUIDE_V}`;
        js.onload = () => (window.kairoGuide ? resolve(window.kairoGuide) : reject(new Error('guide')));
        js.onerror = () => { guideLoader = null; reject(new Error('guide')); };
        document.head.appendChild(js);
      });
    }
    return guideLoader.then(g => g.open()).catch(() => window.showToast?.('Panduan gagal dimuat. Coba lagi.', 'error'));
  };
  function mountGuideButton(anchor) {
    if (!anchor || q('#kairo-guide-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'kairo-guide-btn'; btn.className = 'kairo-notif-btn kairo-guide-btn';
    btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Panduan'); btn.title = 'Panduan';
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8M8 10.5h6"/></svg>';
    btn.addEventListener('click', () => window.kairoOpenGuide());
    anchor.before(btn);
  }

  function mountNotifications() {
    const theme = q('#saas-theme-toggle');
    if (theme && q('#kairo-notif-btn')) mountGuideButton(q('.kairo-notif'));
    if (!theme || q('#kairo-notif-btn')) return;
    const wrap = document.createElement('div');
    wrap.className = 'kairo-notif';
    wrap.innerHTML = '<button type="button" id="kairo-notif-btn" class="kairo-notif-btn" aria-haspopup="true" aria-expanded="false" aria-label="Notifikasi" title="Notifikasi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0"/></svg><span class="kairo-notif-dot" hidden></span></button><div class="kairo-notif-panel" id="kairo-notif-panel" role="dialog" aria-label="Notifikasi order" hidden><div class="kairo-notif-head"><strong>Order belum tuntas</strong><span>Lebih dari 5 menit sejak Start Reading</span></div><div class="kairo-notif-list" id="kairo-notif-list"></div><button type="button" class="kairo-notif-open">Lihat Riwayat Transaksi</button></div>';
    theme.before(wrap);
    mountGuideButton(wrap);
    q('#kairo-notif-btn', wrap).addEventListener('click', event => { event.stopPropagation(); toggleNotifications(); });
    q('.kairo-notif-open', wrap).addEventListener('click', () => {
      toggleNotifications(false);
      if (window.innerWidth <= 900 && typeof window.kairoOpenMobileHistory === 'function') return window.kairoOpenMobileHistory();
      q('#saas-sidebar .tab[data-tab="dashboard"]')?.click();
      setTimeout(() => q('#transaction-history-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    });
    document.addEventListener('click', event => { if (!wrap.contains(event.target)) toggleNotifications(false); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') toggleNotifications(false); });
    refreshNotifications();
    setInterval(() => { if (!document.hidden) refreshNotifications(); }, 30000);
    document.addEventListener('kairo:refreshed', scheduleNotificationRefresh);
  }

  function boot() {
    const landing = q('#kairo-entry');
    if (landing) bindLanding(landing);
    mountDashboardHeader();
    mountNotifications();
    syncLayoutColors();
    new MutationObserver(syncLayoutColors).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    bindLayoutColorReset();
    const historyBody = q('#tx-table-body');
    if (historyBody) {
      enhanceHistoryRows();
      new MutationObserver(() => { enhanceHistoryRows(); scheduleNotificationRefresh(); }).observe(historyBody, { childList: true });
    }
    new MutationObserver(() => {
      if (document.body.classList.contains('authenticated')) {
        if (pendingRemember) {
          setRememberedUsername(pendingRemember.remember ? pendingRemember.username : '');
          pendingRemember = null;
        }
        closeLogin({ restoreFocus: false });
        mountDashboardHeader();
        mountNotifications();
        scheduleNotificationRefresh();
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

// Orders: when a required field is missed, scroll to the first one, focus it and give it a
// short shake + red outline (instead of the browser's small bubble). Covers the native
// required fields and the package/topic checks that kairo-app.js does on submit.
(function () {
  const MISSING = 'kairo-field-missing';
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const groupOf = el => el.closest('.form-group, .full, .seller-app-field') || el;
  const labelOf = el => (groupOf(el).querySelector('.label, label')?.textContent || '').replace(/\(.*?\)/g, '').trim();
  let batch = null;
  // Replace the previous reminder instead of stacking a new one on every tap.
  const dropReminder = () => document.querySelectorAll('#toast .kairo-toast').forEach(t => {
    if (/Lengkapi dulu:/.test(t.textContent)) { clearTimeout(t._timer); t.remove(); }
  });

  function point(el) {
    const group = groupOf(el);
    if (!group.offsetParent) return;
    const rect = group.getBoundingClientRect();
    const inView = rect.top >= 80 && rect.bottom <= window.innerHeight - 100;
    if (!inView) group.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    const focusable = el.matches('select') ? group.querySelector('.sh-select-trigger') || el : el.matches('input,textarea') ? el : group.querySelector('input,button');
    try { focusable?.focus({ preventScroll: true }); } catch (_e) {}
    group.classList.remove('kairo-field-shake');
    setTimeout(() => { void group.offsetWidth; group.classList.add('kairo-field-shake'); }, inView ? 0 : 320);
    setTimeout(() => group.classList.remove('kairo-field-shake'), (inView ? 0 : 320) + 600);
  }

  document.addEventListener('invalid', event => {
    const field = event.target;
    if (field.form?.id !== 'tx-form') return;
    event.preventDefault();
    groupOf(field).classList.add(MISSING);
    if (batch) { batch.push(field); return; }
    batch = [field];
    setTimeout(() => {
      const fields = batch; batch = null;
      point(fields[0]);
      const names = [...new Set(fields.map(labelOf).filter(Boolean))];
      dropReminder();
      if (typeof window.showToast === 'function') window.showToast(`Lengkapi dulu: ${names.join(', ')}.`, 'warning');
    }, 0);
  }, true);

  // Runs before the app's own submit handler, which then shows its error message.
  document.addEventListener('submit', event => {
    if (event.target.id !== 'tx-form' || typeof window.calculateTotal !== 'function') return;
    let order; try { order = window.calculateTotal(); } catch (_e) { return; }
    const target = !order?.packages?.length ? document.getElementById('tx-packages') : !order?.topics?.length ? document.getElementById('tx-topics') : null;
    dropReminder();
    if (!target || !target.offsetParent) return;
    groupOf(target).classList.add(MISSING);
    point(target);
  }, true);

  const clear = event => {
    if (!event.target.closest?.('#tx-form')) return;
    const group = event.target.closest('.' + MISSING);
    if (!group) return;
    const field = group.querySelector('input:not([type=hidden]),select,textarea');
    const ok = group.querySelector('.master-list') ? group.querySelector('input[type=checkbox]:checked') : !field || field.checkValidity();
    if (ok) group.classList.remove(MISSING);
  };
  document.addEventListener('input', clear, true);
  document.addEventListener('change', clear, true);
  document.addEventListener('reset', event => { if (event.target.id === 'tx-form') event.target.querySelectorAll('.' + MISSING).forEach(g => g.classList.remove(MISSING)); }, true);
})();

// Dashboard upgrade hint, one slim card under the stat cards (alur penjualan Okt 2026):
// - Gratis: ajakan upgrade; X = sembunyi 7 hari per workspace di perangkat ini.
// - Pro yang sudah habis (data-sub-state="lapsed"): "Masa aktif Pro sudah berakhir" + Perpanjang (X = 7 hari).
// - Pro tinggal <=7 hari (data-sub-state="renew"): pengingat perpanjang dengan tanggal berakhir (X = 1 hari).
(function () {
  const root = document.documentElement;
  const wid = () => { let id = ''; try { id = activeWorkspaceId || ''; } catch (_e) {} return id || 'default'; };
  const key = mode => (mode === 'renew' ? 'kairo_renew_hint_hidden_until_v1_' : 'kairo_upgrade_hint_hidden_until_v1_') + wid();
  const isFree = () => { let p = root.dataset.workspacePlan || ''; try { p = p || activeWorkspacePlan; } catch (_e) {} return String(p || 'basic').toLowerCase() === 'basic'; };
  const dismissed = mode => { try { return Number(localStorage.getItem(key(mode)) || 0) > Date.now(); } catch (_e) { return false; } };
  const mode = () => { const s = root.dataset.subState || ''; if (s === 'renew' && !isFree()) return 'renew'; if (!isFree()) return ''; return s === 'lapsed' ? 'lapsed' : 'upgrade'; };
  let original = null;
  function copy(hint, m) {
    const parts = { strong: hint.querySelector('.kairo-upgrade-hint-copy strong'), long: hint.querySelector('.is-long'), short: hint.querySelector('.is-short'), cta: hint.querySelector('[data-upgrade-cta]') };
    if (!original) original = Object.fromEntries(Object.entries(parts).map(([k, el]) => [k, el ? el.textContent : '']));
    // Online Shop tidak punya Open Store: daftar fitur Pro tanpa itu.
    const feats = root.dataset.businessTemplate === 'online_shop' ? 'Autofill Orders, Customer Database, Promo, Petty Cash, dan Export Excel' : 'Autofill Orders, Customer Database, Promo, Open Store, Petty Cash, dan Export Excel';
    let text = original ? { ...original, long: original.long.replace('Autofill Orders, Customer Database, Promo, Open Store, Petty Cash, dan Export Excel', feats) } : original;
    if (m === 'lapsed') text = { strong: 'Masa aktif Pro sudah berakhir', long: 'Workspace sementara memakai paket Gratis, data tetap aman. Perpanjang untuk membuka lagi semua fitur Pro.', short: 'Data tetap aman. Perpanjang untuk membuka fitur Pro lagi.', cta: 'Perpanjang Pro' };
    if (m === 'renew') {
      const end = Number(root.dataset.subEnd || 0), days = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
      const date = end ? new Date(end).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      const left = days <= 0 ? 'Berakhir hari ini.' : `Tinggal ${days} hari lagi.`;
      text = { strong: `Paket Pro berakhir ${date}`, long: `${left} Perpanjang sekarang supaya ${feats.replace('Autofill Orders', 'Autofill')} tetap bisa dipakai.`, short: `${left} Perpanjang supaya fitur Pro tetap aktif.`, cta: 'Perpanjang Pro' };
    }
    for (const k of Object.keys(parts)) if (parts[k] && parts[k].textContent !== text[k]) parts[k].textContent = text[k];
    const close = hint.querySelector('[data-upgrade-close]'), label = m === 'renew' ? 'Sembunyikan sampai besok' : 'Sembunyikan selama 7 hari';
    if (close && close.title !== label) { close.title = label; close.setAttribute('aria-label', label); }
    hint.setAttribute('aria-label', m === 'upgrade' ? 'Upgrade ke paket Pro' : 'Perpanjang paket Pro');
    hint.dataset.mode = m;
  }
  function sync() {
    const hint = document.getElementById('kairo-upgrade-hint');
    if (!hint) return;
    const m = mode();
    hint.hidden = !document.body.classList.contains('authenticated') || !m || dismissed(m);
    if (!hint.hidden) copy(hint, m);
  }
  document.addEventListener('click', event => {
    if (event.target.closest('#kairo-upgrade-hint [data-upgrade-cta]')) window.kairoRequestUpgrade?.();
    if (event.target.closest('#kairo-upgrade-hint [data-upgrade-close]')) {
      const m = mode();
      try { localStorage.setItem(key(m), String(Date.now() + (m === 'renew' ? 1 : 7) * 86400000)); } catch (_e) {}
      sync();
    }
  });
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-workspace-plan', 'data-sub-state', 'data-sub-end', 'data-business-template'] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
})();

// Ukuran teks dashboard (owner Okt 2026): 4 pilihan lewat slider di Settings › Workspace & Branding.
// Hanya ukuran HURUF yang dikali (--kfs); lebar kolom, padding, kartu & tabel tidak berubah. Caranya: setiap aturan CSS
// yang punya font-size (px/clamp/var) disalin jadi `html[data-kfs] <selector> { font-size: calc(<asli> * var(--kfs)) }`.
// Ukuran em/% tidak disalin karena otomatis ikut induknya. Disimpan per perangkat (seperti mode gelap), hanya saat login.
(function () {
  const KEY = 'kairo_font_scale_v1';
  const LEVELS = [{ v: 0.9, label: 'Kecil' }, { v: 1, label: 'Normal' }, { v: 1.1, label: 'Besar' }, { v: 1.2, label: 'Ekstra' }];
  const root = document.documentElement;
  let sheet = null, built = '', timer = 0;
  const saved = () => { try { const i = Number(localStorage.getItem(KEY)); return LEVELS[i] ? i : 1; } catch (_e) { return 1; } };
  const splitList = sel => { const out = []; let depth = 0, cur = ''; for (const ch of sel) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()).filter(Boolean); };
  const scope = sel => /^html(?=$|[.:#[\s>~+])/i.test(sel) ? sel.replace(/^html/i, 'html[data-kfs]') : /^:root/.test(sel) ? sel.replace(/^:root/, ':root[data-kfs]') : 'html[data-kfs] ' + sel;
  function convert(rules) {
    let css = '';
    for (const r of rules) {
      if (r.type === 1) {
        const fs = r.style.getPropertyValue('font-size').trim();
        if (!fs || /em|%|inherit|initial|unset|larger|smaller|calc\(.*kfs/i.test(fs)) continue;
        css += `${splitList(r.selectorText).map(scope).join(',')}{font-size:calc(${fs} * var(--kfs,1))${r.style.getPropertyPriority('font-size') ? ' !important' : ''}}\n`;
      } else if (r.cssRules && (r.type === 4 || r.type === 12)) {
        const inner = convert(r.cssRules);
        if (inner) css += `${r.type === 4 ? '@media ' + r.conditionText : '@supports ' + r.conditionText}{${inner}}\n`;
      }
    }
    return css;
  }
  function build() {
    let css = '';
    for (const s of document.styleSheets) {
      if (s.ownerNode === sheet) continue;
      try { css += convert(s.cssRules); } catch (_e) { /* lembar lintas domain: lewati */ }
    }
    if (!sheet) { sheet = document.createElement('style'); sheet.id = 'kairo-font-scale'; }
    if (css !== built) { sheet.textContent = css; built = css; }
    document.head.appendChild(sheet);
  }
  function apply() {
    const lv = LEVELS[saved()], on = lv.v !== 1 && document.body.classList.contains('authenticated');
    if (on) { if (!sheet) build(); root.style.setProperty('--kfs', String(lv.v)); root.dataset.kfs = String(lv.v); }
    else { delete root.dataset.kfs; root.style.removeProperty('--kfs'); }
    syncPicker();
  }
  // CSS yang dimuat belakangan (template seller, wizard) ikut dikonversi.
  new MutationObserver(muts => {
    if (!muts.some(m => [...m.addedNodes].some(n => n !== sheet && (n.tagName === 'LINK' || n.tagName === 'STYLE')))) return;
    clearTimeout(timer); timer = setTimeout(() => { if (sheet) build(); }, 400);
  }).observe(document.head, { childList: true });
  document.addEventListener('load', e => { if (sheet && e.target.tagName === 'LINK') { clearTimeout(timer); timer = setTimeout(build, 100); } }, true);
  new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Settings › Workspace & Branding: slider 4 pilihan, langsung berlaku.
  function syncPicker() {
    const box = document.getElementById('kairo-font-scale-picker'); if (!box) return;
    const i = saved(), input = box.querySelector('input');
    input.value = String(i); input.setAttribute('aria-valuetext', LEVELS[i].label);
    box.style.setProperty('--kfs-fill', `${(i / (LEVELS.length - 1)) * 100}%`);
    box.querySelectorAll('[data-kfs-opt]').forEach(b => b.classList.toggle('is-active', Number(b.dataset.kfsOpt) === i));
  }
  function set(i) { try { localStorage.setItem(KEY, String(i)); } catch (_e) {} apply(); }
  function mountPicker() {
    const form = document.getElementById('workspace-settings-form'), actions = form?.querySelector('.actions');
    if (!form || !actions || document.getElementById('kairo-font-scale-picker')) return;
    const box = document.createElement('div'); box.id = 'kairo-font-scale-picker'; box.className = 'full kairo-font-scale';
    box.innerHTML = `<div class="kairo-layout-colors-title">Ukuran Teks</div><div class="page-sub">Perbesar atau perkecil tulisan di seluruh dashboard. Ukuran kartu dan tabel tetap. Berlaku langsung di perangkat ini.</div>
      <div class="kairo-font-scale-control"><input type="range" min="0" max="${LEVELS.length - 1}" step="1" aria-label="Ukuran teks"><div class="kairo-font-scale-opts">${LEVELS.map((l, i) => `<button type="button" data-kfs-opt="${i}" style="--i:${i}">${l.label}</button>`).join('')}</div></div>`;
    actions.before(box);
    box.querySelector('input').addEventListener('input', e => set(Number(e.target.value)));
    box.querySelectorAll('[data-kfs-opt]').forEach(b => b.addEventListener('click', () => set(Number(b.dataset.kfsOpt))));
    syncPicker();
  }
  window.kairoFontScale = { levels: LEVELS, set, get: () => LEVELS[saved()].v };
  mountPicker(); apply();
  new MutationObserver(() => { if (!document.getElementById('kairo-font-scale-picker')) mountPicker(); }).observe(document.getElementById('settings') || document.body, { childList: true, subtree: true });
})();

/* ---- Kolom nominal Rupiah (owner Okt 2026) ----
   Orders (Tip, Penyesuaian Harga mode Nominal), Withdraw, Petty Cash: saat mengetik tampil "Rp150.000".
   Kolomnya tetap kolom yang sama: properti `value` elemen ini mengembalikan angka murni ("150000"), jadi semua kode lama
   (Number(el.value), reset form, template seller) tidak berubah. Mode Persentase di Penyesuaian Harga tidak diformat. */
(function () {
  'use strict';
  const IDS = ['tx-tip', 'tx-adjustment-value', 'payout-amount', 'cash-expense-amount', 'cash-injection-amount'];
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const raw = el => desc.get.call(el);
  const put = (el, v) => desc.set.call(el, v);
  const isMoney = el => el.id !== 'tx-adjustment-value' || document.getElementById('tx-adjustment-mode')?.value === 'fixed';
  const digits = v => String(v ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
  const money = d => (d === '' ? '' : 'Rp' + d.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  // Persentase: angka + satu tanda desimal (koma diterima, disimpan sebagai titik).
  const percent = v => { const s = String(v ?? '').replace(',', '.').replace(/[^\d.]/g, ''); const i = s.indexOf('.'); return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, ''); };

  function show(el) {
    const before = raw(el);
    const caret = el === document.activeElement ? el.selectionStart : null;
    const next = isMoney(el) ? money(digits(before)) : percent(before);
    if (next === before) return;
    // Kursor tetap di belakang digit yang sama (dihitung dari kanan).
    const right = caret == null ? 0 : before.slice(caret).replace(/\D/g, '').length;
    put(el, next);
    if (caret == null) return;
    let pos = next.length, seen = 0;
    while (pos > 0 && seen < right) { pos--; if (/\d/.test(next[pos])) seen++; }
    if (right === 0) pos = next.length;
    try { el.setSelectionRange(pos, pos); } catch (_e) {}
  }

  function setup(el) {
    if (!el || el.dataset.kairoMoney) return;
    el.dataset.kairoMoney = '1';
    el.type = 'text';
    el.inputMode = isMoney(el) ? 'numeric' : 'decimal';
    el.autocomplete = 'off';
    if (el.id !== 'tx-tip' && el.id !== 'tx-adjustment-value') el.placeholder = 'Rp0';
    Object.defineProperty(el, 'value', {
      configurable: true,
      get() { const v = raw(this); return isMoney(this) ? digits(v) : percent(v); },
      set(v) { put(this, isMoney(this) ? money(digits(v)) : percent(v)); }
    });
    el.addEventListener('input', () => show(el), true);
    show(el);
  }

  // Settings › Package & Harga / Add-on & Harga: harga dan modal tampil "Rp85.000" (baris dibuat ulang tiap render).
  function setupMasterMoney() {
    document.querySelectorAll('#settings-package-list, #settings-addon-list').forEach(host => {
      host.querySelectorAll('.settings-master-price, .settings-master-cost, .settings-master-manual').forEach(setup);
    });
  }
  new MutationObserver(setupMasterMoney).observe(document.getElementById('settings') || document.body, { childList: true, subtree: true });

  function init() {
    setupMasterMoney();
    IDS.forEach(id => setup(document.getElementById(id)));
    const mode = document.getElementById('tx-adjustment-mode');
    const adj = document.getElementById('tx-adjustment-value');
    mode?.addEventListener('change', () => {
      if (!adj) return;
      // Ganti mode: angka yang sudah diketik dipertahankan, hanya bentuk tampilannya yang berubah.
      const was = raw(adj);
      put(adj, isMoney(adj) ? money(digits(percent(was).split('.')[0])) : digits(was));
      adj.inputMode = isMoney(adj) ? 'numeric' : 'decimal';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* ---- Online Shop: istilah toko pada teks statis (Waktu Order / Produk / Kategori) ----
   Template online_shop memakai kerangka tampilan dasar; hanya teksnya yang disesuaikan.
   Nama Kategori mengikuti pengaturan user (topicFieldLabel). Template lain tidak tersentuh. */
(function () {
  'use strict';
  const root = document.documentElement;
  const isShop = () => ['online_shop', 'pos_kasir'].includes(root.dataset.businessTemplate);
  const topic = () => (typeof window.topicFieldLabel === 'function' ? window.topicFieldLabel() : 'Kategori');
  const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
  function apply() {
    if (!isShop()) return;
    const table = document.getElementById('tx-table-body')?.closest('table');
    table?.querySelectorAll('thead th').forEach(th => {
      const t = th.textContent.trim();
      if (t === 'Start Reading') setText(th, 'Waktu Order');
      else if (t === 'Paket') setText(th, 'Produk');
      else if (t === 'Topic') setText(th, topic());
    });
    const pk = document.getElementById('tx-packages')?.previousElementSibling;
    if (pk && pk.classList.contains('label')) setText(pk, 'Produk');
    document.querySelectorAll('#performance .card-title').forEach(el => {
      if (el.textContent.trim() === 'Penjualan Berdasarkan Paket') setText(el, 'Penjualan Berdasarkan Produk');
    });
    // Settings: "Package & Harga" -> "Produk & Harga" (menu samping, menu HP, judul kartu).
    document.querySelectorAll('#settings .card-title, .saas-settings-submenu-btn, .saas-settings-submenu-btn *, .kairo-mobile-settings-link *').forEach(el => {
      if (el.children.length) return;
      const t = el.textContent;
      if (/package & harga/i.test(t)) setText(el, t.replace('Package & Harga', 'Produk & Harga').replace('package & harga', 'produk & harga'));
    });
    const tc = document.getElementById('topic-selection-total')?.closest('.toolbar');
    setText(tc?.querySelector('.page-sub'), 'Jumlah pemilihan ' + topic().toLowerCase() + ' sesuai filter tanggal aktif.');
    document.querySelectorAll('#customers th').forEach(th => { if (th.textContent.trim() === 'Paket Favorit') setText(th, 'Produk Favorit'); });
    // Channel penjualan (marketplace/toko) menggantikan istilah "platform media sosial".
    const pl = document.getElementById('tx-platform')?.closest('.form-group')?.querySelector('.label');
    setText(pl, 'Platform Penjualan');
    const sn = document.getElementById('tx-social-name')?.closest('.form-group')?.querySelector('.label');
    setText(sn, 'Akun / Username Pembeli (Opsional)');
    document.querySelectorAll('#performance .card-title').forEach(el => {
      const t = el.textContent.trim();
      if (t === 'Performa Platform Media Sosial') setText(el, 'Performa Platform Penjualan');
      else if (t === 'Perkembangan Platform') setText(el, 'Perkembangan Platform');
    });
  }
  let t = 0;
  const later = () => { clearTimeout(t); t = setTimeout(apply, 50); };
  new MutationObserver(later).observe(root, { attributes: true, attributeFilter: ['data-business-template'] });
  document.addEventListener('kairo:template-ready', later);
  document.addEventListener('kairo:refreshed', later);
  document.addEventListener('click', later, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later); else later();
})();
