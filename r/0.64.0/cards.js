
import { Calc } from "./calc.js?v=mw5sh34t";
import { NFL_NICKS, PLATE_STATES, TEAM, abbr } from "./leagues.js?v=mw5sh34t";
import { closePreview, GAME_CARD_ACTIONS, nick, changed, $, GAMES, LG, curWeek, detailGame, el, extremes, gameBets, gameKey, gameSettledPL, hedgeFor, helmImg, last, league, leagueId, leagueOf, lineOf, money, odds, parlayShares, pts, riskGame, setDetailGame, scoutOn, trackingOn, setRiskGame, shareRisk, shortDayFmt, showView, signedMoney, spentShares, status, teamLook, tickets, timeZoned, setRiskKey, later, teamChip, hasArt, readableOf, fitSlateLine } from "./base.js?v=mw5sh34t";
import { drawSectionTabs, fitTicketColumn, updateGameArrows, fitViewportHeight, fitSectionTabs } from "./layout.js?v=mw5sh34t";
import { drawGameDetail } from "./panels.js?v=mw5sh34t";
import { expectedOf, gameSituation, liveClock, clockSource } from "./risk.js?v=mw5sh34t";
import { enterMoneyline, enterSpread, enterTotal, showSaved } from "./tracker.js?v=mw5sh34t";
import { telecastFor, watchGame } from "./telecasts.js?v=mw5sh34t";

Object.assign(later, { drawByes });

let lastSavedTabKey = "";
const ACTIVITY_FLASH_MS = 350;   



const tapeLink = g => (leagueOf(g).daily ? `https://www.espn.com/${leagueOf(g).code.toLowerCase()}/recap/_/gameId/${g.eid}` : `https://www.nfl.com/games/${nick(g, "away").toLowerCase()}-at-${nick(g, "home").toLowerCase()}-2026-reg-${g.week}?tab=highlights-replays`);
function cardGutter(g) {
  const box = el("div", "g-gut");
  box.addEventListener("click", e => e.stopPropagation());   
  const st = status(g)[1];
  GAME_CARD_ACTIONS.forEach(([name, icon]) => {
    const b = el("button"), live = name === "Game preview" ? leagueOf(g).gameDetails : name === "Live telecast" ? st !== "final" && !!telecastFor(g) : name === "Tape" ? st === "final" && (!leagueOf(g).daily || !!g.eid) : name === "Box score" ? (st === "live" || st === "final") && !!g.eid : name === "Risk detail" && trackingOn;
    b.type = "button"; b.disabled = !live; b.title = name; b.setAttribute("aria-label", name); b.innerHTML = icon;
    if (name === "Live telecast" && st === "live") b.classList.add("on-air");
    if (name === "Risk detail" && riskGame === g) { b.classList.add("active"); b.setAttribute("aria-pressed", "true"); }
    if (live) b.addEventListener("click", name === "Game preview" ? () => { setDetailGame(g); showView("week"); } : name === "Live telecast" ? () => { watchGame(g); } : name === "Tape" ? () => { window.open(tapeLink(g), "_blank", "noopener"); } : name === "Box score" ? () => { window.open(`https://www.espn.com/${leagueOf(g).code.toLowerCase()}/boxscore/_/gameId/${g.eid}`, "_blank", "noopener"); } : () => { setRiskGame(riskGame === g ? null : g); if (riskGame) setRiskKey(gameKey(g)); });
    box.append(b);
  });
  return box;
}



function finalBadge(chip, g, side) {
  const [r_, g_, b_] = [1, 3, 5].map(i => { const v = parseInt(teamLook(g, side).bg.slice(i, i + 2), 16); return Math.round(v + (255 - v) * .33); });
  chip.style.background = `rgb(${r_} ${g_} ${b_} / .5)`;
}
function plateBadge(chip, g, side) {   
  const k = teamLook(g, side), nk = nick(g, side);
  chip.classList.add("plate");
  chip.style.backgroundColor = k.bg; chip.style.borderColor = k.fg;
  const code = el("b", "pl-no", abbr(nk)), box = el("span", "team-name-text");
  const state = PLATE_STATES[TEAM[nk] && TEAM[nk].state] || "";
  box.append(el("small", "pl-st" + (state.length > 11 ? " long" : ""), state), code);
  const old = chip.querySelector(".team-name-text");
  if (old) old.replaceWith(box); else chip.replaceChildren(box);
}


