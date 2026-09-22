/* KAIRO UI V3 — presentation only. No database or business-logic writes. */
(() => {
  'use strict';
  let queuedLoginSubmit = false;
  let loginReturnFocus = null;

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function openLogin(event) {
    window.__kairoEnsureRuntime?.().catch(() => {});
    const dialog = q('#kairo-login-dialog');
    if (!dialog) return;
    loginReturnFocus = event?.currentTarget || document.activeElement;
    dialog.hidden = false;
    document.body.classList.add('kairo-dialog-open');
    requestAnimationFrame(() => {
      dialog.classList.add('is-open');
      q('#login-username', dialog)?.focus({ preventScroll: true });
    });
  }

  function closeLogin({ restoreFocus = true } = {}) {
    const dialog = q('#kairo-login-dialog');
    if (!dialog || dialog.hidden) return;
    dialog.classList.remove('is-open');
    document.body.classList.remove('kairo-dialog-open');
    dialog.hidden = true;
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

  function bindLanding(root) {
    qa('[data-v3-login]', root).forEach(button => button.addEventListener('click', openLogin));
    qa('[data-v3-signup]', root).forEach(button => button.addEventListener('click', openSignup));
    qa('[data-login-close]', root).forEach(button => button.addEventListener('click', () => closeLogin()));
    qa('#kairo-entry-nav a', root).forEach(link => link.addEventListener('click', () => mobileMenu(false)));
    q('#kairo-menu-toggle', root)?.addEventListener('click', event => {
      const open = event.currentTarget.getAttribute('aria-expanded') !== 'true';
      mobileMenu(open);
    });
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
    const landing = q('#kairo-entry');
    if (landing) bindLanding(landing);
    mountDashboardHeader();
    new MutationObserver(() => {
      if (document.body.classList.contains('authenticated')) closeLogin({ restoreFocus: false });
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  document.addEventListener('submit', event => {
    if (event.target?.id !== 'login-form') return;
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
    if (event.target.closest('[data-tab="dashboard"], [data-mobile-tab="dashboard"], #saas-side-home')) setTimeout(mountDashboardHeader, 60);
    if (!event.target.closest('#kairo-entry-nav')) mobileMenu(false);
  }, true);
})();
