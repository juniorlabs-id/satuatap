/* Beranda — ringkasan harian keluarga */
(function () {
  const I = UI.icon;
  UI.drafts = () => {
    const occ = Calc.occurrences(U.addDays(U.today(), -35), U.today());
    return occ.filter(o => (o.kind === 'rutin' || o.kind === 'pinjaman') && !o.lunas && !UI.isTunda(o));
  };
  UI.gajian = () => {
    const occ = Calc.occurrences(U.addDays(U.today(), 1), U.addDays(U.today(), 45));
    return occ.find(o => o.kind === 'rutin' && o.arah === 'masuk' && /gaji/i.test(o.nama + ' ' + ((Store.byId.Kategori[o.kategoriId] || {}).nama || '')));
  };
  function greet() { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; }

  UI.page('beranda', {
    render() {
      const p = Calc.period(), tot = Calc.periodTotals(p), safe = Calc.safeDaily(), di = Calc.dayIndex(p);
      const liq = Calc.liquidTotal(), gaj = UI.gajian(), drafts = UI.drafts();
      const up = Calc.occurrences(U.addDays(U.today(), 1), U.addDays(U.today(), 7)).filter(o => !o.lunas && o.arah !== 'info' && !UI.isTunda(o));
      const proj = Calc.projection(30);
      const env = Calc.envelopes(p).filter(e => e.status === 'hampir' || e.status === 'lewat').sort((a, b) => b.pct - a.pct).slice(0, 3);
      const goals = Calc.goals().filter(g => !g.t.arsip && (g.t.jenis !== 'pribadi' || g.t.pemilik === Store.me.email)).slice(0, 2);
      const recent = Calc.txSorted().slice(0, 5);
      const un = Calc.unallocated(p);
      return `
      <section class="hello"><div><small>${greet()},</small><h2>${U.esc(Store.me.nama)} 👋</h2></div>
        <div class="hello-r">${gaj ? `<span class="pill gold">${I('banknote')} Gajian ${U.diffDays(U.today(), gaj.tanggal)} hari lagi</span>` : ''}</div></section>

      <section class="hero card-primary">
        <div class="hero-top"><small>Total kas & bank</small><button class="icon-btn on-dark" data-act="toggle-hide" aria-label="Sembunyikan">${I(UI.hide() ? 'eye-off' : 'eye')}</button></div>
        <div class="hero-amt">${UI.m(liq)}</div>
        <div class="hero-safe"><div><small>Aman dibelanjakan hari ini</small><b>${UI.m(safe.perHari)}</b></div>
          <div class="hero-days"><small>${p.label}</small><div class="bar light"><i style="width:${(di.now / di.total * 100).toFixed(0)}%"></i></div><small>hari ke-${di.now} dari ${di.total} · sisa ${safe.hari} hari</small></div></div>
      </section>

      ${UI.tiles([
        { id: 'a', icon: 'clipboard-list', label: 'Anggaran', to: 'anggaran' },
        { id: 't', icon: 'target', label: 'Tujuan', to: 'tujuan' },
        { id: 'u', icon: 'scale', label: 'Utang', to: 'utang' },
        { id: 'k', icon: 'calendar-days', label: 'Tagihan', to: 'kalender/tagihan' }
      ], '', 'compact')}

      ${(() => { const due = Calc.occurrences(U.today(), U.addDays(U.today(), 3)).filter(o => !o.lunas && o.arah === 'keluar' && (o.kind === 'rutin' || o.kind === 'pinjaman' || o.kind === 'acara') && !UI.isTunda(o)); return due.length ? `<div class="alert warn" data-act="go" data-to="kalender">${I('bell-ring')}<div><b>${due.length} jadwal bayar ≤ 3 hari lagi</b><small>${due.slice(0, 3).map(o => U.esc(o.nama) + ' (' + U.relDay(o.tanggal).toLowerCase() + ')').join(' · ')}</small></div>${I('chevron-right')}</div>` : ''; })()}
      ${proj.kritis ? `<div class="alert warn" data-act="go" data-to="kalender/arus">${I('triangle-alert')}<div><b>Siaga Dana ${U.tgl(proj.kritis.d, 'dm')}</b><small>Perkiraan saldo tinggal ${UI.m(proj.kritis.bal)} saat ada tagihan. Siapkan dana atau geser jadwal.</small></div>${I('chevron-right')}</div>` : ''}

      ${drafts.length ? `${UI.sec('Menunggu konfirmasi <span class="count">' + drafts.length + '</span>', '<small class="muted">geser kanan ✓</small>')}<div class="card list">${drafts.slice(0, 4).map(UI.draftRow).join('')}</div>` : ''}

      ${up.length ? `${UI.sec('7 hari ke depan', '<a href="#/kalender" class="link">Kalender</a>')}<div class="card list">${up.slice(0, 5).map(o => `
        <div class="row" data-act="occ-pay" data-occ="${U.esc(o.id)}"><div class="date-chip"><b>${U.parseDate(o.tanggal).getDate()}</b><small>${U.BLN[U.parseDate(o.tanggal).getMonth()]}</small></div>
        <div class="tx-txt"><b>${U.esc(o.nama)}</b><small>${U.relDay(o.tanggal)}${o.kind === 'acara' ? ' · rencana' : ''}</small></div>${UI.amount(o.sisa, o.arah === 'masuk' ? 'masuk' : 'keluar')}</div>`).join('')}</div>` : ''}

      ${UI.sec('Periode ' + U.esc(p.label), '<a href="#/rapor" class="link">Rapor</a>')}
      <div class="stat3">
        <div class="stat in"><small>${I('arrow-down-left')} Masuk</small><b>${UI.ms(tot.masuk)}</b></div>
        <div class="stat out"><small>${I('arrow-up-right')} Keluar</small><b>${UI.ms(tot.keluar)}</b></div>
        <div class="stat sav"><small>${I('piggy-bank')} Ditabung</small><b>${UI.ms(tot.tabung)}</b></div>
      </div>
      ${un.sisa > 0 && un.income > 0 ? `<div class="alert info" data-act="go" data-to="anggaran/bagi">${I('coins')}<div><b>${UI.m(un.sisa)} belum punya tugas</b><small>Bagi ke amplop atau tujuan supaya setiap rupiah punya tugas.</small></div>${I('chevron-right')}</div>` : ''}

      ${env.length ? `${UI.sec('Amplop perlu perhatian', '<a href="#/anggaran" class="link">Semua</a>')}<div class="card list">${env.map(e => `
        <div class="row env-mini" data-act="go" data-to="anggaran"><span class="cat-ic">${I(e.k.ikon || 'circle-dot')}</span><div class="grow"><div class="row-sp"><b>${U.esc(e.k.nama)}</b><small class="${e.status}">${e.sisa < 0 ? 'Lewat ' + UI.ms(-e.sisa) : 'Sisa ' + UI.ms(e.sisa)}</small></div>${UI.bar(e.pct, e.status)}</div></div>`).join('')}</div>` : ''}

      ${goals.length ? `${UI.sec('Tujuan keluarga', '<a href="#/tujuan" class="link">Semua</a>')}<div class="goal-row">${goals.map(g => `
        <button class="goal-mini" data-act="go" data-to="tujuan/${g.t.id}">${Charts.jar(g.pct, true)}<div><b>${U.esc(g.t.nama)}</b><small>${U.pct(Math.min(1, g.pct))} · ${UI.ms(g.saldo)}</small></div></button>`).join('')}</div>` : ''}

      ${UI.sec('Transaksi terbaru', '<a href="#/mutasi" class="link">Mutasi</a>')}
      <div class="card list">${recent.length ? recent.map(t => UI.txRow(t, { date: true })).join('') : UI.empty('receipt', 'Belum ada transaksi', 'Tekan tombol + untuk mencatat yang pertama.')}</div>
      <div class="spacer"></div>`;
    }
  });
})();