const showsNow = g => !g.final && !!g.now;
const scoreOf = g => g.final || null;
function teamRow(g, side, over) {
  const L = lineOf(g), away = side === "away", n = away ? 0 : 1;
  const tr = el("tr");
  const name = el("td", "team-cell");
  const chip = teamChip(g, side, leagueOf(g).codeChips ? abbr(nick(g, side)) : nick(g, side), "team-name");
  chip.style.borderColor = "transparent";   
  const liveBoard = !over && showsNow(g);   
  if (hasArt(nick(g, side)) && !liveBoard) {   
    const img = helmImg(nick(g, side), "helm");
    chip.replaceChildren(img, el("span", "team-name-text", abbr(nick(g, side)))); chip.classList.add("has-helm");
  }
  (over ? finalBadge : plateBadge)(chip, g, side);
  if (liveBoard) {   
    const situation = gameSituation(g), box = el("span", "team-name-text live-sc"), old = chip.querySelector(".team-name-text"), s = (situation && situation.score) || g.now.score;   
    box.append(el("span", null, abbr(nick(g, side))), el("span", null, String(s[n])));
    if (old) old.replaceWith(box); else chip.replaceChildren(box);
    chip.classList.add("live"); if (s[n] > s[1 - n]) chip.classList.add("lead");
    if (situation && situation.possession === side) chip.classList.add("possession");   
  }
  name.append(chip);
  if (over) {
    
    const shown = scoreOf(g), won = shown && shown[n] > shown[1 - n];
    chip.classList.add("over"); if (won) chip.classList.add("win");
    chip.style.setProperty("--score-cells", leagueId(g) === "nba" ? 3 : 2);   
    if (g.final && g.final[n] < g.final[1 - n]) chip.classList.add("lost");   
    chip.append(el("span", "sc", shown ? String(shown[n]) : "–"));
    name.colSpan = 3;
    tr.append(name);   
    if (away) { const f = el("td", "final", g.final ? "F" : ""); f.rowSpan = 2; if (g.final) f.setAttribute("aria-label", "Final"); tr.append(f); }
    return tr;
  }
  
  const sp = away ? L.sp : -L.sp;
  const nl = !!g.noLine;   
  const ml = el("td", "ml", !scoutOn() ? "" : nl ? "—" : odds(L.ml[n]));   
  ml.style.color = readableOf(g, side);
  if (!nl && scoutOn() && trackingOn) { ml.classList.add("ml-go"); ml.addEventListener("click", e => { e.stopPropagation(); enterMoneyline(g, n); }); }   
  const noSpread = !nl && !!L.noSp, favRow = L.ml[n] < L.ml[1 - n] || (L.ml[n] === L.ml[1 - n] && !away);   
  const spreadCell = el("td", "sp", !scoutOn() || nl ? "" : noSpread ? (favRow ? Calc.winPct(L.ml, away) + "%" : "—") : sp < 0 ? Calc.winPct(L.ml, away) + "%" : pts(sp).replace(/\d+(\.\d+)?/, v => Number(v).toFixed(1)));   
  spreadCell.style.color = readableOf(g, side);
  if (spreadCell.textContent.endsWith("%")) spreadCell.classList.add("win-percent");
  if (!nl && !noSpread && sp >= 0 && scoutOn() && trackingOn) { spreadCell.classList.add("ml-go"); spreadCell.addEventListener("click", e => { e.stopPropagation(); enterSpread(g, n); }); }   
  tr.append(ml, name, spreadCell);
  
  if (away) {
    const tot = el("td", "tot", !scoutOn() ? "" : nl || L.noTot ? "—" : Number(L.tot).toFixed(1)); tot.rowSpan = 2;
    if (!nl && !L.noTot && scoutOn() && trackingOn) { tot.classList.add("ml-go"); tot.title = "Top half: over. Bottom half: under."; tot.addEventListener("click", e => { e.stopPropagation(); const r = tot.getBoundingClientRect(); enterTotal(g, e.clientY < r.top + r.height / 2 ? 0 : 1); }); }   
    tr.append(tot);
  }
  return tr;
}


