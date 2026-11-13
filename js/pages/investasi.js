/* Investasi & aset lain — saham, reksa dana, SBN, deposito, kripto, properti, kendaraan, lainnya; target alokasi */
(function () {
  const I = UI.icon, K = () => Calc.KELAS;
  const me = () => Store.me.email;
  const fmtU = v => U.fmtNum(Math.round(v * 10000) / 10000);

  UI.invForm = (x, kelas) => {
    const isNew = !x;
    x = x || { id: U.uid('i'), kelas: kelas || 'saham', nama: '', kode: '', unit: 0, modal: 0, nilai: 0, tglNilai: U.today(), tanggal: U.today(), walletId: '', tujuanId: '', kepemilikan: {}, jatuhTempo: '', imbal: 0, zakat: (K()[kelas || 'saham'] || {}).zakat !== false, status: 'aktif', tglJual: '', hargaJual: 0, catatan: '', dibuat: new Date().toISOString(), riwayatNilai: [] };
    const ph = { saham: ['mis. Bank Central Asia', 'BBCA'], reksadana: ['mis. RD Pasar Uang Syariah', 'Bibit / Bareksa'], sbn: ['mis. Sukuk Tabungan', 'ST011'], deposito: ['mis. Deposito BCA 6 bln', ''], kripto: ['mis. Bitcoin', 'BTC'], properti: ['mis. Rumah Bekasi', 'SHM / luas'], kendaraan: ['mis. Toyota Avanza 2021', 'Plat nomor'], lain: ['mis. Kamera, alat usaha', ''] };
    const s = UI.sheet({ title: isNew ? 'Tambah aset' : 'Ubah aset', body: `
      ${UI.field('Jenis aset', `<select name="kelas">${Object.keys(K()).map(k => `<option value="${k}" ${x.kelas === k ? 'selected' : ''}>${K()[k].label}</option>`).join('')}</select>`)}
      <div class="grid2">${UI.field('Nama', `<input name="nama" maxlength="60" value="${U.esc(x.nama)}" data-ph-nama>`)}${UI.field('Kode / keterangan', `<input name="kode" maxlength="30" value="${U.esc(x.kode)}" data-ph-kode>`)}</div>
      <div class="grid2"><label class="field" data-unit><span>Jumlah <i data-unit-lb></i></span><input type="number" step="any" min="0" name="unit" value="${x.unit || ''}"></label>${UI.field('Tanggal perolehan', `<input type="date" name="tanggal" value="${x.tanggal || U.today()}">`)}</div>
      <div class="grid2">${UI.field('Modal / harga perolehan', UI.rpInput('modal', x.modal))}${UI.field('Nilai saat ini', UI.rpInput('nilai', x.nilai), 'Kosong = sama dengan modal')}</div>
      <div class="grid2" data-jt><label class="field"><span>Jatuh tempo</span><input type="date" name="jatuhTempo" value="${x.jatuhTempo || ''}"></label><label class="field"><span>Imbal hasil % / tahun</span><input type="number" step="0.01" name="imbal" value="${x.imbal || ''}"></label></div>
      ${isNew ? UI.field('Sumber dana', `<select name="sumber">${UI.sumberDanaOpts('')}</select>`) + UI.biayaField(0, 'Opsional — mis. biaya notaris, admin bank, materai.') : ''}
      ${UI.field('Untuk tujuan', `<select name="tujuanId">${UI.tujuanOpts(x.tujuanId)}</select>`)}
      ${UI.kepemilikanField(x.kepemilikan)}
      <label class="check"><input type="checkbox" name="zakat" ${x.zakat ? 'checked' : ''}><span>Dihitung untuk zakat mal <small class="muted">(rumah tinggal & kendaraan pribadi umumnya tidak)</small></span></label>
      ${UI.field('Catatan', `<input name="catatan" maxlength="120" value="${U.esc(x.catatan)}">`)}`,
      foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${I('trash-2')}</button>`}<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    const sync = (changed) => {
      const k = s.el.querySelector('[name=kelas]').value, def = K()[k];
      s.el.querySelector('[data-unit]').hidden = !def.unit; s.el.querySelector('[data-unit-lb]').textContent = def.unit ? '(' + def.unit + ')' : '';
      s.el.querySelector('[data-jt]').hidden = !def.jt && k !== 'reksadana';
      s.el.querySelector('[data-ph-nama]').placeholder = (ph[k] || ph.lain)[0]; s.el.querySelector('[data-ph-kode]').placeholder = (ph[k] || ph.lain)[1];
      if (changed) s.el.querySelector('[name=zakat]').checked = def.zakat;
    };
    s.el.querySelector('[name=kelas]').onchange = () => sync(true); sync(false);
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el), kp = UI.readKepemilikan(s.el); if (kp === null) return;
      if (!v.nama || !v.modal) return UI.toast('Nama dan modal wajib diisi.', 'warn');
      v.unit = Number(v.unit) || 0; v.imbal = Number(v.imbal) || 0;
      const sumber = v.sumber, biayaLain = v.biayaLain || 0; delete v.sumber; delete v.biayaLain;
      if (sumber && sumber.indexOf('g:') === 0 && !v.tujuanId) v.tujuanId = sumber.slice(2);
      const nilai = v.nilai || v.modal, rw = Array.isArray(x.riwayatNilai) ? x.riwayatNilai.slice() : [];
      if (nilai !== x.nilai) rw.push([U.today(), nilai]);
      const row = Object.assign({}, x, v, { nilai, tglNilai: nilai !== x.nilai ? U.today() : x.tglNilai, kepemilikan: kp, riwayatNilai: rw.slice(-60) });
      Store.commit([{ op: 'upsert', t: 'Investasi', row }].concat(isNew ? UI.opsBeliAset(sumber, v.modal, v.tanggal, row.id, 'Beli ' + K()[v.kelas].label + ': ' + v.nama, biayaLain) : []));
      s.close(); UI.toast('Aset tersimpan.');
    };
    const d = s.el.querySelector('[data-del]');
    if (d) d.onclick = async () => { if (await UI.confirm('Hapus aset?', 'Transaksi terkait tetap ada di Mutasi.', 'Hapus', true)) { Store.remove('Investasi', x.id); s.close(); } };
  };
  UI.act('inv-add', el => el.dataset.kelas === 'reksadana' && UI.rdForm ? UI.rdForm() : UI.invForm(null, el.dataset.kelas));
  UI.act('inv-open', el => {
    const i = Calc.investasi('', true).find(z => z.x.id === el.dataset.id); if (!i) return;
    if (String(el.dataset.id).indexOf('sh:') === 0) return UI.go('saham');
    if (i.x.kelas === 'reksadana' && i.x.status !== 'terjual' && UI.acts['rd-open']) return UI.acts['rd-open'](el);
    const x = i.x, def = K()[x.kelas] || K().lain, aktif = x.status !== 'terjual';
    const rw = (x.riwayatNilai || []).map(r => ({ d: r[0], bal: Number(r[1]) }));
    const s = UI.sheet({ title: x.nama, body: `
      <div class="detail-head"><span class="cat-ic lg">${I(def.ikon)}</span><div><small class="muted">${def.label}${x.kode ? ' · ' + U.esc(x.kode) : ''}${aktif ? '' : ' · terjual ' + U.tgl(x.tglJual)}</small><div class="big-amt">${UI.m(i.nilai)}</div>
        <small class="${i.untung >= 0 ? 'ok' : 'bad'}">${i.untung >= 0 ? '+' : '−'}${UI.m(Math.abs(i.untung))} (${U.pct(i.pct, 1)})</small></div></div>
      ${rw.length > 1 ? Charts.line(rw, { fit: true, fmt: 'mys', aria: 'Riwayat nilai' }) : ''}
      <div class="kv-list">${[['Modal', U.rp(i.modal)], def.unit && x.unit ? ['Jumlah', fmtU(x.unit) + ' ' + def.unit + (x.kelas === 'saham' ? ' (' + fmtU(x.unit / 100) + ' lot)' : '') + ' · rata² ' + U.rp(Math.round(i.modal / x.unit))] : null,
        ['Diperoleh', U.tgl(x.tanggal)], x.jatuhTempo ? ['Jatuh tempo', U.tgl(x.jatuhTempo) + ' · ' + U.relDay(x.jatuhTempo)] : null, x.imbal ? ['Imbal hasil', x.imbal + '% / tahun'] : null,
        ['Nilai diperbarui', x.tglNilai ? U.tgl(x.tglNilai) + (i.basi ? ' · perlu diperbarui' : '') : '—'], ['Pemilik', U.esc(UI.ownLabel(x.kepemilikan))],
        x.tujuanId && Store.byId.Tujuan[x.tujuanId] ? ['Untuk tujuan', U.esc(Store.byId.Tujuan[x.tujuanId].nama)] : null, ['Zakat', x.zakat ? 'Dihitung' : 'Tidak dihitung'], x.catatan ? ['Catatan', U.esc(x.catatan)] : null]
        .filter(Boolean).map(r => `<div class="kv"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>`,
      foot: aktif ? `<button class="btn ghost" data-a="edit">${I('pencil')}</button><button class="btn ghost" data-a="nilai">${I('refresh-cw')} Perbarui nilai</button><button class="btn" data-a="jual">${I('hand-coins')} ${x.kelas === 'deposito' || x.kelas === 'sbn' ? 'Cairkan' : 'Jual'}</button>`
        : `<button class="btn ghost danger" data-a="hapus">${I('trash-2')} Hapus</button>` });
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const a = b.dataset.a; s.close();
      if (a === 'edit') UI.invForm(x); else if (a === 'nilai') nilaiForm(x); else if (a === 'jual') jualForm(i);
      else if (await UI.confirm('Hapus catatan?', 'Catatan aset terjual ini dihapus.', 'Hapus', true)) Store.remove('Investasi', x.id);
    });
  });
  function nilaiForm(x) {
    const def = K()[x.kelas] || K().lain, perUnit = def.unit && x.unit;
    const s = UI.sheet({ title: 'Perbarui nilai · ' + x.nama, cls: 'small', body: `
      ${perUnit ? UI.field('Harga per ' + def.unit + ' hari ini', UI.rpInput('harga', x.unit ? Math.round((x.nilai || x.modal) / x.unit) : 0), 'Nilai = harga × ' + fmtU(x.unit) + ' ' + def.unit) : ''}
      ${UI.field('Nilai total saat ini', UI.rpInput('nilai', x.nilai || x.modal))}`, foot: `<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    const hp = s.el.querySelector('[name=harga]');
    if (hp) hp.addEventListener('input', () => { s.el.querySelector('[name=nilai]').value = U.fmtNum(Math.round(U.parseRp(hp.value) * x.unit)); });
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el); if (!v.nilai) return;
      Store.upsert('Investasi', { id: x.id, nilai: v.nilai, tglNilai: U.today(), riwayatNilai: (x.riwayatNilai || []).concat([[U.today(), v.nilai]]).slice(-60) });
      s.close(); UI.toast('Nilai diperbarui.');
    };
  }
  function jualForm(i) {
    const x = i.x, def = K()[x.kelas] || K().lain, bisaSebagian = def.unit && x.unit > 0;
    const s = UI.sheet({ title: (x.kelas === 'deposito' || x.kelas === 'sbn' ? 'Cairkan ' : 'Jual ') + x.nama, cls: 'small', body: `
      ${bisaSebagian ? UI.field('Jumlah dijual (' + def.unit + ')', `<input type="number" step="any" name="unit" min="0" max="${x.unit}" value="${x.unit}">`, 'Dari ' + fmtU(x.unit) + ' ' + def.unit) : ''}
      ${UI.field('Uang diterima (bersih)', UI.rpInput('hasil', i.nilai))}
      <div class="grid2">${UI.field('Masuk ke', `<select name="walletId">${UI.walletOpts(localStorage.getItem('sa:lastWallet'))}</select>`)}${UI.field('Tanggal', `<input type="date" name="tanggal" value="${U.today()}">`)}</div>${UI.biayaField()}<div class="calc-hint small"></div>`,
      foot: `<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    const hint = s.el.querySelector('.calc-hint');
    const calc = () => { const v = UI.formData(s.el), frac = bisaSebagian ? U.clamp((Number(v.unit) || 0) / x.unit, 0, 1) : 1, modal = Math.round(i.modal * frac), u = v.hasil - modal; hint.innerHTML = `Modal bagian ini ${U.rp(modal)} · <b class="${u >= 0 ? 'ok' : 'bad'}">${u >= 0 ? 'untung' : 'rugi'} ${U.rp(Math.abs(u))}</b>`; return { frac, modal }; };
    const un = s.el.querySelector('[name=unit]');
    if (un) un.addEventListener('input', () => { s.el.querySelector('[name=hasil]').value = U.fmtNum(Math.round(i.nilai * U.clamp((Number(un.value) || 0) / x.unit, 0, 1))); calc(); });
    s.el.addEventListener('input', calc); calc();
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el), r = calc(); if (!v.hasil || !r.frac) return UI.toast('Isi jumlah & uang diterima.', 'warn');
      const ops = [], now = new Date().toISOString(); let sid = x.id;
      if (r.frac < 0.9999) {
        sid = U.uid('i');
        ops.push({ op: 'upsert', t: 'Investasi', row: { id: x.id, unit: x.unit - Number(v.unit), modal: i.modal - r.modal, nilai: Math.round((x.nilai || x.modal) * (1 - r.frac)) } });
        ops.push({ op: 'upsert', t: 'Investasi', row: Object.assign({}, x, { id: sid, unit: Number(v.unit), modal: r.modal, nilai: v.hasil, status: 'terjual', tglJual: v.tanggal, hargaJual: v.hasil, dibuat: now, riwayatNilai: [] }) });
      } else ops.push({ op: 'upsert', t: 'Investasi', row: { id: x.id, status: 'terjual', tglJual: v.tanggal, hargaJual: v.hasil } });
      ops.push({ op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: v.tanggal, jenis: 'aset_jual', jumlah: v.hasil, kategoriId: '', walletId: v.walletId, walletTujuan: '', biaya: v.biayaLain || 0, catatan: 'Jual ' + x.nama, dibayarOleh: me(), tag: '', sumber: 'aset', refId: sid, periodeRef: '', dicatatOleh: me(), dibuat: now, riwayat: [] } });
      Store.commit(ops); s.close(); UI.toast('Tercatat · ' + U.rp(v.hasil) + ' masuk ke dompet.');
    };
  }

  // ---------- Target alokasi ----------
  UI.act('alok-edit', () => {
    let t = {}; try { t = JSON.parse(Store.setting('targetAlokasi', '') || '{}'); } catch (e) {}
    const incl = Store.setting('alokasiProperti', 'false') === 'true';
    const s = UI.sheet({ title: 'Target alokasi aset', body: `<p class="muted small">Tentukan porsi ideal tiap jenis aset (total 100%). Contoh keluarga muda: kas 30, emas 20, reksa dana 25, saham 15, SBN 10.</p>
      <div class="chips"><button class="chip" data-p="konservatif">Konservatif</button><button class="chip" data-p="moderat">Moderat</button><button class="chip" data-p="agresif">Agresif</button></div>
      <div class="alok-edit">${Calc.ALOKASI.map(a => `<label class="${a[0] === 'properti' && !incl ? 'muted' : ''}"><span>${I(a[2])} ${a[1]}</span><input type="number" min="0" max="100" step="5" name="${a[0]}" value="${t[a[0]] || ''}" placeholder="0"><i>%</i></label>`).join('')}</div>
      <div class="sumline" data-sum></div>
      <label class="check"><input type="checkbox" name="alokasiProperti" ${incl ? 'checked' : ''}><span>Ikutkan properti (umumnya rumah tinggal tidak dihitung)</span></label>`, foot: `<button class="btn" data-ok>Simpan</button>` });
    const P = { konservatif: { kas: 40, emas: 25, reksadana: 15, tetap: 20 }, moderat: { kas: 25, emas: 20, saham: 15, reksadana: 25, tetap: 15 }, agresif: { kas: 15, emas: 15, saham: 35, reksadana: 25, tetap: 5, lain: 5 } };
    const sum = () => { let n = 0; Calc.ALOKASI.forEach(a => n += Number(s.el.querySelector(`[name=${a[0]}]`).value) || 0); s.el.querySelector('[data-sum]').innerHTML = `<span class="${n === 100 ? 'in' : 'out'}">Total ${n}%</span>`; return n; };
    s.el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { Calc.ALOKASI.forEach(a => s.el.querySelector(`[name=${a[0]}]`).value = P[b.dataset.p][a[0]] || ''); sum(); });
    s.el.addEventListener('input', sum); sum();
    s.el.querySelector('[data-ok]').onclick = () => {
      if (sum() !== 100) return UI.toast('Total harus 100%.', 'warn');
      const o = {}; Calc.ALOKASI.forEach(a => o[a[0]] = Number(s.el.querySelector(`[name=${a[0]}]`).value) || 0);
      Store.commit([{ op: 'upsert', t: 'Pengaturan', row: { id: 'targetAlokasi', nilai: JSON.stringify(o) } }, { op: 'upsert', t: 'Pengaturan', row: { id: 'alokasiProperti', nilai: s.el.querySelector('[name=alokasiProperti]').checked ? 'true' : 'false' } }]);
      s.close(); UI.toast('Target alokasi disimpan.');
    };
  });
  const PAL = { kas: '#0F5E59', emas: '#F2B33D', saham: '#476364', reksadana: '#2E8C84', tetap: '#90D5CE', properti: '#B76E00', lain: '#BEC9C7' };
  function alokasi() {
    const a = Calc.alokasi();
    return `${a.total ? `<div class="card donut-card">${Charts.donut(a.rows.filter(r => r.v > 0).map(r => ({ v: r.v, color: PAL[r.k] })), ['Aset', UI.ms(a.total)])}</div>` : ''}
      <div class="card list">${a.rows.map(r => `<div class="row"><span class="dot-c" style="background:${PAL[r.k]}"></span><div class="grow"><div class="row-sp"><b>${r.label}</b><b>${U.pct(r.pct)}${a.adaTarget ? ' <small class="muted">/ ' + U.pct(r.target) + '</small>' : ''}</b></div>
        <div class="bar alok"><i style="width:${(r.pct * 100).toFixed(1)}%;background:${PAL[r.k]}"></i>${a.adaTarget ? `<em style="left:${(r.target * 100).toFixed(1)}%"></em>` : ''}</div>
        <small class="muted">${UI.ms(r.v)}${a.adaTarget && Math.abs(r.selisih) > a.total * 0.02 ? ' · ' + (r.selisih > 0 ? 'tambah ' : 'kurangi ') + UI.ms(Math.abs(r.selisih)) : a.adaTarget ? ' · sesuai ✓' : ''}</small></div></div>`).join('')}</div>
      ${a.adaTarget ? `<p class="muted small">Garis tegak = target. Saran "tambah/kurangi" hanya panduan menyeimbangkan ulang, bukan nasihat investasi.</p>` : `<div class="alert info" data-act="alok-edit">${I('target')}<div><b>Atur target alokasi</b><small>Bandingkan porsi aset keluarga dengan rencana idealnya.</small></div>${I('chevron-right')}</div>`}
      <button class="btn block ghost" data-act="alok-edit">${I('sliders-horizontal')} Ubah target</button>`;
  }

  /** Kelompok tampilan: SBN & Deposito digabung; kripto & kendaraan masuk Aset Lain. */
  const GRUP = { sbn: ['sbn', 'deposito'], deposito: ['sbn', 'deposito'], lain: ['lain', 'kripto', 'kendaraan'], kripto: ['lain', 'kripto', 'kendaraan'], kendaraan: ['lain', 'kripto', 'kendaraan'] };
  const JUDUL = { sbn: 'SBN & Deposito', deposito: 'SBN & Deposito', lain: 'Aset Lain', kripto: 'Aset Lain', kendaraan: 'Aset Lain' };
  UI.rutKelas = k => k === 'saham' ? 'saham' : ({ deposito: 'investasi/sbn', kripto: 'investasi/lain', kendaraan: 'investasi/lain' })[k] || 'investasi/' + k;
  const INV_TILES = () => [{ id: 'saham', icon: 'chart-candlestick', label: 'Saham', to: 'saham' }, { id: 'reksadana', icon: 'chart-pie', label: 'Reksa Dana', to: 'investasi/reksadana' }, { id: 'sbn', icon: 'file-badge', label: 'SBN & Deposito', to: 'investasi/sbn' }, { id: 'properti', icon: 'house', label: 'Properti & Tanah', to: 'investasi/properti' }, { id: 'lain', icon: 'package', label: 'Aset Lain', to: 'investasi/lain' }];
  /** Pindah antarkelas aset: strip geser horizontal agar tidak memakan layar. */
  UI.invTiles = () => '';   // navigasi antarkelas cukup dari menu Aset (tanpa tab ganda di atas halaman)
  UI.page('investasi', {
    head: p => ({ title: p === 'alokasi' ? 'Target Alokasi' : JUDUL[p] || (K()[p] || { label: 'Investasi & Aset' }).label, crumb: 'Aset', back: 'aset',
      right: p === 'reksadana' ? `<button class="icon-btn" data-act="rd-add" aria-label="Tambah aplikasi">${I('plus')}</button>` : p !== 'alokasi' ? `<button class="icon-btn" data-act="inv-add" data-kelas="${K()[p] ? p : 'saham'}" aria-label="Tambah">${I('plus')}</button>` : '' }),
    nav: () => 'aset',
    render(p) {
      if (!Store.can('aset', 'lihat')) return UI.empty('lock', 'Tidak ada akses', 'Minta Admin memberi izin menu Aset.');
      const sel = GRUP[p] ? (p === 'deposito' ? 'sbn' : ['kripto', 'kendaraan'].indexOf(p) > -1 ? 'lain' : p) : p;
      const tiles = p === 'alokasi' ? '' : UI.invTiles(sel);
      if (p === 'alokasi') return tiles + alokasi() + '<div class="spacer"></div>';
      if (p === 'reksadana' && UI.rdView) return tiles + UI.rdView();
      const kelas = K()[p] ? p : '', grp = GRUP[kelas], pilih = arr => grp ? arr.filter(i => grp.indexOf(i.x.kelas) > -1) : arr;
      const list = grp ? pilih(Calc.investasi('')) : Calc.investasi(kelas), sold = (grp ? pilih(Calc.investasi('', true)) : Calc.investasi(kelas, true)).filter(i => i.x.status === 'terjual');
      const nilai = U.sum(list, i => i.nilai), modal = U.sum(list, i => i.modal), u = nilai - modal;
      const jt = list.filter(i => i.x.jatuhTempo && U.diffDays(U.today(), i.x.jatuhTempo) <= 30 && i.x.jatuhTempo >= U.today());
      const basi = list.filter(i => i.basi && ['saham', 'reksadana', 'kripto'].indexOf(i.x.kelas) > -1);
      return tiles + `
        <div class="stat3"><div class="stat"><small>Nilai</small><b>${UI.ms(nilai)}</b></div><div class="stat"><small>Modal</small><b>${UI.ms(modal)}</b></div><div class="stat ${u >= 0 ? 'in' : 'out'}"><small>Untung/rugi</small><b>${u >= 0 ? '+' : '−'}${UI.ms(Math.abs(u))}</b><small>${U.pct(modal ? u / modal : 0, 1)}</small></div></div>
        ${jt.map(i => `<div class="alert warn" data-act="inv-open" data-id="${i.x.id}">${I('calendar-clock')}<div><b>${U.esc(i.x.nama)} jatuh tempo ${U.relDay(i.x.jatuhTempo).toLowerCase()}</b><small>${U.tgl(i.x.jatuhTempo)} · putuskan perpanjang atau cairkan.</small></div>${I('chevron-right')}</div>`).join('')}
        ${basi.length ? `<div class="note">${I('refresh-cw')} ${basi.length} aset belum diperbarui nilainya lebih dari 45 hari. Ketuk aset → Perbarui nilai.</div>` : ''}
        <div class="card list">${list.map(i => `<div class="row" data-act="inv-open" data-id="${i.x.id}"><span class="cat-ic">${I((K()[i.x.kelas] || K().lain).ikon)}</span>
          <div class="tx-txt"><b>${U.esc(i.x.nama)}${i.x.kode ? ' <small class="muted">' + U.esc(i.x.kode) + '</small>' : ''}</b><small>${(K()[i.x.kelas] || K().lain).label}${i.x.unit && K()[i.x.kelas].unit ? ' · ' + fmtU(i.x.unit) + ' ' + K()[i.x.kelas].unit : ''}${i.x.jatuhTempo ? ' · JT ' + U.tgl(i.x.jatuhTempo, 'mys') : ''} · ${U.esc(UI.ownLabel(i.x.kepemilikan))}</small></div>
          <div class="tx-amt"><b>${UI.ms(i.nilai)}</b><small class="${i.untung >= 0 ? 'ok' : 'bad'}">${i.untung >= 0 ? '+' : '−'}${U.pct(Math.abs(i.pct), 1)}</small></div></div>`).join('') || UI.empty((K()[kelas] || { ikon: 'briefcase' }).ikon, 'Belum ada ' + (kelas ? K()[kelas].label.toLowerCase() : 'aset'), 'Catat aset yang dimiliki keluarga agar kekayaan bersih & zakat terhitung lengkap.', `<button class="btn" data-act="inv-add" data-kelas="${kelas || 'saham'}">${I('plus')} Tambah</button>`)}</div>
        ${sold.length ? UI.sec('Sudah dijual / dicairkan') + `<div class="card list">${sold.map(i => `<div class="row muted" data-act="inv-open" data-id="${i.x.id}"><span class="cat-ic">${I('archive')}</span><div class="tx-txt"><b>${U.esc(i.x.nama)}</b><small>${U.tgl(i.x.tglJual)}</small></div><small class="${i.untung >= 0 ? 'ok' : 'bad'}">${i.untung >= 0 ? '+' : '−'}${UI.ms(Math.abs(i.untung))}</small></div>`).join('')}</div>` : ''}
        <p class="muted small">Nilai saham/reksa dana diperbarui manual (ketuk aset → Perbarui nilai). Semua angka hanya catatan, bukan rekomendasi investasi.</p><div class="spacer"></div>`;
    }
  });
})();
