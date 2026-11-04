// The settings window: Fan's button, its tabs and the status indicators.
import { espnState } from "./espn.js?v=mw1d2yjh";
import { Fan } from "./hosts.js?v=mw1d2yjh";
import { allNetworks, weirdFills, programBehind, LAYOUTS, layoutPref, setLayoutPref, bdBadge, switchWeek, weekNow, hdhr, setHdhr, sourceOf, setNetworkSource, liveSource, APP_VERSION, $, BADGE_STYLES, NETWORKS, TELECAST_LAYOUTS, allTickets, badgeStyle, el, leagueNames, leaguesOn, networkLinks, pricesWanted, setBadgeStyle, setLeagueOn, setNetworkLink, setTelecastPref, slateAt, linesAt, telecastPref, timeZoned, trackingOn } from "./base.js?v=mw1d2yjh";
import { LEAGUE_DEFS, LEAGUES_LATER, LEAGUES_READY } from "./leagues.js?v=mw1d2yjh";
import { wallPanel } from "./wall.js?v=mw1d2yjh";
import { qrSvg } from "./qr.js?v=mw1d2yjh";
import { recordsItems, setPrices, setTracking } from "./tracker.js?v=mw1d2yjh";
import { demoAway, setBet } from "./trade.js?v=mw1d2yjh";
  // Fan's button opens the settings window.
  let fillSettings;
  // The public page is the front door. A browser that has asked for the connector looks for it on load and moves there, saying so. Only those: the look can bring up a browser permission prompt. ?stay stays.
  const findConnector = () => {
    try { if (Fan.hostHello || !Fan.startLink || localStorage.getItem("fan.connector") !== "yes" || location.search.includes("stay")) return; } catch (e) { return; }
    Fan.connectorUp().then(() => { $("slateNote").textContent = "Found your connector. Moving to it…"; location.href = Fan.localFan; }, () => {});
  };
  { const list = $("fanList"), btn = $("fanBtn"), win = $("fanWindow");
    let firstClose = true;   // closing the window that opens on load shows the current week [U, Nov 2 2026]
    const toNow = () => { if (firstClose) { firstClose = false; switchWeek(weekNow()); } };
    const open = on => { if (on && !win.open) win.showModal(); else if (!on && win.open) { win.close(); toNow(); } };
    // The open tab fits the window (the user's layout rules, Nov 2 2026): laid out wider and scaled down until it doesn't run over, to 60% at most; past that #fanList scrolls.
    const overflows = () => list.scrollHeight > list.clientHeight + 1 || list.scrollWidth > list.clientWidth + 1;
    const fitList = () => {
      const p = list.querySelector(".fan-list:not([hidden])");
      if (!p || !win.open) return;
      p.style.zoom = "";
      if (p.querySelector(".fan-telecasts")) return;   // the Telecasts tab keeps its large type and scrolls (the user's, Nov 3 2026)
      for (let z = 1; z > .6 && overflows(); ) { z = Math.round((z - .05) * 100) / 100; p.style.zoom = String(z); }
    };
    // Fitted again when the window changes size (it follows the strips, base.js fitBand), when its text changes (the statuses update in place) and when fonts arrive. Its own zoom is a style change, which neither watcher hears.
    const listWatch = new ResizeObserver(() => fitList()), textWatch = new MutationObserver(() => fitList());   // held here, so they keep watching
    listWatch.observe(list); textWatch.observe(list, { childList: true, characterData: true, subtree: true });
    if (document.fonts) document.fonts.addEventListener("loadingdone", () => fitList());
    let tab = "about";
    const leagueRows = () => Object.entries(leagueNames()).map(([k, h]) => {
      const row = el("label", "fan-lg" + (LEAGUES_LATER.includes(k) ? " later" : "")), c = el("input");
      c.type = "checkbox"; c.checked = leaguesOn.has(k); c.disabled = !LEAGUES_READY.includes(k) || (c.checked && leaguesOn.size === 1); c.setAttribute("aria-label", "Use " + h);
      c.addEventListener("change", () => { if (c.checked) { c.disabled = true; row.append(el("small", null, "getting its games from ESPN…")); } setLeagueOn(k, c.checked).then(fill, fill); });   // a league's first turn-on pulls its season from ESPN, which takes a few seconds: it says so
      row.append(c, h);
      if (LEAGUES_LATER.includes(k)) { const when = LEAGUE_DEFS[k].listedAs || "next year"; row.title = when[0].toUpperCase() + when.slice(1); row.append(el("small", null, when)); }
      return row;
    });
    // The monitor map: drawn to scale in Windows' arrangement. The selected monitor shows the layout's spots, numbered in the order they fill.
    const screenPicker = () => {
      const box = el("div", "fan-screens");
      if (!Fan.screens) { box.append(el("p", "fan-note", "Choosing a monitor takes the Fan connector. Here a telecast opens as a plain link.")); return box; }
      const draw = ds => {
        const matches = (d, p) => d.label === p.label && d.bounds.width === p.width && d.bounds.height === p.height;
        const same = telecastPref ? ds.filter(d => matches(d, telecastPref)) : [], picked = telecastPref ? same.find(d => d.bounds.x === telecastPref.x && d.bounds.y === telecastPref.y) || same[0] : null;
        const suggested = telecastPref ? null : ds.find(d => d.workArea.height > d.workArea.width), sel = picked || suggested;
        const rows = telecastPref ? telecastPref.rows : 3, cols = telecastPref ? telecastPref.cols : 1;
        const prefOf = (d, r, c) => ({ label: d.label, width: d.bounds.width, height: d.bounds.height, x: d.bounds.x, y: d.bounds.y, rows: r, cols: c });
        const minX = Math.min(...ds.map(d => d.bounds.x)), minY = Math.min(...ds.map(d => d.bounds.y)), w = Math.max(...ds.map(d => d.bounds.x + d.bounds.width)) - minX, h = Math.max(...ds.map(d => d.bounds.y + d.bounds.height)) - minY, k = Math.min(720 / w, 400 / h);
        const map = el("div", "fan-map"); map.style.width = Math.round(w * k) + "px"; map.style.height = Math.round(h * k) + "px";
        ds.forEach(d => {
          const b = el("button", d === sel ? "on" : null), label = el("span", null, d.label || "Monitor");
          b.type = "button"; b.setAttribute("aria-pressed", String(d === sel));
          b.style.cssText = `left:${Math.round((d.bounds.x - minX) * k)}px;top:${Math.round((d.bounds.y - minY) * k)}px;width:${Math.round(d.bounds.width * k)}px;height:${Math.round(d.bounds.height * k)}px`;
          b.append(label, el("small", null, `${d.bounds.width}x${d.bounds.height}`));
          if (d === sel) { const g = el("div", "fan-spots"); g.style.gridTemplate = `repeat(${rows}, 1fr) / repeat(${cols}, 1fr)`; for (let i = 1; i <= rows * cols; i++) g.append(el("i", null, String(i))); b.append(g); }
          b.addEventListener("click", () => { setTelecastPref(prefOf(d, rows, cols)); draw(ds); });
          map.append(b);
        });
        const lay = el("div", "fan-lay");
        TELECAST_LAYOUTS.forEach(([name, r, c]) => {
          const b = el("button", null, name); b.type = "button"; b.disabled = !sel; b.setAttribute("aria-pressed", String(!!sel && r === rows && c === cols));
          b.addEventListener("click", () => { setTelecastPref(prefOf(sel, r, c)); draw(ds); });
          lay.append(b);
        });
        const show = el("button", "fan-show", "Show me"); show.type = "button"; show.disabled = !sel; show.addEventListener("click", () => Fan.screens.show(telecastPref || prefOf(sel, rows, cols)));
        const note = telecastPref && !picked ? "The monitor you chose isn't connected, so telecasts open beside Fan. Click one to choose again." : suggested ? "Fan's suggestion, your portrait monitor. Click a monitor or layout to choose your own." : !sel ? "Click a monitor. Until then, telecasts open beside Fan." : "Telecasts fill these spots in order. With every spot taken, a new one lands on top of the others.";
        box.replaceChildren(el("h3", null, "Where telecasts open"), map, lay, show, el("p", "fan-note", note));
      };
      Fan.screens.list().then(draw, () => box.replaceChildren(el("p", "fan-note", "Couldn't read the monitors.")));
      return box;
    };
    // The Telecasts tab (the user's, Nov 3 2026: "a sports bar controlling a bunch of screens they can see from one place"): the wall first, this computer and every screen that
    // joined it, with the day's games; then its two switches, each with its own address; then, on a computer whose wall takes no one, joining another computer's wall as a screen.
    // With a connector from before the wall, the monitor map waits behind its own button, as before.
    let monitorsOpen = false;
    const telecastRows = () => {
      const grid = el("div", "fan-telecasts"), links = el("div");
      links.append(...networkRows(), ...captureRows());
      if (Fan.wall) { const joined = !!(Fan.screen && Fan.screen.of); grid.append(wallSetup(joined ? [screenRows()] : [doorRows(), screenRows()]), ...(joined ? [] : [wallPanel()]), links); return [grid]; }
      const mon = el("button", "fan-start fan-monbtn"), picker = el("div");
      const set = () => { mon.textContent = monitorsOpen ? "Close monitors" : "Configure monitors"; mon.setAttribute("aria-expanded", String(monitorsOpen)); picker.hidden = !monitorsOpen; if (monitorsOpen && !picker.childNodes.length) picker.append(screenPicker()); };
      mon.type = "button"; mon.addEventListener("click", () => { monitorsOpen = !monitorsOpen; set(); });
      if (!Fan.screens) { mon.disabled = true; monitorsOpen = false; }   // dimmed with no connector, which is what reads the monitors and places the windows
      set();
      const row = el("div", "fan-monrow"); row.append(mon);
      if (!Fan.screens) row.append(el("span", "fan-note", Fan.hostHello ? "The connector can't place telecast windows on this computer, so a telecast opens as a plain link." : "Needs the Fan connector on this computer: it reads your monitors and places each telecast's window. Without it, a telecast opens as a plain link."));
      grid.append(row, picker, links);
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
      const box = el("div", "fan-remote");
      if (!Fan.door) return box;
      if (Fan.door.here) { box.append(el("p", "fan-remote-here", "This is a remote for the wall: telecasts you start here open on its computers.")); return box; }
      const draw = (note = "") => {
        const d = Fan.door.info, row = (kind, label, on, url, ipUrl, how, qr) => {
          const lab = el("label", "fan-check"), c = el("input");
          c.type = "checkbox"; c.checked = !!on;
          c.addEventListener("change", () => { c.disabled = true; Fan.door.set(kind, c.checked).then(() => fill(), e => draw("Couldn't: " + e.message)); });
          lab.append(c, label);
          const out = [lab];
          if (on && url) {
            out.push(el("p", "fan-note", how));
            if (qr) { const q = el("div", "fan-qr"); q.innerHTML = qrSvg(url) || ""; q.title = "Point the tablet or phone's camera here"; out.push(q); }
            out.push(el("div", "fan-remote-url", url));
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
      const box = el("div", "fan-remote");
      if (!Fan.screen || (Fan.door && Fan.door.info.screens.on)) return box;
      const draw = () => {
        const j = Fan.screen.of;
        if (j) {
          const leave = el("button", "fan-start", "Leave"); leave.type = "button";
          leave.addEventListener("click", () => { leave.disabled = true; Fan.screen.set({ op: "leave" }).then(() => fill(), e => { box.append(el("p", "fan-note", "Couldn't: " + e.message)); leave.disabled = false; }); });
          const SAY = { waiting: `Waiting to be allowed: on that computer, Settings, Telecasts, Wall setup, Allow ${j.name}.`, refused: "That wall refused or removed this computer. Leave, then join again.", unreachable: "That wall isn't answering: its computer may be asleep or off." };
          box.replaceChildren(el("p", "fan-remote-here", `This computer is a screen on the wall at ${j.wall}, as ${j.name}.${j.state === "on" ? " That wall puts telecasts here." : ""}`), ...(SAY[j.state] ? [el("p", "fan-note", SAY[j.state])] : []), leave);
          if (j.state !== "on") setTimeout(() => { if (!box.isConnected || !Fan.hostHello) return; Fan.hostHello().then(h => { const was = JSON.stringify(Fan.screen.of); Fan.screen.of = h.screenOf || null; if (JSON.stringify(Fan.screen.of) !== was) fill(); else draw(); }, () => {}); }, 3000);   // waiting: watch for the wall's answer
          return;
        }
        const ip = el("input"), name = el("input"), go = el("button", "fan-start", "Join"), say = el("p", "fan-note", "");
        ip.type = "text"; ip.placeholder = "http://192.168.1.20:5280/?screen=123456"; ip.spellcheck = false; ip.setAttribute("aria-label", "The wall's screens address");
        name.type = "text"; name.value = Fan.screen.name; name.setAttribute("aria-label", "This computer's name on the wall");
        go.type = "button";
        go.addEventListener("click", () => { go.disabled = true; say.textContent = "Joining…"; Fan.screen.set({ op: "join", address: ip.value, name: name.value }).then(() => fill(), e => { say.textContent = "Couldn't: " + e.message; go.disabled = false; }); });
        const row = el("div", "fan-joinrow"); row.append(ip, go);
        // Find walls: one ask on the home network; each wall that answers can be joined, and its computer allows it
        const find = el("button", "fan-start fan-monbtn", "Find walls"), found = el("div", "fan-found");
        find.type = "button";
        find.addEventListener("click", () => {
          find.disabled = true; found.replaceChildren(el("p", "fan-note", "Looking on your network…"));
          Fan.screen.find().then(walls => {
            find.disabled = false;
            if (!walls.length) { found.replaceChildren(el("p", "fan-note", "No wall answered. On the computer that runs it, turn on \"Let other computers join this wall as screens\", or paste its address below.")); return; }
            found.replaceChildren(...walls.map(w => { const r = el("div", "fan-foundrow"), b = el("button", "fan-start", "Join"); b.type = "button"; r.append(el("b", null, `${w.name}'s wall`), el("small", null, w.wall || w.ip || ""), b); b.addEventListener("click", () => { b.disabled = true; const ask = wall => Fan.screen.set({ op: "ask", wall, name: name.value }); (w.wall ? ask(w.wall).catch(() => ask(w.ip)) : ask(w.ip)).then(() => fill(), e => { r.append(el("small", "fan-note", "Couldn't: " + e.message)); b.disabled = false; }); }); return r; }));
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
    const trackItem = () => { const lab = el("label", "fan-check"), c = el("input"); c.type = "checkbox"; c.checked = trackingOn; c.addEventListener("change", () => { setTracking(c.checked); fill(); }); lab.append(c, "Track"); return lab; };
    const pricesItem = () => {
      if (!Fan.lines) return [el("p", "fan-note", (trackingOn ? "Your bets stay in this browser. " : "") + "Prices need the Fan connector on this computer.")];
      const lab = el("label", "fan-check"), c = el("input"); c.type = "checkbox"; c.checked = pricesWanted; c.addEventListener("change", () => setPrices(c.checked)); lab.append(c, "Price"); return [lab];
    };
    // Starting the connector from the page. This tab then goes to the connector's own address, or reloads if it's already there. Nothing answering after a while says so, and it can be pressed again.
    const knowConnector = () => { try { localStorage.setItem("fan.connector", "yes"); } catch (e) {} };
    const startItem = () => {
      const a = el("a", "fan-start", "Start connector"), box = el("div", "fan-starting");
      a.href = Fan.startLink;
      a.addEventListener("click", () => {
        knowConnector();
        box.querySelector("small")?.remove();
        const note = el("small", null, "Starting…");
        box.append(note); a.hidden = true;
        let tries = 0;
        const t = setInterval(() => {
          if (++tries > 15) { clearInterval(t); note.replaceChildren("Nothing answered. If it did start, your browser kept this page from seeing it: ", (() => { const go = el("a", null, "open Fan from your computer"); go.href = Fan.localFan; return go; })(), ". If this computer doesn't have the connector yet, it's under the Connector tab."); a.hidden = false; return; }
          Fan.connectorUp().then(() => { clearInterval(t); if (Fan.hostHello) location.reload(); else location.href = Fan.localFan; }, () => {});
        }, 1000);
      });
      box.prepend(a);
      return box;
    };
    // What a first-time user does, on a page with no connector.
    const connectorRows = () => {
      const box = el("div", "fan-connector"), steps = el("ol"), step = (...parts) => { const li = el("li"); li.append(...parts); steps.append(li); };
      const windows = /Windows/.test(navigator.userAgent), mac = /Macintosh/.test(navigator.userAgent) && !navigator.maxTouchPoints, get = el("a", "fan-start", (mac ? "Download for Mac " : "Download for Windows ") + APP_VERSION);
      get.href = mac ? "fan-connector-mac.zip" : "fan-connector-setup.exe"; get.setAttribute("download", mac ? `fan-connector-mac-${APP_VERSION}.zip` : `fan-connector-setup-${APP_VERSION}.exe`);   // one number for Fan. The Windows file still starts fan-connector-setup, which is how it knows to install itself
      get.addEventListener("click", knowConnector);
      box.append(el("h3", null, "Why it's needed"), el("p", null, "Watch and Track work right here. Price and Bet need the Fan connector: a small program on your computer that pulls prices over your own connection and holds your own Kalshi key. Nothing about your bets or your key leaves your computer for this site."));
      if (!windows && !mac) { box.append(el("h3", null, "Getting it"), el("p", null, "The connector runs on a Windows or Mac computer.")); return [box]; }
      step(el("b", null, "Download it. "), get, el("small", null, "It's new and isn't signed yet, so your browser may call it suspicious. To keep it, open the browser's downloads list and choose Keep."));
      if (mac) {
        const set = el("a", "fan-start", "Open Settings");
        set.href = "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension";
        step(el("b", null, "Open it. "), "Open the zip and double-click Fan Connector Setup. Apple hasn't checked it yet, so the Mac refuses the first time. That's expected, and it unlocks the next step.");
        step(el("b", null, "Allow it. "), set, " In Privacy & Security, scroll down to Security and choose Open Anyway. Your browser asks before it opens Settings. It needs no admin password.");
      }
      else step(el("b", null, "Run the file. "), "It isn't signed yet, so your browser may ask whether to keep it, and Windows may warn you: choose More info, then Run anyway. It needs no admin rights.");
      step(el("b", null, "You're moved. "), "It installs and opens Fan from your own computer, at localhost:5180. That's the copy with prices and betting. Settings, telecast links and bets typed on this site stay with this site, so set those up once there.");
      box.append(el("h3", null, "Getting it"), steps, el("h3", null, "After that"), el("p", null, "Always start from this page. When the connector is running, this page finds it and moves you to it. When it isn't, press Start connector. The first time, your browser asks two things: whether to open Fan connector, where you can tick always allow, and whether this site may look for programs on your computer. Say yes to both."), startItem(), el("p", null, "The connector closes itself 30 minutes after your last Fan page closes, unless you tick Start at login, on the Application tab once you've moved. Reloading the page brings the newest version of it. To update the program, download and run the file again. Your records and key stay where they are."));
      return [box];
    };
    const firstHere = () => { try { return localStorage.getItem("fan.connector") !== "yes"; } catch (e) { return true; } };   // this browser has never pressed Start or Download, so the page doesn't look for one
    const getOrStart = () => { const box = el("div", "fan-get"), get = el("button", null, "Get the connector"); get.type = "button"; get.addEventListener("click", () => { tab = "connector"; fill(); }); box.append(startItem(), get); if (firstHere()) box.append(el("small", "fan-first", "This looks like this browser's first visit. If the connector already runs on this computer, press Start to reach it.")); return box; };
    const keysItem = () => { const b = el("button", null, "Connect Kalshi"); b.type = "button"; b.addEventListener("click", () => { open(false); Fan.account(); }); return b; };
    // The layout: Auto, or one the user picks (base.js's LAYOUTS).
    const layoutItem = () => { const lab = el("label", "fan-layout"), s = el("select", "fan-pick"); LAYOUTS.forEach(([k, name]) => { const o = el("option", null, name); o.value = k; s.append(o); }); s.value = layoutPref; s.setAttribute("aria-label", "Layout"); s.addEventListener("change", () => setLayoutPref(s.value)); lab.append("Layout", s); return lab; };
    const badgeItem = () => { const b = el("button", null, "Badges: " + BADGE_STYLES[badgeStyle].label), names = Object.keys(BADGE_STYLES); b.type = "button"; b.addEventListener("click", () => { setBadgeStyle(names[(names.indexOf(badgeStyle) + 1) % names.length]); b.textContent = "Badges: " + BADGE_STYLES[badgeStyle].label; }); return b; };
    // The Application tab: a diagram of what runs where, left the page, then the connector, then the outside services. A card's checkbox is its part's own switch, and greyed where the part can't be changed from here.
    const partCheck = (name, on, change) => { const lab = el("label", "fan-check"), c = el("input"); c.type = "checkbox"; c.checked = on; c.disabled = !change; if (change) c.addEventListener("change", () => { change(c.checked); fill(); }); lab.append(c, name); return lab; };
    const ABOUT = () => ({
      watch: [partCheck("Watch", true), "See the slate, scores, previews, telecasts, and tape.", ", no install."],
      track: [partCheck("Track", trackingOn, Fan.door && Fan.door.here ? null : on => setTracking(on)), "Enter bets and see scenario risk.", ", no install."],
      price: [partCheck("Price", Fan.lines ? pricesWanted : false, Fan.lines && !connectorAway ? on => setPrices(on) : null), "Live lines and risk, plus trends and analytics.", ", requires the Connector."],
      bet: [partCheck("Bet", !!Fan.trader, Fan.setBet && Fan.keyed && !connectorAway ? on => setBet(on) : null), "Execute directly on prediction markets.", ", requires the Connector and API keys."]
    });
    // The status indicators, each on its part of the diagram: what the page can see right now, redrawn every 5 seconds while it shows.
    let stopPressed = false;   // pressed Stop on this page, so its silence is expected
    let connectorAway = false;   // this page's connector isn't answering: Price and Bet keep their ticks, greyed
    const stopItem = box => {
      const wrap = el("div", "fan-starting"), b = el("button", "fan-start", "Stop");
      b.type = "button";
      b.addEventListener("click", () => {
        stopPressed = true; b.hidden = true;
        wrap.append(el("small", null, "Stopping…"));
        Fan.stopConnector().catch(() => { stopPressed = false; }).then(() => { wrap.remove(); drawStatus(box); });
      });
      wrap.append(b);
      return wrap;
    };
    // A new connector program is a new minor version, so the page's own major.minor says what's newest. A program too old to say its version is behind.
    // A program is shown as its major.minor, "0.36", on the user's word (Nov 2 2026): a page release changes only the patch.
    const programName = v => v.split(".").slice(0, 2).join("."), newestProgram = () => programName(APP_VERSION);
    // The Update button: the connector replaces itself, and this page reloads when the new one answers. A failure says why, and it can be pressed again.
    const updateItem = from => {
      const wrap = el("div", "fan-starting"), b = el("button", "fan-start", "Update to " + newestProgram());
      b.type = "button";
      b.addEventListener("click", () => {
        b.hidden = true;
        wrap.querySelector("small")?.remove();
        const note = el("small", null, "Updating…"), fail = text => { note.textContent = text; b.hidden = false; };
        wrap.append(note);
        Fan.updateConnector().then(() => {
          let tries = 0;
          const t = setInterval(() => {
            if (++tries > 60) { clearInterval(t); fail("It didn't come back. Press Update again, or start the connector from the web link."); return; }
            Fan.hostHello().then(hi => { if (hi.version !== from) { clearInterval(t); location.reload(); } }, () => {});
          }, 2000);
        }, e => fail("Couldn't update: " + (e && e.message)));
      });
      wrap.append(b);
      return wrap;
    };
    // The connector's last check of the records against Kalshi, said as what disagrees (calc.js's reconcile). tools/dev/check-records.js --list names each one.
    const disagree = k => [[k.notSaved, "fill", "not saved"], [k.noTicket, "order", "with no ticket"], [k.twoTickets, "order", "with two tickets"], [k.differ, "ticket", "that differs"]].filter(([n]) => n > 0).map(([n, what, how]) => `${n} ${what}${n === 1 ? "" : "s"} ${how}`).join(", ");
    const statusRows = async () => {
      let hi = null, away = false;
      if (stopPressed) away = true;
      else if (Fan.hostHello) { try { hi = await Fan.hostHello(); } catch (e) { away = true; } }
      const espn = espnState(), feed = $("feedNote"), book = hi && hi.book, rec = hi && Fan.lines === Fan.store && hi.records, kal = hi && Fan.lines === Fan.store && hi.env === "prod" && hi.reconcile && !hi.reconcile.skipped ? hi.reconcile : null, kalOk = !!(kal && !kal.error && kal.bad === 0), linked = allNetworks().filter(n => liveSource(n) === "link").length, tuned = allNetworks().filter(n => liveSource(n) === "hdhr").length, time = at => timeZoned(new Date(at));
      return { hi, away, rows: [
        ["Connector", away ? (stopPressed ? ["off", "Stopped"] : ["bad", "Not answering"]) : hi ? programBehind(hi.version) ? ["warn", hi.update ? programName(hi.version) : `${hi.version ? programName(hi.version) + ", u" : "U"}pdate to ${newestProgram()}`] : ["ok", "Running " + programName(hi.version), true] : ["off", "Not on this page"]],
        ["ESPN", espn.problem ? ["bad", espn.problem] : espn.at ? ["ok", "Last read " + time(espn.at), true] : ["ok", "Using this browser's saved copy"]],
        ["Records", !trackingOn ? ["off", "Track is off"] : !Fan.store ? ["bad", "Nowhere to keep them"] : away && Fan.lines === Fan.store ? ["off", "Kept by the connector, which isn't running"] : rec && !rec.ok ? ["bad", "Failed the integrity check: " + rec.error] : weirdFills.length ? ["warn", `Fills Fan can't place in a game: ${weirdFills.join(", ")}`] : kal && kal.error ? ["warn", "Couldn't check against Kalshi: " + kal.error] : kal && kal.bad ? ["warn", "Kalshi disagrees: " + disagree(kal)] : ["ok", `${allTickets.length} wagers, kept ${Fan.lines === Fan.store ? "by the connector" : "in this browser"}${rec && rec.backup ? ", checked, backed up today" : ""}${kalOk ? ", matching Kalshi at " + time(kal.at) : ""}`, !!(rec && rec.ok && rec.backup) && (hi.env !== "prod" || kalOk)]],
        ["Prices", !Fan.lines ? ["off", "Needs the connector"] : !pricesWanted ? ["off", "Price is off"] : away ? ["off", "Not updating: the connector isn't running"] : hi && hi.refresh ? ["bad", hi.refresh] : !linesAt ? ["off", "No lines yet"] : Date.now() - linesAt > 3600000 ? ["warn", "Lines from " + time(linesAt) + ", over an hour old"] : book && book.note ? ["warn", book.note[0].toUpperCase() + book.note.slice(1)] : [book && book.live && book.games ? "live" : "ok", "Lines from " + time(slateAt) + (book && book.live && book.games ? `, live on ${book.games} game${book.games === 1 ? "" : "s"}` : ""), true]],
        ["Kalshi", !hi ? ["off", "Needs the connector"] : hi.keyError ? ["bad", hi.keyError] : !hi.env ? ["off", "No key connected"] : ["ok", `${feed.classList.contains("on") ? "Signed in" : "Connected"}${hi.env === "demo" ? " to demo, fake money" : ""}, orders ${hi.orders ? "on" : "off"}`, feed.classList.contains("on")]],   // the fill feed's connection is signed with the key, so Kalshi taking it proves the key
        ["Fill feed", !hi ? ["off", "Needs the connector"] : !hi.env ? ["off", "Waits for a Kalshi key"] : !feed.textContent || feed.classList.contains("wait") ? ["wait", "Starting"] : feed.classList.contains("on") ? ["live", "Live"] : ["bad", feed.textContent]],
        ["Networks", hdhr.ip && !Fan.playHdhr ? ["warn", "HDHomeRun needs a connector of 0.33 or later"] : hdhr.ip && !Object.keys(hdhr.channels).length ? ["warn", "HDHomeRun: read its channels"] : linked + tuned ? ["ok", [linked && `${linked} by link`, tuned && `${tuned} on the HDHomeRun at ${hdhr.ip}`].filter(Boolean).join(", ")] : ["off", "No sources set"]],
        ["Leagues", ["ok", [...leaguesOn].map(k => leagueNames()[k]).join(", ")]]
      ] };
    };
    const drawStatus = async box => {
      const { hi, away, rows } = await statusRows();
      const ctl = document.querySelector(".fan-con-ctl");   // the connector's own controls sit on it, in the diagram
      if (!ctl || ctl.querySelector(".fan-starting small")) return;   // a press of Start is under way: its note stays until the page reloads
      if (away !== connectorAway) { connectorAway = away; demoAway(away); fill(); return; }   // the diagram above changes too, and this list is drawn again with it
      rows.forEach(([name, [state, text, checked]]) => { const at = box.querySelector(`[data-st="${name}"]`), r = el("div", "fan-st " + state + (checked ? " checked" : "")); r.append(el("i")); if (!at.dataset.plain) r.append(el("b", null, name)); r.append(el("span", null, text)); at.replaceChildren(r); });
      showStates(box, new Map(rows.map(([name, [state, , checked]]) => [name, [state, checked]])));
      box.classList.toggle("healthy", !!hi && !away && rows.every(([name, [state]]) => state === "ok" || state === "live" || state === "off" || (name === "Connector" && programBehind(hi.version))));   // a part turned off isn't a problem; amber, red or waiting is, but not an older program: it runs fine as it is, and updating is the user's choice (Nov 2 2026)
      ctl.replaceChildren();
      if (away && Fan.startLink) ctl.append(startItem());
      if (hi && hi.update && programBehind(hi.version)) ctl.append(updateItem(hi.version));   // in Stop's place: there's room on the line for one
      else if (hi && hi.stop) ctl.append(stopItem(box));
      if (hi && hi.login != null) {   // an installed connector's own checkbox
        const lab = el("label", "fan-check"), c = el("input");
        c.type = "checkbox"; c.checked = hi.login;
        c.addEventListener("change", () => { Fan.setLogin(c.checked).catch(() => {}).then(() => drawStatus(box)); });
        lab.append(c, "Start at login");
        ctl.append(lab);
      }
      releaseHeld(hi);
      drawRoutes(hi);
    };
    // Each venue's switches, on the user's word (Nov 2 2026): prices from Kalshi and Polymarket US, and where orders may go. A venue the connector can't send orders to yet says why. They're the connector's to keep, so they show only with one that knows them.
    const VENUES = [["kalshi", "Kalshi"], ["polymarket", "Polymarket US"]];
    const routeBox = kind => { const d = el("div", "fan-routes"); d.dataset.kind = kind; return d; };
    const drawRoutes = hi => {
      const r = hi && hi.routes;
      document.querySelectorAll(".fan-routes").forEach(box => {
        if (box.dataset.busy) return;
        box.replaceChildren();
        if (!r || !Fan.setRoutes) return;
        const kind = box.dataset.kind, on = new Set(r[kind] || []);
        box.append(el("small", null, kind === "prices" ? "Prices from" : "Orders to"));
        VENUES.forEach(([v, name]) => {
          const cannot = kind === "orders" && !(r.canOrder || []).includes(v), lab = el("label", "fan-check"), c = el("input");
          c.type = "checkbox"; c.checked = on.has(v) && !cannot; c.disabled = cannot || connectorAway;
          c.addEventListener("change", () => {
            if (c.checked) on.add(v); else on.delete(v);
            Fan.setRoutes({ [kind]: VENUES.map(x => x[0]).filter(x => on.has(x)) });
            box.dataset.busy = "1"; setTimeout(() => { delete box.dataset.busy; }, 2000);   // until the connector has it, so a redraw doesn't flip it back
          });
          lab.append(c, name + (cannot ? ": needs a key" : ""));
          box.append(lab);
        });
      });
    };
    // A status shown under its own title, the connector's and Kalshi's, puts its state on that title, which then wears it as the other names do (fan.css).
    // A check means something was verified, not just that nothing's wrong: the connector on the newest program, ESPN's last read, the records' integrity check and today's backup, fresh lines, Kalshi signed in. Telecasts and Leagues have nothing to verify.
    const showStates = (box, states) => {
      box.querySelectorAll("[data-st][data-plain]").forEach(s => { const t = s.parentElement && s.parentElement.querySelector(":scope > b"), [state, checked] = states.get(s.dataset.st) || ["off"]; if (!t) return; t.dataset.state = state; if (checked) t.dataset.checked = "1"; else delete t.dataset.checked; });
    };
    // Holding page updates is gone, on the user's word (Nov 2 2026): every copy follows the site. A connector still holding is let go once, which reloads the page.
    let released = false;
    const releaseHeld = hi => { if (released || !(hi && hi.page && hi.page.held) || !Fan.pageChoice) return; released = true; Fan.pageChoice("release").then(() => location.reload(), () => {}); };
    setInterval(() => { const box = document.querySelector(".fan-about"); if (win.open && box && !box.closest("[hidden]")) drawStatus(box); }, 5000);
    new MutationObserver(() => { const box = document.querySelector(".fan-about"); if (win.open && box && !box.closest("[hidden]")) drawStatus(box); }).observe($("feedNote"), { attributes: true, childList: true, characterData: true, subtree: true });   // the fill feed's dot changes when the feed does
    // The connector, one box in four sections, its three jobs and its program, with a small gear outside it, level with the bottom section, on the user's word (Nov 2 2026). The gear turns, green, while the whole system is healthy (drawStatus): the user knows it's all well if it's turning.
    const GEAR = (() => { const teeth = 10, R = 50, r = 41, w = 0.18, corners = []; for (let i = 0; i < teeth; i++) { const a = (i / teeth) * 2 * Math.PI; [[a - w * 1.4, r], [a - w, R], [a + w, R], [a + w * 1.4, r]].forEach(([t, d]) => corners.push(`${(50 + d * Math.cos(t)).toFixed(2)},${(50 + d * Math.sin(t)).toFixed(2)}`)); } return `<svg viewBox="0 0 100 100" aria-hidden="true"><path fill-rule="evenodd" d="M${corners.join("L")}Z M50,34 a16,16 0 1,0 0.01,0 Z"/></svg>`; })();
    const conFrame = here => el("div", "fan-frame" + (here ? "" : " away"));
    const conGear = () => { const g = el("div", "fan-gear"); g.innerHTML = GEAR; return g; };   // outside the box, level with its bottom section
    // Under the box, on the user's word (Nov 2 2026): what the gear means, with a curved arrow up and to the left, at the gear.
    const gearNote = () => { const n = el("p", "fan-gear-note"); n.innerHTML = '<svg viewBox="0 0 28 34" aria-hidden="true"><path d="M24 32C24 20 12 12 5 5"/><path d="M6.8 11.8 5 5l6.8 1.8"/></svg>'; n.append("If this gear is rotating, all systems are go as configured."); return n; };
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
    // Each part card's mockup of an element of the page it brings, named under it, on the user's word (Nov 2 2026). Made-up figures, no game data.
    const MOCK = { watch: "Game card badge", track: "Wager ticket", price: "Line", bet: "Place button" };
    const partMock = k => {
      const m = el("div", "fan-mock"), art = el("div", "fan-mock-art");
      if (k === "watch") art.append(bdBadge({ away: "Chicago Bears", home: "Seattle Seahawks" }, "home"));
      else if (k === "track") art.append(el("span", "fan-mock-book", "KAL"), el("span", null, "SEA -3.5"), el("span", "fan-mock-num", "$100"));
      else if (k === "price") art.append(el("span", null, "-3.5"), el("span", "fan-mock-num", "-110"), el("span", "fan-mock-num", "+150"));
      else art.append(el("span", "fan-mock-place", "Place"), el("span", "fan-mock-num", "100 @ 52¢"));
      m.dataset.mock = k; m.append(art, el("small", null, MOCK[k]));
      return m;
    };
    const aboutRows = () => {
      const box = el("div", "fan-about"), parts = ABOUT();
      const here = !!Fan.lines && !connectorAway;   // the connector is on this page and answering
      const at = (node, row, col) => { node.style.setProperty("--r", row); node.style.setProperty("--c", col); return node; };
      // Where a status indicator goes. A plain one sits under its own name, so it doesn't repeat it.
      const slot = (name, plain) => { const s = el("div", "fan-slot"); s.dataset.st = name; if (plain) s.dataset.plain = "1"; return s; };
      const card = (k, row) => { const [toggle, what, needs] = parts[k], d = el("div", "fan-part" + (toggle.querySelector("input").checked ? "" : " off")); d.dataset.part = k; const cost = el("span", "fan-cost"), head = el("div", "fan-part-head"); cost.append(el("b", "fan-free", "Free"), needs); head.append(toggle, cost); d.append(head, el("p", null, what), partMock(k)); return at(d, row, 1); };
      // A wire is lit while what it carries is flowing. Its arrow points at the page, or both ways.
      const wire = (label, lit, both, row, col) => { const w = el("div", "fan-wire" + (lit ? " lit" : "")), line = el("div"); line.append(el("i", "l")); if (both) line.append(el("i", "r")); w.append(el("span", null, label), line); return at(w, row, col); };
      const job = (text, status, row) => { const d = el("div", "fan-job" + (row === 3 ? " first" : "")); d.append(el("p", null, text), slot(status)); return at(d, row, 3); };
      const outBox = (name, on, ...rest) => { const d = el("div", "fan-out" + (on ? " on" : "")); d.append(el("b", null, name), ...rest); return d; };
      const service = (name, row, on, ...rest) => at(outBox(name, on, ...rest), row, 5);
      const stack = (...boxes) => { const s = el("div", "fan-outs"); s.append(...boxes); return s; };
      const con = el("div", "fan-con");
      con.append(el("b", null, "Fan connector"), slot("Connector", true));
      if (!Fan.lines && Fan.startLink) con.append(getOrStart());   // on the name's line where it fits, like the controls below
      con.append(el("div", "fan-con-ctl"), conGear());
      box.append(
        at(el("h3", null, "In your browser"), 1, 1), at(el("h3", null, "On this computer"), 1, 3), at(el("h3", null, "Everywhere else"), 1, 5),
        at(conFrame(here), "3 / 7", 3),   // the box around the connector's three jobs and its program
        card("watch", 2), wire("scores, networks", true, false, 2, "2 / 5"), at(stack(outBox("ESPN", true, slot("ESPN", true)), outBox("Networks", true, ...networkPick(), slot("Networks", true))), 2, 5),
        at(con, 6, 3),   // the box's bottom section: its badge, Stop or Update, Start at login
        card("track", 3), Fan.lines ? wire("your bets", trackingOn && here && Fan.lines === Fan.store, true, 3, 2) : at(el("span"), 3, 2), job(Fan.lines ? "Keeps your records, with daily backups." : "Without it, your records stay in this browser.", "Records", 3),
        card("price", 4), wire("lines", here && pricesWanted, false, 4, 2), job("Pulls lines on a timer, over your own connection.", "Prices", 4), wire("prices", here && pricesWanted, false, 4, 4), service("Kalshi, Polymarket US", 4, here && pricesWanted, routeBox("prices")),
        card("bet", 5), wire("orders, fills", here && !!Fan.trader, true, 5, 2), job("Holds your key. Sends orders, hears fills, and runs triggers and responses, with or without this page.", "Fill feed", 5), wire("orders, fills", here && !!Fan.keyed, true, 5, 4), service("Kalshi", 5, here && !!Fan.keyed, slot("Kalshi", true), routeBox("orders"), ...(Fan.account && !Fan.keyed ? [keysItem()] : []))
      );
      box.append(at(gearNote(), 7, 3));
      box.querySelector("[data-part=watch]").append(slot("Leagues"));
      drawStatus(box);
      return [box, el("p", "fan-yours", "Fan does not track, keep, or use your data in any way, other than local storage of the things you want, which is only used internally. There is nothing to sign or agree on: your data is yours.")];
    };
    const SETTINGS_TABS = [
      ["about", "Application", aboutRows],
      ["leagues", "Leagues", leagueRows],
      ["telecasts", "Telecasts", telecastRows],
      ["sportsbooks", "Sportsbooks", () => [trackItem(), ...pricesItem(), ...(Fan.account ? [keysItem()] : [])]],
      ["look", "Look/feel", () => [badgeItem(), layoutItem()]],
      ["connector", "Connector", connectorRows],
      ["records", "Records", () => recordsItems()]
    ];
    const fill = () => {
      const tabs = SETTINGS_TABS.filter(([k]) => k === "connector" ? !Fan.lines && Fan.startLink : k !== "records" || (trackingOn && Fan.store && Fan.store.dump));   // the connector's tab is for a page without one. Only a browser's own records need Records, and only with Bet tracking on
      if (!tabs.some(([k]) => k === tab)) tab = "leagues";
      $("fanTabs").replaceChildren(...tabs.map(([k, h]) => {
        const b = el("button", null, h);
        b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(k === tab));
        b.addEventListener("click", () => { tab = k; fill(); });
        return b;
      }));
      list.replaceChildren(...tabs.map(([k, , rows]) => { const p = el("div", "fan-list"); p.setAttribute("role", "tabpanel"); p.hidden = k !== tab; p.append(...rows()); return p; }));
      fitList();
    };
    btn.addEventListener("click", () => { fill(); open(!win.open); });
    $("fanClose").addEventListener("click", () => open(false));
    win.addEventListener("close", toNow);   // Escape closes it too
    setTimeout(() => { fill(); open(true); }, 0);
    let remoteTab = false;   // a remote opens on Telecasts, the wall: that's its whole job
    fillSettings = () => { if (Fan.door && Fan.door.here && !remoteTab) { remoteTab = true; tab = "telecasts"; } if (win.open) fill(); }; }   // what the connector offers arrives after the window opens
export { fillSettings, findConnector };
