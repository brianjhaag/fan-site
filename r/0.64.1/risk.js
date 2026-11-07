
import { nick, scoutOn, $, GAMES, gdBadge, teamChip, changed, sportsbookTag, calc, deadFor, el, extremes, gameBets, gameKey, gameLabel, gamesInView, last, later, leagueOf, legResult, legText, money, odds, parlayShares, profitOf, projectedPL, pts, resultCell, riskGame, riskKey, riskOf, setRiskGame, shareRisk, shareTerm, shortDayFmt, signedMoney, spentShares, status, ticketPL, ticketPrice, tickets, ticketsInView, timeFmt, timeZoned } from "./base.js?v=mw6bp18h";
import { fitTicketColumn, updateGameArrows } from "./layout.js?v=mw6bp18h";
import { abbr } from "./leagues.js?v=mw6bp18h";
import { Calc } from "./calc.js?v=mw6bp18h";
  
  
  function riskGrid(g, bets, W, parlayLegs = [], shares = [], minHalfWidth = 0, shrink = 0, textSize = 18) {   
    const an = nick(g, "away"), hn = nick(g, "home");
    const c = g.line.sp, tc = g.line.tot, PL = 58, PR = W - 20, PT = 30, PB = 205 - shrink;
    const xs = [], Ts = [];
    
    
    const thisGameKey = gameKey(g), totLines = [];
    bets.forEach(t => { if (t.parlay) t.legs.forEach(l => { if (l.key === thisGameKey && l.type === "Total") totLines.push(l.line); }); else if (t.type === "Total") totLines.push(t.line); });
    parlayLegs.forEach(({ l }) => { if (l.type === "Total") totLines.push(l.line); });
    shares.forEach(q => q.t.legs.forEach(l => { if (l.key === thisGameKey && l.type === "Total") totLines.push(l.line); }));
    
    const axis = leagueOf(g).graphAxis || { margin: 12.5, total: 10.5, tick: 5 };
    const totSpan = totLines.length ? Math.max(...totLines) - Math.min(...totLines) : 0, HALF = Math.max(axis.total, totSpan / 2 + 3), HX = Math.max(axis.margin, Math.ceil(Math.abs(c)) + 2.5, minHalfWidth);
    const totalCenter = Math.max(HALF - .5, totLines.length ? (Math.min(...totLines) + Math.max(...totLines)) / 2 : tc);   
    for (let v = Math.ceil(-HX); v <= HX; v++) xs.push(v);
    for (let v = Math.ceil(totalCenter - HALF); v <= totalCenter + HALF; v++) Ts.push(v);
    
    
    const F = c < 0 ? -1 : 1, favSide = F > 0 ? "home" : "away", dogSide = F > 0 ? "away" : "home";
    const X = v => PL + (F * v + HX) / (2 * HX) * (PR - PL), Y = v => PB - (v - (totalCenter - HALF)) / (2 * HALF) * (PB - PT);
    
    const XR = (a, b) => { const p = X(a - .5), q = X(b + .5); return [Math.min(p, q), Math.abs(q - p)]; };
    
    const plAt = (x, T) => bets.reduce((s, t) => s + ticketPL(t, an, x, T), 0) + (shares.length ? shareTerm(g, shares, x, T) : 0);
    const round = v => Math.round(v * 100) / 100;
    const feasible = (x, T) => T >= Math.abs(x);
    
    const val = Ts.map(T => xs.map(x => feasible(x, T) ? round(plAt(x, T)) : null));
    
    const ex = extremes(g, bets, shares);
    const maxAbs = Math.max(...val.flat().map(v => Math.abs(v || 0)), 1);
    
    const flood = (m, m2 = null) => {   
      const seen = Ts.map(() => xs.map(() => false)), out = [];
      Ts.forEach((_, ti) => xs.forEach((_, xi) => {
        if (seen[ti][xi] || m[ti][xi] === null) return;
        const v = m[ti][xi], v2 = m2 ? m2[ti][xi] : null, region = { v, v2, n: 0, sx: 0, sT: 0, x0: 1e9, x1: -1e9, T0: 1e9, T1: -1e9, cells: [] }, stack = [[ti, xi]];
        seen[ti][xi] = true;
        while (stack.length) {
          const [a, b] = stack.pop(), x = xs[b], T = Ts[a];
          region.cells.push([b, a]);
          region.n++; region.sx += x; region.sT += T;
          region.x0 = Math.min(region.x0, x); region.x1 = Math.max(region.x1, x); region.T0 = Math.min(region.T0, T); region.T1 = Math.max(region.T1, T);
          [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]].forEach(([p, q]) => {
            if (p < 0 || q < 0 || p >= Ts.length || q >= xs.length || seen[p][q] || m[p][q] !== v || (m2 && m2[p][q] !== v2) || Math.sign(xs[q]) !== Math.sign(x)) return;   
            seen[p][q] = true; stack.push([p, q]);
          });
        }
        out.push(region);
      }));
      return out;
    };
    
    
    const shareLoss = shares.reduce((a, q) => a - riskOf(q.t, q.t.odds) * q.f, 0);
    const val2 = shares.length ? Ts.map(T => xs.map(x => feasible(x, T) ? round(bets.reduce((a, t) => a + ticketPL(t, an, x, T), 0) + shareLoss) : null)) : null;
    const regions = flood(val, val2);
    
    const ticketWins = (t, x, T) => (t.parlay ? t.legs : [{ type: t.type, side: t.side, line: t.line }]).every(l => legResult(l, an, x, T) === 1);
    
    const manyBets = bets.length + new Set(parlayLegs.map(e => e.t)).size > 1;
    const allWin = parlayLegs.length && manyBets ? Ts.map(T => xs.map(x => feasible(x, T) ? bets.every(t => ticketWins(t, x, T)) && parlayLegs.every(e => legResult(e.l, an, x, T) === 1) : null)) : null;
    const winRegions = allWin ? flood(allWin).filter(k => k.v) : [];
    
    const rangeText = (lo, hi) => hi >= 60 ? lo + "+" : lo === hi ? String(lo) : lo + "–" + hi;
    const describe = k => {
      const a = k.x0 <= xs[0] ? -60 : k.x0, b = k.x1 >= xs[xs.length - 1] ? 60 : k.x1, p = [];
      if (a < 0) p.push(`${an} by ${rangeText(-Math.min(b, -1), -a)}`);
      if (a <= 0 && b >= 0) p.push("tie");
      if (b > 0) p.push(`${hn} by ${rangeText(Math.max(a, 1), b)}`);
      const minAbs = k.x0 <= 0 && k.x1 >= 0 ? 0 : Math.min(Math.abs(k.x0), Math.abs(k.x1));
      const low = k.T0 <= Math.max(Ts[0], minAbs), high = k.T1 >= Ts[Ts.length - 1];
      const tot = low && high ? "" : low ? `total ${k.T1} or fewer` : high ? `total over ${k.T0 - 1}` : `total ${k.T0}–${k.T1}`;
      return [p.join(", "), tot].filter(Boolean).join(" · ");
    };
    regions.forEach(k => { k.label = describe(k); });
    
    winRegions.forEach(k => {
      k.label = describe(k); k.best = -Infinity;
      Ts.forEach((T, ti) => xs.forEach((x, xi) => {
        if (allWin[ti][xi] && x >= k.x0 && x <= k.x1 && T >= k.T0 && T <= k.T1) k.best = Math.max(k.best, val[ti][xi]);
      }));
    });

    const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
    const zone$ = v => { const r = Math.round(v); return (r < 0 ? "−" : r > 0 ? "+" : "") + "$" + Math.abs(r).toLocaleString("en-US"); };
    const n1 = v => v.toFixed(1);
    let s = `<svg class="axis" viewBox="0 0 ${W} ${PB + 30}" role="img">`;   
    
    const stack = rows => {
      const out = []; let open = new Map();
      rows.forEach(runs => {
        const next = new Map();
        runs.forEach(r => {
          const k = r.k + "|" + r.x + "|" + r.w, p = open.get(k);
          if (p) { p.y = r.y; p.h += r.h; next.set(k, p); } else { const c = { ...r }; out.push(c); next.set(k, c); }
        });
        open = next;
      });
      return out;
    };
    const rowBox = T => { const a = Math.round(Y(T + .5)), b = Math.round(Y(T - .5)); return [a, b - a]; };   
    const cellRows = Ts.map((T, ti) => {
      const runs = [], [y, h] = rowBox(T);
      let b = 0;
      while (b < xs.length) {
        let e = b; while (xs[b] !== 0 && e + 1 < xs.length && xs[e + 1] !== 0 && val[ti][e + 1] === val[ti][b]) e++;
        if (xs[b] === 0) { b = e + 1; continue; }   
        const v = val[ti][b], [x0, w0] = XR(xs[b], xs[e]), x = Math.round(x0), w = Math.round(x0 + w0) - x;
        if (v === null) runs.push({ k: "no", x, w, y, h, cls: "ax-no" });
        else if (v !== 0) runs.push({ k: v, x, w, y, h, cls: v > 0 ? "ax-run-profit" : "ax-run-loss", op: (.26 + .6 * Math.abs(v) / maxAbs).toFixed(2) });
        b = e + 1;
      }
      return runs;
    });
    stack(cellRows).forEach(r => { s += `<rect x="${n1(r.x)}" y="${n1(r.y)}" width="${n1(r.w)}" height="${n1(r.h)}" class="${r.cls}"${r.op ? ` fill-opacity="${r.op}"` : ""}/>`; });
    s += `<path d="M${PL} ${PT}V${PB}M${PR} ${PT}V${PB}" class="ax-frame"/>`;   
    winRegions.forEach(k => {
      const [xl, wl] = XR(k.x0, k.x1), x0 = Math.max(PL, xl), x1 = Math.min(PR, xl + wl), y0 = Math.max(PT, Y(k.T1 + .5)), y1 = Math.min(PB, Y(k.T0 - .5));
      s += `<rect x="${n1(x0)}" y="${n1(y0)}" width="${n1(x1 - x0)}" height="${n1(y1 - y0)}" class="ax-all"/><text x="${n1(x0 + 6)}" y="${n1(y0 + 15)}" class="ax-all-label">ALL WIN ${zone$(k.best)}</text>`;
    });
    
    
    
    const isLive = !!(g.live && status(g)[1] === "live"), totNow = isLive ? g.live.tot : tc, totShown = totNow >= totalCenter - HALF && totNow <= totalCenter + HALF, totUp = totNow > totalCenter + HALF, Yc = totShown ? Y(totNow) : (totUp ? PT + 7 : PB - 7);   
    for (let v = Math.ceil((totalCenter - HALF) / axis.tick) * axis.tick; v <= totalCenter + HALF; v += axis.tick) {
      s += `<line x1="${PL - 5}" x2="${PL}" y1="${n1(Y(v))}" y2="${n1(Y(v))}" class="ax-tick"/>`;
      if (Math.abs(Y(v) - Yc) >= 13) s += `<text x="${PL - 9}" y="${n1(Y(v) + 4)}" text-anchor="end" class="ax-lbl">${v}</text>`;
    }
    if (totShown) s += `<line x1="${PL - 6}" x2="${PL}" y1="${n1(Yc)}" y2="${n1(Yc)}" class="ax-total-tick"/><text x="${PL - 9}" y="${n1(Yc + 5)}" text-anchor="end" class="ax-tot">${Number(totNow).toFixed(1)}</text>`;
    else s += `<polygon points="${totUp ? `${PL - 11},${n1(Yc - 5)} ${PL - 16},${n1(Yc + 3)} ${PL - 6},${n1(Yc + 3)}` : `${PL - 11},${n1(Yc + 5)} ${PL - 16},${n1(Yc - 3)} ${PL - 6},${n1(Yc - 3)}`}" class="ax-total-arrow"/><text x="${PL - 21}" y="${n1(Yc + 5)}" text-anchor="end" class="ax-tot">${Number(totNow).toFixed(1)}</text>`;
    
    
    const spNow = isLive ? g.live.sp : c, Xc = Math.max(PL, Math.min(PR, X(spNow))), spreadFav = F * spNow, spTxt = (spreadFav < 0 ? "−" : "") + Math.abs(spreadFav).toFixed(1), spHalf = spTxt.length * 4.2 + 8;
    for (let v = Math.ceil(-HX); v <= HX; v++) {
      const major = v % 3 === 0;
      s += `<line x1="${n1(X(v))}" x2="${n1(X(v))}" y1="${PB}" y2="${PB + (major ? 8 : 4)}" class="ax-tick"/>`;
      if (Math.abs(X(v) - Xc) >= spHalf + 5) s += `<text x="${n1(X(v))}" y="${PB + 22}" text-anchor="middle" class="ax-lbl">${Math.abs(v)}</text>`;   
    }
    s += `<text x="${n1(Xc)}" y="${PB + 22}" text-anchor="middle" class="ax-tot">${spTxt}</text>`;
    
    
    const cellLabels = regions.filter(k => k.v !== 0 && k.n >= 14 && !(k.x0 === 0 && k.x1 === 0)).map(k => {
      const two = k.v2 != null && Math.abs(k.v2 - k.v) >= 0.5, t1 = zone$(k.v), t2 = two ? zone$(k.v2) : "";
      return { k, two, cx: X(k.sx / k.n), cy: Y(k.sT / k.n), w: Math.max(t1.length * textSize * .62, t2.length * textSize * .5), h: two ? textSize + 13 : textSize + 2 };
    });
    for (let it = 0; it < 60; it++) {
      let moved = false;
      for (let i = 0; i < cellLabels.length; i++) for (let j = i + 1; j < cellLabels.length; j++) {
        const a = cellLabels[i], b = cellLabels[j], dx = (a.w + b.w) / 2 + 8 - Math.abs(a.cx - b.cx), dy = (a.h + b.h) / 2 + 5 - Math.abs(a.cy - b.cy);
        if (dx <= 0 || dy <= 0) continue;
        moved = true;
        const m = dy / 2 * (a.cy <= b.cy ? 1 : -1); a.cy -= m; b.cy += m;   
      }
      cellLabels.forEach(a => { a.cx = Math.min(PR - a.w / 2 - 3, Math.max(PL + a.w / 2 + 3, a.cx)); a.cy = Math.min(PB - a.h / 2 - 2, Math.max(PT + a.h / 2 + 2, a.cy)); });
      if (!moved) break;
    }
    cellLabels.forEach(({ k, two, cx, cy }) => {
      s += `<text x="${n1(cx)}" y="${n1(cy + (two ? -1 : 5))}" text-anchor="middle" class="ax-cell ${k.v > 0 ? "ax-cell-profit" : "ax-cell-loss"}">${zone$(k.v)}</text>`;
      if (two) s += `<text x="${n1(cx)}" y="${n1(cy + 14)}" text-anchor="middle" class="ax-cell2 ${k.v2 > 0 ? "ax-cell-profit" : "ax-cell-loss"}">${zone$(k.v2)}</text>`;
    });
    
    s += (totShown ? `<line x1="${PL}" x2="${PR}" y1="${n1(Yc)}" y2="${n1(Yc)}" class="ax-cross"/>` : "") + `<line x1="${n1(Xc)}" x2="${n1(Xc)}" y1="${PT - 6}" y2="${PB + 8}" class="ax-center"/>`;
    s += `</svg>`;   
    const w = document.createElement("div");
    w.className = "rk-axis";
    w.innerHTML = s;
    w.firstElementChild.setAttribute("aria-label", `Profit and loss by final margin and total points, centered on ${an} ${sgn(c)} and a total of ${tc}`);
    
    const badges = el("div", "rk-sides");
    
    const gk = gameKey(g);
    
    
    
    const exchange = b => b === "Kalshi" || /^Polymarket/.test(b || "");
    const booksOn = team => {
      const m = new Map(), add = (t, amt) => { if (exchange(t.book)) return; const e = m.get(t.book) || { cash: 0, bonus: 0 }; e[t.bonus ? "bonus" : "cash"] += amt; m.set(t.book, e); };
      tickets.forEach(t => {
        if (t.parlay) { const n = t.legs.filter(l => l.key === gk && l.side === team).length; if (n) add(t, t.amount * n / t.legs.length); }
        else if ((t.key === gk || (!t.key && t.kickoff === g.t && t.game === gameLabel(g))) && t.type !== "Total" && t.side === team) add(t, t.amount);
      });
      return m;
    };
    const sideBox = (side, row) => {
      const box = el("div", "rk-side"), books = booksOn(nick(g, side));
      const list = el("small", "rk-books");
      books.forEach((e, b) => {
        const item = el("span", "rk-sportsbook"); item.append(sportsbookTag(b, false, true));
        item.append(el("span", "rk-sportsbook-amount", [e.cash ? money(e.cash) : "", e.bonus ? "B" + money(e.bonus) : ""].filter(Boolean).join(" + ")));   
        list.append(item);
      });
      
      
      const code = teamChip(g, side, abbr(nick(g, side)), "rk-code");
      if (side === dogSide) list.prepend(code); else list.append(code);
      box.append(row, list);
      return box;
    };
    const leftRow = el("span", "rk-side-row"), rightRow = el("span", "rk-side-row");
    leftRow.append(gdBadge(g, dogSide));
    rightRow.append(gdBadge(g, favSide));
    const left = sideBox(dogSide, leftRow), right = sideBox(favSide, rightRow);
    left.classList.add("end");
    
    
    const aL = X(-F) / W * 100, aR = X(F) / W * 100;
    badges.style.gridTemplateColumns = `${aL}% ${aR - aL}% 1fr`; badges.style.columnGap = "0";
    right.style.gridColumn = "3";
    badges.style.setProperty("--pl", (PL / W * 100) + "%"); badges.style.setProperty("--pr", ((W - PR) / W * 100) + "%");   
    badges.append(left, right);
    w.append(badges);
    return { el: w, regions: regions.sort((a, b) => a.v - b.v), winRegions, maxRisk: ex.maxRisk, maxWin: ex.maxWin, pc: (PL + PR) / 2 / W * 100 };
  }
  
  let keptSizes = [];
  function selectionBefore() {
    const col = document.querySelector(".col.left"), rc = $("riskDetail"), tk = $("wagerTicket");
    if (riskGame && !col.classList.contains("has-selection")) {   
      const done = col.classList.contains("all-final");
      if (done) col.classList.remove("all-final");   
      col.style.setProperty("--tk-h", (tk.offsetHeight || 411) + "px");
      
      
      const info = document.querySelector("fan-info-line"), tkTop = tk.getBoundingClientRect().top, end = Math.min(info ? info.getBoundingClientRect().top : Infinity, window.innerHeight) - 6;
      col.style.setProperty("--rk-room", (tk.offsetHeight ? Math.max(tk.offsetHeight, Math.round(end - tkTop)) : 411) + "px");   
      if (done) col.classList.add("all-final");
      col.style.setProperty("--tk-slack", done ? "0px" : Math.max(0, Math.round(col.getBoundingClientRect().bottom - tk.getBoundingClientRect().bottom)) + "px");
    }
    col.classList.toggle("has-selection", !!riskGame);
    rc.classList.toggle("rk-off", !riskGame); rc.classList.toggle("rk-over", !!riskGame); rc.setAttribute("aria-hidden", String(!riskGame));
    
    keptSizes = ["--games-h", "--card-h"].map(v => document.documentElement.style.getPropertyValue(v));
  }
  function selectionAfter() {
    ["--games-h", "--card-h"].forEach((v, i) => { if (keptSizes[i]) document.documentElement.style.setProperty(v, keptSizes[i]); });
    fitTicketColumn(); updateGameArrows();
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && riskGame && $("gameList").hidden && $("sportsbookList").hidden) setRiskGame(null); });
  
  
  
  
  const liveStates = new Map();
  const hedgeTabs = new Map();   
  const liveReading = new Set();   
  
  
  
  function secondsLeftOf(e, lg) {
    const [count, length] = lg.periods, period = String(e.period || ""), q = /[QP](\d)/.exec(period), n = q ? Number(q[1]) : count, [mm, ss] = String(e.elapsed || "").split(":").map(Number);
    if (/^(HT|Half)/i.test(period)) return (count / 2) * length;
    if (/OT/.test(period)) return 0;
    const inPeriod = /^End/i.test(period) ? 0 : e.elapsed ? (mm || 0) * 60 + (ss || 0) : length;
    return Math.max(0, (count - n) * length + inPeriod);
  }
  async function readLiveState(g) {
    const lg = leagueOf(g);
    if (liveReading.has(lg)) return;
    liveReading.add(lg);
    try {
      const j = await (await fetch(`https://gateway.polymarket.us/v2/leagues/${lg.code.toLowerCase()}/events?limit=100`)).json(), events = (j.events || []).filter(e => e.live);
      let any = false;
      GAMES.filter(x => leagueOf(x) === lg && status(x)[1] === "live").forEach(game => {
        
        const named = (e, side) => (e.teams || []).findIndex(t => t.alias === nick(game, side) || String(t.alias || "").endsWith(" " + nick(game, side))), e = events.find(x => named(x, "away") >= 0 && named(x, "home") >= 0);
        if (!e) return;
        const points = String(e.score || "").split("-").map(Number), away = points[named(e, "away")], home = points[named(e, "home")];
        if (!Number.isFinite(away) || !Number.isFinite(home)) return;
        liveStates.set(gameKey(game), { at: Date.now(), away, home, clock: e.elapsed, period: e.period, secondsLeft: secondsLeftOf(e, lg) });
        any = true;
      });
      if (any) changed("live");
    } catch (err) {   } finally { liveReading.delete(lg); }
  }
  
  
  
  const KALSHI_FRESH_MS = 60000;   
  function gameState(g) {
    const k = g.state;
    if (k && !k.over && Date.now() - k.at < KALSHI_FRESH_MS && Number.isFinite(k.score[0]) && Number.isFinite(k.score[1]))
      return { at: k.at, away: k.score[0], home: k.score[1], clock: k.clock, period: k.period, secondsLeft: secondsLeftOf({ period: k.period, elapsed: k.clock }, leagueOf(g)), source: "Kalshi", kalshi: k };
    const s = liveStates.get(gameKey(g));
    if ((!s || Date.now() - s.at > 15000) && status(g)[1] === "live") readLiveState(g);
    return s ? { ...s, source: "Polymarket" } : null;
  }
  
  
  function liveClock(g) {
    const s = gameState(g);
    if (!s) return null;
    return /^([QP]\d|\d?OT)$/.test(s.period || "") && s.clock ? `${s.period} ${String(s.clock).replace(/^0(\d)/, "$1")}` : s.period || null;
  }
  const clockSource = g => { const s = gameState(g); return s ? s.source : null; };
  
  
  const DOWNS = ["", "1st", "2nd", "3rd", "4th"];
  function gameSituation(g) {
    const s = gameState(g), k = s && s.kalshi;
    if (!k) return null;
    const team = side => (side ? abbr(nick(g, side)) : ""), spot = k.spot && k.spot[1] != null ? " · " + (k.spot[1] === 50 ? "50" : `${team(k.spot[0])} ${k.spot[1]}`.trim()) : "";
    const text = k.review ? "Review" : k.tryNext ? "Try" : k.down ? `${DOWNS[k.down] || k.down} & ${k.goal ? "Goal" : k.distance ?? ""}${spot}`
      : k.strength && !/^(even|ev|5v5)$/i.test(k.strength) ? `${k.strength}${k.side ? " " + team(k.side) : ""}` : k.timeout ? "Timeout" : "";
    return { text, possession: k.possession || null, score: [s.away, s.home] };
  }
  
  
  
  function liveModelBox(g) {
    const s = gameState(g), box = el("div", "rk-live");
    if (!s) { box.append(el("span", "rk-live-head", "Live model · reading the score…")); return box; }
    const L = g.live || g.line, expected = L.sp, F = g.line.sp < 0 ? -1 : 1, an = abbr(nick(g, "away")), hn = abbr(nick(g, "home"));
    const q = Calc.liveMargin(s.home - s.away, s.secondsLeft, expected), old = Calc.marginModel(leagueOf(g).sigma, !leagueOf(g).keyNumbers).detail(expected === 0 ? 0.001 : expected);
    box.append(el("span", "rk-live-head", `Live model · ${an} ${s.away}–${s.home} ${hn} · ${s.clock || ""} ${s.period || ""} · ${s.source}`));
    const mid = Math.round(F * q.mean), W = 560, H = 54, lo = mid - 24, hi = mid + 24, x = m => (m - lo + 0.5) / (hi - lo + 1) * W, bw = W / (hi - lo + 1) - 1;
    let top = 0; for (let m = lo; m <= hi; m++) top = Math.max(top, q.P(F * m), old.P(F * m));
    const y = p => H - 2 - p / (top || 1) * (H - 6);
    let svg = `<svg class="rk-live-graph" viewBox="0 0 ${W} ${H + 12}" preserveAspectRatio="none" role="img">`;
    for (let m = lo; m <= hi; m++) { const p = q.P(F * m); if (p > 0.0005) svg += `<rect x="${x(m) - bw / 2}" y="${y(p).toFixed(1)}" width="${bw}" height="${(H - 2 - y(p)).toFixed(1)}" class="${[3, 7, 10, 14, 17].includes(Math.abs(m)) ? "key" : ""}"/>`; }
    let path = ""; for (let m = lo; m <= hi; m++) path += (path ? " L" : "M") + x(m).toFixed(1) + " " + y(old.P(F * m)).toFixed(1);
    svg += `<path d="${path}" class="pregame"/>`;
    const now = F * (s.home - s.away); if (now >= lo && now <= hi) svg += `<line x1="${x(now)}" x2="${x(now)}" y1="0" y2="${H}" class="now"/>`;
    for (let m = Math.ceil(lo / 7) * 7; m <= hi; m += 7) svg += `<text x="${x(m)}" y="${H + 11}" text-anchor="middle">${Math.abs(m)}</text>`;
    svg += "</svg>";
    const graph = el("div", "rk-live-plot"); graph.innerHTML = svg;
    const likely = q.margins.map(m => [m, q.P(m)]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([m, p]) => `${m > 0 ? hn : an} by ${Math.abs(m)} ${Math.round(p * 100)}%`).join(" · ");
    box.append(graph, el("small", "rk-live-likely", `${hn} wins ${Math.round(q.win * 100)}% (the line's curve ${Math.round(old.win * 100)}%) · ${likely}`));
    box.title = "Bars: the live model, from the score, the clock and the live line. Line: today's curve, the whole-game shape at the live line. The vertical line is the margin now.";
    return box;
  }
  
  
  function expectedOf(g, bets, shares) {
    const now = gameState(g), atLadder = calc.ladderExpected(g, bets, shares, now && Date.now() - now.at < 60000 ? now : null);
    return atLadder != null ? atLadder : bets.reduce((s, t) => s + projectedPL(t), 0) + shares.reduce((s, q) => s + q.f * projectedPL(q.t), 0);
  }
  
  
  
  
  function suggestedBets(g, bets, shares) {
    const state = gameState(g), tabs = calc.kellyTabs(g, bets, shares, state && Date.now() - state.at < 60000 ? state : null);
    if (!tabs.away.length && !tabs.total.length) return null;
    if (!hedgeTabs.has(gameKey(g))) { const bestOf = k => Math.max(0, ...tabs[k].map(r => (r.h ? r.h.gain : 0))); hedgeTabs.set(gameKey(g), ["away", "home", "total"].sort((a, b) => bestOf(b) - bestOf(a))[0]); }
    const tab = hedgeTabs.get(gameKey(g)), rows = tabs[tab];
    const list = el("div", "rk-hedge"), top = el("div", "hedge-top");
    const strip = el("span", "hedge-tabs");
    [["away", teamChip(g, "away", abbr(nick(g, "away")))], ["home", teamChip(g, "home", abbr(nick(g, "home")))], ["total", "Total"]].forEach(([k, label]) => {
      const b = el("button", "hedge-tab"); b.type = "button"; b.setAttribute("aria-selected", String(k === tab)); b.append(label);
      b.title = k === "total" ? "Over or under at Kalshi's totals" : `${nick(g, k)}: the moneyline and each line`;
      b.addEventListener("click", e => { e.stopPropagation(); hedgeTabs.set(gameKey(g), k); changed("exec"); });
      strip.append(b);
    });
    top.append(el("span", "hedge-head", "Suggested bets"), strip, later.execShare());   
    list.append(top);
    if (!rows.length) { const row = el("div", "hedge-row empty"); row.append(el("span", "hedge-line", ""), el("span", "hedge-text", "no Kalshi totals")); list.append(row); }
    rows.forEach(r => {
      const h = r.h, row = el("div", "hedge-row " + (h ? h.kind : "empty"));
      row.append(el("span", "hedge-line", r.K === 0 ? "ML" : String(r.K)));
      if (h) {
        
        const text = el("span", "hedge-text"), key = `${gameKey(g)}|${h.tk}|${h.side}`, limit = later.limitSlider(h, key);
        text.append(el("b", null, `${h.kind === "press" ? "Press" : "Hedge"}: ${h.n} ${h.txt}`), document.createTextNode(` · ask ${Math.round(h.ask * 100)}¢ · ${Math.round(h.chance * 100)}%`));
        row.title = `Full Kelly${h.kind === "press" ? ", a press: the price beats the chance" : ", a hedge"}: buy ${h.n} contracts, ${h.txt}, ${h.src} ${Math.round(h.ask * 100)}¢, ${money(h.cost)}${h.alt != null && Calc.costAfterFee("polymarket", h.alt) < Calc.costAfterFee("kalshi", h.ask) - 0.005 ? `, Polymarket ${Math.round(h.alt * 100)}¢` : ""}. Pays ${Math.round(h.chance * 100)}% of the time (${h.from === "ladder" ? "Kalshi's own prices, the middle of each line's two asks" : h.from === "live" ? "the live model, from the score and clock" : "the moneyline, no vig, on the key-number curve"}), on a bankroll of ${money(h.bank)}, this game's wagers. Expected ${signedMoney(h.evBefore)} to ${signedMoney(h.evAfter)}, worst ${signedMoney(h.worstBefore)} to ${signedMoney(h.worstAfter)}, best ${signedMoney(h.bestBefore)} to ${signedMoney(h.bestAfter)}. Prices ${timeFmt.format(new Date(h.at))}.`;
        row.append(text, limit.el, later.execButton(h, key, limit.price));
      } else row.append(el("span", "hedge-text", r.market ? "no bet now" : "no Kalshi line"));
      list.append(row);
    });
    const res = later.execResult(gameKey(g) + "|");
    if (res) list.append(res);
    return list;
  }
  function drawRiskDetail() {
    const box = $("riskDetail");
    box.replaceChildren();
    const g = GAMES.find(x => gameKey(x) === riskKey);
    box.classList.toggle("full", !!g);   
    const head = el("div", "sec-title");
    head.append(el("h2", null, "Game detail"));
    if (!g) {
      box.append(head, el("p", "dim", "Select Max risk on a game card to see its wagers here."));
      return;
    }
    const mine = tickets.filter(t => t.key === gameKey(g) || (!t.key && t.kickoff === g.t && t.game === gameLabel(g)));
    const sum = list => list.reduce((s, t) => s + t.amount, 0);
    const bets = gameBets(g), shares = parlayShares(g);
    const spent = spentShares(g);
    const sumShare = bonusFlag => spent.filter(s => !!s.t.bonus === bonusFlag).reduce((a, s) => a + s.share, 0);
    const wagered = sum(bets.filter(t => !t.bonus)) + sumShare(false), bonus = sum(bets.filter(t => t.bonus)) + sumShare(true);
    const parlayLegs = tickets.filter(t => t.parlay && !t.legs.every(l => l.key === gameKey(g)) && !deadFor(g, t)).flatMap(t => t.legs.filter(l => l.key === gameKey(g)).map(l => ({ t, l })));
    const grid = riskGrid(g, bets, Math.max(560, box.clientWidth - 34), parlayLegs, shares, leagueOf(g).graphMinMargin, box.classList.contains("rk-over") ? 78 : 0, box.classList.contains("rk-over") ? 13 : 18);   
    const expectedPl = expectedOf(g, bets, shares);
    head.append(el("small", null, `${shortDayFmt.format(new Date(g.t))} · ${timeZoned(new Date(g.t))}`));

    const top = el("div", "rk-top");
    const title = el("span", "rk-game");
    title.append(gdBadge(g, "away", `${nick(g, "away").toUpperCase()}${g.line.noSp ? "" : " " + pts(g.line.sp)}`), el("span", "rk-at", " @ "), gdBadge(g, "home"));
    title.style.setProperty("--pc", grid.pc + "%");   
    top.append(title);
    const stats = el("div", "rk-stats");
    [["Wagered", money(wagered), null], ...(bonus ? [["Bonus", "B" + money(bonus), null]] : []), ["Max risk", money(grid.maxRisk + shareRisk(shares)), "high"], ["Max win", signedMoney(grid.maxWin), "win"], ["Expected P/L", scoutOn() ? signedMoney(expectedPl) : "—", (!scoutOn() ? "dim" : expectedPl > 0.5 ? "profit" : expectedPl < -0.5 ? "loss" : "dim") + (g.live && status(g)[1] === "live" ? " live-pl" : "")]].forEach(([l, v, c]) => {
      const s = el("div", "stat"); s.append(el("span", "lbl", l), el("b", c, v)); stats.append(s);
    });
    const overlay = box.classList.contains("rk-over");
    if (!overlay) top.append(stats);   


    const ul = el("ul", "rk-list");
    const parlays = tickets.filter(t => t.parlay && t.legs.some(l => l.key === gameKey(g)));
    if (!mine.length && !parlays.length) ul.append(el("li", "empty", "No wagers on this game yet."));
    parlays.forEach(t => {
      const li = el("li"), win = profitOf(t.amount, t.odds), payout = t.bonus ? win : t.amount + win;
      const what = el("span", "rk-what");
      what.append(sportsbookTag(t.book, false, true), document.createTextNode(` · ${t.legs.length}-leg parlay @ ${t.kalshi ? t.kalshi.cents + "¢" : odds(t.odds)}${t.bonus ? " · bonus" : ""}`));
      const legBox = el("small", "rk-legs");   
      t.legs.forEach(l => legBox.append(el("span", "rk-leg", legText(l))));
      legBox.append(el("span", "rk-leg per", `${t.bonus ? "B" : ""}${money(t.amount / t.legs.length)} per leg`));
      what.append(legBox);
      const nums = el("span", "rk-nums");
      
      [["Wager", t.amount * t.legs.filter(l => l.key === gameKey(g)).length / t.legs.length], ["To win", win], ["Payout", payout], ["Risk", riskOf(t, t.odds)]].forEach(([l, v]) => {
        const c = el("span", "rk-num"); c.append(el("small", null, l), el("b", null, (l === "Wager" && t.bonus ? "B" : "") + money(v))); nums.append(c);
      });
      if (g.final) nums.append(resultCell(t));
      li.append(what, nums);
      ul.append(li);
    });
    mine.forEach(t => {
      const li = el("li");
      const priced = t.type === "Moneyline" || t.odds != null;
      const od = ticketPrice(t);
      const win = profitOf(t.amount, od), payout = t.bonus ? win : t.amount + win;
      const what = t.pick ? `${t.pick}${t.type !== "Moneyline" && !t.kalshi ? " @ " + odds(od) : ""} (${t.type})` : t.type || "Wager";
      const nums = el("span", "rk-nums");
      [["Wager", t.amount], ["To win", win], ["Payout", payout], ["Risk", riskOf(t, od)]].forEach(([l, v]) => {
        const c = el("span", "rk-num"); c.append(el("small", null, l), el("b", null, (l === "Wager" && t.bonus ? "B" : "") + money(v) + (priced ? "" : "*"))); nums.append(c);
      });
      if (g.final) nums.append(resultCell(t));
      const wh = el("span", "rk-what");
      wh.append(sportsbookTag(t.book, false, true), document.createTextNode(` · ${what}${t.bonus ? " · bonus" : ""}`));
      li.append(wh, nums);
      ul.append(li);
    });
    const suggestedEl = overlay && !g.final ? suggestedBets(g, bets, shares) : null;   
    const armEl = overlay && !g.final && (bets.length || shares.length) ? later.hedgeControls() : null;   
    box.classList.toggle("has-tune", !!armEl);
    const liveEl = overlay && !g.final && status(g)[1] === "live" && leagueOf(g).keyNumbers ? liveModelBox(g) : null;   
    box.append(head, top, grid.el, ...(suggestedEl ? [suggestedEl] : []), ...(armEl ? [armEl] : []), ...(overlay ? [stats] : []), ...(liveEl ? [liveEl] : []), ul);
    if (overlay) { const x = el("button", "gd-close", "×"); x.type = "button"; x.title = "Close"; x.setAttribute("aria-label", "Close risk detail"); x.addEventListener("click", () => setRiskGame(null)); box.append(x); }
  }

  
  function drawTotals() {
    const games = gamesInView(), shown = ticketsInView();
    const { wagered, bonusTotal, risk, win, pl: plSum, plAny, expected: slateWagers, theo } = calc.slateTotals(games, shown);
    
    const slateExpected = games.filter(g => !g.final).reduce((s, g) => { const bets = calc.gameBets(g, shown); return bets.length ? s + expectedOf(g, bets, []) - bets.reduce((a, t) => a + projectedPL(t), 0) : s; }, slateWagers);
    const plCls = !plAny ? "dim" : "settled " + (plSum > 0.004 ? "profit" : plSum < -0.004 ? "loss" : "dim");
    const slateOver = games.length > 0 && games.every(g => g.final);   
    const expectedCls = slateExpected > 0.5 ? "profit" : slateExpected < -0.5 ? "loss" : "dim";
    const box = $("totals");
    box.replaceChildren();
    const row = el("div", "totals-stats");
    [["Wagers", money(wagered), null], ["Max risk", money(risk), "high"], ["Max win", signedMoney(win), "win"], ["Expected P/L", scoutOn() && shown.length && !slateOver ? signedMoney(slateExpected) : "—", scoutOn() && shown.length && !slateOver ? expectedCls : "dim"], ["P/L", plAny ? signedMoney(plSum) : "—", plCls], ["Theo P/L", scoutOn() && shown.length ? signedMoney(theo) : "—", scoutOn() && shown.length ? (theo > 0.5 ? "profit" : theo < -0.5 ? "loss" : "dim") : "dim"]].forEach(([l, v, c]) => {
      const s = el("div", "stat"), b = el("b", c, v);
      if (l === "Wagers" && bonusTotal) b.append(el("span", "bonus-staked", " + B" + money(bonusTotal)));
      s.append(el("span", "lbl", l), b); row.append(s);
    });
    box.append(row);
    $("sum").replaceChildren(later.sportsbookReport(shown));
  }
export { selectionBefore, selectionAfter, drawRiskDetail, drawTotals, riskGrid, expectedOf, liveClock, clockSource, gameSituation };
