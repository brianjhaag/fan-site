
import { riskGrid } from "./risk.js?v=mw5rq7x1";
import { DAILY_TEAMS, GAME_VENUES, TEAM_INFO, VENUE, WEEK_GAMES, ensureDailyTeams, ensureTeams } from "./espn.js?v=mw5rq7x1";
import { Fan } from "./hosts.js?v=mw5rq7x1";
import { ALL_GAMES, LG, league, isTall, nick, $, RULES, americanOf, gdBadge, changed, curWeek, decimalOf, detailGame, drawStub, el, evMoneyline, evPoints, gameBets, gameKey, gameLabel, graphGames, last, later, leagueOf, marginModel, odds, outcomes, pairFlagged, pairStakes, parlayShares, profitOf, pts, shortDayFmt, status, teamLook, ticketPL, timeZoned, scoutOn, view } from "./base.js?v=mw5rq7x1";
import { ABBR, HELM_PAD, TEAM, abbr, lumOf, slateTitleOf } from "./leagues.js?v=mw5rq7x1";
  Object.assign(later, { drawGameDetail });
  
  
  
  
  const SVG_NS = "http://www.w3.org/2000/svg";
  const mkSvg = (w, h, label) => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.setAttribute("width", w); svg.setAttribute("height", h); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", label);
    const add = (tag, attrs, text, parent = svg) => { const n = document.createElementNS(SVG_NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); if (text != null) n.textContent = text; parent.append(n); return n; };
    return { svg, add };
  };
  const cell = (title, svg, wide) => {
    const c = el("div", "graphs-cell" + (wide ? " wide" : ""));
    if (title) c.append(el("div", "cap", title));
    c.append(svg);
    return c;
  };


  
  
  const helmSizes = new Map();
  function helmetBox(n, h) {
    if (!helmSizes.has(n)) {
      const uri = (TEAM[n] && TEAM[n].art) || "", b = atob(uri.slice(uri.indexOf(",") + 1, uri.indexOf(",") + 45));
      const read32 = o => ((b.charCodeAt(o) << 24) | (b.charCodeAt(o + 1) << 16) | (b.charCodeAt(o + 2) << 8) | b.charCodeAt(o + 3)) >>> 0;
      helmSizes.set(n, uri ? [read32(16), read32(20)] : [104, 80]);
    }
    const [iw, ih] = helmSizes.get(n), pad = (HELM_PAD[n] || 0) / 100 * iw;
    return { iw, ih, pad, w: (iw - pad) * h / ih };
  }
  function helmetSvg(add, parent, n, x, y, h) {
    if (!(TEAM[n] && TEAM[n].art)) return;
    const { iw, ih, pad, w } = helmetBox(n, h);
    const box = add("svg", { x, y, width: w, height: h, viewBox: `${pad} 0 ${iw - pad} ${ih}`, overflow: "visible" }, null, parent);
    add("image", { href: TEAM[n].art, x: 0, y: 0, width: iw, height: ih }, null, box);
    box.style.pointerEvents = "none";
  }
  function drawGraphs(again = true) {
    const box = $("graphs"), games = graphGames();
    const available = box.clientWidth;   
    box.replaceChildren();
    const pts8 = games.flatMap(g => [0, 1].map(i => ({ g, side: i ? "home" : "away", ml: g.line.ml[i], sp: i ? -g.line.sp : g.line.sp })));
    const xs = pts8.map(p => p.ml), ys = pts8.map(p => p.sp);
    
    const lg = ml => Math.log(decimalOf(ml));
    
    
    
    
    const flat = !LG().keyNumbers;
    const sigma = (() => {
      const sps = [...new Set(pts8.map(p => p.sp))];   
      const ys = sps.map(sp => { const q = pts8.filter(p => p.sp === sp); return [sp, q.length, q.reduce((t, p) => t + lg(p.ml), 0) / q.length, q.reduce((t, p) => t + lg(p.ml) ** 2, 0)]; });
      let best = null;
      for (let sg = 8; sg <= 22.001; sg += 0.25) {
        const win = marginModel(sg, flat);
        const sse = ys.reduce((t, [sp, n, mean, sq]) => { const f = -Math.log(win(-sp)); return t + sq - 2 * f * n * mean + n * f * f; }, 0);
        if (!best || sse < best[1]) best = [sg, sse];
      }
      return best[0];
    })();
    const winProb = marginModel(sigma, flat);
    const fit = sp => -Math.log(winProb(-sp));   
    
    
    const pointsOf = l => { const d = Math.exp(l); return d >= 2 ? (d - 2) * 100 : 100 - 100 / (d - 1); };
    const off = p => pointsOf(fit(p.sp)) - pointsOf(lg(p.ml));
    
    const impliedML = sp => { const d = Math.exp(fit(sp)); return Math.round(d >= 2 ? (d - 1) * 100 : -100 / (d - 1)); };
    const offText = v => { const r = Math.round(v); return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r); };
    
    
    
    const spreadPrice = p => p.g.line.spj[p.side === "home" ? 1 : 0];
    const evML = p => evMoneyline(winProb, p);
    const evPts = p => evPoints(winProb, p);
    const showsML = p => evML(p) >= evPts(p);
    
    
    
    
    const hot = new Set(games.filter(g => {
      const two = pts8.filter(p => p.g === g), fav = two.find(p => p.sp < 0), dog = two.find(p => p.sp > 0);
      if (!fav || !dog) return false;
      return pairFlagged(winProb, fav, dog);
    }));

    const W = Math.max(560, available), gap = 12, pad = 0;   
    const S = Math.max(2, Math.ceil((Math.max(...ys.map(Math.abs)) + 1) / 2) * 2);   

    
    
    const portraitHeight = isTall() ? window.innerHeight - document.querySelector(".strip.bottom").offsetHeight - 36 - 8 - (box.getBoundingClientRect().top + window.scrollY) : 0;
    const Wg = Math.max(260, Math.floor((W - gap) / 2) - pad), Hg = Math.max(768, Math.floor(portraitHeight)), m = { l: 84, r: 80, t: 24, b: 104 };
    function graph(list, dir, label) {
      const { svg, add } = mkSvg(Wg, Hg, label);
      const lgs = list.map(p => lg(p.ml)), lo = Math.min(...lgs), hi = Math.max(...lgs), padY = Math.max(0.05, (hi - lo) * 0.07);
      const x0 = lo - padY, x1 = hi + padY;
      const plotLeft = m.l, plotRight = Wg - m.r;
      const SX = v => dir > 0 ? plotLeft + (S - v) / S * (plotRight - plotLeft) : plotLeft + (-v) / S * (plotRight - plotLeft);
      
      const LY = l => m.t + (dir > 0 ? (x1 - l) : (l - x0)) / (x1 - x0) * (Hg - m.t - m.b), MY = v => LY(lg(v));
      let lastTick = null;
      [-2000, -1500, -1000, -800, -600, -500, -400, -300, -250, -200, -150, -120, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1500, 2000]   
        .filter(v => lg(v) >= x0 && lg(v) <= x1)
        .filter(v => (lastTick === null || Math.abs(MY(v) - lastTick) >= 32) && (lastTick = MY(v), true))   
        .forEach(v => { add("line", { x1: plotLeft, x2: plotRight, y1: MY(v), y2: MY(v), class: "grid" }); add("text", { x: plotLeft - 10, y: MY(v), "text-anchor": "end", "dominant-baseline": "central" }, odds(v)); });
      
      
      for (let i = 0; i <= S; i++) {
        const v = dir * i;
        add("line", { x1: SX(v), x2: SX(v), y1: m.t, y2: Hg - m.b, class: i === 0 ? "zero" : "grid" });
        add("text", { x: SX(v), y: Hg - m.b + 18, "text-anchor": "middle" }, i === 0 ? "0" : pts(v));
      }
      for (let i = 0; i <= S; i += 0.5) {
        const v = dir * i;
        add("line", { x1: SX(v), x2: SX(v), y1: Hg - m.b, y2: Hg - m.b + 5, class: "tick" });
        if (i === 0) continue;
        add("text", { x: SX(v), y: Hg - m.b + (Number.isInteger(i) ? 38 : 56), "text-anchor": "middle", class: "implied" }, odds(impliedML(v)));
      }
      
      if (dir < 0 && lg(100) >= x0 && lg(100) <= x1) {   
        add("line", { x1: plotLeft, x2: plotRight, y1: MY(100), y2: MY(100), class: "zero" });
        if (dir < 0) add("text", { x: plotRight, y: MY(100) - 6, "text-anchor": "end", class: "ax" }, "Even money");   
      }
      
      
      
      
      const CW = 132, CH = 36, GAP = 8, HH = CH + 14, HO = 9, NUDGE = 14, placed = [];   
      const spots = [];
      for (let k = -250; k <= 250; k++) spots.push(k * 6);
      spots.sort((a, b) => Math.abs(a) - Math.abs(b));
      const free = (cx, cy) => placed.every(q => Math.abs(q[0] - cx) >= CW + GAP || Math.abs(q[1] - cy) >= CH + GAP);
      const lines = add("g", {}), marks = add("g", {});
      list.slice().sort((a, b) => a.ml - b.ml || a.sp - b.sp).forEach(p => {
        const k = teamLook(p.g, p.side), name = nick(p.g, p.side), tx = SX(p.sp), ty = MY(p.ml);
        const hw = helmetBox(name, HH).w;   
        const lo = plotLeft + CW / 2 + HO, hi = plotRight - CW / 2;
        const bx = Math.max(lo, Math.min(hi, tx + (showsML(p) ? -NUDGE : NUDGE)));   
        const dy = spots.find(oy => free(bx, ty + oy)) || 0;
        const cx = bx, cy = ty + dy;
        placed.push([cx, cy]);
        if (Math.abs(cx - tx) > 2 || Math.abs(cy - ty) > 2) {
          add("line", { x1: tx, y1: ty, x2: cx, y2: cy, stroke: k.outline || k.bg, "stroke-width": 1, opacity: .7 }, null, lines);
          add("circle", { cx: tx, cy: ty, r: 3, fill: k.bg, stroke: k.outline || k.fg, "stroke-width": 1 }, null, lines);
        }
        const markGroup = add("g", { class: "mk", "data-game": gameLabel(p.g), "data-side": p.side }, null, marks);
        if (hot.has(p.g)) add("rect", { x: cx - CW / 2 - 4, y: cy - CH / 2 - 4, width: CW + 8, height: CH + 8, class: "flag" }, null, markGroup);
        add("rect", { x: cx - CW / 2, y: cy - CH / 2, width: CW, height: CH, rx: 4, fill: k.bg }, null, markGroup);   
        const inside = hw - HO, textCenterX = cx + inside / 2;   
        add("text", { x: textCenterX, y: cy - 7, style: `fill:${k.fg}` }, abbr(name), markGroup);
        
        const second = showsML(p) ? odds(p.ml) : pts(p.sp).replace(/\d+(\.\d+)?/, v => Number(v).toFixed(1)) + " " + odds(spreadPrice(p));
        add("text", { x: textCenterX, y: cy + 9, class: "off", style: `fill:${k.fg}` }, second, markGroup);
        helmetSvg(add, markGroup, name, cx - CW / 2 - HO, cy - HH / 2, HH);
      });
      return svg;
    }
    const dogs = pts8.filter(p => p.sp > 0), favs = pts8.filter(p => p.sp <= 0);
    const row = el("div", "graphs-row");
    row.append(cell(null, graph(dogs, 1, `Scatter of ${slateTitleOf(curWeek)} underdogs: point spread against moneyline`)),
      cell(null, graph(favs, -1, `Scatter of ${slateTitleOf(curWeek)} favorites: point spread against moneyline`)));

    box.append(row);
    
    
    const link = document.createElementNS(SVG_NS, "svg"); link.setAttribute("class", "graphs-link"); box.append(link);
    {
      const hotNames = new Set([...hot].map(gameLabel)), br = box.getBoundingClientRect();
      const mk = (tag, attrs) => { const n = document.createElementNS(SVG_NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); link.append(n); };
      const rc = n => { const r = n.querySelector("rect:not(.flag)").getBoundingClientRect(); return { l: r.left - br.left, r: r.right - br.left, y: (r.top + r.bottom) / 2 - br.top }; };
      hotNames.forEach(name => {
        const two = [...box.querySelectorAll("g.mk")].filter(g => g.dataset.game === name);
        if (two.length !== 2) return;
        const [a, b] = two.map(rc), [L, R] = a.l < b.l ? [a, b] : [b, a];   
        mk("line", { x1: L.r, y1: L.y, x2: R.l, y2: R.y, stroke: "#ffb52e", "stroke-width": 2, opacity: .95 });
        mk("circle", { cx: L.r, cy: L.y, r: 3.5, fill: "#ffb52e" }); mk("circle", { cx: R.l, cy: R.y, r: 3.5, fill: "#ffb52e" });
      });
    }
    
    
    
    box._pairs = new Map([...hot].map(g => {
      const two = pts8.filter(p => p.g === g), fav = two.find(p => p.sp < 0), dog = two.find(p => p.sp > 0);
      return [gameLabel(g), { g, fav, dog, dogPrice: spreadPrice(dog) }];
    }));
    if (!box.dataset.pairWired) {
      box.dataset.pairWired = "1";
      let pop = null;
      const hide = () => { if (pop) { pop.remove(); pop = null; } };
      const place = e => {
        if (!pop) return;
        const r = pop.getBoundingClientRect();
        const left = e.clientX + 24 + r.width > innerWidth - 8 ? e.clientX - 24 - r.width : e.clientX + 24;
        pop.style.left = Math.max(8, left) + "px";
        pop.style.top = Math.max(8, Math.min(e.clientY - r.height / 2, innerHeight - r.height - 8)) + "px";
      };
      box.addEventListener("mouseleave", hide);
      box.addEventListener("mousemove", place);
      box.addEventListener("mouseover", e => {
        const chip = e.target.closest && e.target.closest("g.mk"), info = chip && box._pairs.get(chip.dataset.game);
        if (!info) { hide(); return; }
        if (pop && pop.dataset.game === chip.dataset.game) return;
        hide();
        const { g, fav, dog, dogPrice } = info, base = RULES.userSet.pairBase, key = gameKey(g);
        pop = el("div", "flagged-pair");
        pop.dataset.game = chip.dataset.game;
        const dogPts = pts(dog.sp).replace(/\d+(\.\d+)?/, v => Number(v).toFixed(1));
        const S = Math.abs(dog.sp), start = Math.floor(S) + 1, favName = nick(g, fav.side), dogName = nick(g, dog.side);
        const K2 = Math.floor(S) + 4.5, K3 = 3.5, rung2Floor = Math.floor(K2);   
        const F = fav.side === "home" ? 1 : -1, an = nick(g, "away"), T0 = Math.round(g.line.tot);   
        const usd = v => "$" + Math.round(v).toLocaleString("en-US"), sgn = v => (v < 0 ? "−" : "+") + usd(Math.abs(v));
        
        
        
        const bets0 = gameBets(g), parlays0 = parlayShares(g);
        const atX = new Map(); outcomes(g, bets0).forEach(({ x, T }) => atX.set(x, [...(atX.get(x) || []), T]));
        const profitAt = M => { const x = F * M; return Math.min(...(atX.get(x) || [Math.max(T0, Math.abs(x))]).map(T => bets0.reduce((s, t) => s + ticketPL(t, an, x, T), 0))); };
        const worstOf = (lo, hi) => { let w = Infinity; for (let M = lo; M <= hi; M++) w = Math.min(w, profitAt(M)); return w; };
        
        
        
        
        
        
        
        
        
        const perDollarMl = profitOf(1, fav.ml), rD = profitOf(1, dogPrice);
        const bd = g.band && g.band.fav === fav.side && g.band.K === S ? g.band : null;
        const model = (a, b) => winProb.band(-fav.sp, a, b);
        const c2 = bd ? bd.c2 : Math.min(0.95, (1 - model(rung2Floor + 1, 70)) * 1.02), c3 = bd && bd.c3 ? bd.c3 : Math.min(0.97, (1 - model(-70, -4)) * 1.02);
        const rB = (1 - c2) / c2, rN = (1 - c3) / c3;
        const favMlStaked = bets0.filter(t => !t.parlay && !t.bonus && t.type === "Moneyline" && t.side === favName).reduce((s, t) => s + t.amount, 0);
        const stakeFavMl = Math.max(0, base - favMlStaked);
        const worstBlowout = worstOf(rung2Floor + 1, 60), worstPastSpread = worstOf(start, rung2Floor), worstSmallUpset = worstOf(-3, -1), worstBigUpset = worstOf(-60, -4);
        const { stakeBlowout, stakeUpset, stakeDogPoints } = pairStakes({ stakeFavMl, perDollarMl, rD, rB, rN, worstBlowout, worstPastSpread, worstSmallUpset, worstBigUpset });
        const priceOdds = americanOf;   
        const mk = (type, side, line, odds, amount) => ({ type, side, line, odds, amount, key });
        const new0 = [stakeFavMl > 0 ? { type: "Moneyline", side: favName, line: fav.ml, amount: stakeFavMl, key } : null, stakeDogPoints > 0.5 ? mk("Spread", dogName, dog.sp, dogPrice, stakeDogPoints) : null,
          stakeBlowout > 0.5 ? mk("Spread", dogName, K2, priceOdds(c2), stakeBlowout) : null, stakeUpset > 0.5 ? mk("Spread", favName, K3, priceOdds(c3), stakeUpset) : null].filter(Boolean);
        const bets = [...bets0, ...new0];
        
        const mlNew = M => (M > 0 ? perDollarMl * stakeFavMl : M < 0 ? -stakeFavMl : 0), fD = M => (M < S ? rD : M > S ? -1 : 0), fB = M => (M < K2 ? rB : -1), fN = M => (M > -K3 ? rN : -1);
        const afterAt = M => profitAt(M) + mlNew(M) + (stakeDogPoints > 0.5 ? stakeDogPoints * fD(M) : 0) + (stakeBlowout > 0.5 ? stakeBlowout * fB(M) : 0) + (stakeUpset > 0.5 ? stakeUpset * fN(M) : 0);
        const lows = (f, lo, hi) => { let w = Infinity; for (let M = lo; M <= hi; M++) w = Math.min(w, f(M)); return w; };
        const regions = [[`${dogName} by 4+`, -60, -4], [`${dogName} by 1–3`, -3, -1], [`${favName} by 1–${start - 1}`, 1, start - 1], [`${favName} by ${start}–${rung2Floor}`, start, rung2Floor], [`${favName} by ${rung2Floor + 1}+`, rung2Floor + 1, 60]];
        const line = f => regions.map(([n, lo, hi]) => `${n} ${sgn(lows(f, lo, hi))}`).join(" · ");
        
        const v = g.venue, dogSide = fav.side === "home" ? "away" : "home";
        let chances = null;
        if (bd && bd.c3 && v) {
          const chanceFav = v.ml[fav.side][1] / (v.ml[fav.side][1] + v.ml[dogSide][1]), chanceDog = 1 - chanceFav, chanceBig = Math.min(chanceDog, 1 - c3), pc = [chanceBig, chanceDog - chanceBig, chanceFav - bd.c1, bd.c1 + c2 - 1, 1 - c2];
          if (pc.every(p => p >= -0.005)) chances = pc.map(p => Math.max(0, p));
        }
        const ev = chances ? chances.reduce((s, p, i) => s + p * lows(afterAt, regions[i][1], regions[i][2]), 0) : null;
        
        
        const favVen = v && v.ml[fav.side], dogVen = v && v.sp.dog, rung2Venue = bd && [bd.src2, c2], rung3Venue = bd && bd.c3 ? [bd.src3, c3] : null;
        const px = (ven, price) => ven ? ven[1] : 1 / decimalOf(price);
        const where = (ven, p, kalshiText, polyText) => ven ? `${ven[0]} at ${Math.round(ven[1] * 100)}¢: ${ven[0] === "Kalshi" ? kalshiText : polyText}` : `at about ${Math.round(p * 100)}¢ (no venue saved for this game)`;
        const table = el("table", "flagged-pair-table");
        table.innerHTML = "<thead><tr><th>Contracts</th><th>Bet</th><th>Venue</th><th>Ask</th><th>Cost</th><th>Pays</th></tr></thead><tbody></tbody>";
        const row = (what, dollars, ven, price, kalshiText, polyText, label) => {
          const p = px(ven, price), n = Math.round(dollars / p), r = el("tr");
          const cell = (text, cls) => { const c = el("td", cls, text); r.append(c); return c; };
          cell(n.toLocaleString("en-US"), "num");
          const bet = cell(`${what}${label ? ` (${label})` : ""}`);
          bet.append(el("small", null, ven ? (ven[0] === "Kalshi" ? kalshiText : polyText) : "no venue saved for this game"));
          cell(ven ? ven[0] : "—");
          cell(`${Math.round(p * 100)}¢`, "num");
          cell(usd(dollars), "num");
          cell(usd(n), "num");
          table.tBodies[0].append(r);
        };
        const odd = od => odds(Math.round(od));
        const list = el("div", "flagged-pair-text");
        const have = [...bets0.filter(t => !t.parlay).map(t => `${usd(t.amount)}${t.bonus ? " bonus" : ""} ${t.side} ${t.type === "Moneyline" ? "moneyline" : pts(t.line)}`), ...(parlays0.length ? [`${parlays0.length} multi-game parlay${parlays0.length > 1 ? "s" : ""} (not counted)`] : []), ...bets0.filter(t => t.parlay).map(() => "a same-game parlay")];
        list.append(el("div", "tx sub", `Already on this game: ${have.length ? have.join(" · ") : "nothing"}`));
        if (stakeFavMl > 0) row(`${favName} to win`, stakeFavMl, favVen, fav.ml, `Yes on "${favName} win"`, `the ${favName} outcome of the moneyline market`, odds(fav.ml));
        if (stakeDogPoints > 0.5) row(`${dogName} ${dogPts}`, stakeDogPoints, dogVen, dogPrice, `No on "${favName} win by over ${S.toFixed(1)} points"`, `the ${dogName} outcome of "Spread: ${favName} (−${S.toFixed(1)})"`, odds(dogPrice));
        if (stakeBlowout > 0.5) row(`${dogName} +${K2.toFixed(1)}`, stakeBlowout, rung2Venue, priceOdds(c2), `No on "${favName} win by over ${K2.toFixed(1)} points"`, `the ${dogName} outcome of "Spread: ${favName} (−${K2.toFixed(1)})"`, `${odd(priceOdds(c2))}${bd ? "" : ", model price"}`);
        if (stakeUpset > 0.5) row(`${favName} +${K3.toFixed(1)} (the underdog does not win by more than 3)`, stakeUpset, rung3Venue, priceOdds(c3), `No on "${dogName} win by over ${K3.toFixed(1)} points"`, `the ${favName} outcome of "Spread: ${dogName} (−${K3.toFixed(1)})"`, `${odd(priceOdds(c3))}${bd && bd.c3 ? "" : ", model price"}`);
        if (stakeDogPoints <= 0.5 && stakeBlowout <= 0.5 && stakeUpset <= 0.5 && stakeFavMl <= 0) list.append(el("div", "tx sub", "Nothing to add: your position already meets the target."));
        else list.append(table);
        const foot = el("div", "flagged-pair-sum");
        foot.append(el("div", null, `Now: ${line(profitAt)}`), el("div", null, `After: ${line(afterAt)} · new money ${usd(stakeFavMl + [stakeDogPoints, stakeBlowout, stakeUpset].filter(x => x > 0.5).reduce((s, x) => s + x, 0))}`));
        if (chances) foot.append(el("div", null, `Chances from the market (${abbr(favName)} win ${Math.round((1 - (chances[0] + chances[1])) * 100)}%): ${chances.map((p, i) => `${regions[i][0].replace(`${dogName} by`, "upset by").replace(`${favName} by`, "fav by")} ${Math.round(p * 100)}%`).join(" · ")} · expected value about ${sgn(ev)}`));
        pop.append(el("div", "flagged-pair-head", `To get to optimal: ${usd(base)} on the ${favName} moneyline in total; a blowout (${favName} by ${rung2Floor + 1}+) breaks even and a small upset loses less than a big one`), riskGrid(g, bets, 640, [], [], 0, 67).el, list, foot);
        document.body.append(pop);
        place(e);
      });
    }
    
    if (again && Math.max(560, box.clientWidth) !== W) drawGraphs(false);
  }

  
  
  
  
  
  
  
  function weatherIcon(cond, indoor) {
    const id = Number(cond) || 0, A = "#d49b00", B = "#2f6fd0", G = "#6b7480";
    const sun = `<circle cx="12" cy="12" r="4.2" fill="${A}" stroke="${A}"/><g stroke="${A}" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></g>`;
    const cloud = (x = 0, y = 0, fill = "#e8ecf1") => `<path transform="translate(${x} ${y})" d="M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.6 4.5 4.5 0 0 0 7 18.5z" fill="${fill}" stroke="${G}" stroke-width="1.5" stroke-linejoin="round"/>`;
    let body;
    if (indoor) body = `<path d="M3 19.5V11a9 7 0 0 1 18 0v8.5z" fill="#e8ecf1" stroke="${G}" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 19.5h18" stroke="${G}" stroke-width="1.6"/><path d="M12 5.2v14.3M7.5 7v12.5M16.5 7v12.5" stroke="${G}" stroke-width="1"/>`;
    else if ([1, 2, 5, 30].includes(id)) body = sun;
    else if ([33, 34, 37].includes(id)) body = `<path d="M15.5 3.5a8.5 8.5 0 1 0 5 15 7 7 0 0 1-5-15z" fill="#f2cf5b" stroke="#b38900" stroke-width="1.4" stroke-linejoin="round"/>`;
    else if ([3, 4, 35, 36, 38].includes(id)) body = `<g transform="translate(-2.5 -3.5) scale(.62)">${sun}</g>` + cloud(1.5, 1);
    else if ([12, 13, 14, 18, 26, 39, 40].includes(id)) body = cloud(0, -2.5) + `<g stroke="${B}" stroke-width="1.8" stroke-linecap="round"><path d="M8.5 18.5l-1 2.6M12.5 18.5l-1 2.6M16.5 18.5l-1 2.6"/></g>`;
    else if ([15, 16, 17, 41, 42].includes(id)) body = cloud(0, -2.5, "#cfd5dd") + `<path d="M12.6 15.5l-3 4.2h2.6l-1.2 3.6 4.4-5.2h-2.8l1.4-2.6z" fill="${A}" stroke="#a07700" stroke-width=".8" stroke-linejoin="round"/>`;
    else if ([19, 20, 21, 22, 23, 24, 25, 29, 31, 43, 44].includes(id)) body = cloud(0, -2.5) + `<g fill="${B}"><circle cx="8.5" cy="19.5" r="1.3"/><circle cx="12.5" cy="21" r="1.3"/><circle cx="16.5" cy="19.5" r="1.3"/></g>`;
    else if (id === 11) body = `<g stroke="${G}" stroke-width="2" stroke-linecap="round"><path d="M4 8h16M6 12h14M4 16h16M8 20h10"/></g>`;
    else body = cloud(0, 0);
    return `<svg class="weather-icon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  }
  
  const DIVS = [["Bills", "Dolphins", "Patriots", "Jets"], ["Ravens", "Bengals", "Browns", "Steelers"], ["Texans", "Colts", "Jaguars", "Titans"], ["Chiefs", "Raiders", "Chargers", "Broncos"],
    ["Cowboys", "Giants", "Eagles", "Commanders"], ["Bears", "Lions", "Packers", "Vikings"], ["Falcons", "Panthers", "Saints", "Buccaneers"], ["Cardinals", "Rams", "49ers", "Seahawks"]];
  const divOf = n => DIVS.findIndex(d => d.includes(n));
  
  function darkLook(g, side) {
    const k = teamLook(g, side);
    
    if (lumOf(k.bg) > lumOf(k.fg)) return { bg: k.fg, fg: k.bg, outline: null };
    return { bg: k.bg, fg: k.fg, outline: null };
  }
  
  function scriptLines(g, side) {
    const nk = nick(g, side), opNick = nick(g, side === "away" ? "home" : "away"), t = TEAM_INFO[nk], op = TEAM_INFO[opNick], all = Object.values(TEAM_INFO);
    const rk = (fn, high) => { const v = fn(t); return v === null ? "–" : "#" + (1 + all.filter(x => { const y = fn(x); return y !== null && (high ? y > v : y < v); }).length); };
    const per = (n, k) => (k ? n / k : 0), f1 = v => v.toFixed(1), sg = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
    const out = [], wp = r => { const [w, l, ti = 0] = (r || "0-0").split("-").map(Number); return w + l + ti ? (w + ti / 2) / (w + l + ti) : 0; };
    const abbrOf = n => ABBR[n] || n, nickOf = ab => Object.keys(ABBR).find(k => ABBR[k] === ab);
    const add = (cls, label, text) => out.push({ cls, label, text });
    const played = (t.sch || []).filter(x => x[3] !== null);
    if (g.final) add("role", "", (g.final[0] === g.final[1] ? "TIED " : (g.final[0] > g.final[1]) === (side === "away") ? "WON " : "LOST ") + g.final[0] + "–" + g.final[1]);
    else if (scoutOn() && (g.noLine || !g.line)) add("role", "", "NO LINE YET");
    
    add("sx", "Edges", "3rd down " + f1(t.td3) + "% (" + rk(x => x.td3, true) + "), red zone TD " + f1(t.rz) + "% (" + rk(x => x.rz, true) + "), turnovers " + sg(t.tk - t.gv) + " (" + rk(x => x.tk - x.gv, true) + "), sacks " + t.sk + " (" + rk(x => x.sk, true) + ") taken " + t.skt + " (" + rk(x => x.skt, false) + "), pass " + f1(t.pass) + " (" + rk(x => x.pass, true) + ") rush " + f1(t.rush) + " (" + rk(x => x.rush, true) + ")");
    
    const impacts = [], qb = t.inj.find(p => p[1] === "QB" && p[2] !== "Injured Reserve");
    if (qb) impacts.push("QB " + qb[0].split(" ").slice(-1)[0] + " " + (qb[2] === "Out" ? "OUT" : qb[2] === "Doubtful" ? "doubtful" : "questionable"));
    const UNITS = { OT: "O-line", G: "O-line", C: "O-line", OL: "O-line", DE: "D-line", DT: "D-line", NT: "D-line", LB: "Linebackers", ILB: "Linebackers", OLB: "Linebackers", CB: "Secondary", S: "Secondary", FS: "Secondary", SS: "Secondary", WR: "Receivers", TE: "Receivers" };
    const IMPACT = { "O-line": "pass protection and the run game at risk", "D-line": "pass rush and run defense thinned", Linebackers: "run defense and coverage thinned", Secondary: "exposed to the deep pass", Receivers: "fewer passing targets" };
    const unitCounts = {}; t.inj.forEach(([, positionCode, st]) => { if (st !== "Injured Reserve" && UNITS[positionCode]) unitCounts[UNITS[positionCode]] = (unitCounts[UNITS[positionCode]] || 0) + 1; });
    Object.entries(unitCounts).filter(([, n]) => n >= 3).forEach(([u, n]) => impacts.push(u + " (" + n + "): " + IMPACT[u]));
    if (impacts.length) add("inj", "Injuries", impacts.join(", "));
    
    const sch = t.sch || [], wk = g.week, byWeek = new Map(sch.map(x => [x[0], x])), spot = [];
    const dow = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" }).format(new Date(g.t));
    if (wk > 1 && !byWeek.has(wk - 1)) spot.push("off the bye (rested)");
    else if (["Thu", "Fri", "Sat"].includes(dow) && wk > 1) spot.push("short week (" + dow + ")");
    if (wk > 1 && byWeek.has(wk - 1)) { const p = byWeek.get(wk - 1); if (p[3] !== null) spot.push("off a " + (p[3] > p[4] ? "W " : p[3] < p[4] ? "L " : "T ") + p[3] + "–" + p[4] + (p[2] ? " at home" : " on the road")); }
    const nextGame = sch.find(x => x[0] > wk);
    if (nextGame) {
      if (nextGame[0] > wk + 1) spot.push("bye next week (all-in spot)");
      const nn = nickOf(nextGame[1]), nt = nn && TEAM_INFO[nn];
      if (nn && nt) { const rival = divOf(nn) === divOf(nk), strong = wp(nt.r) >= 0.7; if (rival || strong) spot.push("look-ahead: " + (nextGame[2] ? "v " : "@ ") + nextGame[1] + " in Wk " + nextGame[0] + " (" + [rival ? "division rival" : "", nt.r].filter(Boolean).join(", ") + "), letdown risk"); }
    }
    const prevMeet = sch.find(x => x[0] < wk && x[1] === abbrOf(opNick) && x[3] !== null);
    if (prevMeet) spot.push("rematch: " + (prevMeet[3] > prevMeet[4] ? "won " : "lost ") + prevMeet[3] + "–" + prevMeet[4] + " in Wk " + prevMeet[0]);
    else if (divOf(nk) === divOf(opNick)) spot.push("division game");
    if (spot.length) add("spot", "Spot", spot.join(", "));
    
    const rec = wp(t.r);
    const stand = t.r + " (" + t.stand.replace("National Football Conference", "NFC").replace("American Football Conference", "AFC") + ")" + (t.streak >= 3 ? ", W" + t.streak : t.streak <= -3 ? ", L" + Math.abs(t.streak) : "");
    add("motivation", "Motivation", (rec >= 0.65 ? "contending: " : rec <= 0.3 ? "losing season: " : "in the mix: ") + stand);
    return out;
  }
  
  
  function drawDailyDetail(box, g) {
    const l = g.league, T = DAILY_TEAMS[l] || {}, code = side => abbr(nick(g, side)), vs = `${code("away")} @ ${code("home")}`;
    if (!T[code("away")] || !T[code("home")]) {   
      box.replaceChildren(el("div", "page-stub", vs), el("p", "page-stub-text", "Asking ESPN for team stats and injuries…"));
      ensureDailyTeams(l).then(ok => { if (detailGame !== g) return; if (ok && T[code("away")] && T[code("home")]) changed("cards"); else box.replaceChildren(el("div", "page-stub", vs), el("p", "page-stub-text", "Couldn't reach ESPN for team stats.")); });
      return;
    }
    ensureDailyTeams(l);
    const A = T[code("away")], H = T[code("home")], all = Object.values(T), nhl = l === "nhl";
    const per = (n, gp) => (gp && n !== null ? n / gp : null), f1 = v => v.toFixed(1), f2 = v => v.toFixed(2), sg = d => v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d), pct = v => v.toFixed(1) + "%";
    
    const metrics = nhl ? [
      ["goals", t => per(t.pf, t.gp), true, f2], ["against", t => per(t.pa, t.gp), false, f2], ["shots", t => per(t.shots, t.sgp), true, f1], ["against", t => per(t.sa, t.sgp), false, f1],
      ["shooting", t => t.shp, true, pct], ["save", t => t.svp, true, v => v.toFixed(3).replace(/^0/, "")], ["power-play goals", t => t.ppg, true, v => String(v)], ["faceoffs", t => t.fo, true, pct]
    ] : [
      ["points", t => per(t.pf, t.gp), true, f1], ["against", t => per(t.pa, t.gp), false, f1], ["net", t => per(t.pf - t.pa, t.gp), true, sg(1)], ["FG", t => t.fg, true, pct], ["3P", t => t.tp, true, pct],
      ["threes", t => t.tpm, true, f1], ["rebounds", t => t.reb, true, f1], ["assists", t => t.ast, true, f1], ["turnovers", t => t.tov, false, f1]
    ];
    const rank = (fn, high, v) => 1 + all.filter(t => { const x = fn(t); return x !== null && (high ? x > v : x < v); }).length;
    const edges = t => metrics.map(([label, fn, high, fmt]) => { const v = fn(t); return v === null ? null : label + " " + fmt(v) + " (#" + rank(fn, high, v) + ")"; }).filter(Boolean).join(", ");
    const head = el("div", "gd-head"), info = el("div", "gd-info"), part = (...n) => { if (info.childNodes.length) info.append(el("i", null, " · ")); info.append(...n); };
    if (g.final) part(el("b", null, "FINAL " + g.final[0] + " – " + g.final[1]));
    part(el("span", null, `${shortDayFmt.format(new Date(g.t))} · ${timeZoned(new Date(g.t))}`));
    if (g.tv) part(el("span", null, g.tv));
    if (Array.isArray(g.arena)) g.arena.filter(Boolean).forEach(x => part(el("span", null, x)));   
    head.dataset.scene = "dome";
    const team = (side, t) => { const d = el("div", "gd-team " + side); d.append(gdBadge(g, side, t.called.toUpperCase())); return d; };
    head.append(info, team("away", A), team("home", H));
    
    const seasonOf = c => ALL_GAMES.filter(x => x.league === l && (abbr(nick(x, "away")) === c || abbr(nick(x, "home")) === c)).map(x => { const home = abbr(nick(x, "home")) === c, s = x.final; return [Date.parse(x.t), abbr(nick(x, home ? "away" : "home")), home ? 1 : 0, s ? s[home ? 1 : 0] : null, s ? s[home ? 0 : 1] : null, x]; }).sort((p, q) => p[0] - q[0]);
    const etDay = ms => Math.floor(Date.parse(new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" })) / 864e5);
    const spotLines = (side, t) => {
      const out = [], add = (cls, label, text) => out.push({ cls, label, text }), sch = seasonOf(code(side)), at = Date.parse(g.t), before = sch.filter(x => x[0] < at && x[3] !== null), prev = sch.filter(x => x[0] < at).pop();
      if (g.final) add("role", "", ((g.final[0] > g.final[1]) === (side === "away") ? "WON " : "LOST ") + g.final[0] + "–" + g.final[1]);
      else if (scoutOn() && g.noLine) add("role", "", "NO LINE YET");
      add("sx", "Edges", edges(t));
      const spot = [];
      if (prev) { const rest = etDay(at) - etDay(prev[0]) - 1; spot.push(rest === 0 ? "second night of a back-to-back" : rest + (rest === 1 ? " day" : " days") + " of rest"); }
      const last = before[before.length - 1];
      if (last) spot.push("off a " + (last[3] > last[4] ? "W " : "L ") + last[3] + "–" + last[4] + (last[2] ? " v " : " @ ") + last[1]);
      const home = side === "home";
      let run = 1; for (let k = sch.findIndex(x => x[5] === g) - 1; k >= 0 && !!sch[k][2] === home; k--) run++;
      if (run >= 3) spot.push((home ? "home game " : "road game ") + run + " in a row");
      const met = before.filter(x => x[1] === code(home ? "away" : "home"));
      if (met.length) spot.push("met " + met.length + "x: " + met.map(x => (x[3] > x[4] ? "W " : "L ") + x[3] + "–" + x[4]).join(", "));
      if (spot.length) add("spot", "Spot", spot.join(", "));
      const out1 = t.inj.filter(p => p[2] === "Out").length, key = t.inj.find(p => p[4] && p[2] !== "Injured Reserve");
      if (key) add("inj", "Injuries", "G " + key[0].split(" ").slice(-1)[0] + " " + (key[2] === "Out" ? "OUT" : key[2].toLowerCase()));
      else if (out1 >= 3) add("inj", "Injuries", out1 + " out");
      add("motivation", "Standing", t.r + " (" + t.stand + ")" + (nhl && t.standPts !== null ? ", " + t.standPts + " points" : "") + ", " + (home ? "home " + t.h : "road " + t.a) + ", last ten " + t.l10 + (t.streak >= 3 ? ", W" + t.streak : t.streak <= -3 ? ", L" + Math.abs(t.streak) : ""));
      return out;
    };
    const low = el("div", "gd-low"), half = (t, side) => {
      const d = el("div", "gd-half"), c2 = el("div", "gd-col"), look = darkLook(g, side), label = (cls, text) => { const x = el("div", cls, text); x.style.background = look.bg; x.style.color = look.fg; return x; };
      const list = el("div", "gd-injury-list");
      c2.append(label("gd-vertical-label", "Injuries"), list);
      [...t.inj].sort((p, q) => (q[2] === "Injured Reserve") - (p[2] === "Injured Reserve")).forEach(([name, positionCode, status, type, key]) => {
        const ln = el("div", "gd-line" + (key ? " key" : "")), nm = name.split(" "), short = nm.length > 1 ? nm[0][0] + ". " + nm.slice(1).join(" ") : name, k = status === "Out" ? "out" : status === "Injured Reserve" ? "ir" : "questionable";
        const nameEl = el("span", "name", short + " "); nameEl.append(el("span", "position", positionCode));
        ln.append(nameEl, el("span", "st " + k, status === "Out" ? "OUT" : status === "Injured Reserve" ? "IR" : "DTD"), el("span", "dim", type));
        list.append(ln);
      });
      if (!t.inj.length) list.append(el("div", "gd-line dim", "none listed"));
      
      const c3 = el("div", "gd-col gd-sched"), grid = el("div", "gd-season-grid gd-days"), sch = seasonOf(code(side)), i = Math.max(0, sch.findIndex(x => x[5] === g)), from = Math.max(0, Math.min(i - 12, sch.length - 16));
      c3.style.setProperty("--tc", look.bg);
      c3.append(label("gd-vertical-label sched", "Season"));
      sch.slice(from, from + 16).forEach(e => {
        const cell = el("div", "gd-sc" + (e[5] === g ? " cur" : ""));
        cell.title = shortDayFmt.format(new Date(e[0]));
        cell.append(el("span", "name", (e[2] ? "v " : "@ ") + e[1]));
        if (e[3] === null) cell.append(el("span", "dim", e[5] === g ? "" : new Date(e[0]).toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "America/New_York" })));
        else cell.append(el("span", e[3] > e[4] ? "won" : "lost", (e[3] > e[4] ? "W " : "L ") + e[3] + "–" + e[4]));
        grid.append(cell);
      });
      grid.style.flex = "1"; grid.style.minWidth = "0";
      c3.append(grid);
      const c4 = el("div", "gd-col gd-sched gd-script"), scriptBody = el("div", "gd-script-body");
      c4.style.setProperty("--tc", look.bg);
      spotLines(side, t).forEach(x => { const r = el("div", "gd-script-row " + x.cls); if (x.label) r.append(el("b", null, x.label + " ")); r.append(document.createTextNode(x.text)); scriptBody.append(r); });
      c4.append(scriptBody);
      d.append(c2, c4, c3);
      return d;
    };
    const nInj = Math.max(A.inj.length, H.inj.length, 1), lh = Math.max(13, Math.min(22, Math.floor(250 / nInj)));
    const setRows = (h, scriptSize) => { low.style.setProperty("--lh", h + "px"); low.style.setProperty("--line-size", Math.max(10, Math.min(14, Math.round(h * 0.56))) + "px"); if (scriptSize) low.style.setProperty("--script-size", scriptSize + "px"); [...low.children].forEach(d => { d.style.gridTemplateRows = Math.max(nInj * h + 2, 70) + "px auto minmax(0, 1fr)"; }); };
    low.append(half(A, "away"), half(H, "home"));
    setRows(lh);
    const wrap = el("div", "gd-wrap");
    wrap.append(head, low);
    box.replaceChildren(wrap);
    
    for (let i = 0, h = lh, scriptSize = 14.5; i < 24; i++) {
      const scs = [...box.querySelectorAll(".gd-script")], sch = [...box.querySelectorAll(".gd-half > .gd-sched:not(.gd-script)")];
      const deficit = Math.max(low.scrollHeight - low.clientHeight - 1, ...scs.map((e, k) => e.getBoundingClientRect().bottom - sch[k].getBoundingClientRect().top + 4));
      if (deficit <= 0.5) break;
      if (h > 13) { h = Math.max(13, h - Math.max(1, Math.ceil(deficit / nInj))); setRows(h); }
      else if (scriptSize > 10.5) { scriptSize -= 0.5; setRows(h, scriptSize); }
      else break;
    }
    const sp = [...box.querySelectorAll(".gd-script")], sh = Math.max(0, ...sp.map(e => e.offsetHeight));
    sp.forEach(e => { e.style.minHeight = sh + "px"; });
  }
  function drawGameDetail(box, g) {
    if (leagueOf(g).daily && leagueOf(g).gameDetails) { try { drawDailyDetail(box, g); } catch (e) { box.replaceChildren(el("div", "page-stub", `${abbr(nick(g, "away"))} @ ${abbr(nick(g, "home"))}`), el("p", "page-stub-text", "This preview couldn't be drawn: " + e.message)); } return; }
    if (!leagueOf(g).gameDetails) { box.replaceChildren(el("div", "page-stub", `${abbr(nick(g, "away"))} @ ${abbr(nick(g, "home"))}`), el("p", "page-stub-text", `${leagueOf(g).code} game details are not built yet.`)); return; }
    if (!TEAM_INFO[nick(g, "away")] || !TEAM_INFO[nick(g, "home")]) {   
      box.replaceChildren(el("div", "page-stub", `${abbr(nick(g, "away"))} @ ${abbr(nick(g, "home"))}`), el("p", "page-stub-text", "Asking ESPN for team stats and injuries…"));
      ensureTeams().then(ok => { if (detailGame !== g) return; if (ok && TEAM_INFO[nick(g, "away")]) changed("cards"); else box.replaceChildren(el("div", "page-stub", `${abbr(nick(g, "away"))} @ ${abbr(nick(g, "home"))}`), el("p", "page-stub-text", "Couldn't reach ESPN for team stats.")); });
      return;
    }
    ensureTeams();
    const A = TEAM_INFO[nick(g, "away")], H = TEAM_INFO[nick(g, "home")], conference = t => (t || "").replace("National Football Conference", "NFC").replace("American Football Conference", "AFC");
    const all = Object.values(TEAM_INFO);
    const rank = (fn, high, v) => 1 + all.filter(t => { const x = fn(t); return x !== null && (high ? x > v : x < v); }).length;
    const per = (n, gp) => (gp ? n / gp : null);
    const metrics = [
      ["Points for / game", t => per(t.pf, t.gp), true, v => v.toFixed(1)],
      ["Points against / game", t => per(t.pa, t.gp), false, v => v.toFixed(1)],
      ["Point differential / game", t => per(t.pf - t.pa, t.gp), true, v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1)],
      ["Total yards / game", t => t.ypg, true, v => v.toFixed(1)],
      ["Passing yards / game", t => t.pass, true, v => v.toFixed(1)],
      ["Rushing yards / game", t => t.rush, true, v => v.toFixed(1)],
      ["Third-down conversion", t => t.td3, true, v => v.toFixed(1) + "%"],
      ["Red-zone touchdown rate", t => t.rz, true, v => v.toFixed(1) + "%"],
      ["Takeaways", t => t.tk, true, v => String(v)],
      ["Giveaways", t => t.gv, false, v => String(v)],
      ["Sacks made", t => t.sk, true, v => String(v)],
      ["Sacks taken", t => t.skt, false, v => String(v)]
    ];
    const wp = rec => { const [w, l, t = 0] = (rec || "0-0").split("-").map(Number); return w + l + t ? (w + t / 2) / (w + l + t) : 0; };
    const row = (label, av, hv, best, ar, hr) => {
      const r = el("div", "gd-row"), a = el("div", "value away"), l = el("div", "gd-row-label", label), h = el("div", "value home");
      a.append(av); if (ar) a.append(el("small", null, "#" + ar));
      if (hr) h.append(el("small", null, "#" + hr)); h.append(hv);
      if (best === "a") a.classList.add("best"); else if (best === "h") h.classList.add("best");
      r.append(a, l, h);
      return r;
    };
    const wrap = el("div", "gd-wrap");
    if (!A || !H) { wrap.append(el("div", "gd-foot", "No team data for this matchup.")); box.replaceChildren(wrap); return; }
    
    const head = el("div", "gd-head"), team = (side, t) => {
      
      
      const d = el("div", "gd-team " + side);   
      d.append(gdBadge(g, side));   
      return d;
    };
    
    let wxMid = null;
    const info = el("div", "gd-info"), part = (...n) => { if (info.childNodes.length) info.append(el("i", null, " · ")); info.append(...n); };
    if (g.final) part(el("b", null, "FINAL " + g.final[0] + " – " + g.final[1]));
    part(el("span", null, `${shortDayFmt.format(new Date(g.t))} · ${timeZoned(new Date(g.t))}`));
    if (g.tv) part(el("span", null, g.tv));
    const venue = GAME_VENUES[g.week + "|" + nick(g, "away") + "|" + nick(g, "home")];
    if (venue) {
      if (venue[VENUE.stadium]) part(el("span", null, venue[VENUE.stadium]));
      if (venue[VENUE.city]) part(el("span", null, venue[VENUE.city]));
      if (!g.final && !venue[VENUE.indoor] && venue[VENUE.forecast]) {   
        wxMid = el("div", "gd-forecast"); wxMid.title = "Forecast for kickoff"; wxMid.innerHTML = weatherIcon(venue[VENUE.condition], false);
        wxMid.append(el("span", null, (venue[VENUE.temperature] !== null ? venue[VENUE.temperature] + "° " : "") + venue[VENUE.forecast]));
      }   
    }
    head.dataset.scene = "";
    if (venue && !g.final) {
      const id = Number(venue[VENUE.condition]) || 0, inList = l => l.includes(id);
      head.dataset.scene = venue[VENUE.indoor] ? "dome" : !venue[VENUE.forecast] ? "none" : inList([15, 16, 17, 41, 42]) ? "storm" : inList([12, 13, 14, 18, 26, 39, 40]) ? "rain" : inList([19, 20, 21, 22, 23, 24, 25, 29, 31, 43, 44]) ? "snow" : id === 11 ? "fog" : inList([33, 34, 35, 36, 37, 38]) ? "night" : inList([1, 2, 5, 30]) ? "clear" : inList([3, 4]) ? "partly" : "cloudy";
    }
    head.append(info, team("away", A), team("home", H)); if (wxMid) head.append(wxMid);
    
    const rows = el("div", "gd-rows");
    const cmp = (x, y, high) => (x === null || y === null || x === y ? "" : (high ? x > y : x < y) ? "a" : "h");
    rows.append(row("Record", A.r, H.r, wp(A.r) === wp(H.r) ? "" : wp(A.r) > wp(H.r) ? "a" : "h"));
    rows.append(row("Road · home record", A.a || "–", H.h || "–", wp(A.a) === wp(H.h) ? "" : wp(A.a) > wp(H.h) ? "a" : "h"));
    metrics.forEach(([label, fn, high, fmt]) => {
      const x = fn(A), y = fn(H);
      rows.append(row(label, x === null ? "–" : fmt(x), y === null ? "–" : fmt(y), cmp(x, y, high), x === null ? 0 : rank(fn, high, x), y === null ? 0 : rank(fn, high, y)));
    });
    
    const low = el("div", "gd-low"), half = (t, side) => {
      const d = el("div", "gd-half"), c2 = el("div", "gd-col");
      
      const labelEl = el("div", "gd-vertical-label", "Injuries"), list = el("div", "gd-injury-list"), look = darkLook(g, side);
      labelEl.style.background = look.bg; labelEl.style.color = look.fg;
      if (look.outline) labelEl.style.boxShadow = "inset 0 0 0 2px " + look.outline;
      c2.append(labelEl, list);
      
      const UNIT = { OT: "O-line", G: "O-line", C: "O-line", OL: "O-line", OG: "O-line", DE: "D-line", DT: "D-line", NT: "D-line", DL: "D-line", LB: "Linebackers", ILB: "Linebackers", OLB: "Linebackers", MLB: "Linebackers", CB: "Secondary", S: "Secondary", FS: "Secondary", SS: "Secondary", DB: "Secondary", WR: "Receivers", TE: "Receivers" }, units = {};
      t.inj.forEach(([, positionCode, status]) => { if (status !== "Injured Reserve" && UNIT[positionCode]) { const u = units[UNIT[positionCode]] || (units[UNIT[positionCode]] = { n: 0, out: 0 }); u.n++; if (status === "Out") u.out++; } });
      const clusters = Object.entries(units).filter(([, u]) => u.n >= 3).sort((p, q) => q[1].n - p[1].n);
      const clusterUnits = new Set(clusters.map(([name]) => name));
      
      [...t.inj].sort((p, q) => (q[2] === "Injured Reserve") - (p[2] === "Injured Reserve")).forEach(([name, positionCode, status, type, key]) => {
        const ln = el("div", "gd-line" + (key ? " key" : "") ), inCluster = status !== "Injured Reserve" && clusterUnits.has(UNIT[positionCode]), nm = name.split(" "), short = nm.length > 1 ? nm[0][0] + ". " + nm.slice(1).join(" ") : name, k = status === "Out" ? "out" : status === "Doubtful" ? "doubtful" : status === "Injured Reserve" ? "ir" : "questionable";
        const nameEl = el("span", "name", short + " "), positionEl = el("span", inCluster ? "position cluster" : "position", positionCode);   
        nameEl.append(positionEl);
        ln.append(nameEl, el("span", "st " + k, status === "Out" ? "OUT" : status === "Doubtful" ? "DOUBT" : status === "Injured Reserve" ? "IR" : "Q"), el("span", "dim", type));
        list.append(ln);
      });
      if (!t.inj.length) list.append(el("div", "gd-line dim", "none listed"));
      
      const c3 = el("div", "gd-col gd-sched"), grid = el("div", "gd-season-grid"), byWeek = new Map((t.sch || []).map(x => [x[0], x]));
      c3.style.setProperty("--tc", darkLook(g, side).bg);   
      
      const slab = el("div", "gd-vertical-label sched", "Schedule"), slabLook = darkLook(g, side);
      slab.style.background = slabLook.bg; slab.style.color = slabLook.fg;
      if (slabLook.outline) slab.style.boxShadow = "inset 0 0 0 2px " + slabLook.outline;
      c3.append(slab);
      for (let wk = 1; wk <= 18; wk++) {
        const e = byWeek.get(wk), cell = el("div", "gd-sc" + (e && wk === g.week ? " cur" : "") + (!e ? " bye" : ""));
        cell.append(el("span", "dim wk", String(wk)));
        if (!e) cell.append(el("span", "dim bye-week", "BYE"));
        else {
          cell.append(el("span", "name", (e[2] ? "v " : "@ ") + e[1]));
          if (e[3] === null) cell.append(el("span", "dim", "–"));
          else { const won = e[3] > e[4], tie = e[3] === e[4]; cell.append(el("span", won ? "won" : tie ? "dim" : "lost", (won ? "W " : tie ? "T " : "L ") + e[3] + "–" + e[4])); }
        }
        grid.append(cell);
      }
      
      for (let k = 0; k < 2; k++) grid.append(el("div", "gd-sc blank"));
      grid.style.flex = "1"; grid.style.minWidth = "0";
      c3.append(grid);
      
      const c4 = el("div", "gd-col gd-sched gd-script"), scriptBody = el("div", "gd-script-body");
      c4.style.setProperty("--tc", darkLook(g, side).bg);   
      scriptLines(g, side).forEach(l => { const row = el("div", "gd-script-row " + l.cls); if (l.label) row.append(el("b", null, l.label + " ")); row.append(document.createTextNode(l.text)); scriptBody.append(row); });
      c4.append(scriptBody);
      d.append(c2, c4, c3);
      return d;
    };
    
    const nInj = Math.max(A.inj.length, H.inj.length, 1), lh = Math.max(14, Math.min(22, Math.floor(250 / nInj))), textSize = Math.max(10, Math.min(14, Math.round(lh * 0.56)));
    low.style.setProperty("--lh", lh + "px"); low.style.setProperty("--line-size", textSize + "px");
    low.append(half(A, "away"), half(H, "home"));
    [...low.children].forEach(d => { d.style.gridTemplateRows = (nInj * lh + 2) + "px auto minmax(0, 1fr)"; });   
    wrap.append(head, low);
    box.replaceChildren(wrap);
    
    {
      let lineHeightNow = lh, scriptSize = 14.5;
      const setRows = () => { low.style.setProperty("--lh", lineHeightNow + "px"); low.style.setProperty("--line-size", Math.max(10, Math.min(14, Math.round(lineHeightNow * 0.56))) + "px"); [...low.children].forEach(d => { d.style.gridTemplateRows = (nInj * lineHeightNow + 2) + "px auto minmax(0, 1fr)"; }); };
      for (let i = 0; i < 24; i++) {
        const scs = [...box.querySelectorAll(".gd-script")], sch = [...box.querySelectorAll(".gd-half > .gd-sched:not(.gd-script)")];
        const deficit = Math.max(low.scrollHeight - low.clientHeight - 1, ...scs.map((e, k) => e.getBoundingClientRect().bottom - sch[k].getBoundingClientRect().top));
        if (deficit <= 0.5) break;   
        if (lineHeightNow > 13) { lineHeightNow = Math.max(13, lineHeightNow - Math.max(1, Math.ceil(deficit / nInj))); setRows(); }
        else if (scriptSize > 10.5) { scriptSize -= 0.5; low.style.setProperty("--script-size", scriptSize + "px"); }
        else break;
      }
    }
    
    const sp = [...box.querySelectorAll(".gd-script")], sh = Math.max(0, ...sp.map(e => e.offsetHeight));
    sp.forEach(e => { e.style.minHeight = sh + "px"; });
  }
export { divOf, drawGameDetail, drawGraphs };
