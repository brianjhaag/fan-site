// The wall (PLAN.md E step 3; the user's, Nov 3 2026: "a sports bar controlling a bunch of screens they can see from one place"), at the top of the Telecasts tab: this computer and every
// screen that joined its wall, with their monitors and the telecast windows on them, where they really sit, and the day's games to put on any of them. This page's connector keeps it;
// the other computers are its screens (wall.rs in the connector). Tap a window for its sound, which mutes every other telecast on the wall; x closes it; Snap back puts a computer's
// windows back in their spots; each computer's monitor and layout pick its spots.
import { Fan } from "./hosts.js?v=mw1d2yjh";
import { nflWeek, nbaDay, el, ALL_GAMES, leagueOf, leaguesOn, nick, telecastFor, TELECAST_LAYOUTS, timeZoned, shortDayFmt } from "./base.js?v=mw1d2yjh";
import { slateOfDay } from "./leagues.js?v=mw1d2yjh";
import { abbr } from "./leagues.js?v=mw1d2yjh";

const WALL_MS = 3000;   // how often the open Telecasts tab reads the wall
let wallTimer = null, wallData = null, wallNote = "", wallBox = null, wallShown = "";

const wallAct = (body, say) => Fan.wall.act(body).then(r => { wallNote = r.ok ? (say || "") : "Couldn't: " + r.error; readWall(); }, e => { wallNote = "Couldn't: " + e.message; drawWall(); });
function readWall() { if (!Fan.wall) return; Fan.wall.get().then(d => { wallData = d; drawWall(); }, () => {}); }

// One computer: its name and state, its monitors drawn to scale with its windows on them, its monitor and layout, and Snap back.
function machineBox(m, sound) {
  const box = el("div", "wl-machine" + (m.online ? "" : " off")), head = el("div", "wl-head");
  head.append(el("b", null, m.name || "Screen"), el("span", "wl-state " + (m.online ? "on" : "off"), m.id === "self" ? "this computer" : m.online ? "on" : "asleep"));
  const snap = el("button", "fan-start", "Snap back"); snap.type = "button"; snap.disabled = !m.online;
  snap.addEventListener("click", () => wallAct({ op: "snap", machine: m.id }, `${m.name}: snapped back`));
  head.append(snap);
  if (m.id !== "self" && !m.online) { const rm = el("button", "fan-start", "Remove"); rm.type = "button"; rm.title = "Take this computer off the wall; it can join again"; rm.addEventListener("click", () => wallAct({ op: "remove", machine: m.id }, `${m.name} removed`)); head.append(rm); }   // an asleep screen, which may be gone for good
  box.append(head);
  const ds = Array.isArray(m.displays) ? m.displays : [], ws = Array.isArray(m.windows) ? m.windows : [];
  if (!ds.length) { box.append(el("p", "fan-note", m.online ? "No monitors reported." : "Asleep or off: its screens come back when it does.")); return box; }
  const minX = Math.min(...ds.map(d => d.bounds.x)), minY = Math.min(...ds.map(d => d.bounds.y)), w = Math.max(...ds.map(d => d.bounds.x + d.bounds.width)) - minX, h = Math.max(...ds.map(d => d.bounds.y + d.bounds.height)) - minY, k = Math.min(360 / w, 300 / h);
  const nameOf = (d, i) => (ds.length > 1 ? (i + 1) + " " : "") + (d.label || "Monitor");   // numbered on the map and in the menu alike, when there are several
  const map = el("div", "wl-map"); map.style.width = Math.round(w * k) + "px"; map.style.height = Math.round(h * k) + "px";
  ds.forEach((d, i) => { const s = el("div", "wl-display"); s.style.cssText = `left:${Math.round((d.bounds.x - minX) * k)}px;top:${Math.round((d.bounds.y - minY) * k)}px;width:${Math.round(d.bounds.width * k)}px;height:${Math.round(d.bounds.height * k)}px`; s.append(el("small", null, nameOf(d, i))); map.append(s); });
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
  // where its telecasts open, one menu of every monitor and layout (the user's, Nov 3 2026), kept by the hub for this computer. A monitor is matched as the connector does (spot_for):
  // by name and size, then by position, so two of the same make are told apart.
  const p = m.pref || {}, pick = el("select", "fan-pick wl-pick");
  pick.setAttribute("aria-label", `Where ${m.name || "this computer"}'s telecasts open`);
  const def = el("option", null, "Fan's choice: the portrait monitor, 3 stacked"); def.value = ""; pick.append(def);
  ds.forEach((d, i) => {
    const g = el("optgroup"); g.label = `${nameOf(d, i)} ${d.bounds.width}x${d.bounds.height}`;
    TELECAST_LAYOUTS.forEach(([name], j) => { const o = el("option", null, `${g.label}, ${name}`); o.value = i + ":" + j; g.append(o); });
    pick.append(g);
  });
  const same = ds.map((d, i) => i).filter(i => ds[i].label === p.label && ds[i].bounds.width === p.width && ds[i].bounds.height === p.height);
  const cur = same.find(i => ds[i].bounds.x === p.x && ds[i].bounds.y === p.y) ?? same[0] ?? -1, lay = TELECAST_LAYOUTS.findIndex(([, r, c]) => r === p.rows && c === p.cols);
  pick.value = cur >= 0 && lay >= 0 ? cur + ":" + lay : "";
  pick.addEventListener("change", () => {
    const [i, j] = pick.value.split(":").map(Number), d = ds[i], l = TELECAST_LAYOUTS[j];
    wallAct({ op: "pref", machine: m.id, pref: pick.value === "" || !d || !l ? null : { label: d.label, width: d.bounds.width, height: d.bounds.height, x: d.bounds.x, y: d.bounds.y, rows: l[1], cols: l[2] } });
  });
  box.append(pick);
  return box;
}

