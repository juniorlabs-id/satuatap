/* ============================================================
 * Store — data lokal (tabel di memori + IndexedDB) & sinkronisasi
 *  - Render selalu dari data lokal (instan)
 *  - Perubahan diterapkan lokal dulu (optimistic), masuk antrean,
 *    lalu dikirim ke server dalam satu batch.
 *  - Sinkron hanya mengambil baris yang berubah (delta berbasis rev).
 * ============================================================ */
(function () {
  const SCHEMA = {
    Anggota:   ['id', 'nama', 'email', 'peran', 'warna', 'izin', 'aktif', 'dibuat'],
    Pengaturan:['id', 'nilai'],
    Wallet:    ['id', 'nama', 'jenis', 'pemilik', 'saldoAwal', 'ikon', 'likuid', 'urutan', 'arsip', 'catatan'],
    Kategori:  ['id', 'nama', 'jenis', 'kelompok', 'ikon', 'batas', 'bawaSisa', 'tetap', 'pribadi', 'urutan', 'arsip'],
    Transaksi: ['id', 'tanggal', 'jenis', 'jumlah', 'kategoriId', 'walletId', 'walletTujuan', 'biaya', 'catatan',
                'dibayarOleh', 'tag', 'sumber', 'refId', 'periodeRef', 'dicatatOleh', 'dibuat', 'riwayat'],
    Template:  ['id', 'nama', 'jenis', 'jumlah', 'kategoriId', 'walletId', 'catatan', 'urutan'],
    Rutin:     ['id', 'nama', 'jenis', 'jumlah', 'kategoriId', 'walletId', 'frekuensi', 'tanggal', 'bulan',
                'mulai', 'selesai', 'langganan', 'ditinjau', 'aktif', 'catatan'],
    Acara:     ['id', 'nama', 'tanggal', 'estimasi', 'besar', 'catatan'],
    GeserDana: ['id', 'tanggal', 'periode', 'dari', 'ke', 'jumlah', 'catatan'],
    Tujuan:    ['id', 'nama', 'ikon', 'target', 'tenggat', 'prioritas', 'jenis', 'pemilik', 'setoranBulanan',
                'walletId', 'arsip', 'catatan', 'dibuat'],
    Pinjaman:  ['id', 'arah', 'jenis', 'pihak', 'pokok', 'bunga', 'metode', 'tenor', 'mulai', 'tanggalBayar',
                'cicilan', 'walletId', 'lunas', 'catatan', 'dibuat'],
    Laporan:   ['id', 'tanggal', 'jenis', 'modul', 'judul', 'deskripsi', 'prioritas', 'status']
  };
  const NUM = { saldoAwal: 1, urutan: 1, batas: 1, jumlah: 1, biaya: 1, tanggal_r: 1, estimasi: 1, target: 1, prioritas: 1,
                setoranBulanan: 1, pokok: 1, bunga: 1, tenor: 1, tanggalBayar: 1, cicilan: 1, rev: 1 };
  const BOOL = { likuid: 1, arsip: 1, bawaSisa: 1, tetap: 1, langganan: 1, aktif: 1, besar: 1, lunas: 1 };
  const JSONC = { izin: 1, riwayat: 1 };

  function typed(t, col, v) {
    if (v === undefined || v === null) v = '';
    if (JSONC[col]) { if (typeof v === 'object') return v; try { return v ? JSON.parse(v) : (col === 'riwayat' ? [] : {}); } catch (e) { return col === 'riwayat' ? [] : {}; } }
    if (BOOL[col]) return v === true || v === 'true';
    if (NUM[col] || (t === 'Rutin' && (col === 'tanggal' || col === 'bulan'))) return v === '' ? 0 : Number(v) || 0;
    return String(v);
  }
  function rowFromArray(t, cols, arr) {
    const o = {};
    cols.forEach((c, i) => { o[c] = typed(t, c, arr[i]); });
    return o;
  }
  function toWire(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  }

  // ---------------- IndexedDB key-value ----------------
  const IDB = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        const r = indexedDB.open('satuatap', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    async get(k) { try { const db = await this.open(); return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch (e) { return undefined; } },
    async set(k, v) { try { const db = await this.open(); return await new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); } catch (e) { return false; } },
    async del(k) { try { const db = await this.open(); return await new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(true); }); } catch (e) { return false; } }
  };

  // ---------------- Store ----------------
  const S = {
    SCHEMA, IDB, typed, rowFromArray,
    t: {},          // tabel → array baris
    byId: {},       // tabel → {id: baris}
    rev: 0, ver: 0, me: null, token: '', gasUrl: '', mode: '',   // mode: 'live' | 'demo'
    outbox: [],     // [{reqId, ops:[...]}]
    listeners: [],
    syncing: false, lastSync: 0, online: navigator.onLine !== false, pendingSave: null
  };
  Object.keys(SCHEMA).forEach(k => { S.t[k] = []; S.byId[k] = {}; });

  S.on = fn => S.listeners.push(fn);
  S.emit = (why) => { S.ver++; S.listeners.forEach(fn => { try { fn(why); } catch (e) { console.error(e); } }); };
  S.ns = () => (S.mode === 'demo' ? 'demo:' : 'live:' + U.hash(S.gasUrl || '') + ':');

  S.reset = () => { Object.keys(SCHEMA).forEach(k => { S.t[k] = []; S.byId[k] = {}; }); S.rev = 0; S.outbox = []; };

  S.applySnapshot = (boot) => {
    S.reset();
    Object.keys(boot.tables || {}).forEach(t => {
      if (!SCHEMA[t]) return;
      const { c, r } = boot.tables[t];
      const rows = r.map(a => rowFromArray(t, c, a));
      S.t[t] = rows; S.byId[t] = {}; rows.forEach(x => S.byId[t][x.id] = x);
    });
    S.rev = boot.rev || 0;
  };

  S.applyDelta = (d) => {
    let changed = false;
    const pend = S.pendingIds();
    Object.keys(d.tables || {}).forEach(t => {
      if (!SCHEMA[t]) return;
      const { c, r } = d.tables[t];
      r.forEach(a => {
        const row = rowFromArray(t, c, a);
        if (pend[t + ':' + row.id]) return;            // jangan timpa perubahan lokal yang belum terkirim
        const ex = S.byId[t][row.id];
        if (ex) {
          if (SCHEMA[t].every(k => toWire(ex[k]) === toWire(row[k]))) return;   // sama persis (mis. gema tulisan sendiri) → tak perlu render ulang
          Object.assign(ex, row);
        } else { S.t[t].push(row); S.byId[t][row.id] = row; }
        changed = true;
      });
    });
    (d.del || []).forEach(([t, id]) => {
      if (!S.byId[t] || !S.byId[t][id]) return;
      delete S.byId[t][id]; S.t[t] = S.t[t].filter(x => x.id !== id); changed = true;
    });
    if (d.rev) S.rev = d.rev;
    return changed;
  };

  S.pendingIds = () => {
    const m = {};
    S.outbox.forEach(b => b.ops.forEach(o => { m[o.t + ':' + (o.id || (o.row && o.row.id))] = 1; }));
    return m;
  };

  // ---- Persistensi (debounce) ----
  S.persist = U.debounce(async () => {
    const snap = { rev: S.rev, tables: {} };
    Object.keys(SCHEMA).forEach(t => {
      const cols = SCHEMA[t];
      snap.tables[t] = { c: cols, r: S.t[t].map(x => cols.map(c => toWire(x[c]))) };
    });
    await IDB.set(S.ns() + 'snap', snap);
    await IDB.set(S.ns() + 'outbox', S.outbox);
  }, 400);

  S.loadLocal = async () => {
    const snap = await IDB.get(S.ns() + 'snap');
    const ob = await IDB.get(S.ns() + 'outbox');
    if (snap) S.applySnapshot(snap);
    S.outbox = Array.isArray(ob) ? ob : [];
    // terapkan ulang antrean yang belum terkirim
    S.outbox.forEach(b => b.ops.forEach(applyOpLocal));
    return !!snap;
  };

  function applyOpLocal(o) {
    const t = o.t;
    if (o.op === 'delete') {
      if (S.byId[t][o.id]) { delete S.byId[t][o.id]; S.t[t] = S.t[t].filter(x => x.id !== o.id); }
      return;
    }
    const ex = S.byId[t][o.row.id];
    const typedRow = {};
    Object.keys(o.row).forEach(c => typedRow[c] = typed(t, c, o.row[c]));
    if (ex) Object.assign(ex, typedRow);
    else {
      const full = {}; SCHEMA[t].forEach(c => full[c] = typed(t, c, ''));
      Object.assign(full, typedRow);
      S.t[t].push(full); S.byId[t][full.id] = full;
    }
  }

  // ---- Mutasi lokal → antrean ----
  /** ops: [{op:'upsert', t, row:{id,...}} | {op:'delete', t, id}] */
  S.commit = (ops, opt) => {
    if (!ops || !ops.length) return;
    const wire = ops.map(o => o.op === 'delete' ? { op: 'delete', t: o.t, id: o.id }
      : { op: 'upsert', t: o.t, row: Object.fromEntries(Object.entries(o.row).map(([k, v]) => [k, toWire(v)])) });
    wire.forEach(applyOpLocal);
    S.outbox.push({ reqId: U.uid('r'), ops: wire, at: Date.now() });
    S.emit('local');
    S.persist();
    if (!(opt && opt.noFlush)) S.scheduleFlush();
  };
  S.upsert = (t, row, opt) => S.commit([{ op: 'upsert', t, row }], opt);
  S.remove = (t, id) => S.commit([{ op: 'delete', t, id }]);

  S.scheduleFlush = U.debounce(() => S.flush(), 300);

  S.flush = async () => {
    if (S.flushing || !S.outbox.length) return;
    if (!navigator.onLine && S.mode !== 'demo') return;
    S.flushing = true;
    try {
      while (S.outbox.length) {
        // gabungkan beberapa batch kecil menjadi satu kiriman (maks 250 op)
        const b = S.outbox[0];
        const res = await API.call('write', { ops: b.ops }, { reqId: b.reqId });
        if (res.success) { S.outbox.shift(); S.persist(); continue; }
        if (res.network) { UI && UI.netState(false); break; }   // coba lagi nanti
        // ditolak server (izin/validasi): buang & segarkan dari server
        S.outbox.shift(); S.persist();
        UI && UI.toast(res.message || 'Perubahan ditolak server.', 'error');
        await S.sync(true);
      }
    } finally { S.flushing = false; }
    if (!S.outbox.length) S.sync();
  };

  S.sync = async (full) => {
    if (S.syncing) return;
    if (S.outbox.length && !full) { S.flush(); return; }
    S.syncing = true;
    try {
      const res = await API.call('sync', { since: full ? 0 : S.rev });
      if (!res.success) { if (res.network) UI && UI.netState(false); return; }
      UI && UI.netState(true);
      const d = res.data;
      let changed;
      if (d.boot) { if (d.me) S.me = d.me; S.applySnapshot(d.boot); S.outbox.forEach(b => b.ops.forEach(applyOpLocal)); changed = true; }
      else changed = S.applyDelta(d);
      S.lastSync = Date.now();
      if (changed) { S.emit('sync'); S.persist(); }
    } finally { S.syncing = false; }
  };

  // ---- Helper akses ----
  S.setting = (k, def) => { const r = S.byId.Pengaturan[k]; return r && r.nilai !== '' ? r.nilai : def; };
  S.setSetting = (k, v) => S.upsert('Pengaturan', { id: k, nilai: v });
  S.members = () => S.t.Anggota.filter(m => m.aktif !== false);
  S.member = email => S.t.Anggota.find(m => m.email === email);
  S.memberName = email => { if (!email) return '-'; const m = S.member(email); return m ? m.nama : (email === 'darurat' ? 'Akses Darurat' : email.split('@')[0]); };
  S.wallets = (all) => S.t.Wallet.filter(w => all || !w.arsip).sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama));
  S.kategori = (jenis, all) => S.t.Kategori.filter(k => (all || !k.arsip) && (!jenis || k.jenis === jenis)).sort((a, b) => a.urutan - b.urutan);
  S.isAdminLike = () => S.me && (S.me.peran === 'admin' || S.me.peran === 'pasangan');
  S.can = (menu, level) => {
    if (!S.me) return false;
    if (S.isAdminLike()) return true;
    const v = (S.me.izin || {})[menu];
    return level === 'lihat' ? (v === 'lihat' || v === 'ubah') : v === 'ubah';
  };

  window.Store = S;
})();
