/* ============================================================
 * Store — data lokal (tabel di memori + IndexedDB) & sinkronisasi
 *  - Render selalu dari data lokal (instan)
 *  - Perubahan diterapkan lokal dulu (optimistic), masuk antrean,
 *    lalu dikirim ke server dalam satu batch.
 *  - Sinkron hanya membaca baris log baru (setelah kursor) dan hanya
 *    bila versi file di Drive berubah.
 * ============================================================ */
(function () {
  const SCHEMA = {
    Anggota:   ['id', 'nama', 'email', 'peran', 'warna', 'izin', 'aktif', 'dibuat', 'foto'],
    Pengaturan:['id', 'nilai'],
    Wallet:    ['id', 'nama', 'jenis', 'pemilik', 'saldoAwal', 'ikon', 'likuid', 'urutan', 'arsip', 'catatan'],
    Kategori:  ['id', 'nama', 'jenis', 'kelompok', 'ikon', 'batas', 'bawaSisa', 'tetap', 'pribadi', 'urutan', 'arsip'],
    Transaksi: ['id', 'tanggal', 'jenis', 'jumlah', 'kategoriId', 'walletId', 'walletTujuan', 'biaya', 'catatan',
                'dibayarOleh', 'tag', 'sumber', 'refId', 'periodeRef', 'dicatatOleh', 'dibuat', 'riwayat', 'lampiran'],
    Template:  ['id', 'nama', 'jenis', 'jumlah', 'kategoriId', 'walletId', 'catatan', 'urutan'],
    Rutin:     ['id', 'nama', 'jenis', 'jumlah', 'kategoriId', 'walletId', 'frekuensi', 'tanggal', 'bulan',
                'mulai', 'selesai', 'langganan', 'ditinjau', 'aktif', 'catatan'],
    Acara:     ['id', 'nama', 'tanggal', 'estimasi', 'besar', 'catatan'],
    GeserDana: ['id', 'tanggal', 'periode', 'dari', 'ke', 'jumlah', 'catatan'],
    Tujuan:    ['id', 'nama', 'ikon', 'target', 'tenggat', 'prioritas', 'jenis', 'pemilik', 'setoranBulanan',
                'walletId', 'arsip', 'catatan', 'dibuat'],
    Pinjaman:  ['id', 'arah', 'jenis', 'pihak', 'pokok', 'bunga', 'metode', 'tenor', 'mulai', 'tanggalBayar',
                'cicilan', 'walletId', 'lunas', 'catatan', 'dibuat'],
    Laporan:   ['id', 'tanggal', 'jenis', 'modul', 'judul', 'deskripsi', 'prioritas', 'status'],
    Emas:      ['id', 'tanggal', 'merek', 'bentuk', 'gramKeping', 'jumlah', 'kadar', 'hargaBeli', 'biaya', 'walletId', 'tujuanId',
                'kepemilikan', 'status', 'zakat', 'tglJual', 'hargaJual', 'pinjamanId', 'sertifikat', 'catatan', 'dibuat'],
    Investasi: ['id', 'kelas', 'nama', 'kode', 'unit', 'modal', 'nilai', 'tglNilai', 'tanggal', 'walletId', 'tujuanId',
                'kepemilikan', 'jatuhTempo', 'imbal', 'zakat', 'status', 'tglJual', 'hargaJual', 'catatan', 'dibuat', 'riwayatNilai'],
    Skenario:  ['id', 'nama', 'jenis', 'data', 'catatan', 'dibuat', 'oleh'],
    Rapat:     ['id', 'tanggal', 'jenis', 'judul', 'catatan', 'keputusan', 'hadir', 'skor', 'dibuat', 'oleh'],
    Tugas:     ['id', 'judul', 'pj', 'tenggat', 'selesai', 'rapatId', 'sumber', 'catatan', 'dibuat', 'tglSelesai'],
    Saham:     ['id', 'tanggal', 'kode', 'aksi', 'lot', 'harga', 'fee', 'nominal', 'walletId', 'catatan', 'dibuat', 'txId', 'oleh']
  };
  const NUM = { saldoAwal: 1, urutan: 1, batas: 1, jumlah: 1, biaya: 1, tanggal_r: 1, estimasi: 1, target: 1, prioritas: 1,
                setoranBulanan: 1, pokok: 1, bunga: 1, tenor: 1, tanggalBayar: 1, cicilan: 1, rev: 1,
                gramKeping: 1, kadar: 1, hargaBeli: 1, hargaJual: 1, unit: 1, modal: 1, nilai: 1, imbal: 1, lot: 1, harga: 1, fee: 1, nominal: 1 };
  const BOOL = { likuid: 1, arsip: 1, bawaSisa: 1, tetap: 1, langganan: 1, aktif: 1, besar: 1, lunas: 1, zakat: 1, selesai: 1 };
  const JSONC = { izin: 1, riwayat: 1, kepemilikan: 1, riwayatNilai: 1, data: 1, keputusan: 1, hadir: 1 };

  function typed(t, col, v) {
    if (v === undefined || v === null) v = '';
    if (JSONC[col]) { const arr = col === 'riwayat' || col === 'riwayatNilai' || col === 'keputusan' || col === 'hadir'; if (typeof v === 'object') return v; try { return v ? JSON.parse(v) : (arr ? [] : {}); } catch (e) { return arr ? [] : {}; } }
    if (BOOL[col]) return v === true || v === 'true';
    if ((NUM[col] && t !== 'Pengaturan') || (t === 'Rutin' && (col === 'tanggal' || col === 'bulan'))) return v === '' ? 0 : Number(v) || 0;
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
    cursor: 0, version: '', ver: 0, me: null, fileId: '', mode: '', backend: null,   // mode: 'live' | 'demo'
    outbox: [],     // [{reqId, ops:[...]}]
    listeners: [],
    syncing: false, lastSync: 0, online: navigator.onLine !== false, pendingSave: null
  };
  Object.keys(SCHEMA).forEach(k => { S.t[k] = []; S.byId[k] = {}; });

  S.on = fn => S.listeners.push(fn);
  S.emit = (why) => { S.ver++; S.listeners.forEach(fn => { try { fn(why); } catch (e) { console.error(e); } }); };
  S.ns = () => (S.mode === 'demo' ? 'demo:' : 'live:' + S.fileId + ':');

  S.reset = () => { Object.keys(SCHEMA).forEach(k => { S.t[k] = []; S.byId[k] = {}; }); S.cursor = 0; S.version = ''; };

  /** Snapshot lokal (IndexedDB) → memori. */
  S.applySnapshot = (snap) => {
    Object.keys(SCHEMA).forEach(k => { S.t[k] = []; S.byId[k] = {}; });
    Object.keys(snap.tables || {}).forEach(t => {
      if (!SCHEMA[t]) return;
      const { c, r } = snap.tables[t];
      const rows = r.map(a => rowFromArray(t, c, a));
      S.t[t] = rows; rows.forEach(x => S.byId[t][x.id] = x);
    });
    S.cursor = snap.cursor || 0; S.version = snap.version || '';
  };

  /** Terapkan baris log [waktu, oleh, tabel, id, op, data]. Mengembalikan true bila ada perubahan. */
  S.applyRows = (rows) => {
    const pend = S.pendingIds(), touched = {};
    let changed = false;
    rows.forEach(r => {
      const t = r[2], id = String(r[3] || ''), op = r[4];
      if (!SCHEMA[t] || !id || pend[t + ':' + id]) return;
      const map = S.byId[t];
      if (op === 'd') { if (map[id]) { delete map[id]; touched[t] = 1; changed = true; } return; }
      let data; try { data = typeof r[5] === 'string' ? JSON.parse(r[5]) : (r[5] || {}); } catch (e) { return; }
      const ex = map[id];
      if (ex) {
        let diff = false;
        Object.keys(data).forEach(c => { if (SCHEMA[t].indexOf(c) < 0) return; const v = typed(t, c, data[c]); if (toWire(ex[c]) !== toWire(v)) { ex[c] = v; diff = true; } });
        if (diff) changed = true;
      } else {
        const full = {}; SCHEMA[t].forEach(c => full[c] = typed(t, c, data[c] === undefined ? '' : data[c]));
        full.id = id; map[id] = full; touched[t] = 1; changed = true;
      }
    });
    Object.keys(touched).forEach(t => { S.t[t] = Object.values(S.byId[t]); });
    return changed;
  };

  S.pendingIds = () => {
    const m = {};
    S.outbox.forEach(b => b.ops.forEach(o => { m[o.t + ':' + (o.id || (o.row && o.row.id))] = 1; }));
    return m;
  };

  // ---- Persistensi (debounce) ----
  S.persist = U.debounce(async () => {
    const snap = { cursor: S.cursor, version: S.version, tables: {} };
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

  S.scheduleFlush = U.debounce(() => S.flush(), 400);
  S.needAuth = false;
  const authLost = () => { S.needAuth = true; UI && UI.authState && UI.authState(true); };

  /** Kirim antrean ke file keluarga (beberapa batch digabung jadi satu permintaan). */
  S.flush = async () => {
    if (S.flushing || !S.outbox.length || !S.backend) return;
    if (navigator.onLine === false && S.mode !== 'demo') return;
    S.flushing = true;
    try {
      while (S.outbox.length) {
        let n = 0, ops = [];
        while (n < S.outbox.length && ops.length + S.outbox[n].ops.length <= 300) { ops = ops.concat(S.outbox[n].ops); n++; }
        if (!n) { n = 1; ops = S.outbox[0].ops; }
        const res = await S.backend.push(ops, S.me ? S.me.email : '', S.outbox[0].reqId);
        if (res.ok) { S.outbox.splice(0, n); S.persist(); UI && UI.netState(true); continue; }
        if (res.auth) { authLost(); break; }
        if (res.network || res.status === 429 || res.status >= 500 || !res.status) { UI && UI.netState(false); break; }
        if (res.status === 403 || res.status === 404) { UI && UI.toast('Akses ke file keluarga ditolak. Minta Admin mengundang ulang akun ini.', 'error', { ms: 6000 }); break; }
        S.outbox.splice(0, n); S.persist();   // 400: data tidak valid → buang agar tidak macet
        UI && UI.toast(res.message || 'Perubahan ditolak Google.', 'error');
      }
    } finally { S.flushing = false; }
  };

  /** Sinkron: cek versi file dulu (murah), baca log baru hanya bila berubah. */
  S.sync = async (full) => {
    if (S.syncing || !S.backend) return;
    S.syncing = true;
    try {
      if (S.outbox.length) await S.flush();
      const v = await S.backend.checkVersion();
      if (!v.ok) { if (v.auth) authLost(); else if (v.network) UI && UI.netState(false); else if (v.status === 404 || v.status === 403) S.emit('denied'); return v; }
      S.needAuth = false; UI && UI.authState && UI.authState(false); UI && UI.netState(true);
      if (!full && S.cursor > 0 && v.version && v.version === S.version) { S.lastSync = Date.now(); return { ok: true }; }
      let changed;
      if (full || !S.cursor) {
        const r = await S.backend.pull(0);
        if (!r.ok) { if (r.auth) authLost(); return r; }
        Object.keys(SCHEMA).forEach(k => { S.t[k] = []; S.byId[k] = {}; });
        S.applyRows(r.rows); S.cursor = r.cursor;
        S.outbox.forEach(b => b.ops.forEach(applyOpLocal));
        changed = true;
      } else {
        const r = await S.backend.pull(S.cursor);
        if (!r.ok) { if (r.auth) authLost(); return r; }
        changed = S.applyRows(r.rows); S.cursor = r.cursor;
      }
      S.version = v.version; S.lastSync = Date.now();
      S.emit(changed ? 'sync' : 'synced'); S.persist();
      return { ok: true };
    } finally { S.syncing = false; }
  };

  /** Tabel dalam bentuk {c, r} untuk cermin spreadsheet / cadangan. */
  S.tablesWire = () => { const o = {}; Object.keys(SCHEMA).forEach(t => { o[t] = { c: SCHEMA[t], r: S.t[t].map(x => SCHEMA[t].map(c => toWire(x[c]))) }; }); return o; };

  // ---- Helper akses ----
  S.setting = (k, def) => { const r = S.byId.Pengaturan[k]; return r && r.nilai !== '' ? r.nilai : def; };
  S.setSetting = (k, v) => S.upsert('Pengaturan', { id: k, nilai: v });
  S.members = () => S.t.Anggota.filter(m => m.aktif !== false);
  S.member = email => S.t.Anggota.find(m => m.email === email);
  S.memberName = email => { if (!email) return '-'; const m = S.member(email); return m ? m.nama : String(email).split('@')[0]; };
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
