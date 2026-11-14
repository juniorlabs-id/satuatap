/* Jembatan webhook Fonnte (WhatsApp) → Skrip Pendamping keluarga (Apps Script).
 * Aplikasi web Apps Script selalu menjawab dengan pengalihan (302); sebagian pengirim webhook
 * (termasuk pemeriksaan alamat oleh Fonnte) menganggapnya gagal. Fungsi ini menjawab 200 langsung,
 * lalu meneruskan pesan ke Pendamping:
 *   https://<situs>/api/wa?id=<ID deployment Pendamping>&k=<WA_KUNCI>
 * Hanya meneruskan ke script.google.com/macros/s/<id>/exec — bukan proxy bebas. Tidak menyimpan apa pun;
 * kunci k diperiksa oleh Pendamping. */
module.exports = async (req, res) => {
  const jawab = (kode, teks) => { res.statusCode = kode; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(teks); };
  const q = req.query || {}, id = String(q.id || ''), k = String(q.k || '');
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(id) || !/^[A-Za-z0-9]{8,80}$/.test(k)) return jawab(req.method === 'POST' ? 200 : 400, 'SatuAtap · jembatan WhatsApp. Alamat harus berbentuk /api/wa?id=<ID deployment Pendamping>&k=<kunci>.');
  const tujuan = 'https://script.google.com/macros/s/' + id + '/exec?k=' + encodeURIComponent(k);
  try {
    if (req.method !== 'POST' && q.uji) {
      // Uji jalur POST: kirim pesan kosong tiruan → Pendamping mencatatnya di "Kiriman webhook terakhir" (cekWA)
      const r = await fetch(tujuan, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: '', message: '', uji: true }), redirect: 'follow', signal: AbortSignal.timeout(25000) }), t = await r.text();
      return jawab(200, /^ok/.test(t) ? '✅ Uji terkirim ke Pendamping. Jalankan cekWA: harus muncul 1 baris "diabaikan: bukan pesan teks". Bila muncul, jalur kita beres — yang belum mengirim adalah Fonnte.' : /forbidden/.test(t) ? '❌ Pendamping menolak: kunci k salah.' : '❌ Pendamping tidak menerima POST (HTTP ' + r.status + '). ID deployment salah atau akses bukan "Siapa saja".');
    }
    if (req.method !== 'POST') {
      const r = await fetch(tujuan, { redirect: 'follow', signal: AbortSignal.timeout(15000) }), t = await r.text();
      return jawab(200, /Alamat webhook BENAR/.test(t) ? '✅ Jembatan WhatsApp aktif & tersambung ke Pendamping. Tempel alamat ini di fonnte.com › Device › Edit › Webhook.' : /Kunci \?k= SALAH/.test(t) ? '❌ Kunci k salah — salin ulang dari cekWA.' : '❌ Pendamping tidak menjawab dengan benar (ID deployment salah, akses bukan "Siapa saja", atau kode belum versi terbaru).');
    }
    let body = req.body, tipe = 'application/json';
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) body = JSON.stringify(body);
    else if (body == null || body === '') body = await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); });
    else { body = String(body); tipe = req.headers['content-type'] || tipe; }
    await fetch(tujuan, { method: 'POST', headers: { 'Content-Type': tipe }, body, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  } catch (e) { console.error('[wa] gagal meneruskan: ' + (e && e.message)); }
  jawab(200, 'ok');
};
