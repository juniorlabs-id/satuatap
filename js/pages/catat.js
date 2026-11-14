/* ============================================================
 * Catat Cepat, baris transaksi (geser), detail & riwayat edit, suara
 * ============================================================ */
(function () {
  const I = UI.icon;

  // ---------- Label & privasi transaksi ----------
  UI.isPrivate = t => {
    const k = Store.byId.Kategori[t.kategoriId];
    return !!(k && k.pribadi && Store.me && k.pribadi !== Store.me.email);
  };
  UI.note = (t, f) => UI.isPrivate(t) ? '' : Priv.text(t, f || 'catatan');
  UI.txTitle = t => {
    const k = Store.byId.Kategori[t.kategoriId], W = Store.byId.Wallet;
    if (UI.isPrivate(t)) return k.nama;
    if (t.jenis === 'transfer') return UI.note(t) || ('Transfer ke ' + (W[t.walletTujuan] ? W[t.walletTujuan].nama : '-'));
    if (t.jenis === 'tujuan' || t.jenis === 'tujuan_ambil') { const g = Store.byId.Tujuan[t.refId]; return (t.jenis === 'tujuan' ? 'Setor: ' : 'Ambil: ') + (g ? g.nama : 'Tujuan'); }
    if (t.jenis.indexOf('pinjam') === 0) { const p = Store.byId.Pinjaman[t.refId]; return Calc.JENIS_LABEL[t.jenis] + (p ? ' · ' + p.pihak : ''); }
    if (t.jenis === 'aset_beli' || t.jenis === 'aset_jual') return UI.note(t) || Calc.JENIS_LABEL[t.jenis];
    return UI.note(t) || (k ? k.nama : Calc.JENIS_LABEL[t.jenis] || 'Transaksi');
  };
  UI.txIcon = t => {
    if (t.jenis === 'transfer') return 'arrow-left-right';
    if (t.jenis === 'tujuan' || t.jenis === 'tujuan_ambil') return (Store.byId.Tujuan[t.refId] || {}).ikon || 'target';
    if (t.jenis.indexOf('pinjam') === 0) return 'scale';
    if (t.jenis === 'aset_beli' || t.jenis === 'aset_jual') return Store.byId.Emas[t.refId] ? 'gem' : ((Calc.KELAS[(Store.byId.Investasi[t.refId] || {}).kelas] || {}).ikon || 'briefcase');
    if (t.jenis === 'penyesuaian') return 'sliders-horizontal';
    const k = Store.byId.Kategori[t.kategoriId]; return (k && k.ikon) || 'circle-dot';
  };
  UI.txSub = t => {
    const k = Store.byId.Kategori[t.kategoriId], W = Store.byId.Wallet;
    const parts = [];
    if (t.jenis === 'transfer') parts.push((W[t.walletId] || {}).nama + ' → ' + (W[t.walletTujuan] || {}).nama);
    else { if (k && UI.note(t)) parts.push(k.nama); if (W[t.walletId]) parts.push(W[t.walletId].nama); }
    if (t.refId && Store.byId.Rutin[t.refId]) parts.push('Rutin');
    return parts.join(' · ');
  };
  UI.txRow = (t, opt) => {
    opt = opt || {};
    const who = t.dibayarOleh || t.dicatatOleh;
    return `<div class="swipe" data-id="${t.id}" ${opt.draft ? 'data-draft="1"' : ''}>
      <div class="sw-l">${I('check')} ${opt.draft ? 'Konfirmasi' : ''}</div>
      <div class="sw-r"><button data-act="tx-edit" data-id="${t.id}">${I('pencil')}<span>Ubah</span></button><button class="danger" data-act="tx-del" data-id="${t.id}">${I('trash-2')}<span>Hapus</span></button></div>
      <div class="sw-main tx" data-act="tx-open" data-id="${t.id}">
        <span class="cat-ic ${t.jenis}">${I(UI.txIcon(t))}</span>
        <div class="tx-txt"><b>${U.esc(UI.txTitle(t))}</b><small>${U.esc(UI.txSub(t))}${who && Store.members().length > 1 ? ' · ' + U.esc(Store.memberName(who)) : ''}</small></div>
        <div class="tx-amt">${UI.amount(t.jumlah, t.jenis)}${opt.date ? `<small>${U.tgl(t.tanggal, 'dm')}</small>` : ''}</div>
        <button class="kebab" data-act="tx-menu" data-id="${t.id}" aria-label="Aksi">${I('ellipsis-vertical')}</button>
      </div></div>`;
  };
  /** Baris draf tagihan rutin yang menunggu konfirmasi (geser kanan = konfirmasi). */
  UI.draftRow = o => `<div class="swipe" data-occ="${U.esc(o.id)}" data-draft="1">
      <div class="sw-l">${I('check')} Konfirmasi</div><div class="sw-r"></div>
      <div class="sw-main tx draft" data-act="occ-pay" data-occ="${U.esc(o.id)}">
        <span class="cat-ic">${I(o.kind === 'pinjaman' ? 'landmark' : ((Store.byId.Kategori[o.kategoriId] || {}).ikon || 'repeat'))}</span>
        <div class="tx-txt"><b>${U.esc(o.nama)}</b><small>${o.tanggal < U.today() ? 'Lewat ' + U.diffDays(o.tanggal, U.today()) + ' hari' : U.relDay(o.tanggal)} · geser kanan untuk konfirmasi</small></div>
        <div class="tx-amt">${UI.amount(o.sisa, o.arah === 'masuk' ? 'masuk' : 'keluar')}<small>${o.dibayar ? 'sebagian' : 'draf'}</small></div>
        <button class="kebab" data-act="occ-pay" data-occ="${U.esc(o.id)}" aria-label="Bayar">${I('ellipsis-vertical')}</button>
      </div></div>`;

  // ---------- Geser baris (delegasi global) ----------
  (function swipe() {
    let el = null, main = null, x0 = 0, y0 = 0, dx = 0, mode = '', open = null;
    const closeOpen = () => { if (open) { open.querySelector('.sw-main').style.transform = ''; open.classList.remove('open-r'); open = null; } };
    document.addEventListener('pointerdown', e => {
      const s = e.target.closest('.swipe'); if (!s || e.target.closest('.sw-r button') || e.button > 0) return;
      if (open && open !== s) closeOpen();
      el = s; main = s.querySelector('.sw-main'); x0 = e.clientX; y0 = e.clientY; dx = 0; mode = '';
    }, { passive: true });
    document.addEventListener('pointermove', e => {
      if (!el) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!mode) { if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) mode = 'x'; else if (Math.abs(my) > 10) { el = null; return; } else return; }
      dx = mx;
      if (dx > 0 && !el.dataset.draft) dx = Math.min(dx, 20);
      if (dx < 0 && !el.querySelector('.sw-r button')) dx = Math.max(dx, -20);
      main.style.transition = 'none';
      main.style.transform = `translateX(${(el.classList.contains('open-r') ? -150 : 0) + dx}px)`;
      el.classList.toggle('arm-l', dx > 90);
    }, { passive: true });
    const end = () => {
      if (!el) return;
      const s = el; el = null; main.style.transition = '';
      if (mode !== 'x') return;
      UI._swiped = Date.now();
      s.classList.remove('arm-l');
      if (dx > 90 && s.dataset.draft) { main.style.transform = ''; if (s.dataset.occ) UI.payOcc(s.dataset.occ, { quick: true }); return; }
      if (dx < -60 || (s.classList.contains('open-r') && dx < 30)) { main.style.transform = 'translateX(-150px)'; s.classList.add('open-r'); open = s; }
      else { main.style.transform = ''; s.classList.remove('open-r'); if (open === s) open = null; }
    };
    document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
    document.addEventListener('click', e => { if (UI._swiped && Date.now() - UI._swiped < 350 && e.target.closest('.sw-main')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    window.addEventListener('hashchange', () => { open = null; });
  })();

  UI.act('tx-open', el => UI.txDetail(el.dataset.id));
  UI.act('tx-edit', el => { const t = Store.byId.Transaksi[el.dataset.id]; if (t) UI.catat({ edit: t }); });
  UI.act('tx-del', el => UI.txDelete(el.dataset.id));
  UI.act('tx-menu', el => {
    const t = Store.byId.Transaksi[el.dataset.id]; if (!t) return;
    const s = UI.sheet({ title: UI.txTitle(t), cls: 'small', body: `<div class="menu-list">
      <button data-a="open">${I('info')} Lihat detail</button>${canEdit(t) ? `<button data-a="edit">${I('pencil')} Ubah</button><button data-a="dup">${I('copy')} Duplikat ke hari ini</button><button data-a="del" class="danger">${I('trash-2')} Hapus</button>` : ''}</div>` });
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      s.close(); const a = b.dataset.a;
      if (a === 'open') UI.txDetail(t.id); else if (a === 'edit') UI.catat({ edit: t }); else if (a === 'del') UI.txDelete(t.id);
      else if (a === 'dup') UI.catat({ preset: { jenis: t.jenis, jumlah: t.jumlah, kategoriId: t.kategoriId, walletId: t.walletId, walletTujuan: t.walletTujuan, catatan: UI.note(t), biaya: t.biaya } });
    });
  });
  const canEdit = t => Store.can('mutasi', 'ubah') || (Store.me && t.dicatatOleh === Store.me.email);

  UI.txDelete = async (id) => {
    const t = Store.byId.Transaksi[id]; if (!t) return;
    if (!canEdit(t)) return UI.toast('Anda tidak punya izin mengubah transaksi ini.', 'warn');
    if (!(await UI.confirm('Hapus transaksi?', UI.txTitle(t) + ' · ' + U.rp(t.jumlah) + ' akan dihapus untuk semua anggota.', 'Hapus', true))) return;
    const copy = Object.assign({}, t);
    Store.remove('Transaksi', id);
    UI.toast('Transaksi dihapus.', 'ok', { undo: () => Store.upsert('Transaksi', copy), ms: 5000 });
  };

  UI.txDetail = (id) => {
    const t = Store.byId.Transaksi[id]; if (!t) return;
    const k = Store.byId.Kategori[t.kategoriId], W = Store.byId.Wallet, priv = UI.isPrivate(t);
    const row = (a, b) => b ? `<div class="kv"><span>${a}</span><b>${b}</b></div>` : '';
    const riw = Array.isArray(t.riwayat) ? t.riwayat : [];
    const s = UI.sheet({
      title: 'Detail transaksi',
      body: `<div class="detail-head"><span class="cat-ic lg ${t.jenis}">${I(UI.txIcon(t))}</span><div><h3>${U.esc(UI.txTitle(t))}</h3><div class="big-amt">${UI.amount(t.jumlah, t.jenis)}</div></div></div>
        <div class="kv-list">${row('Jenis', Calc.JENIS_LABEL[t.jenis])}${row('Tanggal', U.tgl(t.tanggal, 'long'))}${row('Kategori', k ? U.esc(k.nama) : '')}
        ${row('Dompet', W[t.walletId] ? U.esc(W[t.walletId].nama) : '')}${row('Ke dompet', W[t.walletTujuan] ? U.esc(W[t.walletTujuan].nama) : '')}
        ${t.biaya ? row('Biaya admin / lain', U.rp(t.biaya)) : ''}${priv ? row('Catatan', '<i class="muted">Detail uang pribadi disembunyikan</i>') : row('Catatan', U.esc(UI.note(t)))}
        ${priv ? '' : row('Tag', U.esc(UI.note(t, 'tag')))}${row('Dibayar oleh', U.esc(Store.memberName(t.dibayarOleh || t.dicatatOleh)))}
        ${row('Dicatat', U.esc(Store.memberName(t.dicatatOleh)) + (t.dibuat ? ' · ' + U.timeAgo(t.dibuat) : '') + (t.sumber && t.sumber !== 'app' ? ' · via ' + U.esc(t.sumber) : ''))}</div>
        ${riw.length ? `<h4 class="mini-h">${I('history')} Riwayat perubahan</h4><ul class="hist">${riw.slice().reverse().map(r => `<li><b>${U.esc(Store.memberName(r.oleh))}</b> · ${U.timeAgo(r.at)}<br><small>${Object.keys(r.ubah || {}).map(f => U.esc(f) + ': ' + U.esc(fmtVal(f, r.ubah[f]))).join(', ')}</small></li>`).join('')}</ul>` : ''}`,
      foot: canEdit(t) ? `<button class="btn ghost danger" data-a="del">${I('trash-2')} Hapus</button><button class="btn" data-a="edit">${I('pencil')} Ubah</button>` : ''
    });
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { s.close(); if (b.dataset.a === 'edit') UI.catat({ edit: t }); else UI.txDelete(t.id); });
  };
  function fmtVal(f, v) {
    if (f === 'jumlah' || f === 'biaya') return U.rp(v);
    if (Priv.isEnc(v)) return '(terenkripsi)';
    if (f === 'kategoriId') return (Store.byId.Kategori[v] || {}).nama || v;
    if (f === 'walletId' || f === 'walletTujuan') return (Store.byId.Wallet[v] || {}).nama || v;
    return v === '' ? '(kosong)' : v;
  }

  // ---------- Kalkulator ----------
  function evalExpr(s) {
    s = String(s || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/[^\d+\-*/.]/g, '');
    const tok = s.match(/\d+\.?\d*|[+\-*/]/g) || [];
    const nums = [], ops = [];
    const prec = o => (o === '+' || o === '-') ? 1 : 2;
    const apply = () => { const b = nums.pop(), a = nums.pop() || 0, o = ops.pop(); nums.push(o === '+' ? a + b : o === '-' ? a - b : o === '*' ? a * b : b ? a / b : 0); };
    let expectNum = true;
    tok.forEach(t => {
      if (/\d/.test(t)) { nums.push(parseFloat(t)); expectNum = false; }
      else { if (expectNum) return; while (ops.length && prec(ops[ops.length - 1]) >= prec(t)) apply(); ops.push(t); expectNum = true; }
    });
    if (expectNum && ops.length) ops.pop();
    while (ops.length && nums.length > 1) apply();
    return Math.max(0, Math.round(nums[0] || 0));
  }
  UI.evalExpr = evalExpr;

  // ---------- Catat Cepat ----------
  UI.act('catat', () => UI.catat());
  UI.catat = (opt) => {
    opt = opt || {};
    const me = Store.me ? Store.me.email : '';
    const edit = opt.edit, pre = Object.assign({}, opt.preset || {});
    if (!edit && !Store.can('mutasi', 'ubah') && !(Store.me && Store.me.peran === 'anggota')) return UI.toast('Anda tidak punya izin mencatat.', 'warn');
    const lastW = localStorage.getItem('sa:lastWallet');
    const wl = Store.wallets();
    if (!wl.length) { UI.toast('Tambahkan dompet/rekening dulu di Aset › Kas & Bank.', 'warn'); UI.go('aset/kas'); return; }
    const src = edit || pre;
    const st = {
      jenis: src.jenis || 'keluar',
      expr: src.jumlah ? String(Math.round(src.jumlah)) : '',
      kategoriId: src.kategoriId || '', walletId: src.walletId || (Store.byId.Wallet[lastW] ? lastW : wl[0].id),
      walletTujuan: src.walletTujuan || '', biaya: src.biaya || 0,
      tanggal: src.tanggal || U.today(), catatan: (edit ? UI.note(edit) : src.catatan) || '', tag: (edit ? UI.note(edit, 'tag') : src.tag) || '',
      dibayarOleh: src.dibayarOleh || me, split: null, patungan: null, more: false
    };
    const special = edit && ['keluar', 'masuk', 'transfer'].indexOf(edit.jenis) < 0;
    const s = UI.sheet({ title: edit ? 'Ubah transaksi' : 'Catat Cepat', cls: 'catat', body: '<div class="catat-body"></div>',
      foot: `${edit ? '' : `<button class="btn ghost" data-save="again">Simpan & lagi</button>`}<button class="btn" data-save="1">${I('check')} Simpan</button>` });
    const body = s.el.querySelector('.catat-body');
    const amount = () => evalExpr(st.expr);

    function render() {
      const isT = st.jenis === 'transfer';
      const cats = isT ? [] : Calc.smartCategories(st.jenis).filter(k => !k.pribadi || k.pribadi === me);
      if (!isT && !special && !st.kategoriId && cats[0] && !edit) st.kategoriId = '';
      const top = cats.slice(0, st.more ? 99 : 7);
      if (st.kategoriId && !top.find(k => k.id === st.kategoriId)) { const k = Store.byId.Kategori[st.kategoriId]; if (k) top.push(k); }
      const tpl = Store.t.Template.filter(x => x.jenis === st.jenis).sort((a, b) => a.urutan - b.urutan);
      body.innerHTML = `
        ${special ? `<div class="note">${I('info')} ${U.esc(Calc.JENIS_LABEL[edit.jenis])} — hanya jumlah, tanggal, dompet & catatan yang bisa diubah.</div>` :
          UI.seg('jenis', [['keluar', 'Pengeluaran'], ['masuk', 'Pemasukan'], ['transfer', 'Transfer']], st.jenis)}
        <div class="amt-box ${st.jenis}"><small class="expr">${/[+\-×÷]/.test(st.expr) ? U.esc(st.expr) + ' =' : (st.jenis === 'keluar' ? 'Jumlah keluar' : st.jenis === 'masuk' ? 'Jumlah masuk' : 'Jumlah dipindah')}</small>
          <div class="amt-val"><span>Rp</span><b>${U.fmtNum(amount()) || '0'}</b></div>
          <input class="amt-kbd" inputmode="none" aria-label="Jumlah (bisa ketik angka & + − × ÷)" value="${U.esc(st.expr)}" autocomplete="off"></div>
        <div class="keypad">${['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '000', '0', '⌫', '+'].map(k => `<button data-k="${k}" class="${/[÷×−+]/.test(k) ? 'op' : k === '⌫' ? 'del' : ''}">${k}</button>`).join('')}</div>
        ${tpl.length && !edit ? `<div class="chips scroll">${tpl.map(x => `<button class="chip" data-tpl="${x.id}">${I('zap')} ${U.esc(x.nama)}${x.jumlah ? ' · ' + U.rpShort(x.jumlah) : ''}</button>`).join('')}</div>` : ''}
        ${!isT && !special ? `<div class="cat-grid">${top.map(k => `<button class="cat-pick ${k.id === st.kategoriId ? 'on' : ''}" data-kat="${k.id}"><span class="cat-ic">${I(k.ikon || 'circle-dot')}</span><span>${U.esc(k.nama)}</span></button>`).join('')}
          ${cats.length > 7 ? `<button class="cat-pick more" data-more>${I(st.more ? 'chevron-up' : 'layout-grid')}<span>${st.more ? 'Ringkas' : 'Semua'}</span></button>` : ''}</div>` : ''}
        <div class="grid2">
          ${UI.field(isT ? 'Dari' : (st.jenis === 'masuk' ? 'Masuk ke' : 'Bayar pakai'), `<select name="walletId">${UI.walletOpts(st.walletId)}</select>`)}
          ${isT ? UI.field('Ke', `<select name="walletTujuan"><option value="">— pilih —</option>${Store.wallets().filter(w => w.id !== st.walletId).map(w => `<option value="${w.id}" ${w.id === st.walletTujuan ? 'selected' : ''}>${U.esc(w.nama)}</option>`).join('')}</select>`)
                : UI.field('Tanggal', `<input type="date" name="tanggal" value="${st.tanggal}" max="${U.addDays(U.today(), 366)}">`)}
        </div>
        ${isT ? `<div class="grid2">${UI.field('Biaya admin / lain', UI.rpInput('biaya', st.biaya, '0'), 'Dihitung sebagai pengeluaran')}${UI.field('Tanggal', `<input type="date" name="tanggal" value="${st.tanggal}">`)}</div>`
          : !special || edit ? (st.biayaOn || st.biaya ? UI.field('Biaya admin / lain', UI.rpInput('biaya', st.biaya, '0'), st.jenis === 'masuk' ? 'Potongan saat uang masuk (mis. biaya transfer) — dicatat sebagai pengeluaran Biaya Admin.' : 'Mis. ongkir, biaya layanan, admin bank — dicatat ke kategori Biaya Admin.') : `<button type="button" class="link small" data-biaya>${I('plus')} Biaya admin / lain</button>`) : ''}
        <div class="chips">${[['Hari ini', U.today()], ['Kemarin', U.addDays(U.today(), -1)]].map(d => `<button class="chip ${st.tanggal === d[1] ? 'on' : ''}" data-date="${d[1]}">${d[0]}</button>`).join('')}</div>
        ${UI.field('Catatan', `<input name="catatan" maxlength="140" placeholder="mis. Makan siang soto" value="${U.esc(st.catatan)}">`)}
        ${(edit && edit.lampiran) || pre.lampiran ? `<a class="link" href="https://drive.google.com/file/d/${encodeURIComponent((edit && edit.lampiran) || pre.lampiran)}/view" target="_blank" rel="noopener">${I('paperclip')} Lihat foto struk</a>` : ''}
        <div class="grid2">${Store.members().length > 1 ? UI.field('Dibayar oleh', `<select name="dibayarOleh">${UI.memberOpts(st.dibayarOleh)}</select>`) : ''}${UI.field('Tag', `<input name="tag" maxlength="40" placeholder="mis. liburan-bali" value="${U.esc(st.tag)}">`)}</div>
        ${st.jenis === 'keluar' && !edit ? `<div class="chips">
            <button class="chip ${st.split ? 'on' : ''}" data-x="split">${I('receipt')} Pecah struk</button>
            <button class="chip ${st.patungan ? 'on' : ''}" data-x="patungan">${I('users')} Patungan</button>
            ${Voice.supported() ? `<button class="chip" data-x="voice">${I('mic')} Suara</button>` : ''}${window.AI && AI.siap() ? `<button class="chip" data-x="struk">${I('camera')} Foto struk</button>` : ''}</div>
            ${st.split ? splitHtml() : ''}${st.patungan ? patunganHtml() : ''}` : ''}`;
      UI.bindRp(body);
    }
    function splitHtml() {
      const rest = amount() - U.sum(st.split, x => x.jumlah);
      return `<div class="subbox"><div class="subbox-h">${I('receipt')} Pecah ke beberapa kategori <small>Sisa ${U.rp(rest)} masuk ke kategori terpilih</small></div>
        ${st.split.map((x, i) => `<div class="split-row"><select data-si="${i}" data-f="kategoriId">${UI.katOpts('keluar', x.kategoriId)}</select><div class="rp-input"><b>Rp</b><input data-si="${i}" data-f="jumlah" data-rp inputmode="numeric" value="${x.jumlah ? U.fmtNum(x.jumlah) : ''}"></div><button class="icon-btn" data-sdel="${i}">${I('x')}</button></div>`).join('')}
        <button class="link" data-sadd>${I('plus')} Tambah baris</button></div>`;
    }
    function patunganHtml() {
      const others = U.sum(st.patungan, x => x.jumlah), mine = amount() - others;
      return `<div class="subbox"><div class="subbox-h">${I('users')} Patungan — Anda menalangi total <small>Bagian Anda ${U.rp(mine)} · sisanya jadi piutang</small></div>
        ${st.patungan.map((x, i) => `<div class="split-row"><input data-pi="${i}" data-f="nama" placeholder="Nama teman" value="${U.esc(x.nama)}"><div class="rp-input"><b>Rp</b><input data-pi="${i}" data-f="jumlah" data-rp inputmode="numeric" value="${x.jumlah ? U.fmtNum(x.jumlah) : ''}"></div><button class="icon-btn" data-pdel="${i}">${I('x')}</button></div>`).join('')}
        <div class="chips"><button class="link" data-padd>${I('plus')} Tambah orang</button>${st.patungan.length ? `<button class="link" data-prata>${I('divide')} Bagi rata</button>` : ''}</div></div>`;
    }
    function readForm() {
      body.querySelectorAll('[name]').forEach(f => {
        if (f.name === 'jenis') { if (f.checked) st.jenis = f.value; return; }
        st[f.name] = f.dataset.rp !== undefined ? U.parseRp(f.value) : f.value;
      });
    }
    const refreshAmt = () => {
      const v = amount();
      body.querySelector('.amt-val b').textContent = U.fmtNum(v) || '0';
      body.querySelector('.expr').textContent = /[+\-×÷]/.test(st.expr) ? st.expr + ' =' : (st.jenis === 'keluar' ? 'Jumlah keluar' : st.jenis === 'masuk' ? 'Jumlah masuk' : 'Jumlah dipindah');
      const kb = body.querySelector('.amt-kbd'); if (kb && document.activeElement !== kb) kb.value = st.expr;
      const sub = body.querySelectorAll('.subbox-h small');
      if (st.split && sub[0]) sub[0].textContent = 'Sisa ' + U.rp(v - U.sum(st.split, x => x.jumlah)) + ' masuk ke kategori terpilih';
      if (st.patungan && sub[sub.length - 1]) sub[sub.length - 1].textContent = 'Bagian Anda ' + U.rp(v - U.sum(st.patungan, x => x.jumlah)) + ' · sisanya jadi piutang';
    };
    const key = k => {
      if (k === '⌫') st.expr = st.expr.slice(0, -1);
      else if (/[÷×−+]/.test(k)) { const op = k === '−' ? '-' : k; if (!st.expr || /[+\-×÷]$/.test(st.expr)) { if (st.expr) st.expr = st.expr.slice(0, -1) + op; } else st.expr += op; }
      else { if (st.expr.length > 30) return; st.expr += k; st.expr = st.expr.replace(/^0+(?=\d)/, ''); }
      st.expr = st.expr.replace(/-/g, '−').replace(/−/g, '-').replace(/\*/g, '×');
      refreshAmt();
    };

    body.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.k) { key(b.dataset.k); return; }
      readForm();
      if (b.dataset.kat) { st.kategoriId = st.kategoriId === b.dataset.kat ? '' : b.dataset.kat; }
      else if (b.dataset.more !== undefined) st.more = !st.more;
      else if (b.dataset.biaya !== undefined) st.biayaOn = true;
      else if (b.dataset.date) st.tanggal = b.dataset.date;
      else if (b.dataset.tpl) { const x = Store.byId.Template[b.dataset.tpl]; if (x) { st.jenis = x.jenis; if (x.jumlah) st.expr = String(x.jumlah); if (x.kategoriId) st.kategoriId = x.kategoriId; if (x.walletId) st.walletId = x.walletId; st.catatan = x.catatan || x.nama; } }
      else if (b.dataset.x === 'split') st.split = st.split ? null : [{ kategoriId: Store.kategori('keluar')[0].id, jumlah: 0 }];
      else if (b.dataset.x === 'patungan') st.patungan = st.patungan ? null : [{ nama: '', jumlah: 0 }];
      else if (b.dataset.x === 'voice') { s.close(); UI.voiceCatat(); return; }
      else if (b.dataset.x === 'struk') { s.close(); UI.fotoStruk(); return; }
      else if (b.dataset.sadd !== undefined) st.split.push({ kategoriId: Store.kategori('keluar')[0].id, jumlah: 0 });
      else if (b.dataset.sdel) st.split.splice(+b.dataset.sdel, 1);
      else if (b.dataset.padd !== undefined) st.patungan.push({ nama: '', jumlah: 0 });
      else if (b.dataset.pdel) st.patungan.splice(+b.dataset.pdel, 1);
      else if (b.dataset.prata !== undefined) { const n = st.patungan.length + 1, each = Math.round(amount() / n); st.patungan.forEach(x => x.jumlah = each); }
      else return;
      render();
    });
    body.addEventListener('change', e => {
      if (e.target.name === 'jenis') { readForm(); st.kategoriId = ''; st.split = null; st.patungan = null; render(); }
      else if (e.target.name === 'walletId' && st.jenis === 'transfer') { readForm(); render(); }
      else if (e.target.name === 'tanggal') { readForm(); body.querySelectorAll('[data-date]').forEach(c => c.classList.toggle('on', c.dataset.date === st.tanggal)); }
    });
    body.addEventListener('input', e => {
      const f = e.target;
      if (f.classList.contains('amt-kbd')) { st.expr = f.value.replace(/[^\d+\-*/×÷.]/g, '').replace(/\*/g, '×').replace(/\//g, '÷'); refreshAmt(); return; }
      if (f.dataset.si) { st.split[+f.dataset.si][f.dataset.f] = f.dataset.rp !== undefined ? U.parseRp(f.value) : f.value; refreshAmt(); }
      if (f.dataset.pi) { st.patungan[+f.dataset.pi][f.dataset.f] = f.dataset.rp !== undefined ? U.parseRp(f.value) : f.value; refreshAmt(); }
    });
    body.addEventListener('change', e => { const f = e.target; if (f.dataset.si && f.dataset.f === 'kategoriId') st.split[+f.dataset.si].kategoriId = f.value; });
    // Keyboard fisik (laptop): angka langsung ke kalkulator bila fokus bukan di input teks
    const onKey = e => {
      if (!document.body.contains(body)) { document.removeEventListener('keydown', onKey); return; }
      const tag = (e.target.tagName || '').toLowerCase();
      if ((tag === 'input' && !e.target.classList.contains('amt-kbd')) || tag === 'textarea' || tag === 'select') { if (e.key === 'Enter' && tag === 'input') { e.preventDefault(); save(false); } return; }
      if (e.target.classList && e.target.classList.contains('amt-kbd')) { if (e.key === 'Enter') { e.preventDefault(); save(false); } return; }
      const map = { '*': '×', '/': '÷', '-': '−', 'Backspace': '⌫' };
      if (/^[0-9]$/.test(e.key) || map[e.key] || e.key === '+') { e.preventDefault(); key(map[e.key] || e.key); }
      else if (e.key === 'Enter') { e.preventDefault(); save(false); }
    };
    document.addEventListener('keydown', onKey);

    async function save(again) {
      readForm();
      const j = amount();
      if (!j) return UI.toast('Isi jumlahnya dulu.', 'warn');
      if (!special && st.jenis !== 'transfer' && !st.kategoriId) return UI.toast('Pilih kategorinya.', 'warn');
      if (st.jenis === 'transfer' && (!st.walletTujuan || st.walletTujuan === st.walletId)) return UI.toast('Pilih dompet tujuan yang berbeda.', 'warn');
      localStorage.setItem('sa:lastWallet', st.walletId);
      const now = new Date().toISOString();
      const base = { tanggal: st.tanggal || U.today(), jenis: special ? edit.jenis : st.jenis, walletId: st.walletId, catatan: st.catatan, tag: st.tag, dibayarOleh: st.dibayarOleh || me };
      const ops = [];
      if (edit) {
        const row = Object.assign({ id: edit.id, jumlah: j }, base);
        if (!special) Object.assign(row, { kategoriId: st.jenis === 'transfer' ? '' : st.kategoriId, walletTujuan: st.jenis === 'transfer' ? st.walletTujuan : '' });
        row.biaya = st.biaya || 0;
        const ubah = {};
        Object.keys(row).forEach(f => { const o = f === 'catatan' || f === 'tag' ? UI.note(edit, f) : edit[f]; if (f !== 'id' && String(o == null ? '' : o) !== String(row[f] == null ? '' : row[f])) ubah[f] = edit[f]; });
        if (!Object.keys(ubah).length) { s.close(); return; }
        row.riwayat = (Array.isArray(edit.riwayat) ? edit.riwayat : []).concat([{ at: now, oleh: me, ubah }]).slice(-20);
        if (!row.kategoriId) row.kategoriId = edit.kategoriId;
        ops.push({ op: 'upsert', t: 'Transaksi', row });
        if (!(await UI.commitPriv(ops))) return;
        s.close(); UI.toast('Perubahan disimpan.'); return;
      }
      const mk = (o) => Object.assign({ id: U.uid('t'), kategoriId: '', walletTujuan: '', biaya: 0, sumber: pre.sumber || 'app', lampiran: pre.lampiran || '', refId: pre.refId || '', periodeRef: pre.periodeRef || '', dicatatOleh: me, dibuat: now, riwayat: [] }, base, o);
      if (st.jenis === 'transfer') ops.push({ op: 'upsert', t: 'Transaksi', row: mk({ jumlah: j, walletTujuan: st.walletTujuan, biaya: st.biaya || 0, kategoriId: '' }) });
      else {
        let mine = j;
        if (st.patungan) {
          const others = st.patungan.filter(x => x.jumlah > 0);
          if (U.sum(others, x => x.jumlah) >= j) return UI.toast('Bagian teman melebihi total.', 'warn');
          others.forEach(x => {
            const pid = U.uid('p');
            ops.push({ op: 'upsert', t: 'Pinjaman', row: { id: pid, arah: 'piutang', jenis: 'patungan', pihak: x.nama || 'Teman', pokok: x.jumlah, bunga: 0, metode: 'tanpa', tenor: 1, mulai: base.tanggal, tanggalBayar: 0, cicilan: x.jumlah, walletId: st.walletId, lunas: false, catatan: 'Patungan: ' + (st.catatan || ''), dibuat: now } });
            ops.push({ op: 'upsert', t: 'Transaksi', row: mk({ jenis: 'pinjam_beri', jumlah: x.jumlah, refId: pid, catatan: 'Talangan patungan · ' + (x.nama || 'Teman'), sumber: 'patungan' }) });
            mine -= x.jumlah;
          });
        }
        if (st.split) {
          const parts = st.split.filter(x => x.jumlah > 0 && x.kategoriId);
          if (U.sum(parts, x => x.jumlah) > mine) return UI.toast('Total pecahan melebihi jumlah.', 'warn');
          parts.forEach(x => { ops.push({ op: 'upsert', t: 'Transaksi', row: mk({ jumlah: x.jumlah, kategoriId: x.kategoriId, sumber: 'struk' }) }); mine -= x.jumlah; });
        }
        if (mine > 0) ops.push({ op: 'upsert', t: 'Transaksi', row: mk({ jumlah: mine, kategoriId: st.kategoriId, biaya: st.biaya || 0 }) });
        else if (st.biaya) ops.push({ op: 'upsert', t: 'Transaksi', row: mk({ jenis: 'keluar', jumlah: st.biaya, kategoriId: Calc.adminKatId(), catatan: 'Biaya · ' + (st.catatan || '') }) });
      }
      if (!(await UI.commitPriv(ops))) return;
      const ids = ops.map(o => [o.t, o.row.id]);
      UI.toast(ops.length > 1 ? ops.length + ' catatan tersimpan.' : 'Tersimpan · ' + U.rp(j), 'ok', { undo: () => Store.commit(ids.map(([t, id]) => ({ op: 'delete', t, id }))), ms: 4500 });
      if (opt.onSaved) opt.onSaved(ops);
      const k = Store.byId.Kategori[st.kategoriId];
      if (st.jenis === 'masuk' && k && /gaji/i.test(k.nama) && !again) { s.close(); setTimeout(() => UI.offerBagiGaji(j), 300); return; }
      if (again) { st.expr = ''; st.catatan = ''; st.split = null; st.patungan = null; render(); }
      else s.close();
    }
    s.el.querySelectorAll('[data-save]').forEach(b => b.onclick = () => save(b.dataset.save === 'again'));
    render();
  };

  // ---------- Uang pribadi: enkripsi catatan sebelum disimpan ----------
  /** Commit dengan enkripsi catatan/tag uang pribadi milik saya. false = dibatalkan. */
  UI.commitPriv = async (ops) => {
    const me = Store.me.email;
    const need = ops.filter(o => o.t === 'Transaksi' && o.op === 'upsert' && (o.row.catatan || o.row.tag) && (Store.byId.Kategori[o.row.kategoriId] || {}).pribadi === me);
    if (need.length && Priv.supported()) {
      const g = await UI.privGuard();
      if (g === 'cancel') return false;
      if (g === 'enc') for (const o of need) { if (o.row.catatan && !Priv.isEnc(o.row.catatan)) o.row.catatan = await Priv.enc(o.row.catatan); if (o.row.tag && !Priv.isEnc(o.row.tag)) o.row.tag = await Priv.enc(o.row.tag); }
    }
    Store.commit(ops); Priv.decryptAll();
    return true;
  };
  /** Pastikan kunci PIN siap: 'enc' | 'plain' | 'cancel' */
  UI.privGuard = () => new Promise(res => {
    if (Priv.unlocked()) return res('enc');
    const has = Priv.has();
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const s = UI.sheet({ title: has ? 'Buka kunci uang pribadi' : 'Atur PIN uang pribadi', cls: 'small', onClose: () => fin('cancel'), body: `
      <p class="muted small">${has ? 'Masukkan PIN uang pribadi Anda agar catatan bisa dienkripsi & dibaca di perangkat ini.' : 'Catatan uang pribadi dienkripsi di HP ini sehingga hanya Anda yang bisa membacanya — termasuk di spreadsheet. Nominal tetap masuk total keluarga. <b>PIN tidak bisa dipulihkan</b>; jika lupa, catatan lama tidak bisa dibaca lagi.'}</p>
      ${UI.field('PIN (min. 6 angka)', `<input type="password" inputmode="numeric" autocomplete="off" name="pin" minlength="6" maxlength="12">`)}
      ${has ? '' : UI.field('Ulangi PIN', `<input type="password" inputmode="numeric" autocomplete="off" name="pin2" maxlength="12">`)}<div class="pin-err bad small"></div>`,
      foot: `${has ? '' : `<button class="btn ghost" data-plain>Tanpa enkripsi</button>`}<button class="btn" data-ok>${UI.icon('lock')} ${has ? 'Buka' : 'Atur PIN'}</button>` });
    const err = s.el.querySelector('.pin-err');
    const pl = s.el.querySelector('[data-plain]'); if (pl) pl.onclick = () => { fin('plain'); s.close(); };
    s.el.querySelector('[data-ok]').onclick = async () => {
      const f = UI.formData(s.el);
      if (!/^\d{6,12}$/.test(f.pin)) { err.textContent = 'PIN 6–12 angka.'; return; }
      if (!has && f.pin !== f.pin2) { err.textContent = 'PIN tidak sama.'; return; }
      err.textContent = 'Memproses…';
      if (has) { if (!(await Priv.unlock(f.pin))) { err.textContent = 'PIN salah.'; return; } }
      else await Priv.setup(f.pin);
      fin('enc'); s.close();
    };
  });

  UI.offerBagiGaji = (j) => {
    const s = UI.sheet({ title: 'Gaji masuk 🎉', cls: 'small', body: `<p>Gaji ${UI.m(j)} sudah tercatat. Mau langsung dibagi ke amplop & tujuan supaya setiap rupiah punya tugas?</p>`,
      foot: `<button class="btn ghost" data-n>Nanti saja</button><button class="btn" data-y>${I('split')} Bagi gaji</button>` });
    s.el.querySelector('[data-n]').onclick = s.close;
    s.el.querySelector('[data-y]').onclick = () => { s.close(); UI.bagiJumlah = j; UI.go('anggaran/bagi'); };
  };

  // ---------- Catat cepat pakai suara ----------
  // Ketuk mikrofon (tombol 🎤 di atas tombol +, atau tahan tombol +) → bicara → periksa → Simpan.
  // Satu kalimat bisa berisi beberapa catatan: "gudeg 45 ribu tunai dan bensin 50 ribu gopay".
  UI.act('voice-catat', () => UI.voiceCatat());
  UI.voiceCatat = () => {
    if (!Voice.supported()) return UI.toast('Browser ini belum mendukung input suara. Coba Chrome di Android.', 'warn');
    if (navigator.vibrate) navigator.vibrate(30);
    let items = [], dengar = false, teks = '';
    const s = UI.sheet({ title: 'Catat cepat pakai suara', cls: 'small', body: `<div class="voice"><button type="button" class="mic-pulse" data-mic aria-label="Mulai / berhenti bicara">${I('mic', 'big')}</button>
        <div class="voice-txt">Menyiapkan mikrofon…</div><p class="muted small vq-hint">Contoh: <i>"gudeg empat puluh lima ribu tunai"</i> · <i>"gaji masuk 7,5 juta bca"</i> · bisa beberapa sekaligus dengan kata <i>"dan"</i></p></div>
      <div class="vq-list"></div>`,
      foot: `<button class="btn ghost" data-ulang>${I('mic')} Ulangi</button><button class="btn" data-ok disabled>${I('check')} Simpan</button>`, onClose: () => Voice.stop() });
    const mic = s.el.querySelector('[data-mic]'), txt = s.el.querySelector('.voice-txt'), list = s.el.querySelector('.vq-list'), ok = s.el.querySelector('[data-ok]');
    const lengkap = r => r.jumlah > 0 && r.kategoriId && r.walletId;
    const gambar = () => {
      list.innerHTML = items.map((r, i) => `<div class="vq-row ${lengkap(r) ? '' : 'kurang'}" data-i="${i}">
        <div class="vq-top"><button type="button" class="chip ${r.jenis === 'masuk' ? 'on' : ''}" data-jenis>${r.jenis === 'masuk' ? I('arrow-down-left') + ' Masuk' : I('arrow-up-right') + ' Keluar'}</button>
          ${UI.rpInput('j' + i, r.jumlah)}<button type="button" class="icon-btn" data-hapus aria-label="Hapus">${I('x')}</button></div>
        <input class="vq-cat" data-f="catatan" value="${U.esc(r.catatan)}" placeholder="Catatan" maxlength="140">
        <div class="grid2"><select data-f="kategoriId"><option value="">— kategori —</option>${UI.katOpts(r.jenis, r.kategoriId)}</select>
          <select data-f="walletId"><option value="">— dompet —</option>${UI.walletOpts(r.walletId)}</select></div></div>`).join('');
      UI.bindRp(list);
      const n = items.filter(lengkap).length;
      ok.disabled = !items.length || n < items.length;
      ok.innerHTML = I('check') + (items.length > 1 ? ' Simpan ' + items.length + ' catatan' : ' Simpan');
    };
    list.addEventListener('input', e => { const row = e.target.closest('.vq-row'); if (!row) return; const r = items[+row.dataset.i];
      if (e.target.name && e.target.name[0] === 'j') r.jumlah = U.parseRp(e.target.value); else if (e.target.dataset.f === 'catatan') r.catatan = e.target.value;
      row.classList.toggle('kurang', !lengkap(r)); ok.disabled = items.some(x => !lengkap(x)); });
    list.addEventListener('change', e => { const row = e.target.closest('.vq-row'); if (!row || !e.target.dataset.f) return; const r = items[+row.dataset.i]; r[e.target.dataset.f] = e.target.value; if (e.target.dataset.f === 'kategoriId') r.dipilih = true; gambar(); });
    list.addEventListener('click', e => { const row = e.target.closest('.vq-row'); if (!row) return; const i = +row.dataset.i;
      if (e.target.closest('[data-hapus]')) { items.splice(i, 1); gambar(); }
      else if (e.target.closest('[data-jenis]')) { const r = items[i]; r.jenis = r.jenis === 'masuk' ? 'keluar' : 'masuk'; r.kategoriId = Voice.parse(r.raw + (r.jenis === 'masuk' ? ' masuk' : '')).kategoriId || ''; gambar(); } });
    const mulai = () => {
      if (dengar) { Voice.stop(); return; }
      dengar = true; mic.classList.add('on'); txt.textContent = 'Mendengarkan… silakan bicara'; teks = '';
      Voice.start(p => { txt.textContent = p; teks = p; }, final => {
        dengar = false; mic.classList.remove('on');
        const f = final || teks;
        if (!f) { if (!items.length) txt.textContent = 'Ketuk mikrofon lalu bicara.'; return; }
        txt.textContent = '“' + f + '”';
        const baru = Voice.parseBanyak(f).map(r => Object.assign(r, { walletId: r.walletId || (items[0] && items[0].walletId) || UI.defWallet() }));
        items = items.concat(baru); gambar();
        if (baru.some(r => !r.jumlah)) UI.toast('Nominalnya belum terdengar — ketik di kotak Rp.', 'warn');
      }, err => { dengar = false; mic.classList.remove('on'); txt.textContent = err + ' Ketuk mikrofon untuk mencoba lagi.'; });
    };
    mic.onclick = mulai;
    s.el.querySelector('[data-ulang]').onclick = () => { items = []; gambar(); mulai(); };
    ok.onclick = async () => {
      if (items.some(r => !lengkap(r))) return;
      const now = new Date().toISOString(), today = U.today();
      const ops = items.map(r => ({ op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: today, jenis: r.jenis, jumlah: r.jumlah, kategoriId: r.kategoriId, walletId: r.walletId, walletTujuan: '', biaya: 0,
        catatan: r.catatan || '', dibayarOleh: Store.me.email, tag: '', sumber: 'suara', refId: '', periodeRef: '', dicatatOleh: Store.me.email, dibuat: now, riwayat: [] } }));
      if (!(await UI.commitPriv(ops))) return;
      items.forEach(r => { if (r.dipilih) Voice.ajari(r.raw || r.catatan, r.kategoriId); });
      const ids = ops.map(o => o.row.id);
      s.close();
      UI.toast(ops.length > 1 ? ops.length + ' catatan tersimpan.' : 'Tersimpan · ' + (items[0].catatan ? items[0].catatan + ' ' : '') + U.rp(items[0].jumlah), 'ok', { undo: () => Store.commit(ids.map(id => ({ op: 'delete', t: 'Transaksi', id }))), ms: 4500 });
    };
    gambar(); setTimeout(mulai, 250);
  };
  /** Dompet bawaan untuk catat cepat: dompet yang paling sering dipakai 30 hari terakhir. */
  UI.defWallet = () => {
    const n = {}, dari = U.addDays(U.today(), -30);
    Store.t.Transaksi.forEach(t => { if (t.tanggal >= dari && t.jenis === 'keluar' && t.walletId && Store.byId.Wallet[t.walletId]) n[t.walletId] = (n[t.walletId] || 0) + 1; });
    const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    return top || ((Store.wallets()[0] || {}).id || '');
  };

  // ---------- Bayar tagihan / konfirmasi rutin ----------
  UI.findOcc = (id) => {
    const from = U.addMonths(U.today(), -3), to = U.addDays(U.today(), 400);
    return Calc.occurrences(from, to).find(o => o.id === id);
  };
  UI.act('occ-pay', el => UI.payOcc(el.dataset.occ));
  UI.payOcc = (id, opt) => {
    opt = opt || {};
    const o = UI.findOcc(id);
    if (!o) return UI.toast('Jadwal tidak ditemukan.', 'warn');
    if (o.kind === 'acara') return UI.catat({ preset: { jenis: 'keluar', jumlah: o.sisa, catatan: o.nama, tanggal: U.today() } });
    if (o.kind === 'tujuan') return UI.go('tujuan/' + o.ref.id);
    if (o.kind === 'rapat') return UI.go('rapat');
    const me = Store.me.email, now = new Date().toISOString();
    const cicKat = (Store.t.Kategori.find(k => /cicilan/i.test(k.nama) && k.jenis === 'keluar') || {}).id || '';
    const mkRow = (jumlah, walletId, tanggal, biayaLain) => {
      const jenis = o.kind === 'pinjaman' ? (o.arah === 'masuk' ? 'pinjam_kembali' : 'keluar') : (o.arah === 'masuk' ? 'masuk' : 'keluar');
      return { id: U.uid('t'), tanggal, jenis, jumlah, kategoriId: o.kind === 'pinjaman' ? (jenis === 'keluar' ? cicKat : '') : (o.kategoriId || ''), walletId, walletTujuan: '', biaya: biayaLain || 0,
        catatan: o.nama + (o.periodeRef ? ' · ' + (o.periodeRef.length === 4 ? o.periodeRef : U.tgl(o.periodeRef + '-01', 'my')) : ''), dibayarOleh: me, tag: '', sumber: 'rutin', refId: o.refId, periodeRef: o.periodeRef, dicatatOleh: me, dibuat: now, riwayat: [] };
    };
    const done = (row) => {
      Store.upsert('Transaksi', row);
      UI.toast((o.arah === 'masuk' ? 'Diterima: ' : 'Lunas: ') + o.nama, 'ok', { undo: () => Store.remove('Transaksi', row.id) });
    };
    if (opt.quick) { done(mkRow(o.sisa, o.walletId || Store.wallets()[0].id, o.tanggal <= U.today() ? U.today() : U.today())); return; }
    const s = UI.sheet({ title: o.nama, cls: 'small', body: `
      <div class="kv-list"><div class="kv"><span>Jatuh tempo</span><b>${U.tgl(o.tanggal, 'long')}</b></div><div class="kv"><span>Tagihan</span><b>${U.rp(o.jumlah)}</b></div>${o.dibayar ? `<div class="kv"><span>Sudah dibayar</span><b>${U.rp(o.dibayar)}</b></div>` : ''}</div>
      ${UI.seg('aksi', [['lunas', o.arah === 'masuk' ? 'Sudah diterima' : 'Sudah dibayar'], ['sebagian', 'Sebagian'], ['tunda', 'Tunda']], 'lunas')}
      <div data-p="lunas sebagian">${UI.field('Jumlah', UI.rpInput('jumlah', o.sisa))}<div class="grid2">${UI.field(o.arah === 'masuk' ? 'Masuk ke' : 'Dari dompet', `<select name="walletId">${UI.walletOpts(o.walletId)}</select>`)}${UI.field('Tanggal bayar', `<input type="date" name="tanggal" value="${U.today()}">`)}</div>${UI.biayaField(0, 'Opsional — denda, biaya admin, biaya transfer.')}</div>
      <div data-p="tunda" hidden>${UI.field('Ingatkan lagi pada', `<input type="date" name="tunda" value="${U.addDays(U.today(), 3)}">`, 'Pengingat untuk tagihan ini ditunda sampai tanggal tersebut.')}</div>`,
      foot: `<button class="btn" data-ok>${I('check')} Simpan</button>` });
    UI.bindRp(s.el);
    const sync = () => { const a = s.el.querySelector('[name=aksi]:checked').value; s.el.querySelectorAll('[data-p]').forEach(p => p.hidden = p.dataset.p.indexOf(a) < 0); if (a === 'lunas') s.el.querySelector('[name=jumlah]').value = U.fmtNum(o.sisa); };
    s.el.querySelectorAll('[name=aksi]').forEach(r => r.onchange = sync);
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el);
      if (f.aksi === 'tunda') { Store.setSetting('tunda_' + o.id, f.tunda); UI.toast('Ditunda sampai ' + U.tgl(f.tunda)); s.close(); return; }
      if (!f.jumlah) return UI.toast('Isi jumlah.', 'warn');
      done(mkRow(f.jumlah, f.walletId, f.tanggal || U.today(), f.biayaLain || 0));
      s.close();
    };
  };
  UI.isTunda = o => { const v = Store.setting('tunda_' + o.id, ''); return v && v > U.today(); };
})();
