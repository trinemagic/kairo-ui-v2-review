// Landing Features screenshots (assets/landing/*.webp) from demo data with neutral names.
// Run: python3 -m http.server 8123 (repo root), then `node shoot-landing.js` here.
const { chromium, bootApp } = require('./boot.js');
const fs=require('fs');
let SEED = require('./seed.js');
SEED=SEED.replace(/'Nesa'/g,"'Partner A'").replace(/'Ganesh'/g,"'Partner B'")+`
;(function(){const H=3600000,D=86400000;
T.transactions.slice(0,4).forEach(t=>t.shift_id='s1');
T.reading_shifts.push({id:'s2',workspace_id:'w1',opened_at:new Date(now-D-9*H).toISOString(),closed_at:new Date(now-D-1*H).toISOString()},{id:'s3',workspace_id:'w1',opened_at:new Date(now-2*D-8*H).toISOString(),closed_at:new Date(now-2*D-2*H).toISOString()},{id:'s4',workspace_id:'w1',opened_at:new Date(now-3*D-7*H).toISOString(),closed_at:new Date(now-3*D-H).toISOString()});
T.transactions.slice(4,9).forEach(t=>t.shift_id='s2');T.transactions.slice(9,13).forEach(t=>t.shift_id='s3');T.transactions.slice(13,16).forEach(t=>t.shift_id='s4');
T.cash_expenses.push({id:'ce2',workspace_id:'w1',expense_date:iso(now-D),amount:45000,description:'Kuota internet'},{id:'ce3',workspace_id:'w1',expense_date:iso(now-2*D),amount:30000,description:'Biaya admin transfer'},{id:'ce4',workspace_id:'w1',expense_date:iso(now-4*D),amount:60000,description:'Desain konten'});
Object.keys(T.transactions[0]).filter(k=>/tip/i.test(k)).forEach(k=>T.transactions[0][k]=0);
T.cash_injections.push({id:'ci2',workspace_id:'w1',injection_date:iso(now-3*D),amount:150000,source:'Owner',description:'Tambahan kas'});
})();`;
const OUT=require('path').join(__dirname,'../../assets/landing');fs.mkdirSync(OUT,{recursive:true});
async function toWebp(page,buf,name,width){
  const data='data:image/png;base64,'+buf.toString('base64');
  const webp=await page.evaluate(async({data,width})=>{const img=new Image();img.src=data;await img.decode();const w=Math.min(width,img.naturalWidth),h=Math.round(img.naturalHeight*w/img.naturalWidth);const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(img,0,0,w,h);return [c.toDataURL('image/webp',0.82),w,h]},{data,width});
  fs.writeFileSync(`${OUT}/${name}.webp`,Buffer.from(webp[0].split(',')[1],'base64'));console.log(name,webp[1]+'x'+webp[2],fs.statSync(`${OUT}/${name}.webp`).size);
}
(async()=>{const b=await chromium.launch();
const p=await bootApp(b,{seed:SEED,plan:'pro',width:1440,height:1000,dsf:2,workspaceName:'Toko Demo'});
await p.evaluate(()=>{try{hydrateSaasUi()}catch(e){}});
await p.addStyleTag({content:'#app-shell .header,#app-shell header{position:static!important;top:auto!important} *{caret-color:transparent!important}'});
const shot=async(sel,name,clipH)=>{await p.evaluate(s=>{const e=document.querySelector(s);window.scrollTo(0,e.getBoundingClientRect().top+scrollY-24)},sel);await p.waitForTimeout(400);const el=await p.$(sel);const bb=await el.boundingBox();const buf=await p.screenshot({clip:{x:bb.x,y:bb.y,width:bb.width,height:Math.min(bb.height,clipH||bb.height)}});await toWebp(p,buf,name,1200);0};
// Open Store (dashboard)
await p.evaluate(async()=>{openAppPage('dashboard');await loadPageData('dashboard',{force:true})});await p.waitForTimeout(900);
if(await p.evaluate(()=>!document.querySelector('#shift-history-toggle')?.textContent.includes('Minimize')))await p.click('#shift-history-toggle');
await p.waitForTimeout(400);
await shot('.shift-card','open-store',560);
// Orders form
await p.evaluate(async()=>{openAppPage('input');await loadPageData('input',{force:true})});await p.waitForTimeout(900);
await p.evaluate(()=>{const set=(id,v)=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}))};document.getElementById('tx-customer').value='Alya Putri';document.getElementById('tx-date').value=todayISO();set('tx-platform','Instagram');set('tx-payment','QRIS');const pk=document.querySelector('.package-check');pk.checked=true;pk.dispatchEvent(new Event('change',{bubbles:true}));const tp=document.querySelector('.topic-check');tp.checked=true;tp.dispatchEvent(new Event('change',{bubbles:true}))});
const formCard=await p.evaluate(()=>{const f=document.getElementById('tx-form');const c=f.closest('.card')||f.parentElement;c.id=c.id||'kairo-shot-orders';return '#'+c.id});
await shot(formCard,'orders',760);
// Receipt
await p.evaluate(()=>openSavedReceipt(window.__db.tables.transactions[0].id));await p.waitForTimeout(900);
const rsel=await p.evaluate(()=>{const m=document.getElementById('receipt-modal');const c=m.querySelector('.receipt-card,.modal-card,.modal-content')||m.firstElementChild;c.id=c.id||'kairo-shot-receipt';return '#'+c.id});
await shot(rsel,'receipt');
await p.evaluate(()=>{const m=document.getElementById('receipt-modal');m.style.display='none'});
// Petty cash: expense history with its own date filter
await p.evaluate(async()=>{openAppPage('cash');await loadPageData('cash',{force:true})});await p.waitForTimeout(900);
await p.evaluate(()=>{const bar=document.querySelector('#cash .cash-filter-bar');let t=bar.nextElementSibling;while(t&&!t.classList.contains('table-wrap'))t=t.nextElementSibling;const w=document.createElement('div');w.id='kairo-shot-cash';w.style.cssText='margin-top:48px;position:relative;z-index:2;padding:18px;background:var(--v3-surface,#fff);border-radius:20px';bar.parentNode.insertBefore(w,bar);w.appendChild(bar);w.appendChild(t)});
await p.waitForTimeout(400);{const el=await p.$('#kairo-shot-cash');const buf=await el.screenshot();await toWebp(p,buf,'petty-cash',1200);0}
console.log(p.errs);await b.close();
})();
