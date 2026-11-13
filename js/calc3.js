/* ============================================================
 * Calc Fase 3 — Simulasi Keputusan Besar, Kilas Balik, Rapat Keuangan
 * (dimuat setelah calc.js & calc2.js)
 * ============================================================ */
(function () {
  const C = window.Calc, M = C.M;

  /** Skor kesehatan untuk periode tertentu (dipakai Rapat: perubahan skor). */
  C.scoreFor = (p) => M('scoreFor:' + p.key, () => {
    const r = C.ratios(p), ef = C.emergency(), ot = C.onTimeRate();
    const env = C.envelopes(p).filter(e => e.efektif > 0);
    const v = [
      U.clamp(ef.bulan / ef.target, 0, 1) * 20,
      (r.dsr <= 0.3 ? 1 : r.dsr >= 0.5 ? 0 : (0.5 - r.dsr) / 0.2) * 20,
      U.clamp(r.tabungan / 0.2, 0, 1) * 20,
      env.length ? env.filter(e => e.pct <= 1).length / env.length * 20 : 10,
      ot ? ot.rate * 20 : 15
    ];
    return Math.round(U.sum(v));
  });

  // ---------- Simulasi Keputusan Besar ----------
  C.SIM_JENIS = {
    cicilan: { label: 'Cicilan baru', icon: 'landmark', contoh: 'KPR, kredit motor/mobil, gadget' },
    sekali: { label: 'Pengeluaran besar', icon: 'shopping-bag', contoh: 'renovasi, umrah, DP rumah' },
    pemasukan: { label: 'Perubahan pemasukan', icon: 'trending-up', contoh: 'naik gaji, resign, usaha sampingan' }
  };
  /** Dasar perhitungan (bulanan) yang dipakai semua skenario. */
  C.simBase = () => M('simBase', () => {
    const inc = C.incomeAvg(), ef = C.emergency(), out = ef.avgOut, dsr = C.dsr();
    const goals = C.goals().filter(g => !g.t.arsip && g.sisa > 0).map(g => ({ g, per: g.t.setoranBulanan || Math.max(0, g.laju) }));
    const setoran = U.sum(goals, x => x.per);
    return { inc, out, cicilan: dsr.cicilan, kas: C.liquidTotal(), setoran, goals, surplus: inc - out, safe: C.safeDaily(), score: C.score(), ef };
  });
  /**
   * s = { jenis: 'cicilan'|'sekali'|'pemasukan', jumlah, tenor, mulai (yyyy-mm-dd), sumber: 'kas' | 'g:<tujuanId>', dp }
   * Hasil: uang aman/hari, rasio cicilan, skor, proyeksi 12 bulan (dasar vs skenario), Tujuan yang mundur.
   */
  C.simulasi = (s) => {
    const b = C.simBase(), j = Number(s.jumlah) || 0, mulai = s.mulai || U.today();
    const startIdx = Math.max(0, C.monthsBetween(U.today().slice(0, 7) + '-01', mulai.slice(0, 7) + '-01'));
    const tenor = Number(s.tenor) || 0, dp = Number(s.dp) || 0;
    const cic = s.jenis === 'cicilan' ? j : 0, dInc = s.jenis === 'pemasukan' ? j : 0;
    const sekali = s.jenis === 'sekali' ? j : (s.jenis === 'cicilan' ? dp : 0);
    const dariTujuan = /^g:/.test(s.sumber || '') ? s.sumber.slice(2) : '';
    const inc2 = b.inc + dInc, out2 = b.out + cic;
    // proyeksi 12 bulan saldo kas likuid: kas + (pemasukan − pengeluaran − setoran Tujuan) per bulan
    const base = [], sim = [];
    let k0 = b.kas, k1 = b.kas;
    for (let i = 0; i <= 12; i++) {
      const d = U.addMonths(U.today(), i);
      if (i > 0) {
        k0 += b.inc - b.out - b.setoran;
        const s0 = Math.max(1, startIdx), aktif = i >= s0;                 // perubahan mulai bulan ke-s0
        const cicAktif = cic && aktif && (!tenor || i < s0 + tenor);
        k1 += (aktif ? inc2 : b.inc) - b.out - (cicAktif ? cic : 0) - b.setoran;
      }
      if (i === Math.max(0, startIdx) && sekali && !dariTujuan) k1 -= sekali;
      base.push({ d, bal: k0 }); sim.push({ d, bal: k1 });
    }
    // rasio cicilan & uang aman per hari
    const dsr = inc2 > 0 ? (b.cicilan + cic) / inc2 : 1;
    const perHari = Math.max(0, b.safe.perHari - (cic - dInc) / 30.4);
    // skor (perkiraan): 3 komponen dihitung ulang dengan rumus yang sama untuk kondisi sekarang & sesudah keputusan
    const kasSetelah = b.kas - (dariTujuan ? 0 : sekali);
    const skor = (kas, inc, out, cicTot) => {
      const comp = b.score.comp.map(c => c.v), ef = out > 0 ? Math.max(0, kas) / out : 0, d = inc > 0 ? cicTot / inc : 1, tb = inc > 0 ? (inc - out) / inc : 0;
      comp[0] = U.clamp(ef / b.ef.target, 0, 1) * 20; comp[1] = (d <= 0.3 ? 1 : d >= 0.5 ? 0 : (0.5 - d) / 0.2) * 20; comp[2] = U.clamp(tb / 0.2, 0, 1) * 20;
      return { v: Math.round(U.sum(comp)), ef };
    };
    const s0 = skor(b.kas, b.inc, b.out, b.cicilan), s1 = skor(kasSetelah, inc2, out2, b.cicilan + cic);
    const score = s1.v, efBulan = s1.ef;
    // Tujuan yang mundur
    const F0 = b.inc - b.out, F1 = inc2 - out2, P = b.setoran;
    const f0 = P > 0 ? U.clamp(F0 / P, 0, 1) : 1, f1 = P > 0 ? U.clamp(F1 / P, 0, 1) : 1;
    const goals = b.goals.filter(x => x.per > 0 || x.g.t.id === dariTujuan).map(x => {
      const sisa1 = x.g.sisa + (x.g.t.id === dariTujuan ? sekali : 0);
      const m0 = x.per && f0 ? Math.ceil(x.g.sisa / (x.per * f0)) : Infinity;
      const m1 = x.per && f1 ? Math.ceil(sisa1 / (x.per * f1)) : Infinity;
      return { g: x.g, per: x.per, m0, m1, mundur: m1 === Infinity ? Infinity : m0 === Infinity ? 0 : m1 - m0,
        est0: m0 === Infinity ? '' : U.addMonths(U.today(), m0), est1: m1 === Infinity ? '' : U.addMonths(U.today(), m1) };
    }).filter(x => x.mundur !== 0).sort((a, b2) => (b2.mundur === Infinity ? 999 : b2.mundur) - (a.mundur === Infinity ? 999 : a.mundur));
    const minSim = sim.reduce((m, p) => p.bal < m.bal ? p : m, sim[0]);
    const peringatan = [];
    if (dsr > 0.35) peringatan.push('Rasio cicilan ' + U.pct(dsr, 1) + ' — di atas batas sehat 30–35% pemasukan.');
    if (minSim.bal < 0) peringatan.push('Saldo kas diperkirakan minus pada ' + U.tgl(minSim.d, 'my') + '.');
    else if (out2 > 0 && minSim.bal < out2) peringatan.push('Saldo kas sempat di bawah 1 bulan pengeluaran (' + U.tgl(minSim.d, 'my') + ').');
    if (efBulan < 3 && sekali && !dariTujuan) peringatan.push('Dana darurat turun menjadi ' + U.fmtNum(Math.round(efBulan * 10) / 10) + ' bulan pengeluaran.');
    if (F1 < 0) peringatan.push('Pengeluaran bulanan melebihi pemasukan sebesar ' + U.rp(-F1) + '.');
    return { b, perHari, perHari0: b.safe.perHari, dsr, dsr0: b.inc ? b.cicilan / b.inc : 0, score, score0: s0.v, efBulan, efBulan0: s0.ef,
      base, sim, goals, peringatan, surplus1: F1, surplus0: F0, kasSetelah };
  };
  C.skenario = () => (Store.t.Skenario || []).slice().sort((a, b) => String(b.dibuat).localeCompare(String(a.dibuat)));

  // ---------- Kilas Balik Keuangan Tahunan ----------
  C.kilas = (tahun) => M('kilas:' + tahun, () => {
    const y = String(tahun), tx = Store.t.Transaksi.filter(t => t.tanggal && t.tanggal.slice(0, 4) === y);
    let masuk = 0, keluar = 0, tabung = 0;
    const perKat = {}, perBulan = {}, perOrang = {}, perHari = [0, 0, 0, 0, 0, 0, 0];
    let terbesar = null;
    tx.forEach(t => {
      if (t.jenis === 'masuk') masuk += t.jumlah;
      const e = C.expAmount(t);
      if (e) {
        keluar += e;
        C.expSplit(t).forEach(([k, x]) => { perKat[k] = (perKat[k] || 0) + x; });
        const ym = t.tanggal.slice(0, 7); perBulan[ym] = (perBulan[ym] || 0) + e;
        perHari[U.parseDate(t.tanggal).getDay()] += e;
        if (t.jenis === 'keluar' && (!terbesar || t.jumlah > terbesar.jumlah)) terbesar = t;
      }
      if (t.jenis === 'tujuan') tabung += t.jumlah;
      if (t.jenis === 'tujuan_ambil') tabung -= t.jumlah;
      const o = t.dicatatOleh || ''; if (o) perOrang[o] = (perOrang[o] || 0) + 1;
    });
    const kat = Object.keys(perKat).map(k => ({ k, v: perKat[k], nama: (Store.byId.Kategori[k] || {}).nama || 'Lainnya', ikon: (Store.byId.Kategori[k] || {}).ikon || 'circle' }))
      .sort((a, b) => b.v - a.v);
    // tahun sebelumnya untuk pembanding
    const prevKat = {};
    Store.t.Transaksi.forEach(t => { if (t.tanggal && t.tanggal.slice(0, 4) === String(tahun - 1)) { C.expSplit(t).forEach(([k, x]) => { prevKat[k] = (prevKat[k] || 0) + x; }); } });
    const hemat = kat.filter(x => prevKat[x.k] && x.v < prevKat[x.k]).map(x => Object.assign({}, x, { prev: prevKat[x.k], turun: prevKat[x.k] - x.v }))
      .concat(Object.keys(prevKat).filter(k => !perKat[k]).map(k => ({ k, v: 0, prev: prevKat[k], turun: prevKat[k], nama: (Store.byId.Kategori[k] || {}).nama || 'Lainnya' })))
      .sort((a, b) => b.turun - a.turun).slice(0, 3);
    const bulanBoros = Object.keys(perBulan).sort((a, b) => perBulan[b] - perBulan[a])[0] || '';
    const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIdx = perHari.indexOf(Math.max.apply(null, perHari));
    // Tujuan tercapai tahun ini: saldo ≥ target dan setoran terakhir di tahun itu
    const tercapai = C.goals().filter(g => g.target > 0 && g.pct >= 1 && g.log.length && g.log[0].tanggal.slice(0, 4) === y);
    // Emas
    const lots = C.emasLots ? C.emasLots(true) : [];
    const gramBeli = U.sum(lots.filter(l => l.e.tanggal && l.e.tanggal.slice(0, 4) === y), l => l.gram);
    const gramJual = U.sum(lots.filter(l => l.e.status === 'terjual' && l.e.tglJual && l.e.tglJual.slice(0, 4) === y), l => l.gram);
    // Kekayaan bersih (nilai perolehan, sama dengan Ringkasan SPT)
    let nw = null;
    if (C.spt) { const a = C.spt(tahun), p = C.spt(tahun - 1); nw = { akhir: a.totalHarta - a.totalUtang, awal: p.totalHarta - p.totalUtang }; nw.naik = nw.akhir - nw.awal; }
    const zakat = U.sum(tx.filter(t => t.jenis === 'keluar' && /^(zakat|qurban|sedekah|infak|donasi|wakaf)/.test(t.tag || '')), t => t.jumlah);
    const orangTop = Object.keys(perOrang).sort((a, b) => perOrang[b] - perOrang[a])[0] || '';
    return { tahun, jumlahTx: tx.length, masuk, keluar, tabung, sisa: masuk - keluar, kat, hemat, perBulan, bulanBoros, hari: HARI[hariIdx], hariV: perHari[hariIdx],
      terbesar, tercapai, gramBeli, gramJual, nw, zakat, perOrang, orangTop, adaData: tx.length > 0 };
  });

  // ---------- Rapat Keuangan ----------
  C.rapatHari = () => U.clamp(Number(Store.setting('rapatTanggal', 1)) || 1, 1, 28);
  C.rapatList = () => (Store.t.Rapat || []).slice().sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  C.tugasList = (semua) => (Store.t.Tugas || []).filter(t => semua || !t.selesai).sort((a, b) => String(a.tenggat || '9').localeCompare(String(b.tenggat || '9')));
  /** Jadwal rapat rutin dalam rentang (untuk Kalender). Bulan yang sudah ada rapatnya ditandai selesai. */
  C.rapatJadwal = (from, to) => {
    const out = [], day = C.rapatHari(), done = {};
    C.rapatList().forEach(r => { if (r.tanggal) done[r.tanggal.slice(0, 7)] = r; });
    let ym = from.slice(0, 7);
    while (ym <= to.slice(0, 7)) {
      const d = ym + '-' + U.pad(day), des = ym.slice(5) === '12';
      if (d >= from && d <= to) out.push({ id: 'r|' + ym, kind: 'rapat', nama: des ? 'Rapat keuangan tahunan' : 'Rapat keuangan keluarga', tanggal: d, jumlah: 0, arah: 'info', sisa: 0, lunas: !!done[ym], tglBayar: done[ym] ? done[ym].tanggal : '' });
      ym = U.addMonths(ym + '-01', 1).slice(0, 7);
    }
    return out;
  };
  /** Rapat berikutnya + jumlah bulan berturut-turut rapat rutin terjaga. */
  C.rapatStatus = () => {
    const list = C.rapatList(), months = {};
    list.forEach(r => { if (r.tanggal) months[r.tanggal.slice(0, 7)] = 1; });
    const now = U.today().slice(0, 7), sudahBulanIni = !!months[now];
    let next = now + '-' + U.pad(C.rapatHari());
    if (sudahBulanIni || next < U.today()) next = U.addMonths(now + '-01', 1).slice(0, 7) + '-' + U.pad(C.rapatHari());
    if (!sudahBulanIni && U.today() > now + '-' + U.pad(C.rapatHari())) next = U.today();   // terlewat → hari ini
    let streak = 0, ym = sudahBulanIni ? now : U.addMonths(now + '-01', -1).slice(0, 7);
    while (months[ym]) { streak++; ym = U.addMonths(ym + '-01', -1).slice(0, 7); }
    return { next, sisa: U.diffDays(U.today(), next), sudahBulanIni, streak, terakhir: list[0] || null, tahunan: next.slice(5, 7) === '12' };
  };
  /** Bahan agenda otomatis dari data (M-02). */
  C.rapatAgenda = () => {
    const cur = C.period(), p = C.periodShift(cur, -1), pp = C.periodShift(cur, -2);
    const tot = C.periodTotals(p), totPrev = C.periodTotals(pp);
    const meleset = C.envelopes(p).filter(e => e.efektif > 0 && e.pct > 1).sort((a, b) => (b.terpakai - b.efektif) - (a.terpakai - a.efektif));
    const heavy = C.heavyMonths().months.slice(0, 3);
    const occ3 = C.occurrences(U.today(), U.addMonths(U.today(), 3)).filter(o => o.arah === 'keluar' && !o.lunas && (o.kind === 'acara' || (o.ref && o.ref.frekuensi === 'tahunan') || o.jumlah >= Math.max(1000000, (tot.keluar || 0) * 0.1)));
    const goals = C.goals().filter(g => !g.t.arsip).map(g => {
      const ym = p.start.slice(0, 7);
      const setor = {}; g.log.filter(t => t.jenis === 'tujuan' && t.tanggal >= p.start && t.tanggal <= p.end).forEach(t => { const o = t.dibayarOleh || t.dicatatOleh; setor[o] = (setor[o] || 0) + t.jumlah; });
      return { g, setor, ym };
    });
    const pay = C.payoff('avalanche', 0);
    const nw = C.netWorth(), emas = C.emasSummary ? C.emasSummary() : null;
    return { p, pp, tot, totPrev, skor: C.scoreFor(p), skorPrev: C.scoreFor(pp), meleset, heavy, occ3, goals, pay, nw, emas,
      tugas: C.tugasList(), skenario: C.skenario().slice(0, 3), status: C.rapatStatus() };
  };
})();
