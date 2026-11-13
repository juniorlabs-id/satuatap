/* Jembatan webhook Telegram → relay Apps Script.
 * Telegram butuh jawaban HTTP 200 yang cepat; Apps Script menjawab dengan pengalihan (302)
 * sehingga Telegram akan mengirim ulang. Fungsi ini menerima update, meneruskannya ke relay
 * (aksi tg.update) bersama rahasia dari header Telegram, lalu menjawab 200.
 * Perlu Environment Variable Vercel: RELAY_URL = alamat /exec relay JuniorLabs.
 * Rahasia (TELEGRAM_SECRET) hanya disimpan & diperiksa di relay.
 * Diagnosis: fungsi cekTelegram() di relay mengirim {__ping:1} ke sini untuk menguji jalur Vercel → relay. */
module.exports = async (req, res) => {
  const kirim = (o) => { res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o || { ok: true })); };
  const relay = String(process.env.RELAY_URL || '').trim();
  if (req.method !== 'POST') { res.statusCode = 200; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end('SatuAtap · webhook Telegram aktif' + (relay ? '' : ' — RELAY_URL belum diisi')); }
  const secret = req.headers['x-telegram-bot-api-secret-token'] || '';
  if (!relay) { console.error('[tg] RELAY_URL belum diisi di Environment Variables Vercel'); return kirim(); }
  if (!secret) { console.error('[tg] permintaan tanpa header rahasia Telegram — diabaikan'); return kirim(); }
  let update = req.body;
  if (!update || typeof update === 'string') { try { update = JSON.parse(update || await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); })); } catch (e) { return kirim(); } }
  const ping = !!(update && update.__ping);
  try {
    const r = await fetch(relay, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
      body: JSON.stringify(ping ? { action: 'tg.ping', data: { secret } } : { action: 'tg.update', data: { secret, update } }), signal: AbortSignal.timeout(25000) });
    const teks = await r.text(); let j = null; try { j = JSON.parse(teks); } catch (e) {}
    if (!j) { console.error('[tg] relay tidak menjawab JSON (HTTP ' + r.status + '): ' + teks.slice(0, 160)); if (ping) return kirim({ ok: false, galat: 'Relay menjawab HTTP ' + r.status + ' bukan JSON — RELAY_URL salah atau relay belum dideploy untuk "Siapa saja".' }); }
    else if (!j.success) console.error('[tg] relay menolak: ' + j.message);
    if (ping) return kirim({ ok: true, relay: j });
  } catch (e) {
    console.error('[tg] gagal menghubungi relay: ' + (e && e.message));
    if (ping) return kirim({ ok: false, galat: String(e && e.message || e) });
  }
  kirim();
};
