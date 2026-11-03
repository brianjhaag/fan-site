// The Code section (TRADING.md's first scope, Nov 3 2026): the algo grid, the code editor and the console with its prompt, in one page opened by the Code button, as Ledger is.
// The connector's runtime isn't built yet, so for now an algo is a draft kept in this browser, every one not approved, and the prompt answers from the page itself, saying so. When the runtime
// comes, the grid shows what it reports, the editor's code goes to it to be checked, and the prompt and the console are its.
import { $, el } from "./base.js?v=mw0ro9pf";

const KEPT = "fan.algos";   // the drafts, per browser, until the runtime keeps them
const STATES = ["not approved", "off", "running", "armed"];   // TRADING.md: an algo's states, in order
const SHARED_COLS = 3;   // the shared columns an algo writes to (TRADING.md: 3 for now)
let algos = [], pickedId = null;
try { algos = JSON.parse(localStorage.getItem(KEPT) || "[]"); } catch (e) {}
const keepAlgos = () => { try { localStorage.setItem(KEPT, JSON.stringify(algos)); } catch (e) {} };
const withKids = (tag, cls, kids) => { const n = el(tag, cls); n.append(...kids); return n; };
const pickedAlgo = () => algos.find(a => a.id === pickedId) || null;
const STARTER = "// An algo: plain JavaScript. The global scope is fan: what the connector keeps, read only.\n// The runtime that runs this isn't built yet.\n\n";

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
  text.addEventListener("input", () => { draw(); const p = pickedAlgo(); if (!p) return; p.code = text.value; clearTimeout(saving); saving = setTimeout(keepAlgos, 300); });
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

// ---- The grid: one row per algo, its name and state, then the 3 shared columns it writes to. The headers are the pickedId algo's names for them, or blank.
function algoGrid() {
  const box = el("div", "cd-grid"), a = pickedAlgo(), heads = ["Algo", "State", ...Array.from({ length: SHARED_COLS }, (_, i) => (a && a.cols && a.cols[i]) || "")];
  const table = el("table"), head = el("tr");
  heads.forEach(h => head.append(el("th", null, h)));
  table.append(withKids("thead", null, [head]));
  const body = el("tbody");
  if (!algos.length) { const tr = el("tr", "cd-none"), td = el("td", null, "No algos yet: press New."); td.colSpan = heads.length; tr.append(td); body.append(tr); }
  algos.forEach(x => {
    const tr = el("tr", x.id === pickedId ? "on" : null), state = el("td", "cd-state st-" + STATES.indexOf(x.state || STATES[0]), x.state || STATES[0]);
    tr.append(el("td", "cd-name", x.name), state, ...Array.from({ length: SHARED_COLS }, (_, i) => { const c = (x.cells || [])[i] || {}, td = el("td", "cd-cell", c.v == null ? "" : String(c.v)); if (c.bg) td.style.background = c.bg; if (c.font) td.style.font = c.font; return td; }));
    tr.addEventListener("click", () => { pickedId = x.id === pickedId ? null : x.id; drawCode(); });
    body.append(tr);
  });
  table.append(body);
  const bar = el("div", "cd-bar"), add = el("button", "cd-btn", "New"), del = el("button", "cd-btn", "Delete"), name = el("input", "cd-nm");
  add.type = del.type = "button";
  add.addEventListener("click", () => { const id = "a" + Date.now().toString(36); algos.push({ id, name: "Algo " + (algos.length + 1), code: STARTER, cols: ["", "", ""], state: STATES[0] }); pickedId = id; keepAlgos(); drawCode(); });
  del.disabled = !a; del.title = "Delete this draft";
  del.addEventListener("click", () => { if (!a) return; if (!del.classList.contains("sure")) { del.classList.add("sure"); del.textContent = "Delete: sure?"; return; } algos = algos.filter(x => x.id !== a.id); pickedId = null; keepAlgos(); drawCode(); });
  name.value = a ? a.name : ""; name.disabled = !a; name.placeholder = "Name"; name.setAttribute("aria-label", "Algo name");
  name.addEventListener("change", () => { if (!a || !name.value.trim()) return; a.name = name.value.trim(); keepAlgos(); drawCode(); });
  const cols = Array.from({ length: SHARED_COLS }, (_, i) => { const c = el("input", "cd-col"); c.value = a && a.cols ? a.cols[i] || "" : ""; c.disabled = !a; c.placeholder = "Column " + (i + 1); c.setAttribute("aria-label", "Column " + (i + 1) + "'s name"); c.addEventListener("change", () => { if (!a) return; a.cols = a.cols || ["", "", ""]; a.cols[i] = c.value; keepAlgos(); drawCode(); }); return c; });
  bar.append(add, name, ...cols, del, el("span", "cd-note", "The runtime isn't built: algos are drafts in this browser, and none can be checked or run yet."));
  box.append(bar, withKids("div", "cd-scroll", [table]));
  return box;
}

// ---- The console, shared by every algo, with a prompt. Until the runtime, the prompt answers from the page, marked so.
const conSaid = [{ k: "sys", t: "Console. Until the connector's runtime is built, the prompt runs in this page, not the connector." }], conAsked = [];
let askedBack = -1;
const printable = v => { if (typeof v === "string") return v; try { const s = JSON.stringify(v, null, 1); return s === undefined ? String(v) : s; } catch (e) { return String(v); } };
function runLine(src) {
  conSaid.push({ k: "in", t: src });
  try { let v; try { v = Function('"use strict"; return (' + src + "\n)")(); } catch (e) { if (!(e instanceof SyntaxError)) throw e; v = Function('"use strict";' + src)(); } conSaid.push({ k: "out", t: printable(v) }); }
  catch (e) { conSaid.push({ k: "err", t: String((e && e.message) || e) }); }
  if (conSaid.length > 500) conSaid.splice(1, conSaid.length - 500);
}
function consoleBox() {
  const box = el("div", "cd-con"), out = el("div", "cd-out"), row = el("div", "cd-prompt"), input = el("input", "cd-in");
  input.setAttribute("aria-label", "Prompt"); input.spellcheck = false; input.placeholder = "a line of JavaScript, Enter to run";
  const paint = () => { out.replaceChildren(...conSaid.map(l => el("div", "cl-" + l.k, (l.k === "in" ? "page> " : "") + l.t))); out.scrollTop = out.scrollHeight; };
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && input.value.trim()) { const v = input.value; conAsked.unshift(v); askedBack = -1; input.value = ""; runLine(v); paint(); }
    else if (e.key === "ArrowUp" && conAsked.length) { askedBack = Math.min(conAsked.length - 1, askedBack + 1); input.value = conAsked[askedBack]; e.preventDefault(); }
    else if (e.key === "ArrowDown") { askedBack = Math.max(-1, askedBack - 1); input.value = askedBack < 0 ? "" : conAsked[askedBack]; e.preventDefault(); }
  });
  row.append(el("span", "cd-ps", "page>"), input);
  box.append(el("div", "cd-head", "Console"), out, row);
  requestAnimationFrame(paint); paint();
  return box;
}

// Grid across the top, the editor below it on the left and the console on the right.
function drawCode() {
  const page = $("code");
  if (!page) return;
  page.replaceChildren(algoGrid(), withKids("div", "cd-low", [codeEditor(), consoleBox()]));
}
const renderCode = () => drawCode();
export { renderCode };
