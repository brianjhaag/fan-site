
import { espnState } from "./espn.js?v=mw5e7wzl";
import { NEWS_SOURCES } from "./news.js?v=mw5e7wzl";
import { Fan } from "./hosts.js?v=mw5e7wzl";
import { weirdFills, programBehind, newestFor, LAYOUTS, layoutPref, setLayoutPref, MODES, modePref, setModePref, gdBadge, switchWeek, weekNow, APP_VERSION, $, GAMES, allTickets, el, leagueNames, leaguesOn, scoutWanted, setLeagueOn, slateAt, linesAt, timeZoned, trackingOn } from "./base.js?v=mw5e7wzl";
import { gameCard } from "./cards.js?v=mw5e7wzl";
import { LEAGUE_DEFS, LEAGUES_LATER, LEAGUES_READY } from "./leagues.js?v=mw5e7wzl";
import { recordsItems, setScout, setTracking } from "./tracker.js?v=mw5e7wzl";
import { demoAway, setBet } from "./trade.js?v=mw5e7wzl";
import { sourcesOff, setSourceOff, sourceWhyNot } from "./screens.js?v=mw5e7wzl";
import { allNetworks, hdhr, liveSource, networkPick, sourceOf, telecastTab } from "./telecasts.js?v=mw5e7wzl";
  
  let drawSettings;
  
  const findConnector = () => {
    try { if (Fan.hostHello || !Fan.startLink || localStorage.getItem("fan.connector") !== "yes" || location.search.includes("stay")) return; } catch (e) { return; }
    Fan.connectorUp().then(() => { $("slateNote").textContent = "Found your connector. Moving to it…"; location.href = Fan.localFan; }, () => {});
  };
  { const list = $("settingsList"), btn = $("fanBtn"), win = $("settingsWindow");
    let firstClose = true;   
    const toNow = () => { if (firstClose) { firstClose = false; switchWeek(weekNow()); } };
    const open = on => { if (on && !win.open) win.showModal(); else if (!on && win.open) { win.close(); toNow(); } };
    
    const overflows = () => list.scrollHeight > list.clientHeight + 1 || list.scrollWidth > list.clientWidth + 1;
    const fitTab = () => {
      const p = list.querySelector(".settings-list:not([hidden])");
      if (!p || !win.open) return;
      p.style.zoom = "";
      if (p.querySelector(".settings-telecasts")) return;   
      for (let z = 1; z > .6 && overflows(); ) { z = Math.round((z - .05) * 100) / 100; p.style.zoom = String(z); }
    };
    
    
    let titleLeft = null;
    const placeTitle = () => {
      const box = win.querySelector(".settings-title"), mid = list.querySelector(".settings-list:not([hidden]) .settings-frame:not(.browser)"), M = mid && mid.getBoundingClientRect();
      if (!box || !win.open) return;
      if (M && M.width) titleLeft = M.left - box.parentElement.getBoundingClientRect().left;
      box.classList.toggle("centered", titleLeft === null);
      if (titleLeft === null) { box.style.left = ""; return; }
      const H = box.parentElement.getBoundingClientRect(), first = [...box.parentElement.querySelectorAll(":scope > button")].filter(b => b.getClientRects().length).map(b => b.getBoundingClientRect().left)[0];
      const room = (first === undefined ? H.right : first - 12) - H.left - box.offsetWidth;   
      box.style.left = Math.max(16, Math.min(titleLeft, room)) + "px";
    };
    
    const fitColumn = () => {
      const column = $("settingsTabs"); if (!win.open) return;
      column.style.removeProperty("--column-zoom");
      for (let z = 1; z > .6 && column.scrollHeight > column.clientHeight + 1; ) { z = Math.round((z - .05) * 100) / 100; column.style.setProperty("--column-zoom", String(z)); }
    };
    const fitList = () => { fitTab(); fitColumn(); placeTitle(); };
    
    
    
    const openLink = key => { const b = el("button", "settings-setup-open gear", "Set up"); b.type = "button"; b.dataset.open = key; b.addEventListener("click", () => { tab = key; fill(); }); return b; };
    const backButton = () => { const b = el("button", "settings-back", "\u2190 Back"); b.type = "button"; b.addEventListener("click", () => { tab = "about"; fill(); }); return b; };
    
    const listWatch = new ResizeObserver(() => fitList()), textWatch = new MutationObserver(() => fitList());   
    listWatch.observe(list); listWatch.observe($("settingsTabs")); textWatch.observe(list, { childList: true, characterData: true, subtree: true });   
    const headWatch = new MutationObserver(() => placeTitle());   
    headWatch.observe(win.querySelector(".settings-head"), { attributes: true, subtree: true, attributeFilter: ["hidden"] });
    if (document.fonts) document.fonts.addEventListener("loadingdone", () => fitList());
    let tab = "about";
    const leagueRows = () => Object.entries(leagueNames()).map(([k, h]) => {
      const row = el("label", "settings-lg" + (LEAGUES_LATER.includes(k) ? " later" : "")), c = el("input");
      c.type = "checkbox"; c.checked = leaguesOn.has(k); c.disabled = !LEAGUES_READY.includes(k) || (c.checked && leaguesOn.size === 1); c.setAttribute("aria-label", "Use " + h);
      c.addEventListener("change", () => { if (c.checked) { c.disabled = true; row.append(el("small", null, "getting its games from ESPN…")); } setLeagueOn(k, c.checked).then(fill, fill); });   
      row.append(c, h);
      if (LEAGUES_LATER.includes(k)) { const when = LEAGUE_DEFS[k].listedAs || "next year"; row.title = when[0].toUpperCase() + when.slice(1); row.append(el("small", null, when)); }
      return row;
    });
    
    
    const freeSources = () => {
      const box = el("div", "settings-sources"), espn = el("label", "settings-check"), c = el("input");
      c.type = "checkbox"; c.checked = true; c.disabled = true; espn.title = "Always on: Fan's schedule and scores start here"; espn.append(c, "ESPN");
      box.append(el("b", null, "Free sources"), el("small", null, "Scores"), espn, ...newsItems(), routeBox("prices"));
      return box;
    };
    
    const newsItems = () => [el("small", null, "News"), ...NEWS_SOURCES.map(s => {
      const labelEl = el("label", "settings-check"), c = el("input"), why = sourceWhyNot(s);
      c.type = "checkbox"; c.checked = !sourcesOff.has(s.key) && !why; c.disabled = !!why;
      c.addEventListener("change", () => setSourceOff(s.key, !c.checked));
      labelEl.append(c, s.name); labelEl.title = why || (s.connector ? "Through your connector" : "Read by this browser");   
      return labelEl;
    })];
    
    const knowConnector = () => { try { localStorage.setItem("fan.connector", "yes"); } catch (e) {} };
    const startItem = () => {
      const a = el("a", "settings-start", "Start connector"), box = el("div", "settings-starting");
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
    
    
    const siteRoot = new URL(/\/r\/[^/]+\/$/.test(location.pathname) ? "../../" : "./", location.href);
    const connectorRows = () => {
      const box = el("div", "settings-connector"), steps = el("ol"), step = (...parts) => { const li = el("li"); li.append(...parts); steps.append(li); };
      const windows = /Windows/.test(navigator.userAgent), mac = /Macintosh/.test(navigator.userAgent) && !navigator.maxTouchPoints, onChromebook = /CrOS/.test(navigator.userAgent), get = el("a", "settings-start", (mac ? "Download for Mac " : "Download for Windows ") + APP_VERSION);
      get.href = new URL(mac ? "fan-connector-mac.zip" : "fan-connector-setup.exe", siteRoot).href; get.setAttribute("download", mac ? `fan-connector-mac-${APP_VERSION}.zip` : `fan-connector-setup-${APP_VERSION}.exe`);   
      get.addEventListener("click", knowConnector);
      box.append(el("h3", null, "Why it's needed"), el("p", null, "Watch and Track work right here. Price and Bet need the Fan connector: a small program on your computer that pulls prices over your own connection and holds your own Kalshi key. Nothing about your bets or your key leaves your computer for this site."));
      
      if (onChromebook) {
        const line = "curl -fLo fan-connector-setup " + new URL("fan-connector-chromebook", siteRoot).href + " && chmod +x fan-connector-setup && ./fan-connector-setup";
        const code = el("code", "settings-command", line), copy = el("button", "settings-start", "Copy");
        copy.type = "button"; copy.addEventListener("click", () => { navigator.clipboard?.writeText(line).then(() => { copy.textContent = "Copied"; }, () => {}); knowConnector(); });
        step(el("b", null, "Turn on Linux. "), "Once: Settings, About ChromeOS, Developers, Linux development environment, Set up. It takes a few minutes.");
        step(el("b", null, "Run one line. "), "Open the Terminal app, paste this and press Enter. Linux doesn't ask about unsigned programs. ", copy, code);
        step(el("b", null, "You're moved. "), "It installs and opens Fan from the Chromebook, at localhost:5180. That's the copy with prices. Settings and telecast links set up on this site stay with this site, so set those up once there.");
        box.append(el("h3", null, "Getting it"), steps, el("h3", null, "After that"), el("p", null, "Always start from this page. When the connector is running, this page finds it and moves you to it. To keep it running, tick Start at login on the Application tab once you've moved: it then starts whenever Linux does, and opening the Terminal starts Linux. Otherwise it closes 30 minutes after your last Fan page, and running the same line again starts it. To update, press Update on the Application tab."));
        return [box];
      }
      if (!windows && !mac) { box.append(el("h3", null, "Getting it"), el("p", null, "The connector runs on a Windows or Mac computer, or a Chromebook.")); return [box]; }
      step(el("b", null, "Download it. "), get, el("small", null, "It's new and isn't signed yet, so your browser may call it suspicious. To keep it, open the browser's downloads list and choose Keep."));
      if (mac) {
        const set = el("a", "settings-start", "Open Settings");
        set.href = "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension";
        step(el("b", null, "Open it. "), "Open the zip and double-click Fan Connector Setup. Apple hasn't checked it yet, so the Mac refuses the first time. That's expected, and it unlocks the next step.");
        step(el("b", null, "Allow it. "), set, " In Privacy & Security, scroll down to Security and choose Open Anyway. Your browser asks before it opens Settings. It needs no admin password.");
      }
      else step(el("b", null, "Run the file. "), "It isn't signed yet, so your browser may ask whether to keep it, and Windows may warn you: choose More info, then Run anyway. It needs no admin rights.");
      step(el("b", null, "You're moved. "), "It installs and opens Fan from your own computer, at localhost:5180. That's the copy with prices and betting. Settings, telecast links and bets typed on this site stay with this site, so set those up once there.");
      box.append(el("h3", null, "Getting it"), steps, el("h3", null, "After that"), el("p", null, "Always start from this page. When the connector is running, this page finds it and moves you to it. When it isn't, press Start connector. The first time, your browser asks two things: whether to open Fan connector, where you can tick always allow, and whether this site may look for programs on your computer. Say yes to both."), startItem(), el("p", null, "The connector closes itself 30 minutes after your last Fan page closes, unless you tick Start at login, on the Application tab once you've moved. Reloading the page brings the newest version of it. To update the program, download and run the file again. Your records and key stay where they are."));
      return [box];
    };
    const firstHere = () => { try { return localStorage.getItem("fan.connector") !== "yes"; } catch (e) { return true; } };   
    const getOrStart = () => { const box = el("div", "settings-get"), get = el("button", null, "Get the connector"); get.type = "button"; get.addEventListener("click", () => { tab = "connector"; fill(); }); box.append(startItem(), get); if (firstHere()) box.append(el("small", "settings-first", "This looks like this browser's first visit. If the connector already runs on this computer, press Start to reach it.")); return box; };
    
    const keySwitch = () => {
      const d = el("div", "settings-key-switch gear");   
      [["prod", "Live"], ["demo", "Demo"]].forEach(([env, name]) => {
        const on = Fan.env === env, has = !!(Fan.keys && Fan.keys[env]), b = el("button", on ? "on" : null, name);
        b.type = "button";
        b.title = on ? `The ${name.toLowerCase()} key is in use, with its own ledger` : has ? `Switch to the ${name.toLowerCase()} key, its ledger and everything with it` : `No ${name.toLowerCase()} key saved: connect one`;
        b.addEventListener("click", async () => { if (on) return; if (!has) { open(false); Fan.account(); return; } try { await Fan.useKey(env); } catch (e) { b.title = e.message; b.classList.add("err"); } });
        d.append(b);
      });
      return d;
    };
    const keysItem = () => { const b = el("button", "gear", "Connect Kalshi"); b.type = "button"; b.addEventListener("click", () => { open(false); Fan.account(); }); return b; };
    
    const modePick = () => { const d = el("div", "settings-modes"); MODES.forEach(([k, name]) => { const b = el("button", null, name); b.type = "button"; b.setAttribute("aria-pressed", String(modePref === k)); b.addEventListener("click", () => { setModePref(k); fill(); }); d.append(b); }); return d; };
    
    const layoutPick = () => { const d = el("div", "settings-layouts"); LAYOUTS.filter(([k]) => k !== "auto").forEach(([k, name]) => { const b = el("button", null, name); b.type = "button"; b.setAttribute("aria-pressed", String(layoutPref === k)); b.title = layoutPref === k ? "Press again for Auto" : name; b.addEventListener("click", () => { setLayoutPref(layoutPref === k ? "auto" : k); fill(); }); d.append(b); }); return d; };
    
    
    const partCheck = (name, on, change) => { const labelEl = el("label", "settings-check"), c = el("input"); c.type = "checkbox"; c.checked = on; c.disabled = !change; if (change) labelEl.classList.add("gear"); if (change) c.addEventListener("change", () => { change(c.checked); fill(); }); labelEl.append(c, name); return labelEl; };
    const ABOUT = () => ({
      watch: [partCheck("Watch games", true), "See the slate, scores, previews, telecasts, and tape.", ", no install."],
      track: [partCheck("Track wagers", trackingOn, Fan.door && Fan.door.here ? null : on => setTracking(on)), "Enter bets and see scenario risk.", ", no install."],
      scout: [partCheck("Scout matchups", Fan.lines ? scoutWanted : false, Fan.lines && !connectorAway ? on => setScout(on) : null), "Your own private feeds: live lines and risk, from the markets.", ", requires the Connector."],   
      bet: [partCheck("Place bets", !!Fan.trader, Fan.setBet && Fan.keyed && !connectorAway ? on => setBet(on) : null), "Execute directly on prediction markets.", ", requires the Connector and API keys."]
    });
    
    let stopPressed = false;   
    let connectorAway = false;   
    const stopItem = box => {
      const wrap = el("div", "settings-starting"), b = el("button", "settings-start", "Stop");
      b.type = "button";
      b.addEventListener("click", () => {
        stopPressed = true; b.hidden = true;
        wrap.append(el("small", null, "Stopping…"));
        Fan.stopConnector().catch(() => { stopPressed = false; }).then(() => { wrap.remove(); drawStatus(box); });
      });
      wrap.append(b);
      return wrap;
    };
    
    
    const programName = v => v.split(".").slice(0, 2).join("."), newestProgram = os => programName(newestFor(os));
    
    const updateItem = (from, os) => {
      const wrap = el("div", "settings-starting"), b = el("button", "settings-start", "Update to " + newestProgram(os));
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
            Fan.hostHello().then(hi => { if (hi.version !== from) { clearInterval(t); location.replace("/" + location.search); } }, () => {});
          }, 2000);
        }, e => fail("Couldn't update: " + (e && e.message)));
      });
      wrap.append(b);
      return wrap;
    };
    
    const disagree = k => [[k.notSaved, "fill", "not saved"], [k.noTicket, "order", "with no ticket"], [k.twoTickets, "order", "with two tickets"], [k.differ, "ticket", "that differs"]].filter(([n]) => n > 0).map(([n, what, how]) => `${n} ${what}${n === 1 ? "" : "s"} ${how}`).join(", ");
    const statusRows = async () => {
      let hi = null, away = false;
      if (stopPressed) away = true;
      else if (Fan.hostHello) { try { hi = await Fan.hostHello(); } catch (e) { away = true; } }
      const espn = espnState(), feed = $("feedNote"), book = hi && hi.book, rec = hi && Fan.lines === Fan.store && hi.records, kal = hi && Fan.lines === Fan.store && hi.env === "prod" && hi.reconcile && !hi.reconcile.skipped ? hi.reconcile : null, kalOk = !!(kal && !kal.error && kal.bad === 0), linked = allNetworks().filter(n => liveSource(n) === "link").length, tuned = allNetworks().filter(n => liveSource(n) === "hdhr").length, usesHdhr = allNetworks().some(n => sourceOf(n) === "hdhr"), time = at => timeZoned(new Date(at));
      return { hi, away, rows: [
        ["Connector", away ? (stopPressed ? ["off", "Stopped"] : ["bad", "Not answering"]) : hi ? programBehind(hi.version, hi.os) ? ["warn", hi.update ? programName(hi.version) : `${hi.version ? programName(hi.version) + ", u" : "U"}pdate to ${newestProgram(hi.os)}`] : ["ok", "Running " + programName(hi.version), true] : ["off", "Not on this page"]],
        ["ESPN", espn.problem ? ["bad", espn.problem] : espn.at ? ["ok", "Last read " + time(espn.at), true] : ["ok", "Using this browser's saved copy"]],
        ["Records", !trackingOn ? ["off", "Track is off"] : !Fan.store ? ["bad", "Nowhere to keep them"] : away && Fan.lines === Fan.store ? ["off", "Kept by the connector, which isn't running"] : rec && !rec.ok ? ["bad", "Failed the integrity check: " + rec.error] : weirdFills.length ? ["warn", `Fills Fan can't place in a game: ${weirdFills.join(", ")}`] : kal && kal.error ? ["warn", "Couldn't check against Kalshi: " + kal.error] : kal && kal.bad ? ["warn", "Kalshi disagrees: " + disagree(kal)] : ["ok", `${allTickets.length} wagers, kept ${Fan.lines === Fan.store ? "by the connector" : "in this browser"}${rec && rec.backup ? ", checked, backed up today" : ""}${kalOk ? ", matching Kalshi at " + time(kal.at) : ""}`, !!(rec && rec.ok && rec.backup) && (hi.env !== "prod" || kalOk)]],
        ["Prices", !Fan.lines ? ["off", "Needs the connector"] : !scoutWanted ? ["off", "Scout is off"] : away ? ["off", "Not updating: the connector isn't running"] : hi && hi.refresh ? ["bad", hi.refresh] : !linesAt ? ["off", "No lines yet"] : Date.now() - linesAt > 3600000 ? ["warn", "Lines from " + time(linesAt) + ", over an hour old"] : book && book.note ? ["warn", book.note[0].toUpperCase() + book.note.slice(1)] : [book && book.live && book.games ? "live" : "ok", "Lines from " + time(slateAt) + (book && book.live && book.games ? `, live on ${book.games} game${book.games === 1 ? "" : "s"}` : ""), true]],
        ["Kalshi", !hi ? ["off", "Needs the connector"] : hi.keyError ? ["bad", hi.keyError] : !hi.env ? ["off", "No key connected"] : ["ok", `${feed.classList.contains("on") ? "Signed in" : "Connected"}${hi.env === "demo" ? " to demo, fake money" : ""}, orders ${hi.orders ? "on" : "off"}`, feed.classList.contains("on")]],   
        ["Fill feed", !hi ? ["off", "Needs the connector"] : !hi.env ? ["off", "Waits for a Kalshi key"] : !feed.textContent || feed.classList.contains("wait") ? ["wait", "Starting"] : feed.classList.contains("on") ? ["live", "Live"] : ["bad", feed.textContent]],
        ["Networks", usesHdhr && hdhr.ip && !Fan.playHdhr ? ["warn", "HDHomeRun needs a connector of 0.33 or later"] : usesHdhr && hdhr.ip && !Object.keys(hdhr.channels).length ? ["warn", "HDHomeRun: read its channels"] : linked + tuned ? ["ok", [linked && `${linked} by link`, tuned && `${tuned} on the HDHomeRun at ${hdhr.ip}`].filter(Boolean).join(", ")] : ["off", "No sources set"]]   
      ] };
    };
    const drawStatus = async box => {
      const { hi, away, rows } = await statusRows();
      const controls = document.querySelector(".settings-con-controls");   
      if (!controls || controls.querySelector(".settings-starting small")) return;   
      if (away !== connectorAway) { connectorAway = away; demoAway(away); fill(); return; }   
      rows.forEach(([name, [state, text, checked]]) => { const at = box.querySelector(`[data-st="${name}"]`), r = el("div", "settings-st " + state + (checked ? " checked" : "")); r.append(el("i")); if (!at.dataset.plain) r.append(el("b", null, name)); r.append(el("span", null, text)); at.replaceChildren(r); });
      showStates(box, new Map(rows.map(([name, [state, , checked]]) => [name, [state, checked]])));
      box.classList.toggle("healthy", !!hi && !away && rows.every(([name, [state]]) => state === "ok" || state === "live" || state === "off" || (name === "Connector" && programBehind(hi.version, hi.os))));
      win.classList.toggle("healthy", box.classList.contains("healthy"));   
      { const note = box.querySelector(".settings-spin-note"), [kind, text] = spinSay(hi, away, rows, box.classList.contains("healthy")); if (note) { note.className = "settings-spin-note" + (kind ? " " + kind : ""); note.textContent = text; } }   
      controls.replaceChildren();
      if (away && Fan.startLink) controls.append(startItem());
      if (hi && hi.update && programBehind(hi.version, hi.os)) controls.append(updateItem(hi.version, hi.os));   
      else if (hi && hi.stop) controls.append(stopItem(box));
      if (hi && hi.login != null) {   
        const labelEl = el("label", "settings-check gear"), c = el("input");
        c.type = "checkbox"; c.checked = hi.login;
        c.addEventListener("change", () => { Fan.setLogin(c.checked).catch(() => {}).then(() => drawStatus(box)); });
        labelEl.append(c, "Start at login");
        controls.append(labelEl);
      }
      releaseHeld(hi);
      drawRoutes(hi);
    };
    
    const VENUES = [["kalshi", "Kalshi"], ["polymarket", "Polymarket US"]];
    const routeBox = kind => { const d = el("div", "settings-routes"); d.dataset.kind = kind; return d; };
    const drawRoutes = hi => {
      const r = hi && hi.routes;
      document.querySelectorAll(".settings-routes").forEach(box => {
        if (box.dataset.busy) return;
        box.replaceChildren();
        if (!r || !Fan.setRoutes) return;
        const kind = box.dataset.kind, on = new Set(r[kind] || []);
        box.append(el("small", kind === "orders" ? "gear" : null, kind === "prices" ? (box.closest(".settings-sources") ? "Prices" : "Prices from") : "Orders to"));
        VENUES.forEach(([v, name]) => {
          const cannot = kind === "orders" && !(r.canOrder || []).includes(v), labelEl = el("label", "settings-check"), c = el("input");
          c.type = "checkbox"; c.checked = on.has(v) && !cannot; c.disabled = cannot || connectorAway;
          c.addEventListener("change", () => {
            if (c.checked) on.add(v); else on.delete(v);
            Fan.setRoutes({ [kind]: VENUES.map(x => x[0]).filter(x => on.has(x)) });
            box.dataset.busy = "1"; setTimeout(() => { delete box.dataset.busy; }, 2000);   
          });
          labelEl.append(c, name + (cannot ? ": needs a key" : ""));
          box.append(labelEl);
        });
      });
    };
    
    
    const showStates = (box, states) => {
      box.querySelectorAll("[data-st][data-plain]").forEach(s => { const t = s.parentElement && s.parentElement.querySelector(":scope > b"), [state, checked] = states.get(s.dataset.st) || ["off"]; if (!t) return; t.dataset.state = state; if (checked) t.dataset.checked = "1"; else delete t.dataset.checked; });
    };
    
    let released = false;
    const releaseHeld = hi => { if (released || !(hi && hi.page && hi.page.held) || !Fan.pageChoice) return; released = true; Fan.pageChoice("release").then(() => location.replace("/" + location.search), () => {}); };
    setInterval(() => { const box = document.querySelector(".settings-about"); if (win.open && box && !box.closest("[hidden]")) drawStatus(box); }, 5000);
    new MutationObserver(() => { const box = document.querySelector(".settings-about"); if (win.open && box && !box.closest("[hidden]")) drawStatus(box); }).observe($("feedNote"), { attributes: true, childList: true, characterData: true, subtree: true });   
    
    
    
    
    const SPIN = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M3 20C9 7 31 7 37 20C31 33 9 33 3 20Z" fill="#8a4b22" stroke="#4a2410" stroke-width="1.2"/><path d="M8.6 13.6C9.7 17.6 9.7 22.4 8.6 26.4M31.4 13.6C30.3 17.6 30.3 22.4 31.4 26.4" stroke="#f4efe6" stroke-width="2" fill="none"/><path d="M14 20H26M16 17.6V22.4M18.7 17.6V22.4M21.3 17.6V22.4M24 17.6V22.4" stroke="#f4efe6" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16.5" fill="#e0782c" stroke="#2a1608" stroke-width="1.3"/><path d="M20 3.5V36.5M3.5 20H36.5M8.4 8.4C14 14 14 26 8.4 31.6M31.6 8.4C26 14 26 26 31.6 31.6" stroke="#2a1608" stroke-width="1.3" fill="none"/></svg><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15.5" fill="#15171a" stroke="#4d535c" stroke-width="2"/><circle cx="20" cy="20" r="11" fill="none" stroke="#2e3239" stroke-width="1"/><path d="M13.5 16.5H26.5L24 23.5H16Z" fill="#c8102e"/><path d="M11 12.5A11 11 0 0 1 18 9.4" stroke="#8a9099" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15.5" fill="#f5f6f2" stroke="#a9aea6" stroke-width="1.2"/><g fill="#d3d7ce"><circle cx="14" cy="12.5" r="1.7"/><circle cx="20" cy="10.5" r="1.7"/><circle cx="26" cy="12.5" r="1.7"/><circle cx="10.5" cy="18" r="1.7"/><circle cx="16.5" cy="17" r="1.7"/><circle cx="23.5" cy="17" r="1.7"/><circle cx="29.5" cy="18" r="1.7"/><circle cx="13" cy="23.5" r="1.7"/><circle cx="20" cy="23" r="1.7"/><circle cx="27" cy="23.5" r="1.7"/><circle cx="16.5" cy="29" r="1.7"/><circle cx="23.5" cy="29" r="1.7"/></g><path d="M11.5 11A11.5 11.5 0 0 1 19 8.2" stroke="#ffffff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="#d4e04a" stroke="#97a62a" stroke-width="1.2"/><path d="M8.2 8.6C15.2 14.6 15.2 25.4 8.2 31.4M31.8 8.6C24.8 14.6 24.8 25.4 31.8 31.4" stroke="#f7f8ee" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="#f7f5ef" stroke="#b5b1a6" stroke-width="1.2"/><path d="M9 8.8C15.6 14.8 15.6 25.2 9 31.2M31 8.8C24.4 14.8 24.4 25.2 31 31.2" stroke="#c8102e" stroke-width="1.1" fill="none"/><path d="M9 8.8C15.6 14.8 15.6 25.2 9 31.2M31 8.8C24.4 14.8 24.4 25.2 31 31.2" stroke="#c8102e" stroke-width="3.6" stroke-dasharray=".9 2.1" fill="none"/></svg>`;   
    const conFrame = here => el("div", "settings-frame" + (here ? "" : " away"));
    const conSpin = () => { const g = el("div", "settings-spin"); g.innerHTML = SPIN; return g; };   
    
    
    
    const spinOne = () => { const d = el("div", "settings-spin-one"); d.innerHTML = SPIN; return d; };
    
    const spinNote = () => el("p", "settings-spin-note", "Checking…");
    
    
    const conTop = con => { const d = el("div", "settings-top"), stack = el("div"); stack.append(el("h3", "under", "On this computer"), con); d.append(stack); return d; };   
    
    
    const spinSay = (hi, away, rows, healthy) => {
      if (healthy) return ["ok", "☑ OK"];
      if (away) return Fan.startLink ? ["fix", stopPressed ? "Stopped: press Start connector." : "The connector isn't answering: press Start connector."] : ["", "The connector isn't answering."];
      if (!hi) return ["", "No connector: Watch and Track run in this browser."];
      const [name, [state, text]] = rows.find(([, [s]]) => s !== "ok" && s !== "live" && s !== "off") || ["", ["", ""]];
      const fix = { "HDHomeRun: read its channels": "press Read channels under Networks.", "HDHomeRun needs a connector of 0.33 or later": "update the connector." }[text] || (name === "Kalshi" && state === "bad" ? "check your key under Feeds." : null);
      if (fix) return ["fix", `${name}: ${fix}`];
      return ["", state === "wait" ? `${name}: ${text.toLowerCase()}…` : `${name}: ${text}`];
    };
    
    
    
    const CARD_NOTES = { "Game preview": "", "Box score": "", "Live telecast": "", "Tape": "", "Risk detail": "", "Moneyline": "", "Spread": "", "Chance to win": "", "Total": "" };
    
    
    const CARD_LINES = { nfl: ["+150", "+3.5", "-175", "62%", "45.5"], nba: ["+180", "+5.5", "-210", "66%", "224.5"], nhl: ["+135", "+1.5", "-155", "59%", "6.5"] };
    const MOCK = { watch: "Example game card", track: "Wager ticket", price: "Line", bet: "Place button" };
    const partMock = k => {
      const m = el("div", "settings-mock"), art = el("div", "settings-mock-art");
      
      
      const next = k === "watch" ? [...GAMES].filter(g => !g.final).sort((a, b) => new Date(a.t) - new Date(b.t))[0] || GAMES[0] : null;
      if (next) {
        m.classList.add("example-card"); const card = gameCard(next); art.append(card);
        card.querySelectorAll(".g-gut button").forEach(b => { b.disabled = false; });   
        const [awayMl, awaySp, homeMl, homePct, total] = CARD_LINES[next.league] || CARD_LINES.nfl, rows = card.querySelectorAll(".board tr"), set = (row, q, text) => { const c = row && row.querySelector(q); if (c) c.textContent = text; };
        set(rows[0], "td.ml", awayMl); set(rows[0], "td.sp", awaySp); set(rows[0], "td.tot", total); set(rows[1], "td.ml", homeMl); set(rows[1], "td.sp", homePct);
        art.addEventListener("click", e => {
          e.stopPropagation(); e.preventDefault();   
          const b = e.target.closest(".g-gut button, .board td.ml, .board td.sp, .board td.tot"), small = m.querySelector(":scope > small"); if (!b || !small) return;
          const name = b.matches("button") ? b.getAttribute("aria-label") : b.matches("td.ml") ? "Moneyline" : b.matches("td.tot") ? "Total" : b.textContent.endsWith("%") ? "Chance to win" : "Spread";
          const again = b.classList.contains("on");   
          card.querySelectorAll(".g-gut button, .board td").forEach(x => x.classList.toggle("on", !again && x === b));
          small.textContent = again ? MOCK.watch : `${name}: ${CARD_NOTES[name] || (b.matches("button") ? "what it does" : "what it shows") + ", coming soon."}`;
        }, true);
      }
      else if (k === "watch") art.append(gdBadge({ away: "Chicago Bears", home: "Seattle Seahawks" }, "home"));
      else if (k === "track") art.append(el("span", "settings-mock-book", "KAL"), el("span", null, "SEA -3.5"), el("span", "settings-mock-num", "$100"));
      else if (k === "price") art.append(el("span", null, "-3.5"), el("span", "settings-mock-num", "-110"), el("span", "settings-mock-num", "+150"));
      else art.append(el("span", "settings-mock-place", "Place"), el("span", "settings-mock-num", "100 @ 52¢"));
      m.dataset.mock = k; m.append(art, el("small", null, MOCK[k]));
      return m;
    };
    const aboutRows = () => {
      const box = el("div", "settings-about"), parts = ABOUT();
      const here = !!Fan.lines && !connectorAway;   
      const at = (node, row, col) => { node.style.setProperty("--r", row); node.style.setProperty("--c", col); return node; };
      
      const slot = (name, plain) => { const s = el("div", "settings-slot"); s.dataset.st = name; if (plain) s.dataset.plain = "1"; return s; };
      const card = (k, row) => { const [toggle, what, needs] = parts[k], d = el("div", "settings-part" + (toggle.querySelector("input").checked ? "" : " off")); d.dataset.part = k; const cost = el("span", "settings-cost"), head = el("div", "settings-part-head"); cost.append(el("b", "settings-free", "Free"), needs); head.append(toggle, cost); d.append(head, el("p", null, what), partMock(k)); return at(d, row, 1); };
      
      
      const wireOf = (label, lit, both) => { const w = el("div", "settings-wire" + (lit ? " lit" : "")), line = el("div"); if (both !== "out") line.append(el("i", "side-left")); if (both) line.append(el("i", "side-right")); w.append(el("span", null, label), line); return w; };
      const wire = (label, lit, both, row, col) => at(wireOf(label, lit, both), row, col);
      
      const wires = (row, col, ...list) => { const d = el("div", "settings-wires"); d.append(...list); return at(d, row, col); };
      const job = (text, status, row) => { const d = el("div", "settings-job" + (row === 3 ? " first" : "")); d.append(el("p", null, text), slot(status)); return at(d, row, 3); };
      const outBox = (name, on, ...rest) => { const d = el("div", "settings-out" + (on ? " on" : "")); d.append(el("b", null, name), ...rest); return d; };
      const service = (name, row, on, ...rest) => at(outBox(name, on, ...rest), row, 5);
      const stack = (...boxes) => { const s = el("div", "settings-outs"); s.append(...boxes); return s; };
      const con = el("div", "settings-con");
      con.append(slot("Connector", true));   
      if (!Fan.lines && Fan.startLink) con.append(getOrStart());   
      con.append(el("div", "settings-con-controls"));
      { const head = el("div", "settings-con-head"); head.append(spinOne(), spinNote()); con.prepend(head); }   
      box.append(
        at(el("h3", null, "In your browser"), 1, 1), at(el("h3", null, "Everywhere else"), 1, 5),
        at(conFrame(here), "3 / 6", 3),   
        at(el("div", "settings-frame browser"), "2 / 6", 1),   
        card("watch", 2), wire("scores, networks", true, false, 2, "2 / 5"), at(stack(outBox("ESPN", true, slot("ESPN", true)), outBox("Networks", true, ...networkPick(), slot("Networks", true), openLink("telecasts"))), 2, 5),
        at(conTop(con), 2, 3),   
        card("track", 3), Fan.lines ? wire("your bets", trackingOn && here && Fan.lines === Fan.store, true, 3, 2) : at(el("span"), 3, 2), job(Fan.lines ? "Keeps your records, with daily backups." : "Without it, your records stay in this browser.", "Records", 3),
        card("scout", 4), wire("lines", here && scoutWanted, false, 4, 2), job("Pulls lines on a timer, over your own connection.", "Prices", 4), wire("prices", here && scoutWanted, false, 4, 4), service("Kalshi, Polymarket US", 4, here && scoutWanted),   
        card("bet", 5), wires(5, 2, wireOf("orders, fills", here && !!Fan.trader, true), wireOf("code", here && !!Fan.trader, "out")), job("Holds your key. Sends orders, hears fills, and runs triggers and responses, with or without this page.", "Fill feed", 5), wire("orders, fills", here && !!Fan.keyed, true, 5, 4), service("Kalshi", 5, here && !!Fan.keyed, slot("Kalshi", true), openLink("sportsbooks"), routeBox("orders"), ...(Fan.useKey && Fan.keys && (Fan.keys.prod || Fan.keys.demo) ? [keySwitch()] : []), ...(Fan.account && !Fan.keyed ? [keysItem()] : []))
      );
      drawStatus(box);
      return [box, el("p", "settings-yours", "Fan does not track your activity. Fan sends your data nowhere. What you enter, and what your own accounts report, stays on this computer. Public information you look up is stored here too, for speed.")];
    };
    const SETTINGS_TABS = [
      ["about", "Application", aboutRows],
      ["leagues", "Leagues", leagueRows],
      ["telecasts", "Telecasts", () => telecastTab(fill)],
      ["sportsbooks", "Private sources", () => Fan.account ? [keysItem()] : [el("p", "settings-note", "Signing in to a market needs the Fan connector on this computer.")]],   
      ["connector", "Connector", connectorRows],
      ["records", "Records", () => recordsItems()]
    ];
    const fill = () => {
      const titleBox = win.querySelector(".settings-title");
      titleBox.querySelector(".settings-pickers")?.remove();
      { const pickers = el("div", "settings-pickers gear"); pickers.append(layoutPick(), modePick()); titleBox.append(pickers); }   
      const tabs = SETTINGS_TABS.filter(([k]) => k === "connector" ? !Fan.lines && Fan.startLink : k !== "records" || (trackingOn && Fan.store && Fan.store.dump));   
      if (!tabs.some(([k]) => k === tab) || tab === "leagues") tab = "about";
      
      
      
      const leagueBox = el("div", "settings-leagues"); leagueBox.dataset.tab = "leagues"; leagueBox.append(el("b", null, "Leagues"), ...leagueRows());
      $("settingsTabs").replaceChildren(leagueBox, freeSources(), ...tabs.filter(([k]) => k === "connector" || k === "records").map(([k, h]) => {
        const b = el("button", "settings-open" + (k === "connector" ? " gear" : ""), h);   
        b.type = "button"; b.dataset.tab = k; b.setAttribute("aria-pressed", String(k === tab));
        b.addEventListener("click", () => { tab = tab === k ? "about" : k; fill(); });
        return b;
      }));
      list.replaceChildren(...tabs.filter(([k]) => k !== "leagues").map(([k, , rows]) => { const p = el("div", "settings-list"); p.setAttribute("role", "tabpanel"); p.hidden = k !== tab; if (k !== "about") p.append(backButton()); p.append(...rows()); return p; }));
      fitList();
    };
    btn.addEventListener("click", () => { fill(); open(!win.open); });
    $("settingsTitle").prepend(spinOne());   
    $("settingsTitle").addEventListener("click", () => { if (tab !== "about") { tab = "about"; fill(); } });   
    $("settingsClose").addEventListener("click", () => open(false));
    win.addEventListener("close", toNow);   
    setTimeout(() => { fill(); open(true); }, 0);
    let remoteTab = false;   
    drawSettings = () => { if (Fan.door && Fan.door.here && !remoteTab) { remoteTab = true; tab = "telecasts"; } if (win.open) fill(); }; }   
export { drawSettings, findConnector };
