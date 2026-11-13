// Vercel serverless: harga saham IDX terakhir (Yahoo Finance chart API, kode + ".JK").
// GET /api/saham?k=BBCA,TLKM  →  { ok, data: { BBCA: { harga, prev, tanggal } } }
// Tidak butuh kunci API. Hasil di-cache CDN 5 menit agar hemat kuota.
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';

async function satu(kode) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(kode + '.JK') + '?range=5d&interval=1d';
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  const m = res && res.meta;
  if (!m || !m.regularMarketPrice) throw new Error('tidak ada data');
  const ts = m.regularMarketTime ? new Date((m.regularMarketTime + 7 * 3600) * 1000).toISOString().slice(0, 10) : '';
  return { harga: Math.round(m.regularMarketPrice), prev: Math.round(m.chartPreviousClose || m.previousClose || 0), tanggal: ts };
}

module.exports = async (req, res) => {
  const kode = String((req.query && req.query.k) || '').toUpperCase().split(',').map(s => s.replace(/[^A-Z0-9]/g, '')).filter(s => /^[A-Z]{4}[A-Z0-9]?$/.test(s)).slice(0, 40);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!kode.length) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, message: 'Parameter k kosong' })); }
  const data = {}, galat = {};
  await Promise.all(kode.map(async k => { try { data[k] = await satu(k); } catch (e) { galat[k] = String(e.message || e); } }));
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.end(JSON.stringify({ ok: Object.keys(data).length > 0, data, galat, sumber: 'Yahoo Finance' }));
};
