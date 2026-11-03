// The Screens view (the house's wall, PLAN.md E step 3; the user's, Nov 3 2026), opened by the Screens button as Code is: every computer of the house with its monitors and the telecast
// windows on them, where they really sit, and the day's games to put on any of them. The hub (this page's connector) keeps it; the other computers are its screens (house.rs in the connector).
// Tap a window for its sound, which mutes every other stream in the house; x closes it; Snap back puts a computer's windows back in their spots; each computer's monitor and layout pick its spots.
import { Fan } from "./hosts.js?v=mw13rp77";
import { $, el, ALL_GAMES, leagueOf, leaguesOn, nick, telecastFor, TELECAST_LAYOUTS, timeZoned, shortDayFmt, view } from "./base.js?v=mw13rp77";
import { abbr } from "./leagues.js?v=mw13rp77";

const WALL_MS = 3000;   // how often the open Screens view reads the wall
let wallTimer = null, wallData = null, wallNote = "";

const wallAct = (body, say) => Fan.wall.act(body).then(r => { wallNote = r.ok ? (say || "") : "Couldn't: " + r.error; readWall(); }, e => { wallNote = "Couldn't: " + e.message; drawWall(); });
function readWall() { if (!Fan.wall) return; Fan.wall.get().then(d => { wallData = d; drawWall(); }, () => {}); }

// One computer: its name and state, its monitors drawn to scale with its windows on them, its monitor and layout, and Snap back.
function machineBox(m, sound) {
  const box = el("div", "wl-machine" + (m.online ? "" : " off")), head = el("div", "wl-head");
  head.append(el("b", null, m.name || "Screen"), el("span", "wl-state " + (m.online ? "on" : "off"), m.id === "self" ? "this computer" : m.online ? "on" : "asleep"));
  const snap = el("button", "fan-start", "Snap back"); snap.type = "button"; snap.disabled = !m.online;
  snap.addEventListener("click", () => wallAct({ op: "snap", machine: m.id }, `${m.name}: snapped back`));
  head.append(snap);
  box.append(head);
  const ds = Array.isArray(m.displays) ? m.displays : [], ws = Array.isArray(m.windows) ? m.windows : [];
  if (!ds.length) { box.append(el("p", "fan-note", m.online ? "No monitors reported." : "Asleep or off: its screens come back when it does.")); return box; }
  const minX = Math.min(...ds.map(d => d.bounds.x)), minY = Math.min(...ds.map(d => d.bounds.y)), w = Math.max(...ds.map(d => d.bounds.x + d.bounds.width)) - minX, h = Math.max(...ds.map(d => d.bounds.y + d.bounds.height)) - minY, k = Math.min(360 / w, 300 / h);
  const map = el("div", "wl-map"); map.style.width = Math.round(w * k) + "px"; map.style.height = Math.round(h * k) + "px";
  ds.forEach(d => { const s = el("div", "wl-display"); s.style.cssText = `left:${Math.round((d.bounds.x - minX) * k)}px;top:${Math.round((d.bounds.y - minY) * k)}px;width:${Math.round(d.bounds.width * k)}px;height:${Math.round(d.bounds.height * k)}px`; s.append(el("small", null, d.label || "Monitor")); map.append(s); });
  ws.forEach(win => {
    const b = win.bounds || {}, loud = sound && sound.machine === m.id && sound.target === win.target, t = el("div", "wl-win" + (loud ? " loud" : ""));
    t.style.cssText = `left:${Math.round(((b.left || 0) - minX) * k)}px;top:${Math.round(((b.top || 0) - minY) * k)}px;width:${Math.max(24, Math.round((b.width || 0) * k))}px;height:${Math.max(18, Math.round((b.height || 0) * k))}px`;
    t.title = (loud ? "Has the sound. Tap to mute. " : "Tap for its sound. ") + (win.title || win.url || "");
    t.append(el("span", "wl-title", (loud ? "🔊 " : "") + (win.title || win.url || "Telecast")));
    const x = el("button", "wl-x", "×"); x.type = "button"; x.title = "Close"; x.setAttribute("aria-label", "Close this telecast");
    x.addEventListener("click", e => { e.stopPropagation(); wallAct({ op: "close", machine: m.id, target: win.target }); });
    t.append(x);
    t.addEventListener("click", () => wallAct({ op: "sound", machine: m.id, target: loud ? null : win.target }, loud ? "Sound off" : `Sound: ${m.name}`));
    map.append(t);
  });
  box.append(map);
  // where its telecasts open: a monitor and a layout, kept by the hub for this computer
  const p = m.pref || {}, pick = el("div", "wl-pick"), mon = el("select", "fan-pick");
  [["", "Portrait monitor, or Fan's choice"], ...ds.map((d, i) => [String(i), `${d.label || "Monitor"} ${d.bounds.width}x${d.bounds.height}`])].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; mon.append(o); });
  const cur = ds.findIndex(d => d.label === p.label && d.bounds.width === p.width && d.bounds.height === p.height);
  mon.value = cur >= 0 ? String(cur) : "";
  const prefOf = (i, rows, cols) => { const d = ds[i]; return d ? { label: d.label, width: d.bounds.width, height: d.bounds.height, x: d.bounds.x, y: d.bounds.y, rows, cols } : null; };
  mon.addEventListener("change", () => wallAct({ op: "pref", machine: m.id, pref: mon.value === "" ? null : prefOf(Number(mon.value), p.rows || 3, p.cols || 1) }));
  pick.append(mon);
  TELECAST_LAYOUTS.forEach(([name, r, c]) => {
    const b = el("button", "wl-lay", name); b.type = "button"; b.disabled = cur < 0; b.setAttribute("aria-pressed", String(cur >= 0 && p.rows === r && p.cols === c));
    b.addEventListener("click", () => wallAct({ op: "pref", machine: m.id, pref: prefOf(cur, r, c) }));
    pick.append(b);
  });
  box.append(pick);
  return box;
}

