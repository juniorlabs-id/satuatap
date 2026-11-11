/* Jembatan harga emas Antam — fungsi server Vercel (gratis, ikut repo ini).
 * Logam Mulia menolak permintaan dari server Google (HTTP 403), jadi relay Apps Script
 * mengambil harga lewat alamat ini: https://<situs-anda>/api/emas
 * Harga yang diambil: emas batangan 1 gram — tab "beli" (Harga Dasar, sebelum PPh 0,25%)
 * dan tab "jual" (buyback, sebelum potongan PPh). Hasil di-cache di edge Vercel 30 menit
 * sehingga situs Logam Mulia paling banyak dibuka 2× per 30 menit.
 * Bila logammulia.com menolak, dibaca dari situs yang menyalin harga resmi Antam (Kontan, harga-emas.org).
 * Harga merek lain (UBS, Galeri24, Lotus Archi, Emaskita) dibaca dari galeri24.co.id.
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
/* Opsional: layanan perantara (mis. ScraperAPI/Scrape.do) bila Logam Mulia menolak semua server.
 * Isi Environment Variable Vercel EMAS_FETCH_VIA dengan templat alamat yang memuat {url}, contoh:
 *   https://api.scraperapi.com/?api_key=KUNCI_ANDA&country_code=id&url={url}
 * Kunci hanya disimpan di Vercel (Settings › Environment Variables), tidak pernah di repo. */
