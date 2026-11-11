/* Aset — kekayaan bersih, Kas & Bank (dompet), pintasan Tujuan/Utang */
(function () {
  const I = UI.icon;
  const JENIS_W = { bank: ['Rekening bank', 'landmark'], ewallet: ['Dompet digital', 'smartphone'], tunai: ['Tunai', 'banknote'], kartu: ['Kartu kredit', 'credit-card'], lain: ['Lainnya', 'wallet'] };
  const wIcon = w => (JENIS_W[w.jenis] || JENIS_W.lain)[1];
  const ownerLabel = w => w.pemilik && w.pemilik !== 'bersama' ? Store.memberName(w.pemilik) : 'Bersama';

  UI.walletForm = (w) => {
    const isNew = !w; w = w || { id: U.uid('w'), nama: '', jenis: 'bank', pemilik: 'bersama', saldoAwal: 0, ikon: '', likuid: true, urutan: Store.t.Wallet.length, arsip: false, catatan: '' };
    const bal = isNew ? 0 : Calc.balances()[w.id] || 0;
    const s = UI.sheet({ title: isNew ? 'Tambah dompet / rekening' : 'Ubah dompet', body: `
      ${UI.field('Nama', `<input name="nama" maxlength="40" value="${U.esc(w.nama)}" placeholder="mis. BCA Bersama, GoPay Rini">`)}
      <div class="grid2">${UI.field('Jenis', `<select name="jenis">${Object.keys(JENIS_W).map(k => `<option value="${k}" ${w.jenis === k ? 'selected' : ''}>${JENIS_W[k][0]}</option>`).join('')}</select>`)}
        ${UI.field('Pemilik', `<select name="pemilik"><option value="bersama">Bersama</option>${Store.members().map(m => `<option value="${m.email}" ${w.pemilik === m.email ? 'selected' : ''}>${U.esc(m.nama)}</option>`).join('')}</select>`)}</div>
      ${isNew ? UI.field('Saldo saat ini', UI.rpInput('saldoAwal', 0), 'Isi sesuai saldo hari ini. Kartu kredit: isi 0.') : `<div class="note">${I('info')} Saldo sekarang ${U.rp(bal)}. Untuk mengoreksi saldo, gunakan <b>Cocokkan saldo</b>.</div>`}
      <label class="check"><input type="checkbox" name="likuid" ${w.likuid !== false ? 'checked' : ''}><span>Hitung sebagai kas likuid (dipakai untuk "aman dibelanjakan" & proyeksi)</span></label>
      ${UI.field('Catatan', `<input name="catatan" maxlength="100" value="${U.esc(w.catatan)}" placeholder="mis. 4 digit akhir 1234">`, 'Jangan simpan nomor rekening lengkap, PIN, atau kata sandi.')}`,
      foot: `${isNew ? '' : `<button class="btn ghost" data-arsip>${I(w.arsip ? 'archive-restore' : 'archive')} ${w.arsip ? 'Aktifkan' : 'Arsipkan'}</button>`}<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el); if (!f.nama) return UI.toast('Nama wajib diisi.', 'warn');
      if (!isNew) delete f.saldoAwal;
      Store.upsert('Wallet', Object.assign({}, w, f)); s.close(); UI.toast('Dompet disimpan.');
    };
    const ar = s.el.querySelector('[data-arsip]');
    if (ar) ar.onclick = () => { if (!w.arsip && Math.abs(bal) > 0) return UI.toast('Kosongkan saldo dulu (transfer ke dompet lain) sebelum diarsipkan.', 'warn'); Store.upsert('Wallet', { id: w.id, arsip: !w.arsip }); s.close(); };
  };
  UI.cocokkan = (w) => {
    const bal = Calc.balances()[w.id] || 0;
    const s = UI.sheet({ title: 'Cocokkan saldo · ' + w.nama, cls: 'small', body: `
      <p class="muted">Saldo di aplikasi: <b>${U.rp(bal)}</b>. Masukkan saldo sebenarnya di bank/e-wallet; selisihnya dicatat sebagai penyesuaian.</p>
      ${UI.field('Saldo sebenarnya', UI.rpInput('aktual', bal))}<div class="diff muted"></div>`,
      foot: `<button class="btn" data-ok>Sesuaikan</button>` });
    UI.bindRp(s.el);
    const inp = s.el.querySelector('[name=aktual]'), diff = s.el.querySelector('.diff');
    const upd = () => { const d = U.parseRp(inp.value) - bal; diff.textContent = d ? 'Selisih ' + (d > 0 ? '+' : '−') + U.rp(Math.abs(d)) : 'Sudah cocok ✓'; };
    inp.addEventListener('input', upd); upd();
    s.el.querySelector('[data-ok]').onclick = () => {
      const d = U.parseRp(inp.value) - bal; if (!d) { s.close(); return; }
      const me = Store.me.email;
      Store.upsert('Transaksi', { id: U.uid('t'), tanggal: U.today(), jenis: 'penyesuaian', jumlah: d, kategoriId: '', walletId: w.id, walletTujuan: '', biaya: 0, catatan: 'Cocokkan saldo ' + w.nama, dibayarOleh: me, tag: '', sumber: 'app', refId: '', periodeRef: '', dicatatOleh: me, dibuat: new Date().toISOString(), riwayat: [] });
      s.close(); UI.toast('Saldo disesuaikan.');
    };
  };
  UI.act('wallet-add', () => UI.walletForm());
  UI.act('wallet-open', el => {
    const w = Store.byId.Wallet[el.dataset.id]; if (!w) return;
    const bal = Calc.balances()[w.id] || 0;
    const tx = Calc.txSorted().filter(t => t.walletId === w.id || t.walletTujuan === w.id).slice(0, 8);
    const s = UI.sheet({ title: w.nama, body: `<div class="detail-head"><span class="cat-ic lg">${I(wIcon(w))}</span><div><small class="muted">${(JENIS_W[w.jenis] || JENIS_W.lain)[0]} · ${U.esc(ownerLabel(w))}</small><div class="big-amt">${UI.m(bal)}</div></div></div>
      <div class="chips"><button class="chip" data-a="tf">${I('arrow-left-right')} Transfer</button><button class="chip" data-a="cocok">${I('scale')} Cocokkan saldo</button><button class="chip" data-a="edit">${I('pencil')} Ubah</button></div>
      <h4 class="mini-h">Transaksi terakhir</h4><div class="list">${tx.map(t => UI.txRow(t, { date: true })).join('') || '<p class="muted">Belum ada transaksi.</p>'}</div>` });
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { s.close(); const a = b.dataset.a; if (a === 'tf') UI.catat({ preset: { jenis: 'transfer', walletId: w.id } }); else if (a === 'cocok') UI.cocokkan(w); else UI.walletForm(w); });
  });

  const TILES = () => [
    { id: 'kas', icon: 'landmark', label: 'Kas & Bank', to: 'aset/kas' },
    { id: 'tujuan', icon: 'target', label: 'Tujuan', to: 'tujuan' },
    { id: 'utang', icon: 'scale', label: 'Utang & Piutang', to: 'utang' },
    { id: 'emas', icon: 'gem', label: 'Brankas Emas', to: 'emas', gold: true },
    { id: 'saham', icon: 'chart-candlestick', label: 'Saham', to: 'investasi/saham' },
    { id: 'rd', icon: 'chart-pie', label: 'Reksa Dana', to: 'investasi/reksadana' },
    { id: 'sbn', icon: 'file-badge', label: 'SBN & Deposito', to: 'investasi/sbn' },
    { id: 'prop', icon: 'house', label: 'Properti & Tanah', to: 'investasi/properti' },
    { id: 'lain', icon: 'car', label: 'Aset Lain', to: 'investasi/lain' },
    { id: 'zakat', icon: 'hand-heart', label: 'Zakat', to: 'zakat', gold: true },
    { id: 'alok', icon: 'scale', label: 'Target Alokasi', to: 'investasi/alokasi' },
    { id: 'skor', icon: 'heart-pulse', label: 'Skor Kesehatan', to: 'rapor/rasio' }
  ];

  UI.page('aset', {
    head: p => p === 'kas' ? { title: 'Kas & Bank', crumb: 'Aset', back: 'aset', right: `<button class="icon-btn" data-act="wallet-add" aria-label="Tambah">${I('plus')}</button>` } : null,
    nav: () => 'aset',
    render(p) {
      if (!Store.can('aset', 'lihat')) return UI.empty('lock', 'Tidak ada akses', 'Minta Admin memberi izin menu Aset.');
      if (p === 'kas') return kas();
      const nw = Calc.netWorth(), b = Calc.balances();
      const PAL = ['#2E7D9A', '#7A5BC7', '#C2185B', '#5D8A3A', '#8D6E63', '#00897B', '#6D4C41', '#546E7A'];
      const kl = nw.kelas || {}, kk = Object.keys(kl).filter(k => k !== 'emas' && kl[k] > 0);
      const parts = [{ v: Math.max(0, nw.kas), color: 'var(--primary)', label: 'Kas & bank', to: 'aset/kas' }, { v: nw.danaTujuan, color: 'var(--secondary)', label: 'Dana tujuan (di luar dompet)', to: 'tujuan' },
        { v: kl.emas || 0, color: 'var(--gold)', label: 'Emas', to: 'emas' }]
        .concat(kk.map((k, i) => ({ v: kl[k], color: PAL[i % PAL.length], label: (Calc.KELAS[k] || {}).label || k, to: 'investasi/' + k })))
        .concat([{ v: nw.piutang, color: 'var(--muted)', label: 'Piutang', to: 'utang' }]).filter(x => x.v > 0);
      const ws = Store.wallets();
      return `
        <section class="hero card-primary"><div class="hero-top"><small>Kekayaan bersih keluarga</small><button class="icon-btn on-dark" data-act="toggle-hide">${I(UI.hide() ? 'eye-off' : 'eye')}</button></div>
          <div class="hero-amt">${UI.m(nw.bersih)}</div>
          <div class="hero-split"><div><small>Total aset</small><b>${UI.ms(nw.aset)}</b></div><div><small>Total utang</small><b>${UI.ms(nw.utang)}</b></div></div></section>
        ${UI.tiles(TILES())}
        <div class="card donut-card">${Charts.donut(parts.length ? parts : [{ v: 1, color: 'var(--outline-variant)' }], ['Aset', UI.ms(nw.aset)])}
          <ul class="legend">${parts.map(x => `<li data-act="go" data-to="${x.to}"><i style="background:${x.color}"></i>${U.esc(x.label)}<b>${UI.ms(x.v)}</b></li>`).join('')}${nw.investasi ? '' : '<li class="muted small">Tambahkan emas, saham, reksa dana atau properti lewat ubin di atas.</li>'}</ul></div>
        ${UI.sec('Dompet & rekening', '<a class="link" href="#/aset/kas">Kelola</a>')}
        <div class="card list">${ws.map(w => `<div class="row" data-act="wallet-open" data-id="${w.id}"><span class="cat-ic">${I(wIcon(w))}</span><div class="tx-txt"><b>${U.esc(w.nama)}</b><small>${U.esc(ownerLabel(w))}${w.likuid === false ? ' · tidak likuid' : ''}</small></div><b class="${(b[w.id] || 0) < 0 ? 'bad' : ''}">${UI.m(b[w.id] || 0)}</b></div>`).join('') || `<div class="row muted">Belum ada dompet. <button class="link" data-act="wallet-add">Tambah</button></div>`}</div>
        <div class="spacer"></div>`;
    }
  });

  function kas() {
    const b = Calc.balances(), all = Store.wallets(true);
    const grp = U.groupBy(all.filter(w => !w.arsip), w => w.jenis in JENIS_W ? w.jenis : 'lain');
    const arsip = all.filter(w => w.arsip);
    return `
      <div class="stat3"><div class="stat"><small>Kas likuid</small><b>${UI.ms(Calc.liquidTotal())}</b></div><div class="stat"><small>Semua dompet</small><b>${UI.ms(Calc.walletTotal())}</b></div><div class="stat"><small>Jumlah</small><b>${all.length - arsip.length}</b></div></div>
      ${Object.keys(JENIS_W).filter(k => grp[k]).map(k => `${UI.sec(JENIS_W[k][0], `<small class="muted">${UI.ms(U.sum(grp[k], w => b[w.id]))}</small>`)}<div class="card list">${grp[k].map(w => `
        <div class="row"><span class="cat-ic">${I(wIcon(w))}</span><div class="tx-txt" data-act="wallet-open" data-id="${w.id}"><b>${U.esc(w.nama)}</b><small>${U.esc(ownerLabel(w))}${w.catatan ? ' · ' + U.esc(w.catatan) : ''}</small></div>
        <b class="${(b[w.id] || 0) < 0 ? 'bad' : ''}">${UI.m(b[w.id] || 0)}</b><button class="kebab" data-act="wallet-open" data-id="${w.id}">${I('ellipsis-vertical')}</button></div>`).join('')}</div>`).join('')}
      <button class="btn block ghost" data-act="wallet-add">${I('plus')} Tambah dompet / rekening</button>
      ${arsip.length ? UI.sec('Diarsipkan') + `<div class="card list">${arsip.map(w => `<div class="row muted" data-act="wallet-open" data-id="${w.id}"><span class="cat-ic">${I('archive')}</span><div class="tx-txt"><b>${U.esc(w.nama)}</b></div></div>`).join('')}</div>` : ''}
      <div class="spacer"></div>`;
  }

  const SOON = { zakat: ['Zakat & Sedekah', 'hand-heart', 'Kalkulator zakat mal (emas, tabungan, investasi), zakat fitrah, qurban & catatan sedekah.'], rapat: ['Rapat Keuangan', 'users', 'Agenda rapat bulanan suami-istri: review anggaran, tujuan, keputusan & catatan bersama.'] };
  UI.page('soon', {
    head: p => ({ title: (SOON[p] || ['Segera hadir'])[0], crumb: 'Segera hadir', back: 'lainnya' }), nav: () => 'lainnya',
    render: p => { const x = SOON[p] || ['Fitur ini', 'hourglass', '']; return `<div class="empty">${I(x[1], 'big')}<h3>${U.esc(x[0])} — segera hadir</h3><p>${U.esc(x[2])}</p><p>Fitur ini dijadwalkan pada pembaruan Fase 2–3. Data yang Anda catat sekarang akan langsung terpakai.</p></div>`; }
  });
  UI.act('soon', el => {
    const lb = el.querySelector('.tile-lb'); const name = lb ? lb.textContent : 'Fitur ini';
    UI.sheet({ title: name, cls: 'small', body: `<div class="empty">${I('hourglass', 'big')}<h3>Segera hadir</h3><p>${U.esc(name)} sedang disiapkan untuk pembaruan berikutnya (Fase 2–3). Data yang Anda catat sekarang akan langsung terhubung saat fitur ini rilis.</p></div>` });
  });
})();
