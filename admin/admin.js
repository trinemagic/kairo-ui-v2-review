/* KAIRO Admin — logika lama (RPC platform_admin_*) dengan tampilan baru. */
(function(){
'use strict';
const SUPABASE_URL='https://sbjmvsiwngmfxfktxbgr.supabase.co';
const SUPABASE_KEY='sb_publishable_cylO3B4mLWoohXAWlI0R1A_uanf1qYM';

/* Akses: tidak ada form login. Halaman ini hanya bekerja bila dibuka lewat tombol "KAIRO Admin" di
   dashboard Trine Magic; tab dashboard itulah yang memberi token sesi (lihat openKairoAdmin di
   assets/kairo-app.js). Token diminta ulang saat hampir kedaluwarsa, jadi bila dashboard ditutup atau
   logout, admin ikut terkunci. Server tetap memeriksa is_platform_admin di setiap fungsi. */
let session=null;
function requestToken(){
  return new Promise((resolve,reject)=>{
    const op=window.opener;
    if(!op||op.closed)return reject(new Error('no-opener'));
    const timer=setTimeout(()=>{window.removeEventListener('message',onMsg);reject(new Error('no-session'));},5000);
    function onMsg(e){
      if(e.origin!==location.origin||e.source!==op||e.data?.type!=='kairo-admin-token')return;
      clearTimeout(timer);window.removeEventListener('message',onMsg);
      e.data.token?resolve({token:e.data.token,exp:Number(e.data.exp)||0}):reject(new Error('no-session'));
    }
    window.addEventListener('message',onMsg);
    op.postMessage({type:'kairo-admin-token-request'},location.origin);
  });
}
async function accessToken(){
  if(session&&session.exp*1000-Date.now()>60e3)return session.token;
  try{session=await requestToken();return session.token;}
  catch(e){session=null;gate(e.message==='no-opener'?'no-opener':'no-session');throw e;}
}
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{accessToken,auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
// Log Aktivitas: setiap aksi admin yang berhasil dicatat lewat platform_admin_log_activity
// (SQL .claude/sql/2026-10-admin-activity-log.sql). Gagal mencatat tidak menggagalkan aksinya.
const PLAN_TXT=v=>String(v||'').toLowerCase()==='pro'?'Pro':'Gratis';
const LOG_ACTIONS={
  platform_admin_update_subscription:a=>['Ubah subscription',a.p_workspace_id,`${PLAN_TXT(a.p_plan)} · ${a.p_status||''}${a.p_valid_until?' · s/d '+String(a.p_valid_until).slice(0,10):''}`],
  platform_admin_update_workspace_status:a=>['Ubah status workspace',a.p_workspace_id,a.p_status],
  platform_admin_delete_workspace:a=>['Hapus akun & workspace',a.p_workspace_id,'Permanen'],
  platform_admin_record_sale:a=>['Catat penjualan',a.p_workspace_id,`${PLAN_TXT(a.p_plan)} · Rp${Number(a.p_amount||0).toLocaleString('id-ID')} · ${a.p_payment_status||''}`],
  platform_admin_update_sale_status:a=>{const x=sales.find(v=>String(v.id)===String(a.p_sale_id));return ['Ubah status pembayaran',x?.workspace_id||null,a.p_status,x?.workspace_name];},
  platform_admin_update_plan_price:a=>['Ubah harga paket',null,`${PLAN_TXT(a.p_plan)} · bulanan Rp${Number(a.p_monthly||0).toLocaleString('id-ID')}`],
  platform_admin_record_expense:a=>['Catat pengeluaran',null,`${a.p_category||''} · Rp${Number(a.p_amount||0).toLocaleString('id-ID')}`],
  platform_admin_delete_expense:()=>['Hapus pengeluaran',null,null],
  platform_admin_save_workspace_meta:a=>['Simpan CRM',a.p_workspace_id,a.p_mark_contacted?'Ditandai sudah dihubungi':null],
  platform_admin_create_followup:a=>['Buat follow-up',a.p_workspace_id,a.p_title],
  platform_admin_set_followup_status:a=>['Ubah status follow-up',null,a.p_status],
  platform_admin_save_settings:()=>['Ubah pengaturan admin',null,null],
  platform_admin_save_custom_request:a=>[a.p_id?'Ubah request Custom':'Catat request Custom',a.p_workspace_id,a.p_title],
  platform_admin_delete_custom_request:()=>['Hapus request Custom',null,null]
};
const rawRpc=db.rpc.bind(db);
db.rpc=async(fn,args)=>{
  const make=LOG_ACTIONS[fn];let entry=null;
  // Ambil nama workspace SEBELUM aksi (setelah dihapus, workspace sudah tidak ada di daftar).
  if(make){try{const [action,wsId,detail,wsName]=make(args||{});entry={action,wsId,detail,name:wsName||(wsId?all.find(x=>String(x.workspace_id)===String(wsId))?.workspace_name:null)||null};}catch(_e){}}
  const r=await rawRpc(fn,args);
  if(entry&&!r.error){try{
    const {action,wsId,detail,name}=entry;
    await rawRpc('platform_admin_log_activity',{p_action:action,p_workspace_id:wsId||null,p_workspace_name:name,p_detail:detail==null?null:String(detail)});
  }catch(_e){}}
  return r;
};

let activeFilter='all',all=[],sales=[],expenses=[],renewals=[],planPerf=[],analytics={},crm=[],followups=[],platformSettings={},activity=[],business={},overview={};
let selected=null,selectedCrm=null,revenueChart=null;
let serverHealth=null,serverLatency=null,wsActivity=[],clientErrors=[],customReqs=[],customEditing=null,issues=[],issueFilter='all';
const needSql={};

const PAGES={
  overview:['Overview','Ringkasan platform KAIRO Workspaces'],
  issues:['Perlu Perhatian','Masalah yang terdeteksi otomatis dari data & aplikasi user'],
  workspaces:['Workspaces','Paket, masa aktif, dan status setiap workspace'],
  sales:['Penjualan','Catat dan pantau pembayaran paket'],
  renewals:['Renewal','Workspace yang masa aktifnya segera habis'],
  plans:['Harga Paket','Harga bulanan & tahunan per paket'],
  templates:['Template','Template usaha yang ada di KAIRO Workspaces + preview dashboard'],
  expenses:['Pengeluaran','Biaya operasional dan laba bersih'],
  analytics:['Analitik','Performa paket dan subscription'],
  crm:['CRM & Follow-up','Kontak customer dan tindak lanjut'],
  custom:['Request Custom','Permintaan customer paket Pro custom + checklist pengerjaan'],
  server:['Kapasitas Server','Pemakaian database & beban server KAIRO'],
  settings:['Pengaturan','Target revenue, peringatan, dan backup'],
  activity:['Log Aktivitas','Riwayat perubahan oleh admin']
};

const $=id=>document.getElementById(id);
const setText=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const dateID=v=>v?new Date(v).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'—';
const dayID=v=>v?new Date(v+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'—';
const todayISO=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};

/* Paket: hanya Gratis & Pro (plus/custom/enterprise lama = Pro) */
const planKey=p=>['plus','pro','custom','enterprise'].includes(String(p||'').toLowerCase())?'pro':'basic';
const planBadge=p=>planKey(p)==='pro'?'<span class="badge plain b-pro">PRO</span>':'<span class="badge plain b-free">GRATIS</span>';
const SUB={active:['Aktif','b-ok'],trialing:['Trial','b-info'],past_due:['Telat bayar','b-warn'],canceled:['Dibatalkan','b-danger'],inactive:['Nonaktif','b-mute']};
const WS={active:['Aktif','b-ok'],suspended:['Suspend','b-warn'],archived:['Arsip','b-mute']};
const PAY={paid:'Lunas',pending:'Pending',refunded:'Refund',void:'Void'};
const FOLLOW={open:['Open','b-info'],done:['Selesai','b-ok'],canceled:['Batal','b-mute']};
const PRIO={high:['Tinggi','b-danger'],normal:['Normal','b-info'],low:['Rendah','b-mute']};
const PERIOD={monthly:'1 bulan',quarterly:'3 bulan',semiannual:'6 bulan',annual:'1 tahun',custom:'Custom'};
const CAT={hosting:'Hosting',domain:'Domain',tools:'Tools',marketing:'Marketing',fee:'Biaya admin',operational:'Operasional',other:'Lainnya'};
const badge=(map,v)=>{const k=String(v||'').toLowerCase(),m=map[k];return m?`<span class="badge ${m[1]}">${esc(m[0])}</span>`:`<span class="badge b-mute">${esc(v||'—')}</span>`;};

// Pop-up sama dengan dashboard KAIRO: kartu bertumpuk di kanan atas (di bawah topbar), ikon + judul per jenis,
// tombol X, maks 4, hilang sendiri 5 detik (jeda saat hover/fokus). toast(pesan, true|'success'|'info'|'warning'|'error').
const TOAST_KINDS={
  success:{title:'Berhasil',icon:'<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>'},
  info:{title:'Info',icon:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6h.01"/>'},
  warning:{title:'Perhatian',icon:'<path d="M10.3 4.2 2.9 17.1A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.9L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4"/><path d="M12 16.8h.01"/>'},
  error:{title:'Gagal',icon:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.4h.01"/>'}
};
function dismissToast(item){if(!item||item.classList.contains('is-leaving'))return;clearTimeout(item._timer);item.classList.add('is-leaving');setTimeout(()=>item.remove(),200);}
function toast(msg,kind){
  const host=$('toast');if(!host)return;
  const variant=typeof kind==='string'&&TOAST_KINDS[kind]?kind:(kind?'error':'success'),{title,icon}=TOAST_KINDS[variant];
  const item=document.createElement('div');item.className=`toast-card is-${variant}`;item.setAttribute('role',variant==='error'?'alert':'status');
  item.innerHTML=`<svg class="toast-icon" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><div class="toast-copy"><strong>${title}</strong><span></span></div><button type="button" class="toast-close" aria-label="Tutup notifikasi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  item.querySelector('.toast-copy span').textContent=String(msg??'');
  item.querySelector('.toast-close').onclick=()=>dismissToast(item);
  const start=()=>{clearTimeout(item._timer);item._timer=setTimeout(()=>dismissToast(item),5000);};
  item.addEventListener('mouseenter',()=>clearTimeout(item._timer));item.addEventListener('mouseleave',start);
  item.addEventListener('focusin',()=>clearTimeout(item._timer));item.addEventListener('focusout',start);
  const bar=document.querySelector('.topbar')?.getBoundingClientRect();
  host.style.setProperty('--toast-top',bar&&bar.height&&bar.bottom>0?`${Math.round(bar.bottom+10)}px`:'16px');
  host.prepend(item);[...host.querySelectorAll('.toast-card:not(.is-leaving)')].slice(4).forEach(dismissToast);start();
}
function remain(v){if(!v)return'—';const d=Math.ceil((+new Date(v)-Date.now())/864e5);return d<0?`${Math.abs(d)} hari lewat`:d===0?'Hari ini':`${d} hari`;}
function remainClass(v){if(!v)return'';const d=Math.ceil((+new Date(v)-Date.now())/864e5);return d<0?'t-danger':d<=7?'t-warn':'';}

/* Gerbang */
const GATE={
  'no-opener':['Buka dari dashboard Trine Magic','Admin panel hanya bisa dibuka lewat tombol <b>KAIRO Admin</b> di menu dashboard workspace Trine Magic.'],
  'no-session':['Sesi dashboard tidak ditemukan','Pastikan tab dashboard Trine Magic masih terbuka dan sudah login, lalu buka lagi lewat tombol <b>KAIRO Admin</b>.'],
  'denied':['Akses ditolak','Akun ini tidak memiliki akses admin platform KAIRO.']
};
function gate(kind){
  const g=GATE[kind]||GATE['no-session'];
  $('gateBody').innerHTML=`<svg><use href="#i-lock"/></svg><b>${g[0]}</b><p>${g[1]}</p>`;
  document.querySelectorAll('.modal-backdrop').forEach(m=>m.classList.add('hidden'));
  $('shell').classList.add('hidden');$('gate').classList.remove('hidden');
  clearInterval(serverTimer);
}
async function boot(){
  if(!window.opener)return gate('no-opener');
  try{await accessToken();}catch(_e){return;}
  const {data,error}=await db.rpc('is_platform_admin');
  if(error||!data)return gate('denied');
  $('gate').classList.add('hidden');$('shell').classList.remove('hidden');
  const initial=(location.hash||'').replace('#','');
  activatePage(PAGES[initial]?initial:'overview');
  await load();stampRefresh();
}

/* Data */
async function load(){
  const specs=[['platform_admin_overview'],['platform_admin_workspaces'],['platform_admin_activity',{p_limit:100}],['platform_admin_business_overview'],['platform_admin_sales',{p_limit:500}],['platform_admin_revenue_series',{p_months:12}],['platform_admin_plan_prices'],['platform_admin_expenses',{p_limit:500}],['platform_admin_analytics'],['platform_admin_plan_performance'],['platform_admin_renewal_queue',{p_days:60}],['platform_admin_crm_rows'],['platform_admin_followups',{p_limit:500}],['platform_admin_get_settings']];
  const calls=await Promise.all(specs.map(([fn,args])=>db.rpc(fn,args).then(r=>r,e=>({error:e}))));
  const failed=calls.map((c,i)=>c.error?`${specs[i][0]}: ${c.error.message||c.error}`:null).filter(Boolean);
  failed.forEach(f=>console.warn('Admin load:',f));
  const [o,w,a,b,s,series,prices,ex,an,pp,rq,cr,fu,ps]=calls.map(x=>x.error?null:x.data);
  overview=o||{};all=w||[];activity=a||[];business=b||{};sales=s||[];expenses=ex||[];analytics=an||{};planPerf=pp||[];renewals=rq||[];crm=cr||[];followups=fu||[];platformSettings=ps||{};
  await loadExtras();
  renderOverview(series||[]);renderWorkspaces();renderSales();renderActivity();renderPrices(prices||[]);fillWorkspaceSelect();renderExpenses();renderAnalytics();renderRenewals();renderCrm();renderFollowups();renderPlatformSettings();fillFollowWorkspace();renderCustom();renderServer();renderTemplates();renderIssues();renderNavCounts();
  if(failed.length)toast(`Sebagian data gagal dimuat (${failed.length}). ${failed[0]}`,'warning');
}

/* Fitur v2 (butuh SQL admin panel v2). Gagal = tampilkan catatan, bukan error merah. */
async function loadServer(){
  const t0=performance.now(),r=await db.rpc('platform_admin_server_health').then(x=>x,e=>({error:e}));
  needSql.server=!!r.error;serverHealth=r.error?null:r.data;serverLatency=r.error?null:Math.round(performance.now()-t0);
}
async function loadExtras(){
  const [act,errs,cu]=await Promise.all([db.rpc('platform_admin_workspace_activity'),db.rpc('platform_admin_client_errors',{p_hours:72}),db.rpc('platform_admin_custom_requests'),loadServer()].map(p=>Promise.resolve(p).then(x=>x||{},e=>({error:e}))));
  needSql.activity=!!act.error;needSql.errors=!!errs.error;needSql.custom=!!cu.error;
  wsActivity=act.data||[];clientErrors=errs.data||[];customReqs=cu.data||[];
}
function renderOverview(series){
  const free=Number(overview.basic||0),pro=Number(overview.plus||0)+Number(overview.pro||0),total=Number(overview.total_workspaces??free+pro);
  setText('total',total);setText('active',overview.active_workspaces??0);setText('basic',free);setText('pro',pro);
  setText('revMonth',money(business.revenue_month));setText('salesMonth',business.sales_month??0);setText('renew30',business.renewals_30??0);
  setText('pendingAmount',money(business.pending_amount));setText('pendingB',money(business.pending_amount));
  setText('revAll',money(business.revenue_all));setText('revMonth2',money(business.revenue_month));setText('pending2',money(business.pending_amount));setText('salesMonth2',business.sales_month??0);setText('renew302',business.renewals_30??0);
  const now=Date.now(),d7=now+7*864e5,ar=all.filter(x=>['active','trialing'].includes(String(x.subscription_status||'').toLowerCase()));
  const exp7=ar.filter(x=>x.valid_until&&+new Date(x.valid_until)>=now&&+new Date(x.valid_until)<=d7).length;
  setText('exp7',exp7);setText('exp7b',exp7);setText('issues',all.filter(isIssue).length);
  const sum=free+pro;setText('donutTotal',sum);setText('legendFree',free);setText('legendPro',pro);
  $('planDonut').style.setProperty('--pro',sum?(pro/sum*100).toFixed(1):0);
  renderGoal();renderTasks();renderChart(series);
}
function isIssue(x){return ['past_due','canceled','inactive'].includes(String(x.subscription_status||'').toLowerCase())||['suspended','archived'].includes(String(x.workspace_status||'').toLowerCase());}

function renderGoal(){
  const target=Number(platformSettings.monthly_revenue_target||0),rev=Number(business.revenue_month??analytics.revenue_month??0),pct=target?Math.min(100,rev/target*100):0;
  setText('targetText',target?`Target ${money(target)}`:'Target belum diatur');
  setText('targetPct',target?(rev/target*100).toFixed(1)+'%':'—');
  $('targetBar').style.width=pct+'%';
  const today=todayISO(),open=followups.filter(x=>x.status==='open');
  setText('followToday',open.filter(x=>x.due_date===today).length);
  setText('followOverdue',open.filter(x=>x.due_date<today).length);
  setText('followOpen',open.length);
  setText('crmCount',crm.filter(x=>x.contact_name||x.contact_handle||x.phone||x.admin_notes).length);
}
function renderTasks(){
  const today=todayISO(),list=followups.filter(x=>x.status==='open'&&x.due_date<=today).sort((a,b)=>a.due_date<b.due_date?-1:1).slice(0,5);
  $('taskList').innerHTML=list.length?list.map(x=>`<li><button class="task-check" data-done="${esc(x.id)}" aria-label="Tandai selesai: ${esc(x.title)}" title="Tandai selesai"><svg><use href="#i-check"/></svg></button><div><b>${esc(x.title)}</b><small>${esc(x.workspace_name||'')} · <span class="${x.due_date<today?'t-danger':''}">${x.due_date<today?'Terlambat, '+dayID(x.due_date):'Hari ini'}</span></small></div></li>`).join(''):'<li class="empty-li">Tidak ada follow-up jatuh tempo hari ini.</li>';
  $('taskList').querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>setFollowStatus(+b.dataset.done,'done'));
}
function renderNavCounts(){
  const today=todayISO();
  setText('navWs',all.length||'');
  setText('navRenew',renewals.filter(x=>Number(x.days_left)<=7).length||'');
  setText('navFollow',followups.filter(x=>x.status==='open'&&x.due_date<=today).length||'');
  setText('navIssues',issues.filter(x=>x.sev==='high').length||'');
  setText('navCustom',customReqs.filter(x=>x.status!=='success').length||'');
}

function renderChart(series){
  const ctx=$('revenueChart');if(!ctx||!window.Chart)return;
  if(revenueChart)revenueChart.destroy();
  Chart.defaults.font.family='"Plus Jakarta Sans",system-ui,sans-serif';
  const g=ctx.getContext('2d').createLinearGradient(0,0,0,260);g.addColorStop(0,'rgba(37,185,176,.38)');g.addColorStop(1,'rgba(37,185,176,0)');
  revenueChart=new Chart(ctx,{type:'line',data:{labels:series.map(x=>new Date(x.month_start).toLocaleDateString('id-ID',{month:'short',year:'2-digit'})),datasets:[{label:'Revenue',data:series.map(x=>Number(x.revenue||0)),tension:.35,fill:true,backgroundColor:g,borderColor:'#25b9b0',borderWidth:2,pointRadius:3,pointBackgroundColor:'#25b9b0'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>money(c.parsed.y)}}},
      scales:{x:{grid:{display:false},ticks:{color:'#aebccb'}},y:{grid:{color:'rgba(255,255,255,.07)'},border:{display:false},ticks:{color:'#aebccb',callback:v=>'Rp '+new Intl.NumberFormat('id-ID',{notation:'compact'}).format(v)}}}}});
}

// Duration a user picked when signing up for Pro (needs SQL 2026-10-admin-requested-period).
function requestedPro(id){const a=wsActivity.find(x=>x.workspace_id===id);return a&&a.requested_plan==='pro'&&a.requested_variant!=='custom'&&PERIOD[a.requested_period]?a:null;}
function renderWorkspaces(){
  const q=$('search').value.trim().toLowerCase(),now=Date.now(),d30=now+30*864e5;
  const r=all.filter(x=>{
    if(q&&!`${x.workspace_name} ${x.owner_username||''} ${x.slug||''}`.toLowerCase().includes(q))return false;
    if(activeFilter==='basic'||activeFilter==='pro')return planKey(x.plan)===activeFilter;
    if(activeFilter==='expiring')return x.valid_until&&+new Date(x.valid_until)>=now&&+new Date(x.valid_until)<=d30;
    if(activeFilter==='issue')return isIssue(x);
    return true;});
  $('rows').innerHTML=r.map(x=>`<tr class="click" data-id="${esc(x.workspace_id)}" tabindex="0"><td><b>${esc(x.workspace_name)}</b><br><small>${esc(x.slug||'')}</small></td><td>${esc(x.owner_username||'—')}</td><td>${planBadge(x.plan)}${planKey(x.plan)!=='pro'&&requestedPro(x.workspace_id)?`<br><small>Daftar Pro ${esc(PERIOD[requestedPro(x.workspace_id).requested_period])}</small>`:''}</td><td>${badge(SUB,x.subscription_status)}</td><td>${badge(WS,x.workspace_status)}</td><td>${dateID(x.valid_until)}</td><td class="${remainClass(x.valid_until)}">${esc(remain(x.valid_until))}</td></tr>`).join('');
  $('empty').classList.toggle('hidden',r.length>0);
  $('rows').querySelectorAll('tr').forEach(tr=>{tr.onclick=()=>openWorkspace(tr.dataset.id);tr.onkeydown=e=>{if(e.key==='Enter')openWorkspace(tr.dataset.id);};});
}

function renderSales(){
  $('saleRows').innerHTML=sales.map(x=>`<tr><td>${dateID(x.paid_at||x.created_at)}</td><td><b>${esc(x.workspace_name)}</b></td><td>${esc(x.customer_name||'—')}</td><td>${planBadge(x.plan)}</td><td>${esc(PERIOD[x.billing_period]||x.billing_period||'—')}</td><td class="num"><b>${money(x.amount)}</b></td><td>${esc(x.payment_method||'—')}</td><td><select class="status-select saleStatus" data-id="${esc(x.id)}" aria-label="Status pembayaran">${Object.keys(PAY).map(k=>`<option value="${k}" ${x.payment_status===k?'selected':''}>${PAY[k]}</option>`).join('')}</select></td></tr>`).join('');
  $('saleEmpty').classList.toggle('hidden',sales.length>0);
  document.querySelectorAll('.saleStatus').forEach(s=>s.onchange=async()=>{
    const {error}=await db.rpc('platform_admin_update_sale_status',{p_sale_id:+s.dataset.id,p_status:s.value});
    if(error)return toast(error.message,true);toast('Status pembayaran diperbarui');await load();});
}

function activityItem(x){return `<li><b>${esc(x.workspace_name||'KAIRO')}</b><small>${esc(String(x.action||'').replaceAll('_',' '))}${x.detail?' · '+esc(x.detail):''} · ${x.created_at?new Date(x.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'—'}</small></li>`;}
function renderActivity(){
  const none='<li class="empty-li">Belum ada aktivitas admin.</li>';
  $('activity').innerHTML=activity.length?activity.map(activityItem).join(''):none;
  $('activityMini').innerHTML=activity.length?activity.slice(0,5).map(activityItem).join(''):none;
}

function renderPrices(p){
  const rows=p.filter(x=>['basic','pro'].includes(String(x.plan).toLowerCase()));
  $('priceGrid').innerHTML=rows.length?rows.map(x=>{const pro=planKey(x.plan)==='pro';return `<div class="widget price-card${pro?' pro':''}"><h2>${pro?'Pro':'Gratis'} ${planBadge(x.plan)}</h2><label class="field"><span>Harga bulanan (Rp)</span><input class="pMonth" data-plan="${esc(x.plan)}" type="number" min="0" value="${Number(x.monthly_price||0)}"></label><label class="field"><span>Harga tahunan (Rp)</span><input class="pAnnual" data-plan="${esc(x.plan)}" type="number" min="0" value="${Number(x.annual_price||0)}"></label><button class="btn btn-primary savePrice" data-plan="${esc(x.plan)}">Simpan Harga</button></div>`;}).join(''):'<div class="widget"><p class="empty">Data harga paket belum tersedia.</p></div>';
  document.querySelectorAll('.savePrice').forEach(b=>b.onclick=async()=>{
    const p=b.dataset.plan,m=+document.querySelector(`.pMonth[data-plan="${p}"]`).value,a=+document.querySelector(`.pAnnual[data-plan="${p}"]`).value;
    const {error}=await db.rpc('platform_admin_update_plan_price',{p_plan:p,p_monthly:m,p_annual:a});
    if(error)return toast(error.message,true);toast('Harga paket disimpan');await load();});
}

function renderExpenses(){
  const n=new Date(),total=expenses.reduce((a,x)=>a+Number(x.amount||0),0),month=expenses.filter(x=>{const d=new Date(x.expense_date+'T12:00:00');return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}).reduce((a,x)=>a+Number(x.amount||0),0);
  const rm=Number(analytics.revenue_month||0),ra=Number(analytics.revenue_all||0);
  setText('expenseMonth',money(month));setText('expenseAll',money(total));setText('netMonth',money(rm-month));setText('netAll',money(ra-total));setText('marginMonth',rm?((rm-month)/rm*100).toFixed(1)+'%':'—');
  $('expenseRows').innerHTML=expenses.map(x=>`<tr><td>${dayID(x.expense_date)}</td><td><span class="badge plain b-mute">${esc(CAT[x.category]||x.category||'—')}</span></td><td><b>${esc(x.description)}</b>${x.notes?`<br><small>${esc(x.notes)}</small>`:''}</td><td>${esc(x.payment_method||'—')}</td><td class="num"><b>${money(x.amount)}</b></td><td class="num"><button class="table-btn is-danger delExpense" data-id="${esc(x.id)}">Hapus</button></td></tr>`).join('');
  $('expenseEmpty').classList.toggle('hidden',expenses.length>0);
  document.querySelectorAll('.delExpense').forEach(b=>b.onclick=async()=>{
    if(!confirm('Hapus pengeluaran ini?'))return;
    const {error}=await db.rpc('platform_admin_delete_expense',{p_expense_id:+b.dataset.id});
    if(error)return toast(error.message,true);toast('Pengeluaran dihapus');await load();});
}

function renderAnalytics(){
  setText('paidCustomers',analytics.paid_customers??0);setText('newWsMonth',analytics.new_workspaces_month??0);setText('activeSubs',analytics.active_subscriptions??0);setText('expiredSubs',analytics.expired_subscriptions??0);
  const merged={};
  planPerf.forEach(x=>{const k=planKey(x.plan),m=merged[k]||(merged[k]={plan:k,workspace_count:0,paid_sales:0,revenue:0});m.workspace_count+=Number(x.workspace_count||0);m.paid_sales+=Number(x.paid_sales||0);m.revenue+=Number(x.revenue||0);});
  const rows=['basic','pro'].filter(k=>merged[k]).map(k=>merged[k]),total=rows.reduce((a,x)=>a+x.revenue,0);
  $('planPerfRows').innerHTML=rows.length?rows.map(x=>{const pct=total?x.revenue/total*100:0;return `<tr><td>${planBadge(x.plan)}</td><td class="num">${x.workspace_count}</td><td class="num">${x.paid_sales}</td><td class="num"><b>${money(x.revenue)}</b></td><td class="num">${money(x.paid_sales?x.revenue/x.paid_sales:0)}</td><td>${pct.toFixed(1)}%<div class="mini-bar"><i style="width:${Math.min(100,pct)}%"></i></div></td></tr>`;}).join(''):'<tr><td colspan="6" class="empty">Belum ada data.</td></tr>';
}

function renderRenewals(){
  $('renewRows').innerHTML=renewals.map(x=>{const d=Number(x.days_left);return `<tr><td><b>${esc(x.workspace_name)}</b></td><td>${esc(x.owner_username||'—')}</td><td>${planBadge(x.plan)}</td><td>${badge(SUB,x.subscription_status)}</td><td>${dateID(x.valid_until)}</td><td class="${d<0?'t-danger':d<=7?'t-warn':''}"><b>${d<0?Math.abs(d)+' hari lewat':d+' hari'}</b></td><td class="num"><button class="table-btn renewOpen" data-id="${esc(x.workspace_id)}">Kelola</button></td></tr>`;}).join('');
  $('renewEmpty').classList.toggle('hidden',renewals.length>0);
  document.querySelectorAll('.renewOpen').forEach(b=>b.onclick=()=>openWorkspace(b.dataset.id));
}

function renderCrm(){
  const q=$('crmSearch').value.trim().toLowerCase(),r=crm.filter(x=>!q||`${x.workspace_name} ${x.owner_username||''} ${x.contact_name||''} ${x.contact_handle||''} ${(x.tags||[]).join(' ')}`.toLowerCase().includes(q));
  $('crmRows').innerHTML=r.map(x=>`<tr><td><b>${esc(x.workspace_name)}</b><br>${planBadge(x.plan)}</td><td>${esc(x.contact_name||x.owner_username||'—')}<br><small>${esc(x.contact_handle||x.phone||'')}</small></td><td>${esc(x.acquisition_source||'—')}</td><td>${(x.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')||'—'}</td><td>${dateID(x.last_contacted_at)}</td><td class="note">${esc((x.admin_notes||'—').slice(0,120))}</td><td class="num"><button class="table-btn crmEdit" data-id="${esc(x.workspace_id)}">Kelola</button></td></tr>`).join('');
  $('crmEmpty').classList.toggle('hidden',r.length>0);
  document.querySelectorAll('.crmEdit').forEach(b=>b.onclick=()=>openCrm(b.dataset.id));
}
function openCrm(id){
  selectedCrm=crm.find(x=>x.workspace_id===id);if(!selectedCrm)return;
  setText('crmTitle',selectedCrm.workspace_name);setText('crmSub','Owner: '+(selectedCrm.owner_username||'—'));
  $('cName').value=selectedCrm.contact_name||'';$('cHandle').value=selectedCrm.contact_handle||'';$('cPhone').value=selectedCrm.phone||'';$('cSource').value=selectedCrm.acquisition_source||'';$('cTags').value=(selectedCrm.tags||[]).join(', ');$('cNotes').value=selectedCrm.admin_notes||'';$('cError').textContent='';
  openModal('crmModal');
}
async function saveCrm(mark){
  try{const tags=$('cTags').value.split(',').map(x=>x.trim()).filter(Boolean);
    const {error}=await db.rpc('platform_admin_save_workspace_meta',{p_workspace_id:selectedCrm.workspace_id,p_contact_name:$('cName').value,p_contact_handle:$('cHandle').value,p_phone:$('cPhone').value,p_source:$('cSource').value,p_tags:tags,p_notes:$('cNotes').value,p_mark_contacted:mark});
    if(error)throw error;closeModal('crmModal');toast(mark?'CRM disimpan, kontak ditandai sudah dihubungi':'CRM disimpan');await load();
  }catch(e){$('cError').textContent=e.message;}
}

function renderFollowups(){
  const f=$('followFilter').value,today=todayISO(),r=followups.filter(x=>f==='all'||x.status===f);
  $('followRows').innerHTML=r.map(x=>`<tr><td class="${x.status==='open'&&x.due_date<today?'t-danger':''}"><b>${dayID(x.due_date)}</b></td><td><b>${esc(x.workspace_name)}</b><br><small>${esc(x.owner_username||'')}</small></td><td>${badge(PRIO,x.priority)}</td><td><b>${esc(x.title)}</b>${x.notes?`<br><small>${esc(x.notes)}</small>`:''}</td><td>${badge(FOLLOW,x.status)}</td><td class="num">${x.status==='open'?`<button class="table-btn followDone" data-id="${esc(x.id)}">Selesai</button><button class="table-btn followCancel" data-id="${esc(x.id)}">Batal</button>`:'—'}</td></tr>`).join('');
  $('followEmpty').classList.toggle('hidden',r.length>0);
  document.querySelectorAll('.followDone').forEach(b=>b.onclick=()=>setFollowStatus(+b.dataset.id,'done'));
  document.querySelectorAll('.followCancel').forEach(b=>b.onclick=()=>setFollowStatus(+b.dataset.id,'canceled'));
}
async function setFollowStatus(id,status){
  const {error}=await db.rpc('platform_admin_set_followup_status',{p_followup_id:id,p_status:status});
  if(error)return toast(error.message,true);toast('Follow-up diperbarui');await load();
}
function fillFollowWorkspace(){$('fWorkspace').innerHTML=all.map(x=>`<option value="${esc(x.workspace_id)}">${esc(x.workspace_name)}</option>`).join('');}
function openFollow(wsId,title){$('fDate').value=todayISO();if(typeof wsId==='string'&&wsId)$('fWorkspace').value=wsId;$('fTitle').value=typeof title==='string'?title:'';$('fNotes').value='';$('fError').textContent='';openModal('followModal');}
async function saveFollow(){
  try{const {error}=await db.rpc('platform_admin_create_followup',{p_workspace_id:$('fWorkspace').value,p_due_date:$('fDate').value,p_priority:$('fPriority').value,p_title:$('fTitle').value,p_notes:$('fNotes').value});
    if(error)throw error;closeModal('followModal');toast('Follow-up dibuat');await load();
  }catch(e){$('fError').textContent=e.message;}
}

function renderPlatformSettings(){$('setTarget').value=platformSettings.monthly_revenue_target||0;$('setRenewDays').value=platformSettings.renewal_warning_days||30;}
async function savePlatformSettings(){
  const {error}=await db.rpc('platform_admin_save_settings',{p_monthly_revenue_target:+$('setTarget').value||0,p_renewal_warning_days:+$('setRenewDays').value||30});
  if(error)return toast(error.message,true);toast('Pengaturan disimpan');await load();
}

function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function fullBackup(){
  const data={exported_at:new Date().toISOString(),workspaces:all,sales,expenses,analytics,plan_performance:planPerf,renewals,crm,followups,settings:platformSettings};
  download(`kairo-platform-backup-${todayISO()}.json`,new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
}
function csv(name,rows){
  if(!rows.length)return toast('Belum ada data untuk diexport','info');
  const keys=Object.keys(rows[0]),q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const body=[keys.map(q).join(','),...rows.map(r=>keys.map(k=>q(r[k])).join(','))].join('\n');
  download(name,new Blob(['﻿'+body],{type:'text/csv;charset=utf-8'}));
}

async function saveExpense(){
  try{const {error}=await db.rpc('platform_admin_record_expense',{p_date:$('eDate').value||null,p_category:$('eCategory').value,p_description:$('eDescription').value,p_amount:+$('eAmount').value||0,p_payment_method:$('eMethod').value,p_notes:$('eNotes').value});
    if(error)throw error;closeModal('expenseModal');toast('Pengeluaran disimpan');await load();
  }catch(e){$('eError').textContent=e.message;}
}

function fillWorkspaceSelect(){$('sWorkspace').innerHTML=all.map(x=>`<option value="${esc(x.workspace_id)}" data-plan="${planKey(x.plan)}">${esc(x.workspace_name)} — ${planKey(x.plan)==='pro'?'Pro':'Gratis'}</option>`).join('');}
// The workspace list already carries everything this dialog shows (the old detail RPC does not exist in the database).
function openWorkspace(id){
  const data=all.find(x=>String(x.workspace_id)===String(id));
  if(!data)return toast('Workspace tidak ditemukan. Coba refresh.',true);
  selected=data;
  setText('mName',data.workspace_name);setText('mSlug',data.slug||'');setText('mOwner',data.owner_username||'—');
  $('mWsStatus').innerHTML=badge(WS,data.workspace_status);
  $('mPlan').value=planKey(data.plan);
  $('mSubStatus').value=SUB[data.subscription_status]?data.subscription_status:'active';
  $('mUntil').value=data.valid_until?new Date(data.valid_until).toISOString().slice(0,10):'';
  $('mError').textContent='';
  openModal('workspaceModal');
}
async function saveSubscription(){
  const date=$('mUntil').value?new Date($('mUntil').value+'T23:59:59').toISOString():null;
  const {error}=await db.rpc('platform_admin_update_subscription',{p_workspace_id:selected.workspace_id,p_plan:$('mPlan').value,p_status:$('mSubStatus').value,p_valid_until:date});
  if(error)return $('mError').textContent=error.message;
  toast('Subscription diperbarui');closeModal('workspaceModal');await load();
}
function extend(days){let d=$('mUntil').value?new Date($('mUntil').value+'T12:00:00'):new Date();if(d<new Date())d=new Date();d.setDate(d.getDate()+days);$('mUntil').value=d.toISOString().slice(0,10);}
async function setWsStatus(status){
  const label={active:'Aktif',suspended:'Suspend',archived:'Arsip'}[status]||status;
  if(['suspended','archived'].includes(status)&&!confirm(`Ubah ${selected.workspace_name} menjadi ${label}?`))return;
  const {error}=await db.rpc('platform_admin_update_workspace_status',{p_workspace_id:selected.workspace_id,p_status:status});
  if(error)return toast(error.message,true);closeModal('workspaceModal');toast('Status workspace diperbarui');await load();
}
function saleFromWorkspace(){
  const o=$('sWorkspace').selectedOptions[0];if(!o)return;
  const a=requestedPro(o.value);$('sPlan').value=a?'pro':o.dataset.plan||'basic';
  if(a){$('sPeriod').value=a.requested_period;$('sAmount').value=a.requested_period==='semiannual'?238000:43000;}
  syncSaleEnd();
}
// Hapus akun & workspace permanen (SQL 2026-10-admin-delete-workspace). Pengaman: daftar isi yang akan hilang,
// ketik username/slug/nama, tombol baru aktif 5 detik kemudian; server mengecek ulang ketikan + menolak Trine Magic/admin.
const DEL_LABEL={transactions:'transaksi',customers:'customer',cash_expenses:'pengeluaran kas',cash_injections:'pemasukan kas',payouts:'withdraw',workspace_members:'anggota workspace',reading_shifts:'sesi Open Store',package_masters:'paket/produk',addon_masters:'add-on',topic_masters:'topik',promotions:'promo',profit_share_rules:'aturan pembagian profit',profit_share_versions:'riwayat pembagian profit',workspace_branding:'pengaturan branding',workspace_subscriptions:'data langganan',platform_custom_requests:'request Custom (admin)'};
const delLabel=t=>DEL_LABEL[t]||(/sale/.test(t)?`catatan penjualan admin (${t})`:/followup/.test(t)?`follow-up admin (${t})`:t);
let delTimer=null,delWord='',delReady=false;
function delSync(){const ok=delReady&&$('delConfirm').value.trim().toLowerCase()===delWord.toLowerCase();$('doDelete').disabled=!ok;}
async function openDelete(){
  if(!selected)return;
  delWord=String(selected.owner_username||selected.slug||selected.workspace_name||'').trim();delReady=false;clearInterval(delTimer);
  setText('delName',selected.workspace_name||'—');setText('delWord',delWord);setText('delAuth','');
  $('delConfirm').value='';$('delError').textContent='';$('doDelete').disabled=true;$('doDelete').textContent='Hapus permanen';
  $('delList').innerHTML='<li>Memuat isi workspace…</li>';
  closeModal('workspaceModal');openModal('deleteModal');
  const {data,error}=await db.rpc('platform_admin_delete_preview',{p_workspace_id:selected.workspace_id});
  if(error){$('delList').innerHTML='';$('delError').textContent=/Could not find|does not exist/i.test(error.message)?'Fitur hapus aktif setelah SQL .claude/sql/2026-10-admin-delete-workspace.sql dijalankan.':error.message;return;}
  const rows=(data||[]).filter(r=>r.table_name!=='akun login owner'),auth=(data||[]).find(r=>r.table_name==='akun login owner');
  $('delList').innerHTML=rows.length?rows.map(r=>`<li><b>${Number(r.row_count).toLocaleString('id-ID')}</b> ${esc(delLabel(r.table_name))}</li>`).join(''):'<li>Workspace kosong (tidak ada data).</li>';
  setText('delAuth',auth&&+auth.row_count?`Akun login owner (${delWord||'—'}) ikut dihapus, jadi user tidak bisa login lagi dan harus daftar ulang.`:'Akun login owner tidak dihapus (masih dipakai workspace lain).');
  let n=5;$('doDelete').textContent=`Hapus permanen (${n})`;
  delTimer=setInterval(()=>{n--;if(n>0){$('doDelete').textContent=`Hapus permanen (${n})`;return;}clearInterval(delTimer);$('doDelete').textContent='Hapus permanen';delReady=true;delSync();},1000);
}
async function doDelete(){
  if($('doDelete').disabled||!selected)return;
  if(!confirm(`Terakhir kali: hapus permanen workspace "${selected.workspace_name}" beserta semua datanya?`))return;
  $('doDelete').disabled=true;$('doDelete').textContent='Menghapus…';
  const {data,error}=await db.rpc('platform_admin_delete_workspace',{p_workspace_id:selected.workspace_id,p_confirm:$('delConfirm').value.trim()});
  if(error){$('delError').textContent=error.message;$('doDelete').textContent='Hapus permanen';delSync();return;}
  closeModal('deleteModal');selected=null;
  toast(data?.note||`Workspace dihapus (${Number(data?.deleted_rows||0).toLocaleString('id-ID')} baris data${data?.auth_user_deleted?', akun login ikut dihapus':''}).`,data?.note?'warning':'success');
  await load();
}
function openSale(workspaceId){
  $('sPaid').value=todayISO();$('sStart').value=$('sPaid').value;$('sError').textContent='';
  if(typeof workspaceId==='string')$('sWorkspace').value=workspaceId;
  saleFromWorkspace();openModal('saleModal');
}
function syncSaleEnd(){
  if(!$('sStart').value)return;
  const d=new Date($('sStart').value+'T12:00:00'),p=$('sPeriod').value;
  if(p==='monthly')d.setMonth(d.getMonth()+1);if(p==='quarterly')d.setMonth(d.getMonth()+3);if(p==='semiannual')d.setMonth(d.getMonth()+6);if(p==='annual')d.setFullYear(d.getFullYear()+1);
  if(p!=='custom')$('sEnd').value=d.toISOString().slice(0,10);
}
async function saveSale(){
  try{const iso=id=>$(id).value?new Date($(id).value+'T12:00:00').toISOString():null;
    const {error}=await db.rpc('platform_admin_record_sale',{p_workspace_id:$('sWorkspace').value,p_customer_name:$('sCustomer').value,p_plan:$('sPlan').value,p_billing_period:$('sPeriod').value,p_amount:+$('sAmount').value||0,p_payment_method:$('sMethod').value,p_payment_status:$('sStatus').value,p_paid_at:iso('sPaid'),p_period_start:iso('sStart'),p_period_end:iso('sEnd'),p_notes:$('sNotes').value});
    if(error)throw error;closeModal('saleModal');toast('Penjualan berhasil dicatat');await load();
  }catch(e){$('sError').textContent=e.message;}
}

/* ── Template usaha (data tetap; perbarui di sini setiap ada template baru) ── */
const TEMPLATES=[
  {key:'digital_subscription',name:'Seller App Premium',desc:'Kelola seller aplikasi premium dan paket berlangganan.',kind:'custom',preview:'seller-app-premium',
   features:['Katalog app premium siap pakai (Netflix, Spotify, ChatGPT, Canva, dll) lengkap dengan logo','Orders pakai keranjang: produk, varian, durasi','Pantau masa aktif langganan customer (Akan Expired)','Piutang / pembayaran sebagian (Piutang Aktif)','Dashboard 5 kartu termasuk Profit','Settings › Produk: atur harga; paket Gratis maks 3 produk custom'],
   files:['assets/templates/seller-app-premium.js','assets/templates/seller-app-premium.css']},
  {key:'service_consultation',name:'Jasa Online',desc:'Joki / Tarot Reading / Wording / jasa online lainnya.',kind:'base',preview:'jasa-online',
   features:['Orders: Package + Add-on + Topik','Start Reading + status On Progress / Done','Notifikasi order On Progress ≥ 5 menit','Open / Close Store (sesi kerja)','Bagi hasil partner & Withdraw','Struk yang bisa diatur'],
   files:['assets/kairo-app.js (tampilan dasar KAIRO)'],
   note:'Tampilan dasar KAIRO (asal mula dari dashboard Trine Magic). Akun lama yang tidak tercatat templatenya juga tampil seperti ini.'},
  {key:'online_shop',name:'Online Shop',desc:'Kreasikan produkmu sendiri pada dashboard.',kind:'none',preview:'jasa-online',features:[],files:[],
   note:'Belum ada tampilan khusus. User yang memilih ini sekarang melihat tampilan Jasa Online (ada istilah Start Reading & Topik).'},
  {key:'digital_product',name:'Digital Product',desc:'Produk digital, file, akses, atau layanan digital.',kind:'none',preview:'jasa-online',features:[],files:[],
   note:'Belum ada tampilan khusus. User yang memilih ini sekarang melihat tampilan Jasa Online (ada istilah Start Reading & Topik).'}
];
const TPL_KIND={custom:['Tampilan khusus','b-ok'],base:['Tampilan dasar','b-info'],none:['Belum ada tampilan khusus','b-warn']};
function templateUsage(){
  const byWs=Object.fromEntries(all.map(w=>[w.workspace_id,w])),known=new Set(TEMPLATES.map(t=>t.key)),use={};
  TEMPLATES.forEach(t=>use[t.key]=[]);use.__none=[];
  wsActivity.forEach(a=>{const w=byWs[a.workspace_id];if(!w)return;const k=known.has(a.business_template)?a.business_template:'__none';use[k].push({w,a});});
  return use;
}
function renderTemplates(){
  const hasData=wsActivity.length>0&&wsActivity.some(a=>'business_template' in a);
  $('tplNeedSql').classList.toggle('hidden',hasData);
  const use=hasData?templateUsage():null;
  setText('tplTotal',TEMPLATES.length);setText('tplCustom',TEMPLATES.filter(t=>t.kind==='custom').length);setText('tplBase',TEMPLATES.filter(t=>t.kind==='base').length);setText('tplNone',TEMPLATES.filter(t=>t.kind==='none').length);
  setText('navTemplates',TEMPLATES.length);
  const stat=list=>list?{n:list.length,pro:list.filter(x=>planKey(x.w.plan)==='pro').length,active:list.filter(x=>Number(x.a.tx_30d)>0).length}:{n:'—',pro:'—',active:'—'};
  // catatan analisa
  const notes=[];
  if(use){
    const ranked=TEMPLATES.map(t=>[t,use[t.key].length]).sort((a,b)=>b[1]-a[1]);
    if(ranked[0][1])notes.push(['ok',`Paling banyak dipakai: <b>${esc(ranked[0][0].name)}</b> (${ranked[0][1]} workspace).`]);
    const noneUsers=TEMPLATES.filter(t=>t.kind==='none').reduce((a,t)=>a+use[t.key].length,0);
    if(noneUsers)notes.push(['warn',`<b>${noneUsers} workspace</b> memilih template yang belum punya tampilan khusus (Online Shop / Digital Product) — mereka melihat tampilan Jasa Online.`]);
    if(use.__none.length)notes.push(['warn',`${use.__none.length} workspace tidak tercatat templatenya (akun lama / dibuat manual) — tampil sebagai Jasa Online.`]);
    TEMPLATES.forEach(t=>{const l=use[t.key];if(l.length&&!l.some(x=>Number(x.a.tx_30d)>0))notes.push(['warn',`Semua workspace <b>${esc(t.name)}</b> tidak mencatat transaksi 30 hari terakhir.`]);});
  }
  notes.push(['warn',`${TEMPLATES.filter(t=>t.kind==='none').length} dari ${TEMPLATES.length} template di form daftar belum punya tampilan khusus.`]);
  $('tplNotes').innerHTML=notes.map(([k,t])=>`<li class="${k}"><svg><use href="#i-${k==='ok'?'check':'alert'}"/></svg><span>${t}</span></li>`).join('');
  $('tplGrid').innerHTML=TEMPLATES.map((t,i)=>{
    const st=stat(use&&use[t.key]),list=use?use[t.key]:[],fb=t.kind==='none';
    return `<article class="widget tpl-card">
      <button class="tpl-thumb${fb?' is-fallback':''}" data-tpl="${i}" aria-label="Perbesar preview ${esc(t.name)}"><img src="previews/${t.preview}-desktop.webp" alt="" loading="lazy"><img class="tpl-phone" src="previews/${t.preview}-mobile.webp" alt="" loading="lazy">${fb?'<span class="tpl-flag">Sementara memakai tampilan Jasa Online</span>':''}</button>
      <div class="tpl-title"><h2>${esc(t.name)}</h2><span class="badge ${TPL_KIND[t.kind][1]}">${TPL_KIND[t.kind][0]}</span></div>
      <p class="tpl-desc">${esc(t.desc)} <code>${esc(t.key)}</code></p>
      <div class="tpl-stats"><div><b>${st.n}</b><span>Workspace</span></div><div><b>${st.pro}</b><span>Paket Pro</span></div><div><b>${st.active}</b><span>Aktif 30 hari</span></div></div>
      ${t.features.length?`<ul class="tpl-feat">${t.features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}
      ${t.note?`<p class="tpl-note">${esc(t.note)}</p>`:''}
      ${t.files.length?`<div class="tpl-files">File: ${t.files.map(f=>`<code>${esc(f)}</code>`).join(', ')}</div>`:''}
      ${list.length?`<details><summary>Lihat ${list.length} workspace</summary><ul>${list.map(x=>`<li>${esc(x.w.workspace_name)} · ${planKey(x.w.plan)==='pro'?'Pro':'Gratis'}${Number(x.a.tx_30d)?` · ${x.a.tx_30d} transaksi/30 hari`:' · belum ada transaksi 30 hari'}</li>`).join('')}</ul></details>`:''}
    </article>`;}).join('');
  $('tplGrid').querySelectorAll('.tpl-thumb').forEach(b=>b.onclick=()=>{const t=TEMPLATES[+b.dataset.tpl];setText('tplModalTitle',t.name);setText('tplModalSub',t.kind==='none'?'Belum ada tampilan khusus — ini tampilan yang dilihat user sekarang (Jasa Online).':'Halaman Dashboard utama (data contoh)');$('tplShotDesk').src=`previews/${t.preview}-desktop.webp`;$('tplShotMob').src=`previews/${t.preview}-mobile.webp`;openModal('tplModal');});
}

/* ── Salin detail masalah (untuk ditempel ke chat & dianalisa) ── */
const PAGE_LABEL={dashboard:'Dashboard',performance:'Performance',input:'Orders',customers:'Customers',promo:'Promo',payout:'Withdraw',cash:'Petty Cash',settings:'Settings'};
const pageLabel=p=>p?(PAGE_LABEL[p]?`${PAGE_LABEL[p]} (${p})`:p):'—';
const fmtTime=v=>v?new Date(v).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'—';
function uaLabel(ua){
  ua=String(ua||'');if(!ua)return'';
  const dev=/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android':/Macintosh|Mac OS X/.test(ua)?'Mac':/Windows/.test(ua)?'Windows':/Linux/.test(ua)?'Linux':'Perangkat lain';
  const m=ua.match(/(Edg|SamsungBrowser|Firefox|CriOS|FxiOS|Chrome)\/(\d+)/)||(/Safari/.test(ua)&&ua.match(/Version\/(\d+)/)?['','Safari',ua.match(/Version\/(\d+)/)[1]]:null);
  const name={Edg:'Edge',CriOS:'Chrome iOS',FxiOS:'Firefox iOS'}[m?.[1]]||m?.[1]||'Browser lain';
  return `${dev} · ${name}${m?.[2]?' '+m[2]:''}`;
}
function errorReport(e){
  const loc=`${e.source||'—'}${e.line?` baris ${e.line}`:''}${e.col?` kolom ${e.col}`:''}`;
  return ['=== KAIRO · Laporan error untuk dianalisa ===',
    `Pesan     : ${e.message}`,
    `Lokasi    : ${loc}${e.source==='toast'?' (pop-up "Gagal" di aplikasi)':e.source==='promise'?' (proses async gagal)':''}`,
    `Halaman   : ${pageLabel(e.page)}`,
    `Versi app : kairo-app.js v${(e.app_versions||[]).join(', ')||'tidak tercatat'}`,
    `Kejadian  : ${e.occurrences}× oleh ${e.users} user (72 jam terakhir)`,
    `Pertama   : ${fmtTime(e.first_seen)}`,
    `Terakhir  : ${fmtTime(e.last_seen)}`,
    `Workspace : ${(e.workspace_names||[]).join(', ')||'—'}`,
    `Browser   : ${[...new Set((e.user_agents||[]).map(uaLabel).filter(Boolean))].join(' | ')||'—'}`,
    'Stack trace:',
    e.stack?String(e.stack).split('\n').map(l=>'  '+l.trim()).join('\n'):'  (tidak tercatat)'
  ].join('\n');
}
function serverReport(r){
  const h=serverHealth||{},st=serverState();
  return ['=== KAIRO · Laporan server untuk dianalisa ===',
    `Masalah   : ${r.title} — ${r.detail}`,
    `Database  : ${fmtBytes(h.db_size_bytes)} dari batas ${fmtBytes(serverLimitMB()*1048576)}${st.dbPct!=null?` (${st.dbPct.toFixed(1)}%)`:''}`,
    `Koneksi   : ${h.connections_total??'—'} total, ${h.connections_active??'—'} aktif, maks ${h.max_connections??'—'}`,
    `Respons   : ${serverLatency!=null?serverLatency+' ms':'—'} · cache hit ${h.cache_hit_pct??'—'}%`,
    `Beban 24j : ${h.active_users_24h??'—'} akun login, ${h.transactions_24h??'—'} transaksi`,
    `Tabel terbesar: ${(h.top_tables||[]).slice(0,5).map(t=>`${t.name} ${fmtBytes(t.bytes)}`).join(', ')||'—'}`,
    `Dicek     : ${fmtTime(h.checked_at)}`
  ].join('\n');
}
async function copyText(text,btn){
  let ok=false;
  try{await navigator.clipboard.writeText(text);ok=true;}catch(_e){
    const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(ta);ta.select();
    try{ok=document.execCommand('copy');}catch(_e2){}ta.remove();
  }
  if(!ok)return toast('Gagal menyalin. Coba lagi atau salin manual.',true);
  toast('Detail disalin — tempel ke chat Claude untuk dianalisa');
  if(btn){const old=btn.innerHTML;btn.innerHTML='<svg><use href="#i-check"/></svg>Tersalin';btn.classList.add('is-done');setTimeout(()=>{btn.innerHTML=old;btn.classList.remove('is-done');},1800);}
}

/* ── Perlu Perhatian: deteksi otomatis ── */
const SEV={high:['Tinggi','b-danger',0],med:['Sedang','b-warn',1],low:['Rendah','b-info',2]};
const DAY=864e5;
function computeIssues(){
  const out=[],now=Date.now(),today=todayISO(),act=Object.fromEntries(wsActivity.map(a=>[a.workspace_id,a]));
  const openFollow=new Set(followups.filter(f=>f.status==='open').map(f=>f.workspace_name));
  const customWs=new Set(customReqs.map(r=>r.workspace_id).filter(Boolean));
  const soldWs=new Set(sales.flatMap(x=>[x.workspace_id,x.workspace_name]).filter(Boolean));
  const add=(sev,title,ws,detail,since,action,copy,fp)=>out.push({sev,title,ws,detail,since,action,copy,fp});
  all.forEach(w=>{
    const ss=String(w.subscription_status||'').toLowerCase(),wst=String(w.workspace_status||'').toLowerCase(),until=w.valid_until?+new Date(w.valid_until):null,pro=planKey(w.plan)==='pro';
    const manage={label:'Kelola',run:()=>openWorkspace(w.workspace_id)};
    if(ss==='past_due')add('high','Pembayaran telat',w,'Subscription berstatus telat bayar',w.valid_until,manage);
    else if(pro&&until&&until<now&&['active','trialing'].includes(ss))add('high','Masa aktif Pro sudah habis',w,`Habis ${remain(w.valid_until)} — dashboard user sudah otomatis jadi Gratis. Perpanjang atau ubah paket ke Gratis.`,w.valid_until,manage);
    else if(pro&&until&&until>=now&&until<=now+7*DAY&&!openFollow.has(w.workspace_name))add('med','Pro hampir habis, belum di-follow-up',w,`Sisa ${remain(w.valid_until)}`,null,{label:'Follow-up',run:()=>openFollow(w.workspace_id,'Ingatkan perpanjangan Pro')},null,w.valid_until);
    // Dashboard membaca Pro yang lewat masa aktif sebagai Gratis; Pro tanpa tanggal berakhir = Pro selamanya.
    if(pro&&!until&&!/trine magic/i.test(w.workspace_name||''))add('med','Pro tanpa masa aktif',w,'Tanggal berakhir belum diisi, jadi Pro tidak pernah habis',null,{label:'Atur',run:()=>openWorkspace(w.workspace_id)});
    if(wst==='suspended')add('low','Workspace di-suspend',w,'Owner tidak bisa memakai workspace',null,manage);
    const a=act[w.workspace_id];
    if(a&&wst==='active'){
      const created=a.workspace_created_at?+new Date(a.workspace_created_at):null,last=a.last_tx_at?+new Date(a.last_tx_at):null;
      if(!last&&created&&created<now-3*DAY)add('med','Belum pernah mencatat transaksi',w,`Daftar ${Math.floor((now-created)/DAY)} hari lalu — mungkin bingung memulai`,a.workspace_created_at,{label:'Follow-up',run:()=>openFollow(w.workspace_id,'Bantu mulai catat transaksi pertama')});
      else if(last&&last<now-14*DAY)add(pro?'med':'low','Tidak ada transaksi 14+ hari',w,`Transaksi terakhir ${dateID(a.last_tx_at)}`,a.last_tx_at,{label:'Follow-up',run:()=>openFollow(w.workspace_id,'Cek kenapa berhenti mencatat')});
      const rp=requestedPro(w.workspace_id);
      if(rp&&!soldWs.has(w.workspace_id)&&!soldWs.has(w.workspace_name))add('med','Daftar Pro, pembayaran belum dicatat',w,`Pilih ${PERIOD[rp.requested_period]}${rp.owner_phone?` · WA ${rp.owner_phone}`:''}`,a.workspace_created_at,{label:'Catat',run:()=>openSale(w.workspace_id)});
      if(a.requested_variant==='custom'&&!customWs.has(w.workspace_id))add('med','Daftar paket Custom, request belum dicatat',w,a.owner_phone?`WA ${a.owner_phone}`:'Hubungi owner untuk detail kebutuhan',a.workspace_created_at,{label:'Catat',run:()=>openCustom(null,{workspace_id:w.workspace_id,customer_name:w.owner_username||'',contact:a.owner_phone||''})});
    }
  });
  sales.filter(x=>x.payment_status==='pending'&&+new Date(x.created_at||x.paid_at)<now-3*DAY).forEach(x=>add('med','Pembayaran pending lebih dari 3 hari',{workspace_name:x.workspace_name},`${money(x.amount)} · ${x.customer_name||'—'}`,x.created_at||x.paid_at,{label:'Lihat',run:()=>activatePage('sales')}));
  clientErrors.filter(e=>+new Date(e.last_seen)>now-DAY).forEach(e=>add(Number(e.occurrences)>=5||Number(e.users)>=3?'high':'med','Error aplikasi di sisi user',{workspace_name:(e.workspace_names||[]).join(', ')||'—'},`${String(e.message).slice(0,90)} · ${e.occurrences}× / ${e.users} user`,e.first_seen,{label:'Detail',run:()=>{$('errorRows').scrollIntoView({behavior:'smooth',block:'center'});}},()=>errorReport(e),e.last_seen));
  const srv=serverState();srv.reasons.forEach(r=>add(r.sev,r.title,{workspace_name:'Server KAIRO'},r.detail,null,{label:'Lihat',run:()=>activatePage('server')},()=>serverReport(r)));
  return out.sort((a,b)=>SEV[a.sev][2]-SEV[b.sev][2]||String(b.since||'').localeCompare(String(a.since||'')));
}
// Masalah yang ditandai "sudah di-fix" disimpan per browser (kairo_admin_resolved_v1). Kalau masalah yang sama
// muncul lagi dengan data baru (sidik jari = waktu/kejadian terakhir berubah), otomatis tampil lagi.
const RESOLVED_KEY='kairo_admin_resolved_v1';
let showResolved=false;
const issueKey=x=>`${x.title}|${x.ws?.workspace_name||''}`;
const issueFp=x=>String(x.fp??x.since??x.detail??'');
function readResolved(){try{return JSON.parse(localStorage.getItem(RESOLVED_KEY)||'{}')||{};}catch(_e){return {};}}
function writeResolved(m){try{localStorage.setItem(RESOLVED_KEY,JSON.stringify(m));}catch(_e){}}
function setResolved(x,done){
  const m=readResolved(),k=issueKey(x);
  if(done)m[k]={fp:issueFp(x),at:new Date().toISOString()};else delete m[k];
  writeResolved(m);renderIssues();
  toast(done?'Ditandai sudah di-fix. Akan muncul lagi kalau masalahnya terjadi lagi.':'Dikembalikan ke daftar masalah.',done?'success':'info');
}
function renderIssues(){
  const resolvedMap=readResolved(),allIssues=computeIssues();
  allIssues.forEach(x=>{const r=resolvedMap[issueKey(x)];x.resolved=!!r&&r.fp===issueFp(x);x.resolvedAt=r?.at;});
  // Bersihkan tanda lama yang masalahnya sudah tidak ada / sudah berubah.
  const live=new Set(allIssues.filter(x=>x.resolved).map(issueKey));
  if(Object.keys(resolvedMap).some(k=>!live.has(k))){Object.keys(resolvedMap).forEach(k=>{if(!live.has(k))delete resolvedMap[k];});writeResolved(resolvedMap);}
  issues=allIssues.filter(x=>!x.resolved);
  const done=allIssues.filter(x=>x.resolved);
  setText('issResolvedCount',done.length);$('issResolvedToggle').classList.toggle('hidden',!done.length);
  $('issResolvedToggle').textContent=showResolved?`Sembunyikan yang sudah di-fix (${done.length})`:`Tampilkan yang sudah di-fix (${done.length})`;
  const c=k=>issues.filter(x=>x.sev===k).length;
  setText('issHigh',c('high'));setText('issMed',c('med'));setText('issLow',c('low'));
  setText('issueCount',c('high')+c('med'));
  $('issuesNeedSql').classList.toggle('hidden',!(needSql.activity||needSql.errors));
  const rows=[...issues,...(showResolved?done:[])].filter(x=>issueFilter==='all'||x.sev===issueFilter);
  $('issueRows').innerHTML=rows.map((x,i)=>`<tr class="${x.resolved?'is-resolved':''}"><td class="chk"><label class="issue-check" title="${x.resolved?'Batalkan tanda sudah di-fix':'Tandai sudah di-fix'}"><input type="checkbox" class="issueDone" data-i="${i}" ${x.resolved?'checked':''} aria-label="Sudah di-fix: ${esc(x.title)}"><span></span></label></td><td><span class="issue-title ${x.sev}"><svg><use href="#i-alert"/></svg>${esc(x.title)}</span></td><td><span class="badge ${SEV[x.sev][1]}">${SEV[x.sev][0]}</span></td><td>${esc(x.ws?.workspace_name||'—')}</td><td>${esc(x.detail)}</td><td>${x.since?dateID(x.since):'—'}</td><td class="num">${x.copy&&x.sev==='high'?`<button class="table-btn is-copy issueCopy" data-i="${i}" title="Salin detail untuk dianalisa"><svg><use href="#i-copy"/></svg>Salin</button>`:''}${x.action?`<button class="table-btn issueAct" data-i="${i}">${esc(x.action.label)}</button>`:''}</td></tr>`).join('');
  $('issueEmpty').classList.toggle('hidden',rows.length>0);
  $('issueRows').querySelectorAll('.issueDone').forEach(c=>c.onchange=()=>setResolved(rows[+c.dataset.i],c.checked));
  $('issueRows').querySelectorAll('.issueAct').forEach(b=>b.onclick=()=>rows[+b.dataset.i].action.run());
  $('issueRows').querySelectorAll('.issueCopy').forEach(b=>b.onclick=()=>copyText(rows[+b.dataset.i].copy(),b));
  const urgent=issues.filter(x=>x.sev==='high'&&x.copy);
  $('copyUrgent').classList.toggle('hidden',!urgent.length);
  $('copyUrgent').onclick=()=>copyText(urgent.map(x=>x.copy()).join('\n\n'),$('copyUrgent'));
  $('errorRows').innerHTML=clientErrors.map((e,i)=>`<tr><td class="err-msg">${esc(e.message)}${e.source?`<br><small>${esc(e.source)}${e.line?':'+esc(e.line):''}</small>`:''}</td><td>${esc(pageLabel(e.page))}</td><td class="num"><b>${esc(e.occurrences)}</b></td><td class="num">${esc(e.users)}</td><td>${esc((e.workspace_names||[]).join(', ')||'—')}</td><td>${e.last_seen?new Date(e.last_seen).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'—'}</td><td class="num"><button class="table-btn is-copy errCopy" data-i="${i}" title="Salin detail untuk dianalisa"><svg><use href="#i-copy"/></svg>Salin</button></td></tr>`).join('');
  $('errorRows').querySelectorAll('.errCopy').forEach(b=>b.onclick=()=>copyText(errorReport(clientErrors[+b.dataset.i]),b));
  $('errorEmpty').textContent=needSql.errors?'Aktif setelah SQL admin panel v2 dijalankan.':'Belum ada error yang dilaporkan.';
  $('errorEmpty').classList.toggle('hidden',clientErrors.length>0);
  renderNavCounts();
}

/* ── Kapasitas Server ── */
let serverTimer=null;
const fmtBytes=b=>{b=Number(b||0);const u=['B','KB','MB','GB'];let i=0;while(b>=1024&&i<u.length-1){b/=1024;i++;}return (i>1?b.toFixed(1):Math.round(b))+' '+u[i];};
function serverLimitMB(){let v=500;try{v=+localStorage.getItem('kairo_admin_db_limit_mb')||500;}catch(_e){}return v;}
function serverState(){
  const h=serverHealth,reasons=[];
  if(!h)return{level:'unknown',reasons,dbPct:null,connPct:null};
  const dbPct=Number(h.db_size_bytes||0)/(serverLimitMB()*1048576)*100,connPct=h.max_connections?Number(h.connections_total||0)/h.max_connections*100:0;
  if(dbPct>=90)reasons.push({sev:'high',title:'Database hampir penuh',detail:`${dbPct.toFixed(0)}% dari batas paket terpakai`});
  else if(dbPct>=75)reasons.push({sev:'med',title:'Database mulai penuh',detail:`${dbPct.toFixed(0)}% dari batas paket terpakai`});
  if(connPct>=85)reasons.push({sev:'high',title:'Koneksi database hampir habis',detail:`${h.connections_total}/${h.max_connections} koneksi`});
  else if(connPct>=65)reasons.push({sev:'med',title:'Koneksi database ramai',detail:`${h.connections_total}/${h.max_connections} koneksi`});
  if(serverLatency>=2500)reasons.push({sev:'med',title:'Server lambat merespons',detail:`${serverLatency} ms dari browser admin`});
  if(h.cache_hit_pct!=null&&Number(h.cache_hit_pct)<95)reasons.push({sev:'low',title:'Cache database rendah',detail:`Cache hit ${h.cache_hit_pct}% (ideal ≥ 99%)`});
  const level=reasons.some(r=>r.sev==='high')?'danger':reasons.some(r=>r.sev==='med')?'warn':'ok';
  return{level,reasons,dbPct,connPct};
}
function bar(id,pct){const el=$(id);if(!el)return;el.style.width=Math.min(100,pct||0)+'%';el.className=pct>=85?'danger':pct>=65?'warn':'ok';}
function renderServer(){
  const h=serverHealth,st=serverState();
  $('serverNeedSql').classList.toggle('hidden',!needSql.server);
  const B={ok:['Aman','b-ok','Server dalam kondisi aman','Kapasitas database dan koneksi masih longgar.'],warn:['Perlu dipantau','b-warn','Ada yang perlu dipantau',''],danger:['Kritis','b-danger','Kapasitas server kritis',''],unknown:['Belum ada data','b-mute','Status server','Data kapasitas belum tersedia.']}[st.level];
  $('srvBadge').className='badge '+B[1];$('srvBadge').textContent=B[0];setText('srvHeadline',B[2]);
  setText('srvSummary',st.reasons.length?st.reasons.map(r=>r.title+' ('+r.detail+')').join(' · '):B[3]);
  const dot=$('navServer');dot.className='nav-dot'+(st.level==='unknown'?'':' '+st.level);dot.title=B[0];
  setText('srvChecked',h?.checked_at?new Date(h.checked_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'—');
  setText('srvDb',h?fmtBytes(h.db_size_bytes):'—');setText('srvDbOf',`dari ${fmtBytes(serverLimitMB()*1048576)}`);setText('srvDbPct',st.dbPct!=null?st.dbPct.toFixed(1)+'%':'—');bar('srvDbBar',st.dbPct);
  setText('dbPctMini',st.dbPct!=null?st.dbPct.toFixed(1)+'%':'—');
  setText('srvConn',h?`${h.connections_total}`:'—');setText('srvConnOf',h?`aktif ${h.connections_active} · maks ${h.max_connections}`:'—');setText('srvConnPct',st.connPct!=null?st.connPct.toFixed(0)+'%':'—');bar('srvConnBar',st.connPct);
  setText('srvLatency',serverLatency!=null?serverLatency+' ms':'—');setText('srvCache',h?.cache_hit_pct!=null?h.cache_hit_pct+'%':'—');
  setText('srvUsers',h?.auth_users??'—');setText('srvActive',h?.active_users_24h??'—');setText('srvTx',h?.transactions_24h??'—');
  setText('srvErrors',needSql.errors?'—':clientErrors.reduce((a,e)=>a+Number(e.occurrences||0),0));
  $('srvPlan').value=String(serverLimitMB());
  $('srvTables').innerHTML=(h?.top_tables||[]).map(t=>`<tr><td><b>${esc(t.name)}</b></td><td class="num">${Number(t.rows||0).toLocaleString('id-ID')}</td><td class="num">${fmtBytes(t.bytes)}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">—</td></tr>';
}
async function pollServer(){
  if(document.hidden||$('shell').classList.contains('hidden'))return;
  await loadServer();renderServer();renderIssues();
}

/* ── Request Custom ── */
const CU={pending:'Pending',on_progress:'On progress',success:'Success'};
function itemsOf(r){return Array.isArray(r.items)?r.items:[];}
function renderCustom(){
  $('customNeedSql').classList.toggle('hidden',!needSql.custom);
  const c=k=>customReqs.filter(r=>r.status===k).length;
  setText('cuTotal',customReqs.length);setText('cuPending',c('pending'));setText('cuProgress',c('on_progress'));setText('cuSuccess',c('success'));
  const have=new Set(customReqs.map(r=>r.workspace_id).filter(Boolean)),byId=Object.fromEntries(all.map(w=>[w.workspace_id,w]));
  const leads=wsActivity.filter(a=>a.requested_variant==='custom'&&!have.has(a.workspace_id)&&byId[a.workspace_id]);
  $('customLeads').classList.toggle('hidden',!leads.length);
  $('customLeadList').innerHTML=leads.map(a=>{const w=byId[a.workspace_id];return `<li><div><b>${esc(w.workspace_name)}</b><small>${esc(w.owner_username||'')}${a.owner_phone?' · WA '+esc(a.owner_phone):''} · daftar ${dateID(a.workspace_created_at)}</small></div><button class="btn btn-ghost leadAdd" data-id="${esc(w.workspace_id)}"><svg><use href="#i-plus"/></svg>Catat</button></li>`;}).join('');
  $('customLeadList').querySelectorAll('.leadAdd').forEach(b=>b.onclick=()=>{const w=byId[b.dataset.id],a=wsActivity.find(x=>x.workspace_id===b.dataset.id);openCustom(null,{workspace_id:w.workspace_id,customer_name:w.owner_username||'',contact:a?.owner_phone||''});});
  const q=$('customSearch').value.trim().toLowerCase(),today=todayISO();
  const list=customReqs.filter(r=>!q||`${r.title} ${r.workspace_name||''} ${r.customer_name||''} ${r.detail||''}`.toLowerCase().includes(q));
  const col={pending:'boardPending',on_progress:'boardProgress',success:'boardSuccess'},cnt={pending:'colPending',on_progress:'colProgress',success:'colSuccess'};
  Object.keys(col).forEach(k=>{
    const rows=list.filter(r=>r.status===k);setText(cnt[k],rows.length);
    $(col[k]).innerHTML=rows.length?rows.map(r=>{const it=itemsOf(r),done=it.filter(i=>i.status==='success').length,pct=it.length?done/it.length*100:(k==='success'?100:0),late=r.due_date&&r.due_date<today&&k!=='success';
      return `<button class="req-card" data-id="${esc(r.id)}"><b>${esc(r.title)}</b><small>${esc(r.workspace_name||r.customer_name||'Tanpa workspace')}</small><div class="progress"><i class="${k==='success'?'ok':pct?'warn':''}" style="width:${pct}%"></i></div><div class="req-meta"><span>${it.length?`${done}/${it.length} poin`:'Belum ada checklist'}</span><span class="${late?'t-danger':''}">${r.due_date?(late?'Telat · ':'Target ')+dayID(r.due_date):''}</span></div></button>`;}).join(''):'<p class="board-empty">Kosong</p>';
  });
  document.querySelectorAll('.req-card').forEach(b=>b.onclick=()=>openCustom(+b.dataset.id));
}
function fillCustomWorkspace(){$('cuWorkspace').innerHTML='<option value="">— Belum punya workspace —</option>'+all.map(x=>`<option value="${esc(x.workspace_id)}">${esc(x.workspace_name)}</option>`).join('');}
function openCustom(id,preset){
  if(needSql.custom)return toast('Menu Request Custom aktif setelah SQL admin panel v2 dijalankan.','info');
  customEditing=id?customReqs.find(r=>r.id===id)||null:null;
  const r=customEditing||Object.assign({workspace_id:'',customer_name:'',contact:'',title:'',detail:'',price:'',start_date:todayISO(),due_date:''},preset||{});
  fillCustomWorkspace();
  $('cuWorkspace').value=r.workspace_id||'';$('cuCustomer').value=r.customer_name||'';$('cuContact').value=r.contact||'';$('cuPrice').value=r.price||'';
  $('cuName').value=r.title||'';$('cuDetail').value=r.detail||'';$('cuStart').value=r.start_date||'';$('cuDue').value=r.due_date||'';
  setText('cuTitle',customEditing?customEditing.title:'Request Custom Baru');$('cuError').textContent='';
  renderChecklist();openModal('customModal');
}
function renderChecklist(){
  const r=customEditing;
  $('cuChecklist').classList.toggle('hidden',!r);$('cuSaveFirst').classList.toggle('hidden',!!r);$('deleteCustom').classList.toggle('hidden',!r);
  setText('cuSub',r?`Status: ${CU[r.status]||r.status}${r.workspace_name?' · '+r.workspace_name:''}`:'Catat permintaan customer paket Pro custom.');
  if(!r)return;
  const it=itemsOf(r),done=it.filter(i=>i.status==='success').length;
  setText('cuProgressText',it.length?`${done} dari ${it.length} selesai`:'Belum ada poin');
  bar('cuProgressBar',it.length?done/it.length*100:0);$('cuProgressBar').className=done&&done===it.length?'ok':'';
  $('cuItems').innerHTML=it.map(i=>`<li class="is-${esc(i.status)}"><span>${esc(i.label)}</span><div class="seg" role="group" aria-label="Status ${esc(i.label)}">${Object.keys(CU).map(k=>`<button type="button" data-item="${esc(i.id)}" data-s="${k}" class="${i.status===k?'on':''}" aria-pressed="${i.status===k}">${CU[k]}</button>`).join('')}</div><button type="button" class="icon-x" data-del="${esc(i.id)}" aria-label="Hapus poin ${esc(i.label)}"><svg><use href="#i-x"/></svg></button></li>`).join('');
  $('cuItems').querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>customRpc('platform_admin_save_custom_item',{p_id:+b.dataset.item,p_request_id:null,p_label:null,p_status:b.dataset.s,p_note:null}));
  $('cuItems').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>customRpc('platform_admin_delete_custom_item',{p_id:+b.dataset.del}));
}
async function reloadCustom(){
  const r=await db.rpc('platform_admin_custom_requests');
  if(r.error)return toast(r.error.message,true);
  customReqs=r.data||[];
  if(customEditing)customEditing=customReqs.find(x=>x.id===customEditing.id)||null;
  renderCustom();renderChecklist();renderIssues();
}
async function customRpc(fn,args,msg){
  const {data,error}=await db.rpc(fn,args);
  if(error){$('cuError').textContent=error.message;return null;}
  $('cuError').textContent='';await reloadCustom();if(msg)toast(msg);return data??true;
}
async function saveCustom(){
  const isNew=!customEditing;
  const id=await customRpc('platform_admin_save_custom_request',{p_id:customEditing?.id??null,p_workspace_id:$('cuWorkspace').value||null,p_customer_name:$('cuCustomer').value,p_contact:$('cuContact').value,p_title:$('cuName').value,p_detail:$('cuDetail').value,p_price:+$('cuPrice').value||0,p_status:customEditing?.status||'pending',p_start_date:$('cuStart').value||null,p_due_date:$('cuDue').value||null},'Request disimpan');
  if(id&&isNew){customEditing=customReqs.find(r=>r.id===id)||null;setText('cuTitle',customEditing?.title||'Request Custom');renderChecklist();$('cuNewItem').focus();}
}

/* Label kolom untuk tampilan kartu di HP */
function labelCells(tbody){const t=tbody.closest('table'),heads=t?[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim()):[];tbody.querySelectorAll('tr').forEach(tr=>[...tr.children].forEach((td,i)=>{if(!td.hasAttribute('colspan'))td.setAttribute('data-label',heads[i]||'');}));}
document.querySelectorAll('.table-wrap tbody').forEach(tb=>new MutationObserver(()=>labelCells(tb)).observe(tb,{childList:true}));

/* Shell */
let lastFocus=null;
function openModal(id){lastFocus=document.activeElement;$(id).classList.remove('hidden');const f=$(id).querySelector('input:not([disabled]),select,textarea,button.btn');if(f)setTimeout(()=>f.focus(),20);}
function closeModal(id){$(id).classList.add('hidden');if(lastFocus&&lastFocus.focus)lastFocus.focus();}
function setNav(open){$('shell').classList.toggle('nav-open',open);$('scrim').hidden=!open;}
function activatePage(page){
  if(!PAGES[page])return;
  document.querySelectorAll('.nav-item[data-page]').forEach(x=>{const on=x.dataset.page===page;x.classList.toggle('active',on);if(on)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');});
  document.querySelectorAll('.page').forEach(x=>x.hidden=x.dataset.page!==page);
  setText('pageTitle',PAGES[page][0]);setText('pageSub',PAGES[page][1]);
  document.title=PAGES[page][0]+' · KAIRO Admin';
  if(history.replaceState)history.replaceState(null,'','#'+page);
  setNav(false);window.scrollTo(0,0);
  if(page==='overview'&&revenueChart)revenueChart.resize();
}
function stampRefresh(){setText('lastRefresh',new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}));}

document.querySelectorAll('.nav-item[data-page]').forEach(b=>b.onclick=()=>activatePage(b.dataset.page));
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>activatePage(b.dataset.go));
$('menuBtn').onclick=()=>setNav(!$('shell').classList.contains('nav-open'));
$('scrim').onclick=()=>setNav(false);
$('search').oninput=()=>{$('topSearch').value=$('search').value;renderWorkspaces();};
$('topSearch').oninput=()=>{$('search').value=$('topSearch').value;if(activeFilter!=='all')document.querySelector('.filter[data-filter="all"]').click();activatePage('workspaces');renderWorkspaces();$('topSearch').focus();};
document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));activeFilter=b.dataset.filter;renderWorkspaces();});
$('refresh').onclick=async()=>{const b=$('refresh');b.classList.add('spin');try{await load();stampRefresh();toast('Data diperbarui');}catch(e){toast(e.message,true);}finally{b.classList.remove('spin');}};
$('logout').onclick=()=>{window.close();setTimeout(()=>{location.href='../';},150);};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('mousedown',e=>{if(e.target===m)closeModal(m.id);}));
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const open=[...document.querySelectorAll('.modal-backdrop:not(.hidden)')].pop();if(open)closeModal(open.id);else setNav(false);});
$('saveSub').onclick=saveSubscription;$('add30').onclick=()=>extend(30);$('add365').onclick=()=>extend(365);
document.querySelectorAll('.wsStatus').forEach(b=>b.onclick=()=>setWsStatus(b.dataset.status));
$('openDelete').onclick=openDelete;$('doDelete').onclick=doDelete;$('delConfirm').oninput=delSync;
$('newSale').onclick=openSale;$('sPeriod').onchange=syncSaleEnd;$('sStart').onchange=syncSaleEnd;
$('sWorkspace').onchange=saleFromWorkspace;
$('saveSale').onclick=saveSale;
$('newExpense').onclick=()=>{$('eDate').value=todayISO();$('eError').textContent='';openModal('expenseModal');};
$('saveExpense').onclick=saveExpense;
$('exportSales').onclick=$('exportSales2').onclick=()=>csv('kairo-sales.csv',sales);
$('exportWorkspaces').onclick=$('exportWorkspaces2').onclick=()=>csv('kairo-workspaces.csv',all);
$('exportRenewals').onclick=()=>csv('kairo-renewals.csv',renewals);
$('crmSearch').oninput=renderCrm;$('followFilter').onchange=renderFollowups;
$('newFollow').onclick=()=>openFollow();$('saveFollow').onclick=saveFollow;
$('saveCrm').onclick=()=>saveCrm(false);$('markContacted').onclick=()=>saveCrm(true);
$('saveSettings').onclick=savePlatformSettings;
$('issResolvedToggle').onclick=()=>{showResolved=!showResolved;renderIssues();};
document.querySelectorAll('.issFilter').forEach(b=>b.onclick=()=>{document.querySelectorAll('.issFilter').forEach(x=>x.classList.toggle('active',x===b));issueFilter=b.dataset.sev;renderIssues();});
$('customSearch').oninput=renderCustom;$('newCustom').onclick=()=>openCustom(null);$('saveCustom').onclick=saveCustom;
$('deleteCustom').onclick=async()=>{if(!customEditing||!confirm(`Hapus request "${customEditing.title}" beserta checklist-nya?`))return;const ok=await customRpc('platform_admin_delete_custom_request',{p_id:customEditing.id},'Request dihapus');if(ok!==null){customEditing=null;closeModal('customModal');}};
$('cuAddItem').onsubmit=async e=>{e.preventDefault();const v=$('cuNewItem').value.trim();if(!v||!customEditing)return;const id=await customRpc('platform_admin_save_custom_item',{p_id:null,p_request_id:customEditing.id,p_label:v,p_status:'pending',p_note:null});if(id){$('cuNewItem').value='';$('cuNewItem').focus();}};
$('srvPlan').onchange=()=>{try{localStorage.setItem('kairo_admin_db_limit_mb',$('srvPlan').value);}catch(_e){}renderServer();renderIssues();};
serverTimer=setInterval(()=>{if(!$('shell').classList.contains('hidden')&&!document.querySelector('.page[data-page="server"]').hidden)pollServer();},60e3);
boot();$('fullBackup').onclick=fullBackup;
})();
