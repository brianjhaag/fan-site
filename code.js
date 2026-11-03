// The Code section (TRADING.md, Nov 3 2026): the algo grid, the code editor and the console with its prompt, in one page opened by the Code button, as Ledger is.
// With a connector of 0.38 or later, the algos are the connector's algoRuntime's: kept in its records, checked, run and armed there, with or without a page open; the grid and the console show what it
// reports, and the prompt runs there. With none, an algo is a draft kept in this browser, every one not approved, and the prompt answers from the page itself, saying so.
import { Fan } from "./hosts.js?v=mw0zcjhc";
import { $, el } from "./base.js?v=mw0zcjhc";

const KEPT = "fan.algos";   // the drafts, per browser, when there's no algoRuntime; draftsMoved into the connector the first time one is found
const STATES = ["not approved", "off", "running", "armed"];   // TRADING.md: an algo's states, in order
const SHARED_COLS = 3;   // the shared columns an algo writes to (TRADING.md: 3 for now)
const POLL_MS = 1000;   // how often the open Code page reads the algoRuntime
let algos = [], pickedId = null;
try { algos = JSON.parse(localStorage.getItem(KEPT) || "[]"); } catch (e) {}
const keepAlgos = () => { if (algoRuntime()) return; try { localStorage.setItem(KEPT, JSON.stringify(algos)); } catch (e) {} };
const withKids = (tag, cls, kids) => { const n = el(tag, cls); n.append(...kids); return n; };
const pickedAlgo = () => algos.find(a => a.id === pickedId) || null;
const algoRuntime = () => Fan.algos || null;
const STARTER = "// An algo: plain JavaScript, run by the connector on its global scope, fan, which it reads and never writes.\n// fan.on(event, fn) says what wakes it: start, tick, move, fill or order. fan.order({ ticker, side, count, price }) sends one when armed.\n\nfan.on(\"tick\", () => {\n});\n";

// ---- The algoRuntime: what it last said, and what's promptHistory of it.
let conSeq = null, codePoll = null, draftsMoved = false;
const conSaid = [];
function sayHere(k, t) { conSaid.push({ k, t }); if (conSaid.length > 1000) conSaid.splice(0, conSaid.length - 1000); }
async function askRuntime(q) {
  const r = await algoRuntime().ask(q).catch(e => ({ ok: false, error: String((e && e.message) || e) }));
  if (!r.ok) sayHere("err", (q.op === "eval" ? "" : q.op + ": ") + r.error);
  await readRuntime();
  return r;
}
// The rows and the new console lines. The editor isn't redrawn, so typing isn't lost; only the grid and the console are.
async function readRuntime() {
  const rt = algoRuntime();
  if (!rt) return;
  let r;
  try { r = await rt.read(conSeq); } catch (e) { return; }
  if (!r || !Array.isArray(r.algos)) return;
  if (!draftsMoved) { draftsMoved = true; await moveDrafts(r.algos); return readRuntime(); }
  const typed = pickedAlgo() && document.activeElement && document.activeElement.classList.contains("cd-text") ? pickedAlgo().code : null;
  algos = r.algos;
  if (typed != null && pickedAlgo()) pickedAlgo().code = typed;   // what's being typed wins over the copy that was saved a moment ago
  (r.lines || []).forEach(l => conSaid.push({ k: l.k, t: l.t, who: l.algo }));
  if (conSaid.length > 1000) conSaid.splice(0, conSaid.length - 1000);
  conSeq = r.seq;
  redrawLive();
}
// Drafts made in this browser before it had a algoRuntime go into the connector once, not approved, and leave the browser.
async function moveDrafts(have) {
  let drafts = [];
  try { drafts = JSON.parse(localStorage.getItem(KEPT) || "[]"); } catch (e) {}
  for (const d of drafts) if (!have.some(a => a.id === d.id)) await algoRuntime().ask({ op: "save", id: d.id, name: d.name, code: d.code, cols: d.cols || ["", "", ""] }).catch(() => {});
  try { localStorage.removeItem(KEPT); } catch (e) {}
}
function startPolling() {
  if (codePoll || !algoRuntime()) return;
  codePoll = setInterval(() => { const page = $("code"); if (!page || page.hidden) { clearInterval(codePoll); codePoll = null; return; } readRuntime(); }, POLL_MS);
}

