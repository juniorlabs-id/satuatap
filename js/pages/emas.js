/* Brankas Emas — koleksi, harga harian, beli/jual/gadai, multi-pemilik, simulasi, haul */
(function () {
  const I = UI.icon;
  const BENTUK = [['batangan', 'Batangan'], ['perhiasan', 'Perhiasan'], ['digital', 'Tabungan/digital']];
  const KADAR = [[24, '24K (99,9%)'], [23, '23K'], [22, '22K'], [20, '20K'], [18, '18K'], [17, '17K'], [16, '16K'], [10, '10K'], [8, '8K']];
  const S = { pilih: {} };
  const g = v => U.fmtNum(Math.round(v * 1000) / 1000);
  const me = () => Store.me.email;

  // ---------- Komponen bersama: kepemilikan multi-pemilik ----------
  UI.kepemilikanField = (kp) => {
    const sh = kp && typeof kp === 'object' ? kp : {}, ms = Store.members();
    return `<div class="field"><span>Kepemilikan</span><div class="own-grid">${ms.map(m => `<label class="own"><span class="avatar xs" style="background:${m.warna || '#5b7a78'}">${U.esc(U.initials(m.nama))}</span><b>${U.esc(m.nama)}</b>
      <input type="number" min="0" max="100" step="5" data-own="${U.esc(m.email)}" value="${sh[m.email] != null ? sh[m.email] : ''}" placeholder="0"><i>%</i></label>`).join('')}</div>
      <small>Kosongkan semua = milik bersama. Bisa lebih dari 2 pemilik (mis. 50/30/20).</small><small class="own-err bad"></small></div>`;
  };
  UI.readKepemilikan = (root) => {
    const o = {}; let tot = 0;
    root.querySelectorAll('[data-own]').forEach(i => { const v = Number(i.value) || 0; if (v > 0) { o[i.dataset.own] = v; tot += v; } });
    if (tot && Math.abs(tot - 100) > 0.5) { const e = root.querySelector('.own-err'); if (e) e.textContent = 'Total kepemilikan ' + tot + '% — harus 100%.'; return null; }
    return o;
  };
  UI.ownLabel = (kp) => { const sh = Calc.shares(kp); return sh.bersama ? 'Bersama' : Object.keys(sh).map(e => Store.memberName(e) + ' ' + Math.round(sh[e] * 100) + '%').join(' · '); };
  /** Pilihan sumber dana: sudah dimiliki / dompet / dana tujuan. */
  UI.sumberDanaOpts = (sel) => `<option value="">Sudah dimiliki sebelumnya (tidak memotong saldo)</option>
    <optgroup label="Dari dompet">${Store.wallets().map(w => `<option value="w:${w.id}" ${sel === 'w:' + w.id ? 'selected' : ''}>${U.esc(w.nama)} — ${U.rpShort(Calc.balances()[w.id] || 0)}</option>`).join('')}</optgroup>
    ${Calc.goals().filter(x => !x.t.arsip && !x.t.walletId && x.dana > 0).length ? `<optgroup label="Dari dana tujuan">${Calc.goals().filter(x => !x.t.arsip && !x.t.walletId && x.dana > 0).map(x => `<option value="g:${x.t.id}">${U.esc(x.t.nama)} — ${U.rpShort(x.dana)}</option>`).join('')}</optgroup>` : ''}`;
  UI.tujuanOpts = (sel) => `<option value="">— tidak ditautkan —</option>${Calc.goals().filter(x => !x.t.arsip).map(x => `<option value="${x.t.id}" ${x.t.id === sel ? 'selected' : ''}>${U.esc(x.t.nama)}</option>`).join('')}`;
  /** Operasi transaksi untuk pembelian aset sesuai sumber dana. */
  UI.opsBeliAset = (sumber, jumlah, tanggal, refId, catatan) => {
    if (!sumber || !jumlah) return [];
    const now = new Date().toISOString(), m = me();
    const base = { kategoriId: '', walletTujuan: '', biaya: 0, dibayarOleh: m, tag: '', sumber: 'aset', periodeRef: '', dicatatOleh: m, dibuat: now, riwayat: [] };
    if (sumber.indexOf('w:') === 0) return [{ op: 'upsert', t: 'Transaksi', row: Object.assign({}, base, { id: U.uid('t'), tanggal, jenis: 'aset_beli', jumlah, walletId: sumber.slice(2), refId, catatan }) }];
    const gid = sumber.slice(2), w = Store.wallets()[0];
    return [{ op: 'upsert', t: 'Transaksi', row: Object.assign({}, base, { id: U.uid('t'), tanggal, jenis: 'tujuan_ambil', jumlah, walletId: w.id, refId: gid, catatan: 'Dipakai untuk ' + catatan }) },
            { op: 'upsert', t: 'Transaksi', row: Object.assign({}, base, { id: U.uid('t'), tanggal, jenis: 'aset_beli', jumlah, walletId: w.id, refId, catatan }) }];
  };

  // ---------- Form beli / ubah ----------
  UI.emasForm = (e) => {
    const isNew = !e, h = Calc.hargaEmas();
    e = e || { id: U.uid('e'), tanggal: U.today(), merek: 'Antam', bentuk: 'batangan', gramKeping: 1, jumlah: 1, kadar: 24, hargaBeli: 0, biaya: 0, walletId: '', tujuanId: '', kepemilikan: {}, status: 'simpan', zakat: true, tglJual: '', hargaJual: 0, pinjamanId: '', sertifikat: '', catatan: '', dibuat: new Date().toISOString() };
    // Baris keping: [{gram, n, harga (per keping)}]. Pembelian baru boleh beberapa gramasi sekaligus.
    const awal = isNew ? [{ gram: 1, n: 1, harga: 0 }] : [{ gram: Number(e.gramKeping) || 1, n: Number(e.jumlah) || 1, harga: Math.round((Number(e.hargaBeli) || 0) / (Number(e.jumlah) || 1)) }];
    const baris = (r, i) => {
      const std = Calc.GRAMASI.indexOf(Number(r.gram)) > -1;
      return `<div class="keping-row" data-i="${i}">
        <label class="field"><span>Berat/keping</span><select data-k="gsel">${Calc.GRAMASI.map(x => `<option value="${x}" ${Number(r.gram) === x ? 'selected' : ''}>${String(x).replace('.', ',')} g</option>`).join('')}<option value="lain" ${std ? '' : 'selected'}>Lainnya…</option></select>
          <input type="number" step="0.001" min="0.001" data-k="gram" value="${r.gram}" ${std ? 'hidden' : ''} placeholder="gram"></label>
        <label class="field kecil"><span>Keping</span><input type="number" min="1" data-k="n" value="${r.n}" inputmode="numeric"></label>
        <label class="field"><span>Harga/keping</span><div class="rp-input"><b>Rp</b><input data-k="harga" data-rp inputmode="numeric" autocomplete="off" value="${r.harga ? U.fmtNum(r.harga) : ''}" placeholder="0"></div></label>
        ${isNew ? `<button type="button" class="icon-btn sm keping-x" data-x aria-label="Hapus baris" ${i === 0 ? 'hidden' : ''}>${I('x')}</button>` : ''}
      </div>`;
    };
    const s = UI.sheet({ title: isNew ? 'Catat emas' : 'Ubah catatan emas', body: `
      ${UI.seg('bentuk', BENTUK, e.bentuk)}
      <div class="grid2">${UI.field('Merek', `<select name="merek">${Calc.MEREK_EMAS.map(m => `<option ${m === e.merek ? 'selected' : ''}>${m}</option>`).join('')}</select>`)}${UI.field('Tanggal beli', `<input type="date" name="tanggal" value="${e.tanggal}">`)}</div>
      <div class="keping-list">${awal.map(baris).join('')}</div>
      ${isNew ? `<button type="button" class="btn ghost block sm" data-tambah>${I('plus')} Tambah gramasi lain</button>` : ''}
      <div class="grid2"><label class="field" data-kadar><span>Kadar</span><select name="kadar">${KADAR.map(k => `<option value="${k[0]}" ${Number(e.kadar) === k[0] ? 'selected' : ''}>${k[1]}</option>`).join('')}</select></label>${UI.field('Ongkos / biaya lain', UI.rpInput('biaya', e.biaya), isNew ? 'Total untuk seluruh pembelian' : '')}</div>
      ${h ? `<button type="button" class="link" data-hari>${I('wand-sparkles')} Isi harga/keping dengan harga hari ini</button>` : ''}
      <div class="keping-total"></div>
      ${isNew ? UI.field('Sumber dana', `<select name="sumber">${UI.sumberDanaOpts('')}</select>`, 'Pembelian dari dompet mengurangi saldo dompet itu, bukan dicatat sebagai pengeluaran.') : ''}
      ${UI.field('Untuk tujuan', `<select name="tujuanId">${UI.tujuanOpts(e.tujuanId)}</select>`, 'Nilai emas ini ikut dihitung sebagai dana tujuan tersebut.')}
      ${UI.kepemilikanField(e.kepemilikan)}
      <label class="check"><input type="checkbox" name="zakat" ${e.zakat ? 'checked' : ''}><span>Dihitung untuk zakat mal <small class="muted">(perhiasan yang dipakai sehari-hari umumnya tidak)</small></span></label>
      <div class="grid2">${UI.field('No. sertifikat / seri', `<input name="sertifikat" maxlength="40" value="${U.esc(e.sertifikat)}">`)}${UI.field('Catatan', `<input name="catatan" maxlength="100" value="${U.esc(e.catatan)}">`)}</div>`,
      foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${I('trash-2')}</button>`}<button class="btn" data-ok>${I('check')} Simpan</button>` });
    UI.bindRp(s.el);
    const list = s.el.querySelector('.keping-list'), tot = s.el.querySelector('.keping-total');
    const f = () => UI.formData(s.el);
    const rows = () => Array.from(list.querySelectorAll('.keping-row')).map(r => {
      const sel = r.querySelector('[data-k=gsel]').value, gr = sel === 'lain' ? Number(r.querySelector('[data-k=gram]').value) || 0 : Number(sel);
      return { el: r, gram: gr, n: Math.max(1, Math.round(Number(r.querySelector('[data-k=n]').value) || 1)), harga: Number(String(r.querySelector('[data-k=harga]').value).replace(/\D/g, '')) || 0 };
    });
    const sync = () => {
      const v = f(), rs = rows();
      s.el.querySelector('[data-kadar]').hidden = v.bentuk !== 'perhiasan';
      list.querySelectorAll('[data-x]').forEach((x, i) => x.hidden = list.children.length < 2);
      const gram = U.sum(rs, r => r.gram * r.n), beli = U.sum(rs, r => r.harga * r.n), total = beli + (v.biaya || 0);
      const hl = Calc.hargaLot({ merek: v.merek, bentuk: v.bentuk });
      const nb = hl ? Math.round(gram * (v.bentuk === 'perhiasan' ? Number(v.kadar) / 24 : 1) * hl.buyback) : 0;
      tot.innerHTML = gram ? `<div class="kv"><span>${rs.length > 1 ? rs.map(r => r.n + '×' + g(r.gram) + 'g').join(' + ') : 'Total berat'}</span><b>${g(gram)} gram</b></div>
        <div class="kv"><span>Total bayar${v.biaya ? ' (termasuk ongkos)' : ''}</span><b>${U.rp(total)}</b></div>
        ${total ? `<div class="kv muted"><span>Rata-rata</span><b>${U.rp(Math.round(total / gram))}/gram${nb ? ' · buyback hari ini ' + U.rp(nb) : ''}</b></div>` : ''}` : '';
    };
    list.addEventListener('change', ev => { if (ev.target.dataset.k === 'gsel') { const inp = ev.target.closest('.keping-row').querySelector('[data-k=gram]'); inp.hidden = ev.target.value !== 'lain'; if (ev.target.value !== 'lain') inp.value = ev.target.value; else inp.focus(); } });
    list.addEventListener('click', ev => { const x = ev.target.closest('[data-x]'); if (x && list.children.length > 1) { x.closest('.keping-row').remove(); sync(); } });
    const tb = s.el.querySelector('[data-tambah]');
    if (tb) tb.onclick = () => { const last = rows().pop(); list.insertAdjacentHTML('beforeend', baris({ gram: last && last.gram === 1 ? 5 : 1, n: 1, harga: 0 }, list.children.length)); UI.bindRp(list.lastElementChild); sync(); };
    s.el.addEventListener('input', sync); s.el.addEventListener('change', e2 => {
      if (e2.target.name === 'bentuk') { const z = s.el.querySelector('[name=zakat]'); z.checked = e2.target.value !== 'perhiasan'; if (e2.target.value === 'perhiasan') s.el.querySelector('[name=merek]').value = 'Perhiasan'; else s.el.querySelector('[name=kadar]').value = '24'; }
      sync();
    });
    const hb = s.el.querySelector('[data-hari]');
    if (hb) hb.onclick = () => { const v = f(), hx = Calc.hargaLot(v) || h; rows().forEach(r => { r.el.querySelector('[data-k=harga]').value = U.fmtNum(Math.round(r.gram * hx.beli * (v.bentuk === 'perhiasan' ? Number(v.kadar) / 24 : 1))); }); sync(); };
    sync();
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = f(), kp = UI.readKepemilikan(s.el), rs = rows();
      if (kp === null) return;
      if (rs.some(r => !r.gram)) return UI.toast('Isi berat per keping di setiap baris.', 'warn');
      if (rs.some(r => !r.harga)) return UI.toast('Isi harga per keping (untuk menghitung untung/rugi).', 'warn');
      const kadar = v.bentuk === 'perhiasan' ? Number(v.kadar) || 24 : 24, biaya = v.biaya || 0, beliTot = U.sum(rs, r => r.harga * r.n);
      const sumber = v.sumber; delete v.sumber;
      if (sumber && sumber.indexOf('g:') === 0 && !v.tujuanId) v.tujuanId = sumber.slice(2);
      // ongkos dibagi proporsional ke tiap gramasi agar harga per gram tiap lot tetap akurat
      let sisaB = biaya;
      const lots = rs.map((r, i) => {
        const bi = i === rs.length - 1 ? sisaB : Math.round(biaya * (r.harga * r.n) / (beliTot || 1)); sisaB -= bi;
        return Object.assign({}, e, v, { id: i === 0 ? e.id : U.uid('e'), gramKeping: r.gram, jumlah: r.n, kadar, hargaBeli: r.harga * r.n, biaya: bi, kepemilikan: kp, dibuat: e.dibuat || new Date().toISOString() });
      });
      const ket = 'Beli emas ' + (v.bentuk === 'perhiasan' ? 'perhiasan ' : v.merek + ' ') + rs.map(r => (r.n > 1 ? r.n + '×' : '') + g(r.gram) + 'g').join(' + ');
      const ops = lots.map(row => ({ op: 'upsert', t: 'Emas', row })).concat(isNew ? UI.opsBeliAset(sumber, beliTot + biaya, v.tanggal, lots[0].id, ket) : []);
      Store.commit(ops); s.close();
      UI.toast((lots.length > 1 ? lots.length + ' gramasi, ' : 'Emas ') + g(U.sum(rs, r => r.gram * r.n)) + ' g tersimpan.');
    };
    const d = s.el.querySelector('[data-del]');
    if (d) d.onclick = async () => { if (await UI.confirm('Hapus catatan emas?', 'Transaksi pembelian/penjualan yang terkait tetap ada di Mutasi.', 'Hapus', true)) { Store.remove('Emas', e.id); s.close(); } };
  };
  UI.act('emas-beli', () => UI.emasForm());

  // ---------- Detail lot ----------
  UI.act('emas-open', el => {
    const l = Calc.emasLots(true).find(x => x.e.id === el.dataset.id); if (!l) return;
    const e = l.e, tj = Store.byId.Tujuan[e.tujuanId], aktif = e.status !== 'terjual';
    const s = UI.sheet({ title: (e.bentuk === 'perhiasan' ? 'Perhiasan' : e.merek) + ' · ' + g(l.gram) + ' g', body: `
      <div class="detail-head"><span class="cat-ic lg gold">${I('gem')}</span><div><small class="muted">${e.status === 'terjual' ? 'Terjual ' + U.tgl(e.tglJual) : e.status === 'gadai' ? 'Sedang digadaikan' : 'Nilai buyback hari ini'}</small><div class="big-amt">${UI.m(l.nilai)}</div>
        <small class="${l.untung >= 0 ? 'ok' : 'bad'}">${l.untung >= 0 ? '+' : '−'}${UI.m(Math.abs(l.untung))} (${U.pct(l.pct, 1)})</small></div></div>
      <div class="kv-list">
        <div class="kv"><span>Berat</span><b>${e.jumlah > 1 ? e.jumlah + ' × ' + g(e.gramKeping) + ' g = ' : ''}${g(l.gram)} g${e.bentuk === 'perhiasan' ? ' (' + e.kadar + 'K ≈ ' + g(l.gramMurni) + ' g murni)' : ''}</b></div>
        <div class="kv"><span>Harga beli</span><b>${UI.m(l.modal)} · ${U.rp(Math.round(l.perGram))}/g</b></div>
        ${aktif && l.hargaGram ? `<div class="kv"><span>Buyback dipakai</span><b>${U.rp(Math.round(l.hargaGram))}/g · ${U.esc(l.hargaSumber)}</b></div>` : ''}
        <div class="kv"><span>Dibeli</span><b>${U.tgl(e.tanggal)} · ${l.umur} hari</b></div>
        <div class="kv"><span>Haul zakat</span><b>${e.zakat ? (l.haul ? '✓ Sudah 1 tahun Hijriah' : 'Kurang ' + (354 - l.umur) + ' hari') : 'Tidak dihitung zakat'}</b></div>
        <div class="kv"><span>Pemilik</span><b>${U.esc(UI.ownLabel(e.kepemilikan))}</b></div>
        ${tj ? `<div class="kv"><span>Untuk tujuan</span><b>${U.esc(tj.nama)}</b></div>` : ''}
        ${e.sertifikat ? `<div class="kv"><span>Sertifikat</span><b>${U.esc(e.sertifikat)}</b></div>` : ''}${e.catatan ? `<div class="kv"><span>Catatan</span><b>${U.esc(e.catatan)}</b></div>` : ''}</div>`,
      foot: aktif ? `<button class="btn ghost" data-a="edit">${I('pencil')}</button>${e.status === 'gadai' ? `<button class="btn ghost" data-a="tebus">${I('lock-open')} Tebus</button>` : `<button class="btn ghost" data-a="gadai">${I('landmark')} Gadai</button>`}<button class="btn" data-a="jual" ${e.status === 'gadai' ? 'disabled' : ''}>${I('hand-coins')} Jual</button>`
        : `<button class="btn ghost danger" data-a="hapus">${I('trash-2')} Hapus catatan</button>` });
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const a = b.dataset.a; s.close();
      if (a === 'edit') UI.emasForm(e); else if (a === 'jual') jualForm(l); else if (a === 'gadai') gadaiForm(l); else if (a === 'tebus') tebusForm(l);
      else if (a === 'hapus' && await UI.confirm('Hapus catatan?', 'Riwayat penjualan ini dihapus dari Brankas Emas.', 'Hapus', true)) Store.remove('Emas', e.id);
    });
  });

  // ---------- Jual ----------
  function jualForm(l) {
    const e = l.e, h = Calc.hargaLot(e);
    const s = UI.sheet({ title: 'Jual emas', cls: 'small', body: `
      ${e.jumlah > 1 ? UI.field('Keping yang dijual', `<input type="number" name="n" min="1" max="${e.jumlah}" value="${e.jumlah}">`, 'Dari ' + e.jumlah + ' keping @ ' + g(e.gramKeping) + ' g') : ''}
      ${UI.field('Harga buyback per gram', UI.rpInput('hb', h ? h.buyback : 0))}
      <div class="grid2">${UI.field('Masuk ke dompet', `<select name="walletId">${UI.walletOpts(localStorage.getItem('sa:lastWallet'))}</select>`)}${UI.field('Tanggal', `<input type="date" name="tanggal" value="${U.today()}">`)}</div>
      <label class="check"><input type="checkbox" name="npwp" ${Store.setting('punyaNpwp', 'true') !== 'false' ? 'checked' : ''}><span>Punya NPWP (tarif PPh 22 lebih rendah)</span></label>
      <div class="kv-list card" data-out></div>`, foot: `<button class="btn" data-ok>${I('check')} Catat penjualan</button>` });
    UI.bindRp(s.el);
    const calc = () => {
      const v = UI.formData(s.el), n = e.jumlah > 1 ? U.clamp(Math.round(Number(v.n) || 1), 1, e.jumlah) : 1;
      const frac = n / (e.jumlah || 1), gram = l.gramMurni * frac, bruto = Math.round(gram * v.hb);
      if (Store.setting('punyaNpwp', 'true') !== (v.npwp ? 'true' : 'false')) Store.setSetting('punyaNpwp', v.npwp ? 'true' : 'false');
      const pph = Calc.pphJual(bruto), net = bruto - pph, modal = Math.round(l.modal * frac);
      s.el.querySelector('[data-out]').innerHTML = `<div class="kv"><span>Nilai bruto</span><b>${U.rp(bruto)}</b></div><div class="kv"><span>PPh 22 ${pph ? '' : '(≤ Rp10 jt: tidak dipotong)'}</span><b>${pph ? '−' + U.rp(pph) : '0'}</b></div>
        <div class="kv"><span>Diterima bersih</span><b>${U.rp(net)}</b></div><div class="kv"><span>Untung / rugi vs modal</span><b class="${net - modal >= 0 ? 'ok' : 'bad'}">${net - modal >= 0 ? '+' : '−'}${U.rp(Math.abs(net - modal))}</b></div>`;
      return { n, frac, net, modal };
    };
    s.el.addEventListener('input', calc); s.el.addEventListener('change', calc); calc();
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el), r = calc(); if (!v.hb) return UI.toast('Isi harga buyback.', 'warn');
      const ops = [], now = new Date().toISOString();
      let soldId = e.id;
      if (r.n < e.jumlah) {
        soldId = U.uid('e');
        ops.push({ op: 'upsert', t: 'Emas', row: { id: e.id, jumlah: e.jumlah - r.n, hargaBeli: Math.round(e.hargaBeli * (1 - r.frac)), biaya: Math.round((e.biaya || 0) * (1 - r.frac)) } });
        ops.push({ op: 'upsert', t: 'Emas', row: Object.assign({}, e, { id: soldId, jumlah: r.n, hargaBeli: Math.round(e.hargaBeli * r.frac), biaya: Math.round((e.biaya || 0) * r.frac), status: 'terjual', tglJual: v.tanggal, hargaJual: r.net, dibuat: now }) });
      } else ops.push({ op: 'upsert', t: 'Emas', row: { id: e.id, status: 'terjual', tglJual: v.tanggal, hargaJual: r.net } });
      ops.push({ op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: v.tanggal, jenis: 'aset_jual', jumlah: r.net, kategoriId: '', walletId: v.walletId, walletTujuan: '', biaya: 0, catatan: 'Jual emas ' + g(e.gramKeping * r.n) + ' g', dibayarOleh: me(), tag: '', sumber: 'aset', refId: soldId, periodeRef: '', dicatatOleh: me(), dibuat: now, riwayat: [] } });
      Store.commit(ops); s.close(); UI.toast('Penjualan tercatat · ' + U.rp(r.net) + ' masuk ke dompet.');
    };
  }
  // ---------- Gadai & tebus ----------
  function gadaiForm(l) {
    const e = l.e;
    const s = UI.sheet({ title: 'Gadaikan emas', cls: 'small', body: `<p class="muted small">Emas ditandai "digadaikan" (tetap milik Anda) dan pinjamannya dicatat di Utang & Piutang.</p>
      <div class="grid2">${UI.field('Pinjaman diterima', UI.rpInput('pokok', Math.round(l.nilai * 0.85 / 100000) * 100000))}${UI.field('Pegadaian / lembaga', `<input name="pihak" value="Pegadaian">`)}</div>
      <div class="grid2">${UI.field('Sewa modal % / bulan', `<input type="number" step="0.01" name="sewa" value="1.2">`)}${UI.field('Jangka (bulan)', `<input type="number" name="tenor" min="1" value="4">`)}</div>
      ${UI.field('Uang masuk ke', `<select name="walletId">${UI.walletOpts()}</select>`)}`, foot: `<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el); if (!v.pokok) return UI.toast('Isi nilai pinjaman.', 'warn');
      const pid = U.uid('p'), now = new Date().toISOString(), tenor = Math.max(1, Number(v.tenor) || 4);
      Store.commit([
        { op: 'upsert', t: 'Pinjaman', row: { id: pid, arah: 'utang', jenis: 'gadai', pihak: v.pihak || 'Pegadaian', pokok: v.pokok, bunga: (Number(v.sewa) || 0) * 12, metode: 'flat', tenor, mulai: U.today(), tanggalBayar: 0, cicilan: 0, walletId: v.walletId, lunas: false, catatan: 'Gadai emas ' + g(l.gram) + ' g', dibuat: now } },
        { op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: U.today(), jenis: 'pinjam_terima', jumlah: v.pokok, kategoriId: '', walletId: v.walletId, walletTujuan: '', biaya: 0, catatan: 'Gadai emas ' + g(l.gram) + ' g', dibayarOleh: me(), tag: '', sumber: 'gadai', refId: pid, periodeRef: '', dicatatOleh: me(), dibuat: now, riwayat: [] } },
        { op: 'upsert', t: 'Emas', row: { id: e.id, status: 'gadai', pinjamanId: pid } }]);
      s.close(); UI.toast('Gadai tercatat. Jatuh tempo ' + U.tgl(U.addMonths(U.today(), tenor)) + '.');
    };
  }
  function tebusForm(l) {
    const e = l.e, p = Store.byId.Pinjaman[e.pinjamanId], bln = p ? Math.max(1, Math.ceil(U.diffDays(p.mulai, U.today()) / 30)) : 1;
    const tot = p ? Math.round(p.pokok * (1 + (p.bunga / 12 / 100) * bln)) : 0;
    const s = UI.sheet({ title: 'Tebus emas', cls: 'small', body: `${p ? `<p class="muted small">Pinjaman ${U.rp(p.pokok)} sejak ${U.tgl(p.mulai)} (${bln} bulan).</p>` : ''}
      ${UI.field('Total pelunasan', UI.rpInput('jumlah', tot))}${UI.field('Bayar dari', `<select name="walletId">${UI.walletOpts(p && p.walletId)}</select>`)}`, foot: `<button class="btn" data-ok>Tebus</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el), now = new Date().toISOString(), ops = [{ op: 'upsert', t: 'Emas', row: { id: e.id, status: 'simpan', pinjamanId: '' } }];
      if (p) {
        const cic = (Store.t.Kategori.find(k => /cicilan/i.test(k.nama) && k.jenis === 'keluar') || {}).id || '';
        ops.push({ op: 'upsert', t: 'Pinjaman', row: { id: p.id, lunas: true } });
        if (v.jumlah) ops.push({ op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: U.today(), jenis: 'keluar', jumlah: v.jumlah, kategoriId: cic, walletId: v.walletId, walletTujuan: '', biaya: 0, catatan: 'Tebus gadai emas', dibayarOleh: me(), tag: '', sumber: 'gadai', refId: p.id, periodeRef: U.today().slice(0, 7), dicatatOleh: me(), dibuat: now, riwayat: [] } });
      }
      Store.commit(ops); s.close(); UI.toast('Emas sudah ditebus.');
    };
  }

  // ---------- Harga: mode, manual, alert ----------
  UI.act('emas-refresh', async el => { el.disabled = true; await Harga.fetch(true); el.disabled = false; UI.toast(Calc.hargaEmas() ? 'Harga diperbarui.' : 'Harga belum tersedia.'); UI.render(); });
  UI.act('emas-mode', el => { Store.setSetting('hargaEmasMode', el.value); });
  UI.act('emas-manual', () => {
    const h = Calc.hargaEmas() || {};
    const s = UI.sheet({ title: 'Isi harga emas manual', cls: 'small', body: `<p class="muted small">Contoh sumber: logammulia.com (Antam) atau aplikasi Pegadaian. Harga per gram.</p>
      <div class="grid2">${UI.field('Harga beli / gram', UI.rpInput('beli', h.beli))}${UI.field('Harga buyback / gram', UI.rpInput('buyback', h.buyback))}</div>`, foot: `<button class="btn" data-ok>Simpan & pakai</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el); if (!v.beli || !v.buyback || v.buyback >= v.beli) return UI.toast('Isi harga beli & buyback (buyback lebih kecil).', 'warn');
      Store.commit([{ op: 'upsert', t: 'Pengaturan', row: { id: 'hargaEmasManual', nilai: JSON.stringify({ beli: v.beli, buyback: v.buyback, tanggal: U.today() }) } }, { op: 'upsert', t: 'Pengaturan', row: { id: 'hargaEmasMode', nilai: 'manual' } }]);
      s.close(); UI.toast('Harga manual dipakai.');
    };
  });
  UI.act('emas-alert', () => {
    let a = {}; try { a = JSON.parse(Store.setting('hargaAlert', '') || '{}'); } catch (e) {}
    const s = UI.sheet({ title: 'Peringatan harga', cls: 'small', body: `<p class="muted small">Muncul di Beranda & Brankas Emas saat harga menyentuh target.</p>
      ${UI.field('Ingatkan bila buyback ≥ (saat ingin jual)', UI.rpInput('jual', a.jual))}${UI.field('Ingatkan bila harga beli ≤ (saat ingin beli)', UI.rpInput('beli', a.beli))}`, foot: `<button class="btn ghost" data-off>Matikan</button><button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => { const v = UI.formData(s.el); Store.setSetting('hargaAlert', JSON.stringify({ jual: v.jual || 0, beli: v.beli || 0 })); s.close(); };
    s.el.querySelector('[data-off]').onclick = () => { Store.setSetting('hargaAlert', '{}'); s.close(); };
  });
  /** Peringatan harga yang sedang terpicu (dipakai Beranda). */
  UI.emasAlert = () => {
    const h = Calc.hargaEmas(); if (!h) return '';
    let a = {}; try { a = JSON.parse(Store.setting('hargaAlert', '') || '{}'); } catch (e) {}
    const msg = [];
    if (a.jual && h.buyback >= a.jual) msg.push('Buyback ' + U.rp(h.buyback) + '/g sudah ≥ target jual ' + U.rp(a.jual));
    if (a.beli && h.beli <= a.beli) msg.push('Harga beli ' + U.rp(h.beli) + '/g sudah ≤ target beli ' + U.rp(a.beli));
    return msg.length ? `<div class="alert info" data-act="go" data-to="emas/harga">${I('bell-ring')}<div><b>Peringatan harga emas</b><small>${msg.join(' · ')}</small></div>${I('chevron-right')}</div>` : '';
  };

  // ---------- Simulasi ----------
  UI.act('emas-geser', U.debounce(el => { Calc.geserHarga = Number(el.value) || 0; Calc.clear(); const o = document.getElementById('sim-emas'); if (o) o.innerHTML = simOut(); const lb = document.getElementById('geser-lb'); if (lb) lb.textContent = (Calc.geserHarga > 0 ? '+' : '') + Calc.geserHarga + '%'; }, 20));
  UI.act('emas-pilih', el => { S.pilih[el.dataset.id] = el.checked; const o = document.getElementById('sim-emas'); if (o) o.innerHTML = simOut(); });
  function simOut() {
    const h = Calc.hargaEmas(), sum = Calc.emasSummary(), lots = sum.lots.filter(l => l.e.status === 'simpan');
    const pilih = lots.filter(l => S.pilih[l.e.id]), set = pilih.length ? pilih : lots;
    const bruto = U.sum(set, l => l.nilai), pph = Calc.pphJual(bruto), modal = U.sum(set, l => l.modal);
    return `<div class="stat3"><div class="stat"><small>Buyback simulasi</small><b>${U.rpShort(h ? Math.round(h.buyback * (1 + Calc.geserHarga / 100)) : 0)}/g</b></div><div class="stat"><small>Nilai seluruh emas</small><b>${UI.ms(sum.nilai)}</b></div><div class="stat ${sum.untung >= 0 ? 'in' : 'out'}"><small>Untung/rugi</small><b>${sum.untung >= 0 ? '+' : '−'}${UI.ms(Math.abs(sum.untung))}</b></div></div>
      <div class="card kv-list"><div class="kv"><span>${pilih.length ? pilih.length + ' koleksi dipilih' : 'Jika semua dijual'} · ${g(U.sum(set, l => l.gram))} g</span><b>${U.rp(bruto)}</b></div>
        <div class="kv"><span>PPh 22 (${Store.setting('punyaNpwp', 'true') !== 'false' ? 'NPWP' : 'tanpa NPWP'})</span><b>${pph ? '−' + U.rp(pph) : 'tidak dipotong'}</b></div>
        <div class="kv"><span>Diterima bersih</span><b>${U.rp(bruto - pph)}</b></div><div class="kv"><span>Untung vs modal ${U.rp(modal)}</span><b class="${bruto - pph - modal >= 0 ? 'ok' : 'bad'}">${bruto - pph - modal >= 0 ? '+' : '−'}${U.rp(Math.abs(bruto - pph - modal))}</b></div></div>`;
  }

  // ---------- Halaman ----------
  const TILES = cur => UI.tiles([
    { id: '', icon: 'gem', label: 'Ringkasan', to: 'emas', gold: true }, { id: 'koleksi', icon: 'layers', label: 'Koleksi', to: 'emas/koleksi', gold: true },
    { id: 'harga', icon: 'trending-up', label: 'Harga & Alert', to: 'emas/harga', gold: true }, { id: 'simulasi', icon: 'calculator', label: 'Simulasi Jual', to: 'emas/simulasi', gold: true },
    { id: 'beli', icon: 'circle-plus', label: 'Catat Beli', act: 'emas-beli', gold: true }, { id: 'zakat', icon: 'hand-heart', label: 'Zakat Emas', to: 'zakat', gold: true },
    { id: 'tujuan', icon: 'target', label: 'Tujuan', to: 'tujuan', gold: true }, { id: 'alok', icon: 'scale', label: 'Alokasi', to: 'investasi/alokasi', gold: true }
  ], cur);
  const priceChip = h => h ? `<div class="price-chip ${h.basi ? 'stale' : ''}">${I(h.mode === 'manual' ? 'pencil' : 'radio')}<span>Beli <b>${U.rpShort(h.beli)}</b> · Buyback <b>${U.rpShort(h.buyback)}</b> /g</span><small>${U.tgl(h.tanggal, 'dm')}${h.basi ? ' · perlu diperbarui' : ''}</small></div>`
    : `<div class="alert warn" data-act="emas-manual">${I('triangle-alert')}<div><b>Harga emas belum tersedia</b><small>Ketuk untuk mengisi harga manual sementara.</small></div></div>`;
  const lotRow = l => `<div class="row" data-act="emas-open" data-id="${l.e.id}"><span class="cat-ic gold">${I(l.e.bentuk === 'perhiasan' ? 'sparkles' : l.e.bentuk === 'digital' ? 'smartphone' : 'gem')}</span>
    <div class="tx-txt"><b>${l.e.jumlah > 1 ? l.e.jumlah + ' × ' : ''}${g(l.e.gramKeping)} g ${U.esc(l.e.bentuk === 'perhiasan' ? 'Perhiasan ' + l.e.kadar + 'K' : l.e.merek)}${l.e.status === 'gadai' ? ' ' + UI.pill('Gadai', 'bad') : l.e.status === 'terjual' ? ' ' + UI.pill('Terjual', '') : ''}</b>
    <small>${U.tgl(l.e.tanggal, 'mys')} · ${U.esc(UI.ownLabel(l.e.kepemilikan))}${l.e.tujuanId && Store.byId.Tujuan[l.e.tujuanId] ? ' · ' + U.esc(Store.byId.Tujuan[l.e.tujuanId].nama) : ''}</small></div>
    <div class="tx-amt"><b>${UI.ms(l.nilai)}</b><small class="${l.untung >= 0 ? 'ok' : 'bad'}">${l.e.status === 'terjual' ? 'realisasi ' : ''}${l.untung >= 0 ? '+' : '−'}${U.pct(Math.abs(l.pct), 1)}</small></div></div>`;

  UI.page('emas', {
    head: p => ({ title: { koleksi: 'Koleksi Emas', harga: 'Harga & Peringatan', simulasi: 'Simulasi Jual' }[p] || 'Brankas Emas', crumb: p ? 'Brankas Emas' : 'Aset', back: p ? 'emas' : 'aset',
      right: `<button class="icon-btn" data-act="emas-beli" aria-label="Catat emas">${I('plus')}</button>` }),
    nav: () => 'aset',
    render(p) {
      if (!Store.can('aset', 'lihat')) return UI.empty('lock', 'Tidak ada akses', 'Minta Admin memberi izin menu Aset.');
      Harga.fetch();
      const h = Calc.hargaEmas(), sum = Calc.emasSummary();
      if (p === 'koleksi') {
        const sold = Calc.emasLots(true).filter(l => l.e.status === 'terjual');
        return TILES('koleksi') + priceChip(h) + `<div class="card list">${sum.lots.map(lotRow).join('') || UI.empty('gem', 'Belum ada emas', 'Catat emas yang sudah dimiliki atau yang baru dibeli.', `<button class="btn" data-act="emas-beli">${I('plus')} Catat emas</button>`)}</div>
          ${sold.length ? UI.sec('Sudah dijual', `<small class="muted">realisasi ${sum.realisasi >= 0 ? '+' : '−'}${UI.ms(Math.abs(sum.realisasi))}</small>`) + `<div class="card list">${sold.map(lotRow).join('')}</div>` : ''}<div class="spacer"></div>`;
      }
      if (p === 'harga') {
        let a = {}; try { a = JSON.parse(Store.setting('hargaAlert', '') || '{}'); } catch (e) {}
        const rw = h && h.riwayat ? h.riwayat.slice(-90) : [];
        const pts = rw.map(r => ({ d: r[0], bal: r[2] }));
        const ch = rw.length > 1 ? rw[rw.length - 1][2] - rw[Math.max(0, rw.length - 31)][2] : 0;
        return TILES('harga') + `${UI.emasAlert()}
          <div class="card"><div class="row-sp"><div><small class="muted">Harga beli / gram</small><h3>${h ? U.rp(h.beli) : '—'}</h3></div><div class="r"><small class="muted">Buyback / gram</small><h3>${h ? U.rp(h.buyback) : '—'}</h3></div></div>
            ${h ? `<small class="muted">Selisih beli–buyback ${U.rp(h.beli - h.buyback)} (${U.pct((h.beli - h.buyback) / h.beli, 1)}) · ${U.esc(h.sumber)} · ${U.tgl(h.tanggal)}</small>` : ''}
            ${pts.length > 2 ? `<h4 class="mini-h">Buyback ${pts.length} hari terakhir <small class="${ch >= 0 ? 'ok' : 'bad'}">${ch >= 0 ? '▲' : '▼'} ${U.rp(Math.abs(ch))} / 30 hari</small></h4>${Charts.line(pts, { fit: true, aria: 'Riwayat harga buyback' })}` : ''}
            <div class="row-btns"><button class="btn ghost sm" data-act="emas-refresh">${I('refresh-cw')} Perbarui</button><button class="btn ghost sm" data-act="emas-manual">${I('pencil')} Isi manual</button></div></div>
          ${(() => { const ml = Calc.hargaMerekList(); return ml.length ? `${UI.sec('Merek lain', '<small class="muted">harga per gram (1 g) · galeri24.co.id</small>')}<div class="card"><table class="tbl merek"><thead><tr><th>Merek</th><th>Beli</th><th>Buyback</th></tr></thead><tbody>${ml.map(x => `<tr><td>${U.esc(x.nama)}</td><td>${U.rp(x.beli)}</td><td>${U.rp(x.buyback)}</td></tr>`).join('')}</tbody></table>
            <small class="muted">Dipakai otomatis untuk keping bermerek sama. Antam selalu mengikuti logammulia.com; perhiasan & merek lain memakai harga Antam × kadar.</small></div>` : ''; })()}
          <div class="card">${UI.field('Sumber harga yang dipakai', `<select data-change="emas-mode"><option value="otomatis" ${Store.setting('hargaEmasMode', 'otomatis') !== 'manual' ? 'selected' : ''}>Otomatis (harian, dari JuniorLabs)</option><option value="manual" ${Store.setting('hargaEmasMode', '') === 'manual' ? 'selected' : ''}>Manual (isian keluarga)</option></select>`, 'Antam mengikuti logammulia.com; UBS, Galeri24, Lotus Archi & Emaskita mengikuti galeri24.co.id. Isian manual hanya mengganti harga Antam.')}</div>
          <div class="card"><div class="row-sp"><b>${I('bell')} Peringatan harga</b><button class="link" data-act="emas-alert">Atur</button></div>
            <small class="muted">${a.jual ? 'Jual bila buyback ≥ ' + U.rp(a.jual) : 'Target jual belum diatur'} · ${a.beli ? 'beli bila ≤ ' + U.rp(a.beli) : 'target beli belum diatur'}</small></div>
          <div class="card"><b>${I('receipt')} Pajak jual-beli emas</b>
            <p class="small">${UI.field('Tarif PPh 22 buyback (punya NPWP / tanpa NPWP)', `<div class="grid2"><input type="number" step="0.01" data-set="pphNpwp" value="${Store.setting('pphNpwp', 1.5)}"><input type="number" step="0.01" data-set="pphNonNpwp" value="${Store.setting('pphNonNpwp', 3)}"></div>`, 'Dipotong bila nilai jual di atas Rp10 juta. Periksa aturan terbaru di Butik/Pegadaian; tarif bisa berubah.')}</p></div><div class="spacer"></div>`;
      }
      if (p === 'simulasi') {
        return TILES('simulasi') + priceChip(h) + `
          <div class="card sliders"><label><span>Geser harga buyback <b id="geser-lb">${(Calc.geserHarga > 0 ? '+' : '') + Calc.geserHarga}%</b></span><input type="range" min="-25" max="40" step="1" value="${Calc.geserHarga}" data-input="emas-geser"></label>
            <small class="muted">Coba: "bagaimana bila harga naik 10%?"</small></div>
          <div id="sim-emas">${simOut()}</div>
          ${UI.sec('Pilih koleksi yang ingin dijual', '<small class="muted">kosong = semua</small>')}
          <div class="card list">${sum.lots.filter(l => l.e.status === 'simpan').map(l => `<label class="row"><input type="checkbox" data-change="emas-pilih" data-id="${l.e.id}" ${S.pilih[l.e.id] ? 'checked' : ''}><div class="tx-txt"><b>${l.e.jumlah > 1 ? l.e.jumlah + ' × ' : ''}${g(l.e.gramKeping)} g ${U.esc(l.e.bentuk === 'perhiasan' ? 'Perhiasan' : l.e.merek)}</b><small>Modal ${U.rpShort(l.modal)}</small></div><b>${UI.ms(l.nilai)}</b></label>`).join('')}</div><div class="spacer"></div>`;
      }
      if (!sum.lots.length && !Store.t.Emas.length) return TILES('') + priceChip(h) + UI.empty('gem', 'Brankas Emas masih kosong', 'Catat emas batangan, perhiasan, atau tabungan emas keluarga. Nilainya diperbarui otomatis mengikuti harga harian.', `<button class="btn" data-act="emas-beli">${I('plus')} Catat emas pertama</button>`);
      const akum = Calc.emasAkumulasi(), pem = Object.keys(sum.perPemilik), gr = Object.keys(sum.perGramasi).sort((a, b) => a - b);
      const belum = sum.lots.filter(l => l.e.zakat && !l.haul);
      return `
        <section class="hero card-gold"><div class="hero-top"><small>Total emas keluarga</small><button class="icon-btn on-dark" data-act="toggle-hide">${I(UI.hide() ? 'eye-off' : 'eye')}</button></div>
          <div class="hero-amt">${g(sum.gram)} <small>gram</small></div>
          <div class="hero-split"><div><small>Nilai buyback</small><b>${UI.ms(sum.nilai)}</b></div><div><small>Untung/rugi</small><b>${sum.untung >= 0 ? '+' : '−'}${UI.ms(Math.abs(sum.untung))} · ${U.pct(sum.pct, 1)}</b></div></div>
          <small>Modal ${UI.ms(sum.modal)} · rata-rata ${U.rpShort(sum.rata)}/g${sum.realisasi ? ' · sudah direalisasi ' + (sum.realisasi >= 0 ? '+' : '−') + UI.ms(Math.abs(sum.realisasi)) : ''}</small></section>
        ${priceChip(h)}${UI.emasAlert()}${TILES('')}
        ${sum.gadai.length ? `<div class="alert warn" data-act="go" data-to="emas/koleksi">${I('landmark')}<div><b>${sum.gadai.length} koleksi sedang digadaikan</b><small>${g(U.sum(sum.gadai, l => l.gram))} g · tebus dari detail koleksi.</small></div>${I('chevron-right')}</div>` : ''}
        ${gr.length ? UI.sec('Keping per gramasi') + `<div class="keping">${gr.map(k => `<div><b>${sum.perGramasi[k]}</b><small>× ${String(k).replace('.', ',')} g</small></div>`).join('')}</div>` : ''}
        ${UI.sec('Kepemilikan')}<div class="card list">${pem.map(k => `<div class="row"><span class="avatar xs" style="background:${k === 'bersama' ? '#476364' : (Store.member(k) || {}).warna || '#5b7a78'}">${k === 'bersama' ? I('users') : U.esc(U.initials(Store.memberName(k)))}</span><div class="grow"><div class="row-sp"><b>${k === 'bersama' ? 'Bersama' : U.esc(Store.memberName(k))}</b><b>${g(sum.perPemilik[k].gram)} g</b></div>${UI.bar(sum.gram ? sum.perPemilik[k].gram / sum.gram : 0, 'aman')}<small class="muted">${UI.ms(sum.perPemilik[k].nilai)}</small></div></div>`).join('')}</div>
        ${akum.length > 1 ? UI.sec('Tren akumulasi') + `<div class="card">${Charts.line(akum, { fit: false, fmt: 'mys', aria: 'Akumulasi gram emas' })}<small class="muted">Total gram dari waktu ke waktu (pembelian & penjualan).</small></div>` : ''}
        ${UI.sec('Per merek')}<div class="card list">${Object.keys(sum.perMerek).map(m => `<div class="row"><div class="tx-txt"><b>${U.esc(m)}</b></div><b>${g(sum.perMerek[m])} g</b></div>`).join('')}</div>
        ${belum.length ? `<div class="note">${I('moon-star')} ${belum.length} koleksi belum genap 1 tahun Hijriah (haul) — tetap dihitung dalam total harta zakat bila haul keluarga sudah tiba.</div>` : ''}
        <div class="spacer"></div>`;
    },
    after(view) {
      view.querySelectorAll('[data-set]').forEach(i => i.onchange = () => Store.setSetting(i.dataset.set, String(Number(i.value) || 0)));
    }
  });
})();
