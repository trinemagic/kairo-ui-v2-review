// Seed Pre-Order & Jastip: SEED dasar + 6 pre-order (lunas/DP/cicilan/batal), buku uang (talangan valas, biaya, refund), jadwal cicilan.
module.exports = require('./seed.js') + `
(function(){
  const D=n=>iso(now+n*86400000), TS=n=>new Date(now+n*86400000).toISOString();
  T.topic_masters=['Fashion','Tas & Aksesoris','Skincare & Kosmetik','Elektronik','Makanan & Snack','Lainnya'].map((n,i)=>({id:'k'+i,workspace_id:'w1',name:n,is_active:true}));
  T.partners=[{id:'pa1',workspace_id:'w1',partner_name:'Rani',share_pct:50,percentage:0.5,is_active:true},{id:'pa2',workspace_id:'w1',partner_name:'Dina',share_pct:50,percentage:0.5,is_active:true}];
  T.profit_share_rules=T.partners.map(p=>({...p}));
  T.customers=[['Sinta','081234567801'],['Maya','081234567802'],['Ayu','081234567803'],['Lina',''],['Nadia','081234567805'],['Rina','081234567806']].map((c,i)=>({id:'c'+i,workspace_id:'w1',display_name:c[0],whatsapp:c[1]||null,created_at:TS(-40)}));
  const item=(n,q,p)=>({id:'po-item-1',code:'PO',name:n,qty:q,unit_price:p,subtotal:q*p,cost_price:0,cost_subtotal:0,profit_share_mode:'percentage',manual_profit_split:[]});
  const fee=(n,p)=>({id:'po-fee-1',code:'FEE',name:n,qty:1,unit_price:p,subtotal:p,cost_price:0,cost_subtotal:0,profit_share_mode:'percentage',manual_profit_split:[],is_charge:true});
  const tx=(id,c,day,items,fees,cat,st,scheme,eta)=>{const total=[...items,...fees].reduce((s,x)=>s+x.subtotal,0);return {id,workspace_id:'w1',transaction_date:D(day),created_at:TS(day),reading_started_at:TS(day),reading_status:st==='delivered'||st==='cancelled'?'done':'on_progress',customer_name:T.customers[c].display_name,customer_id:'c'+c,whatsapp:T.customers[c].whatsapp,platform:'Instagram',package_code:'PRE-ORDER',package_qty:items.reduce((s,x)=>s+x.qty,0),total_price:total,order_items:items,order_addons:fees,order_topics:[{id:'k'+cat,name:T.topic_masters[cat].name}],topic_name:T.topic_masters[cat].name,payment_method:'TRANSFER',po_status:st,po_scheme:scheme,po_eta:eta===undefined?null:D(eta)};};
  T.transactions=[
    tx('j1',0,-20,[item('Sneakers Onitsuka Tiger Mexico 66',1,1200000)],[fee('Jasa titip',150000)],0,'delivered','full'),
    tx('j2',1,-40,[item('Tas Charles & Keith Mini',1,2100000)],[fee('Jasa titip',300000)],1,'shipping','installment',6),
    tx('j3',2,-25,[item('Paket Skincare Korea (5 item)',1,950000)],[fee('Jasa titip',150000)],2,'arrived','dp'),
    tx('j4',3,-12,[item('Kaos Uniqlo Jepang',3,250000)],[fee('Jasa titip',75000)],0,'bought','full',-5),
    tx('j5',4,-30,[item('Snack Jepang Kit Kat Matcha',4,90000)],[],4,'cancelled','dp'),
    tx('j6',5,-35,[item('AirPods Pro (USA)',1,3400000)],[fee('Jasa titip',250000)],3,'delivered','installment')
  ];
  const L=(id,day,kind,amount,o)=>Object.assign({id,workspace_id:'w1',entry_date:D(day),kind,amount,currency:'IDR',created_at:TS(day)},o||{});
  T.ledger_entries=[
    L('l1',-20,'customer_payment',1350000,{transaction_id:'j1',customer_id:'c0',method:'TRANSFER',category:'Pelunasan',recorded_by:'Rani'}),
    L('l2',-18,'partner_advance',1134000,{transaction_id:'j1',partner_id:'pa1',partner_name:'Rani',category:'Harga barang',currency:'USD',amount_foreign:70,fx_rate:16200,recorded_by:'Rani'}),
    L('l3',-40,'customer_payment',600000,{transaction_id:'j2',customer_id:'c1',method:'TRANSFER',category:'DP',recorded_by:'Dina'}),
    L('l4',-38,'partner_advance',1770000,{transaction_id:'j2',partner_id:'pa2',partner_name:'Dina',category:'Harga barang',currency:'KRW',amount_foreign:150000,fx_rate:11.8,recorded_by:'Dina'}),
    L('l5',-8,'customer_payment',300000,{transaction_id:'j2',customer_id:'c1',method:'TRANSFER',recorded_by:'Dina'}),
    L('l6',-25,'customer_payment',500000,{transaction_id:'j3',customer_id:'c2',method:'QRIS',category:'DP',recorded_by:'Rani'}),
    L('l7',-23,'order_cost',820000,{transaction_id:'j3',category:'Harga barang',recorded_by:'Rani'}),
    L('l8',-12,'customer_payment',825000,{transaction_id:'j4',customer_id:'c3',method:'TRANSFER',category:'Pelunasan',recorded_by:'Dina'}),
    L('l9',-30,'customer_payment',150000,{transaction_id:'j5',customer_id:'c4',method:'TRANSFER',category:'DP',recorded_by:'Rani'}),
    L('l10',-28,'refund',150000,{transaction_id:'j5',customer_id:'c4',method:'TRANSFER',note:'Stok habis di toko',recorded_by:'Rani'}),
    L('l11',-35,'customer_payment',1000000,{transaction_id:'j6',customer_id:'c5',method:'TRANSFER',category:'DP',recorded_by:'Dina'}),
    L('l12',-33,'partner_advance',3080000,{transaction_id:'j6',partner_id:'pa1',partner_name:'Rani',category:'Harga barang',currency:'USD',amount_foreign:190,fx_rate:16210.53,recorded_by:'Rani'}),
    L('l13',-5,'customer_payment',1325000,{transaction_id:'j6',customer_id:'c5',method:'TRANSFER',recorded_by:'Dina'}),
    L('l14',-3,'advance_repayment',500000,{partner_id:'pa1',partner_name:'Rani',method:'TRANSFER',recorded_by:'Dina'}),
    L('l15',-6,'operating_expense',75000,{category:'Packing',note:'Bubble wrap & kardus',recorded_by:'Rani'}),
    L('l16',-4,'other_income',50000,{category:'Fee lain',note:'Ongkir lebih dari customer',recorded_by:'Dina'}),
    L('l17',-2,'operating_expense',30000,{category:'Admin bank',note:'salah catat',recorded_by:'Rani'}),
    L('l18',-1,'reversal',30000,{reverses_id:'l17',note:'Dobel input',recorded_by:'Rani'})
  ];
  T.installment_schedules=[
    {id:'s2',workspace_id:'w1',transaction_id:'j2',version:1,frequency:'monthly',items:{base_paid:600000,list:[{seq:1,due:D(-10),amount:600000},{seq:2,due:D(2),amount:600000},{seq:3,due:D(32),amount:600000}]},created_at:TS(-40)},
    {id:'s3',workspace_id:'w1',transaction_id:'j3',version:1,frequency:'once',items:{base_paid:500000,list:[{seq:1,due:D(0),amount:600000}]},created_at:TS(-25)},
    {id:'s5',workspace_id:'w1',transaction_id:'j5',version:1,frequency:'once',items:{base_paid:150000,list:[{seq:1,due:D(-10),amount:210000}]},created_at:TS(-30)},
    {id:'s6',workspace_id:'w1',transaction_id:'j6',version:1,frequency:'monthly',items:{base_paid:1000000,list:[{seq:1,due:D(-5),amount:1325000},{seq:2,due:D(25),amount:1325000}]},created_at:TS(-35)}
  ];
  T.payouts=[{id:'py1',workspace_id:'w1',partner_id:'pa1',partner_name:'Rani',amount:50000,payout_date:D(-1),notes:'Bagi hasil'}];
  T.cash_expenses=[];T.cash_injections=[];T.reading_shifts=[];T.promos=[];
})();`;
