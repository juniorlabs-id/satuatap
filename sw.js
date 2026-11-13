/* Service worker SatuAtap — cache kerangka aplikasi agar terbuka instan & bisa offline.
 * Data keluarga TIDAK di-cache di sini (disimpan di IndexedDB oleh aplikasi). */
const VER = 'satuatap-1.6.4';
const SHELL = [ "./", "./index.html", "./css/style.css", "./img/apple-touch-icon.png", "./img/favicon-32.png", "./img/icon-192.png", "./img/icon-512.png", "./img/icon-maskable-512.png", "./img/logo-wide.png", "./js/ai.js", "./js/api.js", "./js/app.js", "./js/calc.js", "./js/calc2.js", "./js/calc3.js", "./js/charts.js", "./js/cloud.js", "./js/config.js", "./js/demo.js", "./js/gapi.js", "./js/i18n-en.js", "./js/i18n.js", "./js/icons.js", "./js/pages/ai.js", "./js/pages/anggaran.js", "./js/pages/aset.js", "./js/pages/beranda.js", "./js/pages/catat.js", "./js/pages/emas.js", "./js/pages/impor.js", "./js/pages/investasi.js", "./js/pages/kalender.js", "./js/pages/kilas.js", "./js/pages/konsol.js", "./js/pages/lainnya.js", "./js/pages/mutasi.js", "./js/pages/notif.js", "./js/pages/pasang.js", "./js/pages/rapat.js", "./js/pages/rapor.js", "./js/pages/reksadana.js", "./js/pages/saham.js", "./js/pages/simulasi.js", "./js/pages/tujuan.js", "./js/pages/utang.js", "./js/pages/zakat.js", "./js/priv.js", "./js/store.js", "./js/ui.js", "./js/util.js", "./js/voice.js", "./manifest.webmanifest", "./oauth.html" ];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.indexOf('/api/') === 0) return;   // GAS, Google, font, /api: lewat jaringan biasa
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const net = fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VER).then(c => c.put(e.request, cp)); } return r; }).catch(() => hit);
      return hit || net;
    })
  );
});
