/* Mutasi — daftar transaksi cepat (render bertahap) + filter & cari */
(function () {
  const I = UI.icon;
  const F = { off: 0, all: false, jenis: '', kat: '', wallet: '', who: '', q: '' };
  let n = 0, list = [], key = '', obs = null;
  const STEP = 120;

  function filtered() {
    const k = JSON.stringify(F) + Store.ver;
    if (k === key) return list;
    key = k;
    const p = Calc.periodShift(Calc.period(), F.off);
    const q = F.q.toLowerCase();
    const src = F.all ? Calc.txSorted() : Calc.txSorted().filter(t => t.tanggal >= p.start && t.tanggal <= p.end);
    list = src.filter(t => {
      if (F.jenis && (F.jenis === 'lain' ? (t.jenis === 'keluar' || t.jenis === 'masuk' || t.jenis === 'transfer') : t.jenis !== F.jenis)) return false;
      if (F.kat && t.kategoriId !== F.kat) return false;
      if (F.wallet && t.walletId !== F.wallet && t.walletTujuan !== F.wallet) return false;
      if (F.who && (t.dibayarOleh || t.dicatatOleh) !== F.who) return false;
      if (q) {
        const k = Store.byId.Kategori[t.kategoriId];
        const hay = (UI.note(t) + ' ' + UI.note(t, 'tag')) + ' ' + (k ? k.nama : '') + ' ' + UI.txTitle(t) + ' ' + t.jumlah;
        if (hay.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    return list;
  }
  let dayKey = '', dayTot = {};
  function totals() {
    if (dayKey === key) return dayTot;
    dayKey = key; dayTot = {};
    filtered().forEach(t => { dayTot[t.tanggal] = (dayTot[t.tanggal] || 0) + (t.jenis === 'masuk' ? t.jumlah : -Calc.expAmount(t)); });
    return dayTot;
  }
  /** Kelompokkan potongan [from, to) per tanggal → [{d, rows}] */
  function groups(from, to) {
    const out = [];
    filtered().slice(from, to).forEach(t => {
      let g = out[out.length - 1];
      if (!g || g.d !== t.tanggal) out.push(g = { d: t.tanggal, rows: '' });
      g.rows += UI.txRow(t);
    });
    return out;
  }
  const head = d => { const v = totals()[d] || 0; return `<div class="day-h"><b>${U.relDay(d)}</b><span>${U.tgl(d, 'long')}</span><em class="${v >= 0 ? 'in' : 'out'}">${v >= 0 ? '+' : '−'}${UI.ms(Math.abs(v))}</em></div>`; };
  const tail = all => n < all.length ? '<div class="sentinel" id="mut-more">Memuat…</div>' : '<div class="list-end">— ' + U.fmtNum(all.length) + ' transaksi —</div>';
  function renderList() {
    const box = document.getElementById('mut-list'); if (!box) return;
    const all = filtered();
    n = Math.max(STEP, Math.min(n, all.length));
    const gs = groups(0, n);
    box.innerHTML = all.length ? gs.map(g => head(g.d) + '<div class="card list">' + g.rows + '</div>').join('') + tail(all)
      : UI.empty('search-x', 'Tidak ada transaksi', F.q || F.kat || F.jenis ? 'Coba ubah filter atau kata kunci.' : 'Belum ada catatan di periode ini.');
    box.dataset.last = gs.length ? gs[gs.length - 1].d : '';
    const tot = U.sum(all, t => t.jenis === 'masuk' ? t.jumlah : 0), out = U.sum(all, t => Calc.expAmount(t));
    const sm = document.getElementById('mut-sum'); if (sm) sm.innerHTML = `<span class="in">+${UI.ms(tot)}</span><span class="out">−${UI.ms(out)}</span><span>${U.fmtNum(all.length)} catatan</span>`;
    observe();
  }
  function more() {
    const box = document.getElementById('mut-list'), s = document.getElementById('mut-more'); if (!box || !s) return;
    const all = filtered(), from = n; n = Math.min(all.length, n + STEP);
    const gs = groups(from, n);
    s.remove();
    if (gs.length && gs[0].d === box.dataset.last) {
      const lists = box.querySelectorAll(':scope > .card.list');
      lists[lists.length - 1].insertAdjacentHTML('beforeend', gs.shift().rows);
    }
    box.insertAdjacentHTML('beforeend', gs.map(g => head(g.d) + '<div class="card list">' + g.rows + '</div>').join('') + tail(all));
    if (gs.length) box.dataset.last = gs[gs.length - 1].d;
    observe();
  }
  function observe() {
    if (obs) obs.disconnect();
    const s = document.getElementById('mut-more'); if (!s) return;
    obs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) more(); }, { rootMargin: '600px' });
    obs.observe(s);
  }

  UI.mutasiFilter = (o) => { Object.assign(F, { off: 0, all: false, jenis: '', kat: '', wallet: '', who: '', q: '' }, o); n = 0; UI.go('mutasi'); };
  UI.act('mut-shift', el => { F.off += Number(el.dataset.d); F.all = false; n = 0; UI.render(); });
  UI.act('mut-all', () => { F.all = !F.all; n = 0; UI.render(); });
  UI.act('mut-jenis', el => { F.jenis = F.jenis === el.dataset.v ? '' : el.dataset.v; n = 0; UI.render(); });
  UI.act('mut-filter', () => {
    const s = UI.sheet({ title: 'Filter mutasi', cls: 'small', body: `
      ${UI.field('Kategori', `<select name="kat"><option value="">Semua kategori</option>${Store.kategori('', true).map(k => `<option value="${k.id}" ${k.id === F.kat ? 'selected' : ''}>${U.esc(k.nama)}</option>`).join('')}</select>`)}
      ${UI.field('Dompet', `<select name="wallet"><option value="">Semua dompet</option>${UI.walletOpts(F.wallet, true)}</select>`)}
      ${UI.field('Anggota', `<select name="who"><option value="">Semua anggota</option>${UI.memberOpts(F.who)}</select>`)}`,
      foot: `<button class="btn ghost" data-r>Reset</button><button class="btn" data-ok>Terapkan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => { Object.assign(F, UI.formData(s.el)); n = 0; s.close(); UI.render(); };
    s.el.querySelector('[data-r]').onclick = () => { F.kat = F.wallet = F.who = ''; n = 0; s.close(); UI.render(); };
  });
  UI.act('mut-export', () => {
    const rows = [['Tanggal', 'Jenis', 'Kategori', 'Dompet', 'Ke Dompet', 'Jumlah', 'Biaya', 'Catatan', 'Tag', 'Dibayar oleh']];
    filtered().forEach(t => rows.push([t.tanggal, Calc.JENIS_LABEL[t.jenis], (Store.byId.Kategori[t.kategoriId] || {}).nama || '', (Store.byId.Wallet[t.walletId] || {}).nama || '', (Store.byId.Wallet[t.walletTujuan] || {}).nama || '', t.jumlah, t.biaya || 0, UI.note(t), UI.note(t, 'tag'), Store.memberName(t.dibayarOleh || t.dicatatOleh)]));
    U.download('mutasi-satuatap-' + U.today() + '.csv', '﻿' + U.csv(rows), 'text/csv');
  });
  const onSearch = U.debounce(v => { F.q = v.trim(); n = 0; renderList(); }, 250);
  UI.act('mut-q', el => onSearch(el.value));

  UI.page('mutasi', {
    render() {
      const p = Calc.periodShift(Calc.period(), F.off);
      const drafts = F.off === 0 && !F.all ? UI.drafts() : [];
      const nf = (F.kat ? 1 : 0) + (F.wallet ? 1 : 0) + (F.who ? 1 : 0);
      return `
        <div class="toolbar">
          <div class="period-nav"><button class="icon-btn" data-act="mut-shift" data-d="-1" aria-label="Sebelumnya">${I('chevron-left')}</button>
            <button class="period-lb" data-act="mut-all">${F.all ? 'Semua waktu' : U.esc(p.label)}</button>
            <button class="icon-btn" data-act="mut-shift" data-d="1" aria-label="Berikutnya" ${F.off >= 0 && !F.all ? 'disabled' : ''}>${I('chevron-right')}</button></div>
          <div class="search">${I('search')}<input type="search" placeholder="Cari catatan, kategori, nominal…" value="${U.esc(F.q)}" data-input="mut-q"></div>
          <div class="chips scroll">
            ${[['keluar', 'Keluar'], ['masuk', 'Masuk'], ['transfer', 'Transfer'], ['tujuan', 'Tabungan'], ['lain', 'Lainnya']].map(j => `<button class="chip ${F.jenis === j[0] ? 'on' : ''}" data-act="mut-jenis" data-v="${j[0]}">${j[1]}</button>`).join('')}
            <button class="chip ${nf ? 'on' : ''}" data-act="mut-filter">${I('sliders-horizontal')} Filter${nf ? ' · ' + nf : ''}</button>
            <button class="chip" data-act="go" data-to="impor">${I('file-up')} Impor CSV</button>
            <button class="chip" data-act="mut-export">${I('download')} Ekspor CSV</button>
          </div>
          <div class="sumline" id="mut-sum"></div>
        </div>
        ${drafts.length ? `<div class="day-h"><b>Menunggu konfirmasi</b><span>geser kanan untuk konfirmasi</span></div><div class="card list">${drafts.map(UI.draftRow).join('')}</div>` : ''}
        <div id="mut-list"></div><div class="spacer"></div>`;
    },
    after() { renderList(); }
  });
})();
