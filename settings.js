// The settings window: Fan's button, its tabs and the status indicators.
import { espnState } from "./espn.js?v=mvylnzab";
import { Fan } from "./hosts.js?v=mvylnzab";
import { APP_VERSION, $, BADGE_STYLES, LEAGUES_READY, NETWORKS, TELECAST_LAYOUTS, allTickets, badgeStyle, el, leagueNames, leaguesOn, networkLinks, pricesWanted, setBadgeStyle, setLeagueOn, setNetworkLink, setTelecastPref, slateAt, telecastPref, timeZoned, trackingOn } from "./base.js?v=mvylnzab";
import { recordsItems, setPrices, setTracking } from "./tracker.js?v=mvylnzab";
import { demoAway, setBet } from "./trade.js?v=mvylnzab";
  // Fan's button opens the settings window.
  let fillSettings;
  // The public page is the front door. A browser that has asked for the connector looks for it on load and moves there, saying so. Only those: the look can bring up a browser permission prompt. ?stay stays.
  const findConnector = () => {
    try { if (Fan.hostHello || !Fan.startLink || localStorage.getItem("fan.connector") !== "yes" || location.search.includes("stay")) return; } catch (e) { return; }
    Fan.connectorUp().then(() => { $("slateNote").textContent = "Found your connector. Moving to it…"; location.href = Fan.localFan; }, () => {});
  };
  { const list = $("fanList"), btn = $("fanBtn"), win = $("fanWindow");
    const open = on => { if (on && !win.open) win.showModal(); else if (!on && win.open) win.close(); };
    let tab = "about";
    const leagueRows = () => Object.entries(leagueNames()).map(([k, h]) => {
      const row = el("label", "fan-lg"), c = el("input");
      c.type = "checkbox"; c.checked = leaguesOn.has(k); c.disabled = !LEAGUES_READY.includes(k) || (c.checked && leaguesOn.size === 1); c.setAttribute("aria-label", "Use " + h);
      c.addEventListener("change", () => { setLeagueOn(k, c.checked); fill(); });
      row.append(c, h);
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
    const telecastRows = () => { const grid = el("div", "fan-telecasts"), links = el("div"); links.append(...networkRows()); grid.append(screenPicker(), links); return [grid]; };
    const networkRows = () => [el("h3", null, "Network links"), el("p", "fan-note", "YouTube TV links. Open a channel in your browser, copy its address and paste it here."), ...NETWORKS.map(n => {
      const row = el("label", "fan-net"), c = el("input");
      c.type = "url"; c.value = networkLinks[n] || ""; c.placeholder = "https://tv.youtube.com/watch/..."; c.spellcheck = false;
      c.addEventListener("input", () => setNetworkLink(n, c.value));
      row.append(n, c);
      return row;
    })];
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
      box.append(el("h3", null, "Getting it"), steps, el("h3", null, "After that"), el("p", null, "Always start from this page. When the connector is running, this page finds it and moves you to it. When it isn't, press Start connector. The first time, your browser asks two things: whether to open Fan connector, where you can tick always allow, and whether this site may look for programs on your computer. Say yes to both."), startItem(), el("p", null, "The connector closes itself 30 minutes after your last Fan page closes, unless you tick Start at login, on the Fan tab once you've moved. Reloading the page brings the newest version of it. To update the program, download and run the file again. Your records and key stay where they are."));
      return [box];
    };
    const getOrStart = () => { const box = el("div", "fan-get"), get = el("button", null, "Get the connector"); get.type = "button"; get.addEventListener("click", () => { tab = "connector"; fill(); }); box.append(startItem(), get); return box; };
    const keysItem = () => { const b = el("button", null, "Connect Kalshi"); b.type = "button"; b.addEventListener("click", () => { open(false); Fan.account(); }); return b; };
    const badgeItem = () => { const b = el("button", null, "Badges: " + BADGE_STYLES[badgeStyle].label), names = Object.keys(BADGE_STYLES); b.type = "button"; b.addEventListener("click", () => { setBadgeStyle(names[(names.indexOf(badgeStyle) + 1) % names.length]); b.textContent = "Badges: " + BADGE_STYLES[badgeStyle].label; }); return b; };
    // The Fan tab: a diagram of what runs where, left the page, then the connector, then the outside services. A card's checkbox is its part's own switch, and greyed where the part can't be changed from here.
    const partCheck = (name, on, change) => { const lab = el("label", "fan-check"), c = el("input"); c.type = "checkbox"; c.checked = on; c.disabled = !change; if (change) c.addEventListener("change", () => { change(c.checked); fill(); }); lab.append(c, name); return lab; };
    const ABOUT = () => ({
      watch: [partCheck("Watch", true), "See the whole slate, scores, previews, telecasts, and tape.", ", no install."],
      track: [partCheck("Track", trackingOn, on => setTracking(on)), "Enter bets and see scenario risk.", ", no install."],
      price: [partCheck("Price", Fan.lines ? pricesWanted : false, Fan.lines && !connectorAway ? on => setPrices(on) : null), "Live lines and risk, plus trends and analytics.", ", requires the Connector."],
      bet: [partCheck("Bet", !!Fan.trader, Fan.setBet && Fan.keyed && !connectorAway ? on => setBet(on) : null), "Execute directly on prediction markets.", ", requires the Connector and API keys."]
    });
    // The status indicators, each on its part of the diagram: what the page can see right now, redrawn every 5 seconds while it shows.
    let stopPressed = false;   // pressed Stop on this page, so its silence is expected
    let connectorAway = false;   // this page's connector isn't answering: Price and Bet keep their ticks, greyed
    const stopItem = box => {
      const wrap = el("div", "fan-starting"), b = el("button", "fan-start", "Stop connector");
      b.type = "button";
      b.addEventListener("click", () => {
        stopPressed = true; b.hidden = true;
        wrap.append(el("small", null, "Stopping…"));
        Fan.stopConnector().catch(() => { stopPressed = false; }).then(() => { wrap.remove(); drawStatus(box); });
      });
      wrap.append(b);
      return wrap;
    };
    const statusRows = async () => {
      let hi = null, away = false;
      if (stopPressed) away = true;
      else if (Fan.hostHello) { try { hi = await Fan.hostHello(); } catch (e) { away = true; } }
      const espn = espnState(), feed = $("feedNote"), nets = Object.values(networkLinks).filter(u => /^https:\/\//i.test(u)).length, time = at => timeZoned(new Date(at));
      return { hi, away, rows: [
        ["Connector", away ? (stopPressed ? ["off", "Stopped"] : ["bad", "Not answering"]) : hi ? ["ok", "Running" + (hi.version ? " " + hi.version : "")] : ["off", "Not on this page"]],
        ["ESPN", espn.problem ? ["bad", espn.problem] : espn.at ? ["ok", "Last read " + time(espn.at)] : ["ok", "Using this browser's saved copy"]],
        ["Records", !trackingOn ? ["off", "Track is off"] : !Fan.store ? ["bad", "Nowhere to keep them"] : away && Fan.lines === Fan.store ? ["off", "Kept by the connector, which isn't running"] : ["ok", `${allTickets.length} wagers, kept ${Fan.lines === Fan.store ? "by the connector" : "in this browser"}`]],
        ["Prices", !Fan.lines ? ["off", "Needs the connector"] : !pricesWanted ? ["off", "Price is off"] : away ? ["off", "Not updating: the connector isn't running"] : hi && hi.refresh ? ["bad", hi.refresh] : !slateAt ? ["off", "No lines yet"] : Date.now() - slateAt > 3600000 ? ["warn", "Lines from " + time(slateAt) + ", over an hour old"] : ["ok", "Lines from " + time(slateAt)]],
        ["Kalshi", !hi ? ["off", "Needs the connector"] : hi.keyError ? ["bad", hi.keyError] : !hi.env ? ["off", "No key connected"] : ["ok", `Connected${hi.env === "demo" ? " to demo, fake money" : ""}, orders ${hi.orders ? "on" : "off"}`]],
        ["Fill feed", !hi ? ["off", "Needs the connector"] : !hi.env ? ["off", "Waits for a Kalshi key"] : !feed.textContent || feed.classList.contains("wait") ? ["wait", "Starting"] : feed.classList.contains("on") ? ["ok", "Live"] : ["bad", feed.textContent]],
        ["Telecasts", nets ? ["ok", nets + (nets === 1 ? " network linked" : " networks linked")] : ["off", "No links pasted"]],
        ["Leagues", ["ok", [...leaguesOn].map(k => leagueNames()[k]).join(", ")]]
      ] };
    };
    const drawStatus = async box => {
      const { hi, away, rows } = await statusRows();
      const ctl = document.querySelector(".fan-con-ctl");   // the connector's own controls sit on it, in the diagram
      if (!ctl || ctl.querySelector(".fan-starting small")) return;   // a press of Start is under way: its note stays until the page reloads
      if (away !== connectorAway) { connectorAway = away; demoAway(away); fill(); return; }   // the diagram above changes too, and this list is drawn again with it
      rows.forEach(([name, [state, text]]) => { const at = box.querySelector(`[data-st="${name}"]`), r = el("div", "fan-st " + state); r.append(el("i")); if (!at.dataset.plain) r.append(el("b", null, name)); r.append(el("span", null, text)); at.replaceChildren(r); });
      ctl.replaceChildren();
      if (away && Fan.startLink) ctl.append(startItem());
      if (hi && hi.stop) ctl.append(stopItem(box));
      if (hi && hi.login != null) {   // an installed connector's own checkbox
        const lab = el("label", "fan-check"), c = el("input");
        c.type = "checkbox"; c.checked = hi.login;
        c.addEventListener("change", () => { Fan.setLogin(c.checked).catch(() => {}).then(() => drawStatus(box)); });
        lab.append(c, "Start at login");
        ctl.append(lab);
      }
    };
    setInterval(() => { const box = document.querySelector(".fan-about"); if (win.open && box && !box.closest("[hidden]")) drawStatus(box); }, 5000);
    const aboutRows = () => {
      const box = el("div", "fan-about"), parts = ABOUT();
      const here = !!Fan.lines && !connectorAway;   // the connector is on this page and answering
      const at = (node, row, col) => { node.style.setProperty("--r", row); node.style.setProperty("--c", col); return node; };
      // Where a status indicator goes. A plain one sits under its own name, so it doesn't repeat it.
      const slot = (name, plain) => { const s = el("div", "fan-slot"); s.dataset.st = name; if (plain) s.dataset.plain = "1"; return s; };
      const card = (k, row) => { const [toggle, what, needs] = parts[k], d = el("div", "fan-part" + (toggle.querySelector("input").checked ? "" : " off")); d.dataset.part = k; const cost = el("p"); cost.append(el("b", "fan-free", "Free"), needs); d.append(toggle, el("p", null, what), cost); return at(d, row, 1); };
      // A wire is lit while what it carries is flowing. Its arrow points at the page, or both ways.
      const wire = (label, lit, both, row, col) => { const w = el("div", "fan-wire" + (lit ? " lit" : "")), line = el("div"); line.append(el("i", "l")); if (both) line.append(el("i", "r")); w.append(el("span", null, label), line); return at(w, row, col); };
      const job = (text, status, row) => { const d = el("div", "fan-job"); d.append(el("p", null, text), slot(status)); return at(d, row, 3); };
      const service = (name, row, on, ...rest) => { const d = el("div", "fan-out" + (on ? " on" : "")); d.append(el("b", null, name), ...rest); return at(d, row, 5); };
      const con = el("div", "fan-con");
      con.append(el("b", null, "Fan connector"), slot("Connector", true));
      if (!Fan.lines && Fan.startLink) con.append(getOrStart());   // on the name's line where it fits, like the controls below
      con.append(el("div", "fan-con-ctl"));
      box.append(
        at(el("h3", null, "In your browser"), 1, 1), at(el("h3", null, "On this computer"), 1, 3), at(el("h3", null, "Outside"), 1, 5),
        at(el("div", "fan-frame" + (here ? "" : " away")), "3 / 7", 3),
        card("watch", "2 / span 2"), wire("scores, telecasts", true, false, 2, "2 / 5"), service("ESPN, YouTube TV", 2, true, slot("ESPN"), slot("Telecasts")),
        at(con, 3, 3),
        card("track", 4), Fan.lines ? wire("your bets", trackingOn && here && Fan.lines === Fan.store, true, 4, 2) : at(el("span"), 4, 2), job(Fan.lines ? "Keeps your records, with daily backups." : "Without it, your records stay in this browser.", "Records", 4),
        card("price", 5), wire("lines", here && pricesWanted, false, 5, 2), job("Pulls lines on a timer, over your own connection.", "Prices", 5), wire("prices", here && pricesWanted, false, 5, 4), service("Kalshi, Polymarket", 5, here && pricesWanted, el("small", null, "Public prices.")),
        card("bet", 6), wire("orders, fills", here && !!Fan.trader, true, 6, 2), job("Holds your key. Sends orders, hears fills, and runs triggers and responses, with or without this page.", "Fill feed", 6), wire("orders, fills", here && !!Fan.keyed, true, 6, 4), service("Kalshi", 6, here && !!Fan.keyed, slot("Kalshi", true), ...(Fan.account && !Fan.keyed ? [keysItem()] : []))
      );
      box.querySelector("[data-part=watch]").append(slot("Leagues"));
      drawStatus(box);
      return [box, el("p", "fan-yours", "Fan does not track, keep, or use your data in any way, other than local storage of the things you want, which is only used internally. There is nothing to sign or agree on: your data is yours.")];
    };
    const SETTINGS_TABS = [
      ["about", "Fan", aboutRows],
      ["leagues", "Leagues", leagueRows],
      ["telecasts", "Telecasts", telecastRows],
      ["sportsbooks", "Sportsbooks", () => [trackItem(), ...pricesItem(), ...(Fan.account ? [keysItem()] : [])]],
      ["look", "Look/feel", () => [badgeItem()]],
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
    };
    btn.addEventListener("click", () => { fill(); open(!win.open); });
    $("fanClose").addEventListener("click", () => open(false));
    setTimeout(() => { fill(); open(true); }, 0);
    fillSettings = () => { if (win.open) fill(); }; }   // what the connector offers arrives after the window opens
export { fillSettings, findConnector };
