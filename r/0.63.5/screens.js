

import { lastSeason, pullDivisions, pullHistory, pullLeaders, pullStatus, seasonHistory } from "./espn.js?v=mw5nr7x2";
import { NEWS_SOURCES, pullNews } from "./news.js?v=mw5nr7x2";
import { Fan } from "./hosts.js?v=mw5nr7x2";
import { Calc } from "./calc.js?v=mw5nr7x2";
import { SHARED } from "./shared.js?v=mw5nr7x2";
import { LEAGUE_DEFS, TEAM } from "./leagues.js?v=mw5nr7x2";
import { LEAGUES, closeLeagues, $, el, helmImg, later, league, leagueNames, leaguesOn, view } from "./base.js?v=mw5nr7x2";
  Object.assign(later, { followLeague, setConnectorNews });
  
  function followLeague() { if (newsOpen()) drawNews(); if (leaderboardOpen()) drawLeaderboard(); if (pricingOpen()) drawPricing(); }
  
  
  
  
  
  const newsOpen = () => !$("newsPage").hidden;
  function closeNews() { $("newsPage").hidden = true; $("newsPage").replaceChildren(); $("newsBtn").setAttribute("aria-expanded", "false"); }
  const sinceText = ms => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 60 ? m + "m ago" : m < 1440 ? Math.round(m / 60) + "h ago" : Math.round(m / 1440) + "d ago"; };
  let newsOff = {};
  try { newsOff = JSON.parse(localStorage.getItem("fan.news.off")) || {}; } catch (e) {}
  const keepNewsOff = () => { try { localStorage.setItem("fan.news.off", JSON.stringify(newsOff)); } catch (e) {} };
  
  let sourcesOff = new Set();
  try { sourcesOff = new Set(JSON.parse(localStorage.getItem("fan.news.sources.off")) || []); } catch (e) {}
  const keepSourcesOff = () => { try { localStorage.setItem("fan.news.sources.off", JSON.stringify([...sourcesOff])); } catch (e) {} };
  const setSourceOff = (key, off) => { if (off) sourcesOff.add(key); else sourcesOff.delete(key); keepSourcesOff(); };
  
  let connectorNews = null;   
  function setConnectorNews(list) { connectorNews = Array.isArray(list) ? list : null; }
  const sourceWhyNot = (s, l) => !s.connector ? "" : !Fan.hostHello ? "Needs the Fan connector" : !connectorNews || !connectorNews.some(x => x.source === s.key) ? "Needs a newer connector program" : l && !connectorNews.some(x => x.source === s.key && x.leagues.includes(l)) ? "No feed for this league" : "";
  
  function fitScreen(screen) {
    const top = document.querySelector(".strip:not(.bottom)").getBoundingClientRect(), bottom = document.querySelector(".strip.bottom").getBoundingClientRect(), page = screen.style;
    page.top = top.bottom + 8 + "px"; page.left = top.left + "px"; page.width = top.width + "px"; page.height = Math.max(200, bottom.top - top.bottom - 16) + "px";
  }
  
  const espnCodeOf = l => { const back = Object.fromEntries(Object.entries(LEAGUE_DEFS[l].espnCodes || {}).map(([e, o]) => [o, e])); return c => back[c] || c; };
  async function drawNews() {
    const l = LEAGUES.includes(view) ? view : league, page = $("newsPage"), board = el("div", "news-board");
    const teams = Object.fromEntries(Object.entries(TEAM).filter(([, t]) => t.lg === l).map(([nk, t]) => [t.code, { nk, t }]));
    const off = new Set((newsOff[l] || []).filter(c => teams[c]));
    const closeBtn = el("button", "gd-close", "\u00d7"); closeBtn.type = "button"; closeBtn.title = "Close"; closeBtn.setAttribute("aria-label", "Close news"); closeBtn.addEventListener("click", closeNews);
    
    const sourceRow = el("div", "news-sources");
    sourceRow.append(...NEWS_SOURCES.map(s => {
      const label = el("label", "news-source"), box = el("input");
      const why = sourceWhyNot(s, l);
      box.type = "checkbox"; box.checked = !sourcesOff.has(s.key) && !why; box.disabled = !!why; if (why) label.title = why;
      box.addEventListener("change", () => { setSourceOff(s.key, !box.checked); drawNewsList(); });
      label.append(box, el("span", null, s.name));
      return label;
    }));
    page.replaceChildren(el("h2", "overlay-head", leagueNames()[l] + " news"), sourceRow, board, closeBtn);
    page.dataset.lg = l;
    board.append(el("p", "overlay-note", "Getting the divisions"));
    let groups;
    try { groups = await pullDivisions(l); } catch (e) { groups = [{ name: leagueNames()[l], codes: Object.keys(teams).sort() }]; }   
    if (!newsOpen() || page.dataset.lg !== l) return;
    groups = groups.map(g => ({ name: g.name, codes: g.codes.filter(c => teams[c]) })).filter(g => g.codes.length);
    const columns = [{ name: "League", codes: [] }, ...groups], boxes = [];
    board.replaceChildren();
    board.style.gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
    const saveOff = () => { newsOff[l] = [...off]; if (!newsOff[l].length) delete newsOff[l]; keepNewsOff(); drawNewsList(); };
    const lists = columns.map((column, i) => {
      const head = el("h3", "overlay-group", column.name), badges = el("div", "news-teams"), list = el("ol", "news-list");
      [head, badges, list].forEach((n, row) => { n.style.gridColumn = i + 1; n.style.gridRow = row + 1; });
      if (!i) {
        const allBtn = el("button", "news-all", "All"), noneBtn = el("button", "news-all", "None");
        allBtn.type = noneBtn.type = "button";
        allBtn.addEventListener("click", () => { off.clear(); boxes.forEach(b => { b.checked = true; }); saveOff(); });
        noneBtn.addEventListener("click", () => { Object.keys(teams).forEach(c => off.add(c)); boxes.forEach(b => { b.checked = false; }); saveOff(); });
        badges.append(allBtn, noneBtn);
      }
      badges.append(...column.codes.map(c => {
        const { nk, t } = teams[c], badge = el("label", "news-team"), box = el("input");
        box.type = "checkbox"; box.checked = !off.has(c); boxes.push(box);
        badge.style.background = t.bg; badge.style.color = t.fg; badge.title = t.name;
        box.addEventListener("change", () => { if (box.checked) off.delete(c); else off.add(c); saveOff(); });
        badge.append(box);
        if (t.art) badge.append(helmImg(nk, "news-team-art"));
        badge.append(el("span", "news-team-code", c));
        return badge;
      }));
      board.append(head, badges, list);
      return list;
    });
    
    const columnOf = n => { const mine = n.codes.filter(c => !off.has(c)); if (!mine.length || n.codes.length > 4) return 0; const i = groups.findIndex(g => g.codes.includes(mine[0])); return i + 1; };
    
    let asked = 0, wait = null;
    function drawNewsList() { clearTimeout(wait); wait = setTimeout(pull, 400); }
    const note = text => { lists.forEach(list => list.replaceChildren()); lists[0].append(el("li", "overlay-note", text)); };
    async function pull() {
      const mine = ++asked, codeOf = espnCodeOf(l), checked = Object.keys(teams).filter(c => !off.has(c));
      const sources = NEWS_SOURCES.filter(s => !sourcesOff.has(s.key) && !sourceWhyNot(s, l)).map(s => s.key);
      note(!sources.length ? "No sources checked" : checked.length ? "Getting the news" : "No teams checked");
      if (!checked.length || !sources.length) return;
      let news;
      try { news = await pullNews(l, off.size ? checked.map(codeOf) : null, sources); } catch (e) { if (mine === asked) note("No news: " + (pullStatus() || e.message)); return; }
      if (mine !== asked || !newsOpen() || page.dataset.lg !== l) return;
      lists.forEach(list => list.replaceChildren());
      if (!news.length) { note("No news"); return; }
      news.forEach(n => {
        const li = el("li", "news-item"), card = el(n.link ? "a" : "div", "news-card");
        if (n.link) { card.href = n.link; card.target = "_blank"; card.rel = "noopener"; }
        const frame = el("div", "news-image");
        if (n.image) { const img = el("img"); img.src = n.image; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; frame.append(img); }
        card.append(frame, el("span", "news-title", n.title), el("span", "news-line", [n.source, n.kind, isFinite(n.ms) ? sinceText(n.ms) : ""].filter(Boolean).join(" \u00b7 ")));
        li.append(card);
        lists[columnOf(n)].append(li);
      });
      lists.forEach(list => { const room = list.getBoundingClientRect().bottom; [...list.children].forEach(li => { if (li.getBoundingClientRect().bottom > room + 1) li.remove(); }); });
    }
    pull();
  }
  $("newsBtn").addEventListener("click", () => { if (newsOpen()) { closeNews(); return; } closeLeagues(); closeLeaderboard(); $("newsPage").hidden = false; $("newsBtn").setAttribute("aria-expanded", "true"); fitScreen($("newsPage")); drawNews(); });
  window.addEventListener("resize", () => { if (newsOpen()) { fitScreen($("newsPage")); drawNews(); } if (leaderboardOpen()) { fitScreen($("leaderboardPage")); drawLeaderboard(); } });
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if (newsOpen()) { closeNews(); $("newsBtn").focus(); } if (leaderboardOpen()) { closeLeaderboard(); $("leaderboardBtn").focus(); } });
  
  
  const leaderboardOpen = () => !$("leaderboardPage").hidden;
  function closeLeaderboard() { $("leaderboardPage").hidden = true; $("leaderboardPage").replaceChildren(); $("leaderboardBtn").setAttribute("aria-expanded", "false"); }
  async function drawLeaderboard() {
    const l = LEAGUES.includes(view) ? view : league, page = $("leaderboardPage"), board = el("div", "leader-board");
    const teams = Object.fromEntries(Object.values(TEAM).filter(t => t.lg === l).map(t => [t.code, t]));
    const closeBtn = el("button", "gd-close", "\u00d7"); closeBtn.type = "button"; closeBtn.title = "Close"; closeBtn.setAttribute("aria-label", "Close leaderboard"); closeBtn.addEventListener("click", closeLeaderboard);
    page.replaceChildren(el("h2", "overlay-head", leagueNames()[l] + " leaderboard"), board, closeBtn);
    page.dataset.lg = l;
    board.append(el("p", "overlay-note", "Getting the leaders"));
    let groups;
    try { groups = await pullLeaders(l); } catch (e) { if (page.dataset.lg === l) board.replaceChildren(el("p", "overlay-note", "No leaders: " + (pullStatus() || e.message))); return; }
    if (!leaderboardOpen() || page.dataset.lg !== l) return;
    if (!groups.length) { board.replaceChildren(el("p", "overlay-note", "No leaders yet")); return; }
    board.replaceChildren(...groups.map(g => {
      const block = el("section", "leader-group"), list = el("ol", "leader-list");
      list.append(...g.leaders.map((x, i) => {
        const li = el("li"), row = el(x.link ? "a" : "div", "leader-row"), face = el("span", "leader-face"), badge = el("span", "leader-team", x.code), t = teams[x.code];
        if (x.link) { row.href = x.link; row.target = "_blank"; row.rel = "noopener"; }
        if (x.image) { const img = el("img"); img.src = x.image; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; face.append(img); }
        if (t) { badge.style.background = t.bg; badge.style.color = t.fg; badge.title = t.name; }
        row.append(el("span", "leader-rank", String(i + 1)), face, el("span", "leader-name", x.name), badge, el("span", "leader-value", x.value));
        li.append(row);
        return li;
      }));
      block.append(el("h3", "overlay-group", g.name), list);
      return block;
    }));
    const room = board.getBoundingClientRect().bottom;
    [...board.children].forEach(b => { if (b.getBoundingClientRect().bottom > room + 1) b.remove(); });
  }
  $("leaderboardBtn").addEventListener("click", () => { if (leaderboardOpen()) { closeLeaderboard(); return; } closeLeagues(); closeNews(); $("leaderboardPage").hidden = false; $("leaderboardBtn").setAttribute("aria-expanded", "true"); fitScreen($("leaderboardPage")); drawLeaderboard(); });
  
  
  
  const PRICING_FAVS = [150, 200, 250, 300, 350, 400, 500];
  let pricing = { pinned: false, open: false };   
  try { pricing = { ...pricing, ...JSON.parse(localStorage.getItem("fan.pricing")) }; } catch (e) {}
  const keepPricing = () => { try { localStorage.setItem("fan.pricing", JSON.stringify(pricing)); } catch (e) {} };
  const pricingOpen = () => !$("pricingPanel").hidden;
  const pricingPct = (x, places) => { const t = (x * 100).toFixed(places); return (Number(t) === 0 ? (0).toFixed(places) : t).replace("-", "\u2212") + "%"; };
  const pinIcon = () => { const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg"), p = document.createElementNS(ns, "path"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); p.setAttribute("d", "M15 2l7 7-2 1-1.5-1.5-4 4 .5 5L13.5 19l-4-4L4 20.5 3.5 20 9 14.5l-4-4L6.5 9l5 .5 4-4L14 4z"); s.append(p); return s; };
  const pricingTable = (heads, rows) => {
    const t = el("table", "pricing-table"), thead = el("thead"), head = el("tr"), body = el("tbody");
    head.append(...heads.map(h => el("th", null, h))); thead.append(head);
    body.append(...rows.map(([name, cells]) => { const r = el("tr"); r.append(el("th", null, name), ...cells.map(([text, cls]) => el("td", cls, text))); return r; }));
    t.append(thead, body);
    return t;
  };
  
  
  
  const keysOf = async l => {
    if (!Fan.store) return null;
    if (l === "nfl") { const d = await Fan.store.get("playbook", "games"), rows = (d && d.rows) || []; if (!rows.length) return null; const years = rows.map(r => r[0]); return { finals: rows.map(r => [r[6], r[7]]), range: `${Math.min(...years)}\u2013${Math.max(...years)} seasons` }; }
    const s = SHARED.leagues[l], at = s && s.tag && new RegExp("^" + s.tag + "\\d{8}-");
    if (!at) return null;
    const saved = (await Fan.store.list("slate")).filter(r => at.test(r.id) && r.data && Array.isArray(r.data.final)).map(r => r.data.final), past = seasonHistory(l);
    const seasonName = y => `${y - 1}\u2013${String(y).slice(2)}`;   
    const range = [past && (past.complete ? seasonName(past.season) : `${seasonName(past.season)} (${past.done.length} of ${past.teams ? past.teams.length : "?"} teams)`), saved.length && `${seasonName(lastSeason() + 1)} so far`].filter(Boolean).join(" and ");
    const finals = [...(past ? Object.values(past.games) : []), ...saved];
    return finals.length ? { finals, range } : null;
  };
  const shareTable = (head, rows) => {   
    const max = Math.max(...rows.filter(r => !r[2]).map(r => r[1]), 1e-9), t = el("table", "pricing-table pricing-keys"), thead = el("thead"), hr = el("tr"), body = el("tbody");
    hr.append(el("th", null, head), el("th", null, "Games"), el("th")); thead.append(hr);
    body.append(...rows.map(([label, s, open]) => { const r = el("tr"), barCell = el("td", "pricing-bar-cell"), bar = el("span", "pricing-bar"); bar.style.width = Math.min(100, Math.round(s / max * 100)) + "%"; if (open) bar.classList.add("open"); barCell.append(bar); r.append(el("th", null, label), el("td", null, pricingPct(s, 1)), barCell); return r; }));
    t.append(thead, body);
    return t;
  };
  const totalLabel = t => (t.first ? "\u2264" + (t.at + t.step - 1) : t.last ? t.at + "+" : t.step > 1 ? `${t.at}\u2013${t.at + t.step - 1}` : String(t.at));
  
  
  function drawPricingKeys() { const box = pricingOpen() && $("pricingPanel").querySelector(".pricing-side"); if (box) drawKeys(box, league); }
  function drawKeys(box, l) {
    const keys = Calc.RULES.leagues[l] && Calc.RULES.leagues[l].keys, title = el("h3", null, `${leagueNames()[l] || l.toUpperCase()} key numbers`);
    box.dataset.lg = l;
    if (!keys) { box.replaceChildren(title, el("p", null, "None for this league yet.")); return; }
    box.replaceChildren(title, el("p", null, "Reading the saved games"));
    keysOf(l).then(got => {
      if (!box.isConnected || box.dataset.lg !== l) return;
      if (!got) { box.replaceChildren(title, el("p", null, "No saved games here: they come from the Fan connector on this computer.")); return; }
      const k = Calc.keyShares(got.finals, keys), tables = el("div", "pricing-key-tables");
      tables.append(shareTable("Margin", k.margins.map(m => [m.last ? m.at + "+" : String(m.at), m.share, m.last])), shareTable("Total", k.totals.map(t => [totalLabel(t), t.share, t.first || t.last])));
      title.append(el("small", "pricing-range", got.range));   
      box.replaceChildren(title, tables);
      placePricing();
    }, e => { if (box.dataset.lg === l) box.replaceChildren(title, el("p", null, "Couldn't read the saved games: " + e.message)); });
  }
  function drawPricing() {
    const panel = $("pricingPanel"), head = el("div", "pricing-head"), pin = el("button", "pricing-pin"), close = el("button", "pricing-close", "\u00d7");
    pin.type = close.type = "button";
    pin.setAttribute("aria-pressed", String(pricing.pinned)); pin.title = pricing.pinned ? "Pinned: it stays up while you use the rest of the page. Press to unpin" : "Pin it: keep it up while you use the rest of the page";
    pin.append(pinIcon(), pricing.pinned ? "Pinned" : "Pin");
    pin.addEventListener("click", () => { pricing.pinned = !pricing.pinned; keepPricing(); drawPricing(); });
    close.title = "Close"; close.setAttribute("aria-label", "Close Pricing"); close.addEventListener("click", closePricing);
    head.append(el("h2", null, "Pricing"), pin, close);
    const cash = pricingTable(["Kalshi fav", "Locks from"], PRICING_FAVS.map(f => ["\u2212" + f, [["+" + Math.ceil(Calc.lockPrice(f)), null]]]));
    const bonus = pricingTable(["Kalshi fav", "Keeps half"], PRICING_FAVS.map(f => ["\u2212" + f, [["+" + Math.ceil(Calc.bonusPrice(f, 0.5)), null]]]));
    const body = el("div", "pricing-body"), keys = el("div", "pricing-side"), locks = el("div", "pricing-locks");   
    locks.append(
      el("h3", null, "Cash: a lock starts at"), cash,
      el("h3", null, "Bonus bet: keeps half at"), bonus);
    body.append(keys, locks);
    panel.replaceChildren(head, body);
    drawKeys(keys, league);
    placePricing();
  }
  
  
  function placePricing() {
    if (!pricingOpen()) return;
    const panel = $("pricingPanel"), strip = document.querySelector(".strip.bottom").getBoundingClientRect(), row = document.querySelector(".strip-row2").getBoundingClientRect(), top = document.querySelector(".strip:not(.bottom)").getBoundingClientRect();
    const col = document.querySelector(".col.left").getBoundingClientRect(), edge = col.width && col.left > innerWidth / 2 ? col.left - 8 : row.right;
    panel.style.right = Math.max(8, innerWidth - edge) + "px";
    panel.style.maxWidth = Math.max(320, edge - 8) + "px";   
    panel.style.bottom = Math.max(8, innerHeight - strip.top + 8) + "px";
    panel.style.maxHeight = Math.max(160, strip.top - top.bottom - 16) + "px";
  }
  function openPricing() { $("pricingPanel").hidden = false; $("pricingBtn").setAttribute("aria-selected", "true"); pricing.open = true; keepPricing(); drawPricing(); }
  function closePricing() { $("pricingPanel").hidden = true; $("pricingPanel").replaceChildren(); $("pricingBtn").setAttribute("aria-selected", "false"); pricing.open = false; keepPricing(); }
  $("pricingBtn").addEventListener("click", () => (pricingOpen() ? closePricing() : openPricing()));
  document.addEventListener("pointerdown", e => { if (pricingOpen() && !pricing.pinned && !$("pricingPanel").contains(e.target) && !$("pricingBtn").contains(e.target)) closePricing(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && pricingOpen() && !pricing.pinned) closePricing(); });
  window.addEventListener("resize", placePricing);
  const pricingWatch = new ResizeObserver(placePricing);   
  pricingWatch.observe(document.querySelector(".strip.bottom"));
  if (pricing.pinned && pricing.open) openPricing();   
  
  pullHistory(() => ["nba", "nhl"].filter(l => leaguesOn.has(l) && Calc.RULES.leagues[l] && Calc.RULES.leagues[l].keys), () => !document.documentElement.classList.contains("bet-off"), l => { const box = pricingOpen() && $("pricingPanel").querySelector(".pricing-side"); if (box && box.dataset.lg === l) drawKeys(box, l); });
export { drawPricingKeys, sourcesOff, setSourceOff, sourceWhyNot };
