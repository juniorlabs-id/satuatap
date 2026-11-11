/* Kilas Balik Keuangan Tahunan (R-08) — ringkasan + kartu geser */
(function () {
  const I = UI.icon;
  let tahun = 0;
  const thDefault = () => { const d = new Date(); return d.getMonth() >= 10 ? d.getFullYear() : d.getFullYear() - 1; };   // Nov–Des: tahun berjalan
  const BLN = m => U.tgl(m + '-01', 'my');

  /** Kartu-kartu cerita satu tahun. Dipakai juga oleh Rapat tahunan. */
  UI.kilasCards = (th) => {
    const k = Calc.kilas(th), nama = Store.setting('namaKeluarga', 'Keluarga');
    if (!k.adaData) return [{ cls: 'hero-slide', html: `<p class="kicker">${I('sparkles')} Kilas Balik ${th}</p><h2>Belum ada catatan di tahun ${th}</h2><p class="muted">Mulai mencatat, dan kilas balik tahun depan akan penuh cerita.</p>` }];
    const top = k.kat.slice(0, 5), maxK = top.length ? top[0].v : 1;
    const cards = [
      { cls: 'hero-slide', html: `<p class="kicker">${I('sparkles')} Kilas Balik Keuangan</p><div class="big">${th}</div><h2>${U.esc(nama)}</h2>
        <p>${U.fmtNum(k.jumlahTx)} transaksi tercatat bersama. Mari lihat perjalanannya.</p>` },
      { html: `<p class="kicker">${I('arrow-left-right')} Uang masuk & keluar</p>
        <div class="stat3"><div class="stat in"><small>Pemasukan</small><b>${UI.ms(k.masuk)}</b></div><div class="stat out"><small>Pengeluaran</small><b>${UI.ms(k.keluar)}</b></div><div class="stat"><small>Ditabung</small><b>${UI.ms(k.tabung)}</b></div></div>
        <p>${k.sisa >= 0 ? `Sisa ${UI.m(k.sisa)} — ${U.pct(k.masuk ? k.sisa / k.masuk : 0)} dari pemasukan tidak habis terpakai.` : `Pengeluaran lebih besar ${UI.m(-k.sisa)} dari pemasukan.`}</p>
        ${(() => { const ms = Object.keys(k.perBulan).sort(); return Charts.bars(ms.map(m => ({ label: U.BLN[Number(m.slice(5)) - 1].slice(0, 3), b: k.perBulan[m] })), { h: 130, selected: ms.indexOf(k.bulanBoros), aria: 'Pengeluaran per bulan' }); })()}
        ${k.bulanBoros ? `<small class="muted">Bulan paling boros: <b>${BLN(k.bulanBoros)}</b> (${UI.ms(k.perBulan[k.bulanBoros])})</small>` : ''}` },
      { html: `<p class="kicker">${I('chart-pie')} Ke mana uangnya pergi</p><h2>${U.esc(top[0] ? top[0].nama : '-')}</h2><p class="muted">kategori terbesar tahun ini</p>
        <div class="list">${top.map((x, i) => `<div class="row"><span class="cat-ic">${I(x.ikon)}</span><div class="tx-txt"><b>${i + 1}. ${U.esc(x.nama)}</b>${UI.bar(x.v / maxK, 'aman')}</div><b>${UI.ms(x.v)}</b></div>`).join('')}</div>` }
    ];
    if (k.hemat.length) cards.push({ html: `<p class="kicker">${I('trending-down')} Berhasil dihemat</p><h2>Dibanding ${th - 1}</h2>
        <div class="list">${k.hemat.map(x => `<div class="row"><div class="tx-txt"><b>${U.esc(x.nama)}</b><small>${UI.ms(x.prev)} → ${UI.ms(x.v)}</small></div><b class="ok">−${UI.ms(x.turun)}</b></div>`).join('')}</div>` });
    cards.push({ html: `<p class="kicker">${I('calendar-days')} Kebiasaan</p>
        <div class="kv-list"><div class="kv"><span>Hari paling sering belanja</span><b>${k.hari}</b></div>
        ${k.terbesar ? `<div class="kv"><span>Pengeluaran terbesar</span><b>${UI.ms(k.terbesar.jumlah)}</b></div><div class="kv"><span></span><small class="muted">${U.esc(UI.note(k.terbesar) || (Store.byId.Kategori[k.terbesar.kategoriId] || {}).nama || '')} · ${U.tgl(k.terbesar.tanggal)}</small></div>` : ''}
        ${k.orangTop ? `<div class="kv"><span>Paling rajin mencatat</span><b>${U.esc(Store.memberName(k.orangTop))} (${k.perOrang[k.orangTop]}×)</b></div>` : ''}
        ${k.zakat ? `<div class="kv"><span>Zakat & sedekah</span><b>${UI.ms(k.zakat)}</b></div>` : ''}</div>` });
    if (k.tercapai.length) cards.push({ cls: 'hero-slide', html: `<p class="kicker">${I('trophy')} Tujuan tercapai</p><div class="big">${k.tercapai.length}</div>
        <div class="list">${k.tercapai.map(g => `<div class="row"><span class="cat-ic">${I(g.t.ikon || 'target')}</span><div class="tx-txt"><b>${U.esc(g.t.nama)}</b><small>${UI.ms(g.target)}</small></div>${I('circle-check')}</div>`).join('')}</div>` });
    if (k.gramBeli || k.gramJual) cards.push({ cls: 'gold-slide', html: `<p class="kicker">${I('gem')} Brankas Emas</p><div class="big">${k.gramBeli - k.gramJual >= 0 ? '+' : ''}${U.fmtNum(Math.round((k.gramBeli - k.gramJual) * 100) / 100)} g</div>
        <p>Dibeli ${U.fmtNum(k.gramBeli)} g${k.gramJual ? ', dijual ' + U.fmtNum(k.gramJual) + ' g' : ''} sepanjang ${th}.</p>` });
    if (k.nw) cards.push({ html: `<p class="kicker">${I('landmark')} Kekayaan bersih</p><div class="big ${k.nw.naik >= 0 ? 'ok' : 'bad'}">${k.nw.naik >= 0 ? '+' : '−'}${UI.ms(Math.abs(k.nw.naik))}</div>
        <p>${UI.ms(k.nw.awal)} → ${UI.ms(k.nw.akhir)} (31 Des ${th - 1} → 31 Des ${th})</p><small class="muted">Dihitung dari nilai perolehan, sama dengan Ringkasan SPT.</small>` });
    cards.push({ cls: 'hero-slide', html: `<p class="kicker">${I('flag')} Tahun depan</p><h2>Apa target ${th + 1}?</h2>
        <p>Bahas di Rapat Keuangan tahunan: tetapkan Tujuan baru, sesuaikan anggaran, dan bagi tugas.</p>
        <div class="acts"><button class="btn" data-act="go" data-to="rapat" data-tutup>${I('users')} Buka Rapat Keuangan</button></div>` });
    return cards;
  };
  UI.act('kilas-th', el => { tahun = Number(el.dataset.v); UI.render(); });
  UI.act('kilas-putar', () => UI.slides(UI.kilasCards(tahun || thDefault())));

  UI.page('kilas', {
    head: () => ({ title: 'Kilas Balik', crumb: 'Rapor', back: 'rapor' }), nav: () => 'rapor',
    render() {
      const th = tahun || thDefault(), y = new Date().getFullYear(), k = Calc.kilas(th);
      const anyYears = [y - 2, y - 1, y].filter(x => x === th || Calc.kilas(x).adaData);
      return `<div class="chips">${anyYears.map(x => `<button class="chip ${x === th ? 'on' : ''}" data-act="kilas-th" data-v="${x}">${x}</button>`).join('')}</div>
        <section class="hero compact"><div class="hero-top"><small>Kilas Balik ${th}</small>${UI.pill(U.fmtNum(k.jumlahTx) + ' transaksi', '')}</div>
          <div class="hero-split"><div><small>Pemasukan</small><b>${UI.ms(k.masuk)}</b></div><div><small>Pengeluaran</small><b>${UI.ms(k.keluar)}</b></div></div>
          <button class="btn block on-dark" data-act="kilas-putar">${I('play')} Putar Kilas Balik</button></section>
        ${k.adaData ? `${UI.sec('Kategori terbesar')}<div class="card list">${k.kat.slice(0, 5).map(x => `<div class="row"><span class="cat-ic">${I(x.ikon)}</span><div class="tx-txt"><b>${U.esc(x.nama)}</b></div><b>${UI.ms(x.v)}</b></div>`).join('')}</div>
          <div class="card kv-list"><div class="kv"><span>Ditabung ke Tujuan</span><b>${UI.ms(k.tabung)}</b></div><div class="kv"><span>Tujuan tercapai</span><b>${k.tercapai.length}</b></div>
            <div class="kv"><span>Emas bertambah</span><b>${U.fmtNum(Math.round((k.gramBeli - k.gramJual) * 100) / 100)} g</b></div>${k.nw ? `<div class="kv"><span>Kekayaan bersih</span><b class="${k.nw.naik >= 0 ? 'ok' : 'bad'}">${k.nw.naik >= 0 ? '+' : '−'}${UI.ms(Math.abs(k.nw.naik))}</b></div>` : ''}</div>`
          : UI.empty('history', 'Belum ada catatan di ' + th, 'Kilas Balik muncul setelah ada transaksi di tahun ini.')}
        <div class="spacer"></div>`;
    }
  });
})();
