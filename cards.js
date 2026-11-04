// The game cards (the refactor, Nov 3 2026, from base.js): each card's badges, lines and gutter, the strip of cards in kickoff windows, a finished week's grid, and the byes.
import { Calc } from "./calc.js?v=mw231hrw";
import { NFL_NICKS, PLATE_STATES, TEAM, abbr } from "./leagues.js?v=mw231hrw";
import { CARD_ACTIONS, nick, changed, $, GAMES, LG, curWeek, detailGame, el, extremes, gameBets, gameKey, gameSettledPL, hedgeFor, helmImg, last, league, leagueId, leagueOf, lineOf, money, odds, parlayShares, projectedPL, pts, riskGame, setDetailGame, pricesOn, trackingOn, setRiskGame, shareRisk, shortDayFmt, showView, signedMoney, spentShares, status, teamLook, tickets, timeZoned, setRiskKey, later, teamChip, hasArt, brighterOf, fitSlateLine } from "./base.js?v=mw231hrw";
import { renderSectionTabs, fitTicketColumn, updateGameArrows, fitViewportHeight, fitSectionTabs } from "./layout.js?v=mw231hrw";
import { renderGameDetail } from "./panels.js?v=mw231hrw";
import { fillMoneyline, fillSpread, fillTotal, showSaved } from "./tracker.js?v=mw231hrw";
import { telecastFor, watchGame } from "./telecasts.js?v=mw231hrw";
// base.js draws the byes as a league or week changes
Object.assign(later, { renderByes });

let lastSavedTabKey = "";

// A final NFL game's replays on nfl.com, in the user's own browser, where their sign-in is. Condensed Replay is a button on that tab. Every 2026 game to Week 8 answered at this address, Nov 1 2026.
// Tape: the NFL's condensed replay on nfl.com; the NBA's and NHL's recap with its highlights on ESPN (Nov 3 2026), by ESPN's game id.
const tapeLink = g => (leagueOf(g).daily ? `https://www.espn.com/${leagueOf(g).code.toLowerCase()}/recap/_/gameId/${g.eid}` : `https://www.nfl.com/games/${nick(g, "away").toLowerCase()}-at-${nick(g, "home").toLowerCase()}-2026-reg-${g.week}?tab=highlights-replays`);
function cardGutter(g) {
  const box = el("div", "g-gut");
  box.addEventListener("click", e => e.stopPropagation());   // a click here isn't a click on the card
  const st = status(g)[1];
  CARD_ACTIONS.forEach(([name, icon]) => {
    const b = el("button"), live = name === "Game preview" ? leagueOf(g).gameDetails : name === "Live telecast" ? st !== "final" && !!telecastFor(g) : name === "Tape" ? st === "final" && (!leagueOf(g).daily || !!g.eid) : name === "Box score" ? (st === "live" || st === "final") && !!g.eid : name === "Risk detail" && trackingOn;
    b.type = "button"; b.disabled = !live; b.title = name; b.setAttribute("aria-label", name); b.innerHTML = icon;
    if (name === "Live telecast" && st === "live") b.classList.add("on-air");
    if (name === "Risk detail" && riskGame === g) { b.classList.add("active"); b.setAttribute("aria-pressed", "true"); }
    if (live) b.addEventListener("click", name === "Game preview" ? () => { setDetailGame(g); showView("week"); } : name === "Live telecast" ? () => { watchGame(g); } : name === "Tape" ? () => { window.open(tapeLink(g), "_blank", "noopener"); } : name === "Box score" ? () => { window.open(`https://www.espn.com/${leagueOf(g).code.toLowerCase()}/boxscore/_/gameId/${g.eid}`, "_blank", "noopener"); } : () => { setRiskGame(riskGame === g ? null : g); if (riskGame) setRiskKey(gameKey(g)); });
    box.append(b);
  });
  return box;
}

