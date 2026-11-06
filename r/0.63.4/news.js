

import { pullEspnNews } from "./espn.js?v=mw5e7wzl";
import { LEAGUE_DEFS, TEAM } from "./leagues.js?v=mw5e7wzl";



const NEWS_SOURCES = [
  { key: "espn", name: "ESPN" },
  { key: "cbs", name: "CBS Sports", url: l => `https://www.cbssports.com/rss/headlines/${l}/`, link: /^https:\/\/www\.cbssports\.com\//i },
  { key: "yahoo", name: "Yahoo Sports", connector: true, link: /^https:\/\/sports\.yahoo\.com\//i },
  { key: "nbc", name: "NBC Sports", connector: true, link: /^https:\/\/www\.nbcsports\.com\//i },
  { key: "guardian", name: "The Guardian", connector: true, link: /^https:\/\/www\.theguardian\.com\//i },
];
const stoppedFeeds = new Set();   


async function pullFeedNews(s, l) {
  let body;
  if (s.connector) {
    const r = await fetch(`/connector/news?source=${s.key}&league=${l}`, { signal: AbortSignal.timeout(30000) }), answer = r.ok ? await r.json().catch(() => null) : null;
    if (!answer || !answer.ok) throw new Error(s.name + ": " + ((answer && answer.error) || "the connector has no news feeds"));
    body = answer.text;
  } else {
    if (stoppedFeeds.has(s.key)) throw new Error(s.name + " pulls stopped");
    const r = await fetch(s.url(l), { credentials: "omit", signal: AbortSignal.timeout(30000) });
    if (r.status === 429 || r.status >= 500) stoppedFeeds.add(s.key);
    if (!r.ok) throw new Error(s.name + " answered " + r.status);
    body = await r.text();
  }
  const doc = new DOMParser().parseFromString(body, "text/xml"), text = (item, tag) => { const n = item.getElementsByTagName(tag)[0]; return n ? n.textContent.trim() : ""; };
  const names = Object.values(TEAM).filter(t => t.lg === l).map(t => [t.code, new RegExp("\\b" + t.name.split(" ").pop() + "\\b")]);
  const imageOf = item => {
    const tag = item.getElementsByTagName("enclosure")[0] || item.getElementsByTagName("media:content")[0] || item.getElementsByTagName("media:thumbnail")[0];
    const found = (tag && tag.getAttribute("url")) || ((text(item, "content:encoded") + text(item, "description")).match(/src="(https:\/\/[^"]+?\.(?:jpe?g|png|webp)[^"]*)"/i) || [])[1] || "";
    return /^https:\/\//i.test(found) ? found : "";
  };
  return [...doc.getElementsByTagName("item")].map(item => {
    const title = text(item, "title"), link = text(item, "link"), words = title + " " + text(item, "description");
    return { title, kind: "", source: s.name, ms: Date.parse(text(item, "pubDate")), link: s.link.test(link) ? link : "", image: imageOf(item), codes: names.filter(([, word]) => word.test(words)).map(([c]) => c) };
  }).filter(n => n.title);
}

async function pullNews(l, teams, sources = ["espn"]) {
  const def = LEAGUE_DEFS[l], fanCode = c => (def.espnCodes || {})[c] || c, on = teams && new Set(teams.map(fanCode)), problems = [];
  const lists = await Promise.all(sources.map(key => NEWS_SOURCES.find(s => s.key === key)).filter(Boolean).map(s => (s.key !== "espn" ? pullFeedNews(s, l).then(list => (on ? list.filter(n => !n.codes.length || n.codes.some(c => on.has(c))) : list)) : pullEspnNews(l, teams))
    .catch(e => { problems.push(e.message); return null; })));
  if (lists.every(x => !x)) throw new Error(problems.join("; ") || "no sources");
  const seen = new Set();
  return lists.flatMap(x => x || []).filter(n => { const k = (n.link || n.title).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).sort((p, q) => (q.ms || 0) - (p.ms || 0));
}
export { NEWS_SOURCES, pullNews };
