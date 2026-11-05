// Telecasts and the wall, in one module (the refactor, Nov 3 2026): the networks and where each comes from, what a game's Live telecast does, the wall, and the rest of the
// settings window's Telecasts tab. base.js's cards call telecastFor and watchGame, and its league switch sendManifest, through later.
import { Fan } from "./hosts.js?v=mw2s9s1f";
import { qrSvg } from "./qr.js?v=mw2s9s1f";
import { slateOfDay, abbr } from "./leagues.js?v=mw2s9s1f";
import { nflWeek, nbaDay, el, ALL_GAMES, leagueOf, leaguesOn, nick, timeZoned, shortDayFmt, changed, later } from "./base.js?v=mw2s9s1f";
Object.assign(later, { telecastFor, watchGame, sendManifest });

// ---- The networks and their sources
// The networks the slates name, each with a link the user pastes in the settings window. Claude's default list. Kept per browser.
// Every network Claude knows of (the user's word, Nov 3 2026: "a link for every network you know of"): broadcast, national cable, streaming, then Colorado's own. allNetworks adds any other a game names, the regional ones mostly.
const NETWORKS = ["CBS", "Fox", "NBC", "ABC", "CW", "ION", "ESPN", "ESPN2", "ESPNU", "ESPNews", "ESPN+", "ESPN Deportes", "TNT", "truTV", "TBS", "USA Network", "FS1", "FS2", "NFL Network", "NBA TV", "NHL Network", "MLB Network", "CBS Sports Network", "SEC Network", "BTN", "ACC Network", "Golf Channel",
  "Peacock", "Prime Video", "Paramount+", "Netflix", "Apple TV", "HBO Max", "Disney+", "Hulu", "YouTube", "NFL+", "DAZN", "Altitude Sports"];   // the NBA's and NHL's national networks and Colorado's own (Nov 3 2026)
