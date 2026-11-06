
import { addTicket, centsOk, clearTicket, gameSelect, inStore, isKalshi, ledgerCard, lineShown, mode, placeNote, readLeg, ticketsReady, updateTicket } from "./tracker.js?v=mw4f1obf";
import { Fan } from "./hosts.js?v=mw4f1obf";
import { Calc } from "./calc.js?v=mw4f1obf";
import { ticketFromFill, nick, changed, $, ALL_GAMES, GAMES, RULES, allTickets, calc, hedgeFor, contractsFor, dayFmt, el, fillAmounts, fillSide, freshPrices, gameKey, gameLabel, kalshiCheck, kalshiMarket, last, later, leagueId, odds, readTicker, replyFill, riskGame, subView, timeZoned, marketWanted, pricesOn, trackingOn, view } from "./base.js?v=mw4f1obf";
import { ABBR, slateDocId } from "./leagues.js?v=mw4f1obf";
  Object.assign(later, { hedgeControls, execShare, execButton, execResult, limitSlider, drawKalshiCheck, syncPlace });
  
  let execBusy = false, lastExec = null, execPct = 100;   
  (async () => {
    await Fan.connectTrader();
    showDemo();
    changed("settings");
    if (riskGame) changed("exec");
    syncPlace();
    if (reader()) { pendingFills().catch(() => {}); feedLoop(); }
  })();
  
  function showDemo() {
    if (Fan.env !== "demo") return;
    document.documentElement.classList.add("demo");
    document.title = "DEMO " + document.title;
    const b = el("span", "demo-badge", "DEMO");
    b.id = "demoBadge"; b.title = "Kalshi's demo, fake money";
    $("infoVer").after(b);   
    $("fanBtn").setAttribute("aria-label", "Fan, settings, on Kalshi's demo with fake money");
  }
  
  function demoAway(away) {
    const b = $("demoBadge");
    if (!b) return;
    b.hidden = away;
    document.documentElement.classList.toggle("demo", !away);
    document.title = (away ? "" : "DEMO ") + document.title.replace(/^DEMO /, "");
  }
  let feedWaiting = Date.now();   
  const reader = () => Fan.trader || Fan.reads;   
  async function setBet(on) {
    try { await Fan.setBet(on); } catch (e) {}
    syncPlace(); changed("exec", "settings");
  }
  
  
  const feedShow = (text, cls) => { const n = document.getElementById("feedNote"); if (n) { n.textContent = text; n.className = cls || ""; } };
  
  
  
  const priceBusy = new Map();   
  function applyFreshPrices(q) {
    if (!pricesOn()) return;
    const g = ALL_GAMES.find(x => leagueId(x) === (q.league || "nfl") && ABBR[nick(x, "away")] === q.away && ABBR[nick(x, "home")] === q.home && (!q.start || Math.abs(Date.parse(x.t) - q.start) < 864e5));
    if (!g || g.final) return;
    const patch = freshPrices(g, q, Date.now());
    Object.assign(g, patch);
    changed("lines");
    if (Fan.lines) Fan.lines.update("slate", slateDocId(g), patch).catch(() => {});
  }
  async function refreshPrices(ticker, venue) {
    if (!pricesOn() || venue !== "kalshi") return;   
    const key = String(ticker).split("-")[1];
    if (priceBusy.has(key)) { priceBusy.set(key, ticker); return; }   
    priceBusy.set(key, null);
    try {
      const q = await reader().call("market_prices", { venue, ticker });
      if (q && !q.skip) applyFreshPrices(q);
    } catch (e) { feedShow("Prices not refreshed: " + ((e && (e.code || e.message)) || "error"), "off"); }
    const again = priceBusy.get(key);
    priceBusy.delete(key);
    if (again) refreshPrices(again, venue);
  }
  
  
  
  
  const OTHER_WINDOW_MS = 5000;   
  const ownOrders = new Map(), fillTickets = new Map();   
  function saveFillTicket(x) {
    if (x.env === "demo") return;
    const id = `fill-${x.venue}-${x.order_id}`, out = ticketFromFill(x, fillTickets.get(id) || allTickets.find(t => t.id === id), k => dayFmt.format(new Date(k)) + ", " + timeZoned(new Date(k)));
    if (!out) return;
    fillTickets.set(id, out.ticket);
    return inStore ? Fan.store.set("wagers", id, out.ticket) : undefined;
  }
  async function handleFill(x, delayMs) {
    await ticketsReady;
    const id = x.venue === "kalshi" ? x.trade_id : x.venue + "-" + x.trade_id;
    let known = false, waiting = false, savedClient = null;
    try {
      if (inStore && x.env !== "demo") {
        const had = await Fan.store.get("fills", "feed-" + id);
        savedClient = had && had.client;   
        waiting = !!had && had.handled === false; known = !!had && !waiting;
        if (!had) Fan.store.set("fills", "feed-" + id, { at: Date.now(), venue: x.venue, env: x.env, source: x.catchup ? "catchup" : "feed", ticker: x.ticker, side: x.side, action: x.action, price: x.price, filled: x.count, fee: x.fee, order: x.order_id, client: x.client_order_id || null, tradeMs: x.ts_ms, serverMs: x.received_ms, ...(x.catchup ? {} : { delayMs }), reply: x.raw }).catch(() => {});
      }
    } catch (e) {}
    const done = () => { if (waiting) Fan.store.update("fills", "feed-" + id, { handled: true, ...(x.catchup ? {} : { delayMs }) }).catch(() => {}); };
    const clientOrder = x.client_order_id || savedClient;
    if (clientOrder && ownOrders.has(clientOrder)) { ownOrders.get(clientOrder).push(x); return; }   
    if (known) return;
    
    if (clientOrder && Date.now() - x.ts_ms < 60000) await new Promise(r => setTimeout(r, OTHER_WINDOW_MS));
    if (clientOrder && allTickets.some(t => t.fillId === clientOrder && t.id !== `fill-${x.venue}-${x.order_id}`)) return done();
    try { await saveFillTicket(x); done(); } catch (e) {}   
  }
  async function pendingFills() {
    await ticketsReady;
    if (!inStore) return;
    for (const { id, data: d } of await Fan.store.list("fills")) {
      if (d.handled === false) await handleFill({ venue: d.venue, env: d.env, trade_id: id.slice(5), order_id: d.order, client_order_id: d.client, ticker: d.ticker, side: d.side, action: d.action, price: d.price, count: d.filled, fee: d.fee, ts_ms: d.tradeMs, received_ms: d.serverMs, raw: d.reply, catchup: true }, 0);
    }
  }
  async function feedLoop() {
    let boot, after, tries = 0;
    for (;;) {
      try {
        const r = await reader().call("wait_fill", { ...(boot ? { boot, after } : {}), timeout_ms: boot ? 20000 : 1 });   
        boot = r.boot; after = r.seq; tries = 0;
        
        (r.fills || []).forEach(x => {
          handleFill(x, Date.now() - x.ts_ms);
          if (!x.catchup) refreshPrices(x.ticker, x.venue);
        });
        const fs = Calc.feedState(r.venues, Date.now() - (feedWaiting || (feedWaiting = Date.now())));
        if (fs.cls === "on") feedWaiting = 0;
        if (Fan.keyed === false) feedShow("", ""); else feedShow(fs.text, fs.cls);   
      } catch (e) {
        const c = e && e.code;
        if (!(e && e.retryable) || (++tries > 3 && !e.keepTrying)) { feedShow(c === "server_not_connected" ? "" : "Feed off: " + (c || "error"), "off"); return; }
        feedShow("Feed off: retrying", "off");
        await new Promise(res => setTimeout(res, (e.retryAfterMs || 5000) + Math.random() * 1000));
      }
    }
  }
  
  
  let labels = [];
  function execShare() {
    labels = [];
    const sl = el("input", "exec-share");
    sl.type = "range"; sl.min = "10"; sl.max = "100"; sl.step = "10"; sl.value = String(execPct); sl.disabled = execBusy; sl.title = "Share of the suggested size to send";   
    sl.addEventListener("input", () => { execPct = Number(sl.value); labels.forEach(f => f()); });
    return sl;
  }
  
  function execButton(h, signature, price = () => h.ask) {
    const btn = el("button", "exec-button");
    const contractCount = () => Math.max(1, Math.round(h.n * execPct / 100)), labelEl = () => { btn.textContent = execBusy ? "Sending…" : `Execute ${execPct}%${Fan.env === "demo" ? " (demo)" : ""}`; btn.title = Fan.trader ? `Buy ${contractCount()} ${h.side.toUpperCase()} on ${h.tk} at ${Math.round(price() * 100)}¢ or better, immediate-or-cancel` : "Needs the connector (" + (Fan.traderWhy || "still checking") + ")"; };
    btn.type = "button"; btn.disabled = execBusy || !Fan.trader;
    labelEl(); labels.push(labelEl);
    btn.addEventListener("click", e => { e.stopPropagation(); runExec({ ...h, ask: price(), n: contractCount() }, signature); });
    return btn;
  }
  
  
  
  
  const limitCents = new Map();
  function limitSlider(h, key) {
    const ask = Math.round(h.ask * 100), picked = () => limitCents.has(key) ? limitCents.get(key) : ask;
    const box = el("span", "exec-limit"), sl = el("input", "exec-price"), shown = el("b", "exec-price-value");
    sl.type = "range"; sl.step = "1"; sl.min = String(Math.max(1, Math.min(ask - 15, picked()))); sl.max = String(Math.min(99, Math.max(ask + 10, picked()))); sl.value = String(picked());
    const show = () => { const c = picked(); shown.textContent = c + "¢"; shown.classList.toggle("under", c < ask); shown.classList.toggle("over", c > ask); sl.title = `Limit price ${c}¢; the ask is ${ask}¢. Double-click for the ask.`; };
    sl.addEventListener("input", () => { limitCents.set(key, Number(sl.value)); show(); labels.forEach(f => f()); });
    sl.addEventListener("dblclick", () => { limitCents.delete(key); sl.value = String(ask); show(); labels.forEach(f => f()); });
    show(); box.append(sl, shown);
    return { el: box, price: () => picked() / 100 };
  }
  
  function execResult(start) { return lastExec && String(lastExec.signature).startsWith(start) && Date.now() - lastExec.at < 6e5 ? el("span", "exec-result " + lastExec.cls, lastExec.text) : null; }
  async function runExec(h, signature) {
    if (execBusy || !Fan.trader) return;
    execBusy = true; lastExec = { at: Date.now(), signature, text: "Sending to Kalshi…", cls: "" }; changed("exec");
    const id = (crypto.randomUUID ? crypto.randomUUID() : "fan-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    ownOrders.set(id, []);
    try {
      const r = await Fan.trader.call("place_order", { ticker: h.tk, side: h.side, count: h.n, price: h.ask, client_order_id: id });
      const o = r && typeof r === "object" ? r : {}, env = o.env === "demo" ? " (demo)" : "";
      const fill = replyFill(o, h.side, h.ask), avgPrice = fill.avg;
      if (o.dryRun) lastExec = { at: Date.now(), signature, text: "Dry run: nothing was sent.", cls: "" };
      else {
        
        try {
          if (inStore) Fan.store.set("fills", id, {
            at: Date.now(), env: o.env || "prod", game: h.gn || null, key: h.gk || null, bet: h.txt, ticker: h.tk, side: h.side, price: h.ask,
            requested: o.requested != null ? o.requested : h.n, filled: o.filled || 0, unfilled: o.unfilled != null ? o.unfilled : null,
            averagePrice: avgPrice, feePerContract: o.average_fee_paid != null ? o.average_fee_paid : null,
            reply: JSON.parse(JSON.stringify(o))
          }).catch(() => {});
        } catch (e) {}
        
        if (o.filled > 0 && h.ticketFields && o.env !== "demo") {   
          try {
            const { contracts: C, amount, american, cents, fee } = fill, ml = h.ticketFields.type === "Moneyline";
            addTicket({
              key: h.gk, game: h.gn, kickoff: h.gt, book: "Kalshi", amount, bonus: false, createdAt: Date.now(), fillId: id,
              type: h.ticketFields.type, side: h.ticketFields.side, ...(ml ? { line: american } : { line: h.ticketFields.line, odds: american }),
              kalshi: { cents, contracts: C, fee },
              pick: `${h.ticketFields.side}${ml ? "" : " " + lineShown(h.ticketFields.type, h.ticketFields.line)} ${cents}¢`,
              when: dayFmt.format(new Date(h.gt)) + ", " + timeZoned(new Date(h.gt))
            });
          } catch (e) {}
        }
        const paidUp = h.ticketCents != null && Math.round(h.ask * 100) !== h.ticketCents ? ` (ticket ${h.ticketCents}¢, limit ${Math.round(h.ask * 100)}¢)` : "", px = avgPrice != null ? ` at ${(avgPrice * 100).toFixed(1)}¢${paidUp}` : "", fee = o.average_fee_paid ? `, fee ${(o.average_fee_paid * 100).toFixed(1)}¢ each` : "";
        const moved = (o.funded || []).map(f => `moved $${f.dollars.toFixed(2)} to shard ${f.to}`).join(", "), movedNote = moved ? `; ${moved}` : "";   
        lastExec = { at: Date.now(), signature, cls: o.filled > 0 ? "ok" : "err", text: (o.filled > 0 ? `Filled ${o.filled} of ${o.requested}${px}${fee}${o.unfilled ? `; ${o.unfilled} not filled at ${Math.round(h.ask * 100)}¢ or better (canceled)` : ""}${env}` : `Nothing filled at ${Math.round(h.ask * 100)}¢ or better (canceled)${env}`) + movedNote };
      }
    } catch (e) {
      
      const held = ownOrders.get(id) || []; ownOrders.delete(id);
      held.forEach(x => { try { Promise.resolve(saveFillTicket(x)).catch(() => {}); } catch (err) {} });
      const c = e && e.code, m = e && e.message;
      lastExec = { at: Date.now(), signature, cls: "err", text: c === "server_not_connected" ? "The connector isn't running."
        : c === "approval_required" || c === "cancelled" || c === "not_in_manifest" ? "Not approved in the app, nothing was sent."
        : c === "tool_error" ? `Kalshi refused: ${m}`
        : c === "server_unavailable" || c === "upstream_error" ? "No answer: check Kalshi before sending again, the order may have gone through."
        : `${c || "error"}: ${m || ""}` };
    }
    execBusy = false; changed("exec");
  }
  
  
  const hedgeSet = { lift: RULES.hedge.LIFT, capital: RULES.hedge.CAPITAL * 100 };
  try { const s = JSON.parse(localStorage.getItem("fan.arm") || "{}"); ["lift", "capital"].forEach(k => { if (s[k] != null) hedgeSet[k] = s[k]; }); } catch (e) {}
  const applyHedgeRules = () => { RULES.hedge.LIFT = hedgeSet.lift; RULES.hedge.CAPITAL = hedgeSet.capital / 100; };
  applyHedgeRules();
  function hedgeControls() {
    const box = el("div", "rk-tune"), row = el("div", "rk-tune-row");
    const save = () => { try { localStorage.setItem("fan.arm", JSON.stringify({ ...JSON.parse(localStorage.getItem("fan.arm") || "{}"), ...hedgeSet })); } catch (e) {} };
    const field = (name, key, title) => {
      const labelEl = el("label", null, name), c = el("input");
      c.type = "number"; c.min = "0"; c.step = "0.5"; c.value = hedgeSet[key]; c.title = title; c.setAttribute("aria-label", title);
      c.addEventListener("change", () => { const v = Number(c.value); if (!(v >= 0)) { c.value = hedgeSet[key]; return; } hedgeSet[key] = v; save(); applyHedgeRules(); changed("lines"); });
      labelEl.append(c); return labelEl;
    };
    row.append(field("Lift $", "lift", "How much a hedge has to raise the worst case"), field("Capital ¢", "capital", "Charge per dollar put down, for hedges"));
    box.append(row);
    return box;
  }
  
  let checkRun = 0;
  async function drawKalshiCheck() {
    const box = $("ledger"), run = ++checkRun;
    box.replaceChildren(el("div", "page-stub", "Kalshi check"), el("p", "page-stub-text", Fan.trader || Fan.keyed ? "Reading Kalshi's fills…" : Fan.account ? "Connect Kalshi first: settings, Sportsbooks, Kalshi account." : "Needs the connector."));
    if (!Fan.trader && !Fan.keyed) return;
    let fills;
    try { fills = (await reader().call("run", { venue: "kalshi", name: "fills_list", args: { ms: Date.UTC(2026, 0, 1) } })).fills; }
    catch (e) { if (run === checkRun) box.replaceChildren(el("div", "page-stub", "Kalshi check"), el("p", "page-stub-text", "Could not read Kalshi: " + ((e && (e.message || e.code)) || "error"))); return; }
    if (run !== checkRun || view !== "ledger" || subView.ledger !== "check") return;
    const r = kalshiCheck(fills, allTickets), cents = v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), count = v => v.toLocaleString("en-US", { maximumFractionDigits: 2 });
    const note = el("p", "trends-note", r.off.length ? `${r.off.length} of ${r.rows.length} bets differ. Fills ${cents(r.fillPaid)}, tickets ${cents(r.ticketPaid)}.` : `All ${r.rows.length} bets match. Fills ${cents(r.fillPaid)}, tickets ${cents(r.ticketPaid)}.`);
    const table = el("table", "ledger-sheet"), head = el("tr");
    ["Bet", "Fills", "Paid", "Tickets", "Amount", "Difference"].forEach(h => head.append(el("th", null, h)));
    const thead = el("thead"), body = el("tbody"); thead.append(head);
    [...r.off, ...r.rows.filter(x => !r.off.includes(x))].forEach(x => {
      const tr = el("tr"), d = x.ticketPaid - x.fillPaid, bad = r.off.includes(x);
      tr.append(el("td", null, x.label), el("td", null, count(x.fillN)), el("td", null, cents(x.fillPaid)), el("td", null, count(x.ticketN)), el("td", null, cents(x.ticketPaid)), el("td", bad ? "loss" : "dim", bad ? (d < 0 ? "−" : "+") + cents(Math.abs(d)) : "match"));
      body.append(tr);
    });
    table.append(thead, body);
    box.replaceChildren(ledgerCard("Kalshi check", note, table));
  }
  
  
  function placeSpec() {
    if (!isKalshi()) return { why: "Only Kalshi orders can be placed" };
    if (mode !== "straight") return { why: "Parlays cannot be placed" };
    if ($("bonus").checked) return { why: "A bonus bet cannot be placed" };
    const l = readLeg(), a = parseFloat($("amount").value);
    if (!l || !(a > 0) || !centsOk(l.cents)) return { why: "Fill in the ticket" };
    const limit = Calc.placeLimit(l.cents, $("payup").value), g = GAMES[gameSelect.value], p = limit / 100, m = kalshiMarket(g, l);
    if (m.why) return { why: m.why };
    const { tk, side } = m, txt = l.type === "Moneyline" ? `${l.side} to win` : `${l.side} ${lineShown(l.type, l.line)}`;
    const n = contractsFor(a, p);
    if (n < 1) return { why: "Not enough for one contract with the fee" };
    return { h: { tk, side, n, ask: p, ticketCents: l.cents, txt, gk: l.key, gn: l.game, gt: l.kickoff, ticketFields: { type: l.type, side: l.side, ...(l.type !== "Moneyline" ? { line: l.line } : {}) } } };
  }
  
  try { const v = localStorage.getItem("fan.payup"); if (v != null) $("payup").value = v; } catch (e) {}
  $("payup").addEventListener("input", e => { try { localStorage.setItem("fan.payup", e.target.value); } catch (err) {} syncPlace(); });
  function syncPlace() {
    try {
      $("payupBox").hidden = !isKalshi();
      const b = $("placeBtn"), s = placeSpec(), ok = !!s.h && !!Fan.trader && !execBusy;
      b.disabled = !ok; b.classList.toggle("ready", ok); b.textContent = execBusy ? "Sending…" : Fan.env === "demo" ? "Place (demo)" : "Place";
      b.title = ok ? `Buy ${s.h.n} ${s.h.side.toUpperCase()} on ${s.h.tk} at ${Math.round(s.h.ask * 100)}¢ or better, immediate-or-cancel` : s.h ? "Needs the connector (" + (Fan.traderWhy || "still checking") + ")" : s.why;
    } catch (e) {}   
  }
  $("placeBtn").addEventListener("click", async () => {
    const s = placeSpec();
    if (!s.h || execBusy || !Fan.trader) return;
    placeNote("Sending to Kalshi…");
    const run = runExec(s.h, "ticket"); syncPlace();
    await run;
    placeNote(lastExec.text, lastExec.cls);
    if (lastExec.cls === "ok") clearTicket();
    syncPlace();
  });
export { showDemo, demoAway, pendingFills, execShare, execButton, execResult, limitSlider, handleFill, placeSpec, refreshPrices, drawKalshiCheck, setBet, syncPlace };
