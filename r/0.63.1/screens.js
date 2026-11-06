

import { pullDivisions, pullLeaders, pullStatus } from "./espn.js?v=mw55ioao";
import { NEWS_SOURCES, pullNews } from "./news.js?v=mw55ioao";
import { Fan } from "./hosts.js?v=mw55ioao";
import { LEAGUE_DEFS, TEAM } from "./leagues.js?v=mw55ioao";
import { LEAGUES, closeLeagues, $, el, helmImg, later, league, leagueNames, view } from "./base.js?v=mw55ioao";
  Object.assign(later, { followLeague, setConnectorNews });
  
  function followLeague() { if (newsOpen()) drawNews(); if (leaderboardOpen()) drawLeaderboard(); }
  
  
  
  
  
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
export { sourcesOff, setSourceOff, sourceWhyNot };