const VIA = process.env.EMAS_FETCH_VIA || '';
async function halaman(urls, log) {
  let last = '';
  if (VIA && /\{url\}/.test(VIA)) {
    try {
      const r = await fetch(VIA.replace('{url}', encodeURIComponent(urls[0])), { signal: AbortSignal.timeout(25000) });
      log.push('perantara → HTTP ' + r.status);
      if (r.ok) return { html: await r.text(), jar: {} };
    } catch (e) { log.push('perantara → ' + (e && e.message)); }
  }
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

/* Cadangan bila logammulia.com menolak server: situs yang menyalin harga resmi Antam setiap hari.
 * Hanya baris Antam/Logam Mulia yang dibaca, jadi angkanya tetap angka resmi Antam (bisa terlambat beberapa jam). */
const CERMIN = [
  { nama: 'Kontan', url: 'https://pusatdata.kontan.co.id/amp/market/logam_mulia', baca(h) {
      const t = teks(h), g = /(\d{2}\/\d{2}\/\d{4})\s*GOLD\s*Rp\.?\s?([\d.]{7,13})/i.exec(t);
      if (!g) return null;
      const b = new RegExp(g[1].replace(/\//g, '\\/') + '\\s*BUY\\s*BACK\\s*Rp\\.?\\s?([\\d.]{7,13})', 'i').exec(t) || /BUY\s*BACK\s*Rp\.?\s?([\d.]{7,13})/i.exec(t);
      const [d, m, y] = g[1].split('/');
      return b ? { beli: rupiah(g[2]), buyback: rupiah(b[1]), tanggal: y + '-' + m + '-' + d } : null;
    } },
  { nama: 'harga-emas.org', url: 'https://harga-emas.org/', baca(h) {
      const t = teks(h), k = t.search(/Antam|Logam\s*Mulia/i); if (k < 0) return null;
      const s = t.slice(k), beli = baris1gr(s, []), m = /(?:buy\s*back|beli\s*kembali)[^R]{0,80}Rp\.?\s?([\d.]{7,13}(?:,\d{1,2})?)/i.exec(s);
      return beli && m ? { beli, buyback: rupiah(m[1]) } : null;
    } }
];
async function lewatCermin(log, cek, cuplikan) {
  for (const c of CERMIN) {
    try {
      const r = await fetch(c.url, { headers: HDR, redirect: 'follow', signal: AbortSignal.timeout(12000) });
      log.push(c.nama + ' → HTTP ' + r.status);
      if (!r.ok) continue;
      const h = await r.text(); if (cek) cuplikan[c.nama] = teks(h).slice(0, 600);
      const v = c.baca(h);
      if (v && wajar(v.beli) && wajar(v.buyback) && v.buyback < v.beli && v.buyback > v.beli * 0.8) return Object.assign(v, { via: c.nama });
      log.push(c.nama + ': baris Antam tidak terbaca');
    } catch (e) { log.push(c.nama + ' → ' + (e && e.message)); }
  }
  return null;
}

/* Harga merek lain (UBS, Galeri24, Lotus Archi, Emaskita, …) dari halaman resmi Galeri24 (Pegadaian).
 * Harga ANTAM di Galeri24 TIDAK dipakai — Antam tetap mengikuti logammulia.com. */
const URL_G24 = 'https://galeri24.co.id/harga-emas';
const kunciMerek = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const MEREK_RE = /\b(Antam(?:\s+[A-Za-z]+){0,3}|UBS(?:\s+[A-Za-z]+){0,2}|Galeri\s*24(?:\s+[A-Za-z]+){0,2}|Lotus\s*Archi(?:\s+[A-Za-z]+){0,2}|Emas\s*Kita|EmasKita|Baby\s*Galeri(?:\s+[A-Za-z]+){0,2}|Dinar\s*G\s*24|King\s*Halim)\s*(?:Updated|Diperbarui|Update)\s*:?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})?/gi;
const BULAN = { jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05', jun: '06', jul: '07', agu: '08', aug: '08', ags: '08', sep: '09', okt: '10', oct: '10', nov: '11', des: '12', dec: '12' };
function tglTeks(s) { const m = /(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/.exec(s || ''); return m && BULAN[m[2].toLowerCase()] ? m[3] + '-' + BULAN[m[2].toLowerCase()] + '-' + ('0' + m[1]).slice(-2) : ''; }
function parseG24(html) {
  const t = teks(html), tanda = [], out = {};
  let m; MEREK_RE.lastIndex = 0;
  while ((m = MEREK_RE.exec(t))) tanda.push({ nama: m[1].replace(/\s+/g, ' ').trim(), tgl: tglTeks(m[2]), i: m.index, akhir: MEREK_RE.lastIndex });
  tanda.forEach((x, k) => {
    const seg = t.slice(x.akhir, k + 1 < tanda.length ? tanda[k + 1].i : x.akhir + 3000);
    const r = /(?:^|\s)1(?:[.,]0+)?\s*(?:gr|gram)\s+(?:Rp\.?\s?)?([\d.]{6,13})\s+(?:Rp\.?\s?)?([\d.]{6,13})/i.exec(seg);
    const key = kunciMerek(x.nama);
    if (!r || out[key]) return;
    const beli = rupiah(r[1]), buyback = rupiah(r[2]);
    if (wajar(beli) && wajar(buyback) && buyback < beli && buyback > beli * 0.75) out[key] = { nama: x.nama, beli, buyback, tanggal: x.tgl };
  });
  return out;
}
async function merekLain(log, cek, cuplikan) {
  try {
    const r = await fetch(URL_G24, { headers: Object.assign({}, HDR, { Referer: 'https://galeri24.co.id/' }), redirect: 'follow', signal: AbortSignal.timeout(12000) });
    log.push('Galeri24 → HTTP ' + r.status);
    if (!r.ok) return {};
    const h = await r.text(), o = parseG24(h);
    if (cek) { const t = teks(h), i = t.search(/Updated|Diperbarui/i); cuplikan.Galeri24 = i >= 0 ? t.slice(Math.max(0, i - 120), i + 700) : t.slice(0, 700); }
    log.push('Galeri24: ' + (Object.keys(o).join(', ') || 'tabel merek tidak terbaca'));
    return o;
  } catch (e) { log.push('Galeri24 → ' + (e && e.message)); return {}; }
}

module.exports = async (req, res) => {
  const cek = /[?&]cek=1/.test(req.url || ''), log = [];
  let beli = 0, buyback = 0, pb = null, pj = null, cuplikan = {};
  try { pb = await halaman(URL_BELI, log); beli = parseBeli(pb.html); } catch (e) {}
  try { pj = await halaman(URL_JUAL, log); buyback = parseJual(pj.html); } catch (e) {}
  if (!beli && pb) beli = await lewatJson(pb, JSON_BELI, log);
  if (!buyback && (pj || pb)) buyback = await lewatJson(pj || pb, JSON_JUAL, log);
  if (cek) [['beli', pb], ['jual', pj]].forEach(([k, p]) => { if (p) { const t = teks(p.html), i = t.search(/1\s*gr/i); cuplikan[k] = i >= 0 ? t.slice(Math.max(0, i - 200), i + 250) : t.slice(0, 450); } });
  let ok = wajar(beli) && wajar(buyback) && buyback < beli && buyback > beli * 0.8, sumber = 'Logam Mulia (Antam)', tanggal = '';
  if (!ok || cek) { const v = await lewatCermin(log, cek, cuplikan); if (v && !ok) { ok = true; beli = v.beli; buyback = v.buyback; tanggal = v.tanggal || ''; sumber = 'Logam Mulia (Antam) · via ' + v.via; } }
  const merek = await merekLain(log, cek, cuplikan);
  delete merek.ANTAM;                                     // Antam hanya dari Logam Mulia
  const adaMerek = Object.keys(merek).length > 0;
  const body = ok ? { success: true, data: { beli, buyback, sumber, tanggal, merek, waktu: new Date().toISOString() } }
    : adaMerek ? { success: false, message: 'Harga Antam tidak terbaca: ' + log.join(' | '), data: { merek, waktu: new Date().toISOString() } }
    : { success: false, message: 'Harga Antam tidak terbaca: ' + (log.join(' | ') || 'tanpa respons') + (beli || buyback ? ' (beli ' + beli + ', buyback ' + buyback + ')' : '') };
  if (cek) body.diagnosis = { log, cuplikan, beli, buyback, merek };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', (ok || adaMerek) && !cek ? 'public, s-maxage=1800, stale-while-revalidate=3600' : 'no-store');
  res.statusCode = 200;
  res.end(JSON.stringify(body));
};
