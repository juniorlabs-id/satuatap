/* Konsol JuniorLabs — khusus superadmin: kelola lisensi, buat kode, lihat laporan masuk. */
(function () {
  const I = UI.icon;
  const K = { data: null, at: 0, loading: false, q: '', st: '', baru: [] };
  const ST = { baru: ['Belum dipakai', ''], aktif: ['Aktif', 'ok'], dicabut: ['Dicabut', 'bad'] };

  async function load(force) {
    if (K.loading || (!force && K.data && Date.now() - K.at < 60000)) return;
    K.loading = true;
    const r = await Relay.call('konsol.ringkas', {});
    K.loading = false;
    if (r.success) { K.data = r.data; K.at = Date.now(); } else UI.toast(r.message || 'Gagal memuat konsol.', 'error');
    if (UI.cur === 'konsol') UI.render();
  }
  const salin = async (t, msg) => { try { await navigator.clipboard.writeText(t); UI.toast(msg || 'Disalin.'); } catch (e) { prompt('Salin:', t); } };
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
    const r = await Relay.call('konsol.buat', { jumlah: n, catatan: f.catatan });
    el.disabled = false;
    if (!r.success) return UI.toast(r.message || 'Gagal.', 'error');
    K.baru = r.data.kode; K.at = 0; UI.toast(r.message); UI.render(); load(true);
  });
  UI.act('ks-open', el => {
    const L = ((K.data && K.data.lisensi) || []).find(x => x.kode === el.dataset.v); if (!L) return;
    const st = ST[L.status] || [L.status, ''];
    const s = UI.sheet({ title: L.kode, body: `
      <div class="kv-list">
        <div class="kv"><span>Status</span><b>${UI.pill(st[0], st[1])}</b></div>
        <div class="kv"><span>Keluarga</span><b>${U.esc(L.keluarga || '—')}</b></div>
        <div class="kv"><span>Admin</span><b>${U.esc(L.emailAdmin || '—')}</b></div>
        <div class="kv"><span>Anggota</span><b>${L.anggota.length ? L.anggota.map(U.esc).join('<br>') : '—'}</b></div>
        <div class="kv"><span>Dibuat</span><b>${L.dibuat ? U.tgl(L.dibuat.slice(0, 10)) : '—'}</b></div>
        <div class="kv"><span>Diaktifkan</span><b>${L.diaktifkan ? U.tgl(L.diaktifkan.slice(0, 10)) : '—'}</b></div>
        <div class="kv"><span>Cek terakhir</span><b>${L.cekTerakhir ? U.timeAgo(L.cekTerakhir) : '—'}</b></div></div>
      ${UI.field('Catatan (mis. nama pembeli / no. pesanan)', `<input name="catatan" maxlength="120" value="${U.esc(L.catatan)}">`)}
      <div class="chips"><button class="chip" data-a="copy">${I('copy')} Salin kode</button><button class="chip" data-a="wa">${I('message-circle')} Kirim via WA</button><button class="chip" data-a="catatan">${I('save')} Simpan catatan</button></div>`,
      foot: `${L.status === 'dicabut' ? `<button class="btn" data-a="pulihkan">${I('rotate-ccw')} Pulihkan</button>` : `<button class="btn ghost danger" data-a="cabut">${I('ban')} Cabut</button>`}
        ${L.fileId ? `<button class="btn ghost" data-a="lepas">${I('unlink')} Lepas ikatan</button>` : ''}` });
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'copy') return salin(L.kode, 'Kode disalin.');
      if (a === 'wa') return window.open('https://wa.me/?text=' + encodeURIComponent(pesanWA(L.kode)), '_blank', 'noopener');
      const msg = { cabut: ['Cabut lisensi?', `Keluarga ${L.keluarga || ''} tidak bisa memakai aplikasi sampai dipulihkan. Data mereka tetap aman di Drive mereka.`],
        lepas: ['Lepas ikatan?', 'Kode bisa diaktifkan ulang oleh akun Google lain / file baru (mis. pembeli ganti akun). Keluarga lama otomatis tidak aktif.'] }[a];
      if (msg && !(await UI.confirm(msg[0], msg[1], 'Ya, lanjutkan', true))) return;
      b.disabled = true;
      const r = await Relay.call('konsol.ubah', { kode: L.kode, aksi: a, catatan: s.el.querySelector('[name=catatan]').value });
      b.disabled = false;
      if (!r.success) return UI.toast(r.message || 'Gagal.', 'error');
      s.close(); UI.toast(r.message || 'Tersimpan.'); load(true);
    });
  });

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
    const rows = all.filter(L => (!K.st || L.status === K.st) && (!K.q || (L.kode + ' ' + L.keluarga + ' ' + L.emailAdmin + ' ' + L.catatan + ' ' + L.anggota.join(' ')).toLowerCase().indexOf(K.q) > -1));
    if (!rows.length) return `<div class="row muted">Tidak ada lisensi yang cocok.</div>`;
    return rows.slice(0, 300).map(L => { const st = ST[L.status] || [L.status, '']; return `<div class="row" data-act="ks-open" data-v="${U.esc(L.kode)}">
      <span class="cat-ic ${L.status === 'aktif' ? 'ok' : L.status === 'dicabut' ? 'bad' : ''}">${I(L.status === 'aktif' ? 'house' : L.status === 'dicabut' ? 'ban' : 'key-round')}</span>
      <div class="tx-txt"><b>${U.esc(L.keluarga || L.kode)}</b><small>${U.esc(L.keluarga ? L.kode + ' · ' + L.emailAdmin : (L.catatan || 'Belum dipakai'))}</small></div>
      <div class="r">${UI.pill(st[0], st[1])}${L.anggota.length ? `<small class="muted">${L.anggota.length}/5 akun</small>` : ''}</div></div>`; }).join('');
  }

  UI.page('konsol', {
    head: p => ({ title: { buat: 'Buat Kode Lisensi', laporan: 'Laporan Masuk', statistik: 'Statistik', emas: 'Harga Emas' }[p] || 'Konsol Lisensi', crumb: 'JuniorLabs', back: p ? 'konsol' : 'lainnya',
      right: `<button class="icon-btn" data-act="ks-reload" aria-label="Muat ulang">${I('refresh-cw')}</button>` }),
    nav: () => 'lainnya', noFab: true,
    render(p) {
      if (!App.isSuper) return UI.empty('lock', 'Khusus superadmin', 'Halaman ini hanya untuk akun JuniorLabs.');
      if (!K.data) { load(); return `<div class="empty">${I('loader', 'big')}<h3>Memuat konsol…</h3></div>`; }
      if (Date.now() - K.at > 60000) load();
      const L = K.data.lisensi, n = st => L.filter(x => x.status === st).length;
      const tiles = UI.tiles([
        { id: '', icon: 'list', label: 'Lisensi', to: 'konsol' }, { id: 'buat', icon: 'key-round', label: 'Buat Kode', to: 'konsol/buat' },
        { id: 'laporan', icon: 'inbox', label: 'Laporan', to: 'konsol/laporan', badge: K.data.laporan.length ? String(K.data.laporan.length) : '' }, { id: 'statistik', icon: 'chart-column', label: 'Statistik', to: 'konsol/statistik' },
        { id: 'emas', icon: 'gem', label: 'Harga Emas', to: 'konsol/emas', gold: true, badge: K.data.emasGalat ? '!' : '' }
      ], p || '');
      if (p === 'emas') {
        const h = K.data.emas, rw = h && h.riwayat || [];
        return tiles + `<div class="card"><div class="row-sp"><div><small class="muted">Harga beli / gram</small><h3>${h ? U.rp(h.beli) : '—'}</h3></div><div class="r"><small class="muted">Buyback / gram</small><h3>${h ? U.rp(h.buyback) : '—'}</h3></div></div>
            <div class="kv-list"><div class="kv"><span>Sumber</span><b>${h ? U.esc(h.sumber) : '—'}</b></div><div class="kv"><span>Tanggal</span><b>${h ? U.tgl(h.tanggal) : '—'}</b></div><div class="kv"><span>Diambil</span><b>${h && h.waktu ? U.timeAgo(h.waktu) : '—'}</b></div><div class="kv"><span>Riwayat tersimpan</span><b>${rw.length} hari</b></div></div>
            ${rw.length > 2 ? Charts.line(rw.slice(-60).map(r => ({ d: r[0], bal: r[2] })), { fit: true, aria: 'Riwayat buyback' }) : ''}</div>
          ${K.data.emasGalat ? `<div class="alert warn">${I('triangle-alert')}<div><b>Pengambilan terakhir gagal</b><small>${U.esc(K.data.emasGalat)}</small></div></div>` : ''}
          <button class="btn block" data-act="ks-emas-ambil">${I('refresh-cw')} Ambil harga sekarang</button>
          ${UI.sec('Isi manual untuk hari ini')}<div class="card" id="ks-emas"><div class="grid2">${UI.field('Harga beli / gram', UI.rpInput('beli', h && h.beli))}${UI.field('Buyback / gram', UI.rpInput('buyback', h && h.buyback))}</div>
            <button class="btn block ghost" data-act="ks-emas-manual">${I('save')} Simpan untuk semua keluarga</button></div>
          <p class="muted small">Relay mengambil harga otomatis tiap 2 jam (Logam Mulia → harga-emas.org → harga spot dunia). Harga manual hari ini tidak ditimpa pengambilan otomatis. Keluarga juga bisa memakai harga manual sendiri di Brankas Emas › Harga.</p>`;
      }
      if (p === 'buat') return tiles + `
        <div class="card" id="ks-form"><div class="grid2">${UI.field('Jumlah kode', '<input type="number" name="jumlah" min="1" max="50" value="1">')}${UI.field('Catatan', '<input name="catatan" maxlength="120" placeholder="mis. Shopee #12345 / nama pembeli">')}</div>
          <button class="btn block" data-act="ks-buat">${I('key-round')} Buat kode</button></div>
        ${K.baru.length ? `${UI.sec('Kode baru', `<button class="link" data-act="ks-copyall">${I('copy')} Salin semua</button>`)}<div class="card list">${K.baru.map(k => `<div class="row"><span class="cat-ic">${I('key-round')}</span><div class="tx-txt"><b><code>${k}</code></b></div><button class="icon-btn" data-act="ks-copy" data-v="${k}" aria-label="Salin">${I('copy')}</button><button class="icon-btn" data-act="ks-wa" data-v="${k}" aria-label="WhatsApp">${I('message-circle')}</button></div>`).join('')}</div>` : ''}
        <p class="muted small">Kirim satu kode ke satu pembeli. Tombol WhatsApp menyiapkan pesan berisi kode & langkah aktivasi.</p>`;
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
        <div class="stat3"><div class="stat ok"><small>Aktif</small><b>${n('aktif')}</b></div><div class="stat"><small>Belum dipakai</small><b>${n('baru')}</b></div><div class="stat out"><small>Dicabut</small><b>${n('dicabut')}</b></div></div>
        <div class="search">${I('search')}<input type="search" placeholder="Cari kode, keluarga, email, catatan…" value="${U.esc(K.q)}" data-input="ks-q"></div>
        <div class="chips">${Object.keys(ST).map(k => `<button class="chip ${K.st === k ? 'on' : ''}" data-act="ks-filter" data-v="${k}">${ST[k][0]}</button>`).join('')}</div>
        <div class="card list" id="ks-list">${listHtml()}</div><p class="muted small">Diperbarui ${U.timeAgo(new Date(K.at).toISOString())}. Data keuangan keluarga tidak pernah terlihat di sini.</p>`;
    }
  });
})();