// The game card's team badge, by named style. Each colors a chip that already has its text; a final game's card has no badge.
const BADGE_STYLES = {
  plain: { label: "Plain", draw(chip, g, side) {   // the badge color is lightened 33% toward white, then faded 50%; the helmet stays solid
    const [r_, g_, b_] = [1, 3, 5].map(i => { const v = parseInt(teamLook(g, side).bg.slice(i, i + 2), 16); return Math.round(v + (255 - v) * .33); });
    chip.style.background = `rgb(${r_} ${g_} ${b_} / .5)`;
  } },
  license: { label: "License", draw(chip, g, side) {   // the team's colors on its home state's plate: state on top, the team stamped below
    const k = teamLook(g, side), nk = nick(g, side);
    chip.classList.add("plate");
    chip.style.backgroundColor = k.bg; chip.style.borderColor = k.fg;
    const code = el("b", "pl-no", abbr(nk)), box = el("span", "tn-txt");
    const state = PLATE_STATES[TEAM[nk] && TEAM[nk].state] || "";
    box.append(el("small", "pl-st" + (state.length > 11 ? " long" : ""), state), code);
    const old = chip.querySelector(".tn-txt");
    if (old) old.replaceWith(box); else chip.replaceChildren(box);
  } }
};
let badgeStyle = "license";
try { const s = localStorage.getItem("fan.badges"); if (BADGE_STYLES[s]) badgeStyle = s; } catch (e) {}
function setBadgeStyle(s) {
  badgeStyle = s;
  try { localStorage.setItem("fan.badges", s); } catch (e) {}
  changed("cards");
}

