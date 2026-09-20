/* KAIRO Runtime Loader v3.2
   Loads Supabase + the legacy-compatible application only when authentication
   is actually requested. The public landing stays independent and fast. */
(() => {
  'use strict';

  let runtimePromise = null;
  let replayingSubmit = false;

  function loadScript(src, id) {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.ready === '1') return Promise.resolve();
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.addEventListener('load', () => { script.dataset.ready = '1'; resolve(); }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Gagal memuat ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function setPreparing(active) {
    const button = document.getElementById('login-button');
    if (!button) return;
    button.disabled = active;
    if (active) button.dataset.runtimeLabel = button.textContent || 'Masuk';
    button.textContent = active ? 'Menyiapkan KAIRO...' : (button.dataset.runtimeLabel || 'Masuk');
  }

  function ensureRuntime() {
    if (window.__KAIRO_APP_READY__) return Promise.resolve();
    if (runtimePromise) return runtimePromise;
    setPreparing(true);
    runtimePromise = loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'kairo-supabase-runtime')
      .then(() => loadScript('assets/kairo-app.js?v=20.10.147', 'kairo-app-runtime'))
      .then(() => { window.__KAIRO_APP_READY__ = true; })
      .catch(error => {
        runtimePromise = null;
        console.error('KAIRO runtime:', error);
        const authError = document.getElementById('auth-error');
        if (authError) { authError.textContent = 'Koneksi aplikasi gagal dimuat. Periksa internet lalu coba lagi.'; authError.style.display = 'block'; }
        throw error;
      })
      .finally(() => setPreparing(false));
    return runtimePromise;
  }

  window.__kairoEnsureRuntime = ensureRuntime;

  document.addEventListener('focusin', event => {
    if (event.target.closest('#login-form')) ensureRuntime().catch(() => {});
  }, true);
  document.addEventListener('pointerenter', event => {
    if (event.target.closest('#login-form, [data-v3-login], [data-v3-signup]')) ensureRuntime().catch(() => {});
  }, true);
  document.addEventListener('submit', event => {
    if (event.target?.id !== 'login-form' || window.__KAIRO_APP_READY__ || replayingSubmit) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ensureRuntime().then(() => {
      replayingSubmit = true;
      event.target.requestSubmit();
      replayingSubmit = false;
    }).catch(() => {});
  }, true);
})();
