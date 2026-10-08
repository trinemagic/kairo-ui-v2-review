/* KAIRO — Login PIN di perangkat ini (owner Okt 2026).
   Password TIDAK disimpan. Setelah login password, user boleh membuat PIN 6 angka: token pembaruan sesi dienkripsi
   (AES-GCM, kunci dari PIN lewat PBKDF2) dan disimpan di localStorage perangkat ini. Masuk dengan PIN = dekripsi token
   lalu db.auth.refreshSession(). Salah 5 kali = data PIN dihapus, wajib login password. Logout/auto-lock saat PIN aktif
   hanya melupakan sesi di memori (tidak mencabut token di server) supaya PIN tetap bisa dipakai lagi. */
(function () {
  'use strict';
  const KEY = 'kairo_pin_v1', TRIES = 'kairo_pin_tries_v1', MAX = 5, ITER = 600000, LEN = 6;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const q = (s, r = document) => r.querySelector(s);
  const demo = () => Boolean(window.__kairoDemoKind);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_e) {} }
  };
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const supported = () => Boolean(window.crypto?.subtle) && !demo();

  function blob() { try { return JSON.parse(store.get(KEY) || 'null'); } catch (_e) { return null; } }
  const active = () => supported() && Boolean(blob()?.ct);
  const tries = () => Number(store.get(TRIES) || 0) || 0;
  function wipe() { store.del(KEY); store.del(TRIES); memKey = null; memSalt = null; sync(); }

  let memKey = null, memSalt = null; // kunci turunan PIN, hanya di memori selama sesi berjalan

  async function derive(pin, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(session) {
    if (!memKey || !memSalt || !session?.refresh_token || !session?.user?.id) return;
    const iv = crypto.getRandomValues(new Uint8Array(12)), uid = session.user.id;
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(uid) }, memKey, enc.encode(JSON.stringify({ rt: session.refresh_token })));
    const old = blob();
    store.set(KEY, JSON.stringify({ v: 1, uid, name: session.user.user_metadata?.username || old?.name || '', salt: b64(memSalt), iv: b64(iv), ct: b64(ct) }));
  }

  async function createPin(pin) {
    const { data } = await db.auth.getSession();
    if (!data?.session) throw new Error('Masuk dulu dengan password.');
    memSalt = crypto.getRandomValues(new Uint8Array(16));
    memKey = await derive(pin, memSalt);
    await seal(data.session);
    store.del(TRIES);
    sync();
  }

  // Dipanggil setiap sesi diperbarui supaya token terbaru selalu tersimpan.
  db.auth.onAuthStateChange((ev, session) => {
    if (session && memKey && (ev === 'TOKEN_REFRESHED' || ev === 'SIGNED_IN')) seal(session).catch(() => {});
  });

  async function unlock(pin) {
    const b = blob();
    if (!b?.ct) return { ok: false, gone: true, msg: 'PIN belum diatur. Masuk dengan password.' };
    if (tries() >= MAX) { wipe(); return { ok: false, gone: true, msg: 'PIN dikunci. Masuk dengan password.' }; }
    store.set(TRIES, String(tries() + 1)); // dihitung dulu: menutup tab di tengah percobaan tidak memberi percobaan gratis
    let rt;
    try {
      const salt = unb64(b.salt), key = await derive(pin, salt);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(b.iv), additionalData: enc.encode(b.uid) }, key, unb64(b.ct));
      rt = JSON.parse(dec.decode(plain)).rt;
      memKey = key; memSalt = salt;
    } catch (_e) {
      const left = MAX - tries();
      if (left <= 0) { wipe(); return { ok: false, gone: true, msg: 'PIN salah 5 kali. PIN dihapus, masuk dengan password.' }; }
      return { ok: false, msg: `PIN salah. Sisa percobaan: ${left}.` };
    }
    const { error } = await db.auth.refreshSession({ refresh_token: rt });
    if (error) {
      memKey = null; memSalt = null;
      if (/fetch|network|timeout/i.test(error.message || '') || error.name === 'AuthRetryableFetchError') {
        store.set(TRIES, String(Math.max(0, tries() - 1)));
        return { ok: false, msg: 'Tidak bisa terhubung. Cek internet lalu coba lagi.' };
      }
      wipe();
      return { ok: false, gone: true, msg: 'Sesi PIN sudah kedaluwarsa. Masuk dengan password lalu atur PIN lagi.' };
    }
    store.del(TRIES);
    return { ok: true };
  }

  /* ---------- keypad ---------- */
  function pad({ title, sub, onDone }) {
    const el = document.createElement('div');
    el.className = 'kairo-pin-pad';
    el.innerHTML = `<div class="kairo-pin-title">${title}</div><div class="kairo-pin-sub">${sub || ''}</div>
      <div class="kairo-pin-dots" aria-hidden="true">${'<i></i>'.repeat(LEN)}</div>
      <div class="kairo-pin-msg" role="alert"></div>
      <div class="kairo-pin-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join('')}<span></span><button type="button" data-k="0">0</button><button type="button" data-k="del" aria-label="Hapus angka">⌫</button></div>`;
    let v = '', busy = false;
    const dots = [...el.querySelectorAll('.kairo-pin-dots i')], msg = q('.kairo-pin-msg', el);
    const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < v.length));
    const api = {
      el, reset() { v = ''; paint(); },
      say(t, bad) { msg.textContent = t || ''; msg.classList.toggle('bad', Boolean(bad)); },
      lock(on) { busy = on; el.classList.toggle('is-busy', on); }
    };
    async function press(k) {
      if (busy) return;
      if (k === 'del') v = v.slice(0, -1); else if (v.length < LEN) v += k;
      paint(); msg.textContent = '';
      if (v.length === LEN) { const pin = v; await onDone(pin, api); }
    }
    el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
    el.tabIndex = -1;
    el.addEventListener('keydown', e => {
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); press('del'); }
    });
    return api;
  }

  /* ---------- masuk dengan PIN (dialog Masuk) ---------- */
  function mountLogin() {
    const card = q('#kairo-login-dialog .kairo-login-card'), form = q('#login-form');
    if (!card || !form) return;
    let box = q('#kairo-pin-login');
    if (!active()) { if (box) box.remove(); form.hidden = false; card.classList.remove('has-pin'); return; }
    if (box || card.classList.contains('pin-off')) return;
    const b = blob();
    const p = pad({
      title: 'Masukkan PIN', sub: b.name ? `Masuk sebagai <b>${b.name.replace(/[&<>"]/g, '')}</b>` : 'PIN 6 angka perangkat ini',
      async onDone(pin, api) {
        api.lock(true); api.say('Memeriksa…');
        const r = await unlock(pin);
        api.lock(false);
        if (r.ok) return; // dashboard dibuka oleh alur login biasa
        api.reset(); api.say(r.msg, true);
        if (r.gone) setTimeout(mountLogin, 1200);
      }
    });
    box = document.createElement('div'); box.id = 'kairo-pin-login';
    box.appendChild(p.el);
    const alt = document.createElement('button'); alt.type = 'button'; alt.className = 'kairo-pin-alt'; alt.textContent = 'Pakai password';
    alt.onclick = () => { card.classList.add('pin-off'); card.classList.remove('has-pin'); box.remove(); form.hidden = false; q('#login-password')?.focus(); };
    box.appendChild(alt);
    form.before(box); form.hidden = true; card.classList.add('has-pin');
    setTimeout(() => p.el.focus({ preventScroll: true }), 80);
  }
  new MutationObserver(() => {
    const d = q('#kairo-login-dialog');
    if (d && !d.hidden) mountLogin(); else q('#kairo-login-dialog .kairo-login-card')?.classList.remove('pin-off');
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });

  /* ---------- Settings › Workspace & Branding ---------- */
  function openSetup(replacing) {
    const wrap = document.createElement('div'); wrap.className = 'kairo-pin-modal'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    const card = document.createElement('div'); card.className = 'kairo-pin-modal-card';
    const close = () => { wrap.remove(); };
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    let first = null;
    const step1 = () => pad({
      title: replacing ? 'Buat PIN baru' : 'Buat PIN', sub: '6 angka. Hanya berlaku di perangkat ini.',
      onDone(pin) { first = pin; show(step2()); }
    });
    const step2 = () => pad({
      title: 'Ulangi PIN', sub: 'Masukkan PIN yang sama sekali lagi.',
      async onDone(pin, api) {
        if (pin !== first) { api.reset(); api.say('PIN tidak sama. Ulangi dari awal.', true); setTimeout(() => show(step1()), 900); return; }
        api.lock(true); api.say('Menyimpan…');
        try { await createPin(pin); close(); window.showToast?.('PIN login aktif di perangkat ini.', 'success'); }
        catch (err) { api.lock(false); api.reset(); api.say(String(err.message || 'Gagal menyimpan PIN.'), true); }
      }
    });
    function show(p) {
      card.innerHTML = ''; card.appendChild(p.el);
      const x = document.createElement('button'); x.type = 'button'; x.className = 'kairo-pin-alt'; x.textContent = 'Batal'; x.onclick = close; card.appendChild(x);
      setTimeout(() => p.el.focus({ preventScroll: true }), 50);
    }
    wrap.appendChild(card); document.body.appendChild(wrap); show(step1());
  }

  function sync() {
    const box = q('#kairo-pin-settings'); if (!box) return;
    const on = active();
    q('.kairo-pin-state', box).textContent = on ? 'Aktif di perangkat ini' : 'Belum aktif';
    q('[data-pin-set]', box).textContent = on ? 'Ganti PIN' : 'Aktifkan PIN';
    q('[data-pin-del]', box).hidden = !on;
  }
  function mountSettings() {
    if (!supported()) return;
    const form = q('#workspace-settings-form'), actions = form?.querySelector('.actions');
    if (!form || !actions || q('#kairo-pin-settings')) return;
    const box = document.createElement('div'); box.id = 'kairo-pin-settings'; box.className = 'full kairo-pin-settings';
    box.innerHTML = `<div class="kairo-layout-colors-title">PIN Login</div>
      <div class="page-sub">Masuk lebih cepat di HP ini dengan PIN 6 angka. Salah 5 kali, PIN dihapus dan kamu harus masuk dengan password. Password tidak disimpan.</div>
      <div class="kairo-pin-row"><span class="kairo-pin-state"></span><span class="kairo-pin-btns"><button type="button" class="btn btn-outline" data-pin-set></button><button type="button" class="btn btn-outline" data-pin-del hidden>Hapus PIN</button></span></div>`;
    actions.before(box);
    q('[data-pin-set]', box).onclick = () => openSetup(active());
    q('[data-pin-del]', box).onclick = () => { if (confirm('Hapus PIN di perangkat ini? Kamu masuk lagi dengan password.')) { wipe(); window.showToast?.('PIN dihapus.', 'info'); } };
    sync();
  }
  mountSettings();
  new MutationObserver(() => { if (!q('#kairo-pin-settings')) mountSettings(); }).observe(document.getElementById('settings') || document.body, { childList: true, subtree: true });

  window.kairoPin = { active, wipe };
})();
