// The risk detail and the totals: the payoff grid, the selected game's card, the week's sums.
import { nick, pricesOn, $, GAMES, bdBadge, bookTag, calc, deadFor, el, extremes, fitTicketColumn, gameBets, gameKey, gameLabel, gamesInView, hedgeFor, last, later, leagueOf, legResult, legText, money, odds, parlayShares, profitOf, projectedPL, pts, resultCell, riskGame, riskKey, riskOf, setRiskGame, shareRisk, shareTerm, shortDayFmt, signedMoney, spentShares, status, ticketPL, ticketPrice, tickets, ticketsInView, timeFmt, timeZoned, updateGameArrows } from "./base.js?v=mw17x9rh";
  // extLegs: legs on this game from parlays that also span other games, as { t, l }. Their win zones are shaded over the grid
  // (they say nothing about profit, since a parlay needs its other legs too), and where every wager here wins is outlined.
  function riskGrid(g, bets, W, extLegs = [], shares = [], minHX = 0, shrink = 0, lfs = 18) {   // lfs: the figures' font size (13 over the wager ticket), for spacing them apart   // shrink takes that many px off the plot height (the Graphs popup is shorter)   // minHX widens the margin axis (the Graphs popup needs its band and blowout regions in view)
    const an = nick(g, "away"), hn = nick(g, "home");
    const c = g.line.sp, tc = g.line.tot, PL = 58, PR = W - 20, PT = 30, PB = 205 - shrink;
    const xs = [], Ts = [];
    // Zoom. Margin is centered on zero (pregame spreads rarely pass 10). The total axis is centered on where the total-based wagers on this game are
    // (the midpoint of their lines, widened to hold them all), else on the market total.
    const gk0 = gameKey(g), totLines = [];
    bets.forEach(t => { if (t.parlay) t.legs.forEach(l => { if (l.key === gk0 && l.type === "Total") totLines.push(l.line); }); else if (t.type === "Total") totLines.push(t.line); });
    extLegs.forEach(({ l }) => { if (l.type === "Total") totLines.push(l.line); });
    shares.forEach(q => q.t.legs.forEach(l => { if (l.key === gk0 && l.type === "Total") totLines.push(l.line); }));
    const tcv = totLines.length ? (Math.min(...totLines) + Math.max(...totLines)) / 2 : tc, totSpan = totLines.length ? Math.max(...totLines) - Math.min(...totLines) : 0;
    const HALF = Math.max(10.5, totSpan / 2 + 3), HX =Math.max(12.5, Math.ceil(Math.abs(c)) + 2.5, minHX);
    for (let v = Math.ceil(-HX); v <= HX; v++) xs.push(v);
    for (let v = Math.ceil(tcv - HALF); v <= tcv + HALF; v++) Ts.push(v);
    // The axis is the favorite's margin of victory, the favorite on the right: when the visitor is favored (negative visitor spread)
    // the home-minus-visitor margin runs backwards. F converts between the two. Ticks and labels read as the favorite's margin.
    const F = c < 0 ? -1 : 1, favSide = F > 0 ? "home" : "away", dogSide = F > 0 ? "away" : "home";
    const X = v => PL + (F * v + HX) / (2 * HX) * (PR - PL), Y = v => PB - (v - (tcv - HALF)) / (2 * HALF) * (PB - PT);
    // Left edge and width of the columns for margins a..b (the axis may run backwards).
    const XR = (a, b) => { const p = X(a - .5), q = X(b + .5); return [Math.min(p, q), Math.abs(q - p)]; };
    // The graph paints the straight and same-game bets plus each multi-game parlay's share of this game (its other legs assumed to win).
    const plAt = (x, T) => bets.reduce((s, t) => s + ticketPL(t, an, x, T), 0) + (shares.length ? shareTerm(g, shares, x, T) : 0);
    const round = v => Math.round(v * 100) / 100;
    const feasible = (x, T) => T >= Math.abs(x);
    // Values on the visible grid (null where the score is impossible).
    const val = Ts.map(T => xs.map(x => feasible(x, T) ? round(plAt(x, T)) : null));
    // Extremes over every possible score, not just the visible window.
    const ex = extremes(g, bets, shares);
    const maxAbs = Math.max(...val.flat().map(v => Math.abs(v || 0)), 1);
    // Connected regions of equal value, from any grid of keys (null = impossible score).
    const flood = (m, m2 = null) => {   // m2: a second grid whose value must match too (the "other legs lose" figure)
      const seen = Ts.map(() => xs.map(() => false)), out = [];
      Ts.forEach((_, ti) => xs.forEach((_, xi) => {
        if (seen[ti][xi] || m[ti][xi] === null) return;
        const v = m[ti][xi], v2 = m2 ? m2[ti][xi] : null, comp = { v, v2, n: 0, sx: 0, sT: 0, x0: 1e9, x1: -1e9, T0: 1e9, T1: -1e9, cells: [] }, stack = [[ti, xi]];
        seen[ti][xi] = true;
        while (stack.length) {
          const [a, b] = stack.pop(), x = xs[b], T = Ts[a];
          comp.cells.push([b, a]);
          comp.n++; comp.sx += x; comp.sT += T;
          comp.x0 = Math.min(comp.x0, x); comp.x1 = Math.max(comp.x1, x); comp.T0 = Math.min(comp.T0, T); comp.T1 = Math.max(comp.T1, T);
          [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]].forEach(([p, q]) => {
            if (p < 0 || q < 0 || p >= Ts.length || q >= xs.length || seen[p][q] || m[p][q] !== v || (m2 && m2[p][q] !== v2) || Math.sign(xs[q]) !== Math.sign(x)) return;   // results never merge across a margin of 0: a tie is graded differently
            seen[p][q] = true; stack.push([p, q]);
          });
        }
        out.push(comp);
      }));
      return out;
    };
    // With multi-game parlays on this game, a second figure: the result if their other legs lose (each parlay is then a lost stake share,
    // whatever happens here). Regions also split where that figure changes.
    const shareLoss = shares.reduce((a, q) => a - riskOf(q.t, q.t.odds) * q.f, 0);
    const val2 = shares.length ? Ts.map(T => xs.map(x => feasible(x, T) ? round(bets.reduce((a, t) => a + ticketPL(t, an, x, T), 0) + shareLoss) : null)) : null;
    const comps = flood(val, val2);
    // Where every wager touching this game wins at once, counting the legs of parlays that also span other games.
    const ticketWins = (t, x, T) => (t.parlay ? t.legs : [{ type: t.type, side: t.side, line: t.line }]).every(l => legResult(l, an, x, T) === 1);
    // With a single wager there is nothing to "win together", so no ALL WIN region is worked out.
    const manyBets = bets.length + new Set(extLegs.map(e => e.t)).size > 1;
    const allWin = extLegs.length && manyBets ? Ts.map(T => xs.map(x => feasible(x, T) ? bets.every(t => ticketWins(t, x, T)) && extLegs.every(e => legResult(e.l, an, x, T) === 1) : null)) : null;
    const winComps = allWin ? flood(allWin).filter(k => k.v) : [];
    // Plain-words description of a region from its bounding box.
    const rng = (lo, hi) => hi >= 60 ? lo + "+" : lo === hi ? String(lo) : lo + "–" + hi;
    const describe = k => {
      const a = k.x0 <= xs[0] ? -60 : k.x0, b = k.x1 >= xs[xs.length - 1] ? 60 : k.x1, p = [];
      if (a < 0) p.push(`${an} by ${rng(-Math.min(b, -1), -a)}`);
      if (a <= 0 && b >= 0) p.push("tie");
      if (b > 0) p.push(`${hn} by ${rng(Math.max(a, 1), b)}`);
      const minAbs = k.x0 <= 0 && k.x1 >= 0 ? 0 : Math.min(Math.abs(k.x0), Math.abs(k.x1));
      const low = k.T0 <= Math.max(Ts[0], minAbs), high = k.T1 >= Ts[Ts.length - 1];
      const tot = low && high ? "" : low ? `total ${k.T1} or fewer` : high ? `total over ${k.T0 - 1}` : `total ${k.T0}–${k.T1}`;
      return [p.join(", "), tot].filter(Boolean).join(" · ");
    };
    comps.forEach(k => { k.label = describe(k); });
    // The best result inside each all-win region, counting the parlays' winnings on their legs here (their other legs assumed to win).
    winComps.forEach(k => {
      k.label = describe(k); k.best = -Infinity;
      Ts.forEach((T, ti) => xs.forEach((x, xi) => {
        if (allWin[ti][xi] && x >= k.x0 && x <= k.x1 && T >= k.T0 && T <= k.T1) k.best = Math.max(k.best, val[ti][xi]);
      }));
    });

    const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
    const zone$ = v => { const r = Math.round(v); return (r < 0 ? "−" : r > 0 ? "+" : "") + "$" + Math.abs(r).toLocaleString("en-US"); };
    const n1 = v => v.toFixed(1);
    let s = `<svg class="axis" viewBox="0 0 ${W} ${PB + 30}" role="img" aria-label="Profit and loss by final margin and total points, centered on ${an} ${sgn(c)} and a total of ${tc}">`;
    // Cells, merged into horizontal runs of equal value and then stacked vertically, so no seams show between rows.
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
    const rowBox = T => [Y(T + .5), Y(T - .5) - Y(T + .5)];
    const cellRows = Ts.map((T, ti) => {
      const runs = [], [y, h] = rowBox(T);
      let b = 0;
      while (b < xs.length) {
        let e = b; while (xs[b] !== 0 && e + 1 < xs.length && xs[e + 1] !== 0 && val[ti][e + 1] === val[ti][b]) e++;
        if (xs[b] === 0) { b = e + 1; continue; }   // the margin-0 column is left unpainted, so it shows the graph's background
        const v = val[ti][b], [x, w] = XR(xs[b], xs[e]);
        if (v === null) runs.push({ k: "no", x, w, y, h, cls: "ax-no" });
        else if (v !== 0) runs.push({ k: v, x, w, y, h, cls: v > 0 ? "ax-gp" : "ax-gn", op: (.26 + .6 * Math.abs(v) / maxAbs).toFixed(2) });
        b = e + 1;
      }
      return runs;
    });
    stack(cellRows).forEach(r => { s += `<rect x="${n1(r.x)}" y="${n1(r.y)}" width="${n1(r.w)}" height="${n1(r.h)}" class="${r.cls}"${r.op ? ` fill-opacity="${r.op}"` : ""}/>`; });
    s += `<path d="M${PL} ${PT}V${PB}M${PR} ${PT}V${PB}" class="ax-frame"/>`;   // only the left and right edges: no rules along the top and bottom
    winComps.forEach(k => {
      const [xl, wl] = XR(k.x0, k.x1), x0 = Math.max(PL, xl), x1 = Math.min(PR, xl + wl), y0 = Math.max(PT, Y(k.T1 + .5)), y1 = Math.min(PB, Y(k.T0 - .5));
      s += `<rect x="${n1(x0)}" y="${n1(y0)}" width="${n1(x1 - x0)}" height="${n1(y1 - y0)}" class="ax-all"/><text x="${n1(x0 + 6)}" y="${n1(y0 + 15)}" class="ax-alltag">ALL WIN ${zone$(k.best)}</text>`;
    });
    // The game's total, on the vertical axis in bright white: the saved pre-game total, or the live total while the game is under way. It replaces
    // any ordinary tick label that would sit on top of it, and the dashed total line is drawn at the same height.
    // (when the total is outside the visible range, because the axis is centered on the total wagers or the live total has moved, a caret points toward it and its dashed line is not drawn)
    const isLive = !!(g.live && status(g)[1] === "live"), totNow = isLive ? g.live.tot : tc, totShown = totNow >= tcv - HALF && totNow <= tcv + HALF, totUp = totNow > tcv + HALF, Yc = totShown ? Y(totNow) : (totUp ? PT + 7 : PB - 7);   // off the graph: a caret at the edge it moved past
    for (let v = Math.ceil((tcv - HALF) / 5) * 5; v <= tcv + HALF; v += 5) {
      s += `<line x1="${PL - 5}" x2="${PL}" y1="${n1(Y(v))}" y2="${n1(Y(v))}" class="ax-tick"/>`;
      if (Math.abs(Y(v) - Yc) >= 13) s += `<text x="${PL - 9}" y="${n1(Y(v) + 4)}" text-anchor="end" class="ax-lbl">${v}</text>`;
    }
    if (totShown) s += `<line x1="${PL - 6}" x2="${PL}" y1="${n1(Yc)}" y2="${n1(Yc)}" class="ax-tottick"/><text x="${PL - 9}" y="${n1(Yc + 5)}" text-anchor="end" class="ax-tot">${Number(totNow).toFixed(1)}</text>`;
    else s += `<polygon points="${totUp ? `${PL - 11},${n1(Yc - 5)} ${PL - 16},${n1(Yc + 3)} ${PL - 6},${n1(Yc + 3)}` : `${PL - 11},${n1(Yc + 5)} ${PL - 16},${n1(Yc - 3)} ${PL - 6},${n1(Yc - 3)}`}" class="ax-tottri"/><text x="${PL - 21}" y="${n1(Yc + 5)}" text-anchor="end" class="ax-tot">${Number(totNow).toFixed(1)}</text>`;
    // The point spread (live while the game is under way) on the x-axis in bright white, at the spread line: the favorite's margin it stands for, signed only
    // when the pre-game favorite has become the underdog. It replaces any margin label that would sit on top of it.
    const spNow = isLive ? g.live.sp : c, Xc = Math.max(PL, Math.min(PR, X(spNow))), spM = F * spNow, spTxt = (spM < 0 ? "−" : "") + Math.abs(spM).toFixed(1), spHalf = spTxt.length * 4.2 + 8;
    for (let v = Math.ceil(-HX); v <= HX; v++) {
      const major = v % 3 === 0;
      s += `<line x1="${n1(X(v))}" x2="${n1(X(v))}" y1="${PB}" y2="${PB + (major ? 8 : 4)}" class="ax-tick"/>`;
      if (Math.abs(X(v) - Xc) >= spHalf + 5) s += `<text x="${n1(X(v))}" y="${PB + 22}" text-anchor="middle" class="ax-lbl">${Math.abs(v)}</text>`;   // labels only: no signs, the axis reads as the margin either way
    }
    s += `<text x="${n1(Xc)}" y="${PB + 22}" text-anchor="middle" class="ax-tot">${spTxt}</text>`;
    // The margin-0 column carries no figures.
    // Each figure starts at its region's center; figures that would crowd each other are pushed apart, up or down, and kept inside the plot.
    const labs = comps.filter(k => k.v !== 0 && k.n >= 14 && !(k.x0 === 0 && k.x1 === 0)).map(k => {
      const two = k.v2 != null && Math.abs(k.v2 - k.v) >= 0.5, t1 = zone$(k.v), t2 = two ? zone$(k.v2) : "";
      return { k, two, cx: X(k.sx / k.n), cy: Y(k.sT / k.n), w: Math.max(t1.length * lfs * .62, t2.length * lfs * .5), h: two ? lfs + 13 : lfs + 2 };
    });
    for (let it = 0; it < 60; it++) {
      let moved = false;
      for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) {
        const a = labs[i], b = labs[j], dx = (a.w + b.w) / 2 + 8 - Math.abs(a.cx - b.cx), dy = (a.h + b.h) / 2 + 5 - Math.abs(a.cy - b.cy);
        if (dx <= 0 || dy <= 0) continue;
        moved = true;
        const m = dy / 2 * (a.cy <= b.cy ? 1 : -1); a.cy -= m; b.cy += m;   // figures only move up or down, never sideways
      }
      labs.forEach(a => { a.cx = Math.min(PR - a.w / 2 - 3, Math.max(PL + a.w / 2 + 3, a.cx)); a.cy = Math.min(PB - a.h / 2 - 2, Math.max(PT + a.h / 2 + 2, a.cy)); });
      if (!moved) break;
    }
    labs.forEach(({ k, two, cx, cy }) => {
      s += `<text x="${n1(cx)}" y="${n1(cy + (two ? -1 : 5))}" text-anchor="middle" class="ax-cell ${k.v > 0 ? "ax-pos" : "ax-neg"}">${zone$(k.v)}</text>`;
      if (two) s += `<text x="${n1(cx)}" y="${n1(cy + 14)}" text-anchor="middle" class="ax-cell2 ${k.v2 > 0 ? "ax-pos" : "ax-neg"}">${zone$(k.v2)}</text>`;
    });
    // (the spread line, at Xc, follows the live spread while the game is under way; the graph's own orientation stays on the pre-game favorite)
    s += (totShown ? `<line x1="${PL}" x2="${PR}" y1="${n1(Yc)}" y2="${n1(Yc)}" class="ax-cross"/>` : "") + `<line x1="${n1(Xc)}" x2="${n1(Xc)}" y1="${PT - 6}" y2="${PB + 8}" class="ax-center"/>`;
    s += `</svg>`;   // (no axis titles: the axes explain themselves)
    const w = document.createElement("div");
    w.className = "rk-axis";
    w.innerHTML = s;
    // Team badges under the axis ends: the underdog winning by more is to the left, the favorite to the right.
    const badges = el("div", "rk-sides");
    // Under each badge: the sportsbooks holding a bet on that team (spread, moneyline, or a parlay leg), not totals.
    const gk = gameKey(g);
    // book -> {cash, bonus} wagered there on this team in this game (a parlay leg counts stake / legs)
    const booksOn = team => {
      const m = new Map(), add = (t, amt) => { const e = m.get(t.book) || { cash: 0, bonus: 0 }; e[t.bonus ? "bonus" : "cash"] += amt; m.set(t.book, e); };
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
        const item = el("span", "rk-bk"); item.append(bookTag(b, false, true));
        item.append(el("span", "rk-bkamt", [e.cash ? money(e.cash) : "", e.bonus ? "B" + money(e.bonus) : ""].filter(Boolean).join(" + ")));   // the amount wagered at that book on this team
        list.append(item);
      });
      box.append(row, list);
      return box;
    };
    const leftRow = el("span", "rk-side-row"), rightRow = el("span", "rk-side-row");
    leftRow.append(bdBadge(g, dogSide));
    rightRow.append(bdBadge(g, favSide));
    const left = sideBox(dogSide, leftRow), right = sideBox(favSide, rightRow);
    left.classList.add("end");
    // The inside edges line up with the graph's ticks one point either side of 0: the underdog's badge ends at the tick one point toward the
    // underdog, the favorite's begins at the tick one point toward the favorite (x of the favorite's margin m is X(F * m)).
    const aL = X(-F) / W * 100, aR = X(F) / W * 100;
    badges.style.gridTemplateColumns = `${aL}% ${aR - aL}% 1fr`; badges.style.columnGap = "0";
    right.style.gridColumn = "3";
    badges.style.setProperty("--pl", (PL / W * 100) + "%"); badges.style.setProperty("--pr", ((W - PR) / W * 100) + "%");   // the plot's left and right edges, for the badges at the axis ends (risk detail)
    badges.append(left, right);
    w.append(badges);
    return { el: w, comps: comps.sort((a, b) => a.v - b.v), winComps, maxRisk: ex.maxRisk, maxWin: ex.maxWin, pc: (PL + PR) / 2 / W * 100 };
  }
  // show / clear the selection: the game's risk detail takes the wager ticket's place (same height), the totals and saved tickets filter
  let keptSizes = [];
  function selectionBefore() {
    const col = document.querySelector(".col.left"), rc = $("riskCard"), tk = $("ticket");
    if (riskGame && !col.classList.contains("has-sel")) {   // the ticket's height and the room under it, kept by the graph card
      const done = col.classList.contains("all-final");
      if (done) col.classList.remove("all-final");   // a final week hides the ticket: its pane is still the ticket's size, at the bottom of the column
      col.style.setProperty("--tk-h", (tk.offsetHeight || 411) + "px");
      if (done) col.classList.add("all-final");
      col.style.setProperty("--tk-slack", done ? "0px" : Math.max(0, Math.round(col.getBoundingClientRect().bottom - tk.getBoundingClientRect().bottom)) + "px");
    }
    col.classList.toggle("has-sel", !!riskGame);
    rc.classList.toggle("rk-off", !riskGame); rc.classList.toggle("rk-over", !!riskGame); rc.setAttribute("aria-hidden", String(!riskGame));
    // selecting never resizes the game cards: keep the card / games-area sizes the page had and put them back after the redraw
    keptSizes = ["--games-h", "--card-h"].map(v => document.documentElement.style.getPropertyValue(v));
  }
  function selectionAfter() {
    ["--games-h", "--card-h"].forEach((v, i) => { if (keptSizes[i]) document.documentElement.style.setProperty(v, keptSizes[i]); });
    fitTicketColumn(); updateGameArrows();
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && riskGame && $("gameList").hidden && $("bookList").hidden) setRiskGame(null); });
  function renderRisk() {
    const box = $("riskCard");
    box.replaceChildren();
    const g = GAMES.find(x => gameKey(x) === riskKey);
    box.classList.toggle("full", !!g);   // a fixed-size card; the wager list scrolls inside it
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
    const extLegs = tickets.filter(t => t.parlay && !t.legs.every(l => l.key === gameKey(g)) && !deadFor(g, t)).flatMap(t => t.legs.filter(l => l.key === gameKey(g)).map(l => ({ t, l })));
    const grid = riskGrid(g, bets, Math.max(560, box.clientWidth - 34), extLegs, shares, leagueOf(g).graphMinMargin, box.classList.contains("rk-over") ? 78 : 0, box.classList.contains("rk-over") ? 13 : 18);   // over the wager ticket the plot is shorter
    const expPL = bets.reduce((s, t) => s + projectedPL(t), 0) + shares.reduce((s, q) => s + q.f * projectedPL(q.t), 0);
    head.append(el("small", null, `${shortDayFmt.format(new Date(g.t))} · ${timeZoned(new Date(g.t))}`));

    const top = el("div", "rk-top");
    const title = el("span", "rk-game");
    title.append(bdBadge(g, "away", `${nick(g, "away").toUpperCase()}${g.line.noSp ? "" : " " + pts(g.line.sp)}`), el("span", "rk-at", " @ "), bdBadge(g, "home"));
    title.style.setProperty("--pc", grid.pc + "%");   // the plot's center (margin 0), where the "@" goes
    top.append(title);
    const stats = el("div", "rk-stats");
    [["Wagered", money(wagered), null], ...(bonus ? [["Bonus", "B" + money(bonus), null]] : []), ["Max risk", money(grid.maxRisk + shareRisk(shares)), "hi"], ["Max win", signedMoney(grid.maxWin), "win"], ["Expected P/L", pricesOn() ? signedMoney(expPL) : "—", (!pricesOn() ? "dim" : expPL > 0.5 ? "pos" : expPL < -0.5 ? "neg" : "dim") + (g.live && status(g)[1] === "live" ? " livepl" : "")]].forEach(([l, v, c]) => {
      const s = el("div", "stat"); s.append(el("span", "lbl", l), el("b", c, v)); stats.append(s);
    });
    const overlay = box.classList.contains("rk-over");
    if (!overlay) top.append(stats);   // over the wager ticket the totals sit at the bottom of the card, under the graph


    const ul = el("ul", "rk-list");
    const pars = tickets.filter(t => t.parlay && t.legs.some(l => l.key === gameKey(g)));
    if (!mine.length && !pars.length) ul.append(el("li", "empty", "No wagers on this game yet."));
    pars.forEach(t => {
      const li = el("li"), win = profitOf(t.amount, t.odds), payout = t.bonus ? win : t.amount + win;
      const what = el("span", "rk-what");
      what.append(bookTag(t.book, false, true), document.createTextNode(` · ${t.legs.length}-leg parlay @ ${t.kalshi ? t.kalshi.cents + "¢" : odds(t.odds)}${t.bonus ? " · bonus" : ""}`));
      const legBox = el("small", "rk-legs");   // one leg per line, then the stake per leg
      t.legs.forEach(l => legBox.append(el("span", "rk-leg", legText(l))));
      legBox.append(el("span", "rk-leg per", `${t.bonus ? "B" : ""}${money(t.amount / t.legs.length)} per leg`));
      what.append(legBox);
      const nums = el("span", "rk-nums");
      // The Wager column is this game's share of the parlay stake (stake / legs, times the legs on this game); the other columns are for the whole parlay.
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
      wh.append(bookTag(t.book, false, true), document.createTextNode(` · ${what}${t.bonus ? " · bonus" : ""}`));
      li.append(wh, nums);
      ul.append(li);
    });
    // Any game with positions that is not final: a suggested bet, between the sportsbooks and the totals.
    let hedgeEl = null;
    if (overlay && !g.final) {
      const h = hedgeFor(g, bets, shares);
      if (h) {
        const sg = v => el("b", v > 0.5 ? "pos" : v < -0.5 ? "neg" : "dim", signedMoney(v)), arrow = (a, b) => [sg(a), document.createTextNode(" → "), sg(b)];
        hedgeEl = el("div", "rk-hedge");
        const hb = el("div", "hb"), hr = el("div", "hr");
        hb.append(el("b", null, `Buy ${h.n} contracts: ${h.txt}`), el("span", null, ` · ${h.src} ${Math.round(h.ask * 100)}¢ · ${money(h.cost)}`), el("small", null, `${h.alt != null && h.alt < h.ask - 0.005 ? ` · Polymarket ${Math.round(h.alt * 100)}¢` : ""} · prices ${timeFmt.format(new Date(h.at))}`));
        const hx = later.execControls(h, gameKey(g));
        const pct = v => `${Math.round(v * 100)}%`;
        hr.append(document.createTextNode("Worst "), ...arrow(h.worstBefore, h.worstAfter), document.createTextNode(" · best "), ...arrow(h.bestBefore, h.bestAfter));
        hedgeEl.append(el("div", "hh", h.kind === "lock" ? "Locks in a profit" : "Suggested bet"), hb, hr, hx);
      }
    }
    const armEl = overlay && !g.final && (bets.length || shares.length) ? later.hedgeControls() : null;   // the hedge suggestion's settings
    box.classList.toggle("has-tune", !!armEl);
    box.append(head, top, grid.el, ...(hedgeEl ? [hedgeEl] : []), ...(armEl ? [armEl] : []), ...(overlay ? [stats] : []), ul);
    if (overlay) { const x = el("button", "bd-close", "×"); x.type = "button"; x.title = "Close"; x.setAttribute("aria-label", "Close risk detail"); x.addEventListener("click", () => setRiskGame(null)); box.append(x); }
  }

  // Games are independent, so the worst and best cases across all games are the sums of each game's.
  function renderTotals() {
    const games = gamesInView(), shown = ticketsInView();
    const { wagered, bonusTotal, risk, win, pl: plSum, plAny, expected: expAll, theo } = calc.slateTotals(games, shown);
    const plCls = !plAny ? "dim" : "settled " + (plSum > 0.004 ? "pos" : plSum < -0.004 ? "neg" : "dim");
    const slateOver = games.length > 0 && games.every(g => g.final);   // nothing is left to expect once every game of the slate is final
    const expCls = expAll > 0.5 ? "pos" : expAll < -0.5 ? "neg" : "dim";
    const box = $("totals");
    box.replaceChildren();
    const row = el("div", "tt-stats");
    [["Wagers", money(wagered), null], ["Max risk", money(risk), "hi"], ["Max win", signedMoney(win), "win"], ["Expected P/L", pricesOn() && shown.length && !slateOver ? signedMoney(expAll) : "—", pricesOn() && shown.length && !slateOver ? expCls : "dim"], ["P/L", plAny ? signedMoney(plSum) : "—", plCls], ["Theo P/L", pricesOn() && shown.length ? signedMoney(theo) : "—", pricesOn() && shown.length ? (theo > 0.5 ? "pos" : theo < -0.5 ? "neg" : "dim") : "dim"]].forEach(([l, v, c]) => {
      const s = el("div", "stat"), b = el("b", c, v);
      if (l === "Wagers" && bonusTotal) b.append(el("span", "bsub", " + B" + money(bonusTotal)));
      s.append(el("span", "lbl", l), b); row.append(s);
    });
    box.append(row);
    $("sum").replaceChildren(later.bookReport(shown));
  }
export { selectionBefore, selectionAfter, renderRisk, renderTotals, riskGrid };
