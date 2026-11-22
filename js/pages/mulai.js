/* ============================================================
 * Wizard "Mulai" — penyiapan awal keluarga baru (± 3 menit).
 * Langkah: kenalan → dompet & saldo → pemasukan rutin → tagihan rutin → goals → selesai.
 * Tiap "Lanjut" langsung menyimpan langkah itu, jadi tidak ada yang hilang bila berhenti di tengah.
 * Muncul otomatis untuk Admin pada keluarga yang masih kosong; bisa dibuka lagi dari Lainnya › Panduan Mulai.
 * ============================================================ */
(function () {
  const I = UI.icon;
  const LANGKAH = [['kenal', 'Kenalan', 'heart-handshake'], ['dompet', 'Dompet', 'wallet'], ['masuk', 'Pemasukan', 'banknote'], ['tagihan', 'Tagihan', 'calendar-days'], ['goals', 'Goals', 'target'], ['selesai', 'Selesai', 'party-popper']];
  const PRESET_W = [['BCA', 'bank'], ['Mandiri', 'bank'], ['BRI', 'bank'], ['BNI', 'bank'], ['BSI', 'bank'], ['Bank Jago', 'bank'], ['SeaBank', 'bank'], ['GoPay', 'ewallet'], ['OVO', 'ewallet'], ['DANA', 'ewallet'], ['ShopeePay', 'ewallet'], ['Kartu kredit', 'kartu']];
  const IKON_W = { bank: 'landmark', ewallet: 'smartphone', tunai: 'banknote', kartu: 'credit-card', rdn: 'chart-candlestick', lain: 'wallet' };
  const PRESET_T = [['Listrik', 'zap'], ['Internet / WiFi', 'wifi'], ['Air PDAM', 'house'], ['Pulsa & paket data', 'smartphone'], ['Cicilan rumah (KPR)', 'house'], ['Cicilan kendaraan', 'car'],
    ['SPP / sekolah anak', 'graduation-cap'], ['Asuransi', 'shield'], ['Iuran RT & kebersihan', 'users'], ['Langganan streaming', 'tv'], ['Arisan', 'users'], ['Sedekah rutin', 'hand-heart']];
  const PRESET_G = [['Dana Darurat', 'shield', 2], ['Pendidikan Anak', 'graduation-cap', 10], ['Rumah', 'house', 5], ['Umroh / Haji', 'moon-star', 5], ['Liburan Keluarga', 'plane', 1], ['Kendaraan', 'car', 3], ['Qurban', 'beef', 1]];
  let W = null;

  const awal = () => {
    const bal = Calc.balances();
    const lahir = Store.t.Transaksi.reduce((o, t) => { o[t.walletId] = 1; if (t.walletTujuan) o[t.walletTujuan] = 1; return o; }, {});
    W = { i: 0, kel: Store.setting('namaKeluarga', ''), nama: Store.me.nama || '', mulai: String(Store.setting('periodeMulai', 1) || 1),
      dompet: Store.wallets().map(w => ({ id: w.id, nama: w.nama, jenis: w.jenis, saldo: Math.round(bal[w.id] || 0), ada: true, kunci: !!lahir[w.id] })),
      masuk: [{ nama: 'Gaji ' + (Store.me.nama || ''), jumlah: 0, tanggal: '' }], tagihan: [], goals: [], hasil: { w: 0, r: 0, g: 0 } };
  };
  /** Baca semua isian [data-w="bagian.indeks.kolom"] ke W sebelum menggambar ulang / menyimpan. */
  const baca = () => document.querySelectorAll('.mw [data-w]').forEach(el => {
    const p = el.dataset.w.split('.'), v = el.dataset.rp !== undefined ? U.parseRp(el.value) : el.value;
    if (p.length === 1) W[p[0]] = v; else if (W[p[0]] && W[p[0]][+p[1]]) W[p[0]][+p[1]][p[2]] = v;
  });
  const opsiTgl = (v, kosong) => (kosong ? `<option value="">${kosong}</option>` : '') + Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${String(v) === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`).join('');
  const katKeluar = nama => (window.Kamus && Kamus.tebak(nama, 'keluar')) || ((Store.kategori('keluar').find(k => k.tetap && !k.arsip) || Store.kategori('keluar')[0]) || {}).id || '';
  const katGaji = () => ((Store.kategori('masuk').find(k => /gaji/i.test(k.nama)) || Store.kategori('masuk')[0]) || {}).id || '';
  const dompetUtama = () => { const w = Store.wallets(); return ((w.find(x => x.jenis === 'bank') || w[0]) || {}).id || ''; };
  const totalTagihan = () => U.sum(W.tagihan, x => x.jumlah || 0);

  function isi() {
    const st = LANGKAH[W.i][0];
    if (st === 'kenal') return `<div class="mw-hero">${I('wand-sparkles', 'big')}<h2>Selamat datang di SatuAtap</h2><p class="muted">Tiga menit untuk menyiapkan keuangan keluarga. Semua bisa diubah lagi nanti.</p></div>
      ${UI.field('Nama keluarga', `<input data-w="kel" maxlength="40" value="${U.esc(W.kel)}" placeholder="mis. Keluarga Yanuar">`)}
      ${UI.field('Nama panggilan Anda', `<input data-w="nama" maxlength="30" value="${U.esc(W.nama)}" placeholder="mis. Ayah, Ibu, Dimas">`, 'Tampil di sapaan Beranda dan di catatan "dibayar oleh".')}
      ${UI.field('Tanggal gajian (awal periode anggaran)', `<select data-w="mulai">${opsiTgl(W.mulai).replace(/<option value="(29|30|31)"[^<]*<\/option>/g, '')}</select>`, 'Ringkasan bulanan & "aman dibelanjakan" dihitung dari tanggal ini.')}`;
    if (st === 'dompet') return `<h3 class="mw-h">Di mana saja uang keluarga disimpan?</h3><p class="muted small">Isi saldo hari ini. Tambah rekening & dompet digital dengan sekali ketuk.</p>
      <div class="card list mw-list">${W.dompet.map((w, i) => `<div class="row mw-row"><span class="cat-ic">${I(IKON_W[w.jenis] || 'wallet')}</span>
          <div class="mw-in"><input data-w="dompet.${i}.nama" maxlength="40" value="${U.esc(w.nama)}" aria-label="Nama dompet" ${w.ada ? 'readonly' : ''}>
          ${w.kunci ? `<small class="muted">Saldo ${U.rp(w.saldo)} · sudah ada transaksi</small>` : `<div class="cs-amt"><span>Rp</span><input data-w="dompet.${i}.saldo" data-rp inputmode="numeric" value="${w.saldo ? U.fmtNum(w.saldo) : ''}" placeholder="0" aria-label="Saldo ${U.esc(w.nama)}"></div>`}</div>
          ${w.ada ? '' : `<button class="icon-btn sm" data-act="mw-del" data-k="dompet" data-i="${i}" aria-label="Hapus">${I('x')}</button>`}</div>`).join('')}</div>
      <div class="chips mw-chips">${PRESET_W.filter(p => !W.dompet.some(w => w.nama.toLowerCase() === p[0].toLowerCase())).map(p => `<button class="chip" data-act="mw-w" data-n="${p[0]}" data-j="${p[1]}">${I('plus')} ${p[0]}</button>`).join('')}<button class="chip" data-act="mw-w" data-n="" data-j="bank">${I('plus')} Lainnya</button></div>`;
    if (st === 'masuk') return `<h3 class="mw-h">Pemasukan rutin tiap bulan</h3><p class="muted small">Dipakai untuk pengingat gajian, proyeksi saldo, dan pembagian gaji ke amplop.</p>
      ${W.masuk.map((m, i) => `<div class="card mw-card"><div class="mw-card-h">${UI.field('Nama', `<input data-w="masuk.${i}.nama" maxlength="50" value="${U.esc(m.nama)}" placeholder="mis. Gaji Ayah">`)}${i ? `<button class="icon-btn sm" data-act="mw-del" data-k="masuk" data-i="${i}" aria-label="Hapus">${I('x')}</button>` : ''}</div>
        <div class="grid2">${UI.field('Jumlah / bulan', UI.rpInput('', m.jumlah).replace('<input', `<input data-w="masuk.${i}.jumlah"`))}${UI.field('Tanggal masuk', `<select data-w="masuk.${i}.tanggal">${opsiTgl(m.tanggal || W.mulai)}</select>`)}</div></div>`).join('')}
      <button class="btn ghost block" data-act="mw-add" data-k="masuk">${I('plus')} Pemasukan rutin lain (gaji pasangan, sewa, dll.)</button>`;
    if (st === 'tagihan') return `<h3 class="mw-h">Tagihan yang rutin dibayar</h3><p class="muted small">Ketuk yang ada di keluarga Anda. SatuAtap akan mengingatkan sebelum jatuh tempo.</p>
      <div class="chips mw-chips">${PRESET_T.filter(p => !W.tagihan.some(t => t.nama === p[0])).map(p => `<button class="chip" data-act="mw-t" data-n="${p[0]}">${I(p[1])} ${p[0]}</button>`).join('')}<button class="chip" data-act="mw-t" data-n="">${I('plus')} Lainnya</button></div>
      ${W.tagihan.length ? `<div class="card list mw-list">${W.tagihan.map((t, i) => `<div class="row mw-row"><div class="mw-in"><input data-w="tagihan.${i}.nama" maxlength="50" value="${U.esc(t.nama)}" placeholder="Nama tagihan" aria-label="Nama tagihan">
          <div class="mw-sub"><div class="cs-amt"><span>Rp</span><input data-w="tagihan.${i}.jumlah" data-rp inputmode="numeric" value="${t.jumlah ? U.fmtNum(t.jumlah) : ''}" placeholder="0" aria-label="Jumlah"></div>
          <label class="mw-tgl">tgl <select data-w="tagihan.${i}.tanggal" aria-label="Tanggal jatuh tempo">${opsiTgl(t.tanggal)}</select></label></div></div>
          <button class="icon-btn sm" data-act="mw-del" data-k="tagihan" data-i="${i}" aria-label="Hapus">${I('x')}</button></div>`).join('')}</div>
        <p class="muted small mw-total">Total ${U.rp(totalTagihan())} / bulan.</p>` : ''}`;
    if (st === 'goals') return `<h3 class="mw-h">Apa yang sedang ditabung keluarga?</h3><p class="muted small">Pilih satu atau beberapa goals. Setoran per bulan dihitung otomatis.</p>
      <div class="chips mw-chips">${PRESET_G.filter(p => !W.goals.some(g => g.nama === p[0])).map(p => `<button class="chip" data-act="mw-g" data-n="${p[0]}">${I(p[1])} ${p[0]}</button>`).join('')}<button class="chip" data-act="mw-g" data-n="">${I('plus')} Lainnya</button></div>
      ${W.goals.map((g, i) => { const bln = (Number(g.tahun) || 1) * 12, per = g.target ? Math.ceil(g.target / bln / 1000) * 1000 : 0;
        return `<div class="card mw-card"><div class="mw-card-h">${UI.field('Goals', `<input data-w="goals.${i}.nama" maxlength="50" value="${U.esc(g.nama)}">`)}<button class="icon-btn sm" data-act="mw-del" data-k="goals" data-i="${i}" aria-label="Hapus">${I('x')}</button></div>
          <div class="grid2">${UI.field('Target', UI.rpInput('', g.target).replace('<input', `<input data-w="goals.${i}.target"`))}${UI.field('Tercapai dalam', `<select data-w="goals.${i}.tahun">${[1, 2, 3, 4, 5, 7, 10, 15, 20].map(n => `<option value="${n}" ${String(g.tahun) === String(n) ? 'selected' : ''}>${n} tahun</option>`).join('')}</select>`)}</div>
          <small class="muted" data-per="${i}">${per ? '≈ ' + U.rp(per) + ' / bulan' : ''}</small></div>`; }).join('')}`;
    const h = W.hasil;
    return `<div class="mw-hero">${I('party-popper', 'big')}<h2>Siap dipakai!</h2><p class="muted">${[h.w ? h.w + ' dompet' : '', h.r ? h.r + ' jadwal rutin' : '', h.g ? h.g + ' goals' : ''].filter(Boolean).join(' · ') || 'Pengaturan dasar tersimpan'}.</p></div>
      <div class="card list">${[['user-plus', 'Undang pasangan', 'Catat bersama dari HP masing-masing', 'mw-ke', 'pengaturan/anggota'], ['bell', 'Pasang pengingat Telegram & WhatsApp', 'Tagihan, rapat, dan catat lewat chat', 'mw-ke', 'pengaturan/notif'],
        ['clipboard-list', 'Bagi gaji ke amplop', 'Batas belanja per kategori', 'mw-ke', 'anggaran'], ['zap', 'Catat pengeluaran pertama', 'Ketik "makan 25rb, bensin 50rb"', 'mw-catat', '']]
        .map(x => `<div class="row" data-act="${x[3]}" data-to="${x[4]}"><span class="cat-ic">${I(x[0])}</span><div class="tx-txt"><b>${x[1]}</b><small>${x[2]}</small></div>${I('chevron-right')}</div>`).join('')}</div>`;
  }

  /** Simpan langkah aktif. false = ada isian yang perlu dibetulkan. */
  async function simpan() {
    baca();
    const st = LANGKAH[W.i][0], ops = [];
    if (st === 'kenal') {
      if (W.kel.trim()) ops.push({ op: 'upsert', t: 'Pengaturan', row: { id: 'namaKeluarga', nilai: W.kel.trim() } });
      ops.push({ op: 'upsert', t: 'Pengaturan', row: { id: 'periodeMulai', nilai: String(W.mulai || 1) } });
      if (W.nama.trim() && W.nama.trim() !== Store.me.nama) { ops.push({ op: 'upsert', t: 'Anggota', row: { id: Store.me.id, nama: W.nama.trim() } }); Store.me.nama = W.nama.trim(); }
      if (W.masuk[0] && /^Gaji\s*$|^Gaji /.test(W.masuk[0].nama) && !W.masuk[0].jumlah) W.masuk[0].nama = 'Gaji ' + Store.me.nama;
    }
    if (st === 'dompet') {
      W.dompet.forEach((w, i) => {
        if (w.ada) { if (!w.kunci && Number(w.saldo) !== Number((Store.byId.Wallet[w.id] || {}).saldoAwal || 0)) ops.push({ op: 'upsert', t: 'Wallet', row: { id: w.id, saldoAwal: Number(w.saldo) || 0 } }); return; }
        if (!String(w.nama).trim()) return;
        ops.push({ op: 'upsert', t: 'Wallet', row: { id: w.id, nama: w.nama.trim(), jenis: w.jenis, pemilik: 'bersama', saldoAwal: Number(w.saldo) || 0, ikon: '', likuid: w.jenis !== 'kartu', urutan: Store.t.Wallet.length + i, arsip: false, catatan: '' } });
        w.ada = true; W.hasil.w++;
      });
    }
    const rutin = (r, jenis, kat) => ({ op: 'upsert', t: 'Rutin', row: { id: r.id || (r.id = U.uid('r')), nama: r.nama.trim(), jenis, jumlah: Number(r.jumlah) || 0, kategoriId: kat, walletId: dompetUtama(), frekuensi: 'bulanan',
      tanggal: Number(r.tanggal || W.mulai) || 1, bulan: '', mulai: U.today(), selesai: '', langganan: /streaming|langganan/i.test(r.nama), ditinjau: '', aktif: true, catatan: '' } });
    if (st === 'masuk') W.masuk.forEach(m => { if (!String(m.nama).trim() || !m.jumlah) return; if (!m.id) W.hasil.r++; ops.push(rutin(m, 'masuk', katGaji())); });
    if (st === 'tagihan') {
      if (W.tagihan.some(t => String(t.nama).trim() && !t.jumlah)) { UI.toast('Isi jumlah setiap tagihan, atau hapus yang tidak perlu.', 'warn'); return false; }
      W.tagihan.forEach(t => { if (!String(t.nama).trim()) return; if (!t.id) W.hasil.r++; ops.push(rutin(t, 'keluar', katKeluar(t.nama))); });
    }
    if (st === 'goals') W.goals.forEach((g, i) => {
      if (!String(g.nama).trim() || !g.target) return;
      const bln = (Number(g.tahun) || 1) * 12, p = PRESET_G.find(x => x[0] === g.nama);
      if (!g.id) W.hasil.g++;
      ops.push({ op: 'upsert', t: 'Tujuan', row: { id: g.id || (g.id = U.uid('g')), nama: g.nama.trim(), ikon: p ? p[1] : 'target', target: Number(g.target), tenggat: U.addMonths(U.today(), bln), prioritas: Store.t.Tujuan.length + i + 1,
        jenis: 'bersama', pemilik: '', setoranBulanan: Math.ceil(g.target / bln / 1000) * 1000, walletId: '', arsip: false, catatan: '', dibuat: new Date().toISOString() } });
    });
    if (ops.length) await Store.commit(ops);
    return true;
  }
  const lanjut = async (lewati) => {
    if (!lewati && !(await simpan())) return; if (lewati) baca();
    W.i = Math.min(LANGKAH.length - 1, W.i + 1);
    if (LANGKAH[W.i][0] === 'goals' && !W.goals.length) W.goals.push({ nama: 'Dana Darurat', target: saranDarurat(), tahun: '2' });
    UI.render(); window.scrollTo(0, 0);
  };
  /** Saran dana darurat: 6 × perkiraan pengeluaran bulanan (tagihan rutin + kebutuhan harian), dibulatkan. */
  const saranDarurat = () => { const gaji = U.sum(W.masuk, m => Number(m.jumlah) || 0), bln = Math.max(totalTagihan() * 2, gaji * 0.7, 3000000), n = Number(Store.setting('danaDaruratBulan', 6)) || 6; return Math.round(bln * n / 1e6) * 1e6; };
  const selesai = () => { Store.setSetting('wizardSelesai', '1'); W = null; };

  UI.act('mw-next', () => lanjut(false));
  UI.act('mw-skip', () => lanjut(true));
  UI.act('mw-back', () => { baca(); W.i = Math.max(0, W.i - 1); UI.render(); window.scrollTo(0, 0); });
  UI.act('mw-done', () => { selesai(); UI.go('beranda'); UI.toast('Selamat mencatat! Tekan + untuk catatan pertama.', 'ok'); });
  UI.act('mw-ke', el => { selesai(); UI.go(el.dataset.to); });
  UI.act('mw-catat', () => { selesai(); UI.go('beranda'); setTimeout(() => UI.cepat && UI.cepat(), 300); });
  UI.act('mw-w', el => { baca(); W.dompet.push({ id: U.uid('w'), nama: el.dataset.n, jenis: el.dataset.j, saldo: 0, ada: false }); UI.render(); const n = document.querySelectorAll('.mw-list [data-w$=".' + (el.dataset.n ? 'saldo' : 'nama') + '"]'); if (n.length) n[n.length - 1].focus(); });
  UI.act('mw-t', el => { baca(); W.tagihan.push({ nama: el.dataset.n, jumlah: 0, tanggal: '' }); UI.render(); const n = document.querySelectorAll('.mw-list [data-w$=".' + (el.dataset.n ? 'jumlah' : 'nama') + '"]'); if (n.length) n[n.length - 1].focus(); });
  UI.act('mw-g', el => { baca(); const p = PRESET_G.find(x => x[0] === el.dataset.n); W.goals.push({ nama: el.dataset.n, target: el.dataset.n === 'Dana Darurat' ? saranDarurat() : 0, tahun: String(p ? p[2] : 3) }); UI.render(); });
  UI.act('mw-add', el => { baca(); W[el.dataset.k].push({ nama: '', jumlah: 0, tanggal: '' }); UI.render(); });
  UI.act('mw-del', el => { baca(); W[el.dataset.k].splice(+el.dataset.i, 1); UI.render(); });

  UI.page('mulai', {
    noFab: true,
    head: () => ({ title: 'Panduan Mulai', crumb: 'Langkah ' + ((W ? W.i : 0) + 1) + ' dari ' + LANGKAH.length, back: 'beranda' }),
    nav: () => 'lainnya',
    render() {
      if (!W) awal();
      const akhir = W.i === LANGKAH.length - 1;
      return `<div class="mw">
        <div class="mw-steps">${LANGKAH.map((l, i) => `<span class="${i < W.i ? 'done' : i === W.i ? 'on' : ''}" title="${l[1]}">${I(i < W.i ? 'check' : l[2])}</span>`).join('<i></i>')}</div>
        ${isi()}
        <div class="mw-foot">${akhir ? `<button class="btn block" data-act="mw-done">${I('check')} Mulai pakai SatuAtap</button>`
          : `${W.i ? `<button class="btn ghost" data-act="mw-back" aria-label="Kembali">${I('chevron-left')}</button>` : ''}${W.i ? `<button class="btn ghost" data-act="mw-skip">Lewati</button>` : ''}<button class="btn grow" data-act="mw-next">Lanjut ${I('chevron-right')}</button>`}</div>
        <div class="spacer"></div></div>`;
    },
    after(el) {
      UI.bindRp(el);
      if (el._mw) return; el._mw = true;
      // nominal/target berubah → perbarui teks bantu tanpa menggambar ulang (agar kursor tidak lompat)
      el.addEventListener('input', e => { if (UI.cur !== 'mulai' || !W || !e.target.dataset.w) return; baca();
        const t = el.querySelector('.mw-total'); if (t) t.textContent = 'Total ' + U.rp(totalTagihan()) + ' / bulan.';
        el.querySelectorAll('[data-per]').forEach(x => { const g = W.goals[+x.dataset.per]; const bln = (Number(g && g.tahun) || 1) * 12; x.textContent = g && g.target ? '≈ ' + U.rp(Math.ceil(g.target / bln / 1000) * 1000) + ' / bulan' : ''; });
      });
      el.addEventListener('change', e => { if (UI.cur === 'mulai' && e.target.matches('select[data-w^="goals."]')) el.dispatchEvent(new Event('input', { bubbles: true })); });
    }
  });

  /** Keluarga baru yang masih kosong → buka wizard sekali (Admin saja). */
  UI.cekWizard = () => {
    if (Store.mode !== 'live' || !Store.isAdminLike() || Store.setting('wizardSelesai', '') === '1') return;
    if (Store.t.Transaksi.length || (Store.t.Rutin || []).length || (Store.t.Tujuan || []).length) return;
    if (UI.cur !== 'mulai') UI.go('mulai');
  };
})();
