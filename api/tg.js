/* Jembatan webhook Telegram → relay Apps Script.
 * Telegram butuh jawaban HTTP 200 yang cepat; Apps Script menjawab dengan pengalihan (302)
 * sehingga Telegram akan mengirim ulang. Fungsi ini menerima update, meneruskannya ke relay
 * (aksi tg.update) bersama rahasia dari header Telegram, lalu menjawab 200.
 *
 * Alamat relay dicari berurutan (agar bot tidak putus saat relay di-deploy ulang):
 *   1. Environment Variable Vercel RELAY_URL (bila diisi)
 *   2. RELAY_URL di js/config.js situs ini sendiri — sumber yang sama dengan aplikasi
 * Bila alamat pertama gagal (deployment lama dihapus, salah ketik), alamat kedua dicoba otomatis.
 * Rahasia (TELEGRAM_SECRET) hanya disimpan & diperiksa di relay.
 * Diagnosis: cekTelegram() / pemicu relay mengirim {__ping:1} untuk menguji jalur Vercel → relay. */
let CFG = { url: '', t: 0 };
async function relayDariConfig(host) {
  if (CFG.url && Date.now() - CFG.t < 10 * 60e3) return CFG.url;
  try {
    const r = await fetch('https://' + host + '/js/config.js', { signal: AbortSignal.timeout(5000), headers: { 'Cache-Control': 'no-cache' } });
    const m = (await r.text()).match(/RELAY_URL\s*:\s*['"](https:\/\/script\.google\.com\/[^'"]+\/exec)['"]/);
    CFG = { url: m ? m[1] : '', t: Date.now() };
  } catch (e) { CFG = { url: '', t: Date.now() - 9 * 60e3 }; }
  return CFG.url;
}
async function kirimKeRelay(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', body, signal: AbortSignal.timeout(25000) });
  const teks = await r.text(); let j = null; try { j = JSON.parse(teks); } catch (e) {}
  if (!j) throw new Error('relay menjawab HTTP ' + r.status + ' bukan JSON (alamat salah / deployment dihapus / akses bukan "Siapa saja")');
  if (!j.success && /Aksi tidak dikenal/.test(j.message || '')) throw new Error('relay versi lama: ' + j.message);
  return j;
}
module.exports = async (req, res) => {
  const kirim = (o) => { res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o || { ok: true })); };
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const env = String(process.env.RELAY_URL || '').trim();
  if (req.method !== 'POST') {
    const cfg = env ? '' : await relayDariConfig(host);
    res.statusCode = 200; res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('SatuAtap · webhook Telegram aktif' + (env || cfg ? '' : ' — RELAY_URL belum diisi (Vercel maupun js/config.js)'));
  }
  const secret = req.headers['x-telegram-bot-api-secret-token'] || '';
  if (!secret) { console.error('[tg] permintaan tanpa header rahasia Telegram — diabaikan'); return kirim(); }
  let update = req.body;
  if (!update || typeof update === 'string') { try { update = JSON.parse(update || await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); })); } catch (e) { return kirim(); } }
  const ping = !!(update && update.__ping);
  const body = JSON.stringify(ping ? { action: 'tg.ping', data: { secret } } : { action: 'tg.update', data: { secret, update } });
  const calon = [];
  if (env) calon.push(['env', env]);
  const cfg = await relayDariConfig(host);
  if (cfg && cfg !== env) calon.push(['config', cfg]);
  if (!calon.length) { console.error('[tg] alamat relay tidak ditemukan: isi RELAY_URL di Vercel atau di js/config.js'); return kirim(ping ? { ok: false, galat: 'RELAY_URL belum diisi (Vercel maupun js/config.js)' } : null); }
  let galat = '';
  for (const [lewat, url] of calon) {
    try {
      const j = await kirimKeRelay(url, body);
      if (!j.success) console.error('[tg] relay menolak: ' + j.message);
      if (lewat === 'config' && env) console.error('[tg] RELAY_URL di Vercel gagal, memakai js/config.js — perbarui/hapus RELAY_URL di Vercel. Galat: ' + galat);
      return kirim(ping ? { ok: true, relay: j, lewat } : null);
    } catch (e) { galat = (galat ? galat + ' | ' : '') + lewat + ': ' + (e && e.message); console.error('[tg] ' + lewat + ' gagal: ' + (e && e.message)); }
  }
  kirim(ping ? { ok: false, galat } : null);
};
