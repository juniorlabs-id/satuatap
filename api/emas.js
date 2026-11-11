/* Jembatan harga emas Antam — fungsi server Vercel (gratis, ikut repo ini).
 * Logam Mulia menolak permintaan dari server Google (HTTP 403), jadi relay Apps Script
 * mengambil harga lewat alamat ini: https://<situs-anda>/api/emas
 * Harga yang diambil: emas batangan 1 gram — tab "beli" (Harga Dasar, sebelum PPh 0,25%)
 * dan tab "jual" (buyback, sebelum potongan PPh). Hasil di-cache di edge Vercel 30 menit
 * sehingga situs Logam Mulia paling banyak dibuka 2× per 30 menit.
 * Tambahkan ?cek=1 untuk melihat diagnosis (kode HTTP & cuplikan halaman). */
const URL_BELI = ['https://www.logammulia.com/harga-hari-ini/emas?tab=beli', 'https://logammulia.com/harga-hari-ini/emas?tab=beli'];
const URL_JUAL = ['https://www.logammulia.com/harga-hari-ini/emas?tab=jual', 'https://logammulia.com/harga-hari-ini/emas?tab=jual'];
const JSON_BELI = 'https://www.logammulia.com/data-base-price/gold/sell/', JSON_JUAL = 'https://www.logammulia.com/data-base-price/gold/buy/';
const HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7', 'Referer': 'https://www.logammulia.com/', 'Cache-Control': 'no-cache'
};
const wajar = v => v >= 300000 && v <= 20000000;
const angka = s => Number(String(s || '').replace(/[^\d]/g, '')) || 0;
const rupiah = s => angka(String(s || '').replace(/,\d{1,2}(?!\d)/g, ''));
const teks = h => String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
function baris1gr(t, penanda) {
  let from = 0;
  for (const p of penanda) { const k = t.search(p); if (k >= 0) { from = k; break; } }
  const m = /(?:^|\s)1(?:[.,]0+)?\s*(?:gr|gram)\b\s*:?\s*Rp\.?\s?([\d.]{7,13}(?:,\d{1,2})?)/i.exec(t.slice(from));
  return m ? rupiah(m[1]) : 0;
}
const parseBeli = h => baris1gr(teks(h), [/Harga\s*Dasar/i, /Emas\s*Batangan(?!\s*Gift)/i, /Harga\s*\(?\s*\+?\s*Pajak/i]);
function parseJual(h) {
  const t = teks(h), v = baris1gr(t, [/Materai/i, /PPh\s*22?\s*1[.,]5/i, /Harga\s*Buy\s*back/i, /Buy\s*back/i]);
  if (v) return v;
  const m = /(?:buy\s*back|beli\s*kembali)[^R]{0,80}Rp\.?\s?([\d.]{7,13}(?:,\d{1,2})?)/i.exec(t);
  return m ? rupiah(m[1]) : 0;
}
function cari1gr(o, d = 0) {
  if (!o || typeof o !== 'object' || d > 6) return 0;
  if (!Array.isArray(o)) {
    const w = o.weight != null ? Number(o.weight) : NaN, wr = String(o.weight_raw || o.berat || o.gramasi || '');
    if (w === 1 || /^\s*1(\.0+)?\s*(gr|gram)/i.test(wr)) { const v = rupiah(o.base != null ? o.base : (o.price != null ? o.price : o.harga)); if (wajar(v)) return v; }
  }
  for (const k of Object.keys(o)) { const v = cari1gr(o[k], d + 1); if (v) return v; }
  return 0;
}
function cookies(r) {
  const list = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : String(r.headers.get('set-cookie') || '').split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
  const jar = {}; list.forEach(c => { const m = /^\s*([^=;\s]+)=([^;]*)/.exec(c); if (m) jar[m[1]] = m[2]; });
  return jar;
}
async function halaman(urls, log) {
  let last = '';
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: HDR, redirect: 'follow', signal: AbortSignal.timeout(12000) });
      log.push(u + ' → HTTP ' + r.status);
      if (r.ok) return { html: await r.text(), jar: cookies(r) };
      last = 'HTTP ' + r.status;
    } catch (e) { last = String(e && e.message || e); log.push(u + ' → ' + last); }
  }
  throw new Error(last);
}
async function lewatJson(pg, url, log) {
  const tok = (/<meta[^>]+name=["'](?:_token|csrf-token)["'][^>]+content=["']([^"']+)/i.exec(pg.html) || [])[1];
  if (!tok) { log.push('JSON: _token tidak ada'); return 0; }
  const hd = Object.assign({}, HDR, { Cookie: Object.entries(pg.jar).map(([k, v]) => k + '=' + v).join('; '), 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' });
  if (pg.jar['XSRF-TOKEN']) hd['X-XSRF-TOKEN'] = decodeURIComponent(pg.jar['XSRF-TOKEN']);
  try {
    const r = await fetch(url + '?_token=' + encodeURIComponent(tok), { headers: hd, signal: AbortSignal.timeout(12000) });
    log.push('JSON ' + url + ' → HTTP ' + r.status);
    return r.ok ? cari1gr(await r.json()) : 0;
  } catch (e) { log.push('JSON gagal: ' + e.message); return 0; }
}

module.exports = async (req, res) => {
  const cek = /[?&]cek=1/.test(req.url || ''), log = [];
  let beli = 0, buyback = 0, pb = null, pj = null, cuplikan = {};
  try { pb = await halaman(URL_BELI, log); beli = parseBeli(pb.html); } catch (e) {}
  try { pj = await halaman(URL_JUAL, log); buyback = parseJual(pj.html); } catch (e) {}
  if (!beli && pb) beli = await lewatJson(pb, JSON_BELI, log);
  if (!buyback && (pj || pb)) buyback = await lewatJson(pj || pb, JSON_JUAL, log);
  if (cek) [['beli', pb], ['jual', pj]].forEach(([k, p]) => { if (p) { const t = teks(p.html), i = t.search(/1\s*gr/i); cuplikan[k] = i >= 0 ? t.slice(Math.max(0, i - 200), i + 250) : t.slice(0, 450); } });
  const ok = wajar(beli) && wajar(buyback) && buyback < beli && buyback > beli * 0.8;
  const body = ok ? { success: true, data: { beli, buyback, sumber: 'Logam Mulia (Antam)', waktu: new Date().toISOString() } }
    : { success: false, message: 'Harga Antam tidak terbaca: ' + (log.join(' | ') || 'tanpa respons') + (beli || buyback ? ' (beli ' + beli + ', buyback ' + buyback + ')' : '') };
  if (cek) body.diagnosis = { log, cuplikan, beli, buyback };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', ok && !cek ? 'public, s-maxage=1800, stale-while-revalidate=3600' : 'no-store');
  res.statusCode = 200;
  res.end(JSON.stringify(body));
};