// A game under way, by ESPN: its card has the clock, and each plate the team's score, with or without prices.
const showsNow = g => !g.final && !!g.now;
const scoreOf = g => g.final || null;
function teamRow(g, side, over) {
  const L = lineOf(g), away = side === "away", n = away ? 0 : 1;
  const tr = el("tr");
  const name = el("td", "tn");
  const chip = teamChip(g, side, leagueOf(g).codeChips ? abbr(nick(g, side)) : nick(g, side), "tname");
  chip.style.borderColor = "transparent";   // no outline on black badges here (the other views keep it)
  if (hasArt(nick(g, side))) {   // the helmet or logo sits at the left of the badge
    const img = helmImg(nick(g, side), "helm");
    chip.replaceChildren(img, el("span", "tn-txt", abbr(nick(g, side)))); chip.classList.add("has-helm");
  }
  BADGE_STYLES[over ? "plain" : badgeStyle].draw(chip, g, side);
  if (!over && showsNow(g)) {   // a black plate holding what a final's card shows: team and score in scoreboard type, the leader lit
    const box = el("span", "tn-txt live-sc"), old = chip.querySelector(".tn-txt"), s = g.now.score;
    box.append(el("span", null, abbr(nick(g, side))), el("span", null, String(s[n])));
    if (old) old.replaceWith(box); else chip.replaceChildren(box);
    chip.classList.add("live"); if (s[n] > s[1 - n]) chip.classList.add("lead");    }
  name.append(chip);
  if (over) {
    // final: no badge; helmet, name and score share one cell, the name centered between helmet and score in the scoreboard font
    const shown = scoreOf(g), won = shown && shown[n] > shown[1 - n];
    chip.classList.add("over"); if (won) chip.classList.add("win");
    chip.style.setProperty("--score-cells", leagueId(g) === "nba" ? 3 : 2);   // the NBA's scores run to three digits
    if (g.final && g.final[n] < g.final[1 - n]) chip.classList.add("lost");   // the losing team's helmet is faded to 25% opacity
    chip.append(el("span", "sc", shown ? String(shown[n]) : "–"));
    name.colSpan = 3;
    tr.append(name);   // no moneyline once the game is over
    if (away) { const f = el("td", "fin", g.final ? "F" : ""); f.rowSpan = 2; if (g.final) f.setAttribute("aria-label", "Final"); tr.append(f); }
    return tr;
  }
  // The favorite's spread is the underdog's mirrored, so only the underdog's row shows it. The favorite's row shows its chance to win there instead.
  const sp = away ? L.sp : -L.sp;
  const nl = !!g.noLine;   // no market yet (a far-off week): dashes instead of the placeholder numbers
  const ml = el("td", "ml", !pricesOn() ? "" : nl ? "—" : odds(L.ml[n]));   // tracking off: no prices anywhere, not dashes
  ml.style.color = brighterOf(g, side);
  if (!nl && pricesOn() && trackingOn) { ml.classList.add("ml-go"); ml.addEventListener("click", e => { e.stopPropagation(); fillMoneyline(g, n); }); }   // a moneyline click fills the wager ticket instead of selecting the card
  const nsp = !nl && !!L.noSp, favRow = L.ml[n] < L.ml[1 - n] || (L.ml[n] === L.ml[1 - n] && !away);   // no spread market yet: the favorite's row keeps its chance to win, the other a dash
  const spc = el("td", "sp", !pricesOn() || nl ? "" : nsp ? (favRow ? Calc.winPct(L.ml, away) + "%" : "—") : sp < 0 ? Calc.winPct(L.ml, away) + "%" : pts(sp).replace(/\d+(\.\d+)?/, v => Number(v).toFixed(1)));   // one decimal always: +4.0, +3.5
  spc.style.color = brighterOf(g, side);
  if (spc.textContent.endsWith("%")) spc.classList.add("wp");
  if (!nl && !nsp && sp >= 0 && pricesOn() && trackingOn) { spc.classList.add("ml-go"); spc.addEventListener("click", e => { e.stopPropagation(); fillSpread(g, n); }); }   // the spread shows on the underdog's row, so a click fills the underdog
  tr.append(ml, name, spc);
  // The total is the same for both teams: one cell on the first row spanning both, centered between them.
  if (away) {
    const tot = el("td", "tot", !pricesOn() ? "" : nl || L.noTot ? "—" : Number(L.tot).toFixed(1)); tot.rowSpan = 2;
    if (!nl && !L.noTot && pricesOn() && trackingOn) { tot.classList.add("ml-go"); tot.title = "Top half: over. Bottom half: under."; tot.addEventListener("click", e => { e.stopPropagation(); const r = tot.getBoundingClientRect(); fillTotal(g, e.clientY < r.top + r.height / 2 ? 0 : 1); }); }   // a total click fills the wager ticket
    tr.append(tot);
  }
  return tr;
}