let tradeTip = null;
const hideTradeTip = () => { if (tradeTip) { tradeTip.remove(); tradeTip = null; } };
function showTradeTip(anchor, h) {
  hideTradeTip();
  const tip = el("div", "trade-tip");
  tip.append(el("b", null, `Buy ${h.n} contracts: ${h.txt} at ${Math.round(h.ask * 100)}¢ on Kalshi, ${money(h.cost)}`),
    el("div", null, `Worst ${signedMoney(h.worstBefore)} → ${signedMoney(h.worstAfter)}, best ${signedMoney(h.bestBefore)} → ${signedMoney(h.bestAfter)}`));
  document.body.append(tip);
  tradeTip = tip;
  const a = anchor.getBoundingClientRect(), t = tip.getBoundingClientRect();
  tip.style.left = Math.max(8, Math.min(window.innerWidth - t.width - 8, a.left + a.width / 2 - t.width / 2)) + "px";
  tip.style.top = (a.top - t.height - 8 >= 8 ? a.top - t.height - 8 : a.bottom + 8) + "px";
}
let cardsScroll = null;
function drawGameCards() {
  hideTradeTip();
  const box = $("games");
  
  const allFinal = GAMES.length > 0 && GAMES.every(g => g.final);
  document.querySelector(".col.left").classList.toggle("all-final", allFinal);
  document.querySelector(".bye-box").style.display = !LG().byes || allFinal || (detailGame && GAMES.includes(detailGame)) ? "none" : "";   
  fitSlateLine();
  if (curWeek + ":" + allFinal !== lastSavedTabKey) { lastSavedTabKey = curWeek + ":" + allFinal; showSaved(allFinal ? "summary" : "tickets"); }
  const shownDetail = detailGame && GAMES.includes(detailGame) ? detailGame : null;
  const wasDetail = box.classList.contains("gd");
  if (shownDetail && !wasDetail) cardsScroll = { week: curWeek, league, x: box.scrollLeft, y: window.scrollY };   
  box.classList.toggle("gd", !!shownDetail);
  
  { const topEl = document.querySelector(".top"), cl = document.querySelector(".col.left"); topEl.classList.toggle("gd-open", !!shownDetail); topEl.style.setProperty("--bdx", (cl.getBoundingClientRect().width + 20) + "px"); }
  if (shownDetail) { box.classList.remove("kickoff-windows", "flat"); drawGameDetail(box, shownDetail); { const x = el("button", "gd-close", "×"); x.type = "button"; x.title = "Close"; x.setAttribute("aria-label", "Close game preview"); x.addEventListener("click", () => closePreview()); box.append(x); } drawSectionTabs(); fitViewportHeight(); fitSectionTabs(); fitTicketColumn(); updateGameArrows(); return; }
  box.replaceChildren();
  box.classList.add("kickoff-windows");   
  const made = GAMES.map(g => [g, gameCard(g)]);
  windowColumns(box, made);
  drawSectionTabs();
  fitViewportHeight();
  fitSectionTabs();
  fitTicketColumn();
  if (wasDetail && cardsScroll && cardsScroll.week === curWeek && cardsScroll.league === league) { box.scrollLeft = cardsScroll.x; window.scrollTo(window.scrollX, cardsScroll.y); }
  updateGameArrows();
}


