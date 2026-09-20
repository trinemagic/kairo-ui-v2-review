
/* =========================
   SUPABASE CONFIG
   ========================= */
const SUPABASE_URL = "https://sbjmvsiwngmfxfktxbgr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cylO3B4mLWoohXAWlI0R1A_uanf1qYM";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth:{
    persistSession:false,
    autoRefreshToken:true,
    detectSessionInUrl:true
  }
});

/* =========================
   SAAS WORKSPACE + ROLE/PLAN RUNTIME — V20.3.4
   Visual UI is intentionally unchanged.
   ========================= */
let activeWorkspaceId = null;
let activeWorkspaceName = "Trine Magic";
let activeWorkspaceRole = null;
let activeAuthUserId = null;
let activeWorkspacePlan = "basic";
let activeWorkspaceBranding = null;
let activeWorkspaceSubscription = null;
let activeWorkspaceMemberships = [];
let activePlatformAdmin = false;

async function loadPlatformAccess(){
  activePlatformAdmin=false;
  if(!activeAuthUserId) return false;
  try{
    const {data,error}=await db.rpc("is_platform_admin");
    if(error) throw error;
    activePlatformAdmin=Boolean(data);
  }catch(err){
    console.warn("Platform access check:",err?.message||err);
  }
  document.documentElement.dataset.platformAdmin=activePlatformAdmin?"true":"false";
  return activePlatformAdmin;
}

function isTrineMagicWorkspace(){
  return String(activeWorkspaceId||"")==="e43c8ee6-f4a7-4e10-8d00-dc34fdaf1dc2" || String(activeWorkspaceName||"").trim().toLowerCase()==="trine magic";
}
function ensureKairoAppSwitcher(){
  let el=document.getElementById("kairo-app-switcher");
  const allowed=Boolean(activePlatformAdmin && isTrineMagicWorkspace());
  if(!allowed){ if(el) el.remove(); return; }
  if(!el){
    el=document.createElement("a");
    el.id="kairo-app-switcher";
    el.href="admin/";
    el.title="Buka KAIRO Super Admin";
    el.setAttribute("aria-label","Buka KAIRO Super Admin");
    el.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5.2c0 4.7 3.1 8.9 7.5 9.8 4.4-.9 7.5-5.1 7.5-9.8V6L12 3Z"/><path d="M9 12.2 11 14l4-4"/></svg><span>KAIRO Admin</span>`;
  }
  const meta=document.querySelector('.saas-side-meta');
  if(meta && el.parentElement!==meta) meta.prepend(el);
  else if(!meta && !el.isConnected) document.body.appendChild(el);
}

function normalizedWorkspaceRole(){ return String(activeWorkspaceRole||"").toLowerCase(); }
function isWorkspaceOwner(){ return normalizedWorkspaceRole()==="owner"; }
function isWorkspaceAdmin(){ return ["owner","admin"].includes(normalizedWorkspaceRole()); }
function isWorkspaceStaff(){ return ["owner","admin","staff"].includes(normalizedWorkspaceRole()); }
function requireWorkspaceRole(allowedRoles, actionLabel="melakukan aksi ini"){
  const role=normalizedWorkspaceRole();
  if(!allowedRoles.includes(role)) throw new Error(`Role ${role||"unknown"} tidak diizinkan untuk ${actionLabel}.`);
  return true;
}
let activePlanEntitlements = new Map();
const PLAN_RANK={basic:1,plus:2,pro:3};
const FEATURE_MIN_PLAN={
  customer_database:'plus',open_close_store:'plus',export_excel:'plus',autofill_orders:'plus',
  custom_branding:'plus',receipt_customization:'plus',multi_partner_profit_share:'plus',performance:'basic',
  advanced_analytics:'pro',advanced_profit_sharing:'pro',business_insights:'pro',advanced_customer_analytics:'pro',
  advanced_reports:'pro',activity_log:'pro',granular_permissions:'pro',full_workspace_backup:'pro',multi_workspace:'pro',remove_saas_branding:'pro'
};
function normalizedPlan(){const p=String(activeWorkspacePlan||'basic').toLowerCase();return p==='free'?'basic':(PLAN_RANK[p]?p:'basic');}
function planAtLeast(minPlan){return (PLAN_RANK[normalizedPlan()]||1)>=(PLAN_RANK[minPlan]||1);}
function featureAccessLevel(feature){
  const row=activePlanEntitlements.get(String(feature));
  if(row)return row.enabled===false?'none':String(row.access_level||'full');
  if(feature==='performance'&&normalizedPlan()==='plus')return 'basic';
  return planAtLeast(FEATURE_MIN_PLAN[feature]||'basic')?'full':'none';
}
function canUseFeature(feature,minLevel='basic'){const level=featureAccessLevel(feature);return minLevel==='full'?level==='full':level!=='none';}
async function loadPlanEntitlements(){
  activePlanEntitlements=new Map();
  try{const {data,error}=await db.from('saas_plan_entitlements').select('feature_key,access_level,enabled').eq('plan',normalizedPlan());if(error)throw error;(data||[]).forEach(r=>activePlanEntitlements.set(String(r.feature_key),r));}
  catch(err){console.warn('Plan entitlements fallback aktif:',err?.message||err);}
  return activePlanEntitlements;
}

async function loadWorkspaceSaasContext(){
  const wid=requireWorkspaceId();
  const [{data:branding,error:brandingError},{data:subscription,error:subscriptionError}] = await Promise.all([
    db.from("workspace_branding").select("*").eq("workspace_id",wid).maybeSingle(),
    db.from("workspace_subscriptions").select("*").eq("workspace_id",wid).maybeSingle()
  ]);
  if(brandingError) console.warn("Workspace branding:",brandingError.message);
  if(subscriptionError) console.warn("Workspace subscription:",subscriptionError.message);
  activeWorkspaceBranding=branding||null;
  activeWorkspaceSubscription=subscription||null;
  activeWorkspacePlan=String(subscription?.plan||subscription?.plan_code||"basic").toLowerCase();
  if(activeWorkspacePlan==='free')activeWorkspacePlan='basic';
  document.documentElement.dataset.workspacePlan=activeWorkspacePlan;
  await loadPlanEntitlements();
  console.info("Trine SaaS context",{workspaceId:wid,role:activeWorkspaceRole,plan:activeWorkspacePlan});
  return {branding:activeWorkspaceBranding,subscription,plan:activeWorkspacePlan};
}

async function loadActiveWorkspaceForUser(user){
  if(!user?.id) throw new Error("Sesi pengguna tidak valid.");
  activeAuthUserId=user.id;

  const {data,error}=await db
    .from("workspace_members")
    .select("workspace_id,role,status,workspaces!inner(id,name,slug,status)")
    .eq("user_id",user.id)
    .eq("status","active");

  if(error) throw error;
  const memberships=(data||[]).filter(x=>x.workspaces?.status==="active");
  activeWorkspaceMemberships=memberships;
  if(!memberships.length){
    activeWorkspaceId=null;
    activeWorkspaceRole=null;
    throw new Error("Akun ini belum memiliki akses ke workspace aktif.");
  }

  const savedWorkspaceId=localStorage.getItem("trine_active_workspace_id_v1");
  const membership=memberships.find(x=>x.workspace_id===savedWorkspaceId) || memberships.find(x=>x.workspaces?.slug==="trine-magic") || memberships[0];
  activeWorkspaceId=membership.workspace_id;
  activeWorkspaceRole=membership.role;
  activeWorkspaceName=membership.workspaces?.name || "Trine Magic";
  document.documentElement.dataset.workspaceRole=normalizedWorkspaceRole();
  return membership;
}

function requireWorkspaceId(){
  if(!activeWorkspaceId) throw new Error("Workspace belum siap. Silakan login ulang.");
  return activeWorkspaceId;
}

function workspaceInsert(row){
  return {
    ...row,
    workspace_id: requireWorkspaceId(),
    ...(activeAuthUserId ? {created_by:activeAuthUserId} : {})
  };
}
let dashboardInitialized = false;
let authBusy = false;
let refreshInFlight = null;
let logoutBusy = false;
let realtimeChannel = null;
let realtimeRefreshTimer = null;
let maskedNominals = localStorage.getItem("trine_magic_masked_nominals") === "1";
const lastKpiValues = {"kpi-revenue":0,"kpi-cash":0,"kpi-rights":0};

function showAuthError(message){
  const el=document.getElementById("auth-error");
  el.textContent=message;
  el.style.display="block";
}

function clearAuthError(){
  const el=document.getElementById("auth-error");
  el.textContent="";
  el.style.display="none";
}

function setAuthLoading(loading){
  authBusy=loading;
  const btn=document.getElementById("login-button");
  if(btn){
    btn.disabled=loading;
    btn.textContent=loading ? "Memproses..." : "Masuk";
  }
}

async function loginWithUsername(username,password){
  clearAuthError();
  setAuthLoading(true);
  const cleanUsername=username.trim().toLowerCase();
  let email=cleanUsername;
  // v20.10.74: login accepts either username or the account email directly.
  // This also keeps login usable if username mapping/provisioning needs repair.
  if(!cleanUsername.includes("@")){
    const {data,error:lookupError}=await db.rpc("get_login_email",{p_username:cleanUsername});
    if(lookupError){
      setAuthLoading(false);
      showAuthError("Username belum terdaftar atau sistem login belum disiapkan.");
      return;
    }
    email=typeof data === "string" ? data : data?.email;
    if(!email){
      setAuthLoading(false);
      showAuthError("Username atau password salah.");
      return;
    }
  }
  const {error}=await db.auth.signInWithPassword({email,password});
  setAuthLoading(false);
  if(error){
    const msg=String(error?.message||"").toLowerCase();
    if(msg.includes("email not confirmed") || msg.includes("email_not_confirmed")){
      showAuthError("Email akun belum diverifikasi. Cek inbox/spam email pendaftaran dulu, lalu coba masuk lagi.");
    }else if(msg.includes("invalid login credentials")){
      showAuthError("Username atau password salah.");
    }else if(msg.includes("too many requests") || msg.includes("rate limit")){
      showAuthError("Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.");
    }else{
      console.error("Login auth error:",error);
      showAuthError("Login gagal: "+(error?.message||"terjadi masalah pada autentikasi."));
    }
  }
}

function showLogoutConfirmation(){
  if(logoutBusy) return;
  const modal=document.getElementById("logout-modal");
  if(!modal) return;
  modal.style.display="block";
  const confirm=document.getElementById("logout-confirm-button");
  const cancel=document.getElementById("logout-cancel-button");
  if(confirm){confirm.disabled=false;confirm.textContent="Yoi nih";}
  if(cancel){cancel.disabled=false;}
}

function openLogoutConfirmation(){
  if(logoutBusy) return;
  const modal=document.getElementById("logout-modal");
  if(!modal) return;
  modal.style.display="flex";
  const confirm=document.getElementById("logout-confirm-button");
  const cancel=document.getElementById("logout-cancel-button");
  if(confirm){confirm.disabled=false;confirm.textContent="Yoi nih";}
  if(cancel){cancel.disabled=false;}
}

function closeLogoutConfirmation(){
  if(logoutBusy) return;
  const modal=document.getElementById("logout-modal");
  if(modal) modal.style.display="none";
}

async function confirmLogout(){
  if(logoutBusy) return;
  logoutBusy=true;
  const confirm=document.getElementById("logout-confirm-button");
  const cancel=document.getElementById("logout-cancel-button");
  if(confirm){confirm.disabled=true;confirm.textContent="Keluar...";}
  if(cancel) cancel.disabled=true;

  // Give immediate visual feedback so a slow network never looks like a dead button.
  const modal=document.getElementById("logout-modal");
  if(modal) modal.style.display="none";
  const overlay=document.getElementById("logout-busy-overlay");
  if(overlay){overlay.classList.add("show");overlay.setAttribute("aria-hidden","false");}

  try{
    const {error}=await db.auth.signOut();
    if(error) throw error;

    const usernameInput=document.getElementById("login-username");
    const passwordInput=document.getElementById("login-password");
    if(usernameInput) usernameInput.value="";
    if(passwordInput) passwordInput.value="";
    clearAuthError();
    if(document.activeElement) document.activeElement.blur();
  }catch(error){
    console.error(error);
    if(overlay){overlay.classList.remove("show");overlay.setAttribute("aria-hidden","true");}
    showToast(error.message || "Gagal keluar dari akun.",true);
  }finally{
    logoutBusy=false;
    if(overlay){overlay.classList.remove("show");overlay.setAttribute("aria-hidden","true");}
  }
}

async function handleAuthSession(session){
  if(!session){ stopRealtimeSync(); }
  if(session?.user){
    try{
      await loadActiveWorkspaceForUser(session.user);
      await loadWorkspaceSaasContext();
      await loadPlatformAccess();
      ensureKairoAppSwitcher();
      setTimeout(hydrateSaasUi,0);
    }catch(workspaceError){
      console.error("Workspace access:",workspaceError);
      stopRealtimeSync();
      dashboardInitialized=false;
      document.body.classList.remove("authenticated");
      document.body.classList.add("auth-locked");
      showAuthError(workspaceError.message || "Akun tidak memiliki akses workspace.");
      await db.auth.signOut();
      return;
    }
    document.body.classList.remove("auth-locked");
    document.body.classList.add("authenticated");
    document.getElementById("user-email").textContent=session.user.user_metadata?.username || session.user.email || "";
    document.getElementById("connection-status").textContent="Terhubung";
  { const ls=document.getElementById("landing-connection-status"); if(ls) ls.textContent="Terhubung"; }
    if(!dashboardInitialized){
      dashboardInitialized=true;
  startRealtimeSync();
      const shell=document.getElementById("app-shell");
      shell.classList.remove("dashboard-enter");
      void shell.offsetWidth;
      shell.classList.add("dashboard-enter");
      await init();
    }
  }else{
    dashboardInitialized=false;
    activeWorkspaceId=null;
    activeWorkspaceRole=null;
    activeAuthUserId=null;
    activePlatformAdmin=false;
    document.getElementById("kairo-app-switcher")?.remove();
    document.body.classList.remove("authenticated");
    document.body.classList.add("auth-locked");
    document.getElementById("user-email").textContent="";
    document.getElementById("connection-status").textContent="Belum masuk";
  { const ls=document.getElementById("landing-connection-status"); if(ls) ls.textContent="Belum masuk"; }

    const usernameInput=document.getElementById("login-username");
    const passwordInput=document.getElementById("login-password");
    if(usernameInput) usernameInput.value="";
    if(passwordInput) passwordInput.value="";
    clearAuthError();
  }
}

/* =========================
   STATE
   ========================= */
let packages = [];
let addons = [];
let topics = [];
let partners = [];
let profitShareVersions = [];
let profitShareVersionTableReady = true;
let transactions = [];
let historyTransactions = [];
let historyDateFilter = "all";
let historyCustomDate = "";
let shifts = [];
let shiftTransactions = [];
let currentShift = null;
let shiftClockTimer = null;
const SHIFT_HISTORY_COLLAPSE_KEY = "trine_shift_history_collapsed_v1";
let shiftHistoryCollapsed = localStorage.getItem(SHIFT_HISTORY_COLLAPSE_KEY)==="1";
let payouts = [];
let cashExpenses = [];
let cashInjections = [];
let financialSnapshot = { revenue: 0, payoutTotal: 0, cashEarned: 0, cashInjected: 0, cashSpent: 0, cashBalance: 0, payoutByPartner: {} };
let dailyChart, packageChart, monthlyRevenueChart, topicChart, platformChart;
let platformAnalyticsRows=[];
let platformAnalyticsPeriod="30";
let monthlyRevenueComparison = {
  currentTotal:0,
  previousTotal:0,
  currentLabel:"",
  previousLabel:""
};

const rupiah = n => "Rp" + Number(n || 0).toLocaleString("id-ID");

/* V16.5 — Tip + pricelist baru\n   Struktur pembagian tetap: Nesa 60%, Ganesh 35%, Kas 5%.\n\n   V16.4 — Struktur pembagian terbaru
   Nesa 60%, Ganesh 35%, Kas 5% dari omzet bruto.
   Persentase partner tetap dibaca dari profit_share_rules agar database menjadi source of truth.
*/
const LEGACY_CASH_SHARE_RATE = 0.05;
const partnerEntitlement = (grossRevenue, partnerPct) => Number(grossRevenue || 0) * Number(partnerPct || 0);
function normalizeShareRules(rules){ return Array.isArray(rules)?rules:[]; }
function kairoLocalDateTimeValue(date=new Date()){
  const pad=n=>String(n).padStart(2,"0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function kairoShareTime(value,endOfDayForDateOnly=false){
  const raw=String(value||"").trim();
  if(!raw) return Date.now();
  const normalized=/^\d{4}-\d{2}-\d{2}$/.test(raw)?`${raw}T${endOfDayForDateOnly?'23:59:59':'00:00:00'}`:raw;
  const ms=Date.parse(normalized);
  return Number.isFinite(ms)?ms:0;
}
function activeShareVersionForDate(date){
  const target=kairoShareTime(date||kairoLocalDateTimeValue(),true);
  return profitShareVersions.filter(v=>kairoShareTime(v.effective_from)<=target).sort((a,b)=>kairoShareTime(b.effective_from)-kairoShareTime(a.effective_from))[0]||null;
}
function shareRuleFor(partner,date){
  const v=activeShareVersionForDate(date);
  if(v){
    const rules=normalizeShareRules(v.rules);
    const byId=rules.find(r=>r.partner_id&&String(r.partner_id)===String(partner?.id));
    const byName=rules.find(r=>String(r.partner_name||'').toLowerCase()===String(partner?.partner_name||partner||'').toLowerCase());
    if(byId||byName) return Number((byId||byName).percentage||0);
  }
  return Number(partner?.percentage||0);
}
function cashShareRateForDate(date){
  const v=activeShareVersionForDate(date);
  if(v){ const r=normalizeShareRules(v.rules).find(x=>String(x.partner_name||'').toLowerCase()==='kas'); if(r) return Number(r.percentage||0); }
  const kas=partners.find(p=>String(p.partner_name||'').toLowerCase()==='kas');
  return Number(kas?.percentage||LEGACY_CASH_SHARE_RATE);
}
function transactionProfitBreakdown(t){
  const items=[...(Array.isArray(t?.order_items)?t.order_items:[]),...(Array.isArray(t?.order_addons)?t.order_addons:[])];
  const hpp=items.reduce((sum,x)=>{const qty=Math.max(0,Number(x?.qty||0));const snap=Number(x?.cost_subtotal);return sum+(Number.isFinite(snap)?Math.max(0,snap):Math.max(0,Number(x?.cost_price||0))*qty);},0);
  const distributable=Math.max(0,Number(t?.total_price||0)-hpp),manual=[];
  items.filter(x=>String(x?.profit_share_mode||'percentage')==='manual').forEach(x=>{const qty=Math.max(0,Number(x?.qty||0));(Array.isArray(x?.manual_profit_split)?x.manual_profit_split:[]).forEach(r=>{const amount=Math.max(0,Number(r?.amount||0))*qty;if(amount>0)manual.push({partner_id:r?.partner_id||null,partner_name:r?.partner_name||'',amount});});});
  const rawManual=manual.reduce((sum,r)=>sum+r.amount,0),scale=rawManual>distributable&&rawManual>0?distributable/rawManual:1,manualScaled=manual.map(r=>({...r,amount:r.amount*scale})),manualTotal=manualScaled.reduce((sum,r)=>sum+r.amount,0);
  return {hpp,distributable,manual:manualScaled,manualTotal,percentageBase:Math.max(0,distributable-manualTotal)};
}
function manualAllocationForPartner(breakdown,partner){const pid=partner?.id?String(partner.id):'',pname=String(partner?.partner_name||partner||'').toLowerCase();return (breakdown?.manual||[]).reduce((sum,r)=>sum+(((pid&&r.partner_id&&String(r.partner_id)===pid)||String(r.partner_name||'').toLowerCase()===pname)?Number(r.amount||0):0),0);}
function entitlementFromTransactions(txRows,partner,throughDate=null){return (txRows||[]).filter(t=>!throughDate||String(t.transaction_date||'')<=String(throughDate)).reduce((sum,t)=>{const b=transactionProfitBreakdown(t);return sum+manualAllocationForPartner(b,partner)+b.percentageBase*shareRuleFor(partner,t.created_at||t.transaction_date);},0);}
function cashEntitlementFromTransactions(txRows,throughDate=null){const kasPartner=partners.find(p=>String(p.partner_name||'').toLowerCase()==='kas')||{partner_name:'Kas'};return (txRows||[]).filter(t=>!throughDate||String(t.transaction_date||'')<=String(throughDate)).reduce((sum,t)=>{const b=transactionProfitBreakdown(t);return sum+manualAllocationForPartner(b,kasPartner)+b.percentageBase*cashShareRateForDate(t.created_at||t.transaction_date);},0);}

function localISODate(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
const todayISO = () => localISODate();

function dateOffsetISO(days){
  const d=new Date();
  d.setDate(d.getDate()+days);
  return localISODate(d);
}

let activePeriod="today";

function getPeriodRange(period){
  const today=todayISO();

  if(period==="today") return {from:today,to:today};
  if(period==="7days") return {from:dateOffsetISO(-6),to:today};
  if(period==="30days") return {from:dateOffsetISO(-29),to:today};

  return {
    from:document.getElementById("filter-from").value,
    to:document.getElementById("filter-to").value
  };
}

function setActivePeriodButton(period){
  document.querySelectorAll(".period-btn").forEach(btn=>{
    btn.classList.toggle("active",btn.dataset.period===period);
  });
  document.getElementById("custom-range").classList.toggle("show",period==="custom");
}

function setPeriod(period,refresh=true){
  activePeriod=period;
  setActivePeriodButton(period);

  if(period!=="custom"){
    const range=getPeriodRange(period);
    document.getElementById("filter-from").value=range.from;
    document.getElementById("filter-to").value=range.to;
  }

  if(refresh) refreshAll();
}

function showToast(message, error=false){
  const el=document.getElementById("toast");
  el.textContent=message;
  el.style.background=error ? "var(--danger)" : "var(--green)";
  el.style.display="block";
  setTimeout(()=>el.style.display="none",2800);
}

function setDefaultDates(){
  document.getElementById("tx-date").value=todayISO();
  document.getElementById("payout-date").value=todayISO();
  document.getElementById("cash-expense-date").value=todayISO();
  document.getElementById("cash-injection-date").value=todayISO();
  setPeriod("today",false);
}


async function switchActiveWorkspace(workspaceId){
  const membership=activeWorkspaceMemberships.find(x=>x.workspace_id===workspaceId);
  if(!membership || workspaceId===activeWorkspaceId) return;
  stopRealtimeSync();
  activeWorkspaceId=membership.workspace_id; activeWorkspaceRole=membership.role; activeWorkspaceName=membership.workspaces?.name||"Workspace";
  localStorage.setItem("trine_active_workspace_id_v1",activeWorkspaceId);
  document.documentElement.dataset.workspaceRole=normalizedWorkspaceRole();
  await loadWorkspaceSaasContext();
  dashboardInitialized=false;
  await initializeDashboard();
  hydrateSaasUi();
  openAppPage("dashboard");
  showToast(`Workspace diganti ke ${activeWorkspaceName}`);
}
function renderWorkspaceSwitcher(){
  const el=document.getElementById("saas-workspace-switcher"); if(!el) return;
  el.innerHTML=activeWorkspaceMemberships.map(m=>`<option value="${escapeHtml(m.workspace_id)}" ${m.workspace_id===activeWorkspaceId?'selected':''}>${escapeHtml(m.workspaces?.name||'Workspace')}</option>`).join('');
  el.style.display=activeWorkspaceMemberships.length>1?'block':'none';
}
function hydrateSaasUi(){
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('saas-workspace-pill',activeWorkspaceName||'Workspace'); set('saas-plan-pill',String(activeWorkspacePlan||'basic').toUpperCase()); set('saas-role-pill',String(activeWorkspaceRole||'-').toUpperCase());
  set('settings-meta-name',activeWorkspaceName||'-'); set('settings-meta-role',String(activeWorkspaceRole||'-').toUpperCase()); set('settings-meta-plan',String(activeWorkspacePlan||'basic').toUpperCase()); set('settings-meta-status',String(activeWorkspaceSubscription?.status||'active').toUpperCase());
  const b=activeWorkspaceBranding||{}; const name=document.getElementById('settings-workspace-name'); if(name)name.value=activeWorkspaceName||'';
  const logo=document.getElementById('settings-logo-url'); if(logo)logo.value=b.logo_url||'';
  const pc=b.primary_color||'#696F41', ac=b.accent_color||'#EA97A9';
  ['settings-primary-color','settings-primary-text'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=pc}); ['settings-accent-color','settings-accent-text'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=ac});
  const rf=document.getElementById('settings-receipt-footer');if(rf)rf.value=b.receipt_footer||''; const slogan=document.getElementById('settings-dashboard-slogan');if(slogan)slogan.value=dashboardSlogan(); const validity=document.getElementById('settings-meta-validity');if(validity){const raw=activeWorkspaceSubscription?.current_period_end||activeWorkspaceSubscription?.expires_at||activeWorkspaceSubscription?.end_date||activeWorkspaceSubscription?.valid_until||activeWorkspaceSubscription?.trial_ends_at; validity.textContent=raw?new Date(raw).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'Belum ditentukan';}
  const editable=isWorkspaceAdmin(); document.querySelectorAll('#workspace-settings-form input').forEach(e=>e.disabled=!editable); const save=document.getElementById('settings-save-btn');if(save)save.style.display=editable?'':'none';
  const note=document.getElementById('settings-permission-note');if(note)note.style.display=editable?'none':'block';
  const fullBranding=canUseFeature('custom_branding');
  const lock=document.getElementById('settings-branding-lock');if(lock)lock.style.display=fullBranding?'none':'block';
  ['settings-logo-url','settings-dashboard-slogan'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!editable||!fullBranding});
  ['settings-primary-color','settings-primary-text','settings-accent-color','settings-accent-text'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!editable});
  set('settings-access-copy',isWorkspaceOwner()?'Owner punya akses penuh ke workspace dan pengaturannya.':isWorkspaceAdmin()?'Admin dapat mengelola operasional dan identitas workspace.':'Staff dapat menjalankan operasional, tetapi tidak dapat mengubah Settings.');
  renderSettingsMasterData();
  applyTopicFieldLabel();
  renderWorkspaceSwitcher();
}
function openWorkspaceSettings(){
  if(!isWorkspaceAdmin()){showToast('Role Staff tidak memiliki akses untuk mengubah Settings.',true);return;}
  hydrateSaasUi();
  openAppPage('settings');
}
window.openWorkspaceSettings=openWorkspaceSettings; window.canManageSettings=isWorkspaceAdmin;

/* =========================
   V19 PAGE NAVIGATION
   ========================= */
function openAppPage(tabName){
  if(tabName==='performance' && !canUseFeature('performance')){showToast('Performance tersedia mulai paket PLUS.',true);return;}
  const landing=document.getElementById("landing-screen");
  const app=document.getElementById("app-shell");
  if(landing) landing.hidden=true;
  if(app) app.hidden=false;

  document.querySelectorAll(".section").forEach(x=>{x.classList.remove("active");x.style.display="";});
  const section=document.getElementById(tabName);
  if(section){
    section.classList.add("active");
    section.style.animation="none";
    void section.offsetWidth;
    section.style.animation="";
  }

  document.querySelectorAll(".v19-nav .tab").forEach(x=>{
    x.classList.toggle("active",x.dataset.tab===tabName);
  });

  const pageTitle=document.querySelector('main.container .page-title');
  const pageSub=document.querySelector('main.container .page-sub');
  const pageCopy={
    dashboard:['Dashboard',dashboardSlogan()],
    performance:['Performance','Ringkasan performa penjualan berdasarkan periode aktif.'],
    cash:['Petty Cash','Kelola arus kas operasional workspace.'],
    payout:['Withdraw','Kelola pencairan dan pembagian hasil.'],
    input:['Orders','Input dan kelola transaksi penjualan.'],
    customers:['Customer Database','Data dan riwayat customer workspace.'],
    settings:['Workspace Settings','Identitas bisnis, package, add-on, pembagian omzet, dan akses workspace aktif.']
  };
  if(pageTitle&&pageCopy[tabName]) pageTitle.textContent=pageCopy[tabName][0];
  if(pageSub&&pageCopy[tabName]) pageSub.textContent=pageCopy[tabName][1];
  if(tabName==="customers") renderCustomerDatabase();
  if(tabName==="performance") setTimeout(()=>[dailyChart,packageChart,monthlyRevenueChart,topicChart].forEach(c=>c?.resize?.()),60);
  window.scrollTo({top:0,left:0,behavior:"auto"});
}
function openLanding(){
  // Landing page removed in V20.4.2: the brand/home action now opens Dashboard directly.
  if(document.body.classList.contains("authenticated")){
    openAppPage("dashboard");
  }else{
    const app=document.getElementById("app-shell");
    if(app) app.hidden=false;
    document.getElementById("login-username")?.focus();
    window.scrollTo({top:0,left:0,behavior:"auto"});
  }
}
document.querySelectorAll(".v19-nav .tab, .landing-nav-btn").forEach(btn=>{
  btn.addEventListener("click",()=>openAppPage(btn.dataset.tab));
});
document.getElementById("v19-home")?.addEventListener("click",openLanding);


document.getElementById('saas-settings-btn')?.addEventListener('click',openWorkspaceSettings);
document.getElementById('saas-workspace-switcher')?.addEventListener('change',e=>switchActiveWorkspace(e.target.value).catch(err=>{console.error(err);showToast(err.message||'Gagal mengganti workspace.',true)}));
function syncColorPair(a,b){const x=document.getElementById(a),y=document.getElementById(b);x?.addEventListener('input',()=>{if(y)y.value=x.value});y?.addEventListener('change',()=>{if(/^#[0-9a-f]{6}$/i.test(y.value)&&x)x.value=y.value})}
syncColorPair('settings-primary-color','settings-primary-text');syncColorPair('settings-accent-color','settings-accent-text');
const DEFAULT_DASHBOARD_SLOGAN='';
function dashboardSlogan(){return String(activeWorkspaceBranding?.receipt_labels?.__dashboard_slogan||DEFAULT_DASHBOARD_SLOGAN).trim()||DEFAULT_DASHBOARD_SLOGAN;}
const DEFAULT_TOPIC_LABEL='Topik';
function topicFieldLabel(){return String(activeWorkspaceBranding?.receipt_labels?.__topic_label||DEFAULT_TOPIC_LABEL).trim()||DEFAULT_TOPIC_LABEL;}
function applyTopicFieldLabel(){const label=topicFieldLabel(); document.querySelectorAll('[data-kairo-topic-label]').forEach(el=>el.textContent=label); const orderLabel=document.querySelector('#tx-topics')?.previousElementSibling; if(orderLabel&&orderLabel.classList.contains('label'))orderLabel.textContent=label+' (bisa lebih dari satu)'; const cardTitle=document.getElementById('settings-topic-card-title');if(cardTitle)cardTitle.textContent=label; const add=document.getElementById('settings-add-topic');if(add)add.textContent='+ Tambah '+label; const inp=document.getElementById('settings-topic-label');if(inp)inp.value=label; const opt=document.querySelector('#settings-category-select option[value="topics"]');if(opt)opt.textContent=label; const sub=document.querySelector('.saas-settings-submenu-btn[data-settings-category="topics"]');if(sub)sub.textContent=label; const perf=[...document.querySelectorAll('.card-title')].find(x=>x.textContent.trim()==='Topik yang Dipilih'||x.dataset.topicTitle==='1');if(perf){perf.dataset.topicTitle='1';perf.textContent=label+' yang Dipilih';}}
document.getElementById('workspace-settings-form')?.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    requireWorkspaceRole(['owner','admin'],'mengubah Settings'); const wid=requireWorkspaceId(); const name=document.getElementById('settings-workspace-name').value.trim(); if(!name)throw new Error('Nama workspace wajib diisi.');
    const {error:werr}=await db.from('workspaces').update({name}).eq('id',wid); if(werr)throw werr;
    // v20.10.85: BASIC may customize only Primary + Accent colors. Logo/slogan stay plan-gated.
    const branding={
      primary_color:document.getElementById('settings-primary-text').value,
      accent_color:document.getElementById('settings-accent-text').value,
      updated_at:new Date().toISOString()
    };
    if(canUseFeature('custom_branding')){
      const sloganValue=document.getElementById('settings-dashboard-slogan')?.value.trim()||DEFAULT_DASHBOARD_SLOGAN;
      branding.receipt_labels={...(activeWorkspaceBranding?.receipt_labels||{}),__dashboard_slogan:sloganValue};
      branding.logo_url=document.getElementById('settings-logo-url').value.trim()||null;
    }
    const {error:berr}=await db.from('workspace_branding').upsert({workspace_id:wid,...branding},{onConflict:'workspace_id'}); if(berr)throw berr;
    activeWorkspaceName=name; await loadWorkspaceSaasContext(); hydrateSaasUi(); showToast('Workspace Settings tersimpan.');
  }catch(err){console.error(err);showToast(err.message||'Gagal menyimpan Settings.',true)}
});

/* =========================
   MASTER DATA
   ========================= */
async function loadMasters(){
  const [p,a,t,s] = await Promise.all([
    db.from("package_masters").select("*").eq("workspace_id",requireWorkspaceId()).eq("is_active",true).order("price"),
    db.from("addon_masters").select("*").eq("workspace_id",requireWorkspaceId()).eq("is_active",true).order("price"),
    db.from("topic_masters").select("*").eq("workspace_id",requireWorkspaceId()).eq("is_active",true).order("name"),
    db.from("profit_share_rules").select("*").eq("workspace_id",requireWorkspaceId()).eq("is_active",true).order("partner_name")
  ]);

  let versionResult={data:[],error:null};
  try{ versionResult=await db.from("profit_share_versions").select("*").eq("workspace_id",requireWorkspaceId()).order("effective_from",{ascending:false}); }
  catch(e){ versionResult={data:[],error:e}; }
  profitShareVersionTableReady=!versionResult.error;
  if(versionResult.error) console.warn("Profit share versions:",versionResult.error.message||versionResult.error);
  profitShareVersions=versionResult.data||[];

  const errors=[p,a,t,s].filter(x=>x.error);
  if(errors.length) throw new Error(errors.map(x=>x.error.message).join(" | "));

  packages=p.data||[];
  addons=a.data||[];
  topics=t.data||[];
  partners=s.data||[];

  renderMasterOptions();
  renderProfitShareEditor();
  renderSettingsMasterData();
}


function settingsMasterCanEdit(){return isWorkspaceAdmin();}
function masterTypeMeta(type){
  if(type==='package')return {label:'Package',table:'package_masters',priced:true};
  if(type==='addon')return {label:'Add-on',table:'addon_masters',priced:true};
  return {label:topicFieldLabel(),table:'topic_masters',priced:false};
}
function masterRowHtml(item,type){
  const canEdit=settingsMasterCanEdit(),m=masterTypeMeta(type);
  return `<div class="settings-master-row ${m.priced?'':'settings-topic-master-row'}" data-master-type="${type}" data-master-id="${escapeHtml(item.id||'')}"><div class="form-group"><label class="label">Kode <span style="font-weight:500;color:var(--muted)">(opsional)</span></label><input class="input settings-master-code" value="${escapeHtml(item.code||'')}" maxlength="30" ${canEdit?'':'disabled'}></div><div class="form-group master-name-field"><label class="label">Nama ${escapeHtml(m.label)}</label><input class="input settings-master-name" value="${escapeHtml(item.name||'')}" maxlength="100" ${canEdit?'':'disabled'}></div>${m.priced?`<div class="form-group"><label class="label">Harga</label><input class="input settings-master-price" type="number" min="0" step="1000" value="${Number(item.price||0)}" ${canEdit?'':'disabled'}></div>`:''}<div class="settings-master-actions">${canEdit?`<button class="btn btn-green settings-master-save" type="button">Simpan</button><button class="btn btn-light settings-master-disable" type="button">Nonaktifkan</button><button class="btn btn-danger settings-master-delete" type="button">Hapus</button>`:`<span class="settings-master-status">Read only</span>`}</div></div>`;
}
function renderSettingsMasterData(){
  const p=document.getElementById('settings-package-list'),a=document.getElementById('settings-addon-list'),t=document.getElementById('settings-topic-list');
  if(p)p.innerHTML=packages.length?packages.map(x=>masterRowHtml(x,'package')).join(''):'<div class="empty">Belum ada package aktif.</div>';
  if(a)a.innerHTML=addons.length?addons.map(x=>masterRowHtml(x,'addon')).join(''):'<div class="empty">Belum ada add-on aktif.</div>';
  if(t)t.innerHTML=topics.length?topics.map(x=>masterRowHtml(x,'topic')).join(''):`<div class="empty">Belum ada ${escapeHtml(topicFieldLabel().toLowerCase())} aktif.</div>`;
  const canEdit=settingsMasterCanEdit(); ['package','addon','topic'].forEach(type=>{const id=type==='package'?'settings-add-package':type==='addon'?'settings-add-addon':'settings-add-topic';const b=document.getElementById(id);if(b)b.style.display=canEdit?'':'none'}); const sl=document.getElementById('settings-save-topic-label');if(sl)sl.style.display=canEdit?'':'none'; const li=document.getElementById('settings-topic-label');if(li)li.disabled=!canEdit;
  applyTopicFieldLabel();
}
function appendNewMasterRow(type){
  if(!settingsMasterCanEdit())return showToast('Hanya Owner/Admin yang bisa mengubah master data.',true);
  const list=document.getElementById(type==='package'?'settings-package-list':type==='addon'?'settings-addon-list':'settings-topic-list'); if(!list)return;
  // v20.10.89: allow multiple draft rows at once, including Topic/Jenis.
  // Each click on + Tambah creates a fresh independent row instead of forcing a single draft.
  const m=masterTypeMeta(type),row=document.createElement('div'); row.className='settings-master-row'+(m.priced?'':' settings-topic-master-row'); row.dataset.masterType=type; row.dataset.masterNew='1';
  row.innerHTML=`<div class="form-group"><label class="label">Kode <span style="font-weight:500;color:var(--muted)">(opsional)</span></label><input class="input settings-master-code" maxlength="30" placeholder="${type==='package'?'PKG':type==='addon'?'ADD':'TOP'}"></div><div class="form-group master-name-field"><label class="label">Nama ${escapeHtml(m.label)}</label><input class="input settings-master-name" maxlength="100" placeholder="Nama ${escapeHtml(m.label)}"></div>${m.priced?'<div class="form-group"><label class="label">Harga</label><input class="input settings-master-price" type="number" min="0" step="1000" value="0"></div>':''}<div class="settings-master-actions"><button class="btn btn-green settings-master-create" type="button">Tambah</button><button class="btn btn-light settings-master-cancel" type="button">Batal</button></div>`;
  if(list.querySelector('.empty'))list.innerHTML=''; list.appendChild(row); row.querySelector('.settings-master-code')?.focus();
}
async function saveExistingMasterRow(row){
  try{requireWorkspaceRole(['owner','admin'],'mengubah master data'); const type=row.dataset.masterType,id=row.dataset.masterId,code=row.querySelector('.settings-master-code').value.trim(),name=row.querySelector('.settings-master-name').value.trim(),m=masterTypeMeta(type); if(!name)throw new Error('Nama wajib diisi.'); const payload={code:code||null,name}; if(m.priced){const price=Number(row.querySelector('.settings-master-price').value);if(!Number.isFinite(price)||price<0)throw new Error('Harga tidak valid.');payload.price=price} const {error}=await db.from(m.table).update(payload).eq('workspace_id',requireWorkspaceId()).eq('id',id); if(error)throw error; showToast(`${m.label} berhasil diperbarui.`); await loadMasters();}catch(err){showToast(err.message||'Gagal menyimpan master data.',true)}
}
async function createMasterRow(row){
  try{requireWorkspaceRole(['owner','admin'],'menambah master data'); const type=row.dataset.masterType,code=row.querySelector('.settings-master-code').value.trim(),name=row.querySelector('.settings-master-name').value.trim(),m=masterTypeMeta(type); if(!name)throw new Error('Nama wajib diisi.'); const payload={workspace_id:requireWorkspaceId(),code:code||null,name,is_active:true}; if(m.priced){const price=Number(row.querySelector('.settings-master-price').value);if(!Number.isFinite(price)||price<0)throw new Error('Harga tidak valid.');payload.price=price} const {error}=await db.from(m.table).insert(payload); if(error)throw error; showToast(`${m.label} berhasil ditambahkan.`); await loadMasters();}catch(err){showToast(err.message||'Gagal menambah master data.',true)}
}
async function deleteMasterRow(row){
  const type=row.dataset.masterType,id=row.dataset.masterId,name=row.querySelector('.settings-master-name')?.value||'',m=masterTypeMeta(type);
  if(!confirm(`Hapus permanen ${m.label} “${name}”? Item ini akan hilang dari master aktif. Data transaksi lama tidak ikut dihapus.`))return;
  try{requireWorkspaceRole(['owner','admin'],'menghapus master data');const {error}=await db.from(m.table).delete().eq('workspace_id',requireWorkspaceId()).eq('id',id);if(error)throw error;showToast(`${m.label} berhasil dihapus.`);await loadMasters();}catch(err){console.error(err);const msg=String(err?.message||'');showToast(msg.toLowerCase().includes('foreign key')||msg.toLowerCase().includes('violates')?'Item ini sudah dipakai di data lama, jadi tidak aman dihapus permanen. Gunakan Nonaktifkan agar histori tetap utuh.':(msg||'Gagal menghapus master data.'),true)}
}
async function disableMasterRow(row){
  const type=row.dataset.masterType,id=row.dataset.masterId,name=row.querySelector('.settings-master-name')?.value||'',m=masterTypeMeta(type); if(!confirm(`Nonaktifkan ${m.label} “${name}”? Data transaksi lama tetap aman.`))return;
  try{requireWorkspaceRole(['owner','admin'],'menonaktifkan master data');const {error}=await db.from(m.table).update({is_active:false}).eq('workspace_id',requireWorkspaceId()).eq('id',id);if(error)throw error;showToast(`${m.label} dinonaktifkan.`);await loadMasters();}catch(err){showToast(err.message||'Gagal menonaktifkan master data.',true)}
}
document.getElementById('settings-add-package')?.addEventListener('click',()=>appendNewMasterRow('package'));
document.getElementById('settings-add-addon')?.addEventListener('click',()=>appendNewMasterRow('addon'));
document.getElementById('settings-add-topic')?.addEventListener('click',()=>appendNewMasterRow('topic'));
document.getElementById('settings-save-topic-label')?.addEventListener('click',async()=>{try{requireWorkspaceRole(['owner','admin'],'mengubah nama topik');const label=(document.getElementById('settings-topic-label')?.value||'').trim();if(!label)throw new Error('Nama field wajib diisi.');const wid=requireWorkspaceId(),labels={...(activeWorkspaceBranding?.receipt_labels||{}),__topic_label:label};const {error}=await db.from('workspace_branding').upsert({workspace_id:wid,receipt_labels:labels,updated_at:new Date().toISOString()},{onConflict:'workspace_id'});if(error)throw error;await loadWorkspaceSaasContext();applyTopicFieldLabel();renderSettingsMasterData();showToast(`Nama Topik diubah menjadi “${label}”.`)}catch(err){showToast(err.message||'Gagal menyimpan nama Topik.',true)}});
document.addEventListener('click',e=>{const row=e.target.closest('.settings-master-row'); if(!row)return; if(e.target.closest('.settings-master-save'))saveExistingMasterRow(row); if(e.target.closest('.settings-master-create'))createMasterRow(row); if(e.target.closest('.settings-master-disable'))disableMasterRow(row); if(e.target.closest('.settings-master-delete'))deleteMasterRow(row); if(e.target.closest('.settings-master-cancel'))renderSettingsMasterData();});

function renderMasterOptions(){
  window.trineMasters={packages,addons,topics};
  document.getElementById("tx-packages").innerHTML = packages.map(x=>`
    <div class="master-item">
      <input type="checkbox" class="package-check" data-id="${x.id}" data-code="${escapeHtml(x.code)}" data-name="${escapeHtml(x.name)}" data-price="${x.price}">
      <div class="master-main"><strong>${escapeHtml(x.code)}</strong> — ${escapeHtml(x.name)}<small>${rupiah(x.price)}</small></div>
      <input class="input qty-input package-qty" type="number" min="1" step="1" value="1" disabled data-id="${x.id}">
    </div>`).join("");

  document.getElementById("tx-topics").innerHTML = topics.map(x=>`
    <label class="master-item"><input type="checkbox" class="topic-check" data-id="${x.id}" data-name="${escapeHtml(x.name)}"> <span class="master-main">${escapeHtml(x.name)}</span></label>`).join("");

  document.getElementById("tx-addons").innerHTML = addons.map(x=>`
    <div class="master-item">
      <input type="checkbox" class="addon-check" data-id="${x.id}" data-code="${escapeHtml(x.code)}" data-name="${escapeHtml(x.name)}" data-price="${x.price}">
      <div class="master-main"><strong>${escapeHtml(x.code)}</strong> — ${escapeHtml(x.name)}<small>${rupiah(x.price)}</small></div>
      <input class="input qty-input addon-qty" type="number" min="1" step="1" value="1" disabled data-id="${x.id}">
    </div>`).join("");

  document.getElementById("payout-partner").innerHTML =
    `<option value="">-- Pilih Partner --</option>` +
    partners.filter(x=>String(x.partner_name).toLowerCase()!=="kas").map(x=>`<option value="${x.id}" data-name="${escapeHtml(x.partner_name)}">${escapeHtml(x.partner_name)}</option>`).join("");

  document.querySelectorAll('.package-check').forEach(c=>c.addEventListener('change',()=>{ const q=document.querySelector(`.package-qty[data-id="${c.dataset.id}"]`); q.disabled=!c.checked; calculateTotal(); }));
  document.querySelectorAll('.addon-check').forEach(c=>c.addEventListener('change',()=>{ const q=document.querySelector(`.addon-qty[data-id="${c.dataset.id}"]`); q.disabled=!c.checked; calculateTotal(); }));
  document.querySelectorAll('.package-qty,.addon-qty').forEach(q=>q.addEventListener('input',calculateTotal));
  const tipInput=document.getElementById("tx-tip");
  if(tipInput) tipInput.addEventListener("input",()=>{
    try{ calculateTotal(); }catch(err){
      document.getElementById("tx-total").textContent="—";
    }
  });
}


/* =========================
   FETCH DATA
   ========================= */
function getRange(){
  const range=getPeriodRange(activePeriod);

  if(activePeriod==="custom"){
    if(!range.from || !range.to){
      throw new Error("Pilih tanggal mulai dan tanggal akhir untuk periode kustom.");
    }
    if(range.from>range.to){
      throw new Error("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.");
    }
  }

  return range;
}

function monthRangeParts(date){
  const y=date.getFullYear();
  const m=date.getMonth();
  const first=new Date(y,m,1);
  const last=new Date(y,m+1,0);
  return {first:localISODate(first),last:localISODate(last)};
}

function monthLabel(date){
  return new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(date);
}

async function fetchPlatformAnalytics(){
  const now=new Date(), start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-59), rows=[], PAGE_SIZE=500;
  for(let page=0;;page++){
    const {data,error}=await db.from("transactions").select("transaction_date,platform").eq("workspace_id",requireWorkspaceId()).gte("transaction_date",localISODate(start)).lte("transaction_date",localISODate(now)).order("transaction_date",{ascending:true}).range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
    if(error)throw error; const batch=data||[]; rows.push(...batch); if(batch.length<PAGE_SIZE)break;
  }
  platformAnalyticsRows=rows;
}
function platformKey(v){const s=String(v||"Other").trim(),n=s.toLowerCase();if(n==="x"||n==="twitter")return "X";if(n.includes("instagram"))return "Instagram";if(n.includes("threads"))return "Threads";if(n.includes("tiktok"))return "TikTok";if(n.includes("whatsapp")||n==="wa")return "WhatsApp";if(n.includes("telegram")||n==="tg")return "Telegram";return s||"Other";}
function chartBrandColors(){
  const cs=getComputedStyle(document.documentElement);
  const primary=(cs.getPropertyValue("--brand-primary")||"#696F41").trim();
  const accent=(cs.getPropertyValue("--brand-accent")||"#EA97A9").trim();
  const hexToRgb=h=>{const m=String(h).match(/^#([0-9a-f]{6})$/i);if(!m)return null;const n=parseInt(m[1],16);return [(n>>16)&255,(n>>8)&255,n&255];};
  const mix=(a,b,t)=>{const A=hexToRgb(a),B=hexToRgb(b);if(!A||!B)return a;const C=A.map((v,i)=>Math.round(v+(B[i]-v)*t));return `#${C.map(v=>v.toString(16).padStart(2,"0")).join("")}`;};
  const alpha=(h,a)=>{const r=hexToRgb(h);return r?`rgba(${r[0]},${r[1]},${r[2]},${a})`:h;};
  return {primary,accent,mix,alpha,palette:[accent,primary,mix(accent,"#ffffff",.28),mix(primary,"#ffffff",.28),mix(accent,primary,.42),mix(primary,accent,.42),mix(accent,"#ffffff",.52),mix(primary,"#ffffff",.52),mix(accent,"#000000",.16),mix(primary,"#000000",.16)]};
}
function platformChartColor(name,previous=false){const c=chartBrandColors();const i=Math.abs([...String(name||"")].reduce((a,ch)=>a+ch.charCodeAt(0),0))%c.palette.length;return previous?c.alpha(c.palette[i],.28):c.palette[i];}
function platformChartBorder(name){const c=chartBrandColors();const i=Math.abs([...String(name||"")].reduce((a,ch)=>a+ch.charCodeAt(0),0))%c.palette.length;return c.palette[i];}
function platformLogo(name){const n=platformKey(name);if(n==="X")return `<span class="platform-logo platform-x"><strong>𝕏</strong></span>`;if(n==="Instagram")return `<span class="platform-logo platform-instagram"><svg viewBox="0 0 24 24"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.7" r="1.1" fill="currentColor"/></svg></span>`;if(n==="Threads")return `<span class="platform-logo platform-threads"><strong>@</strong></span>`;if(n==="TikTok")return `<span class="platform-logo platform-tiktok"><strong>♪</strong></span>`;if(n==="WhatsApp")return `<span class="platform-logo platform-whatsapp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.7 2.2 2.3 3.8 4.5 4.5"/></svg></span>`;if(n==="Telegram")return `<span class="platform-logo platform-telegram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4 3.8 10.6c-.9.4-.8 1.7.1 1.9l4.4 1.3 1.7 5.1c.3.9 1.5 1 2 .2l2.6-3.3 4.4 3.2c.8.6 1.9.1 2.1-.9L22 5.1c.2-.8-.5-1.4-1-1.1Z"/><path d="m8.4 13.8 8.7-6.2-6.9 7.9"/></svg></span>`;return `<span class="platform-logo platform-other">•</span>`;}
function platformBounds(period){const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),days=period==="today"?1:Number(period||30),cs=new Date(today);cs.setDate(today.getDate()-(days-1));const pe=new Date(cs);pe.setDate(cs.getDate()-1);const ps=new Date(pe);ps.setDate(pe.getDate()-(days-1));return{days,currentStart:localISODate(cs),currentEnd:localISODate(today),previousStart:localISODate(ps),previousEnd:localISODate(pe)};}
function countPlatforms(from,to){const c={};platformAnalyticsRows.forEach(x=>{const d=String(x.transaction_date||"");if(d<from||d>to)return;const k=platformKey(x.platform);c[k]=(c[k]||0)+1});return c;}
function renderPlatformAnalytics(){const canvas=document.getElementById("platformChart"),summary=document.getElementById("platform-summary-list");if(!canvas||!summary)return;const b=platformBounds(platformAnalyticsPeriod),cur=countPlatforms(b.currentStart,b.currentEnd),prev=countPlatforms(b.previousStart,b.previousEnd),names=[...new Set([...Object.keys(cur),...Object.keys(prev)])].sort((a,z)=>(cur[z]||0)-(cur[a]||0));document.querySelectorAll(".platform-period-btn").forEach(x=>x.classList.toggle("active",x.dataset.platformPeriod===platformAnalyticsPeriod));const note=document.getElementById("platform-chart-note");if(note)note.textContent=platformAnalyticsPeriod==="today"?"Jumlah transaksi hari ini.":`Jumlah transaksi ${b.days} hari terakhir.`;if(platformChart)platformChart.destroy();platformChart=new Chart(canvas,{type:"bar",data:{labels:names.length?names:["Belum ada data"],datasets:[{label:"Periode Ini",data:names.length?names.map(n=>cur[n]||0):[0],backgroundColor:names.length?names.map(n=>platformChartColor(n,false)):[chartBrandColors().alpha(chartBrandColors().accent,.20)],borderColor:names.length?names.map(n=>platformChartBorder(n)):[chartBrandColors().accent],borderWidth:1.5,borderRadius:9},{label:"Periode Sebelumnya",data:names.length?names.map(n=>prev[n]||0):[0],backgroundColor:names.length?names.map(n=>platformChartColor(n,true)):[chartBrandColors().alpha(chartBrandColors().primary,.16)],borderColor:names.length?names.map(n=>platformChartBorder(n)):[chartBrandColors().primary],borderWidth:1,borderRadius:9}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{boxWidth:12,font:{size:10}}},tooltip:{callbacks:{label:x=>`${x.dataset.label}: ${x.parsed.y} transaksi`}}},scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{grid:{display:false}}}}});if(!names.length){summary.innerHTML=`<div class="empty">Belum ada data.</div>`;return}summary.innerHTML=names.map(n=>{const a=cur[n]||0,p=prev[n]||0;let g="-",cl="platform-growth-flat";if(p>0){const q=(a-p)/p*100;g=`${q>0?"+":""}${q.toLocaleString("id-ID",{maximumFractionDigits:1})}%`;cl=q>0?"platform-growth-up":q<0?"platform-growth-down":"platform-growth-flat"}else if(a>0){g="Baru";cl="platform-growth-up"}return `<div class="platform-summary-row">${platformLogo(n)}<div><div class="platform-summary-name">${escapeHtml(n)}</div><div class="platform-summary-meta">${p} → ${a} transaksi</div></div><div class="platform-summary-value ${cl}">${g}</div></div>`}).join("");}
document.querySelectorAll(".platform-period-btn").forEach(btn=>btn.addEventListener("click",()=>{platformAnalyticsPeriod=btn.dataset.platformPeriod||"30";renderPlatformAnalytics()}));

async function fetchMonthlyRevenueComparison(){
  const now=new Date();
  const currentStart=new Date(now.getFullYear(),now.getMonth(),1);
  const previousStart=new Date(now.getFullYear(),now.getMonth()-1,1);
  const previousEnd=new Date(now.getFullYear(),now.getMonth(),0);

  const from=localISODate(previousStart);
  const to=localISODate(now);

  const PAGE_SIZE=500;
  const rows=[];
  for(let page=0;;page++){
    const {data,error}=await db.from("transactions")
      .select("transaction_date,total_price")
      .eq("workspace_id",requireWorkspaceId())
      .gte("transaction_date",from)
      .lte("transaction_date",to)
      .order("transaction_date",{ascending:true})
      .range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
    if(error) throw error;
    const batch=data||[];
    rows.push(...batch);
    if(batch.length<PAGE_SIZE) break;
  }

  const currentFrom=localISODate(currentStart);
  const previousFrom=localISODate(previousStart);
  const previousTo=localISODate(previousEnd);

  const currentTotal=rows
    .filter(t=>t.transaction_date>=currentFrom && t.transaction_date<=to)
    .reduce((sum,t)=>sum+Number(t.total_price||0),0);

  const previousTotal=rows
    .filter(t=>t.transaction_date>=previousFrom && t.transaction_date<=previousTo)
    .reduce((sum,t)=>sum+Number(t.total_price||0),0);

  monthlyRevenueComparison={
    currentTotal,
    previousTotal,
    currentLabel:monthLabel(currentStart),
    previousLabel:monthLabel(previousStart)
  };
}


function formatDateTimeID(value){
  if(!value)return "-";
  const d=new Date(value); if(Number.isNaN(d.getTime()))return "-";
  return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(d).replace(".",":");
}
function formatDurationBetween(start,end=new Date()){
  if(!start)return "-";
  const a=new Date(start),b=end instanceof Date?end:new Date(end);
  let ms=Math.max(0,b-a); if(!Number.isFinite(ms))return "-";
  const totalMin=Math.floor(ms/60000),h=Math.floor(totalMin/60),m=totalMin%60;
  return h>0?`${h}j ${m}m`:`${m}m`;
}
async function fetchShiftData(){
  const [{data:shiftRows,error:sErr},txRows]=await Promise.all([
    db.from("reading_shifts").select("*").eq("workspace_id",requireWorkspaceId()).order("opened_at",{ascending:false}).limit(30),
    fetchAllRows(()=>db.from("transactions").select("id,shift_id,total_price,reading_started_at").eq("workspace_id",requireWorkspaceId()).not("shift_id","is",null))
  ]);
  if(sErr)throw sErr;
  shifts=shiftRows||[];
  shiftTransactions=txRows||[];
  currentShift=shifts.find(s=>!s.closed_at)||null;
}
function shiftStats(shift){
  if(!shift)return {revenue:0,count:0};
  const rows=shiftTransactions.filter(t=>String(t.shift_id)===String(shift.id));
  return {revenue:rows.reduce((s,t)=>s+Number(t.total_price||0),0),count:rows.length};
}
function renderShiftDashboard(){
  const status=document.getElementById("shift-status-text"); if(!status)return;
  const dot=document.getElementById("shift-status-dot"),openBtn=document.getElementById("open-shift-btn"),closeBtn=document.getElementById("close-shift-btn");
  const stats=shiftStats(currentShift);
  document.getElementById("shift-current-revenue").textContent=rupiah(stats.revenue);
  document.getElementById("shift-current-count").textContent=stats.count.toLocaleString("id-ID");
  document.getElementById("shift-opened-at").textContent=currentShift?formatDateTimeID(currentShift.opened_at):"-";
  document.getElementById("shift-duration").textContent=currentShift?formatDurationBetween(currentShift.opened_at):"-";
  status.textContent=currentShift?`Store aktif sejak ${formatDateTimeID(currentShift.opened_at)}`:"Store sedang tutup";
  dot.classList.toggle("open",!!currentShift);
  openBtn.disabled=!!currentShift; closeBtn.disabled=!currentShift;

  const body=document.getElementById("shift-history-body");
  const visibleShifts=shiftHistoryCollapsed?shifts.filter(s=>!s.closed_at):shifts;
  if(!shifts.length){
    body.innerHTML=`<tr><td colspan="7" class="empty">Belum ada riwayat Open Store.</td></tr>`;
  }else if(!visibleShifts.length){
    body.innerHTML=`<tr><td colspan="7" class="empty">Riwayat Open Store yang sudah ditutup sedang disembunyikan. Klik Expand untuk melihat semuanya.</td></tr>`;
  }else{
    body.innerHTML=visibleShifts.map(s=>{
      const st=shiftStats(s),isOpen=!s.closed_at;
      return `<tr class="${isOpen?"shift-row-active":"shift-row-closed"}"><td>${escapeHtml(formatDateTimeID(s.opened_at))}</td><td>${escapeHtml(formatDateTimeID(s.closed_at))}</td><td>${escapeHtml(formatDurationBetween(s.opened_at,s.closed_at||new Date()))}</td><td>${st.count}</td><td><strong>${rupiah(st.revenue)}</strong></td><td><span class="shift-badge ${isOpen?"open":"closed"}">${isOpen?"Aktif":"Ditutup"}</span></td><td><button type="button" class="shift-delete-btn" onclick="deleteReadingShift('${escapeHtml(s.id)}',${isOpen})">Hapus</button></td></tr>`;
    }).join("");
  }
  syncShiftHistoryToggle();

  clearInterval(shiftClockTimer);
  if(currentShift) shiftClockTimer=setInterval(()=>{
    const el=document.getElementById("shift-duration"); if(el)el.textContent=formatDurationBetween(currentShift.opened_at);
  },30000);
}
function syncShiftHistoryToggle(){
  const btn=document.getElementById("shift-history-toggle");
  const panel=document.getElementById("shift-history-panel");
  if(!btn)return;
  btn.setAttribute("aria-expanded",shiftHistoryCollapsed?"false":"true");
  btn.title=shiftHistoryCollapsed?"Expand riwayat Open Store":"Minimize riwayat Open Store";
  const span=btn.querySelector("span"); if(span)span.textContent=shiftHistoryCollapsed?"Expand":"Minimize";
  btn.classList.toggle("collapsed",shiftHistoryCollapsed);
  panel?.classList.toggle("is-collapsed",shiftHistoryCollapsed);
}
function toggleShiftHistory(){
  shiftHistoryCollapsed=!shiftHistoryCollapsed;
  localStorage.setItem(SHIFT_HISTORY_COLLAPSE_KEY,shiftHistoryCollapsed?"1":"0");
  renderShiftDashboard();
}
document.getElementById("shift-history-toggle")?.addEventListener("click",toggleShiftHistory);

function localDateTimeInputValue(date=new Date()){
  const pad=n=>String(n).padStart(2,"0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function parseLocalDateTimeInput(value){
  if(!value)return null;
  const d=new Date(value);
  return Number.isNaN(d.getTime())?null:d;
}
async function openReadingShift(){
  const btn=document.getElementById("open-shift-btn"); if(btn.disabled)return;
  const entered=prompt("Open Store dari tanggal & jam berapa?\n\nFormat: YYYY-MM-DDTHH:MM\nContoh: 2026-09-03T11:00\n\nKalau baru mulai sekarang, biarkan nilai default.",localDateTimeInputValue());
  if(entered===null)return;
  const opened=parseLocalDateTimeInput(entered.trim());
  if(!opened){showToast("Tanggal/jam Open Store tidak valid.",true);return;}
  if(opened>new Date()){showToast("Jam Open Store tidak boleh di masa depan.",true);return;}
  btn.disabled=true;
  try{
    const {data,error}=await db.from("reading_shifts").insert([workspaceInsert({opened_at:opened.toISOString()})]).select("*").single();
    if(error)throw error;
    const {data:backfilled,error:backfillError}=await db.from("transactions")
      .update({shift_id:data.id}).eq("workspace_id",requireWorkspaceId()).is("shift_id",null)
      .gte("reading_started_at",opened.toISOString()).lte("reading_started_at",new Date().toISOString()).select("id");
    if(backfillError)throw backfillError;
    currentShift=data;
    const n=backfilled?.length||0;
    showToast(n?`Store dibuka dari ${formatDateTimeID(data.opened_at)}. ${n} transaksi sebelumnya ikut dimasukkan.`:`Store dibuka dari ${formatDateTimeID(data.opened_at)}.`);
    await Promise.all([fetchShiftData(),refreshAll()]);
    renderShiftDashboard();
  }catch(err){showToast("Gagal membuka store: "+err.message,true);}
  finally{btn.disabled=!!currentShift;}
}
async function closeReadingShift(){
  if(!currentShift)return;
  const shiftId=currentShift.id;
  const entered=prompt("Close Store di tanggal & jam berapa?\n\nKalau kelupaan tutup, ubah ke jam selesai yang sebenarnya.\nFormat: YYYY-MM-DDTHH:MM",localDateTimeInputValue());
  if(entered===null)return;
  const closed=parseLocalDateTimeInput(entered.trim());
  if(!closed){showToast("Tanggal/jam tutup shift tidak valid.",true);return;}
  if(closed<new Date(currentShift.opened_at)){showToast("Jam Close Store tidak boleh lebih awal dari jam Open Store.",true);return;}
  if(closed>new Date()){showToast("Jam Close Store tidak boleh di masa depan.",true);return;}
  const btn=document.getElementById("close-shift-btn");btn.disabled=true;
  try{
    const {data:removed,error:removeError}=await db.from("transactions")
      .update({shift_id:null}).eq("workspace_id",requireWorkspaceId()).eq("shift_id",shiftId)
      .gt("reading_started_at",closed.toISOString()).select("id");
    if(removeError)throw removeError;
    const {error}=await db.from("reading_shifts").update({closed_at:closed.toISOString()}).eq("workspace_id",requireWorkspaceId()).eq("id",shiftId);
    if(error)throw error;
    const removedCount=removed?.length||0;
    await Promise.all([fetchShiftData(),refreshAll()]);
    renderShiftDashboard();
    showToast(removedCount?`Store ditutup sesuai jam pilihan. ${removedCount} transaksi setelah jam tutup dikeluarkan dari sesi.`:"Store berhasil ditutup sesuai jam pilihan.");
  }catch(err){showToast("Gagal menutup store: "+err.message,true);}
  finally{btn.disabled=!currentShift;}
}
async function deleteReadingShift(shiftId,isOpen){
  if(!shiftId)return;
  const message=isOpen
    ?"Hapus shift yang sedang aktif ini?\n\nTransaksi di dalamnya TIDAK akan terhapus dan omzet harian tetap aman. Transaksi hanya akan dilepas dari shift supaya bisa dimasukkan ke shift lain nanti."
    :"Hapus riwayat shift ini?\n\nTransaksi di dalamnya TIDAK akan terhapus dan pencatatan keuangan tetap aman. Transaksi hanya akan menjadi tidak terikat ke shift.";
  if(!confirm(message))return;

  try{
    const {error}=await db.from("reading_shifts").delete().eq("workspace_id",requireWorkspaceId()).eq("id",shiftId);
    if(error)throw error;
    if(currentShift && String(currentShift.id)===String(shiftId)) currentShift=null;
    showToast("Shift berhasil dihapus. Data transaksi dan omzet tetap aman.");
    await Promise.all([fetchShiftData(),refreshAll()]);
    renderShiftDashboard();
  }catch(err){showToast("Gagal menghapus shift: "+err.message,true);}
}

document.getElementById("open-shift-btn")?.addEventListener("click",openReadingShift);
document.getElementById("close-shift-btn")?.addEventListener("click",closeReadingShift);

async function fetchTransactions(){
  const {from,to}=getRange();
  const PAGE_SIZE=500;
  const rows=[];

  for(let page=0;;page++){
    let q=db.from("transactions")
      .select("*")
      .eq("workspace_id",requireWorkspaceId())
      .order("transaction_date",{ascending:false})
      .order("created_at",{ascending:false})
      .range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);

    if(from) q=q.gte("transaction_date",from);
    if(to) q=q.lte("transaction_date",to);

    const {data,error}=await q;
    if(error) throw error;

    const batch=data||[];
    rows.push(...batch);

    if(batch.length<PAGE_SIZE) break;
  }

  transactions=rows;
}


function historyFilterBounds(mode=historyDateFilter,customDate=historyCustomDate){
  const now=new Date();
  const iso=d=>localISODate(d);
  if(mode==="today") return {from:iso(now),to:iso(now)};
  if(mode==="yesterday"){const d=new Date(now);d.setDate(d.getDate()-1);return {from:iso(d),to:iso(d)};}
  if(mode==="month"){const start=new Date(now.getFullYear(),now.getMonth(),1);const end=new Date(now.getFullYear(),now.getMonth()+1,0);return {from:iso(start),to:iso(end)};}
  if(mode==="custom" && customDate) return {from:customDate,to:customDate};
  return {from:null,to:null};
}

async function fetchHistoryTransactions(){
  const {from,to}=historyFilterBounds();
  const PAGE_SIZE=500;
  const rows=[];
  for(let page=0;;page++){
    let q=db.from("transactions")
      .select("*")
      .eq("workspace_id",requireWorkspaceId())
      .order("transaction_date",{ascending:false})
      .order("created_at",{ascending:false})
      .range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
    if(from) q=q.gte("transaction_date",from);
    if(to) q=q.lte("transaction_date",to);
    const {data,error}=await q;
    if(error) throw error;
    const batch=data||[]; rows.push(...batch);
    if(batch.length<PAGE_SIZE) break;
  }
  historyTransactions=rows;
}

async function fetchPayouts(){
  const {from,to}=getRange();

  let q=db.from("payouts")
    .select("*")
    .eq("workspace_id",requireWorkspaceId())
    .order("payout_date",{ascending:false})
    .order("created_at",{ascending:false});

  if(from) q=q.gte("payout_date",from);
  if(to) q=q.lte("payout_date",to);

  const PAGE_SIZE=500;
  let offset=0;
  const rows=[];

  while(true){
    const {data,error}=await q.range(offset,offset+PAGE_SIZE-1);
    if(error) throw error;

    const batch=data||[];
    rows.push(...batch);

    if(batch.length<PAGE_SIZE) break;
    offset+=PAGE_SIZE;
  }

  payouts=rows;
}
async function fetchCashExpenses(){
  const {from,to}=getRange();
  let q=db.from("cash_expenses").select("*").eq("workspace_id",requireWorkspaceId()).order("expense_date",{ascending:false}).order("created_at",{ascending:false});
  if(from) q=q.gte("expense_date",from);
  if(to) q=q.lte("expense_date",to);
  const PAGE_SIZE=500; let offset=0; const rows=[];
  while(true){
    const {data,error}=await q.range(offset,offset+PAGE_SIZE-1);
    if(error) throw error;
    const batch=data||[]; rows.push(...batch);
    if(batch.length<PAGE_SIZE) break; offset+=PAGE_SIZE;
  }
  cashExpenses=rows;
}
async function fetchCashInjections(){
  const {from,to}=getRange();
  let q=db.from("cash_injections").select("*").eq("workspace_id",requireWorkspaceId()).order("injection_date",{ascending:false}).order("created_at",{ascending:false});
  if(from) q=q.gte("injection_date",from);
  if(to) q=q.lte("injection_date",to);
  const PAGE_SIZE=500; let offset=0; const rows=[];
  while(true){
    const {data,error}=await q.range(offset,offset+PAGE_SIZE-1);
    if(error) throw error;
    const batch=data||[]; rows.push(...batch);
    if(batch.length<PAGE_SIZE) break; offset+=PAGE_SIZE;
  }
  cashInjections=rows;
}

async function fetchFinancialSnapshot(){
  const {to}=getRange();
  const fetchAllSnapshot = async (makeQuery) => {
    const PAGE_SIZE=500; let offset=0; const all=[];
    while(true){
      const {data,error}=await makeQuery().range(offset,offset+PAGE_SIZE-1);
      if(error) throw error;
      const batch=data||[]; all.push(...batch);
      if(batch.length<PAGE_SIZE) break; offset+=PAGE_SIZE;
    }
    return all;
  };
  // These four snapshots are independent; fetch them concurrently to reduce mobile latency.
  const [txAll,poAll,cashAll,injectionAll]=await Promise.all([
    fetchAllSnapshot(()=>{let q=db.from("transactions").select("total_price,transaction_date,created_at,order_items,order_addons").eq("workspace_id",requireWorkspaceId()); if(to) q=q.lte("transaction_date",to); return q;}),
    fetchAllSnapshot(()=>{let q=db.from("payouts").select("partner_id,partner_name,amount,payout_date").eq("workspace_id",requireWorkspaceId()); if(to) q=q.lte("payout_date",to); return q;}),
    fetchAllSnapshot(()=>{let q=db.from("cash_expenses").select("amount,expense_date").eq("workspace_id",requireWorkspaceId()); if(to) q=q.lte("expense_date",to); return q;}),
    fetchAllSnapshot(()=>{let q=db.from("cash_injections").select("amount,injection_date").eq("workspace_id",requireWorkspaceId()); if(to) q=q.lte("injection_date",to); return q;})
  ]);
  const revenue=txAll.reduce((s,t)=>s+Number(t.total_price||0),0);
  const payoutTotal=poAll.reduce((s,p)=>s+Number(p.amount||0),0);
  const cashSpent=cashAll.reduce((s,e)=>s+Number(e.amount||0),0);
  const cashInjected=injectionAll.reduce((s,e)=>s+Number(e.amount||0),0);
  const cashEarned=cashEntitlementFromTransactions(txAll);
  const payoutByPartner={};
  poAll.forEach(p=>{const key=p.partner_id||p.partner_name||"-"; payoutByPartner[key]=(payoutByPartner[key]||0)+Number(p.amount||0);});
  financialSnapshot={revenue,payoutTotal,payoutByPartner,cashEarned,cashInjected,cashSpent,cashBalance:cashEarned+cashInjected-cashSpent,txAll};
}
async function refreshAll(){
  if(refreshInFlight) return refreshInFlight;
  refreshInFlight=(async()=>{
    try{
      document.getElementById("connection-status").textContent="Memuat...";
  { const ls=document.getElementById("landing-connection-status"); if(ls) ls.textContent="Memuat..."; }
      // Current-period data and the cumulative financial snapshot are independent.
      await Promise.all([fetchTransactions(),fetchHistoryTransactions(),fetchPayouts(),fetchCashExpenses(),fetchCashInjections(),fetchFinancialSnapshot(),fetchMonthlyRevenueComparison(),fetchPlatformAnalytics(),fetchShiftData()]);
      renderDashboard();
      renderShiftDashboard();
      renderPayouts();
      renderCashExpenses();
      document.getElementById("connection-status").textContent="● Database terhubung";
  { const ls=document.getElementById("landing-connection-status"); if(ls) ls.textContent="● Database terhubung"; }
    }catch(e){
      console.error(e);
      document.getElementById("connection-status").textContent="Database error";
  { const ls=document.getElementById("landing-connection-status"); if(ls) ls.textContent="Database error"; }
      showToast(e.message || "Gagal mengambil data",true);
    }finally{
      refreshInFlight=null;
    }
  })();
  return refreshInFlight;
}

/* =========================
   REALTIME SYNC + FALLBACK POLLING
   ========================= */
let realtimeRetryTimer=null;
let livePollTimer=null;
function scheduleRealtimeRefresh(){
  clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer=setTimeout(()=>{
    realtimeRefreshTimer=null;
    if(!dashboardInitialized || document.body.classList.contains("auth-locked")) return;
    refreshAll();
  },350);
}
function stopRealtimeSync(){
  clearTimeout(realtimeRefreshTimer);
  clearTimeout(realtimeRetryTimer);
  clearInterval(livePollTimer);
  realtimeRefreshTimer=null; realtimeRetryTimer=null; livePollTimer=null;
  if(realtimeChannel){
    try{ db.removeChannel(realtimeChannel); }catch(e){ console.warn("Realtime cleanup:",e); }
    realtimeChannel=null;
  }
}
function scheduleRealtimeRetry(){
  clearTimeout(realtimeRetryTimer);
  if(!dashboardInitialized || document.body.classList.contains("auth-locked")) return;
  realtimeRetryTimer=setTimeout(()=>{ realtimeRetryTimer=null; startRealtimeSync(); },3000);
}
function startLiveFallbackPolling(){
  clearInterval(livePollTimer);
  livePollTimer=setInterval(()=>{
    if(document.hidden || !dashboardInitialized || document.body.classList.contains("auth-locked")) return;
    scheduleRealtimeRefresh();
  },15000);
}
function startRealtimeSync(){
  if(realtimeChannel) return;
  realtimeChannel=db.channel("trine-magic-live-dashboard")
    .on("postgres_changes",{event:"*",schema:"public",table:"transactions",filter:`workspace_id=eq.${requireWorkspaceId()}`},scheduleRealtimeRefresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"payouts",filter:`workspace_id=eq.${requireWorkspaceId()}`},scheduleRealtimeRefresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"cash_expenses",filter:`workspace_id=eq.${requireWorkspaceId()}`},scheduleRealtimeRefresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"cash_injections",filter:`workspace_id=eq.${requireWorkspaceId()}`},scheduleRealtimeRefresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"profit_share_versions",filter:`workspace_id=eq.${requireWorkspaceId()}`},async()=>{await loadMasters();scheduleRealtimeRefresh();})
    .subscribe((status)=>{
      const statusEl=document.getElementById("connection-status");
      if(status==="SUBSCRIBED"){
        if(statusEl) statusEl.textContent="Live";
      }else if(status==="CHANNEL_ERROR" || status==="TIMED_OUT" || status==="CLOSED"){
        console.warn("Supabase Realtime status:",status);
        if(statusEl) statusEl.textContent="Sinkronisasi...";
        if(realtimeChannel){ try{ db.removeChannel(realtimeChannel); }catch(e){} realtimeChannel=null; }
        scheduleRealtimeRetry();
      }
    });
  startLiveFallbackPolling();
}

/* =========================
   CALCULATIONS
   ========================= */
function getPriceAdjustment(baseTotal){
  const type=document.getElementById("tx-adjustment-type")?.value || "none";
  const mode=document.getElementById("tx-adjustment-mode")?.value || "percent";
  const raw=Number(document.getElementById("tx-adjustment-value")?.value || 0);
  const value=Math.max(0,Number.isFinite(raw)?raw:0);
  if(type==="none" || value<=0) return {type:"none",mode,value:0,amount:0};
  let amount=mode==="percent" ? baseTotal*(value/100) : value;
  amount=Math.min(Math.max(0,amount), type==="discount" ? baseTotal : Number.MAX_SAFE_INTEGER);
  return {type,mode,value,amount:type==="discount" ? -amount : amount};
}
function getSelectedOrder(){
  const selectedPackages=[...document.querySelectorAll('.package-check:checked')].map(c=>{
    const q=document.querySelector(`.package-qty[data-id="${c.dataset.id}"]`);
    const qty=Math.max(1,Number(q?.value||1)); const unit=Number(c.dataset.price||0);
    const master=packages.find(x=>String(x.id)===String(c.dataset.id))||{}; const cost=Math.max(0,Number(master.cost_price||0));
    return {id:c.dataset.id,code:c.dataset.code,name:c.dataset.name,qty,unit_price:unit,subtotal:unit*qty,cost_price:cost,cost_subtotal:cost*qty,profit_share_mode:master.profit_share_mode||'percentage',manual_profit_split:Array.isArray(master.manual_profit_split)?master.manual_profit_split:[]};
  });
  const selectedTopics=[...document.querySelectorAll('.topic-check:checked')].map(c=>({id:c.dataset.id,name:c.dataset.name}));
  const selectedAddons=[...document.querySelectorAll('.addon-check:checked')].map(c=>{
    const q=document.querySelector(`.addon-qty[data-id="${c.dataset.id}"]`);
    const qty=Math.max(1,Number(q?.value||1)); const unit=Number(c.dataset.price||0);
    const master=addons.find(x=>String(x.id)===String(c.dataset.id))||{}; const cost=Math.max(0,Number(master.cost_price||0));
    return {id:c.dataset.id,code:c.dataset.code,name:c.dataset.name,qty,unit_price:unit,subtotal:unit*qty,cost_price:cost,cost_subtotal:cost*qty,profit_share_mode:master.profit_share_mode||'percentage',manual_profit_split:Array.isArray(master.manual_profit_split)?master.manual_profit_split:[]};
  });
  const subtotal=selectedPackages.reduce((s,x)=>s+x.subtotal,0)+selectedAddons.reduce((s,x)=>s+x.subtotal,0);
  const adjustment=getPriceAdjustment(subtotal);
  const tipInput=document.getElementById("tx-tip");
  const tipRaw=String(tipInput?.value||"").trim();
  const tip=tipRaw==="" ? 0 : Number(tipRaw);
  if(tipRaw!=="" && (!Number.isFinite(tip) || tip<500 || tip>10000000)){
    throw new Error("Tip harus di antara Rp500 sampai Rp10.000.000.");
  }
  const total=Math.max(0,subtotal+adjustment.amount)+tip;
  return {packages:selectedPackages,topics:selectedTopics,addons:selectedAddons,subtotal,adjustment,tip,total};
}
function calculateTotal(){
  const order=getSelectedOrder();
  document.getElementById("tx-total").textContent=rupiah(order.total);
  const help=document.getElementById("tx-adjustment-help");
  if(help){
    const a=order.adjustment;
    help.textContent=a.type==="none" ? "Bisa digunakan untuk promo, harga khusus, atau penyesuaian harga satu kali pada transaksi ini." : `${a.type==="discount"?"Pengurangan":"Penambahan"}: ${a.mode==="percent"?a.value+"%":rupiah(a.value)} → ${a.amount<0?"-":"+"}${rupiah(Math.abs(a.amount))}`;
  }
  return order;
}

function setKpiValue(id,value){
  lastKpiValues[id]=Number(value||0);
  const el=document.getElementById(id);
  if(!el) return;
  el.textContent=maskedNominals ? "••••••" : rupiah(lastKpiValues[id]);
}
function updateKpiEyeButtons(){
  document.querySelectorAll(".kpi-eye").forEach(btn=>{
    const hidden=maskedNominals;
    btn.innerHTML=hidden?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"></path><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6 0 9.5 7 9.5 7a16.5 16.5 0 0 1-2.2 3.1"></path><path d="M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.5 7 9.5 7a9.7 9.7 0 0 0 4.1-.9"></path></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.7"></circle></svg>';
    btn.setAttribute("aria-label",hidden?"Tampilkan nominal":"Sembunyikan nominal");
    btn.title=hidden?"Tampilkan nominal":"Sembunyikan nominal";
  });
}
function toggleKpiVisibility(){
  maskedNominals=!maskedNominals;
  localStorage.setItem("trine_magic_masked_nominals",maskedNominals?"1":"0");
  ["kpi-revenue","kpi-cash","kpi-rights"].forEach(id=>setKpiValue(id,lastKpiValues[id]));
  updateKpiEyeButtons();
}

function currentCalendarMonthRevenue(){
  const now=new Date();
  const y=now.getFullYear(),m=now.getMonth();
  const start=`${y}-${String(m+1).padStart(2,"0")}-01`;
  const lastDay=new Date(y,m+1,0).getDate();
  const end=`${y}-${String(m+1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
  const source=Array.isArray(financialSnapshot?.txAll)?financialSnapshot.txAll:[];
  return source.filter(t=>{const d=String(t.transaction_date||"");return d>=start&&d<=end;}).reduce((sum,t)=>sum+Number(t.total_price||0),0);
}
function renderDashboard(){
  const revenue=transactions.reduce((s,t)=>s+Number(t.total_price||0),0);
  const counts={};
  transactions.forEach(t=>{
    const items=Array.isArray(t.order_items)&&t.order_items.length?t.order_items:[{name:t.package_code||"-",qty:Number(t.package_qty||1)}];
    items.forEach(x=>{const name=x.name||x.code||"-"; counts[name]=(counts[name]||0)+Number(x.qty||1);});
  });
  const best=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  setKpiValue("kpi-revenue",revenue);
  document.getElementById("kpi-tx").textContent=transactions.length;
  document.getElementById("kpi-best").textContent=best ? `${best[0]} (${best[1]}x)` : "-";
  setKpiValue("kpi-cash",financialSnapshot.cashBalance);
  setKpiValue("kpi-rights",currentCalendarMonthRevenue());
  renderShares(revenue);
  renderCharts();
  renderHistory();
}

function renderShares(revenue){
  let totalRights=0;
  const html=partners.filter(p=>String(p.partner_name).toLowerCase()!=="kas").map(p=>{
    const pct=shareRuleFor(p,todayISO());
    const periodRight=entitlementFromTransactions(transactions,p);
    const key=p.id||p.partner_name;
    const paidToDate=Number(financialSnapshot.payoutByPartner?.[key]||0);
    const cumulativeRight=entitlementFromTransactions(financialSnapshot.txAll||[],p);
    const remaining=Math.max(0,cumulativeRight-paidToDate);
    totalRights+=remaining;
    return `<div class="share-row"><div><div class="share-name">${escapeHtml(p.partner_name)}</div></div><div style="text-align:right"><div><strong>${rupiah(periodRight)}</strong></div><div class="share-pct">Sisa hak: <strong>${rupiah(remaining)}</strong></div></div></div>`;
  }).join("") || `<div class="empty">Belum ada profit sharing rule.</div>`;
  document.getElementById("share-summary").innerHTML=html;
}

function renderProfitShareEditor(){
  const grid=document.getElementById("profit-share-rule-grid"); if(!grid) return;
  const editable=isWorkspaceAdmin();
  const effective=document.getElementById("profit-share-effective-date"); if(effective&&!effective.value) effective.value=kairoLocalDateTimeValue();
  const active=activeShareVersionForDate(kairoLocalDateTimeValue());
  const activeRules=active?normalizeShareRules(active.rules):[];
  const rows=[...partners];
  if(!rows.some(p=>String(p.partner_name||'').toLowerCase()==='kas')) rows.push({id:null,partner_name:'Kas',percentage:LEGACY_CASH_SHARE_RATE});
  grid.innerHTML=rows.map(p=>{
    const saved=activeRules.find(r=>(r.partner_id&&p.id&&String(r.partner_id)===String(p.id))||String(r.partner_name||'').toLowerCase()===String(p.partner_name||'').toLowerCase());
    const pct=(Number(saved?.percentage??p.percentage??(String(p.partner_name).toLowerCase()==='kas'?LEGACY_CASH_SHARE_RATE:0))*100);
    return `<div class="profit-rule-item"><label>${escapeHtml(p.partner_name||'-')}</label><div class="profit-rule-input-wrap"><input class="input profit-share-pct" type="number" min="0" max="100" step="0.01" value="${Number.isFinite(pct)?pct.toFixed(2).replace(/\.00$/,''):0}" data-partner-id="${p.id||''}" data-partner-name="${escapeHtml(p.partner_name||'')}"><span>%</span></div></div>`;
  }).join('');
  grid.querySelectorAll('input').forEach(i=>{i.disabled=!editable;i.addEventListener('input',updateProfitShareTotal)});
  const save=document.getElementById('profit-share-save'); if(save) save.style.display=editable?'':'none';
  const label=document.getElementById('profit-share-active-label'); if(label) label.textContent=active?`Aktif sejak ${String(active.effective_from||'').replace('T',' ').slice(0,16)}`:'Aturan legacy';
  const note=document.getElementById('profit-share-history-note'); if(note) note.textContent=profitShareVersionTableReady?(profitShareVersions.length?`${profitShareVersions.length} versi pembagian tersimpan.`:'Belum ada versi tersimpan. Simpan untuk membuat versi pertama.'):'Jalankan migration profit_share_versions dulu agar histori pembagian tersimpan.';
  updateProfitShareTotal();
  renderProductProfitRules();
}
function updateProfitShareTotal(){
  const total=[...document.querySelectorAll('.profit-share-pct')].reduce((s,i)=>s+Number(i.value||0),0);
  const el=document.getElementById('profit-share-total'); if(!el)return; el.textContent=`Total ${total.toLocaleString('id-ID',{maximumFractionDigits:2})}%`; el.classList.toggle('invalid',Math.abs(total-100)>0.001);
}

function profitManualPartners(){const rows=[...partners];if(!rows.some(p=>String(p.partner_name||'').toLowerCase()==='kas'))rows.push({id:null,partner_name:'Kas'});return rows;}
function productProfitRow(item,type){
  const editable=isWorkspaceAdmin(),mode=String(item.profit_share_mode||'percentage'),cost=Math.max(0,Number(item.cost_price||0)),net=Math.max(0,Number(item.price||0)-cost),saved=Array.isArray(item.manual_profit_split)?item.manual_profit_split:[];
  const fields=profitManualPartners().map(p=>{const r=saved.find(x=>(x.partner_id&&p.id&&String(x.partner_id)===String(p.id))||String(x.partner_name||'').toLowerCase()===String(p.partner_name||'').toLowerCase());return `<div class="profit-manual-field"><label>${escapeHtml(p.partner_name||'-')}</label><input class="input profit-product-manual-amount" type="number" min="0" step="500" value="${Number(r?.amount||0)}" data-partner-id="${p.id||''}" data-partner-name="${escapeHtml(p.partner_name||'')}" ${editable?'':'disabled'}></div>`;}).join('');
  return `<div class="profit-product-row ${mode==='manual'?'manual':''}" data-profit-type="${type}" data-profit-id="${escapeHtml(item.id||'')}"><div class="profit-product-top"><div class="profit-product-name"><strong>${escapeHtml(item.name||item.code||'-')}</strong><small>${type==='package'?'Package':'Add-on'} · Harga jual ${rupiah(item.price||0)}</small></div><div class="form-group"><label class="label">HPP / Modal</label><input class="input profit-product-cost" type="number" min="0" step="500" value="${cost}" ${editable?'':'disabled'}></div><div class="form-group"><label class="label">Laba Bersih</label><div class="profit-product-net">${rupiah(net)}</div></div><div class="form-group"><label class="label">Metode Pembagian</label><select class="input profit-product-mode" ${editable?'':'disabled'}><option value="percentage" ${mode!=='manual'?'selected':''}>Persentase global</option><option value="manual" ${mode==='manual'?'selected':''}>Nominal manual</option></select></div>${editable?'<button class="btn btn-green profit-product-save" type="button">Simpan</button>':''}</div><div class="profit-product-manual">${fields}<div class="profit-manual-total"></div></div></div>`;
}
function refreshProductProfitRow(row){if(!row)return;const type=row.dataset.profitType,id=row.dataset.profitId,source=type==='package'?packages:addons,item=source.find(x=>String(x.id)===String(id));if(!item)return;const cost=Math.max(0,Number(row.querySelector('.profit-product-cost')?.value||0)),net=Math.max(0,Number(item.price||0)-cost),mode=row.querySelector('.profit-product-mode')?.value||'percentage';const netEl=row.querySelector('.profit-product-net');if(netEl)netEl.textContent=rupiah(net);row.classList.toggle('manual',mode==='manual');const total=[...row.querySelectorAll('.profit-product-manual-amount')].reduce((s,x)=>s+Math.max(0,Number(x.value||0)),0),note=row.querySelector('.profit-manual-total');if(note){note.textContent=mode==='manual'?`Total manual ${rupiah(total)} dari laba bersih ${rupiah(net)}`:'Mengikuti persentase global setelah HPP dipotong.';note.classList.toggle('invalid',mode==='manual'&&Math.abs(total-net)>0.005);}}
function renderProductProfitRules(){const host=document.getElementById('profit-product-rules');if(!host)return;const rows=[...packages.map(x=>({item:x,type:'package'})),...addons.map(x=>({item:x,type:'addon'}))];host.innerHTML=rows.length?rows.map(x=>productProfitRow(x.item,x.type)).join(''):'<div class="empty">Belum ada package atau add-on aktif.</div>';host.querySelectorAll('.profit-product-row').forEach(row=>{row.querySelector('.profit-product-cost')?.addEventListener('input',()=>refreshProductProfitRow(row));row.querySelector('.profit-product-mode')?.addEventListener('change',()=>refreshProductProfitRow(row));row.querySelectorAll('.profit-product-manual-amount').forEach(i=>i.addEventListener('input',()=>refreshProductProfitRow(row)));row.querySelector('.profit-product-save')?.addEventListener('click',()=>saveProductProfitRule(row));refreshProductProfitRow(row);});}
async function saveProductProfitRule(row){try{requireWorkspaceRole(['owner','admin'],'mengubah HPP dan pembagian produk');const type=row.dataset.profitType,id=row.dataset.profitId,source=type==='package'?packages:addons,item=source.find(x=>String(x.id)===String(id));if(!item)throw new Error('Produk tidak ditemukan.');const cost=Math.max(0,Number(row.querySelector('.profit-product-cost')?.value||0)),net=Math.max(0,Number(item.price||0)-cost),mode=row.querySelector('.profit-product-mode')?.value||'percentage',manual=[...row.querySelectorAll('.profit-product-manual-amount')].map(i=>({partner_id:i.dataset.partnerId||null,partner_name:i.dataset.partnerName||'',amount:Math.max(0,Number(i.value||0))})),total=manual.reduce((s,r)=>s+r.amount,0);if(mode==='manual'&&Math.abs(total-net)>0.005)throw new Error(`Total nominal manual wajib sama dengan laba bersih ${rupiah(net)}. Sekarang ${rupiah(total)}.`);const table=type==='package'?'package_masters':'addon_masters',payload={cost_price:cost,profit_share_mode:mode,manual_profit_split:mode==='manual'?manual:[]};const {error}=await db.from(table).update(payload).eq('workspace_id',requireWorkspaceId()).eq('id',id);if(error)throw error;showToast(`${type==='package'?'Package':'Add-on'}: HPP dan aturan profit tersimpan.`);await loadMasters();await refreshAll();}catch(err){console.error(err);showToast(err.message||'Gagal menyimpan aturan profit produk.',true);}}


function renderCharts(){
  const daily={};
  transactions.forEach(t=>{
    const d=t.transaction_date;
    daily[d]=(daily[d]||0)+Number(t.total_price||0);
  });

  // Rekap paket berdasarkan TOTAL QTY yang dibeli, bukan jumlah customer/transaksi.
  // order_items adalah sumber utama karena setiap item menyimpan qty masing-masing.
  const pkg={};
  transactions.forEach(t=>{
    const items=Array.isArray(t.order_items)&&t.order_items.length
      ? t.order_items
      : [{name:t.package_code||"-",qty:Number(t.package_qty||1)}];
    items.forEach(x=>{
      const name=x.name||x.code||"-";
      const qty=Number(x.qty||1);
      pkg[name]=(pkg[name]||0)+(Number.isFinite(qty)&&qty>0?qty:0);
    });
  });

  // Rekap topik berdasarkan berapa kali topik dipilih dalam transaksi
  // pada periode/filter tanggal yang sedang aktif.
  const topicCounts={};
  transactions.forEach(t=>{
    const topics=Array.isArray(t.order_topics)&&t.order_topics.length
      ? t.order_topics
      : (t.topic_name ? [{name:t.topic_name}] : []);
    topics.forEach(x=>{
      const name=String(x?.name||x?.code||"").trim();
      if(!name)return;
      topicCounts[name]=(topicCounts[name]||0)+1;
    });
  });

  const brandChart=chartBrandColors();

  if(dailyChart) dailyChart.destroy();
  if(packageChart) packageChart.destroy();
  if(monthlyRevenueChart) monthlyRevenueChart.destroy();
  if(topicChart) topicChart.destroy();

  dailyChart=new Chart(document.getElementById("dailyChart"),{
    type:"line",
    data:{labels:Object.keys(daily).sort(),datasets:[{
      label:"Omset",
      data:Object.keys(daily).sort().map(k=>daily[k]),
      borderColor:brandChart.accent,
      backgroundColor:brandChart.alpha(brandChart.accent,.15),
      fill:true,tension:.35
    }]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{ticks:{callback:v=>rupiah(v)}},x:{grid:{display:false}}}}
  });

  const pkgEntries=Object.entries(pkg).sort((a,b)=>b[1]-a[1]);
  packageChart=new Chart(document.getElementById("packageChart"),{
    type:"doughnut",
    data:{labels:pkgEntries.map(x=>x[0]),datasets:[{
      data:pkgEntries.map(x=>x[1]),
      label:"Qty Terjual",
      backgroundColor:pkgEntries.map((_,i)=>brandChart.palette[i%brandChart.palette.length]),
      borderWidth:2,borderColor:"#fff"
    }]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{
      legend:{position:"bottom",labels:{boxWidth:12,font:{size:10}}},
      tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.parsed}x terjual`}}
    }}
  });

  const monthData=monthlyRevenueComparison||{};
  const current=Number(monthData.currentTotal||0);
  const previous=Number(monthData.previousTotal||0);
  const deltaEl=document.getElementById("monthly-revenue-delta");
  const noteEl=document.getElementById("monthly-revenue-note");
  let deltaText="-";
  if(previous>0){
    const pct=((current-previous)/previous)*100;
    deltaText=`${pct>0?"+":""}${pct.toLocaleString("id-ID",{maximumFractionDigits:1})}%`;
  }else if(current>0){
    deltaText="Baru";
  }else{
    deltaText="0%";
  }
  if(deltaEl){
    deltaEl.textContent=deltaText;
    deltaEl.style.color=current>=previous ? "var(--green)" : "var(--danger)";
  }
  if(noteEl){
    noteEl.textContent=`${monthData.currentLabel||"Bulan ini"}: ${rupiah(current)} · ${monthData.previousLabel||"Bulan lalu"}: ${rupiah(previous)}`;
  }

  const monthlyCanvas=document.getElementById("monthlyRevenueChart");
  if(monthlyCanvas){
    monthlyRevenueChart=new Chart(monthlyCanvas,{
      type:"bar",
      data:{
        labels:[monthData.previousLabel||"Bulan Lalu",monthData.currentLabel||"Bulan Ini"],
        datasets:[{
          label:"Omzet",
          data:[previous,current],
          backgroundColor:[brandChart.alpha(brandChart.primary,.72),brandChart.alpha(brandChart.accent,.78)],
          borderColor:[brandChart.primary,brandChart.accent],
          borderWidth:1.5,
          borderRadius:12,
          maxBarThickness:110
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:ctx=>`Omzet: ${rupiah(ctx.parsed.y)}`}}
        },
        scales:{
          y:{beginAtZero:true,ticks:{callback:v=>rupiah(v)}},
          x:{grid:{display:false}}
        }
      }
    });
  }

  const topicEntries=Object.entries(topicCounts).sort((a,b)=>b[1]-a[1]);
  const topicTotal=topicEntries.reduce((sum,[,count])=>sum+Number(count||0),0);
  const topicTotalEl=document.getElementById("topic-selection-total");
  if(topicTotalEl) topicTotalEl.textContent=topicTotal.toLocaleString("id-ID");

  const topicCanvas=document.getElementById("topicChart");
  if(topicCanvas){
    const topicLabels=topicEntries.length?topicEntries.map(x=>x[0]):["Belum ada data"];
    const topicValues=topicEntries.length?topicEntries.map(x=>x[1]):[1];
    topicChart=new Chart(topicCanvas,{
      type:"doughnut",
      data:{
        labels:topicLabels,
        datasets:[{
          data:topicValues,
          backgroundColor:topicEntries.length
            ? topicEntries.map((_,i)=>brandChart.palette[i%brandChart.palette.length])
            : [brandChart.alpha(brandChart.accent,.14)],
          borderWidth:2,
          borderColor:"#fff"
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        cutout:"58%",
        plugins:{
          legend:{
            position:"bottom",
            labels:{boxWidth:12,font:{size:10}}
          },
          tooltip:{
            callbacks:{
              label:ctx=>{
                if(!topicEntries.length)return "Belum ada data";
                const value=Number(ctx.parsed||0);
                const pct=topicTotal>0?(value/topicTotal*100):0;
                return `${ctx.label}: ${value}x (${pct.toLocaleString("id-ID",{maximumFractionDigits:1})}%)`;
              }
            }
          }
        }
      }
    });
  }

  renderPlatformAnalytics();
}

function renderHistory(){
  const body=document.getElementById("tx-table-body");
  const rows=historyTransactions||[];
  if(!rows.length){body.innerHTML=`<tr><td colspan="12" class="empty">Belum ada transaksi untuk filter tanggal ini.</td></tr>`;return;}
  body.innerHTML=rows.map(t=>{
    const items=Array.isArray(t.order_items)&&t.order_items.length?t.order_items:[{name:t.package_code||"-",qty:Number(t.package_qty||1)}];
    const packageText=items.map(x=>`${escapeHtml(x.name||x.code||"-")} × ${Number(x.qty||1)}`).join(", ");
    const topics=Array.isArray(t.order_topics)&&t.order_topics.length?t.order_topics.map(x=>escapeHtml(x.name||x.code||"-")).join(", "):(t.topic_name||"-");
    const addons=Array.isArray(t.order_addons)&&t.order_addons.length?t.order_addons.map(x=>`${escapeHtml(x.name||x.code||"-")} × ${Number(x.qty||1)}`).join(", "):(t.addon_code||"-");
    const qty=items.reduce((sum,x)=>sum+Number(x.qty||1),0);
    const done=(t.reading_status||"done")==="done";
    return `<tr>
      <td>${escapeHtml(t.transaction_date||"-")}</td>
      <td><strong>${escapeHtml(formatReadingStartedAt(t.reading_started_at))}</strong></td>
      <td>${escapeHtml(t.customer_name||"-")}</td>
      <td><div class="reading-status-wrap"><input class="reading-check" type="checkbox" ${done?"checked":""} onchange="toggleReadingStatus('${escapeHtml(t.id)}',this.checked,this)"><span class="reading-status-pill ${done?"done":"progress"}">${done?"Selesai":"On Progress"}</span></div></td>
      <td><span class="badge">${packageText}</span></td><td>${qty}</td><td>${topics}</td><td>${addons}</td>
      <td>${Number(t.tip_amount||0)>0?`<strong>${rupiah(t.tip_amount)}</strong>`:"-"}</td>
      <td><strong>${rupiah(t.total_price)}</strong></td>
      <td>${escapeHtml(t.payment_method||"-")}</td>
      <td><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><button type="button" class="btn btn-light" style="padding:6px 10px;font-size:11px" onclick="openSavedReceipt('${escapeHtml(t.id)}')">Struk</button><button type="button" class="tx-delete-btn" onclick="deleteCancelledTransaction('${escapeHtml(t.id)}','${escapeHtml(String(t.customer_name||"").replace(/'/g,"&#39;"))}','${escapeHtml(t.customer_id||"")}')">Hapus / Cancel</button></div></td>
    </tr>`;
  }).join("");
}

function openSavedReceipt(transactionId){
  const source=[...(historyTransactions||[]),...(transactions||[])];
  const found=source.find(t=>String(t.id)===String(transactionId));
  if(!found){showToast("Data transaksi tidak ditemukan. Coba refresh lalu buka lagi.",true);return;}
  const p={...found};
  if(!Array.isArray(p.order_items)||!p.order_items.length){
    p.order_items=[{name:p.package_code||"Package",qty:Number(p.package_qty||1),subtotal:Number(p.package_price||0)}];
  }
  if(!Array.isArray(p.order_topics)||!p.order_topics.length){
    p.order_topics=String(p.topic_name||"").split(",").map(x=>x.trim()).filter(Boolean).map(name=>({name}));
  }
  if(!Array.isArray(p.order_addons)){p.order_addons=[];}
  if(!p.order_addons.length && p.addon_code){
    p.order_addons=String(p.addon_code).split(",").map(x=>x.trim()).filter(Boolean).map((name,i)=>({name,qty:i===0?Number(p.addon_qty||1):1,subtotal:i===0?Number(p.addon_price||0):0}));
  }
  showReceiptPreview(p);
  const saveBtn=document.getElementById("confirm-save");
  if(saveBtn)saveBtn.style.display="none";
}

async function toggleReadingStatus(transactionId,checked,el){
  if(!transactionId)return;
  const next=checked?"done":"on_progress";
  el.disabled=true;
  try{
    const {error}=await db.from("transactions").update({reading_status:next}).eq("workspace_id",requireWorkspaceId()).eq("id",transactionId);
    if(error)throw error;
    const tx=transactions.find(t=>String(t.id)===String(transactionId));
    if(tx)tx.reading_status=next;
    const historyTx=historyTransactions.find(t=>String(t.id)===String(transactionId));
    if(historyTx)historyTx.reading_status=next;
    showToast(next==="done"?"Reading ditandai selesai.":"Reading dikembalikan ke On Progress.");
    renderHistory();
    await loadCustomerDirectory();
  }catch(err){
    el.checked=!checked;
    showToast("Gagal update status: "+err.message,true);
  }finally{el.disabled=false;}
}

async function deleteCancelledTransaction(transactionId,customerName,customerId){
  if(!transactionId)return;
  const ok=confirm(`Hapus transaksi ${customerName||"customer ini"} karena cancel?\n\nTransaksi akan dihapus dari omzet, profit sharing, kas, grafik, dan riwayat. Tindakan ini tidak bisa dibatalkan.`);
  if(!ok)return;
  try{
    const {error}=await db.from("transactions").delete().eq("workspace_id",requireWorkspaceId()).eq("id",transactionId);
    if(error)throw error;

    // Kalau customer ini tidak punya transaksi lain, bersihkan juga master customer-nya.
    if(customerId){
      const {count,error:countErr}=await db.from("transactions")
        .select("id",{count:"exact",head:true})
        .eq("workspace_id",requireWorkspaceId())
        .eq("customer_id",customerId);
      if(countErr)throw countErr;
      if(Number(count||0)===0){
        const {error:customerErr}=await db.from("customers").delete().eq("workspace_id",requireWorkspaceId()).eq("id",customerId);
        if(customerErr)throw customerErr;
      }
    }

    showToast(`Transaksi ${customerName||""} berhasil dihapus.`);
    await Promise.all([refreshAll(),loadCustomerDirectory()]);
  }catch(err){showToast("Gagal menghapus transaksi: "+err.message,true);}
}

function renderPayouts(){
  const total=payouts.reduce((s,p)=>s+Number(p.amount||0),0);
  const recap={};
  payouts.forEach(p=>{const name=p.partner_name||"-"; recap[name]=(recap[name]||0)+Number(p.amount||0);});
  document.getElementById("payout-recap-total").textContent=rupiah(total);
  document.getElementById("payout-recap-table").innerHTML=Object.entries(recap).sort((a,b)=>b[1]-a[1]).map(([name,amount])=>`<tr><td>${escapeHtml(name)}</td><td><strong>${rupiah(amount)}</strong></td></tr>`).join("") || `<tr><td colspan="2" class="empty">Belum ada pencairan pada periode ini.</td></tr>`;
  document.getElementById("payout-table").innerHTML=payouts.length ? payouts.map(p=>`<tr><td>${escapeHtml(p.payout_date||"-")}</td><td>${escapeHtml(p.partner_name||"-")}</td><td><strong>${rupiah(p.amount)}</strong></td><td>${escapeHtml(p.notes||"-")}</td></tr>`).join("") : `<tr><td colspan="4" class="empty">Belum ada pencairan.</td></tr>`;
}

function renderCashExpenses(){
  document.getElementById("cash-earned").textContent=rupiah(financialSnapshot.cashEarned);
  document.getElementById("cash-injected-total").textContent=rupiah(financialSnapshot.cashInjected);
  const totalCash=financialSnapshot.cashEarned+financialSnapshot.cashInjected;
  document.getElementById("cash-total").textContent=rupiah(totalCash);
  const cashSpentValue=rupiah(financialSnapshot.cashSpent);
  document.getElementById("cash-spent").textContent=cashSpentValue;
  document.getElementById("cash-spent-summary").textContent=cashSpentValue;
  document.getElementById("cash-summary-table").innerHTML=`<tr><td>Kas dari Penjualan</td><td><strong>${rupiah(financialSnapshot.cashEarned)}</strong></td></tr><tr><td>Kas dari Non Penjualan</td><td><strong>${rupiah(financialSnapshot.cashInjected)}</strong></td></tr><tr><td><strong>Total Kas Bisnis</strong></td><td><strong>${rupiah(totalCash)}</strong></td></tr><tr><td><strong>Total Kas Terpakai</strong></td><td><strong>${cashSpentValue}</strong></td></tr><tr><td><strong>Sisa Kas</strong></td><td><strong>${rupiah(financialSnapshot.cashBalance)}</strong></td></tr>`;
  const cashBalanceEl=document.getElementById("cash-balance");
  cashBalanceEl.textContent=rupiah(financialSnapshot.cashBalance);
  cashBalanceEl.style.color=financialSnapshot.cashBalance<0 ? "#c62828" : "";
  const expenseAvailableEl=document.getElementById("cash-expense-available");
  if(expenseAvailableEl){
    expenseAvailableEl.textContent=`Saldo kas tersedia untuk pengeluaran: ${rupiah(Math.max(0,financialSnapshot.cashBalance))}`;
  }
  document.getElementById("cash-expense-table").innerHTML=cashExpenses.length ? cashExpenses.map(e=>`<tr><td>${escapeHtml(e.expense_date||"-")}</td><td>${escapeHtml(e.description||"-")}</td><td><strong>${rupiah(e.amount)}</strong></td></tr>`).join("") : `<tr><td colspan="3" class="empty">Belum ada pengeluaran kas pada periode ini.</td></tr>`;
  document.getElementById("cash-injection-table").innerHTML=cashInjections.length ? cashInjections.map(e=>`<tr><td>${escapeHtml(e.injection_date||"-")}</td><td>${escapeHtml(e.source||"-")}</td><td>${escapeHtml(e.description||"-")}</td><td><strong>${rupiah(e.amount)}</strong></td></tr>`).join("") : `<tr><td colspan="4" class="empty">Belum ada pemasukan kas dari luar pendapatan pada periode ini.</td></tr>`;
}


/* =========================
   CUSTOMER MASTER / REPEAT CUSTOMER
   ========================= */
let customerDirectory=[];
let selectedCustomerId=null;
let customerSort={key:"order_count",direction:"desc"};

function normalizeCustomerName(v){
  return String(v||"").trim().replace(/\s+/g," ").toLowerCase();
}

async function loadCustomerDirectory(){
  try{
    const [{data:customerRows,error:cErr},txRows]=await Promise.all([
      db.from("customers").select("id,display_name,social_name,whatsapp,created_at").eq("workspace_id",requireWorkspaceId()).order("display_name"),
      fetchAllRows(()=>db.from("transactions").select("id,customer_id,customer_name,transaction_date,total_price,platform,order_items,package_code,package_qty,reading_status,reading_started_at").eq("workspace_id",requireWorkspaceId()))
    ]);
    if(cErr) throw cErr;

    const byId={},legacy={};
    (txRows||[]).forEach(t=>{
      const key=t.customer_id ? String(t.customer_id) : normalizeCustomerName(t.customer_name);
      const bucket=t.customer_id ? byId : legacy;
      if(!key)return;
      if(!bucket[key]) bucket[key]={order_count:0,total_spend:0,last_order:null,last_platform:"-",last_status:"done",last_started_at:null,packages:{}};
      const x=bucket[key];
      x.order_count++;
      x.total_spend+=Number(t.total_price||0);
      if(!x.last_order || String(t.transaction_date||"")>x.last_order){
        x.last_order=t.transaction_date||null;
        x.last_platform=t.platform||"-";
        x.last_status=(String(t.package_code||'').toUpperCase()==='SELLER_APP'&&Array.isArray(t.order_items)&&t.order_items[0]?.seller_order_status)?t.order_items[0].seller_order_status:(t.reading_status||"done");
        x.last_started_at=t.reading_started_at||null;
      }
      const items=Array.isArray(t.order_items)&&t.order_items.length?t.order_items:[{name:t.package_code||"-",qty:Number(t.package_qty||1)}];
      items.forEach(item=>{
        const name=item.name||item.code||"-";
        x.packages[name]=(x.packages[name]||0)+Number(item.qty||1);
      });
    });

    customerDirectory=(customerRows||[]).map(c=>{
      const linked=byId[String(c.id)]||{};
      const old=legacy[normalizeCustomerName(c.display_name)]||{};
      const packages={...(old.packages||{})};
      Object.entries(linked.packages||{}).forEach(([k,v])=>packages[k]=(packages[k]||0)+v);
      const favorite=Object.entries(packages).sort((a,b)=>b[1]-a[1])[0];
      const lastLinked=linked.last_order||"";
      const lastOld=old.last_order||"";
      const useLinked=lastLinked>=lastOld;
      return {
        ...c,
        normalized:normalizeCustomerName(c.display_name),
        order_count:Number(linked.order_count||0)+Number(old.order_count||0),
        total_spend:Number(linked.total_spend||0)+Number(old.total_spend||0),
        last_order:lastLinked||lastOld||null,
        last_platform:(useLinked?linked.last_platform:old.last_platform)||"-",
        last_status:(useLinked?linked.last_status:old.last_status)||"done",
        last_started_at:(useLinked?linked.last_started_at:old.last_started_at)||null,
        favorite_package:favorite?favorite[0]:"-"
      };
    });
    renderCustomerDatabase();
  }catch(err){
    console.warn("Customer directory belum tersedia:",err?.message||err);
    customerDirectory=[];
    renderCustomerDatabase();
  }
}

function renderCustomerDatabase(){
  const body=document.getElementById("customer-db-body"); if(!body)return;
  const q=normalizeCustomerName(document.getElementById("customer-db-search")?.value||"");
  const dir=customerSort.direction==="asc"?1:-1;

  const rows=[...customerDirectory].filter(c=>!q||c.normalized.includes(q)).sort((a,b)=>{
    const k=customerSort.key;
    if(k==="order_count"||k==="total_spend"){
      const av=Number(a[k]||0),bv=Number(b[k]||0);
      return av===bv?a.display_name.localeCompare(b.display_name,"id"):(av-bv)*dir;
    }
    if(k==="last_order"){
      const av=String(a.last_order||""),bv=String(b.last_order||"");
      return av===bv?a.display_name.localeCompare(b.display_name,"id"):av.localeCompare(bv)*dir;
    }
    if(k==="platform"){
      const av=String(a.last_platform||"").toLowerCase(),bv=String(b.last_platform||"").toLowerCase();
      return av===bv?a.display_name.localeCompare(b.display_name,"id"):av.localeCompare(bv,"id")*dir;
    }
    return String(a.display_name||"").localeCompare(String(b.display_name||""),"id",{sensitivity:"base"})*dir;
  });

  const repeatCount=customerDirectory.filter(c=>Number(c.order_count||0)>=2).length;
  document.getElementById("customer-db-total").textContent=customerDirectory.length.toLocaleString("id-ID");
  document.getElementById("customer-db-repeat").textContent=repeatCount.toLocaleString("id-ID");

  // Customer Teraktif = order count tertinggi; jika seri, total belanja terbesar jadi tie-breaker.
  const mostActive=[...customerDirectory].sort((a,b)=>{
    const orderDiff=Number(b.order_count||0)-Number(a.order_count||0);
    if(orderDiff)return orderDiff;
    const spendDiff=Number(b.total_spend||0)-Number(a.total_spend||0);
    if(spendDiff)return spendDiff;
    return String(a.display_name||"").localeCompare(String(b.display_name||""),"id",{sensitivity:"base"});
  })[0]||null;
  const activeCard=document.getElementById("customer-db-most-active-card");
  const activeName=document.getElementById("customer-db-most-active-name");
  const activeMeta=document.getElementById("customer-db-most-active-meta");
  if(activeName)activeName.textContent=mostActive?.display_name||"-";
  if(activeMeta)activeMeta.innerHTML=mostActive?`<strong>${Number(mostActive.order_count||0)}x order</strong> · ${rupiah(mostActive.total_spend||0)}`:"Belum ada data customer.";
  if(activeCard){
    activeCard.dataset.customerHistoryId=mostActive?.id||"";
    activeCard.dataset.customerHistoryName=mostActive?.display_name||"";
    activeCard.style.cursor=mostActive?"pointer":"default";
    activeCard.setAttribute("aria-disabled",mostActive?"false":"true");
  }

  document.querySelectorAll(".customer-sort-btn").forEach(btn=>{
    const active=btn.dataset.sort===customerSort.key; btn.classList.toggle("active",active);
    const ar=btn.querySelector(".customer-sort-arrow"); if(ar)ar.textContent=active?(customerSort.direction==="asc"?"↑":"↓"):"↕";
  });

  if(!rows.length){body.innerHTML=`<tr><td colspan="8" class="empty">${q?"Customer tidak ditemukan.":"Belum ada data customer."}</td></tr>`;return;}
  body.innerHTML=rows.map((c,i)=>`
    <tr>
      <td><span class="customer-db-rank">${i+1}</span></td>
      <td><button type="button" class="customer-db-name customer-db-name-btn" data-customer-history-id="${escapeHtml(c.id||'')}" data-customer-history-name="${escapeHtml(c.display_name)}" title="Lihat riwayat order ${escapeHtml(c.display_name)}">${escapeHtml(c.display_name)}</button></td>
      <td>${Number(c.order_count||0)>=2?`<span class="customer-db-repeat">${Number(c.order_count||0)}x order</span>`:`${Number(c.order_count||0)}x`}</td>
      <td><strong>${rupiah(c.total_spend||0)}</strong></td>
      <td>${escapeHtml(c.last_order||"-")}</td>
      <td>${c.last_status==="new"?'<span class="reading-status-pill progress">Baru</span>':c.last_status==="on_progress"?'<span class="reading-status-pill progress">On Progress</span>':'<span class="reading-status-pill done">Selesai</span>'}</td>
      <td>${escapeHtml(c.last_platform||"-")}</td>
      <td>${escapeHtml(c.favorite_package||"-")}</td>
    </tr>`).join("");
}

document.querySelectorAll(".customer-sort-btn").forEach(btn=>btn.addEventListener("click",()=>{
  const key=btn.dataset.sort;if(!key)return;
  if(customerSort.key===key) customerSort.direction=customerSort.direction==="asc"?"desc":"asc";
  else {customerSort.key=key;customerSort.direction=(key==="name"||key==="platform")?"asc":"desc";}
  renderCustomerDatabase();
}));
document.getElementById("customer-db-search")?.addEventListener("input",renderCustomerDatabase);

let customerHistoryBusy=false;
function ensureCustomerHistoryModal(){
  let modal=document.getElementById("customer-history-modal");
  if(modal)return modal;
  modal=document.createElement("div");modal.id="customer-history-modal";
  modal.innerHTML=`<div class="customer-history-backdrop" data-customer-history-close></div><div class="customer-history-card" role="dialog" aria-modal="true" aria-labelledby="customer-history-title"><div class="customer-history-head"><div><div class="customer-history-title" id="customer-history-title">Riwayat Customer</div><div class="customer-history-sub" id="customer-history-sub">Memuat data pembelian...</div></div><button type="button" class="customer-history-close" data-customer-history-close aria-label="Tutup">×</button></div><div id="customer-history-content"><div class="customer-history-empty">Memuat riwayat order...</div></div></div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-customer-history-close]').forEach(el=>el.addEventListener('click',closeCustomerHistory));
  return modal;
}
function closeCustomerHistory(){
  const modal=document.getElementById('customer-history-modal');if(!modal)return;modal.classList.remove('show');
  document.body.style.overflow=document.body.dataset.customerHistoryOverflow||'';delete document.body.dataset.customerHistoryOverflow;
}
function customerHistoryPackageText(t){
  const items=Array.isArray(t.order_items)&&t.order_items.length?t.order_items:[{name:t.package_code||'-',qty:Number(t.package_qty||1)}];
  return items.map(x=>`${escapeHtml(x.name||x.code||'-')} × ${Number(x.qty||1)}`).join('<br>');
}
function customerHistoryTopicText(t){
  return Array.isArray(t.order_topics)&&t.order_topics.length?t.order_topics.map(x=>escapeHtml(x.name||x.code||'-')).join(', '):escapeHtml(t.topic_name||'-');
}
function customerHistoryAddonText(t){
  return Array.isArray(t.order_addons)&&t.order_addons.length?t.order_addons.map(x=>`${escapeHtml(x.name||x.code||'-')} × ${Number(x.qty||1)}`).join(', '):escapeHtml(t.addon_code||'-');
}
async function openCustomerHistory(customerId,customerName){
  if(customerHistoryBusy)return;customerHistoryBusy=true;
  const modal=ensureCustomerHistoryModal(),title=modal.querySelector('#customer-history-title'),sub=modal.querySelector('#customer-history-sub'),content=modal.querySelector('#customer-history-content');
  title.textContent=customerName||'Riwayat Customer';sub.textContent='Memuat seluruh riwayat pembelian...';content.innerHTML='<div class="customer-history-empty">Memuat riwayat order...</div>';
  document.body.dataset.customerHistoryOverflow=document.body.style.overflow||'';document.body.style.overflow='hidden';modal.classList.add('show');
  try{
    const all=await fetchAllRows(()=>db.from('transactions').select('*').eq('workspace_id',requireWorkspaceId()).order('transaction_date',{ascending:false}));
    const normalized=normalizeCustomerName(customerName);const rows=(all||[]).filter(t=>String(t.customer_id||'')===String(customerId||'')||(!t.customer_id&&normalizeCustomerName(t.customer_name)===normalized));
    const total=rows.reduce((sum,t)=>sum+Number(t.total_price||0),0);const last=rows[0]?.transaction_date||'-';const contact=customerDirectory.find(x=>String(x.id||'')===String(customerId||''))||{};
    sub.textContent=`${rows.length} order tercatat • seluruh periode`;
    if(!rows.length){content.innerHTML='<div class="customer-history-empty">Belum ada transaksi yang tercatat untuk customer ini.</div>';return;}
    content.innerHTML=`<div class="customer-contact-card"><div class="customer-contact-item"><span>Media Sosial</span><strong>${escapeHtml(contact.social_name||rows.find(x=>x.social_name)?.social_name||'-')}</strong></div><div class="customer-contact-item"><span>WhatsApp</span><strong>${escapeHtml(contact.whatsapp||rows.find(x=>x.whatsapp)?.whatsapp||'-')}</strong></div></div><div class="customer-history-stats"><div class="customer-history-stat"><span>Total Order</span><strong>${rows.length.toLocaleString('id-ID')}</strong></div><div class="customer-history-stat"><span>Total Belanja</span><strong>${rupiah(total)}</strong></div><div class="customer-history-stat"><span>Order Terakhir</span><strong>${escapeHtml(last)}</strong></div></div><div class="table-wrap"><table class="customer-history-table"><thead><tr><th>Tanggal</th><th>Package</th><th>Topic</th><th>Add-on</th><th>Platform</th><th>Pembayaran</th><th>Status</th><th>Total</th></tr></thead><tbody>${rows.map(t=>{const rawStatus=String((String(t.package_code||'').toUpperCase()==='SELLER_APP'&&Array.isArray(t.order_items)&&t.order_items[0]?.seller_order_status)?t.order_items[0].seller_order_status:(t.reading_status||'done')).toLowerCase(),done=rawStatus==='done',fresh=rawStatus==='new';return `<tr><td>${escapeHtml(t.transaction_date||'-')}</td><td><div class="customer-history-packages">${customerHistoryPackageText(t)}</div></td><td>${customerHistoryTopicText(t)}</td><td>${customerHistoryAddonText(t)}</td><td>${escapeHtml(t.platform||'-')}</td><td>${escapeHtml(t.payment_method||'-')}</td><td><span class="reading-status-pill ${done?'done':'progress'}">${done?'Selesai':fresh?'Baru':'On Progress'}</span></td><td><strong>${rupiah(t.total_price||0)}</strong>${Number(t.tip_amount||0)>0?`<div class="customer-history-meta">Tip ${rupiah(t.tip_amount)}</div>`:''}</td></tr>`}).join('')}</tbody></table></div>`;
  }catch(err){console.error('openCustomerHistory failed',err);sub.textContent='Gagal memuat riwayat';content.innerHTML=`<div class="customer-history-empty">${escapeHtml(err?.message||'Gagal memuat riwayat customer.')}</div>`;}
  finally{customerHistoryBusy=false;}
}
document.getElementById('customer-db-body')?.addEventListener('click',e=>{const btn=e.target.closest('[data-customer-history-id]');if(!btn)return;openCustomerHistory(btn.dataset.customerHistoryId||'',btn.dataset.customerHistoryName||btn.textContent.trim());});
const mostActiveCard=document.getElementById('customer-db-most-active-card');if(mostActiveCard){const openMostActive=()=>{const id=mostActiveCard.dataset.customerHistoryId||'';const name=mostActiveCard.dataset.customerHistoryName||'';if(!id&&!name)return;openCustomerHistory(id,name)};mostActiveCard.addEventListener('click',openMostActive);mostActiveCard.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openMostActive()}});}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('customer-history-modal')?.classList.contains('show'))closeCustomerHistory();});

function getExactCustomer(name){
  const n=normalizeCustomerName(name);
  return customerDirectory.find(c=>c.normalized===n)||null;
}

function renderCustomerMatches(){
  const input=document.getElementById("tx-customer");
  const pop=document.getElementById("customer-match-pop");
  const note=document.getElementById("customer-selected-note");
  if(!input||!pop||!note)return;

  const raw=input.value.trim();
  const q=normalizeCustomerName(raw);
  const exact=getExactCustomer(raw);

  if(selectedCustomerId){
    const selected=customerDirectory.find(c=>String(c.id)===String(selectedCustomerId));
    if(selected && normalizeCustomerName(input.value)===selected.normalized){
      note.textContent=`Customer tersimpan: ${selected.display_name} • ${selected.order_count}x order sebelumnya`;
      note.classList.add("show");
    }else{
      selectedCustomerId=null;
      document.getElementById("tx-customer-id").value="";
      note.classList.remove("show");
      note.textContent="";
    }
  }else{
    note.classList.remove("show");
    note.textContent="";
  }

  if(!q || selectedCustomerId){
    pop.classList.remove("show");
    pop.innerHTML="";
    return;
  }

  let matches=customerDirectory
    .filter(c=>c.normalized.includes(q) || q.includes(c.normalized))
    .sort((a,b)=>{
      const ae=a.normalized===q?1:0, be=b.normalized===q?1:0;
      if(ae!==be)return be-ae;
      return (b.order_count||0)-(a.order_count||0);
    })
    .slice(0,6);

  if(!matches.length){
    pop.classList.remove("show");
    pop.innerHTML="";
    return;
  }

  const title=exact
    ? `Nama "${escapeHtml(raw)}" sudah ada. Ini customer yang sama?`
    : "Customer mirip sudah pernah tersimpan:";

  pop.innerHTML=`<div class="customer-match-title">${title}</div>`+
    matches.map(c=>`
      <button type="button" class="customer-match-item" data-customer-id="${escapeHtml(c.id)}">
        <span class="customer-match-name">${escapeHtml(c.display_name)}</span>
        <span class="customer-match-meta">${Number(c.order_count||0)}x order</span>
      </button>`).join("");

  if(exact){
    pop.innerHTML+=`<div class="customer-duplicate-warning">Kalau ini orang yang berbeda, ubah namanya dulu (contoh: ${escapeHtml(raw)} 2).</div>`;
  }
  pop.classList.add("show");
}

function chooseExistingCustomer(id){
  const c=customerDirectory.find(x=>String(x.id)===String(id));
  if(!c)return;
  selectedCustomerId=c.id;
  document.getElementById("tx-customer-id").value=c.id;
  document.getElementById("tx-customer").value=c.display_name;
  const sn=document.getElementById("tx-social-name");if(sn)sn.value=c.social_name||"";const wa=document.getElementById("tx-whatsapp");if(wa)wa.value=c.whatsapp||"";
  renderCustomerMatches();
}

async function ensureCustomerForPendingTransaction(){
  const name=String(pendingTransactionPayload?.customer_name||"").trim();
  if(!name) throw new Error("Nama customer wajib diisi.");

  if(pendingTransactionPayload.customer_id){
    return pendingTransactionPayload.customer_id;
  }

  const exact=getExactCustomer(name);
  if(exact){
    throw new Error(`Nama "${exact.display_name}" sudah terdaftar. Pilih customer tersebut dari popup atau gunakan nama berbeda.`);
  }

  const {data,error}=await db.from("customers")
    .insert([workspaceInsert({display_name:name,social_name:pendingTransactionPayload?.social_name||null,whatsapp:pendingTransactionPayload?.whatsapp||null})])
    .select("id,display_name,social_name,whatsapp,created_at")
    .single();

  if(error){
    if(String(error.code)==="23505"){
      await loadCustomerDirectory();
      const collision=getExactCustomer(name);
      if(collision){
        throw new Error(`Nama "${collision.display_name}" sudah terdaftar. Pilih customer tersebut dari popup atau gunakan nama berbeda.`);
      }
    }
    throw error;
  }

  customerDirectory.push({
    ...data,
    normalized:normalizeCustomerName(data.display_name),
    order_count:0
  });
  return data.id;
}

document.getElementById("tx-customer")?.addEventListener("input",()=>{
  const hidden=document.getElementById("tx-customer-id");
  if(hidden)hidden.value="";
  selectedCustomerId=null;
  renderCustomerMatches();
});
document.getElementById("tx-customer")?.addEventListener("focus",renderCustomerMatches);

document.getElementById("customer-match-pop")?.addEventListener("click",e=>{
  const item=e.target.closest(".customer-match-item");
  if(item) chooseExistingCustomer(item.dataset.customerId);
});
document.addEventListener("click",e=>{
  if(!e.target.closest(".customer-field-wrap")){
    document.getElementById("customer-match-pop")?.classList.remove("show");
  }
});

/* =========================
   INSERT TRANSACTION
   ========================= */
let pendingTransactionPayload=null;

document.getElementById("tx-form").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const order=calculateTotal();
    if(!order.packages.length) throw new Error("Pilih minimal 1 package.");
    if(!order.topics.length) throw new Error("Pilih minimal 1 topik.");
    const customer=document.getElementById("tx-customer").value.trim();
    if(!customer) throw new Error("Nama customer wajib diisi.");
    const customerId=document.getElementById("tx-customer-id")?.value || null;
    const exactCustomer=getExactCustomer(customer);
    if(exactCustomer && String(exactCustomer.id)!==String(customerId||"")){
      renderCustomerMatches();
      throw new Error(`Nama "${exactCustomer.display_name}" sudah ada. Pilih nama tersebut jika customer yang sama, atau ubah nama jika orangnya berbeda.`);
    }

    pendingTransactionPayload={
      transaction_date:document.getElementById("tx-date").value,
      reading_started_at:new Date().toISOString(),
      reading_status:"on_progress",
      shift_id:currentShift?.id || null,
      customer_name:customer,
      customer_id:customerId,
      platform:document.getElementById("tx-platform").value,
      social_name:document.getElementById("tx-social-name")?.value.trim()||null,
      whatsapp:document.getElementById("tx-whatsapp")?.value.trim()||null,
      package_id:order.packages[0]?.id || null,
      package_code:order.packages.map(x=>x.code).join(", "),
      package_price:order.packages.reduce((s,x)=>s+x.subtotal,0),
      package_qty:order.packages.reduce((s,x)=>s+x.qty,0),
      topic_id:order.topics[0]?.id || null,
      topic_name:order.topics.map(x=>x.name).join(", "),
      addon_id:order.addons[0]?.id || null,
      addon_code:order.addons.map(x=>x.code).join(", ") || null,
      addon_price:order.addons.reduce((s,x)=>s+x.subtotal,0),
      addon_qty:order.addons.reduce((s,x)=>s+x.qty,0),
      order_items:order.packages,
      order_topics:order.topics,
      order_addons:order.addons,
      price_adjustment_type:order.adjustment.type,
      price_adjustment_mode:order.adjustment.mode,
      price_adjustment_value:order.adjustment.value,
      price_adjustment_amount:order.adjustment.amount,
      tip_amount:order.tip,
      total_price:order.total,
      payment_method:document.getElementById("tx-payment").value,
      notes:document.getElementById("tx-notes").value.trim() || null
    };
    const saveBtn=document.getElementById("confirm-save");
    if(saveBtn){saveBtn.style.display="";saveBtn.disabled=false;saveBtn.textContent="✓ Simpan Transaksi";}
    showReceiptPreview(pendingTransactionPayload);
  }catch(err){ showToast(err.message,true); }
});

function showReceiptPreview(p){
  const pkg=p.order_items.map(x=>`<div class="receipt-line"><span>${escapeHtml(x.name)} × ${x.qty}</span><strong>${rupiah(x.subtotal)}</strong></div>`).join("");
  const addon=p.order_addons.length ? `<div style="margin-top:10px"><strong>Add On</strong>${p.order_addons.map(x=>`<div class="receipt-line"><span>${escapeHtml(x.name)} × ${x.qty}</span><strong>${rupiah(x.subtotal)}</strong></div>`).join("")}</div>` : "";
  const adjustment=p.price_adjustment_type && p.price_adjustment_type!=="none" ? `<div class="receipt-line"><span>${p.price_adjustment_type==="discount"?"Diskon":"Kenaikan Harga"} (${p.price_adjustment_mode==="percent"?p.price_adjustment_value+"%":rupiah(p.price_adjustment_value)})</span><strong>${p.price_adjustment_amount<0?"-":"+"}${rupiah(Math.abs(p.price_adjustment_amount))}</strong></div>` : "";
  document.getElementById("receipt-content").innerHTML=`
    <div><strong>Customer:</strong> ${escapeHtml(p.customer_name)}</div>
    <div><strong>Start Reading:</strong> ${escapeHtml(formatReadingStartedAt(p.reading_started_at))}</div>
    <div><strong>Status:</strong> On Progress</div>
    <div><strong>Shift:</strong> ${p.shift_id?"Shift aktif":"Tanpa shift"}</div>
    <div><strong>Platform:</strong> ${escapeHtml(p.platform)}</div>
    <div><strong>Pembayaran:</strong> ${escapeHtml(p.payment_method)}</div>
    <div style="margin-top:12px"><strong>Package</strong>${pkg}</div>
    <div style="margin-top:10px"><strong>Topic</strong><div>${p.order_topics.map(x=>escapeHtml(x.name)).join(", ")}</div></div>
    ${addon}
    <div class="receipt-line" style="margin-top:10px"><span>Subtotal</span><strong>${rupiah(p.order_items.reduce((s,x)=>s+x.subtotal,0)+p.order_addons.reduce((s,x)=>s+x.subtotal,0))}</strong></div>
    ${adjustment}
    ${Number(p.tip_amount||0)>0 ? `<div class="receipt-line"><span>Tip 💖</span><strong>+${rupiah(p.tip_amount)}</strong></div>` : ""}
    <div class="receipt-total">Total <span style="float:right">${rupiah(p.total_price)}</span></div>`;
  const receiptModal=document.getElementById("receipt-modal");
  if(receiptModal.parentElement!==document.body) document.body.appendChild(receiptModal);
  const scrollY=window.scrollY || window.pageYOffset || 0;
  document.body.dataset.receiptScrollY=String(scrollY);
  document.body.style.position="fixed";
  document.body.style.top=`-${scrollY}px`;
  document.body.style.left="0";
  document.body.style.right="0";
  document.body.style.width="100%";
  document.body.style.overflow="hidden";
  receiptModal.style.display="flex";
}
function closeReceiptPreview(){
  const receiptModal=document.getElementById("receipt-modal");
  receiptModal.style.display="none";
  const scrollY=parseInt(document.body.dataset.receiptScrollY||"0",10);
  document.body.style.position="";
  document.body.style.top="";
  document.body.style.left="";
  document.body.style.right="";
  document.body.style.width="";
  document.body.style.overflow="";
  window.scrollTo(0,scrollY);
}
document.getElementById("confirm-save").addEventListener("click",async()=>{
  if(!pendingTransactionPayload) return;
  const btn=document.getElementById("confirm-save"); btn.disabled=true; btn.textContent="Menyimpan...";
  try{
    const ensuredCustomerId=await ensureCustomerForPendingTransaction();
    pendingTransactionPayload.customer_id=ensuredCustomerId;
    if(ensuredCustomerId && (pendingTransactionPayload.social_name||pendingTransactionPayload.whatsapp)){const {error:cu}=await db.from("customers").update({social_name:pendingTransactionPayload.social_name||null,whatsapp:pendingTransactionPayload.whatsapp||null}).eq("workspace_id",requireWorkspaceId()).eq("id",ensuredCustomerId);if(cu)throw cu;}
    const {error}=await db.from("transactions").insert([workspaceInsert(pendingTransactionPayload)]);
    if(error) throw error;

    const savedName=pendingTransactionPayload.customer_name;
    closeReceiptPreview();
    pendingTransactionPayload=null;
    resetTxForm();
    selectedCustomerId=null;
    const hiddenCustomerId=document.getElementById("tx-customer-id");
    if(hiddenCustomerId) hiddenCustomerId.value="";
    showToast(`Penjualan ${savedName} berhasil disimpan.`);
    await Promise.all([refreshAll(),loadCustomerDirectory()]);
  }catch(err){ showToast("Gagal menyimpan: "+err.message,true); }
  finally{btn.disabled=false;btn.textContent="✓ Simpan Transaksi";}
});

/* =========================
   INSERT PAYOUT
   ========================= */
document.getElementById("profit-share-editor-form")?.addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    requireWorkspaceRole(["owner","admin"],"mengubah pembagian omzet");
    if(!profitShareVersionTableReady) throw new Error("Migration profit_share_versions belum diterapkan di Supabase.");
    const effectiveFrom=document.getElementById("profit-share-effective-date")?.value; if(!effectiveFrom) throw new Error("Tanggal dan waktu mulai wajib diisi.");
    const inputs=[...document.querySelectorAll('.profit-share-pct')];
    const rules=inputs.map(i=>({partner_id:i.dataset.partnerId||null,partner_name:i.dataset.partnerName,percentage:Number(i.value||0)/100}));
    const total=rules.reduce((s,r)=>s+r.percentage,0);
    if(rules.some(r=>!Number.isFinite(r.percentage)||r.percentage<0||r.percentage>1)) throw new Error("Persentase harus di antara 0% sampai 100%.");
    if(Math.abs(total-1)>0.00001) throw new Error(`Total pembagian wajib 100%. Sekarang ${(total*100).toLocaleString('id-ID',{maximumFractionDigits:2})}%.`);
    const wid=requireWorkspaceId();
    const payload={workspace_id:wid,effective_from:effectiveFrom,rules,created_by:activeAuthUserId};
    const {error}=await db.from("profit_share_versions").upsert(payload,{onConflict:"workspace_id,effective_from"}); if(error) throw error;
    for(const r of rules){
      if(!r.partner_id) continue;
      const {error:uerr}=await db.from("profit_share_rules").update({percentage:r.percentage}).eq("workspace_id",wid).eq("id",r.partner_id); if(uerr) throw uerr;
    }
    showToast("Pembagian omzet tersimpan dan berlaku sesuai tanggal & waktu.");
    await loadMasters(); await refreshAll();
  }catch(err){console.error(err);showToast(err.message||"Gagal menyimpan pembagian omzet.",true)}
});

document.getElementById("payout-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  const btn=form.querySelector('button[type="submit"]');
  if(btn.disabled) return;
  btn.disabled=true;
  const originalText=btn.textContent;
  btn.textContent="Menyimpan...";

  try{
    const s=document.getElementById("payout-partner");
    const opt=s.options[s.selectedIndex];
    const partnerId=s.value;
    const partnerName=opt?.dataset.name;
    const amount=Number(document.getElementById("payout-amount").value);
    const payoutDate=document.getElementById("payout-date").value;
    const notes=document.getElementById("payout-note").value.trim() || null;

    if(!partnerId || !partnerName) throw new Error("Pilih partner terlebih dahulu.");
    if(!Number.isFinite(amount) || amount<=0) throw new Error("Nominal pencairan harus lebih dari Rp0.");
    if(!Number.isInteger(amount)) throw new Error("Nominal pencairan harus berupa Rupiah bulat tanpa desimal.");
    
    if(!payoutDate) throw new Error("Tanggal pencairan wajib diisi.");

    // Validasi terhadap hak kumulatif partner sampai tanggal pencairan.
    const partner=partners.find(p=>String(p.id)===String(partnerId));
    const pct=shareRuleFor(partner,payoutDate);
    if(!partner || pct<=0) throw new Error("Profit sharing partner tidak ditemukan.");

    const [{data:txData,error:txError},{data:poData,error:poError}]=await Promise.all([
      db.from("transactions").select("total_price,transaction_date,created_at,order_items,order_addons").eq("workspace_id",requireWorkspaceId()).lte("transaction_date",payoutDate),
      db.from("payouts").select("amount").eq("workspace_id",requireWorkspaceId()).eq("partner_id",partnerId).lte("payout_date",payoutDate)
    ]);
    if(txError) throw txError;
    if(poError) throw poError;

    const paidToDate=(poData||[]).reduce((sum,p)=>sum+Number(p.amount||0),0);
    const entitled=Math.max(0,entitlementFromTransactions(txData||[],partner,payoutDate));
    const available=Math.max(0,entitled-paidToDate);

    if(amount>available+0.005){
      throw new Error(`${partnerName} hanya memiliki sisa hak ${rupiah(available)} sampai ${payoutDate}.`);
    }

    const payload={
      partner_id:partnerId,
      partner_name:partnerName,
      amount,
      payout_date:payoutDate,
      notes
    };

    const {error}=await db.from("payouts").insert([workspaceInsert(payload)]);
    if(error) throw error;

    showToast("💸 Pencairan berhasil disimpan.");
    form.reset();
    document.getElementById("payout-date").value=todayISO();
  document.getElementById("cash-expense-date").value=todayISO();
    await refreshAll();
  }catch(err){
    console.error(err);
    showToast("Gagal menyimpan pencairan: "+err.message,true);
  }finally{
    btn.disabled=false;
    btn.textContent=originalText;
  }
});

async function fetchAllRows(makeQuery){
  const PAGE_SIZE=500; let offset=0; const all=[];
  while(true){
    const {data,error}=await makeQuery().range(offset,offset+PAGE_SIZE-1);
    if(error) throw error;
    const batch=data||[]; all.push(...batch);
    if(batch.length<PAGE_SIZE) break;
    offset+=PAGE_SIZE;
  }
  return all;
}

document.getElementById("cash-expense-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  const btn=form.querySelector('button[type="submit"]');
  if(btn.disabled) return;
  const originalText=btn.textContent;
  btn.disabled=true;
  btn.textContent="Menyimpan...";
  try{
    const amount=Number(document.getElementById("cash-expense-amount").value);
    const expenseDate=document.getElementById("cash-expense-date").value;
    const description=document.getElementById("cash-expense-note").value.trim();
    if(!amount || amount<=0) throw new Error("Nominal pengeluaran harus lebih dari Rp0.");
    if(!expenseDate || !description) throw new Error("Tanggal dan keterangan wajib diisi.");
    // Hard stop: pengeluaran kas tidak boleh melebihi kas 5% yang tersedia sampai tanggal pengeluaran.
    const [txData,expenseData,injectionData]=await Promise.all([
      fetchAllRows(()=>db.from("transactions").select("total_price,transaction_date,created_at,order_items,order_addons").eq("workspace_id",requireWorkspaceId()).lte("transaction_date",expenseDate)),
      fetchAllRows(()=>db.from("cash_expenses").select("amount").eq("workspace_id",requireWorkspaceId()).lte("expense_date",expenseDate)),
      fetchAllRows(()=>db.from("cash_injections").select("amount").eq("workspace_id",requireWorkspaceId()).lte("injection_date",expenseDate))
    ]);

    const cashEarnedToDate=cashEntitlementFromTransactions(txData,expenseDate);
    const cashSpentToDate=expenseData.reduce((sum,x)=>sum+Number(x.amount||0),0);
    const cashInjectedToDate=injectionData.reduce((sum,x)=>sum+Number(x.amount||0),0);
    const cashAvailable=Math.max(0,cashEarnedToDate+cashInjectedToDate-cashSpentToDate);

    if(cashAvailable <= 0){
      throw new Error(`Saldo kas tersedia saat ini ${rupiah(cashAvailable)}. Pengeluaran kas tidak dapat dicatat sebelum kas tersedia kembali.`);
    }
    if(amount > cashAvailable + 0.005){
      throw new Error(`Pengeluaran melebihi saldo kas tersedia ${rupiah(cashAvailable)}. Maksimal pengeluaran saat ini: ${rupiah(cashAvailable)}.`);
    }

    const {error}=await db.from("cash_expenses").insert([workspaceInsert({expense_date:expenseDate,amount,description})]);
    if(error) throw error;
    form.reset(); document.getElementById("cash-expense-date").value=todayISO();
    showToast("🏦 Pengeluaran kas berhasil dicatat."); await refreshAll();
  }catch(err){
    console.error("[KAIRO][PettyCash]",err);
    showToast("Gagal mencatat pengeluaran kas: "+(err?.message||"Terjadi kesalahan saat menyimpan."),true);
  }finally{
    btn.disabled=false;
    btn.textContent=originalText;
  }
});

document.getElementById("cash-injection-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  const btn=form.querySelector('button[type="submit"]');
  if(btn.disabled) return;
  btn.disabled=true;
  const originalText=btn.textContent;
  btn.textContent="Menyimpan...";
  try{
    const amount=Number(document.getElementById("cash-injection-amount").value);
    const injectionDate=document.getElementById("cash-injection-date").value;
    const source=document.getElementById("cash-injection-source").value.trim();
    const description=document.getElementById("cash-injection-note").value.trim() || null;
    if(!Number.isFinite(amount) || amount<=0) throw new Error("Nominal pemasukan kas harus lebih dari Rp0.");
    if(!injectionDate || !source) throw new Error("Tanggal dan sumber dana wajib diisi.");
    const {error}=await db.from("cash_injections").insert([workspaceInsert({injection_date:injectionDate,amount,source,description})]);
    if(error) throw error;
    form.reset();
    document.getElementById("cash-injection-date").value=todayISO();
    showToast("💰 Pemasukan kas berhasil dicatat.");
    await refreshAll();
  }catch(err){
    showToast("Gagal mencatat pemasukan kas: "+err.message,true);
  }finally{
    btn.disabled=false;
    btn.textContent=originalText;
  }
});

function resetTxForm(){
  selectedCustomerId=null;
  const hiddenCustomerId=document.getElementById("tx-customer-id");
  if(hiddenCustomerId) hiddenCustomerId.value="";
  const customerPop=document.getElementById("customer-match-pop");
  if(customerPop){customerPop.classList.remove("show");customerPop.innerHTML="";}
  const customerNote=document.getElementById("customer-selected-note");
  if(customerNote){customerNote.classList.remove("show");customerNote.textContent="";}
  document.getElementById("tx-form").reset();
  document.getElementById("tx-date").value=todayISO();
  document.querySelectorAll('.package-check,.topic-check,.addon-check').forEach(c=>c.checked=false);
  document.querySelectorAll('.package-qty,.addon-qty').forEach(q=>{q.value=1;q.disabled=true;});
  document.getElementById("tx-total").textContent="Rp0";
  const at=document.getElementById("tx-adjustment-type"); if(at) at.value="none";
  const am=document.getElementById("tx-adjustment-mode"); if(am) am.value="percent";
  const av=document.getElementById("tx-adjustment-value"); if(av) av.value="0";
  const tip=document.getElementById("tx-tip"); if(tip) tip.value="";
  pendingTransactionPayload=null;
}


function formatReadingStartedAt(value){
  if(!value) return "-";
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit",hour12:false}).format(d).replace(".",":");
}
function readingStatusLabel(status){
  return status==="done" ? "Selesai" : "On Progress";
}

function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

/* =========================
   EXCEL EXPORT — TRINE MAGIC TEMPLATE
   ========================= */
function excelDate(value){
  if(!value) return "";
  const d=new Date(value+"T00:00:00");
  return isNaN(d) ? value : d;
}
function excelMoney(n){ return Number(n||0); }

function setXCell(ws, addr, value, style){
  ws[addr]={v:value,t: typeof value==="number" ? "n" : (value instanceof Date ? "d" : "s"), s:style};
}
function applyRangeBorder(ws, range, border){
  const r=XLSX.utils.decode_range(range);
  for(let R=r.s.r;R<=r.e.r;R++){
    for(let C=r.s.c;C<=r.e.c;C++){
      const addr=XLSX.utils.encode_cell({r:R,c:C});
      ws[addr]=ws[addr]||{v:"",t:"s"};
      ws[addr].s=ws[addr].s||{};
      ws[addr].s.border=border;
    }
  }
}
function styleTable(ws, range, headerRows=[], totalRows=[]){
  const thin={style:"thin",color:{rgb:"B7B7B7"}};
  applyRangeBorder(ws,range,{top:thin,bottom:thin,left:thin,right:thin});
  headerRows.forEach(row=>{
    const rg=XLSX.utils.decode_range(range);
    for(let C=rg.s.c;C<=rg.e.c;C++){
      const addr=XLSX.utils.encode_cell({r:row-1,c:C});
      if(ws[addr]){
        ws[addr].s=Object.assign({},ws[addr].s,{
          font:{name:"Arial",sz:11,bold:true,color:{rgb:"FFFFFF"}},
          alignment:{horizontal:"center",vertical:"center",wrap_text:true}
        });
      }
    }
  });
  totalRows.forEach(row=>{
    const rg=XLSX.utils.decode_range(range);
    for(let C=rg.s.c;C<=rg.e.c;C++){
      const addr=XLSX.utils.encode_cell({r:row-1,c:C});
      if(ws[addr]){
        ws[addr].s=Object.assign({},ws[addr].s,{
          font:{name:"Arial",sz:11,bold:true,color:{rgb:"000000"}},
          fill:{fgColor:{rgb:"E8B9D0"}},
          alignment:{horizontal:"center",vertical:"center"}
        });
      }
    }
  });
}

function exportExcel(){
  if(typeof XLSX==="undefined"){showToast("Library Excel belum termuat. Coba refresh halaman.",true);return;}
  try{
    const wb=XLSX.utils.book_new();
    const header={font:{name:"Arial",sz:11,bold:true,color:{rgb:"FFFFFF"}},fill:{fgColor:{rgb:"4B2354"}},alignment:{horizontal:"center",vertical:"center",wrap_text:true}};
    const cell={font:{name:"Arial",sz:10},alignment:{vertical:"center",wrap_text:true},border:{top:{style:"thin",color:{rgb:"D9D9D9"}},bottom:{style:"thin",color:{rgb:"D9D9D9"}},left:{style:"thin",color:{rgb:"D9D9D9"}},right:{style:"thin",color:{rgb:"D9D9D9"}}}};
    const money=Object.assign({},cell,{numFmt:'"Rp"#,##0'});
    const range=getRange();
    const periodLabel=activePeriod==="today"?"Hari Ini":activePeriod==="7days"?"7 Hari Terakhir":activePeriod==="30days"?"30 Hari Terakhir":"Kustom";

    // SHEET 1 — LAPORAN PENJUALAN
    const rows=[["Tanggal","Nama","Jenis Paket","Qty","Harga","Topic","Add On","Qty","Tip","Metode Pembayaran","Total"]];
    const dataRows=transactions.slice().sort((a,b)=>String(a.transaction_date||"").localeCompare(String(b.transaction_date||"")));
    dataRows.forEach(t=>{
      const pk=(Array.isArray(t.order_items)&&t.order_items.length?t.order_items:[{
        code:t.package_code||"",name:t.package_code||"",qty:Number(t.package_qty||1),unit_price:Number(t.package_price||0),subtotal:Number(t.package_price||0)
      }]);
      const topics=Array.isArray(t.order_topics)&&t.order_topics.length
        ? t.order_topics.map(x=>x.name||x.code||"").filter(Boolean).join(", ")
        : (t.topic_name||"");
      const ad=Array.isArray(t.order_addons)&&t.order_addons.length?t.order_addons:[];
      const addonText=ad.length?ad.map(x=>x.name||x.code||"").filter(Boolean).join(", "):(t.addon_code||"");
      const addonQty=ad.length?ad.reduce((sum,x)=>sum+Number(x.qty||0),0):Number(t.addon_qty||0);
      pk.forEach((x,i)=>rows.push([
        t.transaction_date||"",
        t.customer_name||"",
        x.name||x.code||"",
        Number(x.qty||1),
        Number(x.unit_price||0),
        i===0?topics:"",
        i===0?addonText:"",
        i===0?addonQty:"",
        i===0?Number(t.tip_amount||0):"",
        i===0?(t.payment_method||""):"",
        i===0?Number(t.total_price||0):""
      ]));
    });
    const ws=XLSX.utils.aoa_to_sheet(rows);
    rows[0].forEach((_,i)=>ws[XLSX.utils.encode_cell({r:0,c:i})].s=header);
    for(let r=1;r<rows.length;r++){
      for(let c=0;c<11;c++){const a=XLSX.utils.encode_cell({r,c}); if(ws[a]) ws[a].s=cell;}
      if(ws[`E${r+1}`]) ws[`E${r+1}`].s=money;
      if(ws[`I${r+1}`]) ws[`I${r+1}`].s=money;
      if(ws[`K${r+1}`]) ws[`K${r+1}`].s=money;
    }
    ws["!cols"]=[{wch:13},{wch:22},{wch:28},{wch:8},{wch:15},{wch:30},{wch:28},{wch:8},{wch:15},{wch:20},{wch:16}];
    ws["!freeze"]="A2";
    ws["!autofilter"]={ref:`A1:K${Math.max(1,rows.length)}`};
    XLSX.utils.book_append_sheet(wb,ws,"Laporan");

    // SHEET 2 — PROFIT SHARING
    const revenue=transactions.reduce((sum,t)=>sum+Number(t.total_price||0),0);
    const psRows=[
      ["Periode",periodLabel],
      ["Tanggal",`${range.from} s/d ${range.to}`],
      [],
      ["Nama","Persentase","Hak Periode","Pencairan Periode","Sisa Hak Kumulatif"]
    ];
    partners.filter(partner=>String(partner.partner_name).toLowerCase()!=="kas").forEach(partner=>{
      const pct=shareRuleFor(partner,todayISO());
      const periodRight=entitlementFromTransactions(transactions,partner);
      const partnerPayoutPeriod=payouts.filter(p=>String(p.partner_id||"")===String(partner.id||"")||(!p.partner_id&&String(p.partner_name||"")===String(partner.partner_name||""))).reduce((s,p)=>s+Number(p.amount||0),0);
      const paidToDate=Number(financialSnapshot.payoutByPartner?.[partner.id||partner.partner_name]||0);
      const remaining=Math.max(0,entitlementFromTransactions(financialSnapshot.txAll||[],partner)-paidToDate);
      psRows.push([partner.partner_name, pct, periodRight, partnerPayoutPeriod, remaining]);
    });
    psRows.push(["Kas", cashShareRateForDate(todayISO()), cashEntitlementFromTransactions(transactions), 0, financialSnapshot.cashBalance]);
    psRows.push(["TOTAL ALOKASI","",revenue,"",""]);
    const wpShare=XLSX.utils.aoa_to_sheet(psRows);
    [0,1,3].forEach(r=>{ if(psRows[r]) psRows[r].forEach((_,c)=>{const a=XLSX.utils.encode_cell({r,c});if(wpShare[a])wpShare[a].s=header;});});
    for(let r=4;r<psRows.length;r++) for(let c=0;c<5;c++){const a=XLSX.utils.encode_cell({r,c});if(wpShare[a])wpShare[a].s=cell;}
    for(let r=4;r<psRows.length;r++) for(let c=2;c<=4;c++){const a=XLSX.utils.encode_cell({r,c});if(wpShare[a]&&typeof wpShare[a].v==="number")wpShare[a].s=money;}
    ws["!cols"]=[{wch:22},{wch:14},{wch:18},{wch:20},{wch:22}];
    wpShare["!cols"]=[{wch:22},{wch:14},{wch:18},{wch:20},{wch:22}];
    XLSX.utils.book_append_sheet(wb,wpShare,"Profit Sharing");

    // SHEET 3 — PENCAIRAN
    const payoutRows=[["Tanggal","Nama","Nominal","Catatan"]];
    payouts.slice().sort((a,b)=>String(a.payout_date||"").localeCompare(String(b.payout_date||""))).forEach(p=>payoutRows.push([p.payout_date||"",p.partner_name||"",Number(p.amount||0),p.notes||""]));
    const wp=XLSX.utils.aoa_to_sheet(payoutRows);
    payoutRows[0].forEach((_,i)=>wp[XLSX.utils.encode_cell({r:0,c:i})].s=header);
    for(let r=1;r<payoutRows.length;r++){for(let c=0;c<4;c++){const a=XLSX.utils.encode_cell({r,c});if(wp[a])wp[a].s=cell;}if(wp[`C${r+1}`])wp[`C${r+1}`].s=money;}
    wp["!cols"]=[{wch:14},{wch:20},{wch:16},{wch:30}];wp["!freeze"]="A2";
    XLSX.utils.book_append_sheet(wb,wp,"Pencairan");

    // SHEET 4 — KAS BISNIS
    const cashRows=[["Tanggal","Jenis","Sumber / Keterangan","Nominal"]];
    cashInjections.slice().sort((a,b)=>String(a.injection_date||"").localeCompare(String(b.injection_date||""))).forEach(e=>cashRows.push([e.injection_date||"","Pemasukan Kas",e.source||e.description||"",Number(e.amount||0)]));
    cashExpenses.slice().sort((a,b)=>String(a.expense_date||"").localeCompare(String(b.expense_date||""))).forEach(e=>cashRows.push([e.expense_date||"","Pengeluaran Kas",e.description||"",Number(e.amount||0)]));
    cashRows.push([]);
    cashRows.push(["Kas dari Omzet", "", "", financialSnapshot.cashEarned]);
    cashRows.push(["Pemasukan Kas Luar", "", "", financialSnapshot.cashInjected]);
    cashRows.push(["Total Pengeluaran", "", "", financialSnapshot.cashSpent]);
    cashRows.push(["Saldo Kas", "", "", financialSnapshot.cashBalance]);
    const wc=XLSX.utils.aoa_to_sheet(cashRows);
    cashRows[0].forEach((_,i)=>wc[XLSX.utils.encode_cell({r:0,c:i})].s=header);
    for(let r=1;r<cashRows.length;r++){for(let c=0;c<4;c++){const a=XLSX.utils.encode_cell({r,c});if(wc[a])wc[a].s=cell;}}
    for(let r=1;r<cashRows.length;r++){const a=XLSX.utils.encode_cell({r:r,c:3}); if(wc[a]&&typeof wc[a].v==="number") wc[a].s=money;}
    wc["!cols"]=[{wch:14},{wch:20},{wch:38},{wch:18}]; wc["!freeze"]="A2";
    XLSX.utils.book_append_sheet(wb,wc,"Kas Bisnis");

    const safeFrom=String(range.from||"all").replace(/[^0-9-]/g,"")||"all";
    const safeTo=String(range.to||"all").replace(/[^0-9-]/g,"")||"all";
    XLSX.writeFile(wb,`Trine_Magic_Report_${safeFrom}_to_${safeTo}.xlsx`);
    showToast("📊 Excel berhasil dibuat.");
  }catch(err){console.error(err);showToast("Gagal membuat Excel: "+(err.message||err),true);}
}


/* =========================
   INIT
   ========================= */
async function init(){
  setDefaultDates();
  try{
    await loadMasters();
    await loadCustomerDirectory();
    await refreshAll();
  }catch(e){
    console.error(e);
    document.getElementById("connection-status").textContent="Gagal terhubung";
  { const ls=document.getElementById("landing-connection-status"); if(ls) ls.textContent="Gagal terhubung"; }
    showToast(e.message || "Gagal memuat dashboard",true);
  }
}

document.querySelectorAll(".period-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    setPeriod(btn.dataset.period,btn.dataset.period!=="custom");
  });
});

const logoutButton=document.getElementById("logout-button");
if(logoutButton){
  logoutButton.addEventListener("click",async ()=>{
    if(logoutBusy) return;
    logoutBusy=true;
    logoutButton.disabled=true;
    try{
      stopRealtimeSync();
      await db.auth.signOut({scope:"local"});
    }catch(err){
      console.warn("Logout warning:",err);
    }finally{
      dashboardInitialized=false;
      activeWorkspaceId=null;
      activeWorkspaceRole=null;
      activeAuthUserId=null;
      activeWorkspaceMemberships=[];
      document.body.classList.remove("authenticated");
      document.body.classList.add("auth-locked");
      const u=document.getElementById("login-username");
      const pw=document.getElementById("login-password");
      if(u) u.value="";
      if(pw) pw.value="";
      clearAuthError();
      logoutBusy=false;
      logoutButton.disabled=false;
      setTimeout(()=>u?.focus(),0);
    }
  });
}

document.getElementById("filter-from").addEventListener("change",()=>{
  activePeriod="custom";
  setActivePeriodButton("custom");
  const {from,to}=getPeriodRange("custom");
  if(from && to) refreshAll();
});

document.getElementById("filter-to").addEventListener("change",()=>{
  activePeriod="custom";
  setActivePeriodButton("custom");
  const {from,to}=getPeriodRange("custom");
  if(from && to) refreshAll();
});

document.getElementById("login-form").addEventListener("submit",async (e)=>{
  e.preventDefault();
  const username=document.getElementById("login-username").value.trim();
  const password=document.getElementById("login-password").value;
  if(!username || !password){
    showAuthError("Username dan password wajib diisi.");
    return;
  }
  await loginWithUsername(username,password);
});

const historyFilterSelect=document.getElementById("history-date-filter");
const historyCustomDateInput=document.getElementById("history-custom-date");
if(historyFilterSelect){
  historyFilterSelect.value=historyDateFilter;
  historyFilterSelect.addEventListener("change",async()=>{
    historyDateFilter=historyFilterSelect.value||"all";
    if(historyCustomDateInput) historyCustomDateInput.classList.toggle("show",historyDateFilter==="custom");
    if(historyDateFilter==="custom" && !historyCustomDate){
      historyCustomDate=todayISO();
      if(historyCustomDateInput) historyCustomDateInput.value=historyCustomDate;
    }
    try{await fetchHistoryTransactions();renderHistory();}catch(err){showToast("Gagal memfilter riwayat: "+err.message,true);}
  });
}
if(historyCustomDateInput){
  historyCustomDateInput.value=historyCustomDate;
  historyCustomDateInput.addEventListener("change",async()=>{
    historyCustomDate=historyCustomDateInput.value||"";
    if(historyDateFilter!=="custom"||!historyCustomDate)return;
    try{await fetchHistoryTransactions();renderHistory();}catch(err){showToast("Gagal memfilter riwayat: "+err.message,true);}
  });
}

document.querySelectorAll(".kpi-eye").forEach(btn=>btn.addEventListener("click",toggleKpiVisibility));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!logoutBusy) closeLogoutConfirmation();});
updateKpiEyeButtons();

db.auth.onAuthStateChange((event,session)=>{
  // Password recovery has its own verified-email flow and must not open the dashboard.
  if(event==="PASSWORD_RECOVERY"){ setTimeout(()=>window.__kairoOpenRecoveryComplete?.(session),0); return; }
  // Defer dashboard work so Supabase auth callbacks do not block the auth lock.
  setTimeout(()=>handleAuthSession(session),0);
});

(async function bootstrapAuth(){
  // Every page load starts locked. Login is required again on every access/reload.
  document.body.classList.remove("authenticated");
  document.body.classList.add("auth-locked");
  await handleAuthSession(null);
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  const INACTIVITY_LIMIT=365*24*60*60*1000;
  const WARNING_BEFORE=0;
  let lastActivityAt=Date.now(), warningShown=false, locked=false;

  function modal(show){
    const m=document.getElementById("inactivity-modal");
    if(!m)return;
    m.style.display=show?"flex":"none";
    m.setAttribute("aria-hidden",show?"false":"true");
  }
  function logoutAndLogin(){
    if(locked)return;
    locked=true;
    modal(false);
    try{
      if(typeof supabaseClient!=="undefined" && supabaseClient?.auth) supabaseClient.auth.signOut().catch(()=>{});
      else if(typeof supabase!=="undefined" && supabase?.auth) supabase.auth.signOut().catch(()=>{});
    }catch(e){}
    setTimeout(()=>window.location.reload(),250);
  }
  function activity(){
    if(locked)return;
    lastActivityAt=Date.now();
    if(warningShown){warningShown=false;modal(false);}
  }
  ["pointerdown","keydown","scroll","touchstart","wheel","click"].forEach(e=>{
    window.addEventListener(e,activity,{passive:true});
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible") lastActivityAt=Date.now();
  });
  const b=document.getElementById("inactivity-login-button");
  if(b)b.addEventListener("click",logoutAndLogin);
  setInterval(()=>{
    if(locked||document.visibilityState!=="visible")return;
    const idle=Date.now()-lastActivityAt;
    if(idle>=INACTIVITY_LIMIT){logoutAndLogin();return;}
    if(idle>=INACTIVITY_LIMIT-WARNING_BEFORE&&!warningShown){
      warningShown=true;modal(true);
    }
  },1000);
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  let parsed = null;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const norm = s => String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}@+._\-\s]/gu," ")
    .replace(/\s+/g," ")
    .trim();

  function modal(show){
    const m=$("smart-sales-modal"); if(!m) return;
    if(show && m.parentElement!==document.body) document.body.appendChild(m);
    m.style.display=show?"flex":"none";
    m.setAttribute("aria-hidden",show?"false":"true");
  }

  function parseLabeledForm(raw){
    const lines=raw.replace(/\r/g,"").split("\n");
    const labels=[
      ["customer_name", /^(nama)\s*:/i],
      ["contact", /^(wa|whatsapp|akun threads|akun x|wa\/akun threads\/akun x|contact|kontak)\s*:/i],
      ["package_text", /^(package|paket)\s*:/i],
      ["topic_text", /^(topic|topik)\s*:/i],
      ["question", /^(question|pertanyaan)\s*:/i],
      ["extra", /^(extra|tambahan|add[\s-]?on)\s*:/i],
      ["payment_text", /^(payment|pembayaran|metode pembayaran)\s*:/i],
      ["testimonial_text", /^(apakah berkenan.*testimoni.*)\s*:/i]
    ];
    const out={};
    let currentKey=null;
    for(const original of lines){
      const line=original.trim();
      if(!line) continue;
      let matched=false;
      for(const [key,rx] of labels){
        const mm=line.match(rx);
        if(mm){
          currentKey=key;
          out[key]=line.slice(mm[0].length).trim();
          matched=true;
          break;
        }
      }
      if(!matched && currentKey){
        if(out[currentKey]) out[currentKey]+=" "+line;
        else out[currentKey]=line;
      }
    }
    return out;
  }

  function scoreMatch(query,item,fields){
    const q=norm(query);
    if(!q)return 0;
    let best=0;
    for(const f of fields){
      const v=norm(item?.[f]);
      if(!v)continue;
      if(q===v) best=Math.max(best,100);
      else if(q.includes(v)||v.includes(q)) best=Math.max(best,Math.min(q.length,v.length)+15);
      else{
        const qa=new Set(q.split(" ")), va=new Set(v.split(" "));
        let overlap=0; qa.forEach(x=>{if(va.has(x))overlap++});
        best=Math.max(best,overlap*5);
      }
    }
    return best;
  }

  function bestMasterMatch(query,arr,fields){
    if(!query||!Array.isArray(arr))return null;
    let best=null,bestScore=0;
    for(const item of arr){
      const score=scoreMatch(query,item,fields);
      if(score>bestScore){bestScore=score;best=item;}
    }
    return bestScore>=5?best:null;
  }

  function inferPlatform(contact){
    const raw=String(contact||"").trim();
    const q=norm(raw);
    if(!q)return null;
    const compact=q.replace(/\s+/g,"");
    if(q.includes("threads") || q.includes("thread")) return "Threads";
    if(q.includes("instagram") || /^ig[:\s]/i.test(raw)) return "Instagram";
    if(q.includes("tiktok")) return "TikTok";
    if(q.includes("whatsapp") || /^wa[:\s]/i.test(raw) || /^\+?62\d{7,}$/.test(compact) || /^08\d{7,}$/.test(compact)) return "WhatsApp";
    if(q.includes("twitter") || /^x[:\s]/i.test(raw) || q.includes("akun x")) return "X";
    return "Other";
  }

  function normalizePayment(text){
    const q=norm(text);
    if(!q)return null;
    if(q.includes("qris")) return "QRIS";
    if(q.includes("cash") || q.includes("tunai")) return "CASH";
    if(
      q.includes("transfer") || q.includes("bca") || q.includes("bri") ||
      q.includes("bni") || q.includes("mandiri") || q.includes("seabank") ||
      q.includes("dana") || q.includes("gopay") || q.includes("ovo") ||
      q.includes("shopeepay")
    ) return "TRANSFER";
    return "OTHER";
  }

  function parsePackageQty(text){
    if(!text)return 1;
    const mm=String(text).match(/(?:x|×|qty\s*[:\-]?)\s*(\d+)/i);
    return mm?Math.max(1,Number(mm[1])):1;
  }

  function parseAddonSelections(extra,addons){
    if(!extra||!Array.isArray(addons)||!addons.length)return [];
    const clean=String(extra).trim();
    if(!clean || /^(tidak ada|ga ada|gak ada|nggak ada|none|-|no)$/i.test(clean)) return [];
    const matches=[];
    for(const addon of addons){
      const score=scoreMatch(clean,addon,["code","name"]);
      if(score>=5){
        let qty=1;
        const code=String(addon.code||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        const name=String(addon.name||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        const qtyRegex=new RegExp(`(?:${code}|${name})[^\\n,;]*?(?:x|×|qty\\s*[:\\-]?)\\s*(\\d+)`,"i");
        const mm=clean.match(qtyRegex);
        if(mm) qty=Math.max(1,Number(mm[1]));
        matches.push({id:addon.id,code:addon.code,name:addon.name,qty});
      }
    }
    return matches;
  }

  function matchTopicSmart(text, topics){
    if(!text || !Array.isArray(topics)) return null;

    // 1) Exact/direct match to an active dashboard topic always wins.
    const direct=bestMasterMatch(text,topics,["name"]);
    if(direct && norm(direct.name)===norm(text)) return direct;

    const q=norm(text);

    // 2) Weighted intent scoring.
    // Important: words that can merely describe WHO is being asked about
    // (pacar, pasangan, mantan, teman, keluarga) get low weight by themselves.
    // Strong topic-intent words get much higher weight.
    const groups={
      "love life":{
        strong:["percintaan","asmara","hubungan cinta","hubungan percintaan","relationship","romance","romantic","jodoh","selingkuh","putus","balikan","perasaan cinta","cinta"],
        weak:["pacar","pasangan","gebetan","mantan","ex"]
      },
      "career":{
        strong:["karir","karier","pekerjaan","kerja","job","work","profesi","kantor","promosi","jabatan","kenaikan jabatan","resign","interview","lowongan"],
        weak:[]
      },
      "finance":{
        strong:["keuangan","finansial","uang","rezeki","rejeki","penghasilan","income","financial","money","gaji","hutang","utang","tabungan"],
        weak:[]
      },
      "family":{
        strong:["keluarga","hubungan keluarga","masalah keluarga","orang tua","ortu"],
        weak:["ayah","ibu","saudara","kakak","adik"]
      },
      "friendship":{
        strong:["pertemanan","persahabatan","hubungan pertemanan","hubungan persahabatan","friendship"],
        weak:["teman","sahabat","friend","friends"]
      },
      "other":{
        strong:["other","lainnya","lain lain","lain-lain","uncategorized","tidak terkategori","topik lain"],
        weak:[]
      }
    };

    function containsPhrase(phrase){
      const p=norm(phrase);
      if(!p) return false;
      if(q===p) return true;
      // Word-boundary-ish check that works for normalized Indonesian/English phrases.
      return (` ${q} `).includes(` ${p} `) || q.includes(p);
    }

    const scores={};
    for(const [topicName,dict] of Object.entries(groups)){
      let score=0;

      // Strong intent word = 10 points.
      for(const w of dict.strong){
        if(containsPhrase(w)) score+=10;
      }

      // Weak entity/reference word = only 2 points.
      for(const w of dict.weak){
        if(containsPhrase(w)) score+=2;
      }

      scores[topicName]=score;
    }

    // 3) If the exact master label appears in text, give it a strong boost.
    for(const t of topics){
      const tn=norm(t?.name);
      if(tn && (q===tn || (` ${q} `).includes(` ${tn} `))) {
        scores[tn]=(scores[tn]||0)+20;
      }
    }

    // Highest score wins. Require enough intent confidence.
    let winner=null, best=-1, second=-1;
    for(const [name,score] of Object.entries(scores)){
      if(score>best){
        second=best;
        best=score;
        winner=name;
      }else if(score>second){
        second=score;
      }
    }

    // Need at least one strong intent signal (>=10).
    // If two categories are equally strong, don't guess.
    if(best<10 || best===second) return null;

    return topics.find(t=>{
      const n=norm(t?.name);
      const target=norm(winner);
      return n===target || n.includes(target) || target.includes(n);
    }) || null;
  }

  function smartParse(raw){
    const f=parseLabeledForm(raw);
    const masters=window.trineMasters||{packages:[],addons:[],topics:[]};
    const warnings=[];
    const pkg=bestMasterMatch(f.package_text,masters.packages||[],["code","name"]);
    const topic=matchTopicSmart(f.topic_text,masters.topics||[]);
    const addons=parseAddonSelections(f.extra,masters.addons||[]);
    const platform=inferPlatform(f.contact);
    const payment=normalizePayment(f.payment_text);

    if(f.package_text && !pkg) warnings.push("Package belum cocok dengan master aktif. Pilih manual.");
    if(f.topic_text && !topic) warnings.push("Topic belum cocok dengan master aktif. Pilih manual.");
    if(f.extra && !addons.length && !/^(tidak ada|ga ada|gak ada|nggak ada|none|-|no)$/i.test(f.extra.trim()))
      warnings.push("Extra terisi tetapi belum cocok dengan Add On aktif. Cek Add On manual.");
    if(!f.customer_name) warnings.push("Nama customer belum terbaca.");
    if(!f.payment_text) warnings.push("Metode pembayaran belum terbaca.");
    if(f.contact && platform==="Other" && String(f.contact).trim().startsWith("@"))
      warnings.push("Akun hanya berupa @username, jadi platform tidak bisa dipastikan. Pilih Platform manual.");

    return {
      customer_name:f.customer_name||"",
      platform,
      package_id:pkg?.id||null,
      package_code:pkg?.code||null,
      package_name:pkg?.name||f.package_text||"",
      package_qty:parsePackageQty(f.package_text),
      topic_id:topic?.id||null,
      topic:topic?.name||f.topic_text||"",
      addons,
      payment,
      warnings
    };
  }

  function render(d){
    const warns=Array.isArray(d.warnings)?d.warnings:[];
    const addonText=d.addons?.length
      ? d.addons.map(a=>`${esc(a.name||a.code)} × ${esc(a.qty)}`).join(", ")
      : "-";
    $("smart-sales-preview").innerHTML=`
      <div>
        <b>Nama Customer:</b> ${esc(d.customer_name||"-")}<br>
        <b>Platform Media Sosial:</b> ${esc(d.platform||"-")}<br>
        <b>Package:</b> ${esc(d.package_code||d.package_name||"-")} × ${esc(d.package_qty||1)}<br>
        <b>Topic:</b> ${esc(d.topic||"-")}<br>
        <b>Add On:</b> ${addonText}<br>
        <b>Metode Pembayaran:</b> ${esc(d.payment||"-")}
      </div>
      ${warns.length
        ? `<div style="margin-top:12px"><b>Cek dulu:</b><br>${warns.map(esc).join("<br>")}</div>`
        : "<div style='margin-top:12px'>Semua kategori yang dipakai berhasil dibaca.</div>"
      }
    `;
    $("smart-sales-preview").style.display="block";
    $("smart-sales-apply").style.display="inline-flex";
  }

  function parseClick(){
    const raw=$("smart-sales-text").value.trim();
    if(!raw){$("smart-sales-status").textContent="Paste form customer dulu.";return;}
    parsed=smartParse(raw);
    render(parsed);
    $("smart-sales-status").textContent="Selesai. Cek preview lalu klik Gunakan Data Ini.";
  }

  function selectExactValue(id,value){
    const s=$(id);
    if(!s||!value)return false;
    const opt=[...s.options].find(o=>String(o.value)===String(value));
    if(!opt)return false;
    s.value=opt.value;
    s.dispatchEvent(new Event("change",{bubbles:true}));
    return true;
  }

  function apply(){
    const d=parsed;
    if(!d)return;

    if($("tx-customer")) $("tx-customer").value=d.customer_name||"";
    if(d.platform) selectExactValue("tx-platform",d.platform);
    if(d.payment) selectExactValue("tx-payment",d.payment);

    document.querySelectorAll(".package-check").forEach(c=>{
      c.checked=false;
      const q=document.querySelector(`.package-qty[data-id="${CSS.escape(String(c.dataset.id))}"]`);
      if(q){q.disabled=true;q.value=1;}
    });
    if(d.package_id){
      const c=[...document.querySelectorAll(".package-check")].find(x=>String(x.dataset.id)===String(d.package_id));
      if(c){
        c.checked=true;
        const q=document.querySelector(`.package-qty[data-id="${CSS.escape(String(c.dataset.id))}"]`);
        if(q){q.disabled=false;q.value=Math.max(1,Number(d.package_qty||1));}
      }
    }

    document.querySelectorAll(".topic-check").forEach(c=>c.checked=false);
    if(d.topic_id){
      const c=[...document.querySelectorAll(".topic-check")].find(x=>String(x.dataset.id)===String(d.topic_id));
      if(c)c.checked=true;
    }

    document.querySelectorAll(".addon-check").forEach(c=>{
      c.checked=false;
      const q=document.querySelector(`.addon-qty[data-id="${CSS.escape(String(c.dataset.id))}"]`);
      if(q){q.disabled=true;q.value=1;}
    });
    for(const addon of (d.addons||[])){
      const c=[...document.querySelectorAll(".addon-check")].find(x=>String(x.dataset.id)===String(addon.id));
      if(c){
        c.checked=true;
        const q=document.querySelector(`.addon-qty[data-id="${CSS.escape(String(c.dataset.id))}"]`);
        if(q){q.disabled=false;q.value=Math.max(1,Number(addon.qty||1));}
      }
    }

    try{calculateTotal();}catch(e){}

    // Reset AUTOFILL FORM after its data has been applied to the sales form.
    // This only clears the Autofill helper; the populated sales form stays intact.
    parsed=null;
    if($("smart-sales-text")) $("smart-sales-text").value="";
    if($("smart-sales-status")) $("smart-sales-status").textContent="";
    if($("smart-sales-preview")){
      $("smart-sales-preview").innerHTML="";
      $("smart-sales-preview").style.display="none";
    }
    if($("smart-sales-apply")) $("smart-sales-apply").style.display="none";

    modal(false);
  }

  document.addEventListener("click",e=>{
    if(e.target.closest("#smart-sales-open")) modal(true);
    if(e.target.closest("#smart-sales-close")) modal(false);
    if(e.target.closest("#smart-sales-parse")) parseClick();
    if(e.target.closest("#smart-sales-apply")) apply();
  });
})();

document.getElementById("landing-logout-button")?.addEventListener("click",()=>document.getElementById("logout-button")?.click());


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  const SELECT_IDS=[
    "tx-platform",
    "tx-payment",
    "tx-adjustment-type",
    "tx-adjustment-mode",
    "payout-partner"
  ];

  function esc(v){
    return String(v??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function closeAll(except){
    document.querySelectorAll(".sh-select-wrap.open").forEach(w=>{
      if(w!==except) w.classList.remove("open");
    });
  }

  function build(select){
    if(!select || select.dataset.shadcnReady==="1") return;

    select.dataset.shadcnReady="1";
    select.classList.add("sh-select-native");

    const wrap=document.createElement("div");
    wrap.className="sh-select-wrap";
    select.parentNode.insertBefore(wrap,select);
    wrap.appendChild(select);

    const trigger=document.createElement("button");
    trigger.type="button";
    trigger.className="sh-select-trigger";
    trigger.setAttribute("aria-haspopup","listbox");
    trigger.setAttribute("aria-expanded","false");

    const label=document.createElement("span");
    label.className="sh-select-label";

    const chevron=document.createElement("span");
    chevron.innerHTML='<svg class="sh-select-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    trigger.appendChild(label);
    trigger.appendChild(chevron);

    const menu=document.createElement("div");
    menu.className="sh-select-menu";
    menu.setAttribute("role","listbox");

    wrap.appendChild(trigger);
    wrap.appendChild(menu);

    function render(){
      const options=[...select.options];
      menu.innerHTML=options.map((opt,i)=>{
        const selected=String(opt.value)===String(select.value);
        return `<button type="button" class="sh-select-option${selected?" selected":""}" role="option" aria-selected="${selected}" data-value="${esc(opt.value)}" data-index="${i}">
          <span>${esc(opt.textContent.trim())}</span>
          <svg class="sh-select-check" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>`;
      }).join("");

      const selected=select.options[select.selectedIndex];
      label.textContent=selected ? selected.textContent.trim() : "Pilih";
      const isPlaceholder=!select.value;
      trigger.classList.toggle("placeholder",isPlaceholder);
    }

    trigger.addEventListener("click",()=>{
      const willOpen=!wrap.classList.contains("open");
      closeAll(wrap);
      wrap.classList.toggle("open",willOpen);
      trigger.setAttribute("aria-expanded",willOpen?"true":"false");
    });

    menu.addEventListener("click",e=>{
      const option=e.target.closest(".sh-select-option");
      if(!option) return;
      const index=Number(option.dataset.index);
      if(!Number.isInteger(index) || !select.options[index]) return;
      select.selectedIndex=index;
      select.dispatchEvent(new Event("change",{bubbles:true}));
      render();
      wrap.classList.remove("open");
      trigger.setAttribute("aria-expanded","false");
      trigger.focus();
    });

    select.addEventListener("change",render);

    const observer=new MutationObserver(()=>render());
    observer.observe(select,{childList:true,subtree:true,attributes:true});

    render();
  }

  function init(){
    SELECT_IDS.forEach(id=>build(document.getElementById(id)));
  }

  document.addEventListener("click",e=>{
    if(!e.target.closest(".sh-select-wrap")) closeAll();
  });

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){
      closeAll();
      document.querySelectorAll(".sh-select-trigger[aria-expanded='true']").forEach(b=>{
        b.setAttribute("aria-expanded","false");
      });
    }
  });

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
  else init();

  // payout partner options are refreshed dynamically from Supabase; retry after master loading.
  setTimeout(init,500);
  setTimeout(init,1500);
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


/* V20.3.5: hydrate visible SaaS state without changing existing business flow */
(function(){
  function pick(obj, keys){ for(const k of keys){ if(obj && obj[k] != null) return obj[k]; } }
  function txt(id,v){ const el=document.getElementById(id); if(el && v!=null && String(v).trim()) el.textContent=String(v); }
  function hydrate(){
    try{
      const ws = window.activeWorkspace || window.currentWorkspace || window.workspaceState || null;
      const role = window.activeWorkspaceRole || window.currentWorkspaceRole || window.workspaceRole || pick(ws,['role']);
      const sub = window.activeWorkspaceSubscription || window.currentSubscription || window.workspaceSubscription || null;
      const plan = window.activeWorkspacePlan || window.currentPlan || pick(sub,['plan','plan_code','tier']);
      const name = pick(ws,['name','business_name','workspace_name']);
      if(name) txt('saas-workspace-pill', name);
      if(plan) txt('saas-plan-pill', String(plan).toUpperCase());
      if(role) txt('saas-role-pill', String(role).toUpperCase());
      const settingsBtn=document.getElementById('saas-settings-btn');
      if(settingsBtn){
        const can = (typeof window.canManageSettings==='function') ? !!window.canManageSettings() : String(role||'').toLowerCase()!=='staff';
        settingsBtn.style.display = can ? '' : 'none';
        settingsBtn.onclick=function(){
          if(typeof window.openWorkspaceSettings==='function') return window.openWorkspaceSettings();
          const target=document.querySelector('[data-section="settings"],#settings,.settings-section');
          if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
          else if(typeof window.showToast==='function') window.showToast('Workspace Settings akan aktif di tahap UI berikutnya.');
          else alert('Workspace Settings akan aktif di tahap UI berikutnya.');
        };
      }
    }catch(e){ console.warn('SaaS UI hydrate skipped:', e); }
  }
  document.addEventListener('DOMContentLoaded', hydrate);
  window.addEventListener('trine:workspace-ready', hydrate);
  setTimeout(hydrate, 800);
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  const iconMap={
    dashboard:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9 20v-6h6v6"/></svg>`,
    promo:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5V5a1 1 0 0 1 1-1h6.5L20 12.5 12.5 20 4 11.5Z"/><circle cx="8" cy="8" r="1.2"/></svg>`,
    performance:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/><path d="M2 19h20"/></svg>`,
    cash:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5h16a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2z"/><path d="M3 8V6a2 2 0 0 1 2-2h13"/><path d="M16 13h5"/><circle cx="16" cy="13" r=".8"/></svg>`,
    payout:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5"/><path d="M10 5h9v9"/><path d="M5 7v12h12"/></svg>`,
    input:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/><path d="M16 15v4M14 17h4"/></svg>`,
    customers:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.5 2.5-5.5 5.5-5.5s5 2 5.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5c2.8-.2 4.7 1.4 5 4.5"/></svg>`,
    settings:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05-2.78 2.78-.05-.05A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1.1 1.64V21H10v-.06A1.8 1.8 0 0 0 8.9 19.3a1.8 1.8 0 0 0-1.98.36l-.05.05-2.78-2.78.05-.05A1.8 1.8 0 0 0 4.5 15a1.8 1.8 0 0 0-1.64-1.1H2.8V10h.06A1.8 1.8 0 0 0 4.5 8.9a1.8 1.8 0 0 0-.36-1.98l-.05-.05 2.78-2.78.05.05A1.8 1.8 0 0 0 8.9 4.5 1.8 1.8 0 0 0 10 2.86V2.8h3.9v.06A1.8 1.8 0 0 0 15 4.5a1.8 1.8 0 0 0 1.98-.36l.05-.05 2.78 2.78-.05.05A1.8 1.8 0 0 0 19.4 8.9 1.8 1.8 0 0 0 21.04 10h.06v3.9h-.06A1.8 1.8 0 0 0 19.4 15Z"/></svg>`
  };
  const labelMap={dashboard:'Dashboard',input:'Orders',promo:'Promo',performance:'Performance',customers:'Customer Database',payout:'Withdraw',cash:'Petty Cash',settings:'Settings'};
  const SIDEBAR_KEY='trine_saas_sidebar_collapsed_v1';
  const DEFAULT_PRIMARY='#22C7B8',DEFAULT_ACCENT='#D9A441';
  let savedBrandingSnapshot=null;

  function validHex(v){return /^#[0-9A-Fa-f]{6}$/.test(String(v||''));}
  function safeColor(v,fallback){return validHex(v)?v:fallback;}
  function setBrandVars(primary,accent){
    const root=document.documentElement;
    root.style.setProperty('--brand-primary',safeColor(primary,DEFAULT_PRIMARY));
    root.style.setProperty('--brand-accent',safeColor(accent,DEFAULT_ACCENT));
    root.style.setProperty('--green',safeColor(primary,DEFAULT_PRIMARY));
    root.style.setProperty('--pink',safeColor(accent,DEFAULT_ACCENT));
  }
  function applyWorkspaceBrandingV204(branding){
    const b=branding||{}; savedBrandingSnapshot={...b};
    setBrandVars(b.primary_color,b.accent_color);
    document.querySelectorAll('.brand-logo,.saas-side-brand img,.saas-brand-preview-logo').forEach(img=>{
      if(!img.dataset.defaultSrc) img.dataset.defaultSrc=img.getAttribute('src')||'';
      img.src=b.logo_url||img.dataset.defaultSrc;
    });
    const sideName=document.getElementById('saas-side-workspace-name');if(sideName)sideName.textContent=activeWorkspaceName||'Workspace';
    const previewName=document.getElementById('saas-preview-name');if(previewName)previewName.textContent=activeWorkspaceName||'Workspace';
  }
  window.applyWorkspaceBrandingV204=applyWorkspaceBrandingV204;

  function buildSidebar(){
    const app=document.querySelector('.app-shell#app-shell'); if(!app||document.getElementById('saas-sidebar')) return;
    const existingNav=app.querySelector('.v19-nav');
    const oldWsSelect=document.getElementById('saas-workspace-switcher');
    const side=document.createElement('aside');side.id='saas-sidebar';
    side.innerHTML=`<div class="saas-side-brand" id="saas-side-home"><img class="brand-logo" alt="Logo workspace"><div class="saas-side-brand-copy"><strong id="saas-side-workspace-name">${escapeHtml(typeof activeWorkspaceName!=='undefined'?activeWorkspaceName:'Trine Magic')}</strong><small>Business Dashboard</small></div></div><nav class="saas-sidebar-nav" aria-label="Navigasi dashboard"></nav><div class="saas-side-spacer"></div><div class="saas-side-meta"><div class="saas-side-meta-top"><span class="saas-side-dot"></span><div class="saas-side-meta-copy"><strong id="saas-side-role-plan">Workspace aktif</strong><small id="saas-side-status">Masa berlaku: —</small></div></div><select id="saas-workspace-select-side" class="saas-workspace-select-side" style="display:none"></select></div><button id="saas-collapse-btn" class="saas-collapse-btn" type="button" title="Minimize sidebar">‹</button>`;
    document.body.appendChild(side);
    const sideNav=side.querySelector('.saas-sidebar-nav');
    if(existingNav){
      existingNav.querySelectorAll('.tab[data-tab]').forEach(btn=>{
        const tab=btn.dataset.tab; btn.innerHTML=`<span class="saas-nav-icon">${iconMap[tab]||'•'}</span><span class="saas-nav-label">${labelMap[tab]||tab}</span>`; sideNav.appendChild(btn);
      });
    }
    const settingsBtn=document.getElementById('saas-settings-btn');
    if(settingsBtn){settingsBtn.style.display='none';const b=document.createElement('button');b.type='button';b.id='saas-settings-side-btn';b.className='saas-settings-side-btn';b.innerHTML=`<span class="saas-nav-icon">${iconMap.settings}</span><span class="saas-nav-label">Settings</span>`;b.addEventListener('click',()=>settingsBtn.click());sideNav.appendChild(b);}
    const originalLogo=app.querySelector('.header .brand-logo'); const sideLogo=side.querySelector('.brand-logo'); if(originalLogo&&sideLogo){sideLogo.src=originalLogo.src;sideLogo.dataset.defaultSrc=originalLogo.src;}
    side.querySelector('#saas-side-home')?.addEventListener('click',()=>document.querySelector('.tab[data-tab="dashboard"]')?.click());
    const collapse=side.querySelector('#saas-collapse-btn');
    const setCollapsed=(yes)=>{document.body.classList.toggle('saas-sidebar-collapsed',yes);collapse.textContent=yes?'›':'‹';collapse.title=yes?'Expand sidebar':'Minimize sidebar';localStorage.setItem(SIDEBAR_KEY,yes?'1':'0')};
    collapse.addEventListener('click',()=>setCollapsed(!document.body.classList.contains('saas-sidebar-collapsed')));setCollapsed(localStorage.getItem(SIDEBAR_KEY)==='1');
    if(oldWsSelect){
      const sideSel=side.querySelector('#saas-workspace-select-side');
      const sync=()=>{sideSel.innerHTML=oldWsSelect.innerHTML;sideSel.value=oldWsSelect.value;sideSel.style.display=oldWsSelect.options.length>1?'':'none'};
      sync(); new MutationObserver(sync).observe(oldWsSelect,{childList:true,subtree:true,attributes:true});
      sideSel.addEventListener('change',()=>{oldWsSelect.value=sideSel.value;oldWsSelect.dispatchEvent(new Event('change',{bubbles:true}))});
    }
    buildMobileNav(); syncNavState();
  }
  function buildMobileNav(){
    if(document.getElementById('saas-mobile-bottom')) return; const bar=document.createElement('nav');bar.id='saas-mobile-bottom';bar.setAttribute('aria-label','Navigasi mobile');
    ['dashboard','input','promo','performance','customers','payout','cash','settings'].forEach(tab=>{const b=document.createElement('button');b.type='button';b.className='saas-mobile-nav-btn';b.dataset.mobileTab=tab;b.innerHTML=`<span>${iconMap[tab]}</span><span>${labelMap[tab]}</span>`;b.addEventListener('click',()=>{if(tab==='settings')document.getElementById('saas-settings-btn')?.click();else document.querySelector(`#saas-sidebar .tab[data-tab="${tab}"],.v19-nav .tab[data-tab="${tab}"]`)?.click();setTimeout(syncNavState,20)});bar.appendChild(b)});document.body.appendChild(bar);
  }
  function syncNavState(){
    const active=document.querySelector('.section.active')?.id||'dashboard';document.querySelectorAll('.saas-mobile-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.mobileTab===active));
    const sb=document.getElementById('saas-settings-side-btn');if(sb)sb.classList.toggle('active',active==='settings');
    document.querySelectorAll('#saas-sidebar .tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===active));
  }
  function addBrandPreview(){
    const form=document.getElementById('workspace-settings-form');if(!form||document.getElementById('saas-brand-preview'))return;
    const preview=document.createElement('div');preview.id='saas-brand-preview';preview.className='saas-brand-preview full';preview.innerHTML=`<div class="saas-brand-preview-head"><img class="saas-brand-preview-logo" alt="Preview logo"><div><div id="saas-preview-name" class="saas-brand-preview-name">Workspace</div><div class="saas-brand-preview-sub">Preview branding workspace <span class="saas-brand-preview-accent"></span></div></div></div><span class="saas-brand-preview-btn">Contoh tombol</span>`;
    const actions=form.querySelector('.actions');form.insertBefore(preview,actions||null);
  }
  function wireBrandingPreview(){
    const pc=document.getElementById('settings-primary-color'),pt=document.getElementById('settings-primary-text'),ac=document.getElementById('settings-accent-color'),at=document.getElementById('settings-accent-text'),logo=document.getElementById('settings-logo-url'),name=document.getElementById('settings-workspace-name');
    if(!pc||pc.dataset.v204wired)return;pc.dataset.v204wired='1';
    const update=()=>{const p=safeColor(pt.value,DEFAULT_PRIMARY),a=safeColor(at.value,DEFAULT_ACCENT);pc.value=p;ac.value=a;setBrandVars(p,a);const pv=document.querySelector('.saas-brand-preview-logo');if(pv&&logo.value.trim())pv.src=logo.value.trim();const pn=document.getElementById('saas-preview-name');if(pn)pn.textContent=name.value.trim()||activeWorkspaceName||'Workspace';};
    pc.addEventListener('input',()=>{pt.value=pc.value.toUpperCase();update()});ac.addEventListener('input',()=>{at.value=ac.value.toUpperCase();update()});pt.addEventListener('input',update);at.addEventListener('input',update);logo?.addEventListener('input',update);name?.addEventListener('input',update);
    formCancelOnEscape();
  }
  function formCancelOnEscape(){document.getElementById('workspace-settings-form')?.addEventListener('keydown',e=>{if(e.key==='Escape'){applyWorkspaceBrandingV204(savedBrandingSnapshot||activeWorkspaceBranding);hydrateSaasUi();}})}

  // Extend existing UI hydrator without replacing its backend behavior.
  if(typeof hydrateSaasUi==='function'){
    const originalHydrate=hydrateSaasUi;
    hydrateSaasUi=function(){const r=originalHydrate.apply(this,arguments);setTimeout(()=>{addBrandPreview();wireBrandingPreview();applyWorkspaceBrandingV204(activeWorkspaceBranding);const rp=document.getElementById('saas-side-role-plan');if(rp)rp.textContent=`${String(activeWorkspaceRole||'-').toUpperCase()} · ${String(activeWorkspacePlan||'basic').toUpperCase()}`;const st=document.getElementById('saas-side-status');if(st){if(isTrineMagicWorkspace()){st.textContent='Masa berlaku: Unlimited';}else{const raw=activeWorkspaceSubscription?.current_period_end||activeWorkspaceSubscription?.expires_at||activeWorkspaceSubscription?.end_date||activeWorkspaceSubscription?.valid_until||activeWorkspaceSubscription?.trial_ends_at;st.textContent=raw?`Masa berlaku: ${new Date(raw).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}`:'Masa berlaku: Belum ditentukan';}}ensureKairoAppSwitcher();syncNavState();},0);return r;};
  }
  // Add workspace-specific receipt footer to preview.
  if(typeof showReceiptPreview==='function'){
    const originalReceipt=showReceiptPreview;
    showReceiptPreview=function(p){originalReceipt(p);const footer=activeWorkspaceBranding?.receipt_footer;if(footer){const c=document.getElementById('receipt-content');if(c&&!c.querySelector('.saas-receipt-footer')){const f=document.createElement('div');f.className='saas-receipt-footer';f.style.cssText='margin-top:14px;padding-top:11px;border-top:1px dashed #ddd;text-align:center;font-size:11px;color:var(--muted)';f.textContent=footer;c.appendChild(f);}}};
  }
  // Keep active state synced even when old navigation logic changes sections.
  document.addEventListener('click',e=>{if(e.target.closest('.tab,#saas-settings-btn,.saas-settings-side-btn'))setTimeout(syncNavState,30)});
  const appObs=new MutationObserver(()=>syncNavState());document.querySelectorAll('.section').forEach(s=>appObs.observe(s,{attributes:true,attributeFilter:['class']}));

  function initV204(){buildSidebar();addBrandPreview();wireBrandingPreview();if(typeof activeWorkspaceBranding!=='undefined')applyWorkspaceBrandingV204(activeWorkspaceBranding);syncNavState();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initV204);else initV204();
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  function initV205AccountMenu(){
    const btn=document.getElementById('saas-user-avatar');
    const menu=document.getElementById('saas-user-menu');
    const email=document.getElementById('user-email');
    const menuAvatar=document.getElementById('saas-user-menu-avatar');
    if(!btn||!menu||btn.dataset.v205wired)return;
    btn.dataset.v205wired='1';
    const setOpen=(open)=>{menu.hidden=!open;btn.setAttribute('aria-expanded',open?'true':'false')};
    btn.addEventListener('click',(e)=>{e.stopPropagation();setOpen(menu.hidden)});
    menu.addEventListener('click',e=>e.stopPropagation());
    document.addEventListener('click',()=>setOpen(false));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false)});
    document.getElementById('saas-user-settings-menu')?.addEventListener('click',()=>{setOpen(false);document.getElementById('saas-settings-btn')?.click()});
    const updateInitial=()=>{
      const raw=(email?.textContent||'G').trim();
      const ch=(raw.match(/[A-Za-z0-9]/)?.[0]||'G').toUpperCase();
      btn.textContent=ch;if(menuAvatar)menuAvatar.textContent=ch;
    };
    updateInitial();
    if(email)new MutationObserver(updateInitial).observe(email,{childList:true,subtree:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initV205AccountMenu);else initV205AccountMenu();
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
 function buildSettingsDropdown(){
   const settings=document.getElementById('settings');
   if(!settings || document.getElementById('settings-category-select')) return;
   const workspaceGrid=settings.querySelector('.settings-grid');
   const adminGrid=settings.querySelector('.settings-admin-grid');
   const profitCard=settings.querySelector('#profit-share-editor-card');
   if(!workspaceGrid || !adminGrid || !profitCard) return;
   const masterCards=Array.from(adminGrid.querySelectorAll(':scope > .settings-master-card'));
   const packageCard=masterCards.find(x=>x.textContent.includes('Package & Harga'));
   const addonCard=masterCards.find(x=>x.textContent.includes('Add-on & Harga'));
   const topicCard=masterCards.find(x=>x.id==='settings-topic-card');
   if(!packageCard || !addonCard || !topicCard) return;

   const selector=document.createElement('div');
   selector.className='card settings-category-shell';
   selector.innerHTML=`<div class="settings-category-copy"><div class="card-title">Pengaturan</div><div class="page-sub">Pilih bagian yang mau lo kelola biar halaman tetap ringkas.</div></div><div class="settings-category-select-wrap"><label class="label" for="settings-category-select">Menu Settings</label><select id="settings-category-select"><option value="workspace">Workspace & Branding</option><option value="packages">Package & Harga</option><option value="addons">Add-on & Harga</option><option value="topics">Topik</option><option value="profit">Pembagian Omzet</option></select></div>`;
   workspaceGrid.parentNode.insertBefore(selector,workspaceGrid);

   const makePanel=(key,node)=>{const panel=document.createElement('div');panel.className='settings-category-panel';panel.dataset.settingsPanel=key;node.parentNode.insertBefore(panel,node);panel.appendChild(node);return panel;};
   const workspacePanel=makePanel('workspace',workspaceGrid);
   const packagePanel=document.createElement('div');packagePanel.className='settings-category-panel';packagePanel.dataset.settingsPanel='packages';adminGrid.parentNode.insertBefore(packagePanel,adminGrid);packagePanel.appendChild(packageCard);
   const addonPanel=document.createElement('div');addonPanel.className='settings-category-panel';addonPanel.dataset.settingsPanel='addons';adminGrid.parentNode.insertBefore(addonPanel,adminGrid);addonPanel.appendChild(addonCard);
   const topicPanel=document.createElement('div');topicPanel.className='settings-category-panel';topicPanel.dataset.settingsPanel='topics';adminGrid.parentNode.insertBefore(topicPanel,adminGrid);topicPanel.appendChild(topicCard);
   const profitPanel=makePanel('profit',profitCard);
   if(adminGrid && !adminGrid.children.length) adminGrid.remove();

   const select=selector.querySelector('#settings-category-select');
   function show(key){
     settings.querySelectorAll('.settings-category-panel').forEach(p=>p.classList.toggle('active',p.dataset.settingsPanel===key));
     try{localStorage.setItem('trine_settings_category_v1',key)}catch(e){}
   }
   select.addEventListener('change',()=>show(select.value));
   let initial='workspace';try{const saved=localStorage.getItem('trine_settings_category_v1');if(['workspace','packages','addons','profit'].includes(saved))initial=saved}catch(e){}
   select.value=initial;show(initial);
 }
 if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',buildSettingsDropdown); else buildSettingsDropdown();
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
 const DEFAULT_RECEIPT_LABELS={
   title:'', customer:'Customer', start:'Start Reading', status:'Status', status_value:'On Progress', shift:'Shift', shift_active:'Shift aktif', shift_none:'Tanpa shift', platform:'Platform', payment:'Pembayaran', package:'Package', topic:'Topic', addon:'Add On', subtotal:'Subtotal', discount:'Diskon', markup:'Kenaikan Harga', tip:'Tip', total:'Total'
 };
 const clean=(v,fallback='')=>String(v??fallback).trim()||fallback;
 function receiptLabels(){return {...DEFAULT_RECEIPT_LABELS,...(activeWorkspaceBranding?.receipt_labels||{})};}
 function copyIcon(){return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`;}
 function initCopyIcon(){const el=document.querySelector('.receipt-copy-icon');if(el)el.innerHTML=copyIcon();}
 function buildReceiptHtml(p){
   const l=receiptLabels();
   const pkg=(p.order_items||[]).map(x=>`<div class="receipt-line"><span>${escapeHtml(x.name)} × ${x.qty}</span><strong>${rupiah(x.subtotal)}</strong></div>`).join('');
   const addon=(p.order_addons||[]).length?`<div style="margin-top:10px"><strong>${escapeHtml(l.addon)}</strong>${p.order_addons.map(x=>`<div class="receipt-line"><span>${escapeHtml(x.name)} × ${x.qty}</span><strong>${rupiah(x.subtotal)}</strong></div>`).join('')}</div>`:'';
   const adjustment=p.price_adjustment_type&&p.price_adjustment_type!=='none'?`<div class="receipt-line"><span>${escapeHtml(p.price_adjustment_type==='discount'?l.discount:l.markup)} (${p.price_adjustment_mode==='percent'?p.price_adjustment_value+'%':rupiah(p.price_adjustment_value)})</span><strong>${p.price_adjustment_amount<0?'-':'+'}${rupiah(Math.abs(p.price_adjustment_amount))}</strong></div>`:'';
   const title=clean(l.title,activeWorkspaceName||'Struk Penjualan');
   const subtotal=(p.order_items||[]).reduce((s,x)=>s+x.subtotal,0)+(p.order_addons||[]).reduce((s,x)=>s+x.subtotal,0);
   return `<div class="receipt-customer-ready"><div class="receipt-heading">${escapeHtml(title)}</div>
    <div><strong>${escapeHtml(l.customer)}:</strong> ${escapeHtml(p.customer_name)}</div>
    <div><strong>${escapeHtml(l.start)}:</strong> ${escapeHtml(formatReadingStartedAt(p.reading_started_at))}</div>
    <div><strong>${escapeHtml(l.status)}:</strong> ${escapeHtml(l.status_value)}</div>
    <div><strong>${escapeHtml(l.shift)}:</strong> ${escapeHtml(p.shift_id?l.shift_active:l.shift_none)}</div>
    <div><strong>${escapeHtml(l.platform)}:</strong> ${escapeHtml(p.platform)}</div>
    <div><strong>${escapeHtml(l.payment)}:</strong> ${escapeHtml(p.payment_method)}</div>
    <div style="margin-top:12px"><strong>${escapeHtml(l.package)}</strong>${pkg}</div>
    <div style="margin-top:10px"><strong>${escapeHtml(l.topic)}</strong><div>${(p.order_topics||[]).map(x=>escapeHtml(x.name)).join(', ')}</div></div>
    ${addon}
    <div class="receipt-line" style="margin-top:10px"><span>${escapeHtml(l.subtotal)}</span><strong>${rupiah(subtotal)}</strong></div>
    ${adjustment}
    ${Number(p.tip_amount||0)>0?`<div class="receipt-line"><span>${escapeHtml(l.tip)}</span><strong>+${rupiah(p.tip_amount)}</strong></div>`:''}
    <div class="receipt-total">${escapeHtml(l.total)} <span style="float:right">${rupiah(p.total_price)}</span></div></div>`;
 }
 function buildReceiptText(p){
   const l=receiptLabels(), lines=[];
   const title=clean(l.title,activeWorkspaceName||'Struk Penjualan');
   lines.push(title,'');
   lines.push(`${l.customer}: ${p.customer_name||'-'}`,`${l.start}: ${formatReadingStartedAt(p.reading_started_at)}`,`${l.status}: ${l.status_value}`,`${l.shift}: ${p.shift_id?l.shift_active:l.shift_none}`,`${l.platform}: ${p.platform||'-'}`,`${l.payment}: ${p.payment_method||'-'}`,'');
   lines.push(l.package);(p.order_items||[]).forEach(x=>lines.push(`${x.name} × ${x.qty} — ${rupiah(x.subtotal)}`));
   if((p.order_topics||[]).length)lines.push('',l.topic,(p.order_topics||[]).map(x=>x.name).join(', '));
   if((p.order_addons||[]).length){lines.push('',l.addon);p.order_addons.forEach(x=>lines.push(`${x.name} × ${x.qty} — ${rupiah(x.subtotal)}`));}
   const subtotal=(p.order_items||[]).reduce((s,x)=>s+x.subtotal,0)+(p.order_addons||[]).reduce((s,x)=>s+x.subtotal,0);
   lines.push('',`${l.subtotal}: ${rupiah(subtotal)}`);
   if(p.price_adjustment_type&&p.price_adjustment_type!=='none'){const label=p.price_adjustment_type==='discount'?l.discount:l.markup;const val=p.price_adjustment_mode==='percent'?p.price_adjustment_value+'%':rupiah(p.price_adjustment_value);lines.push(`${label} (${val}): ${p.price_adjustment_amount<0?'-':'+'}${rupiah(Math.abs(p.price_adjustment_amount))}`);}
   if(Number(p.tip_amount||0)>0)lines.push(`${l.tip}: +${rupiah(p.tip_amount)}`);
   lines.push(`${l.total}: ${rupiah(p.total_price)}`);
   const footer=activeWorkspaceBranding?.receipt_footer;if(footer)lines.push('',footer);
   return lines.join('\n');
 }
 async function copyReceipt(){
   const p=window.__trineLastReceiptPayload;if(!p)return showToast('Belum ada struk untuk disalin.',true);
   const text=buildReceiptText(p);let ok=false;
   try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);ok=true;}}catch(e){}
   if(!ok){const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;left:-9999px;top:-9999px';document.body.appendChild(ta);ta.focus();ta.select();try{ok=document.execCommand('copy')}catch(e){}ta.remove();}
   const btn=document.getElementById('copy-receipt');if(btn&&ok){const label=btn.querySelector('span:last-child');const old=label?.textContent;if(label)label.textContent='Tersalin';setTimeout(()=>{if(label)label.textContent=old||'Salin Struk'},1400);}
   showToast(ok?'Struk berhasil disalin. Tinggal paste dan forward ke customer.':'Browser gagal menyalin struk.',!ok);
 }
 // Replace preview renderer with editable wording version.
 showReceiptPreview=function(p){
   window.__trineLastReceiptPayload=p;
   document.getElementById('receipt-content').innerHTML=buildReceiptHtml(p);
   const footer=activeWorkspaceBranding?.receipt_footer;if(footer){const c=document.getElementById('receipt-content');const f=document.createElement('div');f.className='saas-receipt-footer';f.style.cssText='margin-top:14px;padding-top:11px;border-top:1px dashed #ddd;text-align:center;font-size:11px;color:var(--muted)';f.textContent=footer;c.appendChild(f);}
   const receiptModal=document.getElementById('receipt-modal');if(receiptModal.parentElement!==document.body)document.body.appendChild(receiptModal);
   const scrollY=window.scrollY||window.pageYOffset||0;document.body.dataset.receiptScrollY=String(scrollY);document.body.style.position='fixed';document.body.style.top=`-${scrollY}px`;document.body.style.left='0';document.body.style.right='0';document.body.style.width='100%';document.body.style.overflow='hidden';receiptModal.style.display='flex';
 };
 function buildReceiptSettingsPanel(){
   const settings=document.getElementById('settings'),select=document.getElementById('settings-category-select');if(!settings||!select||document.querySelector('[data-settings-panel="receipt"]'))return;
   const option=document.createElement('option');option.value='receipt';option.textContent='Struk & Wording';select.appendChild(option);
   const panel=document.createElement('div');panel.className='settings-category-panel';panel.dataset.settingsPanel='receipt';
   panel.innerHTML=`<div class="card receipt-settings-card"><div class="card-title">Struk & Wording</div><div class="page-sub" style="margin-bottom:14px">Atur wording struk yang muncul di preview dan saat disalin untuk customer.</div><form id="receipt-wording-form" class="form-grid">
     <div class="form-group full"><label class="label">Judul Struk</label><input class="input" data-receipt-label="title" placeholder="Kosongkan untuk memakai nama workspace"></div>
     <div class="form-group"><label class="label">Customer</label><input class="input" data-receipt-label="customer"></div><div class="form-group"><label class="label">Start Reading</label><input class="input" data-receipt-label="start"></div>
     <div class="form-group"><label class="label">Status</label><input class="input" data-receipt-label="status"></div><div class="form-group"><label class="label">Isi Status</label><input class="input" data-receipt-label="status_value"></div>
     <div class="form-group"><label class="label">Shift</label><input class="input" data-receipt-label="shift"></div><div class="form-group"><label class="label">Tanpa Shift</label><input class="input" data-receipt-label="shift_none"></div>
     <div class="form-group"><label class="label">Platform</label><input class="input" data-receipt-label="platform"></div><div class="form-group"><label class="label">Pembayaran</label><input class="input" data-receipt-label="payment"></div>
     <div class="form-group"><label class="label">Package</label><input class="input" data-receipt-label="package"></div><div class="form-group"><label class="label">Topic</label><input class="input" data-receipt-label="topic"></div>
     <div class="form-group"><label class="label">Add-on</label><input class="input" data-receipt-label="addon"></div><div class="form-group"><label class="label">Subtotal</label><input class="input" data-receipt-label="subtotal"></div>
     <div class="form-group"><label class="label">Diskon</label><input class="input" data-receipt-label="discount"></div><div class="form-group"><label class="label">Kenaikan Harga</label><input class="input" data-receipt-label="markup"></div>
     <div class="form-group"><label class="label">Tip</label><input class="input" data-receipt-label="tip"></div><div class="form-group"><label class="label">Total</label><input class="input" data-receipt-label="total"></div>
     <div class="full receipt-settings-preview"><strong>Catatan</strong>Footer struk diatur dari submenu Struk & Wording. Tombol “Salin Struk” akan menyalin versi teks yang rapi dan siap dipaste ke chat customer.</div>
     <div class="full actions"><button class="btn btn-green" type="submit">Simpan Wording Struk</button></div></form></div>`;
   settings.appendChild(panel);
   function fill(){const l=receiptLabels();panel.querySelectorAll('[data-receipt-label]').forEach(input=>{input.value=l[input.dataset.receiptLabel]??'';input.disabled=!isWorkspaceAdmin();});}
   fill();
   panel.querySelector('#receipt-wording-form').addEventListener('submit',async e=>{e.preventDefault();try{requireWorkspaceRole(['owner','admin'],'mengubah wording struk');const labels={...(activeWorkspaceBranding?.receipt_labels||{})};panel.querySelectorAll('[data-receipt-label]').forEach(input=>labels[input.dataset.receiptLabel]=input.value.trim());labels.shift_active=receiptLabels().shift_active;const wid=requireWorkspaceId();const {error}=await db.from('workspace_branding').upsert({workspace_id:wid,receipt_labels:labels,updated_at:new Date().toISOString()},{onConflict:'workspace_id'});if(error)throw error;await loadWorkspaceSaasContext();fill();showToast('Wording struk tersimpan.');}catch(err){console.error(err);showToast(err.message||'Gagal menyimpan wording struk.',true);}});
   // Extend the existing dropdown controller without rebuilding it.
   select.addEventListener('change',()=>{settings.querySelectorAll('.settings-category-panel').forEach(p=>p.classList.toggle('active',p.dataset.settingsPanel===select.value));try{localStorage.setItem('trine_settings_category_v1',select.value)}catch(e){}});
   try{if(localStorage.getItem('trine_settings_category_v1')==='receipt'){select.value='receipt';select.dispatchEvent(new Event('change'));}}catch(e){}
   const oldHydrate=hydrateSaasUi;hydrateSaasUi=function(){const r=oldHydrate.apply(this,arguments);fill();return r;};
 }
 function init(){initCopyIcon();document.getElementById('copy-receipt')?.addEventListener('click',copyReceipt);buildReceiptSettingsPanel();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
 const BUCKET='workspace-branding';
 const OUTPUT_SIZE=512;
 let selectedFile=null, cropImg=null, cropState=null, drag=null;
 const q=id=>document.getElementById(id);
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function buildLogoUploader(){
   const urlInput=q('settings-logo-url');
   if(!urlInput || q('settings-logo-upload-shell')) return;
   const group=urlInput.closest('.form-group')||urlInput.parentElement;
   const shell=document.createElement('div');
   shell.id='settings-logo-upload-shell';shell.className='logo-upload-shell';
   shell.innerHTML=`<div class="logo-upload-row"><div class="logo-upload-preview"><img id="settings-logo-upload-preview" alt="Preview logo"></div><div class="logo-upload-copy"><strong>Upload Logo</strong><small>Upload PNG, JPG, atau WebP lalu atur crop supaya logo tetap centered di sidebar, header, dan preview branding.</small></div><div class="logo-upload-actions"><input id="settings-logo-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><button id="settings-logo-file-btn" class="btn" type="button">Pilih File</button><button id="settings-logo-recrop-btn" class="btn" type="button" style="display:none">Crop Ulang</button></div></div><div class="logo-upload-note">URL logo tetap bisa dipakai seperti sebelumnya. Upload file akan otomatis mengisi dan menyimpan Logo URL workspace.</div>`;
   group.appendChild(shell);
   document.body.insertAdjacentHTML('beforeend',`<div id="logo-crop-modal" aria-hidden="true"><div class="logo-crop-card" role="dialog" aria-modal="true" aria-labelledby="logo-crop-title"><div class="logo-crop-head"><div><h3 id="logo-crop-title">Atur posisi logo</h3><p>Geser gambar dan atur zoom. Area kotak adalah hasil logo yang akan dipakai.</p></div><button class="logo-crop-close" id="logo-crop-close" type="button" aria-label="Tutup">×</button></div><div class="logo-crop-stage-wrap"><div class="logo-crop-stage" id="logo-crop-stage"><img id="logo-crop-image" alt="Crop logo"><div class="logo-crop-guide"></div></div></div><div class="logo-crop-controls"><label for="logo-crop-zoom">Zoom</label><input id="logo-crop-zoom" type="range" min="1" max="3" step="0.01" value="1"><span id="logo-crop-zoom-value">100%</span></div><div class="logo-crop-actions"><button class="btn" id="logo-crop-cancel" type="button">Batal</button><button class="btn btn-green" id="logo-crop-apply" type="button">Gunakan Logo</button></div></div></div>`);
   q('settings-logo-file-btn').addEventListener('click',()=>q('settings-logo-file').click());
   q('settings-logo-file').addEventListener('change',onFileSelected);
   q('settings-logo-recrop-btn').addEventListener('click',()=>{if(selectedFile)openCrop(selectedFile)});
   q('logo-crop-close').addEventListener('click',closeCrop);q('logo-crop-cancel').addEventListener('click',closeCrop);
   q('logo-crop-modal').addEventListener('click',e=>{if(e.target===q('logo-crop-modal'))closeCrop()});
   q('logo-crop-zoom').addEventListener('input',()=>{if(!cropState)return;cropState.zoom=Number(q('logo-crop-zoom').value);q('logo-crop-zoom-value').textContent=Math.round(cropState.zoom*100)+'%';constrainCrop();renderCrop();});
   const stage=q('logo-crop-stage');stage.addEventListener('pointerdown',startDrag);stage.addEventListener('pointermove',moveDrag);stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);
   q('logo-crop-apply').addEventListener('click',uploadCroppedLogo);
   urlInput.addEventListener('input',updateLogoUploadPreview);
   updateLogoUploadPreview();syncLogoUploadPermissions();
 }
 function syncLogoUploadPermissions(){
   const editable=(typeof isWorkspaceAdmin==='function'?isWorkspaceAdmin():true) && (typeof canUseFeature==='function'?canUseFeature('custom_branding'):true);
   ['settings-logo-file-btn','settings-logo-recrop-btn'].forEach(id=>{const e=q(id);if(e)e.disabled=!editable});
 }
 function updateLogoUploadPreview(){
   const img=q('settings-logo-upload-preview'),url=q('settings-logo-url')?.value?.trim();if(!img)return;
   const fallback=document.querySelector('.brand-logo')?.dataset?.defaultSrc||document.querySelector('.brand-logo')?.src||'';
   img.src=url||fallback;img.onerror=()=>{if(fallback&&img.src!==fallback)img.src=fallback};
 }
 function onFileSelected(e){const file=e.target.files?.[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)){showToast('Format logo harus PNG, JPG, atau WebP.',true);return}if(file.size>5*1024*1024){showToast('Ukuran logo maksimal 5 MB.',true);return}selectedFile=file;q('settings-logo-recrop-btn').style.display='';openCrop(file)}
 function openCrop(file){
   const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{cropImg=img;const stage=q('logo-crop-stage');const size=stage.clientWidth;const minScale=Math.max(size/img.naturalWidth,size/img.naturalHeight);cropState={stageSize:size,minScale,zoom:1,x:(size-img.naturalWidth*minScale)/2,y:(size-img.naturalHeight*minScale)/2};q('logo-crop-image').src=reader.result;q('logo-crop-zoom').value='1';q('logo-crop-zoom-value').textContent='100%';renderCrop();q('logo-crop-modal').classList.add('show');q('logo-crop-modal').setAttribute('aria-hidden','false')};img.src=reader.result};reader.readAsDataURL(file);
 }
 function closeCrop(){q('logo-crop-modal')?.classList.remove('show');q('logo-crop-modal')?.setAttribute('aria-hidden','true');drag=null}
 function currentScale(){return cropState?cropState.minScale*cropState.zoom:1}
 function constrainCrop(){if(!cropState||!cropImg)return;const size=cropState.stageSize,sc=currentScale(),w=cropImg.naturalWidth*sc,h=cropImg.naturalHeight*sc;cropState.x=clamp(cropState.x,size-w,0);cropState.y=clamp(cropState.y,size-h,0)}
 function renderCrop(){if(!cropState||!cropImg)return;const el=q('logo-crop-image'),sc=currentScale();el.style.width=cropImg.naturalWidth+'px';el.style.height=cropImg.naturalHeight+'px';el.style.transform=`translate(${cropState.x}px,${cropState.y}px) scale(${sc})`}
 function startDrag(e){if(!cropState)return;drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:cropState.x,y:cropState.y};e.currentTarget.setPointerCapture?.(e.pointerId)}
 function moveDrag(e){if(!drag||drag.id!==e.pointerId||!cropState)return;cropState.x=drag.x+(e.clientX-drag.startX);cropState.y=drag.y+(e.clientY-drag.startY);constrainCrop();renderCrop()}
 function endDrag(e){if(drag&&drag.id===e.pointerId)drag=null}
 async function croppedBlob(){
   if(!cropState||!cropImg)throw new Error('Logo belum siap dicrop.');
   const c=document.createElement('canvas');c.width=OUTPUT_SIZE;c.height=OUTPUT_SIZE;const ctx=c.getContext('2d');const factor=OUTPUT_SIZE/cropState.stageSize,sc=currentScale()*factor;ctx.clearRect(0,0,OUTPUT_SIZE,OUTPUT_SIZE);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(cropImg,cropState.x*factor,cropState.y*factor,cropImg.naturalWidth*sc,cropImg.naturalHeight*sc);return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Gagal memproses logo.')),'image/png',0.95));
 }
 async function uploadCroppedLogo(){
   const btn=q('logo-crop-apply');const shell=q('settings-logo-upload-shell');
   try{
     requireWorkspaceRole(['owner','admin'],'mengubah logo workspace');if(typeof canUseFeature==='function'&&!canUseFeature('custom_branding'))throw new Error('Upload logo tersedia untuk plan PRO.');
     btn.disabled=true;btn.textContent='Mengupload...';shell?.classList.add('logo-upload-busy');
     const blob=await croppedBlob(),wid=requireWorkspaceId(),path=`${wid}/logo.png`;
     const {error:upErr}=await db.storage.from(BUCKET).upload(path,blob,{contentType:'image/png',upsert:true,cacheControl:'3600'});if(upErr)throw upErr;
     const {data:pub}=db.storage.from(BUCKET).getPublicUrl(path);let url=pub?.publicUrl;if(!url)throw new Error('Public URL logo tidak tersedia.');url+=`?v=${Date.now()}`;
     const {error:saveErr}=await db.from('workspace_branding').upsert({workspace_id:wid,logo_url:url,updated_at:new Date().toISOString()},{onConflict:'workspace_id'});if(saveErr)throw saveErr;
     const input=q('settings-logo-url');if(input)input.value=url;closeCrop();await loadWorkspaceSaasContext();hydrateSaasUi();if(typeof applyWorkspaceBrandingV204==='function')applyWorkspaceBrandingV204(activeWorkspaceBranding);updateLogoUploadPreview();showToast('Logo workspace berhasil diupload dan disimpan.');
   }catch(err){console.error(err);showToast(err.message||'Gagal mengupload logo.',true)}finally{btn.disabled=false;btn.textContent='Gunakan Logo';shell?.classList.remove('logo-upload-busy');syncLogoUploadPermissions()}
 }
 function wrapHydrate(){try{const original=window.hydrateSaasUi;if(typeof original==='function'&&!original.__logoCropWrapped){const wrapped=function(){const r=original.apply(this,arguments);setTimeout(()=>{updateLogoUploadPreview();syncLogoUploadPermissions()},0);return r};wrapped.__logoCropWrapped=true;window.hydrateSaasUi=wrapped}}catch(e){}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{buildLogoUploader();wrapHydrate()});else{buildLogoUploader();wrapHydrate()}
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
 const DEFAULT_LABELS={title:'',customer:'Customer',start:'Start Reading',status:'Status',status_value:'On Progress',shift:'Shift',shift_active:'Shift aktif',shift_none:'Tanpa shift',platform:'Platform',payment:'Pembayaran',package:'Package',topic:'Topic',addon:'Add On',subtotal:'Subtotal',discount:'Diskon',markup:'Kenaikan Harga',tip:'Tip',total:'Total'};
 const SELLER_RECEIPT_LABELS={start:'Tanggal',status_value:'Diproses',package:'Produk',topic:'Kategori',addon:'Tambahan'};
 function isSellerReceiptContext(){return document.body.classList.contains('seller-app-premium')}
 function receiptDefaultLabels(){return {...DEFAULT_LABELS,...(isSellerReceiptContext()?SELLER_RECEIPT_LABELS:{})}}
 const svg={pencil:'<svg viewBox="0 0 24 24"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',up:'<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>',down:'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>',plusPencil:'<svg viewBox="0 0 24 24"><path d="M4 20h4l9.5-9.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m12 8 4 4M19 3v6M16 6h6"/></svg>'};
 const builtinNames={title:'Judul Struk',customer:'Customer',start:'Start Reading',status:'Status',shift:'Shift',platform:'Platform',payment:'Pembayaran',package:'Package',topic:'Topic',addon:'Add-on',subtotal:'Subtotal',adjustment:'Penyesuaian Harga',tip:'Tip',total:'Total',footer:'Footer'};
 const RECEIPT_TEMPLATES=[['pastel','Pastel Commission','Playful, pastel, layered headline'],['studio','Studio List','Clean editorial / pricelist'],['receiptify','Receiptify','Thermal typewriter + doodle'],['vintage','Vintage Story','Warm paper + classic serif'],['newspaper','Newspaper Editorial','Bold monochrome editorial'],['boarding','Boarding Pass','Ticket / travel inspired'],['diner','Retro Diner','Playful retro counter receipt'],['luxury','Minimal Luxury','Minimal fashion / premium']];
 function normalizeTemplate(v){const id=String(v||'pastel').toLowerCase();return RECEIPT_TEMPLATES.some(x=>x[0]===id)?id:'pastel';}
 function labels(){return {...receiptDefaultLabels(),...(activeWorkspaceBranding?.receipt_labels||{})};}
 function receiptStore(){const l=activeWorkspaceBranding?.receipt_labels||{};return activeWorkspaceBranding?.receipt_layout||l.__layout_v2||null;}
 function defaultDesign(){const cs=getComputedStyle(document.documentElement);return {template:'pastel',background:'#FFFFFF',text:'#2D3748',accent:(cs.getPropertyValue('--brand-accent')||'#EA97A9').trim(),watermark:'',watermarkOpacity:8,watermarkSize:54,fontFamily:'Arial',description:'',descriptionAlign:'left',watermarkImage:'',showWorkspaceName:false};}
 function currentDesign(){const raw=receiptStore();const legacy=activeWorkspaceBranding?.receipt_labels?.__design||{};return {...defaultDesign(),...(raw?.design||legacy||{})};}
 function currentReceiptFooter(){const input=document.getElementById('settings-receipt-footer');if(input)return String(input.value||'').trim();return String(activeWorkspaceBranding?.receipt_footer||'').trim();}
 function safeHex(v,fallback){return /^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):fallback;}
  function receiptFontCss(font){
    const f=String(font||'Arial').replace(/[\"']/g,'').trim()||'Arial';
    const serif=new Set(['Georgia','Didot','Baskerville','Times New Roman']);
    const mono=new Set(['Courier New']);
    const fallback=serif.has(f)?'Georgia, serif':mono.has(f)?'Courier New, monospace':'Arial, sans-serif';
    return `\"${f}\", ${fallback}`;
  }
 function defaultLayout(){const l=labels();return [
  {id:'title',type:'builtin',key:'title',enabled:true,label:l.title||''},
  {id:'customer',type:'builtin',key:'customer',enabled:true,label:l.customer},
  {id:'start',type:'builtin',key:'start',enabled:true,label:l.start},
  {id:'status',type:'builtin',key:'status',enabled:true,label:l.status,value:l.status_value},
  {id:'shift',type:'builtin',key:'shift',enabled:true,label:l.shift,activeValue:l.shift_active,noneValue:l.shift_none},
  {id:'platform',type:'builtin',key:'platform',enabled:true,label:l.platform},
  {id:'payment',type:'builtin',key:'payment',enabled:true,label:l.payment},
  {id:'package',type:'builtin',key:'package',enabled:true,label:l.package},
  {id:'topic',type:'builtin',key:'topic',enabled:true,label:l.topic},
  {id:'addon',type:'builtin',key:'addon',enabled:true,label:l.addon},
  {id:'subtotal',type:'builtin',key:'subtotal',enabled:true,label:l.subtotal},
  {id:'adjustment',type:'builtin',key:'adjustment',enabled:true,discountLabel:l.discount,markupLabel:l.markup},
  {id:'tip',type:'builtin',key:'tip',enabled:true,label:l.tip},
  {id:'total',type:'builtin',key:'total',enabled:true,label:l.total},
  {id:'footer',type:'builtin',key:'footer',enabled:true,label:'Footer'}
 ];}
 function normalizeLayout(raw){
   let arr=Array.isArray(raw)?raw:(Array.isArray(raw?.items)?raw.items:null); if(!arr||!arr.length)return defaultLayout();
   const base=defaultLayout(), byKey=new Map(arr.filter(x=>x&&x.type==='builtin').map(x=>[x.key,x]));
   // Preserve saved order exactly, then append any newer built-ins that did not exist when saved.
   const normalized=arr.filter(Boolean).map((x,i)=>({...x,id:x.id||`${x.type||'item'}-${i}`,enabled:x.enabled!==false}));
   if(isSellerReceiptContext()){
     const legacyMap={start:['Start Reading','Tanggal'],package:['Package','Produk'],topic:['Topic','Kategori'],addon:['Add On','Tambahan']};
     normalized.forEach(x=>{const m=legacyMap[x.key];if(x.type==='builtin'&&m&&String(x.label||'')===m[0])x.label=m[1];if(x.key==='status'&&String(x.value||'')==='On Progress')x.value='Diproses';});
   }
   const keys=new Set(normalized.filter(x=>x.type==='builtin').map(x=>x.key));
   base.forEach(x=>{if(!keys.has(x.key))normalized.push(x)});
   return normalized;
 }
 function currentLayout(){return normalizeLayout(receiptStore());}
 function esc(v){return escapeHtml(String(v??''));}
 function money(n){return rupiah(Number(n||0));}
 function subtotalOf(p){return (p.order_items||[]).reduce((s,x)=>s+Number(x.subtotal||0),0)+(p.order_addons||[]).reduce((s,x)=>s+Number(x.subtotal||0),0);}
 function itemHtml(item,p){if(item.enabled===false)return '';
   const key=item.key, label=item.label||builtinNames[key]||'', cls=`receipt-field receipt-field-${esc(key||item.type||'custom')}`;
   if(item.type==='custom'){
     const value=String(item.value||''); if(!label&&!value)return '';
     if(item.style==='heading')return `<div class="${cls} receipt-static-heading">${esc(label||value)}</div>`;
     return `<div class="${cls} receipt-static-line">${label?`<span class="receipt-custom-label">${esc(label)}${value?':':''}</span> `:''}${esc(value)}</div>`;
   }
   if(key==='title')return `<div class="${cls} receipt-heading">${esc(item.label||activeWorkspaceName||'Struk Penjualan')}</div>`;
   if(key==='customer')return `<div class="${cls}"><strong>${esc(label)}:</strong> <span>${esc(p.customer_name||'-')}</span></div>`;
   if(key==='start')return `<div class="${cls}"><strong>${esc(label)}:</strong> <span>${esc(formatReadingStartedAt(p.reading_started_at))}</span></div>`;
   if(key==='status')return `<div class="${cls}"><strong>${esc(label)}:</strong> <span>${esc(item.value||'On Progress')}</span></div>`;
   if(key==='shift')return `<div class="${cls}"><strong>${esc(label)}:</strong> <span>${esc(p.shift_id?(item.activeValue||'Shift aktif'):(item.noneValue||'Tanpa shift'))}</span></div>`;
   if(key==='platform')return `<div class="${cls}"><strong>${esc(label)}:</strong> <span>${esc(p.platform||'-')}</span></div>`;
   if(key==='payment')return `<div class="${cls}"><strong>${esc(label)}:</strong> <span>${esc(p.payment_method||'-')}</span></div>`;
   if(key==='package'){const rows=(p.order_items||[]).map(x=>`<div class="receipt-line"><span>${esc(x.name)} × ${Number(x.qty||0)}</span><strong>${money(x.subtotal)}</strong></div>`).join('');return `<div class="${cls}"><strong class="receipt-section-label">${esc(label)}</strong>${rows}</div>`;}
   if(key==='topic'){if(!(p.order_topics||[]).length)return '';return `<div class="${cls}"><strong class="receipt-section-label">${esc(label)}</strong><div>${(p.order_topics||[]).map(x=>esc(x.name)).join(', ')}</div></div>`;}
   if(key==='addon'){if(!(p.order_addons||[]).length)return '';return `<div class="${cls}"><strong class="receipt-section-label">${esc(label)}</strong>${p.order_addons.map(x=>`<div class="receipt-line"><span>${esc(x.name)} × ${Number(x.qty||0)}</span><strong>${money(x.subtotal)}</strong></div>`).join('')}</div>`;}
   if(key==='subtotal')return `<div class="${cls} receipt-line"><span>${esc(label)}</span><strong>${money(subtotalOf(p))}</strong></div>`;
   if(key==='adjustment'){if(!p.price_adjustment_type||p.price_adjustment_type==='none')return '';const txt=p.price_adjustment_type==='discount'?(item.discountLabel||labels().discount):(item.markupLabel||labels().markup);const val=p.price_adjustment_mode==='percent'?p.price_adjustment_value+'%':money(p.price_adjustment_value);return `<div class="${cls} receipt-line"><span>${esc(txt)} (${esc(val)})</span><strong>${p.price_adjustment_amount<0?'-':'+'}${money(Math.abs(p.price_adjustment_amount))}</strong></div>`;}
   if(key==='tip'){if(Number(p.tip_amount||0)<=0)return '';return `<div class="${cls} receipt-line"><span>${esc(label)}</span><strong>+${money(p.tip_amount)}</strong></div>`;}
   if(key==='total')return `<div class="${cls} receipt-total"><span>${esc(label)}</span><strong>${money(p.total_price)}</strong></div>`;
   if(key==='footer'){const f=currentReceiptFooter();return f?`<div class="${cls} saas-receipt-footer">${esc(f)}</div>`:'';}
   return '';
 }
 function itemText(item,p){if(item.enabled===false)return [];
   const key=item.key,label=item.label||builtinNames[key]||'';
   if(item.type==='custom'){
     const value=String(item.value||'');if(!label&&!value)return [];
     if(item.style==='heading')return ['',label||value];
     return [`${label?label+(value?': ':''):''}${value}`];
   }
   if(key==='title')return [item.label||activeWorkspaceName||'Struk Penjualan',''];
   if(key==='customer')return [`${label}: ${p.customer_name||'-'}`];
   if(key==='start')return [`${label}: ${formatReadingStartedAt(p.reading_started_at)}`];
   if(key==='status')return [`${label}: ${item.value||'On Progress'}`];
   if(key==='shift')return [`${label}: ${p.shift_id?(item.activeValue||'Shift aktif'):(item.noneValue||'Tanpa shift')}`];
   if(key==='platform')return [`${label}: ${p.platform||'-'}`];
   if(key==='payment')return [`${label}: ${p.payment_method||'-'}`];
   if(key==='package'){const out=['',label];(p.order_items||[]).forEach(x=>out.push(`${x.name} × ${Number(x.qty||0)} — ${money(x.subtotal)}`));return out;}
   if(key==='topic'){return (p.order_topics||[]).length?['',label,(p.order_topics||[]).map(x=>x.name).join(', ')]:[];}
   if(key==='addon'){if(!(p.order_addons||[]).length)return [];const out=['',label];p.order_addons.forEach(x=>out.push(`${x.name} × ${Number(x.qty||0)} — ${money(x.subtotal)}`));return out;}
   if(key==='subtotal')return ['',`${label}: ${money(subtotalOf(p))}`];
   if(key==='adjustment'){if(!p.price_adjustment_type||p.price_adjustment_type==='none')return [];const txt=p.price_adjustment_type==='discount'?(item.discountLabel||labels().discount):(item.markupLabel||labels().markup);const val=p.price_adjustment_mode==='percent'?p.price_adjustment_value+'%':money(p.price_adjustment_value);return [`${txt} (${val}): ${p.price_adjustment_amount<0?'-':'+'}${money(Math.abs(p.price_adjustment_amount))}`];}
   if(key==='tip')return Number(p.tip_amount||0)>0?[`${label}: +${money(p.tip_amount)}`]:[];
   if(key==='total')return [`${label}: ${money(p.total_price)}`];
   if(key==='footer'){const f=currentReceiptFooter();return f?['',f]:[];}
   return [];
 }
 function receiptSceneDecor(template,business){
   const b=esc(business||'NAMA USAHA');
   if(template==='pastel')return `<div class="receipt-scene-stars">✦　☆　✧　★　☆　✦</div><div class="receipt-sign-stack"><span class="receipt-sign-main">${b}</span><em>for</em><span class="receipt-sign-sub">${isSellerReceiptContext()?'DIGITAL ACCESS MADE SIMPLE':'A KINDER TOMORROW'}</span></div><div class="receipt-metal-clip"></div>`;
   if(template==='studio')return `<div class="receipt-locker-lines"></div><div class="receipt-sticker receipt-sticker-a">GOOD<br>THINGS<br>AHEAD</div><div class="receipt-sticker receipt-sticker-b">DO<br>YOUR<br>BEST</div><div class="receipt-pushpin">●</div><div class="receipt-studio-brand">${b}<small>QUALITY MAKES A DIFFERENCE</small></div><div class="receipt-faux-qr" aria-hidden="true"></div>`;
   if(template==='receiptify')return `<div class="receipt-checker-bg"></div><div class="receipt-hand-corner"></div><div class="receipt-doodle d1">♡</div><div class="receipt-doodle d2">?!</div><div class="receipt-doodle d3">✦</div>`;
   if(template==='vintage')return `<div class="receipt-vintage-badge">VINTAGE<br>VIBES<br>ONLY</div><div class="receipt-tape">☺　☺　☺　☺</div><div class="receipt-vintage-sticker">THANK<br>YOU ☺</div>`;
   if(template==='newspaper')return `<div class="receipt-news-collage">THE DAILY ORDER　•　GOOD PEOPLE GOOD STORIES</div>`;
   if(template==='boarding')return `<div class="receipt-flight-band">✈　BUSINESS CLASS</div><div class="receipt-flight-note">A SMALL BUSINESS<br>GOES A LONG WAY</div>`;
   if(template==='diner')return `<div class="receipt-diner-check"></div><div class="receipt-diner-mascot">☺</div>`;
   if(template==='luxury')return `<div class="receipt-luxury-shadow"></div><div class="receipt-luxury-flower">❧</div>`;
   return '';
 }
 function receiptPaperHeader(template,business,p){
   const b=esc(business||'NAMA USAHA');
   const date=new Date(p.reading_started_at||Date.now());
   const ds=isNaN(date.getTime())?'':date.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
   if(template==='studio')return `<div class="receipt-template-brand receipt-template-brand-studio">${b}<small>BUSINESS RECEIPT</small></div>`;
   if(template==='receiptify')return `<div class="receipt-template-brand receipt-template-brand-receiptify">${b}<small>GOOD PEOPLE, GOOD BUSINESS</small></div>`;
   if(template==='vintage')return `<div class="receipt-template-brand receipt-template-brand-vintage"><span>★</span><b>${b}</b><span>★</span><small>MORE THAN JUST A BUSINESS</small></div><div class="receipt-date-row"><strong>DATE:</strong><span>${esc(ds)}</span></div>`;
   if(template==='newspaper')return `<div class="receipt-news-masthead">The Daily Order</div><div class="receipt-template-brand receipt-template-brand-newspaper">${b}<small>SMALL BUSINESS, BIG IMPACT</small></div>`;
   if(template==='boarding')return `<div class="receipt-template-brand receipt-template-brand-boarding">${b}<small>BOARDING TO A BRIGHTER TOMORROW</small></div>`;
   if(template==='diner')return `<div class="receipt-template-brand receipt-template-brand-diner">${b}<small>ALWAYS A GOOD CHOICE</small></div>`;
   if(template==='luxury')return `<div class="receipt-luxury-mark">❧</div><div class="receipt-template-brand receipt-template-brand-luxury">${b}<small>BEAUTY IN EVERY DETAIL</small></div>`;
   return '';
 }
 function receiptExtra(template){
   if(template==='receiptify')return `<div class="receipt-doodle-layer"><span>♡</span><span>✦</span><span>⌁</span><span>?!</span><span>☺</span></div>`;
   if(template==='studio')return `<div class="receipt-paper-tape">✚</div>`;
   if(template==='vintage')return `<div class="receipt-vintage-smiles">☺　☺　☺　☺</div>`;
   return '';
 }
 function renderReceiptSurface(p,layout,d){
   d={...defaultDesign(),...(d||{})};const bg=safeHex(d.background,'#FFFFFF'),tx=safeHex(d.text,'#2D3748'),ac=safeHex(d.accent,'#EA97A9'),wm=String(d.watermark||'').trim(),font=String(d.fontFamily||'Arial').replace(/["']/g,''),fontCss=receiptFontCss(font),description=String(d.description||'').trim(),descriptionAlign=['left','center','right','justify'].includes(String(d.descriptionAlign||''))?String(d.descriptionAlign):'left',template=normalizeTemplate(d.template);
   const wmText=wm?`<div class="receipt-preview-watermark" style="color:${ac};opacity:${Math.max(0,Math.min(60,Number(d.watermarkOpacity||0)))/100};font-size:${Math.max(24,Math.min(180,Number(d.watermarkSize||54)))}px;font-family:${esc(fontCss)}">${esc(wm)}</div>`:'';
   const wmImg=d.watermarkImage?`<img src="${esc(d.watermarkImage)}" alt="Watermark" class="receipt-watermark-image" style="width:${Math.max(90,Math.min(360,Number(d.watermarkSize||54)*2.4))}px;opacity:${Math.max(0,Math.min(60,Number(d.watermarkOpacity||0)))/100}">`:'';
   const body=(layout||currentLayout()).map(x=>itemHtml(x,p)).join('');
   const business=activeWorkspaceName||'NAMA USAHA';
   const desc=description?`<div class="receipt-template-description" style="text-align:${descriptionAlign}">${esc(description)}</div>`:'';
   return `<div class="receipt-preview-surface receipt-template receipt-template-${template}" data-receipt-template="${template}" style="position:relative;--receipt-bg:${bg};--receipt-text:${tx};--receipt-accent:${ac};--receipt-font-family:${esc(fontCss)};color:${tx};font-family:${esc(fontCss)}"><div class="receipt-scene receipt-scene-${template}">${receiptSceneDecor(template,business)}<div class="receipt-paper">${wmText}${wmImg}${receiptExtra(template)}<div class="receipt-customer-ready" style="position:relative;z-index:2">${receiptPaperHeader(template,business,p)}${desc}${body}<div class="receipt-barcode" aria-hidden="true"></div><div class="receipt-powered">powered by kairo workspaces</div></div></div></div></div>`;
 }
 function buildHtml(p){const d=(layoutDirty?{...currentDesign(),...designDraft}:currentDesign());return renderReceiptSurface(p,currentLayout(),d);}
 function buildText(p){const out=[];const d=currentDesign();if(d.description)out.push(d.description,'');currentLayout().forEach(x=>out.push(...itemText(x,p)));return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();}
 function copyNew(){
   const p=window.__trineLastReceiptPayload;if(!p)return showToast('Belum ada struk untuk disalin.',true);const text=buildText(p);let ok=false;
   const finish=()=>{const btn=document.getElementById('copy-receipt');if(btn&&ok){const span=btn.querySelector('span:last-child');const old=span?.textContent;if(span)span.textContent='Tersalin';setTimeout(()=>{if(span)span.textContent=old||'Salin Struk'},1400)}showToast(ok?'Struk berhasil disalin. Tinggal paste dan forward ke customer.':'Browser gagal menyalin struk.',!ok)};
   (async()=>{try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);ok=true}}catch(e){}if(!ok){const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;left:-9999px;top:-9999px';document.body.appendChild(ta);ta.focus();ta.select();try{ok=document.execCommand('copy')}catch(e){}ta.remove()}finish()})();
 }
 function installCopyHandler(){const old=document.getElementById('copy-receipt');if(!old||old.dataset.layoutCopy==='1')return;const fresh=old.cloneNode(true);fresh.dataset.layoutCopy='1';old.replaceWith(fresh);fresh.addEventListener('click',copyNew);}
 function installPreview(){showReceiptPreview=function(p){window.__trineLastReceiptPayload=p;const c=document.getElementById('receipt-content');if(c)c.innerHTML=buildHtml(p);const modal=document.getElementById('receipt-modal');if(modal.parentElement!==document.body)document.body.appendChild(modal);const y=window.scrollY||window.pageYOffset||0;document.body.dataset.receiptScrollY=String(y);document.body.style.position='fixed';document.body.style.top=`-${y}px`;document.body.style.left='0';document.body.style.right='0';document.body.style.width='100%';document.body.style.overflow='hidden';modal.style.display='flex';};}
 let draft=[];let editingId=null;let designDraft=currentDesign();let layoutDirty=false;
 function previewText(item){if(item.type==='custom')return item.style==='heading'?(item.label||item.value||'Heading baru'):[item.label,item.value].filter(Boolean).join(': ')||'Wording baru';if(item.key==='title')return item.label||activeWorkspaceName||'Nama workspace';if(item.key==='status')return `${item.label||'Status'}: ${item.value||'On Progress'}`;if(item.key==='shift')return `${item.label||'Shift'}: ${item.noneValue||'Tanpa shift'}`;if(item.key==='adjustment')return `${item.discountLabel||'Diskon'} / ${item.markupLabel||'Kenaikan Harga'}`;if(item.key==='footer')return currentReceiptFooter()||'Footer belum diisi';return item.label||builtinNames[item.key]||item.key;}
 function editorModal(){let m=document.getElementById('receipt-item-editor');if(m)return m;m=document.createElement('div');m.id='receipt-item-editor';m.innerHTML=`<div class="receipt-editor-backdrop" data-close-editor></div><div class="receipt-editor-card"><div class="receipt-editor-title" id="receipt-editor-title">Edit Bagian</div><div class="receipt-editor-sub">Wording disimpan sesuai urutan struk. Teks Unicode/stylized dari luar akan dicopy persis seperti yang lo paste.</div><div class="receipt-editor-fields" id="receipt-editor-fields"></div><div class="receipt-editor-actions"><button type="button" class="btn btn-light" data-close-editor>Batal</button><button type="button" class="btn btn-green" id="receipt-editor-save">Simpan</button></div></div>`;document.body.appendChild(m);m.querySelectorAll('[data-close-editor]').forEach(b=>b.addEventListener('click',()=>m.classList.remove('show')));m.querySelector('#receipt-editor-save').addEventListener('click',saveEditor);return m;}
 function field(label,id,value='',placeholder=''){return `<div class="form-group"><label class="label">${esc(label)}</label><input class="input" id="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}"></div>`;}
 function openEditor(id,isNew=false){const m=editorModal(),fields=m.querySelector('#receipt-editor-fields');editingId=id;let item=draft.find(x=>x.id===id);if(isNew){item={id,type:'custom',enabled:true,label:'',value:'',style:'line'};draft.push(item)}m.querySelector('#receipt-editor-title').textContent=item.type==='custom'?(isNew?'Tambah Bagian / Wording':'Edit Bagian Custom'):`Edit ${builtinNames[item.key]||'Bagian'}`;
   let html='';if(item.type==='custom'){html+=`<div class="form-group"><label class="label">Tipe</label><select class="input" id="re-style"><option value="line" ${item.style!=='heading'?'selected':''}>Baris / Wording</option><option value="heading" ${item.style==='heading'?'selected':''}>Heading / Judul Bagian</option></select></div>`;html+=field('Wording / Label','re-label',item.label||'','Contoh: Notes');html+=field('Isi','re-value',item.value||'','Boleh dikosongkan');}
   else if(item.key==='title'){html+=field('Judul Struk','re-label',item.label||'','Kosong = nama workspace');}
   else if(item.key==='status'){html+=field('Label','re-label',item.label||'Status');html+=field('Isi Status','re-value',item.value||'On Progress');}
   else if(item.key==='shift'){html+=field('Label','re-label',item.label||'Shift');html+=field('Saat Ada Shift','re-active',item.activeValue||'Shift aktif');html+=field('Saat Tanpa Shift','re-none',item.noneValue||'Tanpa shift');}
   else if(item.key==='adjustment'){html+=field('Label Diskon','re-discount',item.discountLabel||labels().discount);html+=field('Label Kenaikan Harga','re-markup',item.markupLabel||labels().markup);}
   else if(item.key==='footer'){html+=`<div class="receipt-layout-note">Isi footer diedit langsung dari submenu <strong>Struk & Wording</strong>. Di sini lo menentukan apakah footer ditampilkan dan posisinya dalam urutan struk.</div>`;}
   else html+=field('Wording','re-label',item.label||builtinNames[item.key]||'');
   fields.innerHTML=html;m.dataset.newItem=isNew?'1':'0';m.classList.add('show');setTimeout(()=>fields.querySelector('input,select')?.focus(),30);
 }
 function saveEditor(){const m=editorModal(),item=draft.find(x=>x.id===editingId);if(!item)return;m.classList.remove('show');if(item.type==='custom'){item.style=document.getElementById('re-style')?.value||'line';item.label=document.getElementById('re-label')?.value.trim()||'';item.value=document.getElementById('re-value')?.value.trim()||'';}else if(item.key==='title'){item.label=document.getElementById('re-label')?.value.trim()||'';}else if(item.key==='status'){item.label=document.getElementById('re-label')?.value.trim()||'Status';item.value=document.getElementById('re-value')?.value.trim()||'On Progress';}else if(item.key==='shift'){item.label=document.getElementById('re-label')?.value.trim()||'Shift';item.activeValue=document.getElementById('re-active')?.value.trim()||'Shift aktif';item.noneValue=document.getElementById('re-none')?.value.trim()||'Tanpa shift';}else if(item.key==='adjustment'){item.discountLabel=document.getElementById('re-discount')?.value.trim()||'Diskon';item.markupLabel=document.getElementById('re-markup')?.value.trim()||'Kenaikan Harga';}else if(item.key!=='footer'){item.label=document.getElementById('re-label')?.value.trim()||builtinNames[item.key]||'';}layoutDirty=true;renderRows();}
 function renderRows(){
  const list=document.getElementById('receipt-layout-list');if(!list)return;
  list.innerHTML=draft.map((item,i)=>`<div class="receipt-layout-row ${item.enabled===false?'is-disabled':''}" data-id="${esc(item.id)}"><label class="receipt-layout-toggle"><input type="checkbox" data-toggle="${esc(item.id)}" ${item.enabled!==false?'checked':''}><div class="receipt-layout-meta"><div class="receipt-layout-name">${esc(item.type==='custom'?(item.style==='heading'?'Custom Heading':'Custom Wording'):(builtinNames[item.key]||item.key))}</div><div class="receipt-layout-preview">${esc(previewText(item))}</div></div></label><div></div><div class="receipt-layout-actions"><button type="button" class="receipt-icon-btn" data-edit="${esc(item.id)}" title="Edit wording">${svg.pencil}</button><button type="button" class="receipt-icon-btn" data-up="${esc(item.id)}" title="Naikkan" ${i===0?'disabled':''}>${svg.up}</button><button type="button" class="receipt-icon-btn" data-down="${esc(item.id)}" title="Turunkan" ${i===draft.length-1?'disabled':''}>${svg.down}</button>${item.type==='custom'?`<button type="button" class="receipt-icon-btn" data-remove="${esc(item.id)}" title="Hapus">${svg.trash}</button>`:''}</div></div>`).join('');
  list.querySelectorAll('[data-toggle]').forEach(x=>x.addEventListener('change',()=>{
    const it=draft.find(v=>v.id===x.dataset.toggle);if(!it)return;
    it.enabled=!!x.checked;layoutDirty=true;
    x.closest('.receipt-layout-row')?.classList.toggle('is-disabled',!x.checked);
  }));
  list.querySelectorAll('[data-edit]').forEach(x=>x.addEventListener('click',e=>{e.preventDefault();openEditor(x.dataset.edit,false)}));
  list.querySelectorAll('[data-up]').forEach(x=>x.addEventListener('click',e=>{e.preventDefault();move(x.dataset.up,-1)}));
  list.querySelectorAll('[data-down]').forEach(x=>x.addEventListener('click',e=>{e.preventDefault();move(x.dataset.down,1)}));
  list.querySelectorAll('[data-remove]').forEach(x=>x.addEventListener('click',e=>{e.preventDefault();draft=draft.filter(v=>v.id!==x.dataset.remove);layoutDirty=true;renderRows()}));
 }
 function move(id,delta){const i=draft.findIndex(x=>x.id===id),j=i+delta;if(i<0||j<0||j>=draft.length)return;[draft[i],draft[j]]=[draft[j],draft[i]];layoutDirty=true;renderRows();}
 function syncLegacyLabels(){const l={...labels()};draft.filter(x=>x.type==='builtin').forEach(x=>{if(x.key==='title')l.title=x.label||'';else if(x.key==='status'){l.status=x.label||'Status';l.status_value=x.value||'On Progress'}else if(x.key==='shift'){l.shift=x.label||'Shift';l.shift_active=x.activeValue||'Shift aktif';l.shift_none=x.noneValue||'Tanpa shift'}else if(x.key==='adjustment'){l.discount=x.discountLabel||'Diskon';l.markup=x.markupLabel||'Kenaikan Harga'}else if(x.key!=='footer')l[x.key]=x.label||l[x.key]||builtinNames[x.key]||x.key});return l;}
 async function saveLayout(){
   const btn=document.getElementById('receipt-layout-save');const oldText=btn?.textContent;
   try{
     requireWorkspaceRole(['owner','admin'],'mengubah layout struk');const wid=requireWorkspaceId();
     if(btn){btn.disabled=true;btn.textContent='Menyimpan…';}
     readDesignControls();
     const labelsPayload=syncLegacyLabels();
     labelsPayload.__layout_v2={version:2,items:draft,design:designDraft};
     labelsPayload.__design=designDraft;
     const layoutPayload={version:2,items:draft,design:designDraft};
     const footerInput=document.getElementById('settings-receipt-footer');const base={receipt_labels:labelsPayload,receipt_footer:footerInput?footerInput.value.trim()||null:(activeWorkspaceBranding?.receipt_footer||null),updated_at:new Date().toISOString()};
     let savedLayout=true;
     let res=await db.from('workspace_branding').update({...base,receipt_layout:layoutPayload}).eq('workspace_id',wid);
     if(res.error && String(res.error.message||res.error.details||'').includes('receipt_layout')){
       savedLayout=false;
       res=await db.from('workspace_branding').update(base).eq('workspace_id',wid);
     }
     if(res.error)throw res.error;
     // Verify a branding row exists. If it does not, create one.
     let check=await db.from('workspace_branding').select('workspace_id,receipt_labels').eq('workspace_id',wid).maybeSingle();
     if(check.error)throw check.error;
     if(!check.data){
       let ins=await db.from('workspace_branding').insert({workspace_id:wid,...base,...(savedLayout?{receipt_layout:layoutPayload}:{})});
       if(ins.error)throw ins.error;
     }
     activeWorkspaceBranding={...(activeWorkspaceBranding||{}),...base,receipt_layout:layoutPayload,workspace_id:wid};
     try{localStorage.setItem(`trine_receipt_layout_v2_${wid}`,JSON.stringify(layoutPayload));}catch(e){}
     layoutDirty=false;draft=normalizeLayout(layoutPayload).map(x=>({...x}));designDraft={...designDraft};renderRows();applyDesignControls();
     try{await loadWorkspaceSaasContext();activeWorkspaceBranding={...(activeWorkspaceBranding||{}),receipt_layout:activeWorkspaceBranding?.receipt_layout||layoutPayload,receipt_labels:{...(activeWorkspaceBranding?.receipt_labels||{}),...labelsPayload}};}catch(refreshErr){console.warn('Receipt settings saved; context refresh skipped',refreshErr);}
     showToast(savedLayout?'Layout, wording, dan desain struk tersimpan.':'Struk tersimpan lewat mode kompatibilitas. Layout tetap aktif.');
   }catch(err){console.error('saveLayout failed',err);showToast(err?.message||err?.details||'Gagal menyimpan pengaturan struk.',true);}
   finally{if(btn){btn.disabled=false;btn.textContent=oldText||'Simpan Pengaturan Struk';}}
 }
 function readDesignControls(){
   const get=id=>document.getElementById(id);designDraft={...designDraft,
     template:normalizeTemplate(get('receipt-design-template')?.value||designDraft.template||'pastel'),
     background:safeHex(get('receipt-design-bg')?.value,designDraft.background||'#FFFFFF'),
     text:safeHex(get('receipt-design-text')?.value,designDraft.text||'#2D3748'),
     accent:safeHex(get('receipt-design-accent')?.value,designDraft.accent||'#EA97A9'),
     watermark:String(get('receipt-design-watermark')?.value||'').trim(),
     watermarkOpacity:Number(get('receipt-design-watermark-opacity')?.value||8),
     watermarkSize:Number(get('receipt-design-watermark-size')?.value||54),
     fontFamily:String(get('receipt-design-font')?.value||designDraft.fontFamily||'Arial'),description:String(get('receipt-design-description')?.value||'').trim(),descriptionAlign:['left','center','right','justify'].includes(String(get('receipt-design-description-align')?.value||''))?String(get('receipt-design-description-align').value):'left',watermarkImage:String(designDraft.watermarkImage||''),showWorkspaceName:false};
 }
 function refreshTemplatePicker(){const hidden=document.getElementById('receipt-design-template');if(!hidden)return;const value=normalizeTemplate(hidden.value);document.querySelectorAll('[data-receipt-template-option]').forEach(b=>b.classList.toggle('active',b.dataset.receiptTemplateOption===value));}
 function wireTemplatePicker(){const hidden=document.getElementById('receipt-design-template');const grid=document.getElementById('receipt-template-grid');if(!hidden||!grid)return;grid.querySelectorAll('[data-receipt-template-option]').forEach(btn=>btn.onclick=()=>{hidden.value=normalizeTemplate(btn.dataset.receiptTemplateOption);layoutDirty=true;readDesignControls();refreshTemplatePicker();const host=document.getElementById('receipt-settings-preview');if(host&&host.style.display!=='none')previewReceiptFromSettings();});refreshTemplatePicker();}
 function updateColorSwatches(){
   ['receipt-design-bg','receipt-design-text','receipt-design-accent'].forEach(id=>{
     const input=document.getElementById(id); if(!input)return;
     const value=safeHex(input.value,'#FFFFFF').toUpperCase();
     input.style.setProperty('--receipt-swatch',value);
     input.style.background=value;
     const label=document.querySelector(`[data-color-hex="${id}"]`); if(label)label.textContent=value;
   });
 }
 function updateWatermarkPreview(){
   const box=document.getElementById('receipt-watermark-preview'); if(!box)return;
   const data=String(designDraft?.watermarkImage||'');
   if(data){box.innerHTML=`<img src="${esc(data)}" alt="Watermark preview">`;}
   else{box.innerHTML='<span style="font-size:11px;color:var(--muted)">Belum ada</span>';}
 }
 function wireWatermarkUpload(){
   const input=document.getElementById('receipt-watermark-file');
   const choose=document.getElementById('receipt-watermark-upload-btn');
   const remove=document.getElementById('receipt-watermark-remove-btn');
   if(!input||!choose||!remove)return;
   choose.onclick=()=>input.click();
   input.onchange=()=>{
     const file=input.files&&input.files[0]; if(!file)return;
     if(!/^image\/(png|jpeg|webp)$/i.test(file.type||'')){showToast('Format watermark harus PNG, JPG, atau WebP.',true);input.value='';return;}
     if(file.size>3*1024*1024){showToast('Ukuran watermark maksimal 3 MB.',true);input.value='';return;}
     const reader=new FileReader();
     reader.onload=()=>{designDraft={...designDraft,watermarkImage:String(reader.result||'')};layoutDirty=true;updateWatermarkPreview();showToast('Foto watermark siap dipakai. Jangan lupa simpan pengaturan struk.');};
     reader.onerror=()=>showToast('Gagal membaca foto watermark.',true);
     reader.readAsDataURL(file);
   };
   remove.onclick=()=>{designDraft={...designDraft,watermarkImage:''};input.value='';layoutDirty=true;updateWatermarkPreview();};
 }
 function fontLabel(font){const map={'Arial':'Clean / Arial','Avenir Next':'Modern / Avenir Next','Futura':'Minimal / Futura','Georgia':'Elegant / Georgia','Didot':'Fashion / Didot','Baskerville':'Editorial / Baskerville','Trebuchet MS':'Friendly / Trebuchet','Optima':'Soft / Optima','Marker Felt':'Cute / Marker Felt','Noteworthy':'Handwritten / Noteworthy','Chalkboard SE':'Playful / Chalkboard','Comic Sans MS':'Fun / Comic Sans','Snell Roundhand':'Script / Snell Roundhand','Copperplate':'Bold Classic / Copperplate','Courier New':'Mono / Courier'};return map[font]||font||'Clean / Arial';}
 function refreshFontPicker(){const hidden=document.getElementById('receipt-design-font'),label=document.getElementById('receipt-font-trigger-label'),menu=document.getElementById('receipt-font-menu');if(!hidden||!label)return;const font=hidden.value||'Arial';label.textContent=fontLabel(font);label.style.fontFamily=`${font}, sans-serif`;menu?.querySelectorAll('[data-font]').forEach(b=>b.classList.toggle('active',b.dataset.font===font));}
 function wireFontPicker(){const hidden=document.getElementById('receipt-design-font'),trigger=document.getElementById('receipt-font-trigger'),menu=document.getElementById('receipt-font-menu');if(!hidden||!trigger||!menu)return;trigger.onclick=e=>{e.stopPropagation();menu.classList.toggle('show')};menu.querySelectorAll('[data-font]').forEach(btn=>btn.onclick=()=>{hidden.value=btn.dataset.font||'Arial';menu.classList.remove('show');refreshFontPicker();hidden.dispatchEvent(new Event('input',{bubbles:true}))});document.addEventListener('click',e=>{if(!e.target.closest('#receipt-font-picker'))menu.classList.remove('show')});refreshFontPicker();}
 function applyDesignControls(){const d=designDraft||currentDesign();const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v};set('receipt-design-template',normalizeTemplate(d.template));set('receipt-design-bg',d.background);set('receipt-design-text',d.text);set('receipt-design-accent',d.accent);set('receipt-design-watermark',d.watermark||'');set('receipt-design-watermark-opacity',d.watermarkOpacity??8);set('receipt-design-watermark-size',d.watermarkSize??54);set('receipt-design-font',d.fontFamily||'Arial');set('receipt-design-description',d.description||'');set('receipt-design-description-align',d.descriptionAlign||'left');updateColorSwatches();updateWatermarkPreview();refreshFontPicker();refreshTemplatePicker();}
 function previewReceiptFromSettings(){
   try{
     readDesignControls();
     const host=document.getElementById('receipt-settings-preview');if(!host)return;
     const sellerPreview=isSellerReceiptContext();
     const dummy=sellerPreview
       ?{customer_name:'Nadia Putri',reading_started_at:new Date().toISOString(),reading_status:'done',shift_id:'preview-shift',platform:'WhatsApp',payment_method:'QRIS',order_items:[{name:'Netflix Premium — Sharing 1P — 1 Bulan',qty:1,subtotal:45000}],order_topics:[{name:'Streaming Apps'}],order_addons:[],price_adjustment_type:'discount',price_adjustment_mode:'nominal',price_adjustment_value:5000,price_adjustment_amount:-5000,tip_amount:0,total_price:40000}
       :{customer_name:'Nadia Putri',reading_started_at:new Date().toISOString(),reading_status:'done',shift_id:'preview-shift',platform:'Instagram',payment_method:'QRIS',order_items:[{name:'1 Question — 3 Cards',qty:1,subtotal:25000}],order_topics:[{name:'Love & Relationship'}],order_addons:[{name:'Priority Reading',qty:1,subtotal:5000}],price_adjustment_type:'discount',price_adjustment_mode:'nominal',price_adjustment_value:3000,price_adjustment_amount:-3000,tip_amount:5000,total_price:32000};
     const baseLayout=(Array.isArray(draft)&&draft.length?draft:currentLayout());
     const layout=sellerPreview?baseLayout.map(x=>x.key==='status'?{...x,value:'Completed'}:{...x}):baseLayout,d={...defaultDesign(),...designDraft};
     host.innerHTML=`<div class="receipt-preview-toolbar"><div><strong>Preview dengan data dummy</strong><div>Preview mengikuti checklist, wording, template, warna, font, deskripsi, dan watermark yang sedang lo edit.</div></div><button type="button" class="receipt-icon-btn" id="receipt-settings-preview-close" title="Tutup preview">×</button></div>${renderReceiptSurface(dummy,layout,d)}`;
     host.style.display='block';host.scrollIntoView({behavior:'smooth',block:'nearest'});host.querySelector('#receipt-settings-preview-close')?.addEventListener('click',()=>{host.style.display='none';});
   }catch(err){console.error('previewReceiptFromSettings failed',err);showToast(err?.message||'Gagal membuka preview struk.',true);}
 } function rebuildSettings(){const settings=document.getElementById('settings'),select=document.getElementById('settings-category-select');if(!settings||!select)return;const old=settings.querySelector('[data-settings-panel="receipt"]');if(old)old.remove();let option=[...select.options].find(o=>o.value==='receipt');if(!option){option=document.createElement('option');option.value='receipt';option.textContent='Struk & Wording';select.appendChild(option)}
   const panel=document.createElement('div');panel.className='settings-category-panel';panel.dataset.settingsPanel='receipt';panel.innerHTML=`<div class="card receipt-layout-card"><div class="receipt-layout-head"><div class="receipt-layout-head-copy"><div class="card-title">Struk & Wording</div><div class="page-sub">Checklist bagian yang mau muncul, edit wording, atur urutan, desain, dan watermark.</div></div><button type="button" class="btn btn-light receipt-add-btn" id="receipt-add-custom">${svg.plusPencil}<span>Tambah Bagian</span></button></div><div class="receipt-layout-list" id="receipt-layout-list"></div><div class="receipt-layout-note">Perubahan checklist dan wording disimpan saat lo tekan tombol simpan di bawah. Teks Unicode/stylized dari luar tetap dipertahankan saat struk dicopy.</div><div class="receipt-design-card"><div class="card-title" style="font-size:14px">Desain Foto Struk</div><div class="page-sub">Atur tampilan foto struk sebelum dikirim ke customer.</div><div class="receipt-template-section"><div class="label">Template Layout</div><input id="receipt-design-template" type="hidden" value="pastel"><div class="receipt-template-grid" id="receipt-template-grid">${RECEIPT_TEMPLATES.map(t=>`<button type="button" class="receipt-template-option" data-receipt-template-option="${t[0]}"><span class="receipt-template-thumb receipt-template-thumb-${t[0]}"><i></i><i></i><i></i><b>${esc(t[1].split(' ')[0])}</b></span><strong>${esc(t[1])}</strong><small>${esc(t[2])}</small></button>`).join('')}</div></div><div class="receipt-design-grid"><div class="form-group"><label class="label">Background</label><div class="receipt-color-wrap"><input id="receipt-design-bg" type="color"><span class="receipt-color-hex" data-color-hex="receipt-design-bg"></span></div></div><div class="form-group"><label class="label">Warna Teks</label><div class="receipt-color-wrap"><input id="receipt-design-text" type="color"><span class="receipt-color-hex" data-color-hex="receipt-design-text"></span></div></div><div class="form-group"><label class="label">Accent</label><div class="receipt-color-wrap"><input id="receipt-design-accent" type="color"><span class="receipt-color-hex" data-color-hex="receipt-design-accent"></span></div></div><div class="form-group"><label class="label">Gaya Font</label><div class="receipt-font-picker" id="receipt-font-picker"><input id="receipt-design-font" class="receipt-font-hidden" type="hidden" value="Arial"><button type="button" class="receipt-font-trigger" id="receipt-font-trigger"><span id="receipt-font-trigger-label" style="font-family:Arial,sans-serif">Clean / Arial</span><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button><div class="receipt-font-menu" id="receipt-font-menu"><button type="button" class="receipt-font-option" data-font="Arial" data-font-label="Clean / Arial" style="font-family:Arial,sans-serif"><span>Clean / Arial<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Clean</small></button><button type="button" class="receipt-font-option" data-font="Avenir Next" data-font-label="Modern / Avenir Next" style="font-family:'Avenir Next',sans-serif"><span>Modern / Avenir Next<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Modern</small></button><button type="button" class="receipt-font-option" data-font="Futura" data-font-label="Minimal / Futura" style="font-family:Futura,sans-serif"><span>Minimal / Futura<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Minimal</small></button><button type="button" class="receipt-font-option" data-font="Georgia" data-font-label="Elegant / Georgia" style="font-family:Georgia,serif"><span>Elegant / Georgia<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Elegant</small></button><button type="button" class="receipt-font-option" data-font="Didot" data-font-label="Fashion / Didot" style="font-family:Didot,serif"><span>Fashion / Didot<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Fashion</small></button><button type="button" class="receipt-font-option" data-font="Baskerville" data-font-label="Editorial / Baskerville" style="font-family:Baskerville,serif"><span>Editorial / Baskerville<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Editorial</small></button><button type="button" class="receipt-font-option" data-font="Trebuchet MS" data-font-label="Friendly / Trebuchet" style="font-family:'Trebuchet MS',sans-serif"><span>Friendly / Trebuchet<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Friendly</small></button><button type="button" class="receipt-font-option" data-font="Optima" data-font-label="Soft / Optima" style="font-family:Optima,sans-serif"><span>Soft / Optima<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Soft</small></button><button type="button" class="receipt-font-option" data-font="Marker Felt" data-font-label="Cute / Marker Felt" style="font-family:'Marker Felt',cursive"><span>Cute / Marker Felt<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Cute</small></button><button type="button" class="receipt-font-option" data-font="Noteworthy" data-font-label="Handwritten / Noteworthy" style="font-family:Noteworthy,cursive"><span>Handwritten / Noteworthy<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Handwritten</small></button><button type="button" class="receipt-font-option" data-font="Chalkboard SE" data-font-label="Playful / Chalkboard" style="font-family:'Chalkboard SE',cursive"><span>Playful / Chalkboard<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Playful</small></button><button type="button" class="receipt-font-option" data-font="Comic Sans MS" data-font-label="Fun / Comic Sans" style="font-family:'Comic Sans MS',cursive"><span>Fun / Comic Sans<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Fun</small></button><button type="button" class="receipt-font-option" data-font="Snell Roundhand" data-font-label="Script / Snell Roundhand" style="font-family:'Snell Roundhand',cursive"><span>Script / Snell Roundhand<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Script</small></button><button type="button" class="receipt-font-option" data-font="Copperplate" data-font-label="Bold Classic / Copperplate" style="font-family:Copperplate,serif"><span>Bold Classic / Copperplate<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Classic</small></button><button type="button" class="receipt-font-option" data-font="Courier New" data-font-label="Mono / Courier" style="font-family:'Courier New',monospace"><span>Mono / Courier<span class="receipt-font-sample">Aa Bb Cc 123</span></span><small>Mono</small></button></div></div></div><div class="form-group full"><label class="label">Deskripsi Struk</label><textarea id="receipt-design-description" class="input receipt-description-textarea" placeholder="Contoh: Terima kasih sudah menggunakan layanan kami."></textarea></div><div class="form-group"><label class="label">Perataan Deskripsi</label><select id="receipt-design-description-align" class="input"><option value="left">Rata Kiri</option><option value="center">Rata Tengah</option><option value="right">Rata Kanan</option><option value="justify">Rata Kiri Kanan</option></select></div><div class="form-group"><label class="label">Watermark Teks</label><input id="receipt-design-watermark" class="input" placeholder="${isSellerReceiptContext()?'Contoh: NAMA TOKO':'Contoh: TRINE MAGIC'}"></div><div class="form-group"><label class="label">Opacity Watermark (%)</label><input id="receipt-design-watermark-opacity" class="input" type="number" min="0" max="60" step="1"></div><div class="form-group"><label class="label">Ukuran Watermark</label><input id="receipt-design-watermark-size" class="input" type="number" min="24" max="180" step="2"></div><div class="form-group full"><label class="label">Upload Foto Watermark</label><div class="receipt-watermark-upload"><div class="receipt-watermark-preview" id="receipt-watermark-preview"><span style="font-size:11px;color:var(--muted)">Belum ada</span></div><input id="receipt-watermark-file" class="receipt-watermark-file" type="file" accept="image/png,image/jpeg,image/webp"><button type="button" class="btn btn-light" id="receipt-watermark-upload-btn">Pilih Foto</button><button type="button" class="btn btn-light" id="receipt-watermark-remove-btn">Hapus</button></div></div></div><div class="receipt-design-actions"><button type="button" class="btn btn-light" id="receipt-design-preview-btn">Preview Struk</button></div><div class="receipt-preview-live" id="receipt-settings-preview" style="display:none"></div></div><div class="receipt-layout-save"><button type="button" class="btn btn-green" id="receipt-layout-save">Simpan Pengaturan Struk</button></div></div>`;settings.appendChild(panel);
   const stored=(()=>{try{return JSON.parse(localStorage.getItem(`trine_receipt_layout_v2_${requireWorkspaceId()}`)||'null')}catch(e){return null}})();const src=receiptStore()||stored;draft=normalizeLayout(src).map(x=>({...x}));designDraft={...defaultDesign(),...(src?.design||activeWorkspaceBranding?.receipt_labels?.__design||{})};renderRows();applyDesignControls();
   panel.querySelector('#receipt-add-custom')?.addEventListener('click',()=>{layoutDirty=true;openEditor(`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,true)});panel.querySelector('#receipt-layout-save')?.addEventListener('click',saveLayout);
   panel.querySelectorAll('#receipt-design-bg,#receipt-design-text,#receipt-design-accent,#receipt-design-font,#receipt-design-description,#receipt-design-description-align,#receipt-design-watermark,#receipt-design-watermark-opacity,#receipt-design-watermark-size').forEach(el=>el.addEventListener('input',()=>{layoutDirty=true;readDesignControls();updateColorSwatches();const p=window.__trineLastReceiptPayload;if(p&&document.getElementById('receipt-modal')?.style.display==='flex'){const c=document.getElementById('receipt-content');if(c)c.innerHTML=buildHtml(p)}}));
   wireWatermarkUpload();wireFontPicker();wireTemplatePicker();panel.querySelector('#receipt-design-preview-btn')?.addEventListener('click',previewReceiptFromSettings);updateColorSwatches();updateWatermarkPreview();refreshFontPicker();const activate=()=>settings.querySelectorAll('.settings-category-panel').forEach(p=>p.classList.toggle('active',p.dataset.settingsPanel===select.value));select.addEventListener('change',activate);activate();
 }
 function wrapCanvasText(ctx,text,maxWidth){const words=String(text||'').split(/\s+/),lines=[];let line='';for(const w of words){const test=line?line+' '+w:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w}else line=test}if(line)lines.push(line);return lines.length?lines:[''];}
 function drawCanvasDescriptionLine(ctx,line,y,align,isLast,pad,inner,W){if(align==='justify'&&!isLast){const words=String(line).trim().split(/\s+/);if(words.length>1){const wordsWidth=words.reduce((sum,w)=>sum+ctx.measureText(w).width,0),gap=(inner-wordsWidth)/(words.length-1);let x=pad;ctx.textAlign='left';for(const w of words){ctx.fillText(w,x,y);x+=ctx.measureText(w).width+gap}return}}ctx.textAlign=align==='center'?'center':align==='right'?'right':'left';ctx.fillText(line,align==='center'?W/2:align==='right'?W-pad:pad,y);}
 function makeReceiptCanvas(p){
   readDesignControls();
   const d={...defaultDesign(),...(designDraft||currentDesign())},template=normalizeTemplate(d.template),canvasFont=receiptFontCss(d.fontFamily||'Arial');
   const W=1080,raw=(()=>{const out=[];currentLayout().forEach(x=>out.push(...itemText(x,p)));return out.join('\n').replace(/\n{3,}/g,'\n\n').trim()})().split('\n'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   const paperW=template==='boarding'?800:690,paperX=(W-paperW)/2,pad=54,inner=paperW-pad*2;
   ctx.font=`25px ${canvasFont}`;const measured=[];raw.forEach(line=>{if(!line.trim()){measured.push('');return}wrapCanvasText(ctx,line,inner).forEach(x=>measured.push(x))});
   const contentH=Math.max(720,measured.length*38+360),H=Math.max(1200,contentH+260);canvas.width=W;canvas.height=H;
   const bg=safeHex(d.background,'#FFFFFF'),tx=safeHex(d.text,'#2D3748'),ac=safeHex(d.accent,'#EA97A9'),business=String(activeWorkspaceName||'NAMA USAHA');
   function rect(x,y,w,h,fill){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h)}
   function line(x1,y1,x2,y2,color='#222',width=1,dash=[]){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore()}
   function text(t,x,y,size=24,font=canvasFont,color=tx,align='left',weight='400'){ctx.save();ctx.fillStyle=color;ctx.font=`${weight} ${size}px ${font}`;ctx.textAlign=align;ctx.fillText(String(t),x,y);ctx.restore()}
   function barcode(x,y,w,h){ctx.save();ctx.fillStyle='#111';let xx=x,i=0;while(xx<x+w){const bw=[2,4,3,7,2,5,3,2][i++%8];ctx.fillRect(xx,y,bw,h);xx+=bw+[3,2,4,3][i%4]}ctx.restore()}
   // Scene backgrounds + reference-specific hero elements.
   if(template==='pastel'){
     const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#f7dfe8');g.addColorStop(.5,'#dce7ff');g.addColorStop(1,'#abd3ff');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
     ctx.fillStyle='rgba(255,255,255,.66)';ctx.font='32px Arial';for(let yy=220;yy<H;yy+=130)for(let xx=40+(yy%260);xx<W;xx+=190)ctx.fillText('☆',xx,yy);
     rect(280,55,520,74,'#6eb3ec');text(business.toUpperCase(),540,108,47,'Arial','#fff','center','900');
     text('for',540,145,39,'Georgia','#ff8cae','center','400');rect(250,140,580,62,'#fff');text(isSellerReceiptContext()?'DIGITAL ACCESS MADE SIMPLE':'A KINDER TOMORROW',540,184,37,'Arial','#72b7eb','center','900');
     const mg=ctx.createLinearGradient(0,0,0,45);mg.addColorStop(0,'#c8cbd0');mg.addColorStop(.55,'#858a92');mg.addColorStop(1,'#c3c6cb');ctx.fillStyle=mg;ctx.fillRect(325,205,430,45);
   }else if(template==='studio'){
     rect(0,0,W,H,'#087eb9');ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=3;for(let x=170;x<W;x+=250){line(x,0,x,H,'rgba(0,0,0,.18)',3)}for(let y=55;y<H;y+=85){line(0,y,W,y,'rgba(255,255,255,.08)',2)}
     rect(65,45,130,95,'#203d9d');text('GOOD',130,77,24,'Arial','#fff','center','900');text('THINGS',130,104,24,'Arial','#fff','center','900');text('AHEAD',130,131,24,'Arial','#fff','center','900');
     rect(850,50,130,90,'#ff85af');text('DO YOUR',915,88,25,'Arial','#182d5a','center','900');text('BEST',915,119,25,'Arial','#182d5a','center','900');
   }else if(template==='receiptify'){
     rect(0,0,W,H,'#f5eaa5');const sq=120;for(let y=0;y<H;y+=sq)for(let x=0;x<W;x+=sq)if(((x+y)/sq)%2===0)rect(x,y,sq,sq,'#ef76a7');
   }else if(template==='vintage'){
     rect(0,0,W,H,'#f4f1e8');for(let i=0;i<900;i++){ctx.fillStyle='rgba(80,60,35,.035)';ctx.fillRect((i*97)%W,(i*53)%H,2,2)}
     ctx.save();ctx.translate(170,125);ctx.fillStyle='#1628a1';ctx.beginPath();for(let i=0;i<24;i++){const a=i*Math.PI/12,r=i%2?78:105;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.restore();text('VINTAGE',170,108,24,'Arial','#fff','center','900');text('VIBES',170,139,24,'Arial','#fff','center','900');text('ONLY',170,170,24,'Arial','#fff','center','900');
   }else if(template==='newspaper'){
     rect(0,0,W,H,'#d9d3c9');for(let x=20;x<W;x+=150){line(x,0,x,H,'rgba(0,0,0,.07)',1)}text('THE DAILY ORDER',540,70,42,'Georgia','#111','center','900');line(70,92,1010,92,'#111',4);line(70,104,1010,104,'#111',1);
   }else if(template==='boarding'){
     rect(0,0,W,H,'#0d5f9a');text('✈  BUSINESS CLASS',70,72,32,'Arial','#fff','left','800');text('A SMALL BUSINESS GOES A LONG WAY',1010,70,16,'Arial','#fff','right','700');
   }else if(template==='diner'){
     rect(0,0,W,H,'#f4e5c1');const sq=54;for(let y=0;y<H;y+=sq)for(let x=0;x<W;x+=sq)if(((x+y)/sq)%2===0)rect(x,y,sq,sq,'#c7372f');
   }else{
     const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#d7d0c7');g.addColorStop(.25,'#f4efe7');g.addColorStop(.78,'#f4efe7');g.addColorStop(1,'#d9d1c5');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);text('❧',930,H-110,72,'Georgia','#8d7454','center','400');
   }
   // paper
   let paperY=template==='pastel'?265:template==='studio'?180:150;ctx.save();ctx.shadowColor='rgba(0,0,0,.22)';ctx.shadowBlur=28;ctx.shadowOffsetY=14;rect(paperX,paperY,paperW,H-paperY-100,template==='vintage'?'#f9f7f1':template==='diner'?'#fff4d8':template==='luxury'?'#fdfbf6':template==='receiptify'?'#f8f7f3':template==='newspaper'?'#f5f0e7':template==='boarding'?'#eff7ff':bg);ctx.restore();
   if(template==='receiptify')rect(paperX,paperY,paperW,155,'#b9b8ee');
   if(template==='boarding'){line(paperX+paperW*.76,paperY,paperX+paperW*.76,H-100,'#6d91aa',3,[12,10])}
   if(template==='diner'){ctx.strokeStyle='#c7372f';ctx.lineWidth=4;ctx.strokeRect(paperX+16,paperY+16,paperW-32,H-paperY-132)}
   let y=paperY+70;
   if(template==='studio'){text(business.toUpperCase(),W/2,y,45,'Arial','#168dca','center','900');y+=38;text('QUALITY MAKES A DIFFERENCE',W/2,y,14,'Courier New','#111','center','700');y+=45}
   else if(template==='receiptify'){text(business.toUpperCase(),paperX+pad,y,44,'Arial','#292c32','left','900');y+=36;rect(paperX+pad,y-24,360,32,'#ef7da9');text('GOOD PEOPLE, GOOD BUSINESS',paperX+pad+180,y,16,'Arial','#303039','center','800');y+=55}
   else if(template==='vintage'){text('★',paperX+120,y,35,'Georgia','#6e0e1e','center','900');text(business.toUpperCase(),W/2,y,36,'Georgia','#6e0e1e','center','900');text('★',paperX+paperW-120,y,35,'Georgia','#6e0e1e','center','900');y+=28;text('MORE THAN JUST A BUSINESS',W/2,y,12,'Arial','#6e0e1e','center','700');y+=40;line(paperX+pad,y,paperX+paperW-pad,y,'#222',2);y+=30}
   else if(template==='newspaper'){text('The Daily Order',W/2,y,42,'Georgia','#111','center','900');y+=18;line(paperX+pad,y,paperX+paperW-pad,y,'#111',4);y+=45;text(business.toUpperCase(),paperX+pad,y,34,'Arial','#111','left','900');y+=25;text('SMALL BUSINESS, BIG IMPACT',paperX+pad,y,13,'Courier New','#111','left','700');y+=45}
   else if(template==='boarding'){text(business.toUpperCase(),paperX+pad,y,37,'Arial','#19689f','left','900');y+=27;text('BOARDING TO A BRIGHTER TOMORROW',paperX+pad,y,12,'Arial','#254055','left','700');y+=45}
   else if(template==='diner'){text(business.toUpperCase(),W/2,y,38,'Arial','#c7372f','center','900');y+=27;text('ALWAYS A GOOD CHOICE',W/2,y,13,'Courier New','#c7372f','center','700');y+=45}
   else if(template==='luxury'){text('❧',W/2,y,38,'Georgia','#a27c4e','center','400');y+=40;text(business.toUpperCase(),W/2,y,34,'Georgia','#111','center','400');y+=28;text('BEAUTY IN EVERY DETAIL',W/2,y,12,'Courier New','#111','center','600');y+=50}
   if(d.description){ctx.fillStyle=tx;ctx.font=`600 22px ${canvasFont}`;const descLines=wrapCanvasText(ctx,d.description,inner);descLines.forEach((l,i)=>{text(l,W/2,y,22,canvasFont,tx,'center','600');y+=30});y+=18;line(paperX+pad,y,paperX+paperW-pad,y,ac,1,[7,7]);y+=28}
   const bodyColor=template==='vintage'||template==='receiptify'||template==='newspaper'||template==='diner'||template==='luxury'?'#171717':tx;
   ctx.fillStyle=bodyColor;for(const l of measured){if(!l){y+=15;continue}const isTotal=/total\s*:/i.test(l);text(l,paperX+pad,y,isTotal?27:23,template==='luxury'?'Courier New':canvasFont,bodyColor,'left',isTotal?'800':'400');y+=isTotal?44:35}
   y+=30;barcode(W/2-210,y,420,80);y+=105;text('powered by kairo workspaces',W/2,y,16,'Courier New','#333','center','400');
   return canvas;
 }
 async function receiptImageBlob(){const p=window.__trineLastReceiptPayload;if(!p)throw new Error('Belum ada struk untuk dibuat foto.');const canvas=makeReceiptCanvas(p);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Gagal membuat PNG.')),'image/png',1));}
 async function saveReceiptImage(){try{const blob=await receiptImageBlob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`struk-${String(window.__trineLastReceiptPayload?.customer_name||'customer').replace(/[^a-z0-9_-]+/gi,'-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);showToast('Foto struk PNG berhasil disimpan.')}catch(err){showToast(err.message||'Gagal membuat foto struk.',true)}}
 async function shareReceiptImage(){try{const blob=await receiptImageBlob(),file=new File([blob],'struk.png',{type:'image/png'});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({files:[file],title:'Struk '+(activeWorkspaceName||'')});showToast('Foto struk siap dibagikan.')}else{await saveReceiptImage();showToast('Browser ini belum mendukung share file langsung. PNG sudah disimpan.')}}catch(err){if(err?.name!=='AbortError')showToast(err.message||'Gagal membagikan foto struk.',true)}}
 function installImageButtons(){const copy=document.getElementById('copy-receipt');if(!copy||document.getElementById('save-receipt-image'))return;const save=document.createElement('button');save.type='button';save.id='save-receipt-image';save.className='btn btn-light receipt-image-btn';save.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></svg><span>Simpan PNG</span>';save.addEventListener('click',saveReceiptImage);copy.insertAdjacentElement('afterend',save);const share=document.createElement('button');share.type='button';share.id='share-receipt-image';share.className='btn btn-light receipt-image-btn';share.innerHTML='<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5m-8 7 8 5"/></svg><span>Bagikan Foto</span>';share.addEventListener('click',shareReceiptImage);save.insertAdjacentElement('afterend',share)}
 function init(){installPreview();installCopyHandler();installImageButtons();rebuildSettings();const oldHydrate=window.hydrateSaasUi;if(typeof oldHydrate==='function'){window.hydrateSaasUi=function(){const r=oldHydrate.apply(this,arguments);setTimeout(()=>{if(!layoutDirty){const stored=(()=>{try{return JSON.parse(localStorage.getItem(`trine_receipt_layout_v2_${requireWorkspaceId()}`)||'null')}catch(e){return null}})();const src=receiptStore()||stored;draft=normalizeLayout(src).map(x=>({...x}));designDraft={...defaultDesign(),...(src?.design||activeWorkspaceBranding?.receipt_labels?.__design||{})};renderRows();applyDesignControls()}installImageButtons()},0);return r}}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  const CATEGORY_LABELS={workspace:'Workspace & Branding',packages:'Package & Harga',addons:'Add-on & Harga',topics:'Topik',profit:'Pembagian Omzet',receipt:'Struk & Wording'};
  let menuOpen=true;

  function getSelect(){return document.getElementById('settings-category-select');}
  function getSettingsButton(){return document.getElementById('saas-settings-side-btn');}
  function ensureSubmenu(){
    const settingsBtn=getSettingsButton();
    if(!settingsBtn)return null;
    let menu=document.getElementById('saas-settings-submenu');
    if(!menu){
      menu=document.createElement('div');
      menu.id='saas-settings-submenu';
      menu.className='saas-settings-submenu';
      menu.setAttribute('aria-label','Submenu Settings');
      settingsBtn.insertAdjacentElement('afterend',menu);
    }
    // Keep the submenu physically anchored directly under Settings even after sidebar reordering.
    if(menu.previousElementSibling!==settingsBtn) settingsBtn.insertAdjacentElement('afterend',menu);
    rebuildSubmenu(menu);
    return menu;
  }

  function rebuildSubmenu(menu){
    const select=getSelect();
    if(!menu||!select)return;
    const opts=[...select.options].filter(o=>o.value);
    const signature=opts.map(o=>o.value+':'+o.textContent).join('|');
    if(menu.dataset.signature===signature){syncActive();return;}
    menu.dataset.signature=signature;
    menu.innerHTML='';
    opts.forEach(o=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='saas-settings-submenu-btn';
      b.dataset.settingsCategory=o.value;
      b.textContent=o.value==='topics'?topicFieldLabel():(CATEGORY_LABELS[o.value]||o.textContent||o.value);
      b.addEventListener('click',e=>{
        e.stopPropagation();
        const hidden=getSelect();if(!hidden)return;
        hidden.value=o.value;
        hidden.dispatchEvent(new Event('change',{bubbles:true}));
        try{localStorage.setItem('trine_settings_category_v1',o.value)}catch(err){}
        menuOpen=true;
        syncActive();
      });
      menu.appendChild(b);
    });
    syncActive();
  }

  function syncActive(){
    const menu=document.getElementById('saas-settings-submenu');
    const select=getSelect();
    const activeSection=document.querySelector('.section.active')?.id;
    if(!menu||!select)return;
    menu.querySelectorAll('.saas-settings-submenu-btn').forEach(b=>b.classList.toggle('active',b.dataset.settingsCategory===select.value));
    const shouldShow=activeSection==='settings' && menuOpen && !document.body.classList.contains('saas-sidebar-collapsed');
    menu.classList.toggle('open',shouldShow);
  }

  function wire(){
    const settingsBtn=getSettingsButton();
    const select=getSelect();
    if(!settingsBtn||!select)return;
    ensureSubmenu();
    const shell=select.closest('.settings-category-shell');if(shell)shell.style.display='none';

    if(!settingsBtn.dataset.submenuWired){
      settingsBtn.dataset.submenuWired='1';
      settingsBtn.addEventListener('click',()=>{
        if(document.body.classList.contains('saas-sidebar-collapsed')){
          document.getElementById('saas-collapse-btn')?.click();
          menuOpen=true;
        }else if(document.querySelector('.section.active')?.id==='settings'){
          menuOpen=!menuOpen;
        }else{
          menuOpen=true;
        }
        setTimeout(syncActive,30);
      });
    }
    if(!select.dataset.sidebarSyncWired){
      select.dataset.sidebarSyncWired='1';
      select.addEventListener('change',()=>{menuOpen=true;syncActive();});
    }

    const menu=document.getElementById('saas-settings-submenu');
    const observer=new MutationObserver(()=>rebuildSubmenu(menu));
    observer.observe(select,{childList:true,subtree:true});

    document.addEventListener('click',e=>{
      if(e.target.closest('#saas-settings-side-btn,#saas-settings-submenu'))return;
      if(document.querySelector('.section.active')?.id!=='settings')menuOpen=false;
      syncActive();
    });
    document.querySelectorAll('#saas-sidebar .tab').forEach(tab=>tab.addEventListener('click',()=>{menuOpen=false;setTimeout(syncActive,20)}));
    document.getElementById('saas-collapse-btn')?.addEventListener('click',()=>setTimeout(syncActive,20));

    const sectionObserver=new MutationObserver(syncActive);
    document.querySelectorAll('.section').forEach(sec=>sectionObserver.observe(sec,{attributes:true,attributeFilter:['class']}));
    syncActive();
  }

  function init(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(getSettingsButton()&&getSelect()){clearInterval(timer);wire();}
      else if(tries>80)clearInterval(timer);
    },50);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  const KEY='trine_saas_appearance_v1';
  const btn=document.getElementById('saas-theme-toggle');
  if(!btn)return;
  let transitionTimer=null;
  function apply(mode,{animate=false}={}){
    const dark=mode==='dark';
    if(animate){
      document.body.classList.add('saas-theme-transition');
      clearTimeout(transitionTimer);
      transitionTimer=setTimeout(()=>document.body.classList.remove('saas-theme-transition'),620);
    }
    // Force one frame before flipping classes so Safari can interpolate the colors smoothly.
    const commit=()=>{
      document.body.classList.toggle('saas-dark',dark);
      document.documentElement.style.colorScheme=dark?'dark':'light';
      btn.setAttribute('aria-label',dark?'Aktifkan light mode':'Aktifkan dark mode');
      btn.title=dark?'Light mode':'Dark mode';
      localStorage.setItem(KEY,dark?'dark':'light');
      setTimeout(()=>{
        try{[window.dailyChart,window.packageChart,window.monthlyRevenueChart,window.topicChart,window.platformChart].forEach(c=>c?.update?.())}catch(e){}
      },90);
    };
    if(animate) requestAnimationFrame(()=>requestAnimationFrame(commit)); else commit();
  }
  apply(localStorage.getItem(KEY)==='dark'?'dark':'light');
  btn.addEventListener('click',()=>apply(document.body.classList.contains('saas-dark')?'light':'dark',{animate:true}));
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  function unlockReceiptPageScroll(preserveY){
    const y=Number.isFinite(preserveY)?preserveY:(window.scrollY||window.pageYOffset||0);
    document.body.style.position='';
    document.body.style.top='';
    document.body.style.left='';
    document.body.style.right='';
    document.body.style.width='';
    document.body.style.overflow='';
    delete document.body.dataset.receiptScrollY;
    requestAnimationFrame(()=>window.scrollTo(0,y));
  }

  function install(){
    if(typeof window.showReceiptPreview!=='function' || window.showReceiptPreview.__bgScrollPatched)return;
    const originalShow=window.showReceiptPreview;
    const wrapped=function(p){
      const y=window.scrollY||window.pageYOffset||0;
      originalShow(p);
      unlockReceiptPageScroll(y);
      const modal=document.getElementById('receipt-modal');
      if(modal)modal.dataset.backgroundScroll='1';
    };
    wrapped.__bgScrollPatched=true;
    window.showReceiptPreview=wrapped;

    window.closeReceiptPreview=function(){
      const modal=document.getElementById('receipt-modal');
      if(modal)modal.style.display='none';
      unlockReceiptPageScroll(window.scrollY||window.pageYOffset||0);
    };
  }

  install();
  setTimeout(install,0);
  setTimeout(install,250);

  /* If another late script replaces the preview renderer, patch it again once Settings has finished booting. */
  window.addEventListener('load',()=>setTimeout(install,50),{once:true});
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  function syncCashWorkspaceName(){
    const el=document.getElementById('cash-workspace-name');
    if(el) el.textContent=(typeof activeWorkspaceName!=='undefined' && activeWorkspaceName) ? activeWorkspaceName : 'Workspace';
  }

  function installHydrateHook(){
    if(typeof window.hydrateSaasUi!=='function' || window.hydrateSaasUi.__cashWorkspacePatched) return;
    const original=window.hydrateSaasUi;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      syncCashWorkspaceName();
      setTimeout(syncCashWorkspaceName,0);
      return result;
    };
    wrapped.__cashWorkspacePatched=true;
    window.hydrateSaasUi=wrapped;
  }

  function init(){
    syncCashWorkspaceName();
    installHydrateHook();
    setTimeout(()=>{installHydrateHook();syncCashWorkspaceName();},0);
    setTimeout(()=>{installHydrateHook();syncCashWorkspaceName();},300);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  window.addEventListener('load',()=>setTimeout(init,50),{once:true});
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  function rand(min,max){return Math.random()*(max-min)+min}
  function mountOrigami(){
    if(document.getElementById('living-origami-bg')) return;
    const bg=document.createElement('div');bg.id='living-origami-bg';bg.className='living-origami-bg';bg.setAttribute('aria-hidden','true');
    const lowPower = matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    const veryLowPower = matchMedia('(max-width: 480px)').matches || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    document.body.classList.toggle('origami-lite', lowPower);
    const count = veryLowPower ? 4 : lowPower ? 6 : 9;
    for(let i=0;i<count;i++){
      const d=document.createElement('div');d.className='origami-drifter';
      d.style.setProperty('--y-start',`${rand(-38,38)}vh`);d.style.setProperty('--y-end',`${rand(-38,38)}vh`);d.style.setProperty('--r-start',`${rand(-18,18)}deg`);d.style.setProperty('--r-end',`${rand(-18,18)}deg`);d.style.setProperty('--scale',rand(.34,.76).toFixed(2));d.style.animationDuration=`${rand(lowPower?34:28,lowPower?54:46).toFixed(1)}s`;d.style.animationDelay=`${rand(-48,0).toFixed(1)}s`;
      d.innerHTML='<div class="origami-crane" style="animation-delay:'+rand(-4,0).toFixed(1)+'s"><div class="origami-part origami-body"></div><div class="origami-part origami-wing-left"></div><div class="origami-part origami-wing-right"></div><div class="origami-part origami-tail"></div><div class="origami-part origami-head"></div></div>';
      bg.appendChild(d);
    }
    document.body.prepend(bg);
    const syncPause=()=>document.body.classList.toggle('origami-paused',document.hidden);
    document.addEventListener('visibilitychange',syncPause,{passive:true});
    syncPause();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountOrigami);else mountOrigami();
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
 const DEFAULT_SLOGAN='';
 window.dashboardSlogan=function(){return String(activeWorkspaceBranding?.receipt_labels?.__dashboard_slogan||DEFAULT_SLOGAN).trim()||DEFAULT_SLOGAN};
 const HISTORY_KEY='trine_transaction_history_collapsed_v1';
 let historyCollapsed=localStorage.getItem(HISTORY_KEY)==='1';
 function syncSlogan(){const e=document.getElementById('dashboard-slogan-display')||document.querySelector('main.container .page-sub');if(document.querySelector('.section.active')?.id==='dashboard'&&e)e.textContent=dashboardSlogan();const i=document.getElementById('settings-dashboard-slogan');if(i)i.value=dashboardSlogan();}
 function syncHistory(){const card=document.getElementById('transaction-history-card'),btn=document.getElementById('history-collapse-btn');if(!card||!btn)return;card.classList.toggle('is-collapsed',historyCollapsed);btn.setAttribute('aria-expanded',historyCollapsed?'false':'true');btn.title=historyCollapsed?'Expand riwayat transaksi':'Minimize riwayat transaksi';const sp=btn.querySelector('span');if(sp)sp.textContent=historyCollapsed?'Expand':'Minimize';if(historyCollapsed){const body=document.getElementById('tx-table-body');if(body)body.innerHTML='';}else if(typeof renderHistory==='function')renderHistory();}
 document.getElementById('history-collapse-btn')?.addEventListener('click',()=>{historyCollapsed=!historyCollapsed;localStorage.setItem(HISTORY_KEY,historyCollapsed?'1':'0');syncHistory();});
 if(typeof renderHistory==='function'){const old=renderHistory;renderHistory=function(){if(historyCollapsed){const body=document.getElementById('tx-table-body');if(body)body.innerHTML='';return;}return old.apply(this,arguments)}}
 function isPro(){return String(activeWorkspacePlan||'basic').toLowerCase()==='pro'}
 function lockPerformanceNav(){document.querySelectorAll('[data-tab="performance"],.saas-mobile-nav-btn[data-mobile-tab="performance"]').forEach(btn=>{btn.classList.remove('plan-locked','entitlement-locked');btn.setAttribute('aria-disabled','false');btn.querySelector('.saas-nav-lock')?.remove()})}
 const oldOpen=window.openAppPage||openAppPage;window.openAppPage=function(tab){return oldOpen.apply(this,arguments)};try{openAppPage=window.openAppPage}catch(e){}
 function wireTools(){const tr=document.getElementById('orders-tool-trigger'),label=document.getElementById('orders-tool-trigger-label'),menu=document.getElementById('orders-tool-menu'),auto=document.getElementById('smart-sales-open'),manual=document.getElementById('manual-orders-select');if(!tr||!menu)return;const close=()=>{menu.hidden=true;tr.setAttribute('aria-expanded','false')};const sync=()=>{const p=isPro();if(auto){auto.disabled=!p;auto.title=p?'':'Autofill Orders tersedia di paket PRO.';auto.setAttribute('aria-disabled',p?'false':'true')}};tr.onclick=e=>{e.stopPropagation();const open=menu.hidden;menu.hidden=!open;tr.setAttribute('aria-expanded',open?'true':'false')};manual&&(manual.onclick=e=>{e.preventDefault();e.stopPropagation();if(label)label.textContent='Manual Orders';manual.classList.add('is-active');auto?.classList.remove('is-active');close();document.getElementById('tx-form')?.scrollIntoView({behavior:'smooth',block:'start'})});auto&&(auto.onclick=e=>{if(!isPro()){e.preventDefault();e.stopPropagation();if(label)label.textContent='Manual Orders';manual?.classList.add('is-active');auto.classList.remove('is-active');showToast('Autofill Orders tersedia di paket PRO.',true);close();return}if(label)label.textContent='Autofill Orders';auto.classList.add('is-active');manual?.classList.remove('is-active');close()});document.addEventListener('click',e=>{if(!e.target.closest('#orders-tool-dropdown'))close()});sync()}
 function formatPlanValidity(){const s=activeWorkspaceSubscription||{};const raw=s.current_period_end||s.expires_at||s.end_date||s.valid_until||s.trial_ends_at||null;if(!raw)return 'Belum ditentukan';const d=new Date(raw);return Number.isNaN(d.getTime())?String(raw):d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}
 function renderAccess(){const box=document.getElementById('settings-access-list');if(!box)return;const pro=isPro();const rows=pro?['Dashboard & operasional utama','Performance analytics','Autofill Orders','Custom branding & tampilan']:['Dashboard & operasional utama','Petty Cash, Withdraw, Orders & Customer Database','Performance terbatas di paket basic','Autofill Orders terkunci di paket basic'];box.innerHTML=rows.map((x,i)=>`<div class="settings-access-item"><svg viewBox="0 0 24 24" aria-hidden="true">${(!pro&&i>=2)?'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>':'<path d="m5 12 4 4L19 6"/>'}</svg><span>${x}</span></div>`).join('')}
 function ensureReceiptFooter(){const panel=document.querySelector('[data-settings-panel="receipt"] .receipt-layout-card');if(!panel||document.getElementById('settings-receipt-footer'))return;const box=document.createElement('div');box.className='receipt-footer-moved';box.innerHTML='<div class="form-group"><label class="label">Footer Struk</label><input id="settings-receipt-footer" class="input" type="text" maxlength="180" placeholder="Terima kasih sudah menggunakan layanan kami"></div>';const head=panel.querySelector('.receipt-layout-head');head?.insertAdjacentElement('afterend',box);const footer=document.getElementById('settings-receipt-footer');footer.value=activeWorkspaceBranding?.receipt_footer||'';footer.addEventListener('input',()=>{if(activeWorkspaceBranding)activeWorkspaceBranding.receipt_footer=footer.value.trim()||null;const p=window.__trineLastReceiptPayload;if(p&&document.getElementById('receipt-modal')?.style.display==='flex'&&typeof showReceiptPreview==='function'){const c=document.getElementById('receipt-content');if(c&&typeof buildHtml==='function')c.innerHTML=buildHtml(p)}})}
 const oldHydrate=window.hydrateSaasUi||hydrateSaasUi;window.hydrateSaasUi=function(){const r=oldHydrate.apply(this,arguments);setTimeout(()=>{syncSlogan();const v=document.getElementById('settings-meta-validity');if(v)v.textContent=formatPlanValidity();renderAccess();lockPerformanceNav();wireTools();ensureReceiptFooter();},0);return r};try{hydrateSaasUi=window.hydrateSaasUi}catch(e){}
 const oldBuildSidebar=window.buildSidebar;setTimeout(()=>{lockPerformanceNav();wireTools();syncHistory();syncSlogan();renderAccess();const v=document.getElementById('settings-meta-validity');if(v)v.textContent=formatPlanValidity();},80);
 
 // Add moved receipt footer to receipt save payload without changing database schema.
 const observer=new MutationObserver(()=>ensureReceiptFooter());observer.observe(document.getElementById('settings')||document.body,{childList:true,subtree:true});
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  const PREMIUM_SETTINGS=new Set(['profit','receipt']);
  const isProPlan=()=>String(window.activeWorkspacePlan||activeWorkspacePlan||'basic').toLowerCase()==='pro';
  const lockSvg='<span class="settings-submenu-lock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>';

  function decorateSettingsLocks(){
    const menu=document.getElementById('saas-settings-submenu');
    if(!menu)return;
    const pro=isProPlan();
    menu.querySelectorAll('.saas-settings-submenu-btn').forEach(btn=>{
      const locked=!pro&&PREMIUM_SETTINGS.has(btn.dataset.settingsCategory);
      btn.classList.toggle('settings-pro-locked',locked);
      btn.setAttribute('aria-disabled',locked?'true':'false');
      btn.title=locked?'Fitur ini tersedia di paket PRO.':'';
      const old=btn.querySelector('.settings-submenu-lock');
      if(locked&&!old)btn.insertAdjacentHTML('beforeend',lockSvg);
      if(!locked&&old)old.remove();
    });
  }

  function guardLockedSelection(){
    if(isProPlan())return;
    const select=document.getElementById('settings-category-select');
    if(select&&PREMIUM_SETTINGS.has(select.value)){
      select.value='workspace';
      select.dispatchEvent(new Event('change',{bubbles:true}));
      try{localStorage.setItem('trine_settings_category_v1','workspace')}catch(e){}
    }
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('.saas-settings-submenu-btn');
    if(!btn||isProPlan()||!PREMIUM_SETTINGS.has(btn.dataset.settingsCategory))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showToast('Fitur ini tersedia di paket PRO.',true);
  },true);

  document.addEventListener('change',e=>{
    if(e.target?.id!=='settings-category-select'||isProPlan())return;
    if(PREMIUM_SETTINGS.has(e.target.value)){
      e.preventDefault();
      e.target.value='workspace';
      e.target.dispatchEvent(new Event('change',{bubbles:true}));
      showToast('Fitur ini tersedia di paket PRO.',true);
    }
  },true);

  function refresh(){decorateSettingsLocks();guardLockedSelection()}
  const boot=()=>{
    refresh();
    const target=document.getElementById('saas-sidebar')||document.body;
    new MutationObserver(()=>decorateSettingsLocks()).observe(target,{childList:true,subtree:true});
    setTimeout(refresh,120);
    setTimeout(refresh,600);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  const previousHydrate=window.hydrateSaasUi;
  if(typeof previousHydrate==='function'){
    window.hydrateSaasUi=function(){const r=previousHydrate.apply(this,arguments);setTimeout(refresh,0);return r};
    try{hydrateSaasUi=window.hydrateSaasUi}catch(e){}
  }
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
 const plus=()=>planAtLeast('plus'), pro=()=>planAtLeast('pro');
 const lockedMsg=(feature)=>({customer_database:'Customer Database',open_close_store:'Open / Close Store',export_excel:'Export Excel',autofill_orders:'Autofill Orders',custom_branding:'Custom Branding',receipt_customization:'Struk & Wording',multi_partner_profit_share:'Pembagian Omzet'}[feature]||'Fitur ini')+' tersedia mulai paket PLUS.';
 function decorate(){
   // Performance: PLUS basic, PRO full.
   document.querySelectorAll('[data-tab="performance"],.saas-mobile-nav-btn[data-mobile-tab="performance"]').forEach(b=>{b.querySelector('.saas-nav-lock')?.remove();b.querySelector('.kairo-menu-lock')?.remove();b.classList.remove('plan-locked','entitlement-locked','kairo-feature-locked');b.setAttribute('aria-disabled','false')});
   // Autofill is PLUS+, not PRO-only.
   const auto=document.getElementById('smart-sales-open');if(auto){auto.disabled=!plus();auto.setAttribute('aria-disabled',plus()?'false':'true');auto.title=plus()?'':'Autofill Orders tersedia mulai paket PLUS.';const badge=auto.querySelector('.pro-inline-badge');if(badge)badge.textContent='PLUS';}
   // Settings profit + receipt are PLUS+.
   document.querySelectorAll('.saas-settings-submenu-btn').forEach(b=>{if(!['profit','receipt'].includes(b.dataset.settingsCategory))return;b.classList.toggle('settings-pro-locked',!plus());b.setAttribute('aria-disabled',plus()?'false':'true');b.title=plus()?'':'Tersedia mulai paket PLUS.';if(plus())b.querySelector('.settings-submenu-lock')?.remove();});
   // Customer DB BASIC lock.
   document.querySelectorAll('[data-tab="customers"],.saas-mobile-nav-btn[data-mobile-tab="customers"]').forEach(b=>b.classList.toggle('entitlement-locked',!canUseFeature('customer_database')));
   // Open/Close buttons BASIC lock.
   ['open-shift-btn','close-shift-btn'].forEach(id=>{const b=document.getElementById(id);if(b&&!canUseFeature('open_close_store')){b.disabled=true;b.title='Open / Close Store tersedia mulai paket PLUS.';}});
 }
 // Capture guards, centralized around entitlement keys.
 document.addEventListener('click',e=>{
   const cust=e.target.closest('[data-tab="customers"],.saas-mobile-nav-btn[data-mobile-tab="customers"]');if(cust&&!canUseFeature('customer_database')){e.preventDefault();e.stopImmediatePropagation();showToast(lockedMsg('customer_database'),true);return;}
   const shift=e.target.closest('#open-shift-btn,#close-shift-btn');if(shift&&!canUseFeature('open_close_store')){e.preventDefault();e.stopImmediatePropagation();showToast(lockedMsg('open_close_store'),true);return;}
   const auto=e.target.closest('#smart-sales-open');if(auto&&!canUseFeature('autofill_orders')){e.preventDefault();e.stopImmediatePropagation();showToast(lockedMsg('autofill_orders'),true);return;}
   const set=e.target.closest('.saas-settings-submenu-btn');if(set&&['profit','receipt'].includes(set.dataset.settingsCategory)&&!plus()){e.preventDefault();e.stopImmediatePropagation();showToast('Menu ini tersedia mulai paket PLUS.',true);return;}
 },true);
 // Wrap export: BASIC blocked, PLUS/PRO normal.
 if(typeof window.exportExcel==='function'||typeof exportExcel==='function'){const old=window.exportExcel||exportExcel;window.exportExcel=function(){if(!canUseFeature('export_excel')){showToast(lockedMsg('export_excel'),true);return;}return old.apply(this,arguments)};try{exportExcel=window.exportExcel}catch(e){}}
 // Advanced per-product split remains PRO; HPP itself stays available.
 const oldRender=window.renderProductProfitRules||renderProductProfitRules;window.renderProductProfitRules=function(){const r=oldRender.apply(this,arguments);setTimeout(()=>{document.querySelectorAll('.profit-product-row').forEach(row=>{const mode=row.querySelector('.profit-product-mode');if(mode&&!pro()){mode.value='percentage';mode.disabled=true;mode.title='Custom pembagian profit per produk tersedia di paket PRO.';row.classList.remove('manual');row.querySelectorAll('.profit-product-manual-amount').forEach(i=>i.disabled=true);}})},0);return r};try{renderProductProfitRules=window.renderProductProfitRules}catch(e){}
 const oldSave=window.saveProductProfitRule||saveProductProfitRule;window.saveProductProfitRule=async function(row){const mode=row?.querySelector('.profit-product-mode')?.value||'percentage';if(mode==='manual'&&!canUseFeature('advanced_profit_sharing','full')){showToast('Custom pembagian profit per produk tersedia di paket PRO.',true);return;}return oldSave.apply(this,arguments)};try{saveProductProfitRule=window.saveProductProfitRule}catch(e){}
 const oldHyd=window.hydrateSaasUi||hydrateSaasUi;window.hydrateSaasUi=function(){const r=oldHyd.apply(this,arguments);setTimeout(decorate,0);return r};try{hydrateSaasUi=window.hydrateSaasUi}catch(e){}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(decorate,150),{once:true});else setTimeout(decorate,150);
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
  function bootSignup(){
    const loginForm=document.getElementById('login-form');
    const card=loginForm?.closest('.auth-card');
    if(!loginForm||!card||document.getElementById('signup-form'))return;
    const title=card.querySelector('.auth-title');
    const sub=card.querySelector('.auth-sub');
    const authError=document.getElementById('auth-error');

    const switcher=document.createElement('div');
    switcher.className='auth-mode-switch';
    switcher.innerHTML='<button type="button" class="auth-mode-btn active" data-auth-mode="login">Masuk</button><button type="button" class="auth-mode-btn" data-auth-mode="signup">Buat Akun</button>';
    loginForm.before(switcher);

    const form=document.createElement('form');
    form.id='signup-form';
    form.hidden=true;
    form.innerHTML=`
      <div class="signup-status" id="signup-status"></div>
      <div class="signup-grid">
        <div class="form-group"><label class="label" for="signup-name">Nama Kamu</label><input id="signup-name" class="input" type="text" autocomplete="name" required placeholder="Nama owner"></div>
        <div class="form-group"><label class="label" for="signup-business">Nama Bisnis</label><input id="signup-business" class="input" type="text" required placeholder="Nama workspace"></div>
      </div>
      <div class="form-group"><label class="label" for="signup-template">Jenis Usaha</label><select id="signup-template" class="input" required><option value="general">General / Blank</option><option value="digital_subscription">Digital Subscription Seller</option><option value="service_consultation">Service / Consultation</option><option value="online_shop">Online Shop</option></select><div class="username-hint" id="signup-template-hint">KAIRO menyiapkan struktur awal sesuai jenis usaha. Semua master data tetap bisa diedit setelah masuk.</div></div>
      <div class="form-group"><label class="label" for="signup-username">Username</label><input id="signup-username" class="input" type="text" autocomplete="username" required maxlength="32" placeholder="username"><div class="username-hint" id="signup-username-hint">3–32 karakter: huruf kecil, angka, titik, _ atau -</div></div>
      <div class="form-group"><label class="label" for="signup-email">Email</label><input id="signup-email" class="input" type="email" autocomplete="email" required placeholder="nama@email.com"></div>
      <div class="signup-grid">
        <div class="form-group"><label class="label" for="signup-password">Password</label><input id="signup-password" class="input" type="password" autocomplete="new-password" required minlength="8" placeholder="Minimal 8 karakter"></div>
        <div class="form-group"><label class="label" for="signup-password-confirm">Ulangi Password</label><input id="signup-password-confirm" class="input" type="password" autocomplete="new-password" required minlength="8" placeholder="Ulangi password"></div>
      </div>
      <div class="signup-note"><span class="signup-plan-chip">BASIC</span> Akun baru otomatis mendapat 1 workspace dengan paket BASIC dan pembagian Owner 100%.</div>
      <button id="signup-button" class="btn btn-green auth-submit" type="submit">Buat Akun & Workspace</button>`;
    loginForm.after(form);

    function setMode(mode){
      const signup=mode==='signup';
      loginForm.hidden=signup; form.hidden=!signup;
      switcher.querySelectorAll('.auth-mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.authMode===mode));
      if(authError){authError.style.display='none';authError.textContent='';}
      const status=document.getElementById('signup-status'); if(status){status.className='signup-status';status.textContent='';}
      if(title)title.textContent=signup?'Buat Workspace Baru':'Masuk ke Dashboard';
      if(sub)sub.textContent='';
      setTimeout(()=>document.getElementById(signup?'signup-name':'login-username')?.focus(),0);
    }
    switcher.addEventListener('click',e=>{const b=e.target.closest('[data-auth-mode]');if(!b)return;if(b.dataset.authMode==='signup'){e.preventDefault();e.stopPropagation();location.href=location.pathname+'?signup=1';return;}setMode(b.dataset.authMode)});
    const directSignupBtn=switcher.querySelector('[data-auth-mode="signup"]');
    if(directSignupBtn){directSignupBtn.onclick=(e)=>{e.preventDefault();e.stopImmediatePropagation();location.href=location.pathname+'?signup=1';};}

    const usernameInput=document.getElementById('signup-username');
    const hint=document.getElementById('signup-username-hint');
    function normalizeUsername(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,'');}
    usernameInput.addEventListener('input',()=>{usernameInput.value=normalizeUsername(usernameInput.value);hint.className='username-hint';hint.textContent='3–32 karakter: huruf kecil, angka, titik, _ atau -';});
    usernameInput.addEventListener('blur',async()=>{
      const u=normalizeUsername(usernameInput.value); if(!u)return;
      if(!/^[a-z0-9._-]{3,32}$/.test(u)){hint.className='username-hint bad';hint.textContent='Format username belum valid.';return;}
      try{const {data,error}=await db.rpc('is_username_available',{p_username:u});if(error)throw error;hint.className='username-hint '+(data?'ok':'bad');hint.textContent=data?'Username tersedia.':'Username sudah dipakai.';}catch(err){hint.className='username-hint';hint.textContent='Ketersediaan akan dicek saat daftar.';}
    });

    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=document.getElementById('signup-button');
      const status=document.getElementById('signup-status');
      const displayName=document.getElementById('signup-name').value.trim();
      const workspaceName=document.getElementById('signup-business').value.trim();
      const businessTemplate=document.getElementById('signup-template')?.value||'general';
      const username=normalizeUsername(usernameInput.value);
      const email=document.getElementById('signup-email').value.trim().toLowerCase();
      const password=document.getElementById('signup-password').value;
      const confirm=document.getElementById('signup-password-confirm').value;
      const fail=msg=>{status.className='signup-status show bad';status.textContent=msg;};
      if(!displayName||!workspaceName||!username||!email||!password){fail('Semua field wajib diisi.');return;}
      if(!/^[a-z0-9._-]{3,32}$/.test(username)){fail('Format username belum valid.');return;}
      if(password.length<8){fail('Password minimal 8 karakter.');return;}
      if(password!==confirm){fail('Ulangi password harus sama.');return;}
      btn.disabled=true;btn.textContent='Membuat akun...';status.className='signup-status';status.textContent='';
      try{
        const {data:available,error:checkError}=await db.rpc('is_username_available',{p_username:username});
        if(checkError)throw checkError;
        if(!available){fail('Username sudah dipakai. Coba username lain.');return;}
        const {data,error}=await db.auth.signUp({email,password,options:{data:{username,display_name:displayName,workspace_name:workspaceName,business_template:businessTemplate}}});
        if(error)throw error;
        if(data?.session){
          status.className='signup-status show ok';status.textContent='Akun dan workspace BASIC berhasil dibuat. Membuka dashboard...';
          // onAuthStateChange handles workspace hydration.
        }else{
          status.className='signup-status show ok';
          status.textContent='Akun berhasil dibuat. Lo bisa langsung masuk memakai username kamu.';
          document.getElementById('login-username').value=username;
          setTimeout(()=>setMode('login'),2200);
        }
      }catch(err){
        console.error('Signup:',err);
        const raw=String(err?.message||'');
        let msg='Gagal membuat akun. Coba lagi.';
        if(/already registered|already exists|user already/i.test(raw))msg='Email tersebut sudah terdaftar.';
        else if(/username/i.test(raw)||/Database error saving new user/i.test(raw))msg='Username kemungkinan sudah dipakai. Coba username lain.';
        else if(/password/i.test(raw))msg='Password belum memenuhi ketentuan keamanan.';
        fail(msg);
      }finally{btn.disabled=false;btn.textContent='Buat Akun & Workspace';}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootSignup,{once:true});else bootSignup();
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(()=>{
 const boot=()=>{
  const track=document.getElementById('plan-carousel-track'); if(!track)return;
  const move=dir=>track.scrollBy({left:dir*track.clientWidth*.8,behavior:'smooth'});
  document.getElementById('plan-carousel-left')?.addEventListener('click',()=>move(-1));
  document.getElementById('plan-carousel-right')?.addEventListener('click',()=>move(1));
  const markCurrent=()=>{const p=String(window.activeWorkspacePlan||document.documentElement.dataset.workspacePlan||'basic').toLowerCase();document.querySelectorAll('[data-plan-card]').forEach(x=>x.classList.toggle('is-current',x.dataset.planCard===p));};
  markCurrent(); new MutationObserver(markCurrent).observe(document.documentElement,{attributes:true,attributeFilter:['data-workspace-plan']});
 };
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(()=>{
  function mountAuthPlanCarousel(){
    const auth=document.getElementById('auth-screen');
    const card=auth?.querySelector(':scope > .auth-card');
    const carousel=document.getElementById('plan-carousel-shell');
    if(!auth||!card||!carousel||auth.querySelector('.auth-entry-layout')) return;

    const layout=document.createElement('div');
    layout.className='auth-entry-layout';
    const left=document.createElement('section');
    left.className='auth-plans-panel';
    left.setAttribute('aria-label','Pilihan paket SaaS');
    left.innerHTML=`
      <div class="auth-plans-eyebrow">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17 9 12l4 4 7-8"/><path d="M15 8h5v5"/></svg>
        <span>PILIH KEBUTUHAN BISNISMU</span>
      </div>
      <h1 class="auth-plans-title">Someday, you'll look back at how far you've come. Kairo remembers where you started.</h1>
      <p class="auth-plans-sub">Bandingkan paket sesuai dengan kebutuhanmu. Mulai pencatatan usahamu dengan Kairo.</p>`;

    const nav=document.createElement('div');
    nav.className='plan-carousel-nav auth-carousel-nav';
    nav.innerHTML=`
      <button type="button" class="plan-carousel-arrow" data-auth-carousel="left" aria-label="Geser paket ke kiri"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
      <button type="button" class="plan-carousel-arrow" data-auth-carousel="right" aria-label="Geser paket ke kanan"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>`;

    auth.insertBefore(layout,card);
    const pageBrand=auth.querySelector(':scope > .kairo-auth-page-brand');
    if(pageBrand) layout.append(pageBrand);
    layout.append(left,card);
    left.append(carousel,nav);

    const track=carousel.querySelector('#plan-carousel-track');
    nav.addEventListener('click',e=>{
      const b=e.target.closest('[data-auth-carousel]'); if(!b||!track)return;
      track.scrollBy({left:(b.dataset.authCarousel==='left'?-1:1)*Math.max(220,track.clientWidth*.72),behavior:'smooth'});
    });
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mountAuthPlanCarousel,{once:true}):mountAuthPlanCarousel();
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(()=>{
 const copy={general:'Workspace kosong dan fleksibel untuk berbagai jenis usaha.',digital_subscription:'Siap untuk seller aplikasi premium: durasi 1/3/6/12 bulan + tracking masa aktif.',service_consultation:'Siap untuk jasa konsultasi/readings: paket layanan + alur order berbasis layanan.',online_shop:'Siap untuk toko online: master produk/order dasar yang bisa kamu sesuaikan.'};
 function sync(){const s=document.getElementById('signup-template'),h=document.getElementById('signup-template-hint');if(s&&h)h.textContent=copy[s.value]||copy.general;}
 document.addEventListener('change',e=>{if(e.target?.id==='signup-template')sync()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
 const EYE_OPEN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.7"/></svg>';
 const EYE_CLOSED='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 6.2A9.7 9.7 0 0 1 12 6c6.5 0 10 6 10 6a15 15 0 0 1-2.1 2.8M6.2 6.2C3.5 8 2 12 2 12s3.5 6 10 6c1.6 0 3-.35 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
 function eye(input){if(!input||input.parentElement?.classList.contains('kairo-password-wrap'))return;const wrap=document.createElement('div');wrap.className='kairo-password-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);const b=document.createElement('button');b.type='button';b.className='kairo-eye';b.setAttribute('aria-label','Tampilkan password');b.innerHTML=EYE_OPEN;wrap.appendChild(b);b.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';b.innerHTML=show?EYE_CLOSED:EYE_OPEN;b.setAttribute('aria-label',show?'Sembunyikan password':'Tampilkan password')};}
 function wireEyes(root=document){root.querySelectorAll('input[type="password"]').forEach(eye)}
 function validEmail(email){const e=String(email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))return false;const d=e.split('@')[1]||'';const blocked=['example.com','example.org','example.net','mailinator.com','yopmail.com','guerrillamail.com','10minutemail.com','tempmail.com','temp-mail.org','fakeinbox.com','trashmail.com','sharklasers.com','dispostable.com'];return !blocked.includes(d)}
 function normalizeUsername(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,'')}
 function ensureLoginExtras(){const login=document.getElementById('login-form');if(!login)return;wireEyes(login);if(!document.getElementById('kairo-forgot-button')){const b=document.createElement('button');b.type='button';b.id='kairo-forgot-button';b.className='kairo-auth-secondary';b.textContent='Lupa username / password?';login.appendChild(b);b.onclick=()=>openAccountPage('recover')}}
 function buildPage(){if(document.getElementById('kairo-account-page'))return;const page=document.createElement('div');page.id='kairo-account-page';page.innerHTML=`<div class="kairo-account-shell"><div class="kairo-account-top"><div class="kairo-account-brand"><strong>KAIRO WORKSPACES</strong><span>EVERY STEP, FROM THE START.</span></div><button class="kairo-back" id="kairo-account-back" type="button">Kembali ke Masuk</button></div><div class="kairo-account-card" id="kairo-account-content"></div></div>`;document.body.appendChild(page);document.getElementById('kairo-account-back').onclick=closeAccountPage}
 function closeAccountPage(){const p=document.getElementById('kairo-account-page');p?.classList.remove('show');history.replaceState({},'',location.pathname+location.hash)}
 function renderSignup(){const c=document.getElementById('kairo-account-content');c.innerHTML=`<h2>Buat akun KAIRO</h2><p class="kairo-account-lead">Pilih kebutuhan usahamu dulu, lalu buat satu akun untuk satu workspace KAIRO.</p><form id="kairo-signup-form"><div class="kairo-step-label">01 — PILIH PAKET</div><div class="kairo-plan-grid" id="kairo-plan-grid">${[['basic','BASIC','Mulai mencatat dan rasakan pengalaman pertama mengelola usaha dengan KAIRO.'],['plus','PLUS','Kelola operasional lebih dalam untuk usaha yang ingin tumbuh dan berjalan jangka panjang.'],['pro','PRO','Bangun pengelolaan usaha yang lebih lengkap, profesional, dan siap berkembang ke depan.']].map((x,i)=>`<label class="kairo-plan-option ${i===0?'selected':''}"><input type="radio" name="kairo-plan" value="${x[0]}" ${i===0?'checked':''}><div class="kairo-plan-name">${x[1]}</div><div class="kairo-plan-copy">${x[2]}</div><span class="kairo-plan-state">${x[0]==='basic'?'AKTIF SETELAH DAFTAR':'DIPILIH · AKTIVASI SETELAH PEMBAYARAN'}</span></label>`).join('')}</div><div class="kairo-step-label">02 — JENIS USAHA</div><div class="form-group"><select id="kairo-signup-template" class="input" required><option value="digital_subscription">Seller App Premium</option><option value="digital_product">Digital Product</option><option value="online_shop">Online Shop (Create your own package)</option><option value="service_consultation">Jasa Online (Joki/Tarot Reading/Wording/dll)</option></select></div><div class="kairo-step-label">03 — DATA AKUN & WORKSPACE</div><div class="kairo-account-grid"><div class="form-group"><label class="label">Nama Kamu</label><input id="kairo-signup-name" class="input" required autocomplete="name" placeholder="Nama owner"></div><div class="form-group"><label class="label">Nama Bisnis</label><input id="kairo-signup-business" class="input" required placeholder="Nama dashboard/workspace"></div></div><div class="form-group"><label class="label">Username</label><input id="kairo-signup-username" class="input" required maxlength="32" autocomplete="username" placeholder="username"><div id="kairo-username-hint" class="username-hint">3–32 karakter: huruf kecil, angka, titik, _ atau -</div></div><div class="form-group"><label class="label">Email aktif</label><input id="kairo-signup-email" class="input" type="email" required autocomplete="email" placeholder="nama@email.com"><div class="kairo-inline-note">Email digunakan sebagai identitas dan pemulihan akun. Tidak perlu konfirmasi email untuk mulai menggunakan KAIRO. Email sementara/disposable yang kami kenali akan ditolak.</div></div><div class="kairo-account-grid"><div class="form-group"><label class="label">Password</label><input id="kairo-signup-password" class="input" type="password" required minlength="8" autocomplete="new-password" placeholder="Minimal 8 karakter"></div><div class="form-group"><label class="label">Ulangi Password</label><input id="kairo-signup-confirm" class="input" type="password" required minlength="8" autocomplete="new-password" placeholder="Ulangi password"></div></div><div id="kairo-signup-status" class="kairo-account-status"></div><button class="kairo-account-submit" id="kairo-signup-submit" type="submit">Buat Akun</button></form>`;wireEyes(c);c.querySelectorAll('input[name="kairo-plan"]').forEach(r=>r.onchange=()=>c.querySelectorAll('.kairo-plan-option').forEach(x=>x.classList.toggle('selected',x.querySelector('input').checked)));const u=document.getElementById('kairo-signup-username'),hint=document.getElementById('kairo-username-hint');u.oninput=()=>{u.value=normalizeUsername(u.value);hint.className='username-hint';hint.textContent='3–32 karakter: huruf kecil, angka, titik, _ atau -'};u.onblur=async()=>{const v=normalizeUsername(u.value);if(!/^[a-z0-9._-]{3,32}$/.test(v)){hint.className='username-hint bad';hint.textContent='Format username belum valid.';return}try{const {data,error}=await db.rpc('is_username_available',{p_username:v});if(error)throw error;hint.className='username-hint '+(data?'ok':'bad');hint.textContent=data?'Username tersedia.':'Username sudah dipakai.'}catch(e){hint.textContent='Ketersediaan dicek saat daftar.'}};document.getElementById('kairo-signup-form').onsubmit=submitSignup}
 async function submitSignup(e){e.preventDefault();const s=document.getElementById('kairo-signup-status'),btn=document.getElementById('kairo-signup-submit'),username=normalizeUsername(document.getElementById('kairo-signup-username').value),email=document.getElementById('kairo-signup-email').value.trim().toLowerCase(),password=document.getElementById('kairo-signup-password').value,confirm=document.getElementById('kairo-signup-confirm').value,plan=document.getElementById('kairo-selected-plan')?.value||document.querySelector('input[name="kairo-plan"]:checked')?.value||'basic';const fail=m=>{s.className='kairo-account-status show bad';s.textContent=m};if(!validEmail(email))return fail('Gunakan email aktif yang valid. Email sementara/disposable tidak dapat dipakai.');if(!/^[a-z0-9._-]{3,32}$/.test(username))return fail('Format username belum valid.');if(password.length<8)return fail('Password minimal 8 karakter.');if(password!==confirm)return fail('Ulangi password harus sama.');btn.disabled=true;btn.textContent='Membuat akun...';try{const {data:available,error:ce}=await db.rpc('is_username_available',{p_username:username});if(ce)throw ce;if(!available)return fail('Username sudah dipakai. Coba username lain.');const {data,error}=await db.auth.signUp({email,password,options:{data:{username,display_name:document.getElementById('kairo-signup-name').value.trim(),workspace_name:document.getElementById('kairo-signup-business').value.trim(),business_template:(document.querySelector('input[name="kairo-business"]:checked')?.value||document.getElementById('kairo-signup-template')?.value||'digital_subscription'),requested_plan:plan,phone:(document.getElementById('kairo-signup-wa')?.value||'').trim()}}});if(error)throw error;if(!data?.user?.id)throw new Error('Auth user tidak terbentuk. Coba daftar lagi setelah memastikan Email Provider aktif.');if(Array.isArray(data?.user?.identities)&&data.user.identities.length===0)throw new Error('Email tersebut sudah terdaftar. Gunakan email lain atau pulihkan akun lama.');const verify=await db.auth.signInWithPassword({email,password});if(verify.error)throw new Error('Akun Auth terbentuk tetapi belum bisa login: '+verify.error.message);try{await db.auth.signOut()}catch(_e){}document.getElementById('kairo-signup-form').reset();c=document.getElementById('kairo-account-content');c.innerHTML=`<div class="kairo-success"><div class="kairo-success-icon"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></div><h3>Akun berhasil dibuat</h3><p>Akun <strong>${username.replace(/[&<>]/g,'')}</strong> sudah aktif. Email <strong>${email.replace(/[&<>]/g,'')}</strong> tersimpan sebagai identitas dan pemulihan akun. Lo bisa langsung masuk ke KAIRO.</p>${plan!=='basic'?`<button class="kairo-account-submit" id="kairo-success-wa" type="button">Konfirmasi Pembelian via WhatsApp</button>`:''}<button class="kairo-account-submit" id="kairo-success-login" type="button" style="margin-top:8px">Kembali ke Masuk</button></div>`;document.getElementById('kairo-success-login').onclick=closeAccountPage;const wb=document.getElementById('kairo-success-wa');if(wb)wb.onclick=()=>{const no=(window.__KAIRO_BUSINESS_WA||'').replace(/\D/g,'');const txt=encodeURIComponent(`Halo KAIRO, saya sudah membuat akun ${username} dan memilih paket ${plan.toUpperCase()}. Saya ingin konfirmasi pembelian dan aktivasi.`);if(no)window.open(`https://wa.me/${no}?text=${txt}`,'_blank');else alert('Nomor WhatsApp bisnis KAIRO akan dikonfigurasi pada tahap sistemasi konfirmasi pembelian.')}}catch(err){console.error(err);let m=String(err?.message||'Gagal membuat akun.');if(/already/i.test(m))m='Email tersebut sudah terdaftar.';if(/disposable|temporary/i.test(m))m='Email sementara/disposable tidak dapat digunakan.';fail(m)}finally{btn.disabled=false;btn.textContent='Buat Akun'}}
 function renderRecover(){const c=document.getElementById('kairo-account-content');c.innerHTML=`<h2>Pulihkan akun</h2><p class="kairo-account-lead">Masukkan email yang sudah terkonfirmasi. Link pemulihan hanya dikirim ke email tersebut.</p><form id="kairo-recover-form"><div class="form-group"><label class="label">Email akun</label><input id="kairo-recover-email" class="input" type="email" autocomplete="email" required placeholder="nama@email.com"></div><div id="kairo-recover-status" class="kairo-account-status"></div><button id="kairo-recover-submit" class="kairo-account-submit" type="submit">Kirim Link Pemulihan</button></form><div class="kairo-inline-note">Demi privasi, KAIRO tidak akan mengonfirmasi apakah suatu email terdaftar atau tidak pada layar ini.</div>`;document.getElementById('kairo-recover-form').onsubmit=async e=>{e.preventDefault();const email=document.getElementById('kairo-recover-email').value.trim().toLowerCase(),s=document.getElementById('kairo-recover-status'),b=document.getElementById('kairo-recover-submit');if(!validEmail(email)){s.className='kairo-account-status show bad';s.textContent='Masukkan email aktif yang valid.';return}b.disabled=true;try{const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+'?recovery=1'});if(error)throw error;s.className='kairo-account-status show ok';s.textContent='Jika email cocok dengan akun KAIRO, link pemulihan sudah dikirim. Cek inbox dan spam.'}catch(err){s.className='kairo-account-status show bad';s.textContent=/rate/i.test(err.message||'')?'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.':'Gagal mengirim link pemulihan. Coba lagi.'}finally{b.disabled=false}}}
 function renderRecoveryComplete(){const c=document.getElementById('kairo-account-content');c.innerHTML=`<h2>Buat akses baru</h2><p class="kairo-account-lead">Email sudah terverifikasi melalui link pemulihan. Sekarang lo bisa mengganti username dan password.</p><form id="kairo-recovery-complete-form"><div class="form-group"><label class="label">Username baru</label><input id="kairo-recovery-username" class="input" required maxlength="32" autocomplete="username" placeholder="username baru"></div><div class="kairo-account-grid"><div class="form-group"><label class="label">Password baru</label><input id="kairo-recovery-password" class="input" type="password" required minlength="8" autocomplete="new-password"></div><div class="form-group"><label class="label">Ulangi password</label><input id="kairo-recovery-confirm" class="input" type="password" required minlength="8" autocomplete="new-password"></div></div><div id="kairo-recovery-status" class="kairo-account-status"></div><button id="kairo-recovery-save" class="kairo-account-submit" type="submit">Simpan Username & Password Baru</button></form>`;wireEyes(c);document.getElementById('kairo-recovery-complete-form').onsubmit=async e=>{e.preventDefault();const u=normalizeUsername(document.getElementById('kairo-recovery-username').value),p=document.getElementById('kairo-recovery-password').value,pc=document.getElementById('kairo-recovery-confirm').value,s=document.getElementById('kairo-recovery-status'),b=document.getElementById('kairo-recovery-save'),fail=m=>{s.className='kairo-account-status show bad';s.textContent=m};if(!/^[a-z0-9._-]{3,32}$/.test(u))return fail('Format username belum valid.');if(p.length<8)return fail('Password minimal 8 karakter.');if(p!==pc)return fail('Ulangi password harus sama.');b.disabled=true;try{const {error:ue}=await db.auth.updateUser({password:p});if(ue)throw ue;const {error:re}=await db.rpc('update_my_username',{p_username:u});if(re)throw re;s.className='kairo-account-status show ok';s.textContent='Username dan password berhasil diperbarui. Silakan masuk lagi.';setTimeout(async()=>{try{await db.auth.signOut()}catch(e){}closeAccountPage();location.href=location.pathname},1400)}catch(err){fail(/username/i.test(err.message||'')?'Username sudah dipakai. Pilih username lain.':String(err.message||'Gagal memperbarui akun.'))}finally{b.disabled=false}}}
 function openAccountPage(mode='signup'){buildPage();const page=document.getElementById('kairo-account-page');if(!page)return;page.classList.add('show');page.setAttribute('aria-hidden','false');mode==='recover'?renderRecover():mode==='recovery-complete'?renderRecoveryComplete():renderSignup();window.scrollTo(0,0)}
 window.__kairoOpenAccountPage=openAccountPage;
 window.__kairoOpenRecoveryComplete=function(){document.body.classList.remove('authenticated');document.body.classList.add('auth-locked');openAccountPage('recovery-complete')};
 function hijackOldSignup(){const oldForm=document.getElementById('signup-form');if(oldForm)oldForm.hidden=true}
 function addAutolock(){
  const theme=document.getElementById('saas-theme-toggle');
  if(!theme||document.getElementById('kairo-lock-trigger'))return;
  const wrap=document.createElement('div');wrap.className='kairo-lock-control';
  const trigger=document.createElement('button');trigger.type='button';trigger.id='kairo-lock-trigger';trigger.className='kairo-lock-trigger';trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');trigger.title='Atur auto-lock dashboard';
  const screenIcon='<span class="kairo-lock-screen-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><rect x="9" y="8.5" width="6" height="5" rx="1.2"/><path d="M10.5 8.5V7.3a1.5 1.5 0 0 1 3 0v1.2"/></svg></span>';
  const closedIcon='<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h14"/></svg>';
  const openIcon='<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
  const labels={'5':'5 menit','10':'10 menit','30':'30 menit','0':'Always On'};
  const descriptions={'5':'Kunci setelah 5 menit tidak aktif','10':'Kunci setelah 10 menit tidak aktif','30':'Kunci setelah 30 menit tidak aktif','0':'Dashboard tidak dikunci otomatis'};
  let value=localStorage.getItem('kairo_autolock_minutes_v1')??'10';
  const menu=document.createElement('div');menu.className='kairo-lock-menu';menu.id='kairo-lock-menu';menu.setAttribute('role','menu');
  function renderTrigger(open=false){trigger.innerHTML=screenIcon+`<span class="kairo-lock-trigger-copy"><small>Auto Lock</small><strong>${labels[value]||labels['10']}</strong></span><span class="kairo-lock-menu-icon" aria-hidden="true">${open?openIcon:closedIcon}</span>`;trigger.setAttribute('aria-expanded',open?'true':'false')}
  function renderMenu(){menu.innerHTML='<div class="kairo-lock-menu-head"><strong>Lock Screen</strong><span>Pilih kapan dashboard dikunci setelah tidak ada aktivitas.</span></div>'+['5','10','30','0'].map(v=>`<button type="button" class="kairo-lock-option${value===v?' active':''}" data-lock-value="${v}" role="menuitem"><span class="kairo-lock-option-dot"></span><span class="kairo-lock-option-copy"><strong>${labels[v]}</strong><span>${descriptions[v]}</span></span></button>`).join('');menu.querySelectorAll('[data-lock-value]').forEach(btn=>btn.addEventListener('click',()=>{value=btn.dataset.lockValue;localStorage.setItem('kairo_autolock_minutes_v1',value);window.__kairoResetIdle?.();renderMenu();closeMenu();showToast(`Auto-lock diatur: ${labels[value]}.`)}))}
  function openMenu(){menu.classList.add('show');renderTrigger(true)}
  function closeMenu(){menu.classList.remove('show');renderTrigger(false)}
  trigger.addEventListener('click',e=>{e.stopPropagation();menu.classList.contains('show')?closeMenu():openMenu()});
  menu.addEventListener('click',e=>e.stopPropagation());
  document.addEventListener('click',closeMenu);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  renderTrigger(false);renderMenu();
  theme.parentNode.insertBefore(wrap,theme);wrap.append(trigger,menu,theme)
}
 // Robust auth router: works even if the auth switcher is rebuilt/reordered later.
 document.addEventListener('click',e=>{
   const signupBtn=e.target.closest?.('.auth-mode-btn[data-auth-mode="signup"],#auth-signup-toggle,#kairo-create-account-btn,[data-kairo-open-account]');
   if(!signupBtn)return;
   e.preventDefault();
   e.stopPropagation();
   openAccountPage('signup');
 },true);
 function boot(){buildPage();ensureLoginExtras();hijackOldSignup();addAutolock();wireEyes();const q=new URLSearchParams(location.search);if(q.get('recovery')==='1')setTimeout(()=>openAccountPage('recovery-complete'),120);else if(q.get('signup')==='1')setTimeout(()=>openAccountPage('signup'),120)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,40));else setTimeout(boot,40)
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


/* Replaces the old fixed 5-minute warning behavior. The legacy interval remains inert because its modal is suppressed and this controller owns locking. */
(function(){let last=Date.now(),locked=false,timer=null;function minutes(){return Number(localStorage.getItem('kairo_autolock_minutes_v1')??10)}function reset(){last=Date.now();locked=false}window.__kairoResetIdle=reset;['pointerdown','keydown','scroll','touchstart','wheel','click'].forEach(e=>window.addEventListener(e,()=>{if(!locked)last=Date.now()},{passive:true}));function tick(){const m=minutes();if(!m||locked||!document.body.classList.contains('authenticated'))return;if(Date.now()-last>=m*60000){locked=true;try{db.auth.signOut().finally(()=>location.reload())}catch(e){location.reload()}}}timer=setInterval(tick,5000);const legacy=document.getElementById('inactivity-modal');if(legacy){legacy.remove();}}
)();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
 function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 const pencil='<svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',trash='<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>';
 const old=window.renderProfitShareEditor||renderProfitShareEditor;
 window.renderProfitShareEditor=renderProfitShareEditor=function(){old.apply(this,arguments);const grid=document.getElementById('profit-share-rule-grid');if(!grid||!isWorkspaceAdmin())return;grid.querySelectorAll('.profit-rule-item').forEach(row=>{row.classList.add('kairo-partner-row');const input=row.querySelector('.profit-share-pct'),label=row.querySelector('label');if(!input||!label)return;const id=input.dataset.partnerId,name=input.dataset.partnerName;label.innerHTML=`<span>${esc(name)}</span><span class="kairo-partner-actions">${id?`<button type="button" class="kairo-partner-icon kairo-rename-partner" title="Ganti nama">${pencil}</button><button type="button" class="kairo-partner-icon kairo-delete-partner" title="Hapus partner">${trash}</button>`:''}</span>`;label.querySelector('.kairo-rename-partner')?.addEventListener('click',async()=>{const next=prompt('Nama partner baru:',name);if(!next||next.trim()===name)return;try{const {error}=await db.from('profit_share_rules').update({partner_name:next.trim()}).eq('workspace_id',requireWorkspaceId()).eq('id',id);if(error)throw error;await loadMasters();await refreshAll();showToast('Nama partner diperbarui.')}catch(e){showToast(e.message||'Gagal mengganti nama partner.',true)}});label.querySelector('.kairo-delete-partner')?.addEventListener('click',async()=>{if(!confirm(`Hapus ${name} dari pembagian aktif? Histori versi lama tetap tersimpan.`))return;try{const {error}=await db.from('profit_share_rules').update({is_active:false}).eq('workspace_id',requireWorkspaceId()).eq('id',id);if(error)throw error;await loadMasters();await refreshAll();showToast('Partner dinonaktifkan.')}catch(e){showToast(e.message||'Gagal menghapus partner.',true)}})});if(!document.getElementById('kairo-add-partner')){const b=document.createElement('button');b.id='kairo-add-partner';b.type='button';b.className='btn btn-light kairo-profit-add';b.textContent='+ Tambah Partner';grid.after(b);b.onclick=async()=>{const name=prompt('Nama partner / pos pembagian baru:');if(!name?.trim())return;try{const {error}=await db.from('profit_share_rules').insert({workspace_id:requireWorkspaceId(),partner_name:name.trim(),percentage:0,is_active:true});if(error)throw error;await loadMasters();await refreshAll();showToast('Partner ditambahkan. Atur persentasenya lalu simpan pembagian.')}catch(e){showToast(e.message||'Gagal menambahkan partner.',true)}}}}
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(()=>{
 const WA_BUSINESS=''; // isi nomor bisnis KAIRO format internasional, contoh 62812xxxx
 const svg={basic:'<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 9h8M8 13h6M8 17h4"/></svg>',plus:'<svg viewBox="0 0 24 24"><path d="M4 20V9l8-5 8 5v11"/><path d="M8 20v-7h8v7M12 4v16"/></svg>',pro:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V6M16 20V12M21 20V3"/><path d="m3 8 6-4 6 5 6-7"/></svg>'};
 const features=[['Manual Orders',1,1,1],['Petty Cash & Withdrawal',1,1,1],['Customer Database',0,1,1],['Open / Close Store',0,1,1],['Excel Export',0,1,1],['Custom Branding & Receipt',0,1,1],['Performance',0,'Basic','Full'],['Advanced Profit Sharing',0,0,1],['Business Insights & Analytics',0,0,1],['Multi-workspace',0,0,1]];
 function planCompare(){const plans=[['basic','Basic','Mulai & Catat','Fondasi untuk mulai mencatat order dan arus kas dengan rapi.'],['plus','Plus','Operate & Grow','Workflow lebih praktis untuk usaha yang tumbuh dan berjalan jangka panjang.'],['pro','Pro','Understand & Scale','Kontrol, insight, dan pengelolaan advanced untuk bisnis yang siap berkembang.']];return `<div class="kairo-plan-compare-wrap"><div class="kairo-plan-compare"><div class="kairo-plan-feature-name">Benefit KAIRO</div>${plans.map((p,i)=>`<div class="kairo-plan-head ${i===0?'selected':''}" data-kairo-plan="${p[0]}"><div class="kairo-plan-icon">${svg[p[0]]}</div><strong>${p[1]}</strong><small><b>${p[2]}</b><br>${p[3]}</small></div>`).join('')}${features.map(f=>`<div class="kairo-plan-feature-name">${f[0]}</div>${f.slice(1).map(v=>`<div class="kairo-plan-cell">${v===1?'<span class="kairo-plan-check">✓</span>':v===0?'<span class="kairo-plan-dash">—</span>':v}</div>`).join('')}`).join('')}</div></div><input type="hidden" id="kairo-selected-plan" value="basic">`}
 function businessGrid(){const a=[['digital_subscription','Seller App Premium','Kelola seller aplikasi premium dan paket berlangganan','<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h8M8 13h5"/></svg>'],['service_consultation','Jasa Online','Joki / Tarot Reading / Wording / jasa online lainnya','<svg viewBox="0 0 24 24"><path d="M4 18v-7a8 8 0 0 1 16 0v7"/><path d="M4 15H2v3h4v-5M20 15h2v3h-4v-5M18 20h-5"/></svg>'],['online_shop','Online Shop','Kreasikan produkmu sendiri pada dashboard','<svg viewBox="0 0 24 24"><path d="M4 9h16l-1-5H5L4 9Z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></svg>'],['digital_product','Digital Product','Produk digital, file, akses, atau layanan digital','<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 13h6M9 17h4"/></svg>']];return `<div class="kairo-business-grid">${a.map((x,i)=>`<label class="kairo-business-option ${i===0?'selected':''}"><input type="radio" name="kairo-business" value="${x[0]}" ${i===0?'checked':''}><span class="kairo-business-icon">${x[3]}</span><span><strong>${x[1]}</strong><small>${x[2]}</small></span></label>`).join('')}</div>`}
 function patchSignup(){const page=document.getElementById('kairo-account-content');if(!page||!document.getElementById('kairo-signup-form'))return;const old=document.getElementById('kairo-plan-grid');if(old){old.outerHTML=planCompare()}const sel=document.getElementById('kairo-signup-template');if(sel){sel.parentElement.innerHTML=businessGrid()}const email=document.getElementById('kairo-signup-email');if(email&&!document.getElementById('kairo-signup-wa')){const g=document.createElement('div');g.className='form-group';g.innerHTML='<label class="label">Nomor WhatsApp aktif</label><input id="kairo-signup-wa" class="input" type="tel" required inputmode="tel" autocomplete="tel" placeholder="08xxxxxxxxxx"><div class="kairo-inline-note">Dipakai untuk konfirmasi pembelian/aktivasi paket dan komunikasi akun KAIRO.</div>';email.closest('.form-group').after(g)}const form=document.getElementById('kairo-signup-form');form.querySelectorAll('[data-kairo-plan]').forEach(h=>h.onclick=()=>{form.querySelectorAll('[data-kairo-plan]').forEach(x=>x.classList.toggle('selected',x===h));document.getElementById('kairo-selected-plan').value=h.dataset.kairoPlan;syncSignupButton()});form.querySelectorAll('input[name="kairo-business"]').forEach(r=>r.onchange=()=>form.querySelectorAll('.kairo-business-option').forEach(x=>x.classList.toggle('selected',x.querySelector('input').checked)));syncSignupButton()}
 function syncSignupButton(){const p=document.getElementById('kairo-selected-plan')?.value||'basic',b=document.getElementById('kairo-signup-submit');if(b)b.textContent=p==='basic'?'Buat Akun':'Buat Akun dan Konfirmasi ke WA'}
 const oldOpen=window.__kairoOpenAccountPage;
 const obs=new MutationObserver(()=>{if(document.getElementById('kairo-signup-form')&&!document.getElementById('kairo-selected-plan'))patchSignup()});obs.observe(document.body,{childList:true,subtree:true});
 // Capture submit to enrich metadata and open WA after successful Supabase signup flow.
 document.addEventListener('submit',e=>{if(e.target?.id!=='kairo-signup-form')return;const plan=document.getElementById('kairo-selected-plan')?.value||'basic',biz=document.querySelector('input[name="kairo-business"]:checked')?.value||'digital_subscription',wa=(document.getElementById('kairo-signup-wa')?.value||'').trim();const hiddenTemplate=document.getElementById('kairo-signup-template');if(hiddenTemplate)hiddenTemplate.value=biz;window.__kairoPendingSignup={plan,biz,wa}},true);
 // Basic-only upgrade frame + feedback in sidebar.
 function decorateSidebar(){const meta=document.querySelector('.saas-side-meta');if(!meta)return;if(!document.getElementById('kairo-feedback-link')){const f=document.createElement('button');f.id='kairo-feedback-link';f.className='kairo-feedback-link';f.type='button';f.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/></svg><span>Ada masukan/keluhan? <strong>Tell us</strong></span>';f.onclick=()=>{const msg=encodeURIComponent(`Halo KAIRO, saya punya masukan/keluhan untuk workspace ${window.activeWorkspaceName||''}: `);if(WA_BUSINESS)window.open(`https://wa.me/${WA_BUSINESS}?text=${msg}`,'_blank');else showToast('Nomor WhatsApp bisnis KAIRO belum dikonfigurasi.',true)};meta.insertAdjacentElement('afterend',f)}else if(f.previousElementSibling!==meta){meta.insertAdjacentElement('afterend',f)}let up=document.getElementById('kairo-basic-upgrade');if(!up){up=document.createElement('div');up.id='kairo-basic-upgrade';up.className='kairo-basic-upgrade';up.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 17 9 12l4 4 7-9"/><path d="M14 7h6v6"/></svg><div><strong>Siap melangkah lebih jauh?</strong><br>Upgrade ke PLUS atau PRO untuk pengalaman pengelolaan usaha jangka panjang yang lebih lengkap.</div>';meta.appendChild(up)}up.classList.toggle('show',String(window.activeWorkspacePlan||activeWorkspacePlan||'basic').toLowerCase()==='basic')}
 setTimeout(decorateSidebar,1200);
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(()=>{
 const ICONS={
  basic:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 8h8M8 12h5M8 16h7"/><circle cx="17.2" cy="17.2" r="2.2"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11"/><path d="M8 20v-7h8v7M12 4v16"/><path d="M8 9h8"/></svg>',
  pro:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V12M10 20V8M16 20V5M21 20V3"/><path d="m3 9 6-4 6 3 6-6"/></svg>'
 };
 const ROWS=[
  ['Manual Orders',1,1,1],
  ['Petty Cash & Withdrawal',1,1,1],
  ['Performance', 'Penjualan harian + filter','Basic','Full'],
  ['Add-on & Harga',0,1,1],
  ['Customer Database',0,1,1],
  ['Open / Close Store',0,1,1],
  ['Excel Export',0,1,1],
  ['Autofill Orders',0,1,1],
  ['Custom Branding',0,1,1],
  ['Struk & Wording',0,'Warna + wording','Full + template unlimited'],
  ['Auto Lock',0,1,1],
  ['Promo',0,1,1],
  ['Advanced Profit Sharing',0,0,1],
  ['Business Insights & Analytics',0,0,1],
  ['Akun Dashboard','1 akun','1 akun','2 akun · Owner + Member'],
  ['Owner Menu Lock',0,0,1]
 ];
 const PLANS=[
  ['basic','Basic','Mulai & Catat','Fondasi untuk mulai mencatat order dan arus kas secara rapi.'],
  ['plus','Plus','Operate & Grow','Operasional lebih lengkap untuk usaha yang ingin tumbuh jangka panjang.'],
  ['pro','Pro','Understand & Scale','Semua fitur terbuka, insight advanced, kontrol Owner, dan akses tim.']
 ];
 function cell(v,plan){
   const body=v===1?'<span class="kairo-plan-check">✓</span>':v===0?'<span class="kairo-plan-dash">—</span>':`<span class="kairo-plan-note">${v}</span>`;
   return `<div class="kairo-plan-cell" data-plan-column="${plan}">${body}</div>`;
 }
 function markup(selected){
   return `<div class="kairo-plan-feature-name">Benefit KAIRO</div>${PLANS.map(p=>`<div class="kairo-plan-head ${p[0]===selected?'selected':''}" data-kairo-plan="${p[0]}"><div class="kairo-plan-icon">${ICONS[p[0]]}</div><strong>${p[1]}</strong><small><b>${p[2]}</b><br>${p[3]}</small></div>`).join('')}${ROWS.map(r=>`<div class="kairo-plan-feature-name">${r[0]}</div>${cell(r[1],'basic')}${cell(r[2],'plus')}${cell(r[3],'pro')}`).join('')}`;
 }
 function paint(table,plan){
   table.querySelectorAll('.kairo-plan-head').forEach(h=>h.classList.toggle('selected',h.dataset.kairoPlan===plan));
   const palette={basic:['#d5b43e','rgba(223,184,60,.10)'],plus:['#2f9aa4','rgba(89,185,167,.10)'],pro:['#3b5b8b','rgba(59,91,139,.10)']}[plan]||['#2f9aa4','rgba(47,154,164,.08)'];
   table.querySelectorAll('.kairo-plan-cell').forEach(c=>{const on=c.dataset.planColumn===plan;c.classList.toggle('selected-plan-col',on);if(on){c.style.setProperty('--selected-accent',palette[0]);c.style.setProperty('--selected-soft',palette[1])}});
 }
 function upgrade(){
   const table=document.querySelector('.kairo-plan-compare');
   const hidden=document.getElementById('kairo-selected-plan');
   if(!table||!hidden||table.dataset.v201061==='1')return;
   const selected=hidden.value||'basic';
   table.dataset.v201061='1';table.innerHTML=markup(selected);paint(table,selected);
   table.querySelectorAll('[data-kairo-plan]').forEach(h=>h.addEventListener('click',()=>{
      hidden.value=h.dataset.kairoPlan;paint(table,h.dataset.kairoPlan);
      const b=document.getElementById('kairo-signup-submit');if(b)b.textContent=hidden.value==='basic'?'Buat Akun':'Buat Akun dan Konfirmasi ke WA';
   }));
 }
 function gateAutoLock(){
   let plan='basic';try{plan=String(window.activeWorkspacePlan||activeWorkspacePlan||'basic').toLowerCase()}catch(e){}
   document.querySelectorAll('.kairo-lock-wrap,#kairo-lock-wrap,.kairo-lock-trigger').forEach(el=>{const host=el.classList.contains('kairo-lock-trigger')?el.closest('.kairo-lock-wrap')||el:el;host.style.display=plan==='basic'?'none':''});
 }
 const mo=new MutationObserver(()=>{upgrade();gateAutoLock()});mo.observe(document.body,{childList:true,subtree:true});
 document.addEventListener('click',e=>{if(e.target.closest('#kairo-create-account-btn,[data-kairo-open-account],#auth-signup-toggle'))setTimeout(upgrade,40)},true);
 setTimeout(()=>{upgrade();gateAutoLock()},1200);
})();


/* ---- KAIRO SCRIPT BOUNDARY ---- */


(function(){
 const PROMO_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12 12 20 4 12l8-8 8 8Z"/><circle cx="12" cy="9" r="1.5"/><path d="M9 14h6"/></svg>';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 function currentPlan(){try{return String(window.activeWorkspacePlan||activeWorkspacePlan||document.documentElement.dataset.workspacePlan||'basic').toLowerCase()}catch(e){return 'basic'}}
 function wid(){try{return typeof requireWorkspaceId==='function'?requireWorkspaceId():window.activeWorkspaceId||activeWorkspaceId}catch(e){return window.activeWorkspaceId||null}}

 function wirePlanHover(){
   document.querySelectorAll('.kairo-plan-compare').forEach(table=>{
    if(table.dataset.hoverV62)return;table.dataset.hoverV62='1';
    const clear=()=>table.querySelectorAll('.hover-plan-col').forEach(x=>x.classList.remove('hover-plan-col'));
    const preview=plan=>{clear();table.querySelectorAll(`[data-kairo-plan="${plan}"],[data-plan-column="${plan}"]`).forEach(x=>x.classList.add('hover-plan-col'))};
    table.addEventListener('mouseover',e=>{const h=e.target.closest('[data-kairo-plan]');const c=e.target.closest('[data-plan-column]');const p=h?.dataset.kairoPlan||c?.dataset.planColumn;if(p)preview(p)});
    table.addEventListener('mouseleave',clear);
   });
 }

 function ensurePromoSection(){
   if(document.getElementById('promo'))return;
   const target=document.getElementById('performance')||document.getElementById('customers');if(!target)return;
   const sec=document.createElement('section');sec.id='promo';sec.className='section';sec.innerHTML=`<div class="promo-shell"><div class="promo-card"><div class="promo-title">${PROMO_ICON}<span>Buat Promo</span></div><div class="promo-sub">Atur diskon otomatis berdasarkan package, topik, semua package, atau keyword package.</div><div id="promo-plan-lock"></div><form id="promo-form" class="promo-form"><div class="full"><label class="label">Nama Promo</label><input id="promo-name" class="input" maxlength="80" required placeholder="Contoh: General Reading September"></div><div><label class="label">Target Promo</label><select id="promo-target-type" class="input"><option value="all_packages">All Packages</option><option value="package">Package tertentu</option><option value="topic">Topik tertentu</option><option value="package_keyword">Keyword Package</option></select></div><div><label class="label">Target / Keyword</label><input id="promo-target-value" class="input" placeholder="Kosong untuk All Packages"><div class="promo-target-hint" id="promo-target-hint">Semua package akan menerima diskon.</div></div><div><label class="label">Jenis Diskon</label><select id="promo-discount-type" class="input"><option value="percent">Persentase (%)</option><option value="fixed">Nominal (Rp)</option></select></div><div><label class="label">Nilai Diskon</label><input id="promo-discount-value" class="input" type="number" min="0" step="0.01" required placeholder="Contoh: 10"></div><div><label class="label">Mulai</label><input id="promo-start" class="input" type="date"></div><div><label class="label">Berakhir</label><input id="promo-end" class="input" type="date"></div><div class="full"><label class="label">Catatan (opsional)</label><textarea id="promo-notes" placeholder="Keterangan internal promo"></textarea></div><div class="full"><button class="promo-save" id="promo-save" type="submit">Simpan Promo</button></div></form></div><div class="promo-card"><div class="promo-title">${PROMO_ICON}<span>Promo Aktif & Tersimpan</span></div><div class="promo-sub">Promo tersimpan per workspace. BASIC hanya dapat melihat penawaran upgrade dan tidak dapat memakai fitur Promo.</div><div id="promo-list" class="promo-list"><div class="promo-empty">Belum ada promo.</div></div></div></div>`;
   target.parentNode.insertBefore(sec,target);
   wirePromoForm();
 }

 function ensurePromoNav(){
   const icon=`<span class="saas-nav-icon">${PROMO_ICON}</span><span class="saas-nav-label">Promo</span>`;
   const side=document.querySelector('#saas-sidebar .saas-sidebar-nav');
   if(side&&!side.querySelector('[data-tab="promo"]')){const b=document.createElement('button');b.type='button';b.className='tab';b.dataset.tab='promo';b.innerHTML=icon;b.onclick=()=>openPromo();side.appendChild(b)}
   if(side){const order=['dashboard','input','promo','performance','customers','payout','cash'];order.forEach(k=>{const n=side.querySelector(`[data-tab="${k}"]`);if(n)side.appendChild(n)});const set=side.querySelector('#saas-settings-side-btn');const submenu=document.getElementById('saas-settings-submenu');if(set){side.appendChild(set);if(submenu)side.appendChild(submenu)}}
   const top=document.querySelector('.v19-nav');if(top&&!top.querySelector('[data-tab="promo"]')){const b=document.createElement('button');b.type='button';b.className='tab';b.dataset.tab='promo';b.textContent='Promo';b.onclick=openPromo;top.appendChild(b)}
   if(top){const order=['dashboard','input','promo','performance','customers','payout','cash'];order.forEach(k=>{const n=top.querySelector(`[data-tab="${k}"]`);if(n)top.appendChild(n)})}
 }
 function openPromo(){
   try{if(typeof openAppPage==='function')openAppPage('promo')}catch(e){}
   document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id==='promo'));
   document.querySelectorAll('#saas-sidebar .tab,.v19-nav .tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='promo'));
   const t=document.querySelector('main.container .page-title'),sub=document.querySelector('main.container .page-sub');if(t)t.textContent='Promo';if(sub)sub.textContent='Kelola diskon package dan topik untuk workspace aktif.';
   renderPromos();window.scrollTo({top:0,behavior:'auto'});
 }

 function promoTargetHint(){const type=document.getElementById('promo-target-type')?.value;const h=document.getElementById('promo-target-hint');const input=document.getElementById('promo-target-value');if(!h||!input)return;const map={all_packages:'Semua package akan menerima diskon.',package:'Isi nama package persis atau sebagian.',topic:'Isi nama topik yang ingin diberi diskon.',package_keyword:'Contoh: ketik “general” untuk semua package yang mengandung keyword general.'};h.textContent=map[type]||'';input.disabled=type==='all_packages';if(type==='all_packages')input.value='';}
 async function renderPromos(){
   ensurePromoSection();const lock=document.getElementById('promo-plan-lock'),form=document.getElementById('promo-form'),list=document.getElementById('promo-list');if(!list)return;
   const plan=currentPlan();const allowed=plan==='plus'||plan==='pro';if(lock)lock.innerHTML=allowed?'':'<div class="promo-basic-lock"><strong>Promo tersedia mulai PLUS.</strong><br>Upgrade untuk membuat diskon berdasarkan package, topik, atau keyword.</div>';if(form)form.style.display=allowed?'grid':'none';
   try{const id=wid();if(!id)return;const {data,error}=await db.from('promotions').select('*').eq('workspace_id',id).order('created_at',{ascending:false});if(error)throw error;const rows=data||[];if(!rows.length){list.innerHTML='<div class="promo-empty">Belum ada promo.</div>';return}list.innerHTML=rows.map(r=>{const amount=r.discount_type==='percent'?`${Number(r.discount_value||0)}%`:`Rp${Number(r.discount_value||0).toLocaleString('id-ID')}`;const target={all_packages:'All Packages',package:`Package: ${esc(r.target_value||'-')}`,topic:`Topik: ${esc(r.target_value||'-')}`,package_keyword:`Keyword: ${esc(r.target_value||'-')}`}[r.target_type]||r.target_type;return `<div class="promo-row"><div><strong>${esc(r.name)}</strong><small>${target} · Diskon ${amount}${r.start_date?` · ${esc(r.start_date)}`:''}${r.end_date?` s/d ${esc(r.end_date)}`:''}</small><span class="promo-badge">${r.is_active?'AKTIF':'NONAKTIF'}</span></div><div class="promo-row-actions">${allowed?`<button class="promo-toggle" data-promo-toggle="${r.id}" data-next="${!r.is_active}">${r.is_active?'Nonaktifkan':'Aktifkan'}</button><button class="promo-delete" data-promo-delete="${r.id}">Hapus</button>`:''}</div></div>`}).join('')}
   catch(e){console.error(e);list.innerHTML=`<div class="promo-empty">${esc(e.message||'Gagal memuat promo.')}</div>`}
 }
 function wirePromoForm(){
   document.getElementById('promo-target-type')?.addEventListener('change',promoTargetHint);promoTargetHint();
   document.getElementById('promo-form')?.addEventListener('submit',async e=>{e.preventDefault();if(!['plus','pro'].includes(currentPlan()))return showToast('Promo tersedia mulai paket PLUS.',true);const btn=document.getElementById('promo-save');btn.disabled=true;try{const type=document.getElementById('promo-target-type').value;const val=(document.getElementById('promo-target-value').value||'').trim();if(type!=='all_packages'&&!val)throw new Error('Target atau keyword promo wajib diisi.');const discountType=document.getElementById('promo-discount-type').value;const discountValue=Number(document.getElementById('promo-discount-value').value||0);if(!(discountValue>0))throw new Error('Nilai diskon harus lebih dari 0.');if(discountType==='percent'&&discountValue>100)throw new Error('Diskon persentase maksimal 100%.');const row={workspace_id:wid(),name:document.getElementById('promo-name').value.trim(),target_type:type,target_value:type==='all_packages'?null:val,discount_type:discountType,discount_value:discountValue,start_date:document.getElementById('promo-start').value||null,end_date:document.getElementById('promo-end').value||null,notes:document.getElementById('promo-notes').value.trim()||null,is_active:true};const {error}=await db.from('promotions').insert(row);if(error)throw error;e.target.reset();promoTargetHint();showToast('Promo tersimpan.');await renderPromos()}catch(err){console.error(err);showToast(err.message||'Gagal menyimpan promo.',true)}finally{btn.disabled=false}});
   document.getElementById('promo-list')?.addEventListener('click',async e=>{const del=e.target.closest('[data-promo-delete]'),tog=e.target.closest('[data-promo-toggle]');try{if(del){const {error}=await db.from('promotions').delete().eq('id',del.dataset.promoDelete).eq('workspace_id',wid());if(error)throw error;showToast('Promo dihapus.')}else if(tog){const {error}=await db.from('promotions').update({is_active:tog.dataset.next==='true',updated_at:new Date().toISOString()}).eq('id',tog.dataset.promoToggle).eq('workspace_id',wid());if(error)throw error;showToast('Status promo diperbarui.')}else return;await renderPromos()}catch(err){showToast(err.message||'Gagal memperbarui promo.',true)}});
 }

 function boot(){wirePlanHover();ensurePromoSection();ensurePromoNav();setTimeout(()=>{wirePlanHover();ensurePromoNav()},900)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 /* v20.10.66: removed global body MutationObserver here. ensurePromoNav() reorders existing nav nodes with appendChild; observing body childList caused a self-triggering mutation loop and could freeze the page. boot() already initializes this UI. */
})();


/* ---- KAIRO v20.10.77 — neutral tenant template + interactive BASIC locks ---- */
(function(){
 const LOCK_SVG='<span class="kairo-menu-lock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2.5"/><path d="M8 10V7.2a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15" r="1.2"/></svg></span>';
 const KAIRO_LOGO='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#59B9A7"/><stop offset=".55" stop-color="#2F9AA4"/><stop offset="1" stop-color="#353A66"/></linearGradient></defs><rect width="96" height="96" rx="26" fill="#EAF4F6"/><path d="M27 22v52M29 49 62 22M29 49l36 25" fill="none" stroke="url(#g)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>');
 const isBasic=()=>String(window.activeWorkspacePlan||activeWorkspacePlan||'basic').toLowerCase()==='basic';
 const isTrine=()=>typeof isTrineMagicWorkspace==='function'&&isTrineMagicWorkspace();
 const upgradeMessage=()=>showToast('Upgrade ke paket PLUS atau PRO untuk mengakses ini',true);
 function neutralBrand(){
   if(isTrine())return;
   document.querySelectorAll('.brand-logo,.saas-side-brand img,.saas-brand-preview-logo').forEach(img=>{
     if(!activeWorkspaceBranding?.logo_url){img.src=KAIRO_LOGO;img.dataset.defaultSrc=KAIRO_LOGO;}
   });
   const logoInput=document.getElementById('settings-logo-url');if(logoInput&&!activeWorkspaceBranding?.logo_url)logoInput.value='';
   const uploadPreview=document.getElementById('settings-logo-upload-preview');if(uploadPreview&&!activeWorkspaceBranding?.logo_url)uploadPreview.src=KAIRO_LOGO;
   const slogan=document.getElementById('settings-dashboard-slogan');if(slogan&&!activeWorkspaceBranding?.receipt_labels?.__dashboard_slogan)slogan.value='';
   const dash=document.getElementById('dashboard-slogan-display');if(dash&&!activeWorkspaceBranding?.receipt_labels?.__dashboard_slogan)dash.textContent='';
 }
 function setLock(el,locked){
   if(!el)return;el.classList.toggle('kairo-feature-locked',locked);el.setAttribute('aria-disabled',locked?'true':'false');
   const old=el.querySelector('.kairo-menu-lock');if(locked&&!old)el.insertAdjacentHTML('beforeend',LOCK_SVG);if(!locked&&old)old.remove();
 }
 function decorateLocks(){
   const basic=isBasic();
   // Whole menus unavailable on BASIC. They stay clickable so the upgrade message can explain why.
   document.querySelectorAll('[data-tab="promo"],.saas-mobile-nav-btn[data-mobile-tab="promo"],[data-tab="customers"],.saas-mobile-nav-btn[data-mobile-tab="customers"]').forEach(el=>setLock(el,basic));
   // BASIC Settings: Package & Harga stays available. Premium categories get a visible lock.
   document.querySelectorAll('.saas-settings-submenu-btn').forEach(el=>setLock(el,basic&&['workspace','addons','profit','receipt'].includes(el.dataset.settingsCategory)));
   // Performance is intentionally NOT locked on BASIC; Daily Sales remains available.
   document.querySelectorAll('[data-tab="performance"],.saas-mobile-nav-btn[data-mobile-tab="performance"]').forEach(el=>setLock(el,false));
 }
 document.addEventListener('click',e=>{
   if(!isBasic())return;
   const whole=e.target.closest('[data-tab="promo"],.saas-mobile-nav-btn[data-mobile-tab="promo"],[data-tab="customers"],.saas-mobile-nav-btn[data-mobile-tab="customers"]');
   const settings=e.target.closest('.saas-settings-submenu-btn');
   if(whole||(settings&&['workspace','addons','profit','receipt'].includes(settings.dataset.settingsCategory))){e.preventDefault();e.stopImmediatePropagation();upgradeMessage();}
 },true);
 function refresh(){neutralBrand();decorateLocks()}
 const oldHyd=window.hydrateSaasUi||hydrateSaasUi;window.hydrateSaasUi=function(){const r=oldHyd.apply(this,arguments);setTimeout(refresh,0);return r};try{hydrateSaasUi=window.hydrateSaasUi}catch(e){}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,180),{once:true});else setTimeout(refresh,180);
 setTimeout(refresh,1000);
})();


/* ---- KAIRO v20.10.82 — BASIC UI revision only ---- */
(function(){
  const basic=()=>String(window.activeWorkspacePlan||activeWorkspacePlan||'basic').toLowerCase()==='basic';
  function dedupeSettingsLocks(){
    document.querySelectorAll('.saas-settings-submenu-btn').forEach(btn=>{
      const locks=[...btn.querySelectorAll('.settings-submenu-lock,.kairo-menu-lock,.saas-nav-lock')];
      if(locks.length>1)locks.slice(1).forEach(x=>x.remove());
    });
  }
  function basicPerformance(){
    const isBasic=basic();
    document.body.classList.toggle('kairo-basic-plan',isBasic);
    document.querySelectorAll('[data-tab="performance"],.saas-mobile-nav-btn[data-mobile-tab="performance"]').forEach(btn=>{
      btn.querySelectorAll('.settings-submenu-lock,.kairo-menu-lock,.saas-nav-lock').forEach(x=>x.remove());
      btn.classList.remove('plan-locked','entitlement-locked','kairo-feature-locked');
      btn.setAttribute('aria-disabled','false');
    });
  }
  function moveBasicPlanFrame(){
    const headerMeta=document.querySelector('#app-shell .header .workspace-meta');
    const sideMeta=document.querySelector('#saas-sidebar .saas-side-meta');
    const upgrade=document.getElementById('kairo-basic-upgrade');
    let frame=document.getElementById('kairo-basic-header-frame');
    if(!basic()){
      frame?.remove();
      sideMeta?.classList.remove('kairo-basic-meta-moved');
      upgrade?.classList.remove('kairo-basic-upgrade-moved');
      return;
    }
    if(!headerMeta||!sideMeta||!upgrade)return;
    if(!frame){
      frame=document.createElement('div');frame.id='kairo-basic-header-frame';frame.className='kairo-basic-header-frame';
      const rolePlan=document.getElementById('saas-side-role-plan')?.textContent||'OWNER · BASIC';
      const validity=document.getElementById('saas-side-status')?.textContent||'Masa berlaku: Belum ditentukan';
      const upgradeTitle=upgrade.querySelector('strong')?.textContent||'Siap melangkah lebih jauh?';
      const upgradeText=(upgrade.innerText||'').replace(upgradeTitle,'').trim();
      frame.innerHTML=`<div class="kairo-basic-header-status"><span class="saas-side-dot"></span><div><strong>${rolePlan}</strong><small>${validity}</small></div></div><div class="kairo-basic-header-upgrade"><span class="kairo-basic-header-arrow">↗</span><div><strong>${upgradeTitle}</strong><small>${upgradeText}</small></div></div>`;
      headerMeta.appendChild(frame);
    }else{
      const a=frame.querySelector('.kairo-basic-header-status strong'),b=frame.querySelector('.kairo-basic-header-status small');
      if(a)a.textContent=document.getElementById('saas-side-role-plan')?.textContent||'OWNER · BASIC';
      if(b)b.textContent=document.getElementById('saas-side-status')?.textContent||'Masa berlaku: Belum ditentukan';
    }
    sideMeta.classList.add('kairo-basic-meta-moved');
    upgrade.classList.add('kairo-basic-upgrade-moved');
  }
  function refresh82(){basicPerformance();dedupeSettingsLocks();moveBasicPlanFrame()}
  const oldHyd=window.hydrateSaasUi||hydrateSaasUi;window.hydrateSaasUi=function(){const r=oldHyd.apply(this,arguments);setTimeout(refresh82,20);return r};try{hydrateSaasUi=window.hydrateSaasUi}catch(e){}
  document.addEventListener('click',()=>setTimeout(refresh82,30));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh82,220),{once:true});else setTimeout(refresh82,220);
  setTimeout(refresh82,1100);
})();

/* ---- KAIRO v20.10.83 — BASIC UI targeted fixes ---- */
(function(){
  const isBasic83=()=>String(window.activeWorkspacePlan||activeWorkspacePlan||'basic').toLowerCase()==='basic';
  const LOCK83='<span class="settings-submenu-lock kairo-lock-v83" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>';

  function normalizeSettingsLocks83(){
    document.querySelectorAll('.saas-settings-submenu-btn').forEach(btn=>{
      btn.querySelectorAll('.settings-submenu-lock,.kairo-menu-lock,.saas-nav-lock').forEach(x=>x.remove());
      if(btn.classList.contains('kairo-feature-locked')||btn.classList.contains('settings-pro-locked')||btn.getAttribute('aria-disabled')==='true'){
        btn.insertAdjacentHTML('beforeend',LOCK83);
      }
    });
  }

  function headerBasic83(){
    const meta=document.querySelector('#app-shell .header .workspace-meta');
    if(!meta)return;
    document.getElementById('kairo-basic-header-frame')?.remove();
    let upgrade=document.getElementById('kairo-basic-header-upgrade-v83');
    const workspace=document.getElementById('saas-workspace-pill');
    const plan=document.getElementById('saas-plan-pill');
    const role=document.getElementById('saas-role-pill');
    if(!isBasic83()){
      upgrade?.remove();
      [workspace,plan,role].forEach(x=>x?.classList.remove('kairo-header-card-v83'));
      plan?.classList.remove('kairo-plan-card-v83');
      return;
    }
    [workspace,plan,role].forEach(x=>x?.classList.add('kairo-header-card-v83'));
    plan?.classList.add('kairo-plan-card-v83');
    const raw=activeWorkspaceSubscription?.current_period_end||activeWorkspaceSubscription?.expires_at||activeWorkspaceSubscription?.end_date||activeWorkspaceSubscription?.valid_until||activeWorkspaceSubscription?.trial_ends_at;
    const validity=raw?new Date(raw).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'Belum ditentukan';
    if(plan) plan.innerHTML=`<strong>BASIC</strong><small>Masa berlaku: ${validity}</small>`;
    if(!upgrade){
      upgrade=document.createElement('div');
      upgrade.id='kairo-basic-header-upgrade-v83';
      upgrade.className='kairo-basic-header-upgrade-v83';
      upgrade.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17 9 12l4 4 7-9"/><path d="M14 7h6v6"/></svg><div><strong>Siap melangkah lebih jauh?</strong><small>Upgrade ke PLUS atau PRO untuk pengalaman pengelolaan usaha jangka panjang yang lebih lengkap.</small></div>';
      meta.appendChild(upgrade);
    }
  }

  function ensureBasicDailyTable83(){
    const perf=document.getElementById('performance');
    if(!perf)return;
    let host=document.getElementById('kairo-basic-daily-sales-v83');
    if(!isBasic83()){host?.remove();return;}
    if(!host){
      host=document.createElement('div');
      host.id='kairo-basic-daily-sales-v83';
      host.className='card kairo-basic-daily-sales-v83';
      host.innerHTML='<div class="card-title">Penjualan Harian</div><div class="page-sub">Ringkasan transaksi dan omzet sesuai filter tanggal aktif.</div><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Total Transaksi</th><th>Omzet</th></tr></thead><tbody id="kairo-basic-daily-sales-body-v83"></tbody></table></div>';
      perf.appendChild(host);
    }
    const body=document.getElementById('kairo-basic-daily-sales-body-v83');
    if(!body)return;
    const map={};
    (Array.isArray(transactions)?transactions:[]).forEach(t=>{
      const d=String(t.transaction_date||'').slice(0,10)||'-';
      if(!map[d])map[d]={count:0,total:0};
      map[d].count+=1; map[d].total+=Number(t.total_price||0);
    });
    const rows=Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));
    body.innerHTML=rows.length?rows.map(([d,v])=>`<tr><td>${escapeHtml(d)}</td><td>${v.count}</td><td>${rupiah(v.total)}</td></tr>`).join(''):'<tr><td colspan="3" class="empty">Belum ada penjualan pada periode ini.</td></tr>';
  }

  const oldRenderCharts83=renderCharts;
  renderCharts=function(){const r=oldRenderCharts83.apply(this,arguments);ensureBasicDailyTable83();return r};
  try{window.renderCharts=renderCharts}catch(e){}

  function refresh83(){
    document.body.classList.toggle('kairo-basic-plan',isBasic83());
    headerBasic83();normalizeSettingsLocks83();ensureBasicDailyTable83();
  }
  const oldHyd83=window.hydrateSaasUi||hydrateSaasUi;
  window.hydrateSaasUi=function(){const r=oldHyd83.apply(this,arguments);setTimeout(refresh83,25);return r};
  try{hydrateSaasUi=window.hydrateSaasUi}catch(e){}
  document.addEventListener('click',()=>setTimeout(refresh83,35));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh83,250),{once:true});else setTimeout(refresh83,250);
  setTimeout(refresh83,1100);
})();


/* ---- KAIRO v20.10.86 — unified plan header cards (all plans) ---- */
(function(){
  const plan86=()=>String(window.activeWorkspacePlan||activeWorkspacePlan||'basic').toLowerCase();
  const validity86=()=>{
    if(typeof isTrineMagicWorkspace==='function'&&isTrineMagicWorkspace())return 'Unlimited';
    const sub=window.activeWorkspaceSubscription||activeWorkspaceSubscription||{};
    const raw=sub.current_period_end||sub.expires_at||sub.end_date||sub.valid_until||sub.trial_ends_at;
    return raw?new Date(raw).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'Belum ditentukan';
  };
  function unifiedHeader86(){
    const meta=document.querySelector('#app-shell .header .workspace-meta');
    if(!meta)return;
    // The old sidebar plan/status frame is retired for every package.
    document.querySelector('#saas-sidebar .saas-side-meta')?.classList.add('kairo-plan-meta-retired-v86');
    document.getElementById('kairo-basic-header-frame')?.remove();
    document.getElementById('kairo-basic-upgrade')?.classList.add('kairo-basic-upgrade-moved');

    const workspace=document.getElementById('saas-workspace-pill');
    const plan=document.getElementById('saas-plan-pill');
    const role=document.getElementById('saas-role-pill');
    [workspace,plan,role].forEach(x=>x?.classList.add('kairo-header-card-v83'));
    plan?.classList.add('kairo-plan-card-v83');

    const p=plan86();
    if(plan)plan.innerHTML=`<strong>${p.toUpperCase()}</strong><small>Masa berlaku: ${validity86()}</small>`;

    let card=document.getElementById('kairo-basic-header-upgrade-v83');
    if(!card){
      card=document.createElement('div');
      card.id='kairo-basic-header-upgrade-v83';
      card.className='kairo-basic-header-upgrade-v83';
      meta.appendChild(card);
    }
    let title='Siap melangkah lebih jauh?', copy='Upgrade ke PLUS atau PRO untuk pengalaman pengelolaan usaha jangka panjang yang lebih lengkap.';
    if(p==='plus')copy='Upgrade ke PRO untuk membuka seluruh fitur, insight advanced, dan kontrol Owner yang lebih lengkap.';
    if(p==='pro'){title='Paket PRO aktif';copy='Seluruh fitur KAIRO tersedia untuk workspace ini.';}
    card.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17 9 12l4 4 7-9"/><path d="M14 7h6v6"/></svg><div><strong>${title}</strong><small>${copy}</small></div>`;
  }
  const prior=window.hydrateSaasUi||hydrateSaasUi;
  window.hydrateSaasUi=function(){const r=prior.apply(this,arguments);setTimeout(unifiedHeader86,35);return r};
  try{hydrateSaasUi=window.hydrateSaasUi}catch(e){}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(unifiedHeader86,260),{once:true});else setTimeout(unifiedHeader86,260);
  document.addEventListener('click',()=>setTimeout(unifiedHeader86,45));
  setTimeout(unifiedHeader86,1200);
})();

/* ---- KAIRO v20.10.108 — mobile UI rebuild, post-auth only ---- */
(function(){
  'use strict';
  const MQ=900;
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const icons={
    dashboard:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg>`,
    input:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/><path d="M16 15v4M14 17h4"/></svg>`,
    promo:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13 11 22l-9-9V4h9l9 9Z"/><circle cx="7" cy="9" r="1.5"/></svg>`,
    settings:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05-2.78 2.78-.05-.05A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1.1 1.64V21H10v-.06A1.8 1.8 0 0 0 8.9 19.3a1.8 1.8 0 0 0-1.98.36l-.05.05-2.78-2.78.05-.05A1.8 1.8 0 0 0 4.5 15a1.8 1.8 0 0 0-1.64-1.1H2.8V10h.06A1.8 1.8 0 0 0 4.5 8.9a1.8 1.8 0 0 0-.36-1.98l-.05-.05 2.78-2.78.05.05A1.8 1.8 0 0 0 8.9 4.5 1.8 1.8 0 0 0 10 2.86V2.8h3.9v.06A1.8 1.8 0 0 0 15 4.5a1.8 1.8 0 0 0 1.98-.36l.05-.05 2.78 2.78-.05.05A1.8 1.8 0 0 0 19.4 8.9 1.8 1.8 0 0 0 21.04 10h.06v3.9h-.06A1.8 1.8 0 0 0 19.4 15Z"/></svg>`,
    performance:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19V3M2 19h20"/></svg>`,
    customers:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.5 2.5-5.5 5.5-5.5s5 2 5.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5c2.8-.2 4.7 1.4 5 4.5"/></svg>`,
    payout:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M10 5h9v9M5 7v12h12"/></svg>`,
    cash:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5h16a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2z"/><path d="M3 8V6a2 2 0 0 1 2-2h13M16 13h5"/><circle cx="16" cy="13" r=".8"/></svg>`,
    more:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
    plus:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
    close:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
    lock:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
    user:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
    moon:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"/></svg>`,
    sun:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`
  };
  const labels={performance:'Performance',customers:'Customer Database',payout:'Withdraw',cash:'Petty Cash'};
  let booted=false;
  let resizeTimer=0;

  function isMobile(){return window.innerWidth<=MQ}
  function isAuthed(){return document.body.classList.contains('authenticated')&&!document.body.classList.contains('auth-locked')}
  function closeMore(){
    const s=document.getElementById('kairo-mobile-more-sheet');
    if(s){s.classList.remove('open');s.setAttribute('aria-hidden','true')}
    document.getElementById('kairo-mobile-more-btn')?.setAttribute('aria-expanded','false');
    document.body.classList.remove('kairo-mobile-sheet-open');
  }
  function closeQuickActions(){
    const s=document.getElementById('kairo-mobile-quick-sheet');
    if(s){s.classList.remove('open');s.setAttribute('aria-hidden','true')}
    document.getElementById('kairo-mobile-quick-btn')?.setAttribute('aria-expanded','false');
    document.body.classList.remove('kairo-mobile-sheet-open');
  }
  function navTo(tab){
    if(tab==='settings') document.getElementById('saas-settings-btn')?.click();
    else document.querySelector(`#saas-sidebar .tab[data-tab="${tab}"],.v19-nav .tab[data-tab="${tab}"]`)?.click();
    closeMore();
    setTimeout(sync,30);
  }
  function rebuildBottomNav(){
    let bar=document.getElementById('saas-mobile-bottom');
    if(!bar){bar=document.createElement('nav');bar.id='saas-mobile-bottom';document.body.appendChild(bar)}
    bar.setAttribute('aria-label','Navigasi mobile');
    bar.innerHTML='';
    const items=[
      {tab:'dashboard',label:'Dashboard'},
      {tab:'input',label:'Orders'},
      {kind:'quick',label:'Tambah',center:true},
      {tab:'promo',label:'Promo'},
      {kind:'more',label:'More'}
    ];
    items.forEach(item=>{
      const b=document.createElement('button');b.type='button';
      b.className='saas-mobile-nav-btn'+(item.center?' kairo-mobile-orders-main':'')+(item.kind==='more'?' kairo-mobile-more-btn':'');
      if(item.kind==='more'){
        b.id='kairo-mobile-more-btn';b.setAttribute('aria-expanded','false');
        b.innerHTML=`<span>${icons.more}</span><span>More</span>`;
        b.addEventListener('click',()=>{
          const s=document.getElementById('kairo-mobile-more-sheet');if(!s)return;
          const open=!s.classList.contains('open');
          closeQuickActions();
          s.classList.toggle('open',open);s.setAttribute('aria-hidden',open?'false':'true');
          b.setAttribute('aria-expanded',open?'true':'false');document.body.classList.toggle('kairo-mobile-sheet-open',open);
        });
      }else if(item.kind==='quick'){
        b.id='kairo-mobile-quick-btn';b.setAttribute('aria-expanded','false');
        b.innerHTML=`<span>${icons.plus}</span><span>${item.label}</span>`;
        b.addEventListener('click',()=>{
          const s=document.getElementById('kairo-mobile-quick-sheet');if(!s)return;
          const open=!s.classList.contains('open');
          closeMore();
          s.classList.toggle('open',open);s.setAttribute('aria-hidden',open?'false':'true');
          b.setAttribute('aria-expanded',open?'true':'false');document.body.classList.toggle('kairo-mobile-sheet-open',open);
        });
      }else{
        b.dataset.mobileTab=item.tab;b.innerHTML=`<span>${icons[item.tab]}</span><span>${item.label}</span>`;
        b.addEventListener('click',()=>navTo(item.tab));
      }
      bar.appendChild(b);
    });
  }
  function buildMore(){
    document.getElementById('kairo-mobile-more-sheet')?.remove();
    const wrap=document.createElement('div');wrap.id='kairo-mobile-more-sheet';wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML=`<button type="button" class="kairo-mobile-more-backdrop" aria-label="Tutup menu"></button><section class="kairo-mobile-more-panel" role="dialog" aria-modal="true" aria-label="Menu lainnya"><div class="kairo-mobile-sheet-handle"></div><div class="kairo-mobile-sheet-head"><div><strong>Menu Lainnya</strong><small>Akses cepat ke fitur workspace</small></div><button type="button" class="kairo-mobile-sheet-close" aria-label="Tutup menu">${icons.close}</button></div><div class="kairo-mobile-more-grid"></div><div class="kairo-mobile-sheet-tip"><span>✦</span><div><strong>Quick access</strong><small>Menu mengikuti akses paket dan role workspace.</small></div></div></section>`;
    document.body.appendChild(wrap);
    const grid=wrap.querySelector('.kairo-mobile-more-grid');
    ['performance','customers','payout','cash','settings'].forEach(tab=>{
      const b=document.createElement('button');b.type='button';b.className='saas-mobile-nav-btn kairo-mobile-more-item';b.dataset.mobileTab=tab;
      b.innerHTML=`<span>${icons[tab]}</span><span>${labels[tab]}</span>`;b.addEventListener('click',()=>navTo(tab));grid.appendChild(b);
    });
    wrap.querySelector('.kairo-mobile-more-backdrop')?.addEventListener('click',closeMore);
    wrap.querySelector('.kairo-mobile-sheet-close')?.addEventListener('click',closeMore);
  }
  function buildQuickActions(){
    document.getElementById('kairo-mobile-quick-sheet')?.remove();
    const wrap=document.createElement('div');wrap.id='kairo-mobile-quick-sheet';wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML=`<button type="button" class="kairo-mobile-more-backdrop" aria-label="Tutup aksi cepat"></button><section class="kairo-mobile-more-panel kairo-mobile-quick-panel" role="dialog" aria-modal="true" aria-label="Aksi cepat"><div class="kairo-mobile-sheet-handle"></div><div class="kairo-mobile-sheet-head"><div><strong>Aksi Cepat</strong><small>Mulai pekerjaan yang paling sering dipakai</small></div><button type="button" class="kairo-mobile-sheet-close" aria-label="Tutup aksi cepat">${icons.close}</button></div><div class="kairo-mobile-quick-grid"></div></section>`;
    document.body.appendChild(wrap);
    const grid=wrap.querySelector('.kairo-mobile-quick-grid');
    [
      {tab:'input',label:'Tambah Order',icon:'input'},
      {tab:'customers',label:'Tambah Customer',icon:'customers'},
      {tab:'cash',label:'Catat Pengeluaran',icon:'cash'},
      {tab:'promo',label:'Buat Promo',icon:'promo'}
    ].forEach(item=>{
      const b=document.createElement('button');b.type='button';b.className='kairo-mobile-quick-item';
      b.innerHTML=`<span>${icons[item.icon]}</span><strong>${item.label}</strong>`;
      b.addEventListener('click',()=>{navTo(item.tab);closeQuickActions()});grid.appendChild(b);
    });
    wrap.querySelector('.kairo-mobile-more-backdrop')?.addEventListener('click',closeQuickActions);
    wrap.querySelector('.kairo-mobile-sheet-close')?.addEventListener('click',closeQuickActions);
  }
  function desktopLogo(){
    return document.querySelector('#app-shell .header .brand-logo')?.getAttribute('src')||document.querySelector('#saas-sidebar .brand-logo')?.getAttribute('src')||'';
  }
  function mobileAutoLockValue(){return localStorage.getItem('kairo_autolock_minutes_v1')??'10'}
  function mobileAutoLockLabel(v=mobileAutoLockValue()){return ({'5':'5 menit','10':'10 menit','30':'30 menit','0':'Always On'})[String(v)]||'10 menit'}
  function closeHeaderMenus(except=''){
    if(except!=='lock')document.getElementById('kairo-mobile-lock-menu')?.classList.remove('show');
    if(except!=='profile')document.getElementById('kairo-mobile-profile-menu')?.classList.remove('show');
  }
  function buildMobileLockMenu(host){
    const menu=document.createElement('div');menu.id='kairo-mobile-lock-menu';menu.className='kairo-mobile-header-popover kairo-mobile-lock-popover';
    const desc={'5':'Kunci setelah 5 menit tidak aktif','10':'Kunci setelah 10 menit tidak aktif','30':'Kunci setelah 30 menit tidak aktif','0':'Dashboard tidak dikunci otomatis'};
    const render=()=>{const value=mobileAutoLockValue();menu.innerHTML=`<div class="kairo-mobile-popover-head"><strong>Lock Screen</strong><small>Pilih waktu auto-lock seperti versi desktop.</small></div>`+['5','10','30','0'].map(v=>`<button type="button" class="kairo-mobile-lock-option${value===v?' active':''}" data-mobile-lock-value="${v}"><span></span><div><strong>${mobileAutoLockLabel(v)}</strong><small>${desc[v]}</small></div></button>`).join('');menu.querySelectorAll('[data-mobile-lock-value]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();localStorage.setItem('kairo_autolock_minutes_v1',btn.dataset.mobileLockValue);window.__kairoResetIdle?.();render();syncPlan();menu.classList.remove('show');if(typeof showToast==='function')showToast(`Auto-lock diatur: ${mobileAutoLockLabel(btn.dataset.mobileLockValue)}.`)}));};
    render();host.appendChild(menu);return menu;
  }
  function buildMobileProfileMenu(host){
    const menu=document.createElement('div');menu.id='kairo-mobile-profile-menu';menu.className='kairo-mobile-header-popover kairo-mobile-profile-popover';
    const rebuild=()=>{const email=document.getElementById('user-email')?.textContent?.trim()||'';const originals=[...document.querySelectorAll('#saas-user-menu .saas-user-menu-item')];menu.innerHTML=`<div class="kairo-mobile-popover-head"><strong>Profil</strong>${email?`<small>${esc(email)}</small>`:''}</div><div class="kairo-mobile-profile-items"></div>`;const holder=menu.querySelector('.kairo-mobile-profile-items');if(originals.length){originals.forEach(original=>{const b=document.createElement('button');b.type='button';b.className='kairo-mobile-profile-item'+(original.classList.contains('saas-user-logout')?' danger':'');b.innerHTML=original.innerHTML;b.addEventListener('click',e=>{e.stopPropagation();menu.classList.remove('show');original.click()});holder.appendChild(b)})}else{const b=document.createElement('button');b.type='button';b.className='kairo-mobile-profile-item';b.textContent='Pengaturan akun';b.addEventListener('click',()=>navTo('settings'));holder.appendChild(b)}};
    rebuild();host.appendChild(menu);menu._rebuild=rebuild;return menu;
  }
  function buildBrandbar(){
    document.getElementById('kairo-mobile-brandbar')?.remove();
    const main=document.querySelector('#app-shell main.container,#app-shell .container');if(!main)return;
    const wrap=document.createElement('div');wrap.id='kairo-mobile-brandbar';
    wrap.innerHTML=`<div class="kairo-mobile-brand-top"><div class="kairo-mobile-brand-id"><img class="brand-logo kairo-mobile-brand-logo" alt="Logo workspace" src="${esc(desktopLogo())}"><div><strong>KAIRO WORKSPACES</strong><small id="kairo-mobile-workspace-name">Workspace</small></div></div><div class="kairo-mobile-header-actions"><button type="button" class="kairo-mobile-auto-lock" data-mobile-header-action="lock" aria-expanded="false">${icons.lock}<span><small>AUTO LOCK</small><strong>10 menit</strong></span>${icons.more}</button><button type="button" class="kairo-mobile-icon-action kairo-mobile-theme-action" data-mobile-header-action="theme" aria-label="Ganti mode tampilan"><span class="kairo-mobile-theme-icon"></span></button><button type="button" class="kairo-mobile-avatar-action" data-mobile-header-action="profile" aria-label="Buka profil">G</button></div></div><div id="kairo-mobile-plan-card" class="kairo-mobile-plan-card"><span class="kairo-mobile-plan-icon">${icons.performance}</span><div><strong>Paket aktif</strong><small>Status paket workspace aktif.</small></div><span class="kairo-mobile-plan-chevron">›</span></div>`;
    main.insertBefore(wrap,main.firstChild);
    const actions=wrap.querySelector('.kairo-mobile-header-actions');
    const lockMenu=buildMobileLockMenu(actions),profileMenu=buildMobileProfileMenu(actions);
    const lockBtn=wrap.querySelector('[data-mobile-header-action="lock"]');
    lockBtn?.addEventListener('click',e=>{e.stopPropagation();const open=!lockMenu.classList.contains('show');closeHeaderMenus(open?'lock':'');lockMenu.classList.toggle('show',open);lockBtn.setAttribute('aria-expanded',open?'true':'false')});
    wrap.querySelector('[data-mobile-header-action="theme"]')?.addEventListener('click',e=>{e.stopPropagation();closeHeaderMenus();document.getElementById('saas-theme-toggle')?.click();setTimeout(syncPlan,50)});
    wrap.querySelector('[data-mobile-header-action="profile"]')?.addEventListener('click',e=>{e.stopPropagation();profileMenu._rebuild?.();const open=!profileMenu.classList.contains('show');closeHeaderMenus(open?'profile':'');profileMenu.classList.toggle('show',open)});
    document.addEventListener('click',()=>closeHeaderMenus(),{once:false});
    syncPlan();
  }
  function syncPlan(){
    const name=document.getElementById('kairo-mobile-workspace-name');if(name)name.textContent=(typeof activeWorkspaceName!=='undefined'&&activeWorkspaceName)||'Workspace';
    const logo=document.querySelector('.kairo-mobile-brand-logo');if(logo&&desktopLogo())logo.src=desktopLogo();
    const card=document.getElementById('kairo-mobile-plan-card');if(card){
      const p=String((typeof activeWorkspacePlan!=='undefined'&&activeWorkspacePlan)||'basic').toUpperCase();
      const source=document.getElementById('kairo-basic-header-upgrade-v83');
      const title=source?.querySelector('strong')?.textContent?.trim()||`Paket ${p} aktif`;
      const copy=source?.querySelector('small')?.textContent?.trim()||'Status paket workspace aktif.';
      const mainCopy=card.querySelector(':scope > div:not(.kairo-mobile-plan-actions)');
      if(mainCopy){mainCopy.querySelector('strong').textContent=title;mainCopy.querySelector('small').textContent=copy}
    }
    const dark=document.body.classList.contains('saas-dark');
    const theme=document.querySelector('[data-mobile-header-action="theme"]');
    if(theme)theme.querySelector('.kairo-mobile-theme-icon').innerHTML=dark?icons.sun:icons.moon;
    const lock=document.querySelector('[data-mobile-header-action="lock"]');
    if(lock){const strong=lock.querySelector('strong');if(strong)strong.textContent=mobileAutoLockLabel();lock.style.display=document.getElementById('kairo-lock-trigger')?'':'none'}
    const avatar=document.querySelector('[data-mobile-header-action="profile"]');
    if(avatar){const raw=(document.getElementById('user-email')?.textContent||'G').trim();avatar.textContent=(raw.match(/[A-Za-z0-9]/)?.[0]||'G').toUpperCase()}
  }
  function settingsItems(){
    const buttons=[...document.querySelectorAll('.saas-settings-submenu-btn[data-settings-category]')];
    if(buttons.length)return buttons.map(b=>({key:b.dataset.settingsCategory,label:b.textContent.replace(/\s+/g,' ').trim(),button:b}));
    const select=document.getElementById('settings-category-select');
    return select?[...select.options].filter(o=>o.value).map(o=>({key:o.value,label:o.textContent.trim(),button:null})):[];
  }
  function buildSettings(){
    const settings=document.getElementById('settings');if(!settings)return;
    document.getElementById('kairo-mobile-settings-hub')?.remove();
    const items=settingsItems();if(!items.length)return;
    const hub=document.createElement('div');hub.id='kairo-mobile-settings-hub';hub.className='kairo-mobile-settings-hub';
    items.forEach(({key,label,button})=>{
      const icon=key==='packages'||key==='receipt'?icons.input:key==='addons'?icons.promo:key==='topics'?icons.customers:key==='profit'?icons.performance:icons.settings;
      const b=document.createElement('button');b.type='button';b.className='kairo-mobile-settings-link';b.dataset.settingsCategory=key;
      b.innerHTML=`<span class="kairo-mobile-settings-icon">${icon}</span><span class="kairo-mobile-settings-copy"><strong>${esc(label)}</strong><small>Kelola pengaturan ${esc(label.toLowerCase())}</small></span><span class="kairo-mobile-settings-arrow">›</span>`;
      b.addEventListener('click',()=>{
        const target=document.querySelector(`.saas-settings-submenu-btn[data-settings-category="${CSS.escape(key)}"]`);
        if(target)target.click();else{const select=document.getElementById('settings-category-select');if(select){select.value=key;select.dispatchEvent(new Event('change',{bubbles:true}))}}
        setTimeout(syncSettings,20);
      });
      const locked=button&&(button.getAttribute('aria-disabled')==='true'||button.classList.contains('settings-pro-locked')||button.classList.contains('kairo-feature-locked'));
      if(locked){b.classList.add('locked');b.setAttribute('aria-disabled','true')}
      hub.appendChild(b);
    });
    const anchor=settings.querySelector('.settings-category-shell')||settings.firstElementChild;
    if(anchor)anchor.insertAdjacentElement('afterend',hub);else settings.prepend(hub);
    syncSettings();
  }
  function syncSettings(){
    const select=document.getElementById('settings-category-select');const value=select?.value||'';
    document.querySelectorAll('#kairo-mobile-settings-hub .kairo-mobile-settings-link').forEach(b=>b.classList.toggle('active',b.dataset.settingsCategory===value));
  }
  function sync(){
    if(!isMobile()||!isAuthed())return;
    const active=document.querySelector('.section.active')?.id||'dashboard';
    document.querySelectorAll('#saas-mobile-bottom .saas-mobile-nav-btn[data-mobile-tab],#kairo-mobile-more-sheet .saas-mobile-nav-btn[data-mobile-tab]').forEach(b=>b.classList.toggle('active',b.dataset.mobileTab===active));
    document.getElementById('kairo-mobile-more-btn')?.classList.toggle('active',['performance','customers','payout','cash','settings'].includes(active));
    if(active==='settings'){if(!document.getElementById('kairo-mobile-settings-hub'))buildSettings();syncSettings()}
    syncPlan();
  }
  function boot(){
    if(!isMobile()||!isAuthed())return;
    if(!booted){rebuildBottomNav();buildMore();buildQuickActions();buildBrandbar();buildSettings();booted=true}else{
      if(!document.getElementById('saas-mobile-bottom'))rebuildBottomNav();
      if(!document.getElementById('kairo-mobile-more-sheet'))buildMore();
      if(!document.getElementById('kairo-mobile-quick-sheet'))buildQuickActions();
      if(!document.getElementById('kairo-mobile-brandbar'))buildBrandbar();
    }
    sync();
  }
  function teardown(){
    if(isMobile())return;
    closeMore();
    closeQuickActions();
    document.getElementById('kairo-mobile-brandbar')?.remove();
    document.getElementById('kairo-mobile-more-sheet')?.remove();
    document.getElementById('kairo-mobile-quick-sheet')?.remove();
    document.getElementById('kairo-mobile-settings-hub')?.remove();
    booted=false;
  }

  // IMPORTANT: installed after every existing auth/account script. It only decorates UI after hydration/auth succeeds.
  const priorHydrate=window.hydrateSaasUi||((typeof hydrateSaasUi==='function')?hydrateSaasUi:null);
  if(typeof priorHydrate==='function'){
    const wrapped=function(){const r=priorHydrate.apply(this,arguments);setTimeout(boot,60);return r};
    try{window.hydrateSaasUi=wrapped;hydrateSaasUi=wrapped}catch(e){window.hydrateSaasUi=wrapped}
  }
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(isMobile())boot();else teardown()},120)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMore();closeQuickActions()}});
  // One harmless fallback for already-authenticated sessions; no observer/polling.
  setTimeout(()=>{if(isAuthed())boot()},900);
})();


/* =========================================================
   KAIRO v20.10.119 — SELLER APP PREMIUM LAZY TEMPLATE LOADER
   Isolated: only digital_subscription users load seller assets.
   ========================================================= */
(function(){
  let sellerTemplateBooted=false;
  let sellerTemplateChecking=false;
  async function maybeBootSellerTemplate(){
    if(sellerTemplateBooted||sellerTemplateChecking)return;
    if(!document.body.classList.contains('authenticated'))return;
    sellerTemplateChecking=true;
    try{
      const {data}=await db.auth.getSession();
      const template=String(data?.session?.user?.user_metadata?.business_template||'').toLowerCase();
      if(template!=='digital_subscription')return;
      sellerTemplateBooted=true;
      document.documentElement.dataset.businessTemplate='digital_subscription';
      if(!document.getElementById('seller-app-premium-css')){
        const link=document.createElement('link');
        link.id='seller-app-premium-css';
        link.rel='stylesheet';
        link.href='assets/templates/seller-app-premium.css?v=20.10.144';
        document.head.appendChild(link);
      }
      if(!document.getElementById('seller-app-premium-js')){
        const script=document.createElement('script');
        script.id='seller-app-premium-js';
        script.src='assets/templates/seller-app-premium.js?v=20.10.144';
        script.defer=true;
        document.body.appendChild(script);
      }
    }catch(err){console.warn('Seller App Premium template loader:',err?.message||err);}
    finally{sellerTemplateChecking=false;}
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-tab="input"],[data-mobile-tab="input"],.kairo-mobile-orders-main'))setTimeout(maybeBootSellerTemplate,0);
  },true);
  // Seller-only login bootstrap: bounded retries after an actual login submit.
  // No observer and no polling loop; this only makes the seller template available
  // on the first Dashboard render after login.
  document.addEventListener('submit',e=>{
    if(e.target?.id!=='login-form')return;
    [350,800,1500,2600].forEach(ms=>setTimeout(maybeBootSellerTemplate,ms));
  },true);
  setTimeout(maybeBootSellerTemplate,700);
})();

/* =========================================================
   KAIRO UI V2 — dashboard hierarchy enhancer
   Presentation-only. It links to existing sections; it never writes data.
   ========================================================= */
(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dateLabel=()=>new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  function openTab(tab){
    if(tab==='settings')document.getElementById('saas-settings-btn')?.click();
    else document.querySelector(`#saas-sidebar .tab[data-tab="${tab}"],.v19-nav .tab[data-tab="${tab}"]`)?.click();
  }
  function render(){
    if(!document.body.classList.contains('authenticated'))return;
    const dashboard=document.getElementById('dashboard');if(!dashboard)return;
    let hero=document.getElementById('kairo-v2-dashboard-hero');
    if(!hero){
      hero=document.createElement('section');hero.id='kairo-v2-dashboard-hero';hero.className='kairo-v2-dashboard-hero';
      dashboard.insertBefore(hero,dashboard.firstChild);
    }
    const name=typeof activeWorkspaceName!=='undefined'&&activeWorkspaceName?activeWorkspaceName:'Workspace';
    hero.innerHTML=`<div class="kairo-v2-greeting"><span class="kairo-v2-eyebrow">WORKSPACE HARI INI</span><h2>Halo, siap rapihin bisnismu?</h2><p>${esc(name)} · ${esc(dateLabel())}</p></div><div class="kairo-v2-quick-actions" aria-label="Aksi cepat"><button type="button" data-kairo-v2-action="input"><span>＋</span>Tambah Order</button><button type="button" data-kairo-v2-action="customers"><span>◌</span>Tambah Customer</button><button type="button" data-kairo-v2-action="cash"><span>↗</span>Catat Pengeluaran</button><button type="button" data-kairo-v2-action="promo"><span>✦</span>Buat Promo</button></div>`;
    hero.querySelectorAll('[data-kairo-v2-action]').forEach(button=>button.addEventListener('click',()=>openTab(button.dataset.kairoV2Action)));
  }
  document.addEventListener('submit',e=>{if(e.target?.id==='login-form')[700,1500,2800].forEach(ms=>setTimeout(render,ms))},true);
  document.addEventListener('click',e=>{if(e.target.closest('[data-tab="dashboard"],[data-mobile-tab="dashboard"],#saas-side-home'))setTimeout(render,40)},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(render,900));else setTimeout(render,900);
})();
