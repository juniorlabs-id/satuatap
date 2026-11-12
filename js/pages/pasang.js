/* ============================================================
 * Pasang aplikasi (PWA) — tombol di Beranda & Lainnya.
 *  - Android/Chrome/Samsung/Edge: pakai event beforeinstallprompt → 1 ketuk.
 *    Browser hanya mengirim event ini bila aplikasi BELUM terpasang,
 *    jadi tombol otomatis hilang setelah dipasang.
 *  - iPhone/iPad: Safari tidak punya tombol pasang otomatis → tampilkan langkahnya.
 *  - Dibuka dari ikon layar utama (mode standalone) → tombol tidak pernah tampil.
 * ============================================================ */
(function () {
  const I = UI.icon;
  const ua = navigator.userAgent || '';
  const iOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const iOSSafari = iOS && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  const standalone = () => (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: minimal-ui)').matches)) || navigator.standalone === true;
  let evt = window.__bip || null, baruPasang = false;

  const segarkan = () => { if (window.UI && (UI.cur === 'beranda' || UI.cur === 'lainnya')) UI.render(); };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evt = e; window.__bip = e; segarkan(); });
  window.addEventListener('appinstalled', () => { evt = window.__bip = null; baruPasang = true; UI.toast('SatuAtap terpasang di layar utama 🎉'); segarkan(); });

  /** Tampil hanya bila memang bisa dipasang dari browser ini. */
  UI.bisaPasang = () => {
    if (standalone() || baruPasang) return false;
    if (evt) return true;
    return iOS && ls('sa:pasang:ios') !== '1';
  };
  UI.pasangKartu = (tempat) => {
    if (!UI.bisaPasang()) return '';
    if (tempat === 'beranda' && Number(ls('sa:pasang:nanti') || 0) > Date.now()) return '';
    return `<div class="alert pasang" data-act="pasang">${I('download')}<div><b>Pasang aplikasi SatuAtap</b><small>Buka langsung dari layar utama, layar penuh & lebih cepat.</small></div>${tempat === 'beranda' ? `<button class="icon-btn sm" data-act="pasang-nanti" aria-label="Nanti saja">${I('x')}</button>` : I('chevron-right')}</div>`;
  };

  UI.act('pasang-nanti', () => { ls('sa:pasang:nanti', String(Date.now() + 14 * 864e5)); UI.render(); UI.toast('Tombol pasang tetap ada di menu Lainnya.'); });
  UI.act('pasang', async () => {
    if (evt) {
      const e = evt;
      try {
        await e.prompt();
        const r = await e.userChoice;
        evt = window.__bip = null;                      // event hanya bisa dipakai sekali
        if (r && r.outcome === 'accepted') baruPasang = true;
      } catch (x) { evt = window.__bip = null; }
      UI.render();
      return;
    }
    const langkah = iOSSafari
      ? `<ol class="langkah"><li>Ketuk tombol <b>Bagikan</b> ${I('share')} di bilah bawah Safari.</li><li>Gulir lalu pilih <b>Tambah ke Layar Utama</b> ${I('square-plus')}.</li><li>Ketuk <b>Tambah</b>. Buka SatuAtap dari ikon barunya.</li></ol>`
      : iOS
        ? `<p>Di iPhone/iPad, aplikasi hanya bisa dipasang lewat <b>Safari</b>.</p><ol class="langkah"><li>Salin alamat: <b>${U.esc(location.host)}</b></li><li>Buka di Safari, ketuk <b>Bagikan</b> ${I('share')}.</li><li>Pilih <b>Tambah ke Layar Utama</b> → <b>Tambah</b>.</li></ol>`
        : `<ol class="langkah"><li>Ketuk menu browser ${I('ellipsis-vertical')} di pojok kanan atas.</li><li>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li><li>Ketuk <b>Instal</b>.</li></ol>`;
    const s = UI.sheet({ title: 'Pasang SatuAtap', body: langkah + `<small class="muted">Data tetap sama — aplikasi di layar utama memakai akun & file Drive yang sama.</small>`,
      foot: iOS ? `<button class="btn ghost" data-sudah>Sudah saya pasang</button><button class="btn" data-ok>Mengerti</button>` : `<button class="btn" data-ok>Mengerti</button>` });
    s.el.querySelector('[data-ok]').onclick = () => s.close();
    const sd = s.el.querySelector('[data-sudah]');
    if (sd) sd.onclick = () => { ls('sa:pasang:ios', '1'); s.close(); UI.render(); };
  });
})();
