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
  // ---------- Susunan Beranda: urutan & sembunyikan kartu, per anggota (tersimpan di Pengaturan) ----------
  const BLOK = [['hero', 'Kas & aman dibelanjakan', 'wallet'], ['peringatan', 'Peringatan & pengingat', 'bell'], ['insight', 'Insight AI minggu ini', 'sparkles'], ['konfirmasi', 'Menunggu konfirmasi', 'circle-check'],
    ['tujuh', '7 hari ke depan', 'calendar'], ['periode', 'Ringkasan periode', 'chart-column'], ['amplop', 'Amplop perlu perhatian', 'mail'], ['goals', 'Goals keluarga', 'target'], ['terbaru', 'Transaksi terbaru', 'receipt']];
  const kunciUrut = () => 'berandaUrut:' + ((Store.me && Store.me.email) || '');
  const bacaCfg = () => { try { const o = JSON.parse(Store.setting(kunciUrut(), '') || '{}'); return { urut: Array.isArray(o.urut) ? o.urut : [], sembunyi: Array.isArray(o.sembunyi) ? o.sembunyi : [] }; } catch (e) { return { urut: [], sembunyi: [] }; } };
  /** Urutan blok aktif (blok baru di versi mendatang otomatis ditambahkan di posisi bawaannya). */
  UI.berandaUrut = (semua) => {
    const c = bacaCfg(), ids = BLOK.map(b => b[0]), u = c.urut.filter(k => ids.indexOf(k) > -1);
    ids.forEach((k, i) => { if (u.indexOf(k) < 0) u.splice(Math.min(i, u.length), 0, k); });
    return semua ? u : u.filter(k => c.sembunyi.indexOf(k) < 0);
  };
  UI.berandaAtur = () => {
    const c = bacaCfg(), nama = k => BLOK.find(b => b[0] === k);
    return `<div class="bd-edit-h"><div><b>Atur Beranda</b><small>Tahan & geser ${I('grip-vertical')} untuk mengubah urutan. Ketuk ${I('eye')} untuk menyembunyikan.</small></div></div>
      <div class="card list bd-sort">${UI.berandaUrut(true).map(k => { const b = nama(k), off = c.sembunyi.indexOf(k) > -1;
        return `<div class="row bd-item ${off ? 'off' : ''}" data-k="${k}"><span class="bd-grip" aria-label="Geser">${I('grip-vertical')}</span><span class="cat-ic">${I(b[2])}</span><div class="tx-txt"><b>${b[1]}</b>${off ? '<small>disembunyikan</small>' : ''}</div>
          <button class="icon-btn" data-act="bd-lihat" data-k="${k}" aria-label="${off ? 'Tampilkan' : 'Sembunyikan'}">${I(off ? 'eye-off' : 'eye')}</button></div>`; }).join('')}</div>
      <div class="row-btns"><button class="btn ghost" data-act="bd-reset">Urutan bawaan</button><button class="btn" data-act="bd-selesai">${I('check')} Selesai</button></div><div class="spacer"></div>`;
  };
  const simpanCfg = c => Store.setSetting(kunciUrut(), JSON.stringify(c));
  window.addEventListener('hashchange', () => { UI.atur = false; });
  UI.act('bd-atur', () => { UI.atur = true; UI.render(); window.scrollTo(0, 0); });
  UI.act('bd-selesai', () => { UI.atur = false; UI.render(); UI.toast('Susunan Beranda tersimpan.'); });
  UI.act('bd-reset', () => { simpanCfg({ urut: [], sembunyi: [] }); UI.render(); });
  UI.act('bd-lihat', el => { const c = bacaCfg(), k = el.dataset.k, i = c.sembunyi.indexOf(k); if (i > -1) c.sembunyi.splice(i, 1); else c.sembunyi.push(k); c.urut = UI.berandaUrut(true); simpanCfg(c); UI.render(); });
  // drag & drop urutan (pointer: jari & mouse)
  document.addEventListener('pointerdown', e => {
    const g = e.target.closest('.bd-grip'); if (!g) return;
    const item = g.closest('.bd-item'), list = item.parentElement; e.preventDefault();
    const tinggi = item.offsetHeight + 1, y0 = e.clientY; let dy = 0;
    item.classList.add('drag'); g.setPointerCapture(e.pointerId); if (navigator.vibrate) navigator.vibrate(15);
    let base = y0;
    const gerak2 = ev => { dy = ev.clientY - base; item.style.transform = `translateY(${dy}px)`;
      const prev = item.previousElementSibling, next = item.nextElementSibling;
      if (next && dy > tinggi * 0.6) { list.insertBefore(next, item); base += tinggi; dy -= tinggi; item.style.transform = `translateY(${dy}px)`; }
      else if (prev && dy < -tinggi * 0.6) { list.insertBefore(prev, item.nextSibling); base -= tinggi; dy += tinggi; item.style.transform = `translateY(${dy}px)`; } };
    const selesai = () => { g.removeEventListener('pointermove', gerak2); g.removeEventListener('pointerup', selesai); g.removeEventListener('pointercancel', selesai);
      item.classList.remove('drag'); item.style.transform = '';
      const c = bacaCfg(); c.urut = [].map.call(list.querySelectorAll('.bd-item'), x => x.dataset.k); simpanCfg(c); };
    g.addEventListener('pointermove', gerak2); g.addEventListener('pointerup', selesai); g.addEventListener('pointercancel', selesai);
  });
  function greet() { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; }

  UI.page('beranda', {
    render() {
      const p = Calc.period(), tot = Calc.periodTotals(p), safe = Calc.safeDaily(), di = Calc.dayIndex(p);
      const liq = Calc.liquidTotal(), gaj = UI.gajian(), drafts = UI.drafts(), kotak = UI.kotakList ? UI.kotakList() : [];
      const up = Calc.occurrences(U.addDays(U.today(), 1), U.addDays(U.today(), 7)).filter(o => !o.lunas && o.arah !== 'info' && !UI.isTunda(o));
      const proj = Calc.projection(30);
      const env = Calc.envelopes(p).filter(e => e.status === 'hampir' || e.status === 'lewat').sort((a, b) => b.pct - a.pct).slice(0, 3);
      const goals = Calc.goals().filter(g => !g.t.arsip && (g.t.jenis !== 'pribadi' || g.t.pemilik === Store.me.email)).slice(0, 2);
      const recent = Calc.txSorted().slice(0, 5);
      const un = Calc.unallocated(p);
      const B = {
        hero: () => `      <section class="hero card-primary">
        <div class="hero-top"><small>Total kas & bank</small><button class="icon-btn on-dark" data-act="toggle-hide" aria-label="Sembunyikan">${I(UI.hide() ? 'eye-off' : 'eye')}</button></div>
        <div class="hero-amt">${UI.m(liq)}</div>
        <div class="hero-safe"><div><small>Aman dibelanjakan hari ini</small><b>${UI.m(safe.perHari)}</b></div>
          <div class="hero-days"><small>${p.label}</small><div class="bar light"><i style="width:${(di.now / di.total * 100).toFixed(0)}%"></i></div><small>hari ke-${di.now} dari ${di.total} · sisa ${safe.hari} hari</small></div></div>
      </section>`,
        peringatan: () => `      ${UI.langgananAlert ? UI.langgananAlert() : ''}
      ${(() => { const due = Calc.occurrences(U.today(), U.addDays(U.today(), 3)).filter(o => !o.lunas && o.arah === 'keluar' && (o.kind === 'rutin' || o.kind === 'pinjaman' || o.kind === 'acara') && !UI.isTunda(o)); return due.length ? `<div class="alert warn" data-act="go" data-to="kalender">${I('bell-ring')}<div><b>${due.length} jadwal bayar ≤ 3 hari lagi</b><small>${due.slice(0, 3).map(o => U.esc(o.nama) + ' (' + U.relDay(o.tanggal).toLowerCase() + ')').join(' · ')}</small></div>${I('chevron-right')}</div>` : ''; })()}
      ${UI.emasAlert ? UI.emasAlert() : ''}
      ${UI.pasangKartu ? UI.pasangKartu('beranda') : ''}
      ${UI.kotakAlert ? UI.kotakAlert() : ''}
      ${(() => { const lewat = Calc.tugasList().filter(t => t.tenggat && t.tenggat < U.today()).length;
        const jd = Store.setting('rapatTanggal', '') !== '' ? Calc.rapatJadwal(U.today(), U.addDays(U.today(), 1)).filter(x => !x.lunas)[0] : null, sisaJ = jd ? U.diffDays(U.today(), jd.tanggal) : 9;
        return (jd ? `<div class="alert" data-act="go" data-to="rapat">${I('users')}<div><b>Rapat keuangan ${sisaJ <= 0 ? 'hari ini' : 'besok'}</b><small>Agenda sudah disusun otomatis — 20 menit cukup.</small></div>${I('chevron-right')}</div>` : '')
          + (lewat ? `<div class="alert warn" data-act="go" data-to="rapat">${I('list-checks')}<div><b>${lewat} tugas rapat lewat tenggat</b><small>Lihat di Rapat Keuangan.</small></div>${I('chevron-right')}</div>` : ''); })()}
      ${(() => { const z = Calc.zakatMal(); return z.haul && z.wajib && z.kurang > 0 && z.haul.sisa <= 14 ? `<div class="alert" data-act="go" data-to="zakat">${I('hand-heart')}<div><b>Haul zakat mal ${z.haul.sisa <= 0 ? 'sudah tiba' : z.haul.sisa + ' hari lagi'}</b><small>Perkiraan zakat ${UI.m(z.kurang)} (2,5% dari harta bersih).</small></div>${I('chevron-right')}</div>` : ''; })()}
      ${proj.kritis ? `<div class="alert warn" data-act="go" data-to="kalender/arus">${I('triangle-alert')}<div><b>Siaga Dana ${U.tgl(proj.kritis.d, 'dm')}</b><small>Perkiraan saldo tinggal ${UI.m(proj.kritis.bal)} saat ada tagihan. Siapkan dana atau geser jadwal.</small></div>${I('chevron-right')}</div>` : ''}`,
        insight: () => `      ${UI.aiInsightCard ? UI.aiInsightCard() : ''}`,
        konfirmasi: () => `      ${drafts.length || kotak.length ? `${UI.sec('Menunggu konfirmasi <span class="count">' + (drafts.length + kotak.length) + '</span>', '<small class="muted">geser kanan ✓</small>')}<div class="card list">${kotak.slice(0, 4).map(UI.kotakRow).join('')}${drafts.slice(0, Math.max(0, 4 - kotak.length)).map(UI.draftRow).join('')}</div>${drafts.length + kotak.length > 4 ? `<button class="link small" data-act="go" data-to="mutasi">Lihat semua (${drafts.length + kotak.length})</button>` : ''}` : ''}`,
        tujuh: () => `      ${up.length ? `${UI.sec('7 hari ke depan', '<a href="#/kalender" class="link">Kalender</a>')}<div class="card list">${up.slice(0, 5).map(o => `
        <div class="row" data-act="occ-pay" data-occ="${U.esc(o.id)}"><div class="date-chip"><b>${U.parseDate(o.tanggal).getDate()}</b><small>${U.BLN[U.parseDate(o.tanggal).getMonth()]}</small></div>
        <div class="tx-txt"><b>${U.esc(o.nama)}</b><small>${U.relDay(o.tanggal)}${o.kind === 'acara' ? ' · rencana' : ''}</small></div>${UI.amount(o.sisa, o.arah === 'masuk' ? 'masuk' : 'keluar')}</div>`).join('')}</div>` : ''}`,
        periode: () => `      ${UI.sec('Periode ' + U.esc(p.label), '<a href="#/rapor" class="link">Rapor</a>')}
      <div class="stat3">
        <div class="stat in"><small>${I('arrow-down-left')} Masuk</small><b>${UI.ms(tot.masuk)}</b></div>
        <div class="stat out"><small>${I('arrow-up-right')} Keluar</small><b>${UI.ms(tot.keluar)}</b></div>
        <div class="stat sav"><small>${I('piggy-bank')} Ditabung</small><b>${UI.ms(tot.tabung)}</b></div>
      </div>
      ${un.sisa > 0 && un.income > 0 ? `<div class="alert info" data-act="go" data-to="anggaran/bagi">${I('coins')}<div><b>${UI.m(un.sisa)} belum punya tugas</b><small>Bagi ke amplop atau tujuan supaya setiap rupiah punya tugas.</small></div>${I('chevron-right')}</div>` : ''}`,
        amplop: () => `      ${env.length ? `${UI.sec('Amplop perlu perhatian', '<a href="#/anggaran" class="link">Semua</a>')}<div class="card list">${env.map(e => `
        <div class="row env-mini" data-act="go" data-to="anggaran"><span class="cat-ic">${I(e.k.ikon || 'circle-dot')}</span><div class="grow"><div class="row-sp"><b>${U.esc(e.k.nama)}</b><small class="${e.status}">${e.sisa < 0 ? 'Lewat ' + UI.ms(-e.sisa) : 'Sisa ' + UI.ms(e.sisa)}</small></div>${UI.bar(e.pct, e.status)}</div></div>`).join('')}</div>` : ''}`,
        goals: () => `      ${goals.length ? `${UI.sec('Goals keluarga', '<a href="#/tujuan" class="link">Semua</a>')}<div class="goal-row">${goals.map(g => `
        <button class="goal-mini" data-act="go" data-to="tujuan/${g.t.id}">${Charts.jar(g.pct, true)}<div><b>${U.esc(g.t.nama)}</b><small>${U.pct(Math.min(1, g.pct))} · ${UI.ms(g.saldo)}</small></div></button>`).join('')}</div>` : ''}`,
        terbaru: () => `      ${UI.sec('Transaksi terbaru', '<a href="#/mutasi" class="link">Mutasi</a>')}
      <div class="card list">${recent.length ? recent.map(t => UI.txRow(t, { date: true })).join('') : UI.empty('receipt', 'Belum ada transaksi', 'Tekan tombol + untuk mencatat yang pertama.')}</div>`,
      };
      if (UI.atur) return `      <section class="hello"><div><small>${greet()},</small><h2>${U.esc(Store.me.nama)} 👋</h2></div>
        <div class="hello-r">${gaj ? `<span class="pill gold">${I('banknote')} Gajian ${U.diffDays(U.today(), gaj.tanggal)} hari lagi</span>` : ''}</div></section>` + UI.berandaAtur();
      return `      <section class="hello"><div><small>${greet()},</small><h2>${U.esc(Store.me.nama)} 👋</h2></div>
        <div class="hello-r">${gaj ? `<span class="pill gold">${I('banknote')} Gajian ${U.diffDays(U.today(), gaj.tanggal)} hari lagi</span>` : ''}</div></section>` + UI.berandaUrut().filter(k => B[k]).map(k => { const h = B[k]().trim(); return h ? `<div class="bd-blk" data-blk="${k}">${h}</div>` : ''; }).join('')
        + `<button class="link bd-atur" data-act="bd-atur">${I('grip-vertical')} Atur urutan Beranda</button><div class="spacer"></div>`;
    }
  });
})();
