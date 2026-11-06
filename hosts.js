





let connectorPrefs = {}, connectorHere = false;
const tellConnector = what => {
  Object.assign(connectorPrefs, what);
  if (connectorHere) window.fetch("/connector/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(what) }).catch(() => {});
};
const Fan = {
  store: null, lines: null, trader: null, reads: null, traderWhy: "",   
  account: null,   
  screens: null,   
  openTelecast: url => { window.open(url, "_blank", "noopener"); },   
  setMarket: on => { tellConnector({ market: on }); },   
  startLink: "fan-connector://start",   
  localFan: "http://localhost:5180/",   
  connectorUp: () => (Fan.hostHello ? Fan.hostHello() : window.fetch(Fan.localFan + "connector/hello", { mode: "no-cors" })),
  setLeagues: list => { tellConnector({ leagues: list }); },   
  setRoutes: r => { tellConnector(r); }   
};


function browserStore(idb, name = "fan") {
  const opened = new Promise((ok, no) => {
    const r = idb.open(name, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("records"); r.result.createObjectStore("local"); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
  const watchers = new Set(), changes = new Set();   
  const heard = col => { watchers.forEach(w => { if (w.col === col) w.fire(); }); changes.forEach(fn => fn(col)); };
  const channel = window.BroadcastChannel ? new window.BroadcastChannel(name + "-records") : null;   
  if (channel) channel.onmessage = e => heard(e.data);
  const changed = cols => cols.forEach(c => { heard(c); if (channel) channel.postMessage(c); });
  const plain = v => JSON.parse(JSON.stringify(v));
  const asked = q => new Promise((ok, no) => { q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
  
  const inTransaction = async (store, access, work) => {
    const tx = (await opened).transaction(store, access);
    let out;
    return new Promise((ok, no) => {
      tx.oncomplete = () => ok(out);
      tx.onabort = tx.onerror = () => no(tx.error || new Error("not saved"));
      Promise.resolve(work(tx.objectStore(store), tx)).then(v => { out = v; }, e => { try { tx.abort(); } catch (x) {} no(e); });
    });
  };
  const inCol = col => window.IDBKeyRange.bound([col], [col, []]);
  const rowsOf = col => inTransaction("records", "readonly", s => new Promise((ok, no) => {
    const rows = [], q = s.openCursor(inCol(col));
    q.onsuccess = () => { const c = q.result; if (!c) return ok(rows); rows.push({ id: c.key[1], data: c.value }); c.continue(); };
    q.onerror = () => no(q.error);
  }));
  const get = async (col, id) => { const d = await inTransaction("records", "readonly", s => asked(s.get([col, id]))); return d === undefined ? null : d; };
  const set = async (col, id, data) => { const d = plain(data); await inTransaction("records", "readwrite", s => { s.put(d, [col, id]); }); changed([col]); };
  const newId = () => Array.from(window.crypto.getRandomValues(new Uint8Array(20)), b => (b % 36).toString(36)).join("");
  const follow = (col, tell, fail) => { const w = { col, fire: () => tell().catch(e => { if (fail) fail(e); }) }; watchers.add(w); w.fire(); return () => watchers.delete(w); };
  return {
    get, set,
    list: rowsOf,
    add: (col, data) => set(col, newId(), data),
    update: async (col, id, patch) => {
      const p = plain(patch);
      await inTransaction("records", "readwrite", async s => {
        const q = s.get([col, id]);
        await new Promise((ok, no) => {
          q.onerror = () => no(q.error);
          q.onsuccess = () => { if (q.result === undefined) return no(new Error("not found")); s.put({ ...q.result, ...p }, [col, id]); ok(); };
        });
      });
      changed([col]);
    },
    del: async (col, id) => { await inTransaction("records", "readwrite", s => { s.delete([col, id]); }); changed([col]); },
    watch: (col, fn, fail) => follow(col, async () => { const r = await rowsOf(col); fn(r); }, fail),
    watchDoc: (col, id, fn, fail) => follow(col, async () => { const r = await get(col, id); fn(r); }, fail),
    onChange: fn => { changes.add(fn); return () => changes.delete(fn); },
    dump: async () => ({ fan: 1, at: Date.now(), records: await inTransaction("records", "readonly", s => new Promise((ok, no) => {
      const rows = [], q = s.openCursor();
      q.onsuccess = () => { const c = q.result; if (!c) return ok(rows); rows.push({ col: c.key[0], id: c.key[1], data: c.value }); c.continue(); };
      q.onerror = () => no(q.error);
    })) }),
    
    restore: async file => {
      const rows = file && file.fan === 1 && file.records;
      if (!Array.isArray(rows) || rows.some(r => !r || typeof r.col !== "string" || typeof r.id !== "string" || r.data === undefined)) throw new Error("not a Fan export");
      await inTransaction("records", "readwrite", s => { rows.forEach(r => s.put(plain(r.data), [r.col, r.id])); });
      changed([...new Set(rows.map(r => r.col))]);
      return rows.length;
    },
    kept: async key => { const v = await inTransaction("local", "readonly", s => asked(s.get(key))); return v === undefined ? null : v; },
    keep: (key, value) => inTransaction("local", "readwrite", s => { if (value == null) s.delete(key); else s.put(value, key); })   
  };
}

function connectorStore(ask) {
  const call = async (op, col, id, data) => {
    const r = await (await ask("/connector/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, col, id, data }) })).json();
    if (!r.ok) throw new Error(r.error);
    return r.result;
  };
  const watchers = new Set();
  let after = null, polling = false;
  const poll = async () => {
    while (watchers.size) {
      try {
        const c = await (await ask("/connector/changes" + (after == null ? "" : "?after=" + after))).json();
        const hadNone = after == null;
        after = c.seq;
        if (!hadNone) watchers.forEach(w => { if (c.all || c.cols.includes(w.col)) w.fire(); });
      } catch (e) { await new Promise(r => setTimeout(r, 5000)); }   
    }
    polling = false;
  };
  const follow = (col, tell, fail) => {
    const w = { col, fire: () => tell().catch(e => { if (fail) fail(e); }) };
    watchers.add(w);
    if (!polling) { polling = true; poll(); }
    w.fire();
    return () => watchers.delete(w);
  };
  return {
    get: (col, id) => call("get", col, id),
    list: col => call("list", col),
    set: (col, id, data) => call("set", col, id, data),
    add: (col, data) => call("add", col, "", data),
    update: (col, id, patch) => call("update", col, id, patch),
    del: (col, id) => call("del", col, id),
    watch: (col, fn, fail) => follow(col, async () => fn(await call("list", col)), fail),
    watchDoc: (col, id, fn, fail) => follow(col, async () => fn(await call("get", col, id)), fail)
  };
}

const connectorTrader = (ask, hi) => ({
  hello: async () => hi,
  call: async (tool, args) => {
    let r;
    try { r = await (await ask("/connector/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool, args }) })).json(); }
    catch (e) { throw Object.assign(new Error("The connector isn't answering"), { code: "server_unavailable", retryable: true, keepTrying: true }); }   
    if (!r.ok) throw Object.assign(new Error(r.error), { code: r.error });
    return r.result;
  }
});

Fan.connectStore = async () => {
  const hi = !window.fetch ? null : await window.fetch("/connector/hello").then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (hi && hi.store) {
    Fan.store = Fan.lines = connectorStore(window.fetch);
    connectorHere = true;
    tellConnector(connectorPrefs);
  }
  if (hi) Fan.hostHello = () => window.fetch("/connector/hello").then(r => r.json());
  if (hi && hi.login != null) Fan.setLogin = async on => {   
    const r = await (await window.fetch("/connector/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }) })).json();
    if (!r.ok) throw new Error(r.error);
  };
  if (hi && hi.stop) Fan.stopConnector = async () => {   
    const r = await (await window.fetch("/connector/stop", { method: "POST" })).json();
    if (!r.ok) throw new Error(r.error);
  };
  if (hi && hi.page) Fan.pageChoice = async action => {   
    const r = await (await window.fetch("/connector/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })).json();
    if (!r.ok) throw new Error(r.error);
    return r.page;
  };
  if (hi && hi.update) Fan.updateConnector = async () => {   
    const r = await (await window.fetch("/connector/update", { method: "POST" })).json();
    if (!r.ok) throw new Error(r.error);
  };
  if (hi && hi.algos) Fan.algos = {   
    read: after => window.fetch("/connector/algos" + (after == null ? "" : "?after=" + after)).then(r => r.json()),
    ask: q => window.fetch("/connector/algos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) }).then(r => r.json())
  };
  if (hi && hi.door && hi.wall) {   
    const post = (path, body) => window.fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
    Fan.wall = { get: () => window.fetch("/connector/wall").then(r => r.json()), act: body => post("/connector/wall", body) };
    Fan.door = { info: hi.door, here: !!hi.fromRemote, set: (kind, on) => post("/connector/door", { kind, on }).then(r => { if (r.door) Fan.door.info = r.door; if (!r.ok) throw new Error(r.error); return r.door; }) };
    if (!hi.fromRemote) Fan.screen = { of: hi.screenOf || null, name: hi.machineName || "", set: body => post("/connector/screen", body).then(r => { if (!r.ok) throw new Error(r.error); Fan.screen.of = r.screenOf || null; return r.screenOf; }), find: () => post("/connector/screen", { op: "find" }).then(r => { if (!r.ok) throw new Error(r.error); return r.walls || []; }) };
  }
  if (hi && hi.telecast) {
    const send =(path, body) => window.fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
    Fan.openTelecast = (url, pref) => { send("/connector/telecast", { url, pref }).then(r => { if (!r.opened && !r.refused) window.open(url, "_blank", "noopener"); }, () => window.open(url, "_blank", "noopener")); };
    if (hi.hdhomerun) {   
      Fan.hdhrLineup = ip => send("/connector/hdhomerun/lineup", { ip });
      Fan.playHdhr = (ip, channel) => send("/connector/hdhomerun/play", { ip, channel });
    }
    Fan.captureTelecast = () => window.fetch("/connector/telecast/capture", { method: "POST" }).then(r => r.json());   
    if (hi.screens) Fan.screens = { list: () => window.fetch("/connector/screens").then(r => r.json()) };
  }
  else if (window.indexedDB) {   
    Fan.store = browserStore(window.indexedDB);
    if (window.navigator && window.navigator.storage && window.navigator.storage.persist) window.navigator.storage.persist().catch(() => {});   
  }
  return Fan.store;
};
Fan.connectTrader = async () => {
  try {
    Fan.traderWhy = "no connector here";
    if (!window.fetch) return null;
    const answer = await window.fetch("/connector/hello").catch(() => null);
    const hi = answer && answer.ok ? await answer.json().catch(() => null) : null;
    if (!hi) return null;
    Fan.traderWhy = hi.ordersWhy || "";
    if (window.BroadcastChannel) new window.BroadcastChannel("fan-connector").onmessage = () => window.location.reload();   
    if (hi.account) Fan.account = () => window.open("/connector/connect", "_blank");   
    if (hi.feed) Fan.reads = connectorTrader(window.fetch, hi);
    if (hi.orders) Fan.trader = Fan.reads;   
    Fan.keyed = !!hi.env;
    Fan.env = hi.env || "";
    
    Fan.keys = hi.keys || null;
    
    if (hi.methods) Fan.methods = {
      get: async () => (await (await window.fetch("/connector/methods")).json()).text || null,
      set: async text => { const r = await (await window.fetch("/connector/methods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })).json(); if (!r.ok) throw new Error(r.error); },
    };
    if (hi.keys) Fan.useKey = async env => {
      const r = await (await window.fetch("/connector/key/use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ env }) })).json();
      if (r.error) throw new Error(r.error);
      if (window.BroadcastChannel) new window.BroadcastChannel("fan-connector").postMessage("key");   
      window.location.reload();
    };
    Fan.setBet = async on => {   
      const r = await (await window.fetch("/connector/bet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }) })).json();
      if (!r.ok) throw new Error(r.error);
      Fan.trader = r.orders ? Fan.reads : null;
    };
  } catch (e) { Fan.traderWhy = "error: " + (e && e.message); }
  return Fan.trader;
};
export { Fan };
