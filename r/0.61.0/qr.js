// A QR code for an address (Nov 3 2026: the wall's remote address, for a tablet's camera), drawn by the page itself, so Fan fetches nothing to make one. Byte mode, error
// correction level M, versions 1 to 10 (up to 213 bytes), the mask scored as the standard does. After Project Nayuki's QR Code generator (MIT), cut down to what Fan needs.
const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   // level M, versions 1-10
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const gfMul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; };
function rsDivisor(degree) {
  const r = new Array(degree).fill(0); r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) { for (let j = 0; j < degree; j++) { r[j] = gfMul(r[j], root); if (j + 1 < degree) r[j] ^= r[j + 1]; } root = gfMul(root, 0x02); }
  return r;
}
function rsRemainder(data, divisor) {
  const r = divisor.map(() => 0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); divisor.forEach((c, i) => { r[i] ^= gfMul(c, f); }); }
  return r;
}
const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
const dataCodewords = v => Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[v - 1] * BLOCKS[v - 1];
function alignPositions(v, size) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, out = [6];
  for (let spot = size - 7; out.length < n; spot -= step) out.splice(1, 0, spot);
  return out;
}
// Data codewords then error correction, interleaved across blocks as the standard lays them out.
function codewords(data, v) {
  const nb = BLOCKS[v - 1], ecl = ECC_PER_BLOCK[v - 1], raw = Math.floor(rawModules(v) / 8), short = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(ecl), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dataBlock = data.slice(k, k + shortLen - ecl + (i < short ? 0 : 1)); k += dataBlock.length;
    const b = dataBlock.concat(rsRemainder(dataBlock, div));
    if (i < short) b.splice(shortLen - ecl, 0, 0);   // a short block gets a placeholder, skipped below
    blocks.push(b);
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecl || j >= short) out.push(b[i]); });
  return out;
}
const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];

// The modules, rows of booleans (dark), for text; null when it's too long for version 10.
function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1;
  const bitsFor = ver => 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
  while (v <= 10 && bitsFor(v) > dataCodewords(v) * 8) v++;
  if (v > 10) return null;
  // the bit stream: byte mode, the count, the bytes, the terminator, then padding
  const bits = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }, cap = dataCodewords(v) * 8;
  put(4, 4); put(bytes.length, v <= 9 ? 8 : 16); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  const all = codewords(data, v), size = v * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); }
  const al = alignPositions(v, size), alignLast = al.length - 1;
  al.forEach((ay, i) => al.forEach((ax, j) => { if ((i === 0 && j === 0) || (i === 0 && j === alignLast) || (i === alignLast && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  const format = mask => {
    const d = (0 << 3) | mask; let r = d;   // level M's format bits are 00
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const dark = ((b >>> i) & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, dark); set(c, a, dark); }
  }
  // the codewords, two columns at a time, up and down, skipping the timing column
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vertical : vertical;
      if (!fn[y][x] && i < all.length * 8) { m[y][x] = ((all[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }
  const apply = k => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x]; };
  let best = 0, bestScore = Infinity;
  for (let k = 0; k < 8; k++) { apply(k); format(k); const s = penalty(m); if (s < bestScore) { best = k; bestScore = s; } apply(k); }
  apply(best); format(best);
  return m;
}
// The standard's readability score: long runs, 2x2 blocks, finder-like stretches, and the dark share.
function penalty(m) {
  const size = m.length, line = get => {
    let s = 0, run = 1, seq = [];
    for (let i = 0; i < size; i++) { const c = get(i); seq.push(c); if (i > 0 && c === get(i - 1)) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; }
    const str = seq.map(c => (c ? 1 : 0)).join("");
    for (const pattern of ["10111010000", "00001011101"]) for (let k = str.indexOf(pattern); k >= 0; k = str.indexOf(pattern, k + 1)) s += 40;
    return s;
  };
  let s = 0, dark = 0;
  for (let k = 0; k < size; k++) { s += line(i => m[k][i]); s += line(i => m[i][k]); }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) s += 3; }
  m.forEach(r => r.forEach(c => { if (c) dark++; }));
  const total = size * size;
  return s + Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
}
// As SVG, with the standard's quiet border of 4 modules, scaled to px.
function qrSvg(text, px = 220) {
  const m = qrMatrix(text);
  if (!m) return null;
  const n = m.length + 8, d = [];
  m.forEach((r, y) => r.forEach((c, x) => { if (c) d.push(`M${x + 4},${y + 4}h1v1h-1z`); }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d.join("")}" fill="#000"/></svg>`;
}
export { qrMatrix, qrSvg };
