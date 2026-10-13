/* KAIRO - Metode Pembayaran yang bisa diatur user (owner Okt 2026).
   Satu modul untuk semua template: Jasa Online (dasar), Seller App Premium, dan Online Shop. Template Kasir / POS punya kartu sendiri
   (Settings › Kategori › Pengaturan Kasir) dengan daftar yang sama (receipt_labels.__payments), jadi modul ini tidak menyentuhnya.
   - Daftar disimpan di workspace_branding.receipt_labels.__payments (tanpa SQL). Kosong / sama dengan bawaan = pakai pilihan bawaan di HTML,
     jadi akun lama tidak berubah.
   - Mengisi <select id="tx-payment"> di Orders. Template dasar & Seller memakai nilai lama (QRIS / CASH / TRANSFER / OTHER) untuk empat nama
     bawaan supaya riwayat dan Autofill tetap cocok; nama baru disimpan apa adanya. Online Shop memakai nama = nilai (seperti sebelumnya).
   - Kartu "Metode Pembayaran" di Settings: tambah, ganti nama, hapus, kembalikan bawaan. Mengganti nama tidak mengubah transaksi lama. */
(function () {
  'use strict';
  const root = document.documentElement;
  const tpl = () => root.dataset.businessTemplate || '';
  const isPos = () => tpl() === 'pos_kasir';
  const isShop = () => tpl() === 'online_shop';
  const isSeller = () => document.body.classList.contains('seller-app-premium') || tpl() === 'digital_subscription';
  const DEFAULTS = ['QRIS', 'Cash', 'Transfer', 'Other'];
  const LEGACY = { qris: 'QRIS', cash: 'CASH', transfer: 'TRANSFER', other: 'OTHER' };
  const MAX_ITEMS = 12;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const labels = () => (typeof activeWorkspaceBranding !== 'undefined' && activeWorkspaceBranding?.receipt_labels) || {};
  const clean = arr => { const seen = new Set(), out = []; (arr || []).forEach(x => { const n = String(x || '').trim(); if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push(n); } }); return out; };
  const custom = () => { const l = labels().__payments; const c = Array.isArray(l) ? clean(l) : []; return c.length ? c : null; };
  const list = () => custom() || DEFAULTS.slice();
  const valueOf = n => (isShop() ? n : (LEGACY[n.toLowerCase()] || n));
  const sameAsDefault = names => names.length === DEFAULTS.length && names.every((n, i) => n.toLowerCase() === DEFAULTS[i].toLowerCase());

  /* ---------- Pilihan di Orders ---------- */
  function syncSelect() {
    if (isPos()) return;
    const sel = document.getElementById('tx-payment');
    if (!sel) return;
    if (sel.dataset.kpayDefault === undefined) sel.dataset.kpayDefault = sel.innerHTML; // pilihan bawaan dari HTML
    const cur = sel.value, c = custom();
    let html;
    if (!c && !isShop()) html = sel.dataset.kpayDefault;
    else {
      const names = (c || DEFAULTS).slice();
      const has = v => names.some(n => n.toLowerCase() === v.toLowerCase() || valueOf(n).toLowerCase() === v.toLowerCase());
      const extra = cur && !has(cur) ? `<option value="${esc(cur)}">${esc(cur)}</option>` : '';
      html = '<option value="">-- Pilih Metode Pembayaran --</option>' + names.map(n => `<option value="${esc(valueOf(n))}">${esc(n)}</option>`).join('') + extra;
    }
    if (sel.dataset.kpayApplied === html) return;
    sel.innerHTML = html;
    sel.dataset.kpayApplied = html;
    const match = [...sel.options].find(o => o.value.toLowerCase() === String(cur || '').toLowerCase());
    sel.value = match ? match.value : '';
    try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (_e) { /* tidak kritis */ }
  }

  /* ---------- Kartu di Settings ---------- */
  let draft = null;
  const rowsHtml = () => draft.map((n, i) => `<div class="kpay-row"><input class="input" maxlength="30" value="${esc(n)}" data-kpay-i="${i}" aria-label="Nama metode ${i + 1}"><button type="button" class="kpay-del" data-kpay-del="${i}" aria-label="Hapus ${esc(n)}">×</button></div>`).join('') || '<span class="kpay-empty">Belum ada metode. Tambahkan minimal satu.</span>';
  const paint = () => { const box = document.getElementById('kairo-pay-rows'); if (box) box.innerHTML = rowsHtml(); };

  function mountCard() {
    // Kasir / POS punya kartu sendiri; bila kartu ini sempat terpasang sebelum template Kasir terdeteksi, lepas lagi.
    if (isPos()) { document.getElementById('kairo-pay-card')?.remove(); return; }
    const settings = document.getElementById('settings');
    if (!settings) return;
    let anchor = null, host = null;
    if (isSeller()) host = settings.querySelector('[data-settings-panel="packages"]');
    else anchor = document.getElementById('shop-platform-card') || document.getElementById('settings-topic-card');
    if (!anchor && !host) return;
    const existing = document.getElementById('kairo-pay-card');
    if (existing) {
      // Template Seller baru terdeteksi sesudah kartu terpasang: panel Topik disembunyikan di Seller, jadi pindahkan ke panel Produk.
      if (host && existing.parentElement !== host) host.appendChild(existing);
      else if (anchor && existing.previousElementSibling !== anchor) anchor.after(existing); // urutan Online Shop: Topik, Platform, Pembayaran
      return;
    }
    const card = document.createElement('div');
    card.className = 'card settings-master-card';
    card.id = 'kairo-pay-card';
    card.innerHTML = `<div class="settings-master-head"><div><div class="card-title">Metode Pembayaran</div><div class="page-sub">Pilihan metode pembayaran di Orders, mis. QRIS, Transfer, COD, atau nama dompet digital. Mengganti nama tidak mengubah transaksi lama.</div></div></div>
      <div id="kairo-pay-rows" class="kpay-rows"></div>
      <div class="kpay-add"><input class="input" id="kairo-pay-input" maxlength="30" placeholder="Nama metode baru"><button type="button" class="btn btn-light" id="kairo-pay-add">Tambah</button></div>
      <div class="kpay-actions"><button type="button" class="btn btn-green" id="kairo-pay-save">Simpan Metode</button><button type="button" class="btn btn-light" id="kairo-pay-reset">Kembalikan Bawaan</button></div>`;
    if (anchor) anchor.after(card); else host.appendChild(card);
    draft = list();
    paint();
    const input = card.querySelector('#kairo-pay-input');
    const add = () => {
      const v = input.value.trim();
      if (!v) return;
      if (draft.some(x => x.trim().toLowerCase() === v.toLowerCase())) { showToast('Metode itu sudah ada.', 'warning'); return; }
      if (draft.length >= MAX_ITEMS) { showToast(`Maksimal ${MAX_ITEMS} metode pembayaran.`, 'warning'); return; }
      draft.push(v); input.value = ''; paint();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    card.addEventListener('input', e => { const i = e.target.dataset?.kpayI; if (i !== undefined) draft[Number(i)] = e.target.value; });
    card.addEventListener('click', async e => {
      const del = e.target.closest('[data-kpay-del]');
      if (del) { draft.splice(Number(del.dataset.kpayDel), 1); paint(); return; }
      if (e.target.closest('#kairo-pay-add')) { add(); return; }
      if (e.target.closest('#kairo-pay-reset')) { draft = DEFAULTS.slice(); paint(); return; }
      const save = e.target.closest('#kairo-pay-save');
      if (!save) return;
      const names = draft.map(x => String(x || '').trim()).filter(Boolean);
      try {
        if (!names.length) throw new Error('Isi minimal satu metode pembayaran.');
        if (clean(names).length !== names.length) throw new Error('Ada nama metode yang kembar. Samakan atau hapus salah satunya.');
        window.kairoBtnLoading?.(save, true, undefined, 'Menyimpan…');
        const wid = requireWorkspaceId(), next = { ...labels() };
        if (!isShop() && sameAsDefault(names)) delete next.__payments; else next.__payments = names;
        const { error } = await db.from('workspace_branding').upsert({ workspace_id: wid, receipt_labels: next, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
        if (error) throw error;
        await loadWorkspaceSaasContext();
        draft = list(); paint(); syncSelect();
        showToast('Metode pembayaran disimpan.');
      } catch (err) {
        showToast(err.message || 'Gagal menyimpan metode pembayaran.', true);
      } finally { window.kairoBtnLoading?.(save, false, 'Simpan Metode'); }
    });
  }

  /* ---------- Pasang ---------- */
  let queued = false;
  const refresh = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { mountCard(); syncSelect(); } catch (e) { console.warn('kairo-payments', e); } }); };
  function wrap(name) {
    const core = window[name];
    if (typeof core !== 'function' || core.__kpay) return;
    const w = function () { const r = core.apply(this, arguments); if (r && typeof r.then === 'function') r.then(refresh, () => {}); else refresh(); return r; };
    w.__kpay = true;
    window[name] = w;
  }
  ['loadWorkspaceSaasContext', 'renderSettingsMasterData', 'applyTopicFieldLabel', 'renderMasterOptions'].forEach(wrap);
  document.addEventListener('kairo:refreshed', refresh);
  document.addEventListener('kairo:template-ready', refresh);
  const watch = id => { const el = document.getElementById(id); if (el) new MutationObserver(refresh).observe(el, { childList: true, subtree: true }); };
  watch('tx-form');
  watch('settings');
  refresh();
})();
