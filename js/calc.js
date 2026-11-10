/* ============================================================
 * Calc — semua hitungan keuangan (murni, dimemo per versi data)
 * ============================================================ */
(function () {
  const C = {};
  let memo = {}, memoVer = -1;
  function M(key, fn) {
    if (memoVer !== Store.ver) { memo = {}; memoVer = Store.ver; }
    if (!(key in memo)) memo[key] = fn();
    return memo[key];
  }
  C.clear = () => { memo = {}; };

  const NONEXP = { transfer: 1, tujuan: 1, tujuan_ambil: 1, pinjam_beri: 1, pinjam_kembali: 1, pinjam_terima: 1, penyesuaian: 1 };
  C.JENIS_LABEL = { keluar: 'Pengeluaran', masuk: 'Pemasukan', transfer: 'Transfer', tujuan: 'Setor Tujuan', tujuan_ambil: 'Ambil dari Tujuan',
    pinjam_beri: 'Beri Pinjaman', pinjam_kembali: 'Piutang Kembali', pinjam_terima: 'Terima Pinjaman', penyesuaian: 'Penyesuaian Saldo' };

  // ---------- Periode anggaran ----------
  C.startDay = () => U.clamp(Number(Store.setting('periodeMulai', 1)) || 1, 1, 28);
  C.period = (dateStr) => {
    const sd = C.startDay(), d = U.parseDate(dateStr || U.today());
    let y = d.getFullYear(), m = d.getMonth();
    if (d.getDate() < sd) { m--; if (m < 0) { m = 11; y--; } }
    const start = U.ymd(new Date(y, m, sd));
    const end = U.addDays(U.addMonths(start, 1), -1);
    return { start, end, key: start.slice(0, 7), label: sd === 1 ? U.tgl(start, 'my') : U.tgl(start, 'dm') + ' – ' + U.tgl(end) };
  };
  C.periodShift = (p, n) => C.period(U.addMonths(p.start, n));
  C.lastPeriods = (n, from) => { const out = []; let p = C.period(from); for (let i = 0; i < n; i++) { out.unshift(p); p = C.periodShift(p, -1); } return out; };

  // ---------- Transaksi ----------
  C.txSorted = () => M('txSorted', () => Store.t.Transaksi.slice().sort((a, b) => (b.tanggal > a.tanggal ? 1 : b.tanggal < a.tanggal ? -1 : (b.dibuat > a.dibuat ? 1 : -1))));
  C.txByPeriod = () => M('txByPeriod', () => {
    const m = {};
    const sd = C.startDay();
    // kunci periode langsung dari teks tanggal (cepat untuk puluhan ribu baris)
    const keyOf = s => { if (Number(s.slice(8, 10)) >= sd) return s.slice(0, 7); let y = Number(s.slice(0, 4)), mo = Number(s.slice(5, 7)) - 1; if (!mo) { mo = 12; y--; } return y + '-' + U.pad(mo); };
    Store.t.Transaksi.forEach(t => { if (!t.tanggal) return; const k = keyOf(t.tanggal); (m[k] = m[k] || []).push(t); });
    return m;
  });
  C.txIn = (p) => C.txByPeriod()[p.key] || [];
  C.isExpense = t => t.jenis === 'keluar';
  C.expAmount = t => t.jenis === 'keluar' ? t.jumlah : (t.jenis === 'transfer' ? t.biaya : 0);
  C.adminKatId = () => M('adminKat', () => { const k = Store.t.Kategori.find(x => /biaya admin/i.test(x.nama)); return k ? k.id : ''; });

  C.periodTotals = (p) => M('pt:' + p.key, () => {
    let masuk = 0, keluar = 0, tabung = 0;
    C.txIn(p).forEach(t => {
      if (t.jenis === 'masuk') masuk += t.jumlah;
      else keluar += C.expAmount(t);
      if (t.jenis === 'tujuan') tabung += t.jumlah;
      if (t.jenis === 'tujuan_ambil') tabung -= t.jumlah;
    });
    return { masuk, keluar, tabung, net: masuk - keluar };
  });

  // ---------- Saldo wallet ----------
  C.balances = () => M('bal', () => {
    const b = {};
    Store.t.Wallet.forEach(w => b[w.id] = w.saldoAwal || 0);
    const add = (id, v) => { if (id) b[id] = (b[id] || 0) + v; };
    Store.t.Transaksi.forEach(t => {
      const j = t.jumlah || 0;
      switch (t.jenis) {
        case 'keluar': add(t.walletId, -j); break;
        case 'masuk': add(t.walletId, j); break;
        case 'transfer': add(t.walletId, -(j + (t.biaya || 0))); add(t.walletTujuan, j); break;
        case 'tujuan': add(t.walletId, -j); add(t.walletTujuan, j); break;
        case 'tujuan_ambil': add(t.walletId, j); add(t.walletTujuan, -j); break;
        case 'pinjam_beri': add(t.walletId, -j); break;
        case 'pinjam_kembali': add(t.walletId, j); break;
        case 'pinjam_terima': add(t.walletId, j); break;
        case 'penyesuaian': add(t.walletId, j); break;
      }
    });
    return b;
  });
  C.liquidTotal = () => M('liq', () => { const b = C.balances(); return U.sum(Store.wallets().filter(w => w.likuid !== false), w => b[w.id]); });
  C.walletTotal = () => M('wtot', () => { const b = C.balances(); return U.sum(Store.wallets(), w => b[w.id]); });

  // ---------- Anggaran / amplop ----------
  function geser(p) { return Store.t.GeserDana.filter(g => g.periode === p.key); }
  C.envelopes = (p) => M('env:' + p.key, () => {
    p = p || C.period();
    const txs = C.txIn(p), prev = C.periodShift(p, -1), prevTx = C.txIn(prev);
    const used = {}, usedPrev = {}, adminId = C.adminKatId();
    txs.forEach(t => { const v = C.expAmount(t); if (!v) return; const k = t.jenis === 'transfer' ? adminId : t.kategoriId; used[k] = (used[k] || 0) + v; });
    prevTx.forEach(t => { const v = C.expAmount(t); if (!v) return; const k = t.jenis === 'transfer' ? adminId : t.kategoriId; usedPrev[k] = (usedPrev[k] || 0) + v; });
    const g = geser(p), gPrev = geser(prev);
    const flow = (list, id) => U.sum(list, x => (x.ke === id ? x.jumlah : 0) - (x.dari === id ? x.jumlah : 0));
    return Store.kategori('keluar').map(k => {
      const batas = k.batas || 0;
      const carry = k.bawaSisa && batas ? Math.max(0, batas + flow(gPrev, k.id) - (usedPrev[k.id] || 0)) : 0;
      const efektif = batas + carry + flow(g, k.id);
      const terpakai = used[k.id] || 0;
      const sisa = efektif - terpakai;
      const pct = efektif > 0 ? terpakai / efektif : (terpakai > 0 ? 1 : 0);
      const status = !efektif ? 'none' : pct >= 1 ? 'lewat' : pct >= 0.8 ? 'hampir' : 'aman';
      return { k, batas, carry, efektif, terpakai, sisa, pct, status };
    });
  });
  C.daysLeft = (p) => { p = p || C.period(); return Math.max(1, U.diffDays(U.today(), p.end) + 1); };
  C.dayIndex = (p) => { p = p || C.period(); return { now: U.diffDays(p.start, U.today()) + 1, total: U.diffDays(p.start, p.end) + 1 }; };

  /** Uang aman dibelanjakan per hari. */
  C.safeDaily = () => M('safe', () => {
    const p = C.period(), env = C.envelopes(p).filter(e => e.efektif > 0 && !e.k.tetap && !e.k.pribadi);
    const dl = C.daysLeft(p);
    if (env.length) {
      const sisa = U.sum(env, e => Math.max(0, e.sisa));
      return { perHari: sisa / dl, sisa, hari: dl, dasar: 'amplop', end: p.end };
    }
    // Tanpa amplop: pemasukan periode − pengeluaran − tagihan tersisa − rencana setoran
    const tot = C.periodTotals(p);
    const tagihan = U.sum(C.occurrences(U.today(), p.end).filter(o => !o.lunas && o.arah === 'keluar'), o => o.sisa);
    const sisa = Math.max(0, tot.masuk - tot.keluar - tot.tabung - tagihan);
    return { perHari: sisa / dl, sisa, hari: dl, dasar: 'arus', end: p.end };
  });

  C.unallocated = (p) => M('unalloc:' + (p ? p.key : ''), () => {
    p = p || C.period();
    const tot = C.periodTotals(p);
    let income = tot.masuk;
    if (!income) income = U.sum(Store.t.Rutin.filter(r => r.aktif !== false && r.jenis === 'masuk' && r.frekuensi === 'bulanan'), r => r.jumlah);
    const alloc = U.sum(C.envelopes(p), e => e.batas) + U.sum(C.goals().filter(g => !g.t.arsip), g => g.t.setoranBulanan || 0) + U.sum(C.sinking(), s => s.perBulan);
    return { income, alloc, sisa: income - alloc };
  });

  /** Tagihan tahunan yang dicicil per bulan (sinking fund). */
  C.sinking = () => M('sinking', () => Store.t.Rutin.filter(r => r.aktif !== false && r.jenis === 'keluar' && r.frekuensi === 'tahunan').map(r => {
    const next = C.nextYearly(r);
    const bulan = Math.max(1, Math.round(U.diffDays(U.today(), next) / 30.4));
    return { r, perBulan: r.jumlah / 12, next, bulanLagi: bulan, perluPerBulan: r.jumlah / bulan };
  }));
  C.nextYearly = r => {
    const t = U.today(), y = U.parseDate(t).getFullYear();
    for (let i = 0; i < 2; i++) {
      const m = r.bulan || 1, d = Math.min(r.tanggal || 1, U.daysInMonth(y + i, m));
      const s = (y + i) + '-' + U.pad(m) + '-' + U.pad(d);
      if (s >= t) return s;
    }
    return t;
  };

  // ---------- Jadwal (rutin, cicilan, acara) ----------
  C.paidIndex = () => M('paidIdx', () => {
    const m = {};
    Store.t.Transaksi.forEach(t => {
      if (!t.refId || !t.periodeRef) return;
      const k = t.refId + '|' + t.periodeRef;
      const o = m[k] || (m[k] = { total: 0, last: '' });
      o.total += t.jumlah; if (t.tanggal > o.last) o.last = t.tanggal;
    });
    return m;
  });
  C.loanCicilan = p => p.cicilan || C.loanCalc(p).cicilan;
  /** Semua kejadian jatuh tempo pada rentang [from, to]. */
  C.occurrences = (from, to) => M('occ:' + from + ':' + to, () => {
    const out = [], paid = C.paidIndex();
    const rutin = Store.t.Rutin.filter(r => r.aktif !== false);
    const loans = Store.t.Pinjaman.filter(p => !p.lunas && p.tanggalBayar && C.loanCicilan(p) > 0);
    let d = from;
    while (d <= to) {
      const dt = U.parseDate(d), day = dt.getDate(), mon = dt.getMonth() + 1, last = U.daysInMonth(dt.getFullYear(), mon);
      rutin.forEach(r => {
        if (Math.min(r.tanggal || 1, last) !== day) return;
        if (r.frekuensi === 'tahunan' && (r.bulan || 1) !== mon) return;
        if (r.mulai && d < r.mulai) return; if (r.selesai && d > r.selesai) return;
        const key = r.frekuensi === 'tahunan' ? d.slice(0, 4) : d.slice(0, 7);
        const pd = paid[r.id + '|' + key] || { total: 0 };
        out.push({ id: r.id + '|' + key, ref: r, refId: r.id, periodeRef: key, kind: 'rutin', nama: r.nama, tanggal: d, jumlah: r.jumlah,
          arah: r.jenis === 'masuk' ? 'masuk' : 'keluar', dibayar: pd.total, sisa: Math.max(0, r.jumlah - pd.total), lunas: pd.total >= r.jumlah * 0.999 && pd.total > 0, tglBayar: pd.last,
          kategoriId: r.kategoriId, walletId: r.walletId, langganan: r.langganan, frekuensi: r.frekuensi });
      });
      loans.forEach(p => {
        if (Math.min(p.tanggalBayar, last) !== day) return;
        if (p.mulai && d < p.mulai) return;
        if (p.tenor && p.mulai) { const n = monthsBetween(p.mulai, d); if (n >= p.tenor + 1) return; }
        const key = d.slice(0, 7), c = C.loanCicilan(p), pd = paid[p.id + '|' + key] || { total: 0 };
        out.push({ id: p.id + '|' + key, ref: p, refId: p.id, periodeRef: key, kind: 'pinjaman', nama: p.arah === 'piutang' ? 'Piutang: ' + p.pihak : (/^cicilan/i.test(p.pihak) ? p.pihak : 'Cicilan ' + p.pihak), tanggal: d, jumlah: c,
          arah: p.arah === 'piutang' ? 'masuk' : 'keluar', dibayar: pd.total, sisa: Math.max(0, c - pd.total), lunas: pd.total >= c * 0.999 && pd.total > 0, tglBayar: pd.last, walletId: p.walletId });
      });
      d = U.addDays(d, 1);
    }
    Store.t.Acara.forEach(a => {
      if (a.tanggal >= from && a.tanggal <= to) out.push({ id: 'a|' + a.id, ref: a, kind: 'acara', nama: a.nama, tanggal: a.tanggal, jumlah: a.estimasi || 0, arah: 'keluar', sisa: a.estimasi || 0, lunas: false, besar: a.besar });
    });
    C.goals().forEach(g => { if (g.t.tenggat >= from && g.t.tenggat <= to && !g.t.arsip) out.push({ id: 'g|' + g.t.id, ref: g.t, kind: 'tujuan', nama: 'Tenggat: ' + g.t.nama, tanggal: g.t.tenggat, jumlah: 0, arah: 'info', sisa: 0, lunas: g.pct >= 1 }); });
    out.sort((a, b) => a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0);
    return out;
  });
  function monthsBetween(a, b) { const A = U.parseDate(a), B = U.parseDate(b); return (B.getFullYear() - A.getFullYear()) * 12 + B.getMonth() - A.getMonth(); }
  C.monthsBetween = monthsBetween;

  /** Rata-rata pengeluaran harian di luar tagihan rutin/cicilan (90 hari terakhir). */
  C.variableDaily = () => M('vardaily', () => {
    const from = U.addDays(U.today(), -90);
    let s = 0;
    Store.t.Transaksi.forEach(t => { if (t.tanggal >= from && t.tanggal <= U.today() && t.jenis === 'keluar' && !t.refId) { const k = Store.byId.Kategori[t.kategoriId]; if (!k || !k.tetap) s += t.jumlah; } });
    const first = Store.t.Transaksi.reduce((m, t) => t.tanggal < m ? t.tanggal : m, U.today());
    const days = U.clamp(U.diffDays(first > from ? first : from, U.today()) + 1, 7, 90);
    return s / days;
  });

  /** Proyeksi saldo kas likuid harian. */
  C.projection = (days) => M('proj:' + days, () => {
    const today = U.today(), to = U.addDays(today, days);
    const occ = C.occurrences(today, to).filter(o => !o.lunas && (o.arah === 'masuk' || o.arah === 'keluar'));
    const byDay = U.groupBy(occ, o => o.tanggal);
    const vd = C.variableDaily();
    let bal = C.liquidTotal();
    const pts = [];
    let min = { bal: Infinity };
    for (let i = 0; i <= days; i++) {
      const d = U.addDays(today, i);
      let masuk = 0, keluar = 0;
      (byDay[d] || []).forEach(o => { if (o.arah === 'masuk') masuk += o.sisa; else keluar += o.sisa; });
      if (i > 0) keluar += vd;
      bal += masuk - keluar;
      const pt = { d, bal, masuk, keluar, items: byDay[d] || [] };
      pts.push(pt);
      if (bal < min.bal) min = pt;
    }
    // Peringatan: hari dengan tagihan besar saat saldo rendah
    const avgOut = (U.sum(C.lastPeriods(3), p => C.periodTotals(p).keluar) / 3) || 1;
    const batas = Math.max(avgOut * 0.1, 200000);
    const kritis = pts.find(p => p.items.some(o => o.arah === 'keluar') && p.bal < batas) || (min.bal < 0 ? min : null);
    return { pts, min, vd, kritis, batas };
  });

  /** Peta musim mahal 12 bulan ke depan. */
  C.heavyMonths = () => M('heavy', () => {
    const now = U.parseDate(U.today()), out = [];
    const rutin = Store.t.Rutin.filter(r => r.aktif !== false);
    const loans = Store.t.Pinjaman.filter(p => !p.lunas && p.arah !== 'piutang');
    const vMonth = C.variableDaily() * 30.4;
    const incAvg = (() => {
      const r = U.sum(rutin.filter(x => x.jenis === 'masuk' && x.frekuensi === 'bulanan'), x => x.jumlah);
      const h = U.sum(C.lastPeriods(3), p => C.periodTotals(p).masuk) / 3;
      return Math.max(r, h) || 1;
    })();
    for (let i = 0; i < 12; i++) {
      const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12), m = (now.getMonth() + i) % 12 + 1;
      const ym = y + '-' + U.pad(m);
      const items = [];
      let fixed = 0;
      rutin.forEach(r => {
        if (r.jenis !== 'keluar') return;
        if (r.frekuensi === 'tahunan') { if ((r.bulan || 1) === m) { fixed += r.jumlah; items.push(r.nama); } }
        else fixed += r.jumlah;
      });
      loans.forEach(p => { const c = C.loanCicilan(p); if (!p.mulai || !p.tenor || monthsBetween(p.mulai, ym + '-28') <= p.tenor) fixed += c; });
      Store.t.Acara.forEach(a => { if (a.tanggal && a.tanggal.slice(0, 7) === ym) { fixed += a.estimasi || 0; items.push(a.nama); } });
      // Penanda musiman (perkiraan): Ramadan/Lebaran dari kalender Hijriah, tahun ajaran baru Juli
      const hp = U.hijriParts(ym + '-15');
      if (hp && (hp.m === 9 || hp.m === 10)) items.push(hp.m === 9 ? 'Ramadan' : 'Idul Fitri');
      if (m === 7) items.push('Tahun ajaran baru');
      const total = fixed + vMonth, ratio = total / incAvg;
      out.push({ ym, label: U.BLN[m - 1] + ' ' + String(y).slice(2), total, ratio, items, level: ratio >= 1 ? 'puncak' : ratio >= 0.85 ? 'sedang' : 'aman' });
    }
    return { months: out, incAvg };
  });

  C.subscriptions = () => M('subs', () => {
    const p = C.period();
    const occ = C.occurrences(U.addDays(U.today(), -31), U.addDays(U.today(), 366));
    return Store.t.Rutin.filter(r => r.jenis === 'keluar').map(r => {
      const mine = occ.filter(o => o.refId === r.id);
      const cur = mine.find(o => o.tanggal >= p.start && o.tanggal <= p.end) || mine.find(o => !o.lunas) || mine[0];
      const perBulan = r.frekuensi === 'tahunan' ? r.jumlah / 12 : r.jumlah;
      const perluTinjau = r.langganan && r.aktif !== false && (!r.ditinjau || U.diffDays(r.ditinjau, U.today()) > 90);
      let status = 'belum';
      if (cur && cur.lunas) status = 'lunas';
      else if (cur && cur.tanggal < U.today()) status = 'terlambat';
      return { r, cur, perBulan, perluTinjau, status };
    }).sort((a, b) => (a.cur ? a.cur.tanggal : 'z').localeCompare(b.cur ? b.cur.tanggal : 'z'));
  });

  /** Persentase tagihan dibayar tepat waktu (6 bulan). */
  C.onTimeRate = () => M('ontime', () => {
    const occ = C.occurrences(U.addMonths(U.today(), -6), U.today()).filter(o => (o.kind === 'rutin' || o.kind === 'pinjaman') && o.arah === 'keluar');
    if (!occ.length) return null;
    const ok = occ.filter(o => o.lunas && o.tglBayar && o.tglBayar <= o.tanggal).length;
    return { rate: ok / occ.length, ok, total: occ.length };
  });

  // ---------- Tujuan ----------
  C.goals = () => M('goals', () => {
    const sums = {}, logs = {};
    Store.t.Transaksi.forEach(t => {
      if ((t.jenis !== 'tujuan' && t.jenis !== 'tujuan_ambil') || !t.refId) return;
      const v = t.jenis === 'tujuan' ? t.jumlah : -t.jumlah;
      sums[t.refId] = (sums[t.refId] || 0) + v;
      (logs[t.refId] = logs[t.refId] || []).push(t);
    });
    return Store.t.Tujuan.map(g => {
      const saldo = sums[g.id] || 0, target = g.target || 0;
      const pct = target > 0 ? saldo / target : 0;
      const sisa = Math.max(0, target - saldo);
      const log = (logs[g.id] || []).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      const bulanLagi = g.tenggat ? Math.max(1, monthsBetween(U.today(), g.tenggat) + (U.parseDate(g.tenggat).getDate() >= U.parseDate(U.today()).getDate() ? 0 : 0)) : 0;
      const perluPerBulan = g.tenggat ? sisa / Math.max(1, bulanLagi) : 0;
      // laju aktual 3 bulan terakhir
      const from = U.addMonths(U.today(), -3);
      const laju = U.sum(log.filter(t => t.tanggal >= from), t => t.jenis === 'tujuan' ? t.jumlah : -t.jumlah) / 3;
      const per = g.setoranBulanan || laju;
      const estimasi = sisa <= 0 ? U.today() : per > 0 ? U.addMonths(U.today(), Math.ceil(sisa / per)) : '';
      return { t: g, saldo, target, pct, sisa, log, perluPerBulan, laju, estimasi, bulanLagi };
    }).sort((a, b) => (a.t.prioritas || 99) - (b.t.prioritas || 99));
  });
  C.goal = id => C.goals().find(g => g.t.id === id);
  /** Checklist setoran: 6 bulan terakhir × anggota */
  C.goalChecklist = (g, months) => {
    months = months || 6;
    const out = [], members = Store.members().filter(m => m.peran !== 'anggota' || g.log.some(t => t.dicatatOleh === m.email));
    for (let i = months - 1; i >= 0; i--) {
      const ym = U.addMonths(U.today(), -i).slice(0, 7);
      const row = { ym, label: U.BLN_L[Number(ym.slice(5)) - 1], cells: [] };
      members.forEach(m => {
        const v = U.sum(g.log.filter(t => t.jenis === 'tujuan' && t.tanggal.slice(0, 7) === ym && (t.dibayarOleh || t.dicatatOleh) === m.email), t => t.jumlah);
        row.cells.push({ m, v });
      });
      out.push(row);
    }
    return { rows: out, members };
  };

  // ---------- Pinjaman ----------
  C.loanCalc = (p) => {
    const n = Math.max(1, p.tenor || 1), P = p.pokok || 0, r = (p.bunga || 0) / 1200;
    let cicilan, total;
    if (p.metode === 'anuitas' && r > 0) { cicilan = P * r / (1 - Math.pow(1 + r, -n)); total = cicilan * n; }
    else if (p.metode === 'flat') { cicilan = P / n + P * r; total = cicilan * n; }
    else { cicilan = P / n; total = P; }
    return { cicilan, total, bunga: total - P };
  };
  C.amortization = (P, bungaPa, n, metode) => {
    const r = bungaPa / 1200, rows = [];
    let sisa = P;
    const c = metode === 'anuitas' && r > 0 ? P * r / (1 - Math.pow(1 + r, -n)) : P / n + P * r;
    for (let i = 1; i <= n; i++) {
      const bunga = metode === 'anuitas' ? sisa * r : P * r;
      const pokok = c - bunga;
      sisa = Math.max(0, sisa - pokok);
      rows.push({ i, cicilan: c, pokok, bunga, sisa });
    }
    return { cicilan: c, rows, totalBunga: U.sum(rows, x => x.bunga) };
  };
  C.loans = () => M('loans', () => {
    const paid = {};
    Store.t.Transaksi.forEach(t => {
      if (!t.refId) return;
      if (t.jenis === 'keluar' || t.jenis === 'pinjam_kembali') paid[t.refId] = (paid[t.refId] || 0) + t.jumlah;
    });
    return Store.t.Pinjaman.map(p => {
      const calc = C.loanCalc(p);
      const cicilan = p.cicilan || calc.cicilan;
      const total = p.metode === 'tanpa' || !p.metode ? p.pokok : (p.cicilan ? p.cicilan * (p.tenor || 1) : calc.total);
      const terbayar = paid[p.id] || 0;
      const sisa = Math.max(0, total - terbayar);
      const pct = total ? terbayar / total : 0;
      const ke = p.mulai ? U.clamp(monthsBetween(p.mulai, U.today()) + 1, 0, p.tenor || 999) : 0;
      const selesai = p.mulai && p.tenor ? U.addMonths(p.mulai, p.tenor - 1) : '';
      const next = C.occurrences(U.today(), U.addDays(U.today(), 62)).find(o => o.refId === p.id && !o.lunas);
      return { p, cicilan, total, terbayar, sisa, pct, ke, selesai, next, lunas: p.lunas || (total > 0 && sisa <= 0) };
    });
  });
  C.incomeAvg = () => M('incAvg', () => {
    const r = U.sum(Store.t.Rutin.filter(x => x.aktif !== false && x.jenis === 'masuk' && x.frekuensi === 'bulanan'), x => x.jumlah);
    const h = U.sum(C.lastPeriods(3), p => C.periodTotals(p).masuk) / 3;
    return Math.max(r, h);
  });
  C.dsr = () => M('dsr', () => {
    const cicilan = U.sum(C.loans().filter(l => !l.lunas && l.p.arah !== 'piutang' && l.p.tanggalBayar), l => l.cicilan);
    const inc = C.incomeAvg();
    return { cicilan, inc, ratio: inc ? cicilan / inc : 0 };
  });
  /** Simulasi pelunasan (snowball/avalanche) dengan tambahan setoran. */
  C.payoff = (strategy, extra) => {
    const debts = C.loans().filter(l => !l.lunas && l.p.arah !== 'piutang' && l.sisa > 0).map(l => ({ id: l.p.id, nama: l.p.pihak, jenis: l.p.jenis, sisa: l.sisa, min: l.cicilan || l.sisa, bunga: l.p.bunga || 0, selesai: '' }));
    if (!debts.length) return { order: [], months: 0, end: '', interest: 0 };
    const order = debts.slice().sort((a, b) => strategy === 'avalanche' ? (b.bunga - a.bunga || a.sisa - b.sisa) : (a.sisa - b.sisa || b.bunga - a.bunga));
    let month = 0, interest = 0, free = 0;
    while (order.some(d => d.sisa > 0.5) && month < 600) {
      month++;
      let pool = extra + free;
      order.forEach(d => {
        if (d.sisa <= 0.5) return;
        const bunga = d.sisa * d.bunga / 1200; interest += bunga; d.sisa += bunga;
        const pay = Math.min(d.sisa, d.min); d.sisa -= pay;
      });
      for (const d of order) { if (d.sisa <= 0.5 || pool <= 0) continue; const pay = Math.min(d.sisa, pool); d.sisa -= pay; pool -= pay; }
      order.forEach(d => { if (d.sisa <= 0.5 && !d.selesai) { d.selesai = U.addMonths(U.today(), month); free += d.min; } });
    }
    return { order, months: month, end: U.addMonths(U.today(), month), interest };
  };

  // ---------- Rapor ----------
  C.series = (n) => M('series:' + n, () => C.lastPeriods(n).map(p => Object.assign({ p }, C.periodTotals(p))));
  C.breakdown = (p, by) => M('bd:' + p.key + ':' + by, () => {
    const m = {};
    C.txIn(p).forEach(t => {
      const v = C.expAmount(t); if (!v) return;
      let k;
      if (by === 'kategori') k = t.jenis === 'transfer' ? C.adminKatId() : t.kategoriId;
      else if (by === 'anggota') k = t.dibayarOleh || t.dicatatOleh;
      else if (by === 'wallet') k = t.walletId;
      else k = t.tag || '(tanpa tag)';
      m[k] = (m[k] || 0) + v;
    });
    const total = U.sum(Object.values(m));
    return Object.keys(m).map(k => ({ k, v: m[k], pct: total ? m[k] / total : 0, label: labelFor(by, k) })).sort((a, b) => b.v - a.v);
  });
  function labelFor(by, k) {
    if (by === 'kategori') { const c = Store.byId.Kategori[k]; return c ? c.nama : 'Tanpa kategori'; }
    if (by === 'anggota') return Store.memberName(k);
    if (by === 'wallet') { const w = Store.byId.Wallet[k]; return w ? w.nama : '-'; }
    return k;
  }
  C.compare = (p) => M('cmp:' + p.key, () => {
    const prev = C.periodShift(p, -1), prev3 = [1, 2, 3].map(i => C.periodShift(p, -i));
    const cur = C.breakdown(p, 'kategori'), map = {};
    cur.forEach(x => map[x.k] = { k: x.k, label: x.label, cur: x.v, prev: 0, avg: 0 });
    C.breakdown(prev, 'kategori').forEach(x => { (map[x.k] = map[x.k] || { k: x.k, label: x.label, cur: 0, prev: 0, avg: 0 }).prev = x.v; });
    prev3.forEach(pp => C.breakdown(pp, 'kategori').forEach(x => { (map[x.k] = map[x.k] || { k: x.k, label: x.label, cur: 0, prev: 0, avg: 0 }).avg += x.v / 3; }));
    const rows = Object.values(map).map(r => Object.assign(r, { delta: r.cur - r.avg, deltaPct: r.avg ? (r.cur - r.avg) / r.avg : (r.cur ? 1 : 0) }));
    const tot = C.periodTotals(p), totPrev = C.periodTotals(prev);
    const avgOut = U.sum(prev3, x => C.periodTotals(x).keluar) / 3;
    return { rows, naik: rows.filter(r => r.delta > 0 && r.avg > 0).sort((a, b) => b.deltaPct - a.deltaPct).slice(0, 3),
             turun: rows.filter(r => r.delta < 0).sort((a, b) => a.deltaPct - b.deltaPct).slice(0, 3), tot, totPrev, avgOut };
  });
  C.ratios = (p) => {
    const t = C.periodTotals(p), dsr = C.dsr();
    const bk = C.breakdown(p, 'kategori');
    let butuh = 0, ingin = 0;
    bk.forEach(x => { const k = Store.byId.Kategori[x.k]; if (k && k.kelompok === 'keinginan') ingin += x.v; else butuh += x.v; });
    const ef = C.emergency();
    return { tabungan: t.masuk ? (t.masuk - t.keluar) / t.masuk : 0, butuh: t.masuk ? butuh / t.masuk : 0, ingin: t.masuk ? ingin / t.masuk : 0, dsr: dsr.ratio, likuidBulan: ef.bulan };
  };
  C.emergency = () => M('emerg', () => {
    const avgOut = U.sum(C.lastPeriods(3), p => C.periodTotals(p).keluar) / 3;
    const liq = C.liquidTotal() + U.sum(C.goals().filter(g => /darurat/i.test(g.t.nama) && !g.t.walletId), g => g.saldo);
    return { avgOut, liq, bulan: avgOut ? liq / avgOut : 0, target: Number(Store.setting('danaDaruratBulan', 6)) || 6 };
  });
  /** Skor kesehatan sederhana 0–100 (5 komponen × 20). */
  C.score = () => M('score', () => {
    const p = C.periodShift(C.period(), -1), r = C.ratios(p), ef = C.emergency(), ot = C.onTimeRate();
    const env = C.envelopes(p).filter(e => e.efektif > 0);
    const comp = [
      { nama: 'Ketahanan dana darurat', v: U.clamp(ef.bulan / ef.target, 0, 1) * 20, info: U.fmtNum(ef.bulan * 10 / 10) + ' dari ' + ef.target + ' bulan' },
      { nama: 'Rasio beban cicilan', v: (r.dsr <= 0.3 ? 1 : r.dsr >= 0.5 ? 0 : (0.5 - r.dsr) / 0.2) * 20, info: U.pct(r.dsr, 1) + ' dari pemasukan' },
      { nama: 'Persentase tabungan', v: U.clamp(r.tabungan / 0.2, 0, 1) * 20, info: U.pct(Math.max(0, r.tabungan), 1) + ' dari pemasukan' },
      { nama: 'Kepatuhan anggaran', v: env.length ? env.filter(e => e.pct <= 1).length / env.length * 20 : 10, info: env.length ? env.filter(e => e.pct > 1).length + ' amplop melebihi batas' : 'Belum ada amplop' },
      { nama: 'Bayar tepat waktu', v: ot ? ot.rate * 20 : 15, info: ot ? U.pct(ot.rate) + ' tepat waktu' : 'Belum ada data' }
    ];
    return { total: Math.round(U.sum(comp, c => c.v)), comp };
  });

  // ---------- Kekayaan ----------
  C.netWorth = () => M('nw', () => {
    const kas = C.walletTotal();
    const danaTujuan = U.sum(C.goals().filter(g => !g.t.walletId), g => g.saldo);
    const loans = C.loans().filter(l => !l.lunas);
    const utang = U.sum(loans.filter(l => l.p.arah !== 'piutang'), l => l.sisa);
    const piutang = U.sum(loans.filter(l => l.p.arah === 'piutang'), l => l.sisa);
    return { kas, danaTujuan, utang, piutang, aset: kas + danaTujuan + piutang, bersih: kas + danaTujuan + piutang - utang };
  });

  // ---------- Kategori pintar ----------
  C.smartCategories = (jenis) => M('smart:' + jenis + ':' + new Date().getHours(), () => {
    const h = new Date().getHours(), score = {};
    const recent = C.txSorted().slice(0, 600);
    recent.forEach(t => {
      if (t.jenis !== jenis || !t.kategoriId) return;
      const th = t.dibuat ? new Date(t.dibuat).getHours() : 12;
      const w = Math.abs(th - h) <= 2 ? 3 : 1;
      score[t.kategoriId] = (score[t.kategoriId] || 0) + w;
    });
    return Store.kategori(jenis).slice().sort((a, b) => (score[b.id] || 0) - (score[a.id] || 0) || a.urutan - b.urutan);
  });

  window.Calc = C;
})();
