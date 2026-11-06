


const Calc = (() => {
  
  
  const M = {};
  const noVig = (...a) => M.noVig(...a);
  const spreadFromMl = (...a) => M.spreadFromMl(...a);
  const marginModel = (...a) => M.marginModel(...a);
  const liveMargin = (...a) => M.liveMargin(...a);
  const coverChances = (...a) => M.coverChances(...a);
  const fairLeg = (...a) => M.fairLeg(...a);
  const evMoneyline = (...a) => M.evMoneyline(...a);
  const evPoints = (...a) => M.evPoints(...a);
  const showsML = (...a) => M.showsML(...a);
  const pairFlagged = (...a) => M.pairFlagged(...a);
  const hcVisitorMargin = (...a) => M.hcVisitorMargin(...a);
  const olsFit = (...a) => M.olsFit(...a);
  const hcByeEffect = (...a) => M.hcByeEffect(...a);
  const hcFitOne = (...a) => M.hcFitOne(...a);
  const hcFitLeaveOut = (...a) => M.hcFitLeaveOut(...a);
  const hcFitGaps = (...a) => M.hcFitGaps(...a);
  const hcFitCoef = (...a) => M.hcFitCoef(...a);
  const hcGap = (...a) => M.hcGap(...a);
  const hcTheo = (...a) => M.hcTheo(...a);
  const RULES = {
    userSet: { capital: 0.05, theoCash: 10 / 220, theoBonus: 0.45, pairBase: 1000, hcHurdle: 0.03, hcDivDvoa: 0.67 },   
    defaults: {
      vig: 0.045, spreadPrice: -110, kalshiFee: 0.07,
      lift: 10, hedgeMinPay: 0.25, hedgeMaxPay: 0.75, lockFloor: 0.5, hedgeStep: 5, hedgeMaxContracts: 5000,
      tolPerPoint: 0.005, bandKeep: 0.25, narrow: 0.25,
      liveDrives: 11, liveTd: 0.22, liveFg: 0.16, liveTwo: 0.03, liveMiss: 0.03   
    }
  };
  
  
  
  
  
  RULES.leagues = {
    nfl: { code: "NFL", periods: [4, 900], sigma: 12.25, totalSd: 9, keyNumbers: true, hedgeLines: [2.5, 3.5, 5.5, 6.5, 7.5, 9.5, 10.5, 13.5, 14.5, 16.5, 17.5], maxMargin: 60, ties: true, liveHours: 3.5, daily: false, codeChips: false, graphMinMargin: 0, byes: true, graphs: true, stats: true, gameDetails: true, fullNames: false, season: { margin: 25, totals: [20, 70], tick: 5 }, handicap: true },
    nba: { code: "NBA", periods: [4, 720], hedgeLines: null, sigma: 12, totalSd: 18, keyNumbers: false, maxMargin: 75, ties: false, liveHours: 3.5, daily: true, codeChips: true, graphMinMargin: 20, byes: false, graphs: false, stats: false, gameDetails: true, fullNames: false, season: { margin: 30, totals: [180, 270], tick: 10 }, handicap: false },
    
    nhl: { code: "NHL", periods: [3, 1200], hedgeLines: null, sigma: 2.4, totalSd: 2.4, keyNumbers: false, maxMargin: 12, ties: false, liveHours: 3, daily: true, codeChips: true, graphMinMargin: 0, byes: false, graphs: false, stats: false, gameDetails: true, fullNames: true, season: { margin: 6, totals: [1, 11], tick: 1 }, handicap: false }
  };
  RULES.hedge = { LIFT: RULES.defaults.lift, CAPITAL: RULES.userSet.capital };
  const D = RULES.defaults;
  const leagueId = g => (g && g.league) || "nfl";
  const leagueOf = g => RULES.leagues[leagueId(g)];

   
  const last = n => n.split(" ").pop();
  
  const nick = (g, side) => leagueOf(g).fullNames ? g[side] : last(g[side]);
  const gameLabel = g => `${nick(g, "away")} at ${nick(g, "home")}`;
  const gameKey = g => g.t + "|" + gameLabel(g);
  
  const atFull = od => !od || !Number.isFinite(od);
  const odds = n => (atFull(n) ? "−∞" : (n > 0 ? "+" : "−") + Math.abs(n));
  const pts = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);   
  const profitOf = (amt, od) => atFull(od) ? 0 : od > 0 ? amt * od / 100 : amt * 100 / -od;
  const decimalOf = od => atFull(od) ? 1 : od > 0 ? 1 + od / 100 : 1 + 100 / -od;
  const ticketPrice = t => t.parlay ? t.odds : t.type === "Moneyline" ? t.line : (t.odds ?? D.spreadPrice);
  
  const americanOf = p => (p > 0.5 ? -100 * p / (1 - p) : 100 * (1 - p) / p);
  const quoteOf = p => (p > 0.5 ? -Math.round(100 * p / (1 - p)) : Math.round(100 * (1 - p) / p));
  const centsOf = am => Math.min(99, Math.max(1, Math.round(100 / decimalOf(am))));
  
  const fanNoVig = (ml, away) => {
    const [fa, fh] = ml.map(atFull);
    if (fa !== fh) return (away ? fa : fh) ? 1 : 0;   
    const qa = 1 / decimalOf(ml[0]), qh = 1 / decimalOf(ml[1]);
    return (away ? qa : qh) / (qa + qh);
  };
  const winPct = (ml, away) => Math.round(noVig(ml, away) * 100);   
  
  const feedState = (venues, waitedMs) => {
    const off = Object.entries(venues || {}).filter(([, v]) => !v.connected || v.error || v.reloadError);
    if (!off.length) return { text: "Feed live", cls: "on" };
    if (waitedMs < 60000 && off.every(([, v]) => !v.error && !v.reloadError)) return { text: "Feed starting", cls: "wait" };
    return { text: "Feed off, " + off.map(([n, v]) => `${n}: ${v.reloadError ? "new code failed, old running: " + v.reloadError : v.error || "off"}`).join("; "), cls: "off" };
  };
  const noVigHome = ml => noVig(ml, false) * 100;
  
  
  const invNorm = p => {   
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - 0.02425) return -invNorm(1 - p);
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };
  const fanSpreadFromMl = (ml, sigma) => { const v = Math.round(sigma * invNorm(Math.min(0.999, Math.max(0.001, noVig(ml, false)))) * 2) / 2; return v === 0 ? 0 : v; };

   
  
  
  
  const bonusFactor = od => 1 - 1 / (od > 0 ? 1 + Math.min(od, 100) / 100 : 1 + 100 / -od);
  const riskOf = (t, od) => t.bonus ? t.amount * bonusFactor(od) : t.amount;
  function winChance(t) {
    const q = 1 / decimalOf(ticketPrice(t));
    return t.kalshi ? q : Math.min(0.99, q / Math.pow(1 + D.vig, t.parlay ? t.legs.length : 1));
  }

   
  
  const feePer = p => D.kalshiFee * p * (1 - p);
  const kalshiFee = (contracts, price) => Math.ceil(D.kalshiFee * contracts * price * (1 - price) * 100 - 1e-9) / 100;
  
  const contractsFor = (amount, p) => Math.floor(amount / (p + D.kalshiFee * p * (1 - p)) + 1e-9);
  
  function kalshiCalc(cents, spent) {
    const C = spent / (cents / 100), decimalOdds = 100 / cents;
    return { C, cost: spent, fee: 0, total: spent, win: C - spent, american: decimalOdds >= 2 ? (decimalOdds - 1) * 100 : decimalOdds > 1 ? -100 / (decimalOdds - 1) : -10000 };
  }
  
  const fillSide = x => (x.action === "sell" && x.side === "yes" ? { side: "no", price: Math.round((1 - x.price) * 10000) / 10000 } : { side: x.side, price: x.price });
  
  function fillAmounts(trades) {
    const list = Object.values(trades), C = list.reduce((s, r) => s + r.n, 0), cost = list.reduce((s, r) => s + r.n * r.p, 0), fee = list.reduce((s, r) => s + r.fee, 0), total = cost + fee, decimalOdds = C / total;
    return { contracts: C, cost, fee, total, american: decimalOdds >= 2 ? Math.round((decimalOdds - 1) * 100) : -Math.round(100 / (decimalOdds - 1)), cents: Math.round(cost / C * 1000) / 10 };
  }
  
  
  function reconcile(fills, wagers, saved, since) {
    const orders = new Map();
    fills.forEach(x => { if (!orders.has(x.order_id)) orders.set(x.order_id, { order: x.order_id, client: x.client_order_id || null, ticker: x.ticker, trades: {} }); const { price } = fillSide(x); orders.get(x.order_id).trades[x.trade_id] = { n: x.count, p: price, fee: x.fee }; });
    const out = { orders: orders.size, fills: fills.length, notSaved: [], noTicket: [], twoTickets: [], differ: [], matched: 0, byAmount: 0, merged: [] };
    const savedIds = new Set(saved.map(r => r.id)), clientOf = new Map();
    saved.forEach(r => { if (r.data.order && r.data.client) clientOf.set(r.data.order, r.data.client); });   
    fills.forEach(x => { if (!savedIds.has("feed-" + x.trade_id)) out.notSaved.push(x); });
    const used = new Set();
    
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
  
  function kalshiMarket(g, l) {
    const lad = g.lad && g.lad.v === 2 ? g.lad : null, an = nick(g, "away"), hn = nick(g, "home");
    if (l.type === "Moneyline") { const m = lad && lad.ml && lad.ml[l.side === hn ? "home" : "away"], tk = m && m.tk; return tk ? { tk, side: "yes" } : { why: "No Kalshi market saved for this bet" }; }
    if (l.type === "Spread" && lad) {
      const row = (lad.sp || []).find(([fav, K, , , t]) => t && K === Math.abs(l.line) && (l.line < 0 ? l.side === (fav === "home" ? hn : an) : l.side === (fav === "home" ? an : hn)));
      if (row) return { tk: row[4], side: l.line < 0 ? "yes" : "no" };
    } else if (l.type === "Total" && lad && lad.ml) {
      
      const ev = ((lad.ml.away && lad.ml.away.tk) || (lad.ml.home && lad.ml.home.tk) || "").split("-")[1];
      if (!ev || Math.abs(l.line) % 1 !== .5) return { why: ev ? "Kalshi totals end in .5" : "No Kalshi market saved for this bet" };
      return { tk: `KX${leagueOf(g).code}TOTAL-${ev}-${l.line + .5}`, side: l.side === "Over" ? "yes" : "no" };
    }
    return { why: "No Kalshi market saved for this bet" };
  }
  
  function replyFill(o, side, limit) {
    const avg = o.average_fill_price == null ? null : side === "no" ? Math.round((1 - o.average_fill_price) * 10000) / 10000 : o.average_fill_price;
    if (!(o.filled > 0)) return { avg };
    const contracts = o.filled, price = avg != null ? avg : limit, feeEach = o.average_fee_paid || 0, total = contracts * price + contracts * feeEach, decimalOdds = contracts / total;
    return { avg, contracts, amount: Math.round(total * 100) / 100, american: decimalOdds >= 2 ? Math.round((decimalOdds - 1) * 100) : -Math.round(100 / (decimalOdds - 1)), cents: Math.round(price * 1000) / 10, fee: Math.round(contracts * feeEach * 100) / 100 };
  }

  
  const placeLimit = (cents, up) => Math.min(99, cents + Math.max(0, Math.floor(Number(up)) || 0));
  
  
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
      const o = oldRow.get(s.fav + "|" + s.K), pf = started || !o ? null : o[5], pd = started || !o ? null : o[6], favPrice = quoteOf(low(s.kf, pf)), dogPrice = quoteOf(low(s.kd, pd));
      const line = { sp: s.fav === "away" ? -s.K : s.K, spj: s.fav === "away" ? [favPrice, dogPrice] : [dogPrice, favPrice], tot: t.K, toj: [quoteOf(t.over), quoteOf(t.under)],
        ml: started ? [quoteOf(mA), quoteOf(mH)] : [quoteOf(low(mA, old && old.ml.away.p)), quoteOf(low(mH, old && old.ml.home.p))] };
      if (started) patch.live = { ...line, at: q.at }; else patch.line = line;
    }
    return patch;
  }

   
  
  
  function legResult(l, an, x, T) {      
    if (l.type === "Moneyline") return x === 0 ? 0 : ((l.side === an) === (x < 0) ? 1 : -1);
    if (l.type === "Spread") { const th = l.side === an ? l.line : -l.line; return x === th ? 0 : ((l.side === an) === (x < th) ? 1 : -1); }
    return T === l.line ? 0 : ((l.side === "Over") === (T > l.line) ? 1 : -1);
  }
  const legsOf = t => (t.parlay ? t.legs : [{ key: t.key, type: t.type, side: t.side, line: t.line }]);
  
  function ticketPL(t, an, x, T, cash) {
    const od = ticketPrice(t), rs = legsOf(t).map(l => legResult(l, an, x, T));
    if (rs.includes(-1)) return cash && t.bonus ? 0 : -riskOf(t, od);
    if (rs.includes(0)) return 0;        
    return profitOf(t.amount, od);
  }

   
  
  
  
  const MARGIN_SHARE = { 1: 4.16, 2: 4.05, 3: 15.12, 4: 4.88, 5: 3.57, 6: 5.99, 7: 9.03, 8: 3.72, 9: 1.61, 10: 5.51, 11: 2.35, 12: 1.65, 13: 2.76, 14: 4.88, 15: 1.5, 16: 2.12, 17: 3.57, 18: 2.32, 19: 1.18, 20: 2.14, 21: 2.65 };
  const MARGIN_WEIGHT = (() => {
    const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
    const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2)), s0 = 21.5 / 1.4395, w = [0];
    for (let m = 1; m <= 21; m++) w[m] = (MARGIN_SHARE[m] / 100) / (2 * (Phi((m + 0.5) / s0) - Phi((m - 0.5) / s0)));
    return m => { m = Math.abs(m); return m <= 21 ? w[m] : 1; };
  })();
  
  
  
  function fanMarginModel(sigma, flat) {   
    const MM = 70, memo = new Map();
    const detail = d => {
      if (d === 0) return { win: 0.5, over: 0.5, push: 0, P: () => 0 };
      if (memo.has(d)) return memo.get(d);
      const W = (m, mu) => (flat ? 1 : MARGIN_WEIGHT(m)) * Math.exp(-0.5 * ((m - mu) / sigma) ** 2);
      const gap = mu => { let up = 0, dn = 0; for (let m = -MM; m <= MM; m++) { if (m === 0) continue; const x = W(m, mu); if (m > d) up += x; else if (m < d) dn += x; } return up - dn; };
      let lo = d - 25, hi = d + 25;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (gap(mid) > 0) hi = mid; else lo = mid; }
      const mu = (lo + hi) / 2; let win = 0, tot = 0;
      for (let m = -MM; m <= MM; m++) { if (m === 0) continue; const x = W(m, mu); tot += x; if (m > 0) win += x; }
      let over = 0, push = 0;   
      for (let m = -MM; m <= MM; m++) { if (m === 0) continue; const x = W(m, mu); if (m > d) over += x; else if (m === d) push += x; }
      memo.set(d, { win: win / tot, over: over / tot, push: push / tot, P: m => (m === 0 || Math.abs(m) > MM ? 0 : W(m, mu) / tot) });   
      return memo.get(d);
    };
    const f = d => detail(d).win;
    f.detail = detail;
    f.band = (d, a, b) => { const q = detail(d); let t = 0; for (let m = a; m <= b; m++) t += q.P(m); return t; };   
    
    
    const meanMemo = new Map(), Wm = (m, mu) => (flat ? 1 : MARGIN_WEIGHT(m)) * Math.exp(-0.5 * ((m - mu) / sigma) ** 2);
    f.mean = e => {
      if (meanMemo.has(e)) return meanMemo.get(e);
      const avg = mu => { let s = 0, t = 0; for (let m = -MM; m <= MM; m++) { if (m === 0) continue; const x = Wm(m, mu); s += m * x; t += x; } return s / t; };
      let lo = e - 25, hi = e + 25;
      for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (avg(mid) < e) lo = mid; else hi = mid; }
      const mu = (lo + hi) / 2; let win = 0, tot = 0;
      for (let m = -MM; m <= MM; m++) { if (m === 0) continue; const x = Wm(m, mu); tot += x; if (m > 0) win += x; }
      const q = { win: win / tot, P: m => (m === 0 || Math.abs(m) > MM ? 0 : Wm(m, mu) / tot) };
      meanMemo.set(e, q);
      return q;
    };
    return f;
  }
  
  
  
  
  
  
  function fanLiveMargin(margin, secondsLeft, expected) {
    const { liveDrives, liveTd, liveFg, liveTwo, liveMiss } = D, t = Math.max(0, Math.min(1, secondsLeft / 3600)), drives = liveDrives * t;
    const lo = Math.floor(drives), part = drives - lo;
    
    const teamPoints = (td, fg) => {
      const step = [[0, 1 - td - fg], [3, fg], [6, td * liveMiss], [7, td * (1 - liveMiss - liveTwo)], [8, td * liveTwo]];
      const after = k => { let d = [1]; for (let i = 0; i < k; i++) { const n = new Array(d.length + 8).fill(0); d.forEach((p, a) => { if (p) step.forEach(([pts, q]) => { n[a + pts] += p * q; }); }); d = n; } return d; };
      const a = after(lo), b = part > 0 ? after(lo + 1) : a, out = new Array(b.length).fill(0);
      a.forEach((p, i) => { out[i] += p * (1 - part); }); if (part > 0) b.forEach((p, i) => { out[i] += p * part; }); else a.forEach((p, i) => { out[i] += p * part; });
      return out;
    };
    const tilted = k => { const up = Math.exp(k), cap = x => Math.min(x, 0.95); const h = [cap(liveTd * up), cap(liveFg * up)], a = [cap(liveTd / up), cap(liveFg / up)]; return [teamPoints(h[0], Math.min(h[1], 0.98 - h[0])), teamPoints(a[0], Math.min(a[1], 0.98 - a[0]))]; };
    const rest = k => { const [h, a] = tilted(k), m = new Map(); h.forEach((p, i) => { if (p) a.forEach((q, j) => { if (q) m.set(i - j, (m.get(i - j) || 0) + p * q); }); }); return m; };
    const meanOf = m => { let s = 0; m.forEach((p, x) => { s += p * x; }); return s; };
    
    const finalsAt = k => {
      const out = new Map(); rest(k).forEach((p, x) => { const m = margin + x; out.set(m, (out.get(m) || 0) + p); });
      const tie = out.get(0) || 0; if (tie) { out.delete(0); const hw = 1 / (1 + Math.exp(-2 * k)); out.set(3, (out.get(3) || 0) + tie * hw); out.set(-3, (out.get(-3) || 0) + tie * (1 - hw)); }
      return out;
    };
    let k = 0;
    if (drives > 0) { let a = -3, b = 3; for (let i = 0; i < 30; i++) { const mid = (a + b) / 2; if (meanOf(finalsAt(mid)) < expected) a = mid; else b = mid; } k = (a + b) / 2; }
    const finals = finalsAt(k);
    let mean = 0, win = 0; finals.forEach((p, m) => { mean += p * m; if (m > 0) win += p; });
    return { P: m => finals.get(m) || 0, mean, win, over: line => { let s = 0; finals.forEach((p, m) => { if (m > line) s += p; }); return s; }, margins: [...finals.keys()].sort((x, y) => x - y) };
  }
  
  let liveCache = {};
  const liveModel = (() => { return g => { const m = liveCache; const k = leagueId(g), r = leagueOf(g); return m[k] || (m[k] = marginModel(r.sigma, !r.keyNumbers)); }; })();
  const totalSd = g => leagueOf(g).totalSd;
  const normCdf = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
  
  function fanCoverChances(g, teamSpread, line) {
    const q = liveModel(g).detail(teamSpread === 0 ? -0.001 : -teamSpread);   
    let win = 0, push = 0;
    for (let m = -70; m <= 70; m++) { if (m === 0) continue; const x = q.P(m); if (m > -line) win += x; else if (m === -line) push += x; }
    return { win, push };
  }
  
  
  
  function fanFairLeg(l, g) {
    const L = g && !g.noLine && g.line;
    if (!L) return { win: 0.5, push: 0 };
    const awaySide = l.side === nick(g, "away");
    if (l.type === "Moneyline") return { win: noVig(L.ml, awaySide), push: 0 };
    if (l.type === "Spread") return coverChances(g, awaySide ? L.sp : -L.sp, l.line);
    const sd = totalSd(g), over = 1 - normCdf((l.line - L.tot) / sd), push = Number.isInteger(l.line) ? normCdf((l.line + .5 - L.tot) / sd) - normCdf((l.line - .5 - L.tot) / sd) : 0;
    return l.side === "Over" ? { win: over - push / 2, push } : { win: 1 - over - push / 2, push };
  }

   
  
  
  
  
  
  
  function outcomes(g, bets, shares = [], { tot = g.line && g.line.tot, ties = leagueOf(g).ties, more = [], cdf: totalCdf = null, free = false } = {}) {
    const key = gameKey(g), r = leagueOf(g), legsHere = t => (t.parlay ? t.legs.filter(l => l.key === key) : [t]);
    const lines = [...new Set([...[...bets, ...shares.map(s => s.t)].flatMap(legsHere).filter(l => l.type === "Total").map(l => l.line), ...more])];
    const tots = lines.length ? [...new Set(lines.flatMap(l => (Number.isInteger(l) ? [l - 1, l, l + 1] : [Math.floor(l), Math.ceil(l)])))].sort((a, b) => a - b) : [tot];
    const edge = i => (i < 0 ? -Infinity : i >= tots.length - 1 ? Infinity : (tots[i] + tots[i + 1]) / 2), cdf = totalCdf || (v => (v === -Infinity ? 0 : v === Infinity ? 1 : normCdf((v - tot) / totalSd(g))));
    const weight = tots.map((_, i) => (lines.length ? cdf(edge(i)) - cdf(edge(i - 1)) : 1)), out = [];
    for (let x = -r.maxMargin; x <= r.maxMargin; x++) {
      if (x === 0 && !ties) continue;
      const here = new Map();
      tots.forEach((T0, i) => { const T = lines.length && !free ? Math.max(T0, Math.abs(x)) : T0; here.set(T, (here.get(T) || 0) + weight[i]); });
      here.forEach((w, T) => out.push({ x, T, w }));
    }
    return out;
  }

   
  
  const fanEvMoneyline = (winProb, p) => winProb(-p.sp) * decimalOf(p.ml) - 1;
  const fanEvPoints = (winProb, p) => { const q = winProb.detail(-p.sp), decimalOdds = decimalOf(p.g.line.spj[p.side === "home" ? 1 : 0]); return q.over * (decimalOdds - 1) - (1 - q.over - q.push); };
  const fanShowsML = (winProb, p) => evMoneyline(winProb, p) >= evPoints(winProb, p);
  
  
  const fanPairFlagged = (winProb, fav, dog) => Math.max(0, evPoints(winProb, fav) - evMoneyline(winProb, fav)) + Math.max(0, evMoneyline(winProb, dog) - evPoints(winProb, dog)) <= D.tolPerPoint * Math.abs(dog.sp);
  
  
  function pairStakes({ stakeFavMl, perDollarMl, rD, rB, rN, worstBlowout, worstPastSpread, worstSmallUpset, worstBigUpset }) {
    const base = RULES.userSet.pairBase, NARROW = D.narrow;
    const stakeBlowout = Math.max(0, (D.bandKeep * perDollarMl * base - worstPastSpread + worstBlowout) / (1 + rB));
    const D0 = worstBlowout + perDollarMl * stakeFavMl - stakeBlowout, U0 = -stakeFavMl + rD * D0 + rB * stakeBlowout;
    const stakeUpset = Math.max(0, ((1 - NARROW) * (worstBigUpset + U0) - (worstSmallUpset + U0)) / (rN * (1 + rD) + (1 - NARROW) * (1 - rD * rN)));
    return { stakeBlowout, stakeUpset, stakeDogPoints: Math.max(0, D0 + rN * stakeUpset) };
  }

  

  
  
  
  
  function hcStates(games) {
    
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
  
  
  
  
  const hcBye = s => (s.prev !== null && s.rest >= 13 ? 1 : 0);
  const HC_VARS = [
    { k: "vmov", short: "V MOV", h: "The visitor's average margin of victory this season", start: 0.7, guide: "market", f: (h, a) => a.net },
    
    { k: "dvoa", short: "DVOA diff", h: "Total DVOA difference, visitor minus home (FTN, in percentage points)", start: 0, guide: "market", f: (h, a, x) => (x && x.dvoa && Number.isFinite(x.dvoa[0]) && Number.isFinite(x.dvoa[1]) ? x.dvoa[0] - x.dvoa[1] : null) },
    { k: "bye", short: "Off bye", h: "Off a bye (13+ days' rest after a game that season), visitor minus home: +1 the visitor only, −1 the home team only", start: 0, guide: "adjust", side: hcBye, f: (h, a) => hcBye(a) - hcBye(h) }
  ];
  
  
  
  const fanHcVisitorMargin = (eq, row, x) => eq.terms.reduce((s, t) => { const v = HC_VARS.find(y => y.k === t.v); if (s === null || !v) return s; const val = Number.isFinite(t.val) ? t.val : v.f(row.h, row.a, x); return val === null ? null : s + t.coef * val; }, -eq.hfa);
  
  
  function fanOlsFit(X, y) {
    const n = y.length, p = n ? X[0].length : 0;
    if (n < p + 2) return null;
    const means = Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[j], 0) / n), ybar = y.reduce((s, v) => s + v, 0) / n;
    const Xc = X.map(r => r.map((v, j) => v - means[j])), A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => Xc.reduce((s, r) => s + r[i] * r[j], 0)));
    
    const M = A.map((r, i) => [...r, ...Array.from({ length: p }, (_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < p; c++) {
      let piv = c;
      for (let r = c + 1; r < p; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-9) return null;   
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
  
  
  
  
  function fanHcByeEffect(rows, hfa) {
    const f = olsFit(rows.map(r => [hcBye(r.a), hcBye(r.h)]), rows.map(r => r.g.final[0] - r.g.final[1] + hfa));
    if (!f) return null;
    return { v: f.b[0], h: f.b[1], seVisitor: f.se[0], seHome: f.se[1], n: f.n, byeGamesVisitor: rows.filter(r => hcBye(r.a)).length, byeGamesHome: rows.filter(r => hcBye(r.h)).length };
  }
  
  const hcByeAdjust = (eff, row) => (eff ? eff.v * hcBye(row.a) + eff.h * hcBye(row.h) : null);
  
  
  
  
  const fanHcFitOne = (x, y) => (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) > 1e-9 ? y / x : null);
  
  
  function fanHcFitLeaveOut(xs, ys) {
    let sxy = 0, sxx = 0;
    xs.forEach((x, i) => { sxy += x * ys[i]; sxx += x * x; });
    return xs.map((x, i) => { const a = sxx - x * x; return a > 1e-9 ? (sxy - x * ys[i]) / a : null; });
  }
  
  
  
  function fanHcFitGaps(xs, ys) {
    const out = hcFitLeaveOut(xs, ys), all = hcFitCoef(xs, ys);
    return xs.map((x, i) => { const c = out[i] !== null ? out[i] : all; return c === null ? null : c * x - ys[i]; });
  }
  function fanHcFitCoef(xs, ys) {
    let sxy = 0, sxx = 0;
    xs.forEach((x, i) => { if (Number.isFinite(x) && Number.isFinite(ys[i])) { sxy += x * ys[i]; sxx += x * x; } });
    return sxx > 0 ? sxy / sxx : null;
  }
  
  
  
  
  
  function fanHcGap(mine, line) {
    const out = { sp: null, ml: null };
    if (mine && line && Number.isFinite(mine.sp) && Number.isFinite(line.sp)) { const d = line.sp - mine.sp; out.sp = d === 0 ? 0 : mine.sp === 0 ? Math.sign(d) * Infinity : d / Math.abs(mine.sp); }
    const ok = a => Array.isArray(a) && Number.isFinite(a[0]) && Number.isFinite(a[1]);
    if (mine && line && ok(mine.ml) && ok(line.ml)) out.ml = { v: decimalOf(line.ml[0]) / decimalOf(mine.ml[0]) - 1, h: decimalOf(line.ml[1]) / decimalOf(mine.ml[1]) - 1 };
    return out;
  }
  
  
  const hcDivCoef = (coef, divisional) => (divisional ? coef * RULES.userSet.hcDivDvoa : coef);
  
  
  function fanHcTheo(margin, winProb) {
    const chanceHome = margin === 0 ? 0.5 : margin > 0 ? winProb(margin) : 1 - winProb(-margin);
    return { spread: -margin, chanceHome, ml: [quoteOf(1 - chanceHome), quoteOf(chanceHome)] };
  }

  
  function lineOk(type, n) {
    if (!Number.isFinite(n)) return false;
    return type === "Moneyline" ? Math.abs(n) >= 100 : type === "Total" ? n > 0 : true;
  }

  
  const FAN_CLASSES = ["Favorite", "Underdog", "Pick'em", "Total", "Parlay", "Other"];
  function betClass(t) {
    if (t.parlay) return "Parlay";
    if (t.type === "Total") return "Total";
    if ((t.type !== "Spread" && t.type !== "Moneyline") || t.line == null) return "Other";
    if (t.line === 0 || (t.type === "Moneyline" && Math.abs(t.line) === 100)) return "Pick'em";
    return t.line < 0 ? "Favorite" : "Underdog";
  }

   
  const FAN = { noVig: fanNoVig, spreadFromMl: fanSpreadFromMl, marginModel: fanMarginModel, liveMargin: fanLiveMargin, coverChances: fanCoverChances, fairLeg: fanFairLeg, evMoneyline: fanEvMoneyline, evPoints: fanEvPoints, showsML: fanShowsML, pairFlagged: fanPairFlagged, hcVisitorMargin: fanHcVisitorMargin, olsFit: fanOlsFit, hcByeEffect: fanHcByeEffect, hcFitOne: fanHcFitOne, hcFitLeaveOut: fanHcFitLeaveOut, hcFitGaps: fanHcFitGaps, hcFitCoef: fanHcFitCoef, hcGap: fanHcGap, hcTheo: fanHcTheo };
  Object.assign(M, FAN);
  
  
  const isProbability = x => Number.isFinite(x) && x >= 0 && x <= 1;
  const num = x => Number.isFinite(x);
  const CONTRACT = {
    noVig: f => (isProbability(f([-150, 130], false)) && isProbability(f([-150, 130], true)) ? null : "a team's chance must be a number from 0 to 1"),
    spreadFromMl: f => (num(f([-150, 130], 12.25)) ? null : "a spread must be a number"),
    marginModel: f => { const w = f(12.25, false); if (typeof w !== "function" || !isProbability(w(3))) return "it must give a function of the margin, a chance from 0 to 1"; if (typeof w.detail !== "function" || !isProbability(w.detail(3).win)) return "its detail(d) must give { win, over, push, P }"; if (typeof w.mean !== "function" || !isProbability(w.mean(3.2).win)) return "its mean(e) must give { win, P }"; return typeof w.band === "function" ? null : "it must have band(d, a, b)"; },
    hcFitOne: f => (num(f(2, 4)) && f(0, 4) === null ? null : "a coefficient, or null with no difference"),
    hcFitCoef: f => (num(f([1, 2, 3], [2, 4, 6])) ? null : "a coefficient must be a number"),
    hcFitLeaveOut: f => { const r = f([1, 2, 3], [2, 4, 6]); return Array.isArray(r) && r.length === 3 ? null : "one coefficient per game"; },
    hcFitGaps: f => { const r = f([1, 2, 3], [2, 4, 6]); return Array.isArray(r) && r.length === 3 ? null : "one gap per game"; },
    hcTheo: f => { const r = f(3, FAN.marginModel(12.25)); return r && num(r.spread) && isProbability(r.chanceHome) && Array.isArray(r.ml) && r.ml.length === 2 ? null : "it must give { spread, pHome, ml: [visitor, home] }"; },
    hcGap: f => { const r = f({ sp: -3, ml: [130, -150] }, { sp: -3.5, ml: [135, -155] }); return r && "sp" in r && "ml" in r ? null : "it must give { sp, ml }"; },
  };
  
  
  function useMethods(user, error) {
    Object.assign(M, FAN);
    liveCache = {};
    const report = { replaced: [], refused: [], unknown: [], error: error || null };
    if (!user || typeof user !== "object") return report;
    for (const [k, f] of Object.entries(user)) {
      if (!(k in FAN)) { report.unknown.push(k); continue; }
      if (typeof f !== "function") { report.refused.push({ name: k, why: "not a function" }); continue; }
      let why;
      try { why = CONTRACT[k] ? CONTRACT[k](f) : null; } catch (e) { why = "it failed on the contract's sample: " + ((e && e.message) || e); }
      if (why) report.refused.push({ name: k, why }); else { M[k] = f; report.replaced.push(k); }
    }
    liveCache = {};
    return report;
  }
  const METHOD_NAMES = Object.keys(FAN);

  const shared = { leagueId, leagueOf, outcomes, last, nick, gameLabel, gameKey, pts, profitOf, bonusFactor, riskOf, decimalOf, ticketPrice, winChance, legResult, ticketPL, marginModel, liveModel, totalSd, normCdf, fairLeg, lineOk, FAN_CLASSES, betClass };

   
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
    
    function settleOf(t) {
      const { lost, pushed, pending } = tally(t), profit = profitOf(t.amount, ticketPrice(t));
      if (lost) return { state: "lost", payout: 0, net: t.bonus ? 0 : -t.amount };
      if (pending) return { state: "pending" };
      if (pushed) return { state: "push", payout: t.bonus ? 0 : t.amount, net: 0 };
      return { state: "won", payout: t.bonus ? profit : t.amount + profit, net: profit };
    }
    
    
    function liveChances(t, g) {
      if (t.parlay || !g || !g.live || status(g)[1] !== "live") return null;
      const L = g.live, awaySide = t.side === nick(g, "away");
      if (t.type === "Moneyline") { const p = noVig(L.ml, awaySide); return { win: p, lose: 1 - p }; }
      if (t.type === "Spread") { const { win, push } = coverChances(g, awaySide ? L.sp : -L.sp, t.line); return { win, lose: 1 - win - push }; }
      if (t.type === "Total") { const over = 1 - normCdf((t.line - L.tot) / totalSd(g)), p = t.side === "Over" ? over : 1 - over; return { win: p, lose: 1 - p }; }
      return null;
    }
    
    
    function vigOf(t) {
      if (t.kalshi) { const k = t.kalshi, P = k.cents / 100; return k.fee > 0 ? k.fee : kalshiFee(k.contracts, P); }
      let win, push = 0;
      if (t.parlay) win = t.legs.reduce((p, l) => { const f = fairLeg(l, gameOf(l.key)); return p * (f.win + f.push / 2); }, 1);
      else ({ win, push } = fairLeg({ type: t.type, side: t.side, line: t.line }, gameOf(t.key)));
      return t.amount * (1 - win * decimalOf(ticketPrice(t)) - push);
    }
    
    
    
    
    
    
    function closeEdge(t) {
      const g0 = gameOf(t.key), placedLive = !!(g0 && t.createdAt && t.createdAt > new Date(g0.t).getTime());
      if (placedLive && !t.parlay && !t.kalshi && t.bonus) { const d = decimalOf(ticketPrice(t)); return t.amount * (d - 1) / d; }
      if (placedLive && !t.kalshi) return 0;
      if (t.kalshi && !t.parlay) {
        const k = t.kalshi, cost = k.contracts * k.cents / 100, fee = k.fee > 0 ? k.fee : kalshiFee(k.contracts, k.cents / 100), g = gameOf(t.key);
        if (placedLive) return -fee;
        if (!g || !["Moneyline", "Spread", "Total"].includes(t.type)) return -fee;
        const { win, push } = fairLeg({ type: t.type, side: t.side, line: t.line }, g);
        return k.contracts * win + push * cost - cost - fee;
      }
      if (!t.bonus) return -vigOf(t);
      const d = decimalOf(ticketPrice(t)), w = (1 - vigOf(t) / t.amount) / d;
      return t.amount * w * (d - 1);
    }
    function projectedPL(t) {
      const { lost, pushed, pending } = tally(t), n = legsOf(t).length;
      const cashLoss = t.bonus ? 0 : t.amount, profit = profitOf(t.amount, ticketPrice(t));
      if (lost) return -cashLoss;
      if (!pending) return pushed ? 0 : profit;
      if (!t.parlay) { const q = liveChances(t, gameOf(t.key)); if (q) return q.win * profit - q.lose * cashLoss; }   
      const p = Math.pow(Math.pow(winChance(t), 1 / n), pending);
      return p * profit - (1 - p) * cashLoss;
    }
    
    
    
    
    
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
    
    const spentShares = (g, tickets) => tickets.filter(t => spans(g, t)).map(t => ({ t, share: t.amount * t.legs.filter(l => l.key === gameKey(g)).length / t.legs.length }));
    
    const shareRisk = shares => shares.reduce((a, s) => a + (s.t.bonus ? s.share * bonusFactor(s.t.odds) : s.share), 0);
    const gameBets = (g, tickets) => tickets.filter(t => t.parlay ? t.legs.every(l => l.key === gameKey(g)) : (t.key === gameKey(g) || (!t.key && t.kickoff === g.t && t.game === gameLabel(g))));
    
    
    
    function gameSettledPL(g, tickets) {
      if (!g.final) return null;
      const x = g.final[1] - g.final[0], T = g.final[0] + g.final[1], an = nick(g, "away"), bets = gameBets(g, tickets);
      let v = bets.reduce((s, t) => s + ticketPL(t, an, x, T, true), 0), any = bets.length > 0;
      parlayShares(g, tickets).forEach(s => { const st = settleOf(s.t); if (st.state !== "pending") { any = true; v += st.net * s.f; } });
      return any ? v : null;
    }
    
    
    
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
    
    
    
    function slateTotals(games, tickets) {
      let wagered = 0, bonusTotal = 0, risk = 0, win = 0, pl = 0, plAny = false, theo = 0;   
      games.forEach(g => {
        const bets = gameBets(g, tickets);
        if (!bets.length) return;
        if (!g.final) { const ex = extremes(g, bets); risk += ex.maxRisk; win += ex.maxWin; }
        bets.forEach(t => { if (t.bonus) bonusTotal += t.amount; else wagered += t.amount; theo += closeEdge(t); });
      });
      tickets.filter(t => t.parlay && new Set(t.legs.map(l => l.key)).size > 1).forEach(t => {
        if (t.bonus) bonusTotal += t.amount; else wagered += t.amount;
        theo += closeEdge(t);
        if (settleOf(t).state === "pending") { risk += riskOf(t, t.odds); win += profitOf(t.amount, t.odds); }
      });
      games.forEach(g => { const v = gameSettledPL(g, tickets); if (v !== null) { plAny = true; pl += v; } });
      return { wagered, bonusTotal, risk, win, pl, plAny, expected: tickets.reduce((s, t) => s + projectedPL(t), 0), theo };
    }
    
    const shareCash = (g, t, fr, x, T) => { const rs = t.legs.filter(l => l.key === gameKey(g)).map(l => legResult(l, nick(g, "away"), x, T)); return rs.includes(-1) ? (t.bonus ? 0 : -riskOf(t, t.odds) * fr) : rs.includes(0) ? 0 : profitOf(t.amount, t.odds) * fr; };
    
    
    
    
    
    
    
    
    function kalshiBets(lad, an, hn) {
      const candidates = [];
      [["home", hn, x => x > 0], ["away", an, x => x < 0]].forEach(([sd, team, pays]) => { const m = lad.ml && lad.ml[sd]; const o = lad.ml && lad.ml[sd === "home" ? "away" : "home"]; if (m && m.k > 0 && m.tk) candidates.push({ K: 0, txt: `${team} to win`, a: m.k, sp: o && o.k > 0 ? Math.max(0, (m.k + o.k - 1) / 2) : 0, alt: m.p, tk: m.tk, side: "yes", pays, ticketFields: { type: "Moneyline", side: team } }); });
      (lad.sp || []).forEach(([fav, K, kf, kd, tk, pf, pd]) => {
        if (!tk) return;
        const fh = fav === "home", favTeam = fh ? hn : an, dogTeam = fh ? an : hn, sp = kf && kd ? Math.max(0, (kf + kd - 1) / 2) : 0;
        if (kf) candidates.push({ K, txt: `${favTeam} −${K}`, a: kf, sp, alt: pf, tk, side: "yes", pays: x => (fh ? x : -x) > K, ticketFields: { type: "Spread", side: favTeam, line: -K } });   
        if (kd) candidates.push({ K, txt: `${dogTeam} +${K}`, a: kd, sp, alt: pd, tk, side: "no", pays: x => (fh ? x : -x) < K, ticketFields: { type: "Spread", side: dogTeam, line: K } });   
      });
      return candidates;
    }
    function hedgeFor(g, bets, shares = []) {
      const live = status(g)[1] === "live", lad = g.lad, L = live ? g.live : g.line;   
      if (!lad || lad.v !== 2 || !L || !(bets.length || shares.length) || g.final || g.noLine) return null;
      const an = nick(g, "away"), hn = nick(g, "home"), q = liveModel(g).detail(L.sp === 0 ? 0.001 : L.sp);
      const list = outcomes(g, bets, shares, { tot: L.tot, ties: false }), xs = list.map(o => o.x), ts = list.map(o => o.T), p = list.map(o => q.P(o.x) * o.w);
      const chanceTotal = p.reduce((a, b) => a + b, 0) || 1;
      const own = xs.map((x, i) => bets.reduce((s, t) => s + ticketPL(t, an, x, ts[i], true), 0));   
      
      const base = xs.map((x, i) => own[i] + shares.reduce((s, q) => s + shareCash(g, q.t, q.f, x, ts[i]), 0));
      const dead = own.map(v => v - shares.reduce((s, q) => s + (q.t.bonus ? 0 : riskOf(q.t, q.t.odds) * q.f), 0));
      
      const candidates = kalshiBets(lad, an, hn);
      const worst0 = Math.min(...base), best0 = Math.max(...base);
      if (best0 <= 0) return null;
      const profitChance = arr => arr.reduce((s, v, i) => s + (v > 0.5 ? p[i] : 0), 0) / chanceTotal;
      
      
      const edgeOf = t => { if (live) return projectedPL(t); if (!t.bonus) return -vigOf(t); const d = decimalOf(ticketPrice(t)), w = (1 - vigOf(t) / t.amount) / d; return t.amount * w * (d - 1); };
      const edge0 = bets.reduce((s, t) => s + edgeOf(t), 0) + shares.reduce((s, q) => s + q.f * edgeOf(q.t), 0), { LIFT, CAPITAL } = RULES.hedge;
      const better = (a, b) => !b || a.m > b.m + 1 || (a.m > b.m - 1 && a.e > b.e);
      const deadWorst = Math.min(...dead);
      let lock = null, hedge = null;
      candidates.forEach(c => {
        if (!(c.a > 0.01 && c.a < 0.99)) return;
        const pays = xs.map(x => c.pays(x)), fee = feePer(c.a), win = 1 - c.a - fee, lose = -c.a - fee;   
        const pw = xs.reduce((s, x, i) => s + (pays[i] ? p[i] : 0), 0) / chanceTotal, cost1 = fee + c.sp, charge = cost1 + CAPITAL * (c.a + fee), fair = pw >= D.hedgeMinPay && pw <= D.hedgeMaxPay;
        let top = -Infinity;
        for (let n = D.hedgeStep; n <= D.hedgeMaxContracts; n += D.hedgeStep) {
          const after = base.map((v, i) => v + (pays[i] ? win : lose) * n), m = Math.min(...after);
          if (m < top - 0.5) break;   
          top = Math.max(top, m);
          const dm = Math.min(...dead.map((v, i) => v + (pays[i] ? win : lose) * n));   
          if (m < worst0 + LIFT || dm < deadWorst - 0.5) continue;   
          const t = { c, n, m, b: Math.max(...after), after, e: edge0 - cost1 * n, left: edge0 - charge * n, fee: fee * n };
          if (dm > D.lockFloor && t.e >= 0 && better(t, lock)) lock = t;
          if (t.left >= 0 && fair && better(t, hedge)) hedge = t;
        }
      });
      const said = (pick, isLock) => { const { c, n, after } = pick; return { kind: isLock ? "lock" : "hedge", K: c.K, txt: c.txt, n, ask: c.a, src: "Kalshi", tk: c.tk, side: c.side, alt: c.alt, ticketFields: c.ticketFields, gk: gameKey(g), gn: gameLabel(g), gt: g.t, cost: n * c.a, at: lad.at,
        parlays: shares.length, fee: pick.fee, edgeBefore: edge0, edgeAfter: pick.e, worstBefore: worst0, worstAfter: pick.m, bestBefore: best0, bestAfter: pick.b, chanceBefore: profitChance(base), chanceAfter: profitChance(after) }; };
      const pick = lock || hedge;
      return pick ? said(pick, !!lock) : null;
    }
    
    
    
    function marginChances(g, L, state) {
      if (state && leagueOf(g).keyNumbers && state.secondsLeft != null) { const q = liveMargin(state.home - state.away, state.secondsLeft, L.sp); return { P: q.P, from: "live" }; }
      const curve = liveModel(g);
      
      if (!L.ml || !L.ml.every(Number.isFinite)) return { P: curve.detail(L.sp === 0 ? 0.001 : L.sp).P, from: "spread" };
      const want = noVig(L.ml, false), win = k => curve.mean(k / 20).win;
      let lo = -800, hi = 800;
      while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (win(mid) < want) lo = mid; else hi = mid; }
      const k = Math.abs(win(lo) - want) < Math.abs(win(hi) - want) ? lo : hi;
      return { P: curve.mean(k / 20).P, from: "moneyline" };
    }
    
    
    
    
    
    
    function poolChances(over) {
      const blocks = [];
      [...over].sort((x, y) => x[0] - y[0]).forEach(([x, s]) => { blocks.push({ lines: [x], s, n: 1 }); while (blocks.length > 1 && blocks[blocks.length - 2].s < blocks[blocks.length - 1].s) { const b = blocks.pop(), c = blocks.pop(); blocks.push({ lines: [...c.lines, ...b.lines], s: (c.s * c.n + b.s * b.n) / (c.n + b.n), n: c.n + b.n }); } });
      return blocks.flatMap(b => b.lines.map(x => [x, Math.min(1, Math.max(0, b.s))]));
    }
    
    
    
    function totalChances(g, lad, L) {
      const over = poolChances((lad.tot || []).filter(([, o, u]) => o > 0 && u > 0).map(([K, o, u]) => [K, (o + 1 - u) / 2]));
      if (!over.length) return null;
      const sd = totalSd(g), Phi = v => (v === -Infinity ? 0 : v === Infinity ? 1 : normCdf((v - L.tot) / sd)), edges = [[-Infinity, 1], ...over, [Infinity, 0]];
      return v => {
        if (v === -Infinity) return 0;
        if (v === Infinity) return 1;
        for (let i = 0; i + 1 < edges.length; i++) {
          const [a, sa] = edges[i], [b, sb] = edges[i + 1];
          if (v >= a && v < b) { const f = Phi(b) > Phi(a) ? (Phi(v) - Phi(a)) / (Phi(b) - Phi(a)) : 0; return 1 - (sa - (sa - sb) * f); }
        }
        return 1;
      };
    }
    
    
    function totalBets(lad, lines) {
      const ml = lad.ml || {}, ev = /^KX([A-Z]+)GAME-([^-]+)-/.exec(String((ml.home && ml.home.tk) || (ml.away && ml.away.tk) || "")), out = [];
      if (!ev) return out;
      (lad.tot || []).forEach(([K, o, u]) => {
        if (!lines.includes(K)) return;
        const tk = `KX${ev[1]}TOTAL-${ev[2]}-${K + 0.5}`, sp = o > 0 && u > 0 ? Math.max(0, (o + u - 1) / 2) : 0;
        if (o > 0) out.push({ K, txt: `Over ${K}`, a: o, sp, alt: null, tk, side: "yes", pays: (x, T) => T > K, ticketFields: { type: "Total", side: "Over", line: K } });
        if (u > 0) out.push({ K, txt: `Under ${K}`, a: u, sp, alt: null, tk, side: "no", pays: (x, T) => T < K, ticketFields: { type: "Total", side: "Under", line: K } });
      });
      return out;
    }
    function ladderChances(g, lad, shape) {
      const over = [];   
      const ml = lad.ml || {}, h = ml.home && ml.home.k, a = ml.away && ml.away.k;
      if (h > 0 && a > 0) over.push([0, (h + 1 - a) / 2]);
      (lad.sp || []).forEach(([fav, K, kf, kd]) => { if (!(kf > 0 && kd > 0)) return; const mid = (kf + 1 - kd) / 2; over.push(fav === "home" ? [K, mid] : [-K, 1 - mid]); });
      if (!over.length) return null;
      const pts = poolChances(over), M = leagueOf(g).maxMargin, out = new Map();
      
      const edges = [[-Infinity, 1], ...pts, [Infinity, 0]];
      for (let i = 0; i + 1 < edges.length; i++) {
        const [lo, overLow] = edges[i], [hi, overHigh] = edges[i + 1], part = overLow - overHigh, ms = [];
        for (let m = Math.max(-M, Math.floor(lo) + 1); m <= Math.min(M, hi); m++) if (m !== 0 && m > lo) ms.push(m);
        if (!ms.length || part <= 0) continue;
        const w = ms.map(m => shape(m)), tw = w.reduce((s, v) => s + v, 0);
        ms.forEach((m, j) => out.set(m, part * (tw > 0 ? w[j] / tw : 1 / ms.length)));
      }
      return { P: m => out.get(m) || 0, lines: pts.length };
    }
    
    
    
    
    
    
    
    
    
    
    
    
    
    function ladderExpected(g, bets, shares = [], state = null) {
      const live = status(g)[1] === "live", lad = g.lad, L = live ? g.live : g.line;
      if (!lad || lad.v !== 2 || !L || g.final || g.noLine) return null;
      const fromLadder = ladderChances(g, lad, marginChances(g, L, live ? state : null).P);
      if (!fromLadder) return null;
      const an = nick(g, "away"), list = outcomes(g, bets, shares, { tot: L.tot, ties: false }), raw = list.map(o => fromLadder.P(o.x) * o.w), sum = raw.reduce((a, b) => a + b, 0) || 1;
      return list.reduce((s, o, i) => s + raw[i] / sum * bets.reduce((a, t) => a + ticketPL(t, an, o.x, o.T, true), 0), 0) + shares.reduce((s, q) => s + q.f * projectedPL(q.t), 0);
    }
    
    
    
    
    function kellyTabs(g, bets, shares = [], state = null, bankroll = null) {
      const live = status(g)[1] === "live", lad = g.lad, L = live ? g.live : g.line;
      if (!lad || lad.v !== 2 || !L || !(bets.length || shares.length) || g.final || g.noLine) return { away: [], home: [], total: [] };
      const an = nick(g, "away"), hn = nick(g, "home"), shape = marginChances(g, L, live ? state : null), fromLadder = ladderChances(g, lad, shape.P), chances = fromLadder ? { P: fromLadder.P, from: "ladder" } : shape;
      const near = (g.line && g.line.tot) || L.tot, totalLines = (lad.tot || []).map(r => r[0]).sort((a, b) => Math.abs(a - near) - Math.abs(b - near) || a - b).slice(0, 12).sort((a, b) => a - b), totals = totalChances(g, lad, L);
      const list = outcomes(g, bets, shares, { tot: L.tot, ties: false, more: totalLines, cdf: totals, free: true }), xs = list.map(o => o.x);
      const raw = list.map(o => chances.P(o.x) * o.w), sum = raw.reduce((a, b) => a + b, 0) || 1, p = raw.map(v => v / sum);
      const base = xs.map((x, i) => bets.reduce((s, t) => s + ticketPL(t, an, x, list[i].T, true), 0) + shares.reduce((s, q) => s + shareCash(g, q.t, q.f, x, list[i].T), 0));
      const bank = bankroll != null ? bankroll : bets.reduce((s, t) => s + t.amount, 0) + shares.reduce((s, q) => s + q.share, 0), W = base.map(v => bank + v);   
      const growth = r => W.reduce((s, w, i) => s + (p[i] > 0 ? p[i] * Math.log(Math.max(w + r[i], 1e-9)) : 0), 0);
      const g0 = growth(W.map(() => 0)), ev = r => base.reduce((s, v, i) => s + p[i] * (v + (r ? r[i] : 0)), 0), ev0 = ev(null);
      const worst0 = Math.min(...base), best0 = Math.max(...base);
      const kelly = c => {
        if (!(c.a > 0.01 && c.a < 0.99)) return null;
        const fee = feePer(c.a), pays = list.map(o => c.pays(o.x, o.T)), r1 = pays.map(y => (y ? 1 - c.a - fee : -c.a - fee));
        
        let top = D.hedgeMaxContracts; W.forEach((w, i) => { if (r1[i] < 0 && p[i] > 0) top = Math.min(top, (w - 0.01) / -r1[i]); });
        const slope = n => W.reduce((s, w, i) => s + (p[i] > 0 ? p[i] * r1[i] / Math.max(w + n * r1[i], 1e-9) : 0), 0);
        if (top < 1 || slope(0) <= 0) return null;
        let lo = 0, hi = top;
        if (slope(hi) > 0) lo = hi; else for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (slope(mid) > 0) lo = mid; else hi = mid; }
        const at = n => growth(r1.map(v => v * n)), n = [Math.floor(lo), Math.ceil(lo)].filter(k => k >= 1 && k <= top).sort((a, b) => at(b) - at(a))[0];
        if (!n || at(n) <= g0) return null;
        const after = base.map((v, i) => v + r1[i] * n), evAfter = ev(r1.map(v => v * n));   
        return { c, n, after, gain: at(n) - g0, press: evAfter > ev0, chance: p.reduce((s, q, i) => s + (pays[i] ? q : 0), 0), fee: fee * n, ev: evAfter };
      };
      const sides = kalshiBets(lad, an, hn), overUnder = totalBets(lad, totalLines);
      const wanted = leagueOf(g).hedgeLines, onKalshi = [...new Set(sides.map(c => c.K))].filter(k => k > 0).sort((a, b) => a - b);
      const said = k => {
        const { c, n, after } = k, from = c.ticketFields.type === "Total" ? (totals ? "ladder" : "curve") : chances.from;
        return { kind: k.press ? "press" : "hedge", K: c.K, txt: c.txt, n, ask: c.a, src: "Kalshi", tk: c.tk, side: c.side, alt: c.alt, ticketFields: c.ticketFields, gk: gameKey(g), gn: gameLabel(g), gt: g.t, cost: n * c.a, at: lad.at,
          parlays: shares.length, fee: k.fee, chance: k.chance, from, bank, gain: k.gain, evBefore: ev0, evAfter: k.ev, worstBefore: worst0, worstAfter: Math.min(...after), bestBefore: best0, bestAfter: Math.max(...after) };
      };
      const teamRows = team => [0, ...(wanted || onKalshi)].map(K => { const c = sides.find(s => s.K === K && s.ticketFields.side === team), k = c ? kelly(c) : null; return { K, market: !!c, h: k ? said(k) : null }; });
      const totalRows = totalLines.map(K => { const cs = overUnder.filter(c => c.K === K), k = cs.map(kelly).filter(Boolean).sort((a, b) => b.gain - a.gain)[0]; return { K, market: cs.length > 0, h: k ? said(k) : null }; });
      return { away: teamRows(an), home: teamRows(hn), total: totalRows };
    }
    
    function kellyFor(g, bets, shares = [], state = null, bankroll = null) {
      const t = kellyTabs(g, bets, shares, state, bankroll);
      return t.away.map((r, i) => [r, t.home[i]].filter(x => x.h).sort((a, b) => b.h.gain - a.h.gain)[0] || { K: r.K, market: r.market || t.home[i].market, h: null });
    }
    
    const KX_ALIAS = { WSH: ["WAS"], JAX: ["JAC"], LAR: ["LA"], LV: ["LVR"], NE: ["NWE"], NO: ["NOR"], GB: ["GNB"], TB: ["TAM"], SF: ["SFO"], KC: ["KAN"], LAC: ["SDG"] };
    const kxCodes = n => [abbr(n), ...(KX_ALIAS[abbr(n)] || [])];
    const TICKER = new RegExp("^KX(" + Object.values(RULES.leagues).map(r => r.code).join("|") + ")(GAME|SPREAD|TOTAL)-(\\d\\d)([A-Z]{3})(\\d\\d)([A-Z]+)-([A-Z]*)(\\d*)$");
    function readTicker(tk, side) {
      const m = TICKER.exec(String(tk));
      if (!m) return null;
      const [, lg, kind, yy, month, dd, teams, team, num] = m, day = `20${yy}-${String("JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC".indexOf(month) / 3 + 1).padStart(2, "0")}-${dd}`;
      const g = ALL_GAMES.find(x => leagueId(x) === lg.toLowerCase() && x.t.slice(0, 10) === day && kxCodes(nick(x, "away")).some(a => kxCodes(nick(x, "home")).some(h => a + h === teams)));
      if (!g) return null;
      const an = nick(g, "away"), hn = nick(g, "home"), K = Number(num) - .5, yes = side === "yes";
      if (kind === "TOTAL") return num && !team ? { g, type: "Total", side: yes ? "Over" : "Under", line: K } : null;
      const named = kxCodes(an).includes(team) ? an : kxCodes(hn).includes(team) ? hn : null, other = named === an ? hn : an;
      if (!named) return null;
      if (kind === "GAME") return { g, type: "Moneyline", side: yes ? named : other };
      return num ? { g, type: "Spread", side: yes ? named : other, line: yes ? -K : K } : null;
    }
    
    
    function ticketFromFill(x, had, when) {
      const { side, price } = fillSide(x), id = `fill-${x.venue}-${x.order_id}`;
      if (had && had.trades && had.trades[x.trade_id]) return null;
      const trades = { ...(had && had.trades), [x.trade_id]: { n: x.count, p: price, fee: x.fee } };
      const { contracts: C, fee, total, american, cents } = fillAmounts(trades), b = readTicker(x.ticker, side), ml = b && b.type === "Moneyline";
      const week = b ? b.g.week : 0, kickoff = b ? b.g.t : new Date(x.ts_ms).toISOString();   
      return { id, known: !!b, ticket: {
        book: "Kalshi", amount: Math.round(total * 100) / 100, bonus: false, createdAt: had ? had.createdAt : x.ts_ms, fillId: x.client_order_id || id, ticker: x.ticker, trades, week,
        key: b ? gameKey(b.g) : "kalshi|" + x.ticker, game: b ? gameLabel(b.g) : x.ticker, kickoff, type: b ? b.type : "Other", side: b ? b.side : side.toUpperCase(),
        ...(ml ? { line: american } : { ...(b ? { line: b.line } : {}), odds: american }), kalshi: { cents, contracts: C, fee: Math.round(fee * 100) / 100 },
        pick: b ? `${b.side}${ml ? "" : " " + (b.type === "Spread" ? pts(b.line) : String(b.line))} ${cents}¢` : `${x.ticker} ${side.toUpperCase()} ${cents}¢`,
        when: when(kickoff)
      } };
    }
    
    
    
    
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
          || kalshi.find(s => free(s) && !s.fillId && s.kalshi && Math.abs(s.kalshi.contracts - t.kalshi.contracts) < 1e-9 && Math.abs(s.amount - t.amount) < 0.05);   
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
    return { ...shared, status, settleOf, liveChances, vigOf, projectedPL, deadFor, parlayShares, spentShares, shareRisk, gameBets, gameSettledPL, shareTerm, extremes, slateTotals, closeEdge, hedgeFor, kellyFor, kellyTabs, ladderExpected, readTicker, ticketFromFill, withFills, kalshiCheck, ledgerRows };
  }
  return { RULES, make, ...shared, liveMargin, odds, winPct, feedState, noVigHome, spreadFromMl, kalshiFee, contractsFor, placeLimit, kalshiCalc, centsOf, americanOf, quoteOf, fillSide, fillAmounts, kalshiMarket, freshPrices, replyFill, reconcile, evMoneyline, evPoints, showsML, pairFlagged, pairStakes, hcStates, HC_VARS, hcVisitorMargin, hcFitCoef, hcFitLeaveOut, hcFitGaps, hcFitOne, olsFit, hcTheo, hcByeEffect, hcByeAdjust, hcGap, hcDivCoef, useMethods, METHOD_NAMES, fan: FAN };
})();
export { Calc };
