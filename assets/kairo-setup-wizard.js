/* KAIRO Setup Wizard (owner Okt 2026, tahap 2).
   Muncul sekali untuk workspace yang baru jadi Pro (setelah admin mencatat pembayaran), semua template.
   - Dimuat oleh kairo-app.js (maybeStartSetupWizard) hanya bila perlu; status di workspace_branding.setup_state:
     {dismissed_at, banner_logins, completed_at, steps:{id:'done'|'skipped'}, products:[...]}.
   - "Nanti saja" / tutup = banner "Lanjutkan setup toko" di Dashboard, maksimal 3 kali login berikutnya.
   - Setiap langkah memakai fitur yang sudah ada (tema, Settings › Produk / Package, Pembagian Omzet + Kas,
     Struk & Wording, upload logo). Tidak ada tabel/fitur baru. Semua langkah bisa dilewati. */
(function () {
  'use strict';
  const ICON = {
    spark: '<path d="M12 3l1.8 5.6L19.5 10l-5.7 1.6L12 17l-1.8-5.4L4.5 10l5.7-1.4z"/>',
    check: '<path d="m5 12 4 4 10-10"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    up: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    store: '<path d="M4 10h16v10H4z"/><path d="M3 10l2-6h14l2 6M9 20v-5h6v5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/>'
  };
  const ic = k => `<svg class="ksw-i" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rp = n => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  // Profit per baris; minus (modal > harga jual) ditulis merah supaya kerugian kelihatan.
  const profit = (price, cost) => { const v = (Number(price) || 0) - (Number(cost) || 0); return `<span class="ksw-ml">Profit</span><span class="${v < 0 ? 'is-loss' : ''}">${v < 0 ? '−' : ''}${rp(Math.abs(v))}</span>`; };
  const num = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const sellerWs = () => document.documentElement.dataset.businessTemplate === 'digital_subscription';
  const toast = (m, t) => { try { showToast(m, t); } catch (_e) {} };

  let S = {};          // setup_state
  let steps = [], cur = -1, root = null, busy = false, lastFocus = null;
  const out = {};      // ringkasan tiap langkah untuk layar selesai
  const D = {};        // nilai kerja tiap langkah (bertahan saat Kembali/Lanjut)

  const DEF = {
    theme: { title: 'Tema & warna', sub: 'tampilan toko' },
    products: { title: 'Produk', sub: 'aplikasi yang dijual' },
    prices: { title: 'Harga & modal', sub: 'profit otomatis' },
    packages: { title: 'Paket & harga', sub: 'layanan yang dijual' },
    cash: { title: 'Kas & omzet', sub: 'pembagian laba' },
    receipt: { title: 'Struk', sub: 'isi & desain' },
    logo: { title: 'Logo', sub: 'opsional' }
  };
  function buildSteps() {
    const list = [];
    // Tema untuk semua template usaha (owner Okt 2026; dulu hanya seller).
    if (window.kairoThemeSetup?.allowed()) list.push('theme');
    if (sellerWs()) list.push('products', 'prices');
    else list.push('packages');
    list.push('cash', 'receipt', 'logo');
    return list;
  }

  async function saveState(patch) {
    S = { ...S, ...patch };
    try {
      const { error } = await db.from('workspace_branding').upsert({ workspace_id: requireWorkspaceId(), setup_state: S, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
      if (error) throw error;
      activeWorkspaceBranding = { ...(activeWorkspaceBranding || {}), setup_state: S };
    } catch (err) { console.warn('Setup wizard state:', err?.message || err); }
  }

  async function waitReady() {
    const t0 = Date.now();
    const ready = () => document.body.classList.contains('authenticated') && !document.documentElement.classList.contains('kairo-template-pending') &&
      (!sellerWs() || (document.body.classList.contains('seller-app-premium') && window.kairoSellerCatalog?.ready()));
    while (!ready() && Date.now() - t0 < 9000) await new Promise(r => setTimeout(r, 150));
    return document.body.classList.contains('authenticated');
  }

  async function boot(state) {
    S = { ...(state || {}) };
    if (!(await waitReady())) return;
    if (!S.dismissed_at) { open(-1); return; }
    await saveState({ banner_logins: Number(S.banner_logins || 0) + 1 });
    showBanner();
  }

  /* ---------- banner (setelah "Nanti saja") ---------- */
  function showBanner() {
    let el = document.getElementById('kairo-setup-banner');
    if (!el) {
      el = document.createElement('aside');
      el.id = 'kairo-setup-banner'; el.className = 'ksw-banner'; el.setAttribute('aria-label', 'Lanjutkan setup toko');
      const hint = document.getElementById('kairo-upgrade-hint');
      if (hint) hint.after(el); else document.getElementById('dashboard')?.prepend(el);
    }
    const all = buildSteps(), left = all.filter(id => !S.steps?.[id]).length || all.length;
    el.innerHTML = `<span class="ksw-banner-icon" aria-hidden="true">${ic('spark')}</span><div class="ksw-banner-copy"><strong>Lanjutkan setup toko</strong><span>Tinggal ${left} langkah singkat biar dashboard siap dipakai jualan.</span></div><div class="ksw-banner-actions"><button type="button" class="ksw-banner-cta" data-ksw-resume>Lanjutkan</button><button type="button" class="ksw-banner-close" data-ksw-hide aria-label="Sembunyikan" title="Sembunyikan">${ic('x')}</button></div>`;
    el.hidden = false;
    el.querySelector('[data-ksw-resume]').onclick = () => { el.remove(); steps = buildSteps(); const i = steps.findIndex(id => !S.steps?.[id]); open(i < 0 ? 0 : i); };
    el.querySelector('[data-ksw-hide]').onclick = () => { el.hidden = true; };
  }

  /* ---------- dialog ---------- */
  function open(index) {
    steps = buildSteps(); cur = index;
    if (!root) {
      lastFocus = document.activeElement;
      root = document.createElement('div'); root.id = 'kairo-setup'; root.className = 'ksw';
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'ksw-title');
      root.innerHTML = '<div class="ksw-scrim"></div><div class="ksw-dialog"></div>';
      document.body.appendChild(root);
      root.addEventListener('keydown', e => { if (e.key === 'Escape' && !busy) { e.preventDefault(); later(); } });
      document.documentElement.classList.add('ksw-open');
    }
    render();
  }
  function close() {
    root?.remove(); root = null; document.documentElement.classList.remove('ksw-open');
    try { lastFocus?.focus?.(); } catch (_e) {}
  }
  async function later() {
    if (steps[cur] === 'theme') window.kairoThemeSetup?.revert();
    close();
    if (Object.values(out).some(Boolean)) { try { refreshAll(); } catch (_e) {} }
    if (!S.dismissed_at && !S.completed_at) { await saveState({ dismissed_at: new Date().toISOString(), banner_logins: 0 }); toast('Oke! Setup toko bisa dilanjutkan dari Dashboard di login berikutnya.', 'info'); }
  }

  function render() {
    const box = root.querySelector('.ksw-dialog');
    if (cur < 0) { box.className = 'ksw-dialog is-hero'; box.innerHTML = welcomeHtml(); }
    else if (cur >= steps.length) { box.className = 'ksw-dialog is-hero'; box.innerHTML = doneHtml(); }
    else {
      const id = steps[cur], st = STEP[id];
      st.init?.();
      box.className = 'ksw-dialog';
      box.innerHTML = railHtml() + `<section class="ksw-pane" data-step="${id}"><button type="button" class="ksw-x" data-ksw-later aria-label="Tutup, lanjutkan nanti" title="Tutup, lanjutkan nanti">${ic('x')}</button><div class="ksw-kick">Langkah ${cur + 1} dari ${steps.length}</div><h2 id="ksw-title" tabindex="-1">${esc(st.title())}</h2><p class="ksw-lead">${st.lead()}</p><div class="ksw-body">${st.html()}</div><div class="ksw-bar"><div class="ksw-bar-l">${cur > 0 ? '<button type="button" class="ksw-link" data-ksw-back>Kembali</button>' : ''}<button type="button" class="ksw-link" data-ksw-skip>Lewati langkah ini</button></div><div class="ksw-bar-r"><span class="ksw-prog" aria-hidden="true"><i style="width:${Math.round((cur + 1) / steps.length * 100)}%"></i></span><button type="button" class="ksw-btn" data-ksw-next>${cur === steps.length - 1 ? 'Selesai' : 'Lanjut'} ${ic('arrow')}</button></div></div></section>`;
      st.mount?.(box.querySelector('.ksw-body'));
      box.querySelector('.ksw-body').scrollTop = 0;
    }
    wire(box);
    (box.querySelector('h2') || box).focus({ preventScroll: true });
  }
  function wire(box) {
    const on = (sel, fn) => box.querySelectorAll(sel).forEach(b => b.addEventListener('click', fn));
    on('[data-ksw-later]', later);
    on('[data-ksw-start]', () => { cur = 0; render(); });
    on('[data-ksw-back]', () => { if (!busy) { cur--; render(); } });
    on('[data-ksw-skip]', () => go(false));
    on('[data-ksw-next]', () => go(true));
    on('[data-ksw-close]', () => { close(); try { refreshAll(); } catch (_e) {} });
    on('[data-ksw-settings]', () => { close(); try { openWorkspaceSettings(); refreshAll(); } catch (_e) {} });
    box.querySelectorAll('[data-ksw-jump]').forEach(b => b.addEventListener('click', () => { if (!busy) { if (steps[cur] === 'theme') window.kairoThemeSetup?.revert(); cur = Number(b.dataset.kswJump); render(); } }));
  }
  async function go(save) {
    if (busy) return;
    const id = steps[cur], st = STEP[id], btn = root.querySelector('[data-ksw-next]');
    let summary = null;
    if (save) {
      busy = true; btn.disabled = true; btn.classList.add('is-busy');
      try { summary = await st.save(); }
      catch (err) { console.error(err); toast(err?.message || 'Gagal menyimpan langkah ini.', 'error'); return; }
      finally { busy = false; if (btn.isConnected) { btn.disabled = false; btn.classList.remove('is-busy'); } }
    } else st.skip?.();
    out[id] = summary;
    const stepsState = { ...(S.steps || {}), [id]: summary ? 'done' : 'skipped' };
    const patch = { steps: stepsState };
    if (id === 'products') patch.products = [...(D.products || [])];
    if (cur === steps.length - 1) patch.completed_at = new Date().toISOString();
    await saveState(patch);
    cur++; if (root) render();
  }

  function railHtml() {
    const name = (typeof activeWorkspaceName !== 'undefined' && activeWorkspaceName) || 'Workspace';
    const logo = activeWorkspaceBranding?.logo_url;
    return `<aside class="ksw-rail"><div class="ksw-brand"><span class="ksw-mark">${logo ? `<img src="${esc(logo)}" alt="">` : esc(name.trim().charAt(0).toUpperCase() || 'K')}</span><div><b>Siapkan toko kamu</b><small>${esc(name)}</small></div></div><ol class="ksw-steps">${steps.map((id, k) => {
      const st = S.steps?.[id], cls = k === cur ? 'is-on' : st === 'done' ? 'is-done' : st === 'skipped' ? 'is-skip' : '';
      return `<li><button type="button" class="ksw-step ${cls}" data-ksw-jump="${k}" ${k === cur ? 'aria-current="step"' : ''}><span class="ksw-n">${st === 'done' && k !== cur ? ic('check') : k + 1}</span><span class="ksw-t">${DEF[id].title}<small>${DEF[id].sub}</small></span></button></li>`;
    }).join('')}</ol><p class="ksw-foot">Semua langkah bisa dilewati dan diubah lagi kapan saja di Settings.</p></aside>`;
  }
  function welcomeHtml() {
    const who = window.kairoDisplayName || (typeof activeWorkspaceName !== 'undefined' && activeWorkspaceName) || '';
    return `<section class="ksw-hero"><button type="button" class="ksw-x" data-ksw-later aria-label="Nanti saja" title="Nanti saja">${ic('x')}</button><div class="ksw-badge">${ic('spark')}</div><div class="ksw-kick">Paket Pro aktif</div><h2 id="ksw-title" tabindex="-1">Halo${who ? ' ' + esc(who) : ''}, toko kamu sudah Pro!</h2><p>Kita siapkan dulu biar dashboard langsung siap dipakai jualan. Ada ${steps.length} langkah singkat, sekitar 5 menit. Semua bisa dilewati dan diubah lagi nanti di Settings.</p><div class="ksw-list">${steps.map((id, k) => `<div class="ksw-li"><span class="ksw-n2">${k + 1}</span><div>${DEF[id].title}<small>${DEF[id].sub}</small></div></div>`).join('')}</div><div class="ksw-actions"><button type="button" class="ksw-btn is-ghost" data-ksw-later>Nanti saja</button><button type="button" class="ksw-btn" data-ksw-start>Mulai siapkan ${ic('arrow')}</button></div></section>`;
  }
  function doneHtml() {
    return `<section class="ksw-hero is-done"><div class="ksw-badge is-ok">${ic('check')}</div><div class="ksw-kick">Siap jualan</div><h2 id="ksw-title" tabindex="-1">Toko kamu sudah siap!</h2><p>Pengaturan yang kamu isi sudah tersimpan. Semuanya bisa diubah kapan saja di Settings.</p><div class="ksw-list">${steps.map(id => { const v = out[id] ?? (S.steps?.[id] === 'done' ? 'tersimpan' : null); return `<div class="ksw-li ${v ? 'is-ok' : 'is-skip'}"><span class="ksw-n2">${v ? ic('check') : '–'}</span><div>${DEF[id].title}<small>${esc(v || 'dilewati')}</small></div></div>`; }).join('')}</div><div class="ksw-actions"><button type="button" class="ksw-btn is-ghost" data-ksw-settings>${ic('settings')} Buka Settings</button><button type="button" class="ksw-btn" data-ksw-close>${ic('store')} Buka dashboard</button></div></section>`;
  }

  /* ---------- langkah ---------- */
  const STEP = {};

  // 1. Tema & warna (Seller App Premium + Pro)
  STEP.theme = {
    title: () => 'Pilih suasana toko kamu',
    lead: () => 'Dashboard di belakang langsung berubah saat kamu memilih. Warna masih bisa kamu sesuaikan.',
    init() {
      if (D.theme) return;
      const T = window.kairoThemeSetup.themes, c = window.kairoThemeSetup.current(), id = T[c.theme] ? c.theme : Object.keys(T)[0];
      D.theme = { id, primary: c.theme ? c.primary : T[id].primary, accent: c.theme ? c.accent : T[id].accent };
    },
    html() {
      const T = window.kairoThemeSetup.themes, d = D.theme;
      return `<div class="ksw-themes" role="radiogroup" aria-label="Tema">${Object.entries(T).map(([id, t]) => `<button type="button" role="radio" class="ksw-th" data-th="${id}" aria-checked="${id === d.id}"><span class="ksw-sw" data-sw="${id}" aria-hidden="true"><i></i><em></em><b></b><b></b><b></b></span><strong>${esc(t.name)}</strong><small>${esc(t.desc)}</small></button>`).join('')}</div>
      <div class="ksw-colors"><label class="ksw-fld"><span>Warna utama</span><span class="ksw-color"><input type="color" data-c="primary" value="${d.primary}"><code>${d.primary}</code></span></label><label class="ksw-fld"><span>Warna aksen</span><span class="ksw-color"><input type="color" data-c="accent" value="${d.accent}"><code>${d.accent}</code></span></label><button type="button" class="ksw-btn is-ghost is-sm" data-reset>Reset ke warna tema</button></div>
      <div class="ksw-note">${ic('info')}<span>Tema dan warna tersimpan untuk workspace ini, jadi tetap sama walau kamu login dari HP lain.</span></div>`;
    },
    mount(el) {
      const T = window.kairoThemeSetup.themes, d = D.theme;
      const sync = () => {
        el.querySelectorAll('[data-th]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.th === d.id)));
        el.querySelectorAll('[data-c]').forEach(i => { i.value = d[i.dataset.c]; i.nextElementSibling.textContent = d[i.dataset.c].toUpperCase(); });
        window.kairoThemeSetup.preview(d.id, d.primary, d.accent);
      };
      el.querySelectorAll('[data-th]').forEach(b => b.addEventListener('click', () => { d.id = b.dataset.th; d.primary = T[d.id].primary; d.accent = T[d.id].accent; sync(); }));
      el.querySelectorAll('[data-c]').forEach(i => i.addEventListener('input', () => { d[i.dataset.c] = i.value.toUpperCase(); sync(); }));
      el.querySelector('[data-reset]').addEventListener('click', () => { d.primary = T[d.id].primary; d.accent = T[d.id].accent; sync(); });
      sync();
    },
    async save() { const d = D.theme; await window.kairoThemeSetup.save(d.id, d.primary, d.accent); return `${window.kairoThemeSetup.themes[d.id].name}`; },
    skip() { window.kairoThemeSetup.revert(); }
  };

  // 2. Produk (Seller): pilih aplikasi yang dijual, harganya diisi di langkah berikut.
  function catalogApps() {
    const C = window.kairoSellerCatalog, map = new Map();
    (C?.rows() || []).forEach(r => { const a = map.get(r.product) || { product: r.product, category: r.category, n: 0 }; a.n++; map.set(r.product, a); });
    return [...map.values()];
  }
  const catLabel = c => String(c || '').replace(/\s*Apps$/i, '');
  STEP.products = {
    title: () => 'Aplikasi apa saja yang kamu jual?',
    lead: () => 'Centang aplikasinya, atau tambahkan produkmu sendiri. Di langkah berikutnya kamu isi harga jual & modalnya.',
    init() { if (!D.products) D.products = new Set(S.products || []); D.pcat = D.pcat || ''; D.pq = ''; },
    html() {
      const C = window.kairoSellerCatalog;
      if (!C?.ready()) return `<div class="ksw-note">${ic('info')}<span>Daftar produk belum bisa dimuat. Lewati dulu langkah ini; produk bisa diatur di Settings › Produk.</span></div>`;
      const cats = C.categories.map(c => `<option value="${esc(c)}">${esc(catLabel(c))}</option>`).join('');
      return `<div class="ksw-ptools"><label class="ksw-search">${ic('search')}<input type="search" placeholder="Cari aplikasi, contoh: Netflix, Canva, ChatGPT" aria-label="Cari aplikasi" data-q></label><button type="button" class="ksw-btn is-ghost is-sm" data-all></button><button type="button" class="ksw-btn is-ghost is-sm" data-addtoggle aria-expanded="false">${ic('plus')} Produk sendiri</button></div>
      <form class="ksw-addform" data-addform hidden><div class="ksw-sub">Tambah produk sendiri <small>tersimpan permanen dan muncul di Orders & Settings › Produk</small></div><div class="ksw-addgrid">
        <label class="ksw-fld"><span>Nama produk</span><input type="text" name="product" maxlength="40" placeholder="Contoh: Kopi Premium" required></label>
        <label class="ksw-fld"><span>Kategori</span><select name="category">${cats}</select></label>
        <label class="ksw-fld"><span>Plan / varian</span><input type="text" name="variant" maxlength="40" placeholder="Contoh: Sharing" required></label>
        <label class="ksw-fld"><span>Durasi</span><input type="text" name="duration" maxlength="20" placeholder="Contoh: 1 bulan" required></label>
        <label class="ksw-fld"><span>Harga jual</span><input type="number" name="price" min="0" step="500" inputmode="numeric" value="0"></label>
        <label class="ksw-fld"><span>Modal</span><input type="number" name="cost" min="0" step="500" inputmode="numeric" value="0"></label>
      </div><div class="ksw-addbar"><span class="ksw-addhint">Satu produk bisa punya beberapa plan: simpan, lalu ganti plan/durasinya dan simpan lagi.</span><button type="submit" class="ksw-btn is-sm">Simpan produk</button></div></form>
      <div class="ksw-chips" role="tablist">${['', ...C.categories].map(c => `<button type="button" class="ksw-chip" data-cat="${esc(c)}" aria-pressed="${c === D.pcat}">${c ? esc(catLabel(c)) : 'Semua'}</button>`).join('')}</div><div class="ksw-apps" data-apps></div><div class="ksw-picked" data-picked></div>`;
    },
    mount(el) {
      const C = window.kairoSellerCatalog; if (!C?.ready()) return;
      const grid = el.querySelector('[data-apps]'), picked = el.querySelector('[data-picked]'), allBtn = el.querySelector('[data-all]'), form = el.querySelector('[data-addform]'), toggle = el.querySelector('[data-addtoggle]');
      const visible = () => { const q = D.pq.trim().toLowerCase(); return catalogApps().filter(a => (!D.pcat || a.category === D.pcat) && (!q || C.pretty(a.product).toLowerCase().includes(q))); };
      const paint = () => {
        const apps = visible();
        grid.innerHTML = apps.length ? apps.map(a => `<button type="button" class="ksw-app" role="checkbox" aria-checked="${D.products.has(a.product)}" data-app="${esc(a.product)}"><img src="${esc(C.iconBase + C.slug(a.product) + '.svg')}" alt="" loading="lazy"><span>${esc(C.pretty(a.product))}</span><small>${a.n} pilihan plan${C.hasIcon(a.product) ? '' : ' · buatan sendiri'}</small></button>`).join('') : '<div class="ksw-empty">Aplikasi tidak ditemukan. Tambahkan lewat tombol "Produk sendiri".</div>';
        const all = apps.length > 0 && apps.every(a => D.products.has(a.product));
        allBtn.innerHTML = `${ic('check')} ${all ? 'Batal pilih semua' : `Pilih semua${D.pcat || D.pq.trim() ? ' di daftar ini' : ''}`}`;
        allBtn.disabled = !apps.length;
        const list = [...D.products];
        picked.textContent = list.length ? `${list.length} aplikasi dipilih · ${list.slice(0, 6).map(C.pretty).join(', ')}${list.length > 6 ? ', …' : ''}` : 'Belum ada aplikasi dipilih.';
      };
      grid.addEventListener('click', e => { const b = e.target.closest('[data-app]'); if (!b) return; const p = b.dataset.app; D.products.has(p) ? D.products.delete(p) : D.products.add(p); paint(); });
      allBtn.addEventListener('click', () => { const apps = visible(), all = apps.every(a => D.products.has(a.product)); apps.forEach(a => all ? D.products.delete(a.product) : D.products.add(a.product)); paint(); });
      toggle.addEventListener('click', () => { form.hidden = !form.hidden; toggle.setAttribute('aria-expanded', String(!form.hidden)); if (!form.hidden) { if (D.pcat) form.category.value = D.pcat; form.product.focus(); } });
      form.addEventListener('submit', async e => {
        e.preventDefault(); if (busy) return;
        const btn = form.querySelector('[type=submit]'), data = Object.fromEntries(new FormData(form).entries());
        busy = true; btn.disabled = true; btn.classList.add('is-busy');
        try {
          const row = await C.addCustom(data);
          D.products.add(row.product);
          toast(`${C.pretty(row.product)} (${C.pretty(row.variant)} · ${row.duration}) tersimpan.`, 'success');
          form.variant.value = ''; form.duration.value = ''; form.price.value = '0'; form.cost.value = '0'; form.variant.focus();
          D.pq = ''; el.querySelector('[data-q]').value = ''; paint();
        } catch (err) { toast(err?.message || 'Gagal menyimpan produk.', 'error'); }
        finally { busy = false; btn.disabled = false; btn.classList.remove('is-busy'); }
      });
      el.querySelector('[data-q]').addEventListener('input', e => { D.pq = e.target.value; paint(); });
      el.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { D.pcat = b.dataset.cat; el.querySelectorAll('[data-cat]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint(); }));
      paint();
    },
    async save() { const n = D.products?.size || 0; return n ? `${n} aplikasi` : null; }
  };

  // 3. Harga & modal (Seller): tabel yang sama dengan Settings › Produk (seller_product_settings).
  STEP.prices = {
    title: () => 'Harga jual & modal',
    lead: () => 'Isi modal supaya profit tiap order langsung terhitung di dashboard. Yang belum diisi bisa dilengkapi nanti di Settings › Produk.',
    init() { D.prices = D.prices || {}; },
    html() {
      const C = window.kairoSellerCatalog, chosen = [...(D.products || new Set(S.products || []))];
      if (!C?.ready()) return `<div class="ksw-note">${ic('info')}<span>Daftar produk belum bisa dimuat. Lewati dulu; harga bisa diisi di Settings › Produk.</span></div>`;
      if (!chosen.length) return `<div class="ksw-note">${ic('info')}<span>Belum ada aplikasi dipilih. Kembali ke langkah Produk, atau isi harga nanti di Settings › Produk.</span></div>`;
      const rows = C.rows();
      return `<div class="ksw-ptable"><div class="ksw-prow is-head" aria-hidden="true"><span>Plan · durasi</span><span>Harga jual</span><span>Modal</span><span>Profit</span></div>${chosen.map((p, gi) => {
        const list = rows.filter(r => r.product === p);
        return `<details class="ksw-grp" ${gi === 0 ? 'open' : ''}><summary><img src="${esc(C.iconBase + C.slug(p) + '.svg')}" alt=""><b>${esc(C.pretty(p))}</b><small>${list.length} plan</small></summary>${list.map(r => {
          const k = C.rowKey(r), v = D.prices[k] || { price: r.price, cost: r.cost };
          return `<div class="ksw-prow" data-k="${esc(k)}"><span class="ksw-plan">${esc(C.pretty(r.variant))} · ${esc(r.duration)}</span><label><span class="ksw-ml">Harga jual</span><input type="number" min="0" step="500" inputmode="numeric" data-f="price" value="${Number(v.price) || 0}"></label><label><span class="ksw-ml">Modal</span><input type="number" min="0" step="500" inputmode="numeric" data-f="cost" value="${Number(v.cost) || 0}"></label><b class="ksw-profit">${profit(v.price, v.cost)}</b></div>`;
        }).join('')}</details>`;
      }).join('')}</div>`;
    },
    mount(el) {
      const C = window.kairoSellerCatalog; if (!C?.ready()) return;
      const rows = new Map(C.rows().map(r => [C.rowKey(r), r]));
      el.addEventListener('input', e => {
        const row = e.target.closest('[data-k]'); if (!row) return;
        const k = row.dataset.k, base = rows.get(k), v = D.prices[k] || { price: base.price, cost: base.cost };
        v[e.target.dataset.f] = Math.max(0, num(e.target.value)); v.dirty = true; D.prices[k] = v;
        row.querySelector('.ksw-profit').innerHTML = profit(v.price, v.cost);
      });
    },
    async save() {
      const C = window.kairoSellerCatalog; if (!C?.ready()) return null;
      const rows = new Map(C.rows().map(r => [C.rowKey(r), r]));
      const list = Object.entries(D.prices || {}).filter(([k, v]) => v.dirty && rows.has(k)).map(([k, v]) => ({ row: rows.get(k), price: v.price, cost: v.cost }));
      if (list.length) await C.saveMany(list);
      Object.values(D.prices || {}).forEach(v => { v.dirty = false; });
      const filled = Object.values(D.prices || {}).filter(v => v.cost > 0).length;
      return list.length ? `${list.length} harga disimpan${filled ? ` · ${filled} modal` : ''}` : (S.steps?.prices === 'done' ? 'tersimpan' : null);
    }
  };

  // 2'. Paket & harga (template lain): tabel Package (package_masters) yang sama dengan Settings.
  STEP.packages = {
    title: () => 'Paket / layanan & harga',
    lead: () => 'Tulis paket atau layanan yang kamu jual, lengkap dengan harga jual dan modalnya. Profit tiap order langsung terhitung.',
    init() {
      if (D.pk) return;
      D.pk = (typeof packages !== 'undefined' ? packages : []).map(p => ({ id: p.id, name: p.name || '', price: Number(p.price || 0), cost: Number(p.cost_price || 0), o: [p.name || '', Number(p.price || 0), Number(p.cost_price || 0)] }));
      if (!D.pk.length) D.pk.push({ id: null, name: '', price: 0, cost: 0 });
    },
    html() {
      return `<div class="ksw-ptable is-pk"><div class="ksw-prow is-head" aria-hidden="true"><span>Nama paket</span><span>Harga jual</span><span>Modal</span><span>Profit</span><span></span></div><div data-pk>${D.pk.map((r, i) => pkRow(r, i)).join('')}</div></div><button type="button" class="ksw-add" data-add>${ic('plus')} Tambah paket</button>`;
    },
    mount(el) {
      const host = el.querySelector('[data-pk]');
      const repaint = () => { host.innerHTML = D.pk.map((r, i) => pkRow(r, i)).join(''); };
      host.addEventListener('input', e => {
        const row = e.target.closest('[data-i]'); if (!row) return; const r = D.pk[Number(row.dataset.i)], f = e.target.dataset.f;
        r[f] = f === 'name' ? e.target.value : Math.max(0, num(e.target.value));
        row.querySelector('.ksw-profit').innerHTML = profit(r.price, r.cost);
      });
      host.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; D.pk.splice(Number(b.dataset.del), 1); repaint(); });
      el.querySelector('[data-add]').addEventListener('click', () => { D.pk.push({ id: null, name: '', price: 0, cost: 0 }); repaint(); host.querySelector('[data-i]:last-child [data-f="name"]')?.focus(); });
    },
    async save() {
      const wid = requireWorkspaceId(), m = masterTypeMeta('package');
      let n = 0;
      for (const r of D.pk) {
        const name = r.name.trim();
        if (r.id) {
          if (!name) throw new Error('Nama paket tidak boleh kosong.');
          if (name === r.o[0] && r.price === r.o[1] && r.cost === r.o[2]) continue;
          const { error } = await writeMasterPayload(m, { name, price: r.price }, d => db.from(m.table).update(d).eq('workspace_id', wid).eq('id', r.id)); if (error) throw error;
          if (r.cost !== r.o[2]) { const { error: ce } = await db.from(m.table).update({ cost_price: r.cost }).eq('workspace_id', wid).eq('id', r.id); if (ce) throw ce; }
          n++;
        } else if (name) {
          const { error } = await writeMasterPayload(m, { workspace_id: wid, code: null, name, is_active: true, price: r.price, cost_price: r.cost }, d => db.from(m.table).insert(d)); if (error) throw error;
          n++;
        }
      }
      if (n) { await loadMasters(); try { renderSettingsMasterData(); } catch (_e) {} }
      const total = (typeof packages !== 'undefined' ? packages : []).length;
      D.pk = null;
      return n ? `${n} paket diperbarui` : (total ? `${total} paket` : null);
    }
  };
  function pkRow(r, i) {
    return `<div class="ksw-prow" data-i="${i}"><label class="ksw-pname"><span class="ksw-ml">Nama paket</span><input type="text" maxlength="100" placeholder="Contoh: Paket Reguler" data-f="name" value="${esc(r.name)}"></label><label><span class="ksw-ml">Harga jual</span><input type="number" min="0" step="1000" inputmode="numeric" data-f="price" value="${r.price}"></label><label><span class="ksw-ml">Modal</span><input type="number" min="0" step="500" inputmode="numeric" data-f="cost" value="${r.cost}"></label><b class="ksw-profit">${profit(r.price, r.cost)}</b>${r.id ? '<span></span>' : `<button type="button" class="ksw-del" data-del="${i}" aria-label="Hapus baris" title="Hapus baris">${ic('trash')}</button>`}</div>`;
  }

  // 4. Kas & pembagian omzet: versi pembagian baru mulai sekarang (sama dengan Settings › Pembagian Omzet).
  const pctFmt = v => (Math.round(v * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  STEP.cash = {
    title: () => 'Kas & pembagian omzet',
    lead: () => 'Laba = harga jual − modal. Atur ke mana laba itu dibagi. Berlaku untuk order mulai sekarang.',
    init() {
      if (D.cash) return;
      const now = kairoLocalDateTimeValue(), share = p => Math.round(rawShareRuleFor(p, now) * 10000) / 100;
      // Kas aktif tapi 0% = sama saja dengan tidak memakai Kas; tampilkan sebagai mati (dinyalakan = saran 10%).
      const kasPct = cashActive() ? Math.round(cashShareRateForDate(now) * 10000) / 100 : 0, kasOn = kasPct > 0;
      let rows = partners.filter(p => !isKasName(p)).map(p => ({ id: p.id, name: p.partner_name || '', pct: share(p), o: p.partner_name || '' }));
      if (!rows.length) rows = [{ id: null, name: window.kairoDisplayName || 'Pemilik', pct: 100 - kasPct }];
      D.cash = { kasOn, kasPct: kasOn ? kasPct : 10, mode: rows.length > 1 ? 'partner' : 'solo', rows };
    },
    html() {
      const d = D.cash;
      return `<div class="ksw-two"><div class="ksw-box"><div class="ksw-row"><div><h4>Pakai Kas</h4><p>Sisihkan sebagian laba untuk kebutuhan toko (iklan, akun cadangan, dll).</p></div><button type="button" class="ksw-switch" role="switch" aria-checked="${d.kasOn}" aria-label="Pakai Kas" data-kas></button></div><label class="ksw-fld ksw-kas" ${d.kasOn ? '' : 'hidden'}><span>Disisihkan ke Kas</span><span class="ksw-pct"><input type="number" min="0" max="100" step="0.5" inputmode="decimal" data-kaspct value="${d.kasPct}"><i>%</i></span></label><div class="ksw-note">${ic('info')}<span>${d.kasOn ? 'Bisa dimatikan kapan saja; saldo Kas yang sudah terkumpul tetap tersimpan.' : 'Kas tidak dipakai: 100% laba dibagi ke kamu / partner.'}</span></div></div>
      <div class="ksw-box"><h4>Siapa yang dapat bagian laba?</h4><div role="radiogroup" aria-label="Pembagian laba"><button type="button" role="radio" class="ksw-opt" data-mode="solo" aria-checked="${d.mode === 'solo'}"><span class="ksw-radio"></span><span><b>Sendiri</b><small>Semua laba${d.kasOn ? ' (setelah Kas)' : ''} masuk ke kamu.</small></span></button><button type="button" role="radio" class="ksw-opt" data-mode="partner" aria-checked="${d.mode === 'partner'}"><span class="ksw-radio"></span><span><b>Ada partner</b><small>Bagi laba ke beberapa orang.</small></span></button></div><div data-partners></div></div></div>`;
    },
    mount(el) {
      const d = D.cash, host = el.querySelector('[data-partners]');
      const total = () => d.rows.reduce((t, r) => t + (Number(r.pct) || 0), 0) + (d.kasOn ? Number(d.kasPct) || 0 : 0);
      const paint = () => {
        const kas = d.kasOn ? Number(d.kasPct) || 0 : 0;
        if (d.mode === 'solo') {
          host.innerHTML = `<label class="ksw-fld"><span>Nama penerima laba</span><input type="text" maxlength="60" data-solo value="${esc(d.rows[0]?.name || '')}"></label><div class="ksw-total is-ok"><span>${esc(d.rows[0]?.name || 'Kamu')} ${pctFmt(100 - kas)}%${d.kasOn ? ` + Kas ${pctFmt(kas)}%` : ''}</span><span>100%</span></div>`;
        } else {
          const t = total(), ok = Math.abs(t - 100) < 0.01;
          host.innerHTML = `${d.rows.map((r, i) => `<div class="ksw-partner" data-i="${i}"><input type="text" maxlength="60" placeholder="Nama partner" aria-label="Nama partner" data-f="name" value="${esc(r.name)}"><span class="ksw-pct"><input type="number" min="0" max="100" step="0.5" inputmode="decimal" aria-label="Persen ${esc(r.name)}" data-f="pct" value="${r.pct}"><i>%</i></span><button type="button" class="ksw-del" data-del="${i}" aria-label="Hapus partner" title="Hapus partner" ${d.rows.length < 2 ? 'disabled' : ''}>${ic('x')}</button></div>`).join('')}<button type="button" class="ksw-add" data-addp>${ic('plus')} Tambah partner</button><div class="ksw-total ${ok ? 'is-ok' : 'is-bad'}"><span>Total${d.kasOn ? ` + Kas ${pctFmt(kas)}%` : ''}</span><span>${pctFmt(t)}%${ok ? '' : ' (harus 100%)'}</span></div>`;
        }
      };
      el.querySelector('[data-kas]').addEventListener('click', () => {
        d.kasOn = !d.kasOn; if (d.kasOn && !(Number(d.kasPct) > 0)) d.kasPct = 10;
        if (d.mode === 'partner') { const rest = 100 - (d.kasOn ? d.kasPct : 0), sum = d.rows.reduce((t, r) => t + (Number(r.pct) || 0), 0); if (sum > 0) d.rows.forEach(r => { r.pct = Math.round(r.pct / sum * rest * 100) / 100; }); }
        render();
      });
      el.querySelector('[data-kaspct]')?.addEventListener('input', e => { d.kasPct = Math.min(100, Math.max(0, num(e.target.value))); paint(); });
      el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
        d.mode = b.dataset.mode;
        el.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
        if (d.mode === 'partner' && d.rows.length < 2) { const rest = 100 - (d.kasOn ? d.kasPct : 0); d.rows[0].pct = Math.round(rest / 2 * 100) / 100; d.rows.push({ id: null, name: '', pct: Math.round((rest - d.rows[0].pct) * 100) / 100 }); }
        paint();
      }));
      host.addEventListener('input', e => {
        if (e.target.matches('[data-solo]')) { d.rows[0].name = e.target.value; return; }
        const row = e.target.closest('[data-i]'); if (!row) return; const r = d.rows[Number(row.dataset.i)];
        if (e.target.dataset.f === 'name') r.name = e.target.value; else { r.pct = Math.max(0, num(e.target.value)); const tot = host.querySelector('.ksw-total'); const t = total(), ok = Math.abs(t - 100) < 0.01; tot.className = `ksw-total ${ok ? 'is-ok' : 'is-bad'}`; tot.lastElementChild.textContent = `${pctFmt(t)}%${ok ? '' : ' (harus 100%)'}`; }
      });
      host.addEventListener('click', e => {
        if (e.target.closest('[data-addp]')) { d.rows.push({ id: null, name: '', pct: 0 }); paint(); host.querySelector('[data-i]:last-of-type [data-f="name"]')?.focus(); return; }
        const del = e.target.closest('[data-del]'); if (del && d.rows.length > 1) { d.rows.splice(Number(del.dataset.del), 1); paint(); }
      });
      paint();
    },
    async save() {
      if (typeof profitShareVersionTableReady !== 'undefined' && !profitShareVersionTableReady) throw new Error('Pembagian omzet belum bisa disimpan di database ini. Lewati dulu langkah ini.');
      const d = D.cash, kas = d.kasOn ? Math.min(100, Math.max(0, Number(d.kasPct) || 0)) : 0;
      const list = (d.mode === 'solo' ? [{ ...d.rows[0], pct: 100 - kas }] : d.rows.map(r => ({ ...r }))).map(r => ({ ...r, name: String(r.name || '').trim() }));
      if (list.some(r => !r.name)) throw new Error('Nama penerima laba wajib diisi.');
      if (list.some(r => r.name.toLowerCase() === 'kas')) throw new Error('Nama "Kas" sudah dipakai untuk Kas. Pakai nama lain.');
      if (new Set(list.map(r => r.name.toLowerCase())).size !== list.length) throw new Error('Nama partner tidak boleh sama.');
      const tot = list.reduce((t, r) => t + r.pct, 0) + kas;
      if (Math.abs(tot - 100) > 0.01) throw new Error(`Total pembagian wajib 100%. Sekarang ${pctFmt(tot)}%.`);
      const wid = requireWorkspaceId();
      for (const r of list) {
        if (r.id && r.name !== r.o) { const { error } = await db.from('profit_share_rules').update({ partner_name: r.name }).eq('workspace_id', wid).eq('id', r.id); if (error) throw error; }
        const existing = !r.id && partners.find(p => !isKasName(p) && String(p.partner_name || '').toLowerCase() === r.name.toLowerCase());
        if (existing) r.id = existing.id;
        else if (!r.id) { const { error } = await db.from('profit_share_rules').insert({ workspace_id: wid, partner_name: r.name, percentage: 0, is_active: true }); if (error) throw error; }
      }
      await loadMasters();
      // Partner lama yang tidak dipilih tetap aktif dengan 0% (riwayat & saldo Withdraw-nya aman).
      const rules = partners.filter(p => !isKasName(p)).map(p => {
        const r = list.find(x => (x.id && String(x.id) === String(p.id)) || String(p.partner_name || '').toLowerCase() === x.name.toLowerCase());
        return { partner_id: p.id || null, partner_name: p.partner_name, percentage: r ? r.pct / 100 : 0 };
      });
      const kasRow = partners.find(isKasName);
      rules.push({ partner_id: kasRow?.id || null, partner_name: 'Kas', percentage: kas / 100, ...(d.kasOn ? {} : { cash_off: true }) });
      const { error } = await db.from('profit_share_versions').upsert({ workspace_id: wid, effective_from: kairoLocalDateTimeValue(), rules, created_by: activeAuthUserId }, { onConflict: 'workspace_id,effective_from' });
      if (error) throw error;
      for (const r of rules) { if (!r.partner_id) continue; const { error: ue } = await db.from('profit_share_rules').update({ percentage: r.percentage }).eq('workspace_id', wid).eq('id', r.partner_id); if (ue) throw ue; }
      if (cashActive() !== d.kasOn) await saveCashEnabled(d.kasOn);
      await loadMasters();
      try { renderProfitShareEditor(); syncCashToggle(); } catch (_e) {}
      D.cash = null;
      return `${d.kasOn ? `Kas ${pctFmt(kas)}%` : 'Tanpa Kas'} · ${list.length > 1 ? `${list.length} partner` : 'sendiri'}`;
    }
  };

  // 5. Struk: checklist + template + footer (mesin struk yang sama dengan Settings › Struk & Wording).
  STEP.receipt = {
    title: () => 'Struk untuk pelanggan',
    lead: () => 'Pilih bagian yang tampil di struk dan desain foto struknya. Preview di kanan langsung berubah.',
    init() {
      if (D.rc) return;
      const R = window.kairoReceiptSetup, name = (typeof activeWorkspaceName !== 'undefined' && activeWorkspaceName) || 'toko kami';
      D.rc = { enabled: Object.fromEntries(R.items().map(x => [x.id, x.enabled])), template: R.template(), footer: R.footer() || `Terima kasih sudah belanja di ${name}` };
    },
    html() {
      const R = window.kairoReceiptSetup, d = D.rc;
      return `<div class="ksw-rc"><div class="ksw-rc-l"><div class="ksw-sub">Bagian struk</div><div class="ksw-checks">${R.items().map(x => `<button type="button" role="checkbox" class="ksw-ck" data-ck="${esc(x.id)}" aria-checked="${!!d.enabled[x.id]}"><i aria-hidden="true">${ic('check')}</i>${esc(x.name)}</button>`).join('')}</div><div class="ksw-sub">Desain foto struk</div><div class="ksw-designs" role="radiogroup" aria-label="Desain struk">${R.templates.map(t => `<button type="button" role="radio" class="ksw-ds" data-tpl="${t.id}" aria-checked="${t.id === d.template}" title="${esc(t.desc)}"><span class="receipt-template-thumb receipt-template-thumb-${t.id}" aria-hidden="true"><i></i><i></i><i></i></span><span>${esc(t.name)}</span></button>`).join('')}</div><label class="ksw-fld"><span>Footer struk</span><input type="text" maxlength="160" data-footer value="${esc(d.footer)}"></label></div><div class="ksw-rc-r"><div class="ksw-sub">Preview</div><div class="ksw-rc-prev" data-prev></div></div></div>`;
    },
    mount(el) {
      const R = window.kairoReceiptSetup, d = D.rc, prev = el.querySelector('[data-prev]');
      const paint = () => { try { prev.innerHTML = R.preview(d.enabled, d.template, d.footer); } catch (err) { console.warn(err); prev.textContent = 'Preview belum tersedia.'; } };
      el.querySelectorAll('[data-ck]').forEach(b => b.addEventListener('click', () => { d.enabled[b.dataset.ck] = !d.enabled[b.dataset.ck]; b.setAttribute('aria-checked', String(d.enabled[b.dataset.ck])); paint(); }));
      el.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => { d.template = b.dataset.tpl; el.querySelectorAll('[data-tpl]').forEach(x => x.setAttribute('aria-checked', String(x === b))); paint(); }));
      el.querySelector('[data-footer]').addEventListener('input', e => { d.footer = e.target.value; paint(); });
      paint();
    },
    async save() {
      const R = window.kairoReceiptSetup, d = D.rc;
      await R.save(d.enabled, d.template, d.footer.trim());
      const t = R.templates.find(x => x.id === d.template), n = Object.values(d.enabled).filter(Boolean).length;
      return `${t ? t.name : 'Struk'} · ${n} bagian`;
    }
  };

  // 6. Logo (opsional): dikompres otomatis sebelum diupload (kairoLogoSetup di kairo-app.js).
  STEP.logo = {
    title: () => 'Logo toko (opsional)',
    lead: () => 'Logo tampil di sidebar, header, dan struk. Belum punya? Lewati saja, nanti bisa ditambah di Settings.',
    init() { if (D.logo === undefined) D.logo = null; },
    html() {
      const url = D.logo || activeWorkspaceBranding?.logo_url || '';
      return `<label class="ksw-drop" data-drop><input type="file" accept="image/png,image/jpeg,image/webp" data-file hidden><span class="ksw-drop-ic">${url ? `<img src="${esc(url)}" alt="Logo toko">` : ic('up')}</span><b data-drop-title>${url ? 'Ganti logo' : 'Pilih foto logo'}</b><span data-drop-msg>Klik atau tarik foto ke sini · PNG, JPG, WebP · otomatis dikecilkan supaya hemat memori</span></label>`;
    },
    mount(el) {
      const drop = el.querySelector('[data-drop]'), input = el.querySelector('[data-file]'), msg = el.querySelector('[data-drop-msg]');
      const send = async file => {
        if (!file || busy) return;
        busy = true; drop.classList.add('is-busy'); msg.textContent = 'Mengecilkan & mengupload logo…';
        try {
          const r = await window.kairoLogoSetup.upload(file);
          D.logo = r.url;
          el.querySelector('.ksw-drop-ic').innerHTML = `<img src="${esc(r.url)}" alt="Logo toko">`;
          el.querySelector('[data-drop-title]').textContent = 'Logo tersimpan';
          msg.textContent = `Ukuran setelah dikompres ${Math.max(1, Math.round(r.bytes / 1024))} KB. Klik untuk mengganti.`;
          const mark = root?.querySelector('.ksw-mark'); if (mark) mark.innerHTML = `<img src="${esc(r.url)}" alt="">`;
        } catch (err) { console.error(err); msg.textContent = 'Klik atau tarik foto ke sini · PNG, JPG, WebP'; toast(err?.message || 'Gagal mengupload logo.', 'error'); }
        finally { busy = false; drop.classList.remove('is-busy'); input.value = ''; }
      };
      input.addEventListener('change', () => send(input.files?.[0]));
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('is-over'); send(e.dataTransfer?.files?.[0]); });
    },
    async save() { return D.logo ? 'logo tersimpan' : (activeWorkspaceBranding?.logo_url ? 'logo sebelumnya' : null); }
  };

  // Dibuka lagi dari Settings: mulai dari status tersimpan supaya completed_at/langkah lama tidak hilang.
  window.kairoSetupWizard = { boot, open: i => { if (root) return; S = { ...(activeWorkspaceBranding?.setup_state || {}) }; open(Number(i) || 0); } };
})();
