/* ============================================================
 * Relay JuniorLabs — lisensi, email ringkasan bulanan, laporan masalah.
 * Relay TIDAK menyimpan data keuangan keluarga.
 * ============================================================ */
(function () {
  const Perf = { rows: [], add(a, total, server) { this.rows.push({ a, total, server, at: Date.now() }); if (this.rows.length > 100) this.rows.shift(); }, table() { console.table(this.rows.slice(-30)); } };
  window.Perf = Perf;

  async function once(action, data, timeout) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
    try {
      const res = await fetch(APP_CONFIG.RELAY_URL, { method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token: Auth.token || '', data: data || {} }) });
      const text = await res.text();
      try { const j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms); return j; }
      catch (e) { return { success: false, network: true, message: 'Server lisensi membalas tidak terduga (HTTP ' + res.status + ').' }; }
    } catch (err) { return { success: false, network: true, message: err.name === 'AbortError' ? 'Server lisensi terlalu lama merespons.' : 'Koneksi terputus.' }; }
    finally { clearTimeout(timer); }
  }
  const Relay = {
    enabled: () => !!APP_CONFIG.RELAY_URL,
    async call(action, data) {
      if (Store.mode === 'demo') {
        await new Promise(r => setTimeout(r, 120));
        if (action === 'laporan.kirim') return { success: true, data: { tiket: 'DEMO-' + Math.floor(Math.random() * 9000 + 1000) }, message: 'Mode demo: laporan tidak benar-benar dikirim.' };
        if (action === 'tg.info') return { success: true, data: { aktif: true, bot: 'SatuAtapBot', saya: true, terhubung: [{ email: 'dimas@contoh.id', nama: 'Dimas', username: 'dimas' }], demo: true } };
        if (action === 'tg.kode') return { success: true, data: { kode: 'DEMO1234', bot: 'SatuAtapBot', link: 'https://t.me/SatuAtapBot', berlaku: 15 }, message: 'Mode demo: tautan contoh.' };
        if (action === 'tg.ambil') { const n = (window.Demo && Demo.kotakDiambil) ? [] : [{ id: 'k1', teks: 'makan siang 45rb gopay', waktu: new Date(Date.now() - 36e5).toISOString(), sumber: 'telegram' }, { id: 'k2', teks: 'bensin 50.000', waktu: new Date(Date.now() - 18e5).toISOString(), sumber: 'wa' }]; window.Demo = Object.assign(window.Demo || {}, { kotakDiambil: true }); return { success: true, data: { item: n } }; }
        if (action === 'tg.kirim') return { success: true, data: { terkirim: 0, demo: true } };
        return { success: true, data: { aktif: true, demo: true } };
      }
      if (!Relay.enabled()) return { success: false, off: true, message: 'Server lisensi belum diatur (RELAY_URL kosong).' };
      if (action.indexOf('auth.') !== 0 && !Auth.valid()) await Auth.ensure();
      let r;
      for (let i = 0; i < 2; i++) { if (i) await new Promise(x => setTimeout(x, 1500)); r = await once(action, data, i ? 45000 : 25000); if (r.success || !r.network) break; }
      return r;
    },
    warm() { if (Relay.enabled() && Store.mode === 'live') fetch(APP_CONFIG.RELAY_URL + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); }
  };
  window.Relay = Relay;
  window.API = { call: Relay.call, warm: Relay.warm };
})();
