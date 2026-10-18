/* Pembagian omzet per handler - Jasa Online (owner Okt 2026).
   Order punya satu "handler" (salah satu partner). Handler dapat porsi lebih besar (bawaan 60%), sisanya dibagi rata ke partner lain.
   - Pengaturan: workspace_branding.receipt_labels.__handler = { on, main:{[partnerId]:persen}, pair_pct, inactive:[partnerId] } (tanpa SQL).
   - Saat order dicatat, pembagian disimpan sebagai snapshot di transaksi (handler_partner_id, handler_name, handler_split; SQL
     .claude/sql/2026-10-handler-split.sql), jadi mengubah pengaturan nanti TIDAK mengubah hak partner di order lama.
   - Perhitungan hak partner ada di kairo-app.js (handlerShareFor/txShareFor): bagian non-Kas dibagi sesuai snapshot, Kas dipotong lebih dulu seperti biasa.
   - Handler nonaktif: tidak bisa dipilih dan dapat 0%; sisanya otomatis dibagi ulang (tinggal 2 aktif = pair_pct, bawaan 50-50; tinggal 1 = 100%).
   - Hanya tampilan Jasa Online (html.kairo-jasa) dan paket Pro (multi_partner_profit_share). Akun lama tidak berubah sampai saklarnya dinyalakan. */
