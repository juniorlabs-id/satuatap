/* Konsol JuniorLabs — khusus superadmin: kelola lisensi, buat kode, lihat laporan masuk. */
(function () {
  const I = UI.icon;
  const K = { data: null, at: 0, loading: false, q: '', st: '', baru: [] };
  const ST = { baru: ['Belum dipakai', ''], aktif: ['Aktif', 'ok'], habis: ['Berakhir', 'bad'], segera: ['≤ 14 hari', 'warn'], dicabut: ['Dicabut', 'bad'], terpakai: ['Terpakai', ''] };
  const OST = { menunggu: ['Menunggu', 'warn'], lunas: ['Lunas', 'ok'], batal: ['Batal', 'bad'] };
  const stOf = L => L.status === 'aktif' && L.kedaluwarsa ? 'habis' : L.status === 'aktif' && L.sisaHari != null && L.sisaHari <= 14 ? 'segera' : L.status;
  const appUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '');
  const waKe = (no, t) => window.open('https://wa.me/' + String(no || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
  const berlakuTeks = L => L.berlakuSampai ? (L.kedaluwarsa ? 'berakhir ' : 's.d. ') + U.tgl(L.berlakuSampai) : (Number(L.masa) > 0 ? L.masa + ' bln sejak aktivasi' : 'selamanya');

  async function load(force) {
    if (K.loading || (!force && K.data && Date.now() - K.at < 60000)) return;
    K.loading = true;
    const r = await Relay.call('konsol.ringkas', {});
    K.loading = false;
    if (r.success) { K.data = r.data; K.at = Date.now(); } else UI.toast(r.message || 'Gagal memuat konsol.', 'error');
    if (UI.cur === 'konsol') UI.render();
  }
  const salin = async (t, msg) => { try { await navigator.clipboard.writeText(t); UI.toast(msg || 'Disalin.'); } catch (e) { prompt('Salin:', t); } };
  const pesanKode = (o, kode, L) => o.perpanjang
    ? `Halo ${o.nama}, pembayaran perpanjangan SatuAtap ${o.paketNama || ''} (pesanan ${o.id}) sudah kami terima. Terima kasih! 🙏\n\nLisensi ${kode} kini berlaku ${L && L.berlakuSampai ? 'sampai ' + U.tgl(L.berlakuSampai) : 'selamanya'}.\nBila di aplikasi belum berubah: Lainnya › Langganan › Periksa ulang status.`
    : `Halo ${o.nama}, pembayaran SatuAtap ${o.paketNama || ''} (pesanan ${o.id}) sudah kami terima. Terima kasih! 🏠\n\nKode lisensi: ${kode}\n\n1) Buka ${appUrl()}\n2) Masuk dengan Google (${o.email})\n3) Pilih "Buat data keluarga baru" & masukkan kode di atas.\n\nPanduan & bantuan: wa.me/${APP_CONFIG.SUPPORT_WA}`;
  const pesanWA = kode => `Terima kasih sudah membeli SatuAtap 🏠\n\nKode lisensi: ${kode}\n\n1) Buka ${location.origin + location.pathname}\n2) Masuk dengan Google\n3) Pilih "Buat data keluarga baru" & masukkan kode di atas.\n\nPanduan & bantuan: wa.me/${APP_CONFIG.SUPPORT_WA}`;

  UI.act('ks-reload', () => load(true));
  UI.act('ks-filter', el => { K.st = K.st === el.dataset.v ? '' : el.dataset.v; UI.render(); });
  UI.act('ks-q', U.debounce(el => { K.q = el.value.trim().toLowerCase(); const b = document.getElementById('ks-list'); if (b) b.innerHTML = listHtml(); }, 200));
  UI.act('ks-copy', el => salin(el.dataset.v, 'Kode disalin.'));
  UI.act('ks-copyall', () => salin(K.baru.join('\n'), K.baru.length + ' kode disalin.'));
  UI.act('ks-wa', el => window.open('https://wa.me/?text=' + encodeURIComponent(pesanWA(el.dataset.v)), '_blank', 'noopener'));
  UI.act('ks-buat', async el => {
    const f = UI.formData(document.getElementById('ks-form'));
    const n = U.clamp(Number(f.jumlah) || 1, 1, 50);
    el.disabled = true;
    const r = await Relay.call('konsol.buat', { jumlah: n, catatan: f.catatan, paket: f.paket });
    el.disabled = false;
    if (!r.success) return UI.toast(r.message || 'Gagal.', 'error');
    K.baru = r.data.kode; K.at = 0; UI.toast(r.message); UI.render(); load(true);
  });
  UI.act('ks-open', el => {
    const L = ((K.data && K.data.lisensi) || []).find(x => x.kode === el.dataset.v); if (!L) return;
    const st = ST[stOf(L)] || [L.status, ''], paket = (K.data.toko && K.data.toko.paket) || [];
    const selamanya = !L.berlakuSampai && !(Number(L.masa) > 0);
    const s = UI.sheet({ title: L.kode, body: `
      <div class="kv-list">
        <div class="kv"><span>Status</span><b>${UI.pill(st[0], st[1])}</b></div>
        <div class="kv"><span>Paket</span><b>${U.esc(L.paketNama || 'Lifetime')} · ${U.esc(berlakuTeks(L))}${L.sisaHari != null && !L.kedaluwarsa ? ' (' + L.sisaHari + ' hari)' : ''}</b></div>
        <div class="kv"><span>Admin</span><b>${U.esc(L.emailAdmin || '—')}</b></div>
        <div class="kv"><span>Anggota</span><b>${L.anggota.length ? L.anggota.map(U.esc).join('<br>') : '—'}</b></div>
        <div class="kv"><span>Dibuat</span><b>${L.dibuat ? U.tgl(L.dibuat.slice(0, 10)) : '—'}</b></div>
        <div class="kv"><span>Diaktifkan</span><b>${L.diaktifkan ? U.tgl(L.diaktifkan.slice(0, 10)) : '—'}</b></div>
        <div class="kv"><span>Cek terakhir</span><b>${L.cekTerakhir ? U.timeAgo(L.cekTerakhir) : '—'}</b></div></div>
      ${L.status !== 'terpakai' ? `<h4 class="mini-h">Perpanjang cepat</h4>
      <div class="chips">${[1, 3, 6, 12].map(n => `<button class="chip" data-a="perpanjang" data-b="${n}">+${n} bln</button>`).join('')}<button class="chip" data-a="perpanjang" data-b="0">${I('badge-check')} Jadikan Lifetime</button></div>` : ''}
      <h4 class="mini-h">Data pelanggan</h4>
      <div class="grid2">${UI.field('Nama pelanggan', `<input name="nama" maxlength="60" value="${U.esc(L.nama || '')}">`)}${UI.field('WhatsApp', `<input name="wa" inputmode="tel" value="${U.esc(L.wa || '')}" placeholder="62812…">`)}</div>
      <div class="grid2">${UI.field('Paket', `<select name="paket"><option value="">—</option>${paket.map(p => `<option value="${U.esc(p.id)}" ${p.id === L.paket ? 'selected' : ''}>${U.esc(p.nama)}</option>`).join('')}</select>`)}
        ${L.diaktifkan || L.berlakuSampai ? UI.field('Berlaku sampai (kosong = selamanya)', `<input type="date" name="berlakuSampai" value="${U.esc(L.berlakuSampai || '')}">`) : UI.field('Masa (bulan, 0 = selamanya)', `<input type="number" name="masa" min="0" max="120" value="${Number(L.masa) || 0}">`)}</div>
      <div class="grid2">${UI.field('Batas akun keluarga', `<input type="number" name="maksAkun" min="1" max="20" value="${L.maksAkun || 5}">`)}${L.fileId ? UI.field('Nama keluarga', `<input name="keluarga" maxlength="60" value="${U.esc(L.keluarga || '')}">`) : '<span></span>'}</div>
      ${UI.field('Catatan (mis. no. pesanan)', `<input name="catatan" maxlength="120" value="${U.esc(L.catatan)}">`)}
      <button class="btn block" data-a="pelanggan">${I('save')} Simpan data pelanggan</button>
      <div class="chips" style="margin-top:12px"><button class="chip" data-a="copy">${I('copy')} Salin kode</button><button class="chip" data-a="wa">${I('message-circle')} Kirim kode via WA</button>
        ${L.wa ? `<button class="chip" data-a="chat">${I('message-circle')} Chat pelanggan</button>` : ''}
        ${L.wa && !selamanya && L.fileId ? `<button class="chip" data-a="ingat">${I('bell')} Ingatkan perpanjang</button>` : ''}</div>`,
      foot: `${L.status === 'dicabut' ? `<button class="btn" data-a="pulihkan">${I('rotate-ccw')} Pulihkan</button>` : `<button class="btn ghost danger" data-a="cabut">${I('ban')} Cabut</button>`}
        ${L.fileId ? `<button class="btn ghost" data-a="lepas">${I('unlink')} Lepas ikatan</button>` : ''}` });
    const val = n => { const e = s.el.querySelector('[name=' + n + ']'); return e ? e.value : undefined; };
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'copy') return salin(L.kode, 'Kode disalin.');
      if (a === 'wa') return L.wa ? waKe(L.wa, pesanWA(L.kode)) : window.open('https://wa.me/?text=' + encodeURIComponent(pesanWA(L.kode)), '_blank', 'noopener');
      if (a === 'chat') return waKe(L.wa, `Halo ${L.nama || ''}, ini JuniorLabs (SatuAtap). `);
      if (a === 'ingat') return waKe(L.wa, `Halo ${L.nama || ''} 🙏 Langganan SatuAtap ${L.keluarga || ''} ${L.kedaluwarsa ? 'sudah berakhir ' : 'akan berakhir '}${U.tgl(L.berlakuSampai)}.\n\nPerpanjang di sini (kode lisensi sudah terisi):\n${appUrl()}beli/?perpanjang=${L.kode}#harga\n\nData keluarga tetap aman di Google Drive Anda.`);
      const msg = { cabut: ['Cabut lisensi?', `Keluarga ${L.keluarga || ''} tidak bisa memakai aplikasi sampai dipulihkan. Data mereka tetap aman di Drive mereka.`],
        lepas: ['Lepas ikatan?', 'Kode bisa diaktifkan ulang oleh akun Google lain / file baru (mis. pembeli ganti akun). Keluarga lama otomatis tidak aktif.'],
        perpanjang: b.dataset.b === '0' ? ['Jadikan Lifetime?', 'Lisensi ini tidak akan pernah berakhir.'] : null }[a];
      if (msg && !(await UI.confirm(msg[0], msg[1], 'Ya, lanjutkan', a !== 'perpanjang'))) return;
      const data = { kode: L.kode, aksi: a, catatan: val('catatan') };
      if (a === 'perpanjang') data.bulan = Number(b.dataset.b);
      if (a === 'pelanggan') {
        data.ubah = { nama: val('nama'), wa: val('wa'), catatan: val('catatan'), paket: val('paket'), maksAkun: val('maksAkun') };
        if (val('keluarga') !== undefined) data.ubah.keluarga = val('keluarga');
        if (val('berlakuSampai') !== undefined) data.ubah.berlakuSampai = val('berlakuSampai');
        if (val('masa') !== undefined) data.ubah.masa = val('masa');
      }
      b.disabled = true;
      const r = await Relay.call('konsol.ubah', data);
      b.disabled = false;
      if (!r.success) return UI.toast(r.message || 'Gagal.', 'error');
      s.close(); UI.toast(a === 'perpanjang' ? 'Masa berlaku diperbarui.' : (r.message || 'Tersimpan.')); load(true);
    });
  });

  // ---------- Pesanan ----------
  UI.act('ks-ofilter', el => { K.ost = K.ost === el.dataset.v ? '' : el.dataset.v; UI.render(); });
  UI.act('ks-oopen', el => {
    const o = ((K.data && K.data.pesanan) || []).find(x => x.id === el.dataset.v); if (!o) return;
    const st = OST[o.status] || [o.status, ''];
    const s = UI.sheet({ title: 'Pesanan ' + o.id, body: `
      <div class="kv-list">
        <div class="kv"><span>Status</span><b>${UI.pill(st[0], st[1])}</b></div>
        <div class="kv"><span>Paket</span><b>${U.esc(o.paketNama || o.paket)} · ${U.rp(Number(o.harga))}</b></div>
        ${o.perpanjang ? `<div class="kv"><span>Perpanjang</span><b><code>${U.esc(o.perpanjang)}</code></b></div>` : ''}
        <div class="kv"><span>Nama</span><b>${U.esc(o.nama)}</b></div>
        <div class="kv"><span>Email Google</span><b>${U.esc(o.email)}</b></div>
        <div class="kv"><span>WhatsApp</span><b>${U.esc(o.wa)}</b></div>
        ${o.keluarga ? `<div class="kv"><span>Keluarga</span><b>${U.esc(o.keluarga)}</b></div>` : ''}
        <div class="kv"><span>Dipesan</span><b>${U.tgl(o.tanggal.slice(0, 10))} · ${U.timeAgo(o.tanggal)}</b></div>
        ${o.kode ? `<div class="kv"><span>Kode lisensi</span><b><code>${U.esc(o.kode)}</code></b></div>` : ''}
        ${o.diproses ? `<div class="kv"><span>Diproses</span><b>${U.timeAgo(o.diproses)}</b></div>` : ''}</div>
      ${UI.field('Catatan internal', `<input name="catatan" maxlength="200" value="${U.esc(o.catatan || '')}">`)}
      <div class="chips"><button class="chip" data-a="chat">${I('message-circle')} Chat pembeli</button><button class="chip" data-a="catatan">${I('save')} Simpan catatan</button>
        ${o.kode ? `<button class="chip" data-a="kirim">${I('send')} Kirim ${o.perpanjang ? 'konfirmasi' : 'kode'} via WA</button><button class="chip" data-a="copy">${I('copy')} Salin kode</button>` : ''}</div>
      ${o.status === 'menunggu' ? `<p class="muted small">Cocokkan bukti transfer di WhatsApp dengan nominal ${U.rp(Number(o.harga))} sebelum menandai lunas.</p>` : ''}`,
      foot: o.status === 'menunggu' ? `<button class="btn ghost danger" data-a="batal">${I('x')} Batalkan</button><button class="btn" data-a="lunas">${I('circle-check')} Lunas & ${o.perpanjang ? 'perpanjang' : 'buat kode'}</button>`
        : o.status === 'batal' ? `<button class="btn ghost" data-a="menunggu">${I('rotate-ccw')} Kembalikan ke menunggu</button>` : '' });
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'chat') return waKe(o.wa, `Halo ${o.nama}, ini JuniorLabs terkait pesanan SatuAtap ${o.id}. `);
      if (a === 'copy') return salin(o.kode, 'Kode disalin.');
      if (a === 'kirim') { const L = ((K.data && K.data.lisensi) || []).find(x => x.kode === o.kode); return waKe(o.wa, pesanKode(o, o.kode, L)); }
      if (a === 'lunas' && !(await UI.confirm('Tandai lunas?', o.perpanjang ? `Lisensi ${o.perpanjang} diperpanjang sesuai paket ${o.paketNama}.` : `Kode lisensi ${o.paketNama} dibuat untuk ${o.nama}.`, 'Ya, lunas'))) return;
      if (a === 'batal' && !(await UI.confirm('Batalkan pesanan?', 'Pembeli tidak menerima kode.', 'Batalkan', true))) return;
      b.disabled = true;
      const r = await Relay.call('konsol.pesanan', { id: o.id, aksi: a, catatan: s.el.querySelector('[name=catatan]').value });
      b.disabled = false;
      if (!r.success) return UI.toast(r.message || 'Gagal.', 'error');
      s.close(); UI.toast(r.message || 'Tersimpan.', 'ok'); load(true);
      if (a === 'lunas' && r.data && r.data.kode) {
        const o2 = Object.assign({}, o, r.data);
        const s2 = UI.sheet({ title: o.perpanjang ? 'Lisensi diperpanjang' : 'Kode lisensi dibuat', body: `<div class="empty">${I('circle-check', 'big')}<h3><code>${U.esc(r.data.kode)}</code></h3><p>${o.perpanjang ? 'Berlaku ' + (r.data.lisensi && r.data.lisensi.berlakuSampai ? 'sampai ' + U.tgl(r.data.lisensi.berlakuSampai) : 'selamanya') : 'Paket ' + U.esc(o.paketNama) + ' untuk ' + U.esc(o.nama)}</p></div>`,
          foot: `<button class="btn ghost" data-b="copy">${I('copy')} Salin</button><button class="btn" data-b="wa">${I('send')} Kirim ke WA pembeli</button>` });
        s2.el.querySelector('[data-b=copy]').onclick = () => salin(r.data.kode, 'Kode disalin.');
        s2.el.querySelector('[data-b=wa]').onclick = () => { waKe(o.wa, pesanKode(o2, r.data.kode, r.data.lisensi)); s2.close(); };
      }
    });
  });
  function pesananHtml() {
    const all = (K.data && K.data.pesanan) || [], bln = U.today().slice(0, 7);
    const lunasBln = all.filter(o => o.status === 'lunas' && (o.diproses || o.tanggal).slice(0, 7) === bln);
    const rows = all.filter(o => (!K.ost || o.status === K.ost) && (!K.q || (o.id + ' ' + o.nama + ' ' + o.email + ' ' + o.wa + ' ' + o.kode).toLowerCase().indexOf(K.q) > -1));
    return `<div class="stat3"><div class="stat ${all.some(o => o.status === 'menunggu') ? 'out' : ''}"><small>Menunggu</small><b>${all.filter(o => o.status === 'menunggu').length}</b></div><div class="stat ok"><small>Lunas bln ini</small><b>${lunasBln.length}</b></div><div class="stat"><small>Omzet bln ini</small><b>${UI.m(U.sum(lunasBln, o => Number(o.harga)))}</b></div></div>
      <div class="search">${I('search')}<input type="search" placeholder="Cari no. pesanan, nama, email, WA…" value="${U.esc(K.q)}" data-input="ks-oq"></div>
      <div class="chips">${Object.keys(OST).map(k => `<button class="chip ${K.ost === k ? 'on' : ''}" data-act="ks-ofilter" data-v="${k}">${OST[k][0]}</button>`).join('')}</div>
      <div class="card list" id="ks-olist">${rows.slice(0, 300).map(o => { const st = OST[o.status] || [o.status, '']; return `<div class="row" data-act="ks-oopen" data-v="${U.esc(o.id)}">
        <span class="cat-ic ${o.status === 'lunas' ? 'ok' : o.status === 'batal' ? 'bad' : ''}">${I(o.perpanjang ? 'refresh-cw' : 'receipt')}</span>
        <div class="tx-txt"><b>${U.esc(o.nama)}</b><small>${U.esc(o.id)} · ${U.esc(o.paketNama || o.paket)}${o.perpanjang ? ' · perpanjang' : ''}</small><small>${U.timeAgo(o.tanggal)}</small></div>
        <div class="r"><b>${U.rp(Number(o.harga))}</b>${UI.pill(st[0], st[1])}</div></div>`; }).join('') || '<div class="row muted">Belum ada pesanan.</div>'}</div>
      <p class="muted small">Pesanan masuk dari halaman beli (${U.esc(appUrl())}beli/). Pembeli mengirim bukti transfer lewat WhatsApp; tandai lunas setelah dicek. Bila Telegram superadmin terhubung, setiap pesanan baru juga dikabarkan ke bot.</p>`;
  }
  UI.act('ks-oq', U.debounce(el => { K.q = el.value.trim().toLowerCase(); UI.render(); setTimeout(() => { const i = document.querySelector('[data-input=ks-oq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, 300));

  // ---------- Toko & Harga ----------
  let T = null;
  const tokoDraft = () => T || (T = JSON.parse(JSON.stringify(K.data.toko)), T.paket.forEach(p => { p._ada = 1; }), T);
  const bacaToko = () => {
    const f = document.getElementById('ks-toko'); if (!f) return;
    const t = tokoDraft();
    t.buka = f.querySelector('[name=buka]').checked; t.promo = f.querySelector('[name=promo]').value; t.wa = f.querySelector('[name=wa]').value;
    t.batasJam = f.querySelector('[name=batasJam]').value; t.catatanBayar = f.querySelector('[name=catatanBayar]').value; t.qris = f.querySelector('[name=qris]').value.trim();
    f.querySelectorAll('[data-pk]').forEach((el, i) => { const p = t.paket[i]; ['id', 'nama', 'masa', 'harga', 'coret', 'sub'].forEach(k => { const e = el.querySelector('[name=' + k + ']'); p[k] = ['masa', 'harga', 'coret'].indexOf(k) > -1 ? (String(e.value).replace(/\D/g, '')) : e.value; });
      p.aktif = el.querySelector('[name=aktif]').checked; p.unggulan = el.querySelector('[name=unggulan]').checked; });
    t.bayar = Array.from(f.querySelectorAll('[data-by]')).map(el => ({ jenis: el.querySelector('[name=jenis]').value, nama: el.querySelector('[name=nama]').value, nomor: el.querySelector('[name=nomor]').value, atasNama: el.querySelector('[name=atasNama]').value }));
  };
  UI.act('ks-tk-pk-add', () => { bacaToko(); const t = tokoDraft(); if (t.paket.length >= 6) return UI.toast('Maksimal 6 paket.', 'warn'); t.paket.push({ id: 'p' + (t.paket.length + 1), nama: 'Paket baru', masa: 3, harga: 30000, coret: 0, sub: '', aktif: false }); UI.render(); });
  UI.act('ks-tk-pk-del', el => { bacaToko(); const t = tokoDraft(); if (t.paket.length <= 1) return UI.toast('Minimal satu paket.', 'warn'); t.paket.splice(Number(el.dataset.i), 1); UI.render(); });
  UI.act('ks-tk-by-add', () => { bacaToko(); const t = tokoDraft(); if (t.bayar.length >= 8) return; t.bayar.push({ jenis: 'Bank', nama: '', nomor: '', atasNama: '' }); UI.render(); });
  UI.act('ks-tk-by-del', el => { bacaToko(); tokoDraft().bayar.splice(Number(el.dataset.i), 1); UI.render(); });
  UI.act('ks-tk-batal', () => { T = null; UI.render(); });
  UI.act('ks-tk-simpan', async el => {
    bacaToko(); el.disabled = true;
    const r = await Relay.call('konsol.toko', { toko: T });
    el.disabled = false;
    if (!r.success) return UI.toast(r.message || 'Gagal menyimpan.', 'error');
    K.data.toko = r.data; T = null; UI.toast(r.message || 'Tersimpan.', 'ok'); UI.render();
  });
  UI.act('ks-tk-lihat', () => window.open(appUrl() + 'beli/', '_blank', 'noopener'));
  function tokoHtml() {
    const t = tokoDraft();
    return `<div id="ks-toko">
      <div class="card"><label class="check"><input type="checkbox" name="buka" ${t.buka !== false ? 'checked' : ''}> <span><b>Terima pesanan online</b><br><small class="muted">Matikan untuk menutup form order sementara (tombol diarahkan ke WhatsApp).</small></span></label>
        ${UI.field('Teks promo (kosong = disembunyikan)', `<input name="promo" maxlength="80" value="${U.esc(t.promo || '')}">`)}
        <div class="grid2">${UI.field('WhatsApp admin (verifikasi)', `<input name="wa" inputmode="tel" value="${U.esc(t.wa || '')}">`)}${UI.field('Batas bayar (jam)', `<input type="number" name="batasJam" min="1" max="168" value="${t.batasJam || 24}">`)}</div></div>
      ${UI.sec('Paket & harga', `<button class="link" data-act="ks-tk-pk-add">${I('plus')} Paket</button>`)}
      ${t.paket.map((p, i) => `<div class="card ks-paket" data-pk="${i}">
        <div class="grid2">${UI.field('Nama paket', `<input name="nama" maxlength="30" value="${U.esc(p.nama)}">`)}${UI.field('ID (unik, huruf/angka)', `<input name="id" maxlength="6" value="${U.esc(p.id)}" ${p._ada ? 'readonly title="ID paket yang sudah ada tidak bisa diubah (dipakai lisensi lama)"' : ''}>`)}</div>
        <div class="grid2">${UI.field('Harga promo', UI.rpInput('harga', p.harga))}${UI.field('Harga coret (0 = tanpa)', UI.rpInput('coret', p.coret))}</div>
        <div class="grid2">${UI.field('Masa (bulan, 0 = selamanya)', `<input type="number" name="masa" min="0" max="120" value="${Number(p.masa) || 0}">`)}${UI.field('Keterangan singkat', `<input name="sub" maxlength="60" value="${U.esc(p.sub || '')}">`)}</div>
        <div class="chips"><label class="check"><input type="checkbox" name="aktif" ${p.aktif !== false ? 'checked' : ''}> Ditampilkan</label><label class="check"><input type="radio" name="unggulan" ${p.unggulan ? 'checked' : ''}> Paling untung</label><button class="chip" data-act="ks-tk-pk-del" data-i="${i}">${I('x')} Hapus</button></div></div>`).join('')}
      ${UI.sec('Metode pembayaran', `<button class="link" data-act="ks-tk-by-add">${I('plus')} Rekening</button>`)}
      ${t.bayar.length ? t.bayar.map((b, i) => `<div class="card ks-paket" data-by="${i}"><div class="grid2">${UI.field('Jenis', `<input name="jenis" maxlength="20" value="${U.esc(b.jenis)}" placeholder="Bank / E-wallet">`)}${UI.field('Nama bank / e-wallet', `<input name="nama" maxlength="30" value="${U.esc(b.nama)}" placeholder="BCA / DANA">`)}</div>
        <div class="grid2">${UI.field('Nomor rekening / HP', `<input name="nomor" maxlength="40" value="${U.esc(b.nomor)}">`)}${UI.field('Atas nama', `<input name="atasNama" maxlength="60" value="${U.esc(b.atasNama)}">`)}</div>
        <button class="chip" data-act="ks-tk-by-del" data-i="${i}">${I('x')} Hapus</button></div>`).join('') : `<div class="card muted small">Belum ada rekening. Pembeli akan diminta meminta info pembayaran lewat WhatsApp.</div>`}
      <div class="card">${UI.field('QRIS (opsional): tautan gambar https', `<input name="qris" maxlength="300" value="${U.esc(t.qris || '')}" placeholder="https://…/qris.png">`)}
        ${UI.field('Catatan pembayaran (opsional)', `<input name="catatanBayar" maxlength="200" value="${U.esc(t.catatanBayar || '')}" placeholder="mis. Konfirmasi diproses 08.00–21.00 WIB">`)}</div>
      <button class="btn block" data-act="ks-tk-simpan">${I('save')} Simpan pengaturan toko</button>
      <div class="grid2"><button class="btn ghost" data-act="ks-tk-lihat">${I('external-link')} Lihat halaman beli</button><button class="btn ghost" data-act="ks-tk-batal">${I('rotate-ccw')} Batalkan perubahan</button></div>
      <p class="muted small">Harga di halaman beli langsung mengikuti pengaturan ini. Paket yang sudah terjual tidak berubah bila harganya diubah. Lisensi yang dibuat dari pesanan memakai masa paket saat ditandai lunas.</p></div>`;
  }

  UI.act('ks-emas-ambil', async el => {
    el.disabled = true; const r = await Relay.call('konsol.emas', { aksi: 'ambil' }); el.disabled = false;
    UI.toast(r.message || (r.success ? 'Diperbarui.' : 'Gagal.'), r.success ? '' : 'warn'); if (r.success) { Harga.fetch(true); load(true); }
  });
  UI.act('ks-emas-manual', async el => {
    const f = UI.formData(document.getElementById('ks-emas'));
    el.disabled = true; const r = await Relay.call('konsol.emas', { beli: f.beli, buyback: f.buyback }); el.disabled = false;
    UI.toast(r.message || (r.success ? 'Tersimpan.' : 'Gagal.'), r.success ? '' : 'warn'); if (r.success) { Harga.fetch(true); load(true); }
  });

  function listHtml() {
    const all = (K.data && K.data.lisensi) || [];
    const rows = all.filter(L => (!K.st || stOf(L) === K.st) && (!K.q || (L.kode + ' ' + L.keluarga + ' ' + L.emailAdmin + ' ' + L.catatan + ' ' + (L.nama || '') + ' ' + (L.wa || '') + ' ' + L.anggota.join(' ')).toLowerCase().indexOf(K.q) > -1));
    if (!rows.length) return `<div class="row muted">Tidak ada lisensi yang cocok.</div>`;
    return rows.slice(0, 300).map(L => { const st = ST[stOf(L)] || [L.status, '']; return `<div class="row" data-act="ks-open" data-v="${U.esc(L.kode)}">
      <span class="cat-ic ${L.status === 'aktif' ? 'ok' : L.status === 'dicabut' ? 'bad' : ''}">${I(L.status === 'aktif' ? 'house' : L.status === 'dicabut' ? 'ban' : 'key-round')}</span>
      <div class="tx-txt"><b>${U.esc(L.keluarga || L.nama || L.kode)}</b><small>${U.esc((L.keluarga ? L.kode + ' · ' + L.emailAdmin : (L.catatan || 'Belum dipakai')))}</small><small>${U.esc((L.paketNama || 'Lifetime') + ' · ' + berlakuTeks(L))}</small></div>
      <div class="r">${UI.pill(st[0], st[1])}${L.anggota.length ? `<small class="muted">${L.anggota.length}/${L.maksAkun || 5} akun</small>` : ''}</div></div>`; }).join('');
  }

  UI.page('konsol', {
    head: p => ({ title: { buat: 'Buat Kode Lisensi', laporan: 'Laporan Masuk', statistik: 'Statistik', emas: 'Harga Emas', pesanan: 'Pesanan', toko: 'Toko & Harga' }[p] || 'Konsol Lisensi', crumb: 'JuniorLabs', back: p ? 'konsol' : 'lainnya',
      right: `<button class="icon-btn" data-act="ks-reload" aria-label="Muat ulang">${I('refresh-cw')}</button>` }),
    nav: () => 'lainnya', noFab: true,
    render(p) {
      if (!App.isSuper) return UI.empty('lock', 'Khusus superadmin', 'Halaman ini hanya untuk akun JuniorLabs.');
      if (!K.data) { load(); return `<div class="empty">${I('loader', 'big')}<h3>Memuat konsol…</h3></div>`; }
      if (Date.now() - K.at > 60000) load();
      const L = K.data.lisensi, n = st => L.filter(x => x.status === st).length;
      const tiles = UI.tiles([
        { id: '', icon: 'list', label: 'Lisensi', to: 'konsol', badge: L.some(x => x.status === 'aktif' && x.sisaHari != null && x.sisaHari <= 14) ? String(L.filter(x => x.status === 'aktif' && x.sisaHari != null && x.sisaHari <= 14).length) : '' },
        { id: 'pesanan', icon: 'receipt', label: 'Pesanan', to: 'konsol/pesanan', badge: (K.data.pesanan || []).filter(o => o.status === 'menunggu').length ? String((K.data.pesanan || []).filter(o => o.status === 'menunggu').length) : '' },
        { id: 'toko', icon: 'shopping-bag', label: 'Toko & Harga', to: 'konsol/toko', gold: true },
        { id: 'buat', icon: 'key-round', label: 'Buat Kode', to: 'konsol/buat' },
        { id: 'laporan', icon: 'inbox', label: 'Laporan', to: 'konsol/laporan', badge: K.data.laporan.length ? String(K.data.laporan.length) : '' }, { id: 'statistik', icon: 'chart-column', label: 'Statistik', to: 'konsol/statistik' },
        { id: 'emas', icon: 'gem', label: 'Harga Emas', to: 'konsol/emas', gold: true, badge: K.data.emasGalat ? '!' : '' }
      ], p || '');
      if (p === 'pesanan') return tiles + pesananHtml();
      if (p === 'toko') return tiles + (K.data.toko ? tokoHtml() : UI.empty('shopping-bag', 'Perbarui relay', 'Pengaturan toko butuh relay versi 1.7.3.'));
      if (p !== 'toko') T = null;
      if (p === 'emas') {
        const h = K.data.emas, rw = h && h.riwayat || [];
        return tiles + `<div class="card"><div class="row-sp"><div><small class="muted">Harga beli / gram</small><h3>${h && h.beli ? U.rp(h.beli) : '—'}</h3></div><div class="r"><small class="muted">Buyback / gram</small><h3>${h && h.buyback ? U.rp(h.buyback) : '—'}</h3></div></div>
            <div class="kv-list"><div class="kv"><span>Sumber</span><b>${h ? U.esc(h.sumber) : '—'}</b></div><div class="kv"><span>Tanggal</span><b>${h ? U.tgl(h.tanggal) : '—'}</b></div><div class="kv"><span>Diambil</span><b>${h && h.waktu ? U.timeAgo(h.waktu) : '—'}</b></div><div class="kv"><span>Riwayat tersimpan</span><b>${rw.length} hari</b></div></div>
            ${rw.length > 2 ? Charts.line(rw.slice(-60).map(r => ({ d: r[0], bal: r[2] })), { fit: true, aria: 'Riwayat buyback' }) : ''}</div>
          ${h && h.merek ? `${UI.sec('Merek lain (Galeri24)', '<small class="muted">' + (h.merekWaktu ? U.timeAgo(h.merekWaktu) : '') + '</small>')}<div class="card"><table class="tbl merek"><thead><tr><th>Merek</th><th>Beli</th><th>Buyback</th></tr></thead><tbody>${Object.keys(h.merek).map(k => `<tr><td>${U.esc(h.merek[k].nama)}</td><td>${U.rp(h.merek[k].beli)}</td><td>${U.rp(h.merek[k].buyback)}</td></tr>`).join('')}</tbody></table></div>` : ''}
          ${K.data.emasGalat ? `<div class="alert warn">${I('triangle-alert')}<div><b>Pengambilan terakhir gagal</b><small>${U.esc(K.data.emasGalat)}</small></div></div>` : ''}
          <button class="btn block" data-act="ks-emas-ambil">${I('refresh-cw')} Ambil harga sekarang</button>
          ${UI.sec('Isi manual untuk hari ini')}<div class="card" id="ks-emas"><div class="grid2">${UI.field('Harga beli / gram', UI.rpInput('beli', h && h.beli))}${UI.field('Buyback / gram', UI.rpInput('buyback', h && h.buyback))}</div>
            <button class="btn block ghost" data-act="ks-emas-manual">${I('save')} Simpan untuk semua keluarga</button></div>
          <p class="muted small">Antam diambil tiap 2 jam dari logammulia.com lewat jembatan Vercel (cadangan: situs yang menyalin harga resmi Antam). Merek lain (UBS, Galeri24, Lotus Archi, Emaskita) dari galeri24.co.id. Bila gagal, harga terakhir tetap dipakai. Harga manual hari ini tidak ditimpa pengambilan otomatis. Keluarga juga bisa memakai harga manual sendiri di Brankas Emas › Harga.</p>`;
      }
      if (p === 'buat') return tiles + `
        <div class="card" id="ks-form"><div class="grid2">${UI.field('Jumlah kode', '<input type="number" name="jumlah" min="1" max="50" value="1">')}${UI.field('Paket', `<select name="paket">${(K.data.toko ? K.data.toko.paket : []).map(p => `<option value="${U.esc(p.id)}" ${p.masa ? '' : 'selected'}>${U.esc(p.nama)}${p.masa ? ' (' + p.masa + ' bln)' : ''}</option>`).join('')}</select>`)}</div>
          ${UI.field('Catatan', '<input name="catatan" maxlength="120" placeholder="mis. Shopee #12345 / nama pembeli">')}
          <button class="btn block" data-act="ks-buat">${I('key-round')} Buat kode</button></div>
        ${K.baru.length ? `${UI.sec('Kode baru', `<button class="link" data-act="ks-copyall">${I('copy')} Salin semua</button>`)}<div class="card list">${K.baru.map(k => `<div class="row"><span class="cat-ic">${I('key-round')}</span><div class="tx-txt"><b><code>${k}</code></b></div><button class="icon-btn" data-act="ks-copy" data-v="${k}" aria-label="Salin">${I('copy')}</button><button class="icon-btn" data-act="ks-wa" data-v="${k}" aria-label="WhatsApp">${I('message-circle')}</button></div>`).join('')}</div>` : ''}
        <p class="muted small">Kirim satu kode ke satu pembeli. Masa paket berlangganan dihitung sejak kode diaktifkan. Kode juga bisa dipakai pelanggan lama sebagai kode perpanjangan (Lainnya › Langganan). Untuk pembelian lewat halaman beli, gunakan menu Pesanan — kode dibuat otomatis saat ditandai lunas.</p>`;
      if (p === 'laporan') return tiles + `<div class="card list">${K.data.laporan.map(x => `<details class="lap"><summary class="row"><span class="cat-ic ${x.jenis === 'ide' ? '' : 'bad'}">${I(x.jenis === 'ide' ? 'lightbulb' : 'bug')}</span><div class="tx-txt"><b>${U.esc(x.judul)}</b><small>${U.esc(x.email)} · ${U.esc(x.modul)} · ${x.tanggal ? U.timeAgo(x.tanggal) : ''}</small></div>${UI.pill(x.prioritas || '-', x.prioritas === 'tinggi' ? 'bad' : '')}</summary>
          <div class="lap-body"><p>${U.esc(x.deskripsi).replace(/\n/g, '<br>')}</p><small class="muted">Tiket ${U.esc(x.id)} · ${U.esc(x.diagnostik)}</small><div class="chips"><a class="chip" href="mailto:${U.esc(x.email)}?subject=${encodeURIComponent('Re: [SatuAtap] ' + x.judul)}">${I('mail')} Balas email</a></div></div></details>`).join('') || '<div class="row muted">Belum ada laporan.</div>'}</div>`;
      if (p === 'statistik') {
        const akun = U.sum(L.filter(x => x.status === 'aktif'), x => x.anggota.length);
        const now = Date.now(), aktif7 = L.filter(x => x.status === 'aktif' && x.cekTerakhir && now - new Date(x.cekTerakhir).getTime() < 7 * 864e5).length;
        const perBulan = U.groupBy(L.filter(x => x.diaktifkan), x => x.diaktifkan.slice(0, 7));
        const bln = Object.keys(perBulan).sort().slice(-6);
        return tiles + `<div class="stat3"><div class="stat ok"><small>Keluarga aktif</small><b>${n('aktif')}</b></div><div class="stat"><small>Akun pengguna</small><b>${akun}</b></div><div class="stat"><small>Aktif 7 hari</small><b>${aktif7}</b></div></div>
          <div class="stat3"><div class="stat"><small>Kode belum dipakai</small><b>${n('baru')}</b></div><div class="stat out"><small>Dicabut</small><b>${n('dicabut')}</b></div><div class="stat"><small>Total kode</small><b>${L.length}</b></div></div>
          ${bln.length ? `<div class="card"><b>Aktivasi per bulan</b>${Charts.bars(bln.map(k => ({ label: U.BLN[Number(k.slice(5)) - 1], a: perBulan[k].length, b: 0 })), { aria: 'Aktivasi per bulan' })}</div>` : ''}
          <div class="card kv-list"><div class="kv"><span>Sisa kuota email hari ini</span><b>${K.data.kuotaEmail}</b></div><div class="kv"><span>Ringkasan dalam antrean</span><b>${K.data.antrean}</b></div><div class="kv"><span>Ringkasan terkirim (total)</span><b>${K.data.terkirim}</b></div><div class="kv"><span>Versi relay</span><b>${U.esc(K.data.ver)}</b></div></div>`;
      }
      return tiles + `
        <div class="stat3"><div class="stat ok"><small>Aktif</small><b>${L.filter(x => stOf(x) === 'aktif' || stOf(x) === 'segera').length}</b></div><div class="stat"><small>Belum dipakai</small><b>${n('baru')}</b></div><div class="stat out"><small>Berakhir</small><b>${L.filter(x => stOf(x) === 'habis').length}</b></div></div>
        <div class="search">${I('search')}<input type="search" placeholder="Cari kode, keluarga, email, catatan…" value="${U.esc(K.q)}" data-input="ks-q"></div>
        <div class="chips">${Object.keys(ST).filter(k => k !== 'terpakai' || L.some(x => x.status === 'terpakai')).map(k => `<button class="chip ${K.st === k ? 'on' : ''}" data-act="ks-filter" data-v="${k}">${ST[k][0]}</button>`).join('')}</div>
        <div class="card list" id="ks-list">${listHtml()}</div><p class="muted small">Diperbarui ${U.timeAgo(new Date(K.at).toISOString())}. Data keuangan keluarga tidak pernah terlihat di sini.</p>`;
    }
  });
})();
