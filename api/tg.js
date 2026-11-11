/* Jembatan webhook Telegram → relay Apps Script.
 * Telegram butuh jawaban HTTP 200 yang cepat; Apps Script menjawab dengan pengalihan (302)
 * sehingga Telegram akan mengirim ulang. Fungsi ini menerima update, meneruskannya ke relay
 * (aksi tg.update) bersama rahasia dari header Telegram, lalu menjawab 200.
 * Perlu Environment Variable Vercel: RELAY_URL = alamat /exec relay JuniorLabs.
 * Rahasia (TELEGRAM_SECRET) hanya disimpan & diperiksa di relay. */
module.exports = async (req, res) => {
  const ok = () => { res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); };
  if (req.method !== 'POST') { res.statusCode = 200; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end('SatuAtap · webhook Telegram aktif' + (process.env.RELAY_URL ? '' : ' — RELAY_URL belum diisi')); }
  const relay = process.env.RELAY_URL, secret = req.headers['x-telegram-bot-api-secret-token'] || '';
  if (!relay || !secret) return ok();
  let update = req.body;
  if (!update || typeof update === 'string') { try { update = JSON.parse(update || await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); })); } catch (e) { return ok(); } }
  try {
    await fetch(relay, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', body: JSON.stringify({ action: 'tg.update', data: { secret, update } }), signal: AbortSignal.timeout(25000) });
  } catch (e) { /* relay lambat/gagal: Telegram tidak perlu mengulang, pesan bisa dikirim ulang pengguna */ }
  ok();
};
