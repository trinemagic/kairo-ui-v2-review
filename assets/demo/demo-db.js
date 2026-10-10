/* KAIRO demo: klien "database" di dalam browser + masuk otomatis ke dashboard contoh.
   Hanya dimuat saat alamat berakhiran #demo / #demo-<template> (lihat index.html). Semua data hidup di memori halaman ini:
   tidak ada koneksi ke Supabase, perubahan hilang saat halaman dimuat ulang. */
(function () {
  'use strict';
  const kind = window.__kairoDemoKind || 'jasa';
  const META = window.__kairoDemoMeta || {};
  const T = window.__kairoDemoBuild(kind);
  const log = [];
  const session = {
    access_token: 'demo', expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: { id: 'demo-user', email: 'demo@kairoworkspaces.my.id', user_metadata: { username: 'demo', display_name: 'Pengunjung', business_template: (META[kind] || META.jasa).template } }
  };

  const same = (a, b) => (a === null || a === undefined ? b === null : String(a) === String(b));
  const match = (row, filters) => filters.every(([op, k, v]) => {
    const x = row[k];
    if (op === 'eq') return same(x, v);
    if (op === 'neq') return !same(x, v);
    if (op === 'is') return v === null ? x === null || x === undefined : x === v;
    if (op === 'lte') return String(x ?? '') <= String(v);
    if (op === 'gte') return String(x ?? '') >= String(v);
    if (op === 'lt') return String(x ?? '') < String(v);
    if (op === 'gt') return String(x ?? '') > String(v);
    if (op === 'in') return v.map(String).includes(String(x));
    return true;
  });
  const uid = () => 'd' + Math.random().toString(36).slice(2, 10);

  function builder(table) {
    const st = { op: 'select', filters: [], payload: null, single: false, order: null, range: null, head: false, conflict: null };
    const b = {
      select(_c, o) { if (o && o.head) st.head = true; return b; },
      order(k, o) { st.order = [k, !(o && o.ascending === false)]; return b; },
      limit() { return b; }, range(a, z) { st.range = [a, z]; return b; },
      eq(k, v) { st.filters.push(['eq', k, v]); return b; }, neq(k, v) { st.filters.push(['neq', k, v]); return b; },
      is(k, v) { st.filters.push(['is', k, v]); return b; },
      lte(k, v) { st.filters.push(['lte', k, v]); return b; }, gte(k, v) { st.filters.push(['gte', k, v]); return b; },
      lt(k, v) { st.filters.push(['lt', k, v]); return b; }, gt(k, v) { st.filters.push(['gt', k, v]); return b; },
      in(k, v) { st.filters.push(['in', k, v]); return b; },
      not() { return b; }, or() { return b; }, ilike() { return b; }, like() { return b; }, contains() { return b; },
      insert(p) { st.op = 'insert'; st.payload = p; return b; }, update(p) { st.op = 'update'; st.payload = p; return b; },
      upsert(p, o) { st.op = 'upsert'; st.payload = p; st.conflict = o && o.onConflict; return b; }, delete() { st.op = 'delete'; return b; },
      single() { st.single = true; return b; }, maybeSingle() { st.single = true; return b; },
      then(res, rej) {
        const rows = (T[table] = T[table] || []);
        log.push(st.op + ':' + table);
        let out;
        if (st.op === 'insert') {
          out = (Array.isArray(st.payload) ? st.payload : [st.payload]).map(r => ({ id: uid(), created_at: new Date().toISOString(), ...r }));
          rows.push(...out);
        } else if (st.op === 'update') { out = rows.filter(r => match(r, st.filters)); out.forEach(r => Object.assign(r, st.payload)); }
        else if (st.op === 'delete') { out = rows.filter(r => match(r, st.filters)); T[table] = rows.filter(r => !match(r, st.filters)); }
        else if (st.op === 'upsert') {
          const keys = st.conflict ? String(st.conflict).split(',').map(k => k.trim()) : null;
          out = (Array.isArray(st.payload) ? st.payload : [st.payload]).map(r => {
            const hit = keys && rows.find(x => keys.every(k => String(x[k]) === String(r[k])));
            if (hit) { Object.assign(hit, r); return hit; }
            const n = { id: uid(), created_at: new Date().toISOString(), ...r }; rows.push(n); return n;
          });
        } else {
          out = rows.filter(r => match(r, st.filters));
          if (st.order) { const [k, asc] = st.order; out = [...out].sort((a, z) => { const x = a[k], y = z[k]; return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1); }); }
          if (st.range) out = out.slice(st.range[0], st.range[1] + 1);
        }
        const count = out.length;
        return Promise.resolve({ data: st.head ? null : st.single ? (out[0] || null) : out, error: null, count }).then(res, rej);
      }
    };
    return b;
  }

  const files = {};
  const client = {
    from: builder,
    rpc: async () => ({ data: null, error: null }),
    channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
    removeChannel() {},
    // Foto yang diunggah di demo hanya hidup di halaman ini (URL blob), tidak dikirim ke mana pun.
    storage: { from: () => ({ async upload(path, file) { try { files[path] = URL.createObjectURL(file); } catch (_e) { /* tanpa pratinjau */ } return { data: { path }, error: null }; }, async remove() { return { data: [], error: null }; }, getPublicUrl(path) { return { data: { publicUrl: files[path] || 'assets/brand/kairo-app-icon.svg' } }; } }) },
    auth: { getSession: async () => ({ data: { session }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}), getUser: async () => ({ data: { user: session.user } }) }
  };
  // Pustaka asli (CDN) tidak dipakai di mode demo: window.supabase dikunci ke klien contoh ini.
  Object.defineProperty(window, 'supabase', { configurable: true, get: () => ({ createClient: () => client }), set: () => {} });
  window.__kairoDemo = { kind, tables: T, log };

  function leave(signup) {
    ['trine_active_workspace_id_v1', 'kairo_ws_theme_v1_demo-ws'].forEach(k => { try { localStorage.removeItem(k); } catch (_e) { /* private mode */ } });
    if (signup) { try { sessionStorage.setItem('kairo_demo_signup', '1'); } catch (_e) { /* private mode */ } }
    history.replaceState(null, '', location.pathname + location.search);
    location.reload();
  }

  function banner() {
    if (document.getElementById('kairo-demo-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'kairo-demo-bar';
    const opts = Object.keys(META).map(k => `<option value="${k}" ${k === kind ? 'selected' : ''}>${META[k].label}</option>`).join('');
    bar.innerHTML = `<span class="kdb-tag" title="Data contoh, perubahan tidak disimpan.">DEMO</span><span class="kdb-text">Data contoh, perubahan tidak disimpan.</span><label class="kdb-switch"><span class="kdb-sr">Template</span><select aria-label="Ganti template demo">${opts}</select></label><button type="button" class="kdb-cta">Daftar Gratis</button><button type="button" class="kdb-exit" title="Keluar dari demo">Keluar</button>`;
    document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector('select').addEventListener('change', e => { location.hash = '#demo-' + e.target.value; location.reload(); });
    bar.querySelector('.kdb-cta').addEventListener('click', () => leave(true));
    bar.querySelector('.kdb-exit').addEventListener('click', () => leave(false));
    document.documentElement.classList.add('kairo-demo-on');
  }

  function guards() {
    try { setPeriod('30days'); } catch (_e) { /* belum siap */ }
    window.exportExcel = () => { try { showToast('Export Excel tidak tersedia di mode demo.', 'info'); } catch (_e) { /* belum siap */ } };
  }

  let tries = 0;
  const timer = setInterval(() => {
    if (++tries > 400) return clearInterval(timer);
    if (typeof handleAuthSession !== 'function' || !document.body || !document.body.classList.contains('auth-locked')) return;
    clearInterval(timer);
    handleAuthSession(session).then(() => { banner(); guards(); });
  }, 50);
})();
