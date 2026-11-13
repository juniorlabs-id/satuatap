/* ============================================================
 * Jurnal Saham — Overview · Aktivitas (Trade & Arus Kas) · Analitik · Kalkulator.
 * Akun = dompet (RDN/rekening sekuritas). Beli → aset_beli dari akun, Jual → aset_jual ke akun,
 * Dividen → pemasukan ke akun, Bea meterai Rp10.000 per hari bila nilai transaksi > Rp10 jt.
 * Posisi dihitung dengan metode harga rata-rata (biaya beli termasuk fee).
 * Harga terakhir: otomatis lewat /api/saham (bila tersedia) atau diisi manual.
 * ============================================================ */
(function () {
  const I = UI.icon, me = () => Store.me.email;
  const LEMBAR = 100, MATERAI = 10000, BATAS_MATERAI = 10000000;
  const F = { akun: '', tab: 'trade', rentang: 'bulan', aksi: '', q: '', anaRentang: 'tahun' };
  const json = (k) => { const v = Store.setting(k, ''); if (v && typeof v === 'object') return v; try { return v ? JSON.parse(v) : {}; } catch (e) { return {}; } };
  const setJson = (k, o) => Store.upsert('Pengaturan', { id: k, nilai: JSON.stringify(o) });
  const fee = () => Object.assign({ beli: 0.15, jual: 0.25, materai: true }, json('sahamFee'));
  const hargaMap = () => json('hargaSaham');
  const nm = v => U.fmtNum(Math.round(v));
  const lotTxt = l => U.fmtNum(Math.round(l * 100) / 100) + ' lot';
  const tanda = v => (v >= 0 ? '+' : '−');
  const kelasPL = v => v > 0 ? 'ok' : v < 0 ? 'bad' : 'muted';
  const akunNama = id => (Store.byId.Wallet[id] || {}).nama || 'Akun dihapus';

  // ---------- Hitung posisi ----------
  const trades = () => (Store.t.Saham || []).slice().sort((a, b) => (a.tanggal + (a.dibuat || '')).localeCompare(b.tanggal + (b.dibuat || '')));
  /** Posisi per (akun, kode) per tanggal `sampai` (opsional). Hasil: {posisi: [...], realisasi: [...], dividen, fee}. */
  Calc.saham = (sampai, akun) => {
    const pos = {}, realisasi = [], divs = [];
    let feeTot = 0, materai = 0;
    trades().forEach(t => {
      if (sampai && t.tanggal > sampai) return;
      if (akun && t.walletId !== akun) return;
      const k = t.walletId + '|' + t.kode, lb = (Number(t.lot) || 0) * LEMBAR, h = Number(t.harga) || 0, f = Number(t.fee) || 0;
      if (t.aksi === 'materai') { materai += Number(t.nominal) || MATERAI; return; }
      if (t.aksi === 'dividen') { divs.push({ t, v: Number(t.nominal) || 0 }); return; }
      const p = pos[k] = pos[k] || { kode: t.kode, walletId: t.walletId, lembar: 0, biaya: 0, mulai: t.tanggal, beli: 0 };
      feeTot += f;
      if (t.aksi === 'beli') { if (p.lembar <= 0) p.mulai = t.tanggal; p.lembar += lb; p.biaya += lb * h + f; p.beli++; }
      else if (t.aksi === 'jual' && p.lembar > 0) {
        const jual = Math.min(lb, p.lembar), avg = p.biaya / p.lembar, modal = avg * jual, hasil = jual * h - f;
        realisasi.push({ t, kode: t.kode, walletId: t.walletId, modal, hasil, pl: hasil - modal, pct: modal ? (hasil - modal) / modal : 0, avg, umur: U.diffDays(p.mulai, t.tanggal) });
        p.lembar -= jual; p.biaya -= modal; if (p.lembar <= 0) { p.lembar = 0; p.biaya = 0; }
      }
    });
    const hm = hargaMap();
    const posisi = Object.values(pos).filter(p => p.lembar > 0).map(p => {
      const hh = hm[p.kode], last = hh && Number(hh[0]) || 0, avg = p.biaya / p.lembar, nilai = last ? last * p.lembar : p.biaya;
      return Object.assign(p, { avg, last, nilai, pl: nilai - p.biaya, pct: p.biaya ? (nilai - p.biaya) / p.biaya : 0, prev: hh && Number(hh[3]) || 0, tglHarga: hh && hh[1] || '', sumber: hh && hh[2] || '' });
    }).sort((a, b) => b.nilai - a.nilai);
    return { posisi, realisasi, dividen: divs, fee: feeTot, materai };
  };
  /** Posisi saham → item virtual untuk kekayaan bersih, zakat & alokasi (lewat Calc.investasi). */
  Calc.sahamItems = () => Calc.saham().posisi.map(p => {
    const w = Store.byId.Wallet[p.walletId] || {}, pemilik = w.pemilik && w.pemilik !== 'bersama' ? w.pemilik : '';
    return { x: { id: 'sh:' + p.walletId + ':' + p.kode, kelas: 'saham', nama: p.kode, kode: p.kode, unit: p.lembar, modal: Math.round(p.biaya), nilai: Math.round(p.nilai), tglNilai: p.tglHarga, tanggal: p.mulai, walletId: p.walletId, tujuanId: '', kepemilikan: pemilik ? { [pemilik]: 100 } : {}, zakat: true, status: 'aktif', virtual: true }, nilai: p.nilai, modal: p.biaya, untung: p.pl, pct: p.pct, basi: !p.tglHarga || U.diffDays(p.tglHarga, U.today()) > 45 };
  });
  const akunList = () => { const ids = Array.from(new Set(trades().map(t => t.walletId))); return ids.filter(id => Store.byId.Wallet[id]).map(id => Store.byId.Wallet[id]); };

  // ---------- Harga ----------
  const simpanHarga = (obj) => setJson('hargaSaham', Object.assign({}, hargaMap(), obj));
  const ambilHarga = async (diam) => {
    const kode = Array.from(new Set(Calc.saham().posisi.map(p => p.kode)));
    if (!kode.length) return false;
    if (Store.mode === 'demo') {
      const o = {}; kode.forEach(k => { const h = hargaMap()[k]; const base = h ? Number(h[0]) : 1000; const nb = Math.round(base * (1 + (Math.random() - 0.48) * 0.02) / 5) * 5; o[k] = [nb, U.today(), 'Contoh', base]; });
      simpanHarga(o); if (!diam) UI.toast('Harga contoh diperbarui.'); return true;
    }
    try {
      const r = await fetch('/api/saham?k=' + encodeURIComponent(kode.join(',')), { cache: 'no-store' });
      const j = await r.json();
      if (!j || !j.ok || !j.data) throw new Error((j && j.message) || 'Harga tidak tersedia');
      const o = {}; let n = 0;
      Object.keys(j.data).forEach(k => { const d = j.data[k]; if (d && d.harga) { o[k] = [d.harga, d.tanggal || U.today(), 'Yahoo Finance', d.prev || 0]; n++; } });
      if (!n) throw new Error('Harga tidak ditemukan');
      simpanHarga(o); if (!diam) UI.toast(n + ' harga saham diperbarui.'); return true;
    } catch (e) { if (!diam) UI.toast('Harga otomatis belum tersedia — isi manual.', 'warn'); return false; }
  };
  UI.act('sh-harga', async () => { if (!(await ambilHarga())) hargaManual(); });
  UI.act('sh-harga-manual', () => hargaManual());
  function hargaManual() {
    const ps = Calc.saham().posisi, kode = Array.from(new Set(ps.map(p => p.kode)));
    if (!kode.length) return UI.toast('Belum ada saham yang dipegang.', 'warn');
    const hm = hargaMap();
    const s = UI.sheet({ title: 'Harga terakhir', cls: 'small', body: `<p class="muted small">Isi harga penutupan terakhir per lembar (lihat di aplikasi sekuritas).</p>
      ${kode.map(k => UI.field(k + (hm[k] ? ` <small class="muted">· ${U.rp(hm[k][0])} (${U.tgl(hm[k][1], 'dm')})</small>` : ''), UI.rpInput('h_' + k, 0, hm[k] ? U.fmtNum(hm[k][0]) : 'harga per lembar'))).join('')}`,
      foot: `<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el), o = {}; kode.forEach(k => { if (f['h_' + k]) o[k] = [f['h_' + k], U.today(), 'Manual', hm[k] ? hm[k][0] : 0]; });
      if (!Object.keys(o).length) return UI.toast('Belum ada harga yang diisi.', 'warn');
      simpanHarga(o); s.close(); UI.toast('Harga disimpan.');
    };
  }

  // ---------- Form transaksi ----------
  const katCari = (jenis, re) => (Store.t.Kategori || []).find(k => k.jenis === jenis && !k.arsip && re.test(k.nama));
  UI.sahamForm = (t, pre) => {
    const isNew = !t; pre = pre || {};
    const ws = Store.wallets().slice().sort((a, b) => (b.jenis === 'rdn') - (a.jenis === 'rdn'));
    if (!ws.length) return UI.toast('Tambahkan dompet/RDN dulu di Kas & Bank.', 'warn');
    const lastAkun = localStorage.getItem('sa:shAkun');
    t = t || { id: U.uid('sh'), tanggal: U.today(), kode: pre.kode || '', aksi: pre.aksi || 'beli', lot: 0, harga: 0, fee: 0, nominal: 0, walletId: pre.walletId || (ws.find(w => w.id === lastAkun) || ws[0]).id, catatan: '', dibuat: new Date().toISOString(), txId: '', oleh: me() };
    const kodeAda = Array.from(new Set(trades().map(x => x.kode))).sort();
    const s = UI.sheet({ title: isNew ? 'Catat transaksi saham' : 'Ubah transaksi saham', body: `
      ${UI.seg('aksi', [['beli', 'Beli'], ['jual', 'Jual'], ['dividen', 'Dividen']], t.aksi)}
      <div class="grid2">${UI.field('Kode saham', `<input name="kode" maxlength="6" value="${U.esc(t.kode)}" placeholder="BBCA" list="sh-kode" autocapitalize="characters" class="up"><datalist id="sh-kode">${kodeAda.map(k => `<option value="${k}">`).join('')}</datalist>`)}${UI.field('Tanggal', `<input type="date" name="tanggal" value="${t.tanggal}">`)}</div>
      ${UI.field('Akun / RDN', `<select name="walletId">${ws.map(w => `<option value="${w.id}" ${w.id === t.walletId ? 'selected' : ''}>${U.esc(w.nama)}${w.jenis === 'rdn' ? ' · RDN' : ''}</option>`).join('')}</select>`, 'Uang beli diambil dari akun ini; hasil jual & dividen masuk ke sini.')}
      <div data-trade><div class="grid2">${UI.field('Jumlah lot', `<input type="number" name="lot" min="1" step="1" inputmode="numeric" value="${t.lot || ''}" placeholder="1 lot = 100 lembar">`)}${UI.field('Harga per lembar', UI.rpInput('harga', t.harga))}</div>
        ${UI.field('Fee broker', UI.rpInput('fee', t.fee), '')}<div class="sh-hint"></div></div>
      <div data-div>${UI.field('Dividen diterima (bersih)', UI.rpInput('nominal', t.nominal), 'Setelah pajak dividen.')}</div>
      ${UI.field('Catatan', `<input name="catatan" maxlength="120" value="${U.esc(t.catatan)}" placeholder="alasan beli/jual, rencana TP/SL">`)}`,
      foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${I('trash-2')}</button>`}<button class="btn" data-ok>${I('check')} Simpan</button>` });
    UI.bindRp(s.el);
    let feeManual = !isNew;
    const hint = s.el.querySelector('.sh-hint'), feeIn = s.el.querySelector('[name=fee]');
    feeIn.addEventListener('input', () => { feeManual = true; });
    const sync = (ev) => {
      const v = UI.formData(s.el); v.kode = String(v.kode || '').toUpperCase().trim();
      s.el.querySelector('[data-trade]').hidden = v.aksi === 'dividen'; s.el.querySelector('[data-div]').hidden = v.aksi !== 'dividen';
      const lb = (Number(v.lot) || 0) * LEMBAR, nilai = lb * (v.harga || 0), fp = fee();
      if (!feeManual || (ev && ev.target && ev.target.name === 'aksi')) { feeManual = false; feeIn.value = nilai ? U.fmtNum(Math.round(nilai * (v.aksi === 'jual' ? fp.jual : fp.beli) / 100)) : ''; }
      const fe = U.parseRp(feeIn.value);
      const pos = Calc.saham(v.tanggal, v.walletId).posisi.find(p => p.kode === v.kode && (isNew || true));
      let h = '';
      if (nilai) h += `<div class="kv"><span>${v.aksi === 'jual' ? 'Uang diterima' : 'Total bayar'}</span><b>${U.rp(v.aksi === 'jual' ? nilai - fe : nilai + fe)}</b></div>`;
      if (v.aksi === 'beli' && pos && lb) { const avgB = (pos.biaya + nilai + fe) / (pos.lembar + lb); h += `<div class="kv muted"><span>Harga rata-rata baru</span><b>${U.rp(Math.round(pos.avg))} → ${U.rp(Math.round(avgB))}</b></div>`; }
      if (v.aksi === 'jual') {
        if (!pos) h += v.kode ? `<div class="kv bad"><span>Tidak ada ${U.esc(v.kode)} di akun ini</span></div>` : '';
        else { const pl = lb ? (nilai - fe) - pos.avg * Math.min(lb, pos.lembar) : 0;
          h += `<div class="kv muted"><span>Dipegang</span><b>${lotTxt(pos.lembar / LEMBAR)} · rata-rata ${U.rp(Math.round(pos.avg))}</b></div>` + (lb ? `<div class="kv"><span>Untung/rugi</span><b class="${kelasPL(pl)}">${tanda(pl)}${U.rp(Math.abs(Math.round(pl)))} (${U.pct(Math.abs(pl) / (pos.avg * Math.min(lb, pos.lembar) || 1), 1)})</b></div>` : '') +
            (lb > pos.lembar ? `<div class="kv bad"><span>Melebihi jumlah yang dipegang</span></div>` : ''); }
      }
      hint.innerHTML = h;
    };
    s.el.addEventListener('input', sync); s.el.addEventListener('change', sync); sync();
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el); v.kode = String(v.kode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!/^[A-Z]{4}[A-Z0-9]?$/.test(v.kode)) return UI.toast('Kode saham 4 huruf, mis. BBCA.', 'warn');
      const row = Object.assign({}, t, { tanggal: v.tanggal || U.today(), kode: v.kode, aksi: v.aksi, walletId: v.walletId, catatan: v.catatan || '' });
      if (v.aksi === 'dividen') { if (!v.nominal) return UI.toast('Isi nominal dividen.', 'warn'); Object.assign(row, { lot: 0, harga: 0, fee: 0, nominal: v.nominal }); }
      else {
        const lot = Math.round(Number(v.lot) || 0); if (lot < 1 || !v.harga) return UI.toast('Isi jumlah lot dan harga.', 'warn');
        Object.assign(row, { lot, harga: v.harga, fee: U.parseRp(feeIn.value), nominal: 0 });
        if (v.aksi === 'jual') { const pos = Calc.saham(row.tanggal, row.walletId).posisi.find(p => p.kode === row.kode); const punya = (pos ? pos.lembar : 0) + (!isNew && t.aksi === 'jual' && t.kode === row.kode && t.walletId === row.walletId ? (Number(t.lot) || 0) * LEMBAR : 0); if (lot * LEMBAR > punya) return UI.toast('Jumlah jual melebihi yang dipegang (' + lotTxt(punya / LEMBAR) + ').', 'warn'); }
      }
      localStorage.setItem('sa:shAkun', row.walletId);
      const ops = opsTrade(row, isNew ? null : t);
      Store.commit(ops.concat(cekMaterai(row, isNew)));
      s.close(); UI.toast(v.aksi === 'dividen' ? 'Dividen ' + row.kode + ' dicatat.' : (v.aksi === 'beli' ? 'Beli ' : 'Jual ') + row.kode + ' ' + lotTxt(row.lot) + ' dicatat.');
    };
    const d = s.el.querySelector('[data-del]');
    if (d) d.onclick = async () => { if (await UI.confirm('Hapus transaksi ' + t.kode + '?', 'Transaksi uang yang terkait ikut dihapus, saldo akun kembali seperti semula.', 'Hapus', true)) { Store.commit(hapusOps(t)); s.close(); } };
  };
  /** Baris Saham + baris Transaksi (uang) yang selalu berpasangan lewat txId. */
  function opsTrade(row, lama) {
    const now = new Date().toISOString(), txId = (lama && lama.txId) || U.uid('t');
    row.txId = txId;
    const base = { id: txId, tanggal: row.tanggal, walletId: row.walletId, walletTujuan: '', biaya: 0, dibayarOleh: row.oleh || me(), tag: 'saham', sumber: 'saham', refId: row.id, periodeRef: row.tanggal.slice(0, 7), dicatatOleh: me(), dibuat: now, riwayat: [] };
    let tx;
    if (row.aksi === 'beli') tx = Object.assign(base, { jenis: 'aset_beli', jumlah: Math.round(row.lot * LEMBAR * row.harga + row.fee), kategoriId: '', catatan: `Beli ${row.kode} ${row.lot} lot @ ${nm(row.harga)}` });
    else if (row.aksi === 'jual') tx = Object.assign(base, { jenis: 'aset_jual', jumlah: Math.round(row.lot * LEMBAR * row.harga - row.fee), kategoriId: '', catatan: `Jual ${row.kode} ${row.lot} lot @ ${nm(row.harga)}` });
    else { const k = katCari('masuk', /divid|investasi|pasif|pemasukan lain/i); tx = Object.assign(base, { jenis: 'masuk', jumlah: Math.round(row.nominal), kategoriId: k ? k.id : '', catatan: `Dividen ${row.kode}` }); }
    return [{ op: 'upsert', t: 'Saham', row }, { op: 'upsert', t: 'Transaksi', row: tx }];
  }
  const hapusOps = t => [{ op: 'delete', t: 'Saham', id: t.id }].concat(t.txId && Store.byId.Transaksi[t.txId] ? [{ op: 'delete', t: 'Transaksi', id: t.txId }] : []);
  /** Bea meterai Rp10.000 sekali per hari per akun bila total nilai transaksi hari itu > Rp10 juta. */
  function cekMaterai(row, isNew) {
    if (!fee().materai || row.aksi === 'dividen') return [];
    const hari = trades().filter(x => x.tanggal === row.tanggal && x.walletId === row.walletId && x.id !== row.id && (x.aksi === 'beli' || x.aksi === 'jual')).concat([row]);
    if (trades().some(x => x.aksi === 'materai' && x.tanggal === row.tanggal && x.walletId === row.walletId)) return [];
    const tot = U.sum(hari, x => (Number(x.lot) || 0) * LEMBAR * (Number(x.harga) || 0));
    if (tot <= BATAS_MATERAI) return [];
    const id = U.uid('sh'), txId = U.uid('t'), k = katCari('keluar', /admin|biaya|investasi/i), now = new Date().toISOString();
    return [{ op: 'upsert', t: 'Saham', row: { id, tanggal: row.tanggal, kode: '-', aksi: 'materai', lot: 0, harga: 0, fee: 0, nominal: MATERAI, walletId: row.walletId, catatan: 'Bea meterai (transaksi harian > Rp10 jt)', dibuat: now, txId, oleh: me() } },
      { op: 'upsert', t: 'Transaksi', row: { id: txId, tanggal: row.tanggal, jenis: 'keluar', jumlah: MATERAI, kategoriId: k ? k.id : '', walletId: row.walletId, walletTujuan: '', biaya: 0, catatan: 'Bea meterai saham', dibayarOleh: me(), tag: 'saham', sumber: 'saham', refId: id, periodeRef: row.tanggal.slice(0, 7), dicatatOleh: me(), dibuat: now, riwayat: [] } }];
  }
  UI.act('sh-catat', el => UI.sahamForm(null, el && el.dataset ? { kode: el.dataset.kode, aksi: el.dataset.aksi, walletId: el.dataset.akun } : {}));
  UI.act('sh-edit', el => { const t = (Store.t.Saham || []).find(x => x.id === el.dataset.id); if (!t) return; if (t.aksi === 'materai') { UI.confirm('Hapus bea meterai?', U.tgl(t.tanggal) + ' · ' + akunNama(t.walletId), 'Hapus', true).then(ok => ok && Store.commit(hapusOps(t))); return; } UI.sahamForm(t); });

  // ---------- Pengaturan fee ----------
  UI.act('sh-set', () => {
    const f = fee();
    const s = UI.sheet({ title: 'Pengaturan saham', cls: 'small', body: `
      <div class="grid2">${UI.field('Fee beli (%)', `<input type="number" step="0.01" min="0" name="beli" value="${f.beli}">`)}${UI.field('Fee jual (%)', `<input type="number" step="0.01" min="0" name="jual" value="${f.jual}">`)}</div>
      <p class="muted small">Umumnya 0,15% beli & 0,25% jual (termasuk PPh final 0,1%). Cek di aplikasi sekuritas Anda.</p>
      <label class="check"><input type="checkbox" name="materai" ${f.materai ? 'checked' : ''}><span>Catat bea meterai Rp10.000 otomatis bila transaksi sehari &gt; Rp10 juta</span></label>
      <a class="link" data-act="sh-harga-manual">${I('pencil')} Isi harga terakhir secara manual</a>`, foot: `<button class="btn" data-ok>Simpan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => { const v = UI.formData(s.el); setJson('sahamFee', { beli: Number(v.beli) || 0, jual: Number(v.jual) || 0, materai: !!v.materai }); s.close(); UI.toast('Tersimpan.'); };
  });

  // ---------- Grafik kecil ----------
  const barPN = (rows) => {
    const W = 340, H = 140, pad = { l: 6, r: 6, t: 14, b: 22 }, max = Math.max(1, ...rows.map(r => Math.abs(r.v)));
    const gw = (W - pad.l - pad.r) / rows.length, bw = Math.min(18, gw * 0.56), mid = pad.t + (H - pad.t - pad.b) / 2, sc = (H - pad.t - pad.b) / 2 / max;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart rd-bars" role="img" aria-label="Untung rugi per bulan"><line x1="${pad.l}" x2="${W - pad.r}" y1="${mid}" y2="${mid}" class="grid"/>`;
    rows.forEach((r, i) => { const cx = pad.l + gw * i + gw / 2, h = Math.max(r.v ? 2 : 0, Math.abs(r.v) * sc);
      s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(r.v >= 0 ? mid - h : mid).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" class="${r.v >= 0 ? 'naik' : 'turun'}"/>`;
      if (rows.length <= 6 || i % 2 === (rows.length - 1) % 2) s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="axis${i === rows.length - 1 ? ' strong' : ''}">${U.esc(r.label)}</text>`; });
    return s + '</svg>';
  };
  const WARNA = ['#0F5E59', '#E0A23A', '#2E8C84', '#7A5CC0', '#C2553D', '#3D7FC2', '#5B7A78', '#9C6B1E', '#4E9F6E', '#B04A7A'];

  // ---------- Halaman ----------
  const TABS = () => `<div class="sh-tabs">${[['', 'layout-grid', 'Overview'], ['aktivitas', 'list', 'Aktivitas'], ['analitik', 'chart-column', 'Analitik'], ['kalkulator', 'calculator', 'Kalkulator']].map(t => `<a class="sh-tab ${(UI.param || '') === t[0] ? 'on' : ''}" href="#/saham${t[0] ? '/' + t[0] : ''}">${I(t[1])}<span>${t[2]}</span></a>`).join('')}</div>`;
  const akunChips = () => { const ak = akunList(); return ak.length > 1 ? `<div class="chips sm scroll">${[['', 'Semua akun']].concat(ak.map(w => [w.id, w.nama])).map(a => `<button class="chip ${F.akun === a[0] ? 'on' : ''}" data-act="sh-akun" data-v="${a[0]}">${U.esc(a[1])}</button>`).join('')}</div>` : ''; };
  UI.act('sh-akun', el => { F.akun = el.dataset.v; UI.render(); });

  UI.page('saham', {
    head: p => ({ title: { aktivitas: 'Aktivitas Saham', analitik: 'Analitik Saham', kalkulator: 'Kalkulator Rata-rata' }[p] || 'Saham', crumb: 'Aset', back: p ? 'saham' : 'aset',
      right: `<button class="icon-btn" data-act="sh-set" aria-label="Pengaturan saham">${I('sliders-horizontal')}</button><button class="icon-btn" data-act="sh-catat" aria-label="Catat transaksi">${I('plus')}</button>` }),
    nav: () => 'aset',
    render(p) {
      if (!Store.can('aset', 'lihat')) return UI.empty('lock', 'Tidak ada akses', 'Minta Admin memberi izin menu Aset.');
      const body = p === 'aktivitas' ? aktivitas() : p === 'analitik' ? analitik() : p === 'kalkulator' ? kalkulator() : overview();
      return (UI.invTiles ? UI.invTiles('saham') : '') + TABS() + body + '<div class="spacer"></div>';
    },
    after(v, p) { if (p === 'kalkulator') kalkHitung(); if (!p) UI.sahamAutoHarga(); }
  });

  function overview() {
    const r = Calc.saham(null, F.akun || null), ps = r.posisi;
    const lama = Calc.investasiManual ? Calc.investasiManual('saham') : [];
    if (!ps.length && !(Store.t.Saham || []).length) return `<div class="card">${UI.empty('chart-candlestick', 'Mulai jurnal saham', 'Catat setiap beli, jual & dividen. Harga rata-rata, untung/rugi, win rate dan bea meterai dihitung otomatis.', `<button class="btn" data-act="sh-catat">${I('plus')} Catat transaksi pertama</button>`)}</div>${legacy(lama)}`;
    const nilai = U.sum(ps, x => x.nilai), modal = U.sum(ps, x => x.biaya), pl = nilai - modal, th = U.today().slice(0, 4);
    const realTh = U.sum(r.realisasi.filter(x => x.t.tanggal.slice(0, 4) === th), x => x.pl), divTh = U.sum(r.dividen.filter(x => x.t.tanggal.slice(0, 4) === th), x => x.v);
    const harian = U.sum(ps.filter(x => x.prev && x.last), x => (x.last - x.prev) * x.lembar);
    const tgl = ps.map(x => x.tglHarga).filter(Boolean).sort()[0], b = Calc.balances(), kas = U.sum(akunList().filter(w => !F.akun || w.id === F.akun), w => b[w.id] || 0);
    const parts = ps.slice(0, 8).map((x, i) => ({ v: x.nilai, color: WARNA[i % WARNA.length], label: x.kode })).concat(ps.length > 8 ? [{ v: U.sum(ps.slice(8), x => x.nilai), color: 'var(--muted)', label: 'Lainnya' }] : []);
    return `${akunChips()}
      <div class="hero rd-hero sh-hero">
        <div class="hero-top"><small>${I('chart-candlestick')} Nilai portofolio saham</small><button class="icon-btn sm on-dark" data-act="toggle-hide" aria-label="Sembunyikan angka">${I(UI.hide() ? 'eye-off' : 'eye')}</button></div>
        <div class="rd-big">${UI.m(nilai)}</div>
        <div class="rd-pill ${pl >= 0 ? 'naik' : 'turun'}">${I(pl >= 0 ? 'arrow-up-right' : 'arrow-down-left')} ${tanda(pl)}${UI.ms(Math.abs(pl))} (${tanda(pl)}${U.pct(Math.abs(modal ? pl / modal : 0), 2)}) <span>belum terealisasi</span></div>
        <div class="rd-split sh-split"><div><small>Hari ini</small><b class="${harian >= 0 ? 'naik' : 'turun'}">${harian ? tanda(harian) + UI.ms(Math.abs(harian)) : '—'}</b></div><div><small>Realisasi ${th}</small><b class="${realTh >= 0 ? 'naik' : 'turun'}">${tanda(realTh)}${UI.ms(Math.abs(realTh))}</b></div><div><small>Dividen ${th}</small><b class="naik">${UI.ms(divTh)}</b></div><div><small>Kas di akun</small><b>${UI.ms(kas)}</b></div></div>
        <button class="btn on-dark block" data-act="sh-harga">${I('refresh-cw')} Perbarui harga${tgl ? ' · ' + U.relDay(tgl).toLowerCase() : ''}</button>
      </div>
      ${ps.length ? `<div class="card donut-card">${Charts.donut(parts, ['Saham', ps.length + ' emiten'])}<ul class="legend">${parts.map(x => `<li><i style="background:${x.color}"></i>${U.esc(x.label)}<b>${U.pct(nilai ? x.v / nilai : 0)}</b></li>`).join('')}</ul></div>` : ''}
      ${UI.sec('Posisi', `<small class="muted">${ps.length} emiten</small>`)}
      <div class="card list sh-pos">${ps.map(x => `<div class="row" data-act="sh-open" data-kode="${x.kode}" data-akun="${x.walletId}">
          <span class="sh-kode">${U.esc(x.kode)}</span>
          <div class="tx-txt"><b>${lotTxt(x.lembar / LEMBAR)} · avg ${nm(x.avg)}</b><small>${x.last ? 'harga ' + nm(x.last) + (x.prev ? ` <span class="${kelasPL(x.last - x.prev)}">${tanda(x.last - x.prev)}${U.pct(Math.abs((x.last - x.prev) / x.prev), 1)}</span>` : '') : '<span class="bad">harga belum diisi</span>'}${akunList().length > 1 && !F.akun ? ' · ' + U.esc(akunNama(x.walletId)) : ''}</small></div>
          <div class="tx-amt"><b>${UI.ms(x.nilai)}</b><small class="${kelasPL(x.pl)}">${tanda(x.pl)}${UI.ms(Math.abs(x.pl))} · ${U.pct(Math.abs(x.pct), 1)}</small></div></div>`).join('') || '<div class="row muted">Tidak ada posisi terbuka.</div>'}</div>
      <div class="row-btns"><button class="btn ghost" data-act="sh-catat" data-aksi="beli">${I('plus')} Beli</button><button class="btn ghost" data-act="sh-catat" data-aksi="jual">${I('minus')} Jual</button><button class="btn ghost" data-act="sh-catat" data-aksi="dividen">${I('coins')} Dividen</button></div>
      ${legacy(lama)}
      <p class="muted small">Harga ${ps.some(x => x.sumber === 'Manual') ? 'diisi manual' : 'otomatis'} · nilai & untung/rugi hanya catatan, bukan rekomendasi investasi.</p>`;
  }
  function legacy(lama) {
    if (!lama.length) return '';
    return UI.sec('Dicatat manual (versi lama)') + `<div class="card list">${lama.map(i => `<div class="row" data-act="inv-open" data-id="${i.x.id}"><span class="sh-kode muted">${U.esc(i.x.kode || '—')}</span><div class="tx-txt"><b>${U.esc(i.x.nama)}</b><small>${U.fmtNum(i.x.unit || 0)} lembar · modal ${UI.ms(i.modal)}</small></div><button class="btn xs ghost" data-act="sh-pindah" data-id="${i.x.id}">Pindah ke jurnal</button></div>`).join('')}</div>`;
  }
  UI.act('sh-pindah', async el => {
    const x = Store.byId.Investasi[el.dataset.id]; if (!x) return;
    const ws = Store.wallets().slice().sort((a, b) => (b.jenis === 'rdn') - (a.jenis === 'rdn'));
    const lem = Number(x.unit) || 0, lot = Math.round(lem / LEMBAR);
    if (!lot || !/^[A-Z]{4}/.test(String(x.kode || '').toUpperCase())) return UI.toast('Isi kode saham (mis. BBCA) dan jumlah lembar dulu di catatan lama.', 'warn', { ms: 5000 });
    const s = UI.sheet({ title: 'Pindahkan ' + x.kode + ' ke jurnal', cls: 'small', body: `<p class="muted">${lotTxt(lot)} dengan harga rata-rata ${U.rp(Math.round((x.modal || 0) / lem))} dicatat sebagai pembelian awal tanggal ${U.tgl(x.tanggal)}. Saldo dompet tidak berubah.</p>
      ${UI.field('Akun / RDN', `<select name="walletId">${ws.map(w => `<option value="${w.id}">${U.esc(w.nama)}</option>`).join('')}</select>`)}`, foot: `<button class="btn" data-ok>Pindahkan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el), now = new Date().toISOString();
      const row = { id: U.uid('sh'), tanggal: x.tanggal || U.today(), kode: String(x.kode).toUpperCase().slice(0, 5), aksi: 'beli', lot, harga: Math.round((x.modal || 0) / (lot * LEMBAR)), fee: 0, nominal: 0, walletId: v.walletId, catatan: 'Saldo awal dari catatan lama', dibuat: now, txId: '', oleh: me() };
      Store.commit([{ op: 'upsert', t: 'Saham', row }, { op: 'delete', t: 'Investasi', id: x.id }]);
      if (x.nilai && lem && !hargaMap()[row.kode]) simpanHarga({ [row.kode]: [Math.round(x.nilai / lem), x.tglNilai || U.today(), 'Manual', 0] });
      s.close(); UI.toast(row.kode + ' dipindah ke jurnal.');
    };
  });

  UI.act('sh-open', el => {
    const kode = el.dataset.kode, akun = el.dataset.akun, p = Calc.saham(null, akun).posisi.find(x => x.kode === kode);
    const tr = trades().filter(t => t.kode === kode && t.walletId === akun).reverse();
    const r = Calc.saham(null, akun), real = U.sum(r.realisasi.filter(x => x.kode === kode), x => x.pl), div = U.sum(r.dividen.filter(x => x.t.kode === kode), x => x.v);
    const s = UI.sheet({ title: kode + ' · ' + akunNama(akun), body: (p ? `
      <div class="detail-head"><span class="sh-kode lg">${U.esc(kode)}</span><div><small class="muted">${lotTxt(p.lembar / LEMBAR)} (${U.fmtNum(p.lembar)} lembar)</small><div class="big-amt">${UI.m(p.nilai)}</div>
        <small class="${kelasPL(p.pl)}">${tanda(p.pl)}${UI.m(Math.abs(p.pl))} (${U.pct(Math.abs(p.pct), 2)})</small></div></div>
      <div class="kv-list"><div class="kv"><span>Harga rata-rata</span><b>${U.rp(Math.round(p.avg))}</b></div><div class="kv"><span>Harga terakhir</span><b>${p.last ? U.rp(p.last) + ' · ' + U.tgl(p.tglHarga, 'dm') : '—'}</b></div>
        <div class="kv"><span>Modal</span><b>${U.rp(Math.round(p.biaya))}</b></div>${real ? `<div class="kv"><span>Untung/rugi terealisasi</span><b class="${kelasPL(real)}">${tanda(real)}${U.rp(Math.abs(Math.round(real)))}</b></div>` : ''}${div ? `<div class="kv"><span>Dividen diterima</span><b class="ok">${U.rp(div)}</b></div>` : ''}
        <div class="kv"><span>Dipegang sejak</span><b>${U.tgl(p.mulai)} · ${U.diffDays(p.mulai, U.today())} hari</b></div></div>` : `<p class="muted">Posisi ${kode} sudah ditutup.</p>`) + `
      <h4 class="mini-h">Riwayat ${kode}</h4><div class="list">${tr.map(rowTrade).join('')}</div>`,
      foot: `<button class="btn ghost" data-a="kalk">${I('calculator')}</button><button class="btn ghost" data-a="jual">${I('minus')} Jual</button><button class="btn" data-a="beli">${I('plus')} Beli</button>` });
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { s.close(); if (b.dataset.a === 'kalk') { K.kode = kode; K.akun = akun; UI.go('saham/kalkulator'); } else UI.sahamForm(null, { kode, aksi: b.dataset.a, walletId: akun }); });
  });

  // ---------- Aktivitas ----------
  const realMap = () => { const m = {}; Calc.saham().realisasi.forEach(x => m[x.t.id] = x); return m; };
  function rowTrade(t) {
    const rm = rowTrade.rm || realMap(), x = rm[t.id];
    const ic = { beli: ['arrow-down-left', 'buy'], jual: ['arrow-up-right', 'sell'], dividen: ['coins', 'div'], materai: ['stamp', 'fee'] }[t.aksi] || ['circle', ''];
    const nilai = t.aksi === 'dividen' || t.aksi === 'materai' ? Number(t.nominal) : t.lot * LEMBAR * t.harga;
    return `<div class="row sh-tr" data-act="sh-edit" data-id="${t.id}"><span class="sh-ic ${ic[1]}">${I(ic[0])}</span>
      <div class="tx-txt"><b>${t.aksi === 'materai' ? 'Bea meterai' : `${t.aksi === 'beli' ? 'Beli' : t.aksi === 'jual' ? 'Jual' : 'Dividen'} ${U.esc(t.kode)}`}${t.lot ? ` <small class="muted">${lotTxt(t.lot)} @ ${nm(t.harga)}</small>` : ''}</b>
        <small>${U.tgl(t.tanggal, 'dm')} · ${U.esc(akunNama(t.walletId))}${t.fee ? ' · fee ' + nm(t.fee) : ''}${t.catatan && t.aksi !== 'materai' ? ' · ' + U.esc(t.catatan) : ''}</small></div>
      <div class="tx-amt"><b class="${t.aksi === 'beli' || t.aksi === 'materai' ? '' : 'ok'}">${t.aksi === 'beli' || t.aksi === 'materai' ? '−' : '+'}${UI.ms(nilai + (t.aksi === 'beli' ? Number(t.fee) || 0 : t.aksi === 'jual' ? -(Number(t.fee) || 0) : 0))}</b>${x ? `<small class="${kelasPL(x.pl)}">${tanda(x.pl)}${UI.ms(Math.abs(x.pl))} · ${U.pct(Math.abs(x.pct), 1)}</small>` : ''}</div></div>`;
  }
  const RENTANG = [['bulan', 'Bulan ini'], ['3b', '3 bulan'], ['tahun', 'Tahun ini'], ['semua', 'Semua']];
  const dariRentang = r => r === 'bulan' ? U.today().slice(0, 7) + '-01' : r === '3b' ? U.addMonths(U.today(), -3) : r === 'tahun' ? U.today().slice(0, 4) + '-01-01' : '0000';
  ['sh-tab2', 'sh-rentang', 'sh-aksi', 'sh-ana'].forEach(a => UI.act(a, el => { const k = { 'sh-tab2': 'tab', 'sh-rentang': 'rentang', 'sh-aksi': 'aksi', 'sh-ana': 'anaRentang' }[a]; F[k] = F[k] === el.dataset.v && a === 'sh-aksi' ? '' : el.dataset.v; UI.render(); }));
  UI.act('sh-q', U.debounce(el => { F.q = el.value.toUpperCase(); const l = document.getElementById('sh-act'); if (l) l.innerHTML = daftarAktivitas(); }, 200));
  function daftarAktivitas() {
    const dari = dariRentang(F.rentang);
    if (F.tab === 'kas') {
      const ak = akunList().map(w => w.id).filter(id => !F.akun || id === F.akun);
      const tx = Calc.txSorted().filter(t => t.tanggal >= dari && (t.jenis === 'transfer' && (ak.indexOf(t.walletId) > -1 || ak.indexOf(t.walletTujuan) > -1)));
      const masuk = U.sum(tx.filter(t => ak.indexOf(t.walletTujuan) > -1), t => t.jumlah), keluar = U.sum(tx.filter(t => ak.indexOf(t.walletId) > -1), t => t.jumlah);
      return `<div class="stat3"><div class="stat in"><small>Top up</small><b>${UI.ms(masuk)}</b></div><div class="stat out"><small>Tarik dana</small><b>${UI.ms(keluar)}</b></div><div class="stat"><small>Bersih</small><b>${UI.ms(masuk - keluar)}</b></div></div>
        <div class="card list">${tx.map(t => UI.txRow(t, { date: true })).join('') || `<div class="row muted">Belum ada top up / tarik dana. Catat sebagai Transfer dari rekening bank ke akun RDN.</div>`}</div>
        <button class="btn block ghost" data-act="sh-topup">${I('arrow-left-right')} Top up / tarik dana</button>`;
    }
    rowTrade.rm = realMap();
    const tr = trades().filter(t => t.tanggal >= dari && (!F.akun || t.walletId === F.akun) && (!F.aksi || t.aksi === F.aksi) && (!F.q || t.kode.indexOf(F.q) > -1)).reverse();
    const beli = U.sum(tr.filter(t => t.aksi === 'beli'), t => t.lot * LEMBAR * t.harga), jual = U.sum(tr.filter(t => t.aksi === 'jual'), t => t.lot * LEMBAR * t.harga);
    const g = U.groupBy(tr, t => t.tanggal.slice(0, 7));
    const out = `<div class="stat3"><div class="stat"><small>Beli</small><b>${UI.ms(beli)}</b></div><div class="stat"><small>Jual</small><b>${UI.ms(jual)}</b></div><div class="stat"><small>Fee + meterai</small><b>${UI.ms(U.sum(tr, t => (Number(t.fee) || 0) + (t.aksi === 'materai' ? Number(t.nominal) || 0 : 0)))}</b></div></div>` +
      (Object.keys(g).map(m => `<div class="day-h"><b>${U.tgl(m + '-01', 'my')}</b><span>${g[m].length} transaksi</span></div><div class="card list">${g[m].map(rowTrade).join('')}</div>`).join('') || `<div class="card">${UI.empty('list', 'Belum ada transaksi', 'Tidak ada transaksi pada rentang ini.', `<button class="btn" data-act="sh-catat">${I('plus')} Catat</button>`)}</div>`);
    rowTrade.rm = null;
    return out;
  }
  UI.act('sh-topup', () => { const ak = akunList(); UI.catat({ preset: { jenis: 'transfer', walletTujuan: (ak[0] || {}).id } }); });
  function aktivitas() {
    return `${akunChips()}
      <div class="seg2"><button class="${F.tab === 'trade' ? 'on' : ''}" data-act="sh-tab2" data-v="trade">${I('chart-candlestick')} Trade</button><button class="${F.tab === 'kas' ? 'on' : ''}" data-act="sh-tab2" data-v="kas">${I('arrow-left-right')} Arus kas</button></div>
      <div class="chips sm scroll">${RENTANG.map(r => `<button class="chip ${F.rentang === r[0] ? 'on' : ''}" data-act="sh-rentang" data-v="${r[0]}">${r[1]}</button>`).join('')}</div>
      ${F.tab === 'trade' ? `<div class="sh-filter"><div class="search">${I('search')}<input type="search" placeholder="Cari kode, mis. BBCA" value="${U.esc(F.q)}" data-input="sh-q" class="up"></div>
        <div class="chips sm">${[['beli', 'Beli'], ['jual', 'Jual'], ['dividen', 'Dividen'], ['materai', 'Meterai']].map(a => `<button class="chip ${F.aksi === a[0] ? 'on' : ''}" data-act="sh-aksi" data-v="${a[0]}">${a[1]}</button>`).join('')}</div></div>` : ''}
      <div id="sh-act">${daftarAktivitas()}</div>`;
  }

  // ---------- Analitik ----------
  function analitik() {
    const r = Calc.saham(null, F.akun || null), dari = dariRentang(F.anaRentang);
    const re = r.realisasi.filter(x => x.t.tanggal >= dari), menang = re.filter(x => x.pl > 0), kalah = re.filter(x => x.pl < 0);
    const totPL = U.sum(re, x => x.pl), gross = U.sum(menang, x => x.pl), loss = -U.sum(kalah, x => x.pl);
    const div = U.sum(r.dividen.filter(x => x.t.tanggal >= dari), x => x.v);
    const fe = U.sum(trades().filter(t => t.tanggal >= dari && (!F.akun || t.walletId === F.akun)), t => (Number(t.fee) || 0) + (t.aksi === 'materai' ? Number(t.nominal) || 0 : 0));
    const bln = []; for (let k = 11; k >= 0; k--) { const ym = U.ym(U.addMonths(U.today(), -k)); bln.push({ label: U.tgl(ym + '-01', 'mys').split(' ')[0], v: U.sum(r.realisasi.filter(x => x.t.tanggal.slice(0, 7) === ym), x => x.pl) + U.sum(r.dividen.filter(x => x.t.tanggal.slice(0, 7) === ym), x => x.v) }); }
    let cum = 0; const kurva = r.realisasi.concat(r.dividen.map(d => ({ t: d.t, pl: d.v }))).sort((a, b) => a.t.tanggal.localeCompare(b.t.tanggal)).map(x => ({ d: x.t.tanggal, bal: (cum += x.pl) }));
    const perKode = {}; re.forEach(x => { perKode[x.kode] = perKode[x.kode] || { kode: x.kode, pl: 0, n: 0, w: 0 }; perKode[x.kode].pl += x.pl; perKode[x.kode].n++; if (x.pl > 0) perKode[x.kode].w++; });
    const top = Object.values(perKode).sort((a, b) => b.pl - a.pl), best = re.slice().sort((a, b) => b.pct - a.pct)[0], worst = re.slice().sort((a, b) => a.pct - b.pct)[0];
    const avgHold = re.length ? Math.round(U.sum(re, x => x.umur) / re.length) : 0;
    const st = (lb, v, cls, sub) => `<div class="sh-stat"><small>${lb}</small><b class="${cls || ''}">${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    return `${akunChips()}
      <div class="chips sm scroll">${RENTANG.map(x => `<button class="chip ${F.anaRentang === x[0] ? 'on' : ''}" data-act="sh-ana" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
      <div class="sh-stats">
        ${st('Untung/rugi terealisasi', tanda(totPL) + UI.ms(Math.abs(totPL)), kelasPL(totPL), re.length + ' penjualan')}
        ${st('Win rate', re.length ? U.pct(menang.length / re.length) : '—', re.length && menang.length / re.length >= 0.5 ? 'ok' : '', menang.length + ' untung · ' + kalah.length + ' rugi')}
        ${st('Rata-rata untung', menang.length ? '+' + U.pct(U.sum(menang, x => x.pct) / menang.length, 1) : '—', 'ok', menang.length ? '+' + UI.ms(gross / menang.length) + '/trade' : '')}
        ${st('Rata-rata rugi', kalah.length ? '−' + U.pct(Math.abs(U.sum(kalah, x => x.pct) / kalah.length), 1) : '—', 'bad', kalah.length ? '−' + UI.ms(loss / kalah.length) + '/trade' : '')}
        ${st('Profit factor', loss ? (gross / loss).toFixed(2) : gross ? '∞' : '—', loss && gross / loss >= 1 ? 'ok' : loss ? 'bad' : '', 'total untung dibagi total rugi')}
        ${st('Dividen', UI.ms(div), 'ok', '')}
        ${st('Fee & meterai', UI.ms(fe), '', '')}
        ${st('Lama pegang', avgHold ? avgHold + ' hari' : '—', '', 'rata-rata sampai jual')}
      </div>
      <div class="card rd-trend"><div class="row-sp"><b>Hasil per bulan</b><small class="muted">realisasi + dividen</small></div>${barPN(bln)}</div>
      ${kurva.length > 1 ? `<div class="card rd-trend"><div class="row-sp"><b>Kumulatif hasil</b><span class="${kelasPL(cum)} small">${tanda(cum)}${UI.ms(Math.abs(cum))}</span></div>${Charts.line(kurva, { fit: true, fmt: 'mys', aria: 'Kumulatif untung rugi terealisasi' })}</div>` : ''}
      ${top.length ? UI.sec('Per emiten') + `<div class="card list">${top.map(x => `<div class="row"><span class="sh-kode">${U.esc(x.kode)}</span><div class="tx-txt"><b>${x.n} penjualan</b><small>win rate ${U.pct(x.w / x.n)}</small></div><b class="${kelasPL(x.pl)}">${tanda(x.pl)}${UI.ms(Math.abs(x.pl))}</b></div>`).join('')}</div>` : ''}
      ${best ? UI.sec('Trade terbaik & terburuk') + `<div class="card list">${[best, worst].filter((x, i, a) => x && a.indexOf(x) === i).map(x => `<div class="row" data-act="sh-edit" data-id="${x.t.id}"><span class="sh-ic ${x.pl >= 0 ? 'div' : 'sell'}">${I(x.pl >= 0 ? 'trophy' : 'trending-down')}</span><div class="tx-txt"><b>${U.esc(x.kode)} · ${U.tgl(x.t.tanggal, 'dm')}</b><small>beli avg ${nm(x.avg)} → jual ${nm(x.t.harga)} · ${x.umur} hari</small></div><b class="${kelasPL(x.pl)}">${tanda(x.pl)}${U.pct(Math.abs(x.pct), 1)}</b></div>`).join('')}</div>` : ''}
      ${!re.length ? `<p class="muted small">Analitik terisi setelah ada transaksi jual. Untung/rugi dihitung dari harga rata-rata termasuk fee.</p>` : ''}`;
  }

  // ---------- Kalkulator harga rata-rata ----------
  const K = { kode: '', akun: '' };
  function kalkulator() {
    const ps = Calc.saham().posisi, p = ps.find(x => x.kode === K.kode && (!K.akun || x.walletId === K.akun));
    return `<div class="card sh-kalk">
      ${ps.length ? UI.field('Ambil dari posisi', `<select data-kk="pos"><option value="">— isi manual —</option>${ps.map(x => `<option value="${x.walletId}|${x.kode}" ${p === x ? 'selected' : ''}>${x.kode} · ${lotTxt(x.lembar / LEMBAR)} @ ${nm(x.avg)}${akunList().length > 1 ? ' · ' + U.esc(akunNama(x.walletId)) : ''}</option>`).join('')}</select>`) : ''}
      <h4 class="mini-h">Posisi sekarang</h4>
      <div class="grid2">${UI.field('Lot dimiliki', `<input type="number" min="0" data-kk="lot0" value="${p ? p.lembar / LEMBAR : ''}" inputmode="numeric">`)}${UI.field('Harga rata-rata', `<input inputmode="numeric" data-kk="avg0" data-rpk value="${p ? nm(p.avg) : ''}">`)}</div>
      <h4 class="mini-h">Rencana beli</h4>
      <div class="grid2">${UI.field('Lot dibeli', `<input type="number" min="0" data-kk="lot1" inputmode="numeric" placeholder="0">`)}${UI.field('Harga beli', `<input inputmode="numeric" data-kk="h1" data-rpk value="${p && p.last ? nm(p.last) : ''}">`)}</div>
      <div class="sh-kalk-out" id="kk-out"></div>
      <h4 class="mini-h">Ingin rata-rata berapa?</h4>
      <div class="grid2">${UI.field('Target rata-rata', `<input inputmode="numeric" data-kk="tgt" data-rpk placeholder="mis. 9.000">`)}<div class="sh-kalk-need" id="kk-need"></div></div>
      <label class="check"><input type="checkbox" data-kk="fee" checked><span>Hitung fee beli ${fee().beli}%</span></label></div>
      <p class="muted small">Kalkulator hanya berhitung — tidak mencatat transaksi.</p>`;
  }
  function kalkHitung() {
    const root = document.querySelector('#view .sh-kalk'); if (!root) return;
    const q = k => root.querySelector(`[data-kk=${k}]`), num = el => el ? Number(String(el.value).replace(/\D/g, '')) || 0 : 0;
    const calc = () => {
      root.querySelectorAll('[data-rpk]').forEach(el => { const n = num(el); if (document.activeElement !== el) el.value = n ? U.fmtNum(n) : ''; });
      const fp = q('fee').checked ? fee().beli / 100 : 0;
      const l0 = Number(q('lot0').value) || 0, a0 = num(q('avg0')), l1 = Number(q('lot1').value) || 0, h1 = num(q('h1')), tg = num(q('tgt'));
      const c0 = l0 * LEMBAR * a0, c1 = l1 * LEMBAR * h1 * (1 + fp), lt = l0 + l1, avg = lt ? (c0 + c1) / (lt * LEMBAR) : 0;
      document.getElementById('kk-out').innerHTML = l1 && h1 ? `<div class="sh-big"><small>Rata-rata baru</small><b>${U.rp(Math.round(avg))}</b><small class="${avg < a0 ? 'ok' : 'bad'}">${a0 ? (avg < a0 ? 'turun ' : 'naik ') + U.pct(Math.abs(avg - a0) / a0, 2) : ''}</small></div>
        <div class="kv-list"><div class="kv"><span>Total lot</span><b>${lotTxt(lt)}</b></div><div class="kv"><span>Dana dibutuhkan</span><b>${U.rp(Math.round(c1))}</b></div><div class="kv"><span>Total modal</span><b>${U.rp(Math.round(c0 + c1))}</b></div>
        ${a0 && h1 ? `<div class="kv"><span>Impas (BEP) setelah fee jual</span><b>${U.rp(Math.ceil(avg / (1 - fee().jual / 100)))}</b></div>` : ''}</div>` : '<p class="muted small">Isi lot & harga beli untuk melihat rata-rata baru.</p>';
      let need = '';
      if (tg && h1 && l0 && a0) {
        const hEff = h1 * (1 + fp);
        if (!(hEff < tg && tg < a0) && !(hEff > tg && tg > a0)) need = `<small class="bad">Target harus di antara harga beli (${nm(hEff)}) dan rata-rata sekarang (${nm(a0)}).</small>`;
        else { const lots = Math.ceil(l0 * (a0 - tg) / (tg - hEff)); need = `<small class="muted">Perlu beli</small><b>${lotTxt(lots)}</b><small>≈ ${U.rp(Math.round(lots * LEMBAR * hEff))}</small>`; }
      }
      document.getElementById('kk-need').innerHTML = need;
    };
    root.addEventListener('input', calc);
    const sel = q('pos');
    if (sel) sel.addEventListener('change', () => { const [ak, kd] = sel.value.split('|'); K.akun = ak || ''; K.kode = kd || ''; const p = Calc.saham().posisi.find(x => x.kode === kd && x.walletId === ak); q('lot0').value = p ? p.lembar / LEMBAR : ''; q('avg0').value = p ? nm(p.avg) : ''; q('h1').value = p && p.last ? nm(p.last) : ''; calc(); });
    calc();
  }

  // harga diperbarui diam-diam saat halaman saham dibuka (maks. sekali per 30 menit)
  UI.sahamAutoHarga = () => { try { const k = 'sa:shHargaT', t = Number(localStorage.getItem(k) || 0); if (Date.now() - t < 30 * 60000 || Store.mode === 'demo') return; localStorage.setItem(k, String(Date.now())); ambilHarga(true); } catch (e) {} };
})();
