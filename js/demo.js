/* Mode demo — data contoh keluarga fiktif + server tiruan di memori (perubahan tidak disimpan). */
(function () {
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function buildDemo(big) {
    const R = rng(20261110), pick = a => a[Math.floor(R() * a.length)], between = (a, b) => Math.round((a + R() * (b - a)) / 500) * 500;
    const today = U.today(), now = new Date().toISOString();
    const D = 'dimas@contoh.id', N = 'rini@contoh.id';
    const T = { Anggota: [], Pengaturan: [], Wallet: [], Kategori: [], Transaksi: [], Template: [], Rutin: [], Acara: [], GeserDana: [], Tujuan: [], Pinjaman: [], Laporan: [], Emas: [], Investasi: [], Skenario: [], Rapat: [], Tugas: [], Saham: [] };
    T.Anggota.push({ id: 'm1', nama: 'Dimas', email: D, peran: 'admin', warna: '#0F5E59', izin: '{}', aktif: 'true', dibuat: now });
    T.Anggota.push({ id: 'm2', nama: 'Rini', email: N, peran: 'pasangan', warna: '#F2B33D', izin: '{}', aktif: 'true', dibuat: now });
    [['namaKeluarga', 'Keluarga Dimas & Rini'], ['periodeMulai', '1'], ['danaDaruratBulan', '6'], ['notifEmail', 'true'], ['kalenderSync', 'false'],
     ['bagiGaji', JSON.stringify([{ pos: 'Kebutuhan', persen: 50, kelompok: 'kebutuhan' }, { pos: 'Keinginan', persen: 30, kelompok: 'keinginan' }, { pos: 'Tabungan', persen: 20, kelompok: 'tabungan' }])]]
      .forEach(p => T.Pengaturan.push({ id: p[0], nilai: p[1] }));
    const W = [['w_bca', 'BCA Bersama', 'bank', 'bersama', 15000000], ['w_mdr', 'Mandiri Gaji Dimas', 'bank', D, 4000000], ['w_jago', 'Jago Tabungan', 'bank', 'bersama', 8000000],
               ['w_gopay', 'GoPay Rini', 'ewallet', N, 500000], ['w_tunai', 'Tunai Rumah', 'tunai', 'bersama', 1500000]];
    W.forEach((w, i) => T.Wallet.push({ id: w[0], nama: w[1], jenis: w[2], pemilik: w[3], saldoAwal: String(w[4]), ikon: '', likuid: 'true', urutan: String(i), arsip: 'false', catatan: '' }));
    const K = [['k_mkn', 'Makan & Minum', 'keluar', 'kebutuhan', 'utensils', 2500000], ['k_dpr', 'Belanja Dapur', 'keluar', 'kebutuhan', 'shopping-cart', 4000000],
      ['k_trp', 'Transportasi', 'keluar', 'kebutuhan', 'car', 1700000], ['k_lst', 'Listrik, Air & Internet', 'keluar', 'kebutuhan', 'zap', 950000, 1],
      ['k_pdd', 'Pendidikan Anak', 'keluar', 'kebutuhan', 'graduation-cap', 1850000, 1], ['k_kes', 'Kesehatan', 'keluar', 'kebutuhan', 'heart-pulse', 500000],
      ['k_rmh', 'Rumah & Perawatan', 'keluar', 'kebutuhan', 'home', 600000], ['k_cic', 'Cicilan & Utang', 'keluar', 'kebutuhan', 'landmark', 0, 1],
      ['k_iur', 'Iuran & Sosial', 'keluar', 'kebutuhan', 'users', 300000, 1], ['k_jjn', 'Jajan & Kafe', 'keluar', 'keinginan', 'coffee', 800000],
      ['k_hbr', 'Hiburan & Langganan', 'keluar', 'keinginan', 'tv', 450000, 1], ['k_blj', 'Belanja Pribadi', 'keluar', 'keinginan', 'shopping-bag', 700000],
      ['k_sdk', 'Sedekah & Zakat', 'keluar', 'kebutuhan', 'hand-heart', 550000], ['k_adm', 'Biaya Admin', 'keluar', 'kebutuhan', 'receipt', 0],
      ['k_upd', 'Uang Pribadi Dimas', 'keluar', 'keinginan', 'lock', 1000000, 0, D], ['k_upr', 'Uang Pribadi Rini', 'keluar', 'keinginan', 'lock', 1000000, 0, N],
      ['k_gaji', 'Gaji', 'masuk', 'pemasukan', 'banknote', 0], ['k_bonus', 'Bonus & THR', 'masuk', 'pemasukan', 'gift', 0], ['k_lain', 'Pemasukan Lain', 'masuk', 'pemasukan', 'plus-circle', 0]];
    K.forEach((k, i) => T.Kategori.push({ id: k[0], nama: k[1], jenis: k[2], kelompok: k[3], ikon: k[4], batas: String(k[5] || 0), bawaSisa: 'false', tetap: k[6] ? 'true' : 'false', pribadi: k[7] || '', urutan: String(i), arsip: 'false' }));
    const Rt = [['r_gd', 'Gaji Dimas', 'masuk', 13500000, 'k_gaji', 'w_mdr', 'bulanan', 25], ['r_gr', 'Gaji Rini', 'masuk', 8500000, 'k_gaji', 'w_bca', 'bulanan', 25],
      ['r_pln', 'Listrik PLN Pascabayar', 'keluar', 485000, 'k_lst', 'w_bca', 'bulanan', 20], ['r_net', 'IndiHome WiFi', 'keluar', 399000, 'k_lst', 'w_bca', 'bulanan', 21],
      ['r_spp', 'SPP Sekolah Aisha', 'keluar', 1500000, 'k_pdd', 'w_bca', 'bulanan', 10], ['r_les', 'Les Renang Aisha', 'keluar', 350000, 'k_pdd', 'w_gopay', 'bulanan', 3],
      ['r_iur', 'Iuran Keamanan & Kebersihan', 'keluar', 150000, 'k_iur', 'w_tunai', 'bulanan', 5], ['r_nfx', 'Netflix Family', 'keluar', 186000, 'k_hbr', 'w_gopay', 'bulanan', 24, 1],
      ['r_spt', 'Spotify Family', 'keluar', 86900, 'k_hbr', 'w_bca', 'bulanan', 28, 1], ['r_ggl', 'Google One 2TB', 'keluar', 135000, 'k_hbr', 'w_bca', 'bulanan', 14, 1],
      ['r_pjk', 'Pajak Mobil Avanza', 'keluar', 2800000, 'k_trp', 'w_bca', 'tahunan', 14, 0, 1], ['r_pbb', 'PBB Rumah', 'keluar', 1200000, 'k_rmh', 'w_bca', 'tahunan', 30, 0, 8],
      ['r_asr', 'Premi Asuransi Keluarga', 'keluar', 4200000, 'k_kes', 'w_bca', 'tahunan', 20, 0, 6], ['r_mtr', 'Pajak Motor', 'keluar', 450000, 'k_trp', 'w_bca', 'tahunan', 9, 0, 3]];
    Rt.forEach(r => T.Rutin.push({ id: r[0], nama: r[1], jenis: r[2], jumlah: String(r[3]), kategoriId: r[4], walletId: r[5], frekuensi: r[6], tanggal: String(r[7]), bulan: String(r[9] || ''), mulai: '', selesai: '', langganan: r[8] ? 'true' : 'false', ditinjau: '', aktif: 'true', catatan: '' }));
    const start = U.addMonths(today, big ? -60 : -14).slice(0, 8) + '01';
    T.Pinjaman.push({ id: 'p_kpr', arah: 'utang', jenis: 'kpr', pihak: 'KPR BTN Syariah', pokok: '280000000', bunga: '7.25', metode: 'anuitas', tenor: '180', mulai: U.addMonths(start, -10).slice(0, 8) + '28', tanggalBayar: '28', cicilan: '', walletId: 'w_bca', lunas: 'false', catatan: 'Rumah Serpong', dibuat: now });
    T.Pinjaman.push({ id: 'p_mtr', arah: 'utang', jenis: 'kendaraan', pihak: 'Cicilan Motor Vario', pokok: '27300000', bunga: '0', metode: 'tanpa', tenor: '35', mulai: U.addMonths(start, 2).slice(0, 8) + '10', tanggalBayar: '10', cicilan: '780000', walletId: 'w_mdr', lunas: 'false', catatan: '', dibuat: now });
    T.Pinjaman.push({ id: 'p_pl', arah: 'utang', jenis: 'paylater', pihak: 'PayLater Tokopedia', pokok: '1800000', bunga: '0', metode: 'tanpa', tenor: '3', mulai: U.addMonths(today, -1).slice(0, 8) + '15', tanggalBayar: '15', cicilan: '600000', walletId: 'w_gopay', lunas: 'false', catatan: 'Kulkas 2 pintu', dibuat: now });
    T.Pinjaman.push({ id: 'p_byu', arah: 'piutang', jenis: 'keluarga', pihak: 'Mas Bayu', pokok: '3500000', bunga: '0', metode: 'tanpa', tenor: '7', mulai: U.addMonths(today, -2).slice(0, 8) + '30', tanggalBayar: '28', cicilan: '500000', walletId: 'w_bca', lunas: 'false', catatan: 'Modal bengkel', dibuat: now });
    T.Tujuan.push({ id: 'g_dar', nama: 'Dana Darurat Keluarga', ikon: 'shield', target: '90000000', tenggat: U.addMonths(today, 10), prioritas: '1', jenis: 'bersama', pemilik: '', setoranBulanan: '2000000', walletId: 'w_jago', arsip: 'false', catatan: '6 bulan pengeluaran', dibuat: start });
    T.Tujuan.push({ id: 'g_pdd', nama: 'Dana Pendidikan SD Aisha', ikon: 'graduation-cap', target: '15000000', tenggat: U.addMonths(today, 8), prioritas: '2', jenis: 'bersama', pemilik: '', setoranBulanan: '1000000', walletId: '', arsip: 'false', catatan: '', dibuat: start });
    T.Tujuan.push({ id: 'g_bali', nama: 'Liburan Bali', ikon: 'plane', target: '12000000', tenggat: U.addMonths(today, 14), prioritas: '3', jenis: 'bersama', pemilik: '', setoranBulanan: '500000', walletId: '', arsip: 'false', catatan: '', dibuat: start });
    T.Tujuan.push({ id: 'g_lap', nama: 'Ganti Laptop Dimas', ikon: 'laptop', target: '10000000', tenggat: U.addMonths(today, 9), prioritas: '4', jenis: 'pribadi', pemilik: D, setoranBulanan: '500000', walletId: '', arsip: 'false', catatan: '', dibuat: start });
    T.Acara.push({ id: 'a_mudik', nama: 'Mudik Lebaran', tanggal: U.addMonths(today, 4).slice(0, 8) + '18', estimasi: '8000000', besar: 'true', catatan: 'Tiket + oleh-oleh' });
    T.Acara.push({ id: 'a_ultah', nama: 'Ulang Tahun Aisha', tanggal: U.addDays(today, 12), estimasi: '750000', besar: 'false', catatan: '' });
    T.Template.push({ id: 'tp1', nama: 'Bensin Motor', jenis: 'keluar', jumlah: '50000', kategoriId: 'k_trp', walletId: 'w_tunai', catatan: 'Pertamax', urutan: '0' });
    T.Template.push({ id: 'tp2', nama: 'Parkir', jenis: 'keluar', jumlah: '5000', kategoriId: 'k_trp', walletId: 'w_tunai', catatan: '', urutan: '1' });
    T.Template.push({ id: 'tp3', nama: 'Sayur', jenis: 'keluar', jumlah: '30000', kategoriId: 'k_dpr', walletId: 'w_gopay', catatan: 'Tukang sayur', urutan: '2' });

    // ---- Transaksi ----
    let n = 0;
    const tx = (d, jenis, jumlah, kat, wal, cat, who, extra) => {
      n++;
      T.Transaksi.push(Object.assign({ id: 'tx' + n, tanggal: d, jenis, jumlah: String(Math.round(jumlah)), kategoriId: kat || '', walletId: wal || '', walletTujuan: '', biaya: '0', catatan: cat || '',
        dibayarOleh: who, tag: '', sumber: 'manual', refId: '', periodeRef: '', dicatatOleh: who, dibuat: d + 'T' + U.pad(7 + Math.floor(R() * 14)) + ':' + U.pad(Math.floor(R() * 60)) + ':00.000Z', riwayat: '' }, extra || {}));
    };
    const SPEND = [['k_mkn', ['Makan siang', 'Soto Betawi', 'Nasi Padang', 'Bakso', 'Warteg'], 20000, 85000, 0.9],
      ['k_dpr', ['Superindo', 'Tukang sayur', 'Alfamart', 'Pasar pagi', 'Indomaret'], 25000, 350000, 0.7],
      ['k_trp', ['Bensin', 'Parkir', 'Tol', 'Gojek', 'Grab'], 5000, 150000, 0.6], ['k_jjn', ['Kopi Kenangan', 'Janji Jiwa', 'Martabak', 'Es teh'], 15000, 70000, 0.35],
      ['k_blj', ['Shopee', 'Tokopedia', 'Baju Aisha'], 50000, 400000, 0.08], ['k_kes', ['Apotek', 'Vitamin'], 30000, 250000, 0.05],
      ['k_rmh', ['Galon & gas', 'Servis AC', 'Lampu'], 20000, 300000, 0.1], ['k_upd', ['Kopi kantor', 'Main futsal'], 25000, 120000, 0.12],
      ['k_upr', ['Skincare', 'Arisan'], 30000, 200000, 0.1], ['k_sdk', ['Infaq Jumat', 'Sedekah'], 10000, 100000, 0.15]];
    const WAL = { D: ['w_mdr', 'w_tunai', 'w_bca'], N: ['w_gopay', 'w_bca', 'w_tunai'] };
    const tags = ['', '', '', '', '', 'Makan Siang', 'Weekend'];
    for (let d = start; d <= today; d = U.addDays(d, 1)) {
      const dt = U.parseDate(d), dom = dt.getDate(), ym = d.slice(0, 7), mon = dt.getMonth() + 1;
      const daily = big ? 3 : 1;
      for (let rep = 0; rep < daily; rep++) SPEND.forEach(s => {
        if (R() < s[4] * (big ? 1 : 0.85)) {
          const who = s[0] === 'k_upd' ? 'D' : s[0] === 'k_upr' ? 'N' : (R() < 0.5 ? 'D' : 'N');
          tx(d, 'keluar', between(s[2], s[3]), s[0], pick(WAL[who]), pick(s[1]), who === 'D' ? D : N, { tag: pick(tags) });
        }
      });
      T.Rutin.forEach(r => {
        const rd = Number(r.tanggal);
        if (Math.min(rd, U.daysInMonth(dt.getFullYear(), mon)) !== dom) return;
        if (r.frekuensi === 'tahunan' && Number(r.bulan) !== mon) return;
        if (d === today && R() < 0.5) return;
        const pay = d > U.addDays(today, -2) ? d : (R() < 0.85 ? d : U.addDays(d, 2));
        if (pay > today) return;
        tx(pay, r.jenis, Number(r.jumlah), r.kategoriId, r.walletId, r.nama, r.jenis === 'masuk' ? (r.id === 'r_gr' ? N : D) : (R() < 0.6 ? D : N),
          { sumber: 'rutin', refId: r.id, periodeRef: r.frekuensi === 'tahunan' ? d.slice(0, 4) : ym });
      });
      T.Pinjaman.forEach(p => {
        if (p.arah === 'piutang') return;
        if (Number(p.tanggalBayar) !== Math.min(dom, 28) || d < p.mulai) return;
        const c = p.cicilan ? Number(p.cicilan) : Calc.loanCalc({ pokok: Number(p.pokok), bunga: Number(p.bunga), tenor: Number(p.tenor), metode: p.metode }).cicilan;
        const ke = Calc.monthsBetween(p.mulai, d);
        if (ke >= Number(p.tenor)) return;
        tx(d, 'keluar', c, 'k_cic', p.walletId, 'Cicilan ' + p.pihak, D, { sumber: 'pinjaman', refId: p.id, periodeRef: ym });
      });
      if (dom === 26) {
        tx(d, 'transfer', 3000000, '', 'w_mdr', 'Transfer ke rekening bersama', D, { walletTujuan: 'w_bca', biaya: '0' });
        tx(d, 'transfer', 1800000, '', 'w_bca', 'Top up GoPay', N, { walletTujuan: 'w_gopay', biaya: '1000' });
        tx(d, 'transfer', 1800000 * (big ? 2 : 1), '', 'w_bca', 'Tarik tunai', D, { walletTujuan: 'w_tunai', biaya: '0' });
        T.Tujuan.forEach(g => {
          if (d < g.dibuat) return;
          const who = g.id === 'g_lap' ? D : (R() < 0.5 ? D : N);
          if (g.jenis === 'bersama') {
            tx(d, 'tujuan', Number(g.setoranBulanan) / 2, '', 'w_bca', 'Setor ' + g.nama, D, { refId: g.id, walletTujuan: g.walletId, sumber: 'tujuan' });
            tx(d, 'tujuan', Number(g.setoranBulanan) / 2, '', 'w_bca', 'Setor ' + g.nama, N, { refId: g.id, walletTujuan: g.walletId, sumber: 'tujuan' });
          } else tx(d, 'tujuan', Number(g.setoranBulanan), '', 'w_mdr', 'Setor ' + g.nama, who, { refId: g.id, walletTujuan: g.walletId, sumber: 'tujuan' });
        });
      }
      if (mon === 4 && dom === 1) tx(d, 'masuk', 13500000, 'k_bonus', 'w_mdr', 'THR Dimas', D);
    }
    // Piutang Mas Bayu
    const pb = T.Pinjaman.find(p => p.id === 'p_byu');
    tx(pb.mulai <= today ? pb.mulai : today, 'pinjam_beri', 3500000, '', 'w_bca', 'Pinjaman ke Mas Bayu', D, { refId: 'p_byu', sumber: 'pinjaman' });
    tx(U.addDays(today, -20), 'pinjam_kembali', 500000, '', 'w_bca', 'Cicilan dari Mas Bayu', D, { refId: 'p_byu', sumber: 'pinjaman', periodeRef: U.addDays(today, -20).slice(0, 7) });
    tx(U.addDays(today, -1), 'pinjam_kembali', 500000, '', 'w_bca', 'Cicilan dari Mas Bayu', D, { refId: 'p_byu', sumber: 'pinjaman', periodeRef: U.addDays(today, -1).slice(0, 7) });
    // Geser dana contoh
    const pk = U.today().slice(0, 7);
    T.GeserDana.push({ id: 'gd1', tanggal: U.addDays(today, -2), periode: pk, dari: 'k_trp', ke: 'k_mkn', jumlah: '150000', catatan: 'Jajan martabak mertua' });
    // ---- Fase 2: Brankas Emas & investasi ----
    T.Tujuan.push({ id: 'g_qur', nama: 'Qurban Idul Adha', ikon: 'beef', target: '4000000', tenggat: U.addMonths(today, 6), prioritas: '5', jenis: 'bersama', pemilik: '', setoranBulanan: '500000', walletId: '', arsip: 'false', catatan: '', dibuat: start });
    const E = (id, tgl, merek, bentuk, gram, n, kadar, harga, extra) => T.Emas.push(Object.assign({ id, tanggal: tgl, merek, bentuk, gramKeping: String(gram), jumlah: String(n), kadar: String(kadar), hargaBeli: String(harga), biaya: '0',
      walletId: '', tujuanId: '', kepemilikan: '{}', status: 'simpan', zakat: bentuk === 'perhiasan' ? 'false' : 'true', tglJual: '', hargaJual: '0', pinjamanId: '', sertifikat: '', catatan: '', dibuat: now }, extra || {}));
    E('e1', U.addMonths(today, -22), 'Antam', 'batangan', 5, 2, 24, 11300000, { kepemilikan: JSON.stringify({ [D]: 50, [N]: 50 }), sertifikat: 'CertiEye' });
    E('e2', U.addMonths(today, -14), 'Antam', 'batangan', 10, 1, 24, 15600000 * 1.07, { tujuanId: 'g_pdd', catatan: 'Untuk uang pangkal SD Aisha' });
    E('e3', U.addMonths(today, -9), 'Galeri24', 'batangan', 1, 6, 24, 6 * 1530000, { kepemilikan: JSON.stringify({ [N]: 100 }) });
    E('e4', U.addMonths(today, -30), 'Perhiasan', 'perhiasan', 8, 1, 18, 7200000, { catatan: 'Cincin & gelang mahar', kepemilikan: JSON.stringify({ [N]: 100 }) });
    E('e5', U.addMonths(today, -5), 'Antam', 'batangan', 2, 1, 24, 2 * 2380000, { tujuanId: 'g_qur' });
    E('e6', U.addMonths(today, -26), 'UBS', 'batangan', 2, 1, 24, 2 * 1050000, { status: 'terjual', tglJual: U.addMonths(today, -3), hargaJual: String(2 * 2300000), catatan: 'Dijual untuk biaya rumah sakit' });
    E('e7', U.addMonths(today, -2), 'Pegadaian (digital)', 'digital', 0.85, 1, 24, Math.round(0.85 * 2510000));
    const IV = (id, kelas, nama, kode, unit, modal, nilai, tgl, extra) => T.Investasi.push(Object.assign({ id, kelas, nama, kode, unit: String(unit), modal: String(modal), nilai: String(nilai), tglNilai: U.addDays(today, -3), tanggal: tgl,
      walletId: '', tujuanId: '', kepemilikan: '{}', jatuhTempo: '', imbal: '0', zakat: ['properti', 'kendaraan', 'lain'].indexOf(kelas) > -1 ? 'false' : 'true', status: 'aktif', tglJual: '', hargaJual: '0', catatan: '', dibuat: now,
      riwayatNilai: JSON.stringify([[U.addMonths(today, -6), Math.round(modal * 0.97)], [U.addMonths(today, -3), Math.round((modal + nilai) / 2)], [U.addDays(today, -3), nilai]]) }, extra || {}));
    // Jurnal saham: akun RDN Dimas
    T.Wallet.push({ id: 'w_rdn', nama: 'RDN Ajaib Dimas', jenis: 'rdn', pemilik: D, saldoAwal: '0', ikon: '', likuid: 'false', urutan: '9', arsip: 'false', catatan: '' });
    const SH = (id, hari, kode, aksi, lot, harga, nominal, ex) => { const tg = U.addDays(today, -hari), f = aksi === 'dividen' ? 0 : Math.round(lot * 100 * harga * (aksi === 'jual' ? 0.0025 : 0.0015)), txId = 'tsh' + id;
      T.Saham.push(Object.assign({ id: 'sh' + id, tanggal: tg, kode, aksi, lot: String(lot), harga: String(harga), fee: String(f), nominal: String(nominal || 0), walletId: 'w_rdn', catatan: '', dibuat: now, txId, oleh: D, setup: '', entryLow: '', entryHigh: '', sl: '', tp1: '', tp2: '' }, ex || {}));
      const j = aksi === 'beli' ? lot * 100 * harga + f : aksi === 'jual' ? lot * 100 * harga - f : nominal;
      T.Transaksi.push({ id: txId, tanggal: tg, jenis: aksi === 'beli' ? 'aset_beli' : aksi === 'jual' ? 'aset_jual' : 'masuk', jumlah: String(Math.round(j)), kategoriId: aksi === 'dividen' ? 'k_lain' : '', walletId: 'w_rdn', walletTujuan: '', biaya: '0', catatan: (aksi === 'dividen' ? 'Dividen ' : aksi === 'beli' ? 'Beli ' : 'Jual ') + kode, dibayarOleh: D, tag: 'saham', sumber: 'saham', refId: 'sh' + id, periodeRef: tg.slice(0, 7), dicatatOleh: D, dibuat: now, riwayat: '[]' }); };
    T.Transaksi.push({ id: 'trdn1', tanggal: U.addDays(today, -400), jenis: 'transfer', jumlah: '30000000', kategoriId: '', walletId: 'w_mdr', walletTujuan: 'w_rdn', biaya: '0', catatan: 'Top up RDN', dibayarOleh: D, tag: '', sumber: 'app', refId: '', periodeRef: '', dicatatOleh: D, dibuat: now, riwayat: '[]' });
    SH(1, 380, 'BBCA', 'beli', 10, 8800, 0, { setup: 'Pullback MA20', sl: '8300', tp1: '10200', tp2: '10800' }); SH(2, 300, 'TLKM', 'beli', 20, 3700, 0, { setup: 'Swing Low Support', sl: '3000', tp1: '4200' }); SH(3, 260, 'BBRI', 'beli', 15, 5100, 0, { setup: 'Breakout ATH' }); SH(4, 200, 'BBRI', 'jual', 15, 5450, 0, { setup: 'Breakout ATH' });
    SH(5, 180, 'ASII', 'beli', 10, 5200, 0, { setup: 'Momentum' }); SH(6, 150, 'BBCA', 'beli', 5, 9300); SH(7, 120, 'ASII', 'jual', 10, 4900, 0, { setup: 'Momentum' }); SH(8, 95, 'BBCA', 'dividen', 0, 0, 405000);
    SH(9, 70, 'ANTM', 'beli', 30, 1450, 0, { setup: 'Speculative Rebound', sl: '1350', tp1: '1700', tp2: '1900' }); SH(10, 40, 'ANTM', 'jual', 15, 1690, 0, { setup: 'Speculative Rebound' }); SH(11, 20, 'TLKM', 'dividen', 0, 0, 340000); SH(12, 8, 'UNVR', 'beli', 20, 1900, 0, { setup: 'Pullback MA20', sl: '1780', tp1: '2150' });
    T.Pengaturan.push({ id: 'hargaSaham', nilai: JSON.stringify({ BBCA: [9675, U.addDays(today, -1), 'Contoh', 9600], TLKM: [3180, U.addDays(today, -1), 'Contoh', 3210], ANTM: [1725, U.addDays(today, -1), 'Contoh', 1700], UNVR: [1885, U.addDays(today, -1), 'Contoh', 1900] }) });
    // Reksa dana dicatat per aplikasi: riwayat bulanan [tanggal, nilai, total setoran]
    const RD = (id, nama, bulan, awal, setor, gerak, extra) => {
      const rw = []; let m = awal, v = awal;
      for (let k = bulan; k >= 0; k--) {
        const d = k ? U.addDays(U.addMonths(today, -k), -2) : U.addDays(today, -3);
        if (k !== bulan) { m += setor; v = Math.round((v + setor) * (1 + gerak[(bulan - k) % gerak.length])); }
        rw.push([d, v, m]);
      }
      T.Investasi.push(Object.assign({ id, kelas: 'reksadana', nama, kode: 'aplikasi', unit: '0', modal: String(m), nilai: String(v), tglNilai: U.addDays(today, -3), tanggal: rw[0][0], walletId: '', tujuanId: '', kepemilikan: '{}', jatuhTempo: '', imbal: '0', zakat: 'true', status: 'aktif', tglJual: '', hargaJual: '0', catatan: '', dibuat: now, riwayatNilai: JSON.stringify(rw) }, extra || {}));
    };
    RD('i3', 'Bibit', 14, 5000000, 1000000, [0.004, 0.005, 0.004, 0.005, 0.004, 0.004, 0.005, 0.004, 0.004, 0.005, 0.004, 0.004, 0.005, 0.004], { tujuanId: 'g_dar', kode: 'Dana Darurat', catatan: 'RD pasar uang, autodebet tgl 5', kepemilikan: JSON.stringify({ [D]: 100 }) });
    RD('i9', 'Bibit', 10, 2000000, 500000, [0.012, -0.018, 0.02, 0.009, -0.011, 0.017, 0.006, -0.008, 0.015, 0.01], { tujuanId: 'g_pdd', kode: 'Pendidikan Aisha', catatan: 'RD saham + campuran', kepemilikan: JSON.stringify({ [D]: 100 }) });
    RD('i8', 'Bibit', 8, 3000000, 500000, [0.005, 0.004, 0.006, 0.003, 0.005, 0.004, 0.006, 0.005], { kepemilikan: JSON.stringify({ [N]: 100 }), tujuanId: 'g_dar', kode: 'Dana Darurat Rini', catatan: 'RD obligasi' });
    IV('i4', 'sbn', 'Sukuk Tabungan ST011', 'ST011', 10, 10000000, 10000000, U.addMonths(today, -16), { jatuhTempo: U.addMonths(today, 8), imbal: '6.35' });
    IV('i5', 'deposito', 'Deposito BCA 6 bulan', '', 0, 20000000, 20380000, U.addMonths(today, -4), { jatuhTempo: U.addMonths(today, 2), imbal: '3.5' });
    IV('i6', 'properti', 'Rumah Bekasi', 'SHM', 90, 650000000, 780000000, U.addMonths(today, -48), { catatan: 'Ditempati sendiri, KPR BTN' });
    IV('i7', 'kendaraan', 'Toyota Avanza 2021', 'B 1234 XYZ', 0, 210000000, 165000000, U.addMonths(today, -40));
    T.Pengaturan.push({ id: 'targetAlokasi', nilai: JSON.stringify({ kas: 25, emas: 25, saham: 15, reksadana: 20, tetap: 15, lain: 0 }) });
    T.Pengaturan.push({ id: 'zakatHaul', nilai: U.addDays(today, -300) });
    T.Pengaturan.push({ id: 'zakatJiwa', nilai: '4' });
    T.Pengaturan.push({ id: 'hargaAlert', nilai: JSON.stringify({ jual: 2400000, beli: 2400000 }) });
    // Fase 3: rapat, tugas, skenario
    const bl = n => U.addMonths(today, -n).slice(0, 7) + '-01';
    [3, 2, 1].forEach((n, i) => T.Rapat.push({ id: 'rp' + n, tanggal: bl(n), jenis: 'rutin', judul: 'Rapat ' + U.tgl(bl(n), 'my'), catatan: i === 2 ? 'Fokus kurangi makan di luar. Mulai cicil dana pendidikan.' : '',
      keputusan: JSON.stringify(i === 2 ? [{ teks: 'Anggaran makan di luar turun jadi 1,2 jt', topik: 'Amplop' }, { teks: 'Tugas: Bandingkan asuransi kendaraan — Dimas', tugasId: 'tg1' }] : [{ teks: 'Setoran dana darurat tetap 1 jt/bulan', topik: 'Tujuan' }]),
      hadir: JSON.stringify([D, N]), skor: String(64 + i * 3), dibuat: bl(n) + 'T20:00:00.000Z', oleh: D }));
    T.Tugas.push({ id: 'tg1', judul: 'Bandingkan asuransi kendaraan', pj: D, tenggat: U.addDays(today, 6), selesai: 'false', rapatId: 'rp1', sumber: 'Utang', catatan: '', dibuat: bl(1) + 'T20:10:00.000Z', tglSelesai: '' });
    T.Tugas.push({ id: 'tg2', judul: 'Tutup langganan streaming yang jarang dipakai', pj: N, tenggat: U.addDays(today, -3), selesai: 'false', rapatId: 'rp1', sumber: 'Amplop', catatan: '', dibuat: bl(1) + 'T20:12:00.000Z', tglSelesai: '' });
    T.Tugas.push({ id: 'tg3', judul: 'Cek promo cicilan 0% kulkas', pj: N, tenggat: U.addDays(today, -20), selesai: 'true', rapatId: 'rp2', sumber: '', catatan: '', dibuat: bl(2) + 'T20:12:00.000Z', tglSelesai: U.addDays(today, -25) });
    T.Skenario.push({ id: 'sk1', nama: 'Kredit mobil baru 4,5 jt × 48 bln', jenis: 'cicilan', data: JSON.stringify({ jenis: 'cicilan', jumlah: 4500000, tenor: 48, mulai: U.addMonths(today, 2).slice(0, 7) + '-01', sumber: 'kas', dp: 60000000, ringkas: { dsr: 0.41, skor: 58, perHari: 61000, mundur: 2 } }), catatan: 'Ganti Avanza tahun depan?', dibuat: U.addDays(today, -12) + 'T10:00:00.000Z', oleh: D });
    tx(U.addDays(today, -6), 'keluar', 2500000, 'k_sdk', 'w_bca', 'Zakat penghasilan bulan lalu', D, { tag: 'zakat-penghasilan' });
    tx(U.addDays(today, -4), 'keluar', 200000, 'k_sdk', 'w_gopay', 'Panti Asuhan Al-Ikhlas', N, { tag: 'sedekah' });
    return T;
  }

  // ---------- Server tiruan ----------
  /** Backend tiruan di memori dengan antarmuka sama seperti Cloud (push/pull/checkVersion). */
  const DS = { log: [], ver: 0 };
  DS.init = (big) => {
    const T = buildDemo(big), now = new Date().toISOString();
    DS.log = []; DS.ver = 1;
    Object.keys(Store.SCHEMA).forEach(t => (T[t] || []).forEach(o => DS.log.push([now, 'demo', t, o.id, 'u', o])));
  };
  DS.me = () => ({ id: 'm1', nama: 'Dimas', email: 'dimas@contoh.id', peran: 'admin', warna: '#0F5E59', izin: {} });
  DS.checkVersion = async () => ({ ok: true, version: String(DS.ver) });
  DS.pull = async (cursor) => ({ ok: true, rows: DS.log.slice(cursor), cursor: DS.log.length });
  DS.push = async (ops, oleh) => {
    await new Promise(r => setTimeout(r, 40));
    const now = new Date().toISOString();
    ops.forEach(o => DS.log.push([now, oleh, o.t, o.op === 'delete' ? o.id : o.row.id, o.op === 'delete' ? 'd' : 'u', o.op === 'delete' ? '' : o.row]));
    DS.ver++; return { ok: true };
  };
  window.DemoServer = DS;
})();