// ---- The editor: a text area over its own highlighted copy, with line numbers. Fan's global scope (fan.…) gets a color of its own, so the special dot reads at a glance (TRADING.md).
const WORDS = new Set("await break case catch class const continue default delete do else export extends false finally for function if import in instanceof let new null of return super switch this throw true try typeof undefined var void while yield".split(" "));
const escHtml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function highlight(src) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\b(fan(?:\.[A-Za-z_$][\w$@]*)*)|\b(\d[\d_]*\.?\d*(?:e[+-]?\d+)?)\b|\b([A-Za-z_$][\w$]*)\b/g;
  let out = "", at = 0, m;
  while ((m = re.exec(src))) {
    out += escHtml(src.slice(at, m.index));
    const [t, com, str, scope, num, word] = m;
    out += com ? `<i class="c-com">${escHtml(com)}</i>` : str ? `<i class="c-str">${escHtml(str)}</i>` : scope ? `<i class="c-fan">${escHtml(scope)}</i>` : num ? `<i class="c-num">${escHtml(num)}</i>` : WORDS.has(word) ? `<i class="c-kw">${escHtml(word)}</i>` : escHtml(t);
    at = m.index + t.length;
  }
  return out + escHtml(src.slice(at)) + "\n";
}
function codeEditor() {
  const box = el("div", "cd-ed"), nums = el("pre", "cd-nums"), painted = el("pre", "cd-view"), text = el("textarea", "cd-text");
  text.spellcheck = false; text.setAttribute("aria-label", "Algo code"); text.wrap = "off";
  const a = pickedAlgo();
  text.value = a ? a.code : ""; text.disabled = !a; text.placeholder = a ? "" : "Pick an algo in the grid, or press New.";
  const draw = () => { painted.innerHTML = highlight(text.value); nums.textContent = text.value.split("\n").map((_, i) => i + 1).join("\n"); };
  let saving;
  text.addEventListener("input", () => {
    draw();
    const p = pickedAlgo(); if (!p) return;
    p.code = text.value; clearTimeout(saving);
    saving = setTimeout(() => { if (algoRuntime()) askRuntime({ op: "save", id: p.id, code: p.code }); else keepAlgos(); }, algoRuntime() ? 600 : 300);   // saved, the algoRuntime takes it back to not approved
  });
  text.addEventListener("scroll", () => { painted.scrollTop = nums.scrollTop = text.scrollTop; painted.scrollLeft = text.scrollLeft; });
  text.addEventListener("keydown", e => {   // Tab indents two spaces, Shift+Tab takes them back, rather than leaving the editor
    if (e.key !== "Tab") return;
    e.preventDefault();
    const s = text.selectionStart, v = text.value, lineStart = v.lastIndexOf("\n", s - 1) + 1;
    if (e.shiftKey) { if (v.slice(lineStart, lineStart + 2) === "  ") { text.value = v.slice(0, lineStart) + v.slice(lineStart + 2); text.selectionStart = text.selectionEnd = Math.max(lineStart, s - 2); } }
    else { text.value = v.slice(0, s) + "  " + v.slice(text.selectionEnd); text.selectionStart = text.selectionEnd = s + 2; }
    text.dispatchEvent(new Event("input"));
  });
  draw();
  box.append(nums, withKids("div", "cd-edwrap", [painted, text]));
  return box;
}

