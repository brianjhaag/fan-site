// The tabs that replace the game cards: Playbook, Season stats, Graphs, and the per-game Game detail.
import { riskGrid } from "./risk.js?v=mvxtj25y";
import { GAME_ENV, TEAM_INFO, WEEK_GAMES, ensureTeams } from "./espn.js?v=mvxtj25y";
import { HELMETS } from "./data/assets.js?v=mvxtj25y";
import { Fan } from "./hosts.js?v=mvxtj25y";
import { $, ABBR, HELM_PAD, RULES, abbr, americanOf, bdBadge, changed, curWeek, decimalOf, detailGame, drawStub, el, evMoneyline, evPoints, gameBets, gameKey, gameLabel, graphGames, last, later, leagueOf, lumOf, marginModel, odds, outcomes, pairFlagged, pairStakes, parlayShares, pbStats, profitOf, pts, shortDayFmt, status, teamLook, ticketPL, timeZoned, marketWanted, pricesOn, trackingOn, view } from "./base.js?v=mvxtj25y";
  Object.assign(later, { renderGameDetail });
  // PLAYBOOK: situations are search filters over past games. A situation is one entry in PLAYBOOK; `f` sees one team's game (t) and picks the side to bet, or with `game: true`
  // the game as a whole (only the totals mean anything then). t: home, sp (the team's spread, negative = favored), rest, div, day (0 Sun), hhmm (ET), total, wind, week, prev (margin of its last game this season, null in its first).
  // The history is the user's own pull (playbook.js through app/ingest.js), kept in their records: nothing ships with the page.
  let playbookDoc = null, playbookWatched = false;
  function setPlaybook(doc) { playbookDoc = doc; pbTeamGames = null; }
  const PLAYBOOK = [
    { h: "Every favorite", d: "for reference", f: t => t.sp < 0 },
    { h: "Short road underdogs", d: "+0.5 to +5.5", f: t => !t.home && t.sp > 0 && t.sp < 6 },
    { h: "Divisional road favorites", f: t => !t.home && t.div && t.sp < 0 },
    { h: "Short favorites", d: "−0.5 to −3", f: t => t.sp < 0 && t.sp >= -3 },
    { h: "Home teams after a loss", f: t => t.home && t.prev != null && t.prev < 0 },
    { h: "Big home favorites", d: "−10 or more", f: t => t.home && t.sp <= -10 },
    { h: "Home underdogs", f: t => t.home && t.sp > 0 },
    { h: "Divisional home underdogs", f: t => t.home && t.div && t.sp > 0 },
    { h: "Off a bye", d: "13+ days rest", f: t => t.prev != null && t.rest >= 13 },
    { h: "Short-week road teams", d: "5 days rest or less", f: t => !t.home && t.rest <= 5 },
    { h: "After a blowout loss", d: "by 17+", f: t => t.prev != null && t.prev <= -17 },
    { h: "Favorites after a blowout win", d: "by 17+", f: t => t.sp < 0 && t.prev != null && t.prev >= 17 },
    { h: "Prime-time underdogs", d: "7 PM ET or later", f: t => t.sp > 0 && t.hhmm >= 1900 },
    { h: "Low totals", d: "40 or less", game: true, f: t => t.total <= 40 },
    { h: "Windy games", d: "15+ mph", game: true, f: t => t.wind != null && t.wind >= 15 }
  ];
  let pbTeamGames = null, pbOpen = new Set();
  // Both teams' view of every game, each with the margin of its previous game that season.
  function pbGames() {
    if (pbTeamGames) return pbTeamGames;
    const last = new Map(), out = [];
    playbookDoc.rows.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([season, week, day, hhmm, aw, hm, as, hs, ar, hr, aml, hml, spread, aso, hso, total, uo, oo, div, wind]) => {
      const one = (team, home, m, rest, ml, sp, spo) => {
        const key = season + team, t = { season, week, day, hhmm, team, home, m, rest, ml, sp, spo, total, uo, oo, div: !!div, wind, points: as + hs, prev: last.has(key) ? last.get(key) : null };
        out.push(t);
      };
      one(aw, false, as - hs, ar, aml, spread, aso); one(hm, true, hs - as, hr, hml, -spread, hso);
      last.set(season + aw, as - hs); last.set(season + hm, hs - as);
    });
    return pbTeamGames = out;
  }
  function renderPlaybook() {
    if (drawStub("playbook")) return;
    if (!playbookWatched && Fan.store) { playbookWatched = true; Fan.store.watchDoc("playbook", "games", d => { if (d) { setPlaybook(d); changed("playbook"); } }, () => {}); }
    if (!playbookDoc) { $("playbook").replaceChildren(el("div", "pg-stub", "Playbook"), el("p", "pg-stub-t", Fan.screens ? "Its history pulls to this computer with your lines, and shows here when it arrives." : "Its history pulls to your own computer, which takes the desktop app.")); return; }
    const box = $("playbook"), games = pbGames(), year = Math.max(...games.map(t => t.season)), lastWk = Math.max(...games.filter(t => t.season === year).map(t => t.week));
    const roi = (p, n) => { const v = n ? p / n * 100 : null, td = el("td", v == null ? "dim" : Math.abs(v) < .05 ? "dim" : v > 0 ? "pos" : "neg", v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%"); return td; };
    const rec = (a, b, c) => a + "–" + b + (c ? "–" + c : "");
    const cells = (s, game) => {
      const dash = () => el("td", "dim", "—"), first = el("td", "pb-l", String(s.n));
      return [first, ...(game ? [dash(), dash(), dash(), dash()] : [el("td", null, rec(s.mw, s.ml)), roi(s.mp, s.mw + s.ml), el("td", null, rec(s.aw, s.al, s.ap)), roi(s.ar, s.aw + s.al)]), el("td", null, rec(s.o, s.u, s.op)), roi(s.or, s.o + s.u)];
    };
    const table = el("table"), head = el("thead"), h1 = el("tr"), h2 = el("tr"), body = el("tbody");
    const group = (text, n) => { const th = el("th", "pb-g", text); th.colSpan = n; return th; };
    h1.append(el("th"), group(String(year), 7), group(`Past 5 (${year - 5}–${year - 1})`, 8));
    const heads = ["Games", "ML", "ROI", "Spread", "ROI", "O–U", "Over ROI"];
    h2.append(el("th", null, "Situation"));
    [...heads, ...heads, "Spread z"].forEach((t, i) => h2.append(el("th", i === 0 || i === 7 ? "pb-l" : null, t)));
    h2.lastChild.title = "Spread wins minus losses over the square root of the bets: about 2 or more would be unusual for one filter, and much less so across many";
    head.append(h1, h2);
    PLAYBOOK.forEach((p, i) => {
      const all = games.filter(p.game ? t => t.home && p.f(t) : p.f), cur = pbStats(all.filter(t => t.season === year)), past = pbStats(all.filter(t => t.season < year && t.season >= year - 5));
      const tr = el("tr", "pb-s"), name = el("td", null, p.h);
      if (p.d) name.append(el("small", null, p.d));
      const z = el("td", null, p.game || !(past.aw + past.al) ? "—" : ((past.aw - past.al) / Math.sqrt(past.aw + past.al)).toFixed(1));
      tr.append(name, ...cells(cur, p.game), ...cells(past, p.game), z);
      tr.title = "Click for each season";
      tr.addEventListener("click", () => { if (pbOpen.has(i)) pbOpen.delete(i); else pbOpen.add(i); renderPlaybook(); });
      body.append(tr);
      if (pbOpen.has(i)) for (let y = year; y >= year - 5; y--) {
        const row = el("tr", "pb-y"), s = pbStats(all.filter(t => t.season === y)), lab = el("td", null, String(y)), gap = el("td", "pb-l");
        lab.style.paddingLeft = "24px"; gap.colSpan = 8;
        row.append(lab, ...cells(s, p.game), gap);
        body.append(row);
      }
    });
    table.append(head, body);
    box.replaceChildren(el("p", "pb-note", `Regular season, closing lines (nflverse, as of ${new Date(playbookDoc.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).replace(",", "")}); ${year} is through Week ${lastWk}. ROI is a flat bet on the situation's side at the closing price. Click a row for each season. With this many filters, most hot numbers are noise.`), table);
  }
  // Graphs: Week 8 as two scatters, underdogs on the left and favorites on the right, and a histogram of this season's results below them.
  // In each scatter every team is a point: point spread across (favorites' negative spreads run right) and moneyline up the page.
  // The two teams of a game mirror each other, so each lands in its own graph.
  // Shared by the Graphs and Season stats panels: an SVG with an add() helper, and a titled cell around one.
  const SVG_NS = "http://www.w3.org/2000/svg";
  const mkSvg = (w, h, label) => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.setAttribute("width", w); svg.setAttribute("height", h); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", label);
    const add = (tag, attrs, text, parent = svg) => { const n = document.createElementNS(SVG_NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); if (text != null) n.textContent = text; parent.append(n); return n; };
    return { svg, add };
  };
  const cell = (title, svg, wide) => {
    const c = el("div", "xycell" + (wide ? " wide" : ""));
    if (title) c.append(el("div", "cap", title));
    c.append(svg);
    return c;
  };

  // Season stats panel: so far the histogram of this season's real results.
  function renderSeason() {
    if (drawStub("season")) return;
    const box = $("season"), pad = 22;   // pad: a cell's border and padding
    const W = Math.max(560, box.clientWidth - 32);
    box.replaceChildren();
    box.append(el("h2", null, "Season stats"), el("small", null, "2026 regular season · real results only (weeks 1–6 hardcoded, weeks 7 and 8 from the live slate as games finish)"));
    // Histogram of this season real results: how many games ended with each margin of victory, one-point buckets from 1 to 25+ (the last
    // bucket holds every bigger margin). Each game is counted once; a tie has no margin and is only noted in the caption.
    const nflWeeks = Object.keys(WEEK_GAMES).map(Number).filter(w => w <= 18), results = nflWeeks.flatMap(w => WEEK_GAMES[w].filter(g => g.final).map(g => g.final)), lastPlayed = Math.max(0, ...nflWeeks.filter(w => WEEK_GAMES[w].some(g => g.final)));
    const counts = new Map(), K = 25;
    let ties = 0;
    results.forEach(([a, h]) => {
      const margin = Math.abs(a - h);
      if (!margin) { ties++; return; }
      const k = Math.min(margin, K);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const Wh = W - pad, Hh = 340, mh = { l: 84, r: 80, t: 30, b: 40 };
    const { svg: hs, add: hadd } = mkSvg(Wh, Hh, "Histogram of 2026 game margins of victory");
    const bwid = (Wh - mh.l - mh.r) / K, XH = k => mh.l + (k - 0.5) * bwid;   // bucket k is centered at XH(k)
    const hTop = mh.t + 10, hBase = Hh - mh.b, hMax = Math.max(...counts.values()), bw = bwid - 8;
    for (let k = 1; k <= K; k++) {
      hadd("line", { x1: XH(k), x2: XH(k), y1: mh.t - 10, y2: hBase, class: "grid" });
      hadd("text", { x: XH(k), y: hBase + 18, "text-anchor": "middle" }, k === K ? K + "+" : String(k));
    }
    hadd("line", { x1: mh.l, x2: Wh - mh.r, y1: hBase, y2: hBase, class: "base" });
    for (let k = 1; k <= K; k++) {
      const n = counts.get(k) || 0;
      if (!n) continue;
      const bh = (hBase - hTop) * n / hMax;
      hadd("rect", { x: XH(k) - bw / 2, y: hBase - bh, width: bw, height: bh, class: "bar win" + (k === K ? " end" : "") });
      hadd("text", { x: XH(k), y: hBase - bh - 6, "text-anchor": "middle", class: "cnt" }, String(n));
    }
    box.append(cell(`Season results · ${results.length} games, weeks 1–${lastPlayed} · margin of victory, each game counted once · 25+ includes bigger margins${ties ? ` · ${ties} tie${ties > 1 ? "s" : ""} not shown` : ""}`, hs, true));
  }

  // A team helmet drawn inside an svg (the Graphs badges): natural size is read from the PNG header of its data URI, and the empty left margin
  // (HELM_PAD, the same trim the game cards use) is cropped with a nested viewBox.
  const helmSizes = new Map();
  function helmetBox(n, h) {
    if (!helmSizes.has(n)) {
      const uri = HELMETS[n] || "", b = atob(uri.slice(uri.indexOf(",") + 1, uri.indexOf(",") + 45));
      const u32 = o => ((b.charCodeAt(o) << 24) | (b.charCodeAt(o + 1) << 16) | (b.charCodeAt(o + 2) << 8) | b.charCodeAt(o + 3)) >>> 0;
      helmSizes.set(n, uri ? [u32(16), u32(20)] : [104, 80]);
    }
    const [iw, ih] = helmSizes.get(n), pad = (HELM_PAD[n] || 0) / 100 * iw;
    return { iw, ih, pad, w: (iw - pad) * h / ih };
  }
  function helmetSvg(add, parent, n, x, y, h) {
    if (!HELMETS[n]) return;
    const { iw, ih, pad, w } = helmetBox(n, h);
    const box = add("svg", { x, y, width: w, height: h, viewBox: `${pad} 0 ${iw - pad} ${ih}`, overflow: "visible" }, null, parent);
    add("image", { href: HELMETS[n], x: 0, y: 0, width: iw, height: ih }, null, box);
    box.style.pointerEvents = "none";
  }
  function renderXY(again = true) {
    const box = $("xy"), games = graphGames();
    const avail = box.clientWidth;   // measured with the old graphs still in place, so a scrollbar they caused is already counted
    box.replaceChildren();
    const pts8 = games.flatMap(g => [0, 1].map(i => ({ g, side: i ? "home" : "away", ml: g.line.ml[i], sp: i ? -g.line.sp : g.line.sp })));
    const xs = pts8.map(p => p.ml), ys = pts8.map(p => p.sp);
    // The moneyline axes are logarithmic in decimal odds, so the empty stretch between -100 and +100 disappears; ticks are labeled back in American odds.
    const lg = ml => Math.log(decimalOf(ml));
    // The curve is a key-number model, not a polynomial: the moneyline a spread implies comes from the NFL's final-margin distribution, which
    // is lumpy (3, 7, 6, 10, 14 land far more often than their neighbors), so the curve has real steps where the market does. Only the
    // spread of margins (sigma) is fitted, by least squares on log decimal odds over every chip; see marginModel.
    const sigma = (() => {
      const sps = [...new Set(pts8.map(p => p.sp))];   // each distinct spread is solved once per sigma
      const ys = sps.map(sp => { const q = pts8.filter(p => p.sp === sp); return [sp, q.length, q.reduce((t, p) => t + lg(p.ml), 0) / q.length, q.reduce((t, p) => t + lg(p.ml) ** 2, 0)]; });
      let best = null;
      for (let sg = 8; sg <= 22.001; sg += 0.25) {
        const win = marginModel(sg);
        const sse = ys.reduce((t, [sp, n, mean, sq]) => { const f = -Math.log(win(-sp)); return t + sq - 2 * f * n * mean + n * f * f; }, 0);
        if (!best || sse < best[1]) best = [sg, sse];
      }
      return best[0];
    })();
    const winProb = marginModel(sigma);
    const fit = sp => -Math.log(winProb(-sp));   // log decimal odds of a team with this spread (positive = underdog)
    // Distance from the curve along the y-axis, in moneyline points: positive = above the curve (shorter odds than it implies).
    // American odds jump from -100 to +100, so points are counted on the closed-up scale where even money is 0 (+150 is 50, -150 is -50).
    const pointsOf = l => { const d = Math.exp(l); return d >= 2 ? (d - 2) * 100 : 100 - 100 / (d - 1); };
    const off = p => pointsOf(fit(p.sp)) - pointsOf(lg(p.ml));
    // The moneyline the curve implies at a spread, as American odds.
    const impliedML = sp => { const d = Math.exp(fit(sp)); return Math.round(d >= 2 ? (d - 1) * 100 : -100 / (d - 1)); };
    const offText = v => { const r = Math.round(v); return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r); };
    // Each chip shows the better price of the two ways to back the team, net of vig: expected return per dollar of the moneyline (the model's
    // chance of winning outright at the market moneyline) against the point spread (the model's chances of covering, pushing and losing at the
    // spread's own price). Both use the actual prices, so the vig is already in them.
    const spreadPrice = p => p.g.line.spj[p.side === "home" ? 1 : 0];
    const evML = p => evMoneyline(winProb, p);
    const evPts = p => evPoints(winProb, p);
    const showsML = p => evML(p) >= evPts(p);
    // Games to highlight: the underdog's better price is the points while the favorite's is the moneyline (both chips of the game get the border).
    // The two prices differ by a percent or so of return, which a one-cent quote move can flip, so the rule has a tolerance that grows with the
    // spread (bigger spreads, wider markets): the favorite's moneyline may trail its points, and the underdog's points its moneyline, by a combined
    // TOL_PER_POINT of return per $1 for every point of spread (0.5% a point: 1.75% at +3.5, 2.75% at +5.5). Exact passes (both legs better) count too.
    const hot = new Set(games.filter(g => {
      const two = pts8.filter(p => p.g === g), fav = two.find(p => p.sp < 0), dog = two.find(p => p.sp > 0);
      if (!fav || !dog) return false;
      return pairFlagged(winProb, fav, dog);
    }));

    const W = Math.max(560, avail), gap = 12, pad = 0;   // no boxes, so no border or padding to allow for
    const S = Math.max(2, Math.ceil((Math.max(...ys.map(Math.abs)) + 1) / 2) * 2);   // spreads shown each way from 0

    // dir +1: underdogs (positive spreads, +S at the left, 0 at the right); dir -1: favorites (negative spreads, 0 at the left, -S at the right).
    // Hg keeps the whole panel inside the viewport (no vertical scrolling at 1710x940); a portrait window runs it down to the bottom strip's text row
    const portraitH = matchMedia("(orientation: portrait)").matches ? window.innerHeight - document.querySelector(".tabrows.bottom").offsetHeight - 36 - 8 - (box.getBoundingClientRect().top + window.scrollY) : 0;
    const Wg = Math.max(260, Math.floor((W - gap) / 2) - pad), Hg = Math.max(768, Math.floor(portraitH)), m = { l: 84, r: 80, t: 24, b: 104 };
    function graph(list, dir, label) {
      const { svg, add } = mkSvg(Wg, Hg, label);
      const lgs = list.map(p => lg(p.ml)), lo = Math.min(...lgs), hi = Math.max(...lgs), padY = Math.max(0.05, (hi - lo) * 0.07);
      const x0 = lo - padY, x1 = hi + padY;
      const plotL = m.l, plotR = Wg - m.r;
      const SX = v => dir > 0 ? plotL + (S - v) / S * (plotR - plotL) : plotL + (-v) / S * (plotR - plotL);
      // Favorites: short odds on top. Underdogs: the axis is inverted, so the longest odds are on top.
      const LY = l => m.t + (dir > 0 ? (x1 - l) : (l - x0)) / (x1 - x0) * (Hg - m.t - m.b), MY = v => LY(lg(v));
      let lastTick = null;
      [-1000, -800, -600, -500, -400, -300, -250, -200, -150, -120, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000]
        .filter(v => lg(v) >= x0 && lg(v) <= x1)
        .filter(v => (lastTick === null || Math.abs(MY(v) - lastTick) >= 32) && (lastTick = MY(v), true))   // keep labels from running together
        .forEach(v => { add("line", { x1: plotL, x2: plotR, y1: MY(v), y2: MY(v), class: "grid" }); add("text", { x: plotL - 10, y: MY(v), "text-anchor": "end", "dominant-baseline": "central" }, odds(v)); });
      // Under the spread axis: the spread at every whole point, then the moneyline the curve implies at every half point (a property of the spread,
      // not of any game). Whole points sit on the first row and the .5s on a second row so neighbors never run together. No value at 0.
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
      // American odds have no zero: even money (+100 and -100 are the same price) gets a line wherever it falls in this graph.
      if (dir < 0 && lg(100) >= x0 && lg(100) <= x1) {   // drawn on the favorites graph only: the underdogs graph has no even-money line
        add("line", { x1: plotL, x2: plotR, y1: MY(100), y2: MY(100), class: "zero" });
        if (dir < 0) add("text", { x: plotR, y: MY(100) - 6, "text-anchor": "end", class: "ax" }, "Even money");   // the underdogs graph leaves its line unlabeled
      }
      // Each team is a badge like the one on its game card: team colors, the abbreviation and its helmet at the left, overhanging the badge. The
      // badge's place along the spread axis carries information, so it is only nudged a little sideways (in both graphs the teams whose points are the
      // better price go right and the moneyline ones left) and otherwise moves up or down to stay clear of its
      // neighbors, tied back to the true price by a thin line and a dot.
      const CW = 132, CH = 36, GAP = 8, HH = CH + 14, HO = 9, NUDGE = 14, placed = [];   // the game card badge: helmet 14px taller than the badge, overhanging 9px on the left
      const spots = [];
      for (let k = -250; k <= 250; k++) spots.push(k * 6);
      spots.sort((a, b) => Math.abs(a) - Math.abs(b));
      const free = (cx, cy) => placed.every(q => Math.abs(q[0] - cx) >= CW + GAP || Math.abs(q[1] - cy) >= CH + GAP);
      const lines = add("g", {}), marks = add("g", {});
      list.slice().sort((a, b) => a.ml - b.ml || a.sp - b.sp).forEach(p => {
        const k = teamLook(p.g, p.side), name = last(p.g[p.side]), tx = SX(p.sp), ty = MY(p.ml);
        const hw = helmetBox(name, HH).w;   // the helmet's width at this height, with its empty left margin trimmed
        const lo = plotL + CW / 2 + HO, hi = plotR - CW / 2;
        const bx = Math.max(lo, Math.min(hi, tx + (showsML(p) ? -NUDGE : NUDGE)));   // kept inside the plot so it never covers the axis labels
        const dy = spots.find(oy => free(bx, ty + oy)) || 0;
        const cx = bx, cy = ty + dy;
        placed.push([cx, cy]);
        if (Math.abs(cx - tx) > 2 || Math.abs(cy - ty) > 2) {
          add("line", { x1: tx, y1: ty, x2: cx, y2: cy, stroke: k.outline || k.bg, "stroke-width": 1, opacity: .7 }, null, lines);
          add("circle", { cx: tx, cy: ty, r: 3, fill: k.bg, stroke: k.outline || k.fg, "stroke-width": 1 }, null, lines);
        }
        const grp = add("g", { class: "mk", "data-game": gameLabel(p.g), "data-side": p.side }, null, marks);
        if (hot.has(p.g)) add("rect", { x: cx - CW / 2 - 4, y: cy - CH / 2 - 4, width: CW + 8, height: CH + 8, class: "flag" }, null, grp);
        add("rect", { x: cx - CW / 2, y: cy - CH / 2, width: CW, height: CH, rx: 4, fill: k.bg }, null, grp);   // 4px corners like the card badge, no outline
        const inside = hw - HO, tcx = cx + inside / 2;   // the text is centered in what the helmet leaves of the badge
        add("text", { x: tcx, y: cy - 7, style: `fill:${k.fg}` }, abbr(name), grp);
        // Second line: the better of the two prices, net of vig: the moneyline, or the point spread with its price (see evML / evPts).
        const second = showsML(p) ? odds(p.ml) : pts(p.sp).replace(/\d+(\.\d+)?/, v => Number(v).toFixed(1)) + " " + odds(spreadPrice(p));
        add("text", { x: tcx, y: cy + 9, class: "off", style: `fill:${k.fg}` }, second, grp);
        helmetSvg(add, grp, name, cx - CW / 2 - HO, cy - HH / 2, HH);
      });
      return svg;
    }
    const dogs = pts8.filter(p => p.sp > 0), favs = pts8.filter(p => p.sp <= 0);
    const row = el("div", "xyrow");
    row.append(cell(null, graph(dogs, 1, `Scatter of Week ${curWeek} underdogs: point spread against moneyline`)),
      cell(null, graph(favs, -1, `Scatter of Week ${curWeek} favorites: point spread against moneyline`)));

    box.append(row);
    // The opportunity this panel hunts for: a game whose underdog is better backed with the points while its favorite is better backed with the
    // moneyline (the `hot` set). Those games get a connector line between their two badges, drawn in an overlay svg over the whole panel.
    const link = document.createElementNS(SVG_NS, "svg"); link.setAttribute("class", "xylink"); box.append(link);
    {
      const hotNames = new Set([...hot].map(gameLabel)), br = box.getBoundingClientRect();
      const mk = (tag, attrs) => { const n = document.createElementNS(SVG_NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); link.append(n); };
      const rc = n => { const r = n.querySelector("rect:not(.flag)").getBoundingClientRect(); return { l: r.left - br.left, r: r.right - br.left, y: (r.top + r.bottom) / 2 - br.top }; };
      hotNames.forEach(name => {
        const two = [...box.querySelectorAll("g.mk")].filter(g => g.dataset.game === name);
        if (two.length !== 2) return;
        const [a, b] = two.map(rc), [L, R] = a.l < b.l ? [a, b] : [b, a];   // from the left badge's right edge to the right badge's left edge
        mk("line", { x1: L.r, y1: L.y, x2: R.l, y2: R.y, stroke: "#ffb52e", "stroke-width": 2, opacity: .95 });
        mk("circle", { cx: L.r, cy: L.y, r: 3.5, fill: "#ffb52e" }); mk("circle", { cx: R.l, cy: R.y, r: 3.5, fill: "#ffb52e" });
      });
    }
    // Hovering a badge of one of those games shows what taking BOTH highlighted bets would look like: the game detail graph (P/L by final margin and
    // total) for $100 on the favorite's moneyline plus $100 on the underdog's points, each at its own price. The pairs are rebuilt on every draw;
    // the listeners are wired once per panel and read them from the panel.
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
        pop = el("div", "xypair");
        pop.dataset.game = chip.dataset.game;
        const dogPts = pts(dog.sp).replace(/\d+(\.\d+)?/, v => Number(v).toFixed(1));
        const S = Math.abs(dog.sp), start = Math.floor(S) + 1, favName = last(g[fav.side]), dogName = last(g[dog.side]);
        const K2 = Math.floor(S) + 4.5, K3 = 3.5, k2f = Math.floor(K2);   // the step function's second rung (the blowout starts past it) and the small-upset rung
        const F = fav.side === "home" ? 1 : -1, an = last(g.away), T0 = Math.round(g.line.tot);   // x = home margin = F * the favorite's margin M
        const usd = v => "$" + Math.round(v).toLocaleString("en-US"), sgn = v => (v < 0 ? "−" : "+") + usd(Math.abs(v));
        // EXISTING position on this game: its straight bets and same-game parlays. Multi-game parlays are NOT counted: they need other games to win too, and the
        // game detail graph only values their share by assuming those other legs win, which would flatter the position (they are listed so you can see them).
        // exAt(M) is the position's profit when the favorite wins by M (negative M: the underdog wins by -M).
        const bets0 = gameBets(g), parlays0 = parlayShares(g);
        const atX = new Map(); outcomes(g, bets0).forEach(({ x, T }) => atX.set(x, [...(atX.get(x) || []), T]));
        const exAt = M => { const x = F * M; return Math.min(...(atX.get(x) || [Math.max(T0, Math.abs(x))]).map(T => bets0.reduce((s, t) => s + ticketPL(t, an, x, T), 0))); };
        const worstOf = (lo, hi) => { let w = Infinity; for (let M = lo; M <= hi; M++) w = Math.min(w, exAt(M)); return w; };
        // TARGET SHAPE, five regions of the favorite's margin M: a big upset (underdog by 4+), a small upset (underdog by 1 to 3, the key number 3), the favorite by
        // less than the spread, the favorite just past it (up to the second rung K2 = S + 4: 11 to 14 for +10.5) and a blowout (past K2). The step function is
        // what sets the rungs. Legs: the favorite's moneyline (top-up to a $1,000 total), underdog +S (d), underdog +K2 (b) and "the underdog does NOT win by over 3"
        // (c, pays on every favorite win and a small upset, loses on a big upset). Four conditions fix d, b, c:
        //   blowout worst = 0; the just-past-spread band worst = BAND_KEEP of the moneyline's profit on the base; small-upset worst = (1 - NARROW) x big-upset worst.
        // With r = profit per $1 of each leg, E_* = the existing position's worst in a region and U0 = -aNew + rD*D0 + rB*b, D0 = E_blow + rML*aNew - b:
        //   b = (BK - E_band + E_blow)/(1 + rB),  c = [(1 - NARROW)(E_big + U0) - (E_nar + U0)] / [rN(1 + rD) + (1 - NARROW)(1 - rD*rN)],  d = D0 + rN*c.
        // A leg whose stake comes out negative is dropped (the position already has enough of it). Prices: the market's asks from the slate (`band`, `venue`);
        // without them the key-number model's chances plus a 2% haircut for the vig.
        const rML = profitOf(1, fav.ml), rD = profitOf(1, dogPrice);
        const bd = g.band && g.band.fav === fav.side && g.band.K === S ? g.band : null;
        const model = (a, b) => winProb.band(-fav.sp, a, b);
        const c2 = bd ? bd.c2 : Math.min(0.95, (1 - model(k2f + 1, 70)) * 1.02), c3 = bd && bd.c3 ? bd.c3 : Math.min(0.97, (1 - model(-70, -4)) * 1.02);
        const rB = (1 - c2) / c2, rN = (1 - c3) / c3;
        const exML = bets0.filter(t => !t.parlay && !t.bonus && t.type === "Moneyline" && t.side === favName).reduce((s, t) => s + t.amount, 0);
        const aNew = Math.max(0, base - exML);
        const Eblow = worstOf(k2f + 1, 60), Eband = worstOf(start, k2f), Enar = worstOf(-3, -1), Ebig = worstOf(-60, -4);
        const { bNew, cNew, dNew } = pairStakes({ aNew, rML, rD, rB, rN, Eblow, Eband, Enar, Ebig });
        const priceOdds = americanOf;   // American odds from a $1-payout price
        const mk = (type, side, line, odds, amount) => ({ type, side, line, odds, amount, key });
        const new0 = [aNew > 0 ? { type: "Moneyline", side: favName, line: fav.ml, amount: aNew, key } : null, dNew > 0.5 ? mk("Spread", dogName, dog.sp, dogPrice, dNew) : null,
          bNew > 0.5 ? mk("Spread", dogName, K2, priceOdds(c2), bNew) : null, cNew > 0.5 ? mk("Spread", favName, K3, priceOdds(c3), cNew) : null].filter(Boolean);
        const bets = [...bets0, ...new0];
        // the new legs' profit by margin (the last leg is the underdog's -3.5 seen from the favorite: it wins when the favorite wins or the underdog wins by 1 to 3)
        const mlNew = M => (M > 0 ? rML * aNew : M < 0 ? -aNew : 0), fD = M => (M < S ? rD : M > S ? -1 : 0), fB = M => (M < K2 ? rB : -1), fN = M => (M > -K3 ? rN : -1);
        const afterAt = M => exAt(M) + mlNew(M) + (dNew > 0.5 ? dNew * fD(M) : 0) + (bNew > 0.5 ? bNew * fB(M) : 0) + (cNew > 0.5 ? cNew * fN(M) : 0);
        const lows = (f, lo, hi) => { let w = Infinity; for (let M = lo; M <= hi; M++) w = Math.min(w, f(M)); return w; };
        const regions = [[`${dogName} by 4+`, -60, -4], [`${dogName} by 1–3`, -3, -1], [`${favName} by 1–${start - 1}`, 1, start - 1], [`${favName} by ${start}–${k2f}`, start, k2f], [`${favName} by ${k2f + 1}+`, k2f + 1, 60]];
        const line = f => regions.map(([n, lo, hi]) => `${n} ${sgn(lows(f, lo, hi))}`).join(" · ");
        // The chances, indexed by the moneylines (the market's stated win %) and the ladder rungs the legs trade, when the slate has them.
        const v = g.venue, dogSide = fav.side === "home" ? "away" : "home";
        let chances = null;
        if (bd && bd.c3 && v) {
          const pFav = v.ml[fav.side][1] / (v.ml[fav.side][1] + v.ml[dogSide][1]), pDog = 1 - pFav, pBig = Math.min(pDog, 1 - c3), pc = [pBig, pDog - pBig, pFav - bd.c1, bd.c1 + c2 - 1, 1 - c2];
          if (pc.every(p => p >= -0.005)) chances = pc.map(p => Math.max(0, p));
        }
        const ev = chances ? chances.reduce((s, p, i) => s + p * lows(afterAt, regions[i][1], regions[i][2]), 0) : null;
        // The transactions, where the slate saved the cheapest venue and ask; a contract pays $1, so contracts = dollars / ask. Kalshi's underdog points are the No
        // side of "<favorite> wins by over S"; Polymarket's are the underdog outcome of "Spread: <favorite> (-S)".
        const favVen = v && v.ml[fav.side], dogVen = v && v.sp.dog, b2Ven = bd && [bd.src2, c2], b3Ven = bd && bd.c3 ? [bd.src3, c3] : null;
        const px = (ven, price) => ven ? ven[1] : 1 / decimalOf(price);
        const where = (ven, p, kalshiText, polyText) => ven ? `${ven[0]} at ${Math.round(ven[1] * 100)}¢: ${ven[0] === "Kalshi" ? kalshiText : polyText}` : `at about ${Math.round(p * 100)}¢ (no venue saved for this game)`;
        const table = el("table", "xypair-t");
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
        const list = el("div", "xypair-tx");
        const have = [...bets0.filter(t => !t.parlay).map(t => `${usd(t.amount)}${t.bonus ? " bonus" : ""} ${t.side} ${t.type === "Moneyline" ? "moneyline" : pts(t.line)}`), ...(parlays0.length ? [`${parlays0.length} multi-game parlay${parlays0.length > 1 ? "s" : ""} (not counted)`] : []), ...bets0.filter(t => t.parlay).map(() => "a same-game parlay")];
        list.append(el("div", "tx sub", `Already on this game: ${have.length ? have.join(" · ") : "nothing"}`));
        if (aNew > 0) row(`${favName} to win`, aNew, favVen, fav.ml, `Yes on "${favName} win"`, `the ${favName} outcome of the moneyline market`, odds(fav.ml));
        if (dNew > 0.5) row(`${dogName} ${dogPts}`, dNew, dogVen, dogPrice, `No on "${favName} win by over ${S.toFixed(1)} points"`, `the ${dogName} outcome of "Spread: ${favName} (−${S.toFixed(1)})"`, odds(dogPrice));
        if (bNew > 0.5) row(`${dogName} +${K2.toFixed(1)}`, bNew, b2Ven, priceOdds(c2), `No on "${favName} win by over ${K2.toFixed(1)} points"`, `the ${dogName} outcome of "Spread: ${favName} (−${K2.toFixed(1)})"`, `${odd(priceOdds(c2))}${bd ? "" : ", model price"}`);
        if (cNew > 0.5) row(`${favName} +${K3.toFixed(1)} (the underdog does not win by more than 3)`, cNew, b3Ven, priceOdds(c3), `No on "${dogName} win by over ${K3.toFixed(1)} points"`, `the ${favName} outcome of "Spread: ${dogName} (−${K3.toFixed(1)})"`, `${odd(priceOdds(c3))}${bd && bd.c3 ? "" : ", model price"}`);
        if (dNew <= 0.5 && bNew <= 0.5 && cNew <= 0.5 && aNew <= 0) list.append(el("div", "tx sub", "Nothing to add: your position already meets the target."));
        else list.append(table);
        const foot = el("div", "xypair-sum");
        foot.append(el("div", null, `Now: ${line(exAt)}`), el("div", null, `After: ${line(afterAt)} · new money ${usd(aNew + [dNew, bNew, cNew].filter(x => x > 0.5).reduce((s, x) => s + x, 0))}`));
        if (chances) foot.append(el("div", null, `Chances from the market (${abbr(favName)} win ${Math.round((1 - (chances[0] + chances[1])) * 100)}%): ${chances.map((p, i) => `${regions[i][0].replace(`${dogName} by`, "upset by").replace(`${favName} by`, "fav by")} ${Math.round(p * 100)}%`).join(" · ")} · expected value about ${sgn(ev)}`));
        pop.append(el("div", "xypair-h", `To get to optimal: ${usd(base)} on the ${favName} moneyline in total; a blowout (${favName} by ${k2f + 1}+) breaks even and a small upset loses less than a big one`), riskGrid(g, bets, 640, [], [], 0, 67).el, list, foot);
        document.body.append(pop);
        place(e);
      });
    }
    // The tall graphs can bring a scrollbar that narrows the card; draw once more at the width that is left.
    if (again && Math.max(560, box.clientWidth) !== W) renderXY(false);
  }

  // Team context for the game details, from ESPN's public NFL endpoints (team records and standings, season statistics, schedule results, injury report), pulled
  // Oct 29 2026 (through Week 8's Thursday game not yet played). Keyed by nickname. r/h/a = overall, home, road record; gp games played; pf/pa points; ypg, pass, rush =
  // yards per game; td3 third-down %, rz red-zone TD %; tk/gv takeaways/giveaways; sk sacks made, skt sacks taken; res = [week, opp, home?, pf, pa] of played games; sch = the whole season [week, opp, home?, pf, pa] (scores null until played; a missing week is a bye);
  // inj = [name, pos, status, type, key] (the whole report: out, doubtful, questionable, then injured reserve; key = 1 for a statistical leader (passing yards 1, rushing yards 1, receiving yards 3, sacks 2, tackles 1, interceptions 1) or a quarterback). Refresh: ask Claude to "refresh the team data" (scratch script, see CLAUDE.md).
  // Venue, roof and forecast per game, keyed "week|Away|Home": [stadium, "City, ST", indoor 0/1, forecast text, temperature F, AccuWeather condition id] (ESPN scoreboard, Oct 29 2026;
  // ESPN only forecasts games about 11 days out, so later weeks have the venue only). Refresh: node tools/venues.js <out.json>, then replace this literal.
  // Weather icons (24px line art): the condition id picks one. Night ids (33-44) use the moon or a cloud.
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
    return `<svg class="wx-ic" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  }
  // Divisions (for rivalry / look-ahead context).
  const DIVS = [["Bills", "Dolphins", "Patriots", "Jets"], ["Ravens", "Bengals", "Browns", "Steelers"], ["Texans", "Colts", "Jaguars", "Titans"], ["Chiefs", "Raiders", "Chargers", "Broncos"],
    ["Cowboys", "Giants", "Eagles", "Commanders"], ["Bears", "Lions", "Packers", "Vikings"], ["Falcons", "Panthers", "Saints", "Buccaneers"], ["Cardinals", "Rams", "49ers", "Seahawks"]];
  const divOf = n => DIVS.findIndex(d => d.includes(n));
  // On the whiteboard a team's colors are used the dark way round: the darker of its two colors is the background, the other the text (a light-on-dark chip reads on a white board).
  function darkLook(g, side) {
    const k = teamLook(g, side);
    // no outline on the whiteboard: a black chip already contrasts with the white board, and the outline (the team's other color, white for the Ravens) read as a light frame that made the fill look smaller
    if (lumOf(k.bg) > lumOf(k.fg)) return { bg: k.fg, fg: k.bg, outline: null };
    return { bg: k.bg, fg: k.fg, outline: null };
  }
  // GAME SCRIPT: statistics and trends for each team, then injury impact, schedule spot and motivation. Returns [{cls, label, text}] (class sx, not stat: .stat b is a card rule).
  function scriptLines(g, side) {
    const nick = last(g[side]), opNick = last(g[side === "away" ? "home" : "away"]), t = TEAM_INFO[nick], op = TEAM_INFO[opNick], all = Object.values(TEAM_INFO);
    const rk = (fn, high) => { const v = fn(t); return v === null ? "–" : "#" + (1 + all.filter(x => { const y = fn(x); return y !== null && (high ? y > v : y < v); }).length); };
    const per = (n, k) => (k ? n / k : 0), f1 = v => v.toFixed(1), sg = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
    const out = [], wp = r => { const [w, l, ti = 0] = (r || "0-0").split("-").map(Number); return w + l + ti ? (w + ti / 2) / (w + l + ti) : 0; };
    const abbrOf = n => ABBR[n] || n, nickOf = ab => Object.keys(ABBR).find(k => ABBR[k] === ab);
    const add = (cls, label, text) => out.push({ cls, label, text });
    const played = (t.sch || []).filter(x => x[3] !== null);
    if (g.final) add("role", "", (g.final[0] === g.final[1] ? "TIED " : (g.final[0] > g.final[1]) === (side === "away") ? "WON " : "LOST ") + g.final[0] + "–" + g.final[1]);
    else if (pricesOn() && (g.noLine || !g.line)) add("role", "", "NO LINE YET");
    // efficiency ranks (the form / trend / splits / form-line rows were removed)
    add("sx", "Edges", "3rd down " + f1(t.td3) + "% (" + rk(x => x.td3, true) + "), red zone TD " + f1(t.rz) + "% (" + rk(x => x.rz, true) + "), turnovers " + sg(t.tk - t.gv) + " (" + rk(x => x.tk - x.gv, true) + "), sacks " + t.sk + " (" + rk(x => x.sk, true) + ") taken " + t.skt + " (" + rk(x => x.skt, false) + "), pass " + f1(t.pass) + " (" + rk(x => x.pass, true) + ") rush " + f1(t.rush) + " (" + rk(x => x.rush, true) + ")");
    // 6. injury impact: the quarterback, and clustered units
    const imp = [], qb = t.inj.find(p => p[1] === "QB" && p[2] !== "Injured Reserve");
    if (qb) imp.push("QB " + qb[0].split(" ").slice(-1)[0] + " " + (qb[2] === "Out" ? "OUT" : qb[2] === "Doubtful" ? "doubtful" : "questionable"));
    const UNITS = { OT: "O-line", G: "O-line", C: "O-line", OL: "O-line", DE: "D-line", DT: "D-line", NT: "D-line", LB: "Linebackers", ILB: "Linebackers", OLB: "Linebackers", CB: "Secondary", S: "Secondary", FS: "Secondary", SS: "Secondary", WR: "Receivers", TE: "Receivers" };
    const IMPACT = { "O-line": "pass protection and the run game at risk", "D-line": "pass rush and run defense thinned", Linebackers: "run defense and coverage thinned", Secondary: "exposed to the deep pass", Receivers: "fewer passing targets" };
    const cnt = {}; t.inj.forEach(([, pos, st]) => { if (st !== "Injured Reserve" && UNITS[pos]) cnt[UNITS[pos]] = (cnt[UNITS[pos]] || 0) + 1; });
    Object.entries(cnt).filter(([, n]) => n >= 3).forEach(([u, n]) => imp.push(u + " (" + n + "): " + IMPACT[u]));
    if (imp.length) add("inj", "Injuries", imp.join(", "));
    // 7. schedule spot
    const sch = t.sch || [], wk = g.week, byWeek = new Map(sch.map(x => [x[0], x])), spot = [];
    const dow = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" }).format(new Date(g.t));
    if (wk > 1 && !byWeek.has(wk - 1)) spot.push("off the bye (rested)");
    else if (["Thu", "Fri", "Sat"].includes(dow) && wk > 1) spot.push("short week (" + dow + ")");
    if (wk > 1 && byWeek.has(wk - 1)) { const p = byWeek.get(wk - 1); if (p[3] !== null) spot.push("off a " + (p[3] > p[4] ? "W " : p[3] < p[4] ? "L " : "T ") + p[3] + "–" + p[4] + (p[2] ? " at home" : " on the road")); }
    const nextE = sch.find(x => x[0] > wk);
    if (nextE) {
      if (nextE[0] > wk + 1) spot.push("bye next week (all-in spot)");
      const nn = nickOf(nextE[1]), nt = nn && TEAM_INFO[nn];
      if (nn && nt) { const rival = divOf(nn) === divOf(nick), strong = wp(nt.r) >= 0.7; if (rival || strong) spot.push("look-ahead: " + (nextE[2] ? "v " : "@ ") + nextE[1] + " in Wk " + nextE[0] + " (" + [rival ? "division rival" : "", nt.r].filter(Boolean).join(", ") + "), letdown risk"); }
    }
    const prevMeet = sch.find(x => x[0] < wk && x[1] === abbrOf(opNick) && x[3] !== null);
    if (prevMeet) spot.push("rematch: " + (prevMeet[3] > prevMeet[4] ? "won " : "lost ") + prevMeet[3] + "–" + prevMeet[4] + " in Wk " + prevMeet[0]);
    else if (divOf(nick) === divOf(opNick)) spot.push("division game");
    if (spot.length) add("spot", "Spot", spot.join(", "));
    // 8. motivation
    const rec = wp(t.r);
    const stand = t.r + " (" + t.stand.replace("National Football Conference", "NFC").replace("American Football Conference", "AFC") + ")" + (t.streak >= 3 ? ", W" + t.streak : t.streak <= -3 ? ", L" + Math.abs(t.streak) : "");
    add("mot", "Motivation", (rec >= 0.65 ? "contending: " : rec <= 0.3 ? "losing season: " : "in the mix: ") + stand);
    return out;
  }
  function renderGameDetail(box, g) {
    if (!leagueOf(g).gameDetails) { box.replaceChildren(el("div", "pg-stub", `${abbr(last(g.away))} @ ${abbr(last(g.home))}`), el("p", "pg-stub-t", `${leagueOf(g).code} game details are not built yet.`)); return; }
    if (!TEAM_INFO[last(g.away)] || !TEAM_INFO[last(g.home)]) {   // this browser's own pull, the first time a game detail opens
      box.replaceChildren(el("div", "pg-stub", `${abbr(last(g.away))} @ ${abbr(last(g.home))}`), el("p", "pg-stub-t", "Asking ESPN for team stats and injuries…"));
      ensureTeams().then(ok => { if (detailGame !== g) return; if (ok && TEAM_INFO[last(g.away)]) changed("cards"); else box.replaceChildren(el("div", "pg-stub", `${abbr(last(g.away))} @ ${abbr(last(g.home))}`), el("p", "pg-stub-t", "Couldn't reach ESPN for team stats.")); });
      return;
    }
    ensureTeams();
    const A = TEAM_INFO[last(g.away)], H = TEAM_INFO[last(g.home)], conf = t => (t || "").replace("National Football Conference", "NFC").replace("American Football Conference", "AFC");
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
      const r = el("div", "bd-row"), a = el("div", "v a"), l = el("div", "l", label), h = el("div", "v h");
      a.append(av); if (ar) a.append(el("small", null, "#" + ar));
      if (hr) h.append(el("small", null, "#" + hr)); h.append(hv);
      if (best === "a") a.classList.add("best"); else if (best === "h") h.classList.add("best");
      r.append(a, l, h);
      return r;
    };
    const wrap = el("div", "bd-wrap");
    if (!A || !H) { wrap.append(el("div", "bd-foot", "No team data for this matchup.")); box.replaceChildren(wrap); return; }
    // header: each team (helmet, chip, record and standing) around the game's time, network and result
    const head = el("div", "bd-head"), team = (side, t) => {
      // the game card's badge (team color, helmet overhanging at the left) with the LONG name (the nickname) instead of the abbreviation
      // the card's coloring, as it LOOKS on the card: the team's background lightened a third, blended 50% with the card paper, the team's own text color, no outline
      const d = el("div", "bd-team " + side);   // the card draws its color at 50% over its dark paper: on the white board the half-alpha would wash out, so bdBadge blends it opaque
      d.append(bdBadge(g, side));   // (the record / standings line under the badge is gone)
      return d;
    };
    // ONE info line above the team names (result, kickoff, network, stadium, city, kickoff-hour forecast); the whole top of the card sits on a weather backdrop
    let wxMid = null;
    const info = el("div", "bd-info"), part = (...n) => { if (info.childNodes.length) info.append(el("i", null, " · ")); info.append(...n); };
    if (g.final) part(el("b", null, "FINAL " + g.final[0] + " – " + g.final[1]));
    part(el("span", null, `${shortDayFmt.format(new Date(g.t))} · ${timeZoned(new Date(g.t))}`));
    if (g.tv) part(el("span", null, g.tv));
    const env = GAME_ENV[g.week + "|" + last(g.away) + "|" + last(g.home)];
    if (env) {
      if (env[0]) part(el("span", null, env[0]));
      if (env[1]) part(el("span", null, env[1]));
      if (!g.final && !env[2] && env[3]) { wxMid = el("div", "bd-wxmid"); wxMid.title = "Forecast for kickoff"; wxMid.innerHTML = weatherIcon(env[5], false) + "<span>" + (env[4] !== null ? env[4] + "° " : "") + env[3] + "</span>"; }   // the kickoff forecast sits in the middle between the badges; an indoor stadium has none
    }
    head.dataset.scene = "";
    if (env && !g.final) {
      const id = Number(env[5]) || 0, inList = l => l.includes(id);
      head.dataset.scene = env[2] ? "dome" : !env[3] ? "none" : inList([15, 16, 17, 41, 42]) ? "storm" : inList([12, 13, 14, 18, 26, 39, 40]) ? "rain" : inList([19, 20, 21, 22, 23, 24, 25, 29, 31, 43, 44]) ? "snow" : id === 11 ? "fog" : inList([33, 34, 35, 36, 37, 38]) ? "night" : inList([1, 2, 5, 30]) ? "clear" : inList([3, 4]) ? "partly" : "cloudy";
    }
    head.append(info, team("away", A), team("home", H)); if (wxMid) head.append(wxMid);
    // the head-to-head table
    const rows = el("div", "bd-rows");
    const cmp = (x, y, high) => (x === null || y === null || x === y ? "" : (high ? x > y : x < y) ? "a" : "h");
    rows.append(row("Record", A.r, H.r, wp(A.r) === wp(H.r) ? "" : wp(A.r) > wp(H.r) ? "a" : "h"));
    rows.append(row("Road · home record", A.a || "–", H.h || "–", wp(A.a) === wp(H.h) ? "" : wp(A.a) > wp(H.h) ? "a" : "h"));
    metrics.forEach(([label, fn, high, fmt]) => {
      const x = fn(A), y = fn(H);
      rows.append(row(label, x === null ? "–" : fmt(x), y === null ? "–" : fmt(y), cmp(x, y, high), x === null ? 0 : rank(fn, high, x), y === null ? 0 : rank(fn, high, y)));
    });
    // last five results and the injury report, under each team
    const low = el("div", "bd-low"), half = (t, side) => {
      const d = el("div", "bd-half"), c2 = el("div", "bd-col");
      // no header: a vertical INJURIES label in the team's colors runs down the left side of the list
      const lab = el("div", "bd-vlabel", "Injuries"), list = el("div", "bd-ilist"), look = darkLook(g, side);
      lab.style.background = look.bg; lab.style.color = look.fg;
      if (look.outline) lab.style.boxShadow = "inset 0 0 0 2px " + look.outline;
      c2.append(lab, list);
      // CLUSTER injuries: three or more players from one unit on the report (out, doubtful or questionable; injured reserve is not counted), which handicappers treat as worse than one star missing
      const UNIT = { OT: "O-line", G: "O-line", C: "O-line", OL: "O-line", OG: "O-line", DE: "D-line", DT: "D-line", NT: "D-line", DL: "D-line", LB: "Linebackers", ILB: "Linebackers", OLB: "Linebackers", MLB: "Linebackers", CB: "Secondary", S: "Secondary", FS: "Secondary", SS: "Secondary", DB: "Secondary", WR: "Receivers", TE: "Receivers" }, units = {};
      t.inj.forEach(([, pos, status]) => { if (status !== "Injured Reserve" && UNIT[pos]) { const u = units[UNIT[pos]] || (units[UNIT[pos]] = { n: 0, out: 0 }); u.n++; if (status === "Out") u.out++; } });
      const clusters = Object.entries(units).filter(([, u]) => u.n >= 3).sort((p, q) => q[1].n - p[1].n);
      const clusterUnits = new Set(clusters.map(([name]) => name));
      // injured reserve first, then the game statuses (Out, Doubtful, Questionable); the sort is stable, so key players stay first within each
      [...t.inj].sort((p, q) => (q[2] === "Injured Reserve") - (p[2] === "Injured Reserve")).forEach(([name, pos, status, type, key]) => {
        const ln = el("div", "bd-line" + (key ? " key" : "") ), inClu = status !== "Injured Reserve" && clusterUnits.has(UNIT[pos]), nm = name.split(" "), short = nm.length > 1 ? nm[0][0] + ". " + nm.slice(1).join(" ") : name, k = status === "Out" ? "out" : status === "Doubtful" ? "doubt" : status === "Injured Reserve" ? "ir" : "q";
        const nmEl = el("span", "nm", short + " "), posEl = el("span", inClu ? "pos clu" : "pos", pos);   // the position text carries the cluster highlight
        nmEl.append(posEl);
        ln.append(nmEl, el("span", "st " + k, status === "Out" ? "OUT" : status === "Doubtful" ? "DOUBT" : status === "Injured Reserve" ? "IR" : "Q"), el("span", "dim", type));
        list.append(ln);
      });
      if (!t.inj.length) list.append(el("div", "bd-line dim", "none listed"));
      // the whole schedule, weeks 1-18 in three columns of six: results where played, the matchup being viewed highlighted, byes marked
      const c3 = el("div", "bd-col bd-sched"), grid = el("div", "bd-sgrid"), byWeek = new Map((t.sch || []).map(x => [x[0], x]));
      c3.style.setProperty("--tc", darkLook(g, side).bg);   // a very light team color theme for the schedule
      // a vertical SCHEDULE label like the injuries one, team colored, the full height of the panel on its left
      const slab = el("div", "bd-vlabel sched", "Schedule"), sdk = darkLook(g, side);
      slab.style.background = sdk.bg; slab.style.color = sdk.fg;
      if (sdk.outline) slab.style.boxShadow = "inset 0 0 0 2px " + sdk.outline;
      c3.append(slab);
      for (let wk = 1; wk <= 18; wk++) {
        const e = byWeek.get(wk), cell = el("div", "bd-sc" + (e && wk === g.week ? " cur" : "") + (!e ? " bye" : ""));
        cell.append(el("span", "dim wk", String(wk)));
        if (!e) cell.append(el("span", "dim bye-w", "BYE"));
        else {
          cell.append(el("span", "nm", (e[2] ? "v " : "@ ") + e[1]));
          if (e[3] === null) cell.append(el("span", "dim", "–"));
          else { const won = e[3] > e[4], tie = e[3] === e[4]; cell.append(el("span", won ? "w" : tie ? "dim" : "x", (won ? "W " : tie ? "T " : "L ") + e[3] + "–" + e[4])); }
        }
        grid.append(cell);
      }
      // two empty cells after Week 18 so the vertical rules run to the bottom of the last column too
      for (let k = 0; k < 2; k++) grid.append(el("div", "bd-sc blank"));
      grid.style.flex = "1"; grid.style.minWidth = "0";
      c3.append(grid);
      // the game script: plain text straight on the board (no label, no panel), from scriptLines
      const c4 = el("div", "bd-col bd-sched bd-script"), sbody = el("div", "bd-sbody");
      c4.style.setProperty("--tc", darkLook(g, side).bg);   // only the role line uses it
      scriptLines(g, side).forEach(l => { const row = el("div", "bd-sl " + l.cls); if (l.label) row.append(el("b", null, l.label + " ")); row.append(document.createTextNode(l.text)); sbody.append(row); });
      c4.append(sbody);
      d.append(c2, c4, c3);
      return d;
    };
    // as many injuries as the report has, in type that shrinks with the longer team's list so both fit; both schedules then start at the same height
    const nInj = Math.max(A.inj.length, H.inj.length, 1), lh = Math.max(14, Math.min(22, Math.floor(250 / nInj))), lfs = Math.max(10, Math.min(14, Math.round(lh * 0.56)));
    low.style.setProperty("--lh", lh + "px"); low.style.setProperty("--lfs", lfs + "px");
    low.append(half(A, "away"), half(H, "home"));
    [...low.children].forEach(d => { d.style.gridTemplateRows = (nInj * lh + 2) + "px auto minmax(0, 1fr)"; });   // injuries (a block as tall as the longer list), the script right under it, the schedule pinned to the bottom of the board
    wrap.append(head, low);
    box.replaceChildren(wrap);
    // a short window shrinks the board: tighten the injury rows (then the script type) until the script clears the schedule and nothing is cut off at the bottom
    {
      let lhNow = lh, sfs = 14.5;
      const setRows = () => { low.style.setProperty("--lh", lhNow + "px"); low.style.setProperty("--lfs", Math.max(10, Math.min(14, Math.round(lhNow * 0.56))) + "px"); [...low.children].forEach(d => { d.style.gridTemplateRows = (nInj * lhNow + 2) + "px auto minmax(0, 1fr)"; }); };
      for (let i = 0; i < 24; i++) {
        const scs = [...box.querySelectorAll(".bd-script")], sch = [...box.querySelectorAll(".bd-half > .bd-sched:not(.bd-script)")];
        const deficit = Math.max(low.scrollHeight - low.clientHeight - 1, ...scs.map((e, k) => e.getBoundingClientRect().bottom - sch[k].getBoundingClientRect().top));
        if (deficit <= 0.5) break;   // (the label bleeds 1px past the panel: a 1px scroll overflow is not a real deficit)
        if (lhNow > 13) { lhNow = Math.max(13, lhNow - Math.max(1, Math.ceil(deficit / nInj))); setRows(); }
        else if (sfs > 10.5) { sfs -= 0.5; low.style.setProperty("--sfs", sfs + "px"); }
        else break;
      }
    }
    // the two script panels share one height so their top edges (and the schedules under them) line up (measured after the board is in the page)
    const sp = [...box.querySelectorAll(".bd-script")], sh = Math.max(0, ...sp.map(e => e.offsetHeight));
    sp.forEach(e => { e.style.minHeight = sh + "px"; });
  }
export { renderGameDetail, renderPlaybook, renderSeason, renderXY, setPlaybook };
