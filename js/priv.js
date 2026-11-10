/* ============================================================
 * Priv — catatan "uang pribadi" dienkripsi di perangkat dengan PIN.
 * Nominal tetap terbaca (untuk total keluarga); catatan & tag hanya
 * bisa dibaca pemiliknya. Kunci tidak pernah meninggalkan perangkat.
 * ============================================================ */
(function () {
  const P = { key: null, plain: {}, seen: {} };
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const me = () => (Store.me && Store.me.email) || '';
  const settingKey = () => 'pin_' + me();
  const idbKey = () => 'priv:' + Store.ns() + me();

  P.supported = () => !!(window.crypto && crypto.subtle);
  P.info = () => { try { return JSON.parse(Store.setting(settingKey(), '') || 'null'); } catch (e) { return null; } };
  P.has = () => !!P.info();
  P.unlocked = () => !!P.key;

  async function derive(pin, salt) {
    const base = await crypto.subtle.importKey('raw', te.encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encWith(key, text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(String(text)));
    return 'enc1:' + b64(iv) + ':' + b64(ct);
  }
  async function decWith(key, s) {
    const p = String(s).split(':');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p[1]) }, key, unb64(p[2]));
    return td.decode(pt);
  }
  P.isEnc = s => typeof s === 'string' && s.indexOf('enc1:') === 0;
  P.enc = async (text) => (text ? encWith(P.key, text) : '');

  P.loadKey = async () => { if (!P.supported() || !me()) return; const k = await Store.IDB.get(idbKey()); if (k) P.key = k; };
  P.setup = async (pin) => {
    const salt = crypto.getRandomValues(new Uint8Array(16)), key = await derive(pin, salt);
    Store.setSetting(settingKey(), JSON.stringify({ s: b64(salt), c: await encWith(key, 'satuatap') }));
    P.key = key; await Store.IDB.set(idbKey(), key);
  };
  P.unlock = async (pin) => {
    const inf = P.info(); if (!inf) return false;
    try { const key = await derive(pin, unb64(inf.s)); if ((await decWith(key, inf.c)) !== 'satuatap') return false; P.key = key; await Store.IDB.set(idbKey(), key); P.seen = {}; P.decryptAll(); return true; }
    catch (e) { return false; }
  };
  P.lock = async () => { P.key = null; P.plain = {}; P.seen = {}; await Store.IDB.del(idbKey()); };
  /** Ganti PIN: enkripsi ulang semua catatan pribadi milik saya. */
  P.change = async (oldPin, newPin) => {
    if (!(await P.unlock(oldPin))) return false;
    const oldKey = P.key, mine = Store.t.Transaksi.filter(t => (P.isEnc(t.catatan) || P.isEnc(t.tag)) && own(t));
    const salt = crypto.getRandomValues(new Uint8Array(16)), key = await derive(newPin, salt);
    const ops = [];
    for (const t of mine) {
      const row = { id: t.id };
      if (P.isEnc(t.catatan)) row.catatan = await encWith(key, await decWith(oldKey, t.catatan).catch(() => ''));
      if (P.isEnc(t.tag)) row.tag = await encWith(key, await decWith(oldKey, t.tag).catch(() => ''));
      ops.push({ op: 'upsert', t: 'Transaksi', row });
    }
    ops.push({ op: 'upsert', t: 'Pengaturan', row: { id: settingKey(), nilai: JSON.stringify({ s: b64(salt), c: await encWith(key, 'satuatap') }) } });
    Store.commit(ops); P.key = key; await Store.IDB.set(idbKey(), key); P.seen = {};
    return true;
  };
  const own = t => { const k = Store.byId.Kategori[t.kategoriId]; return !!(k && k.pribadi && k.pribadi === me()); };

  /** Dekripsi di latar belakang; render ulang bila ada yang baru terbaca. */
  P.decryptAll = U.debounce(async () => {
    if (!P.key) return;
    let n = 0;
    for (const t of Store.t.Transaksi) {
      if (!(P.isEnc(t.catatan) || P.isEnc(t.tag)) || !own(t)) continue;
      const sig = t.catatan + '|' + t.tag; if (P.seen[t.id] === sig) continue;
      P.seen[t.id] = sig;
      const o = {};
      try { if (P.isEnc(t.catatan)) o.catatan = await decWith(P.key, t.catatan); if (P.isEnc(t.tag)) o.tag = await decWith(P.key, t.tag); n++; } catch (e) { o.catatan = '🔒'; }
      P.plain[t.id] = o;
    }
    if (n && window.UI && App.ready) UI.render();
  }, 150);

  /** Teks yang ditampilkan untuk catatan/tag transaksi. */
  P.text = (t, f) => {
    const v = t[f || 'catatan'];
    if (!P.isEnc(v)) return v || '';
    const p = P.plain[t.id]; if (p && p[f || 'catatan'] != null) return p[f || 'catatan'];
    return own(t) ? '🔒 terkunci' : '';
  };
  window.Priv = P;
})();