function gameCard(g) {
    const mine = gameBets(g);
    const shares = parlayShares(g);
    const spent = spentShares(g);
    const staked = mine.filter(t => !t.bonus).reduce((s, t) => s + t.amount, 0) + spent.filter(s => !s.t.bonus).reduce((a, s) => a + s.share, 0);
    const bonusStaked = mine.filter(t => t.bonus).reduce((s, t) => s + t.amount, 0) + spent.filter(s => s.t.bonus).reduce((a, s) => a + s.share, 0);
    const [stText, stCls] = status(g);
    const over = stCls === "final" && !showsNow(g);

    const card = el("article", "game" + (over ? " is-final" : "") + (riskGame === g ? " sel" : ""));
    if (scoutOn() && g.live && stCls === "live") { const P = g.line, sgn = v => (v > 0 ? "+" : "") + v; card.title = `Live prices (Kalshi). Pre-game: ${nick(g, "away")} ${pts(P.sp)} @ ${nick(g, "home")}, total ${P.tot}, moneyline ${sgn(P.ml[0])} / ${sgn(P.ml[1])}`; }   

    
    const top = el("div", "g-top" + (stCls === "live" ? " live" : "") + (stText === "Upcoming" ? " upcoming" : ""));
    
    
    
    if (stCls === "live" || showsNow(g)) {
      const clock = el("span", "g-clock", liveClock(g) || "Live"), from = clockSource(g); clock.title = from ? "The game clock, from " + from : "The game clock";
      if (stCls === "live" && g.live) { const light = el("fan-activity-indicator"), elapsed = performance.now() - (g.freshAt ?? -1e9); if (elapsed < ACTIVITY_FLASH_MS) { light.classList.add("flash"); light.style.animationDelay = -elapsed + "ms"; } clock.prepend(light); }
      top.append(clock);
      
      const situation = stCls === "live" ? gameSituation(g) : null;
      if (situation && situation.text) top.append(el("span", "g-situation", situation.text));
    }
    else top.append(el("span", "g-when", `${shortDayFmt.format(new Date(g.t))} · ${timeZoned(new Date(g.t))} · ${g.tv}`));

    
    const mid = el("div", "g-mid");
    const table = el("table", over ? "board" : "board lines");
    const tbody = el("tbody");
    tbody.append(teamRow(g, "away", over), teamRow(g, "home", over));
    table.append(tbody);
    mid.append(table);

    
    const bottomRow = el("div", "g-bottom");
    const wagered = el("div", "stat"), risk = el("div", "stat mid"), pl = el("div", "stat");
    const nd = t => t.split("$").join("");   
    const noBets = !mine.length && !spent.length && !shares.length;   
    const hedge = g.final ? null : hedgeFor(g, mine, shares);   
    const tb = hedge ? el("b", hedge.kind === "lock" ? "mark-lock hedge-icon" : "mark-hedge hedge-icon") : null;
    if (hedge) {
      const lock = hedge.kind === "lock", name = lock ? "Locks in a profit" : "Suggested hedge";
      tb.addEventListener("mouseenter", () => showTradeTip(tb, hedge));
      tb.addEventListener("mouseleave", hideTradeTip);
      tb.innerHTML = lock
        ? '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4.75 7V5a3.25 3.25 0 0 1 6.5 0v2"/><rect x="2.75" y="7" width="10.5" height="7.5" rx="1.5" fill="currentColor" stroke="none"/></svg>'
        : '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M1 13.5c3 0 3.8-1.6 4.8-4.8C6.6 6 7 3 8 3s1.400 3 2.200 5.700c1 3.200 1.800 4.800 4.800 4.800"/></svg>';
      tb.setAttribute("aria-label", name);
    }
    const wb = el("b", null, noBets ? "—" : nd(money(staked)));
    if (bonusStaked) wb.append(el("span", "bonus-staked", " + B" + nd(money(bonusStaked))));
    wagered.append(el("span", "lbl", mine.length + spent.length ? `Wagers (${mine.length + spent.length})` : "Wagers"), wb);
    const maxRisk = (mine.length ? extremes(g, mine).maxRisk : 0) + shareRisk(shares);
    const rv = el("span", "rk-val"); rv.append(el("b", !g.final && maxRisk >= 500 ? "mark-risk" : null, noBets ? "—" : nd(money(maxRisk))), ...(tb ? [tb] : []));
    risk.append(el("span", "lbl", "Risk"), rv);   
    
    let plText = "—", plCls = "dim";
    const settled = gameSettledPL(g);
    if (settled !== null) { plText = nd(signedMoney(settled)); plCls = "settled " + (settled > 0.004 ? "profit" : settled < -0.004 ? "loss" : "dim"); }
    else if (stCls === "live" && g.live && (mine.length || shares.length)) {   
      const e = expectedOf(g, mine, shares);
      plText = nd(signedMoney(e)); plCls = "live-pl " + (e > 0.5 ? "profit" : e < -0.5 ? "loss" : "dim");
    }
    pl.append(el("span", "lbl", "P/L"), el("b", plCls, plText));
    if (g.final) { bottomRow.classList.add("done"); bottomRow.append(pl); }   
    else bottomRow.append(wagered, risk, pl);

    if (!over) card.append(top);   
    card.append(mid, bottomRow, cardGutter(g));
    return card;
}



