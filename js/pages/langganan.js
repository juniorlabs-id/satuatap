/* Langganan — status lisensi keluarga, perpanjang, masukkan kode perpanjangan. */
(function () {
  const I = UI.icon;
  const info = () => App.lic || (Store.mode === 'demo' ? { kode: 'SA-DEMO-DEMO-DEMO', paketNama: '1 Tahun', berlakuSampai: U.addMonths(U.today(), 7), sisaHari: 210, maksAkun: 5, demo: true } : null);
  const linkBeli = kode => location.origin + location.pathname.replace(/[^/]*$/, '') + 'beli/' + (kode ? '?perpanjang=' + encodeURIComponent(kode) : '') + '#harga';

  UI.act('lgn-cek', async el => {
    el.disabled = true; const r = await App.license(true); el.disabled = false;
    UI.toast(r && r.success ? 'Status langganan diperbarui.' : (r && r.message) || 'Belum bisa memeriksa sekarang.', r && r.success ? 'ok' : 'warn'); UI.render();
  });
  UI.act('lgn-beli', () => { const L = info(); window.open(linkBeli(L && !L.demo ? L.kode : ''), '_blank', 'noopener'); });
  UI.act('lgn-salin', async () => { const L = info(); try { await navigator.clipboard.writeText(L.kode); UI.toast('Kode lisensi disalin.'); } catch (e) { prompt('Salin:', L.kode); } });
  UI.act('lgn-kode', async el => {
    const inp = document.getElementById('lgn-in'), kode = String(inp.value || '').toUpperCase().trim();
    if (!/^SA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kode)) return UI.toast('Format kode: SA-XXXX-XXXX-XXXX.', 'warn');
    if (Store.mode === 'demo') return UI.toast('Mode demo: kode tidak benar-benar dipakai.');
    el.disabled = true;
    const r = await Relay.call('lisensi.perpanjang', { fileId: Store.fileId, kode });
    el.disabled = false;
    if (!r.success) return UI.toast(r.message || 'Kode tidak bisa dipakai.', 'error');
    localStorage.setItem('sa:lic:' + Store.fileId, JSON.stringify({ ok: true, at: Date.now(), info: r.data }));
    App.licTerapkan(Object.assign({}, r.data, { kedaluwarsa: false }));
    inp.value = ''; UI.toast(r.message || 'Langganan diperpanjang.', 'ok'); UI.render();
  });

  /** Peringatan untuk Beranda (dipanggil beranda.js). */
  UI.langgananAlert = () => {
    const L = App.lic; if (!L || L.selamanya || !L.berlakuSampai) return '';
    if (Store.readOnly) return `<div class="alert bad" data-act="go" data-to="langganan">${I('lock')}<div><b>Masa langganan berakhir</b><small>Aplikasi sedang baca-saja sejak ${U.tgl(L.berlakuSampai)}. Data aman — perpanjang untuk mencatat lagi.</small></div>${I('chevron-right')}</div>`;
    if (L.sisaHari != null && L.sisaHari <= 14) return `<div class="alert warn" data-act="go" data-to="langganan">${I('hourglass')}<div><b>Langganan berakhir ${L.sisaHari <= 0 ? 'hari ini' : L.sisaHari + ' hari lagi'}</b><small>Paket ${U.esc(L.paketNama || '')} berlaku sampai ${U.tgl(L.berlakuSampai)}. Perpanjang agar tetap bisa mencatat.</small></div>${I('chevron-right')}</div>`;
    return '';
  };

  UI.page('langganan', {
    head: () => ({ title: 'Langganan', crumb: 'Lainnya', back: 'lainnya' }),
    nav: () => 'lainnya', noFab: true,
    render() {
      const L = info();
      if (!L) return UI.empty('key-round', 'Status langganan belum termuat', Relay.enabled() ? 'Periksa koneksi internet, lalu muat ulang.' : 'Server lisensi belum diatur.', Relay.enabled() ? `<button class="btn" data-act="lgn-cek">${I('refresh-cw')} Periksa sekarang</button>` : '');
      const habis = Store.readOnly, selamanya = L.selamanya || !L.berlakuSampai;
      const st = selamanya ? ['Selamanya', 'ok'] : habis ? ['Berakhir', 'bad'] : L.sisaHari <= 14 ? ['Segera berakhir', 'warn'] : ['Aktif', 'ok'];
      const persen = !selamanya && L.berlakuSampai ? U.clamp(L.sisaHari / ((/1 tahun|12/i.test(L.paketNama || '') ? 365 : 183)) * 100, 0, 100) : 100;
      return `
        <div class="card lgn-hero ${habis ? 'habis' : ''}">
          <div class="row-sp"><div><small class="muted">Paket</small><h3>SatuAtap ${U.esc(L.paketNama || (selamanya ? 'Lifetime' : 'Langganan'))}</h3></div>${UI.pill(st[0], st[1])}</div>
          ${selamanya ? `<p class="muted">Lisensi keluarga ini berlaku selamanya, termasuk semua pembaruan aplikasi. Terima kasih! 🙏</p>`
            : `<div class="lgn-bar"><i style="width:${persen.toFixed(0)}%"></i></div>
               <div class="row-sp"><small class="muted">${habis ? 'Berakhir' : 'Berlaku sampai'}</small><b>${U.tgl(L.berlakuSampai)}</b></div>
               ${!habis ? `<div class="row-sp"><small class="muted">Sisa</small><b>${L.sisaHari} hari</b></div>` : ''}`}
          <div class="kv-list"><div class="kv"><span>Kode lisensi</span><b><code>${U.esc(L.kode || Store.setting('lisensiKode', '—'))}</code> <button class="link" data-act="lgn-salin">${I('copy')}</button></b></div>
            <div class="kv"><span>Batas akun keluarga</span><b>${L.maksAkun || 5} akun</b></div></div>
        </div>
        ${habis ? `<div class="alert bad">${I('lock')}<div><b>Aplikasi sedang baca-saja</b><small>Semua data tetap bisa dilihat dan diunduh (Lainnya › Data & Sinkron). Menambah atau mengubah catatan aktif lagi setelah langganan diperpanjang. Masa baru dihitung mulai hari ini.</small></div></div>` : ''}
        ${!selamanya ? `<button class="btn block" data-act="lgn-beli">${I('shopping-cart')} ${habis ? 'Perpanjang sekarang' : 'Perpanjang / upgrade ke Lifetime'}</button>
          <p class="muted small">Membuka halaman pembelian dengan kode lisensi Anda terisi otomatis. Setelah pembayaran diverifikasi, masa langganan bertambah otomatis${habis ? '' : ' dari tanggal berakhir — tidak ada hari yang hilang'}.</p>` : ''}
        ${UI.sec('Punya kode perpanjangan?')}
        <div class="card"><p class="muted small" style="margin-top:0">Masukkan kode perpanjangan dari JuniorLabs (bukan kode lisensi keluarga di atas).</p>
          <div class="grid2"><input id="lgn-in" placeholder="SA-XXXX-XXXX-XXXX" autocomplete="off" style="text-transform:uppercase"><button class="btn" data-act="lgn-kode">${I('key-round')} Pakai kode</button></div></div>
        <button class="btn block ghost" data-act="lgn-cek">${I('refresh-cw')} Periksa ulang status</button>
        <button class="btn block ghost" data-act="wa-support">${I('message-circle')} Tanya JuniorLabs</button>
        <div class="spacer"></div>`;
    }
  });
})();
