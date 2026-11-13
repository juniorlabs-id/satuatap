/* ============================================================
 * Calc Fase 2 — harga emas, Brankas Emas, investasi, kekayaan per
 * kelas, tujuan terhubung aset, zakat, target alokasi, ringkasan SPT.
 * ============================================================ */
(function () {
  const C = Calc, M = C.M;
  const HAUL_HARI = 354;                       // 1 tahun Hijriah

  // ---------- Harga emas ----------
  const Harga = { data: null, loading: null };
  try { Harga.data = JSON.parse(localStorage.getItem('sa:emas') || 'null'); } catch (e) {}
  function demoHarga() {
    const out = [], base = 2480000; let v = base;
    for (let i = 119; i >= 0; i--) { v = Math.round((v + (Math.sin(i / 9) * 9000) + 1500) / 1000) * 1000; out.push([U.addDays(U.today(), -i), v, Math.round(v * 0.918 / 1000) * 1000]); }
    const l = out[out.length - 1];
    const mk = (nama, fb, fj) => ({ nama, beli: Math.round(l[1] * fb / 1000) * 1000, buyback: Math.round(l[2] * fj / 1000) * 1000, tanggal: l[0] });
    const merek = { UBS: mk('UBS', 0.972, 0.984), GALERI24: mk('GALERI 24', 0.986, 1.004), LOTUSARCHI: mk('LOTUS ARCHI', 0.976, 0.98), EMASKITA: mk('EMASKITA', 0.964, 0.986) };
    return { beli: l[1], buyback: l[2], tanggal: l[0], sumber: 'Contoh (mode demo)', waktu: new Date().toISOString(), riwayat: out, merek, at: Date.now() };
  }
  /** Ambil harga terbaru dari relay (maks tiap 3 jam kecuali dipaksa). */
  Harga.fetch = async (force) => {
    if (Store.mode === 'demo') { if (!Harga.data || Harga.data.sumber.indexOf('demo') < 0) { Harga.data = demoHarga(); C.clear(); } return Harga.data; }
    if (!force && Harga.data && Harga.data.merek && Date.now() - (Harga.data.at || 0) < 3600e3) return Harga.data;   // data lama tanpa harga merek → ambil ulang
    if (Harga.loading) return Harga.loading;
    Harga.loading = (async () => {
      const r = await Relay.call('emas.harga', {});
      if (r.success && r.data) {
        Harga.data = Object.assign({}, r.data, { at: Date.now() });
        try { localStorage.setItem('sa:emas', JSON.stringify(Harga.data)); } catch (e) {}
        C.clear(); if (window.App && App.ready) UI.render();
      }
      return Harga.data;
    })().finally(() => { Harga.loading = null; });
    return Harga.loading;
  };
  window.Harga = Harga;

  /** Harga efektif: {beli, buyback, tanggal, sumber, mode, riwayat} atau null. */
  C.hargaEmas = () => M('hargaEmas', () => {
    let man = null; try { man = JSON.parse(Store.setting('hargaEmasManual', '') || 'null'); } catch (e) {}
    const mode = Store.setting('hargaEmasMode', 'otomatis'), auto = Harga.data;
    const pakaiManual = man && man.beli && (mode === 'manual' || !auto || !auto.beli);
    const h = pakaiManual ? { beli: man.beli, buyback: man.buyback, tanggal: man.tanggal, sumber: 'Diisi manual keluarga', riwayat: auto ? auto.riwayat : [] }
      : auto && auto.beli ? { beli: auto.beli, buyback: auto.buyback, tanggal: auto.tanggal, sumber: auto.sumber, riwayat: auto.riwayat || [] } : null;
    if (h) { h.mode = pakaiManual ? 'manual' : 'otomatis'; h.basi = U.diffDays(h.tanggal, U.today()) > 3; }
    return h;
  });
  C.geserHarga = 0;                            // simulasi ± % (halaman Brankas Emas)
  /** Harga merek lain (UBS, Galeri24, Lotus Archi, Emaskita…) dari Galeri24. Antam selalu dari Logam Mulia. */
  C.kunciMerek = m => String(m || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  C.hargaMerekList = () => { const d = Harga.data && Harga.data.merek; return d ? Object.keys(d).map(k => Object.assign({ key: k }, d[k])).sort((a, b) => a.nama.localeCompare(b.nama)) : []; };
  /** Harga untuk satu keping: {beli, buyback, sumber, merek:true|false}. Perhiasan & merek tanpa data → harga Antam × kadar. */
  C.hargaLot = (e) => {
    const k = C.kunciMerek(e && e.merek), d = Harga.data && Harga.data.merek, x = d && k && k !== 'ANTAM' && e.bentuk !== 'perhiasan' ? d[k] : null;
    if (x && x.buyback) return { beli: x.beli, buyback: x.buyback, sumber: x.nama + ' · Galeri24', merek: true, tanggal: x.tanggal };
    const h = C.hargaEmas(); return h ? { beli: h.beli, buyback: h.buyback, sumber: h.sumber, merek: false, tanggal: h.tanggal } : null;
  };

  // ---------- Brankas Emas ----------
  const gramOf = e => (e.gramKeping || 0) * (e.jumlah || 1);
  const murni = e => gramOf(e) * U.clamp((e.kadar || 24) / 24, 0, 1);
  C.MEREK_EMAS = ['Antam', 'UBS', 'Galeri24', 'Lotus Archi', 'Emaskita', 'King Halim', 'Pegadaian (digital)', 'Perhiasan', 'Lainnya'];
  C.GRAMASI = [0.5, 1, 2, 3, 5, 10, 25, 50, 100];
  C.emasLots = (all) => M('emasLots:' + !!all + ':' + C.geserHarga, () => {
    const f = 1 + C.geserHarga / 100;
    return Store.t.Emas.filter(e => all || e.status !== 'terjual').map(e => {
      const gram = gramOf(e), gm = murni(e), modal = (e.hargaBeli || 0) + (e.biaya || 0), hl = C.hargaLot(e), harga = hl ? hl.buyback * f : 0;
      const nilai = e.status === 'terjual' ? (e.hargaJual || 0) : Math.round(gm * harga);
      const umur = U.diffDays(e.tanggal || U.today(), U.today());
      return { e, gram, gramMurni: gm, modal, nilai, hargaGram: harga, hargaSumber: hl ? hl.sumber : '', untung: nilai - modal, pct: modal ? (nilai - modal) / modal : 0, umur, haul: umur >= HAUL_HARI, perGram: gram ? modal / gram : 0 };
    }).sort((a, b) => (b.e.tanggal || '').localeCompare(a.e.tanggal || ''));
  });
  /** Bagian kepemilikan {email|'bersama': fraksi}. */
  C.shares = (kp) => {
    const k = kp && typeof kp === 'object' ? kp : {}, keys = Object.keys(k).filter(x => Number(k[x]) > 0);
    if (!keys.length) return { bersama: 1 };
    const tot = U.sum(keys, x => Number(k[x]));
    const o = {}; keys.forEach(x => o[x] = Number(k[x]) / tot); return o;
  };
  C.emasSummary = () => M('emasSum:' + C.geserHarga, () => {
    const lots = C.emasLots(), aktif = lots.filter(l => l.e.status !== 'hibah');
    const gram = U.sum(aktif, l => l.gram), gm = U.sum(aktif, l => l.gramMurni), modal = U.sum(aktif, l => l.modal), nilai = U.sum(aktif, l => l.nilai);
    const gadai = aktif.filter(l => l.e.status === 'gadai');
    const perGramasi = {}, perMerek = {}, perPemilik = {};
    aktif.forEach(l => {
      if (l.e.bentuk !== 'perhiasan') { const k = String(l.e.gramKeping); perGramasi[k] = (perGramasi[k] || 0) + (l.e.jumlah || 1); }
      const m = l.e.bentuk === 'perhiasan' ? 'Perhiasan' : (l.e.merek || 'Lainnya'); perMerek[m] = (perMerek[m] || 0) + l.gram;
      const sh = C.shares(l.e.kepemilikan); Object.keys(sh).forEach(p => { const o = perPemilik[p] || (perPemilik[p] = { gram: 0, nilai: 0 }); o.gram += l.gram * sh[p]; o.nilai += l.nilai * sh[p]; });
    });
    // realisasi dari penjualan
    const sold = Store.t.Emas.filter(e => e.status === 'terjual');
    const realisasi = U.sum(sold, e => (e.hargaJual || 0) - (e.hargaBeli || 0) - (e.biaya || 0));
    return { lots: aktif, gram, gramMurni: gm, modal, nilai, untung: nilai - modal, pct: modal ? (nilai - modal) / modal : 0, gadai, perGramasi, perMerek, perPemilik, realisasi, rata: gram ? modal / gram : 0 };
  });
  /** Akumulasi gram dari waktu ke waktu (titik per transaksi). */
  C.emasAkumulasi = () => M('emasAkum', () => {
    const ev = [];
    Store.t.Emas.forEach(e => { const g = gramOf(e); if (e.tanggal) ev.push([e.tanggal, g]); if (e.status === 'terjual' && e.tglJual) ev.push([e.tglJual, -g]); });
    ev.sort((a, b) => a[0].localeCompare(b[0]));
    let c = 0; const pts = ev.map(x => { c += x[1]; return { d: x[0], bal: Math.round(c * 1000) / 1000 }; });
    if (pts.length) pts.push({ d: U.today(), bal: pts[pts.length - 1].bal });
    return pts;
  });
  /** PPh 22 buyback: berlaku bila nilai > Rp10 juta; tarif NPWP/non-NPWP diatur di pengaturan. */
  C.pphJual = (nilai) => {
    const batas = Number(Store.setting('pphBatas', 10000000)) || 10000000;
    const npwp = Store.setting('punyaNpwp', 'true') !== 'false';
    const tarif = Number(Store.setting(npwp ? 'pphNpwp' : 'pphNonNpwp', npwp ? 1.5 : 3)) / 100;
    return nilai > batas ? Math.round(nilai * tarif) : 0;
  };

  // ---------- Investasi & aset lain ----------
  C.KELAS = {
    saham: { label: 'Saham', ikon: 'chart-candlestick', unit: 'lembar', zakat: true, spt: '032' },
    reksadana: { label: 'Reksa Dana', ikon: 'chart-pie', unit: 'unit', zakat: true, spt: '036' },
    sbn: { label: 'SBN / Obligasi', ikon: 'file-badge', unit: 'unit', zakat: true, spt: '034', jt: true },
    deposito: { label: 'Deposito', ikon: 'landmark', unit: '', zakat: true, spt: '014', jt: true },
    kripto: { label: 'Kripto', ikon: 'bitcoin', unit: 'koin', zakat: true, spt: '039' },
    properti: { label: 'Properti & Tanah', ikon: 'house', unit: 'm²', zakat: false, spt: '061' },
    kendaraan: { label: 'Kendaraan', ikon: 'car', unit: '', zakat: false, spt: '043' },
    lain: { label: 'Aset Lain', ikon: 'package', unit: '', zakat: false, spt: '059' }
  };
  /** Baris tabel Investasi saja (tanpa posisi dari Jurnal Saham). */
  C.investasiManual = (kelas, all) => M('invm:' + (kelas || '') + ':' + !!all, () => Store.t.Investasi
    .filter(x => (!kelas || x.kelas === kelas) && (all || x.status !== 'terjual'))
    .map(x => { const nilai = x.status === 'terjual' ? (x.hargaJual || 0) : (x.nilai || x.modal || 0); return { x, nilai, modal: x.modal || 0, untung: nilai - (x.modal || 0), pct: x.modal ? (nilai - x.modal) / x.modal : 0, basi: x.tglNilai ? U.diffDays(x.tglNilai, U.today()) > 45 : true }; })
    .sort((a, b) => b.nilai - a.nilai));
  /** Semua investasi; posisi Jurnal Saham ikut masuk sebagai kelas saham (untuk kekayaan bersih, zakat & alokasi). */
  C.investasi = (kelas, all) => M('inv:' + (kelas || '') + ':' + !!all, () => {
    const a = C.investasiManual(kelas, all);
    return (!kelas || kelas === 'saham') && C.sahamItems ? a.concat(C.sahamItems()).sort((x, y) => y.nilai - x.nilai) : a;
  });
  /** Nilai aset non-kas per kelas (untuk kekayaan bersih & alokasi). */
  C.asetKelas = () => M('asetKelas', () => {
    const o = { emas: C.emasSummary().nilai };
    Object.keys(C.KELAS).forEach(k => { const v = U.sum(C.investasi(k), i => i.nilai); if (v) o[k] = v; });
    return o;
  });
  /** Nilai aset yang ditautkan ke Tujuan {tujuanId: nilai}. */
  C.linkedGoalValue = () => M('linkGoal', () => {
    const o = {};
    C.emasLots().forEach(l => { if (l.e.tujuanId && l.e.status !== 'hibah') o[l.e.tujuanId] = (o[l.e.tujuanId] || 0) + l.nilai; });
    C.investasi().forEach(i => { if (i.x.tujuanId) o[i.x.tujuanId] = (o[i.x.tujuanId] || 0) + i.nilai; });
    return o;
  });

  // ---------- Target alokasi ----------
  C.ALOKASI = [['kas', 'Kas & tabungan', 'wallet'], ['emas', 'Emas', 'gem'], ['saham', 'Saham', 'chart-candlestick'], ['reksadana', 'Reksa dana', 'chart-pie'],
    ['tetap', 'SBN & deposito', 'file-badge'], ['properti', 'Properti', 'house'], ['lain', 'Kripto & lainnya', 'package']];
  C.alokasi = () => M('alok', () => {
    const nw = C.netWorth(), k = nw.kelas;
    const nyata = { kas: Math.max(0, nw.kas) + nw.danaTujuan, emas: k.emas || 0, saham: k.saham || 0, reksadana: k.reksadana || 0, tetap: (k.sbn || 0) + (k.deposito || 0), properti: k.properti || 0, lain: (k.kripto || 0) + (k.lain || 0) };
    let tgt = {}; try { tgt = JSON.parse(Store.setting('targetAlokasi', '') || '{}'); } catch (e) {}
    const incl = Store.setting('alokasiProperti', 'false') === 'true';
    const keys = C.ALOKASI.map(a => a[0]).filter(x => incl || x !== 'properti');
    const total = U.sum(keys, x => nyata[x]);
    const rows = keys.map(x => { const v = nyata[x], pct = total ? v / total : 0, t = (Number(tgt[x]) || 0) / 100; return { k: x, label: C.ALOKASI.find(a => a[0] === x)[1], ikon: C.ALOKASI.find(a => a[0] === x)[2], v, pct, target: t, selisih: Math.round(t * total - v) }; });
    return { rows, total, adaTarget: keys.some(x => Number(tgt[x]) > 0), sumTarget: U.sum(keys, x => Number(tgt[x]) || 0), properti: incl };
  });

  // ---------- Zakat ----------
  const tagSum = (re, from, to) => U.sum(Store.t.Transaksi.filter(t => t.jenis === 'keluar' && re.test(t.tag || '') && (!from || t.tanggal >= from) && (!to || t.tanggal <= to)), t => t.jumlah);
  C.haul = () => {
    const mulai = Store.setting('zakatHaul', '');
    if (!mulai) return null;
    let start = mulai; while (U.diffDays(start, U.today()) >= HAUL_HARI) start = U.addDays(start, HAUL_HARI);
    return { start, next: U.addDays(start, HAUL_HARI), sisa: U.diffDays(U.today(), U.addDays(start, HAUL_HARI)) };
  };
  C.zakatMal = () => M('zakatMal', () => {
    const h = C.hargaEmas(), nisabGram = Number(Store.setting('nisabGram', 85)) || 85;
    const hargaNisab = h ? (Store.setting('nisabHarga', 'beli') === 'buyback' ? h.buyback : h.beli) : 0;
    const nisab = Math.round(nisabGram * hargaNisab);
    const b = C.balances(), items = [];
    Store.wallets().forEach(w => { const v = Math.max(0, b[w.id] || 0); if (v) items.push({ grup: 'Kas & tabungan', nama: w.nama, v }); });
    C.goals().filter(g => !g.t.walletId && g.dana > 0).forEach(g => items.push({ grup: 'Kas & tabungan', nama: 'Dana tujuan: ' + g.t.nama, v: g.dana }));
    const hb = h ? h.buyback : 0;
    C.emasLots().filter(l => l.e.zakat && l.e.status !== 'hibah').forEach(l => items.push({ grup: 'Emas', nama: (l.e.bentuk === 'perhiasan' ? 'Perhiasan ' : (l.e.merek || 'Emas') + ' ') + U.fmtNum(l.gram) + ' g', v: Math.round(l.gramMurni * ((C.hargaLot(l.e) || {}).buyback || hb)) }));
    C.investasi().filter(i => i.x.zakat).forEach(i => items.push({ grup: (C.KELAS[i.x.kelas] || C.KELAS.lain).label, nama: i.x.nama, v: i.nilai }));
    if (Store.setting('zakatPiutang', 'true') !== 'false') C.loans().filter(l => !l.lunas && l.p.arah === 'piutang').forEach(l => items.push({ grup: 'Piutang', nama: l.p.pihak, v: l.sisa }));
    const modeUtang = Store.setting('zakatUtang', 'jatuhTempo');
    let utang = 0;
    if (modeUtang === 'semua') utang = U.sum(C.loans().filter(l => !l.lunas && l.p.arah !== 'piutang'), l => l.sisa);
    else if (modeUtang === 'jatuhTempo') utang = U.sum(C.occurrences(U.today(), U.addDays(U.today(), 30)).filter(o => o.kind === 'pinjaman' && o.arah === 'keluar' && !o.lunas), o => o.sisa);
    const harta = U.sum(items, x => x.v), bersih = Math.max(0, harta - utang);
    const wajib = nisab > 0 && bersih >= nisab, zakat = wajib ? Math.round(bersih * 0.025) : 0;
    const haul = C.haul(), dibayar = tagSum(/^zakat-mal/, haul ? haul.start : U.addDays(U.today(), -HAUL_HARI));
    return { nisab, nisabGram, hargaNisab, items, harta, utang, modeUtang, bersih, wajib, zakat, haul, dibayar, kurang: Math.max(0, zakat - dibayar) };
  });
  C.zakatPenghasilan = (p) => M('zakatPeng:' + (p || C.period()).key, () => {
    p = p || C.period();
    const m = C.zakatMal(), nisabBulan = Math.round(m.nisab / 12);
    const inc = U.sum(C.txIn(p).filter(t => t.jenis === 'masuk'), t => t.jumlah);
    const wajib = nisabBulan > 0 && inc >= nisabBulan, zakat = wajib ? Math.round(inc * 0.025) : 0;
    const dibayar = tagSum(/^zakat-penghasilan/, p.start, p.end);
    return { p, inc, nisabBulan, wajib, zakat, dibayar, kurang: Math.max(0, zakat - dibayar) };
  });
  C.zakatFitrah = () => M('fitrah', () => {
    const jiwa = Number(Store.setting('zakatJiwa', Store.members().length || 1)) || 1, tarif = Number(Store.setting('zakatFitrahTarif', 50000)) || 0;
    const hp = U.hijriParts(U.today()), th = hp ? hp.y : new Date().getFullYear();
    const dibayar = tagSum(new RegExp('^zakat-fitrah-' + th));
    return { jiwa, tarif, total: jiwa * tarif, tahunH: th, dibayar, kurang: Math.max(0, jiwa * tarif - dibayar) };
  });
  C.sedekah = (p) => M('sedekah:' + (p || C.period()).key, () => {
    p = p || C.period();
    const target = Number(Store.setting('sedekahTarget', 2.5)) || 0;
    const inc = C.periodTotals(p).masuk, rows = C.txIn(p).filter(t => t.jenis === 'keluar' && /^(sedekah|infak|donasi|wakaf)/.test(t.tag || ''));
    const total = U.sum(rows, t => t.jumlah);
    return { p, target, targetRp: Math.round(inc * target / 100), total, rows, pct: inc ? total / inc : 0 };
  });

  // ---------- Ringkasan SPT ----------
  C.balancesAt = (date) => {
    const b = {}; Store.t.Wallet.forEach(w => b[w.id] = w.saldoAwal || 0);
    const add = (id, v) => { if (id) b[id] = (b[id] || 0) + v; };
    Store.t.Transaksi.forEach(t => {
      if (t.tanggal > date) return; const j = t.jumlah || 0;
      switch (t.jenis) {
        case 'keluar': case 'pinjam_beri': case 'aset_beli': add(t.walletId, -j); break;
        case 'masuk': case 'pinjam_kembali': case 'pinjam_terima': case 'penyesuaian': case 'aset_jual': add(t.walletId, j); break;
        case 'transfer': add(t.walletId, -(j + (t.biaya || 0))); add(t.walletTujuan, j); break;
        case 'tujuan': add(t.walletId, -j); add(t.walletTujuan, j); break;
        case 'tujuan_ambil': add(t.walletId, j); add(t.walletTujuan, -j); break;
      }
      if (t.biaya && t.jenis !== 'transfer') add(t.walletId, -(Number(t.biaya) || 0));
    });
    return b;
  };
  C.spt = (tahun) => M('spt:' + tahun, () => {
    const end = tahun + '-12-31', start = tahun + '-01-01', harta = [], utang = [];
    const thn = d => (d || '').slice(0, 4) || String(tahun);
    const b = C.balancesAt(end);
    Store.t.Wallet.forEach(w => {
      const v = Math.round(b[w.id] || 0); if (!v) return;
      if (w.jenis === 'kartu') { if (v < 0) utang.push({ kode: '102', nama: w.nama, pemberi: w.nama, tahun: '', v: -v }); return; }
      if (v < 0) return;                                       // saldo minus dompet biasa = catatan belum lengkap, bukan utang
      harta.push({ kode: w.jenis === 'tunai' ? '011' : w.jenis === 'bank' ? '012' : '019', nama: w.nama, tahun: '', v, ket: w.jenis === 'tunai' ? 'Uang tunai' : w.jenis === 'bank' ? 'Tabungan' : 'Setara kas lainnya (dompet digital)' });
    });
    Store.t.Emas.filter(e => e.tanggal && e.tanggal <= end && !(e.status === 'terjual' && e.tglJual && e.tglJual <= end)).forEach(e =>
      harta.push({ kode: '051', nama: (e.bentuk === 'perhiasan' ? 'Perhiasan emas ' : 'Emas ' + (e.merek || '') + ' ') + U.fmtNum(gramOf(e)) + ' gram', tahun: thn(e.tanggal), v: (e.hargaBeli || 0) + (e.biaya || 0), ket: 'Logam mulia' }));
    Store.t.Investasi.filter(x => (x.tanggal || '0') <= end && !(x.status === 'terjual' && x.tglJual && x.tglJual <= end)).forEach(x => {
      const k = C.KELAS[x.kelas] || C.KELAS.lain;
      harta.push({ kode: x.kelas === 'kendaraan' && /motor/i.test(x.nama) ? '042' : k.spt, nama: x.nama + (x.kode ? ' (' + x.kode + ')' : ''), tahun: thn(x.tanggal), v: x.modal || 0, ket: k.label });
    });
    if (C.saham) C.saham(end).posisi.forEach(p => harta.push({ kode: '032', nama: 'Saham ' + p.kode + ' (' + U.fmtNum(p.lembar) + ' lembar)', tahun: thn(p.mulai), v: Math.round(p.biaya), ket: 'Saham' }));
    C.loans().forEach(l => {
      if ((l.p.mulai || '') > end) return;
      const paid = U.sum(Store.t.Transaksi.filter(t => t.refId === l.p.id && t.tanggal <= end && t.jenis !== 'pinjam_terima' && t.jenis !== 'pinjam_beri'), t => t.jumlah);
      const sisa = Math.max(0, Math.round((l.p.arah === 'piutang' ? l.p.pokok : (l.total || l.p.pokok)) - paid));
      if (!sisa) return;
      if (l.p.arah === 'piutang') harta.push({ kode: '021', nama: 'Piutang ' + l.p.pihak, tahun: thn(l.p.mulai), v: sisa, ket: 'Piutang' });
      else utang.push({ kode: { kartu: '102', keluarga: '103', patungan: '109', lain: '109' }[l.p.jenis] || '101', nama: l.p.pihak, pemberi: l.p.pihak, tahun: thn(l.p.mulai), v: sisa });
    });
    const inc = {}; Store.t.Transaksi.filter(t => t.jenis === 'masuk' && t.tanggal >= start && t.tanggal <= end).forEach(t => { const k = (Store.byId.Kategori[t.kategoriId] || {}).nama || 'Lainnya'; inc[k] = (inc[k] || 0) + t.jumlah; });
    const zakat = U.sum(Store.t.Transaksi.filter(t => t.jenis === 'keluar' && /^zakat/.test(t.tag || '') && t.tanggal >= start && t.tanggal <= end), t => t.jumlah);
    harta.sort((a, b) => a.kode.localeCompare(b.kode)); utang.sort((a, b) => a.kode.localeCompare(b.kode));
    return { tahun, harta, utang, penghasilan: Object.keys(inc).map(k => ({ nama: k, v: inc[k] })).sort((a, b) => b.v - a.v), zakat,
      totalHarta: U.sum(harta, x => x.v), totalUtang: U.sum(utang, x => x.v), totalPenghasilan: U.sum(Object.keys(inc), k => inc[k]) };
  });
})();