// ---- The grid: one row per algo, its name and state, then the 3 shared columns it writes to. The headers are the picked algo's names for them, or blank.
function gridTable() {
  const a = pickedAlgo(), heads = ["Algo", "State", ...Array.from({ length: SHARED_COLS }, (_, i) => (a && a.cols && a.cols[i]) || "")];
  const table = el("table"), head = el("tr");
  heads.forEach(h => head.append(el("th", null, h)));
  table.append(withKids("thead", null, [head]));
  const body = el("tbody");
  if (!algos.length) { const tr = el("tr", "cd-none"), td = el("td", null, "No algos yet: press New."); td.colSpan = heads.length; tr.append(td); body.append(tr); }
  algos.forEach(x => {
    const tr = el("tr", x.id === pickedId ? "on" : null), state = el("td", "cd-state st-" + STATES.indexOf(x.state || STATES[0]), x.state || STATES[0]);
    if (x.error) { state.classList.add("cd-err"); state.title = x.error; }
    tr.append(el("td", "cd-name", x.name), state, ...Array.from({ length: SHARED_COLS }, (_, i) => { const c = (x.cells || [])[i] || {}, td = el("td", "cd-cell", c.v == null ? "" : String(c.v)); if (c.bg) td.style.background = c.bg; if (c.font) td.style.font = c.font; return td; }));
    tr.addEventListener("click", () => { pickedId = x.id === pickedId ? null : x.id; drawCode(); });
    body.append(tr);
  });
  table.append(body);
  return table;
}
// The state buttons: Check takes a not-approved algo to off; Off, Run and Arm move an approved one. Only the user moves an algo between them.
function stateButtons(a) {
  const st = a ? STATES.indexOf(a.state || STATES[0]) : -1;
  const b = (label, to, can, cls) => { const n = el("button", "cd-btn cd-st" + (cls ? " " + cls : ""), label); n.type = "button"; n.disabled = !a || !algoRuntime() || !can; n.addEventListener("click", () => askRuntime({ op: "state", id: a.id, state: STATES[to] })); return n; };
  return [b("Check", 1, st === 0), b("Off", 1, st >= 2), b("Run", 2, st >= 1 && st !== 2), b("Arm", 3, st >= 1 && st !== 3, "cd-arm")];
}
function algoGrid() {
  const box = el("div", "cd-grid"), a = pickedAlgo();
  const bar = el("div", "cd-bar"), add = el("button", "cd-btn", "New"), del = el("button", "cd-btn", "Delete"), name = el("input", "cd-nm");
  add.type = del.type = "button";
  add.addEventListener("click", async () => {
    const id = "a" + Date.now().toString(36), draft = { id, name: "Algo " + (algos.length + 1), code: STARTER, cols: ["", "", ""], state: STATES[0] };
    pickedId = id;
    if (algoRuntime()) { algos.push(draft); await askRuntime({ op: "save", ...draft }); drawCode(); return; }
    algos.push(draft); keepAlgos(); drawCode();
  });
  del.disabled = !a; del.title = "Delete this algo";
  del.addEventListener("click", () => { if (!a) return; if (!del.classList.contains("sure")) { del.classList.add("sure"); del.textContent = "Delete: sure?"; return; } pickedId = null; if (algoRuntime()) { askRuntime({ op: "delete", id: a.id }).then(drawCode); return; } algos = algos.filter(x => x.id !== a.id); keepAlgos(); drawCode(); });
  name.value = a ? a.name : ""; name.disabled = !a; name.placeholder = "Name"; name.setAttribute("aria-label", "Algo name");
  name.addEventListener("change", () => { if (!a || !name.value.trim()) return; a.name = name.value.trim(); if (algoRuntime()) askRuntime({ op: "save", id: a.id, name: a.name }); else { keepAlgos(); drawCode(); } });
  const cols = Array.from({ length: SHARED_COLS }, (_, i) => { const c = el("input", "cd-col"); c.value = a && a.cols ? a.cols[i] || "" : ""; c.disabled = !a; c.placeholder = "Column " + (i + 1); c.setAttribute("aria-label", "Column " + (i + 1) + "'s name"); c.addEventListener("change", () => { if (!a) return; a.cols = a.cols || ["", "", ""]; a.cols[i] = c.value; if (algoRuntime()) askRuntime({ op: "save", id: a.id, cols: a.cols }); else { keepAlgos(); drawCode(); } }); return c; });
  const note = algoRuntime() ? "Algos run in the connector, with or without this page open. An edit takes one back to not approved." : "Algos run in the Fan connector, 0.38 or later. Without one they're drafts in this browser, and none can be checked or run.";
  bar.append(add, name, ...cols, del, ...stateButtons(a), el("span", "cd-note", note));
  box.append(bar, withKids("div", "cd-scroll", [gridTable()]));
  return box;
}

