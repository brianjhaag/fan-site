// The Handicap section (the NFL first; the user, Nov 4 2026): each game's own numbers to the user's spread and moneylines, against the market's. Moved out of panels.js.
import { divideX } from "./layout.js?v=mw46i2a7";
import { WEEK_GAMES, dvoaNow, pastNflGames } from "./espn.js?v=mw46i2a7";
import { Fan } from "./hosts.js?v=mw46i2a7";
import { GAME_CARD_ACTIONS, GAMES, setDetailGame, showView, switchWeek, helmImg, hasArt, league, nick, $, RULES, changed, curWeek, drawStub, el, gameKey, last, later, marginModel, odds, view, weekNow } from "./base.js?v=mw46i2a7";
import { TEAM, abbr } from "./leagues.js?v=mw46i2a7";
import { Calc } from "./calc.js?v=mw46i2a7";
import { divOf } from "./panels.js?v=mw46i2a7";

  /* ==== Handicap (the NFL first; the user, Nov 4 2026): your spread for each game, from numbers you set game by game, against the market's. ==== */
  // A game's visitor margin = −HFA + each term's coefficient × its value (calc.js HC_VARS and hcVisitorMargin): DVOA diff (FTN's, shown, its coefficient yours; times
  // 0.67 in a divisional game) and Off bye (the bye effect measured over 5 seasons and this one, shown, its coefficient yours). Your line is minus the margin, and the
  // key number model turns it into moneylines. Each game starts at hc.eq's numbers (HFA the average home margin over all the data) and keeps what's typed for it alone.
  // Kept in this browser and in the person's own records: the numbers, the hurdle, the margin spread (sigma) the key number model takes, and the week on screen.
  const HC_KEY = "fan.handicap.nfl";
  const hcTerm = k => { const v = Calc.HC_VARS.find(x => x.k === k) || Calc.HC_VARS[0]; return { v: v.k, coef: v.start }; };
  const hcDefault = () => ({ hurdle: RULES.userSet.hcHurdle * 100, sample: "past", showHow: false, sigma: RULES.leagues.nfl.sigma, minGames: 2, week: null, per: {}, eq: { hfa: null, terms: [hcTerm("dvoa"), hcTerm("bye")] }, fit: null });
  const hcParse = s => { const d = hcDefault(); if (!s || typeof s !== "object") return d; const ok = s.eq && Array.isArray(s.eq.terms); return { ...d, ...s, eq: ok ? s.eq : d.eq, fit: ok ? s.fit : null }; };   // an equation from before terms (0.48.10) starts again
  const hc = (() => { try { return hcParse(JSON.parse(localStorage.getItem(HC_KEY))); } catch (e) { return hcDefault(); } })();
  function hcMigrate() {
    if (!hc.per || typeof hc.per !== "object") hc.per = {};   // each game's own numbers, typed by hand (the user, Nov 4 2026)
    ["spread", "total", "adj"].forEach(k => { delete hc[k]; });   // the earlier screens' (0.48.8, 0.48.9): a regression card, a total model, a points adjustment per game
    hc.eq.terms = hc.eq.terms.filter(t => t.v === "dvoa" || t.v === "bye");   // V MOV and Blowout L went (the user, Nov 4 2026)
    ["dvoa", "bye"].forEach(k => { if (!hc.eq.terms.some(t => t.v === k)) hc.eq.terms.push(hcTerm(k)); });   // and DVOA diff and Off bye join an equation saved before them
    { const at = ["dvoa", "bye"]; hc.eq.terms.sort((p, q) => at.indexOf(p.v) - at.indexOf(q.v)); }   // DVOA diff, then (with Divisional between) Off bye at the far right (the user, Nov 4 2026)
    // Off bye became a coefficient on the measured adjustment (the user, Nov 4 2026): it starts at 1, and what was typed for it before means something else now
    hcOneDecimal();
    if (!hc.byeAdj) { hc.byeAdj = true; hc.eq.terms.forEach(t => { if (t.v === "bye") t.coef = 1; }); Object.values(hc.per).forEach(s => { ["bye", "bye:a", "bye:h", "bye:adj"].forEach(k => { if (s.c) delete s.c[k]; if (s.x) delete s.x[k]; }); }); }
  }
  // coefficients to one decimal (the user, Nov 4 2026), the ones kept from before too
  const hcOneDecimal = () => { if (hc.coef1) return; hc.coef1 = true; const r1 = v => Math.sign(v) * Math.round(Math.abs(v) * 10) / 10; hc.eq.terms.forEach(t => { t.coef = r1(t.coef); }); Object.values(hc.per).forEach(s => { Object.keys(s.c || {}).forEach(k => { s.c[k] = r1(s.c[k]); }); }); };   // runs before hcRound exists
  hcMigrate();
  // Kept in this browser at once, and in the person's own records a moment later (the user, Nov 4 2026: "defintely need to save edits on the real thing"): the
  // connector's records on this computer, backed up with them and read by any browser here, or this browser's own store with no connector.
  let hcStoreTimer = null, hcFromStore = false;
  const hcSave = () => {
    try { localStorage.setItem(HC_KEY, JSON.stringify(hc)); } catch (e) {}
    clearTimeout(hcStoreTimer); hcStoreTimer = setTimeout(() => { if (Fan.store) Fan.store.set("handicap", "nfl", JSON.parse(JSON.stringify(hc))).catch(() => {}); }, 800);
  };
  // The records' copy, read once: it wins over this browser's, and with none there, this browser's goes in. Read at page load, not when the Handicap opens (the user, Nov 4 2026: the table "flexes into place after some redraw": the records' copy came in after the first
  // draw and built it all again). hcStoreDone: the records have answered, or there are none to ask; the Handicap waits for that before its first draw, for at most
  // HC_STORE_WAIT, and a copy the same as this browser's builds nothing again.
  const HC_STORE_WAIT = 1500, hcStarted = Date.now();
  let hcStoreDone = false;
  const hcStoreSettled = () => { hcStoreDone = true; if (!$("handicap").hidden && !$("handicap").querySelector(".hc-games")) drawHandicap(); };
  const hcLoadStore = () => {
    if (hcFromStore || !Fan.store) return;
    hcFromStore = true;
    Fan.store.get("handicap", "nfl").then(s => {
      if (!s || typeof s !== "object" || !s.eq) { hcSave(); hcStoreSettled(); return; }
      const was = JSON.stringify(hc);
      Object.keys(hc).forEach(k => { delete hc[k]; }); Object.assign(hc, hcParse(s)); hcMigrate();
      try { localStorage.setItem(HC_KEY, JSON.stringify(hc)); } catch (e) {}
      const differs = JSON.stringify(hc) !== was;
      hcStoreSettled();
      if (differs && !$("handicap").hidden && $("handicap").querySelector(".hc-games")) buildHandicap();
    }, () => { hcFromStore = false; hcStoreSettled(); });
  };
  { let tries = 0; const t = setInterval(() => { if (Fan.store) { clearInterval(t); hcLoadStore(); } else if (++tries > 50) { clearInterval(t); hcStoreSettled(); } }, 100); }   // as soon as there's a store, up to 5 seconds
  let hcWinFor = null, hcWinFn = null;
  const hcWinProb = () => { if (hcWinFor !== hc.sigma) { hcWinFor = hc.sigma; hcWinFn = marginModel(hc.sigma); } return hcWinFn; };
  const hcMeanWin = () => { const w = hcWinProb(); return e => w.mean(e).win; };   // your margin is an expected margin, a regression's output (the user, Nov 4 2026): the win chance read from its average
  const hcRound = (v, k = 10) => Math.sign(v) * Math.round(Math.abs(v) * k) / k;   // halves away from zero, so a margin and its line read the same
  const hcSigned = (v, d = 1) => { const r = hcRound(v, 10 ** d); return r === 0 ? (0).toFixed(d) : (r > 0 ? "+" : "−") + Math.abs(r).toFixed(d); };
  const hcLine = v => (Math.abs(v) < 0.05 ? "PK" : hcSigned(v));   // a spread: its sign, one decimal, pick'em at zero
  const hcVarOf = t => Calc.HC_VARS.find(v => v.k === t.v);
  // What else a game's terms take beyond hcStates: each team's FTN total DVOA, by Fan's codes.
  const hcExtra = g => { const d = dvoaNow(); return { dvoa: d.ready ? [d.teams[abbr(nick(g, "away"))], d.teams[abbr(nick(g, "home"))]] : null }; };
  // This season's NFL games, finals and games to come, as hcStates takes them.
  // close: the game's line, the points the home team is favored by (nflverse's sense), from the page's own saved lines for this season; null without one.
  const hcClose = g => (g.line && !g.noLine && !g.line.noSp ? g.line.sp : null);   // the away side's line, +3.5 when the home team gives 3.5
  const hcThisSeason = () => Object.keys(WEEK_GAMES).map(Number).filter(w => w <= 18).flatMap(w => WEEK_GAMES[w].map(g => ({ season: "now", ms: Date.parse(g.t), away: g.away, home: g.home, final: g.final || null, game: g, week: w, close: hcClose(g) })));
  // The games Fit learns from: finals where both teams had played at least minGames that season. null while the five seasons are still on their way.
  function hcSample() {
    const games = hcThisSeason();
    if (hc.sample === "past") {
      const past = pastNflGames();
      if (!past.ready) return null;
      past.years.forEach(y => past.games[y].forEach(([ms, away, home, as, hs, close]) => games.push({ season: y, ms, away, home, final: [as, hs], close: close ?? null })));
    }
    return Calc.hcStates(games).filter(r => r.g.final && r.a.gp >= hc.minGames && r.h.gp >= hc.minGames);
  }
  function drawHandicap() {
    if (drawStub("handicap")) return;
    hcLoadStore();
    if (!hcStoreDone && Date.now() - hcStarted < HC_STORE_WAIT) { if (!$("handicap").querySelector(".hc-games")) $("handicap").replaceChildren(); setTimeout(() => { if (!hcStoreDone) hcStoreSettled(); }, HC_STORE_WAIT); return; }   // the records' copy first, so the first draw is the last
    const box = $("handicap");
    if (box.querySelector(".hc-games")) { drawHcGames(); return; }   // built: prices and finals redraw the games alone, so a field being typed in keeps its place
    buildHandicap();
  }
  function buildHandicap() {
    const box = $("handicap"), head = el("div", "season-head hc-head"), right = el("div", "hc-title");
    box.replaceChildren(head);
    // the heading (the user, Nov 4 2026): the week picker at the upper left, drawn with the week; the title and How to at the upper right
    head.append(el("div", "hc-wk"), right);
    right.append(el("h2", null, "NFL handicap"));
    // How to (the user, Nov 4 2026: "an explanation and tutorial for what we've built"), green as Fit; again to close it. The Key numbers table it replaced is gone.
    const howBtn = el("button", "hc-fit hc-how-btn", "How to");
    howBtn.type = "button"; howBtn.setAttribute("aria-pressed", String(!!hc.showHow)); howBtn.title = "What this page shows and how it works";
    howBtn.addEventListener("click", () => { hc.showHow = !hc.showHow; hcSave(); howBtn.setAttribute("aria-pressed", String(hc.showHow)); const k = box.querySelector(".hc-how"); if (k) k.hidden = !hc.showHow; fitHcTable(); });
    right.append(howBtn);
    // HFA starts as the average home margin over all the data, this season and the last 5, which takes nflverse's table once
    if (hc.eq.hfa == null) {
      const past = pastNflGames();
      if (!past.ready) { box.append(el("p", "page-stub-text", past.problem ? `Couldn't read nflverse's games table: ${past.problem}. Reload the page to try again.` : "Reading the last 5 seasons from nflverse's games table, once for this browser, to start home field advantage at their average…")); return; }
      const sample = hcSample();
      hc.eq.hfa = sample.length ? hcRound(sample.reduce((s, r) => s + r.g.final[1] - r.g.final[0], 0) / sample.length, 100) : 0;
      hcSave();
    }
    const pane = el("div", "hc-pane"), games = el("div", "hc-games"), how = hcHowTo();
    how.hidden = !hc.showHow;
    pane.append(how, games);
    box.append(pane);
    drawHcGames();
  }
  // How to: what the page shows and how it works, in plain words
  function hcHowTo() {
    const box = el("div", "graphs-cell hc-how"), p = (h, ...lines) => { const s = el("div", "hc-how-part"); s.append(el("h3", null, h), ...lines.map(x => el("p", null, x))); return s; };
    box.append(el("div", "cap", "How the Handicap works"),
      p("What it is", "Your own line for every game of the week, set game by game, beside the market's. Where the market pays more than your line says it should, the price lights up."),
      p("A game's row", "From the left: the game's preview; the visitor's moneylines, yours on top and the market's under it; the visitor's badge; your spread for the visitor over the market's; @ and the home team; the home moneylines; and Fit. Each team's spread and moneylines are your one number for the game, read two ways."),
      p("Your number", "The visitor's margin = − HFA + DVOA diff × its coefficient + Off bye × its coefficient. Your spread is minus that margin. It's read as an expected margin, an average, so the decimal matters: a visitor at −3.4 covers −3.5 less often than one at −3.9."),
      p("The columns", "HFA: home field advantage, which the visitor gives up; it starts at the average home margin over the last 5 seasons. DVOA diff: FTN's total DVOA, visitor minus home, shown under the coefficient you type. Off bye: the bye effect measured over the last 5 seasons and this one, for a visitor or a home team coming off a bye, shown under its coefficient; 1 takes it as measured. Div. game: a divisional game's box, on by default, counts the DVOA difference at 0.67, since the teams know each other well."),
      p("Typing", "Every number is that game's alone. The row under the column names shows what each game starts at; emptying a field puts it back. A number you've changed shows in the accent color. Coefficients take one decimal. What you type is saved with your records."),
      p("The highlights", "Each market price is held against yours as a percentage gap: a spread by how far the market's is from yours, over the size of yours (at 7%, against your 9.5 only 8.5 or 10.5 light); a moneyline by how much more the market pays that side than your price. A gap at or above the Hurdle lights up: green when the visitor's spread or a moneyline is the one to take, red when the home team's spread is. Hover a price for its gap."),
      p("Key numbers", "NFL margins bunch on 3 and 7, and the returns count that: a market line on the far side of 3 or 7 from yours is worth a lot more than one past a dead number like 4 or 5."),
      p("Fit", "√Fit vs all games sets each game's DVOA diff coefficient to the one that best fits the other games' market spreads this week, given each game's own HFA and Off bye: a game's own line never feeds its own number, so where your line and the market differ, it's the market's game against the rest of the week. A game's own √Fit sets its coefficient so its line lands on its own market spread: it copies the market, a read of how much DVOA the market prices into that game, and won't light anything up. Numbers Fit sets show in Fit's green; the ones you type, in blue."));
    return box;
  }
  // The table (the user, Nov 4 2026: "move the factors and coefficients to each game"): one row a game, its own HFA and, for each term, its own coefficient × its own
  // value, every one a number to type, so a game is adjusted by hand right there. Nothing is shared between games ("no shared values"): a game starts at the starting
  // numbers (hc.eq: HFA the average home margin, each coefficient where the old equation left it) and its variables' own values, and keeps what's typed for it alone
  // (hc.per, by week and teams). An emptied field goes back to its start. Fit's Use buttons set every game of the week.
  // Prices, finals and σ update the rows in place, so a field being typed in keeps its place; a new week or a new set of games builds them again.
  const hcKeyOf = r => `${r.g.week}|${r.g.away}|${r.g.home}`;
  const HC_NONE = { c: {}, x: {} };
  const hcSetOf = k => hc.per[k] || HC_NONE;
  const hcSetFor = k => (hc.per[k] = hc.per[k] || { c: {}, x: {} });
  const hcTidy = k => { const s = hc.per[k]; if (s && s.hfa === undefined && s.div === undefined && !Object.keys(s.c).length && !Object.keys(s.x).length) delete hc.per[k]; };
  const hcWeekRows = wk => Calc.hcStates(hcThisSeason()).filter(r => r.g.week === wk);
  // Fit (the user, Nov 4 2026: "When the fit button is pressed, I want you to replace the DVOA diff coefficients with your own, regardless of what's already there"):
  // the DVOA coefficient that best fits the week's market spreads given each game's own other numbers, its HFA and its Off bye, least squares through zero over the
  // week's games with a market spread and both teams' DVOA (calc.js hcFitCoef), the DVOA difference at its divisional share where the box is on. A game's Fit sets
  // its own coefficient to it; Fit all games sets every game's. A number set this way shows in Fit's green until it's typed over. null without games to fit on.
  // Each game left out of its own fit (the user, Nov 4 2026, "try #1"): its coefficient is fitted on the other games' market spreads, so it varies game to game and
  // its own line can't make it agree with the market. A game the fit can't use (no market spread or DVOA) takes the fit on all of them. { all, byKey } or null.
  function hcFitDvoa(wk) {
    const terms = hc.eq.terms.filter(hcVarOf), dvoaTerm = terms.find(t => t.v === "dvoa"), byeTerm = terms.find(t => t.v === "bye");
    if (!dvoaTerm) return null;
    const xs = [], ys = [], keys = [];
    hcWeekRows(wk).forEach(r => {
      const g = r.g.game, ln = g.line;
      if (r.a.gp < hc.minGames || r.h.gp < hc.minGames || !ln || g.noLine || ln.noSp || !Number.isFinite(ln.sp)) return;
      const dv = hcVarOf(dvoaTerm).f(r.h, r.a, hcExtra(g));
      if (dv === null) return;
      const s = hcSetOf(hcKeyOf(r)), hfa = s.hfa !== undefined ? s.hfa : hc.eq.hfa, div = hcDivisional(g) && s.div !== false;
      const bye = byeTerm ? (s.c.bye !== undefined ? s.c.bye : byeTerm.coef) * (Calc.hcByeAdjust(hcByeEff(), r) || 0) : 0;
      xs.push(div ? dv * RULES.userSet.hcDivDvoa : dv); ys.push(-ln.sp + hfa - bye); keys.push(hcKeyOf(r));   // the market's visitor margin, less what the other numbers already give
    });
    const all = Calc.hcFitCoef(xs, ys);
    if (all === null) return null;
    const out = Calc.hcFitLeaveOut(xs, ys), byKey = new Map(keys.map((k, i) => [k, out[i] === null ? all : out[i]])), points = new Map(keys.map((k, i) => [k, { x: xs[i], y: ys[i] }]));
    const gs = Calc.hcFitGaps(xs, ys), gaps = new Map(keys.map((k, i) => [k, gs[i]]));
    return { all, byKey, points, gaps };
  }
  // Set a game's DVOA coefficient to the fitted one, marked as Fit's
  const hcSetDvoa = (k, coef) => { const s = hcSetFor(k); s.c.dvoa = hcRound(coef, 10 ** hcDecimalsOf("dvoa")); s.fit = s.fit || {}; s.fit.dvoa = true; };
  // A game's own Fit: the coefficient that lands its line on its market spread (calc.js hcFitOne)
  const hcFitOwn = (wk, k) => { const f = hcFitDvoa(wk), p = f && f.points.get(k), c = p ? Calc.hcFitOne(p.x, p.y) : null; if (c === null) return false; hcSetDvoa(k, c); hcSave(); drawHcRows(); return true; };
  // vs fit, each game's gap in points from the season's fit (calc.js hcFitGaps), redrawn for every row at once, since one game's numbers move the others' fits
  function hcDrawGaps() {
    const wrap = document.querySelector("#handicap .hc-games"), body = document.querySelector("#handicap .hc-rows");
    if (!wrap || !body) return;
    const f = hcFitDvoa(Number(wrap.dataset.week));
    body.querySelectorAll("td.hc-vs-fit").forEach(td => {
      const raw = f ? f.gaps.get(td.closest("tr").dataset.k) : undefined, ok = Number.isFinite(raw), v = ok ? Math.round(raw * 10) / 10 : raw;   // rounded first, so a gap under 0.05 shows 0.0, unsigned
      td.textContent = ok ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) : "";
      td.title = ok ? `The market gives the visitor ${Math.abs(v).toFixed(1)} ${v >= 0 ? "more" : "less"} than this season's fit: the DVOA coefficient fitted on the other games' market spreads, with this game's HFA and Off bye` : "No market spread or DVOA to compare";
    });
  }
  const hcFitRows = (wk, keys) => { const f = hcFitDvoa(wk); if (!f) return false; keys.forEach(k => hcSetDvoa(k, f.byKey.has(k) ? f.byKey.get(k) : f.all)); hcSave(); drawHcRows(); return true; };
  // Off bye is a game's adjustment in points (the user, Nov 4 2026: "the value is the adjustment that should be applied to the game. no byes is 0"): the bye effect
  // measured over all the data, this season and the last 5, for the visitor and the home team apart (calc.js hcByeEffect), applied to whichever team is off a bye;
  // one number to type per game where a team is, nothing where neither is.
  let hcByeFor = null, hcByeVal = null;
  const hcByeEff = () => { if (hcByeFor === hc.eq.hfa && hcByeVal) return hcByeVal; const past = hcSample(); if (!past) return null; hcByeVal = Calc.hcByeEffect(past, hc.eq.hfa); hcByeFor = hc.eq.hfa; return hcByeVal; };
  const HC_FIXED = new Set(["dvoa"]);   // variables whose value is the data's alone, never typed: a coefficient to type, the value shown
  // The columns after HFA in order: each term, and "div" (Divisional) right after DVOA diff, which it modifies
  const hcCols = terms => terms.flatMap(t => (t.v === "dvoa" ? [t, "div"] : [t]));
  const hcNum = v => (v === null || v === undefined ? "" : String(hcRound(v, 100)));
  function drawHcGames() {
    const wrap = document.querySelector("#handicap .hc-games");
    if (!wrap) return;
    const wk = Math.min(18, Math.max(1, hc.week || weekNow()));
    if (wrap.dataset.week === String(wk) && wrap.querySelector(".hc-rows")) { drawHcRows(); return; }
    wrap.dataset.week = String(wk);
    hcWeekPicker(wk);
    const parts = [];
    const terms = hc.eq.terms.filter(hcVarOf), hcTable = el("table", "hc-table"), thead = el("thead"), hd = el("tr");
    const heads = [[""], [""], ["HFA", "Home field advantage: the visitor gives it up, so it enters as a minus"], ...hcCols(terms).map(c => (c === "div" ? ["Divisional", `A divisional game: with its box on, the DVOA difference counts ${RULES.userSet.hcDivDvoa} of itself, the teams knowing each other well`] : [hcVarOf(c).short, `${hcVarOf(c).h}: its coefficient × this game's value`])),
      ["vs fit", "Each game's gap in points from this season's fit: the market's visitor spread minus the one the DVOA coefficient fitted on the other games gives it. The biggest are the games the market prices furthest from this season's performance"]
    ];   // the theo moneylines moved into the game (the user, Nov 4 2026)
    // the column names on two lines, a word a line (the user, Nov 4 2026: "make the header row 2 rows"); Divisional is "Div. game"
    heads.forEach(([x, tip, l]) => { const th = el("th", l ? "trends-divider" : null), words = x === "Divisional" ? ["Div.", "game"] : x ? x.split(" ") : []; words.forEach((w, i) => { if (i) th.append(el("br")); th.append(w); }); if (tip) th.title = tip; hd.append(th); });
    const dv = hcCols(terms).findIndex(c => c !== "div" && c.v === "dvoa");
    if (dv >= 0) hd.children[3 + dv].classList.add("hc-src");   // where FTN's DVOA stands, on its column's name's hover: no subtitles (the user, Nov 4 2026)
    // under the headers, the numbers a game starts at, so they stay in sight while a game's are changed (the user, Nov 4 2026): −HFA and each term's coefficient
    const starts = el("tr", "hc-starts"), startCell = (parts, tip) => { const td = el("th"); td.append(...parts); if (tip) td.title = tip; return td; }, num = v => el("span", "hc-start-value", hcNum(v)), op = x => el("span", "hc-op", x);
    const fitAll = el("button", "hc-guide-btn hc-fit hc-fit-all"); fitAll.type = "button"; fitAll.append(hcRoot("Fit vs all games")); fitAll.title = "Set every game's DVOA diff coefficient to the one that best fits the other games' market spreads this week, each game left out of its own fit";
    fitAll.addEventListener("click", () => { const wkNow = Number(document.querySelector("#handicap .hc-games").dataset.week); if (!hcFitRows(wkNow, hcWeekRows(wkNow).filter(r => r.a.gp >= hc.minGames && r.h.gp >= hc.minGames).map(hcKeyOf))) fitAll.title = "No market spreads with DVOA to fit on this week"; });
    const hurdle = el("input"), hurdleBox = el("span", "hc-hurdle"), hurdleField = el("span", "hc-hurdle-field");
    hurdle.type = "number"; hurdle.step = "0.5"; hurdle.value = String(hcRound(hcHurdle() * 100, 100)); hurdle.title = "The hurdle: a market price is highlighted when its percentage gap from yours is at least this";
    hurdle.addEventListener("input", () => { const x = Number(hurdle.value); if (hurdle.value !== "" && Number.isFinite(x)) { hc.hurdle = x; hcSave(); drawHcRows(); } });
    hurdleField.append(hurdle, el("span", null, "%")); hurdleField.addEventListener("click", () => hurdle.focus());
    hurdleBox.append(el("span", "hc-hurdle-label", "Hurdle"), hurdleField);
    const fitAllCell = startCell([hurdleBox, fitAll]); fitAllCell.classList.add("hc-fit-all-cell");
    starts.append(startCell([]), fitAllCell, startCell([op("−"), hcDecimal(el("span", "hc-start-value hc-decimal hc-decimal-hfa"), hcNum(hc.eq.hfa))], "Home field advantage a game starts at"),
      ...hcCols(terms).map(t => t === "div" ? startCell([el("span", "hc-start-value hc-sv-c", "× " + RULES.userSet.hcDivDvoa)], "A divisional game's share of the DVOA difference") : t.v === "bye" ? hcByeStartCell(startCell, t) : startCell([hcDecimal(el("span", "hc-start-value hc-decimal" + (t.v === "dvoa" ? " hc-decimal-dvoa" : "")), t.coef.toFixed(hcDecimalsOf(t.v)))], `The coefficient a game starts at on ${hcVarOf(t).short}`)), startCell([]));
    thead.append(hd, starts);
    hcTable.append(thead, el("tbody", "hc-rows"));
    parts.push(hcTable);
    wrap.replaceChildren(...parts);
    drawHcRows();
  }
  // The week picker (the user, Nov 4 2026: "a scroll week picker at the upper left, in the nfl font, like the one we use for nhl and nba main pages"): weeks in the
  // league's type with the strip's orange bars on the one on screen, a chevron either side; the chevrons step the week and the weeks slide under the highlight.
  // As many weeks as reach the table's right edge, its outside divide (the user: "limit the scroll picker horizontally to the 'external' column divide"): fitHcTable
  // measures it. HC_TAB and HC_ARROW are the CSS's widths of a week and a chevron.
  const HC_TAB = 112, HC_ARROW = 34;
  // The column divide, the wager ticket's left edge (SPEC's Columns), where the picker ends (the user, Nov 4 2026: "i want the picker to end at the left edge of the wager
  // ticket"): layout.js's divideX, kept from the strips' last fit; opened straight onto the Handicap, the week view under it is shown unseen for the measure. null in
  // a layout with the stack above the cards.
  function hcDivide() {
    if (divideX != null) return divideX;
    const panel = $("slate"), was = panel.hidden, stack = document.querySelector(".col.left");
    if (!stack) return null;
    const root = document.documentElement, off = root.classList.contains("tracking-off");   // as the strips measure it: the column as it is with tracking on
    if (was) { panel.style.visibility = "hidden"; panel.hidden = false; }
    root.classList.remove("tracking-off");
    const x = stack.getBoundingClientRect().left, g = $("games").getBoundingClientRect().left;
    root.classList.toggle("tracking-off", off);
    if (was) { panel.hidden = true; panel.style.visibility = ""; }
    return x > g ? x : null;
  }
  let HC_SHOWN = 7;
  function hcWeekPicker(wk) {
    const box = document.querySelector("#handicap .hc-wk");
    if (!box) return;
    const go = w => { hc.week = Math.min(18, Math.max(1, w)); hcSave(); drawHcGames(); };
    const from = Math.min(18 - HC_SHOWN + 1, Math.max(1, wk - Math.floor(HC_SHOWN / 2)));
    const arrow = (d, svg, name) => { const b = el("button", "hc-week-arrow"); b.type = "button"; b.innerHTML = svg; b.title = b.ariaLabel = name; b.disabled = d < 0 ? wk <= 1 : wk >= 18; b.addEventListener("click", () => go(wk + d)); return b; };
    const tabs = Array.from({ length: HC_SHOWN }, (_, i) => { const w = from + i, b = el("button", "hc-week-tab", "Week " + w); b.type = "button"; b.setAttribute("aria-selected", String(w === wk)); b.classList.toggle("now", w === weekNow()); b.addEventListener("click", () => go(w)); return b; });
    box.replaceChildren(arrow(-1, "<svg viewBox=\"0 0 12 20\" width=\"12\" height=\"20\" aria-hidden=\"true\"><path d=\"M10 2 2 10l8 8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", "Earlier week"), ...tabs, arrow(1, "<svg viewBox=\"0 0 12 20\" width=\"12\" height=\"20\" aria-hidden=\"true\"><path d=\"M2 2l8 8-8 8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", "Later week"));
  }
  // The first three columns, the preview, the game and HFA, are frozen at the left, and the terms' columns after the rule scroll sideways under them when they run past
  // the pane (the user, Nov 4 2026: "make it a freeze column control so that the remaining... columns are in a grid control that can scroll horizontally"): never scaled down.
  function fitHcTable() {
    const wrap = document.querySelector("#handicap .hc-games"), hcTable = wrap && wrap.querySelector(".hc-table");
    if (!hcTable) return;
    hcTable.style.zoom = "";
    const rows = [...hcTable.querySelectorAll(".hc-rows tr")];
    rows.forEach(r => { r.style.height = ""; });
    // where each frozen column sticks: the widths of the ones before it
    const head = hcTable.querySelector("thead tr");
    // the scrolling columns spread out to the pane's right edge when there's room (the user, Nov 4 2026: "spread the three of them out to hit our current right edge")
    const spreadCols = () => { if (head) { const cols = [...head.children].slice(3), pane = wrap.closest(".hc-pane") || wrap; cols.forEach(th => { th.style.width = ""; }); const room = () => pane.getBoundingClientRect().left + pane.clientWidth - hcTable.getBoundingClientRect().right; if (cols.length && room() > 1) { const natural = cols.map(th => th.getBoundingClientRect().width), each = (natural.reduce((s, x) => s + x, 0) + room()) / cols.length; cols.forEach((th, i) => { th.style.width = Math.max(natural[i], each) + "px"; }); for (let pass = 0; pass < 2; pass++) { const left = room(); if (Math.abs(left) < 1) break; cols.forEach(th => { th.style.width = (parseFloat(th.style.width) + left / cols.length) + "px"; }); } } } };   // the same width each where they fit, to the pane's inner right edge (border-box widths)
    spreadCols();
    if (head && head.children.length >= 3) { const w = i => head.children[i].getBoundingClientRect().width; hcTable.style.setProperty("--hc-s2", w(0) + "px"); hcTable.style.setProperty("--hc-s3", w(0) + w(1) + "px"); }
    // the pane reaches down to just above the info line, and the games' rows share out what's left of it, up to twice their own height (the user, Nov 4 2026: "measure
    // to bottom of the area (just above info line) and space out vertically"); past that it scrolls
    const pane = wrap.closest(".hc-pane"), info = document.querySelector("fan-info-line"), box = $("handicap");
    if (!pane || !info) return;
    const pad = parseFloat(getComputedStyle(box).paddingBottom) || 0, available = Math.max(200, Math.floor(info.getBoundingClientRect().top - 6 - pad - pane.getBoundingClientRect().top));
    pane.style.height = ""; pane.style.maxHeight = "none";
    const spare = available - pane.scrollHeight;
    pane.style.maxHeight = pane.style.height = available + "px";
    const z = Number(hcTable.style.zoom) || 1;
    if (spare > 0 && rows.length > 1) { const each = rows[0].getBoundingClientRect().height / z, add = Math.min(each, spare / z / rows.length); rows.forEach(r => { r.style.height = Math.floor(each + add) + "px"; }); }
    // the hurdle's number centered over the spreads (the user, Nov 4 2026)
    const hb = box.querySelector(".hc-hurdle"), hf = hb && hb.querySelector(".hc-hurdle-field"), sp1 = box.querySelector(".hc-rows .hc-spread-yours");
    if (hb && hf && sp1) { const th = hb.closest("th").getBoundingClientRect(), s = sp1.getBoundingClientRect(), f = hf.getBoundingClientRect(), b0 = hb.getBoundingClientRect(); if (s.width) hb.style.left = Math.round(s.left + s.width / 2 - th.left - (f.left - b0.left) - f.width / 2) + "px"; }
    // the week picker, no further right than the column divide
    const pick = box.querySelector(".hc-wk"), edge = hcDivide();
    if (pick) pick.style.width = "";
    if (pick && edge) {
      // each week as wide as a week on the NFL's top strip, so the highlight is the same (the user, Nov 4 2026); the chevrons take what's left, so it still ends at the divide
      const strip = document.querySelector(".strip-tabs.wk2"), stripCell = (strip && parseFloat(strip.style.getPropertyValue("--cell"))) || HC_TAB;
      const room = edge - pick.getBoundingClientRect().left, n = Math.min(18, Math.max(1, Math.floor((room - 2 * HC_ARROW) / stripCell)));
      pick.style.width = Math.floor(room) + "px"; pick.style.setProperty("--cell", stripCell + "px");
      if (n !== HC_SHOWN) { HC_SHOWN = n; hcWeekPicker(Number(wrap.dataset.week)); }
    }
    spreadCols();   // again, once the pane's height and its scrollbar are settled
  }
  // A game as the byes show teams, small: each team's badge in its colors with the helmet over its left edge, visitor @ home (the user, Nov 4 2026).
  const hcChip = t => {
    const c = el("span", "bye-chip hc-chip"), look = TEAM[t];
    if (look) { c.style.background = look.bg; c.style.color = look.fg; }
    c.title = t;
    if (hasArt(t)) c.append(helmImg(t, "bye-helm"));
    c.append(el("span", null, abbr(t)));
    return c;
  };
  // The game in six columns over two rows (the user, Nov 4 2026: "make the team badges full row height, and leave the existing spread and @ tag in the middle. outside each
  // helmet put moneylines, mine on top, market on bottom, with market opportunity highlighted"): the visitor's moneylines, its badge the row's height, your spread over
  // the market's, "@", the home badge the row's height, the home moneylines. Fixed widths, so every row lines up on the same marks.
  const hcGameCell = g => {
    const td = el("td", "hc-game"), box = el("div", "hc-game-grid");
    const v = el("span", "hc-visitor"), h = el("span", "hc-home");
    v.append(hcChip(nick(g, "away"))); h.append(hcChip(nick(g, "home")));
    box.append(el("span", "hc-ml hc-ml-visitor"), v, el("span", "hc-spread hc-spread-yours"), el("span", "hc-at", "@"), h, el("span", "hc-ml hc-ml-home"),
      el("span", "hc-ml hc-ml-visitor hc-ml-market"), el("span", "hc-spread hc-spread-market"), el("span", "hc-ml hc-ml-home hc-ml-market"));
    td.append(box);
    return td;
  };
  // Opportunities by percentage gap (the user, Nov 4 2026: "only highlight market opportunities outside of a band"; Nov 5: "a percentage difference of absolute values"):
  // each market price against yours (calc.js hcGap), highlighted when its gap clears the hurdle, so moneylines and spreads are held to the same bar.
  const hcHurdle = () => (Number.isFinite(hc.hurdle) ? hc.hurdle : RULES.userSet.hcHurdle * 100) / 100;
  const hcPct = v => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + "%";
  // A game's moneylines, yours and the market's, each side's market highlighted when it pays that side more than yours by the hurdle. mine: [visitor, home] or null; gap: hcGap's, or null.
  function hcMoneylines(game, r, mine, gap) {
    const g = r.g.game, mkt = g.line && !g.noLine ? g.line.ml : null, bar = hcHurdle();
    const [mv, mh] = game.querySelectorAll(".hc-ml:not(.hc-ml-market)"), [kv, kh] = game.querySelectorAll(".hc-ml-market");
    [[mv, kv, 0, "v"], [mh, kh, 1, "h"]].forEach(([me, mk, i, s]) => {
      me.textContent = mine ? odds(mine[i]) : ""; me.title = "Your price, from your spread by the key number model";
      mk.textContent = mkt && Number.isFinite(mkt[i]) ? odds(mkt[i]) : "";
      const e = gap && gap.ml ? gap.ml[s] : null, take = e !== null && e >= bar;
      mk.classList.toggle("hc-take", take);
      mk.title = e === null ? "The market's moneyline" : `The market's moneyline: pays ${hcPct(e)} against yours${take ? ", over the hurdle" : ""}`;
    });
  }
  // A spread on a fixed decimal point (the user, Nov 4 2026: bold and plain spreads differ in width): the part before the point right-aligned in a box of fixed width,
  // the point and its digit after, so every spread's point sits at the same x whatever its weight. Pick'em sits where the digits would.
  const hcPoint = (span, text) => {
    if (!text) { span.replaceChildren(); return; }
    const i = text.lastIndexOf(".");
    span.replaceChildren(el("span", "hc-points-whole", i < 0 ? text : text.slice(0, i)), el("span", "hc-points-fraction", i < 0 ? "" : text.slice(i)));
  };
  // The market's visitor spread: green when it gives the visitor more than yours by the hurdle, the visitor's spread to take; red when less, the home team's (the user, Nov 4 2026).
  function hcMarketLine(span, r, gap) {
    const g = r.g.game, ln = g.line, sp = ln && !g.noLine && !ln.noSp ? ln.sp : null, e = gap ? gap.sp : null, bar = hcHurdle();
    hcPoint(span, sp == null ? "" : hcLine(sp));
    const v = e !== null && e >= bar, h = e !== null && -e >= bar, pct = e === null ? "" : Number.isFinite(e) ? Math.abs(e * 100).toFixed(1) + "%" : "off your pick'em";
    span.classList.toggle("hc-take", v);
    span.classList.toggle("hc-fade", h);
    span.title = sp == null ? "" : e === null ? "The market's visitor spread" : e === 0 ? "The market's visitor spread: the same as yours" : `The market's visitor spread: ${pct} ${e > 0 ? "more" : "less"} for the visitor than yours${v ? ": the visitor's spread clears the hurdle" : h ? ": the home team's spread clears the hurdle" : ""}`;
  }
  // Both teams in one division (DIVS, by nickname).
  const hcDivisional = g => { const a = divOf(nick(g, "away")); return a >= 0 && a === divOf(nick(g, "home")); };
  // A number on its column's decimal point (the user, Nov 4 2026: "do the alignment such that decimal points are vertical"): the part before the point right-aligned
  // in a box ending where the column's point sits, the point and the rest after it. The coefficients' fields put their point on the same line (fan.css).
  const hcDecimal = (span, text) => { const i = text.indexOf("."); span.replaceChildren(el("span", "hc-whole", i < 0 ? text : text.slice(0, i)), el("span", "hc-fraction", i < 0 ? "" : text.slice(i))); return span; };
  // A coefficient over its value, one over the other in the column (the user, Nov 4 2026: "two values for a single column... should be stacked vertically"): the field on
  // top, "× value" under it, the value right-justified so the points line up down the column.
  const hcStack = (coef, val) => { const s = el("span", "hc-stack"), low = el("span", "hc-low"); low.append(el("span", "hc-op", "×"), val); s.append(coef, low); return s; };
  // Up and down arrows at a field's right (the user, Nov 4 2026: DVOA diff's coefficient), a tenth a press, as typing it would: the field turns blue and is saved
  // The decimals a term's coefficient takes: DVOA diff's two, the rest one
  const hcDecimalsOf = v => (v === "dvoa" ? 2 : 1);
  const hcSpin = (input, places = 1) => {
    const box = el("span", "hc-spin"), arrows = el("span", "hc-arrows");
    const step = 10 ** -places, name = places === 2 ? "a hundredth" : "a tenth";
    [["▲", step, "Up " + name], ["▼", -step, "Down " + name]].forEach(([g, d, tip]) => {
      const b = el("button", null, g); b.type = "button"; b.title = tip; b.tabIndex = -1;
      b.addEventListener("click", () => { const now = Number(input.value) || 0; input.value = (Math.round((now + d) * 10 ** places) / 10 ** places).toFixed(places); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("blur")); });
      arrows.append(b);
    });
    box.append(input, arrows);
    return box;
  };
  // A word under a square root sign, the radical and its bar over the word (the user, Nov 4 2026: "signifying sort of the operation at hand")
  const hcRoot = word => { const s = el("span", "hc-root"); s.append(el("span", "hc-root-sign", "√"), el("span", "hc-root-word", word)); return s; };
  // A game's preview from its row (the user, Nov 4 2026): the game card's Game preview icon, which opens that game's week with the preview open, as the card's does.
  const hcPreviewCell = rg => {
    const td = el("td", "hc-prev"), b = el("button"), g = rg.game;
    b.type = "button"; b.title = "Game preview"; b.setAttribute("aria-label", "Game preview"); b.innerHTML = GAME_CARD_ACTIONS.find(a => a[0] === "Game preview")[1];
    b.addEventListener("click", () => { const from = { view: "handicap", week: curWeek }; switchWeek(rg.week); const k = gameKey(g), on = GAMES.find(x => gameKey(x) === k); if (on) { setDetailGame(on, from); showView("week"); } });   // closing it comes back here
    td.append(b);
    return td;
  };
  // Off bye's start: the measured effects, the visitor's and the home team's, in points to the visitor
  const hcByeStartCell = (startCell, t) => {
    const e = hcByeEff(), sg = v => (v < 0 ? "−" : "+") + Math.abs(hcRound(v, 10)).toFixed(1);
    return startCell([], e ? `The bye effect over ${e.n} finals, the last 5 seasons and this one, in points to the visitor: the visitor off a bye ${sg(e.v)} ± ${e.seVisitor.toFixed(2)} (${e.byeGamesVisitor} games), the home team off a bye ${sg(e.h)} ± ${e.seHome.toFixed(2)} (${e.byeGamesHome} games)` : "");
  };
  // The rows, built once for a week's set of games and then updated in place.
  function drawHcRows() {
    const body = document.querySelector("#handicap .hc-rows"), wrap = document.querySelector("#handicap .hc-games");
    if (!body) return;
    const wk = Number(wrap.dataset.week), rows = hcWeekRows(wk), terms = hc.eq.terms.filter(hcVarOf), d = dvoaNow();
    const src = document.querySelector("#handicap .hc-src");
    if (src) src.title = "Total DVOA difference, visitor minus home. " + (d.problem ? `FTN: ${d.problem}` : d.ready ? `FTN through week ${d.week}` : "Reading FTN…");
    const short = r => r.a.gp < hc.minGames || r.h.gp < hc.minGames;
    const flags = r => terms.map(t => { const v = hcVarOf(t); return v.side ? String(v.side(r.a)) + v.side(r.h) : ""; }).join("");
    const signature = rows.map(r => hcKeyOf(r) + (short(r) ? "s" : "") + flags(r)).join(",") + "|" + terms.map(t => t.v).join(",");
    if (body.dataset.signature === signature) { const by = new Map(rows.map(r => [hcKeyOf(r), r])); body.querySelectorAll("tr").forEach(tr => { if (tr.hcUpd) tr.hcUpd(by.get(tr.dataset.k)); }); hcDrawGaps(); fitHcTable(); return; }
    const tb = el("tbody", "hc-rows");
    tb.dataset.signature = signature;
    rows.forEach(r => tb.append(hcRow(r, terms, short(r))));
    if (!rows.length) { const tr = el("tr"), td = el("td", "dim", "No games this week."); td.colSpan = 5 + terms.length; tr.append(td); tb.append(tr); }
    body.replaceWith(tb);
    hcDrawGaps();
    fitHcTable();
  }
  // One game's row: the game, with your spread after the visitor; its HFA; each term's coefficient × value; the visitor's margin they give; the market's spread in the same
  // form and the difference; and the theo moneylines and the market's. tr.hcUpd(r) redraws it from a fresh row of hcStates.
  // Off bye shows only where a team is off a bye (the user, Nov 4 2026: "remove the controls where something is invalid").
  function hcRow(r, terms, short) {
    const tr = el("tr"), k = hcKeyOf(r), game = hcGameCell(r.g.game), theoSpan = el("span", "hc-theo");
    tr.dataset.k = k;
    const mktSpan = el("span", "hc-mkt");   // the market's visitor spread, under yours
    game.querySelector(".hc-spread-yours").append(theoSpan); game.querySelector(".hc-spread-market").append(mktSpan);

    if (short) {
      game.title = `Too few games for a prediction: a team has played under ${hc.minGames}`;
      tr.append(hcPreviewCell(r.g), game, ...[0, ...terms].map(() => el("td", "dim", "—")), el("td"), el("td"));
      return tr;
    }
    // a number to type: own() what's typed for this game, or undefined; start() what it is untouched (null: none); put(v) keeps v, undefined clearing it
    const fields = [], fixedVals = [];
    // places: the decimals it takes, a coefficient's one; a second one typed is dropped as it's typed
    // fitKey: the name Fit marks this number by (hfa, or a term's), typing over it clears the mark
    const field = (own, start, put, tip, places, fitKey) => {
      const i = el("input");
      i.type = "number"; i.step = places ? String(10 ** -places) : "any"; i.title = tip;
      i.addEventListener("input", () => {
        if (places != null) { const m = i.value.match(/^(-?\d*)\.(\d+)$/); if (m && m[2].length > places) i.value = m[1] + "." + m[2].slice(0, places); }
        const x = Number(i.value); if (i.value === "") put(undefined); else if (Number.isFinite(x)) put(places != null ? hcRound(x, 10 ** places) : x); else return; { const s = hc.per[k]; if (s && s.fit && fitKey) { delete s.fit[fitKey]; if (!Object.keys(s.fit).length) delete s.fit; } } hcTidy(k); hcSave(); upd();
      });
      i.addEventListener("blur", () => upd());
      fields.push({ i, own, start, places, fitKey });
      return i;
    };
    const keep = (f, v) => { const s = hcSetFor(k); if (v === undefined) f(s, true); else f(s, false, v); };
    const hfaCell = el("td", "hc-coef");
    hfaCell.append(el("span", "hc-op", "−"), field(() => hcSetOf(k).hfa, () => hc.eq.hfa, v => keep((s, del, x) => { if (del) delete s.hfa; else s.hfa = x; }, v), "Home field advantage for this game: the visitor gives it up, so it enters as a minus", undefined, "hfa"));
    const sideOf = { a: abbr(nick(r.g.game, "away")), h: abbr(nick(r.g.game, "home")) };
    const flagOn = terms.map(t => { const v = hcVarOf(t); return v.side ? ["a", "h"].filter(s => v.side(r[s])) : null; });   // the teams off a bye, for Off bye
    const byeStart = () => Calc.hcByeAdjust(hcByeEff(), r);
    const termCells = terms.map((t, ti) => {
      const td = el("td", "hc-coef"), v = hcVarOf(t);
      if (t.v === "bye") {   // the game's bye adjustment, in points to the visitor
        if (!flagOn[ti].length) return td;
        const shown = el("span", "hc-val");
        shown.title = `Off a bye: ${flagOn[ti].map(sd => sideOf[sd]).join(" and ")}. The points this game's adjusted by for it, to the visitor, from the bye effect measured over the last 5 seasons and this one`;
        fixedVals.push(() => { const a = byeStart(); hcDecimal(shown, a === null ? "none" : a.toFixed(2)); });
        td.append(hcStack(field(() => hcSetOf(k).c.bye, () => t.coef, x => keep((s, del, y) => { if (del) delete s.c.bye; else s.c.bye = y; }, x), "The coefficient on this game's bye adjustment: 1 takes it as measured", 1, "bye"), shown));
        return td;
      }
      const coefIn = field(() => hcSetOf(k).c[t.v], () => t.coef, x => keep((s, del, y) => { if (del) delete s.c[t.v]; else s.c[t.v] = y; }, x), `The coefficient on ${v.h.toLowerCase()}, for this game`, hcDecimalsOf(t.v), t.v);
      if (HC_FIXED.has(t.v)) { const shown = el("span", "hc-val"); shown.title = v.h; fixedVals.push(() => { const val = v.f(r.h, r.a, hcExtra(r.g.game)); hcDecimal(shown, val === null ? "none" : val.toFixed(1)); }); td.append(hcStack(t.v === "dvoa" ? hcSpin(coefIn, hcDecimalsOf("dvoa")) : coefIn, shown)); return td; }
      td.append(
        coefIn,
        el("span", "hc-op", "×"),
        field(() => hcSetOf(k).x[t.v], () => v.f(r.h, r.a, hcExtra(r.g.game)), x => keep((s, del, y) => { if (del) delete s.x[t.v]; else s.x[t.v] = y; }, x), `${v.h}, for this game: type your own to replace it, empty for its own`));
      return td;
    });
    function upd() {
      const s = hcSetOf(k), x = hcExtra(r.g.game);
      fields.forEach(f => {
        const o = f.own(), v = o !== undefined ? o : f.start();
        const byFit = o !== undefined && !!f.fitKey && !!(hc.per[k] && hc.per[k].fit && hc.per[k].fit[f.fitKey]);
        f.i.classList.toggle("hc-set", o !== undefined && !byFit); f.i.classList.toggle("hc-fit-set", byFit);   // typed: light blue; set by Fit: Fit's green
        if (document.activeElement !== f.i) f.i.value = v === null || v === undefined ? "" : f.places != null ? Number(v).toFixed(f.places) : hcNum(v);
        f.i.placeholder = v === null ? "none" : "";
      });
      fixedVals.forEach(f => f());
      game.title = r.g.final ? `Final ${r.g.final.join("–")}` : "";
      const own = (o, d) => (o !== undefined ? o : d);
      const eq = { hfa: own(s.hfa, hc.eq.hfa), terms: terms.flatMap((t, ti) => (t.v === "bye" ? (flagOn[ti].length ? [{ v: "bye", coef: own(s.c.bye, t.coef), val: byeStart() ?? 0 }] : []) : [{ v: t.v, coef: Calc.hcDivCoef(own(s.c[t.v], t.coef), t.v === "dvoa" && divOn()), val: HC_FIXED.has(t.v) ? undefined : s.x[t.v] }])) };
      const margin = Calc.hcVisitorMargin(eq, r, x);
      if (margin === null) {
        hcPoint(theoSpan, ""); hcMarketLine(mktSpan, r, null);
        hcMoneylines(game, r, null, null);
        return;
      }
      const line = -margin, theo = Calc.hcTheo(-margin, hcMeanWin());   // theo takes the home team's margin, an expected margin
      hcPoint(theoSpan, hcLine(line));   // your spread after the visitor (the user, Nov 4 2026), the row's prediction since the column at the right went
      const ln = r.g.game.line && !r.g.game.noLine ? r.g.game.line : null, gap = Calc.hcGap({ sp: line, ml: theo.ml }, ln ? { sp: ln.noSp ? null : ln.sp, ml: ln.ml } : null);
      hcMarketLine(mktSpan, r, gap);
      hcMoneylines(game, r, theo.ml, gap);   // your spread as moneylines, by the key number model, and the market's
      if (tr.isConnected) hcDrawGaps();   // a typed HFA or Off bye moves every game's fit
    }
    tr.hcUpd = nr => { if (nr) r = nr; upd(); };
    const fit = el("button", "hc-guide-btn hc-fit"), name = `${abbr(nick(r.g.game, "away"))} @ ${abbr(nick(r.g.game, "home"))}`;
    fit.append(hcRoot("Fit"));
    fit.type = "button"; fit.title = `Set ${name}'s DVOA diff coefficient to the one that lands its line on its own market spread: it copies the market, so nothing here will light up`;
    fit.addEventListener("click", () => { if (!hcFitOwn(r.g.week, k)) fit.title = "No market spread, or no DVOA difference, to fit this game on"; });
    game.append(fit);   // in the game's cell, at its right, left of the rule
    tr.prepend(hcPreviewCell(r.g));
    // Divisional: a box on a divisional game, on until it's unticked; ticked, the DVOA difference counts hcDivDvoa of itself
    const divCell = el("td", "hc-div"), isDiv = hcDivisional(r.g.game), divOn = () => isDiv && hcSetOf(k).div !== false;
    if (isDiv) {
      const box = el("input"); box.type = "checkbox"; box.checked = divOn();
      box.title = `A divisional game: ticked, the DVOA difference counts ${RULES.userSet.hcDivDvoa} of itself`;
      box.addEventListener("change", () => { const s = hcSetFor(k); if (box.checked) delete s.div; else s.div = false; hcTidy(k); hcSave(); upd(); });
      divCell.append(box);
    }
    tr.append(game, hfaCell, ...hcCols(terms).map(c => (c === "div" ? divCell : termCells[terms.indexOf(c)])), el("td", "hc-vs-fit"));
    upd();
    return tr;
  }

export { drawHandicap };
