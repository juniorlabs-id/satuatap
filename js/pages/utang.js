/* Utang & Piutang — daftar, bayar cicilan, strategi pelunasan, simulasi cicilan & KPR */
(function () {
  const I = UI.icon;
  const JENIS = { kpr: ['KPR', 'house'], kendaraan: ['Kendaraan', 'car'], kartu: ['Kartu kredit', 'credit-card'], paylater: ['PayLater', 'smartphone'], kta: ['KTA / Bank', 'landmark'], gadai: ['Gadai emas', 'gem'], keluarga: ['Keluarga / teman', 'users'], patungan: ['Patungan', 'users'], lain: ['Lainnya', 'scale'] };
  const S = { extra: 500000, strat: 'avalanche', sim: { pokok: 50000000, bunga: 10, tenor: 24, metode: 'anuitas' }, kpr: { harga: 500000000, dp: 20, bunga: 7.5, tahun: 15, biaya: 4 } };

  UI.loanForm = (p, pre) => {
    const isNew = !p;
    p = p || Object.assign({ id: U.uid('p'), arah: 'utang', jenis: 'kta', pihak: '', pokok: 0, bunga: 0, metode: 'tanpa', tenor: 12, mulai: U.today(), tanggalBayar: U.parseDate(U.today()).getDate(), cicilan: 0, walletId: Store.wallets()[0] && Store.wallets()[0].id, lunas: false, catatan: '', dibuat: new Date().toISOString() }, pre || {});
    const s = UI.sheet({ title: isNew ? 'Catat utang / piutang' : 'Ubah ' + (p.arah === 'piutang' ? 'piutang' : 'utang'), body: `
      ${UI.seg('arah', [['utang', 'Saya berutang'], ['piutang', 'Orang berutang ke saya']], p.arah)}
      <div class="grid2">${UI.field('Jenis', `<select name="jenis">${Object.keys(JENIS).map(k => `<option value="${k}" ${p.jenis === k ? 'selected' : ''}>${JENIS[k][0]}</option>`).join('')}</select>`)}${UI.field('Pihak / nama', `<input name="pihak" maxlength="50" value="${U.esc(p.pihak)}" placeholder="mis. KPR BTN, Mas Bayu">`)}</div>
      <div class="grid2">${UI.field('Pokok pinjaman', UI.rpInput('pokok', p.pokok))}${UI.field('Bunga % / tahun', `<input type="number" step="0.01" min="0" name="bunga" value="${p.bunga || 0}">`)}</div>
      <div class="grid2">${UI.field('Metode', `<select name="metode"><option value="tanpa" ${p.metode === 'tanpa' ? 'selected' : ''}>Tanpa bunga / cicilan tetap</option><option value="flat" ${p.metode === 'flat' ? 'selected' : ''}>Bunga flat</option><option value="anuitas" ${p.metode === 'anuitas' ? 'selected' : ''}>Anuitas (efektif)</option></select>`)}${UI.field('Tenor (bulan)', `<input type="number" min="1" max="360" name="tenor" value="${p.tenor || 1}">`)}</div>
      <div class="grid2">${UI.field('Mulai', `<input type="date" name="mulai" value="${p.mulai || U.today()}">`)}${UI.field('Tanggal bayar tiap bulan', `<input type="number" min="0" max="31" name="tanggalBayar" value="${p.tanggalBayar || 0}">`, '0 = tidak terjadwal')}</div>
      ${UI.field('Cicilan per bulan', UI.rpInput('cicilan', p.cicilan, 'otomatis'), 'Kosongkan untuk dihitung otomatis.')}
      <div class="calc-hint muted small"></div>
      ${UI.field('Dompet pembayaran', `<select name="walletId">${UI.walletOpts(p.walletId)}</select>`)}
      ${isNew ? `<label class="check"><input type="checkbox" name="catatKas"><span data-lb>Catat uang pinjaman masuk ke dompet sekarang</span></label>` : ''}
      ${UI.field('Catatan', `<input name="catatan" maxlength="100" value="${U.esc(p.catatan)}">`)}`,
      foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${I('trash-2')}</button>`}<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    const hint = s.el.querySelector('.calc-hint'), lb = s.el.querySelector('[data-lb]');
    const upd = () => {
      const f = UI.formData(s.el), c = Calc.loanCalc(f);
      hint.innerHTML = f.pokok ? `Cicilan dihitung ${U.rp(c.cicilan)}/bulan · total bunga ${U.rp(c.bunga)} · total bayar ${U.rp(c.total)}` : '';
      if (lb) lb.textContent = f.arah === 'piutang' ? 'Catat uang keluar dari dompet sekarang (meminjamkan)' : 'Catat uang pinjaman masuk ke dompet sekarang';
    };
    s.el.addEventListener('input', upd); s.el.addEventListener('change', upd); upd();
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el);
      if (!f.pihak || !f.pokok) return UI.toast('Nama pihak dan pokok wajib.', 'warn');
      const catat = f.catatKas; delete f.catatKas;
      f.tenor = Number(f.tenor) || 1; f.tanggalBayar = Number(f.tanggalBayar) || 0; f.bunga = Number(f.bunga) || 0;
      const ops = [{ op: 'upsert', t: 'Pinjaman', row: Object.assign({}, p, f) }];
      if (catat) { const me = Store.me.email; ops.push({ op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: f.mulai || U.today(), jenis: f.arah === 'piutang' ? 'pinjam_beri' : 'pinjam_terima', jumlah: f.pokok, kategoriId: '', walletId: f.walletId, walletTujuan: '', biaya: 0, catatan: (f.arah === 'piutang' ? 'Pinjamkan ke ' : 'Pinjaman dari ') + f.pihak, dibayarOleh: me, tag: '', sumber: 'app', refId: p.id, periodeRef: '', dicatatOleh: me, dibuat: new Date().toISOString(), riwayat: [] } }); }
      Store.commit(ops); s.close(); UI.toast('Tersimpan.');
    };
    const del = s.el.querySelector('[data-del]');
    if (del) del.onclick = async () => { if (await UI.confirm('Hapus catatan ini?', 'Transaksi pembayaran yang sudah tercatat tetap ada di Mutasi.', 'Hapus', true)) { Store.remove('Pinjaman', p.id); s.close(); UI.go('utang'); } };
  };
  UI.act('loan-add', el => UI.loanForm(null, el.dataset.arah ? { arah: el.dataset.arah, jenis: el.dataset.arah === 'piutang' ? 'keluarga' : 'kta' } : null));
  UI.act('loan-edit', el => UI.loanForm(Store.byId.Pinjaman[el.dataset.id]));
  UI.act('loan-pay', el => {
    const l = Calc.loans().find(x => x.p.id === el.dataset.id); if (!l) return;
    if (l.next) return UI.payOcc(l.next.id);
    // tidak terjadwal: catat pembayaran bebas
    const me = Store.me.email, pi = l.p.arah === 'piutang';
    const s = UI.sheet({ title: (pi ? 'Terima pembayaran · ' : 'Bayar · ') + l.p.pihak, cls: 'small', body: `${UI.field('Jumlah', UI.rpInput('jumlah', Math.min(l.sisa, l.cicilan || l.sisa)))}<div class="grid2">${UI.field(pi ? 'Masuk ke' : 'Dari', `<select name="walletId">${UI.walletOpts(l.p.walletId)}</select>`)}${UI.field('Tanggal', `<input type="date" name="tanggal" value="${U.today()}">`)}</div>`,
      foot: `<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el); if (!f.jumlah) return;
      const cic = (Store.t.Kategori.find(k => /cicilan/i.test(k.nama) && k.jenis === 'keluar') || {}).id || '';
      Store.upsert('Transaksi', { id: U.uid('t'), tanggal: f.tanggal, jenis: pi ? 'pinjam_kembali' : 'keluar', jumlah: f.jumlah, kategoriId: pi ? '' : cic, walletId: f.walletId, walletTujuan: '', biaya: 0, catatan: (pi ? 'Pengembalian ' : 'Bayar ') + l.p.pihak, dibayarOleh: me, tag: '', sumber: 'app', refId: l.p.id, periodeRef: f.tanggal.slice(0, 7), dicatatOleh: me, dibuat: new Date().toISOString(), riwayat: [] });
      if (f.jumlah >= l.sisa) Store.upsert('Pinjaman', { id: l.p.id, lunas: true });
      s.close(); UI.toast(f.jumlah >= l.sisa ? 'Lunas! 🎉' : 'Tercatat.');
    };
  });
  UI.act('loan-lunas', async el => { const p = Store.byId.Pinjaman[el.dataset.id]; if (p && await UI.confirm('Tandai lunas?', p.pihak + ' tidak akan muncul lagi di jadwal.', 'Tandai lunas')) Store.upsert('Pinjaman', { id: p.id, lunas: !p.lunas }); });
  UI.act('loan-tagih', el => {
    const l = Calc.loans().find(x => x.p.id === el.dataset.id); if (!l) return;
    const msg = `Halo ${l.p.pihak}, semoga sehat selalu 🙏\nMau mengingatkan soal ${l.p.jenis === 'patungan' ? 'patungan' : 'pinjaman'} ${l.p.catatan ? '(' + l.p.catatan + ') ' : ''}sebesar ${U.rp(l.sisa)} yang belum selesai${l.next ? ', cicilan ' + U.rp(l.next.sisa) + ' jatuh tempo ' + U.tgl(l.next.tanggal) : ''}. Kalau sudah ada rezekinya, bisa transfer ya. Terima kasih 😊`;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });
  UI.act('ut-strat', el => { S.strat = el.dataset.v; UI.render(); });
  UI.act('ut-extra', U.debounce(el => { S.extra = U.parseRp(el.value); const o = document.getElementById('strat-out'); if (o) o.innerHTML = stratOut(); }, 250));
  UI.act('ut-sim', el => { S.sim[el.dataset.k] = el.dataset.k === 'metode' ? el.value : (el.dataset.rp !== undefined ? U.parseRp(el.value) : Number(el.value)); const o = document.getElementById('sim-out'); if (o) o.innerHTML = simOut(); const v = document.querySelector('[data-v="' + el.dataset.k + '"]'); if (v) v.textContent = fmtSim(el.dataset.k); });
  UI.act('ut-kpr', el => { S.kpr[el.dataset.k] = el.dataset.rp !== undefined ? U.parseRp(el.value) : Number(el.value); const o = document.getElementById('kpr-out'); if (o) o.innerHTML = kprOut(); const v = document.querySelector('[data-v="k' + el.dataset.k + '"]'); if (v) v.textContent = fmtKpr(el.dataset.k); });

  const TILES = cur => UI.tiles([
    { id: '', icon: 'list', label: 'Daftar', to: 'utang' },
    { id: 'strategi', icon: 'trending-down', label: 'Strategi Lunas', to: 'utang/strategi' },
    { id: 'simulasi', icon: 'calculator', label: 'Simulasi Cicilan', to: 'utang/simulasi' },
    { id: 'kpr', icon: 'house', label: 'Simulasi KPR', to: 'utang/kpr' }
  ], cur);
  const loanRow = l => {
    const j = JENIS[l.p.jenis] || JENIS.lain;
    return `<div class="loan ${l.lunas ? 'done' : ''}" data-act="go" data-to="utang/${l.p.id}"><span class="cat-ic">${I(j[1])}</span>
      <div class="grow"><div class="row-sp"><b>${U.esc(l.p.pihak)}</b><b>${UI.ms(l.sisa)}</b></div>${UI.bar(l.pct, 'aman')}
      <small class="muted">${j[0]}${l.p.tenor > 1 ? ' · ke-' + l.ke + '/' + l.p.tenor : ''}${l.next ? ' · ' + U.tgl(l.next.tanggal, 'dm') + ' ' + UI.ms(l.next.sisa) : ''}${l.lunas ? ' · lunas' : ''}</small></div></div>`;
  };

  UI.page('utang', {
    head: p => ({ title: { strategi: 'Strategi Pelunasan', simulasi: 'Simulasi Cicilan', kpr: 'Simulasi KPR' }[p] || (p ? ((Store.byId.Pinjaman[p] || {}).pihak || 'Detail') : 'Utang & Piutang'), crumb: p ? 'Utang & Piutang' : 'Lainnya', back: p ? 'utang' : 'lainnya',
      right: !p ? `<button class="icon-btn" data-act="loan-add" aria-label="Tambah">${I('plus')}</button>` : Store.byId.Pinjaman[p] ? `<button class="icon-btn" data-act="loan-edit" data-id="${p}">${I('pencil')}</button>` : '' }),
    nav: () => 'lainnya',
    render(p) {
      if (!Store.can('utang', 'lihat')) return UI.empty('lock', 'Tidak ada akses', 'Minta Admin memberi izin menu Utang.');
      if (p === 'strategi') return strategi();
      if (p === 'simulasi') return simulasi();
      if (p === 'kpr') return kpr();
      if (p) return detail(p);
      const ls = Calc.loans(), d = Calc.dsr();
      const ut = ls.filter(l => l.p.arah !== 'piutang' && !l.lunas), pi = ls.filter(l => l.p.arah === 'piutang' && !l.lunas), done = ls.filter(l => l.lunas);
      return `${TILES('')}
        <div class="card gauge-card">${Charts.gauge(d.ratio / 0.5, U.pct(d.ratio, 1), 'rasio cicilan / pemasukan')}
          <p class="${d.ratio > 0.3 ? 'bad' : 'ok'}">${d.ratio > 0.3 ? I('triangle-alert') + ' Di atas batas sehat 30%. Hindari utang baru & prioritaskan pelunasan.' : I('shield-check') + ' Sehat — cicilan di bawah 30% pemasukan.'}</p>
          <small class="muted">Cicilan ${UI.ms(d.cicilan)}/bulan · pemasukan rata-rata ${UI.ms(d.inc)}</small></div>
        <div class="stat3"><div class="stat out"><small>Total utang</small><b>${UI.ms(U.sum(ut, l => l.sisa))}</b></div><div class="stat in"><small>Total piutang</small><b>${UI.ms(U.sum(pi, l => l.sisa))}</b></div><div class="stat"><small>Cicilan/bln</small><b>${UI.ms(d.cicilan)}</b></div></div>
        ${UI.sec('Utang saya', `<button class="link" data-act="loan-add" data-arah="utang">${I('plus')} Tambah</button>`)}<div class="card list">${ut.map(loanRow).join('') || '<div class="row muted">Bebas utang 🎉</div>'}</div>
        ${UI.sec('Piutang (orang lain berutang)', `<button class="link" data-act="loan-add" data-arah="piutang">${I('plus')} Tambah</button>`)}<div class="card list">${pi.map(loanRow).join('') || '<div class="row muted">Tidak ada piutang.</div>'}</div>
        ${done.length ? UI.sec('Sudah lunas') + `<div class="card list">${done.map(loanRow).join('')}</div>` : ''}<div class="spacer"></div>`;
    }
  });

  function detail(id) {
    const l = Calc.loans().find(x => x.p.id === id);
    if (!l) return UI.empty('scale', 'Data tidak ditemukan', '', '<a class="btn" href="#/utang">Kembali</a>');
    const p = l.p, pi = p.arah === 'piutang';
    const hist = Calc.txSorted().filter(t => t.refId === id);
    const am = p.metode !== 'tanpa' && p.tenor > 1 ? Calc.amortization(p.pokok, p.bunga, p.tenor, p.metode) : null;
    return `
      <div class="card"><div class="row-sp"><div><small class="muted">${pi ? 'Sisa piutang' : 'Sisa utang'}</small><h2>${UI.m(l.sisa)}</h2></div>${l.lunas ? UI.pill('Lunas', 'ok') : ''}</div>${UI.bar(l.pct, 'aman')}
        <small class="muted">Terbayar ${UI.ms(l.terbayar)} dari ${UI.ms(l.total)} (${U.pct(l.pct)})</small></div>
      <div class="kv-list card">${[['Jenis', (JENIS[p.jenis] || JENIS.lain)[0]], ['Pokok', U.rp(p.pokok)], ['Bunga', p.bunga ? p.bunga + '% / tahun (' + p.metode + ')' : 'Tanpa bunga'], ['Cicilan', U.rp(l.cicilan) + '/bulan'], ['Tenor', p.tenor + ' bulan' + (l.selesai ? ' · selesai ' + U.tgl(l.selesai, 'my') : '')], ['Jatuh tempo', p.tanggalBayar ? 'Tiap tanggal ' + p.tanggalBayar : 'Tidak terjadwal'], ['Berikutnya', l.next ? U.tgl(l.next.tanggal, 'long') + ' · ' + U.rp(l.next.sisa) : '—']].map(r => `<div class="kv"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>
      ${!l.lunas ? `<div class="row-btns"><button class="btn" data-act="loan-pay" data-id="${id}">${I(pi ? 'hand-coins' : 'banknote')} ${pi ? 'Terima pembayaran' : 'Bayar cicilan'}</button>${pi ? `<button class="btn ghost" data-act="loan-tagih" data-id="${id}">${I('message-circle')} Tagih via WA</button>` : ''}</div>` : ''}
      <button class="btn block ghost sm" data-act="loan-lunas" data-id="${id}">${I(p.lunas ? 'rotate-ccw' : 'circle-check')} ${p.lunas ? 'Batalkan tanda lunas' : 'Tandai lunas'}</button>
      ${am ? `${UI.sec('Jadwal angsuran', '<small class="muted">pokok vs bunga</small>')}<div class="card">${Charts.line(am.rows.map((r, i) => ({ d: U.addMonths(p.mulai, i), bal: r.sisa })), { aria: 'Sisa pokok' })}<small class="muted">Total bunga ${U.rp(am.totalBunga)} · angsuran pertama: pokok ${U.rp(am.rows[0].pokok)}, bunga ${U.rp(am.rows[0].bunga)}</small></div>` : ''}
      ${UI.sec('Riwayat')}<div class="card list">${hist.map(t => UI.txRow(t, { date: true })).join('') || '<div class="row muted">Belum ada pembayaran.</div>'}</div><div class="spacer"></div>`;
  }

  function stratOut() {
    const a = Calc.payoff('avalanche', S.extra), b = Calc.payoff('snowball', S.extra), base = Calc.payoff('avalanche', 0), r = S.strat === 'avalanche' ? a : b;
    if (!r.order.length) return '<div class="row muted">Tidak ada utang berjalan 🎉</div>';
    return `<div class="stat3"><div class="stat"><small>Bebas utang</small><b>${U.tgl(r.end, 'mys')}</b><small>${r.months} bulan</small></div><div class="stat"><small>Total bunga</small><b>${UI.ms(r.interest)}</b></div><div class="stat ok"><small>Lebih cepat</small><b>${Math.max(0, base.months - r.months)} bln</b><small>hemat ${UI.ms(Math.max(0, base.interest - r.interest))}</small></div></div>
      <div class="card list">${r.order.map((d, i) => `<div class="row"><span class="num">${i + 1}</span><div class="tx-txt"><b>${U.esc(d.nama)}</b><small>${d.bunga ? d.bunga + '%/th' : '0%'} · cicilan ${UI.ms(d.min)}</small></div><small>lunas ${d.selesai ? U.tgl(d.selesai, 'mys') : '-'}</small></div>`).join('')}</div>
      <p class="muted small">Avalanche: bunga tertinggi dulu (paling hemat). Snowball: sisa terkecil dulu (paling memotivasi). Selisih: ${UI.ms(Math.abs(a.interest - b.interest))} bunga, ${Math.abs(a.months - b.months)} bulan.</p>`;
  }
  function strategi() {
    return `${TILES('strategi')}<div class="card">${UI.seg('strat', [['avalanche', 'Avalanche'], ['snowball', 'Snowball']], S.strat).replace(/<input /g, '<input data-change="ut-strat2" ')}
      ${UI.field('Tambahan bayar per bulan', `<div class="rp-input"><b>Rp</b><input data-rp inputmode="numeric" value="${U.fmtNum(S.extra)}" data-input="ut-extra"></div>`)}</div>
      <div id="strat-out">${stratOut()}</div><div class="spacer"></div>`;
  }
  UI.act('ut-strat2', el => { S.strat = el.value; const o = document.getElementById('strat-out'); if (o) o.innerHTML = stratOut(); });

  const fmtSim = k => k === 'pokok' ? U.rp(S.sim.pokok) : k === 'bunga' ? S.sim.bunga + '%' : k === 'tenor' ? S.sim.tenor + ' bln' : '';
  function simOut() {
    const s = S.sim, a = Calc.amortization(s.pokok, s.bunga, s.tenor, s.metode), inc = Calc.incomeAvg(), d = Calc.dsr();
    const newR = inc ? (d.cicilan + a.cicilan) / inc : 0;
    return `<div class="stat3"><div class="stat"><small>Cicilan</small><b>${UI.ms(a.cicilan)}</b></div><div class="stat"><small>Total bunga</small><b>${UI.ms(a.totalBunga)}</b></div><div class="stat ${newR > 0.3 ? 'out' : 'in'}"><small>Rasio cicilan baru</small><b>${U.pct(newR, 1)}</b></div></div>
      <div class="alert ${newR > 0.3 ? 'warn' : 'ok'}">${I(newR > 0.3 ? 'triangle-alert' : 'shield-check')}<div><b>${newR > 0.3 ? 'Terlalu berat' : 'Masih aman'}</b><small>Total cicilan menjadi ${UI.ms(d.cicilan + a.cicilan)} dari pemasukan ${UI.ms(inc)}/bulan (batas sehat 30%).</small></div></div>`;
  }
  function simulasi() {
    const s = S.sim;
    return `${TILES('simulasi')}<div class="card sliders">
      <label><span>Pokok pinjaman <b data-v="pokok">${fmtSim('pokok')}</b></span><input type="range" min="1000000" max="500000000" step="1000000" value="${s.pokok}" data-input="ut-sim" data-k="pokok"></label>
      <label><span>Bunga per tahun <b data-v="bunga">${fmtSim('bunga')}</b></span><input type="range" min="0" max="30" step="0.25" value="${s.bunga}" data-input="ut-sim" data-k="bunga"></label>
      <label><span>Tenor <b data-v="tenor">${fmtSim('tenor')}</b></span><input type="range" min="1" max="120" step="1" value="${s.tenor}" data-input="ut-sim" data-k="tenor"></label>
      ${UI.field('Metode', `<select data-change="ut-sim" data-k="metode"><option value="anuitas" ${s.metode === 'anuitas' ? 'selected' : ''}>Anuitas</option><option value="flat" ${s.metode === 'flat' ? 'selected' : ''}>Flat</option></select>`)}</div>
      <div id="sim-out">${simOut()}</div><div class="spacer"></div>`;
  }
  const fmtKpr = k => ({ harga: U.rp(S.kpr.harga), dp: S.kpr.dp + '% · ' + U.rpShort(S.kpr.harga * S.kpr.dp / 100), bunga: S.kpr.bunga + '%', tahun: S.kpr.tahun + ' tahun', biaya: S.kpr.biaya + '% · ' + U.rpShort(S.kpr.harga * S.kpr.biaya / 100) })[k];
  function kprOut() {
    const k = S.kpr, P = k.harga * (1 - k.dp / 100), n = k.tahun * 12, a = Calc.amortization(P, k.bunga, n, 'anuitas');
    const minInc = a.cicilan / 0.3, inc = Calc.incomeAvg(), d = Calc.dsr(), r = inc ? (d.cicilan + a.cicilan) / inc : 0;
    const tunai = k.harga * (k.dp + k.biaya) / 100;
    const saved = U.sum(Calc.goals().filter(g => /rumah|dp/i.test(g.t.nama)), g => g.saldo);
    const yr = []; for (let y = 1; y <= k.tahun; y++) { const row = a.rows[y * 12 - 1]; if (y <= 3 || y % 5 === 0 || y === k.tahun) yr.push({ y, sisa: row.sisa, bunga: U.sum(a.rows.slice((y - 1) * 12, y * 12), x => x.bunga), pokok: U.sum(a.rows.slice((y - 1) * 12, y * 12), x => x.pokok) }); }
    return `<div class="stat3"><div class="stat"><small>Cicilan</small><b>${UI.ms(a.cicilan)}</b><small>/bulan</small></div><div class="stat"><small>Plafon</small><b>${UI.ms(P)}</b></div><div class="stat"><small>Total bunga</small><b>${UI.ms(a.totalBunga)}</b></div></div>
      <div class="kv-list card"><div class="kv"><span>Uang tunai awal (DP + biaya)</span><b>${U.rp(tunai)}</b></div><div class="kv"><span>Sudah terkumpul (tujuan rumah/DP)</span><b>${U.rp(saved)}</b></div>
        <div class="kv"><span>Pemasukan minimal (cicilan ≤30%)</span><b>${U.rp(minInc)}</b></div><div class="kv"><span>Rasio cicilan keluarga setelah KPR</span><b class="${r > 0.3 ? 'bad' : 'ok'}">${U.pct(r, 1)}</b></div></div>
      <div class="card"><table class="tbl"><thead><tr><th>Tahun</th><th>Pokok</th><th>Bunga</th><th>Sisa</th></tr></thead><tbody>${yr.map(x => `<tr><td>${x.y}</td><td>${U.rpShort(x.pokok)}</td><td>${U.rpShort(x.bunga)}</td><td>${U.rpShort(x.sisa)}</td></tr>`).join('')}</tbody></table>
      <small class="muted">Asumsi bunga tetap seluruh tenor. KPR umumnya fix 1–5 tahun lalu floating — siapkan ruang bila bunga naik.</small></div>`;
  }
  function kpr() {
    const k = S.kpr;
    return `${TILES('kpr')}<div class="card sliders">
      <label><span>Harga rumah <b data-v="kharga">${fmtKpr('harga')}</b></span><input type="range" min="100000000" max="3000000000" step="10000000" value="${k.harga}" data-input="ut-kpr" data-k="harga"></label>
      <label><span>Uang muka <b data-v="kdp">${fmtKpr('dp')}</b></span><input type="range" min="0" max="60" step="1" value="${k.dp}" data-input="ut-kpr" data-k="dp"></label>
      <label><span>Bunga per tahun <b data-v="kbunga">${fmtKpr('bunga')}</b></span><input type="range" min="2" max="15" step="0.05" value="${k.bunga}" data-input="ut-kpr" data-k="bunga"></label>
      <label><span>Tenor <b data-v="ktahun">${fmtKpr('tahun')}</b></span><input type="range" min="5" max="30" step="1" value="${k.tahun}" data-input="ut-kpr" data-k="tahun"></label>
      <label><span>Biaya akad, pajak, notaris <b data-v="kbiaya">${fmtKpr('biaya')}</b></span><input type="range" min="0" max="12" step="0.5" value="${k.biaya}" data-input="ut-kpr" data-k="biaya"></label></div>
      <div id="kpr-out">${kprOut()}</div><div class="spacer"></div>`;
  }
})();