function windowColumns(box, made) {
  if (!made.length) { box.classList.remove("flat"); box.replaceChildren(el("p", "page-stub-text", "No games this day.")); return; }
  const allFinal = made.every(([g]) => g.final);
  box.classList.toggle("flat", allFinal);
  if (allFinal) { flatGrid(box, [...made].sort((a, b) => new Date(a[0].t) - new Date(b[0].t)).map(m => m[1])); return; }
  const wins = [];
  const etDay = t => new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" }).format(new Date(t));
  [...made].sort((a, b) => new Date(a[0].t) - new Date(b[0].t)).forEach(([g, card]) => {
    const w = wins[wins.length - 1];
    
    if (w && (new Date(g.t) - new Date(w.t) <= 3600e3 || (etDay(g.t) === "Thu" && etDay(w.t) === "Thu"))) w.cards.push(card); else wins.push({ t: g.t, cards: [card] });
  });
  const et = (t, o) => new Intl.DateTimeFormat("en-US", { ...o, timeZone: "America/New_York" }).format(new Date(t));
  const slotName = t => {
    if (GAMES[0] && leagueOf(GAMES[0]).daily) return timeZoned(new Date(t));   
    const day = et(t, { weekday: "short" }), hr = Number(et(t, { hour: "numeric", hour12: false }));
    if (day === "Sun") return hr >= 19 ? "Sunday night" : hr >= 15 ? "Late window" : hr >= 12 ? "Main slate" : "Sunday morning";
    if (day === "Mon") return "Monday night";
    if (day === "Wed") return "Wednesday night";
    if (day === "Thu") return hr >= 19 ? "Thursday night" : "Thursday";
    if (day === "Fri") return "Friday";
    return day;
  };
  
  
  [["Sunday morning", /^Thursday/], ["Monday night", /^Sunday night/]].forEach(([name, host]) => {
    const i = wins.findIndex(w => slotName(w.t) === name), hw = wins.find(w => host.test(slotName(w.t)));
    if (i >= 0 && hw && hw.cards.length <= 2) hw.sun = wins.splice(i, 1)[0];
  });
  wins.forEach(w => {
    const cols = w.cards.length >= 9 ? 3 : w.cards.length >= 6 ? 2 : 1, slot = el("section", "slot"), grid = el("div", "slot-cards");
    grid.style.setProperty("--rows", Math.ceil(w.cards.length / cols) + (w.sun ? 2 + w.sun.cards.length - 1 : 0));
    grid.style.setProperty("--cols", cols);
    slot.append(el("h3", "slot-head", slotName(w.t)), grid);
    grid.append(...w.cards);
    if (w.sun) {
      const r = w.cards.length + 2, h = el("h3", "slot-head sunday-head", slotName(w.sun.t));
      h.style.gridRow = String(r - 1);
      w.sun.cards.forEach((c, i) => { c.style.gridRow = String(r + i); });
      grid.append(h, ...w.sun.cards);
    }
    box.append(slot);
  });
}




function flatGrid(box, cards) {
  const grid = el("div", "flat-cards");
  grid.append(...cards);
  box.append(grid);
  let best = null;
  for (let cols = cards.length === 16 ? 4 : 1; cols <= (cards.length === 16 ? 4 : cards.length); cols++) {   
    const rows = Math.ceil(cards.length / cols), w = cols * 376 + (cols - 1) * 4, h = rows * 165 + (rows - 1) * 4;
    const scale = Math.min(1, (box.clientWidth - 1) / w, (box.clientHeight - 8) / h);
    if (!best || scale > best.scale) best = { cols, scale };
  }
  grid.style.setProperty("--cols", best.cols);
  grid.style.setProperty("zoom", best.scale);
}
window.addEventListener("resize", () => { const b = $("games"); if (b && b.classList.contains("flat")) changed("cards"); });


function drawByes() {
  const playing = new Set(GAMES.flatMap(g => [nick(g, "away"), nick(g, "home")]));
  const off = LG().byes ? NFL_NICKS.filter(t => !playing.has(t)).sort() : [];   
  const box = $("byes");
  box.replaceChildren();
  $("byeLabel").hidden = !off.length;
  box.append(...off.map(t => {
    
    const { bg, fg } = TEAM[t], c = el("span", "bye-chip");
    c.style.background = bg; c.style.color = fg; c.title = t;
    if (hasArt(t)) c.append(helmImg(t, "bye-helm"));
    c.append(el("span", null, abbr(t)));
    return c;
  }));
  fitSlateLine();
}

export { drawGameCards, gameCard, drawByes };