// The games to queue, every league that's on and not over (the user's, Nov 3 2026): today's and tomorrow's in a daily league, the current week's in the NFL. Each can go on any computer that's on.
function gameRows(machines) {
  const wanted = g => { const l = g.league || "nfl"; if (!leaguesOn.has(l)) return false; return leagueOf(g).daily ? g.week === slateOfDay(l, nbaDay(0)) || g.week === slateOfDay(l, nbaDay(1)) : g.week === nflWeek(); };
  const games = ALL_GAMES.filter(g => !g.final && wanted(g)).sort((p, q) => Date.parse(p.t) - Date.parse(q.t));
  const list = el("div", "wl-games");
  list.append(el("h3", null, "Games"));
  if (!games.length) list.append(el("p", "fan-note", "No games left today, tomorrow or this NFL week, in the leagues that are on."));
  games.forEach(g => {
    const row = el("div", "wl-game"), tv = telecastFor(g), on = machines.filter(m => m.online);
    row.append(el("span", "wl-gname", `${leagueOf(g).code} ${abbr(nick(g, "away"))} @ ${abbr(nick(g, "home"))}`), el("small", null, `${shortDayFmt.format(new Date(g.t))} ${timeZoned(new Date(g.t))} · ${g.tv || "no network"}`));
    const btns = el("span", "wl-go");
    if (!tv || tv.how !== "link") btns.append(el("small", "fan-note", tv ? "an HDHomeRun channel: from its card" : "no link for its network"));
    else {
      if (Fan.door && Fan.door.here) { const b = el("button", "fan-start", "Here"); b.type = "button"; b.title = "Watch on this device"; b.addEventListener("click", () => window.open(tv.url, "_blank", "noopener")); btns.append(b); }   // a remote can watch on itself too, as a plain link
      on.forEach(m => { const b = el("button", "fan-start", m.name); b.type = "button"; b.title = `Watch on ${m.name}`; b.addEventListener("click", () => wallAct({ op: "open", machine: m.id, url: tv.url }, `Opening on ${m.name}`)); btns.append(b); });
    }
    row.append(btns);
    list.append(row);
  });
  return list;
}

// Redrawn only when something changed, and not while a menu in it is open, so a pick isn't snatched away.
function drawWall() {
  const box = wallBox;
  if (!box || !box.isConnected) return;
  if (!wallData) { box.replaceChildren(el("h3", null, "Wall"), el("p", "fan-note", "Reading the wall…")); return; }
  const now = JSON.stringify([wallData, wallNote, leaguesOn.size]);
  if (now === wallShown && box.childNodes.length > 1) return;
  if (box.contains(document.activeElement) && document.activeElement.tagName === "SELECT") return;
  wallShown = now;
  const ms = wallData.machines || [], head = el("div", "wl-top");
  head.append(el("h3", null, "Wall"), el("small", "wl-note", wallNote));
  const off = el("button", "fan-start", "Sound off"); off.type = "button"; off.disabled = !wallData.sound;
  off.addEventListener("click", () => wallAct({ op: "sound", machine: "self", target: null }, "Sound off"));
  head.append(off);
  // computers that found this wall and asked to join, waiting for the user
  const asking = ms.filter(m => m.approved === false), shown = ms.filter(m => m.approved !== false), ask = el("div", "wl-asking");
  if (asking.length) {
    asking.forEach(m => {
      const r = el("div", "wl-askrow"), yes = el("button", "fan-start", "Allow"), no = el("button", "fan-start", "Refuse"); yes.type = no.type = "button";
      yes.addEventListener("click", () => wallAct({ op: "allow", machine: m.id }, `${m.name} joined`));
      no.addEventListener("click", () => wallAct({ op: "remove", machine: m.id }, `${m.name} refused`));
      r.append(el("b", null, m.name || "A computer"), el("span", null, " asks to join this wall as a screen"), yes, no);
      ask.append(r);
    });
  }
  const wall = el("div", "wl-wall");
  if (!shown.length) wall.append(el("p", "fan-note", "No screens yet. This computer shows here once it can open telecasts; other computers join below, with this computer's screens switch on."));
  shown.forEach(m => wall.append(machineBox(m, wallData.sound)));
  const body = el("div", "wl-body");
  body.append(wall, gameRows(shown));
  box.replaceChildren(head, ...(asking.length ? [ask] : []), body);
}

// The panel for the Telecasts tab, read every few seconds while it's on screen.
function wallPanel() {
  wallBox = el("div", "wl-panel"); wallShown = "";
  drawWall(); readWall();
  clearInterval(wallTimer);
  wallTimer = setInterval(() => { if (!wallBox || !wallBox.isConnected) { clearInterval(wallTimer); return; } if (!document.hidden && wallBox.offsetParent) readWall(); }, WALL_MS);
  return wallBox;
}
export { wallPanel };
