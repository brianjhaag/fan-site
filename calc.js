// Fan's calculations: every decision about money. No screen, storage or network, so all of it runs in tests (test/calc.test.js).
// Calc.make(deps) binds what depends on the schedule and the clock: deps = { games: every game, now(): the clock, abbr(nickname): the team's code }. Tickets are always passed in.
// RULES is the one home for tunable numbers: userSet is the user's (change only on the user's say-so), defaults are Claude's. SPEC.md section 13 explains each.
const Calc = (() => {
  const RULES = {
    userSet: { capital: 0.05, theoCash: 10 / 220, theoBonus: 0.45, pairBase: 1000, hcHurdle: 0.03, hcDivDvoa: 0.67 },   // hcHurdle: the Handicap's EV hurdle, its starting value (the user, Nov 4 2026: "start with 3"); hcDivDvoa: the DVOA difference's share in a divisional game ("0.67")
    defaults: {
      hold: 0.045, spreadPrice: -110, kalshiFee: 0.07,
      lift: 10, hedgeMinPay: 0.25, hedgeMaxPay: 0.75, lockFloor: 0.5, hedgeStep: 5, hedgeMaxContracts: 5000,
      tolPerPoint: 0.005, bandKeep: 0.25, narrow: 0.25
    }
  };
  // One entry per league: a new league is mostly a new entry. sigma and totalSd size the models (the NBA's are estimates, not fitted); keyNumbers: final margins bunch on key numbers;
  // maxMargin: the widest final margin to consider; ties: a game can end level; daily: a slate is one day, not a week; codeChips: team chips show the code, not the nickname;
  // graphMinMargin: the P/L graph's narrowest margin axis (0 = its default); byes, graphs, stats, gameDetails: what the league has built (stats: Playbook and Season stats' later views);
  // handicap: the Handicap section's pricing screen is built (the NFL first, Nov 4 2026); season: Season stats' Margins buckets: margins from 1 to `margin`+, totals from totals[0]− to totals[1]+, a gridline every `tick`;
  // fullNames: its teams are keyed by full name, not nickname, because its nicknames meet another league's (the NHL's Panthers, Jets and Kings).
  RULES.leagues = {
    nfl: { code: "NFL", sigma: 12.25, totalSd: 9, keyNumbers: true, maxMargin: 60, ties: true, liveHours: 3.5, daily: false, codeChips: false, graphMinMargin: 0, byes: true, graphs: true, stats: true, gameDetails: true, fullNames: false, season: { margin: 25, totals: [20, 70], tick: 5 }, handicap: true },
    nba: { code: "NBA", sigma: 12, totalSd: 18, keyNumbers: false, maxMargin: 75, ties: false, liveHours: 3.5, daily: true, codeChips: true, graphMinMargin: 20, byes: false, graphs: false, stats: false, gameDetails: true, fullNames: false, season: { margin: 30, totals: [180, 270], tick: 10 }, handicap: false },
    // The NHL's sigma and totalSd are Claude's estimates (goal margins and totals both run about 2.4 goals each way), not fitted; overtime decides every game, so no ties.
    nhl: { code: "NHL", sigma: 2.4, totalSd: 2.4, keyNumbers: false, maxMargin: 12, ties: false, liveHours: 3, daily: true, codeChips: true, graphMinMargin: 0, byes: false, graphs: false, stats: false, gameDetails: true, fullNames: true, season: { margin: 6, totals: [1, 11], tick: 1 }, handicap: false }
  };
  RULES.hedge = { LIFT: RULES.defaults.lift, CAPITAL: RULES.userSet.capital };
  const D = RULES.defaults;
  const leagueId = g => (g && g.league) || "nfl";
  const leagueOf = g => RULES.leagues[leagueId(g)];

  /* ==== Names and prices ==== */
  const last = n => n.split(" ").pop();
  // A team's name as the tables key it (leagues.js's TEAM): its nickname, or its full name in a league with fullNames.
  const nick = (g, side) => leagueOf(g).fullNames ? g[side] : last(g[side]);
  const gameLabel = g => `${nick(g, "away")} at ${nick(g, "home")}`;
  const gameKey = g => g.t + "|" + gameLabel(g);
  // A market at 100¢ has no American odds: its price is infinite, and it reaches here as that or, after being saved, as nothing.
  const atFull = od => !od || !Number.isFinite(od);
  const odds = n => (atFull(n) ? "−∞" : (n > 0 ? "+" : "−") + Math.abs(n));
  const pts = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);   // a spread as the page writes it: +3.5, −3.5
  const profitOf = (amt, od) => atFull(od) ? 0 : od > 0 ? amt * od / 100 : amt * 100 / -od;
  const decimalOf = od => atFull(od) ? 1 : od > 0 ? 1 + od / 100 : 1 + 100 / -od;
  const ticketPrice = t => t.parlay ? t.odds : t.type === "Moneyline" ? t.line : (t.odds ?? D.spreadPrice);
  // American odds from a price that pays $1: exact, and rounded the way a quote is.
  const americanOf = p => (p > 0.5 ? -100 * p / (1 - p) : 100 * (1 - p) / p);
  const quoteOf = p => (p > 0.5 ? -Math.round(100 * p / (1 - p)) : Math.round(100 * (1 - p) / p));
  const centsOf = am => Math.min(99, Math.max(1, Math.round(100 / decimalOf(am))));
  // A side's chance from a two-way moneyline, the vig taken out.
  const noVig = (ml, away) => {
    const [fa, fh] = ml.map(atFull);
    if (fa !== fh) return (away ? fa : fh) ? 1 : 0;   // one side at 100¢: that's the market's whole say, not something to take vig out of
    const qa = 1 / decimalOf(ml[0]), qh = 1 / decimalOf(ml[1]);
    return (away ? qa : qh) / (qa + qh);
  };
  const winPct = (ml, away) => Math.round(noVig(ml, away) * 100);   // a team's chance to win from the moneyline, no vig, as a whole percent
  // What the fill feed says: a venue that simply hasn't connected yet is starting, for its first minute [C]. An error, or a minute of no connection, is a problem.
  const feedState = (venues, waitedMs) => {
    const off = Object.entries(venues || {}).filter(([, v]) => !v.connected || v.error || v.reloadError);
    if (!off.length) return { text: "Feed live", cls: "on" };
    if (waitedMs < 60000 && off.every(([, v]) => !v.error && !v.reloadError)) return { text: "Feed starting", cls: "wait" };
    return { text: "Feed off, " + off.map(([n, v]) => `${n}: ${v.reloadError ? "new code failed, old running: " + v.reloadError : v.error || "off"}`).join("; "), cls: "off" };
  };
  const noVigHome = ml => noVig(ml, false) * 100;
  // The spread a moneyline implies (Nov 3 2026), for a game whose market has a moneyline but no spread yet, so the models keep their center: the away side's line, which is
  // the home team's expected margin, from the no-vig chance and the league's margin spread (sigma), to the half point. Shown nowhere as a price: the card dashes it.
  const invNorm = p => {   // the standard normal's inverse (Acklam's), good to about 1e-9
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - 0.02425) return -invNorm(1 - p);
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };
  const spreadFromMl = (ml, sigma) => { const v = Math.round(sigma * invNorm(Math.min(0.999, Math.max(0.001, noVig(ml, false)))) * 2) / 2; return v === 0 ? 0 : v; };

  /* ==== Bonus bets ==== */
  // A bonus bet risks none of your cash, but spending it forfeits its value: what a hedge at fair odds would lock in,
  // stake x (1 - 1/decimal odds). A $200 bonus bet at -110 is worth about $95.
  // The price is capped at +100, so a bonus bet is never worth more than half its face value.
  const bonusFactor = od => 1 - 1 / (od > 0 ? 1 + Math.min(od, 100) / 100 : 1 + 100 / -od);
  const riskOf = (t, od) => t.bonus ? t.amount * bonusFactor(od) : t.amount;
  function winChance(t) {
    const q = 1 / decimalOf(ticketPrice(t));
    return t.kalshi ? q : Math.min(0.99, q / Math.pow(1 + D.hold, t.parlay ? t.legs.length : 1));
  }

  /* ==== Kalshi: fees, sizing, fills, markets ==== */
  // What Kalshi charges per contract, and on an order: 7% of contracts x price x (1 - price), rounded up to the cent.
  const feePer = p => D.kalshiFee * p * (1 - p);
  const kalshiFee = (contracts, price) => Math.ceil(D.kalshiFee * contracts * price * (1 - price) * 100 - 1e-9) / 100;
  // The most contracts an amount buys, fee included.
  const contractsFor = (amount, p) => Math.floor(amount / (p + D.kalshiFee * p * (1 - p)) + 1e-9);
  // A hand-booked Kalshi ticket: no fee is added, the amount typed is what was paid, fee included. Contracts are the dollars divided by the price; each pays $1.
  function kalshiCalc(cents, spent) {
    const C = spent / (cents / 100), dec = 100 / cents;
    return { C, cost: spent, fee: 0, total: spent, win: C - spent, american: dec >= 2 ? (dec - 1) * 100 : dec > 1 ? -100 / (dec - 1) : -10000 };
  }
  // A fill as a bet: selling YES at p is the same position as buying NO at 1 - p.
  const fillSide = x => (x.action === "sell" && x.side === "yes" ? { side: "no", price: Math.round((1 - x.price) * 10000) / 10000 } : { side: x.side, price: x.price });
  // An order's trades, { id: { n, p, fee } }, as ticket figures. The amount is everything paid, the fee counted once.
  function fillAmounts(trades) {
    const list = Object.values(trades), C = list.reduce((s, r) => s + r.n, 0), cost = list.reduce((s, r) => s + r.n * r.p, 0), fee = list.reduce((s, r) => s + r.fee, 0), total = cost + fee, dec = C / total;
    return { contracts: C, cost, fee, total, american: dec >= 2 ? Math.round((dec - 1) * 100) : -Math.round(100 / (dec - 1)), cents: Math.round(cost / C * 1000) / 10 };
  }
  // Kalshi's fills against the records, as tools/dev/check-records.js and the connector's timed check both run it: is each fill saved, does each order have one ticket, and do contracts and dollars agree.
  // fills: Kalshi's (the fills_list tool), wagers and saved: the records' wagers and fills, as { id, data }. since: tickets older than this aren't looked for. `bad` counts what doesn't agree.
  function reconcile(fills, wagers, saved, since) {
    const orders = new Map();
    fills.forEach(x => { if (!orders.has(x.order_id)) orders.set(x.order_id, { order: x.order_id, client: x.client_order_id || null, ticker: x.ticker, trades: {} }); const { price } = fillSide(x); orders.get(x.order_id).trades[x.trade_id] = { n: x.count, p: price, fee: x.fee }; });
    const out = { orders: orders.size, fills: fills.length, notSaved: [], noTicket: [], twoTickets: [], differ: [], matched: 0, byAmount: 0, merged: [] };
    const savedIds = new Set(saved.map(r => r.id)), clientOf = new Map();
    saved.forEach(r => { if (r.data.order && r.data.client) clientOf.set(r.data.order, r.data.client); });   // Kalshi's list of fills leaves out the client id; the feed's record keeps it
    fills.forEach(x => { if (!savedIds.has("feed-" + x.trade_id)) out.notSaved.push(x); });
    const used = new Set();
    // First by id. Then, for tickets older than the ids, one ticket of the same contracts and dollars.
    const byId = new Map();
    orders.forEach(o => {
      const client = o.client || clientOf.get(o.order);
      const found = wagers.filter(w => w.id === "fill-kalshi-" + o.order || (client && w.data.fillId === client));
      found.forEach(w => used.add(w.id));
      byId.set(o.order, found);
    });
    orders.forEach(o => {
      const a = fillAmounts(o.trades), found = byId.get(o.order);
      if (found.length) return;
      const same = wagers.find(w => !used.has(w.id) && w.data.book === "Kalshi" && w.data.kalshi && Math.abs(w.data.kalshi.contracts - a.contracts) <= 0.005 && Math.abs(w.data.amount - a.total) < 0.05);
      if (same) { used.add(same.id); found.push(same); out.byAmount++; }
    });
    orders.forEach(o => {
      const found = byId.get(o.order);
      const a = fillAmounts(o.trades), row = { order: o.order, ticker: o.ticker, contracts: a.contracts, paid: a.total };
      if (!found.length) return out.noTicket.push(row);
      if (found.length > 1) return out.twoTickets.push({ ...row, tickets: found.map(w => w.id) });
      const k = found[0].data.kalshi || {}, c = k.contracts, amt = found[0].data.amount;
      if (Math.abs(c - a.contracts) > 0.005 || Math.abs(amt - a.total) >= 0.05) return out.differ.push({ ...row, ticket: found[0].id, ticketContracts: c, ticketAmount: amt });
      out.matched++;
    });
    // One hand-booked ticket can hold several orders of one market.
    const byTicker = new Map();
    out.noTicket.forEach(x => byTicker.set(x.ticker, [...(byTicker.get(x.ticker) || []), x]));
    byTicker.forEach(group => {
      if (group.length < 2) return;
      const contracts = group.reduce((s, x) => s + x.contracts, 0), paid = group.reduce((s, x) => s + x.paid, 0);
      const same = wagers.find(w => !used.has(w.id) && w.data.book === "Kalshi" && Math.abs(w.data.amount - paid) < 0.05 && (!w.data.kalshi || Math.abs(w.data.kalshi.contracts - contracts) <= 0.005));
      if (!same) return;
      used.add(same.id);
      out.noTicket = out.noTicket.filter(x => !group.includes(x));
      out.merged.push({ ticket: same.id, orders: group.length, paid });
    });
    out.ticketsWithNoFill = wagers.filter(w => w.data.book === "Kalshi" && !w.data.parlay && !used.has(w.id) && (w.data.createdAt || 0) >= since);
    out.bad = out.notSaved.length + out.noTicket.length + out.twoTickets.length + out.differ.length;
    return out;
  }
  // The Kalshi market for a bet on game g: { tk, side }, or { why } when there is none. leg = { type, side, line }.
  function kalshiMarket(g, l) {
    const lad = g.lad && g.lad.v === 2 ? g.lad : null, an = nick(g, "away"), hn = nick(g, "home");
    if (l.type === "Moneyline") { const m = lad && lad.ml && lad.ml[l.side === hn ? "home" : "away"], tk = m && m.tk; return tk ? { tk, side: "yes" } : { why: "No Kalshi market saved for this bet" }; }
    if (l.type === "Spread" && lad) {
      const row = (lad.sp || []).find(([fav, K, , , t]) => t && K === Math.abs(l.line) && (l.line < 0 ? l.side === (fav === "home" ? hn : an) : l.side === (fav === "home" ? an : hn)));
      if (row) return { tk: row[4], side: l.line < 0 ? "yes" : "no" };
    } else if (l.type === "Total" && lad && lad.ml) {
      // Kalshi's total ticker is the game's event plus the strike rounded up: over 45.5 is KXNFLTOTAL-<event>-46, yes = over, no = under.
      const ev = ((lad.ml.away && lad.ml.away.tk) || (lad.ml.home && lad.ml.home.tk) || "").split("-")[1];
      if (!ev || Math.abs(l.line) % 1 !== .5) return { why: ev ? "Kalshi totals end in .5" : "No Kalshi market saved for this bet" };
      return { tk: `KX${leagueOf(g).code}TOTAL-${ev}-${l.line + .5}`, side: l.side === "Over" ? "yes" : "no" };
    }
    return { why: "No Kalshi market saved for this bet" };
  }
  // What an order's reply comes to, for its ticket. Kalshi reports the fill on the YES leg, so a NO order's own price is 1 minus that; with no average in the reply, the order's limit stands in.
  function replyFill(o, side, limit) {
    const avg = o.average_fill_price == null ? null : side === "no" ? Math.round((1 - o.average_fill_price) * 10000) / 10000 : o.average_fill_price;
    if (!(o.filled > 0)) return { avg };
    const contracts = o.filled, price = avg != null ? avg : limit, feeEach = o.average_fee_paid || 0, total = contracts * price + contracts * feeEach, dec = contracts / total;
    return { avg, contracts, amount: Math.round(total * 100) / 100, american: dec >= 2 ? Math.round((dec - 1) * 100) : -Math.round(100 / (dec - 1)), cents: Math.round(price * 1000) / 10, fee: Math.round(contracts * feeEach * 100) / 100 };
  }

  // Place's limit: the ticket's price plus what the user will pay up, in whole cents. An immediate-or-cancel order still fills at the best price there is, so this costs nothing unless the market moved.
  const placeLimit = (cents, up) => Math.min(99, cents + Math.max(0, Math.floor(Number(up)) || 0));
  // A fresh Kalshi read (q, from market_prices) as the fields to change on game g: the ladder's Kalshi columns (Polymarket's kept), and the live prices under way or the line before kickoff
  // (the cheaper of fresh Kalshi and saved Polymarket asks; the total is Kalshi's alone). The closing line is never touched once the game has started.
  function freshPrices(g, q, now) {
    const low = (a, b) => (a != null && b != null ? Math.min(a, b) : a != null ? a : b);
    const old = g.lad && g.lad.v === 2 ? g.lad : null, oldRow = new Map(((old && old.sp) || []).map(r => [r[0] + "|" + r[1], r]));
    const sideOf = sd => { const n = q.ml[sd], o = old && old.ml[sd]; return { ...(n && n.k != null ? { k: n.k, tk: n.tk } : {}), ...(o && o.p != null ? { p: o.p } : {}) }; };
    const fresh = new Set(q.sp.map(r => r.fav + "|" + r.K));
    const rows = [...q.sp.filter(r => r.K >= 1.5 && r.K <= 20.5).map(r => { const o = oldRow.get(r.fav + "|" + r.K); return [r.fav, r.K, r.kf, r.kd, r.tk, o ? o[5] : null, o ? o[6] : null]; }),
      ...[...oldRow].filter(([k, r]) => !fresh.has(k) && r[5] != null).map(([, r]) => [r[0], r[1], null, null, null, r[5], r[6]])].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
    const lad = { v: 2, at: q.at, ml: { away: sideOf("away"), home: sideOf("home") }, sp: rows, tot: q.tot.map(r => [r.K, r.over, r.under]) }, patch = { lad };
    const started = now >= Date.parse(g.t), near = list => list.slice().sort((a, b) => Math.abs(a.mid - .5) - Math.abs(b.mid - .5))[0];
    const both = q.sp.filter(r => { const o = oldRow.get(r.fav + "|" + r.K); return o && o[5] != null; });
    const s = near(!started && both.length ? both : q.sp), t = near(q.tot), mA = q.ml.away && q.ml.away.k, mH = q.ml.home && q.ml.home.k;
    if (s && t && mA && mH) {
      const o = oldRow.get(s.fav + "|" + s.K), pf = started || !o ? null : o[5], pd = started || !o ? null : o[6], favP = quoteOf(low(s.kf, pf)), dogP = quoteOf(low(s.kd, pd));
      const line = { sp: s.fav === "away" ? -s.K : s.K, spj: s.fav === "away" ? [favP, dogP] : [dogP, favP], tot: t.K, toj: [quoteOf(t.over), quoteOf(t.under)],
        ml: started ? [quoteOf(mA), quoteOf(mH)] : [quoteOf(low(mA, old && old.ml.away.p)), quoteOf(low(mH, old && old.ml.home.p))] };
      if (started) patch.live = { ...line, at: q.at }; else patch.line = line;
    }
    return patch;
  }

  /* ==== A leg and a ticket, by final score ==== */
  // x is the home team's margin of victory and T is total points.
  // A visitor bet at spread s wins when x < s, a home bet at -s wins when x > s, an over wins when the total is above its line.
  function legResult(l, an, x, T) {      // 1 win, 0 push, -1 loss
    if (l.type === "Moneyline") return x === 0 ? 0 : ((l.side === an) === (x < 0) ? 1 : -1);
    if (l.type === "Spread") { const th = l.side === an ? l.line : -l.line; return x === th ? 0 : ((l.side === an) === (x < th) ? 1 : -1); }
    return T === l.line ? 0 : ((l.side === "Over") === (T > l.line) ? 1 : -1);
  }
  const legsOf = t => (t.parlay ? t.legs : [{ key: t.key, type: t.type, side: t.side, line: t.line }]);
  // cash = true gives the real cash change after a game is over: a spent bonus wager that lost simply disappears (0), one that won pays its winnings.
  function ticketPL(t, an, x, T, cash) {
    const od = ticketPrice(t), rs = legsOf(t).map(l => legResult(l, an, x, T));
    if (rs.includes(-1)) return cash && t.bonus ? 0 : -riskOf(t, od);
    if (rs.includes(0)) return 0;        // a pushed parlay leg changes the price; approximated as a push
    return profitOf(t.amount, od);
  }

  /* ==== Models ==== */
  // Key-number model of NFL final margins. Shares of games by final margin 1999-2025 (7,276 games, regular season and playoffs; 22+ points was
  // 15.0% combined), from deucescracked.com/blog/nfl-margin-of-victory-data-1999-2025. Each margin's weight is its share divided by what a smooth
  // folded normal with the same bulk (P(margin <= 21) = 85%) would give, so 3 weighs ~2.9, 7 ~1.9, 14 ~1.4 and 9, 12 or 19 under 0.6; beyond 21 the weight is 1.
  const MARGIN_SHARE = { 1: 4.16, 2: 4.05, 3: 15.12, 4: 4.88, 5: 3.57, 6: 5.99, 7: 9.03, 8: 3.72, 9: 1.61, 10: 5.51, 11: 2.35, 12: 1.65, 13: 2.76, 14: 4.88, 15: 1.5, 16: 2.12, 17: 3.57, 18: 2.32, 19: 1.18, 20: 2.14, 21: 2.65 };
  const MARGIN_W = (() => {
    const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
    const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2)), s0 = 21.5 / 1.4395, w = [0];
    for (let m = 1; m <= 21; m++) w[m] = (MARGIN_SHARE[m] / 100) / (2 * (Phi((m + 0.5) / s0) - Phi((m - 0.5) / s0)));
    return m => { m = Math.abs(m); return m <= 21 ? w[m] : 1; };
  })();
  // marginModel(sigma) returns win(d): the chance a team wins outright when its spread-implied expected margin is d points (a team getting 3.5 has
  // d = -3.5). Signed final margins m (not 0) have weight MARGIN_W(|m|) * normal(m; mu, sigma); mu is solved so that the line d is the median
  // (as much weight above d as below it; a margin equal to d is a push and counts on neither side). win(d) = weight above 0 over all weight.
  function marginModel(sigma, flat) {   // flat: no key numbers (NBA)
    const MM = 70, memo = new Map();
    const detail = d => {
      if (d === 0) return { win: 0.5, over: 0.5, push: 0, P: () => 0 };
      if (memo.has(d)) return memo.get(d);
      const W = (m, mu) => (flat ? 1 : MARGIN_W(m)) * Math.exp(-0.5 * ((m - mu) / sigma) ** 2);
      const gap = mu => { let up = 0, dn = 0; for (let m = -MM; m <= MM; m++) { if (m === 0) continue; const x = W(m, mu); if (m > d) up += x; else if (m < d) dn += x; } return up - dn; };
      let lo = d - 25, hi = d + 25;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (gap(mid) > 0) hi = mid; else lo = mid; }
      const mu = (lo + hi) / 2; let win = 0, tot = 0;
      for (let m = -MM; m <= MM; m++) { if (m === 0) continue; const x = W(m, mu); tot += x; if (m > 0) win += x; }
      let over = 0, push = 0;   // beyond win/tot: the spread bet's chances (over = covers, push = lands exactly on a whole-point line)
      for (let m = -MM; m <= MM; m++) { if (m === 0) continue; const x = W(m, mu); if (m > d) over += x; else if (m === d) push += x; }
      memo.set(d, { win: win / tot, over: over / tot, push: push / tot, P: m => (m === 0 || Math.abs(m) > MM ? 0 : W(m, mu) / tot) });   // P(m): chance of a final margin of exactly m for this team
      return memo.get(d);
    };
    const f = d => detail(d).win;
    f.detail = detail;
    f.band = (d, a, b) => { const q = detail(d); let t = 0; for (let m = a; m <= b; m++) t += q.P(m); return t; };   // chance the team's margin lands from a to b
    return f;
  }
  // A league whose margins don't bunch on key numbers gets a plain normal curve.
  const liveModel = (() => { const m = {}; return g => { const k = leagueId(g), r = leagueOf(g); return m[k] || (m[k] = marginModel(r.sigma, !r.keyNumbers)); }; })();
  const totalSd = g => leagueOf(g).totalSd;
  const normCdf = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
  // A spread bet's chances at its own number, on a market where the side's spread is sTeam.
  function coverChances(g, sTeam, line) {
    const q = liveModel(g).detail(sTeam === 0 ? -0.001 : -sTeam);   // the side's expected margin is minus its spread
    let win = 0, push = 0;
    for (let m = -70; m <= 70; m++) { if (m === 0) continue; const x = q.P(m); if (m > -line) win += x; else if (m === -line) push += x; }
    return { win, push };
  }
  // VIG PAID on a ticket: stake x (1 - fair chance x decimal odds - push chance), so a price better than fair (an odds boost) is a negative cost, a rebate.
  // Fair chances come from the game's saved pre-game line (the closing line once it starts): moneyline = its no-vig chance, spread = the key-number margin
  // model at the ticket's own number, total = a normal curve around the market total. No market (no game, no line yet) = 50%, a -110 bet's fair chance.
  function fairLeg(l, g) {
    const L = g && !g.noLine && g.line;
    if (!L) return { win: 0.5, push: 0 };
    const awaySide = l.side === nick(g, "away");
    if (l.type === "Moneyline") return { win: noVig(L.ml, awaySide), push: 0 };
    if (l.type === "Spread") return coverChances(g, awaySide ? L.sp : -L.sp, l.line);
    const sd = totalSd(g), over = 1 - normCdf((l.line - L.tot) / sd), push = Number.isInteger(l.line) ? normCdf((l.line + .5 - L.tot) / sd) - normCdf((l.line - .5 - L.tot) / sd) : 0;
    return l.side === "Over" ? { win: over - push / 2, push } : { win: 1 - over - push / 2, push };
  }

  /* ==== Outcomes ==== */
  // Every final result a position can tell apart: { x: home margin, T: total, w: chance of T's region }. Everything that asks "what could happen" reads this one list.
  // A ticket's result only changes at a total line, so with a total bet in the position each side of each line is one outcome (a whole line's push its own), weighted by a normal curve
  // around the market total; a total bet has no single result. Without one, the market total stands for them all. A total can't be under the margin, so T is raised to it where needed.
  // tot: the market total to weigh around (the saved line's by default). ties: false leaves out level games, which the margin model gives no chance.
  function outcomes(g, bets, shares = [], { tot = g.line && g.line.tot, ties = leagueOf(g).ties } = {}) {
    const key = gameKey(g), r = leagueOf(g), legsHere = t => (t.parlay ? t.legs.filter(l => l.key === key) : [t]);
    const lines = [...new Set([...bets, ...shares.map(s => s.t)].flatMap(legsHere).filter(l => l.type === "Total").map(l => l.line))];
    const tots = lines.length ? [...new Set(lines.flatMap(l => (Number.isInteger(l) ? [l - 1, l, l + 1] : [Math.floor(l), Math.ceil(l)])))].sort((a, b) => a - b) : [tot];
    const edge = i => (i < 0 ? -Infinity : i >= tots.length - 1 ? Infinity : (tots[i] + tots[i + 1]) / 2), cdf = v => (v === -Infinity ? 0 : v === Infinity ? 1 : normCdf((v - tot) / totalSd(g)));
    const weight = tots.map((_, i) => (lines.length ? cdf(edge(i)) - cdf(edge(i - 1)) : 1)), out = [];
    for (let x = -r.maxMargin; x <= r.maxMargin; x++) {
      if (x === 0 && !ties) continue;
      const here = new Map();
      tots.forEach((T0, i) => { const T = lines.length ? Math.max(T0, Math.abs(x)) : T0; here.set(T, (here.get(T) || 0) + weight[i]); });
      here.forEach((w, T) => out.push({ x, T, w }));
    }
    return out;
  }

  /* ==== The flagged pair (Graphs) ==== */
  // Each team's two ways to be backed, as expected return per $1 at the actual prices (so the vig is in them). p = { g, side, sp, ml }; winProb from marginModel.
  const evMoneyline = (winProb, p) => winProb(-p.sp) * decimalOf(p.ml) - 1;
  const evPoints = (winProb, p) => { const q = winProb.detail(-p.sp), dec = decimalOf(p.g.line.spj[p.side === "home" ? 1 : 0]); return q.over * (dec - 1) - (1 - q.over - q.push); };
  const showsML = (winProb, p) => evMoneyline(winProb, p) >= evPoints(winProb, p);
  // A game is flagged when the favorite's better price is the moneyline and the underdog's the points. The two differ by a percent or so of return, which a one-cent move can flip,
  // so the favorite's moneyline may trail its points, and the underdog's points its moneyline, by a combined tolPerPoint of return per $1 for every point of spread.
  const pairFlagged = (winProb, fav, dog) => Math.max(0, evPoints(winProb, fav) - evMoneyline(winProb, fav)) + Math.max(0, evMoneyline(winProb, dog) - evPoints(winProb, dog)) <= D.tolPerPoint * Math.abs(dog.sp);
  // The popup's stakes, from the existing position's worst in each region (E_*) and each leg's profit per $1 (r*). Blowout worst = 0; the just-past-spread band worst = bandKeep of the
  // moneyline's profit on the base; small-upset worst = (1 - narrow) x big-upset worst. A stake that comes out negative is dropped: the position already has enough of it.
  function pairStakes({ aNew, rML, rD, rB, rN, Eblow, Eband, Enar, Ebig }) {
    const base = RULES.userSet.pairBase, NARROW = D.narrow;
    const bNew = Math.max(0, (D.bandKeep * rML * base - Eband + Eblow) / (1 + rB));
    const D0 = Eblow + rML * aNew - bNew, U0 = -aNew + rD * D0 + rB * bNew;
    const cNew = Math.max(0, ((1 - NARROW) * (Ebig + U0) - (Enar + U0)) / (rN * (1 + rD) + (1 - NARROW) * (1 - rD * rN)));
    return { bNew, cNew, dNew: Math.max(0, D0 + rN * cNew) };
  }

  /* ==== Playbook ==== */
  // Records and flat-bet return at the closing prices.
  function pbStats(list) {
    const win = o => profitOf(1, o), s = { n: list.length, mw: 0, ml: 0, mp: 0, aw: 0, al: 0, ap: 0, ar: 0, o: 0, u: 0, op: 0, or: 0 };
    list.forEach(t => {
      if (t.m > 0) { s.mw++; s.mp += win(t.ml); } else if (t.m < 0) { s.ml++; s.mp -= 1; }
      const c = t.m + t.sp;
      if (c > 0) { s.aw++; s.ar += win(t.spo); } else if (c < 0) { s.al++; s.ar -= 1; } else s.ap++;
      if (t.points > t.total) { s.o++; s.or += win(t.oo); } else if (t.points < t.total) { s.u++; s.or -= 1; } else s.op++;
    });
    return s;
  }

  /* ==== Handicap (the user, Nov 4 2026): the user's own theo for a game. The main calc is the projected game result, the home team's margin, from a linear
  // regression the user controls; the projected spread is that result, and the key number model turns it into a moneyline. Totals are a different calc, not here yet. ==== */
  // How each team stood before a game, from that season's earlier finals only, so a fit never sees the future: per game points for and against, net, win share
  // (a tie a half), rest days (days since its last game, 14 at most, 14 before its first), and its last game's margin (prev, null before its first).
  // games: [{ season, ms, away, home, final: [a, h] | null }]. Out: one row per game, sorted by kickoff, { g, a, h }, each side { gp, pf, pa, net, win, rest, prev };
  // a game without a final is a row too, and changes nothing.
  function hcStates(games) {
    // rest counts from the team's last game on the schedule, played or not, so a week ahead knows who's off a bye before the week between is played (Nov 4 2026)
    const seen = new Map(), sched = new Map(), out = [];
    const side = (season, team, ms) => {
      const k = season + "|" + team, s = seen.get(k), lastMs = sched.get(k), rest = lastMs === undefined ? 14 : Math.min(14, Math.round((ms - lastMs) / 864e5));
      if (!s || !s.g) return { gp: 0, pf: 0, pa: 0, net: 0, win: 0.5, rest, prev: null };
      return { gp: s.g, pf: s.pf / s.g, pa: s.pa / s.g, net: (s.pf - s.pa) / s.g, win: s.w / s.g, rest, prev: s.prev };
    };
    const add = (season, team, ms, us, them) => { const k = season + "|" + team, s = seen.get(k) || { g: 0, pf: 0, pa: 0, w: 0, last: ms }; s.g++; s.pf += us; s.pa += them; s.w += us > them ? 1 : us === them ? 0.5 : 0; s.last = ms; s.prev = us - them; seen.set(k, s); };
    games.slice().sort((p, q) => p.ms - q.ms).forEach(g => {
      out.push({ g, a: side(g.season, g.away, g.ms), h: side(g.season, g.home, g.ms) });
      if (g.final) { add(g.season, g.away, g.ms, g.final[0], g.final[1]); add(g.season, g.home, g.ms, g.final[1], g.final[0]); }
      sched.set(g.season + "|" + g.away, g.ms); sched.set(g.season + "|" + g.home, g.ms);
    });
    return out;
  }
  // The variables a game's margin may use, the user's own (Nov 4 2026), each in the visitor's terms. k: its key; short: its column's name; h: its full name; start: the
  // coefficient a new term starts at; guide: "market" for one Fit fits alone against the week's lines, "adjust" for Off bye, a measured adjustment (hcByeEffect).
  // f(h, a, x): its value from the two sides' standing before the game (hcStates) and x, what else the page has for the game ({ dvoa: [away, home] }); null when it has none.
  // Off bye is visitor minus home: +1 when only the visitor has it, -1 when only the home team does, 0 otherwise; side(s), whether one team is off a bye (1 or 0).
  const hcBye = s => (s.prev !== null && s.rest >= 13 ? 1 : 0);
  const HC_VARS = [
    { k: "vmov", short: "V MOV", h: "The visitor's average margin of victory this season", start: 0.7, guide: "market", f: (h, a) => a.net },
    // FTN's total DVOA in percent, at its latest week: one number a team for the season so far, with no past weeks, so it can only be fitted against this week's lines
    { k: "dvoa", short: "DVOA diff", h: "Total DVOA difference, visitor minus home (FTN, in percentage points)", start: 0, guide: "market", f: (h, a, x) => (x && x.dvoa && Number.isFinite(x.dvoa[0]) && Number.isFinite(x.dvoa[1]) ? x.dvoa[0] - x.dvoa[1] : null) },
    { k: "bye", short: "Off bye", h: "Off a bye (13+ days' rest after a game that season), visitor minus home: +1 the visitor only, −1 the home team only", start: 0, guide: "adjust", side: hcBye, f: (h, a) => hcBye(a) - hcBye(h) }
  ];
  // The visitor's margin from the user's equation: -HFA, then each term's coefficient times its variable. eq = { hfa, terms: [{ v, coef }] }; row = { h, a } from hcStates;
  // x as HC_VARS takes it. null when a term's variable has no value for this game (no DVOA for a team, say); a variable no longer offered counts for nothing.
  // A term's val, when a number, is the user's own value for this game, typed by hand (the user, Nov 4 2026), used instead of the variable's.
  const hcVisitorMargin = (eq, row, x) => eq.terms.reduce((s, t) => { const v = HC_VARS.find(y => y.k === t.v); if (s === null || !v) return s; const val = Number.isFinite(t.val) ? t.val : v.f(row.h, row.a, x); return val === null ? null : s + t.coef * val; }, -eq.hfa);
  // Least squares with an intercept, the variables centered on their means, so the intercept is the average result: the home team's average margin (home field
  // advantage). X: rows of numbers, y: results. Out: { b0, b, means, se, r2, rmse, n }, or null when it can't be solved.
  function olsFit(X, y) {
    const n = y.length, p = n ? X[0].length : 0;
    if (n < p + 2) return null;
    const means = Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[j], 0) / n), ybar = y.reduce((s, v) => s + v, 0) / n;
    const Xc = X.map(r => r.map((v, j) => v - means[j])), A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => Xc.reduce((s, r) => s + r[i] * r[j], 0)));
    // A's inverse by Gauss-Jordan, with partial pivoting
    const M = A.map((r, i) => [...r, ...Array.from({ length: p }, (_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < p; c++) {
      let piv = c;
      for (let r = c + 1; r < p; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-9) return null;   // a variable that's a copy of others, or never moves
      [M[c], M[piv]] = [M[piv], M[c]];
      const d = M[c][c]; M[c] = M[c].map(v => v / d);
      for (let r = 0; r < p; r++) if (r !== c) { const f = M[r][c]; if (f) M[r] = M[r].map((v, j) => v - f * M[c][j]); }
    }
    const inv = M.map(r => r.slice(p)), xty = Array.from({ length: p }, (_, j) => Xc.reduce((s, r, i) => s + r[j] * (y[i] - ybar), 0));
    const b = inv.map(r => r.reduce((s, v, j) => s + v * xty[j], 0));
    const res = y.map((v, i) => v - ybar - Xc[i].reduce((s, x, j) => s + x * b[j], 0)), sse = res.reduce((s, e) => s + e * e, 0), sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
    const s2 = sse / (n - p - 1);
    return { b0: ybar, b, means, se: inv.map((r, j) => Math.sqrt(Math.max(0, s2 * r[j]))), r2: sst ? 1 - sse / sst : 0, rmse: Math.sqrt(sse / n), n };
  }
  // The bye effect (the user, Nov 4 2026: "apply the bye effect as measured over the past seasons to both visitor and home separately"): least squares, over finals, of
  // the visitor's margin beyond -HFA on two flags, the visitor off a bye and the home team off a bye (hcBye), so each side's effect is measured on its own. rows: hcStates
  // rows with finals. Out: { v (points to the visitor when it's off a bye), h (points to the visitor when the home team is, so a home team's gain is negative), seV, seH,
  // n, onV, onH }, or null when it can't be fitted.
  function hcByeEffect(rows, hfa) {
    const f = olsFit(rows.map(r => [hcBye(r.a), hcBye(r.h)]), rows.map(r => r.g.final[0] - r.g.final[1] + hfa));
    if (!f) return null;
    return { v: f.b[0], h: f.b[1], seV: f.se[0], seH: f.se[1], n: f.n, onV: rows.filter(r => hcBye(r.a)).length, onH: rows.filter(r => hcBye(r.h)).length };
  }
  // A game's bye adjustment, in points to the visitor: 0 when neither team is off a bye, the visitor's effect when it is, the home team's when it is, both when both are.
  const hcByeAdjust = (eff, row) => (eff ? eff.v * hcBye(row.a) + eff.h * hcBye(row.h) : null);
  // One variable as the only predictor (the user, Nov 4 2026: a guide to setting coefficients): least squares of the visitor's margin y on x alone, as the equation
  // writes it, visitor margin = -HFA + coef x x. Out: { hfa, coef, r2, rmse, n }, or null when it can't be fitted.
  function hcAlone(xs, ys) {
    const f = olsFit(xs.map(x => [x]), ys);
    if (!f) return null;
    return { hfa: -(f.b0 - f.b[0] * f.means[0]), coef: f.b[0], r2: f.r2, rmse: f.rmse, n: f.n };
  }
  // A game's market prices valued at your result (the user, Nov 4 2026: one band for moneylines and spreads alike): each side's expected return per $1, from the key
  // number model's margins around your predicted home margin (winProb = marginModel(sigma)). Spread: the visitor covers when the home margin is under the market's line
  // (sp, the visitor's points), pushes on it, priced at the spread's juice (spj, -110 without one). Moneyline: your win chance at each side's market price.
  // line: { sp, spj, ml } in the page's form, [visitor, home]. Out: { sp: { v, h } | null, ml: { v, h } | null }.
  function hcEv(winProb, homeMargin, line) {
    const q = winProb.detail(homeMargin), out = { sp: null, ml: null };
    if (line && Number.isFinite(line.sp)) {
      const L = line.sp, MM = 70, j = line.spj || [], dv = decimalOf(Number.isFinite(j[0]) ? j[0] : D.spreadPrice), dh = decimalOf(Number.isFinite(j[1]) ? j[1] : D.spreadPrice);
      let pv = 0, ph = 0, push = 0;
      for (let m = -MM; m <= MM; m++) { const x = q.P(m); if (m < L) pv += x; else if (m > L) ph += x; else push += x; }
      out.sp = { v: pv * (dv - 1) - ph, h: ph * (dh - 1) - pv };
    }
    if (line && Array.isArray(line.ml) && Number.isFinite(line.ml[0]) && Number.isFinite(line.ml[1])) out.ml = { v: (1 - q.win) * decimalOf(line.ml[0]) - 1, h: q.win * decimalOf(line.ml[1]) - 1 };
    return out;
  }
  // The DVOA difference's coefficient in a divisional game (the user, Nov 4 2026: "apply an additional factor of 0.67 to the dvoa diff, to reflect the teams knowing each
  // other well"): the coefficient times RULES.userSet.hcDivDvoa when the game's Divisional box is on, the coefficient as it is otherwise.
  const hcDivCoef = (coef, divisional) => (divisional ? coef * RULES.userSet.hcDivDvoa : coef);
  // The theo from the projected result, the home team's margin: its spread (the home line, minus when favored) and each side's moneyline, rounded the way a quote is,
  // from the key number model (winProb = marginModel(sigma)).
  function hcTheo(margin, winProb) {
    const pHome = margin === 0 ? 0.5 : margin > 0 ? winProb(margin) : 1 - winProb(-margin);
    return { spread: -margin, pHome, ml: [quoteOf(1 - pHome), quoteOf(pHome)] };
  }

  // Is this a usable number for a bet? A moneyline is 100 or more either way; a total is above zero.
  function lineOk(type, n) {
    if (!Number.isFinite(n)) return false;
    return type === "Moneyline" ? Math.abs(n) >= 100 : type === "Total" ? n > 0 : true;
  }

  // The Ledger's bet types. Favorite or underdog comes from the ticket's own number when it was bet: the spread, or the price on a moneyline.
  const FAN_CLASSES = ["Favorite", "Underdog", "Pick'em", "Total", "Parlay", "Other"];
  function betClass(t) {
    if (t.parlay) return "Parlay";
    if (t.type === "Total") return "Total";
    if ((t.type !== "Spread" && t.type !== "Moneyline") || t.line == null) return "Other";
    if (t.line === 0 || (t.type === "Moneyline" && Math.abs(t.line) === 100)) return "Pick'em";
    return t.line < 0 ? "Favorite" : "Underdog";
  }

  const shared = { leagueId, leagueOf, outcomes, last, nick, gameLabel, gameKey, pts, profitOf, bonusFactor, riskOf, decimalOf, ticketPrice, winChance, legResult, ticketPL, marginModel, liveModel, totalSd, normCdf, fairLeg, lineOk, FAN_CLASSES, betClass };

  /* ==== What depends on the schedule and the clock ==== */
  function make(deps) {
    const ALL_GAMES = deps.games, abbr = deps.abbr;
    const gameOf = key => ALL_GAMES.find(x => gameKey(x) === key);
    function status(g) {
      if (g.final) return ["Final", "final"];
      const now = deps.now(), k = new Date(g.t).getTime();
      if (now < k) return ["Upcoming", ""];
      if (now < k + leagueOf(g).liveHours * 3600e3) return ["In progress", "live"];
      return ["Ended", "final"];
    }
    // A ticket's legs against the games already final. A parlay is lost as soon as one leg loses and pending until every leg is decided.
    function tally(t) {
      let lost = false, pushed = false, pending = 0;
      legsOf(t).forEach(l => {
        const g = gameOf(l.key);
        if (g && g.final) {
          const r = legResult(l, nick(g, "away"), g.final[1] - g.final[0], g.final[0] + g.final[1]);
          if (r < 0) lost = true; else if (r === 0) pushed = true;
        } else pending++;
      });
      return { lost, pushed, pending };
    }
    // How a wager settled, once its games are final: payout is what the book returns (stake plus winnings, winnings only for a bonus wager), net is the real cash change.
    function settleOf(t) {
      const { lost, pushed, pending } = tally(t), profit = profitOf(t.amount, ticketPrice(t));
      if (lost) return { state: "lost", payout: 0, net: t.bonus ? 0 : -t.amount };
      if (pending) return { state: "pending" };
      if (pushed) return { state: "push", payout: t.bonus ? 0 : t.amount, net: 0 };
      return { state: "won", payout: t.bonus ? profit : t.amount + profit, net: profit };
    }
    // A game under way is priced from its live market: a wager's win chance comes from the live moneyline (no vig), the margin model centered
    // on the live spread (spread bets), or a normal curve around the live total (total bets). Parlays keep their own price. Null without live prices.
    function liveChances(t, g) {
      if (t.parlay || !g || !g.live || status(g)[1] !== "live") return null;
      const L = g.live, awaySide = t.side === nick(g, "away");
      if (t.type === "Moneyline") { const p = noVig(L.ml, awaySide); return { win: p, lose: 1 - p }; }
      if (t.type === "Spread") { const { win, push } = coverChances(g, awaySide ? L.sp : -L.sp, t.line); return { win, lose: 1 - win - push }; }
      if (t.type === "Total") { const over = 1 - normCdf((t.line - L.tot) / totalSd(g)), p = t.side === "Over" ? over : 1 - over; return { win: p, lose: 1 - p }; }
      return null;
    }
    // Parlays: the product of the legs' fair chances (a pushed leg counts half), so teased legs through 3 and 7 are priced as what they are. Kalshi: its fee.
    // Bonus bets use the same formula (a free bet at a worse price than fair loses the same share of its value).
    function vigOf(t) {
      if (t.kalshi) { const k = t.kalshi, P = k.cents / 100; return k.fee > 0 ? k.fee : kalshiFee(k.contracts, P); }
      let win, push = 0;
      if (t.parlay) win = t.legs.reduce((p, l) => { const f = fairLeg(l, gameOf(l.key)); return p * (f.win + f.push / 2); }, 1);
      else ({ win, push } = fairLeg({ type: t.type, side: t.side, line: t.line }, gameOf(t.key)));
      return t.amount * (1 - win * decimalOf(ticketPrice(t)) - push);
    }
    function projectedPL(t) {
      const { lost, pushed, pending } = tally(t), n = legsOf(t).length;
      const cashLoss = t.bonus ? 0 : t.amount, profit = profitOf(t.amount, ticketPrice(t));
      if (lost) return -cashLoss;
      if (!pending) return pushed ? 0 : profit;
      if (!t.parlay) { const q = liveChances(t, gameOf(t.key)); if (q) return q.win * profit - q.lose * cashLoss; }   // flexes with the live win chance
      const p = Math.pow(Math.pow(winChance(t), 1 / n), pending);
      return p * profit - (1 - p) * cashLoss;
    }
    // Wagers that live entirely inside this game: its straight bets and same-game parlays.
    // A parlay's stake is spread evenly over its legs: each leg carries stake / number of legs. This is the share a game
    // is charged for a parlay that also spans other games (a same-game parlay is already counted whole in gameBets).
    // A parlay already lost on another game is dead: it is no bet on a game still to be played, so it has no share there.
    // Its whole stake and loss belong to the games already final, split over their legs, so nothing is left unaccounted for.
    const deadFor = (g, t) => !g.final && settleOf(t).state === "lost";
    const legFinal = l => !!gameOf(l.key)?.final;
    const spans = (g, t) => t.parlay && !t.legs.every(l => l.key === gameKey(g)) && t.legs.some(l => l.key === gameKey(g));
    const parlayShares = (g, tickets) => tickets
      .filter(t => spans(g, t) && !deadFor(g, t))
      .map(t => {
        const n = settleOf(t).state === "lost" ? t.legs.filter(legFinal).length : t.legs.length;
        const f = t.legs.filter(l => l.key === gameKey(g)).length / n;
        return { t, f, per: t.amount / n, share: t.amount * f };
      });
    // Wagered is real spending: every multi-game parlay, live or dead, charges each game its legs' share of the stake (stake / legs per leg).
    const spentShares = (g, tickets) => tickets.filter(t => spans(g, t)).map(t => ({ t, share: t.amount * t.legs.filter(l => l.key === gameKey(g)).length / t.legs.length }));
    // A multi-game parlay's other legs are unknown, so its share of the stake on this game is counted as fully at risk (a bonus stake at its forfeited value).
    const shareRisk = shares => shares.reduce((a, s) => a + (s.t.bonus ? s.share * bonusFactor(s.t.odds) : s.share), 0);
    const gameBets = (g, tickets) => tickets.filter(t => t.parlay ? t.legs.every(l => l.key === gameKey(g)) : (t.key === gameKey(g) || (!t.key && t.kickoff === g.t && t.game === gameLabel(g))));
    // A final game's settled cash P/L, shown on its card and added up in the totals card so the two always agree: its own wagers
    // (straights and same-game parlays) plus its share (stake or winnings x legs here / legs) of every multi-game parlay that has settled.
    // A parlay is settled as soon as a leg loses, or once all its legs are decided; a pending one adds nothing yet.
    function gameSettledPL(g, tickets) {
      if (!g.final) return null;
      const x = g.final[1] - g.final[0], T = g.final[0] + g.final[1], an = nick(g, "away"), bets = gameBets(g, tickets);
      let v = bets.reduce((s, t) => s + ticketPL(t, an, x, T, true), 0), any = bets.length > 0;
      parlayShares(g, tickets).forEach(s => { const st = settleOf(s.t); if (st.state !== "pending") { any = true; v += st.net * s.f; } });
      return any ? v : null;
    }
    // Worst and best result over every possible final score of the game.
    // Max win assumes the best case for a multi-game parlay's other legs: the parlay pays its profit share when its legs on this game
    // win and loses its stake share when one of them loses. Max risk takes the opposite view and counts the share as lost (shareRisk).
    function shareTerm(g, shares, x, T) {
      const an = nick(g, "away"), key = gameKey(g);
      return shares.reduce((s, q) => {
        const rs = q.t.legs.filter(l => l.key === key).map(l => legResult(l, an, x, T));
        return s + (rs.includes(-1) ? -riskOf(q.t, q.t.odds) * q.f : rs.includes(0) ? 0 : profitOf(q.t.amount, q.t.odds) * q.f);
      }, 0);
    }
    function extremes(g, bets, shares = []) {
      const an = nick(g, "away");
      let min = 0, max = 0;
      outcomes(g, bets, shares).forEach(({ x, T }) => {
        const v = bets.reduce((s, t) => s + ticketPL(t, an, x, T), 0), best = v + (shares.length ? shareTerm(g, shares, x, T) : 0);
        if (v < min) min = v; if (best > max) max = best;
      });
      return { maxRisk: Math.max(0, -min), maxWin: max };
    }
    // The totals card's figures for a slate. wagered is real dollars; bonus wagers are tracked apart. A final game has nothing left to win or lose; its result is in P/L.
    // Parlays across several games depend on all of them at once, so they are counted at face value until decided. pl is exactly what the game cards show.
    // theo: the normal -110 vig on cash wagered, a loss, plus about 45% of each bonus bet.
    function slateTotals(games, tickets) {
      let wagered = 0, bonusTotal = 0, risk = 0, win = 0, pl = 0, plAny = false;
      games.forEach(g => {
        const bets = gameBets(g, tickets);
        if (!bets.length) return;
        if (!g.final) { const ex = extremes(g, bets); risk += ex.maxRisk; win += ex.maxWin; }
        bets.forEach(t => { if (t.bonus) bonusTotal += t.amount; else wagered += t.amount; });
      });
      tickets.filter(t => t.parlay && new Set(t.legs.map(l => l.key)).size > 1).forEach(t => {
        if (t.bonus) bonusTotal += t.amount; else wagered += t.amount;
        if (settleOf(t).state === "pending") { risk += riskOf(t, t.odds); win += profitOf(t.amount, t.odds); }
      });
      games.forEach(g => { const v = gameSettledPL(g, tickets); if (v !== null) { plAny = true; pl += v; } });
      return { wagered, bonusTotal, risk, win, pl, plAny, expected: tickets.reduce((s, t) => s + projectedPL(t), 0), theo: -wagered * RULES.userSet.theoCash + bonusTotal * RULES.userSet.theoBonus };
    }
    // A multi-game parlay's share of this game in cash, its other legs assumed to win (a lost bonus share costs nothing).
    const shareCash = (g, t, fr, x, T) => { const rs = t.legs.filter(l => l.key === gameKey(g)).map(l => legResult(l, nick(g, "away"), x, T)); return rs.includes(-1) ? (t.bonus ? 0 : -riskOf(t, t.odds) * fr) : rs.includes(0) ? 0 : profitOf(t.amount, t.odds) * fr; };
    // A suggested bet, from the Kalshi ladder (`g.lad`) and the margin model. Straight bets and same-game parlays plus each multi-game parlay's share.
    // The money for a hedge comes from YOUR BETS: a price better than the market (a boost, a line since moved) or a bonus bet leaves the position with an edge, and a hedge may spend
    // that edge but never more of it than there is. A position with no edge gets no suggestion: closing it would just turn an expected loss into a certain one.
    // LOCK: the worst case ends in profit after the fee, whichever way the parlays' other legs go; the edge has to pay its fee and half the spread between its two sides.
    // HEDGE: the highest floor (lifted by LIFT or more, parlays' other legs assumed to win) on a leg paying hedgeMinPay to hedgeMaxPay of the time; the edge also has to pay CAPITAL per dollar put down, a charge for the added risk.
    function hedgeFor(g, bets, shares = []) {
      const live = status(g)[1] === "live", lad = g.lad, L = live ? g.live : g.line;   // under way: the live prices; before kickoff: the saved line
      if (!lad || lad.v !== 2 || !L || !(bets.length || shares.length) || g.final || g.noLine) return null;
      const an = nick(g, "away"), hn = nick(g, "home"), q = liveModel(g).detail(L.sp === 0 ? 0.001 : L.sp);
      const list = outcomes(g, bets, shares, { tot: L.tot, ties: false }), xs = list.map(o => o.x), ts = list.map(o => o.T), p = list.map(o => q.P(o.x) * o.w);
      const pTot = p.reduce((a, b) => a + b, 0) || 1;
      const own = xs.map((x, i) => bets.reduce((s, t) => s + ticketPL(t, an, x, ts[i], true), 0));   // cash results: a lost bonus bet costs nothing
      // Multi-game parlays count as their share of this game. `base` has their other legs winning; `dead` has them losing, so a lock has to hold either way.
      const base = xs.map((x, i) => own[i] + shares.reduce((s, q) => s + shareCash(g, q.t, q.f, x, ts[i]), 0));
      const dead = own.map(v => v - shares.reduce((s, q) => s + (q.t.bonus ? 0 : riskOf(q.t, q.t.odds) * q.f), 0));
      // Candidates are Kalshi's own asks (that is where the Execute button trades); the cheaper Polymarket ask, when there is one, rides along as `alt`.
      const cands = [];
      [["home", hn, x => x > 0], ["away", an, x => x < 0]].forEach(([sd, team, pays]) => { const m = lad.ml && lad.ml[sd]; const o = lad.ml && lad.ml[sd === "home" ? "away" : "home"]; if (m && m.k > 0 && m.tk) cands.push({ txt: `${team} to win`, a: m.k, sp: o && o.k > 0 ? Math.max(0, (m.k + o.k - 1) / 2) : 0, alt: m.p, tk: m.tk, side: "yes", pays, tkt: { type: "Moneyline", side: team } }); });
      (lad.sp || []).forEach(([fav, K, kf, kd, tk, pf, pd]) => {
        if (!tk) return;
        const fh = fav === "home", favT = fh ? hn : an, dogT = fh ? an : hn, sp = kf && kd ? Math.max(0, (kf + kd - 1) / 2) : 0;
        if (kf) cands.push({ txt: `${favT} −${K}`, a: kf, sp, alt: pf, tk, side: "yes", pays: x => (fh ? x : -x) > K, tkt: { type: "Spread", side: favT, line: -K } });   // yes on "<fav> wins by over K": the favorite covers
        if (kd) cands.push({ txt: `${dogT} +${K}`, a: kd, sp, alt: pd, tk, side: "no", pays: x => (fh ? x : -x) < K, tkt: { type: "Spread", side: dogT, line: K } });   // no on it: the underdog +K
      });
      const worst0 = Math.min(...base), best0 = Math.max(...base);
      if (best0 <= 0) return null;
      const profitP = arr => arr.reduce((s, v, i) => s + (v > 0.5 ? p[i] : 0), 0) / pTot;
      // The budget is the edge in the bets, priced against the market so a bet at the market price has none: the Vig column's figure, turned into cash terms for a bonus bet.
      // Under way, each bet is priced at the live win chance instead.
      const edgeOf = t => { if (live) return projectedPL(t); if (!t.bonus) return -vigOf(t); const d = decimalOf(ticketPrice(t)), w = (1 - vigOf(t) / t.amount) / d; return t.amount * w * (d - 1); };
      const edge0 = bets.reduce((s, t) => s + edgeOf(t), 0) + shares.reduce((s, q) => s + q.f * edgeOf(q.t), 0), { LIFT, CAPITAL } = RULES.hedge;
      const better = (a, b) => !b || a.m > b.m + 1 || (a.m > b.m - 1 && a.e > b.e);
      const deadWorst = Math.min(...dead);
      let lock = null, hedge = null;
      cands.forEach(c => {
        if (!(c.a > 0.01 && c.a < 0.99)) return;
        const pays = xs.map(x => c.pays(x)), fee = feePer(c.a), win = 1 - c.a - fee, lose = -c.a - fee;   // per contract, Kalshi's fee included
        const pw = xs.reduce((s, x, i) => s + (pays[i] ? p[i] : 0), 0) / pTot, cost1 = fee + c.sp, charge = cost1 + CAPITAL * (c.a + fee), fair = pw >= D.hedgeMinPay && pw <= D.hedgeMaxPay;
        let top = -Infinity;
        for (let n = D.hedgeStep; n <= D.hedgeMaxContracts; n += D.hedgeStep) {
          const after = base.map((v, i) => v + (pays[i] ? win : lose) * n), m = Math.min(...after);
          if (m < top - 0.5) break;   // the floor is a min of straight lines in n: once it falls it keeps falling
          top = Math.max(top, m);
          const dm = Math.min(...dead.map((v, i) => v + (pays[i] ? win : lose) * n));   // the worst cash result with the parlays lost
          if (m < worst0 + LIFT || dm < deadWorst - 0.5) continue;   // never adds cash risk, whichever way the parlays go
          const t = { c, n, m, b: Math.max(...after), after, e: edge0 - cost1 * n, left: edge0 - charge * n, fee: fee * n };
          if (dm > D.lockFloor && t.e >= 0 && better(t, lock)) lock = t;
          if (t.left >= 0 && fair && better(t, hedge)) hedge = t;
        }
      });
      const pick = lock || hedge;
      if (!pick) return null;
      const { c, n, after } = pick;
      return { kind: lock ? "lock" : "hedge", txt: c.txt, n, ask: c.a, src: "Kalshi", tk: c.tk, side: c.side, alt: c.alt, tkt: c.tkt, gk: gameKey(g), gn: gameLabel(g), gt: g.t, cost: n * c.a, at: lad.at,
        parlays: shares.length, fee: pick.fee, edgeBefore: edge0, edgeAfter: pick.e, worstBefore: worst0, worstAfter: pick.m, bestBefore: best0, bestAfter: pick.b, pBefore: profitP(base), pAfter: profitP(after) };
    }
    // A Kalshi ticker read as a bet: its game, type, side and line. Null when it is not a game, spread or total on the schedule.
    const KX_ALIAS = { WSH: ["WAS"], JAX: ["JAC"], LAR: ["LA"], LV: ["LVR"], NE: ["NWE"], NO: ["NOR"], GB: ["GNB"], TB: ["TAM"], SF: ["SFO"], KC: ["KAN"], LAC: ["SDG"] };
    const kxCodes = n => [abbr(n), ...(KX_ALIAS[abbr(n)] || [])];
    const TICKER = new RegExp("^KX(" + Object.values(RULES.leagues).map(r => r.code).join("|") + ")(GAME|SPREAD|TOTAL)-(\\d\\d)([A-Z]{3})(\\d\\d)([A-Z]+)-([A-Z]*)(\\d*)$");
    function readTicker(tk, side) {
      const m = TICKER.exec(String(tk));
      if (!m) return null;
      const [, lg, kind, yy, mon, dd, teams, team, num] = m, day = `20${yy}-${String("JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC".indexOf(mon) / 3 + 1).padStart(2, "0")}-${dd}`;
      const g = ALL_GAMES.find(x => leagueId(x) === lg.toLowerCase() && x.t.slice(0, 10) === day && kxCodes(nick(x, "away")).some(a => kxCodes(nick(x, "home")).some(h => a + h === teams)));
      if (!g) return null;
      const an = nick(g, "away"), hn = nick(g, "home"), K = Number(num) - .5, yes = side === "yes";
      if (kind === "TOTAL") return num && !team ? { g, type: "Total", side: yes ? "Over" : "Under", line: K } : null;
      const named = kxCodes(an).includes(team) ? an : kxCodes(hn).includes(team) ? hn : null, other = named === an ? hn : an;
      if (!named) return null;
      if (kind === "GAME") return { g, type: "Moneyline", side: yes ? named : other };
      return num ? { g, type: "Spread", side: yes ? named : other, line: yes ? -K : K } : null;
    }
    // A fill's ticket: one per order, with its trades by id. For a fill placed anywhere but Place, Execute or Arm, made by whichever of the page and the connector sees it first, so both make the
    // same record (Nov 3 2026). had: the order's ticket so far. when: a kickoff as the user reads it. Null when this trade is on it already. known: the fill is on one of `games`.
    function ticketFromFill(x, had, when) {
      const { side, price } = fillSide(x), id = `fill-${x.venue}-${x.order_id}`;
      if (had && had.trades && had.trades[x.trade_id]) return null;
      const trades = { ...(had && had.trades), [x.trade_id]: { n: x.count, p: price, fee: x.fee } };
      const { contracts: C, fee, total, american, cents } = fillAmounts(trades), b = readTicker(x.ticker, side), ml = b && b.type === "Moneyline";
      const week = b ? b.g.week : 0, kickoff = b ? b.g.t : new Date(x.ts_ms).toISOString();   // week 0 = a market in no league the page has: it shows in the Ledger only, never on a league's pages
      return { id, known: !!b, ticket: {
        book: "Kalshi", amount: Math.round(total * 100) / 100, bonus: false, createdAt: had ? had.createdAt : x.ts_ms, fillId: x.client_order_id || id, ticker: x.ticker, trades, week,
        key: b ? gameKey(b.g) : "kalshi|" + x.ticker, game: b ? gameLabel(b.g) : x.ticker, kickoff, type: b ? b.type : "Other", side: b ? b.side : side.toUpperCase(),
        ...(ml ? { line: american } : { ...(b ? { line: b.line } : {}), odds: american }), kalshi: { cents, contracts: C, fee: Math.round(fee * 100) / 100 },
        pick: b ? `${b.side}${ml ? "" : " " + (b.type === "Spread" ? pts(b.line) : String(b.line))} ${cents}¢` : `${x.ticker} ${side.toUpperCase()} ${cents}¢`,
        when: when(kickoff)
      } };
    }
    // The tickets to show, with fills as the record (the user, Nov 3 2026): one per Kalshi order that has fills, its money worked out from them, what it is from the order's saved ticket, or
    // from its market when there's none, and a real fill's ticket can't be edited or deleted (fromFills). saved: the records' tickets; fills: the records' fills collection, as { id, data }.
    // An order's saved ticket is found by its id (fill-…), its client id (Place's and Execute's), or for one saved before either, by its contracts and dollars. Saved tickets with no fills
    // (hand-booked, or from before fills were kept) are shown as saved. weird: markets of fills Fan can't place in any game and no saved ticket names, for the Application tab.
    function withFills(saved, fills, when) {
      const live = fills.filter(r => r.id.startsWith("feed-") && r.data.env !== "demo" && r.data.order), clientOf = new Map(), orders = new Map();
      fills.forEach(r => { const rp = r.data.reply; if (!r.id.startsWith("feed-") && rp && rp.order_id) clientOf.set(rp.order_id, r.id); });
      live.forEach(r => { if (r.data.client) clientOf.set(r.data.order, r.data.client); });
      [...live].sort((a, b) => (a.data.tradeMs || 0) - (b.data.tradeMs || 0)).forEach(r => { if (!orders.has(r.data.order)) orders.set(r.data.order, []); orders.get(r.data.order).push(r); });
      const kalshi = saved.filter(t => t.book === "Kalshi" && !t.parlay), used = new Set(), made = [], weird = [];
      for (const [order, list] of orders) {
        const client = clientOf.get(order) || null, venue = list[0].data.venue || "kalshi";
        let t = null, known = false;
        list.forEach(r => { const d = r.data, next = ticketFromFill({ venue, order_id: order, trade_id: r.id.slice(5), client_order_id: client, ticker: d.ticker, side: d.side, action: d.action, price: d.price, count: d.filled, fee: d.fee, ts_ms: d.tradeMs }, t, when); if (next) { t = next.ticket; known = next.known; } });
        if (!t) continue;
        const free = s => !used.has(s.id);
        const linked = kalshi.find(s => free(s) && (s.id === `fill-${venue}-${order}` || (client && s.fillId === client)))
          || kalshi.find(s => free(s) && !s.fillId && s.kalshi && Math.abs(s.kalshi.contracts - t.kalshi.contracts) < 1e-9 && Math.abs(s.amount - t.amount) < 0.05);   // the records check's tolerance for a ticket typed in by hand
        if (linked) {
          used.add(linked.id);
          const ml = linked.type === "Moneyline", cents = t.kalshi.cents, american = t.type === "Moneyline" ? t.line : t.odds;
          made.push({ ...linked, amount: t.amount, kalshi: { ...linked.kalshi, ...t.kalshi }, trades: t.trades, ...(ml ? { line: american } : { odds: american }), fromFills: true,
            pick: `${linked.side}${ml ? "" : " " + (linked.type === "Spread" ? pts(linked.line) : String(linked.line))} ${cents}¢` });
        } else {
          if (!known) weird.push(t.ticker);
          made.push({ id: `fill-${venue}-${order}`, ...t, fromFills: true });
        }
      }
      const tickets = [...saved.filter(s => !used.has(s.id)), ...made].sort((p, q) => (p.createdAt > q.createdAt ? 1 : p.createdAt < q.createdAt ? -1 : 0));
      return { tickets, weird };
    }
    // The Ledger's sums, one row per value of keyOf(ticket). Net cash counts settled wagers only (a lost bonus wager costs nothing).
    function ledgerRows(tickets, keyOf) {
      const rows = new Map();
      tickets.forEach(t => {
        const k = keyOf(t), st = settleOf(t);
        if (!rows.has(k)) rows.set(k, { n: 0, cash: 0, bonus: 0, won: 0, lost: 0, push: 0, pend: 0, openCash: 0, openBonus: 0, net: 0 });
        const b = rows.get(k);
        b.n++; if (t.bonus) b.bonus += t.amount; else b.cash += t.amount;
        if (st.state === "pending") { b.pend++; if (t.bonus) b.openBonus += t.amount; else b.openCash += t.amount; } else { b[st.state]++; b.net += st.net; }
      });
      return rows;
    }
    // What the exchange says against what the tickets say, by bet. fills: every fill in the normal shape. Differences under 5 cents or half a contract are rounding.
    function kalshiCheck(fills, allTickets) {
      const rows = new Map();
      const row = (key, label) => { if (!rows.has(key)) rows.set(key, { key, label, fillN: 0, fillPaid: 0, ticketN: 0, ticketPaid: 0 }); return rows.get(key); };
      const betKey = (k, type, side, line) => k + "|" + type + "|" + side + (type === "Moneyline" ? "" : "|" + line);
      const name = (g, type, side, line) => `${abbr(nick(g, "away"))}@${abbr(nick(g, "home"))} ${side}${type === "Moneyline" ? " ML" : " " + (type === "Total" ? line : (line > 0 ? "+" : "−") + Math.abs(line))}`;
      fills.forEach(x => {
        const { side, price } = fillSide(x), b = readTicker(x.ticker, side);
        const r = b ? row(betKey(gameKey(b.g), b.type, b.side, b.line), name(b.g, b.type, b.side, b.line)) : row("ticker|" + x.ticker + "|" + side, x.ticker + " " + side.toUpperCase());
        r.fillN += x.count; r.fillPaid += x.count * price + x.fee;
      });
      allTickets.filter(t => t.book === "Kalshi" && !t.parlay).forEach(t => {
        const g = gameOf(t.key);
        const r = t.type === "Other" ? row("ticker|" + t.ticker + "|" + String(t.side).toLowerCase(), t.ticker + " " + t.side) : row(betKey(t.key, t.type, t.side, t.line), g ? name(g, t.type, t.side, t.line) : t.pick);
        r.ticketN += (t.kalshi && t.kalshi.contracts) || 0; r.ticketPaid += t.amount;
      });
      const all = [...rows.values()], off = all.filter(r => Math.abs(r.fillN - r.ticketN) > 0.5 || Math.abs(r.fillPaid - r.ticketPaid) >= 0.05);
      return { rows: all, off, matched: all.length - off.length, fillPaid: all.reduce((s, r) => s + r.fillPaid, 0), ticketPaid: all.reduce((s, r) => s + r.ticketPaid, 0) };
    }
    return { ...shared, status, settleOf, liveChances, vigOf, projectedPL, deadFor, parlayShares, spentShares, shareRisk, gameBets, gameSettledPL, shareTerm, extremes, slateTotals, hedgeFor, readTicker, ticketFromFill, withFills, kalshiCheck, ledgerRows };
  }
  return { RULES, make, ...shared, odds, winPct, feedState, noVigHome, spreadFromMl, kalshiFee, contractsFor, placeLimit, kalshiCalc, centsOf, americanOf, quoteOf, fillSide, fillAmounts, kalshiMarket, freshPrices, replyFill, reconcile, evMoneyline, evPoints, showsML, pairFlagged, pairStakes, pbStats, hcStates, HC_VARS, hcVisitorMargin, hcAlone, olsFit, hcTheo, hcByeEffect, hcByeAdjust, hcEv, hcDivCoef };
})();
export { Calc };