let networkLinks = {};
try { const v = JSON.parse(localStorage.getItem("fan.networks")); if (v && typeof v === "object") networkLinks = v; } catch (e) {}
function setNetworkLink(n, url) {
  if (url.trim()) networkLinks[n] = url.trim(); else delete networkLinks[n];
  try { localStorage.setItem("fan.networks", JSON.stringify(networkLinks)); } catch (e) {}
  sendManifest();
  changed("cards");
}
// The wall's manifest (the user's, Nov 3 2026): the computer that runs the wall hands its connector its network links and leagues, and a remote uses them as its own,
// so nothing needs setting on a remote. A remote's links are the wall's, held in memory, never saved over its own.
function sendManifest() { if (Fan.wall && Fan.door && !Fan.door.here) Fan.wall.act({ op: "manifest", links: Object.fromEntries(Object.entries(networkLinks).filter(([n]) => liveSource(n) === "link")), leagues: [...leaguesOn] }).catch(() => {}); }   // the links in use only: a remote can't tune this computer's HDHomeRun
function useWallLinks(links) { if (links && typeof links === "object") { networkLinks = { ...links }; networkSource = Object.fromEntries(Object.keys(links).map(n => [n, "link"])); changed("cards"); } }   // a remote's sources are the wall's links, in memory too
// The layouts a computer's telecasts can take on its monitor, each spot an equal share of it: rows, then columns. Picked in the wall's menu.
const TELECAST_LAYOUTS = [["1", 1, 1], ["2 stacked", 2, 1], ["3 stacked", 3, 1], ["2 across", 1, 2], ["2x2", 2, 2]];
// Where each network comes from, by type (the user's, Nov 3 2026): "link", a link pasted from any streaming service (YouTube TV, Xfinity, Peacock); "hdhr", its channel on the HDHomeRun,
// a tuner on the home network, played in VLC (Nov 2 2026); or "none". Other tuners join as types of their own. Kept per browser. With none picked: the HDHomeRun's channel where this browser
// watched by HDHomeRun in the old Provider box (before 0.45.1), else a pasted link, else a channel.
const BROADCAST = ["CBS", "Fox", "NBC", "ABC", "CW"];   // the networks an antenna gets
let hdhr = { ip: "", channels: {} }, networkSource = {}, oldSetup = "";
try { oldSetup = localStorage.getItem("fan.watchSetup") || ""; const v = JSON.parse(localStorage.getItem("fan.hdhomerun")); if (v && typeof v === "object") hdhr = { ip: String(v.ip || ""), channels: v.channels && typeof v.channels === "object" ? v.channels : {} }; const s = JSON.parse(localStorage.getItem("fan.sources")); if (s && typeof s === "object") networkSource = s; } catch (e) {}
function setHdhr(patch) { hdhr = { ...hdhr, ...patch }; try { localStorage.setItem("fan.hdhomerun", JSON.stringify(hdhr)); } catch (e) {} changed("cards"); }
const sourceOf = n => networkSource[n] || (oldSetup === "hdhomerun" && hdhr.channels[n] ? "hdhr" : networkLinks[n] ? "link" : hdhr.channels[n] ? "hdhr" : "none");
function setNetworkSource(n, s) { networkSource = { ...networkSource, [n]: s }; try { localStorage.setItem("fan.sources", JSON.stringify(networkSource)); } catch (e) {} sendManifest(); changed("cards"); }
// A network's source when it's ready to play: its link, or its channel on an HDHomeRun with an address; else null.
const liveSource = n => { const s = sourceOf(n); return s === "link" && /^https:\/\//i.test(networkLinks[n] || "") ? "link" : s === "hdhr" && hdhr.ip && hdhr.channels[n] ? "hdhr" : null; };
// A game's networks: ESPN's list ("ESPN / ABC" is two), plus what ESPN's data leaves out, one rule a line: [when, has, add].
const isMonday = g => new Date(g.t).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" }) === "Mon";
const NETWORK_RULES = [[isMonday, "ESPN", "ABC"]];   // ESPN's Monday night games are on ABC too [U, Nov 2 2026]
const gameNetworks = g => { const nets = String(g.tv || "").split("/").map(n => n.trim()).filter(Boolean); NETWORK_RULES.forEach(([when, has, add]) => { if (nets.includes(has) && !nets.includes(add) && when(g)) nets.push(add); }); return nets; };
const allNetworks = () => { const seen = new Set(NETWORKS); ALL_GAMES.forEach(g => gameNetworks(g).forEach(n => seen.add(n))); return [...seen]; };
// What a game's Live telecast button does, so also whether it's lit: one decision for both. The first of its networks with a source ready to play, its HDHomeRun channel or its link; else null.
function telecastFor(g) {
  const nets = gameNetworks(g), net = nets.find(liveSource);
  if (!net) return null;
  if (liveSource(net) === "hdhr") return { how: "hdhr", network: net, channel: hdhr.channels[net] };
  const ln = net;
  // ESPN+ (ESPN Select) opens the game's own page on espn.com, whose Watch button plays it for a subscriber signed in there (the user's, Nov 3 2026); its pasted link only says the user has it
  return { how: "link", network: ln, url: ln === "ESPN+" && g.eid ? `https://www.espn.com/${leagueOf(g).code.toLowerCase()}/game/_/gameId/${g.eid}` : networkLinks[ln] };
}
// A word at the bottom of the screen for a few seconds, for what a press couldn't do.
function toast(text) { let t = document.querySelector(".fan-toast"); if (!t) { t = el("div", "fan-toast"); document.body.append(t); } t.textContent = text; t.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 7000); }
// Pressed: the HDHomeRun channel, tuned in VLC when that's installed, or else which channel to pick in the HDHomeRun app (which has no documented way to be opened on a channel);
// or the network's link. NCAA FB's list, always on, opens YouTube TV's site when nothing is set.
function watchGame(g) {
  const d = telecastFor(g);
  if (d && d.how === "hdhr") {
    const say = `${d.network} is ${d.channel} on your HDHomeRun: open it in the HDHomeRun app`;
    if (!Fan.playHdhr) { toast(say); return; }
    Fan.playHdhr(hdhr.ip, d.channel).then(r => { if (!r.ok) toast(/VLC isn't installed/.test(r.error) ? say : "HDHomeRun: " + r.error); }, () => toast(say));
    return;
  }
  // with a connector that runs a wall, this computer's telecasts go through it, in the monitor and layout the wall keeps for this computer (below); without one, in the connector's own choice of spot
  if (d && Fan.wall) { Fan.wall.act({ op: "open", machine: "self", url: d.url }).then(r => { if (!r.ok) Fan.openTelecast(d.url); }, () => Fan.openTelecast(d.url)); return; }
  Fan.openTelecast(d ? d.url : "https://tv.youtube.com/");
}

// ---- The wall
// The wall (PLAN.md E step 3; the user's, Nov 3 2026: "a sports bar controlling a bunch of screens they can see from one place"), at the top of the Telecasts tab: this computer and every
// screen that joined its wall, with their monitors and the telecast windows on them, where they really sit, and the day's games to put on any of them. This page's connector keeps it;
// the other computers are its screens (wall.rs in the connector). Tap a window for its sound, which mutes every other telecast on the wall; x closes it; Snap back puts a computer's
// windows back in their spots; each computer's monitor and layout pick its spots.
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

// ---- The rest of the Telecasts tab, drawn by the settings window, which hands over its own redraw
let redrawTab = () => {};
// The Telecasts tab (the user's, Nov 3 2026: "a sports bar controlling a bunch of screens they can see from one place"): the wall first, this computer and every screen that
// joined it, with the day's games; then its two switches, each with its own address; then, on a computer whose wall takes no one, joining another computer's wall as a screen.
// Without a wall, a note: telecasts open as plain links.
const telecastRows = () => {
  const grid = el("div", "fan-telecasts"), links = el("div");
  links.append(...networkRows(), ...captureRows());
  if (Fan.wall) { const joined = !!(Fan.screen && Fan.screen.of); grid.append(wallSetup(joined ? [screenRows()] : [doorRows(), screenRows()]), ...(joined ? [] : [wallPanel()]), links); return [grid]; }
  grid.append(el("p", "fan-note", Fan.hostHello ? "This connector can't run a wall or place telecast windows, so a telecast opens as a plain link." : "Needs the Fan connector on this computer: it runs the wall and places each telecast's window. Without it, a telecast opens as a plain link."), links);
  return [grid];
};
// Wall setup (the user's, Nov 3 2026: "the first choice to make"), at the top of the tab and folding away once set: the two switches, or joining another wall. Open until something
// is set, then as the user last left it, kept per browser. Folded, its title says how it's set.
let setupOpen = null;   // this session's: the tab redraws as a switch changes, and the section stays as it was
const wallSetup = parts => {
  const d = el("details", "fan-setup"), s = el("summary"), door = Fan.door && Fan.door.info, of = Fan.screen && Fan.screen.of;
  const set = !!(of || (door && (door.screens.on || door.remote.on)));
  const how = Fan.door && Fan.door.here ? "This is a remote" : of ? `A screen on the wall at ${of.wall}${of.state === "waiting" ? ", waiting to be allowed" : ""}` : door ? `Screens ${door.screens.on ? "on" : "off"} · Remote control ${door.remote.on ? "on" : "off"}` : "";
  s.append(el("b", null, "Wall setup"), el("span", "fan-setup-how", how));
  if (setupOpen === null) { let kept = null; try { kept = localStorage.getItem("fan.wallSetup"); } catch (e) {} setupOpen = kept ? kept === "open" : !set; }
  d.open = setupOpen;
  d.addEventListener("toggle", () => { setupOpen = d.open; try { localStorage.setItem("fan.wallSetup", d.open ? "open" : "closed"); } catch (e) {} });
  d.append(s, ...parts);
  return d;
};
// The wall's two switches, on the computer that runs it: other computers may join as screens, and tablets or phones may control it. Each has its own code and address.
const doorRows = () => {
  const box = el("div", "fan-door");
  if (!Fan.door) return box;
  if (Fan.door.here) { box.append(el("p", "fan-door-here", "This is a remote for the wall: telecasts you start here open on its computers.")); return box; }
  const draw = (note = "") => {
    const d = Fan.door.info, row = (kind, label, on, url, ipUrl, how, qr) => {
      const lab = el("label", "fan-check"), c = el("input");
      c.type = "checkbox"; c.checked = !!on;
      c.addEventListener("change", () => { c.disabled = true; Fan.door.set(kind, c.checked).then(() => redrawTab(), e => draw("Couldn't: " + e.message)); });
      lab.append(c, label);
      const out = [lab];
      if (on && url) {
        out.push(el("p", "fan-note", how));
        if (qr) { const q = el("div", "fan-qr"); q.innerHTML = qrSvg(url) || ""; q.title = "Point the tablet or phone's camera here"; out.push(q); }
        out.push(el("div", "fan-door-url", url));
        if (ipUrl) out.push(el("p", "fan-note", "By its number, if that name doesn't work on your network: " + ipUrl));
      }
      else if (on) out.push(el("p", "fan-note", "On, but this computer's address on the network couldn't be found."));
      return out;
    };
    box.replaceChildren(
      ...row("screens", "Let other computers join this wall as screens", d.screens.on, d.screens.url, d.screens.ipUrl, "On each of the other computers: Settings, Telecasts, Wall setup, Find walls, and Join this one; you'll allow it on this wall. Or paste this there:", false),
      ...row("remote", "Let a tablet or phone control this wall", d.remote.on, d.remote.url, d.remote.ipUrl, "On the tablet or phone, point its camera at this code, or open the address in Chrome, then Add to Home Screen. It pairs that device, once.", true));
    if (d.open) box.append(el("p", "fan-note", "If Windows asks whether Fan's connector may use the network, choose Private networks."));
    if (note) box.append(el("p", "fan-note", note));
  };
  draw();
  return box;
};
// This computer as a screen on another computer's wall: join with the screens address that one's Telecasts tab shows, or leave. Not while this computer's own wall takes screens.
const screenRows = () => {
  const box = el("div", "fan-door");
  if (!Fan.screen || (Fan.door && Fan.door.info.screens.on)) return box;
  const draw = () => {
    const j = Fan.screen.of;
    if (j) {
      const leave = el("button", "fan-start", "Leave"); leave.type = "button";
      leave.addEventListener("click", () => { leave.disabled = true; Fan.screen.set({ op: "leave" }).then(() => redrawTab(), e => { box.append(el("p", "fan-note", "Couldn't: " + e.message)); leave.disabled = false; }); });
      const SAY = { waiting: `Waiting to be allowed: on that computer, Settings, Telecasts, Wall setup, Allow ${j.name}.`, refused: "That wall refused or removed this computer. Leave, then join again.", unreachable: "That wall isn't answering: its computer may be asleep or off." };
      box.replaceChildren(el("p", "fan-door-here", `This computer is a screen on the wall at ${j.wall}, as ${j.name}.${j.state === "on" ? " That wall puts telecasts here." : ""}`), ...(SAY[j.state] ? [el("p", "fan-note", SAY[j.state])] : []), leave);
      if (j.state !== "on") setTimeout(() => { if (!box.isConnected || !Fan.hostHello) return; Fan.hostHello().then(h => { const was = JSON.stringify(Fan.screen.of); Fan.screen.of = h.screenOf || null; if (JSON.stringify(Fan.screen.of) !== was) redrawTab(); else draw(); }, () => {}); }, 3000);   // waiting: watch for the wall's answer
      return;
    }
    const ip = el("input"), name = el("input"), go = el("button", "fan-start", "Join"), say = el("p", "fan-note", "");
    ip.type = "text"; ip.placeholder = "http://192.168.1.20:5280/?screen=123456"; ip.spellcheck = false; ip.setAttribute("aria-label", "The wall's screens address");
    name.type = "text"; name.value = Fan.screen.name; name.setAttribute("aria-label", "This computer's name on the wall");
    go.type = "button";
    go.addEventListener("click", () => { go.disabled = true; say.textContent = "Joining…"; Fan.screen.set({ op: "join", address: ip.value, name: name.value }).then(() => redrawTab(), e => { say.textContent = "Couldn't: " + e.message; go.disabled = false; }); });
    const row = el("div", "fan-joinrow"); row.append(ip, go);
    // Find walls: one ask on the home network; each wall that answers can be joined, and its computer allows it
    const find = el("button", "fan-start fan-monbtn", "Find walls"), found = el("div", "fan-found");
    find.type = "button";
    find.addEventListener("click", () => {
      find.disabled = true; found.replaceChildren(el("p", "fan-note", "Looking on your network…"));
      Fan.screen.find().then(walls => {
        find.disabled = false;
        if (!walls.length) { found.replaceChildren(el("p", "fan-note", "No wall answered. On the computer that runs it, turn on \"Let other computers join this wall as screens\", or paste its address below.")); return; }
        found.replaceChildren(...walls.map(w => { const r = el("div", "fan-foundrow"), b = el("button", "fan-start", "Join"); b.type = "button"; r.append(el("b", null, `${w.name}'s wall`), el("small", null, w.wall || w.ip || ""), b); b.addEventListener("click", () => { b.disabled = true; const ask = wall => Fan.screen.set({ op: "ask", wall, name: name.value }); (w.wall ? ask(w.wall).catch(() => ask(w.ip)) : ask(w.ip)).then(() => redrawTab(), e => { r.append(el("small", "fan-note", "Couldn't: " + e.message)); b.disabled = false; }); }); return r; }));
      }, e => { find.disabled = false; found.replaceChildren(el("p", "fan-note", "Couldn't: " + e.message)); });
    });
    box.replaceChildren(el("h3", null, "Join a wall"), el("p", "fan-note", "To make this computer a screen on another computer's wall: name it, then find that wall on your network, or paste the screens address its Telecasts tab shows."), name, find, found, row, say);
  };
  draw();
  return box;
};
// The telecast router's probe (PLAN.md E): one press on a Sunday morning saves what Sunday Ticket's page shows in Fan's TV window, so Claude can build the link finder from it.
const captureRows = () => {
  if (!Fan.captureTelecast) return [];
  const b = el("button", "fan-start", "Capture the TV window"), note = el("p", "fan-note", "For Sunday Ticket links. On a Sunday morning, open any telecast from Fan, go to Sunday Ticket in that window so the games show, then press this. It saves what the page shows on this computer, and presses nothing.");
  b.type = "button";
  b.addEventListener("click", () => {
    b.disabled = true; note.textContent = "Capturing…";
    Fan.captureTelecast().then(r => { note.textContent = r.ok ? `Saved: ${r.pages.map(p => `"${p.title}", ${p.links} links, ${p.games} labelled like games`).join("; ")}. Tell Claude it's there.` : "Couldn't: " + r.error; }, e => { note.textContent = "Couldn't: " + e.message; }).then(() => { b.disabled = false; });
  });
  return [el("h3", null, "Sunday Ticket"), note, b];
};
// The Telecasts tab's networks (the user's, Nov 3 2026: sources divided by type): each network's source, None, a link pasted from any streaming service, or its channel on the HDHomeRun,
// from the list read from it when its address is set. Rescan reads the list again and fills in what it can match.
const networkRows = () => {
  const box = el("div"), draw = () => {
    const note = el("p", "fan-note", "Where each network comes from: a link from any streaming service (YouTube TV, Xfinity, Peacock), copied from your browser while the channel plays, or its channel on your HDHomeRun" + (hdhr.ip ? "." : ", once its address is set in the Networks box on the Application tab."));
    box.replaceChildren(el("h3", null, "Networks"), note);
    if (hdhr.ip) {
      const rescan = el("button", "fan-start", "Rescan"); rescan.type = "button"; rescan.disabled = !Fan.hdhrLineup; rescan.title = "Read the HDHomeRun's channels again and match them to networks";
      rescan.addEventListener("click", () => { rescan.disabled = true; hdhrList = null; draw(); });
      box.append(rescan);
      if (!hdhrList && Fan.hdhrLineup) { const reading = el("p", "fan-note", "Reading the HDHomeRun's channels…"); box.append(reading); hdhrRead().then(draw, e => { reading.textContent = "Couldn't read its channels: " + e.message; }); }
    }
    box.append(netCols(allNetworks().map(n => {
      const row = el("div", "fan-net"), s = el("select", "fan-pick"), c = el("input"), saved = hdhr.channels[n];
      const chans = hdhrList ? hdhrList.map(x => [String(x.number), `HDHomeRun ${x.number} ${x.name || ""}`.trim()]) : [];
      if (saved && !chans.some(([v]) => v === saved)) chans.unshift([saved, "HDHomeRun " + saved]);
      [["none", "None"], ["link", "Link"], ...(hdhr.ip ? chans.map(([v, t]) => ["hdhr:" + v, t]) : [])].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; s.append(o); });
      const src = sourceOf(n);
      s.value = src === "hdhr" && hdhr.ip && saved ? "hdhr:" + saved : src === "link" ? "link" : "none";
      s.setAttribute("aria-label", n + "'s source");
      c.type = "url"; c.value = networkLinks[n] || ""; c.placeholder = n === "ESPN+" ? "https://www.espn.com/watch/ (each game opens its own page)" : "https://..."; c.spellcheck = false; c.hidden = s.value !== "link";
      c.setAttribute("aria-label", n + "'s link");
      s.addEventListener("change", () => {
        if (s.value.startsWith("hdhr:")) { setHdhr({ channels: { ...hdhr.channels, [n]: s.value.slice(5) } }); setNetworkSource(n, "hdhr"); } else setNetworkSource(n, s.value);
        c.hidden = s.value !== "link"; if (!c.hidden) c.focus();
      });
      c.addEventListener("input", () => setNetworkLink(n, c.value));
      row.append(el("span", null, n), s, c);
      return row;
    })));
  };
  draw();
  return [box];
};
const netCols = rows => { const d = el("div", "fan-netcols"); d.append(...rows); return d; };   // the networks in two columns
// The Networks box: the HDHomeRun's address, the one tuner so far; each network's source is picked on the Telecasts tab.
const networkPick = () => [el("small", null, "HDHomeRun"), hdhrBox()];
// An HDHomeRun: its address on the user's network, then its channels read from it, each broadcast network matched to one. The match is guessed from Chicago's call signs and set by hand on the Telecasts tab.
const CALL_SIGNS = { WBBM: "CBS", WFLD: "Fox", WMAQ: "NBC", WLS: "ABC", WGN: "CW", KCNC: "CBS", KDVR: "Fox", KUSA: "NBC", KMGH: "ABC", KWGN: "CW" };   // Chicago's, then Denver's
const guessOf = c => { const name = String(c.name || "").toUpperCase(), sign = name.split(/[-\s]/)[0]; return CALL_SIGNS[sign] || allNetworks().find(n => n.toUpperCase() === name || n.toUpperCase() === sign) || null; };
let hdhrList = null;   // the device's channels, read this session
const hdhrRead = () => Fan.hdhrLineup(hdhr.ip).then(r => {
  if (!r.ok) throw new Error(r.error);
  hdhrList = r.channels;
  const guessed = { ...hdhr.channels };
  allNetworks().forEach(n => { if (guessed[n]) return; const c = hdhrList.find(x => guessOf(x) === n); if (c) guessed[n] = String(c.number); });
  setHdhr({ channels: guessed });
  return r.channels.length;
});
const hdhrBox = () => {
  const d = el("div", "fan-hdhr"), ip = el("input"), b = el("button", "fan-start", "Read channels"), note = el("small", null, hdhr.ip ? `${Object.keys(hdhr.channels).length} channels matched` : "Its address on your network");
  ip.type = "text"; ip.value = hdhr.ip; ip.placeholder = "192.168.1.50"; ip.spellcheck = false; ip.setAttribute("aria-label", "HDHomeRun address");
  ip.addEventListener("change", () => setHdhr({ ip: ip.value.trim() }));
  b.type = "button"; b.disabled = !Fan.hdhrLineup;
  b.title = Fan.hdhrLineup ? "Read its channel list" : "Needs a connector of 0.33 or later";
  b.addEventListener("click", () => {
    setHdhr({ ip: ip.value.trim() }); b.disabled = true; note.textContent = "Reading…";
    hdhrRead().then(n => { note.textContent = `${n} channels; ` + (allNetworks().filter(x => hdhr.channels[x]).map(x => `${x} ${hdhr.channels[x]}`).join(", ") || "pick the networks' channels on the Telecasts tab"); }, e => { note.textContent = "Couldn't: " + e.message; }).then(() => { b.disabled = false; });
  });
  d.append(ip, b, note);
  return d;
};
const telecastTab = redraw => { redrawTab = redraw; return telecastRows(); };

export { NETWORKS, TELECAST_LAYOUTS, BROADCAST, networkLinks, setNetworkLink, sendManifest, useWallLinks, hdhr, setHdhr, sourceOf, setNetworkSource, liveSource, allNetworks, telecastFor, watchGame, wallPanel, telecastTab, networkPick };
