// Orders: after a saved sale, platform + payment method stay selected; manual Reset clears them.
const { chromium, bootApp } = require('./boot.js');
const SEED = require('./seed.js');
(async () => {
  const b = await chromium.launch();
  const p = await bootApp(b, { seed: SEED });
  await p.evaluate(async () => { openAppPage('input'); await loadPageData('input', { force: true }); });
  await p.waitForTimeout(600);
  const state = () => p.evaluate(() => ({
    platform: document.getElementById('tx-platform').value,
    payment: document.getElementById('tx-payment').value,
    labels: ['tx-platform', 'tx-payment'].map(id => document.getElementById(id).closest('.sh-select-wrap')?.querySelector('.sh-select-label')?.textContent.trim()),
    customer: document.getElementById('tx-customer').value,
    packagesChecked: document.querySelectorAll('.package-check:checked').length
  }));
  await p.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('tx-platform', 'Instagram'); set('tx-payment', 'TRANSFER'); document.getElementById('tx-date').value = todayISO();
    document.getElementById('tx-customer').value = 'Pelanggan Baru';
    const pk = document.querySelector('.package-check'); pk.checked = true; pk.dispatchEvent(new Event('change', { bubbles: true }));
    const tp = document.querySelector('.topic-check'); tp.checked = true; tp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  console.log('filled      ', JSON.stringify(await state()));
  await p.evaluate(() => document.getElementById('tx-form').requestSubmit());
  await p.waitForTimeout(700);
  await p.evaluate(() => document.getElementById('confirm-save')?.click());
  await p.waitForTimeout(1500);
  console.log('after save  ', JSON.stringify(await state()), '| inserted:', await p.evaluate(() => window.__db.log.filter(l => l.startsWith('insert:transactions')).length), '| toast:', await p.evaluate(() => document.getElementById('toast')?.textContent));
  await p.evaluate(() => document.querySelector('#tx-form button[onclick="resetTxForm()"]').click());
  await p.waitForTimeout(300);
  console.log('after Reset ', JSON.stringify(await state()));
  console.log('errors', JSON.stringify(p.errs));
  await b.close();
})();
