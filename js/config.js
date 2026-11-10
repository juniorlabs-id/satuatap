/* SatuAtap — konfigurasi publik frontend (diisi JuniorLabs sekali).
 * Semua nilai di sini memang publik (dipakai browser). TIDAK ada rahasia.
 * Batasi API key di Google Cloud: hanya untuk Picker API & hanya dari domain situs Anda. */
window.APP_CONFIG = {
  APP_NAME: 'SatuAtap',
  VERSION: '1.2.0',
  // OAuth Client ID (Web) dari Google Cloud — berakhiran .apps.googleusercontent.com
  GOOGLE_CLIENT_ID: '141070415022-7187tjaf6ltiqkqp5pjgoane3gmph7sf.apps.googleusercontent.com',
  // API key untuk Google Picker (anggota memilih file keluarga yang dibagikan)
  GOOGLE_API_KEY: 'AIzaSyArytts5ZSngpMu4hIZ2XI6K9_CofsQBVM',
  // Nomor proyek Google Cloud (Project number) — untuk Picker
  GOOGLE_APP_ID: '141070415022',
  // URL /exec relay JuniorLabs (lisensi, email ringkasan, laporan). Kosong = tanpa lisensi (mode pengembangan)
  RELAY_URL: 'https://script.google.com/macros/s/AKfycbwiY_m1sMiMdD6obW4-gnGsBT69unDR4Gs2w1vQwhXOGH1Gxzz1xt1f5YBtguUlLN9wqg/exec',
  SUPPORT_WA: '628561254689',
  SYNC_INTERVAL_MS: 60000
};