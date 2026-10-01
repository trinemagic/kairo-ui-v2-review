module.exports = `
const now=Date.now(), iso=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const plats=['Instagram','TikTok','X','WhatsApp','Threads'];
T.package_masters=[{id:'p1',workspace_id:'w1',code:'TR3',name:'Tarot 3 Kartu',price:50000,is_active:true},{id:'p2',workspace_id:'w1',code:'LOVE',name:'Love Reading',price:75000,is_active:true}];
T.addon_masters=[{id:'a1',workspace_id:'w1',code:'VN',name:'Voice Note',price:10000,is_active:true}];
T.topic_masters=[{id:'t1',workspace_id:'w1',name:'Karier',is_active:true},{id:'t2',workspace_id:'w1',name:'Asmara',is_active:true}];
T.partners=[{id:'pa1',workspace_id:'w1',partner_name:'Nesa',share_pct:40,percentage:40,is_active:true},{id:'pa2',workspace_id:'w1',partner_name:'Ganesh',share_pct:40,percentage:40,is_active:true},{id:'pa3',workspace_id:'w1',partner_name:'Kas',share_pct:20,percentage:20,is_active:true}];
T.transactions=[];
for(let i=0;i<40;i++){const d=now-i*0.7*86400000;T.transactions.push({id:'tx'+i,workspace_id:'w1',transaction_date:iso(d),created_at:new Date(d).toISOString(),reading_started_at:new Date(i<3?now-(8+i*15)*60000:d).toISOString(),reading_status:i<3?'on_progress':'done',customer_name:['Alya Putri','Bima','Citra Dewi','Dimas','Eka'][i%5],customer_id:'c'+(i%5),platform:plats[i%5],order_items:[{code:i%2?'TR3':'LOVE',name:i%2?'Tarot 3 Kartu':'Love Reading',qty:1,subtotal:i%2?50000:75000}],order_topics:[{name:'Karier'}],order_addons:[],package_code:i%2?'TR3':'LOVE',package_qty:1,total_price:i%2?50000:75000,tip_amount:i%4?0:5000,payment_method:'QRIS'})}
T.profit_share_rules=T.partners.map(p=>({...p}));
T.customers=[0,1,2,3,4].map(i=>({id:'c'+i,workspace_id:'w1',display_name:['Alya Putri','Bima','Citra Dewi','Dimas','Eka'][i],created_at:new Date().toISOString()}));
T.payouts=[{id:'po1',workspace_id:'w1',partner_id:'pa1',partner_name:'Nesa',amount:100000,payout_date:iso(now-2*86400000),notes:'Transfer'}];
T.cash_expenses=[{id:'ce1',workspace_id:'w1',expense_date:iso(now),amount:25000,description:'Iklan Instagram'}];
T.cash_injections=[{id:'ci1',workspace_id:'w1',injection_date:iso(now-86400000),amount:500000,source:'Pribadi',description:'Modal awal'}];
T.reading_shifts=[{id:'s1',workspace_id:'w1',opened_at:new Date(now-3*3600000).toISOString(),closed_at:null}];
T.promos=[{id:'pr1',workspace_id:'w1',name:'Promo Gajian',target:'all',discount_type:'percent',discount_value:10,is_active:true,starts_at:iso(now),ends_at:iso(now+7*86400000)}];
T.workspace_branding=[{workspace_id:'w1',primary_color:'#696F41',accent_color:'#EA97A9'}];
`;
