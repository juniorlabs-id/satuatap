// Vercel serverless: harga saham IDX tanpa kunci API.
//   GET /api/saham?k=BBCA,TLKM                     → { ok, data: { BBCA: { harga, prev, tanggal, sumber } }, galat }
//   GET /api/saham?hist=1&k=BBCA,TLKM&dari=2025-01-01 → { ok, data: { BBCA: { '2025-01-02': 9650, … } }, ihsg: { … } }
// Sumber berlapis: Yahoo Finance (query1 → query2) lalu Google Finance bila Yahoo menolak (sering 429 dari IP server).
// Di-cache CDN agar hemat kuota (harga 5 menit, riwayat 6 jam).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const sym = k => k === 'IHSG' ? '%5EJKSE' : encodeURIComponent(k + '.JK');
const tglWib = s => new Date((s + 7 * 3600) * 1000).toISOString().slice(0, 10);
const hariIni = () => tglWib(Math.floor(Date.now() / 1000));

async function ambil(url, ms, accept) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 8000);
  try { return await fetch(url, { signal: c.signal, headers: { 'User-Agent': UA, Accept: accept || 'application/json', 'Accept-Language': 'en-US,en;q=0.9' } }); }
  finally { clearTimeout(t); }
}
async function chart(k, q) {
  let err;
  for (const host of ['query1', 'query2']) {
    try {
      const r = await ambil('https://' + host + '.finance.yahoo.com/v8/finance/chart/' + sym(k) + '?' + q);
      if (!r.ok) throw new Error('Yahoo HTTP ' + r.status);
      const j = await r.json(), res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res || !res.meta) throw new Error('Yahoo: kode tidak dikenal');
      return res;
    } catch (e) { err = e; }
  }
  throw err;
}
async function yahoo(k) {
  const m = (await chart(k, 'range=5d&interval=1d')).meta;
  if (!m.regularMarketPrice) throw new Error('Yahoo: tidak ada harga');
  return { harga: Math.round(m.regularMarketPrice), prev: Math.round(m.chartPreviousClose || m.previousClose || 0), tanggal: m.regularMarketTime ? tglWib(m.regularMarketTime) : hariIni(), sumber: 'Yahoo Finance' };
}
async function google(k) {
  const r = await ambil('https://www.google.com/finance/quote/' + encodeURIComponent(k) + ':IDX?hl=en', 9000, 'text/html');
  if (!r.ok) throw new Error('Google HTTP ' + r.status);
  const h = await r.text(), m = h.match(/data-last-price="([\d.]+)"/);
  if (!m) throw new Error('Google: harga tidak ditemukan');
  const ts = h.match(/data-last-normal-market-timestamp="(\d+)"/), pv = h.match(/Previous close<\/div>[\s\S]{0,400}?>\s*(?:IDR|Rp)\s?([\d,]+(?:\.\d+)?)/);
  return { harga: Math.round(Number(m[1])), prev: pv ? Math.round(Number(pv[1].replace(/,/g, ''))) : 0, tanggal: ts ? tglWib(Number(ts[1])) : hariIni(), sumber: 'Google Finance' };
}
async function harga(k) {
  try { return await yahoo(k); }
  catch (e1) { try { return await google(k); } catch (e2) { throw new Error(e1.message + '; ' + e2.message); } }
}
async function riwayat(k, p1, p2) {
  const res = await chart(k, 'interval=1d&period1=' + p1 + '&period2=' + p2), q = res.indicators && res.indicators.quote && res.indicators.quote[0], o = {};
  (res.timestamp || []).forEach((t, i) => { const c = q && q.close && q.close[i]; if (c != null) o[tglWib(t)] = k === 'IHSG' ? Math.round(c * 100) / 100 : Math.round(c); });
  return o;
}

module.exports = async (req, res) => {
  const qs = req.query || {};
  const kode = String(qs.k || '').toUpperCase().split(',').map(s => s.replace(/[^A-Z0-9]/g, '')).filter(s => /^[A-Z]{4}[A-Z0-9]?$/.test(s)).slice(0, 40);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!kode.length) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, message: 'Parameter k kosong' })); }
  const data = {}, galat = {};
  if (qs.hist) {
    const dari = /^\d{4}-\d{2}-\d{2}$/.test(String(qs.dari || '')) ? String(qs.dari) : new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    const p1 = Math.floor(new Date(dari + 'T00:00:00+07:00').getTime() / 1000) - 7 * 86400, p2 = Math.floor(Date.now() / 1000) + 86400;
    let ihsg = {};
    await Promise.all(kode.concat('IHSG').map(async k => { try { const r = await riwayat(k, p1, p2); if (k === 'IHSG') ihsg = r; else data[k] = r; } catch (e) { galat[k] = String(e.message || e); } }));
    const ok = Object.keys(ihsg).length > 0;
    res.setHeader('Cache-Control', ok ? 's-maxage=21600, stale-while-revalidate=43200' : 's-maxage=600');
    return res.end(JSON.stringify({ ok, data, ihsg, galat, sumber: 'Yahoo Finance' }));
  }
  await Promise.all(kode.map(async k => { try { data[k] = await harga(k); } catch (e) { galat[k] = String(e.message || e); } }));
  const ok = Object.keys(data).length > 0;
  res.setHeader('Cache-Control', ok ? 's-maxage=300, stale-while-revalidate=600' : 'no-store');   // jangan cache kegagalan
  res.end(JSON.stringify({ ok, data, galat }));
};
