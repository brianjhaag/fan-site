// The settings window: Fan's button, its tabs and the status indicators.
import { espnState } from "./espn.js?v=mw231hrw";
import { Fan } from "./hosts.js?v=mw231hrw";
import { weirdFills, programBehind, LAYOUTS, layoutPref, setLayoutPref, bdBadge, switchWeek, weekNow, APP_VERSION, $, allTickets, el, leagueNames, leaguesOn, pricesWanted, setLeagueOn, slateAt, linesAt, timeZoned, trackingOn } from "./base.js?v=mw231hrw";
import { BADGE_STYLES, badgeStyle, setBadgeStyle } from "./cards.js?v=mw231hrw";
import { LEAGUE_DEFS, LEAGUES_LATER, LEAGUES_READY } from "./leagues.js?v=mw231hrw";
import { recordsItems, setPrices, setTracking } from "./tracker.js?v=mw231hrw";
import { demoAway, setBet } from "./trade.js?v=mw231hrw";
import { allNetworks, hdhr, liveSource, networkPick, sourceOf, telecastTab } from "./telecasts.js?v=mw231hrw";
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
    // Fitted again when the window changes size (it follows the strips, layout.js fitBand), when its text changes (the statuses update in place) and when fonts arrive. Its own zoom is a style change, which neither watcher hears.
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
      const espn = espnState(), feed = $("feedNote"), book = hi && hi.book, rec = hi && Fan.lines === Fan.store && hi.records, kal = hi && Fan.lines === Fan.store && hi.env === "prod" && hi.reconcile && !hi.reconcile.skipped ? hi.reconcile : null, kalOk = !!(kal && !kal.error && kal.bad === 0), linked = allNetworks().filter(n => liveSource(n) === "link").length, tuned = allNetworks().filter(n => liveSource(n) === "hdhr").length, usesHdhr = allNetworks().some(n => sourceOf(n) === "hdhr"), time = at => timeZoned(new Date(at));
      return { hi, away, rows: [
        ["Connector", away ? (stopPressed ? ["off", "Stopped"] : ["bad", "Not answering"]) : hi ? programBehind(hi.version) ? ["warn", hi.update ? programName(hi.version) : `${hi.version ? programName(hi.version) + ", u" : "U"}pdate to ${newestProgram()}`] : ["ok", "Running " + programName(hi.version), true] : ["off", "Not on this page"]],
        ["ESPN", espn.problem ? ["bad", espn.problem] : espn.at ? ["ok", "Last read " + time(espn.at), true] : ["ok", "Using this browser's saved copy"]],
        ["Records", !trackingOn ? ["off", "Track is off"] : !Fan.store ? ["bad", "Nowhere to keep them"] : away && Fan.lines === Fan.store ? ["off", "Kept by the connector, which isn't running"] : rec && !rec.ok ? ["bad", "Failed the integrity check: " + rec.error] : weirdFills.length ? ["warn", `Fills Fan can't place in a game: ${weirdFills.join(", ")}`] : kal && kal.error ? ["warn", "Couldn't check against Kalshi: " + kal.error] : kal && kal.bad ? ["warn", "Kalshi disagrees: " + disagree(kal)] : ["ok", `${allTickets.length} wagers, kept ${Fan.lines === Fan.store ? "by the connector" : "in this browser"}${rec && rec.backup ? ", checked, backed up today" : ""}${kalOk ? ", matching Kalshi at " + time(kal.at) : ""}`, !!(rec && rec.ok && rec.backup) && (hi.env !== "prod" || kalOk)]],
        ["Prices", !Fan.lines ? ["off", "Needs the connector"] : !pricesWanted ? ["off", "Price is off"] : away ? ["off", "Not updating: the connector isn't running"] : hi && hi.refresh ? ["bad", hi.refresh] : !linesAt ? ["off", "No lines yet"] : Date.now() - linesAt > 3600000 ? ["warn", "Lines from " + time(linesAt) + ", over an hour old"] : book && book.note ? ["warn", book.note[0].toUpperCase() + book.note.slice(1)] : [book && book.live && book.games ? "live" : "ok", "Lines from " + time(slateAt) + (book && book.live && book.games ? `, live on ${book.games} game${book.games === 1 ? "" : "s"}` : ""), true]],
        ["Kalshi", !hi ? ["off", "Needs the connector"] : hi.keyError ? ["bad", hi.keyError] : !hi.env ? ["off", "No key connected"] : ["ok", `${feed.classList.contains("on") ? "Signed in" : "Connected"}${hi.env === "demo" ? " to demo, fake money" : ""}, orders ${hi.orders ? "on" : "off"}`, feed.classList.contains("on")]],   // the fill feed's connection is signed with the key, so Kalshi taking it proves the key
        ["Fill feed", !hi ? ["off", "Needs the connector"] : !hi.env ? ["off", "Waits for a Kalshi key"] : !feed.textContent || feed.classList.contains("wait") ? ["wait", "Starting"] : feed.classList.contains("on") ? ["live", "Live"] : ["bad", feed.textContent]],
        ["Networks", usesHdhr && hdhr.ip && !Fan.playHdhr ? ["warn", "HDHomeRun needs a connector of 0.33 or later"] : usesHdhr && hdhr.ip && !Object.keys(hdhr.channels).length ? ["warn", "HDHomeRun: read its channels"] : linked + tuned ? ["ok", [linked && `${linked} by link`, tuned && `${tuned} on the HDHomeRun at ${hdhr.ip}`].filter(Boolean).join(", ")] : ["off", "No sources set"]],
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
      ["telecasts", "Telecasts", () => telecastTab(fill)],
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