// The hover explanation of a game card's lock or hedge icon. One element on the page; a redraw of the cards removes it, since the icon under the pointer is replaced without a mouseleave.
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
function renderGames() {
  hideTradeTip();
  const box = $("games");
  // A week whose games are all final has no wager ticket; the saved tickets card shows its Summary tab by default (set once per week, and when the week becomes final).
  const allFinal = GAMES.length > 0 && GAMES.every(g => g.final);
  document.querySelector(".col.left").classList.toggle("all-final", allFinal);
  document.querySelector(".bye-box").style.display = !LG().byes || allFinal || (detailGame && GAMES.includes(detailGame)) ? "none" : "";   // no byes line for a finished week, or while a game detail is open
  fitSlateLine();
  if (curWeek + ":" + allFinal !== lastSavedTabKey) { lastSavedTabKey = curWeek + ":" + allFinal; showSaved(allFinal ? "summary" : "tickets"); }
  const shownDetail = detailGame && GAMES.includes(detailGame) ? detailGame : null;
  const wasDetail = box.classList.contains("bd");
  if (shownDetail && !wasDetail) cardsScroll = { week: curWeek, league, x: box.scrollLeft, y: window.scrollY };   // closing the preview puts the cards back where they were
  box.classList.toggle("bd", !!shownDetail);
  // a game preview takes over the ticket column's room: the totals, saved tickets and wager ticket are hidden (their space stays) and the preview card widens across it
  { const topEl = document.querySelector(".top"), cl = document.querySelector(".col.left"); topEl.classList.toggle("bd-open", !!shownDetail); topEl.style.setProperty("--bdx", (cl.getBoundingClientRect().width + 20) + "px"); }
  if (shownDetail) { box.classList.remove("strip", "flat"); renderGameDetail(box, shownDetail); { const x = el("button", "bd-close", "×"); x.type = "button"; x.title = "Close"; x.setAttribute("aria-label", "Close game preview"); x.addEventListener("click", () => { setDetailGame(null); showView("week"); }); box.append(x); } renderSectionTabs(); fitViewportHeight(); fitSectionTabs(); fitTicketColumn(); updateGameArrows(); return; }
  box.replaceChildren();
  box.classList.add("strip");   // every week: the cards sit in columns by kickoff window, with a scrollbar along the bottom
  const made = [];
  GAMES.forEach(g => {
    const mine = gameBets(g);
    const shares = parlayShares(g);
    const spent = spentShares(g);
    const staked = mine.filter(t => !t.bonus).reduce((s, t) => s + t.amount, 0) + spent.filter(s => !s.t.bonus).reduce((a, s) => a + s.share, 0);
    const bonusStaked = mine.filter(t => t.bonus).reduce((s, t) => s + t.amount, 0) + spent.filter(s => s.t.bonus).reduce((a, s) => a + s.share, 0);
    const [stText, stCls] = status(g);
    const over = stCls === "final" && !showsNow(g);

    const card = el("article", "game" + (over ? " is-final" : "") + (riskGame === g ? " sel" : ""));
    if (pricesOn() && g.live && stCls === "live") { const P = g.line, sgn = v => (v > 0 ? "+" : "") + v; card.title = `Live prices (Kalshi). Pre-game: ${nick(g, "away")} ${pts(P.sp)} @ ${nick(g, "home")}, total ${P.tot}, moneyline ${sgn(P.ml[0])} / ${sgn(P.ml[1])}`; }   // hover shows the saved pre-game line

    // Top: when and where to watch
    const top = el("div", "g-top" + (stCls === "live" ? " live" : "") + (stText === "Upcoming" ? " upcoming" : ""));
    // Under way, the day and time are moot and the status badge sits mid-card, so only the network is left beside it.
    // A game in progress shows only its network, outlined in red like an "on air" button (no In progress badge).
    if (showsNow(g)) top.append(el("span", "g-air", [g.now.clock, g.tv].filter(Boolean).join(" · ")));
    else if (stCls === "live") top.append(el("span", "g-air", g.tv || "Live"));
    else top.append(el("span", "g-when", `${shortDayFmt.format(new Date(g.t))} · ${timeZoned(new Date(g.t))} · ${g.tv}`));

    // Middle: lines, or the score once the game is over
    const mid = el("div", "g-mid");
    const table = el("table", over ? "board" : "board lines");
    const tbody = el("tbody");
    tbody.append(teamRow(g, "away", over), teamRow(g, "home", over));
    table.append(tbody);
    mid.append(table);

    // Bottom: risk and profit/loss
    const bot = el("div", "g-bot");
    const wagered = el("div", "stat"), risk = el("div", "stat mid"), pl = el("div", "stat");
    const nd = t => t.split("$").join("");   // the values on game cards carry no dollar signs
    const noBets = !mine.length && !spent.length && !shares.length;   // no bets on this game: dashes instead of zeros
    const hedge = g.final ? null : hedgeFor(g, mine, shares);   // Lock or Hedge when the game's risk detail has a suggested bet
    const tb = hedge ? el("b", hedge.kind === "lock" ? "dhi tico" : "dhg tico") : null;
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
    if (bonusStaked) wb.append(el("span", "bsub", " + B" + nd(money(bonusStaked))));
    wagered.append(el("span", "lbl", mine.length + spent.length ? `Wagers (${mine.length + spent.length})` : "Wagers"), wb);
    const maxRisk = (mine.length ? extremes(g, mine).maxRisk : 0) + shareRisk(shares);
    const rv = el("span", "rk-val"); rv.append(el("b", !g.final && maxRisk >= 500 ? "dlo" : null, noBets ? "—" : nd(money(maxRisk))), ...(tb ? [tb] : []));
    risk.append(el("span", "lbl", "Risk"), rv);   // red highlight from $500 of risk on a game still to be played
    // A final game with a score is settled: grade every wager against the final margin and total, and double-underline the result.
    let plText = "—", plCls = "dim";
    const settled = gameSettledPL(g);
    if (settled !== null) { plText = nd(signedMoney(settled)); plCls = "settled " + (settled > 0.004 ? "pos" : settled < -0.004 ? "neg" : "dim"); }
    else if (stCls === "live" && g.live && (mine.length || shares.length)) {   // under way with live prices: the expected P/L at the live win chances, in a P/L-coded outline like the network
      const e = mine.reduce((s, t) => s + projectedPL(t), 0) + shares.reduce((s, q) => s + q.f * projectedPL(q.t), 0);
      plText = nd(signedMoney(e)); plCls = "livepl " + (e > 0.5 ? "pos" : e < -0.5 ? "neg" : "dim");
    }
    pl.append(el("span", "lbl", "P/L"), el("b", plCls, plText));
    if (g.final) { bot.classList.add("done"); bot.append(pl); }   // a final game: the bottom row is just its P/L, in its usual column
    else bot.append(wagered, risk, pl);

    if (!over) card.append(top);   // a final game has no top line: the F on its board says it
    card.append(mid, bot, cardGutter(g));
    made.push([g, card]);
  });
  windowColumns(box, made);
  renderSectionTabs();
  fitViewportHeight();
  fitSectionTabs();
  fitTicketColumn();
  if (wasDetail && cardsScroll && cardsScroll.week === curWeek && cardsScroll.league === league) { box.scrollLeft = cardsScroll.x; window.scrollTo(window.scrollX, cardsScroll.y); }
  updateGameArrows();
}

