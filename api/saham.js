// Vercel serverless: harga saham IDX (Yahoo Finance chart API, kode + ".JK"; IHSG = ^JKSE).
//   GET /api/saham?k=BBCA,TLKM                     → { ok, data: { BBCA: { harga, prev, tanggal } } }
//   GET /api/saham?hist=1&k=BBCA,TLKM&dari=2025-01-01 → { ok, data: { BBCA: { '2025-01-02': 9650, … } }, ihsg: { … } }
// Tanpa kunci API. Di-cache CDN agar hemat kuota (harga 5 menit, riwayat 6 jam).
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';
const sym = k => k === 'IHSG' ? '%5EJKSE' : encodeURIComponent(k + '.JK');
const tglWib = s => new Date((s + 7 * 3600) * 1000).toISOString().slice(0, 10);

async function chart(k, q) {
  const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + sym(k) + '?' + q, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json(), res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res || !res.meta) throw new Error('tidak ada data');
  return res;
}
async function harga(k) {
  const m = (await chart(k, 'range=5d&interval=1d')).meta;
  if (!m.regularMarketPrice) throw new Error('tidak ada harga');
  return { harga: Math.round(m.regularMarketPrice), prev: Math.round(m.chartPreviousClose || m.previousClose || 0), tanggal: m.regularMarketTime ? tglWib(m.regularMarketTime) : '' };
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
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=43200');
    return res.end(JSON.stringify({ ok: Object.keys(ihsg).length > 0, data, ihsg, galat, sumber: 'Yahoo Finance' }));
  }
  await Promise.all(kode.map(async k => { try { data[k] = await harga(k); } catch (e) { galat[k] = String(e.message || e); } }));
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.end(JSON.stringify({ ok: Object.keys(data).length > 0, data, galat, sumber: 'Yahoo Finance' }));
};
