// Trading: Place, Execute, the fill feed, the Kalshi check. It reaches a venue only through Fan.trader, and stays off when nothing fills that socket.
import { addTicket, centsOk, clearTicket, gameSel, inStore, isKalshi, ledgerCard, lineShown, mode, placeNote, readLeg, ticketsReady, updateTicket } from "./tracker.js?v=mw2tx7b1";
import { Fan } from "./hosts.js?v=mw2tx7b1";
import { Calc } from "./calc.js?v=mw2tx7b1";
import { ticketFromFill, nick, changed, $, ALL_GAMES, GAMES, RULES, allTickets, calc, hedgeFor, contractsFor, dayFmt, el, fillAmounts, fillSide, freshPrices, gameKey, gameLabel, kalshiCheck, kalshiMarket, last, later, leagueId, odds, readTicker, replyFill, riskGame, subView, timeZoned, marketWanted, pricesOn, trackingOn, view } from "./base.js?v=mw2tx7b1";
import { ABBR, slateDocId } from "./leagues.js?v=mw2tx7b1";
  Object.assign(later, { hedgeControls, execControls, renderKalshiCheck, syncPlace });
  // EXECUTE. The suggested bet's button and Place send one limit order, immediate-or-cancel, through Fan.trader. One click, one order: no caps or confirmations here by design.
  let execBusy = false, lastExec = null, execPct = 100;   // lastExec = { at: Date.now(), sig, text, cls } so the result survives the card's redraws
  (async () => {
    await Fan.connectTrader();
    showDemo();
    changed("settings");
    if (riskGame) changed("exec");
    syncPlace();
    if (reader()) { pendingFills().catch(() => {}); feedLoop(); }
  })();
  // A demo key says so everywhere orders are: a badge on every view, the tab's title and the buttons that send.
  function showDemo() {
    if (Fan.env !== "demo") return;
    document.documentElement.classList.add("demo");
    document.title = "DEMO " + document.title;
    const b = el("span", "demo-badge", "DEMO");
    b.id = "demoBadge"; b.title = "Kalshi's demo, fake money";
    $("infoVer").after(b);   // at the info line's far right
    $("fanBtn").setAttribute("aria-label", "Fan, settings, on Kalshi's demo with fake money");
  }
  // A connector that isn't answering holds no key that this page can see, so the badge goes until it's back.
  function demoAway(away) {
    const b = $("demoBadge");
    if (!b) return;
    b.hidden = away;
    document.documentElement.classList.toggle("demo", !away);
    document.title = (away ? "" : "DEMO ") + document.title.replace(/^DEMO /, "");
  }
  let feedWaiting = Date.now();   // when the feed last stopped being connected
  const reader = () => Fan.trader || Fan.reads;   // what can read the venue, whether or not it takes orders
  async function setBet(on) {
    try { await Fan.setBet(on); } catch (e) {}
    syncPlace(); changed("exec", "settings");
  }
  // FILL FEED. wait_fill stays open until a fill arrives. Every fill is logged to the fills collection
  // (doc feed-<trade_id>, so a repeat overwrites itself) and shown with its delay. It does not save tickets yet: Execute saves its own from the order's reply.
  const feedShow = (text, cls) => { const n = document.getElementById("feedNote"); if (n) { n.textContent = text; n.className = cls || ""; } };
  // A fill moves that game's book, so its prices are re-read at once through Fan.trader and saved to the slate doc: the card, the risk detail and the
  // suggestion redraw now, and the next snapshot cannot bring the older prices back. Before kickoff the line takes the cheaper of Kalshi's fresh ask and Polymarket's last saved one; once
  // under way `live` is Kalshi alone and `line`, the closing line, is never touched.
  const priceBusy = new Map();   // event key -> ticker to read again when the read in flight ends
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
    if (!pricesOn() || venue !== "kalshi") return;   // the page's prices are Kalshi's; another venue's fill has its own ladder to read when it gets one
    const key = String(ticker).split("-")[1];
    if (priceBusy.has(key)) { priceBusy.set(key, ticker); return; }   // several fills of one order: one more read after this one
    priceBusy.set(key, null);
    try {
      const q = await reader().call("market_prices", { venue, ticker });
      if (q && !q.skip) applyFreshPrices(q);
    } catch (e) { feedShow("Prices not refreshed: " + ((e && (e.code || e.message)) || "error"), "off"); }
    const again = priceBusy.get(key);
    priceBusy.delete(key);
    if (again) refreshPrices(again, venue);
  }
  // The connector saves each fill the moment it hears it, marked handled: false. The page makes the ticket and marks it handled, so a fill heard with no page open waits in the records, unless the
  // connector makes it first. A record without the mark was handled long ago.
  // Every fill becomes one ticket per order: Place and Execute save theirs from the order's reply, so only a fill from anywhere else is saved here.
  // A fill the fills collection already holds was handled before (the feed repeats fills on reload), so a ticket you deleted stays deleted.
  const OTHER_WINDOW_MS = 5000;   // Claude's default
  const ownOrders = new Map(), fillTix = new Map();   // ownOrders: client id of an order this page sent -> its fills so far; fillTix: order id -> its ticket, ahead of the snapshot
  function saveFillTicket(x) {
    if (x.env === "demo") return;
    const id = `fill-${x.venue}-${x.order_id}`, out = ticketFromFill(x, fillTix.get(id) || allTickets.find(t => t.id === id), k => dayFmt.format(new Date(k)) + ", " + timeZoned(new Date(k)));
    if (!out) return;
    fillTix.set(id, out.ticket);
    return inStore ? Fan.store.set("wagers", id, out.ticket) : undefined;
  }
  async function handleFill(x, delayMs) {
    await ticketsReady;
    const id = x.venue === "kalshi" ? x.trade_id : x.venue + "-" + x.trade_id;
    let known = false, waiting = false, savedClient = null;
    try {
      if (inStore && x.env !== "demo") {
        const had = await Fan.store.get("fills", "feed-" + id);
        savedClient = had && had.client;   // a fill replayed after a restart comes from Kalshi's list, which leaves out the client id. The record heard live has it, and without it the order's own ticket isn't recognized and a second one gets made
        waiting = !!had && had.handled === false; known = !!had && !waiting;
        if (!had) Fan.store.set("fills", "feed-" + id, { at: Date.now(), venue: x.venue, env: x.env, source: x.catchup ? "catchup" : "feed", ticker: x.ticker, side: x.side, action: x.action, price: x.price, filled: x.count, fee: x.fee, order: x.order_id, client: x.client_order_id || null, tradeMs: x.ts_ms, serverMs: x.received_ms, ...(x.catchup ? {} : { delayMs }), reply: x.raw }).catch(() => {});
      }
    } catch (e) {}
    const done = () => { if (waiting) Fan.store.update("fills", "feed-" + id, { handled: true, ...(x.catchup ? {} : { delayMs }) }).catch(() => {}); };
    const cid = x.client_order_id || savedClient;
    if (cid && ownOrders.has(cid)) { ownOrders.get(cid).push(x); return; }   // its ticket comes from the order's reply; its money, from the fills (calc.js's withFills)
    if (known) return;
    // Another Fan window may have sent this order, and its ticket comes with the order's reply, after the fill. Give it time to arrive before saving one from the fill.
    if (cid && Date.now() - x.ts_ms < 60000) await new Promise(r => setTimeout(r, OTHER_WINDOW_MS));
    if (cid && allTickets.some(t => t.fillId === cid && t.id !== `fill-${x.venue}-${x.order_id}`)) return done();
    try { await saveFillTicket(x); done(); } catch (e) {}   // not marked, so it's tried again on the next opening
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
        const r = await reader().call("wait_fill", { ...(boot ? { boot, after } : {}), timeout_ms: boot ? 20000 : 1 });   // the first call is only to learn the feed's state, so it doesn't wait for a fill. A fill after it is still caught, by its place in the stream
        boot = r.boot; after = r.seq; tries = 0;
        // Fills from every venue arrive in one shape (see the server's venues/host.js). A catch-up fill was missed while disconnected or closed: it is logged, but it says nothing about the book now.
        (r.fills || []).forEach(x => {
          handleFill(x, Date.now() - x.ts_ms);
          if (!x.catchup) refreshPrices(x.ticker, x.venue);
        });
        const fs = Calc.feedState(r.venues, Date.now() - (feedWaiting || (feedWaiting = Date.now())));
        if (fs.cls === "on") feedWaiting = 0;
        if (Fan.keyed === false) feedShow("", ""); else feedShow(fs.text, fs.cls);   // with no key there's nothing for it to connect to, and the settings window says so
      } catch (e) {
        const c = e && e.code;
        if (!(e && e.retryable) || (++tries > 3 && !e.keepTrying)) { feedShow(c === "server_not_connected" ? "" : "Feed off: " + (c || "error"), "off"); return; }
        feedShow("Feed off: retrying", "off");
        await new Promise(res => setTimeout(res, (e.retryAfterMs || 5000) + Math.random() * 1000));
      }
    }
  }
  // The suggested bet's Execute button and its size slider.
  function execControls(h, sig) {
    const hx = el("div", "hx"), btn = el("button", "hxbtn"), sl = el("input", "hxsl");
    const cnt = () => Math.max(1, Math.round(h.n * execPct / 100)), lab = () => { btn.textContent = execBusy ? "Sending…" : `Execute ${execPct}%${Fan.env === "demo" ? " (demo)" : ""}`; btn.title = Fan.trader ? `Buy ${cnt()} ${h.side.toUpperCase()} on ${h.tk} at ${Math.round(h.ask * 100)}¢ or better, immediate-or-cancel` : "Needs the connector (" + (Fan.traderWhy || "still checking") + ")"; };
    btn.type = "button"; btn.disabled = execBusy || !Fan.trader;
    sl.type = "range"; sl.min = "10"; sl.max = "100"; sl.step = "10"; sl.value = String(execPct); sl.disabled = execBusy; sl.title = "Share of the suggested size to send";   // the slider scales the suggestion: the label shows the share, the order sends that share of the contracts
    sl.addEventListener("input", () => { execPct = Number(sl.value); lab(); });
    lab();
    btn.addEventListener("click", e => { e.stopPropagation(); runExec({ ...h, n: cnt() }, sig); });
    hx.append(btn, sl); if (lastExec && lastExec.sig === sig && Date.now() - lastExec.at < 6e5) hx.append(el("span", "hxres " + lastExec.cls, lastExec.text));
    return hx;
  }
  async function runExec(h, sig) {
    if (execBusy || !Fan.trader) return;
    execBusy = true; lastExec = { at: Date.now(), sig, text: "Sending to Kalshi…", cls: "" }; changed("exec");
    const id = (crypto.randomUUID ? crypto.randomUUID() : "fan-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    ownOrders.set(id, []);
    try {
      const r = await Fan.trader.call("place_order", { ticker: h.tk, side: h.side, count: h.n, price: h.ask, client_order_id: id });
      const o = r && typeof r === "object" ? r : {}, env = o.env === "demo" ? " (demo)" : "";
      const fill = replyFill(o, h.side, h.ask), avgPx = fill.avg;
      if (o.dryRun) lastExec = { at: Date.now(), sig, text: "Dry run: nothing was sent.", cls: "" };
      else {
        // Every reply goes into the fills collection (id = the order's client id), filled or not.
        try {
          if (inStore) Fan.store.set("fills", id, {
            at: Date.now(), env: o.env || "prod", game: h.gn || null, key: h.gk || null, bet: h.txt, ticker: h.tk, side: h.side, price: h.ask,
            requested: o.requested != null ? o.requested : h.n, filled: o.filled || 0, unfilled: o.unfilled != null ? o.unfilled : null,
            averagePrice: avgPx, feePerContract: o.average_fee_paid != null ? o.average_fee_paid : null,
            reply: JSON.parse(JSON.stringify(o))
          }).catch(() => {});
        } catch (e) {}
        // The fill is known for certain from the order's own reply, so it is saved as a Kalshi ticket at once (contracts filled, total paid fee included).
        if (o.filled > 0 && h.tkt && o.env !== "demo") {   // a demo order makes no ticket
          try {
            const { contracts: C, amount, american, cents, fee } = fill, ml = h.tkt.type === "Moneyline";
            addTicket({
              key: h.gk, game: h.gn, kickoff: h.gt, book: "Kalshi", amount, bonus: false, createdAt: Date.now(), fillId: id,
              type: h.tkt.type, side: h.tkt.side, ...(ml ? { line: american } : { line: h.tkt.line, odds: american }),
              kalshi: { cents, contracts: C, fee },
              pick: `${h.tkt.side}${ml ? "" : " " + lineShown(h.tkt.type, h.tkt.line)} ${cents}¢`,
              when: dayFmt.format(new Date(h.gt)) + ", " + timeZoned(new Date(h.gt))
            });
          } catch (e) {}
        }
        const paidUp = h.ticketCents != null && Math.round(h.ask * 100) !== h.ticketCents ? ` (ticket ${h.ticketCents}¢, limit ${Math.round(h.ask * 100)}¢)` : "", px = avgPx != null ? ` at ${(avgPx * 100).toFixed(1)}¢${paidUp}` : "", fee = o.average_fee_paid ? `, fee ${(o.average_fee_paid * 100).toFixed(1)}¢ each` : "";
        const moved = (o.funded || []).map(f => `moved $${f.dollars.toFixed(2)} to shard ${f.to}`).join(", "), movedNote = moved ? `; ${moved}` : "";   // cash the order needed on its market's shard stays there
        lastExec = { at: Date.now(), sig, cls: o.filled > 0 ? "ok" : "err", text: (o.filled > 0 ? `Filled ${o.filled} of ${o.requested}${px}${fee}${o.unfilled ? `; ${o.unfilled} not filled at ${Math.round(h.ask * 100)}¢ or better (canceled)` : ""}${env}` : `Nothing filled at ${Math.round(h.ask * 100)}¢ or better (canceled)${env}`) + movedNote };
      }
    } catch (e) {
      // No reply, so no ticket from it: any fill of this order that reached the feed is saved from the feed, now and later.
      const held = ownOrders.get(id) || []; ownOrders.delete(id);
      held.forEach(x => { try { Promise.resolve(saveFillTicket(x)).catch(() => {}); } catch (err) {} });
      const c = e && e.code, m = e && e.message;
      lastExec = { at: Date.now(), sig, cls: "err", text: c === "server_not_connected" ? "The connector isn't running."
        : c === "approval_required" || c === "cancelled" || c === "not_in_manifest" ? "Not approved in the app, nothing was sent."
        : c === "tool_error" ? `Kalshi refused: ${m}`
        : c === "server_unavailable" || c === "upstream_error" ? "No answer: check Kalshi before sending again, the order may have gone through."
        : `${c || "error"}: ${m || ""}` };
    }
    execBusy = false; changed("exec");
  }
  // The hedge suggestion's two settings, Lift and Capital, kept per browser (under Arm's old key, fan.arm). They shape the suggested bet everywhere, Execute's included. Arm's panel held them
  // until Arm was taken out (Nov 3 2026); now they're the risk detail's, for any game with positions.
  const hedgeSet = { lift: RULES.hedge.LIFT, capital: RULES.hedge.CAPITAL * 100 };
  try { const s = JSON.parse(localStorage.getItem("fan.arm") || "{}"); ["lift", "capital"].forEach(k => { if (s[k] != null) hedgeSet[k] = s[k]; }); } catch (e) {}
  const applyHedgeRules = () => { RULES.hedge.LIFT = hedgeSet.lift; RULES.hedge.CAPITAL = hedgeSet.capital / 100; };
  applyHedgeRules();
  function hedgeControls() {
    const box = el("div", "rk-tune"), row = el("div", "ar");
    const save = () => { try { localStorage.setItem("fan.arm", JSON.stringify({ ...JSON.parse(localStorage.getItem("fan.arm") || "{}"), ...hedgeSet })); } catch (e) {} };
    const field = (name, key, title) => {
      const lab = el("label", null, name), c = el("input");
      c.type = "number"; c.min = "0"; c.step = "0.5"; c.value = hedgeSet[key]; c.title = title; c.setAttribute("aria-label", title);
      c.addEventListener("change", () => { const v = Number(c.value); if (!(v >= 0)) { c.value = hedgeSet[key]; return; } hedgeSet[key] = v; save(); applyHedgeRules(); changed("lines"); });
      lab.append(c); return lab;
    };
    row.append(field("Lift $", "lift", "How much a hedge has to raise the worst case"), field("Capital ¢", "capital", "Charge per dollar put down, for hedges"));
    box.append(row);
    return box;
  }
  // The Ledger's Kalshi check: every fill on the account against the saved tickets, read when opened. Reads only.
  let checkRun = 0;
  async function renderKalshiCheck() {
    const box = $("ledger"), run = ++checkRun;
    box.replaceChildren(el("div", "pg-stub", "Kalshi check"), el("p", "pg-stub-t", Fan.trader || Fan.keyed ? "Reading Kalshi's fills…" : Fan.account ? "Connect Kalshi first: settings, Sportsbooks, Kalshi account." : "Needs the connector."));
    if (!Fan.trader && !Fan.keyed) return;
    let fills;
    try { fills = (await reader().call("run", { venue: "kalshi", name: "fills_list", args: { ms: Date.UTC(2026, 0, 1) } })).fills; }
    catch (e) { if (run === checkRun) box.replaceChildren(el("div", "pg-stub", "Kalshi check"), el("p", "pg-stub-t", "Could not read Kalshi: " + ((e && (e.message || e.code)) || "error"))); return; }
    if (run !== checkRun || view !== "ledger" || subView.ledger !== "check") return;
    const r = kalshiCheck(fills, allTickets), cents = v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), count = v => v.toLocaleString("en-US", { maximumFractionDigits: 2 });
    const note = el("p", "pb-note", r.off.length ? `${r.off.length} of ${r.rows.length} bets differ. Fills ${cents(r.fillPaid)}, tickets ${cents(r.ticketPaid)}.` : `All ${r.rows.length} bets match. Fills ${cents(r.fillPaid)}, tickets ${cents(r.ticketPaid)}.`);
    const table = el("table", "lsheet"), head = el("tr");
    ["Bet", "Fills", "Paid", "Tickets", "Amount", "Difference"].forEach(h => head.append(el("th", null, h)));
    const thead = el("thead"), body = el("tbody"); thead.append(head);
    [...r.off, ...r.rows.filter(x => !r.off.includes(x))].forEach(x => {
      const tr = el("tr"), d = x.ticketPaid - x.fillPaid, bad = r.off.includes(x);
      tr.append(el("td", null, x.label), el("td", null, count(x.fillN)), el("td", null, cents(x.fillPaid)), el("td", null, count(x.ticketN)), el("td", null, cents(x.ticketPaid)), el("td", bad ? "neg" : "dim", bad ? (d < 0 ? "−" : "+") + cents(Math.abs(d)) : "match"));
      body.append(tr);
    });
    table.append(thead, body);
    box.replaceChildren(ledgerCard("Kalshi check", note, table));
  }
  // PLACE sends the ticket to Kalshi: the ticket's price is the limit, immediate-or-cancel, contracts = what the amount buys with the fee. Tickers come from the slate's ladder,
  // so moneylines and spread strikes on the ladder can be placed; totals and parlays cannot. Book only records a bet made elsewhere.
  function placeSpec() {
    if (!isKalshi()) return { why: "Only Kalshi orders can be placed" };
    if (mode !== "straight") return { why: "Parlays cannot be placed" };
    if ($("bonus").checked) return { why: "A bonus bet cannot be placed" };
    const l = readLeg(), a = parseFloat($("amount").value);
    if (!l || !(a > 0) || !centsOk(l.cents)) return { why: "Fill in the ticket" };
    const limit = Calc.placeLimit(l.cents, $("payup").value), g = GAMES[gameSel.value], p = limit / 100, m = kalshiMarket(g, l);
    if (m.why) return { why: m.why };
    const { tk, side } = m, txt = l.type === "Moneyline" ? `${l.side} to win` : `${l.side} ${lineShown(l.type, l.line)}`;
    const n = contractsFor(a, p);
    if (n < 1) return { why: "Not enough for one contract with the fee" };
    return { h: { tk, side, n, ask: p, ticketCents: l.cents, txt, gk: l.key, gn: l.game, gt: l.kickoff, tkt: { type: l.type, side: l.side, ...(l.type !== "Moneyline" ? { line: l.line } : {}) } } };
  }
  // What Place may pay above the ticket's price, kept per browser. 0 until the user sets it: Claude's default, and the order is as it always was.
  try { const v = localStorage.getItem("fan.payup"); if (v != null) $("payup").value = v; } catch (e) {}
  $("payup").addEventListener("input", e => { try { localStorage.setItem("fan.payup", e.target.value); } catch (err) {} syncPlace(); });
  function syncPlace() {
    try {
      $("payupBox").hidden = !isKalshi();
      const b = $("placeBtn"), s = placeSpec(), ok = !!s.h && !!Fan.trader && !execBusy;
      b.disabled = !ok; b.classList.toggle("ready", ok); b.textContent = execBusy ? "Sending…" : Fan.env === "demo" ? "Place (demo)" : "Place";
      b.title = ok ? `Buy ${s.h.n} ${s.h.side.toUpperCase()} on ${s.h.tk} at ${Math.round(s.h.ask * 100)}¢ or better, immediate-or-cancel` : s.h ? "Needs the connector (" + (Fan.traderWhy || "still checking") + ")" : s.why;
    } catch (e) {}   // the first renders run before the ticket's state exists
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
export { showDemo, demoAway, pendingFills, execControls, handleFill, placeSpec, refreshPrices, renderKalshiCheck, setBet, syncPlace };
