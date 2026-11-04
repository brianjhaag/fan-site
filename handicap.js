// The Handicap section (the NFL first; the user, Nov 4 2026): each game's own numbers to the user's spread and moneylines, against the market's. Moved out of panels.js.
import { divideX } from "./layout.js?v=mw2nrhc5";
import { WEEK_GAMES, dvoaNow, pastNflGames } from "./espn.js?v=mw2nrhc5";
import { Fan } from "./hosts.js?v=mw2nrhc5";
import { CARD_ACTIONS, GAMES, setDetailGame, showView, switchWeek, helmImg, hasArt, league, nick, $, RULES, changed, curWeek, drawStub, el, gameKey, last, later, marginModel, odds, view, weekNow } from "./base.js?v=mw2nrhc5";
import { TEAM, abbr } from "./leagues.js?v=mw2nrhc5";
import { Calc } from "./calc.js?v=mw2nrhc5";
import { divOf } from "./panels.js?v=mw2nrhc5";

  /* ==== Handicap (the NFL first; the user, Nov 4 2026): your spread for each game, from numbers you set game by game, against the market's. ==== */
  // A game's visitor margin = −HFA + each term's coefficient × its value (calc.js HC_VARS and hcVisitorMargin): DVOA diff (FTN's, shown, its coefficient yours; times
  // 0.67 in a divisional game) and Off bye (the bye effect measured over 5 seasons and this one, shown, its coefficient yours). Your line is minus the margin, and the
  // key number model turns it into moneylines. Each game starts at hc.eq's numbers (HFA the average home margin over all the data) and keeps what's typed for it alone.
  // Kept in this browser and in the person's own records: the numbers, the EV hurdle, the margin spread (sigma) the key number model takes, and the week on screen.
  const HC_KEY = "fan.handicap.nfl";
  const hcTerm = k => { const v = Calc.HC_VARS.find(x => x.k === k) || Calc.HC_VARS[0]; return { v: v.k, coef: v.start }; };
  const hcDefault = () => ({ hurdle: RULES.userSet.hcHurdle * 100, sample: "past", showKeys: false, sigma: RULES.leagues.nfl.sigma, minGames: 2, week: null, per: {}, eq: { hfa: null, terms: [hcTerm("dvoa"), hcTerm("bye")] }, fit: null });
  const hcParse = s => { const d = hcDefault(); if (!s || typeof s !== "object") return d; const ok = s.eq && Array.isArray(s.eq.terms); return { ...d, ...s, eq: ok ? s.eq : d.eq, fit: ok ? s.fit : null }; };   // an equation from before terms (0.48.10) starts again
  const hc = (() => { try { return hcParse(JSON.parse(localStorage.getItem(HC_KEY))); } catch (e) { return hcDefault(); } })();
  function hcMigrate() {
    if (!hc.per || typeof hc.per !== "object") hc.per = {};   // each game's own numbers, typed by hand (the user, Nov 4 2026)
    ["spread", "total", "adj"].forEach(k => { delete hc[k]; });   // the earlier screens' (0.48.8, 0.48.9): a regression card, a total model, a points adjustment per game
    hc.eq.terms = hc.eq.terms.filter(t => t.v === "dvoa" || t.v === "bye");   // V MOV and Blowout L went (the user, Nov 4 2026)
    ["dvoa", "bye"].forEach(k => { if (!hc.eq.terms.some(t => t.v === k)) hc.eq.terms.push(hcTerm(k)); });   // and DVOA diff and Off bye join an equation saved before them
    // Off bye became a coefficient on the measured adjustment (the user, Nov 4 2026): it starts at 1, and what was typed for it before means something else now
    if (!hc.byeAdj) { hc.byeAdj = true; hc.eq.terms.forEach(t => { if (t.v === "bye") t.coef = 1; }); Object.values(hc.per).forEach(s => { ["bye", "bye:a", "bye:h", "bye:adj"].forEach(k => { if (s.c) delete s.c[k]; if (s.x) delete s.x[k]; }); }); }
  }
  hcMigrate();
  // Kept in this browser at once, and in the person's own records a moment later (the user, Nov 4 2026: "defintely need to save edits on the real thing"): the
  // connector's records on this computer, backed up with them and read by any browser here, or this browser's own store with no connector.
  let hcStoreT = null, hcFromStore = false;
  const hcSave = () => {
    try { localStorage.setItem(HC_KEY, JSON.stringify(hc)); } catch (e) {}
    clearTimeout(hcStoreT); hcStoreT = setTimeout(() => { if (Fan.store) Fan.store.set("handicap", "nfl", JSON.parse(JSON.stringify(hc))).catch(() => {}); }, 800);
  };
  // The records' copy, read once: it wins over this browser's, and with none there, this browser's goes in. Read at page load, not when the Handicap opens (the user, Nov 4 2026: the table "flexes into place after some redraw": the records' copy came in after the first
  // draw and built it all again). hcStoreDone: the records have answered, or there are none to ask; the Handicap waits for that before its first draw, for at most
  // HC_STORE_WAIT, and a copy the same as this browser's builds nothing again.
  const HC_STORE_WAIT = 1500, hcStarted = Date.now();
  let hcStoreDone = false;
  const hcStoreSettled = () => { hcStoreDone = true; if (!$("handicap").hidden && !$("handicap").querySelector(".hc-games")) renderHandicap(); };
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
  // Fit's guide (the user, Nov 4 2026): each variable with a coefficient fitted as the only predictor against the market's lines for the week, each game's visitor margin
  // being minus its visitor line, saying what HFA and coefficient it would take alone and how closely it follows the market. { week, n, res: { k: hcAlone } }.
  let hcGuide = null;
  function hcGuideFit(wk) {
    const rows = Calc.hcStates(hcThisSeason()).filter(r => r.g.week === wk && r.a.gp >= hc.minGames && r.h.gp >= hc.minGames && r.g.game.line && !r.g.game.noLine && !r.g.game.line.noSp);
    const res = {};
    Calc.HC_VARS.forEach(v => {
      const pairs = rows.map(r => [v.f(r.h, r.a, hcExtra(r.g.game)), -r.g.game.line.sp]).filter(([x]) => x !== null);
      if (v.guide === "market") res[v.k] = Calc.hcAlone(pairs.map(p => p[0]), pairs.map(p => p[1]));
    });
    hcGuide = { week: wk, n: rows.length, res };
  }
  function renderHandicap() {
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
    // the heading (the user, Nov 4 2026): the week picker at the upper left, drawn with the week; the title, Key numbers, Fit and FTN's week at the upper right
    head.append(el("div", "hc-wk"), right);
    right.append(el("h2", null, "NFL handicap"));
    const keysBtn = el("button", "hc-keys-btn", "Key numbers");
    keysBtn.type = "button"; keysBtn.setAttribute("aria-pressed", String(!!hc.showKeys)); keysBtn.title = "Show or hide the key number model's table: how a predicted result becomes a moneyline";
    keysBtn.addEventListener("click", () => { hc.showKeys = !hc.showKeys; hcSave(); keysBtn.setAttribute("aria-pressed", String(hc.showKeys)); const k = box.querySelector(".hc-keys"); if (k) k.hidden = !hc.showKeys; fitHcTable(); });
    right.append(keysBtn);
    // HFA starts as the average home margin over all the data, this season and the last 5, which takes nflverse's table once
    if (hc.eq.hfa == null) {
      const past = pastNflGames();
      if (!past.ready) { box.append(el("p", "pg-stub-t", past.problem ? `Couldn't read nflverse's games table: ${past.problem}. Reload the page to try again.` : "Reading the last 5 seasons from nflverse's games table, once for this browser, to start home field advantage at their average…")); return; }
      const sample = hcSample();
      hc.eq.hfa = sample.length ? hcRound(sample.reduce((s, r) => s + r.g.final[1] - r.g.final[0], 0) / sample.length, 100) : 0;
      hcSave();
    }
    const pane = el("div", "hc-pane"), games = el("div", "hc-games"), keys = el("div", "xycell hc-keys");
    // the EV hurdle (the user, Nov 4 2026: "put an input at the bottom for the EV hurdle. start with 3"): a market price is highlighted when its expected return clears it
    const foot = el("div", "hc-foot"), hurdle = el("input");
    hurdle.type = "number"; hurdle.step = "0.5"; hurdle.value = String(hcRound(hcHurdle() * 100, 100)); hurdle.title = "A market price is highlighted when its expected return at your result is at least this";
    hurdle.addEventListener("input", () => { const x = Number(hurdle.value); if (hurdle.value !== "" && Number.isFinite(x)) { hc.hurdle = x; hcSave(); drawHcRows(); } });
    foot.append(el("span", null, "EV hurdle"), hurdle, el("span", null, "%"));
    keys.hidden = !hc.showKeys;
    pane.append(keys, games);
    box.append(pane, foot);
    drawHcKeys();
    drawHcGames();
  }
  // The key number model, as a reference: a predicted result and the favorite's chance and fair moneyline it gives, at this σ. The jumps at 3 and 7 are the key numbers.
  function drawHcKeys() {
    const c = document.querySelector("#handicap .hc-keys");
    if (!c) return;
    const win = hcWinProb(), tbl = el("table"), hd = el("tr"), tb = el("tbody"), thead = el("thead");
    ["Favorite by", "Its chance", "Fair moneyline, favorite / underdog"].forEach(h => hd.append(el("th", null, h)));
    thead.append(hd);
    [1, 2, 2.5, 3, 3.5, 4, 6, 7, 7.5, 10, 14].forEach(m => {
      const th = Calc.hcTheo(m, win), r = el("tr", m === 3 || m === 7 ? "hc-key" : null);
      r.append(el("td", null, String(m)), el("td", null, (th.pHome * 100).toFixed(1) + "%"), el("td", null, `${odds(th.ml[1])} / ${odds(th.ml[0])}`));
      tb.append(r);
    });
    tbl.append(thead, tb);
    c.replaceChildren(el("div", "cap", "Key number model · result to moneyline"), tbl, el("p", "pb-note", `Final margins spread around the predicted result at σ ${hc.sigma}, bunched on the NFL's key numbers.`));
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
  // Fit is per game (the user, Nov 4 2026: "put one on the far right of each row to calc just that row"): a row's Fit runs the week's fits and opens their guide over the
  // games for that game, and its Use buttons set that game's numbers alone. hcGuideFor: the game the guide is open for, or null; its Fit again closes it.
  let hcGuideFor = null, hcGuideName = "";
  const hcUseOn = (k, f) => { f(hcSetFor(k)); hcSave(); buildHandicap(); };
  // Off bye is a game's adjustment in points (the user, Nov 4 2026: "the value is the adjustment that should be applied to the game. no byes is 0"): the bye effect
  // measured over all the data, this season and the last 5, for the visitor and the home team apart (calc.js hcByeEffect), applied to whichever team is off a bye;
  // one number to type per game where a team is, nothing where neither is.
  let hcByeFor = null, hcByeVal = null;
  const hcByeEff = () => { if (hcByeFor === hc.eq.hfa && hcByeVal) return hcByeVal; const past = hcSample(); if (!past) return null; hcByeVal = Calc.hcByeEffect(past, hc.eq.hfa); hcByeFor = hc.eq.hfa; return hcByeVal; };
  const HC_FIXED = new Set(["dvoa"]);   // variables whose value is the data's alone, never typed: a coefficient to type, the value shown
  const hcNum = v => (v === null || v === undefined ? "" : String(hcRound(v, 100)));
  function drawHcGames() {
    const wrap = document.querySelector("#handicap .hc-games");
    if (!wrap) return;
    const wk = Math.min(18, Math.max(1, hc.week || weekNow()));
    if (wrap.dataset.week === String(wk) && wrap.querySelector(".hc-rows")) { drawHcRows(); return; }
    wrap.dataset.week = String(wk);
    hcWeekPicker(wk);
    const parts = [];
    if (hcGuide && hcGuide.week === wk && hcGuideFor) parts.push(hcGuideTable(wk));
    const terms = hc.eq.terms.filter(hcVarOf), tbl = el("table", "hc-table"), thead = el("thead"), hd = el("tr");
    const heads = [[""], [""], ["HFA", "Home field advantage: the visitor gives it up, so it enters as a minus"], ...terms.map(t => [hcVarOf(t).short, `${hcVarOf(t).h}: its coefficient × this game's value`]),
      ["Divisional", `A divisional game: with its box on, the DVOA difference counts ${RULES.userSet.hcDivDvoa} of itself, the teams knowing each other well`]
    ];   // the theo moneylines moved into the game (the user, Nov 4 2026)
    heads.push(["", "Fit: the week's fits as a guide for one game, its Use buttons setting that game alone"]);
    heads.forEach(([x, tip, l]) => { const th = el("th", l ? "pb-l" : null, x); if (tip) th.title = tip; hd.append(th); });
    const dv = terms.findIndex(t => t.v === "dvoa");
    if (dv >= 0) hd.children[3 + dv].classList.add("hc-src");   // where FTN's DVOA stands, on its column's name's hover: no subtitles (the user, Nov 4 2026)
    // under the headers, the numbers a game starts at, so they stay in sight while a game's are changed (the user, Nov 4 2026): −HFA and each term's coefficient
    const starts = el("tr", "hc-starts"), startCell = (parts, tip) => { const td = el("th"); td.append(...parts); if (tip) td.title = tip; return td; }, num = v => el("span", "hc-sv", hcNum(v)), op = x => el("span", "hc-op", x);
    starts.append(startCell([]), startCell([]), startCell([op("−"), num(hc.eq.hfa)], "Home field advantage a game starts at"),
      ...terms.map(t => t.v === "bye" ? hcByeStartCell(startCell, t) : startCell([num(t.coef), op("×"), el("span", "hc-sv")], `The coefficient a game starts at on ${hcVarOf(t).short}`)), startCell([op("DVOA ×"), el("span", "hc-sv", String(RULES.userSet.hcDivDvoa))], "A divisional game's share of the DVOA difference"), startCell([]));
    thead.append(hd, starts);
    tbl.append(thead, el("tbody", "hc-rows"));
    parts.push(tbl);
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
    const panel = $("panel"), was = panel.hidden, stack = document.querySelector(".col.left");
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
    const go = w => { hc.week = Math.min(18, Math.max(1, w)); hcGuideFor = null; hcSave(); drawHcGames(); };
    const from = Math.min(18 - HC_SHOWN + 1, Math.max(1, wk - Math.floor(HC_SHOWN / 2)));
    const arrow = (d, svg, name) => { const b = el("button", "hc-wka"); b.type = "button"; b.innerHTML = svg; b.title = b.ariaLabel = name; b.disabled = d < 0 ? wk <= 1 : wk >= 18; b.addEventListener("click", () => go(wk + d)); return b; };
    const tabs = Array.from({ length: HC_SHOWN }, (_, i) => { const w = from + i, b = el("button", "hc-wkt", "Week " + w); b.type = "button"; b.setAttribute("aria-selected", String(w === wk)); b.classList.toggle("now", w === weekNow()); b.addEventListener("click", () => go(w)); return b; });
    box.replaceChildren(arrow(-1, "<svg viewBox=\"0 0 12 20\" width=\"12\" height=\"20\" aria-hidden=\"true\"><path d=\"M10 2 2 10l8 8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", "Earlier week"), ...tabs, arrow(1, "<svg viewBox=\"0 0 12 20\" width=\"12\" height=\"20\" aria-hidden=\"true\"><path d=\"M2 2l8 8-8 8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", "Later week"));
  }
  // Fit's guide, once it has run for this week: each variable alone, and a button that sets it in every game of the week
  function hcGuideTable(wk) {
    const tbl = el("table", "hc-table hc-guide-tbl"), tb = el("tbody"), terms = hc.eq.terms.filter(hcVarOf);
    const cap = el("tr", "hc-guide"), capTd = el("td", "hc-guide-for", `Fit for ${hcGuideName}`);
    capTd.colSpan = 7; cap.append(capTd); tb.append(cap);
    Calc.HC_VARS.filter(v => v.guide === "market" && terms.some(t => t.v === v.k)).forEach(v => {   // the equation's own variables with a coefficient to fit
      const f = hcGuide.res[v.k], tr = el("tr", "hc-guide"), formula = el("td");
      if (!f) { formula.textContent = "can't be fitted on this week's lines"; tr.append(el("td", "hc-guide-h", v.short + " alone"), formula, el("td", "pb-l"), el("td"), el("td", "pb-l"), el("td"), el("td", "pb-l")); tb.append(tr); return; }
      formula.textContent = `− HFA ${hcRound(f.hfa, 100).toFixed(2)} + ${hcRound(f.coef, 1000)} × ${v.short}`;
      formula.title = v.h;
      const use = el("button", null, "Use alone");
      use.type = "button"; use.title = `Set HFA and ${v.short}'s coefficient to these, and every other coefficient to 0, for ${hcGuideName}`;
      use.addEventListener("click", () => hcUseOn(hcGuideFor, s => { s.hfa = hcRound(f.hfa, 1000); terms.forEach(t => { s.c[t.v] = t.v === v.k ? hcRound(f.coef, 1000) : 0; }); }));
      const useTd = el("td", "pb-l"); useTd.append(use);
      tr.append(el("td", "hc-guide-h", v.short + " alone"), formula, el("td", "pb-l", `R² ${f.r2.toFixed(2)}`), el("td", null, `RMSE ${f.rmse.toFixed(1)}`), el("td", "pb-l", `${f.n} games`), el("td"), useTd);
      tb.append(tr);
    });
    const note = el("tr", "hc-guide"), td = el("td", "dim");
    td.colSpan = 7; td.textContent = `Each variable alone against week ${wk}'s market lines (${hcGuide.n} games with a line and both teams on 2 or more games): R² is how much of the market's spreads it explains, RMSE how far off it runs, in points. Use alone sets ${hcGuideName} alone.`;
    note.append(td); tb.append(note);
    tbl.append(tb);
    return tbl;
  }
  // The table scales down to the pane's width when it's wider, so its right edge, the prediction, always shows (the user, Nov 4 2026).
  function fitHcTable() {
    const wrap = document.querySelector("#handicap .hc-games"), tbl = wrap && wrap.querySelector(".hc-table");
    if (!tbl) return;
    tbl.style.zoom = "";
    const rows = [...tbl.querySelectorAll(".hc-rows tr")];
    rows.forEach(r => { r.style.height = ""; });
    if (tbl.offsetWidth > wrap.clientWidth) tbl.style.zoom = String(Math.floor(wrap.clientWidth / tbl.offsetWidth * 1000) / 1000);
    // the pane reaches down to just above the info line, and the games' rows share out what's left of it, up to twice their own height (the user, Nov 4 2026: "measure
    // to bottom of the area (just above info line) and space out vertically"); past that it scrolls
    const pane = wrap.closest(".hc-pane"), info = document.querySelector(".sec-title.one-line"), box = $("handicap");
    if (!pane || !info) return;
    const pad = parseFloat(getComputedStyle(box).paddingBottom) || 0, foot = box.querySelector(".hc-foot"), footH = foot ? foot.getBoundingClientRect().height + 10 : 0, avail = Math.max(200, Math.floor(info.getBoundingClientRect().top - 6 - pad - footH - pane.getBoundingClientRect().top));   // the EV hurdle stays in sight under the pane
    pane.style.height = ""; pane.style.maxHeight = "none";
    const spare = avail - pane.scrollHeight;
    pane.style.maxHeight = pane.style.height = avail + "px";
    const z = Number(tbl.style.zoom) || 1;
    if (spare > 0 && rows.length > 1) { const each = rows[0].getBoundingClientRect().height / z, add = Math.min(each, spare / z / rows.length); rows.forEach(r => { r.style.height = Math.floor(each + add) + "px"; }); }
    // the week picker, no further right than the column divide
    const pick = box.querySelector(".hc-wk"), edge = hcDivide();
    if (pick) pick.style.width = "";
    if (pick && edge) {
      // each week as wide as a week on the NFL's top strip, so the highlight is the same (the user, Nov 4 2026); the chevrons take what's left, so it still ends at the divide
      const strip = document.querySelector(".weektabs.wk2"), stripCell = (strip && parseFloat(strip.style.getPropertyValue("--cell"))) || HC_TAB;
      const room = edge - pick.getBoundingClientRect().left, n = Math.min(18, Math.max(1, Math.floor((room - 2 * HC_ARROW) / stripCell)));
      pick.style.width = Math.floor(room) + "px"; pick.style.setProperty("--cell", stripCell + "px");
      if (n !== HC_SHOWN) { HC_SHOWN = n; hcWeekPicker(Number(wrap.dataset.week)); }
    }
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
    const td = el("td", "hc-game"), box = el("div", "hc-gm");
    const v = el("span", "hc-gv"), h = el("span", "hc-gh");
    v.append(hcChip(nick(g, "away"))); h.append(hcChip(nick(g, "home")));
    box.append(el("span", "hc-ml hc-mlv"), v, el("span", "hc-gs hc-gs-top"), el("span", "hc-at", "@"), h, el("span", "hc-ml hc-mlh"),
      el("span", "hc-ml hc-mlv hc-mml"), el("span", "hc-gs hc-gs-low"), el("span", "hc-ml hc-mlh hc-mml"));
    td.append(box);
    return td;
  };
  // Opportunities by expected value (the user, Nov 4 2026: "only highlight market opportunities outside of a band"): each market price's return per $1 at your result
  // (calc.js hcEv), highlighted when it clears the EV hurdle at the table's foot, so moneylines and spreads are held to the same bar.
  const hcHurdle = () => (Number.isFinite(hc.hurdle) ? hc.hurdle : RULES.userSet.hcHurdle * 100) / 100;
  const hcPct = v => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + "%";
  // A game's moneylines, yours and the market's, each side's market highlighted when its EV clears the hurdle. mine: [visitor, home] or null; ev: hcEv's, or null.
  function hcMoneylines(game, r, mine, ev) {
    const g = r.g.game, mkt = g.line && !g.noLine ? g.line.ml : null, bar = hcHurdle();
    const [mv, mh] = game.querySelectorAll(".hc-ml:not(.hc-mml)"), [kv, kh] = game.querySelectorAll(".hc-mml");
    [[mv, kv, 0, "v"], [mh, kh, 1, "h"]].forEach(([me, mk, i, s]) => {
      me.textContent = mine ? odds(mine[i]) : ""; me.title = "Your price, from your spread by the key number model";
      mk.textContent = mkt && Number.isFinite(mkt[i]) ? odds(mkt[i]) : "";
      const e = ev && ev.ml ? ev.ml[s] : null, take = e !== null && e >= bar;
      mk.classList.toggle("hc-take", take);
      mk.title = e === null ? "The market's moneyline" : `The market's moneyline: ${hcPct(e)} expected at your result${take ? ", over the hurdle" : ""}`;
    });
  }
  // A spread on a fixed decimal point (the user, Nov 4 2026: bold and plain spreads differ in width): the part before the point right-aligned in a box of fixed width,
  // the point and its digit after, so every spread's point sits at the same x whatever its weight. Pick'em sits where the digits would.
  const hcPoint = (span, text) => {
    if (!text) { span.replaceChildren(); return; }
    const i = text.lastIndexOf(".");
    span.replaceChildren(el("span", "hc-pi", i < 0 ? text : text.slice(0, i)), el("span", "hc-pd", i < 0 ? "" : text.slice(i)));
  };
  // The market's visitor spread: green when the visitor's spread clears the hurdle, red when the home team's does (the user, Nov 4 2026).
  function hcMarketLine(span, r, ev) {
    const g = r.g.game, ln = g.line, sp = ln && !g.noLine && !ln.noSp ? ln.sp : null, e = ev && ev.sp, bar = hcHurdle();
    hcPoint(span, sp == null ? "" : hcLine(sp));
    span.classList.toggle("hc-take", !!e && e.v >= bar);
    span.classList.toggle("hc-fade", !!e && e.h >= bar);
    span.title = sp == null ? "" : !e ? "The market's visitor spread" : `The market's visitor spread at your result: the visitor's ${hcPct(e.v)}, the home team's ${hcPct(e.h)}${e.v >= bar ? ": the visitor's spread clears the hurdle" : e.h >= bar ? ": the home team's spread clears the hurdle" : ""}`;
  }
  // Both teams in one division (DIVS, by nickname).
  const hcDivisional = g => { const a = divOf(nick(g, "away")); return a >= 0 && a === divOf(nick(g, "home")); };
  // A game's preview from its row (the user, Nov 4 2026): the game card's Game preview icon, which opens that game's week with the preview open, as the card's does.
  const hcPreviewCell = rg => {
    const td = el("td", "hc-prev"), b = el("button"), g = rg.game;
    b.type = "button"; b.title = "Game preview"; b.setAttribute("aria-label", "Game preview"); b.innerHTML = CARD_ACTIONS.find(a => a[0] === "Game preview")[1];
    b.addEventListener("click", () => { const from = { view: "handicap", week: curWeek }; switchWeek(rg.week); const k = gameKey(g), on = GAMES.find(x => gameKey(x) === k); if (on) { setDetailGame(on, from); showView("week"); } });   // closing it comes back here
    td.append(b);
    return td;
  };
  // Off bye's start: the measured effects, the visitor's and the home team's, in points to the visitor
  const hcByeStartCell = (startCell, t) => {
    const e = hcByeEff(), sg = v => (v < 0 ? "−" : "+") + Math.abs(hcRound(v, 10)).toFixed(1);
    return startCell([el("span", "hc-sv", hcNum(t.coef)), el("span", "hc-op", "×"), el("span", "hc-sv")], e ? `The bye effect over ${e.n} finals, the last 5 seasons and this one, in points to the visitor: the visitor off a bye ${sg(e.v)} ± ${e.seV.toFixed(2)} (${e.onV} games), the home team off a bye ${sg(e.h)} ± ${e.seH.toFixed(2)} (${e.onH} games)` : "");
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
    const sig = rows.map(r => hcKeyOf(r) + (short(r) ? "s" : "") + flags(r)).join(",") + "|" + terms.map(t => t.v).join(",");
    if (body.dataset.sig === sig) { const by = new Map(rows.map(r => [hcKeyOf(r), r])); body.querySelectorAll("tr").forEach(tr => { if (tr.hcUpd) tr.hcUpd(by.get(tr.dataset.k)); }); fitHcTable(); return; }
    const tb = el("tbody", "hc-rows");
    tb.dataset.sig = sig;
    rows.forEach(r => tb.append(hcRow(r, terms, short(r))));
    if (!rows.length) { const tr = el("tr"), td = el("td", "dim", "No games this week."); td.colSpan = 5 + terms.length; tr.append(td); tb.append(tr); }
    body.replaceWith(tb);
    fitHcTable();
  }
  // One game's row: the game, with your spread after the visitor; its HFA; each term's coefficient × value; the visitor's margin they give; the market's spread in the same
  // form and the difference; and the theo moneylines and the market's. tr.hcUpd(r) redraws it from a fresh row of hcStates.
  // Off bye shows only where a team is off a bye (the user, Nov 4 2026: "remove the controls where something is invalid").
  function hcRow(r, terms, short) {
    const tr = el("tr"), k = hcKeyOf(r), game = hcGameCell(r.g.game), theoSpan = el("span", "hc-theo");
    tr.dataset.k = k;
    const mktSpan = el("span", "hc-mkt");   // the market's visitor spread, under yours
    game.querySelector(".hc-gs-top").append(theoSpan); game.querySelector(".hc-gs-low").append(mktSpan);

    if (short) {
      game.title = `Too few games for a prediction: a team has played under ${hc.minGames}`;
      tr.append(hcPreviewCell(r.g), game, ...[0, ...terms].map(() => el("td", "dim", "—")), el("td"), el("td"));
      return tr;
    }
    // a number to type: own() what's typed for this game, or undefined; start() what it is untouched (null: none); put(v) keeps v, undefined clearing it
    const fields = [], fixedVals = [];
    const field = (own, start, put, tip) => {
      const i = el("input");
      i.type = "number"; i.step = "any"; i.title = tip;
      i.addEventListener("input", () => { const x = Number(i.value); if (i.value === "") put(undefined); else if (Number.isFinite(x)) put(x); else return; hcTidy(k); hcSave(); upd(); });
      i.addEventListener("blur", () => upd());
      fields.push({ i, own, start });
      return i;
    };
    const keep = (f, v) => { const s = hcSetFor(k); if (v === undefined) f(s, true); else f(s, false, v); };
    const hfaTd = el("td", "hc-cv");
    hfaTd.append(el("span", "hc-op", "−"), field(() => hcSetOf(k).hfa, () => hc.eq.hfa, v => keep((s, del, x) => { if (del) delete s.hfa; else s.hfa = x; }, v), "Home field advantage for this game: the visitor gives it up, so it enters as a minus"));
    const sideOf = { a: abbr(nick(r.g.game, "away")), h: abbr(nick(r.g.game, "home")) };
    const flagOn = terms.map(t => { const v = hcVarOf(t); return v.side ? ["a", "h"].filter(s => v.side(r[s])) : null; });   // the teams off a bye, for Off bye
    const byeStart = () => Calc.hcByeAdjust(hcByeEff(), r);
    const termTds = terms.map((t, ti) => {
      const td = el("td", "hc-cv"), v = hcVarOf(t);
      if (t.v === "bye") {   // the game's bye adjustment, in points to the visitor
        if (!flagOn[ti].length) return td;
        const shown = el("span", "hc-val");
        shown.title = `Off a bye: ${flagOn[ti].map(sd => sideOf[sd]).join(" and ")}. The points this game's adjusted by for it, to the visitor, from the bye effect measured over the last 5 seasons and this one`;
        fixedVals.push(() => { const a = byeStart(); shown.textContent = a === null ? "none" : hcNum(a); });
        td.append(field(() => hcSetOf(k).c.bye, () => t.coef, x => keep((s, del, y) => { if (del) delete s.c.bye; else s.c.bye = y; }, x), "The coefficient on this game's bye adjustment: 1 takes it as measured"), el("span", "hc-op", "×"), shown);
        return td;
      }
      const coefIn = field(() => hcSetOf(k).c[t.v], () => t.coef, x => keep((s, del, y) => { if (del) delete s.c[t.v]; else s.c[t.v] = y; }, x), `The coefficient on ${v.h.toLowerCase()}, for this game`);
      if (HC_FIXED.has(t.v)) { const shown = el("span", "hc-val"); shown.title = v.h; fixedVals.push(() => { const val = v.f(r.h, r.a, hcExtra(r.g.game)); shown.textContent = val === null ? "none" : hcNum(val); }); td.append(coefIn, el("span", "hc-op", "×"), shown); return td; }
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
        f.i.classList.toggle("hc-set", o !== undefined);
        if (document.activeElement !== f.i) f.i.value = hcNum(v);
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
      const line = -margin, theo = Calc.hcTheo(-margin, hcWinProb());   // theo takes the home team's margin
      hcPoint(theoSpan, hcLine(line));   // your spread after the visitor (the user, Nov 4 2026), the row's prediction since the column at the right went
      const ln = r.g.game.line && !r.g.game.noLine ? r.g.game.line : null, ev = Calc.hcEv(hcWinProb(), -margin, ln ? { sp: ln.noSp ? null : ln.sp, spj: ln.spj, ml: ln.ml } : null);
      hcMarketLine(mktSpan, r, ev);
      hcMoneylines(game, r, theo.ml, ev);   // your spread as moneylines, by the key number model, and the market's
    }
    tr.hcUpd = nr => { if (nr) r = nr; upd(); };
    const fitTd = el("td", "hc-fit"), fit = el("button", "hc-guide-btn", "Fit"), name = `${abbr(nick(r.g.game, "away"))} @ ${abbr(nick(r.g.game, "home"))}`;
    fit.type = "button"; fit.title = `Fit each variable alone to week ${r.g.week}'s lines, as a guide for ${name}: its Use buttons set this game alone. Again to close it.`;
    fit.setAttribute("aria-pressed", String(hcGuideFor === k));
    tr.classList.toggle("hc-fitting", hcGuideFor === k);
    fit.addEventListener("click", () => { const wrap = document.querySelector("#handicap .hc-games"); if (hcGuideFor === k) hcGuideFor = null; else { hcGuideFor = k; hcGuideName = name; if (!hcGuide || hcGuide.week !== r.g.week) hcGuideFit(r.g.week); } wrap.dataset.week = ""; drawHcGames(); });
    fitTd.append(fit);
    tr.prepend(hcPreviewCell(r.g));
    // Divisional: a box on a divisional game, on until it's unticked; ticked, the DVOA difference counts hcDivDvoa of itself
    const divTd = el("td", "hc-div"), isDiv = hcDivisional(r.g.game), divOn = () => isDiv && hcSetOf(k).div !== false;
    if (isDiv) {
      const box = el("input"); box.type = "checkbox"; box.checked = divOn();
      box.title = `A divisional game: ticked, the DVOA difference counts ${RULES.userSet.hcDivDvoa} of itself`;
      box.addEventListener("change", () => { const s = hcSetFor(k); if (box.checked) delete s.div; else s.div = false; hcTidy(k); hcSave(); upd(); });
      divTd.append(box);
    }
    tr.append(game, hfaTd, ...termTds, divTd, fitTd);
    upd();
    return tr;
  }

export { renderHandicap };