(function () {
  'use strict';
  if (window.__kairoHandler) return;
  window.__kairoHandler = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const fmt = n => (Math.round(n * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const DEF_MAIN = 60, DEF_PAIR = 50;

  const isJasa = () => document.documentElement.classList.contains('kairo-jasa');
  const proOk = () => { try { return canUseFeature('multi_partner_profit_share'); } catch (_e) { return false; } };
  const labels = () => (typeof activeWorkspaceBranding !== 'undefined' && activeWorkspaceBranding?.receipt_labels) || {};
  const cfg = () => {
    const c = labels().__handler || {};
    return { on: c.on === true, main: (c.main && typeof c.main === 'object') ? c.main : {}, pair_pct: num(c.pair_pct) > 0 ? num(c.pair_pct) : DEF_PAIR, inactive: Array.isArray(c.inactive) ? c.inactive.map(String) : [] };
  };
  const people = () => (typeof partners !== 'undefined' ? partners : []).filter(p => !isKasName(p));
  const activePeople = () => { const c = cfg(); return people().filter(p => !c.inactive.includes(String(p.id))); };
  const available = () => isJasa() && proOk();
  const isOn = () => available() && cfg().on && activePeople().length > 0;
  const mainOf = (c, p) => { const v = num(c.main[String(p.id)]); return v > 0 ? v : DEF_MAIN; };

  // Pembagian (pecahan dari bagian non-Kas, jumlah = 1) bila `handler` yang memegang order, dari daftar partner aktif `act`.
  function splitFor(handler, act, c) {
    const n = act.length;
    const hPct = n === 1 ? 100 : n === 2 ? c.pair_pct : mainOf(c, handler);
    const others = act.filter(p => String(p.id) !== String(handler.id));
    return act.map(p => {
      const pct = String(p.id) === String(handler.id) ? hPct : (n === 1 ? 0 : (100 - hPct) / others.length);
      return { partner_id: p.id, partner_name: p.partner_name, pct: pct / 100 };
    });
  }
  const splitText = split => split.map(x => `${x.partner_name} ${fmt(x.pct * 100)}%`).join(' · ');

  /* ---------- Form Orders ---------- */
  function mountOrder() {
    const form = document.getElementById('tx-form');
    const group = document.getElementById('tx-handler-group');
    if (!form) return;
    if (!isOn()) { group?.remove(); return; }
    const c = cfg(), act = activePeople();
    let g = group;
    if (!g) {
      const anchor = document.getElementById('tx-platform')?.closest('.form-group');
      if (!anchor) return;
      g = document.createElement('div');
      g.className = 'form-group'; g.id = 'tx-handler-group';
      g.innerHTML = '<label class="label" for="tx-handler">Handler</label><select id="tx-handler" class="input" required></select><div class="kh-hint" id="tx-handler-hint" aria-live="polite"></div>';
      anchor.insertAdjacentElement('beforebegin', g);
      g.querySelector('select').addEventListener('change', hint);
    }
    const sel = g.querySelector('select'), prev = sel.value;
    const sig = act.map(p => p.id + '|' + p.partner_name).join(';') + '#' + JSON.stringify(c);
    if (g.dataset.sig !== sig) {
      g.dataset.sig = sig;
      sel.innerHTML = '<option value="">-- Pilih Handler --</option>' + act.map(p => `<option value="${esc(p.id)}">${esc(p.partner_name)}</option>`).join('');
      if (prev && act.some(p => String(p.id) === prev)) sel.value = prev;
    }
    hint();
  }
  function hint() {
    const sel = document.getElementById('tx-handler'), el = document.getElementById('tx-handler-hint');
    if (!sel || !el) return;
    const h = activePeople().find(p => String(p.id) === sel.value);
    el.textContent = h ? 'Pembagian laba: ' + splitText(splitFor(h, activePeople(), cfg())) : 'Pilih siapa yang memegang order ini; pembagian laba mengikuti pilihanmu.';
  }
  // Dipanggil kairo-app.js saat order disimpan: tambahan kolom transaksi (atau error bila handler belum dipilih).
  function payload() {
    if (!isOn()) return null;
    const val = document.getElementById('tx-handler')?.value;
    if (!val) throw new Error('Pilih handler dulu.');
    const act = activePeople(), h = act.find(p => String(p.id) === String(val));
    if (!h) throw new Error('Handler yang dipilih sudah nonaktif. Pilih handler lain.');
    return { handler_partner_id: h.id, handler_name: h.partner_name, handler_split: splitFor(h, act, cfg()) };
  }

  /* ---------- Settings › Pembagian Omzet ---------- */
  let draft = null; // { on, rows: {id: {active, pct}}, pair }
  function newDraft() {
    const c = cfg(), d = { on: c.on, pair: c.pair_pct, rows: {} };
    people().forEach(p => { d.rows[String(p.id)] = { active: !c.inactive.includes(String(p.id)), pct: mainOf(c, p) }; });
    return d;
  }
  function rowPreview(p, d) {
    const act = people().filter(x => d.rows[String(x.id)]?.active), n = act.length;
    if (!d.rows[String(p.id)]?.active) return 'Nonaktif: tidak bisa dipilih dan dapat 0%';
    if (n === 1) return 'Satu-satunya handler aktif: dapat 100%';
    if (n === 2) { const o = act.find(x => x.id !== p.id); return `Tinggal 2 handler: ${p.partner_name} ${fmt(d.pair)}% · ${o.partner_name} ${fmt(100 - d.pair)}%`; }
    const pct = num(d.rows[String(p.id)].pct);
    return `Lainnya masing-masing ${fmt((100 - pct) / (n - 1))}%`;
  }
  function paint() {
    const card = document.getElementById('kairo-handler-card');
    if (!card) return;
    const ppl = people();
    const need2 = ppl.length < 2;
    const d = draft || (draft = newDraft());
    const act = ppl.filter(p => d.rows[String(p.id)]?.active);
    card.innerHTML = `
      <div class="kairo-cash-toggle">
        <div><strong>Pembagian per handler</strong><small id="kh-note">Tiap order dipegang satu handler (dipilih di form Orders). Handler dapat porsi lebih besar, sisanya dibagi rata ke yang lain. Berlaku untuk order baru; order lama tidak berubah.</small></div>
        <label class="kairo-switch"><input type="checkbox" id="kh-on" ${d.on ? 'checked' : ''} ${need2 ? 'disabled' : ''} aria-describedby="kh-note"><span aria-hidden="true"></span><b class="sr-only">Pembagian per handler</b></label>
      </div>
      ${need2 ? '<p class="kh-warn">Butuh minimal 2 partner. Tambah partner dulu di pembagian di bawah.</p>' : ''}
      ${d.on && !need2 ? `
      <div class="kh-table" role="table" aria-label="Pembagian per handler">
        <div class="kh-row kh-head" role="row"><span>Handler</span><span>Aktif</span><span>Porsi saat handle</span></div>
        ${ppl.map(p => { const r = d.rows[String(p.id)]; return `<div class="kh-row${r.active ? '' : ' is-off'}" role="row" data-id="${esc(p.id)}">
          <div class="kh-name"><strong>${esc(p.partner_name)}</strong><small>${esc(rowPreview(p, d))}</small></div>
          <label class="kairo-switch" title="Aktifkan atau nonaktifkan ${esc(p.partner_name)} sebagai handler"><input type="checkbox" data-kh-active ${r.active ? 'checked' : ''}><span aria-hidden="true"></span><b class="sr-only">Aktif</b></label>
          <div class="kh-pct"><input class="input" type="number" inputmode="decimal" min="1" max="99" step="0.01" data-kh-pct value="${esc(r.pct)}" ${r.active && act.length > 2 ? '' : 'disabled'} aria-label="Porsi ${esc(p.partner_name)} saat jadi handler"><span>%</span></div>
        </div>`; }).join('')}
      </div>
      <div class="kh-pair"><label for="kh-pair">Kalau tinggal 2 handler aktif</label><div class="kh-pct"><input id="kh-pair" class="input" type="number" inputmode="decimal" min="1" max="99" step="0.01" value="${esc(d.pair)}"><span>% untuk handler, sisanya untuk satunya</span></div></div>
      <p class="kh-note">Menonaktifkan handler tidak perlu mengubah angka: pembagian otomatis menyesuaikan (2 aktif = ${fmt(d.pair)}% / ${fmt(100 - d.pair)}%, 1 aktif = 100%). Kas (kalau dipakai) tetap dipotong lebih dulu seperti biasa; handler membagi sisanya. Persentase partner di bagian bawah halaman tetap dipakai untuk Kas dan order tanpa handler.</p>` : ''}
      <div class="kh-actions"><span class="kh-status" id="kh-status" role="status"></span><button type="button" class="btn btn-green" id="kh-save" ${need2 && !cfg().on ? 'disabled' : ''}>Simpan Pengaturan Handler</button></div>`;
  }
  function mountCard() {
    const host = document.getElementById('profit-share-editor-card');
    let card = document.getElementById('kairo-handler-card');
    if (!host || !available()) { card?.remove(); draft = null; return; }
    if (!card) {
      card = document.createElement('div');
      card.id = 'kairo-handler-card'; card.className = 'kairo-handler-card';
      const anchor = host.querySelector('form');
      (anchor || host).insertAdjacentElement(anchor ? 'beforebegin' : 'beforeend', card);
      card.addEventListener('change', onChange);
      card.addEventListener('input', onInput);
      card.addEventListener('click', onClick);
      draft = null;
    }
    const sig = JSON.stringify([people().map(p => [p.id, p.partner_name]), cfg()]);
    if (card.dataset.sig !== sig) { card.dataset.sig = sig; draft = null; paint(); }
  }
  function onChange(e) {
    const d = draft; if (!d) return;
    if (e.target.id === 'kh-on') { d.on = e.target.checked; paint(); return; }
    const row = e.target.closest('.kh-row[data-id]');
    if (row && e.target.matches('[data-kh-active]')) { d.rows[row.dataset.id].active = e.target.checked; paint(); }
  }
  function onInput(e) {
    const d = draft; if (!d) return;
    const row = e.target.closest('.kh-row[data-id]');
    if (row && e.target.matches('[data-kh-pct]')) { d.rows[row.dataset.id].pct = num(e.target.value); refreshPreviews(); }
    else if (e.target.id === 'kh-pair') { d.pair = num(e.target.value); refreshPreviews(); }
  }
  function refreshPreviews() {
    const d = draft; if (!d) return;
    document.querySelectorAll('#kairo-handler-card .kh-row[data-id]').forEach(row => {
      const p = people().find(x => String(x.id) === row.dataset.id); const sm = row.querySelector('small');
      if (p && sm) sm.textContent = rowPreview(p, d);
    });
  }
  async function onClick(e) {
    const btn = e.target.closest('#kh-save');
    if (!btn || !draft) return;
    const d = draft, status = document.getElementById('kh-status');
    const fail = m => { if (status) { status.textContent = m; status.className = 'kh-status is-bad'; } showToast(m, true); };
    try {
      const act = people().filter(p => d.rows[String(p.id)].active);
      if (d.on && !act.length) throw new Error('Minimal satu handler harus aktif.');
      if (d.on) {
        if (!(d.pair > 0 && d.pair < 100)) throw new Error('Porsi untuk 2 handler harus di antara 1% dan 99%.');
        for (const p of act) { const v = d.rows[String(p.id)].pct; if (!(v > 0 && v < 100)) throw new Error(`Porsi ${p.partner_name} harus di antara 1% dan 99%.`); }
      }
      window.kairoBtnLoading?.(btn, true, undefined, 'Menyimpan…');
      const wid = requireWorkspaceId(), next = { ...labels() };
      const main = {}; people().forEach(p => { main[String(p.id)] = num(d.rows[String(p.id)].pct) || DEF_MAIN; });
      next.__handler = { on: d.on, main, pair_pct: d.pair, inactive: people().filter(p => !d.rows[String(p.id)].active).map(p => String(p.id)) };
      const { error } = await db.from('workspace_branding').upsert({ workspace_id: wid, receipt_labels: next, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
      if (error) throw error;
      await loadWorkspaceSaasContext();
      draft = null; document.getElementById('kairo-handler-card')?.removeAttribute('data-sig');
      refresh();
      showToast(d.on ? 'Pembagian per handler tersimpan. Berlaku untuk order baru.' : 'Pembagian per handler dimatikan. Order baru memakai pembagian biasa.');
    } catch (err) {
      fail(window.kairoFriendlyError?.(err.message, 'menyimpan pengaturan handler') || err.message || 'Gagal menyimpan pengaturan handler.');
    } finally { window.kairoBtnLoading?.(btn, false, 'Simpan Pengaturan Handler'); }
  }

  /* ---------- Pasang ---------- */
  let queued = false;
  const refresh = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { mountCard(); mountOrder(); } catch (e) { console.warn('kairo-handler', e); } }); };
  function wrap(name) {
    const core = window[name];
    if (typeof core !== 'function' || core.__kh) return;
    const w = function () { const r = core.apply(this, arguments); if (r && typeof r.then === 'function') r.then(refresh, () => {}); else refresh(); return r; };
    w.__kh = true;
    window[name] = w;
  }
  ['loadWorkspaceSaasContext', 'renderProfitShareEditor', 'loadMasters', 'renderMasterOptions'].forEach(wrap);
  document.addEventListener('kairo:refreshed', refresh);
  document.addEventListener('kairo:template-ready', refresh);
  const watch = id => { const el = document.getElementById(id); if (el) new MutationObserver(refresh).observe(el, { childList: true }); };
  watch('settings');
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  window.kairoHandler = { isOn, payload, splitFor, refresh };
  refresh();
})();