// ---- The console, shared by every algo, each line marked with its algo, and a prompt. With a algoRuntime the prompt runs there, on the global scope; without, in this page, marked so.
let promptHistory = [], promptBack = -1;
const printable = v => { if (typeof v === "string") return v; try { const s = JSON.stringify(v, null, 1); return s === undefined ? String(v) : s; } catch (e) { return String(v); } };
function runHere(src) {
  sayHere("in", src);
  try { let v; try { v = Function('"use strict"; return (' + src + "\n)")(); } catch (e) { if (!(e instanceof SyntaxError)) throw e; v = Function('"use strict";' + src)(); } sayHere("out", printable(v)); }
  catch (e) { sayHere("err", String((e && e.message) || e)); }
}
const promptMark = () => (algoRuntime() ? "fan>" : "page>");
function paintConsole(out) {
  const first = algoRuntime() ? "Console: what every algo prints, and the prompt, run in the connector on the global scope. The prompt sends no orders." : "Console. With no connector algoRuntime here, the prompt runs in this page.";
  const line = l => { const n = el("div", "cl-" + l.k); if (l.k === "in") n.textContent = promptMark() + " " + l.t; else { if (l.who && l.who !== "prompt") n.append(el("span", "cd-who", l.who + " ")); n.append(l.t); } return n; };
  const stick = out.scrollTop + out.clientHeight >= out.scrollHeight - 4;
  out.replaceChildren(el("div", "cl-sys", first), ...conSaid.map(line));
  if (stick) out.scrollTop = out.scrollHeight;
}
function consoleBox() {
  const box = el("div", "cd-con"), out = el("div", "cd-out"), row = el("div", "cd-prompt"), input = el("input", "cd-in");
  input.setAttribute("aria-label", "Prompt"); input.spellcheck = false; input.placeholder = "a line of JavaScript, Enter to run";
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && input.value.trim()) { const v = input.value; promptHistory.unshift(v); promptBack = -1; input.value = ""; if (algoRuntime()) askRuntime({ op: "eval", line: v }); else { runHere(v); paintConsole(out); } }
    else if (e.key === "ArrowUp" && promptHistory.length) { promptBack = Math.min(promptHistory.length - 1, promptBack + 1); input.value = promptHistory[promptBack]; e.preventDefault(); }
    else if (e.key === "ArrowDown") { promptBack = Math.max(-1, promptBack - 1); input.value = promptBack < 0 ? "" : promptHistory[promptBack]; e.preventDefault(); }
  });
  row.append(el("span", "cd-promptMark", promptMark()), input);
  box.append(el("div", "cd-head", "Console"), out, row);
  requestAnimationFrame(() => { out.scrollTop = out.scrollHeight; }); paintConsole(out); out.scrollTop = out.scrollHeight;
  return box;
}

// What the algoRuntime reports, redrawn in place: the grid when its rows changed, unless a name is being typed or a Delete waits for its second press, and the console. Never the editor.
let gridShown = "";
function redrawLive() {
  const page = $("code");
  if (!page || page.hidden) return;
  const grid = page.querySelector(".cd-grid"), out = page.querySelector(".cd-out"), rows = JSON.stringify([pickedId, algos.map(a => [a.name, a.state, a.cols, a.cells, a.error])]);
  if (grid && rows !== gridShown && !grid.contains(document.activeElement) && !grid.querySelector(".sure")) { gridShown = rows; grid.replaceWith(algoGrid()); }
  if (out) paintConsole(out);
}

// The algos down the left; on the right the editor, taking most of the height, with the console and its prompt under it (the user, Nov 3 2026).
function drawCode() {
  const page = $("code");
  if (!page) return;
  page.replaceChildren(algoGrid(), withKids("div", "cd-low", [codeEditor(), consoleBox()]));
}
const renderCode = () => { drawCode(); if (algoRuntime()) { readRuntime(); startPolling(); } };
export { renderCode };
