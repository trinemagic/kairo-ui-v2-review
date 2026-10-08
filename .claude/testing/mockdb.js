// In-memory Supabase-like client for UI tests. window.__db.tables holds rows; window.__db.log records calls.
window.__db = { tables: {}, log: [], failInsert: {} };
window.supabase = { createClient: () => {
  const D = window.__db;
  const match = (row, filters) => filters.every(([op, k, v]) => {
    const x = row[k];
    if (op === 'eq') return String(x) === String(v);
    if (op === 'lte') return String(x ?? '') <= String(v);
    if (op === 'gte') return String(x ?? '') >= String(v);
    if (op === 'gt') return String(x ?? '') > String(v);
    if (op === 'lt') return String(x ?? '') < String(v);
    if (op === 'in') return v.map(String).includes(String(x));
    return true;
  });
  const builder = (table) => {
    const st = { table, op: 'select', filters: [], payload: null, single: false };
    const b = {
      select() { return b; }, order() { return b; }, limit() { return b; }, range(a, z) { st.range = [a, z]; return b; },
      eq(k, v) { st.filters.push(['eq', k, v]); return b; }, lte(k, v) { st.filters.push(['lte', k, v]); return b; },
      gte(k, v) { st.filters.push(['gte', k, v]); return b; }, gt(k, v) { st.filters.push(['gt', k, v]); return b; }, lt(k, v) { st.filters.push(['lt', k, v]); return b; }, in(k, v) { st.filters.push(['in', k, v]); return b; },
      neq() { return b; }, is() { return b; }, not() { return b; }, or() { return b; }, ilike() { return b; },
      insert(p) { st.op = 'insert'; st.payload = p; return b; }, update(p) { st.op = 'update'; st.payload = p; return b; },
      upsert(p, o) { st.op = 'upsert'; st.payload = p; st.conflict = o?.onConflict; return b; }, delete() { st.op = 'delete'; return b; },
      single() { st.single = true; return b; }, maybeSingle() { st.single = true; return b; },
      then(res, rej) {
        const rows = (D.tables[table] = D.tables[table] || []);
        D.log.push(st.op + ':' + table + (st.filters.length ? ' ' + JSON.stringify(st.filters) : '') + (st.payload ? ' ' + JSON.stringify(st.payload).slice(0, 160) : ''));
        let out;
        if (st.op === 'insert') {
          if (D.failInsert[table]) return Promise.resolve({ data: null, error: { message: D.failInsert[table] } }).then(res, rej);
          const rejectCol = (D.rejectColumn || {})[table];
          if (rejectCol && (Array.isArray(st.payload) ? st.payload : [st.payload]).some(r => rejectCol in r)) return Promise.resolve({ data: null, error: { message: `Could not find the '${rejectCol}' column of '${table}' in the schema cache` } }).then(res, rej);
          const list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map(r => ({ id: 'id' + Math.random().toString(36).slice(2, 8), created_at: new Date().toISOString(), ...r }));
          rows.push(...list); out = list;
        } else if (st.op === 'update') { out = rows.filter(r => match(r, st.filters)); out.forEach(r => Object.assign(r, st.payload)); }
        else if (st.op === 'delete') { out = rows.filter(r => match(r, st.filters)); D.tables[table] = rows.filter(r => !match(r, st.filters)); }
        else if (st.op === 'upsert') { const p = Array.isArray(st.payload) ? st.payload : [st.payload], keys = st.conflict ? String(st.conflict).split(',').map(k => k.trim()) : null; out = p.map(r => { const hit = keys && rows.find(x => keys.every(k => String(x[k]) === String(r[k]))); if (hit) return Object.assign(hit, r); rows.push(r); return r; }); }
        else { out = rows.filter(r => match(r, st.filters)); if (st.range) out = out.slice(st.range[0], st.range[1] + 1); }
        return Promise.resolve({ data: st.single ? (out[0] || null) : out, error: null, count: out.length }).then(res, rej);
      }
    };
    return b;
  };
  const q = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : q, apply: () => q });
  return {
    from: builder,
    rpc: async () => ({ data: null, error: null }),
    channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
    removeChannel() {},
    // Storage: upload/remove/getPublicUrl; uploaded files land in __db.storage (path -> {type,size}).
    storage: { from: (bucket) => ({
      async upload(path, blob, opts) { (D.storage = D.storage || {})[bucket + '/' + path] = { type: opts?.contentType || blob?.type, size: blob?.size || 0 }; D.log.push('upload:' + bucket + '/' + path); return { data: { path }, error: null }; },
      async remove(paths) { paths.forEach(x => { if (D.storage) delete D.storage[bucket + '/' + x]; }); return { data: [], error: null }; },
      getPublicUrl(path) { return { data: { publicUrl: 'assets/brand/kairo-app-icon.svg#' + bucket + '/' + path } }; }
    }) },
    auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}), getUser: async () => ({ data: { user: null } }) }
  };
} };
