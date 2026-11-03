// Bet tracking: the wager ticket, Saved tickets, the Ledger. It keeps a person's records in Fan.store, or in this browser when there is none. The settings window's checkbox hides it.
import { Fan } from "./hosts.js?v=mw00lj85";
import { nick, $, setAcc, FAN_CLASSES, GAMES, LG, allTickets, applySlate, betClass, clearPrices, bookAbbr, bookTag, centsOf, changed, curWeek, dayFmt, drawNow, drawStub, el, gameKey, gameLabel, helmImg, kalshiCalc, last, later, ledgerRows, legGame, legText, lineOf, lineOk, money, odds, profitOf, pts, riskGame, setRiskGame, setTickets, setPricesWanted, setTrackingOn, settleOf, showView, signedMoney, status, subView, switchWeek, teamLook, ticketLeagueOn, tickets, ticketsInView, timeFmt, timeZoned, marketWanted, pricesOn, trackingOn, tz, view, vigOf, weekNow } from "./base.js?v=mw00lj85";
import { TEAM, abbr } from "./leagues.js?v=mw00lj85";
import { setPlaybook } from "./panels.js?v=mw00lj85";
  Object.assign(later, { syncPrices, bookReport, fillMoneyline, fillSpread, fillTotal, showSaved, weekChanged });
  const BOOKS = ["DraftKings", "FanDuel", "BetMGM", "Caesars", "bet365", "BetRivers", "ESPN Bet", "Fanatics", "Hard Rock Bet", "Circa Sports", "Bally Bet", "BetMonarch", "ClutchBet", "SBK", "SI Sportsbook", "Sporttrade", "Kalshi", "Betsafe", "Other"];
  const gameSpread = (g, short) => { const n = short ? abbr : (x => x); return `${n(nick(g, "away"))} ${pts(g.line.sp)} @ ${n(nick(g, "home"))}`; };
  const vigText = v => v < -0.5 ? "−" + money(-v) : money(Math.max(0, v));
  // One-time copy of this browser's saved wagers into the database, then the database becomes the source.
  async function startRecords() {
    try {
      const store = Fan.store;
      if (!store) return;
      if (!await store.get("meta", "migration")) {
        const has = (await store.list("wagers")).length > 0;
        if (!has && tickets.length) {
          const base = Date.now() - tickets.length * 1000;
          for (let i = 0; i < tickets.length; i++) await store.set("wagers", "L" + String(i + 1).padStart(4, "0"), { ...tickets[i], createdAt: base + i, source: "localStorage" });
        }
        if (has || tickets.length) await store.set("meta", "migration", { done: true, at: Date.now(), migrated: has ? 0 : tickets.length });
      }
      inStore = true;
      try { store.watchDoc("meta", "balances", v => { if (v && v.books) { setBalances(v); changed("balances"); } }); } catch (e) {}
      store.watch("wagers", rows => {
        setTickets(rows.map(r => ({ id: r.id, ...r.data })).sort((p, q) => (p.createdAt > q.createdAt ? 1 : p.createdAt < q.createdAt ? -1 : 0)));
        ticketsLoaded();
      }, () => { inStore = false; });
      await startBackups();
    } catch (e) { inStore = false; }
  }

  // Backups of a browser's records (only a store with dump has this: elsewhere the host keeps its own). Export and Import work everywhere; automatic save needs a browser that can write to a file.
  const BACKUP_DAYS = 7;   // Claude's default: the Fan button shows a dot after this long with no backup
  let backupAt = null, autoFile = null, autoOn = false, autoTimer = null, autoStop = null, backupDrawn = null;
  const backupStore = () => (Fan.store && Fan.store.dump ? Fan.store : null);
  const backupText = async () => JSON.stringify(await backupStore().dump());
  async function backedUp() { backupAt = Date.now(); await backupStore().keep("backupAt", backupAt); backupDue(); if (backupDrawn) backupDrawn(); }
  async function backupDue() {
    const s = backupStore(), btn = $("fanBtn");
    if (!s) return;
    const days = backupAt ? Math.floor((Date.now() - backupAt) / 864e5) : null, hasAny = (await s.dump()).records.length > 0;
    const due = trackingOn && hasAny && !autoOn && (days == null || days >= BACKUP_DAYS);
    btn.classList.toggle("due", due);
    btn.setAttribute("aria-label", due ? "Fan, settings. Your records need a backup" : "Fan, settings");
    btn.title = due ? "Your records need a backup: settings, Records" : "";
  }
  const writeAuto = async () => { const w = await autoFile.createWritable(); await w.write(await backupText()); await w.close(); await backedUp(); };
  function startAuto() {
    autoOn = true;
    if (autoStop) autoStop();
    autoStop = backupStore().onChange(() => { clearTimeout(autoTimer); autoTimer = setTimeout(() => writeAuto().catch(() => { autoOn = false; backupDue(); if (backupDrawn) backupDrawn(); }), 2000); });
  }
  async function startBackups() {
    const s = backupStore();
    if (!s) return;
    backupAt = await s.kept("backupAt");
    autoFile = await s.kept("autoFile");
    if (autoFile && await autoFile.queryPermission({ mode: "readwrite" }) === "granted") startAuto();
    s.onChange(() => backupDue());
    backupDue();
  }
  function recordsItems() {
    const box = el("div", "fan-records"), s = backupStore();
    const button = (text, act) => { const b = el("button", null, text); b.type = "button"; b.addEventListener("click", act); return b; };
    const note = el("p", "fan-note", ""), said = el("p", "fan-note", ""), input = el("input");
    input.type = "file"; input.accept = ".json,application/json"; input.hidden = true;
    input.addEventListener("change", async () => {
      const f = input.files[0];
      input.value = "";
      if (!f) return;
      try { const n = await s.restore(JSON.parse(await f.text())); said.textContent = "Imported " + n + (n === 1 ? " record from " : " records from ") + f.name + "."; }
      catch (e) { said.textContent = "Couldn't import " + f.name + ": it isn't a Fan export. Nothing changed."; }
    });
    const exportNow = async () => {
      const a = el("a"), day = new Date(), two = n => String(n).padStart(2, "0");
      a.href = URL.createObjectURL(new Blob([await backupText()], { type: "application/json" }));
      a.download = "fan-records-" + day.getFullYear() + "-" + two(day.getMonth() + 1) + "-" + two(day.getDate()) + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      await backedUp();
    };
    const pickFile = async () => {
      try {
        autoFile = await window.showSaveFilePicker({ suggestedName: "fan-records.json", types: [{ description: "Fan records", accept: { "application/json": [".json"] } }] });
        await s.keep("autoFile", autoFile);
        startAuto(); await writeAuto(); draw();
      } catch (e) { if (e && e.name !== "AbortError") said.textContent = "Couldn't save to that file."; }
    };
    const reconnect = async () => { if (await autoFile.requestPermission({ mode: "readwrite" }) === "granted") { startAuto(); await writeAuto(); draw(); } };
    const stopAuto = async () => { if (autoStop) autoStop(); autoStop = null; clearTimeout(autoTimer); autoOn = false; autoFile = null; await s.keep("autoFile", null); backupDue(); draw(); };
    const draw = () => {
      note.textContent = "Your records are kept only in this browser. " + (backupAt ? "Last backup: " + new Date(backupAt).toLocaleString() + "." : "No backup yet.");
      const auto = !window.showSaveFilePicker ? [] : autoOn ? [el("p", "fan-note", "Saving automatically to " + autoFile.name + "."), button("Stop saving automatically", stopAuto)] : autoFile ? [button("Keep saving to " + autoFile.name, reconnect), button("Stop saving automatically", stopAuto)] : [button("Save automatically to a file", pickFile)];
      box.replaceChildren(note, button("Export", exportNow), button("Import", () => input.click()), input, ...auto, said);
    };
    backupDrawn = () => { if (box.isConnected) draw(); };
    draw();
    return [box];
  }

  // Game dropdown grouped by day, in the viewer's time
  const gameSel = $("game"), gameBtn = $("gameBtn"), gameList = $("gameList");
  function buildGameSelect() {
  gameSel.replaceChildren();
  gameSel.add(new Option("Select a game", ""));
  const groups = new Map();
  const optWidth = 8 + 3 + Math.max(...GAMES.map(g => gameSpread(g).length));
  GAMES.forEach((g, i) => {
    const day = dayFmt.format(new Date(g.t));
    if (!groups.has(day)) { const og = document.createElement("optgroup"); og.label = day; groups.set(day, og); gameSel.append(og); }
    // Time on the left, matchup pushed to the right with non-breaking spaces (the select uses a monospace font).
    const left = g.final ? "Final" : timeFmt.format(new Date(g.t));
    const gap = Math.max(2, optWidth - left.length - gameSpread(g).length);
    groups.get(day).append(new Option(left + " ".repeat(gap) + gameSpread(g), i));
  });
  }
  buildGameSelect();

  const bookSel = $("book");
  bookSel.add(new Option("Select a sportsbook", ""));
  BOOKS.forEach(b => bookSel.add(new Option(b, b)));

  try { setTickets(JSON.parse(localStorage.getItem("fan.tickets") || "[]")); } catch (e) {}
  const persist = () => { try { localStorage.setItem("fan.tickets", JSON.stringify(allTickets)); } catch (e) {} };

  // Wagers live in Fan.store when there is one.
  // Without one, the browser's local storage above is the store.
  let inStore = false;   // true once the store holds the wagers. The `fills` collection has one doc per Execute order (the order's own reply, kept as the record)
  let ticketsLoaded, ticketsReady = new Promise(res => { ticketsLoaded = res; });
  function addTicket(t) {
    t.week = curWeek;
    if (inStore) { Fan.store.add("wagers", t).catch(() => { setTickets([...allTickets, t]); persist(); }); return; }
    setTickets([...allTickets, t]); persist();
  }
  // Saved tickets grid: each wager parsed into columns, sortable by clicking a header.
  // Each ticket is two rows: at = [grid row, grid column].
  const stampFmt = new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
  const COLS = [
    { k: "game", h: "Game", at: [1, 1], v: t => t.game.split(" at ").map(abbr).join(" @ ") },
    { k: "side", h: "Pick", at: [1, 2], v: t => t.parlay ? `${t.legs.length} legs` : abbr(t.side || "") },
    { k: "line", h: "Line", at: [1, 3], num: true, ctr: true, edit: t => t.type !== "Moneyline" && !t.parlay, n: t => t.type === "Moneyline" ? null : t.line, v: t => t.type === "Moneyline" || t.line == null ? "—" : t.type === "Spread" ? pts(t.line) : String(t.line) },
    { k: "price", h: "Price", at: [1, 4], num: true, edit: () => true, n: t => ticketOdds(t), v: t => { const o = ticketOdds(t); return t.kalshi ? t.kalshi.cents + "¢" : o == null ? "—" : odds(o); } },
    { k: "amount", h: "Wager", at: [1, 5], num: true, edit: () => true, n: t => t.amount, v: t => (t.bonus ? "B" : "") + money(t.amount) },
    { k: "win", h: "To win", at: [1, 6], num: true, n: t => { const o = ticketOdds(t); return o == null ? null : profitOf(t.amount, o); }, v: t => { const o = ticketOdds(t); return o == null ? "—" : money(profitOf(t.amount, o)); } },
    { k: "time", h: "Saved", at: [2, 1], n: t => t.createdAt, v: t => t.createdAt ? stampFmt.format(new Date(t.createdAt)).replace(",", "") : "—" },
    { k: "book", h: "Book", at: [2, 2], edit: t => !t.kalshi, v: t => bookAbbr(t.book) },
    { k: "type", h: "Type", at: [2, 3], ctr: true, v: t => ({ Moneyline: "ML", Spread: "SPD", Total: "TOT", Parlay: "PAR" })[t.type] || t.type || "" },
    { k: "vig", h: "Vig", at: [2, 6], num: true, n: t => vigOf(t), v: t => (pricesOn() || t.kalshi ? vigText(vigOf(t)) : "—") }
  ];
  const ticketOdds = t => t.type === "Moneyline" ? t.line : t.odds != null ? t.odds : null;
  let sortCol = null, sortDir = 1;

  function renderHeads() {
    const heads = $("heads");
    heads.replaceChildren();
    COLS.forEach(c => {
      const b = el("button", "gh" + (c.ctr ? " ctr" : c.num ? " num" : ""), c.h + (sortCol === c.k ? (sortDir > 0 ? " ▲" : " ▼") : ""));
      b.type = "button"; b.style.gridArea = `${c.at[0]} / ${c.at[1]}`;
      b.addEventListener("click", () => {
        if (sortCol === c.k) sortDir = -sortDir; else { sortCol = c.k; sortDir = 1; }
        renderHeads(); renderTickets();
      });
      heads.append(b);
    });
  }

  // Delete a ticket: the first click on its X arms it (red); a second click within 3 seconds removes it. There is no undo.
  function deleteTicket(t) {
    if (inStore && t.id) { Fan.store.del("wagers", t.id).catch(() => editMsg("Couldn't delete that ticket.")); return; }
    setTickets(allTickets.filter(x => x !== t)); persist();
  }

  // In-place editing: click a cell in the grid, type, press Enter. Everything that depends on it is recalculated and saved.
  // Type "B200" in the Wager cell to mark a bonus wager. Kalshi wagers are re-priced from the cents and dollars typed.
  const pickText = t => t.parlay ? `${t.legs.length} legs`
    : t.kalshi ? `${t.side}${t.type === "Moneyline" ? "" : " " + lineShown(t.type, t.line)} ${t.kalshi.cents}¢`
    : `${t.side} ${lineShown(t.type, t.line)}`;
  const kalshiSpent = t => t.amount;
  function updateTicket(t, patch) {
    Object.assign(t, patch);
    if (inStore && t.id) Fan.store.update("wagers", t.id, patch).catch(() => {}); else persist();
  }
  function kalshiPatch(t, cents, spent) {
    const kc = kalshiCalc(cents, spent);
    if (kc.C < 1) return null;
    const kalshi = { cents, contracts: kc.C, fee: kc.fee };
    return { amount: kc.total, kalshi, ...(t.type === "Moneyline" ? { line: kc.american } : { odds: kc.american }), pick: pickText({ ...t, kalshi }) };
  }
  function applyEdit(t, k, text) {      // returns an error message, or null once saved
    text = text.trim();
    if (k === "book") {
      if (!BOOKS.includes(text) || text === "Kalshi" || t.kalshi) return "Pick one of the listed sportsbooks.";
      if (text !== t.book) updateTicket(t, { book: text });
      return null;
    }
    if (k === "amount") {
      const m = /^(b)?\s*\$?\s*([\d,]*\.?\d+)$/i.exec(text), amt = m ? parseFloat(m[2].replace(/,/g, "")) : NaN;
      if (!(amt > 0)) return "Enter an amount like 200, or B200 for a bonus wager.";
      const bonus = !!m[1];
      if (t.kalshi) { const p = kalshiPatch(t, t.kalshi.cents, amt); if (!p) return "That is less than one contract at this price."; updateTicket(t, { ...p, bonus }); }
      else updateTicket(t, { amount: amt, bonus });
      return null;
    }
    const n = parseLine(text);
    if (k === "line") {
      if (!lineOk(t.type, n)) return t.type === "Total" ? "Enter the total, like 43.5." : "Enter the points, like +3.5 or -2.5.";
      updateTicket(t, { line: n, pick: pickText({ ...t, line: n }) });
      return null;
    }
    if (k === "price") {
      if (t.kalshi) {
        if (!centsOk(n)) return "Enter the price in cents, 1 to 99.";
        const p = kalshiPatch(t, n, kalshiSpent(t));
        if (!p) return "That is less than one contract at this price.";
        updateTicket(t, p); return null;
      }
      if (!lineOk("Moneyline", n)) return "Enter odds like -110 or +150 (100 or more either way).";
      const patch = t.type === "Moneyline" ? { line: n } : { odds: n };
      updateTicket(t, { ...patch, pick: pickText({ ...t, ...patch }) });
      return null;
    }
    return "That cell can't be edited.";
  }
  let editMsgTimer;
  function editMsg(text) {
    const m = $("edMsg");
    m.textContent = text; m.hidden = !text;
    clearTimeout(editMsgTimer);
    if (text) editMsgTimer = setTimeout(() => { m.hidden = true; }, 4000);
  }
  function startEdit(t, col, cell) {
    const raw = {
      book: t.book,
      line: t.line == null ? "" : lineText(t.type, t.line),
      price: t.kalshi ? String(t.kalshi.cents) : ticketOdds(t) == null ? "" : lineText("Moneyline", ticketOdds(t)),
      amount: (t.bonus ? "B" : "") + (t.kalshi ? kalshiSpent(t).toFixed(2) : String(t.amount))
    }[col.k];
    let field;
    if (col.k === "book") {
      field = el("select", "ced");
      BOOKS.filter(b => b !== "Kalshi").forEach(b => field.add(new Option(b, b)));
      field.value = raw;
    } else { field = el("input", "ced"); field.type = "text"; field.value = raw; field.autocomplete = "off"; }
    field.setAttribute("aria-label", col.h);
    cell.replaceChildren(field);
    field.focus();
    if (field.select) field.select();
    let done = false;
    const finish = save => {
      if (done) return; done = true;
      const err = save ? applyEdit(t, col.k, field.value) : null;
      editMsg(err || "");
      changed("tickets");
    };
    field.addEventListener("keydown", e => { if (e.key === "Enter") finish(true); else if (e.key === "Escape") finish(false); });
    field.addEventListener(col.k === "book" ? "change" : "blur", () => finish(true));
    if (col.k === "book") field.addEventListener("blur", () => finish(false));
  }

  function renderTickets() {
    const shown = ticketsInView();
    const ul = $("list");
    ul.replaceChildren();
    const q = $("search").value.trim().toLowerCase();
    let rows = shown.map(t => ({ t, cells: COLS.map(c => c.v(t)) })).filter(r => (r.cells.join(" ") + " " + r.t.book + " " + r.t.game + " " + (r.t.side || "") + " " + (r.t.parlay ? r.t.legs.map(legText).join(" ") : "")).toLowerCase().includes(q));
    if (sortCol) {
      const i = COLS.findIndex(c => c.k === sortCol), c = COLS[i];
      const key = r => c.n ? c.n(r.t) : r.cells[i].toLowerCase();
      rows.sort((a, b) => { const x = key(a), y = key(b); return (x == null) - (y == null) || (x < y ? -1 : x > y ? 1 : 0) * sortDir; });
    } else rows.reverse();
    $("count").textContent = shown.length ? `(${q ? `${rows.length}/${shown.length}` : shown.length})` : "";
    if (!rows.length) { ul.append(el("li", "empty", shown.length ? "No matches." : "Tickets you save appear here.")); return; }
    rows.forEach(r => {
      const li = el("li", r.t.fillId ? "row from-fill" : "row");   // from-fill: the ticket came from a Kalshi fill, not typed in by hand
      if (r.t.parlay) li.title = r.t.legs.map(legText).join("\n");
      r.cells.forEach((v, i) => {
        const c = COLS[i], editable = c.edit && c.edit(r.t);
        const cell = el("span", [c.ctr ? "ctr" : c.num ? "num" : "", editable ? "ed" : "", c.at[0] === 2 ? "r2" : ""].filter(Boolean).join(" ") || null, v);
        cell.style.gridArea = `${c.at[0]} / ${c.at[1]}`;
        if (editable) { cell.title = "Click to edit"; cell.addEventListener("click", e => { e.stopPropagation(); startEdit(r.t, c, cell); }); }
        li.append(cell);
      });
      const del = el("button", "del", "✕");
      del.style.gridArea = "1 / 7";
      del.type = "button"; del.title = "Delete ticket"; del.setAttribute("aria-label", "Delete ticket");
      let armTimer;
      del.addEventListener("click", e => {
        e.stopPropagation();
        if (!del.classList.contains("arm")) {
          del.classList.add("arm"); del.title = "Click again to delete";
          armTimer = setTimeout(() => { del.classList.remove("arm"); del.title = "Delete ticket"; }, 3000);
        } else { clearTimeout(armTimer); deleteTicket(r.t); }
      });
      li.append(del);
      // A parlay's legs are listed under its row, one per line, so the figures stay on a single line.
      if (r.t.parlay) { const legs = el("div", "legs"); r.t.legs.forEach(l => legs.append(el("div", null, legText(l)))); li.append(legs); }
      ul.append(li);
    });
  }
  renderHeads();
  $("search").addEventListener("input", renderTickets);
  // The saved tickets card has two tabs, the ticket list and the by-sportsbook summary.
  function showSaved(tab) {
    document.querySelector(".saved").classList.toggle("show-sum", tab === "summary");
    $("tabTickets").setAttribute("aria-selected", String(tab === "tickets")); $("tabSummary").setAttribute("aria-selected", String(tab === "summary"));
  }
  $("tabTickets").addEventListener("click", () => showSaved("tickets"));
  $("tabSummary").addEventListener("click", () => showSaved("summary"));


  // Summary tab of the saved tickets card: this week's bets by sportsbook. Wagered amounts are shown for every bet; returns and net cash only
  // count bets that are decided (every leg final, or a parlay already lost on a leg), so the report fills in as games finish.
  function bookReport(tickets) {
    const books = new Map();
    tickets.forEach(t => {
      const b = books.get(t.book) || { n: 0, cash: 0, bonus: 0, open: 0, won: 0, lost: 0, push: 0, ret: 0, net: 0, done: 0, vig: 0 };
      books.set(t.book, b);
      b.n++; if (t.bonus) b.bonus += t.amount; else b.cash += t.amount;
      b.vig += vigOf(t);   // every bet, decided or not: the vig is paid when the bet is placed (a rebate counts negative)
      const st = settleOf(t);
      if (st.state === "pending") b.open++; else { b.done++; b[st.state]++; b.ret += st.payout; b.net += st.net; }
    });
    const pop = el("div", "sum-report");
    if (!books.size) { pop.append(el("div", "dim", "No wagers yet.")); return pop; }
    const rows = [...books].sort((a, c) => c[1].cash + c[1].bonus - a[1].cash - a[1].bonus);
    const all = rows.reduce((t, [, b]) => { Object.keys(b).forEach(k => { t[k] = (t[k] || 0) + b[k]; }); return t; }, {});
    const cls = v => Math.round(v) > 0 ? "pos" : Math.round(v) < 0 ? "neg" : "dim";
    const table = el("table"), head = el("tr");
    ["Book", "Bets", "Wagered", "Vig", "Open", "Won–Lost", "Returned", "Net cash"].forEach(x => head.append(el("th", null, x)));
    table.append(head);
    const line = (name, b, foot) => {
      const tr = el("tr", foot ? "foot" : null), name$ = el("td");
      if (foot) name$.textContent = name; else name$.append(bookTag(name));
      const done = b.done > 0;
      tr.append(name$, el("td", null, String(b.n)), el("td", null, b.cash || !b.bonus ? money(b.cash) + (b.bonus ? " + B" + money(b.bonus) : "") : "B" + money(b.bonus)),
        el("td", pricesOn() && b.vig < -0.5 ? "pos" : null, pricesOn() ? vigText(b.vig) : "—"),
        el("td", b.open ? null : "dim", b.open ? String(b.open) : "—"),
        el("td", done ? null : "dim", done ? `${b.won}–${b.lost}${b.push ? "–" + b.push : ""}` : "—"),
        el("td", done ? null : "dim", done ? money(b.ret) : "—"),
        el("td", done ? cls(b.net) : "dim", done ? signedMoney(b.net) : "—"));
      table.append(tr);
    };
    line("All books", all, true);   // the totals lead the table, in place of a description row
    rows.forEach(([name, b]) => line(name, b, false));
    pop.append(table);
    return pop;
  }

  // Balances: what each sportsbook shows as available cash (saved in the shared db as meta/balances, these are the defaults).
  let balances = { asOf: "", books: {} };
  const setBalances = b => { balances = b; };
  // Ledger: one table by sportsbook over every week's wagers. A staked bet is no longer in the book's balance, so the account total is the
  // balance plus the cash staked on open bets; open bonus stakes are shown beside it but are not cash and stay out of the total.
  // Net cash counts settled wagers only (a lost bonus wager costs nothing).
  // A sheet of ledger paper: a title, a line under it, then the table.
  function ledgerCard(title, sub, table) {
    const card = el("div", "lcard");
    card.append(el("h2", null, title), sub, table);
    return card;
  }
  function renderLedger() {
    if (drawStub("ledger")) return;
    if (subView.ledger === "check") { later.renderKalshiCheck(); return; }
    const box = $("ledger");
    box.replaceChildren();
    const empty = () => ({ n: 0, cash: 0, bonus: 0, won: 0, lost: 0, push: 0, pend: 0, openCash: 0, openBonus: 0, net: 0 });
    const counted = allTickets.filter(ticketLeagueOn);   // an off league's wagers stay in the records and out of here
    const books = ledgerRows(counted, t => t.book);
    Object.entries(balances.books).forEach(([n, v]) => { if (!books.has(n)) books.set(n, empty()); books.get(n).bal = v; });
    const total = b => (b.bal || 0) + b.openCash;
    const rows = [...books].sort((a, c) => total(c[1]) - total(a[1]));
    const all = { ...empty(), bal: 0 };
    rows.forEach(([, b]) => Object.keys(all).forEach(k => { all[k] += b[k] || 0; }));
    if (!rows.length) { box.append(el("p", "dim", "No wagers saved yet.")); return; }
    const byClass = ledgerRows(counted, betClass);
    const cls = v => Math.round(v) < 0 ? "neg" : Math.round(v) > 0 ? null : "dim";
    const cent = v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const netText = v => { const r = Math.round(v); return r < 0 ? `(${money(-r)})` : r > 0 ? money(r) + " " : "— "; };   // a loss in parentheses, with the figures still lined up
    const table = el("table", "lsheet"), thead = el("thead"), hr = el("tr");
    ["Sportsbook", "Balance", "Open bets", "Open cash stakes", "Open bonus stakes", "Account total", "Wagers", "Cash wagered", "Bonus wagered", "Won–Lost", "Net cash"].forEach(h => hr.append(el("th", null, h)));
    if (balances.asOf) hr.children[1].title = `Balances as of ${balances.asOf}`;
    hr.children[5].title = "Balance + cash staked on open bets (bonus stakes are not cash)";
    thead.append(hr);
    const body = el("tbody");
    const section = title => { const tr = el("tr", "lsec"), td = el("td", null, title); td.colSpan = hr.children.length; tr.append(td); body.append(tr); };
    // Balances aren't split by bet type, so those rows leave the Balance and Account total columns empty (hasBal false).
    const line = (name, b, hasBal, rowClass) => {
      const tr = el("tr", rowClass), first = el("td");
      first.append(name);
      tr.append(first, el("td", !hasBal || b.bal == null ? "dim" : null, !hasBal ? "" : b.bal == null ? "—" : cent(b.bal)), el("td", b.pend ? null : "dim", b.pend ? String(b.pend) : "—"), el("td", b.openCash ? null : "dim", b.openCash ? money(b.openCash) : "—"), el("td", b.openBonus ? null : "dim", b.openBonus ? "B" + money(b.openBonus) : "—"),
        el("td", "acct", hasBal ? cent(total(b)) : ""), el("td", null, String(b.n)), el("td", null, money(b.cash)), el("td", null, b.bonus ? "B" + money(b.bonus) : "—"),
        el("td", null, `${b.won}–${b.lost}${b.push ? "–" + b.push : ""}`), el("td", cls(b.net), netText(b.net)));
      body.append(tr);
    };
    section("By sportsbook");
    rows.forEach(([name, b]) => line(bookTag(name), b, true));
    line("All books", all, true, "ltotal");
    section("By bet type");
    FAN_CLASSES.filter(c => byClass.has(c)).forEach(c => line(c, byClass.get(c), false));
    line("All bets", all, false, "ltotal");
    table.append(thead, body);
    box.append(ledgerCard("Ledger", el("small", null, `All leagues, all weeks.${balances.asOf ? ` Balances as of ${balances.asOf}.` : ""}`), table));
  }

  // Bet detail: pick a side, then enter the line you actually got (prefilled with the example line).
  const parseLine = s => parseFloat(String(s).replace("−", "-").replace(/\s/g, ""));
  const sideLine = (g, type, i) => type === "Moneyline" ? g.line.ml[i] : type === "Spread" ? (i === 0 ? g.line.sp : -g.line.sp) : g.line.tot;
  const lineText = (type, n) => type === "Total" || n <= 0 ? String(n) : "+" + n;
  const lineShown = (type, n) => type === "Moneyline" ? odds(n) : type === "Spread" ? pts(n) : String(n);

  // Kalshi is an exchange: a contract costs 1-99 cents and pays $1 if it wins, so its price is the market's win chance in percent.
  // Moneyline is "team wins", spread is "team wins by over X", total is "over X points"; the other side buys the opposite contract.
  // Wagers are stored at the equivalent American odds, so the rest of the accounting works unchanged.
  const isKalshi = () => bookSel.value === "Kalshi";
  const centsOk = c => Number.isFinite(c) && c >= 1 && c <= 99;

  function renderPick() {
    $("type").hidden = gameSel.value === "";   // no bet type until a game is picked
    syncGame();
    const box = $("pick");
    box.replaceChildren();
    box.classList.remove("invalid"); $("pickErr").hidden = true;
    const type = document.querySelector("input[name=btype]:checked");
    if (!type || gameSel.value === "") {
      if (gameSel.value !== "") box.append(el("div", "hint", "Select a bet type to see the sides."));
      return;
    }
    const g = GAMES[gameSel.value];
    const names = type.value === "Total" ? ["Over", "Under"] : [nick(g, "away"), nick(g, "home")];
    // A parlay has one price for the whole ticket, so its legs carry no price (and a moneyline leg has nothing to enter).
    const parlay = mode === "parlay", kal = isKalshi() && !parlay;
    const price = parlay || (type.value === "Moneyline" && !kal) ? null : el("input");
    if (price) {
      price.id = "price"; price.type = "text"; price.autocomplete = "off"; price.inputMode = "decimal";
      price.placeholder = kal ? "62" : "-110"; price.setAttribute("aria-label", kal ? "Price in cents" : "Price");
    }
    const line = (parlay || kal) && type.value === "Moneyline" ? null : el("input");
    if (line) {
      line.id = "line"; line.type = "text"; line.autocomplete = "off"; line.inputMode = "decimal";
      line.placeholder = { Moneyline: "+120", Spread: "-3.5", Total: "42.5" }[type.value];
      line.setAttribute("aria-label", type.value === "Moneyline" ? "Odds" : type.value === "Spread" ? "Points" : "Total");
    }
    const seg = el("div", "seg");
    names.forEach((s, i) => {
      const lab = el("label"), inp = el("input"), sp = el("span", null, s);
      inp.type = "radio"; inp.name = "pick"; inp.value = s;
      inp.addEventListener("change", () => {
        if (g.noLine) return;   // no market here: the placeholder isn't a price, so the user types their own
        if (line) line.value = lineText(type.value, sideLine(g, type.value, i));
        if (price) {
          const am = type.value === "Moneyline" ? g.line.ml[i] : type.value === "Spread" ? g.line.spj[i] : g.line.toj[i];
          price.value = kal ? String(centsOf(am)) : lineText("Moneyline", am);
        }
      });
      // Moneyline and spread pick a team, so each side takes that team's color.
      if (type.value !== "Total") {
        lab.className = "team";
        const k = teamLook(g, i === 0 ? "away" : "home");
        lab.style.setProperty("--tb", k.bg); lab.style.setProperty("--tf", k.fg); lab.style.setProperty("--to", k.outline || "transparent");
      }
      lab.append(inp, sp); seg.append(lab);
    });
    box.append(seg);
    if (line && type.value !== "Moneyline") {
      // Up and down arrows move the points by 0.5. On Kalshi the price follows to that strike's ask when the ladder has one.
      const w = el("span", "tick");
      const step = d => {
        const i = [...seg.querySelectorAll("input")].findIndex(r => r.checked), cur = parseLine(line.value), base = Number.isFinite(cur) ? cur : i >= 0 ? sideLine(g, type.value, i) : type.value === "Total" ? lineOf(g).tot : 0, n = base + d;
        line.value = lineText(type.value, n);
        if (kal && price && i >= 0 && g.lad && g.lad.v === 2 && status(g)[1] !== "live") {
          const fav = (i === 0) === (n < 0) ? "away" : "home";
          const ask = type.value === "Total" ? ((g.lad.tot || []).find(r => r[0] === n) || [])[i + 1] : ((g.lad.sp || []).find(r => r[0] === fav && r[1] === Math.abs(n)) || [])[n < 0 ? 2 : 3];
          if (ask > 0) price.value = String(Math.round(ask * 100));
        }
        line.dispatchEvent(new Event("input", { bubbles: true }));
      };
      [["up", "▲", .5, "Up 0.5"], ["dn", "▼", -.5, "Down 0.5"]].forEach(([c, t, d, a]) => {
        const b = el("button", c, t); b.type = "button"; b.tabIndex = -1; b.setAttribute("aria-label", a);
        b.addEventListener("click", e => { e.preventDefault(); step(d); });
        w.append(b);
      });
      w.prepend(line); box.append(w);
    } else if (line) box.append(line);
    // Straight spread and total wagers also carry a price (the juice); a moneyline's line is its price.
    if (price) {
      if (kal) { const w = el("span", "cent"); w.append(price, el("b", null, "¢")); box.append(w); } else box.append(price);
    }
    box.classList.toggle("has-price", !!price);
    box.classList.toggle("no-line", !line);
  }
  // Fills the wager ticket from a game card's moneyline: Kalshi, $100, that side at Kalshi's own ask (live price once under way).
  function fillMoneyline(g, n) {
    const lad = g.lad && g.lad.v === 2 && g.lad.ml && g.lad.ml[n ? "home" : "away"], ask = status(g)[1] !== "live" && lad && lad.k > 0 ? lad.k : null;
    fillTicket(g, "Moneyline", n, null, ask ? Math.round(ask * 100) : centsOf(lineOf(g).ml[n]));
  }
  // The same from the card's spread: the underdog at the number shown, at Kalshi's ask for that strike when the ladder has it.
  function fillSpread(g, n) {
    const L = lineOf(g), sp = n ? -L.sp : L.sp, fav = n ? "away" : "home";
    const row = g.lad && g.lad.v === 2 && status(g)[1] !== "live" && (g.lad.sp || []).find(r => r[0] === fav && r[1] === Math.abs(sp) && r[3] > 0);
    fillTicket(g, "Spread", n, sp, row ? Math.round(row[3] * 100) : centsOf(L.spj[n]));
  }
  // The same from the card's total: n = 0 over, 1 under, at Kalshi's ask for that strike when the ladder has it.
  function fillTotal(g, n) {
    const L = lineOf(g), row = g.lad && g.lad.v === 2 && status(g)[1] !== "live" && (g.lad.tot || []).find(r => r[0] === L.tot && r[n + 1] > 0);
    fillTicket(g, "Total", n, L.tot, row ? Math.round(row[n + 1] * 100) : centsOf(L.toj[n]));
  }
  function fillTicket(g, type, n, line, cents) {
    setAcc("ticket");   // the narrow layout's accordion shows the ticket being filled
    if (riskGame) setRiskGame(null);   // the risk detail covers the ticket while a game is selected
    if (mode !== "straight") setMode("straight");
    bookSel.value = "Kalshi"; bookSel.dispatchEvent(new Event("input", { bubbles: true }));
    gameSel.value = String(GAMES.indexOf(g)); gameSel.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector(`input[name=btype][value="${type}"]`).checked = true; renderPick();
    document.querySelectorAll("input[name=pick]")[n].checked = true;
    if (line != null) $("line").value = lineText(type, line);
    $("price").value = String(cents);
    $("amount").value = "100";
    ["pick", "type", "game", "book", "amount"].forEach(k => { $(k).classList.remove("invalid"); $(k + "Err").hidden = true; });
    placeNote("");
    renderLegs();
  }
  // The amount selects its content on focus, so typing replaces it. A mouse press would drop the selection, so the press only focuses.
  $("amount").addEventListener("focus", e => e.target.select());
  $("amount").addEventListener("mousedown", e => { if (document.activeElement !== e.target) { e.preventDefault(); e.target.focus(); } });
  // The chosen game sticks after saving and across reloads.
  try {
    const i = GAMES.findIndex(g => gameKey(g) === localStorage.getItem("fan.game"));
    if (i >= 0) gameSel.value = String(i);
  } catch (e) {}
  gameSel.addEventListener("input", () => {
    try { localStorage.setItem("fan.game", gameSel.value === "" ? "" : gameKey(GAMES[gameSel.value])); } catch (e) {}
  });
  gameSel.addEventListener("input", renderPick);
  $("type").addEventListener("input", renderPick);

  const placeNote = (text, cls) => { const m = $("placeMsg"); m.textContent = text; m.className = cls || ""; };
  // Parlay: the legs added so far; the form holds the next leg. A leg is one pick (game, type, side, line, price).
  // Combined odds multiply the legs' decimal odds. Books may quote a different price (boosts, same-game parlays), so it can be edited.
  let pendingLegs = [];
  let parlayEdited = false;
  // The leg being typed: null if none started, false if incomplete, else the leg.
  function readLeg() {
    const type = document.querySelector("input[name=btype]:checked");
    if (!type) return null;
    const side = document.querySelector("input[name=pick]:checked"), line = $("line"), price = $("price"), parlay = mode === "parlay", kal = isKalshi() && !parlay;
    if (gameSel.value === "" || !side) return false;
    if (line && !lineOk(type.value, parseLine(line.value))) return false;
    if (!line && !((parlay || kal) && type.value === "Moneyline")) return false;
    if (!parlay) {
      if (kal) { if (!(price && centsOk(parseLine(price.value)))) return false; }
      else if (type.value !== "Moneyline" && !(price && lineOk("Moneyline", parseLine(price.value)))) return false;
    }
    const g = GAMES[gameSel.value];
    return { key: gameKey(g), game: gameLabel(g), kickoff: g.t, type: type.value, side: side.value, ...(line ? { line: parseLine(line.value) } : {}), ...(!parlay && !kal && type.value !== "Moneyline" ? { odds: parseLine(price.value) } : {}), ...(kal ? { cents: parseLine(price.value) } : {}) };
  }
  // The wager card is modal: a straight ticket takes one leg; a parlay collects two or more.
  let mode = "straight";
  const allLegs = () => { const c = readLeg(); return mode === "parlay" ? (c ? pendingLegs.concat(c) : pendingLegs.slice()) : (c ? [c] : []); };
  function setMode(m) {
    mode = m;
    $("tabStraight").setAttribute("aria-selected", String(m === "straight"));
    $("tabParlay").setAttribute("aria-selected", String(m === "parlay"));
    $("addLeg").hidden = m !== "parlay";
    gameSel.setAttribute("aria-label", (m === "parlay" ? "Game for this leg" : "Game") + ` · ${LG().daily ? LG().code : LG().code + " Week " + curWeek} · local time`);
    ["pick", "type", "parlayRow"].forEach(k => { $(k).classList.remove("invalid"); $(k + "Err").hidden = true; });
    renderPick(); renderLegs();
  }
  $("tabStraight").addEventListener("click", () => setMode("straight"));
  $("tabParlay").addEventListener("click", () => setMode("parlay"));

  function renderLegs() {
    const box = $("legs");
    box.replaceChildren();
    pendingLegs.forEach((l, i) => {
      const row = el("div", "leg"), x = el("button", "leg-x", "×");
      x.type = "button"; x.setAttribute("aria-label", "Remove leg " + (i + 1));
      x.addEventListener("click", () => { pendingLegs.splice(i, 1); parlayEdited = false; renderLegs(); });
      row.append(el("span", null, `${i + 1}. ${legText(l)}`), x);
      box.append(row);
    });
    box.hidden = mode !== "parlay" || !pendingLegs.length;
    const legs = allLegs(), odd = parseLine($("parlayOdds").value), amt = parseFloat($("amount").value), kal = isKalshi();
    $("parlayRow").hidden = mode !== "parlay";
    $("parlayLbl").textContent = kal ? "Parlay price (¢)" : "Parlay odds";
    $("parlayOdds").placeholder = kal ? "10" : "+650";
    const legCount = `${legs.length} ${legs.length === 1 ? "leg" : "legs"}`;
    if (kal) {
      const kc = centsOk(odd) && amt > 0 ? kalshiCalc(odd, amt) : null;
      $("parlayCalc").textContent = legCount + (kc && kc.C >= 1 ? ` · ≈ ${Math.round(kc.C)} contracts · to win ${money(kc.win)}` : "");
    } else {
      $("parlayCalc").textContent = legCount + (lineOk("Moneyline", odd) && amt > 0 ? ` · to win ${money(profitOf(amt, odd))}` : "");
    }
    // Kalshi: turn the dollars typed (fee included) into contracts.
    const cents = mode === "parlay" ? odd : parseLine($("price")?.value), help = $("amountHelp");
    if (kal && amt > 0 && centsOk(cents)) {
      const kc = kalshiCalc(cents, amt);
      help.textContent = kc.C >= 1 ? `≈ ${Math.round(kc.C)} contracts at ${cents}¢ · pays ${money(kc.C)} · to win ${money(kc.win)} · include any fee in the amount` : `Not enough for one contract at ${cents}¢.`;
    } else help.textContent = "";
    later.syncPlace();
  }

  function check() {
    const a = parseFloat($("amount").value), type = document.querySelector("input[name=btype]:checked");
    const cur = readLeg(), more = mode === "parlay" && pendingLegs.length > 0, total = (mode === "parlay" ? pendingLegs.length : 0) + (cur ? 1 : 0);
    const kal = isKalshi(), po = parseLine($("parlayOdds").value), cents = mode === "parlay" ? po : parseLine($("price")?.value);
    const oneContract = !kal || !centsOk(cents) || kalshiCalc(cents, a).C >= 1;
    $("parlayRowErr").textContent = total < 2 ? "A parlay needs at least two legs." : kal ? "Enter the parlay price in cents, 1 to 99." : "Enter the parlay odds from your book, 100 or more in either direction.";
    $("amountErr").textContent = a > 0 ? "Not enough for one contract at that price." : "Enter an amount greater than zero.";
    const rules = [
      ["pick", cur ? true : cur === null],
      ["game", gameSel.value !== "" || (cur === null && more)],
      ["book", bookSel.value !== ""],
      ["amount", a > 0 && oneContract],
      ["type", !!type || more],
      ["parlayRow", mode !== "parlay" || (total >= 2 && (kal ? centsOk(po) : lineOk("Moneyline", po)))]
    ];
    let ok = total > 0 || !!type;
    rules.forEach(([k, good]) => {
      $(k).classList.toggle("invalid", !good);
      $(k + "Err").hidden = good;
      if (!good) ok = false;
    });
    return ok;
  }

  $("addLeg").addEventListener("click", () => {
    const cur = readLeg();
    if (!cur) {
      const type = document.querySelector("input[name=btype]:checked");
      [["game", gameSel.value !== ""], ["type", !!type], ["pick", cur !== false && !!type]].forEach(([k, good]) => {
        $(k).classList.toggle("invalid", !good); $(k + "Err").hidden = good;
      });
      return;
    }
    pendingLegs.push(cur);
    parlayEdited = false;
    gameSel.value = "";   // each parlay leg picks its own game
    document.querySelectorAll("input[name=btype]").forEach(r => r.checked = false);
    renderPick(); renderLegs();
  });

  ["game", "book", "amount", "type", "pick", "parlayRow"].forEach(id => $(id).addEventListener("input", () => {
    if ($(id).classList.contains("invalid")) check();
  }));
  // Choosing or leaving Kalshi changes how the price is entered (cents instead of American odds).
  let wasKalshi = false;
  // The game picker: a button and a list over the whole wager card; it drives the hidden select and fires its input event, so the form works as before.
  const helmetImg = n => TEAM[n] && TEAM[n].art ? helmImg(n, "hl") : null;
  function gameFace(g) {   // helmet, abbreviation and the visitor's spread @ helmet and abbreviation
    const f = el("span", "gface"); f.style.display = "inline-flex"; f.style.alignItems = "center"; f.style.gap = "7px";
    [helmetImg(nick(g, "away")), el("span", null, abbr(nick(g, "away"))), el("span", "sp", g.noLine ? "" : pts(g.line.sp).replace(/\d+(\.\d+)?/, v => Number(v).toFixed(1))), el("span", "at", "@"), helmetImg(nick(g, "home")), el("span", null, abbr(nick(g, "home")))].forEach(x => x && f.append(x));
    return f;
  }
  function syncGame() {
    gameBtn.replaceChildren(gameSel.value === "" ? el("span", "ph", "Select game") : gameFace(GAMES[gameSel.value]));
    [...gameList.querySelectorAll(".g")].forEach(li => li.setAttribute("aria-selected", String(li.dataset.i === gameSel.value)));
  }
  const closeGames = () => { gameList.hidden = true; gameBtn.setAttribute("aria-expanded", "false"); };
  function pickGame(i) { gameSel.value = String(i); gameSel.dispatchEvent(new Event("input", { bubbles: true })); closeGames(); gameBtn.focus(); }
  function openGames() {
    gameList.replaceChildren();
    const head = el("li", "gh", "Select game"); head.addEventListener("click", closeGames); gameList.append(head);
    let day = "";
    GAMES.forEach((g, i) => {
      const d = dayFmt.format(new Date(g.t));
      if (d !== day) { day = d; gameList.append(el("li", "day", d)); }
      const li = el("li", "g"); li.setAttribute("role", "option"); li.dataset.i = String(i);
      li.append(gameFace(g), el("span", "when", g.final ? "Final" : timeFmt.format(new Date(g.t))));
      li.addEventListener("click", () => pickGame(i));
      gameList.append(li);
    });
    gameList.hidden = false; gameBtn.setAttribute("aria-expanded", "true");
    syncGame(); gameList.scrollTop = 0;
    gameList.querySelector('.g[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }
  gameBtn.addEventListener("click", () => { if (gameList.hidden) openGames(); else closeGames(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !gameList.hidden) { closeGames(); gameBtn.focus(); } });
  document.addEventListener("click", e => { if (!gameList.hidden && e.target !== gameSel && !e.composedPath().includes($("gameBox"))) closeGames(); });   // composedPath, not contains(target): opening rebuilds the button's children, so a click on its text arrives from a node that is already detached   // a click on the list's non-row space is forwarded by the wrapping label to the hidden select: that is not an outside click
  // The custom sportsbook list drives the hidden select and fires its input event, so the rest of the form works as before.
  const bookBtn = $("bookBtn"), bookList = $("bookList");
  const syncBook = () => {
    bookBtn.replaceChildren(bookSel.value ? bookTag(bookSel.value) : el("span", "ph", "Select sportsbook"));
    [...bookList.children].filter(li => li.dataset.v).forEach(li => li.setAttribute("aria-selected", String(li.dataset.v === bookSel.value)));
  };
  const closeBooks = () => { bookList.hidden = true; bookBtn.setAttribute("aria-expanded", "false"); };
  const pickBook = v => { bookSel.value = v; bookSel.dispatchEvent(new Event("input", { bubbles: true })); closeBooks(); bookBtn.focus(); };
  { const head = el("li", "gh", "Select sportsbook"); head.addEventListener("click", closeBooks); bookList.append(head); }
  BOOKS.forEach(b => { const li = el("li"); li.setAttribute("role", "option"); li.dataset.v = b; li.append(bookTag(b)); li.addEventListener("click", () => pickBook(b)); bookList.append(li); });
  bookBtn.addEventListener("click", () => {
    const open = bookList.hidden;
    bookList.hidden = !open; bookBtn.setAttribute("aria-expanded", String(open));
    if (open) bookList.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  });
  bookBtn.dataset.keys = "arrows";   // it handles its own keys, past the page's key layer (base.js)
  bookBtn.addEventListener("keydown", e => {
    if (e.key === "Escape") closeBooks();
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const i = BOOKS.indexOf(bookSel.value) + (e.key === "ArrowDown" ? 1 : -1);
      if (i >= 0 && i < BOOKS.length) pickBook(BOOKS[i]);
    }
  });
  document.addEventListener("click", e => { if (e.target !== bookSel && !e.composedPath().includes($("bookBox"))) closeBooks(); });   // same label forwarding as the game picker
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !bookList.hidden) { closeBooks(); bookBtn.focus(); } });
  syncBook();
  bookSel.addEventListener("input", () => {
    syncBook();
    const k = isKalshi();
    if (k !== wasKalshi) { wasKalshi = k; renderPick(); }
    renderLegs();
  });
  ["input", "change"].forEach(ev => $("ticket").addEventListener(ev, e => {
    placeNote("");
    renderLegs();
  }));

  $("ticket").addEventListener("submit", e => {
    e.preventDefault();
    if (!check()) return;
    const legs = allLegs();
    const base = { book: bookSel.value, amount: parseFloat($("amount").value), bonus: $("bonus").checked, createdAt: Date.now() };
    const whenOf = l => { const g = legGame(l); return dayFmt.format(new Date(g.t)) + ", " + timeZoned(new Date(g.t)); };
    const kal = isKalshi();
    // A Kalshi order is stored at its total cost (contracts plus fee) and the equivalent American odds, plus the cents price it was bought at.
    const kalshiRec = (cents, spent) => { const kc = kalshiCalc(cents, spent); return { kc, rec: { amount: kc.total, kalshi: { cents, contracts: kc.C, fee: kc.fee } } }; };
    if (legs.length === 1) {
      const l = legs[0], k = l.cents != null ? kalshiRec(l.cents, base.amount) : null;
      addTicket({
        key: l.key, game: l.game, kickoff: l.kickoff, ...base, type: l.type, side: l.side,
        ...(l.line != null ? { line: l.line } : {}), ...(l.odds != null ? { odds: l.odds } : {}),
        ...(k ? { ...k.rec, ...(l.type === "Moneyline" ? { line: k.kc.american } : { odds: k.kc.american }) } : {}),
        pick: k ? `${l.side}${l.type === "Moneyline" ? "" : " " + lineShown(l.type, l.line)} ${l.cents}¢` : l.side + " " + lineShown(l.type, l.line),
        when: whenOf(l)
      });
    } else {
      const first = legs.reduce((m, l) => new Date(l.kickoff) < new Date(m.kickoff) ? l : m), po = parseLine($("parlayOdds").value);
      const k = kal ? kalshiRec(po, base.amount) : null;
      addTicket({ ...base, parlay: true, key: "parlay", type: "Parlay", game: `${legs.length}-leg parlay`, kickoff: first.kickoff, legs, odds: k ? k.kc.american : po, ...(k ? k.rec : {}), pick: `${legs.length} legs`, when: whenOf(first) });
    }
    placeNote("");
    clearTicket();
  });
  // The half-built wager belongs to the old week's games.
  function weekChanged() {
    pendingLegs = []; parlayEdited = false; $("parlayOdds").value = "";
    document.querySelectorAll("input[name=btype]").forEach(r => r.checked = false);
    buildGameSelect(); gameSel.value = "";
    setMode(mode);
  }
  function clearTicket() {
    pendingLegs = []; parlayEdited = false; $("parlayOdds").value = "";
    bookSel.value = ""; syncBook(); wasKalshi = false; $("amount").value = ""; $("bonus").checked = false; document.querySelectorAll("input[name=btype]").forEach(r => r.checked = false); renderPick();
    ["game", "book", "amount", "type", "pick", "parlayRow"].forEach(k => { $(k).classList.remove("invalid"); $(k + "Err").hidden = true; });
    renderLegs(); changed("tickets");
  }
  // Prices follow Bet tracking and their own checkbox, and need a source. Off, the page holds no prices, and Graphs and Playbook, which are drawn from them, go.
  function syncPrices() {
    const on = pricesOn();
    document.documentElement.classList.toggle("prices-off", !on);
    Fan.setMarket(marketWanted());
    if (!on) { clearPrices(); setPlaybook(null); }
    if (Fan.lines) applySlate(); else changed("lines");
    if (!on && (view === "xy" || view === "playbook")) switchWeek(weekNow());
    drawNow();
    window.dispatchEvent(new Event("resize"));
  }
  function setPrices(on) {
    setPricesWanted(on);
    try { localStorage.setItem("fan.prices", on ? "on" : "off"); } catch (e) {}
    syncPrices();
  }
  // The settings window's checkbox. Hiding changes only what shows: the records and everything calculated from them stay.
  function setTracking(on) {
    setTrackingOn(on);
    document.documentElement.classList.toggle("tracking-off", !on);
    try { localStorage.setItem("fan.tracking", on ? "on" : "off"); } catch (e) {}
    syncPrices();
    if (view === "ncaafb") showView(view);
    if (!on && view === "ledger") switchWeek(weekNow());
    if (!on && riskGame) setRiskGame(null);   // the risk detail's column is gone
    backupDue();
    drawNow();
    window.dispatchEvent(new Event("resize"));   // the page refits as it does for a new window size
  }
export { addTicket, balances, bookReport, centsOk, clearTicket, fillMoneyline, fillSpread, fillTotal, gameSel, inStore, isKalshi, ledgerCard, lineShown, mode, placeNote, readLeg, recordsItems, renderLedger, renderPick, renderTickets, setBalances, setPrices, setTracking, showSaved, startRecords, ticketsReady, updateTicket, weekChanged };