// Games that kick off within an hour of each other share a column. The column is named by its slot (Eastern time, since the
// slots are the league's) and carries its day and first kickoff in the viewer's time; six or more games take two card-columns.
function windowColumns(box, made) {
  if (!made.length) { box.classList.remove("flat"); box.replaceChildren(el("p", "pg-stub-t", "No games this day.")); return; }
  const allFinal = made.every(([g]) => g.final);
  box.classList.toggle("flat", allFinal);
  if (allFinal) { flatGrid(box, [...made].sort((a, b) => new Date(a[0].t) - new Date(b[0].t)).map(m => m[1])); return; }
  const wins = [];
  const etDay = t => new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" }).format(new Date(t));
  [...made].sort((a, b) => new Date(a[0].t) - new Date(b[0].t)).forEach(([g, card]) => {
    const w = wins[wins.length - 1];
    // within an hour of the window's first game, or any Thursday game after a Thursday window: same column
    if (w && (new Date(g.t) - new Date(w.t) <= 3600e3 || (etDay(g.t) === "Thu" && etDay(w.t) === "Thu"))) w.cards.push(card); else wins.push({ t: g.t, cards: [card] });
  });
  const et = (t, o) => new Intl.DateTimeFormat("en-US", { ...o, timeZone: "America/New_York" }).format(new Date(t));
  const slotName = t => {
    if (GAMES[0] && leagueOf(GAMES[0]).daily) return timeZoned(new Date(t));   // NBA: columns by tipoff time
    const day = et(t, { weekday: "short" }), hr = Number(et(t, { hour: "numeric", hour12: false }));
    if (day === "Sun") return hr >= 19 ? "Sunday night" : hr >= 15 ? "Late window" : hr >= 12 ? "Main slate" : "Sunday morning";
    if (day === "Mon") return "Monday night";
    if (day === "Wed") return "Wednesday night";
    if (day === "Thu") return hr >= 19 ? "Thursday night" : "Thursday";
    if (day === "Fri") return "Friday";
    return day;
  };
  // A Sunday morning game (the international one) goes in the Thursday column, two rows below its last Thursday card, under its own heading.
  // Sunday night and Monday night are stacked the same way.
  [["Sunday morning", /^Thursday/], ["Monday night", /^Sunday night/]].forEach(([name, host]) => {
    const i = wins.findIndex(w => slotName(w.t) === name), hw = wins.find(w => host.test(slotName(w.t)));
    if (i >= 0 && hw && hw.cards.length <= 2) hw.sun = wins.splice(i, 1)[0];
  });
  wins.forEach(w => {
    const cols = w.cards.length >= 9 ? 3 : w.cards.length >= 6 ? 2 : 1, slot = el("section", "slot"), grid = el("div", "slot-cards");
    grid.style.setProperty("--rows", Math.ceil(w.cards.length / cols) + (w.sun ? 2 + w.sun.cards.length - 1 : 0));
    grid.style.setProperty("--cols", cols);
    slot.append(el("h3", "slot-h", slotName(w.t)), grid);
    grid.append(...w.cards);
    if (w.sun) {
      const r = w.cards.length + 2, h = el("h3", "slot-h sun-h", slotName(w.sun.t));
      h.style.gridRow = String(r - 1);
      w.sun.cards.forEach((c, i) => { c.style.gridRow = String(r + i); });
      grid.append(h, ...w.sun.cards);
    }
    box.append(slot);
  });
}

