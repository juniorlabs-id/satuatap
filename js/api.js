/* API — fetch ke GAS dengan timeout, retry, reqId idempoten. Mode demo memakai DemoServer lokal. */
(function () {
  const READ = /^(info|auth\.config|boot|sync|rahasia\.status)$/;
  const Perf = { rows: [], add(a, total, server) { this.rows.push({ a, total, server, at: Date.now() }); if (this.rows.length > 100) this.rows.shift(); }, table() { console.table(this.rows.slice(-30)); } };
  window.Perf = Perf;

  async function once(url, action, data, timeout, reqId) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
    try {
      const res = await fetch(url, {
        method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token: Store.token || '', reqId, data: data || {} })
      });
      const text = await res.text();
      try { const j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms); return j; }
      catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429, message: 'Server membalas tidak terduga (HTTP ' + res.status + '). Pastikan URL /exec benar & sudah di-deploy untuk "Anyone".' }; }
    } catch (err) {
      return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi terputus.' };
    } finally { clearTimeout(timer); }
  }

  const API = {
    async call(action, data, opt) {
      opt = opt || {};
      if (Store.mode === 'demo') {
        await new Promise(r => setTimeout(r, 60));
        return DemoServer.handle(action, data || {});
      }
      const url = opt.url || Store.gasUrl;
      if (!url) return { success: false, message: 'URL backend belum diisi.' };
      const isRead = READ.test(action);
      const reqId = isRead ? '' : (opt.reqId || U.uid('r'));
      const tries = isRead ? 3 : 2;
      let res;
      for (let i = 0; i < tries; i++) {
        if (i) { await new Promise(r => setTimeout(r, 1200 * i)); if (navigator.onLine === false) break; }
        res = await once(url, action, data, isRead ? (i ? 40000 : 25000) : 60000, reqId);
        if (res.success || !res.retryable) break;
      }
      if (!res.success && res.data && res.data.code === 'AUTH' && action !== 'auth.darurat') App.sessionExpired();
      return res;
    },
    warm() { if (Store.mode === 'live' && Store.gasUrl) fetch(Store.gasUrl + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); }
  };
  window.API = API;
})();
