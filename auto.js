// Triggers and responses: what the connector does by itself, with or without a page open. It runs in the connector's engine beside calc.js and reaches the world only through `fan` (the connector's README). The page sets them in the local config `auto`, and reads what happened from the records' `auto` collection.
// config auto = { abbr, games: [{ t, away, home, week, league, id, when }], set: { <game key>: { stamp, on, trigger: { kind: "every", seconds } or { kind: "fill" } or { kind: "price" }, response: { kind: "hedge", up, size, max, send, lift, capital } } } }
// It also keeps the saved lines on the live book: each second the book moved, the games it moved get their fresh prices, as a fill's read gives the page.
// Built the way trading systems are: what a decision needs is held in memory and kept current from the records' change feed; the decision (`decide`) reads and writes nothing; the executor (`act`) sends and saves after it.
const Auto = (() => {
  const ownOrders = new Set(), timers = new Map();   // the orders this sent, and when each game's timer is next due
  let orderNo = 0;
  const LOG_KEPT = 20;   // Claude's default

  // ---- What's held: the records a decision reads, loaded once, then again only for a collection the change feed says changed. A connector before 0.25 has no change feed, so everything is read each time.
  const held = { seq: null, tickets: [], fills: [], docs: new Map(), slate: null, games: null, gamesFrom: "" };
  function follow() {
    const c = fan.records.changes ? fan.records.changes(held.seq) : { all: true };
    const all = held.seq == null || !!c.all, cols = new Set(all ? ["wagers", "fills", "auto", "slate"] : c.cols || []);
    held.seq = c.seq;
    if (cols.has("wagers")) held.tickets = fan.records.list("wagers").map(r => ({ id: r.id, ...r.data }));
    if (cols.has("fills")) held.fills = fan.records.list("fills").map(r => ({ id: r.id, ...r.data })).filter(d => d.handled === false);
    if (all) held.docs = new Map(fan.records.list("auto").map(r => [r.id, r.data]));   // only this writes them, and keeps its copy as it does
    if (cols.has("slate")) held.slate = null;   // read again when a decision needs it
  }
  // The config's games with what the slate has saved for each, as applySlate gives them.
  function gamesOf(cfg) {
    const from = JSON.stringify(cfg.games || []);
    if (held.games && held.slate && held.gamesFrom === from) return held.games;
    if (!held.slate) held.slate = new Map(fan.records.list("slate").map(r => [r.id, r.data]));
    held.gamesFrom = from;
    return (held.games = (cfg.games || []).map(g => {
      const v = held.slate.get(g.id) || {}, out = { ...g };
      if (Array.isArray(v.final)) out.final = v.final;
      if (v.line) out.line = v.line; else if (v.live) out.line = v.live;
      ["live", "lad", "band", "venue"].forEach(k => { if (v[k]) out[k] = v[k]; });
      return out;
    }));
  }
  const firstTicker = g => (g.lad && g.lad.ml && ((g.lad.ml.away && g.lad.ml.away.tk) || (g.lad.ml.home && g.lad.ml.home.tk))) || "";
  const eventOf = ticker => String(ticker || "").split("-")[1] || "";

  // A fill with no ticket yet, on this game, means the position isn't known: the next order would be sized on the wrong one. "young" when every such fill is newer than HAND_MS, so its ticket is coming.
  function unknownFill(g, tickets, fills, now) {
    const event = eventOf(firstTicker(g)), have = new Set(tickets.map(t => t.fillId)), list = event ? fills.filter(d => eventOf(d.ticker) === event && !(d.client && have.has(d.client))) : [];
    return !list.length ? false : now != null && list.every(d => d.at && now - d.at < HAND_MS) ? "young" : true;
  }

  // ---- Hand fills: a fill placed anywhere else, with no page open to make its ticket. The connector makes the same ticket the page would (Calc's ticketFromFill) and marks the fill handled, as the
  // page does, so Arm knows the position (Nov 3 2026). Only on a game the page gave, and only once a fill has waited HAND_MS, so an open page, or the reply of an order a page sent, gets there first.
  const HAND_MS = 10000;   // Claude's default
  function handFills(cfg) {
    const now = fan.now(), due = held.fills.filter(d => d.env !== "demo" && d.at && now - d.at >= HAND_MS && !ownOrders.has(d.client) && String(d.id).startsWith("feed-"));
    if (!due.length) return;
    const games = gamesOf(cfg), calc = Calc.make({ games, now: () => now, abbr: n => (cfg.abbr || {})[n] || n }), whenOf = k => (games.find(g => g.t === k) || {}).when || "";
    let made = false;
    for (const d of due) {
      const x = { venue: d.venue, env: d.env, trade_id: d.id.slice(5), order_id: d.order, client_order_id: d.client, ticker: d.ticker, side: d.side, action: d.action, price: d.price, count: d.filled, fee: d.fee, ts_ms: d.tradeMs };
      const own = d.client && held.tickets.some(t => t.fillId === d.client && t.id !== `fill-${d.venue}-${d.order}`);   // a ticket from the order's reply: nothing to make
      const out = own ? null : calc.ticketFromFill(x, held.tickets.find(t => t.id === `fill-${d.venue}-${d.order}`), whenOf);
      if (out && !out.known) continue;   // a market the page didn't give: its ticket waits for the page
      try {
        if (out) { fan.records.set("wagers", out.id, out.ticket); held.tickets = [...held.tickets.filter(t => t.id !== out.id), { id: out.id, ...out.ticket }]; }
        fan.records.update("fills", d.id, { handled: true });
        made = true;
      } catch (e) {}
    }
    if (made) { follow(); held.games = null; }
  }

  // ---- The decision: one armed game, from what's held and the prices just read. It reads and writes nothing, so it can be tested, replayed, or one day run as compiled code.
  // read: { q } or { error }. Answers { stop }, { wait, waitKey }, or { order: { h, d } }, with the slate's new prices as `patch` when there are any.
  const DECIDE = {
    hedge(g, read, set, held, cfg, now) {
      const p = set.response;
      Calc.RULES.hedge.LIFT = p.lift; Calc.RULES.hedge.CAPITAL = p.capital / 100;
      const unknown = unknownFill(g, held.tickets, held.fills, now);
      if (unknown === "young") return { wait: "a fill is on its way to the tickets", waitKey: "fill" };
      if (unknown) return { stop: "a fill hasn't reached the tickets, so the position isn't known" };
      if (read.error) return { stop: "couldn't read the market: " + read.error };   // a rate limit included: never retried in a loop
      const q = read.q;
      if (!q || q.skip) return { wait: "Kalshi has no prices for this game to read", waitKey: "read" };
      const patch = Calc.freshPrices(g, q, now), fresh = { ...g, ...patch };
      const calc = Calc.make({ games: held.games.map(x => (x === g ? fresh : x)), now: () => now, abbr: n => (cfg.abbr || {})[n] || n });
      const h = calc.hedgeFor(fresh, calc.gameBets(fresh, held.tickets), calc.parlayShares(fresh, held.tickets)), d = Calc.armDecision(h, { up: p.up, size: p.size, max: p.max, kind: p.send });
      return d.wait ? { patch, wait: d.wait } : { patch, order: { h, d, g: fresh } };
    }
  };

  // ---- The executor: everything that reaches the world, after the decision. The order goes first; the records and the slate after it.
  const note = (doc, text, cls) => { doc.log = [{ at: fan.now(), text, cls: cls || "" }, ...(doc.log || [])].slice(0, LOG_KEPT); };
  const save = (key, doc) => { fan.records.set("auto", key, doc); held.docs.set(key, doc); };
  const stop = (key, doc, why) => { doc.on = false; doc.lastWait = ""; note(doc, "Disarmed: " + why, "err"); save(key, doc); timers.delete(key); };
  function act(key, doc, g, out) {
    if (out.stop) return stop(key, doc, out.stop);
    if (out.order) {
      const { h, d } = out.order;
      doc.lastWait = "";
      note(doc, `Sending ${d.n} ${h.txt}, limit ${Math.round(d.ask * 100)}¢ (${h.kind})`);
      save(key, doc);
      send(out.order.g, h, d, doc, key);
    } else if (out.wait) {
      const k = out.waitKey || out.wait;
      if (doc.lastWait !== k) { doc.lastWait = k; note(doc, out.wait); save(key, doc); }
    }
    if (out.patch) try { fan.records.update("slate", g.id, out.patch); } catch (e) {}   // for the page's cards. The order doesn't depend on it
  }
  function send(g, h, d, doc, key) {
    const id = `auto-${fan.now()}-${++orderNo}`;
    ownOrders.add(id);
    let o;
    try { o = fan.call("place_order", { ticker: h.tk, side: h.side, count: d.n, price: d.ask, client_order_id: id }); }
    catch (e) { return stop(key, doc, e.code === "server_unavailable" || e.code === "upstream_error" ? "no answer: check Kalshi, the order may have gone through" : String(e.code || e.message)); }
    const fill = Calc.replyFill(o, h.side, d.ask);
    fan.records.set("fills", id, { at: fan.now(), env: o.env || "prod", game: h.gn || null, key: h.gk || null, bet: h.txt, ticker: h.tk, side: h.side, price: d.ask, requested: o.requested != null ? o.requested : d.n, filled: o.filled || 0, unfilled: o.unfilled != null ? o.unfilled : null, averagePrice: fill.avg, feePerContract: o.average_fee_paid != null ? o.average_fee_paid : null, reply: o, auto: true });
    if (!(o.filled > 0)) { note(doc, `Nothing filled at ${Math.round(d.ask * 100)}¢ or better (canceled)`); return save(key, doc); }
    const { contracts: C, amount, american, cents, fee } = fill, ml = h.tkt.type === "Moneyline", shown = h.tkt.type === "Spread" ? (h.tkt.line > 0 ? "+" : "") + h.tkt.line : String(h.tkt.line);
    fan.records.set("wagers", id, {   // under the order's own id: a connector before 0.25 has no records.add
      key: h.gk, game: h.gn, kickoff: h.gt, book: "Kalshi", amount, bonus: false, createdAt: fan.now(), fillId: id,
      type: h.tkt.type, side: h.tkt.side, ...(ml ? { line: american } : { line: h.tkt.line, odds: american }),
      kalshi: { cents, contracts: C, fee }, pick: `${h.tkt.side}${ml ? "" : " " + shown} ${cents}¢`, when: g.when || ""
    });
    note(doc, `Filled ${o.filled} of ${o.requested != null ? o.requested : d.n} at ${(fill.avg * 100).toFixed(1)}¢${o.env === "demo" ? " (demo)" : ""}`, "ok");
    save(key, doc);
  }
  // Each decision in the connector's event journal, with everything it read, so it can be replayed: the game, the other games its parlays need, its tickets, the prices, the settings and the clock. After the order, off its path.
  function journal(key, by, g, read, set, now, out, cfg) {
    if (!fan.journal) return;   // a connector before 0.26 keeps none
    const tickets = held.tickets.filter(t => t.key === key || (t.parlay && (t.legs || []).some(l => l.key === key)));
    const legKeys = new Set(tickets.flatMap(t => (t.legs || []).map(l => l.key)).filter(k => k !== key));
    const order = out.order && { tk: out.order.h.tk, side: out.order.h.side, n: out.order.d.n, ask: out.order.d.ask, kind: out.order.h.kind, txt: out.order.h.txt };
    try { fan.journal("decision", { key, by, now, game: g, games: held.games.filter(x => legKeys.has(Calc.gameKey(x))), tickets, fills: held.fills, read, set, abbr: cfg.abbr || {}, out: { stop: out.stop, wait: out.wait, order } }); } catch (e) {}
  }
  const readPrices = g => { try { return { q: fan.call("market_prices", { venue: "kalshi", ticker: firstTicker(g) }) }; } catch (e) { return { error: e.code || e.message }; } };   // the live book's when it has the game, so no request

  // One pass. `heard`: the fill that set this off; `moved`: the slate ids the book just moved; neither for the clock.
  function pass(heard, moved) {
    if (heard && heard.catchup) return;   // a fill from before this started says nothing about now
    const cfg = fan.config("auto");
    if (!cfg || !cfg.set) return;
    const keys = Object.keys(cfg.set);
    if (!keys.length) return;
    follow();
    handFills(cfg);
    let games = null;
    for (const key of keys) {
      const set = cfg.set[key];
      let doc = held.docs.get(key) || null;
      if (!doc || doc.stamp !== set.stamp) {   // the page set this anew
        if (!set.on) { if (doc && doc.on) stop(key, doc, "you turned it off"); else if (doc && doc.stamp !== set.stamp) { doc.stamp = set.stamp; save(key, doc); } continue; }
        doc = { stamp: set.stamp, on: true, log: (doc && doc.log) || [], lastWait: "" };
        note(doc, "Armed");
        save(key, doc);
        timers.delete(key);
      }
      if (!doc.on) continue;
      const trig = set.trigger || {};
      if (heard) { if (trig.kind !== "fill" || ownOrders.has(heard.client_order_id)) continue; }
      else if (moved) { if (trig.kind !== "price") continue; }
      else if (trig.kind === "fill" || trig.kind === "price" ? timers.has(key) : fan.now() < (timers.get(key) || 0)) continue;   // a fill or price trigger runs once on arming, then waits for its event
      games = games || gamesOf(cfg);
      const g = games.find(x => Calc.gameKey(x) === key);
      if (!g) { stop(key, doc, "this game isn't in the config"); continue; }
      if (moved && !moved.has(g.id)) continue;
      if (heard && eventOf(heard.ticker) !== eventOf(firstTicker(g))) continue;
      if (g.final) { stop(key, doc, "the game is final"); continue; }
      const decide = DECIDE[set.response && set.response.kind];
      if (!decide) { stop(key, doc, "no response called " + (set.response && set.response.kind)); continue; }
      timers.set(key, fan.now() + (Number(trig.seconds) || 0) * 1000);
      const now = fan.now(), read = readPrices(g), out = decide(g, read, set, held, cfg, now);
      act(key, doc, g, out);
      journal(key, heard ? "fill" : moved ? "move" : "clock", g, read, set, now, out, cfg);
      if (out.order) { follow(); games = null; }   // the order changed the tickets and the fills
    }
  }

  // The games the live book moved in the last second: their saved lines, so the page follows the market.
  function priced(ev) {
    const moved = new Set();
    ((ev && ev.games) || []).forEach(({ id, q }) => {
      if (!q || q.skip || q.start == null) return;
      let doc;
      try { doc = fan.records.get("slate", id); } catch (e) { return; }
      if (!doc || Array.isArray(doc.final)) return;   // not in the slate yet, or over
      try { fan.records.update("slate", id, Calc.freshPrices({ t: new Date(q.start).toISOString(), lad: doc.lad }, q, fan.now())); moved.add(id); } catch (e) {}
    });
    if (!hearsMoves && moved.size) pass(null, moved);
  }
  fan.on("tick", () => pass(null));
  fan.on("fill", f => pass(f));
  fan.on("prices", priced);
  // Each move of the book, as it comes: a game armed on a price decides on it at once. A 0.24 connector has no such event, and its price trigger runs on the once-a-second prices.
  let hearsMoves = true;
  try { fan.on("move", ev => pass(null, new Set((ev && ev.ids) || []))); } catch (e) { hearsMoves = false; }
  // A journaled decision made again from what it read, as the journal summarizes it. tools/dev/replay.js runs a day's.
  function replay(e) {
    const out = DECIDE[e.set.response.kind](e.game, e.read, e.set, { tickets: e.tickets, fills: e.fills, games: [e.game, ...e.games] }, { abbr: e.abbr }, e.now);
    const order = out.order && { tk: out.order.h.tk, side: out.order.h.side, n: out.order.d.n, ask: out.order.d.ask, kind: out.order.h.kind, txt: out.order.h.txt };
    return { stop: out.stop, wait: out.wait, order };
  }
  return { pass, priced, decide: DECIDE, replay };
})();
