// Triggers and responses: what the connector does by itself, with or without a page open. It runs in the connector's engine beside calc.js and reaches the world only through `fan` (the connector's README). The page sets them in the local config `auto`, and reads what happened from the records' `auto` collection.
// config auto = { abbr, games: [{ t, away, home, week, league, id, when }], set: { <game key>: { stamp, on, trigger: { kind: "every", seconds } or { kind: "fill" } or { kind: "price" }, response: { kind: "hedge", up, size, max, send, lift, capital } } } }
// It also keeps the saved lines on the live book: each second the book moved, the games it moved get their fresh prices, as a fill's read gives the page.
const Auto = (() => {
  const ownOrders = new Set(), timers = new Map();   // the orders this sent, and when each game's timer is next due
  let orderNo = 0;
  const LOG_KEPT = 20;   // Claude's default

  const note = (doc, text, cls) => { doc.log = [{ at: fan.now(), text, cls: cls || "" }, ...(doc.log || [])].slice(0, LOG_KEPT); };
  const save = (key, doc) => fan.records.set("auto", key, doc);
  const stop = (key, doc, why) => { doc.on = false; doc.lastWait = ""; note(doc, "Disarmed: " + why, "err"); save(key, doc); timers.delete(key); };

  // The games as the page knows them, with what the slate has saved for each, as applySlate gives them.
  function gamesOf(cfg) {
    const slate = new Map(fan.records.list("slate").map(r => [r.id, r.data]));
    return (cfg.games || []).map(g => {
      const v = slate.get(g.id) || {}, out = { ...g };
      if (Array.isArray(v.final)) out.final = v.final;
      if (v.line) out.line = v.line; else if (v.live) out.line = v.live;
      ["live", "lad", "band", "venue"].forEach(k => { if (v[k]) out[k] = v[k]; });
      return out;
    });
  }
  const firstTicker = g => (g.lad && g.lad.ml && ((g.lad.ml.away && g.lad.ml.away.tk) || (g.lad.ml.home && g.lad.ml.home.tk))) || "";
  const eventOf = ticker => String(ticker || "").split("-")[1] || "";

  // A fill the page hasn't made a ticket for, on this game, means the position isn't known: the next order would be sized on the wrong one.
  function unknownFill(g, tickets) {
    const event = eventOf(firstTicker(g)), have = new Set(tickets.map(t => t.fillId));
    return !!event && fan.records.list("fills").some(({ data: d }) => d.handled === false && eventOf(d.ticker) === event && !(d.client && have.has(d.client)));
  }

  const RESPONSES = {
    hedge(g, set, doc, key, calc, tickets) {
      const p = set.response;
      Calc.RULES.hedge.LIFT = p.lift; Calc.RULES.hedge.CAPITAL = p.capital / 100;
      if (unknownFill(g, tickets)) return stop(key, doc, "a fill hasn't reached the tickets, so the position isn't known");
      let q;
      try { q = fan.call("market_prices", { venue: "kalshi", ticker: firstTicker(g) }); } catch (e) { return stop(key, doc, "couldn't read the market: " + (e.code || e.message)); }   // a rate limit included: never retried in a loop
      if (!q || q.skip) { if (doc.lastWait !== "read") { doc.lastWait = "read"; note(doc, "Kalshi has no prices for this game to read"); save(key, doc); } return; }
      const patch = Calc.freshPrices(g, q, fan.now());
      Object.assign(g, patch);
      try { fan.records.update("slate", g.id, patch); } catch (e) {}   // for the page's cards. The order doesn't depend on it
      const h = calc.hedgeFor(g, calc.gameBets(g, tickets), calc.parlayShares(g, tickets)), d = Calc.armDecision(h, { up: p.up, size: p.size, max: p.max, kind: p.send });
      if (d.wait) { if (doc.lastWait !== d.wait) { doc.lastWait = d.wait; note(doc, d.wait); save(key, doc); } return; }
      doc.lastWait = "";
      note(doc, `Sending ${d.n} ${h.txt}, limit ${Math.round(d.ask * 100)}¢ (${h.kind})`);
      save(key, doc);
      send(g, h, d, doc, key);
    }
  };

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
    fan.records.add("wagers", {
      key: h.gk, game: h.gn, kickoff: h.gt, book: "Kalshi", amount, bonus: false, createdAt: fan.now(), fillId: id,
      type: h.tkt.type, side: h.tkt.side, ...(ml ? { line: american } : { line: h.tkt.line, odds: american }),
      kalshi: { cents, contracts: C, fee }, pick: `${h.tkt.side}${ml ? "" : " " + shown} ${cents}¢`, when: g.when || ""
    });
    note(doc, `Filled ${o.filled} of ${o.requested != null ? o.requested : d.n} at ${(fill.avg * 100).toFixed(1)}¢${o.env === "demo" ? " (demo)" : ""}`, "ok");
    save(key, doc);
  }

  // One pass. `heard`: the fill that set this off; `priced`: the slate ids the book just moved; neither for the clock.
  function pass(heard, priced) {
    if (heard && heard.catchup) return;   // a fill from before this started says nothing about now
    const cfg = fan.config("auto");
    if (!cfg || !cfg.set) return;
    const keys = Object.keys(cfg.set);
    if (!keys.length) return;
    let world = null;
    const load = () => {
      if (world) return world;
      const games = gamesOf(cfg), tickets = fan.records.list("wagers").map(r => ({ id: r.id, ...r.data }));
      return (world = { games, tickets, calc: Calc.make({ games, now: fan.now, abbr: n => (cfg.abbr || {})[n] || n }) });
    };
    for (const key of keys) {
      const set = cfg.set[key];
      let doc = fan.records.get("auto", key);
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
      else if (priced) { if (trig.kind !== "price") continue; }
      else if (trig.kind === "fill" || trig.kind === "price" ? timers.has(key) : fan.now() < (timers.get(key) || 0)) continue;   // a fill or price trigger runs once on arming, then waits for its event
      const { games, tickets, calc } = load(), g = games.find(x => calc.gameKey(x) === key);
      if (!g) { stop(key, doc, "this game isn't in the config"); continue; }
      if (priced && !priced.has(g.id)) continue;
      if (heard && eventOf(heard.ticker) !== eventOf(firstTicker(g))) continue;
      if (g.final) { stop(key, doc, "the game is final"); continue; }
      if (!RESPONSES[set.response && set.response.kind]) { stop(key, doc, "no response called " + (set.response && set.response.kind)); continue; }
      timers.set(key, fan.now() + (Number(trig.seconds) || 0) * 1000);
      RESPONSES[set.response.kind](g, set, doc, key, calc, tickets);
      world = null;   // a response may have changed the tickets
    }
  }
  // The games the live book moved: their saved lines first, so the page and the response read the same prices, then any game armed on a price.
  function priced(ev) {
    const moved = new Set();
    ((ev && ev.games) || []).forEach(({ id, q }) => {
      if (!q || q.skip || q.start == null) return;
      let doc;
      try { doc = fan.records.get("slate", id); } catch (e) { return; }
      if (!doc || Array.isArray(doc.final)) return;   // not in the slate yet, or over
      try { fan.records.update("slate", id, Calc.freshPrices({ t: new Date(q.start).toISOString(), lad: doc.lad }, q, fan.now())); moved.add(id); } catch (e) {}
    });
    if (moved.size) pass(null, moved);
  }
  fan.on("tick", () => pass(null));
  fan.on("fill", f => pass(f));
  fan.on("prices", priced);
  return { pass, priced };
})();