// A week with every game final has nothing left to watch: no columns or headings, just a grid of cards in kickoff order. The
// cards keep their 376 x 150 layout and the grid is scaled (zoom) so nothing on a card can overlap; the column count is the one
// that allows the biggest scale in the box (width and height both have to fit).
function flatGrid(box, cards) {
  const grid = el("div", "flat-cards");
  grid.append(...cards);
  box.append(grid);
  let best = null;
  for (let cols = cards.length === 16 ? 4 : 1; cols <= (cards.length === 16 ? 4 : cards.length); cols++) {   // 16 games: always 4 x 4
    const rows = Math.ceil(cards.length / cols), w = cols * 376 + (cols - 1) * 4, h = rows * 165 + (rows - 1) * 4;
    const scale = Math.min(1, (box.clientWidth - 1) / w, (box.clientHeight - 8) / h);
    if (!best || scale > best.scale) best = { cols, scale };
  }
  grid.style.setProperty("--cols", best.cols);
  grid.style.setProperty("zoom", best.scale);
}
window.addEventListener("resize", () => { const b = $("games"); if (b && b.classList.contains("flat")) changed("cards"); });

// The teams not playing this week: every team in the color table that is on no game of the selected week.
function renderByes() {
  const playing = new Set(GAMES.flatMap(g => [nick(g, "away"), nick(g, "home")]));
  const off = LG().byes ? NFL_NICKS.filter(t => !playing.has(t)).sort() : [];   // only the NFL has byes
  const box = $("byes");
  box.replaceChildren();
  $("byeLabel").hidden = !off.length;
  box.append(...off.map(t => {
    // a team chip like the Graphs badges: team colors, abbreviation, helmet overhanging at the left
    const { bg, fg } = TEAM[t], c = el("span", "bye-chip");
    c.style.background = bg; c.style.color = fg; c.title = t;
    if (hasArt(t)) c.append(helmImg(t, "bye-helm"));
    c.append(el("span", null, abbr(t)));
    return c;
  }));
  fitSlateLine();
}

export { renderGames, renderByes, BADGE_STYLES, badgeStyle, setBadgeStyle };
