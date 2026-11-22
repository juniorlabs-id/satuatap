/* Lainnya › Tanya AI · Foto struk · Insight mingguan · Bahan rapat */
(function () {
  const I = UI.icon;
  const A = { chat: [], sibuk: false };
  const kunciChat = () => 'sa:aichat:' + ((Store.me && Store.me.email) || '');
  const muatChat = () => { try { A.chat = JSON.parse(sessionStorage.getItem(kunciChat()) || '[]'); } catch (e) { A.chat = []; } };
  const simpanChat = () => { try { sessionStorage.setItem(kunciChat(), JSON.stringify(A.chat.slice(-30))); } catch (e) {} };
  /** Teks AI → HTML aman (butir "• " dan baris baru). */
  UI.aiTeks = t => U.esc(String(t || '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*•]\s+/gm, '• ').replace(/\n/g, '<br>');

  // ---------- Pengaturan AI (bawaan: AI JuniorLabs; opsional: kunci Gemini sendiri) ----------
  UI.act('ai-atur', () => {
    const c = AI.cfg(), list = (c.models || []).filter(n => /gemini/.test(n));
    const s = UI.sheet({ title: 'Pengaturan AI', cls: 'small', body: AI.pribadi()
      ? `<div class="note">${I('key-round')} <span>Memakai <b>kunci Gemini pribadi</b> di HP ini.</span></div>
         ${UI.field('Model', `<select name="model">${list.map(n => `<option ${n === c.model ? 'selected' : ''}>${U.esc(n)}</option>`).join('')}</select>`, 'Ganti hanya bila sering gagal atau kuota habis.')}
         <button class="btn block ghost" data-simpan>Simpan model</button><button class="btn block ghost danger" data-putus>${I('unplug')} Hapus kunci · kembali ke AI JuniorLabs</button>`
      : `<div class="note ok">${I('sparkles')} <span><b>AI JuniorLabs aktif</b> — sudah termasuk langganan SatuAtap, tanpa pemasangan apa pun.${AI.sisaKuota != null ? ' Sisa jatah keluarga hari ini: <b>' + AI.sisaKuota + '</b>.' : ''}</span></div>
         <details class="adv"><summary>Pakai kunci Gemini sendiri (opsional)</summary>
           <p class="small muted">Hanya bila ingin jatah tak terbatas dari akun Google sendiri. Buat kunci di <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>. Kunci disimpan hanya di HP ini.</p>
           ${UI.field('Kunci API Gemini', `<input id="ai-key" type="password" autocomplete="off" spellcheck="false" placeholder="AQ.… / AIza…">`)}
           <button class="btn block" data-sambung>${I('plug')} Sambungkan</button></details>` });
    const q = x => s.el.querySelector(x);
    if (q('[data-simpan]')) q('[data-simpan]').onclick = () => { AI.simpanCfg(Object.assign(c, { model: UI.formData(s.el).model, manual: true })); s.close(); UI.render(); };
    if (q('[data-putus]')) q('[data-putus]').onclick = () => { AI.hapus(); s.close(); UI.toast('Kembali memakai AI JuniorLabs.'); UI.render(); };
    if (q('[data-sambung]')) q('[data-sambung]').onclick = async () => {
      const b = q('[data-sambung]'); b.disabled = true; b.innerHTML = I('loader') + ' Memeriksa…';
      try { const m = await AI.sambung(q('#ai-key').value); s.close(); UI.toast('Kunci pribadi tersambung · ' + m); UI.render(); }
      catch (e) { UI.toast(e.message, 'warn'); b.disabled = false; b.innerHTML = I('plug') + ' Sambungkan'; }
    };
  });

  // ---------- Tanya AI ----------
  const SARAN = ['Jajan bulan ini naik berapa?', 'Kategori apa yang paling boros bulan ini?', 'Kapan dana darurat kami tercapai?', 'Berapa sisa anggaran makan bulan ini?', 'Apa yang bisa kami hemat bulan depan?', 'Bagaimana kondisi utang kami?'];
  const tanya = async (q) => {
    q = String(q || '').trim(); if (!q || A.sibuk) return;
    A.chat.push({ dari: 'saya', teks: q }); A.sibuk = true; UI.render(); gulir();
    try { const t = await AI.jawab(q); A.chat.push({ dari: 'ai', teks: t }); }
    catch (e) { A.chat.push({ dari: 'ai', teks: '⚠️ ' + e.message, galat: true }); }
    A.sibuk = false; simpanChat(); UI.render(); gulir();
  };
  const gulir = () => setTimeout(() => { const b = document.querySelector('.ai-chat'); if (b) b.lastElementChild && b.lastElementChild.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, 50);
  UI.act('ai-saran', el => tanya(el.dataset.q));
  UI.act('ai-kirim', () => { const i = document.getElementById('ai-q'); if (i) { const v = i.value; i.value = ''; tanya(v); } });
  UI.act('ai-bersih', () => { A.chat = []; simpanChat(); UI.render(); });

  // ---------- Foto struk (T-11): dibaca per barang → 1 mutasi berisi rincian ----------
  UI.fotoStruk = () => {
    if (!AI.siap()) return UI.toast('Fitur AI belum tersedia. Pastikan lisensi aktif dan internet tersambung.', 'warn');
    const pil = UI.sheet({ title: 'Scan struk / bukti bayar', cls: 'small', body: `<p class="muted small">Struk belanja dibaca per barang; screenshot bukti bayar (m-banking, e-wallet, QRIS) dibaca nominal & tujuannya. Anda cek dulu sebelum disimpan.</p>
      <div class="setor-via dua"><button type="button" data-src="kamera">${I('camera')}Kamera<small>foto sekarang</small></button><button type="button" data-src="galeri">${I('image')}Galeri<small>foto / screenshot</small></button></div>
      <div class="note small">${I('share-2')} <span>Lebih cepat: setelah bayar, screenshot halaman "Berhasil" lalu <b>Bagikan › SatuAtap</b> dari galeri. (Aplikasi perlu dipasang di layar utama.) <a class="link" href="#/panduan/bukti">Lihat caranya</a></span></div>` });
    pil.el.querySelectorAll('[data-src]').forEach(b => b.onclick = () => { pil.close(); pilihFoto(b.dataset.src === 'kamera'); });
  };
  function pilihFoto(kamera) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    if (kamera) inp.setAttribute('capture', 'environment');
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.onchange = () => { const f = inp.files[0]; inp.remove(); if (f) UI.bacaFoto(f); };
    inp.click();
  }
  /** Foto/screenshot → AI → struk per barang (Cek hasil scan) atau bukti bayar (Catat cepat berisi 1 catatan). */
  UI.bacaFoto = async (f) => {
    if (!AI.siap()) return UI.toast('Fitur AI belum tersedia. Pastikan lisensi aktif dan internet tersambung.', 'warn');
    const s = UI.sheet({ title: 'Membaca gambar', cls: 'small', body: `<div class="voice"><div class="mic-pulse">${I('scan-line', 'big')}</div><p class="muted">AI sedang membaca struk / bukti bayar…<br><small>Biasanya 5–20 detik.</small></p></div>` });
    try {
      const gb = await AI.kecilkan(f, 1600); if (AI.demo()) gb.bukti = /bukti|screenshot|bayar/i.test(f.name || '');
      const r = await AI.bacaStruk(gb);
      s.close();
      if (!r.items.length && !r.total) { UI.toast('Tidak terbaca sebagai struk atau bukti bayar. Coba gambar yang lebih jelas, atau ketik saja.', 'warn'); return UI.cepat(); }
      if (r.items.length) return UI.cekStruk(r, gb);
      UI.cepat({ items: [{ jenis: r.arah, jumlah: r.total, kategoriId: r.kategoriId || '', walletId: r.walletId || '', catatan: r.toko || '', raw: r.toko || '', tanggal: r.tanggal }], sumber: 'bukti' });
    } catch (e) { s.close(); UI.toast(e.message, 'warn'); }
  };
  /** Kiriman "Bagikan → SatuAtap" (diterima service worker). */
  UI.terimaBagikan = async () => {
    let foto = null, teks = '';
    try { const c = await caches.open('sa-bagikan'), a = await c.match('/__bagikan/foto'), b = await c.match('/__bagikan/teks');
      if (a) { const bl = await a.blob(); foto = new File([bl], 'bagikan.jpg', { type: bl.type || 'image/jpeg' }); }
      if (b) teks = (await b.text()).trim();
      await c.delete('/__bagikan/foto'); await c.delete('/__bagikan/teks'); } catch (e) {}
    if (foto) return UI.bacaFoto(foto);
    if (teks) return UI.cepat({ teks: teks.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 300) });
    UI.toast('Kiriman tidak berisi gambar atau teks.', 'warn');
  };
  /** Layar periksa hasil scan: ubah nama/nominal/kategori per barang, lalu simpan sebagai 1 mutasi. */
  UI.cekStruk = (r, gb) => {
    const wl = Store.wallets();
    const tunai = /tunai|cash/i.test(r.bayar || '') ? (wl.find(w => w.jenis === 'tunai') || {}).id : '';
    const st = { toko: r.toko || 'Belanja', tanggal: r.tanggal || U.today(), walletId: tunai || UI.defWallet(), total: r.total, items: r.items.map(x => Object.assign({ asli: x.kategoriId, milik: '' }, x)), teman: null };
    const s = UI.sheet({ title: 'Cek hasil scan', cls: 'struk-sheet', body: '<div class="cs-body"></div>',
      foot: `<button class="btn block" data-ok>${I('check')} Simpan</button>` });
    const body = s.el.querySelector('.cs-body');
    const subtotal = () => U.sum(st.items, x => x.jumlah || 0);
    /** Bagian tiap pemilik (''=saya, '0','1'..=teman) dari total dibayar, termasuk bagian pajak/diskon secara sebanding. */
    const bagian = () => { const sub = subtotal(), tot = st.total || sub, o = {}; st.items.forEach(x => { const m = st.teman ? x.milik || '' : ''; o[m] = (o[m] || 0) + (x.jumlah || 0); });
      Object.keys(o).forEach(k => { o[k] = sub ? Math.round(o[k] / sub * tot) : 0; }); return o; };
    const splitInfo = () => { const el = body.querySelector('.cs-split-sum'); if (!el || !st.teman) return; const b = bagian();
      el.innerHTML = `<span>Bagian Anda <b>${U.rp(b[''] || 0)}</b></span>` + st.teman.map((n, i) => `<span>${U.esc(n || 'Teman ' + (i + 1))} <b>${U.rp(b[String(i)] || 0)}</b></span>`).join(''); };
    const ringkas = () => {
      const sub = subtotal(), tot = st.total || sub, sel = tot - sub, el = body.querySelector('.cs-sum');
      if (!el) return;
      el.querySelector('[data-sub]').textContent = U.rp(sub);
      const adj = el.querySelector('[data-adj]'); adj.hidden = !sel;
      adj.innerHTML = `<span>${sel > 0 ? 'Pajak & biaya' : 'Potongan'}</span><b>${sel > 0 ? '+' : '−'}${U.rp(Math.abs(sel))}</b>`;
      splitInfo();
    };
    const render = () => {
      const cek = st.items.filter(x => x.cek).map(x => x.nama), kosong = st.items.filter(x => !x.kategoriId).length;
      body.innerHTML = `<div class="cs-head"><input class="cs-toko" data-g="toko" value="${U.esc(st.toko)}" maxlength="60" aria-label="Nama toko">
          <div class="grid2">${UI.field('Tanggal', `<input type="date" data-g="tanggal" value="${st.tanggal}" max="${U.today()}">`)}${UI.field('Bayar pakai', `<select data-g="walletId">${UI.walletOpts(st.walletId)}</select>`)}</div></div>
        ${cek.length ? `<div class="note warn small">${I('circle-alert')} <span><b>Perlu dicek:</b> ${U.esc(cek.slice(0, 4).join(', '))}${cek.length > 4 ? ' +' + (cek.length - 4) : ''}. Ketuk untuk mengubah.</span></div>` : ''}
        ${kosong ? `<div class="note warn small">${I('tag')} <span>${kosong} barang belum berkategori — pilih dulu sebelum menyimpan.</span></div>` : ''}
        <div class="card cs-list">${st.items.map((x, i) => { const k = Store.byId.Kategori[x.kategoriId];
          return `<div class="cs-row ${x.cek ? 'cek' : ''}" data-i="${i}"><div class="cs-t"><input class="cs-nama" data-f="nama" value="${U.esc(x.nama)}" maxlength="60" aria-label="Nama barang">
              <small>${x.qty > 1 ? x.qty + ' × ' + U.rp(x.harga) : ''}</small>
              <label class="vq-pill ${x.kategoriId ? '' : 'kosong'}">${I(k ? k.ikon || 'tag' : 'tag')}<select data-f="kategoriId" aria-label="Kategori"><option value="">Pilih kategori</option>${UI.katOpts('keluar', x.kategoriId)}</select>${I('chevron-down')}</label>
              ${st.teman ? `<label class="vq-pill cs-milik ${x.milik ? 'teman' : ''}">${I(x.milik ? 'user' : 'house')}<select data-f="milik" aria-label="Milik siapa"><option value="">Saya</option>${st.teman.map((n, j) => `<option value="${j}" ${x.milik === String(j) ? 'selected' : ''}>${U.esc(n || 'Teman ' + (j + 1))}</option>`).join('')}</select>${I('chevron-down')}</label>` : ''}</div>
            <div class="cs-r"><div class="cs-amt"><span>Rp</span><input data-f="jumlah" data-rp inputmode="numeric" value="${U.fmtNum(x.jumlah)}" aria-label="Nominal"></div><button type="button" class="icon-btn sm" data-hapus aria-label="Hapus barang">${I('x')}</button></div></div>`; }).join('')}
          <button type="button" class="link cs-add" data-tambah>${I('plus')} Tambah barang</button>
          <div class="cs-sum"><div class="kv"><span>Subtotal</span><b data-sub></b></div><div class="kv" data-adj hidden></div>
            <div class="kv cs-total"><span>Total dibayar</span><div class="cs-amt big"><span>Rp</span><input data-g="total" data-rp inputmode="numeric" value="${U.fmtNum(st.total || subtotal())}" aria-label="Total dibayar"></div></div></div></div>
        ${st.teman ? `<div class="subbox cs-split"><div class="subbox-h">${I('users')} Split bill — Anda membayar total <small>Pilih "milik" tiap barang. Bagian teman dicatat sebagai piutang (pajak & diskon ikut terbagi).</small></div>
            ${st.teman.map((n, i) => `<div class="split-row"><input data-tm="${i}" placeholder="Nama teman" maxlength="40" value="${U.esc(n)}"><button type="button" class="icon-btn" data-tmdel="${i}" aria-label="Hapus teman">${I('x')}</button></div>`).join('')}
            <div class="chips"><button type="button" class="link" data-tmadd>${I('plus')} Tambah teman</button><button type="button" class="link" data-tmoff>Batalkan split bill</button></div>
            <div class="cs-split-sum"></div></div>`
          : `<button type="button" class="btn ghost block" data-split>${I('users')} Split bill dengan teman</button>`}
        <button type="button" class="link block" data-satu>Simpan sebagai 1 transaksi tanpa item</button>`;
      UI.bindRp(body); ringkas();
    };
    const x0 = row => { const x = st.items[+row.dataset.i]; if (x && x.cek) { x.cek = false; row.classList.remove('cek'); } return true; };   // ketuk baris = sudah dicek
    body.addEventListener('input', e => {
      const g = e.target.dataset.g, f = e.target.dataset.f, row = e.target.closest('.cs-row');
      if (g === 'total') { st.total = U.parseRp(e.target.value); return ringkas(); }
      if (e.target.dataset.tm !== undefined) { st.teman[+e.target.dataset.tm] = e.target.value; return splitInfo(); }
      if (g) { st[g] = e.target.value; return; }
      if (!row || !f) return; const x = st.items[+row.dataset.i];
      if (f === 'jumlah') { x.jumlah = U.parseRp(e.target.value); ringkas(); } else if (f === 'nama') x.nama = e.target.value;
    });
    body.addEventListener('change', e => {
      const row = e.target.closest('.cs-row'); if (!row || e.target.dataset.f !== 'kategoriId') return;
      const x = st.items[+row.dataset.i]; x.kategoriId = e.target.value; x.cek = false; render();
    });
    body.addEventListener('change', e => { const row = e.target.closest('.cs-row'); if (row && e.target.dataset.f === 'milik') { st.items[+row.dataset.i].milik = e.target.value; render(); } else if (e.target.dataset.tm !== undefined) render(); });
    body.addEventListener('click', e => {
      const row = e.target.closest('.cs-row');
      if (e.target.closest('[data-split]')) { st.teman = ['']; render(); const t = body.querySelector('[data-tm]'); if (t) t.focus(); return; }
      if (e.target.closest('[data-tmadd]')) { st.teman.push(''); render(); const t = body.querySelectorAll('[data-tm]'); t[t.length - 1].focus(); return; }
      if (e.target.closest('[data-tmoff]')) { st.teman = null; st.items.forEach(x => { x.milik = ''; }); return render(); }
      const td = e.target.closest('[data-tmdel]');
      if (td) { const k = +td.dataset.tmdel; st.teman.splice(k, 1); st.items.forEach(x => { if (x.milik === String(k)) x.milik = ''; else if (x.milik && +x.milik > k) x.milik = String(+x.milik - 1); }); if (!st.teman.length) st.teman = null; return render(); }
      if (row && e.target.closest('[data-hapus]')) { st.items.splice(+row.dataset.i, 1); render(); }
      else if (row) x0(row);
      else if (e.target.closest('[data-tambah]')) { st.items.push({ nama: 'Barang', qty: 1, harga: 0, jumlah: 0, kategoriId: '', cek: false }); render(); const n = body.querySelectorAll('.cs-nama'); if (n.length) { n[n.length - 1].focus(); n[n.length - 1].select(); } }
      else if (e.target.closest('[data-satu]')) { s.close(); UI.catat({ preset: { jenis: 'keluar', jumlah: st.total || subtotal(), tanggal: st.tanggal, walletId: st.walletId, kategoriId: UI.katUtama(st.items.map(x => ({ k: x.kategoriId, j: x.jumlah }))), catatan: st.toko, sumber: 'struk' } }); }
    });
    s.el.querySelector('[data-ok]').onclick = async () => {
      const items = st.items.filter(x => x.jumlah > 0);
      if (!items.length) return UI.toast('Belum ada barang dengan nominal.', 'warn');
      if (items.some(x => !x.kategoriId)) return UI.toast('Pilih kategori untuk semua barang dulu.', 'warn');
      const total = st.total || U.sum(items, x => x.jumlah);
      const split = !!(st.teman && items.some(x => x.milik));
      if (split && st.teman.some((n, i) => !String(n || '').trim() && items.some(x => x.milik === String(i)))) return UI.toast('Isi nama teman dulu.', 'warn');
      const b = split ? bagian() : { '': total }, punyaSaya = split ? items.filter(x => !x.milik) : items;
      const rincian = punyaSaya.map(x => ({ n: String(x.nama || 'Barang').trim().slice(0, 60), q: x.qty || 1, h: x.qty > 1 ? x.harga : x.jumlah, j: x.jumlah, k: x.kategoriId }));
      let lampiran = '';
      if (Store.mode === 'live' && gb && Cloud.simpanStruk) { try { lampiran = await Cloud.simpanStruk(gb.blob, st.toko + ' ' + st.tanggal + '.jpg'); } catch (e) { /* foto opsional */ } }
      const me = Store.me.email, now = new Date().toISOString(), ops = [];
      const mk = o => Object.assign({ id: U.uid('t'), tanggal: st.tanggal, jenis: 'keluar', jumlah: 0, kategoriId: '', walletId: st.walletId, walletTujuan: '', biaya: 0, catatan: st.toko, dibayarOleh: me, tag: '', sumber: 'struk', refId: '', periodeRef: '', dicatatOleh: me, dibuat: now, riwayat: [], lampiran }, o);
      const row = mk({ jumlah: split ? b[''] || 0 : total, kategoriId: UI.katUtama(rincian), rincian });
      if (row.jumlah > 0) ops.push({ op: 'upsert', t: 'Transaksi', row });
      if (split) st.teman.forEach((n, i) => {
        const j = b[String(i)] || 0, nama = String(n || '').trim(); if (!j) return;
        const brg = items.filter(x => x.milik === String(i)).map(x => x.nama).join(', '), pid = U.uid('p');
        ops.push({ op: 'upsert', t: 'Pinjaman', row: { id: pid, arah: 'piutang', jenis: 'patungan', pihak: nama, pokok: j, bunga: 0, metode: 'tanpa', tenor: 1, mulai: st.tanggal, tanggalBayar: 0, cicilan: j, walletId: st.walletId, lunas: false, catatan: 'Split bill ' + st.toko + ': ' + brg.slice(0, 200), dibuat: now } });
        ops.push({ op: 'upsert', t: 'Transaksi', row: mk({ jenis: 'pinjam_beri', jumlah: j, refId: pid, catatan: 'Split bill · ' + nama + ' · ' + st.toko, sumber: 'patungan', lampiran: '' }) });
      });
      if (!(await UI.commitPriv(ops))) return;
      items.forEach(x => { if (x.kategoriId !== x.asli && window.Voice) Voice.ajari(x.nama, x.kategoriId); });   // belajar dari koreksi
      try { localStorage.setItem('sa:lastWallet', st.walletId); } catch (e) {}
      s.close();
      const ids = ops.map(o => [o.t, o.row.id]);
      UI.toast(split ? 'Tersimpan · bagian Anda ' + U.rp(b[''] || 0) + ', piutang teman ' + U.rp(total - (b[''] || 0)) : 'Tersimpan · ' + st.toko + ' ' + U.rp(total) + ' (' + items.length + ' item)', 'ok',
        { undo: () => Store.commit(ids.map(([t, id]) => ({ op: 'delete', t, id }))), ms: 5000 });
    };
    render();
  };
  UI.act('ai-struk', () => UI.fotoStruk());

  // ---------- Insight mingguan (kartu Beranda) ----------
  A.insight = null; A.insightJalan = false;
  UI.aiInsightCard = () => {
    if (!AI.siap()) return '';
    const o = A.insight || AI.insightTersimpan();
    const minggu = U.addDays(U.today(), -((U.parseDate(U.today()).getDay() + 6) % 7));
    if ((!o || o.minggu !== minggu) && !A.insightJalan && !A.insightGagal) {     // sekali per minggu, otomatis
      A.insightJalan = true;
      AI.insight().then(x => { A.insight = x; }).catch(e => { A.insightGagal = e.message; }).finally(() => { A.insightJalan = false; if (UI.cur === 'beranda') UI.render(); });
    }
    if (!o && A.insightJalan) return `<div class="card ai-card"><div class="row-sp"><b>${I('sparkles')} Insight minggu ini</b><small class="muted">menyusun…</small></div></div>`;
    if (!o) return A.insightGagal ? `<div class="card ai-card"><div class="row-sp"><b>${I('sparkles')} Insight minggu ini</b><button class="icon-btn sm" data-act="ai-insight" aria-label="Coba lagi">${I('refresh-cw')}</button></div><small class="muted">${U.esc(A.insightGagal)}</small></div>` : '';
    return `<div class="card ai-card"><div class="row-sp"><b>${I('sparkles')} Insight minggu ini</b><button class="icon-btn sm" data-act="ai-insight" aria-label="Perbarui">${I(A.insightJalan ? 'loader' : 'refresh-cw')}</button></div>
      <div class="ai-out">${UI.aiTeks(o.teks)}</div><small class="muted">Dirangkum AI dari angka minggu ini · ${U.timeAgo(o.at)}</small></div>`;
  };
  UI.act('ai-insight', async () => { if (A.insightJalan) return; A.insightJalan = true; A.insightGagal = ''; UI.render(); try { A.insight = await AI.insight(true); } catch (e) { UI.toast(e.message, 'warn'); } A.insightJalan = false; UI.render(); });

  // ---------- Bahan diskusi rapat (M-05) ----------
  UI.act('rp-ai', async el => {
    const box = document.getElementById('rp-ai'); if (!box) return;
    box.innerHTML = `<small class="muted">${I('loader')} Menyusun bahan diskusi…</small>`;
    try { box.innerHTML = UI.aiTeks(await AI.bahanRapat()) + `<small class="muted">Angka dari catatan keluarga; kalimat oleh AI.</small>`; }
    catch (e) { box.innerHTML = `<small class="bad">${U.esc(e.message)}</small>`; }
  });

  UI.page('ai', {
    head: () => ({ title: 'Tanya AI', crumb: 'Lainnya', back: 'lainnya', right: AI.siap() && !AI.demo() ? `<button class="icon-btn" data-act="ai-atur" aria-label="Pengaturan AI">${I('settings')}</button>` : '' }),
    nav: () => 'lainnya',
    render() {
      if (!AI.siap()) return UI.empty('sparkles', 'AI belum tersedia', 'Fitur AI aktif otomatis setelah aplikasi tersambung ke data keluarga dengan lisensi aktif. Periksa internet lalu buka lagi.');
      if (!A.chat.length) muatChat();
      const c = AI.cfg();
      return `<div class="tiles-row"><button class="btn ghost" data-act="ai-struk">${I('scan-line')} Scan struk</button><button class="btn ghost" data-act="go" data-to="rapat">${I('users')} Bahan rapat</button></div>
        <div class="ai-chat">${A.chat.length ? A.chat.map(m => `<div class="bubble ${m.dari} ${m.galat ? 'err' : ''}">${m.dari === 'ai' ? UI.aiTeks(m.teks) : U.esc(m.teks)}</div>`).join('')
          : `<div class="ai-kosong">${I('sparkles', 'big')}<p>Tanyakan apa saja tentang keuangan keluarga. Angka dihitung dari catatan Anda; AI merangkai jawabannya.</p></div>`}
          ${A.sibuk ? `<div class="bubble ai typing"><i></i><i></i><i></i></div>` : ''}</div>
        <div class="chips">${SARAN.map(q => `<button class="chip" data-act="ai-saran" data-q="${U.esc(q)}">${U.esc(q)}</button>`).join('')}</div>
        <div class="ai-input"><input id="ai-q" maxlength="300" placeholder="Tulis pertanyaan…" enterkeyhint="send"><button class="btn" data-act="ai-kirim" aria-label="Kirim">${I('send')}</button></div>
        <div class="row-sp"><small class="muted">${AI.demo() ? 'Mode demo: jawaban contoh' : AI.pribadi() ? 'Kunci pribadi · ' + U.esc(c.model || '-') : 'AI JuniorLabs' + (AI.sisaKuota != null ? ' · sisa jatah hari ini ' + AI.sisaKuota : '')}</small>${A.chat.length ? `<button class="link" data-act="ai-bersih">Bersihkan</button>` : ''}</div>
        <div class="note small">${I('shield-check')} <span>Yang dikirim ke AI hanya ringkasan angka — tanpa catatan transaksi dan tanpa kategori pribadi. Foto struk dibaca lalu tidak disimpan oleh server.</span></div><div class="spacer"></div>`;
    },
    after(el) { const i = el.querySelector('#ai-q'); if (i) i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const v = i.value; i.value = ''; tanya(v); } }; }
  });
})();
