/* ============================================================
 * Jurnal Saham IDX — diadaptasi dari Trading Journal (Overview · Activity · Analytics · Avg Calculator · Settings)
 * untuk tampilan HP & data keluarga SatuAtap.
 *  - Portofolio = akun RDN (dompet). Kas RDN = saldo dompet itu, modal bersih = saldo awal + top up − tarik.
 *  - Trade: Beli/Jual dengan setup & rencana (entry zone, SL, TP1, TP2). Harga rata-rata (average cost, fee masuk modal).
 *  - Cash flow: Top up / Tarik (transfer bank ↔ RDN), Dividen, Penyesuaian.
 *  - Bea meterai otomatis sekali per hari per akun bila nilai transaksi > ambang (disinkronkan setiap ada perubahan).
 *  - Grafik Portofolio vs IHSG & max drawdown dihitung dari riwayat harga penutupan (/api/saham?hist=1).
 *  - Alert SL/TP: label di posisi + Telegram (bila terhubung) saat harga diperbarui.
 * ============================================================ */
(function () {
  const I = UI.icon, me = () => Store.me.email;
  const LB = 100;
  const SETUP_AWAL = ['Pullback MA20', 'Swing Low Support', 'Breakout ATH', 'Momentum', 'Speculative Rebound'];
  const F = { akun: localStorage.getItem('sa:shPf') || '', q: '', ty: '', su: '', a: '', b: '' }, AN = { a: '', b: '' };
  const json = (k, d) => { const v = Store.setting(k, ''); if (v && typeof v === 'object') return v; try { return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const setJson = (k, o) => Store.upsert('Pengaturan', { id: k, nilai: JSON.stringify(o) });
  const nm = v => U.fmtNum(Math.round(v || 0));
  const tanda = v => (v > 0 ? '+' : v < 0 ? '−' : '');
  const cls = v => v > 0 ? 'ok' : v < 0 ? 'bad' : '';
  const pc = v => `<span class="${cls(v)}">${tanda(v)}${(Math.abs(v || 0)).toFixed(2).replace('.', ',')}%</span>`;
  const rpS = (v, sg) => `<span class="${sg ? cls(v) : ''}">${sg ? tanda(v) : v < 0 ? '−' : ''}${UI.m(Math.abs(v || 0))}</span>`;
  const rpK = (v, sg) => `<span class="${sg ? cls(v) : ''}">${sg ? tanda(v) : v < 0 ? '−' : ''}${UI.ms(Math.abs(v || 0))}</span>`;
  const akunNama = id => (Store.byId.Wallet[id] || {}).nama || 'Akun dihapus';

  // ---------- Pengaturan ----------
  const setAkun = () => json('sahamAkun', {});
  const cfg = (akun) => Object.assign({ beli: 0.15, jual: 0.25, materai: 10000, ambang: 10000000 }, json('sahamFee', {}), (setAkun()[akun] || {}));
  const setups = () => { const s = json('sahamSetup', null); return Array.isArray(s) ? s : SETUP_AWAL.slice(); };
  const harga = () => json('hargaSaham', {});

  // ---------- Data ----------
  const trades = () => (Store.t.Saham || []).slice().sort((a, b) => a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : String(a.dibuat) < String(b.dibuat) ? -1 : 1);
  /** Portofolio = dompet RDN saja. Trade lama yang tercatat di dompet lain (mis. Tunai) ditawarkan untuk dipindah. */
  const akunList = () => Store.wallets(true).filter(w => w.jenis === 'rdn' && (!w.arsip || trades().some(t => t.walletId === w.id)));
  const nyasar = () => { const rdn = {}; Store.t.Wallet.forEach(w => { if (w.jenis === 'rdn') rdn[w.id] = 1; }); return trades().filter(t => !rdn[t.walletId]); };
  const akunAktif = () => { const ak = akunList(); return F.akun && ak.some(w => w.id === F.akun) ? [F.akun] : ak.map(w => w.id); };

  /** Kalkulasi average cost (mengikuti Trading Journal): posisi, realisasi, dividen, fee. */
  Calc.saham = (sampai, akun) => {
    const P = {}, R = [], D = [], ids = akun ? [].concat(akun) : null;
    let fee = 0, materai = 0;
    trades().forEach(t => {
      if (sampai && t.tanggal > sampai) return;
      if (ids && ids.indexOf(t.walletId) < 0) return;
      if (t.aksi === 'materai') { materai += Number(t.nominal) || 0; return; }
      if (t.aksi === 'dividen') { D.push({ t, v: Number(t.nominal) || 0 }); return; }
      const k = t.walletId + '|' + t.kode, lots = Number(t.lot) || 0, gross = lots * LB * (Number(t.harga) || 0), f = Number(t.fee) || 0, ms = Date.parse(t.tanggal);
      const p = P[k] = P[k] || { kode: t.kode, walletId: t.walletId, lots: 0, cost: 0, dw: 0, plan: {}, mulai: t.tanggal };
      fee += f;
      if (t.aksi === 'beli') { if (p.lots <= 0) p.mulai = t.tanggal; p.cost += gross + f; p.lots += lots; p.dw += lots * ms; if (t.sl || t.tp1 || t.tp2) p.plan = t; }
      else if (t.aksi === 'jual' && p.lots > 0) {
        const fr = Math.min(1, lots / p.lots), c = p.cost * fr, net = gross - f, hold = (ms - p.dw / p.lots) / 864e5;
        R.push({ t, kode: t.kode, walletId: t.walletId, tanggal: t.tanggal, setup: t.setup || '', lots, cost: c, hasil: net, pl: net - c, pct: c ? (net - c) / c * 100 : 0, hold, avg: c / (lots * LB), px: Number(t.harga), fee: f });
        p.cost -= c; p.dw -= p.dw * fr; p.lots -= lots; if (p.lots <= 0) { p.lots = p.cost = p.dw = 0; p.plan = {}; }
      }
    });
    const hm = harga();
    const H = Object.values(P).filter(p => p.lots > 0).map(p => {
      const h = hm[p.kode] || [], l = Number(h[0]) || 0, avg = p.cost / (p.lots * LB), mv = (l || avg) * p.lots * LB, pl = p.plan;
      const st = !pl.sl && !pl.tp1 ? '' : l && pl.sl && l <= Number(pl.sl) ? 'sl' : l && pl.tp2 && l >= Number(pl.tp2) ? 'tp2' : l && pl.tp1 && l >= Number(pl.tp1) ? 'tp' : 'ok';
      return Object.assign(p, { avg, l, prev: Number(h[3]) || 0, tglHarga: h[1] || '', sumber: h[2] || '', mv, nilai: mv, biaya: p.cost, lembar: p.lots * LB, unr: l ? mv - p.cost : 0, pl: l ? mv - p.cost : 0, pct: l ? (mv / p.cost - 1) * 100 : 0, st });
    }).sort((a, b) => b.mv - a.mv);
    return { posisi: H, H, realisasi: R, R, dividen: D, fee, materai };
  };
  /** Posisi → item virtual untuk kekayaan bersih, zakat & alokasi (lewat Calc.investasi). */
  Calc.sahamItems = () => Calc.saham().H.map(p => {
    const w = Store.byId.Wallet[p.walletId] || {}, pemilik = w.pemilik && w.pemilik !== 'bersama' ? w.pemilik : '';
    return { x: { id: 'sh:' + p.walletId + ':' + p.kode, kelas: 'saham', nama: p.kode, kode: p.kode, unit: p.lembar, modal: Math.round(p.cost), nilai: Math.round(p.mv), tglNilai: p.tglHarga, tanggal: p.mulai, walletId: p.walletId, tujuanId: '', kepemilikan: pemilik ? { [pemilik]: 100 } : {}, zakat: true, status: 'aktif', virtual: true }, nilai: p.mv, modal: p.cost, untung: p.mv - p.cost, pct: p.cost ? (p.mv - p.cost) / p.cost : 0, basi: !p.tglHarga || U.diffDays(p.tglHarga, U.today()) > 45 };
  });

  // ---------- Kas & modal per akun (dari transaksi SatuAtap) ----------
  const efek = (t, id) => {   // pengaruh transaksi ke saldo dompet id
    const j = Number(t.jumlah) || 0, b = Number(t.biaya) || 0; let v = 0;
    if (t.walletId === id) {
      if (['keluar', 'pinjam_beri', 'aset_beli', 'tujuan'].indexOf(t.jenis) > -1) v -= j;
      else if (['masuk', 'pinjam_kembali', 'pinjam_terima', 'penyesuaian', 'aset_jual', 'tujuan_ambil'].indexOf(t.jenis) > -1) v += j;
      else if (t.jenis === 'transfer') v -= j;
      v -= b;
    }
    if (t.walletTujuan === id) { if (t.jenis === 'transfer' || t.jenis === 'tujuan') v += j; else if (t.jenis === 'tujuan_ambil') v -= j; }
    return v;
  };
  /** Arus modal (top up − tarik) satu transaksi ke akun id. */
  const modalTx = (t, id) => t.jenis === 'transfer' ? (t.walletTujuan === id ? Number(t.jumlah) : t.walletId === id ? -Number(t.jumlah) : 0) : 0;
  const ringkasAkun = (ids) => {
    const b = Calc.balances(); let cash = 0, nc = 0;
    ids.forEach(id => { cash += b[id] || 0; nc += Number((Store.byId.Wallet[id] || {}).saldoAwal) || 0; });
    Store.t.Transaksi.forEach(t => ids.forEach(id => { nc += modalTx(t, id); }));
    return { cash, nc };
  };

  // ---------- Bea meterai: sinkron otomatis (sekali per hari per akun bila gross > ambang) ----------
  function sinkronMaterai() {
    const perlu = {}, ada = {};
    trades().forEach(t => {
      if (t.aksi === 'materai') { (ada[t.walletId + '|' + t.tanggal] = ada[t.walletId + '|' + t.tanggal] || []).push(t); return; }
      if (t.aksi !== 'beli' && t.aksi !== 'jual') return;
      const k = t.walletId + '|' + t.tanggal; perlu[k] = (perlu[k] || 0) + (Number(t.lot) || 0) * LB * (Number(t.harga) || 0);
    });
    const ops = [], now = new Date().toISOString(), kat = (Store.t.Kategori.find(k => k.jenis === 'keluar' && !k.arsip && /admin|biaya/i.test(k.nama)) || {}).id || '';
    Object.keys(perlu).forEach(k => {
      const [akun, tgl] = k.split('|'), c = cfg(akun), harus = c.materai > 0 && perlu[k] > c.ambang, rows = ada[k] || [];
      if (harus && !rows.length) {
        const id = U.uid('sh'), txId = U.uid('t');
        ops.push({ op: 'upsert', t: 'Saham', row: { id, tanggal: tgl, kode: '-', aksi: 'materai', lot: 0, harga: 0, fee: 0, nominal: c.materai, walletId: akun, catatan: 'Bea meterai harian', dibuat: now, txId, oleh: me() } });
        ops.push({ op: 'upsert', t: 'Transaksi', row: { id: txId, tanggal: tgl, jenis: 'keluar', jumlah: c.materai, kategoriId: kat, walletId: akun, walletTujuan: '', biaya: 0, catatan: 'Bea meterai saham', dibayarOleh: me(), tag: 'saham', sumber: 'saham', refId: id, periodeRef: tgl.slice(0, 7), dicatatOleh: me(), dibuat: now, riwayat: [] } });
      }
      (harus ? rows.slice(1) : rows).forEach(r => ops.push(...hapusOps(r)));
      delete ada[k];
    });
    Object.values(ada).forEach(rows => rows.forEach(r => ops.push(...hapusOps(r))));   // hari tanpa transaksi lagi
    if (ops.length) Store.commit(ops);
  }
  const hapusOps = t => [{ op: 'delete', t: 'Saham', id: t.id }].concat(t.txId && Store.byId.Transaksi[t.txId] ? [{ op: 'delete', t: 'Transaksi', id: t.txId }] : []);

  // ---------- Harga terakhir ----------
  const simpanHarga = o => setJson('hargaSaham', Object.assign({}, harga(), o));
  const kodeDipegang = () => Array.from(new Set(Calc.saham().H.map(p => p.kode)));
  async function ambilHarga(diam) {
    const kode = kodeDipegang(); if (!kode.length) return false;
    if (Store.mode === 'demo') {
      const o = {}; kode.forEach(k => { const h = harga()[k], base = h ? Number(h[0]) : 1000; o[k] = [Math.max(50, Math.round(base * (1 + (Math.random() - 0.48) * 0.02) / 5) * 5), U.today(), 'Contoh', base]; });
      simpanHarga(o); if (!diam) UI.toast('Harga contoh diperbarui.'); alertSlTp(); return true;
    }
    let alasan = '';
    try {
      const r = await fetch('/api/saham?k=' + encodeURIComponent(kode.join(',')) + '&t=' + Math.floor(Date.now() / 300000), { cache: 'no-store' });
      const ct = r.headers.get('content-type') || '';
      if (!/json/.test(ct)) throw new Error(r.status === 404 ? 'file api/saham.js belum ter-deploy di Vercel' : 'server ' + r.status);
      const j = await r.json(), o = {};
      Object.keys((j && j.data) || {}).forEach(k => { const d = j.data[k]; if (d && d.harga) o[k] = [d.harga, d.tanggal || U.today(), d.sumber || j.sumber || 'Otomatis', d.prev || 0]; });
      if (!Object.keys(o).length) throw new Error(Object.values((j && j.galat) || {})[0] || 'sumber harga tidak menjawab');
      simpanHarga(o);
      const gagal = kode.filter(k => !o[k]);
      if (!diam) UI.toast(Object.keys(o).length + ' harga diperbarui' + (gagal.length ? ' · belum: ' + gagal.join(', ') : '') + '.');
      alertSlTp(); try { localStorage.setItem('sa:shHargaOk', String(Date.now())); } catch (e) {}
      return true;
    } catch (e) { alasan = e && e.message || 'gagal'; }
    try { localStorage.setItem('sa:shHargaErr', alasan); } catch (e) {}
    if (!diam) UI.toast('Harga otomatis gagal (' + alasan + ') — isi manual dulu.', 'warn', { ms: 6000 });
    return false;
  }
  /** Otomatis: saat buka Saham, paling sering tiap 15 menit di jam bursa (09.00–16.15 WIB hari kerja), selain itu tiap 3 jam. */
  UI.sahamAutoHarga = () => { try {
    if (Store.mode === 'demo' || !kodeDipegang().length) return;
    const t = Number(localStorage.getItem('sa:shHargaT') || 0), d = new Date(), m = d.getHours() * 60 + d.getMinutes(), bursa = d.getDay() > 0 && d.getDay() < 6 && m >= 540 && m <= 975;
    const hm = harga(), basi = kodeDipegang().some(k => !hm[k] || hm[k][1] !== U.today());
    if (Date.now() - t < (bursa ? 15 : basi ? 30 : 180) * 60000) return;
    localStorage.setItem('sa:shHargaT', String(Date.now())); ambilHarga(true).then(ok => { if (ok && UI.cur === 'saham') UI.render(); });
  } catch (e) {} };
  UI.act('sh-harga', async () => { if (!(await ambilHarga())) hargaManual(); });
  function hargaManual() {
    const kode = kodeDipegang(); if (!kode.length) return UI.toast('Belum ada posisi terbuka.', 'warn');
    const hm = harga();
    const s = UI.sheet({ title: 'Harga terakhir', cls: 'small', body: `<p class="muted small">Isi harga penutupan per lembar dari aplikasi sekuritas.</p>
      ${kode.map(k => UI.field(k + (hm[k] ? ` <small class="muted">· ${nm(hm[k][0])} (${U.tgl(hm[k][1], 'dm')})</small>` : ''), UI.rpInput('h_' + k, 0, hm[k] ? nm(hm[k][0]) : 'per lembar'))).join('')}`, foot: `<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => { const f = UI.formData(s.el), o = {}; kode.forEach(k => { if (f['h_' + k]) o[k] = [f['h_' + k], U.today(), 'Manual', hm[k] ? hm[k][0] : 0]; }); if (!Object.keys(o).length) return UI.toast('Belum ada harga diisi.', 'warn'); simpanHarga(o); s.close(); alertSlTp(); UI.toast('Harga disimpan.'); };
  }
  UI.act('sh-harga-manual', hargaManual);
  /** Kirim alert Telegram bila posisi menyentuh SL / TP (sekali per level per posisi). */
  function alertSlTp() {
    if (!App.tgSiap || !App.tgSiap()) return;
    const pesan = [];
    Calc.saham().H.forEach(p => {
      if (!p.st || p.st === 'ok') return;
      const lv = { sl: ['SL', p.plan.sl, '🔻'], tp: ['TP1', p.plan.tp1, '🎯'], tp2: ['TP2', p.plan.tp2, '🎯'] }[p.st];
      const w = Store.byId.Wallet[p.walletId] || {}, ke = w.pemilik && w.pemilik !== 'bersama' ? w.pemilik : Store.me.email;
      pesan.push({ ke, kunci: 'sh|' + p.walletId + '|' + p.kode + '|' + lv[0] + '|' + (p.plan.id || ''), teks: `${lv[2]} <b>${lv[0]} ${p.kode}</b> [${U.esc(w.nama || '')}]\nHarga ${U.rp(p.l)} (level ${U.rp(lv[1])}) · avg ${U.rp(Math.round(p.avg))}` });
    });
    if (pesan.length) App.tgKirim(pesan);
  }

  // ---------- Riwayat harga & snapshot harian (Portofolio vs IHSG) ----------
  let HIST = null, SERI = { key: '', v: null };
  try { HIST = JSON.parse(localStorage.getItem('sa:shHist') || 'null'); } catch (e) {}
  const awalData = () => { const ids = akunAktif(); const d = trades().filter(t => ids.indexOf(t.walletId) > -1).map(t => t.tanggal).concat(Store.t.Transaksi.filter(t => t.jenis === 'transfer' && (ids.indexOf(t.walletTujuan) > -1)).map(t => t.tanggal)).sort(); return d[0] || ''; };
  /** Muat riwayat harga (sekali per hari per susunan kode). Mengembalikan true hanya bila data baru masuk,
   *  dan tidak mencoba ulang lebih dari sekali per 15 menit — mencegah render berulang tanpa henti saat gagal. */
  const COBA = {};
  async function muatHist() {
    const kode = Array.from(new Set(trades().filter(t => t.kode && t.kode !== '-').map(t => t.kode))), dari = awalData();
    if (!kode.length || !dari) return false;
    const kunci = kode.slice().sort().join(',') + '|' + dari;
    if (HIST && HIST.kunci === kunci && HIST.tgl === U.today()) return false;
    if (COBA[kunci] && Date.now() - COBA[kunci] < 15 * 60000) return false;
    COBA[kunci] = Date.now();
    if (Store.mode === 'demo') { HIST = histContoh(kode, dari); HIST.kunci = kunci; SERI.key = ''; return true; }
    try {
      const r = await fetch('/api/saham?hist=1&k=' + encodeURIComponent(kode.join(',')) + '&dari=' + dari, { cache: 'no-store' }), j = await r.json();
      if (!j || !j.ok) return false;
      HIST = { kunci, tgl: U.today(), data: j.data || {}, ihsg: j.ihsg || {} }; SERI.key = '';
      try { localStorage.setItem('sa:shHist', JSON.stringify(HIST)); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  function histContoh(kode, dari) {
    const ih = {}, data = {}, hm = harga(); let d = dari, x = 7050;
    const hari = []; while (d <= U.today()) { const w = U.parseDate(d).getDay(); if (w > 0 && w < 6) hari.push(d); d = U.addDays(d, 1); }
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    hari.forEach(h => { x *= 1 + (rnd() - 0.48) * 0.012; ih[h] = Math.round(x); });
    kode.forEach(k => {   // contoh: harga melewati harga transaksi asli lalu menuju harga terakhir (+ derau kecil)
      const knot = trades().filter(t => t.kode === k && Number(t.harga)).map(t => [t.tanggal, Number(t.harga)]).concat(hm[k] ? [[U.today(), Number(hm[k][0])]] : []).sort((a, b) => a[0] < b[0] ? -1 : 1);
      const m = {}; hari.forEach(h => {
        let i = knot.findIndex(z => z[0] >= h), v;
        if (i < 0) v = knot[knot.length - 1][1]; else if (i === 0) v = knot[0][1];
        else { const a = knot[i - 1], b = knot[i], f = U.diffDays(a[0], h) / Math.max(1, U.diffDays(a[0], b[0])); v = a[1] + (b[1] - a[1]) * f; }
        m[h] = Math.round(v * (1 + (rnd() - 0.5) * 0.025) / 5) * 5;
      }); data[k] = m; });
    return { tgl: U.today(), data, ihsg: ih };
  }
  /** Deret harian: {d, aum, nc, cash, inv, ret (%), ihsg (%)} untuk akun aktif. */
  function seri() {
    const ids = akunAktif(), key = Store.ver + '|' + ids.join(',') + '|' + (HIST ? HIST.kunci + HIST.tgl : '');
    if (SERI.key === key) return SERI.v;
    SERI.key = key; SERI.v = null;
    if (!HIST || !HIST.ihsg) return null;
    const start = awalData(); if (!start) return null;
    const tgl = Object.keys(HIST.ihsg).filter(d => d >= start).sort(); if (tgl.length < 2) return null;
    const tx = Store.t.Transaksi.filter(t => ids.indexOf(t.walletId) > -1 || ids.indexOf(t.walletTujuan) > -1).sort((a, b) => a.tanggal < b.tanggal ? -1 : 1);
    const tr = trades().filter(t => ids.indexOf(t.walletId) > -1 && (t.aksi === 'beli' || t.aksi === 'jual'));
    let cash = 0, nc = 0, ti = 0, ri = 0; ids.forEach(id => { const s0 = Number((Store.byId.Wallet[id] || {}).saldoAwal) || 0; cash += s0; nc += s0; });
    const P = {}, last = {}, i0 = HIST.ihsg[tgl[0]], out = [];
    tgl.forEach(d => {
      while (ti < tx.length && tx[ti].tanggal <= d) { const t = tx[ti++]; ids.forEach(id => { cash += efek(t, id); nc += modalTx(t, id); }); }
      while (ri < tr.length && tr[ri].tanggal <= d) { const t = tr[ri++], q = P[t.kode] = P[t.kode] || { l: 0, c: 0 }, lb = (Number(t.lot) || 0) * LB;
        if (t.aksi === 'beli') { q.c += lb * Number(t.harga) + (Number(t.fee) || 0); q.l += lb; } else if (q.l > 0) { q.c -= q.c * Math.min(1, lb / q.l); q.l -= lb; if (q.l <= 0) q.l = q.c = 0; } }
      let mv = 0, inv = 0;
      Object.keys(P).forEach(k => { const h = (HIST.data[k] || {})[d]; if (h) last[k] = h; const q = P[k]; if (q.l > 0) { inv += q.c; mv += last[k] ? q.l * last[k] : q.c; } });
      const aum = cash + mv;
      out.push({ d, aum, nc, cash, inv, ret: nc ? (aum / nc - 1) * 100 : 0, ihsg: i0 ? (HIST.ihsg[d] / i0 - 1) * 100 : 0, ih: HIST.ihsg[d] });
    });
    let pk = 0, mdd = 0; out.forEach(s => { const r = s.nc ? s.aum / s.nc : 1; pk = Math.max(pk, r); if (pk) mdd = Math.min(mdd, (r / pk - 1) * 100); });
    SERI.v = { s: out, mdd };
    return SERI.v;
  }

  // ---------- Log aktivitas gabungan (trade, kas, dividen, meterai) ----------
  const TIPE = { BELI: 'buy', JUAL: 'sell', DIVIDEN: 'div', 'TOP UP': 'dep', TARIK: 'wd', MATERAI: 'mat', PENYESUAIAN: 'adj' };
  function LOG() {
    const ids = akunAktif(), out = [];
    trades().filter(t => ids.indexOf(t.walletId) > -1).forEach(t => {
      const g = (Number(t.lot) || 0) * LB * (Number(t.harga) || 0), f = Number(t.fee) || 0;
      if (t.aksi === 'beli') out.push({ k: 'trade', id: t.id, d: t.tanggal, ty: 'BELI', kode: t.kode, setup: t.setup || '', amt: -(g + f), g, f, t });
      else if (t.aksi === 'jual') out.push({ k: 'trade', id: t.id, d: t.tanggal, ty: 'JUAL', kode: t.kode, setup: t.setup || '', amt: g - f, g, f, t });
      else if (t.aksi === 'dividen') out.push({ k: 'trade', id: t.id, d: t.tanggal, ty: 'DIVIDEN', kode: t.kode, setup: '', amt: Number(t.nominal) || 0, g: 0, f: 0, t });
      else if (t.aksi === 'materai') out.push({ k: 'mat', id: t.id, d: t.tanggal, ty: 'MATERAI', kode: '', setup: '', amt: -(Number(t.nominal) || 0), g: 0, f: Number(t.nominal) || 0, t });
    });
    Store.t.Transaksi.forEach(t => ids.forEach(id => {
      if (t.jenis === 'transfer' && (t.walletTujuan === id || t.walletId === id)) out.push({ k: 'cash', id: t.id, d: t.tanggal, ty: t.walletTujuan === id ? 'TOP UP' : 'TARIK', kode: '', setup: '', amt: efek(t, id), g: 0, f: 0, tx: t });
      else if (t.jenis === 'penyesuaian' && t.walletId === id) out.push({ k: 'cash', id: t.id, d: t.tanggal, ty: 'PENYESUAIAN', kode: '', setup: '', amt: Number(t.jumlah) || 0, g: 0, f: 0, tx: t });
    }));
    return out.sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
  }
  const bdg = ty => `<span class="tjb ${TIPE[ty] || ''}">${ty}</span>`;

  // ---------- Halaman ----------
  const TABS = [['', 'layout-grid', 'Overview'], ['aktivitas', 'arrow-left-right', 'Activity'], ['analitik', 'chart-column', 'Analytics'], ['kalkulator', 'calculator', 'Avg Calc']];
  const tabs = p => `<nav class="tj-tabs">${TABS.map(t => `<a class="${(p || '') === t[0] ? 'on' : ''}" href="#/saham${t[0] ? '/' + t[0] : ''}">${I(t[1])}<span>${t[2]}</span></a>`).join('')}</nav>`;
  const pindahBanner = () => { const n = nyasar(); if (!n.length) return ''; const w = Array.from(new Set(n.map(t => akunNama(t.walletId)))).join(', ');
    return `<div class="note warn">${I('triangle-alert')} <span>${n.length} transaksi saham tercatat di dompet <b>${U.esc(w)}</b>, bukan di portofolio RDN — kas ${U.esc(w)} jadi ikut berkurang.</span> <button class="btn xs" data-act="sh-pindah-rdn">Pindahkan ke RDN</button></div>`; };
  UI.act('sh-pindah-rdn', () => {
    const n = nyasar(), rdn = Store.wallets().filter(w => w.jenis === 'rdn'); if (!n.length) return;
    if (!rdn.length) { UI.toast('Buat portofolio RDN dulu.', 'warn'); return portofolioBaru(); }
    const asal = Array.from(new Set(n.map(t => t.walletId)));
    const s = UI.sheet({ title: 'Pindahkan ke portofolio RDN', cls: 'small', body: `<p class="muted small">${n.length} transaksi (${Array.from(new Set(n.filter(t => t.kode !== '-').map(t => t.kode))).join(', ')}) di ${asal.map(akunNama).map(U.esc).join(', ')} dipindah beserta catatan uangnya. Saldo ${asal.map(akunNama).map(U.esc).join(', ')} kembali seperti semula dan kas RDN yang terpakai.</p>
      ${UI.field('Portofolio tujuan', `<select name="w">${rdn.map(w => `<option value="${w.id}">${U.esc(w.nama)}</option>`).join('')}</select>`)}`, foot: `<button class="btn" data-ok>${I('check')} Pindahkan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => {
      const ke = UI.formData(s.el).w, ops = [];
      n.forEach(t => { ops.push({ op: 'upsert', t: 'Saham', row: { id: t.id, walletId: ke } }); if (t.txId && Store.byId.Transaksi[t.txId]) ops.push({ op: 'upsert', t: 'Transaksi', row: { id: t.txId, walletId: ke } }); });
      Store.commit(ops); sinkronMaterai(); F.akun = ''; try { localStorage.setItem('sa:shPf', ''); } catch (e) {}
      s.close(); UI.toast(n.length + ' transaksi dipindah ke ' + akunNama(ke) + '.');
    };
  });
  const pfBar = () => { const ak = akunList(); if (!ak.length) return pindahBanner(); return `<div class="tj-pf">${I('briefcase')}<select data-change="sh-pf" aria-label="Pilih portofolio">${ak.length > 1 ? `<option value="">Semua portofolio (${ak.length})</option>` : ''}${ak.map(w => `<option value="${w.id}" ${F.akun === w.id ? 'selected' : ''}>${U.esc(w.nama)}</option>`).join('')}</select>
    <button class="btn xs ghost" data-act="sh-cash">${I('plus')} Kas</button><button class="btn xs" data-act="sh-catat">${I('plus')} Trade</button></div>${pindahBanner()}`; };
  UI.act('sh-pf', el => { F.akun = el.value; try { localStorage.setItem('sa:shPf', F.akun); } catch (e) {} SERI.key = ''; UI.render(); });

  UI.page('saham', {
    head: p => ({ title: { aktivitas: 'Activity', analitik: 'Analytics', kalkulator: 'Avg Calculator' }[p] || 'Saham', crumb: 'Aset · Saham', back: 'aset',
      right: `<button class="icon-btn" data-act="sh-set" aria-label="Pengaturan saham">${I('settings')}</button>` }),
    nav: () => 'aset',
    render(p) {
      if (!Store.can('aset', 'lihat')) return UI.empty('lock', 'Tidak ada akses', 'Minta Admin memberi izin menu Aset.');
      if (!akunList().length) return tabs(p) + pindahBanner() + mulai();
      const body = p === 'aktivitas' ? aktivitas() : p === 'analitik' ? analitik() : p === 'kalkulator' ? kalkulator() : overview();
      return tabs(p) + pfBar() + body + '<div class="spacer"></div>';
    },
    after(v, p) {
      if (p === 'kalkulator') kalkHitung();
      if (!p) { UI.sahamAutoHarga(); pasangGrafik(); if (!HIST || HIST.tgl !== U.today()) muatHist().then(baru => { if (baru && UI.cur === 'saham' && !UI.param) UI.render(); }); }
    }
  });
  function mulai() {
    const ada = Store.wallets().filter(w => w.jenis === 'rdn');
    return `<div class="card tj-mulai">${UI.empty('chart-candlestick', 'Mulai jurnal saham', 'Satu portofolio = satu akun RDN. Catat top up, beli, jual & dividen — harga rata-rata, P&L, win rate, meterai dan grafik vs IHSG dihitung otomatis.',
      `<button class="btn" data-act="sh-pf-baru">${I('plus')} Buat portofolio</button>${ada.length ? '' : ''}`)}</div>${legacy()}`;
  }
  UI.act('sh-pf-baru', () => portofolioBaru());
  function portofolioBaru() {
    const s = UI.sheet({ title: 'Portofolio baru', cls: 'small', body: `<p class="muted small">Dibuat sebagai dompet "RDN" di Kas & Bank. Modal awal dicatat sebagai top up dari rekening yang dipilih.</p>
      ${UI.field('Nama portofolio / akun', `<input name="nama" maxlength="40" placeholder="mis. RDN Ajaib Dimas">`)}
      <div class="grid2">${UI.field('Modal awal', UI.rpInput('modal', 0))}${UI.field('Tanggal', `<input type="date" name="tanggal" value="${U.today()}">`)}</div>
      ${UI.field('Modal diambil dari', `<select name="dari"><option value="">Sudah ada di RDN (tidak memotong rekening lain)</option>${UI.walletOpts()}</select>`)}
      <div class="grid2">${UI.field('Pemilik', `<select name="pemilik"><option value="bersama">Bersama</option>${Store.members().map(m => `<option value="${m.email}" ${m.email === me() ? 'selected' : ''}>${U.esc(m.nama)}</option>`).join('')}</select>`)}${UI.field('Fee beli / jual (%)', `<div class="grid2 tight"><input type="number" step="0.001" name="beli" value="0.15"><input type="number" step="0.001" name="jual" value="0.25"></div>`)}</div>`,
      foot: `<button class="btn" data-ok>Buat portofolio</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el); if (!v.nama) return UI.toast('Nama wajib diisi.', 'warn');
      const id = U.uid('w'), now = new Date().toISOString(), ops = [{ op: 'upsert', t: 'Wallet', row: { id, nama: v.nama, jenis: 'rdn', pemilik: v.pemilik, saldoAwal: v.dari ? 0 : (v.modal || 0), ikon: '', likuid: false, urutan: Store.t.Wallet.length, arsip: false, catatan: 'Portofolio saham' } }];
      if (v.dari && v.modal) ops.push({ op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: v.tanggal || U.today(), jenis: 'transfer', jumlah: v.modal, kategoriId: '', walletId: v.dari, walletTujuan: id, biaya: 0, catatan: 'Modal awal ' + v.nama, dibayarOleh: me(), tag: 'saham', sumber: 'saham', refId: '', periodeRef: '', dicatatOleh: me(), dibuat: now, riwayat: [] } });
      const sa = setAkun(); sa[id] = { beli: Number(v.beli) || 0.15, jual: Number(v.jual) || 0.25 };
      Store.commit(ops); setJson('sahamAkun', sa);
      F.akun = id; try { localStorage.setItem('sa:shPf', id); } catch (e) {}
      s.close(); UI.toast('Portofolio ' + v.nama + ' dibuat.'); UI.go('saham');
    };
  }

  // ===== Overview =====
  function overview() {
    const ids = akunAktif(), r = Calc.saham(null, ids), H = r.H, ak = ringkasAkun(ids), sr = seri();
    const mvT = U.sum(H, h => h.mv), aum = ak.cash + mvT, real = U.sum(r.R, x => x.pl), unr = U.sum(H, h => h.unr), tr = ak.nc ? (aum / ak.nc - 1) * 100 : 0;
    const harian = U.sum(H.filter(h => h.prev && h.l), h => (h.l - h.prev) * h.lembar), tgl = H.map(h => h.tglHarga).filter(Boolean).sort()[0];
    const k = (l, t, v, s, c) => `<div class="tj-k ${c || ''}"><div class="lb">${l}<em>${t}</em></div><div class="tjv">${v}</div><div class="sub">${s}</div></div>`;
    return `
      <section class="hero rd-hero tj-hero">
        <div class="hero-top"><small>Total AUM · ekuitas + kas</small><button class="icon-btn sm on-dark" data-act="toggle-hide" aria-label="Sembunyikan angka">${I(UI.hide() ? 'eye-off' : 'eye')}</button></div>
        <div class="rd-big">${UI.m(aum)}</div>
        <div class="rd-pill ${tr >= 0 ? 'naik' : 'turun'}">${I(tr >= 0 ? 'arrow-up-right' : 'arrow-down-left')} ${tanda(tr)}${Math.abs(tr).toFixed(2).replace('.', ',')}% <span>total return · ${tanda(aum - ak.nc)}${UI.ms(Math.abs(aum - ak.nc))} vs modal</span></div>
        <button class="btn on-dark block" data-act="sh-harga">${I('refresh-cw')} Perbarui harga${tgl ? ' · ' + U.relDay(tgl).toLowerCase() : ''}${harian ? ' · hari ini ' + tanda(harian) + UI.ms(Math.abs(harian)) : ''}</button>
        ${H.some(h => !h.l) ? (() => { let er = ''; try { er = localStorage.getItem('sa:shHargaErr') || ''; } catch (e) {} return `<small class="tj-herr">${I('info')} ${H.filter(h => !h.l).map(h => h.kode).join(', ')} belum punya harga${er ? ' · ' + U.esc(er) : ''}. <a data-act="sh-harga-manual">Isi manual</a></small>`; })() : ''}
      </section>
      <div class="tj-kpi">
        ${k('Realized P&L', 'net fee', rpK(real, 1), r.R.length + ' penjualan', cls(real))}
        ${k('Floating P&L', 'unrealized', rpK(unr, 1), H.length + ' posisi aktif', cls(unr))}
        ${k('Cash (RDN)', '', rpK(ak.cash), aum ? (ak.cash / aum * 100).toFixed(1).replace('.', ',') + '% dari AUM' : '')}
        ${k('Max Drawdown', 'risk', sr ? pc(sr.mdd) : '—', sr ? 'dari snapshot harian' : 'menunggu data harga')}
      </div>
      <div class="card tj-card"><div class="row-sp"><h3>Portofolio vs IHSG</h3>${sr ? `<small>${pc(sr.s[sr.s.length - 1].ret)} · IHSG ${pc(sr.s[sr.s.length - 1].ihsg)}</small>` : ''}</div>${grafik(sr)}</div>
      ${UI.sec('Open positions', `<small class="muted">${H.length} emiten</small>`)}
      <div class="tj-pos">${H.map(h => `<div class="card tj-p" data-act="sh-open" data-kode="${h.kode}" data-akun="${h.walletId}">
          <div class="tj-p-top"><span class="sh-kode">${h.kode}</span><div class="grow"><b>${h.lots} lot</b><small>avg ${nm(h.avg)} · last ${h.l ? nm(h.l) : '<span class="bad">n/a</span>'}${h.l && h.prev ? ' ' + pc((h.l / h.prev - 1) * 100) : ''}</small></div>
            ${h.st ? `<span class="tjs ${h.st}">${{ sl: 'Near SL', tp: 'TP1 reached', tp2: 'TP2 reached', ok: 'In plan' }[h.st]}</span>` : ''}</div>
          <div class="tj-p-mid"><div><small>Invested</small><b>${UI.ms(h.cost)}</b></div><div><small>Market value</small><b>${UI.ms(h.mv)}</b></div><div class="r"><small>Floating</small><b>${rpK(h.unr, 1)}</b><small>${pc(h.pct)}</small></div></div>
          ${h.plan.sl || h.plan.tp1 ? `<div class="tj-plan">${planBar(h)}</div>` : ''}
          ${ids.length > 1 ? `<small class="muted">${U.esc(akunNama(h.walletId))}</small>` : ''}</div>`).join('') || `<div class="card muted center">Tidak ada posisi terbuka.</div>`}</div>
      ${UI.sec('Recent activity', '<a class="link" href="#/saham/aktivitas">Semua</a>')}
      <div class="card list">${LOG().slice(0, 8).map(rowLog).join('') || '<div class="row muted">Belum ada aktivitas.</div>'}</div>
      ${legacy()}`;
  }
  /** Bar posisi harga terhadap SL — entry — TP1 — TP2. */
  function planBar(h) {
    const p = h.plan, sl = Number(p.sl) || 0, t1 = Number(p.tp1) || 0, t2 = Number(p.tp2) || 0, lo = sl || h.avg * 0.9, hi = t2 || t1 || h.avg * 1.1;
    const pos = v => Math.max(0, Math.min(100, (v - lo) / ((hi - lo) || 1) * 100));
    return `<div class="tj-bar"><i class="avg" style="left:${pos(h.avg)}%"></i>${h.l ? `<i class="now ${h.l >= h.avg ? 'up' : 'dn'}" style="left:${pos(h.l)}%"></i>` : ''}</div>
      <div class="tj-lv"><span class="bad">SL ${sl ? nm(sl) : '—'}</span><span>avg ${nm(h.avg)}</span><span class="ok">TP1 ${t1 ? nm(t1) : '—'}${t2 ? ' · TP2 ' + nm(t2) : ''}</span></div>`;
  }
  function grafik(sr) {
    if (!sr) return `<div class="tj-empty">${I('chart-column')} Grafik muncul setelah riwayat harga tersedia (otomatis dari data penutupan harian).</div>`;
    const s = sr.s, p = s.map(x => x.ret), h = s.map(x => x.ihsg), al = p.concat(h), mn = Math.min(0, ...al), mx = Math.max(1, ...al), W = 340, Hh = 160;
    const X = i => i / (s.length - 1) * W, Y = v => Hh - 8 - (v - mn) / ((mx - mn) || 1) * (Hh - 16), pl = a => a.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
    return `<div class="tj-cw" data-n="${s.length}"><svg viewBox="0 0 ${W} ${Hh}" class="tj-ch" preserveAspectRatio="none"><line class="l0" x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}"/><polygon class="ar" points="0,${Hh - 8} ${pl(p)} ${W},${Hh - 8}"/><polyline class="l2" points="${pl(h)}"/><polyline class="l1" points="${pl(p)}"/></svg>
      <i class="xl" hidden></i><i class="dt a" hidden></i><i class="dt b" hidden></i><div class="tt" hidden></div></div>
      <div class="tj-leg"><span><i class="a"></i>Portofolio</span><span><i class="b"></i>IHSG</span><span class="sp"></span><small>${U.tgl(s[0].d, 'mys')} – ${U.tgl(s[s.length - 1].d, 'mys')}</small></div>
      <small class="muted">Sentuh grafik untuk melihat detail harian.</small>`;
  }
  function pasangGrafik() {
    const w = document.querySelector('#view .tj-cw'), sr = SERI.v; if (!w || !sr) return;
    const s = sr.s, p = s.map(x => x.ret), h = s.map(x => x.ihsg), al = p.concat(h), mn = Math.min(0, ...al), mx = Math.max(1, ...al), Y = v => (160 - 8 - (v - mn) / ((mx - mn) || 1) * 144) / 160 * 100;
    const q = c => w.querySelector(c), tt = q('.tt');
    const show = e => {
      const r = w.getBoundingClientRect(), n = s.length, i = Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left) / r.width * (n - 1)))), x = i / (n - 1) * 100, pv = i ? s[i - 1] : null, d = s[i];
      q('.xl').hidden = false; q('.xl').style.left = x + '%';
      [['.a', d.ret], ['.b', d.ihsg]].forEach(a => { const el = q(a[0]); el.hidden = false; el.style.left = x + '%'; el.style.top = Y(a[1]) + '%'; });
      tt.hidden = false; tt.innerHTML = `<b>${U.tgl(d.d)}</b><div>Portofolio ${pc(d.ret)}</div><div>IHSG ${pc(d.ihsg)}</div><div>Selisih ${pc(d.ret - d.ihsg)}</div><div>AUM ${UI.ms(d.aum)}</div><div>Δ harian ${pv ? rpK(d.aum - pv.aum, 1) : '-'}</div>`;
      tt.style.left = x > 55 ? 'auto' : x + '%'; tt.style.right = x > 55 ? (100 - x) + '%' : 'auto';
    };
    const hide = () => w.querySelectorAll('.tt,.xl,.dt').forEach(x => x.hidden = true);
    w.addEventListener('pointermove', show); w.addEventListener('pointerdown', show); w.addEventListener('pointerleave', hide);
  }
  function rowLog(r) {
    const t = r.t, d = t && (t.aksi === 'beli' || t.aksi === 'jual') ? `${t.lot} lot @ ${nm(t.harga)}${r.f ? ' · fee ' + nm(r.f) : ''}` : r.k === 'cash' ? U.esc(UI.note(r.tx) || '') : t && t.aksi === 'dividen' ? 'Dividen tunai' : 'Bea meterai harian';
    return `<div class="row tj-row" ${r.k === 'cash' ? `data-act="tx-open" data-id="${r.id}"` : `data-act="sh-edit" data-id="${r.id}"`}>${bdg(r.ty)}
      <div class="tx-txt"><b>${r.kode ? r.kode : ''}${r.setup ? ` <small class="muted">· ${U.esc(r.setup)}</small>` : ''}</b><small>${U.tgl(r.d, 'dm')} · ${d}</small></div><b class="tx-amt">${rpK(r.amt, 1)}</b></div>`;
  }
  function legacy() {
    const lama = Calc.investasiManual ? Calc.investasiManual('saham') : [];
    if (!lama.length) return '';
    return UI.sec('Dicatat manual (versi lama)') + `<div class="card list">${lama.map(i => `<div class="row"><span class="sh-kode muted">${U.esc(i.x.kode || '—')}</span><div class="tx-txt"><b>${U.esc(i.x.nama)}</b><small>${U.fmtNum(i.x.unit || 0)} lembar · modal ${UI.ms(i.modal)}</small></div><button class="btn xs ghost" data-act="sh-pindah" data-id="${i.x.id}">Pindah ke jurnal</button></div>`).join('')}</div>`;
  }
  UI.act('sh-pindah', el => {
    const x = Store.byId.Investasi[el.dataset.id]; if (!x) return;
    const ak = akunList(); if (!ak.length) return portofolioBaru();
    const lem = Number(x.unit) || 0, lot = Math.round(lem / LB);
    if (!lot || !/^[A-Z]{4}/.test(String(x.kode || '').toUpperCase())) return UI.toast('Isi kode saham & jumlah lembar dulu di catatan lama.', 'warn');
    const s = UI.sheet({ title: 'Pindahkan ' + x.kode, cls: 'small', body: `<p class="muted">${lot} lot @ ${U.rp(Math.round((x.modal || 0) / lem))} dicatat sebagai pembelian awal ${U.tgl(x.tanggal)}. Saldo tidak berubah.</p>
      ${UI.field('Portofolio', `<select name="w">${ak.map(w => `<option value="${w.id}">${U.esc(w.nama)}</option>`).join('')}</select>`)}`, foot: `<button class="btn" data-ok>Pindahkan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el), now = new Date().toISOString(), kode = String(x.kode).toUpperCase().slice(0, 4);
      Store.commit([{ op: 'upsert', t: 'Saham', row: { id: U.uid('sh'), tanggal: x.tanggal || U.today(), kode, aksi: 'beli', lot, harga: Math.round((x.modal || 0) / (lot * LB)), fee: 0, nominal: 0, walletId: v.w, catatan: 'Saldo awal dari catatan lama', dibuat: now, txId: '', oleh: me(), setup: '' } }, { op: 'delete', t: 'Investasi', id: x.id }]);
      if (x.nilai && lem && !harga()[kode]) simpanHarga({ [kode]: [Math.round(x.nilai / lem), x.tglNilai || U.today(), 'Manual', 0] });
      s.close(); UI.toast(kode + ' dipindah ke jurnal.');
    };
  });

  UI.act('sh-open', el => {
    const kode = el.dataset.kode, akun = el.dataset.akun, r = Calc.saham(null, [akun]), h = r.H.find(x => x.kode === kode);
    const real = U.sum(r.R.filter(x => x.kode === kode), x => x.pl), div = U.sum(r.dividen.filter(x => x.t.kode === kode), x => x.v);
    const tr = trades().filter(t => t.kode === kode && t.walletId === akun).reverse();
    const s = UI.sheet({ title: kode + ' · ' + akunNama(akun), body: (h ? `
      <div class="detail-head"><span class="sh-kode lg">${kode}</span><div><small class="muted">${h.lots} lot (${U.fmtNum(h.lembar)} lembar)</small><div class="big-amt">${UI.m(h.mv)}</div><small>${rpS(h.unr, 1)} ${pc(h.pct)}</small></div></div>
      ${h.plan.sl || h.plan.tp1 ? `<div class="tj-plan card">${planBar(h)}</div>` : ''}
      <div class="kv-list"><div class="kv"><span>Average</span><b>${U.rp(Math.round(h.avg))}</b></div><div class="kv"><span>Last</span><b>${h.l ? U.rp(h.l) + ' · ' + U.tgl(h.tglHarga, 'dm') : 'n/a'}</b></div>
        <div class="kv"><span>Invested</span><b>${U.rp(Math.round(h.cost))}</b></div>${real ? `<div class="kv"><span>Realized</span><b class="${cls(real)}">${tanda(real)}${UI.m(Math.abs(real))}</b></div>` : ''}${div ? `<div class="kv"><span>Dividen</span><b class="ok">${U.rp(div)}</b></div>` : ''}
        <div class="kv"><span>Dipegang sejak</span><b>${U.tgl(h.mulai)}</b></div>${h.plan.setup ? `<div class="kv"><span>Setup</span><b>${U.esc(h.plan.setup)}</b></div>` : ''}</div>` : `<p class="muted">Posisi ${kode} sudah ditutup.</p>`) +
      `<h4 class="mini-h">Riwayat ${kode}</h4><div class="list">${tr.map(t => rowLog(LOG().find(x => x.id === t.id) || { k: 'trade', id: t.id, d: t.tanggal, ty: 'BELI', kode, amt: 0, t })).join('')}</div>`,
      foot: `${h ? `<button class="btn ghost" data-a="plan" aria-label="Ubah rencana">${I('target')}</button><button class="btn ghost" data-a="kalk" aria-label="Kalkulator">${I('calculator')}</button>` : ''}<button class="btn ghost" data-a="jual">Jual</button><button class="btn" data-a="beli">Beli</button>` });
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { s.close(); const a = b.dataset.a;
      if (a === 'kalk') { K.kode = kode; K.akun = akun; UI.go('saham/kalkulator'); }
      else if (a === 'plan') { const t = h.plan.id ? h.plan : trades().filter(x => x.kode === kode && x.walletId === akun && x.aksi === 'beli').pop(); if (t) UI.tradeForm(t, { fokusPlan: true }); }
      else UI.tradeForm(null, { kode, side: a, akun }); });
  });

  // ===== Activity =====
  function aktivitas() {
    const q = F.q.toLowerCase(), L = LOG().filter(r => (!F.ty || r.ty === F.ty) && (!F.su || r.setup === F.su) && (!F.a || r.d >= F.a) && (!F.b || r.d <= F.b) && (!q || [r.kode, r.setup, r.t ? r.t.catatan : r.tx ? UI.note(r.tx) : ''].join(' ').toLowerCase().indexOf(q) > -1));
    const tr = L.filter(r => r.k === 'trade' && r.g), nf = (F.ty ? 1 : 0) + (F.su ? 1 : 0) + (F.a || F.b ? 1 : 0);
    const g = U.groupBy(L, r => r.d.slice(0, 7));
    return `<div class="tj-flt"><div class="search">${I('search')}<input type="search" placeholder="Cari kode, setup, catatan…" value="${U.esc(F.q)}" data-input="sh-q"></div>
        <button class="chip ${nf ? 'on' : ''}" data-act="sh-filter">${I('sliders-horizontal')} Filter${nf ? ' · ' + nf : ''}</button></div>
      <div class="chips sm scroll">${Object.keys(TIPE).map(t => `<button class="chip ${F.ty === t ? 'on' : ''}" data-act="sh-ty" data-v="${t}">${t[0] + t.slice(1).toLowerCase()}</button>`).join('')}</div>
      <div class="tj-kpi">${[['Records', L.length + ' event'], ['Gross turnover', UI.ms(U.sum(tr, r => r.g))], ['Fee & materai', UI.ms(U.sum(L, r => r.f))], ['Net cash delta', rpK(U.sum(L, r => r.amt), 1)]].map(x => `<div class="tj-k"><div class="lb">${x[0]}</div><div class="tjv sm">${x[1]}</div></div>`).join('')}</div>
      ${Object.keys(g).map(m => `<div class="day-h"><b>${U.tgl(m + '-01', 'my')}</b><span>${g[m].length} event · ${rpK(U.sum(g[m], r => r.amt), 1)}</span></div><div class="card list">${g[m].map(rowLog).join('')}</div>`).join('') || `<div class="card">${UI.empty('list', 'Belum ada data', 'Tidak ada aktivitas yang cocok dengan filter.', nf || F.q ? `<button class="btn ghost" data-act="sh-reset">Reset filter</button>` : '')}</div>`}`;
  }
  UI.act('sh-q', U.debounce(el => { F.q = el.value; const pos = el.selectionStart; UI.render(); const n = document.querySelector('[data-input=sh-q]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 250));
  UI.act('sh-ty', el => { F.ty = F.ty === el.dataset.v ? '' : el.dataset.v; UI.render(); });
  UI.act('sh-reset', () => { Object.assign(F, { q: '', ty: '', su: '', a: '', b: '' }); UI.render(); });
  UI.act('sh-filter', () => {
    const s = UI.sheet({ title: 'Filter aktivitas', cls: 'small', body: `
      ${UI.field('Tipe', `<select name="ty"><option value="">Semua tipe</option>${Object.keys(TIPE).map(t => `<option ${F.ty === t ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      ${UI.field('Setup', `<select name="su"><option value="">Semua setup</option>${setups().map(x => `<option ${F.su === x ? 'selected' : ''}>${U.esc(x)}</option>`).join('')}</select>`)}
      <div class="grid2">${UI.field('Dari', `<input type="date" name="a" value="${F.a}">`)}${UI.field('Sampai', `<input type="date" name="b" value="${F.b}">`)}</div>`,
      foot: `<button class="btn ghost" data-r>Reset</button><button class="btn" data-ok>Terapkan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => { const v = UI.formData(s.el); Object.assign(F, { ty: v.ty, su: v.su, a: v.a, b: v.b }); s.close(); UI.render(); };
    s.el.querySelector('[data-r]').onclick = () => { Object.assign(F, { ty: '', su: '', a: '', b: '' }); s.close(); UI.render(); };
  });

  // ===== Analytics =====
  function analitik() {
    const ids = akunAktif(), R = Calc.saham(null, ids).R.filter(r => (!AN.a || r.tanggal >= AN.a) && (!AN.b || r.tanggal <= AN.b));
    const w = R.filter(r => r.pl > 0), ls = R.filter(r => r.pl < 0), L = U.sum(R, r => r.lots) || 1, hold = U.sum(R, r => r.hold * r.lots) / L;
    const gross = U.sum(w, r => r.pl), loss = -U.sum(ls, r => r.pl), real = U.sum(R, r => r.pl);
    const row = r => `<div class="row" data-act="sh-edit" data-id="${r.t.id}"><span class="sh-kode">${r.kode}</span><div class="tx-txt"><b>${U.esc(r.setup || '—')}</b><small>${U.tgl(r.tanggal, 'dm')} · ${r.lots} lot · avg ${nm(r.avg)} → ${nm(r.px)} · ${Math.round(r.hold)} hr</small></div><div class="tx-amt"><b>${rpK(r.pl, 1)}</b><small>${pc(r.pct)}</small></div></div>`;
    const grp = k => { const m = {}; R.forEach(r => { const g = m[r[k] || '—'] = m[r[k] || '—'] || { n: 0, w: 0, pl: 0 }; g.n++; g.w += r.pl > 0 ? 1 : 0; g.pl += r.pl; });
      return Object.entries(m).sort((a, b) => b[1].pl - a[1].pl).map(e => `<div class="row"><span class="${k === 'kode' ? 'sh-kode' : 'tj-setup'}">${U.esc(e[0])}</span><div class="tx-txt"><b>${e[1].n} trade</b><small>win ${Math.round(e[1].w / e[1].n * 100)}%</small></div><b class="tx-amt">${rpK(e[1].pl, 1)}</b></div>`).join(''); };
    const bln = []; for (let k = 11; k >= 0; k--) { const ym = U.ym(U.addMonths(U.today(), -k)); bln.push({ label: U.tgl(ym + '-01', 'mys').split(' ')[0], v: U.sum(R.filter(x => x.tanggal.slice(0, 7) === ym), x => x.pl) }); }
    const kk = (l, v, s, c) => `<div class="tj-k ${c || ''}"><div class="lb">${l}</div><div class="tjv">${v}</div>${s ? `<div class="sub">${s}</div>` : ''}</div>`;
    return `<div class="grid2 tj-range">${UI.field('Dari', `<input type="date" value="${AN.a}" data-change="sh-an" data-k="a">`)}${UI.field('Sampai', `<input type="date" value="${AN.b}" data-change="sh-an" data-k="b">`)}</div>
      <div class="tj-kpi">
        ${kk('Win rate', `<span class="${R.length && w.length / R.length >= 0.5 ? 'ok' : ''}">${R.length ? (w.length / R.length * 100).toFixed(1).replace('.', ',') : 0}%</span>`, w.length + ' win · ' + ls.length + ' loss')}
        ${kk('Total trade', R.length, 'penjualan tertutup')}
        ${kk('Avg holding', hold.toFixed(1).replace('.', ',') + ' hari', 'tertimbang lot')}
        ${kk('Realized', rpK(real, 1), 'net fee', cls(real))}
        ${kk('Profit factor', loss ? (gross / loss).toFixed(2).replace('.', ',') : gross ? '∞' : '—', 'total win ÷ total loss')}
        ${kk('Avg win / loss', `<span class="ok">${w.length ? '+' + (U.sum(w, r => r.pct) / w.length).toFixed(1).replace('.', ',') + '%' : '—'}</span> <span class="bad">${ls.length ? (U.sum(ls, r => r.pct) / ls.length).toFixed(1).replace('.', ',') + '%' : ''}</span>`, '')}
      </div>
      <div class="card rd-trend"><div class="row-sp"><b>Realized per bulan</b><small class="muted">12 bulan</small></div>${barPN(bln)}</div>
      ${UI.sec('Best sale — top 10')}<div class="card list">${R.filter(r => r.pl > 0).sort((a, b) => b.pl - a.pl).slice(0, 10).map(row).join('') || '<div class="row muted">Belum ada data.</div>'}</div>
      ${UI.sec('Worst sale — top 10')}<div class="card list">${R.filter(r => r.pl < 0).sort((a, b) => a.pl - b.pl).slice(0, 10).map(row).join('') || '<div class="row muted">Belum ada data.</div>'}</div>
      ${UI.sec('Realized — 10 terakhir')}<div class="card list">${R.slice().sort((a, b) => a.tanggal < b.tanggal ? 1 : -1).slice(0, 10).map(row).join('') || '<div class="row muted">Belum ada data.</div>'}</div>
      ${UI.sec('Per kode saham')}<div class="card list">${grp('kode') || '<div class="row muted">Belum ada data.</div>'}</div>
      ${UI.sec('Per setup')}<div class="card list">${grp('setup') || '<div class="row muted">Belum ada data.</div>'}</div>`;
  }
  UI.act('sh-an', el => { AN[el.dataset.k] = el.value; UI.render(); });
  const barPN = rows => {
    const W = 340, H = 140, pd = 14, max = Math.max(1, ...rows.map(r => Math.abs(r.v))), gw = (W - 12) / rows.length, bw = Math.min(18, gw * 0.56), mid = pd + (H - pd - 22) / 2, sc = (H - pd - 22) / 2 / max;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart rd-bars" role="img" aria-label="Realized per bulan"><line x1="6" x2="${W - 6}" y1="${mid}" y2="${mid}" class="grid"/>`;
    rows.forEach((r, i) => { const cx = 6 + gw * i + gw / 2, h = Math.max(r.v ? 2 : 0, Math.abs(r.v) * sc); s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(r.v >= 0 ? mid - h : mid).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" class="${r.v >= 0 ? 'naik' : 'turun'}"/>`;
      if (i % 2 === (rows.length - 1) % 2) s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="axis${i === rows.length - 1 ? ' strong' : ''}">${U.esc(r.label)}</text>`; });
    return s + '</svg>';
  };

  // ===== Avg Calculator (2 skenario, termasuk fee & materai) =====
  const K = { kode: '', akun: '' };
  function kalkulator() {
    const ids = akunAktif(), H = Calc.saham(null, ids).H;
    const i = (k, l, v) => UI.field(l, `<input type="number" step="any" inputmode="decimal" data-kk="${k}" value="${v || ''}">`);
    const h = H.find(x => x.kode === K.kode && (!K.akun || x.walletId === K.akun));
    return `<div class="card"><div class="chips scroll">${H.map(x => `<button class="chip ${h === x ? 'on' : ''}" data-act="sh-kchip" data-kode="${x.kode}" data-akun="${x.walletId}">${x.kode} ${x.lots} lot · ${nm(x.avg)}</button>`).join('') || '<small class="muted">Belum ada posisi — isi manual.</small>'}</div>
        <div class="grid2">${i('L', 'Lot dimiliki', h && h.lots)}${i('A', 'Average saat ini', h && Math.round(h.avg))}</div></div>
      <div class="card"><h3 class="tj-h">Skenario 1 — Target average</h3><div class="grid2">${i('T', 'Target average')}${i('P1', 'Harga beli tambahan', h && h.l)}</div><div id="o1"></div></div>
      <div class="card"><h3 class="tj-h">Skenario 2 — Simulasi beli</h3><div class="grid2">${i('N', 'Lot tambahan')}${i('P2', 'Harga beli', h && h.l)}</div><div id="o2"></div></div>
      <button class="btn ghost" data-act="sh-kreset">${I('rotate-ccw')} Reset</button>
      <p class="muted small">Termasuk fee beli & bea meterai bila nilai beli > ambang. Hanya berhitung — tidak mencatat transaksi.</p>`;
  }
  UI.act('sh-kchip', el => { K.kode = el.dataset.kode; K.akun = el.dataset.akun; UI.render(); });
  UI.act('sh-kreset', () => { K.kode = K.akun = ''; UI.render(); document.querySelectorAll('[data-kk]').forEach(x => x.value = ''); kalkHitung(); });
  function kalkHitung() {
    const root = document.getElementById('view'); if (!root || !root.querySelector('[data-kk]')) return;
    const v = k => Number((root.querySelector(`[data-kk=${k}]`) || {}).value) || 0;
    const run = () => {
      const c = cfg(K.akun || akunAktif()[0]), f = c.beli / 100, L = v('L'), A0 = v('A'), Tg = v('T'), P1 = v('P1'), N = v('N'), P2 = v('P2'), cash = ringkasAkun(K.akun ? [K.akun] : akunAktif()).cash;
      const ev = (n, p) => { const g = n * LB * p, m = g > c.ambang ? c.materai : 0, fe = Math.round(g * f); return { avg: (L * LB * A0 + g + fe + m) / ((L + n) * LB), g, fe, m, tot: g + fe + m }; };
      const box = (e, n) => `<div class="tj-box"><div class="lb">Lot dibeli</div><div class="kv">${n} <small>(${U.fmtNum(n * LB)} lbr)</small></div>
        <div class="sub">Dana ${U.rp(e.tot)} = gross ${U.rp(e.g)} + fee ${U.rp(e.fe)} + materai ${U.rp(e.m)}</div>
        <div class="sub">Avg baru <b>${U.rp(Math.round(e.avg))}</b> · posisi ${L + n} lot · ${e.tot <= cash ? '<span class="ok">cash cukup</span>' : '<span class="bad">kurang ' + U.rp(e.tot - cash) + '</span>'}</div>
        ${A0 ? `<div class="sub">BEP setelah fee jual ≈ <b>${U.rp(Math.ceil(e.avg / (1 - c.jual / 100)))}</b></div>` : ''}</div>`;
      let o = '<div class="tj-empty">Isi lot, average, target, dan harga beli.</div>';
      if (L && A0 && Tg && P1) { const dn = Tg < A0;
        if (Tg === A0) o = '<div class="sub">Target sama dengan average saat ini.</div>';
        else if (dn ? P1 * (1 + f) >= Tg : P1 * (1 + f) <= Tg) o = `<div class="warn-line bad">Target tidak mungkin: harga beli (+fee) harus ${dn ? 'di bawah' : 'di atas'} target.</div>`;
        else { const ok = n => dn ? ev(n, P1).avg <= Tg : ev(n, P1).avg >= Tg; let n = Math.max(1, Math.ceil(L * (A0 - Tg) / (Tg - P1))); while (!ok(n) && n < 1e5) n++; while (n > 1 && ok(n - 1)) n--; o = box(ev(n, P1), n); } }
      document.getElementById('o1').innerHTML = o;
      document.getElementById('o2').innerHTML = L && A0 && N && P2 ? box(ev(N, P2), N) : '<div class="tj-empty">Isi lot tambahan dan harga beli.</div>';
    };
    root.querySelectorAll('[data-kk]').forEach(x => x.addEventListener('input', run)); run();
  }

  // ===== Modal: Trade (Beli/Jual + setup & rencana) =====
  const heldAt = (kode, akun, tgl, kecuali) => trades().filter(x => x.kode === kode && x.walletId === akun && x.tanggal <= tgl && x.id !== kecuali && (x.aksi === 'beli' || x.aksi === 'jual')).reduce((a, x) => a + (x.aksi === 'beli' ? 1 : -1) * (Number(x.lot) || 0), 0);
  UI.tradeForm = (t, o) => {
    o = o || {};
    const ak = akunList(); if (!ak.length) return portofolioBaru();
    const isNew = !t, akun0 = (t && t.walletId) || o.akun || F.akun || ak[0].id;
    let side = t ? (t.aksi === 'jual' ? 'jual' : 'beli') : (o.side === 'jual' ? 'jual' : 'beli'), warned = false;
    const n = (k, l, v) => UI.field(l, `<input type="number" step="any" inputmode="decimal" name="${k}" value="${v || ''}">`);
    const kodeAda = Array.from(new Set(trades().map(x => x.kode).filter(k => k && k !== '-'))).sort();
    const s = UI.sheet({ title: (t ? 'Ubah' : 'Catat') + ' transaksi saham', body: `
      <div class="seg tj-side"><button type="button" data-sd="beli">BELI</button><button type="button" data-sd="jual">JUAL</button></div>
      <div class="grid2">${UI.field('Kode saham', `<input name="kode" maxlength="4" value="${t ? t.kode : o.kode || ''}" list="tj-kode" autocomplete="off" autocapitalize="characters" class="up" placeholder="BBCA"><datalist id="tj-kode">${kodeAda.map(k => `<option>${k}</option>`).join('')}</datalist>`)}${UI.field('Tanggal', `<input type="date" name="tanggal" value="${t ? t.tanggal : U.today()}">`)}</div>
      ${UI.field('Portofolio', `<select name="walletId">${ak.map(w => `<option value="${w.id}" ${w.id === akun0 ? 'selected' : ''}>${U.esc(w.nama)}</option>`).join('')}</select>`)}
      <div class="grid2">${n('lot', 'Volume (lot)', t && t.lot)}${n('harga', 'Harga / lembar', t && t.harga)}</div>
      ${UI.field('Setup', `<select name="setup"><option value="">—</option>${setups().map(x => `<option ${t && t.setup === x ? 'selected' : ''}>${U.esc(x)}</option>`).join('')}</select>`)}
      <div data-plan><h4 class="mini-h">Rencana trade</h4><div class="grid2">${n('entryLow', 'Entry low', t && t.entryLow)}${n('entryHigh', 'Entry high', t && t.entryHigh)}</div>
        <div class="grid3">${n('sl', 'Stop loss', t && t.sl)}${n('tp1', 'Take profit 1', t && t.tp1)}${n('tp2', 'Take profit 2', t && t.tp2)}</div></div>
      ${UI.field('Catatan', `<input name="catatan" maxlength="140" value="${U.esc(t ? t.catatan : '')}" placeholder="alasan entry / exit">`)}
      <div class="tj-sum"></div><div class="warn-line bad" data-w></div>`,
      foot: `${t ? `<button class="btn ghost danger" data-del aria-label="Hapus">${I('trash-2')}</button>` : `<button class="btn ghost" data-lagi>Simpan & tambah</button>`}<button class="btn" data-ok>${I('check')} Simpan</button>` });
    const q = k => s.el.querySelector(`[name=${k}]`), W = m => { s.el.querySelector('[data-w]').textContent = m; return true; };
    const prev = () => {
      const kode = String(q('kode').value).toUpperCase(), L = Number(q('lot').value) || 0, p = Number(q('harga').value) || 0, akun = q('walletId').value, c = cfg(akun), gr = L * LB * p, f = Math.round(gr * (side === 'beli' ? c.beli : c.jual) / 100), d = q('tanggal').value;
      s.el.querySelectorAll('[data-sd]').forEach(b => { b.classList.toggle('on', b.dataset.sd === side); b.classList.toggle('buy', b.dataset.sd === side && side === 'beli'); });
      const held = kode.length === 4 ? heldAt(kode, akun, d, t && t.id) : 0;
      s.el.querySelector('[data-plan]').hidden = !(side === 'beli' && (held === 0 || o.fokusPlan || (t && (t.sl || t.tp1))));
      const net = side === 'beli' ? -(gr + f) : gr - f, pos = Calc.saham(d, [akun]).H.find(x => x.kode === kode);
      s.el.querySelector('.tj-sum').innerHTML = `<div class="kv"><span>Gross</span><b>${U.rp(gr)}</b></div><div class="kv"><span>Fee ${side === 'beli' ? c.beli : c.jual}%</span><b>${U.rp(f)}</b></div>
        <div class="kv tot"><span>${side === 'beli' ? 'Total cash out' : 'Total cash in'}</span><b>${U.rp(Math.abs(net))}</b></div>
        ${held ? `<div class="kv muted"><span>Dipegang</span><b>${held} lot${pos ? ' · avg ' + nm(pos.avg) : ''}</b></div>` : ''}
        ${side === 'jual' && pos && L ? (() => { const pl = (gr - f) - pos.cost * Math.min(1, L / pos.lots); return `<div class="kv"><span>Estimasi P&L</span><b class="${cls(pl)}">${tanda(pl)}${U.rp(Math.abs(Math.round(pl)))}</b></div>`; })() : ''}
        ${side === 'beli' && gr > c.ambang ? `<div class="kv muted"><span>+ Bea meterai hari ini</span><b>${U.rp(c.materai)}</b></div>` : ''}`;
      return { kode, L, p, akun, f, d, net, held };
    };
    s.el.addEventListener('input', () => { W(''); prev(); }); s.el.addEventListener('change', prev);
    s.el.querySelectorAll('[data-sd]').forEach(b => b.onclick = () => { side = b.dataset.sd; warned = false; prev(); });
    prev();
    const simpan = (lagi) => {
      const x = prev(), v = UI.formData(s.el);
      if (!/^[A-Z]{4}$/.test(x.kode)) return W('Kode saham harus 4 huruf.');
      if (!(x.L > 0 && x.L % 1 === 0)) return W('Lot harus bilangan bulat > 0.');
      if (!(x.p > 0)) return W('Harga harus > 0.');
      if (!x.d) return W('Tanggal wajib diisi.');
      if (side === 'jual' && x.L > x.held) return W('Jual melebihi kepemilikan (' + x.held + ' lot pada tanggal tsb).');
      const old = t && t.txId && Store.byId.Transaksi[t.txId] ? -efek(Store.byId.Transaksi[t.txId], x.akun) : 0, cash = ringkasAkun([x.akun]).cash;
      if (side === 'beli' && cash + old + x.net < 0 && !warned) { warned = true; return W('Peringatan: kas ' + akunNama(x.akun) + ' akan negatif. Tekan simpan lagi untuk melanjutkan (atau catat top up dulu).'); }
      const plan = !s.el.querySelector('[data-plan]').hidden, num = k => Number(v[k]) || '';
      const row = Object.assign({}, t || { id: U.uid('sh'), dibuat: new Date().toISOString(), txId: '', oleh: me(), nominal: 0 }, {
        tanggal: x.d, kode: x.kode, aksi: side, lot: x.L, harga: x.p, fee: x.f, walletId: x.akun, setup: v.setup || '', catatan: v.catatan || '',
        entryLow: plan ? num('entryLow') : (t ? t.entryLow : ''), entryHigh: plan ? num('entryHigh') : (t ? t.entryHigh : ''), sl: plan ? num('sl') : (t ? t.sl : ''), tp1: plan ? num('tp1') : (t ? t.tp1 : ''), tp2: plan ? num('tp2') : (t ? t.tp2 : '') });
      Store.commit(opsUang(row)); sinkronMaterai();
      try { localStorage.setItem('sa:shPf', x.akun); } catch (e) {}
      UI.toast('Trade tersimpan.');
      if (lagi) { ['lot', 'harga'].forEach(k => q(k).value = ''); W(''); prev(); q('lot').focus(); } else s.close();
    };
    s.el.querySelector('[data-ok]').onclick = () => simpan(false);
    const lg = s.el.querySelector('[data-lagi]'); if (lg) lg.onclick = () => simpan(true);
    const dl = s.el.querySelector('[data-del]'); if (dl) dl.onclick = () => { s.close(); hapusDialog(t); };
    if (o.fokusPlan) setTimeout(() => { const e = q('sl'); if (e) e.focus(); }, 250);
  };
  /** Baris Saham + Transaksi uang yang berpasangan (txId). */
  function opsUang(row) {
    const now = new Date().toISOString(), txId = row.txId || U.uid('t'); row.txId = txId;
    const base = { id: txId, tanggal: row.tanggal, walletId: row.walletId, walletTujuan: '', biaya: 0, dibayarOleh: row.oleh || me(), tag: 'saham', sumber: 'saham', refId: row.id, periodeRef: row.tanggal.slice(0, 7), dicatatOleh: me(), dibuat: now, riwayat: [] };
    let tx;
    if (row.aksi === 'beli') tx = Object.assign(base, { jenis: 'aset_beli', jumlah: Math.round(row.lot * LB * row.harga + row.fee), kategoriId: '', catatan: `Beli ${row.kode} ${row.lot} lot @ ${nm(row.harga)}` });
    else if (row.aksi === 'jual') tx = Object.assign(base, { jenis: 'aset_jual', jumlah: Math.round(row.lot * LB * row.harga - row.fee), kategoriId: '', catatan: `Jual ${row.kode} ${row.lot} lot @ ${nm(row.harga)}` });
    else { const k = Store.t.Kategori.find(c => c.jenis === 'masuk' && !c.arsip && /divid|investasi|pasif|pemasukan lain/i.test(c.nama)); tx = Object.assign(base, { jenis: 'masuk', jumlah: Math.round(row.nominal), kategoriId: k ? k.id : '', catatan: `Dividen ${row.kode}` }); }
    return [{ op: 'upsert', t: 'Saham', row }, { op: 'upsert', t: 'Transaksi', row: tx }];
  }
  function hapusDialog(t) {
    const r = LOG().find(x => x.id === t.id) || { ty: t.aksi.toUpperCase(), amt: 0 };
    const s = UI.sheet({ title: 'Hapus transaksi?', cls: 'small', body: `<div class="card tj-row">${bdg(r.ty)} <b>${U.esc(t.kode)}</b> · ${U.tgl(t.tanggal)} · ${rpK(r.amt, 1)}</div>
      <p class="muted">Posisi, average, P&L, kas RDN & meterai dihitung ulang. Tidak dapat dibatalkan.</p>
      <label class="check"><input type="checkbox" data-k><span>Saya mengerti dan ingin menghapus</span></label>`, foot: `<button class="btn ghost" data-x>Batal</button><button class="btn danger" data-ok disabled>${I('trash-2')} Hapus</button>` });
    const ok = s.el.querySelector('[data-ok]');
    s.el.querySelector('[data-k]').onchange = e => ok.disabled = !e.target.checked;
    s.el.querySelector('[data-x]').onclick = () => s.close();
    ok.onclick = () => { Store.commit(hapusOps(t)); sinkronMaterai(); s.close(); UI.toast('Data dihapus.'); };
  }
  UI.act('sh-catat', el => UI.tradeForm(null, el && el.dataset ? { side: el.dataset.aksi, kode: el.dataset.kode, akun: el.dataset.akun } : {}));
  UI.act('sh-edit', el => {
    const t = (Store.t.Saham || []).find(x => x.id === el.dataset.id); if (!t) return;
    if (t.aksi === 'materai') return UI.toast('Bea meterai dihitung otomatis dari transaksi harian.', 'info');
    if (t.aksi === 'dividen') return cashForm(null, t);
    UI.tradeForm(t);
  });

  // ===== Modal: Cash flow (Top up / Tarik / Dividen / Penyesuaian) =====
  function cashForm(tipe, divRow) {
    const ak = akunList(); if (!ak.length) return portofolioBaru();
    let ct = divRow ? 'Dividen' : tipe || 'Top up';
    const akun0 = (divRow && divRow.walletId) || F.akun || ak[0].id, lain = Store.wallets().filter(w => w.jenis !== 'rdn');
    const s = UI.sheet({ title: (divRow ? 'Ubah' : 'Catat') + ' cash flow', cls: 'small', body: `
      <div class="seg tj-side four">${['Top up', 'Tarik', 'Dividen', 'Penyesuaian'].map(x => `<button type="button" data-ct="${x}">${x}</button>`).join('')}</div>
      <div class="grid2">${UI.field('Portofolio', `<select name="akun">${ak.map(w => `<option value="${w.id}" ${w.id === akun0 ? 'selected' : ''}>${U.esc(w.nama)}</option>`).join('')}</select>`)}${UI.field('Tanggal', `<input type="date" name="tanggal" value="${divRow ? divRow.tanggal : U.today()}">`)}</div>
      ${UI.field('Nominal', UI.rpInput('nominal', divRow ? divRow.nominal : 0), '')}
      <div data-f="Top up Tarik">${UI.field('Rekening bank', `<select name="bank">${lain.map(w => `<option value="${w.id}">${U.esc(w.nama)}</option>`).join('')}</select>`)}${UI.biayaField()}</div>
      <div data-f="Dividen">${UI.field('Kode saham', `<input name="kode" maxlength="4" class="up" value="${divRow ? divRow.kode : ''}" placeholder="BBCA">`)}</div>
      <div data-f="Penyesuaian">${UI.field('Saldo RDN sebenarnya', UI.rpInput('aktual', 0), 'Isi saldo yang terlihat di aplikasi sekuritas; selisihnya dicatat sebagai penyesuaian.')}</div>
      ${UI.field('Catatan', `<input name="catatan" maxlength="120" value="${U.esc(divRow ? divRow.catatan : '')}">`)}<div class="tj-sum"></div><div class="warn-line bad" data-w></div>`,
      foot: `${divRow ? `<button class="btn ghost danger" data-del>${I('trash-2')}</button>` : ''}<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    const q = k => s.el.querySelector(`[name=${k}]`);
    const prev = () => {
      s.el.querySelectorAll('[data-ct]').forEach(b => b.classList.toggle('on', b.dataset.ct === ct));
      s.el.querySelectorAll('[data-f]').forEach(d => d.hidden = d.dataset.f.indexOf(ct) < 0);
      q('nominal').closest('.field').hidden = ct === 'Penyesuaian';
      const cash = ringkasAkun([q('akun').value]).cash, m = U.parseRp(q('nominal').value), a = U.parseRp(q('aktual').value);
      const d = ct === 'Tarik' ? -m : ct === 'Penyesuaian' ? (a ? a - cash : 0) : m;
      s.el.querySelector('.tj-sum').innerHTML = `<div class="kv"><span>Cash saat ini</span><b>${U.rp(cash)}</b></div><div class="kv"><span>Setelah transaksi</span><b>${U.rp(cash + d)}</b></div>`;
      return { m, a, d, cash };
    };
    s.el.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { ct = b.dataset.ct; prev(); });
    s.el.addEventListener('input', prev); s.el.addEventListener('change', prev); prev();
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el), x = prev(), akun = v.akun, tgl = v.tanggal || U.today(), now = new Date().toISOString(), W = m => { s.el.querySelector('[data-w]').textContent = m; };
      if (ct === 'Penyesuaian') { if (!x.a && x.a !== 0) return W('Isi saldo sebenarnya.'); if (!x.d) return W('Tidak ada selisih.');
        Store.upsert('Transaksi', { id: U.uid('t'), tanggal: tgl, jenis: 'penyesuaian', jumlah: x.d, kategoriId: '', walletId: akun, walletTujuan: '', biaya: 0, catatan: v.catatan || 'Penyesuaian saldo RDN', dibayarOleh: me(), tag: 'saham', sumber: 'saham', refId: '', periodeRef: '', dicatatOleh: me(), dibuat: now, riwayat: [] }); s.close(); return UI.toast('Penyesuaian dicatat.'); }
      if (!x.m) return W('Nominal wajib diisi.');
      if (ct === 'Dividen') { const kode = String(v.kode || '').toUpperCase(); if (!/^[A-Z]{4}$/.test(kode)) return W('Kode saham wajib untuk dividen.');
        const row = Object.assign({}, divRow || { id: U.uid('sh'), dibuat: now, txId: '', oleh: me(), lot: 0, harga: 0, fee: 0, setup: '' }, { tanggal: tgl, kode, aksi: 'dividen', nominal: x.m, walletId: akun, catatan: v.catatan || '' });
        Store.commit(opsUang(row)); s.close(); return UI.toast('Dividen ' + kode + ' dicatat.'); }
      if (!v.bank) return W('Tambahkan rekening bank dulu di Kas & Bank.');
      const masuk = ct === 'Top up';
      Store.upsert('Transaksi', { id: U.uid('t'), tanggal: tgl, jenis: 'transfer', jumlah: x.m, kategoriId: '', walletId: masuk ? v.bank : akun, walletTujuan: masuk ? akun : v.bank, biaya: v.biayaLain || 0, catatan: v.catatan || (masuk ? 'Top up ' : 'Tarik dana ') + akunNama(akun), dibayarOleh: me(), tag: 'saham', sumber: 'saham', refId: '', periodeRef: '', dicatatOleh: me(), dibuat: now, riwayat: [] });
      s.close(); UI.toast(ct + ' tercatat.');
    };
    const dl = s.el.querySelector('[data-del]'); if (dl) dl.onclick = () => { s.close(); hapusDialog(divRow); };
  }
  UI.act('sh-cash', () => cashForm());

  // ===== Settings =====
  UI.act('sh-set', () => {
    const ak = akunList(), id = F.akun || (ak[0] || {}).id, c = cfg(id), w = Store.byId.Wallet[id];
    const s = UI.sheet({ title: 'Pengaturan saham', body: `
      ${w ? `${UI.field('Portofolio', `<select name="pf">${ak.map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${U.esc(x.nama)}</option>`).join('')}</select>`)}
      <div class="grid2">${UI.field('Fee beli (%)', `<input type="number" step="0.001" name="beli" value="${c.beli}">`)}${UI.field('Fee jual (%)', `<input type="number" step="0.001" name="jual" value="${c.jual}">`)}</div>
      <div class="grid2">${UI.field('Bea meterai (Rp)', `<input type="number" name="materai" value="${c.materai}">`)}${UI.field('Ambang meterai / hari', `<input type="number" name="ambang" value="${c.ambang}">`)}</div>
      <p class="muted small">Perubahan fee hanya berlaku untuk transaksi baru. Isi meterai 0 untuk mematikan.</p>` : ''}
      <h4 class="mini-h">Setup / strategi</h4>
      <div class="chips" data-setups>${setups().map(x => `<span class="chip on tj-chip">${U.esc(x)}<button type="button" data-hs="${U.esc(x)}" aria-label="Hapus ${U.esc(x)}">${I('x')}</button></span>`).join('')}</div>
      <div class="row-btns"><input name="baru" placeholder="Nama setup baru" maxlength="40"><button type="button" class="btn ghost" data-tambah>Tambah</button></div>
      <h4 class="mini-h">Lainnya</h4>
      <div class="list"><button type="button" class="row" data-a="harga">${I('pencil')}<div class="tx-txt"><b>Isi harga terakhir manual</b></div></button><button type="button" class="row" data-a="baru">${I('plus')}<div class="tx-txt"><b>Portofolio baru</b></div></button>
        <button type="button" class="row" data-a="tg">${I('send')}<div class="tx-txt"><b>Alert SL/TP via Telegram</b><small>${App.tgSiap && App.tgSiap() ? 'Aktif — dikirim saat harga diperbarui' : 'Hubungkan Telegram di Lainnya › Notifikasi'}</small></div></button></div>`,
      foot: `<button class="btn" data-ok>Simpan</button>` });
    let sts = setups();
    const drawS = () => { s.el.querySelector('[data-setups]').innerHTML = sts.map(x => `<span class="chip on tj-chip">${U.esc(x)}<button type="button" data-hs="${U.esc(x)}" aria-label="Hapus">${I('x')}</button></span>`).join(''); };
    s.el.addEventListener('click', e => { const h = e.target.closest('[data-hs]'); if (h) { sts = sts.filter(x => x !== h.dataset.hs); drawS(); } });
    s.el.querySelector('[data-tambah]').onclick = () => { const i = s.el.querySelector('[name=baru]'), v = i.value.trim(); if (v && sts.indexOf(v) < 0) { sts.push(v); drawS(); } i.value = ''; };
    const pf = s.el.querySelector('[name=pf]'); if (pf) pf.onchange = () => { s.close(); F.akun = pf.value; UI.acts['sh-set'](); };
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { s.close(); if (b.dataset.a === 'harga') hargaManual(); else if (b.dataset.a === 'baru') portofolioBaru(); else UI.go('pengaturan/notif'); });
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el);
      if (w) { const sa = setAkun(); sa[id] = { beli: Number(v.beli) || 0, jual: Number(v.jual) || 0, materai: Number(v.materai) || 0, ambang: Number(v.ambang) || 10000000 }; setJson('sahamAkun', sa); }
      setJson('sahamSetup', sts); s.close(); sinkronMaterai(); UI.toast('Pengaturan disimpan.');
    };
  });

  // ===== Pintasan keyboard (desktop): T trade, C cash flow, H sembunyikan, / cari =====
  document.addEventListener('keydown', e => {
    if (UI.cur !== 'saham' || document.querySelector('.sheet-wrap, .sheet.open') || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 't') { e.preventDefault(); UI.tradeForm(); } else if (k === 'c') { e.preventDefault(); cashForm(); }
    else if (k === 'h') { const b = document.querySelector('[data-act=toggle-hide]'); if (b) b.click(); }
    else if (e.key === '/') { e.preventDefault(); UI.go('saham/aktivitas'); setTimeout(() => { const i = document.querySelector('[data-input=sh-q]'); if (i) i.focus(); }, 80); }
  });
})();
