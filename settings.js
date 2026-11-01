// The settings window: Fan's button, its tabs and the status monitor.
import { espnState } from "./espn.js?v=mvy6ryxw";
import { Fan } from "./hosts.js?v=mvy6ryxw";
import { $, BADGE_STYLES, LEAGUES_READY, NETWORKS, TELECAST_LAYOUTS, allTickets, badgeStyle, el, leagueNames, leaguesOn, networkLinks, pricesWanted, setBadgeStyle, setLeagueOn, setNetworkLink, setTelecastPref, slateAt, telecastPref, timeZoned, trackingOn } from "./base.js?v=mvy6ryxw";
import { recordsItems, setPrices, setTracking } from "./tracker.js?v=mvy6ryxw";
import { setBet } from "./trade.js?v=mvy6ryxw";
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
      if (!Fan.screens) { box.append(el("p", "fan-note", "Choosing a monitor takes the desktop app. Here a telecast opens as a plain link.")); return box; }
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
      const windows = /Windows/.test(navigator.userAgent), mac = /Macintosh/.test(navigator.userAgent) && !navigator.maxTouchPoints, get = el("a", "fan-start", mac ? "Download for Mac" : "Download for Windows");
      get.href = mac ? "fan-connector-mac.zip" : "fan-connector-setup.exe"; get.setAttribute("download", ""); get.addEventListener("click", knowConnector);
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
      box.append(el("h3", null, "Getting it"), steps, el("h3", null, "After that"), el("p", null, "Always start from this page. When the connector is running, this page finds it and moves you to it. When it isn't, press Start connector. The first time, your browser asks two things: whether to open Fan connector, where you can tick always allow, and whether this site may look for programs on your computer. Say yes to both."), startItem(), el("p", null, "The connector closes itself 30 minutes after your last Fan page closes, unless you tick Start the connector when I log in, in the status list once you've moved. Its page stays current by itself. To update the program, download and run the file again. Your records and key stay where they are."));
      return [box];
    };
    const getOrStart = () => { const box = el("div", "fan-get"), get = el("button", null, "Get the connector"); get.type = "button"; get.addEventListener("click", () => { tab = "connector"; fill(); }); box.append(startItem(), get); return box; };
    const keysItem = () => { const b = el("button", null, "Connect Kalshi"); b.type = "button"; b.addEventListener("click", () => { open(false); Fan.account(); }); return b; };
    const badgeItem = () => { const b = el("button", null, "Badges: " + BADGE_STYLES[badgeStyle].label), names = Object.keys(BADGE_STYLES); b.type = "button"; b.addEventListener("click", () => { setBadgeStyle(names[(names.indexOf(badgeStyle) + 1) % names.length]); b.textContent = "Badges: " + BADGE_STYLES[badgeStyle].label; }); return b; };
    // What Fan is, opened on launch until the user ticks the box: the four layers, each with what it takes.
    // The Fan tab: left what's built in, right what the connector adds. A box's checkbox is its part's own switch, and greyed where the part can't be changed from here.
    const partCheck = (name, on, change) => { const lab = el("label", "fan-check"), c = el("input"); c.type = "checkbox"; c.checked = on; c.disabled = !change; if (change) c.addEventListener("change", () => { change(c.checked); fill(); }); lab.append(c, name); return lab; };
    const ABOUT = () => ({
      watch: [partCheck("Watch", true), "Every game this week on one page, with live scores, so you can see what's on and what's close. Open any game for its injuries, matchup edges and what each team is playing for. Then one click puts it on from the TV you already pay for. That's YouTube TV for now: paste your channel links under Telecasts.", "Free. No install, no sign-up."],
      track: [partCheck("Track", trackingOn, on => setTracking(on)), "Enter your bets from any sportsbook, and each game shows what you have riding on it while you watch. See the most you can win or lose on a game, and which scores make or break you. The Ledger shows how you've really done, book by book.", "Free. No install. Your bets stay on your computer, and only you see them."],
      price: [partCheck("Price", Fan.lines ? pricesWanted : false, Fan.lines ? on => setPrices(on) : null), "Live prices from Kalshi and Polymarket on every game, moving as the game does. Graphs and the Playbook's past results open up too. With Track on, see what your bets are worth right now, and whether you paid more or less than a fair price.", Fan.lines ? (pricesWanted ? "On, and that's all it takes: no key or account. Prices reach the game cards within a minute, and the status list says how old they are." : "Free. Uses the Fan connector, running on your computer. Tick the box and that's all it takes: no key or account.") : "Free. Uses the Fan connector, a small program on your computer that pulls prices over your own connection.", !Fan.lines && Fan.startLink ? getOrStart() : null],
      bet: [partCheck("Bet", !!Fan.trader, Fan.setBet && Fan.keyed ? on => setBet(on) : null), "Trade on Kalshi from the game card in one click, without leaving the game. Fills arrive live and record themselves, and Fan points out a hedge or a lock when your position has one. Off, Fan sends no orders, and fills you make anywhere else still arrive.", "Free. Uses the Fan connector and your own Kalshi account, with your own money.", Fan.account && !Fan.keyed ? keysItem() : null]
    });
    // The status monitor: what the page can see of each part right now, redrawn every 5 seconds while it shows.
    const statusRows = async () => {
      let hi = null, away = false;
      if (Fan.hostHello) { try { hi = await Fan.hostHello(); } catch (e) { away = true; } }
      const espn = espnState(), feed = $("feedNote"), nets = Object.values(networkLinks).filter(u => /^https:\/\//i.test(u)).length, time = at => timeZoned(new Date(at));
      return { hi, away, rows: [
        ["Connector", away ? ["bad", "Not answering"] : hi ? ["ok", "Running on this computer"] : ["off", "Not on this page"]],
        ["ESPN", espn.problem ? ["bad", espn.problem] : espn.at ? ["ok", "Last read " + time(espn.at)] : ["ok", "Using this browser's saved copy"]],
        ["Records", !trackingOn ? ["off", "Track is off"] : !Fan.store ? ["bad", "Nowhere to keep them"] : ["ok", `${allTickets.length} wagers, kept ${Fan.lines === Fan.store ? "by the connector" : "in this browser"}`]],
        ["Prices", !Fan.lines ? ["off", "Needs the connector"] : !pricesWanted ? ["off", "Price is off"] : hi && hi.refresh ? ["bad", hi.refresh] : !slateAt ? ["off", "No lines yet"] : Date.now() - slateAt > 3600000 ? ["warn", "Lines from " + time(slateAt) + ", over an hour old"] : ["ok", "Lines from " + time(slateAt)]],
        ["Kalshi", !hi ? ["off", "Needs the connector"] : !hi.env ? ["off", "No key connected"] : hi.orders ? ["ok", "Connected, orders on"] : ["ok", "Connected, orders off"]],
        ["Fill feed", !hi ? ["off", "Needs the connector"] : !hi.env ? ["off", "Waits for a Kalshi key"] : !feed.textContent || feed.classList.contains("wait") ? ["wait", "Starting"] : feed.classList.contains("on") ? ["ok", "Live"] : ["bad", feed.textContent]],
        ["Telecasts", nets ? ["ok", nets + (nets === 1 ? " network linked" : " networks linked")] : ["off", "No links pasted"]],
        ["Leagues", ["ok", [...leaguesOn].map(k => leagueNames()[k]).join(", ")]]
      ] };
    };
    const drawStatus = async box => {
      const { hi, away, rows } = await statusRows();
      if (box.querySelector(".fan-starting small")) return;   // a press of Start is under way: its note stays until the page reloads
      box.replaceChildren(el("h3", null, "Status"), ...rows.map(([name, [state, text]]) => { const r = el("div", "fan-st " + state); r.append(el("i"), el("b", null, name), el("span", null, text)); return r; }));
      if (away && Fan.startLink) box.append(startItem());
      if (hi && hi.login != null) {   // an installed connector's own checkbox
        const lab = el("label", "fan-check"), c = el("input");
        c.type = "checkbox"; c.checked = hi.login;
        c.addEventListener("change", () => { Fan.setLogin(c.checked).catch(() => {}).then(() => drawStatus(box)); });
        lab.append(c, "Start the connector when I log in");
        box.append(lab);
      }
    };
    setInterval(() => { const box = document.querySelector(".fan-status"); if (win.open && box && !box.closest("[hidden]")) drawStatus(box); }, 5000);
    const aboutRows = () => {
      const box = el("div", "fan-about"), parts = ABOUT();
      const cell = k => { const [toggle, what, needs, extra] = parts[k], d = el("div", "fan-part"); d.dataset.part = k; d.append(toggle, el("p", null, what), el("small", null, needs)); if (extra) d.append(extra); return d; };
      box.append(el("span"), el("h3", null, "Built in"), el("h3", null, "With the Fan connector"), el("b", null, "Watching games"), cell("watch"), cell("price"), el("b", null, "Tracking and betting"), cell("track"), cell("bet"));
      const status = el("div", "fan-status");
      drawStatus(status);
      return [box, status];
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