// The day's games, every league that's on: not over, and starting within the next 36 hours or under way. Each can go on any computer that's on.
function gameRows(machines) {
  const now = Date.now(), games = ALL_GAMES.filter(g => leaguesOn.has(g.league || "nfl") && !g.final && Date.parse(g.t) < now + 36 * 3600e3 && Date.parse(g.t) > now - 4 * 3600e3).sort((p, q) => Date.parse(p.t) - Date.parse(q.t));
  const list = el("div", "wl-games");
  list.append(el("h3", null, "Games"));
  if (!games.length) list.append(el("p", "fan-note", "No games in the next 36 hours."));
  games.forEach(g => {
    const row = el("div", "wl-game"), tv = telecastFor(g), on = machines.filter(m => m.online);
    row.append(el("span", "wl-gname", `${leagueOf(g).code} ${abbr(nick(g, "away"))} @ ${abbr(nick(g, "home"))}`), el("small", null, `${shortDayFmt.format(new Date(g.t))} ${timeZoned(new Date(g.t))} · ${g.tv || "no network"}`));
    const btns = el("span", "wl-go");
    if (!tv || tv.how !== "link") btns.append(el("small", "fan-note", tv ? "an HDHomeRun channel: from its card" : "no link for its network"));
    else on.forEach(m => { const b = el("button", "fan-start", m.name); b.type = "button"; b.title = `Watch on ${m.name}`; b.addEventListener("click", () => wallAct({ op: "open", machine: m.id, url: tv.url }, `Opening on ${m.name}`)); btns.append(b); });
    row.append(btns);
    list.append(row);
  });
  return list;
}

function drawWall() {
  const box = $("screens");
  if (!box || view !== "screens") return;
  if (!Fan.wall) { box.replaceChildren(el("h2", null, "Screens"), el("p", "fan-note", "The wall needs the Fan connector: it holds every computer's screens.")); return; }
  if (!wallData) { box.replaceChildren(el("h2", null, "Screens"), el("p", "fan-note", "Reading the wall…")); return; }
  const ms = wallData.machines || [], head = el("div", "wl-top");
  head.append(el("h2", null, "Screens"), el("small", "wl-note", wallNote));
  const off = el("button", "fan-start", "Sound off"); off.type = "button"; off.disabled = !wallData.sound;
  off.addEventListener("click", () => wallAct({ op: "sound", machine: "self", target: null }, "Sound off"));
  head.append(off);
  const wall = el("div", "wl-wall");
  if (!ms.length) wall.append(el("p", "fan-note", "No screens yet. This computer shows here once it can open telecasts; other computers join from their own Telecasts tab."));
  ms.forEach(m => wall.append(machineBox(m, wallData.sound)));
  const body = el("div", "wl-body");
  body.append(wall, gameRows(ms));
  box.replaceChildren(head, body);
}

// Drawn when Screens opens, then read every few seconds while it's open.
function renderWall() {
  drawWall(); readWall();
  clearInterval(wallTimer);
  wallTimer = setInterval(() => { if (view !== "screens" || document.hidden) { if (view !== "screens") clearInterval(wallTimer); return; } readWall(); }, WALL_MS);
}
export { renderWall };
