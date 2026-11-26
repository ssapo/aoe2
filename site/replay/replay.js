// 엔진 재생 (APP-22, PC): genie 엔진(genie-web.wasm, wasm32-wasip1 명령)이 worker 안에서 경기를 다시
// 실행하며 EVERY 업데이트마다 객체를 보내고, 이 페이지가 캔버스에 재생한다(확대·이동·이름·정보 상자).
// 게임 데이터는 방문자가 고른 자기 게임 폴더의 .dat과 옆의 표 네 개이고, 어디로도 보내지 않는다.
// 리플은 공식 서버(api.ageofempires.com, CORS 허용)에서 받거나 파일로 고른다.
'use strict';
const EVERY = 20;               // updates between two views
const COLORS = ['#8b7d6b', '#3d7bff', '#ff4b3e', '#2fbf4f', '#f2c12e', '#2ec7c9', '#b35cff', '#c8c8c8', '#ff8c1a'];
// the still objects (kind 0) by master class: 15 tree, 32 gold, 8 stone, 34 cliff, 5 bush;
// 14 (grass and other decorations), 30 (map placeholders, removed in the first update) and the
// rest are not drawn
const GROUND = '#5d6644';     // land under everything
const STILL_COLORS = { 15: '#1f3f24', 32: '#d4b13a', 8: '#9a9a9a', 34: '#a17a4f', 5: '#6aa84f', 7: '#c0508a' };
const UNIT_LABEL_ZOOM = 14;     // px per tile from which unit names show
const $ = id => document.getElementById(id);
const canvas = $('map'), ctx = canvas.getContext('2d');

let st = null;                  // the loaded match's state
let looping = false;
const cam = { x: 60, y: 60, scale: 6, fitted: false };   // centre (tiles) and px per tile (CSS px)
const DAT_FILES = ['empires2_x2_p1.dat', 'dropsites.json', 'linkedTechs.json', 'unitlines.json', 'civilizations.json'];
// the .dat the engine's import was checked with (build 188329, aoe2-data/README): another may differ
const KNOWN_DAT_SHA256 = 'd0aefd92428e2215d6f4d9b1d544901e6f171e19183f9e0b88218de5153a337f';
let hover = null, selected = null;                         // object ids
let drawn = [];                                            // this frame's objects on screen, for picking

function fmt(ms) { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

async function envVars() {
  const text = await (await fetch('engine-switches.txt?v=20261126')).text();
  const env = {};
  for (const kv of text.split(/[;\r\n]+/)) { const i = kv.indexOf('='); if (i > 0) env[kv.slice(0, i)] = kv.slice(i + 1); }
  return env;
}

// pieces: the game's .dat and the four tables beside it (install::BESIDE's order, empty for one
// that is not there)
async function start(pieces, rec, name) {
  if (st && st.worker) st.worker.terminate();
  $('status').textContent = name + ' 불러오는 중…';
  $('stage').hidden = false; $('side').hidden = false;
  const [wasm, env] = await Promise.all([fetch('genie-web.wasm?v=20261126f').then(r => r.arrayBuffer()), envVars()]);
  st = { name, frames: [], stills: [], info: null, labels: null, words: 10, playMs: 0, playing: false, done: false, wall: 0, wasmBytes: wasm.byteLength };
  cam.fitted = false; hover = selected = null;
  const worker = new Worker('worker.js?v=20261123');
  st.worker = worker;
  worker.onmessage = e => onMessage(e.data);
  st.t0 = performance.now();
  worker.postMessage({ wasm, pieces, rec, every: EVERY, env }, [wasm, ...pieces, rec]);
  $('bPlay').disabled = false; $('seek').disabled = false;
  if (!looping) { looping = true; loop(); }
}

// the public demo (?demo=518363684): the engine's frames of one match, computed beforehand and
// served as demo-<id>.bin (raw deflate of genie-web's stdout), played without the engine or any
// game file
const DEMOS = {
  521084500: { label: '프로 경기 · 13분 37초', check: '<strong>13:28까지 125개 중 124개 체크포인트가 완전히 일치</strong>하고, 마지막 13:34에는 양쪽 위치 합계가 조금 달라요' },
  518363684: { label: '프로 경기 · 10분 32초', check: '<strong>10:19까지 96개 중 95개 체크포인트가 완전히 일치</strong>하고, 마지막 10:26에는 한쪽 위치 합계만 조금 달라요' },
};
async function startDemo(id) {
  $('setup').hidden = true; $('demoNote').hidden = false;
  $('demoCheck').innerHTML = DEMOS[id].check;
  $('demoPick').replaceChildren(...Object.keys(DEMOS).sort((a, b) => b - a).map(k => {
    const a = document.createElement(k === id ? 'strong' : 'a');
    if (k !== id) a.href = '?demo=' + k;
    a.textContent = '#' + k + ' (' + DEMOS[k].label + ')';
    return a;
  }));
  document.querySelector('header h1 small').textContent = '(데모)';
  $('status').textContent = '엔진 출력 불러오는 중…';
  $('stage').hidden = false; $('side').hidden = false;
  const packed = await fetch('demo-' + id + '.bin?v=20261126f').then(r => { if (!r.ok) throw Error('HTTP ' + r.status); return r.arrayBuffer(); });
  const bytes = await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  st = { name: '#' + id, demo: true, frames: [], stills: [], info: null, labels: null, words: 10, playMs: 0, playing: false, done: false, wall: 1, wasmBytes: 0 };
  cam.fitted = false; hover = selected = null;
  const v = new DataView(bytes);
  for (let o = 0; o + 8 <= bytes.byteLength;) {
    const tag = v.getUint32(o, true), len = v.getUint32(o + 4, true);
    onMessage({ tag, bytes: bytes.slice(o + 8, o + 8 + len), wall: 1 });
    o += 8 + len;
  }
  st.done = true;
  $('status').textContent = '#' + id + ' (' + DEMOS[id].label + '): 미리 계산한 엔진 출력이에요';
  $('bPlay').disabled = false; $('seek').disabled = false;
  if (!looping) { looping = true; loop(); }
}

function onMessage(m) {
  if (m.crash) { $('status').textContent = '엔진이 멈췄어요: ' + m.crash; console.error(m); return; }
  if (m.done) {
    st.done = true; st.wall = m.wall;
    const last = st.frames[st.frames.length - 1];
    st.memory = m.memory;
    $('status').textContent = st.name + ': 끝까지 계산했어요 (' + (m.wall / 1000).toFixed(1) + '초, 실제 1초에 게임 ' + ((last ? last.ms : 0) / m.wall).toFixed(1) + '초)';
    return;
  }
  st.wall = m.wall;
  if (m.tag === 1 && st.loadWall == null) st.loadWall = m.wall;
  if (m.tag === 1) {
    st.info = JSON.parse(new TextDecoder().decode(m.bytes));
    if (st.info.error) $('status').textContent = '불러오지 못했어요: ' + st.info.error;
    if (st.info.view_words) st.words = st.info.view_words;
    if (!st.seen && st.info.map && st.info.players) st.seen = st.info.players.map(() => new Float32Array(st.info.map[0] * st.info.map[1]).fill(Infinity));
    return;
  }
  if (m.tag === 4) { st.labels = JSON.parse(new TextDecoder().decode(m.bytes)); legend(); fogOptions(); return; }
  const words = new Uint32Array(m.bytes);
  const f = { u: words[0], ms: words[1], data: words.subarray(2), floats: new Float32Array(m.bytes, 8), ints: new Int32Array(m.bytes, 8) };
  if (m.tag === 2) {
    st.frames.push(f);
    if (st.frames.length % 4 === 1) explore(f);
    if (!st.done && !st.demo) $('status').textContent = st.name + ': ' + fmt(f.ms) + '까지 계산 (실제 1초에 게임 ' + (f.ms / m.wall).toFixed(1) + '초)';
  } else if (m.tag === 3) st.stills.push(f);
}

// ---- names ----
function masterName(id) {
  if (MASTER_NAMES[id]) return MASTER_NAMES[id];
  const internal = st && st.labels && st.labels.masters[id];
  return internal ? internal : '#' + id;
}
function playerName(p) {
  const l = st && st.labels && st.labels.players[p];
  if (p === 0) return '가이아';
  return 'P' + p + (l && l.name ? ' ' + l.name : '');
}
function actionText(o) {
  const kind = o.action & 0xffff, state = o.action >>> 16;
  if (kind === 0xffff) return '대기';
  let t = ACTION_NAMES[kind] || ('행동 ' + kind + ' (상태 ' + state + ')');
  if (kind === 110 && HELD_NAMES[o.heldKind] && o.heldAmount > 0) t = HELD_NAMES[o.heldKind] + ' ' + t;
  if (o.target >= 0 && [3, 6, 7, 9, 101, 104, 105, 106, 110].includes(kind)) t += ' (대상 ' + o.target + ')';
  return t;
}
// a civilization's data name ("MALAY-CIV") as a word ("Malay")
function civName(c) {
  if (!c) return '?';
  return c.replace(/-CIV$/i, '').toLowerCase().replace(/(^|[\s_-])(\w)/g, (m, s, l) => (s === '_' ? ' ' : s) + l.toUpperCase());
}
function legend() {
  const ps = (st.labels && st.labels.players) || [];
  $('players').innerHTML = '';
  ps.forEach((p, i) => {
    if (!i) return;
    const div = document.createElement('div');
    const sw = document.createElement('b'); sw.style.background = COLORS[i] || '#fff';
    const text = document.createElement('span');
    text.textContent = 'P' + i + ' ' + (p.name || '?') + ' — ' + civName(p.civ);
    div.append(sw, text); $('players').append(div);
  });
}

// ---- frames ----
function at(list, ms) {
  let lo = 0, hi = list.length - 1, best = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (list[mid].ms <= ms) { best = mid; lo = mid + 1; } else hi = mid - 1; }
  return best;
}
function endMs() {
  const last = st.frames[st.frames.length - 1];
  if (!last) return 1;
  if (st.done || !st.info) return last.ms;
  return Math.max(last.ms, last.ms / Math.max(last.u, 1) * st.info.total);
}
function spanMs() {
  if (!st.info || !st.info.players) return 0;
  const ps = st.info.players.slice(1).filter(p => p.site_checkpoints > 0);
  return ps.length ? Math.min(...ps.map(p => p.site_ok_ms)) : 0;
}
// the object of frame a at offset o, its place interpolated towards frame b by t
function objectAt(a, o, next, b, t) {
  const W = st.words, d = a.data, f = a.floats;
  let x = f[o + 4], y = f[o + 5];
  if (next) { const q = next.get(d[o]); if (q !== undefined) { x += (b.floats[q + 4] - x) * t; y += (b.floats[q + 5] - y) * t; } }
  return {
    id: d[o], player: d[o + 1], master: d[o + 2], kind: d[o + 3] & 0xff, cls: (d[o + 3] >> 8) & 0xffff,
    inside: (d[o + 3] & 0x80000000) !== 0, x, y, hp: f[o + 6], action: d[o + 7],
    target: W > 8 ? a.ints[o + 8] : -1, heldKind: W > 9 ? (d[o + 9] << 16 >> 16) : -1, heldAmount: W > 9 ? d[o + 9] >>> 16 : 0,
    sight: W > 10 ? f[o + 10] : 0, rx: W > 12 ? f[o + 11] : 0, ry: W > 12 ? f[o + 12] : 0,
  };
}

// ---- camera ----
function cssSize() { return { w: canvas.clientWidth, h: canvas.clientHeight }; }
function fit() {
  if (!st || !st.info || !st.info.map) return;
  const { w, h } = cssSize(), [mw, mh] = st.info.map;
  cam.x = mw / 2; cam.y = mh / 2; cam.scale = Math.min(w / mw, h / mh); cam.fitted = true;
}
function toScreen(x, y) { const { w, h } = cssSize(); return [(x - cam.x) * cam.scale + w / 2, (y - cam.y) * cam.scale + h / 2]; }
function toWorld(sx, sy) { const { w, h } = cssSize(); return [(sx - w / 2) / cam.scale + cam.x, (sy - h / 2) / cam.scale + cam.y]; }
function zoomAt(sx, sy, factor) {
  const [wx, wy] = toWorld(sx, sy);
  cam.scale = Math.min(80, Math.max(1, cam.scale * factor));
  const [nx, ny] = toWorld(sx, sy);
  cam.x += wx - nx; cam.y += wy - ny;
}

// ---- sight (fog of war): each object's master line of sight (view word 10, tiles) ----
// st.seen[p][tile]: the first game time (ms) player p's objects saw that tile (stamped every
// 4th view as the frames come); visible now: the current view's circles
function stampCircle(grid, mw, mh, x, y, r, value, keepMin) {
  const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(mw - 1, Math.floor(x + r));
  const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(mh - 1, Math.floor(y + r)), r2 = r * r;
  for (let ty = y0; ty <= y1; ty++) {
    const dy = ty + 0.5 - y, row = ty * mw;
    for (let tx = x0; tx <= x1; tx++) {
      const dx = tx + 0.5 - x;
      if (dx * dx + dy * dy > r2) continue;
      if (keepMin) { if (grid[row + tx] > value) grid[row + tx] = value; } else grid[row + tx] = value;
    }
  }
}
function explore(f) {
  if (!st.seen || st.words < 11) return;
  const [mw, mh] = st.info.map, W = st.words, d = f.data, fl = f.floats;
  for (let o = 0; o + W <= d.length; o += W) {
    const p = d[o + 1], r = fl[o + 10];
    if (!p || !(r > 0) || (d[o + 3] & 0x80000000) || !st.seen[p]) continue;
    stampCircle(st.seen[p], mw, mh, fl[o + 4], fl[o + 5], r, f.ms, true);
  }
}
// the viewers: [] for off, else the players whose sight shows
function viewers() {
  const v = $('fog').value;
  if (v === '0' || !st.seen || st.words < 11) return [];
  return v === 'all' ? st.seen.map((_, i) => i).filter(i => i > 0) : [+v];
}
function fogOptions() {
  const sel = $('fog'), keep = sel.value;
  sel.replaceChildren(new Option('끔', '0'));
  ((st.labels && st.labels.players) || []).forEach((p, i) => { if (i) sel.append(new Option('P' + i + ' ' + (p.name || ''), String(i))); });
  sel.append(new Option('양쪽 다', 'all'));
  sel.value = [...sel.options].some(o => o.value === keep) ? keep : '0';
  sel.disabled = $('fogMode').disabled = st.words < 11;
  sel.title = st.words < 11 ? '이 엔진 출력에는 시야 값이 없어요' : '고른 선수가 보는 곳만 밝게, 본 적 있는 곳은 어둡게, 못 본 곳은 검게';
}
const fogCanvas = document.createElement('canvas');
// the visible grid (1 visible) for the viewers from view a, and the fog drawn over the map
function fog(a, vs, mw, mh) {
  const W = st.words, d = a.data, fl = a.floats, vis = new Uint8Array(mw * mh);
  for (let o = 0; o + W <= d.length; o += W) {
    const r = fl[o + 10];
    if (!vs.includes(d[o + 1]) || !(r > 0) || (d[o + 3] & 0x80000000)) continue;
    stampCircle(vis, mw, mh, fl[o + 4], fl[o + 5], r, 1, false);
  }
  if (fogCanvas.width !== mw || fogCanvas.height !== mh) { fogCanvas.width = mw; fogCanvas.height = mh; }
  const fctx = fogCanvas.getContext('2d'), img = fctx.createImageData(mw, mh), px = img.data, fogAll = $('fogMode').value === 'fog';
  for (let i = 0; i < mw * mh; i++) {
    const explored = vs.some(p => st.seen[p][i] <= st.playMs);
    // 'game': unseen black, explored dim; 'fog': the whole map shown, only what is out of sight dimmed
    px[i * 4 + 3] = vis[i] ? 0 : fogAll ? 165 : explored ? 175 : 240;
  }
  fctx.putImageData(img, 0, 0);
  const [x0, y0] = toScreen(0, 0);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(fogCanvas, x0, y0, mw * cam.scale, mh * cam.scale);
  return { vis, explored: i => vs.some(p => st.seen[p][i] <= st.playMs) };
}

// ---- drawing ----
function draw() {
  const dpr = window.devicePixelRatio || 1, { w, h } = cssSize();
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0d0f12'; ctx.fillRect(0, 0, w, h);
  drawn = [];
  if (!st || !st.info || !st.info.map) return;
  if (!cam.fitted) fit();
  const k = cam.scale, W = st.words, [mw, mh] = st.info.map;
  const [mx0, my0] = toScreen(0, 0);
  // the ground: a land colour, so that what is out of sight (darkened below) reads at a glance
  ctx.fillStyle = GROUND; ctx.fillRect(mx0, my0, mw * k, mh * k);
  ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 1; ctx.strokeRect(mx0, my0, mw * k, mh * k);
  const si = at(st.stills, st.playMs);
  if (si >= 0) {
    const s = st.stills[si];
    // cliffs first, in two passes: a dark rim under every piece, then the fills, so the pieces of one
    // cliff read as one rock with a single outline
    for (const pass of [0, 1]) for (let o = 0; o + W <= s.data.length; o += W) {
      if (((s.data[o + 3] >> 8) & 0xffff) !== 34 || (s.data[o + 3] & 0x80000000)) continue;
      const [sx, sy] = toScreen(s.floats[o + 4], s.floats[o + 5]);
      const e = pass ? 0 : 0.22, hx = (W > 12 && s.floats[o + 11] > 0 ? s.floats[o + 11] : 1.5) + e, hy = (W > 12 && s.floats[o + 12] > 0 ? s.floats[o + 12] : 1.5) + e;
      ctx.fillStyle = pass ? STILL_COLORS[34] : '#3a2817'; ctx.fillRect(sx - k * hx, sy - k * hy, k * 2 * hx, k * 2 * hy);
    }
    for (let o = 0; o + W <= s.data.length; o += W) {
      if (((s.data[o + 3] >> 8) & 0xffff) === 34) continue;
      if (s.data[o + 3] & 0x80000000) continue;
      const color = STILL_COLORS[(s.data[o + 3] >> 8) & 0xffff];
      if (color === undefined) continue;
      const [sx, sy] = toScreen(s.floats[o + 4], s.floats[o + 5]);
      if (sx < -k || sy < -k || sx > w + k || sy > h + k) continue;
      // the object's own footprint (master radius x, y; a cliff piece is 1 to 3 tiles each way), a
      // little inset so neighbouring trees stay apart; without the radius words, a tile (a cliff 3 x 3)
      const cliff = ((s.data[o + 3] >> 8) & 0xffff) === 34;
      const hx = W > 12 && s.floats[o + 11] > 0 ? s.floats[o + 11] - (cliff ? 0 : 0.05) : cliff ? 1.5 : 0.45;
      const hy = W > 12 && s.floats[o + 12] > 0 ? s.floats[o + 12] - (cliff ? 0 : 0.05) : cliff ? 1.5 : 0.45;
      ctx.fillStyle = color; ctx.fillRect(sx - k * hx, sy - k * hy, k * 2 * hx, k * 2 * hy);
    }
  }
  const i = at(st.frames, st.playMs);
  if (i < 0) return;
  const a = st.frames[i], b = st.frames[i + 1];
  const vs = viewers(), seen = vs.length ? fog(a, vs, mw, mh) : null, size = +$('markScale').value;
  const t = b && b.ms > a.ms ? Math.min(1, (st.playMs - a.ms) / (b.ms - a.ms)) : 0;
  let next = null;
  if (b && t > 0) { next = new Map(); for (let o = 0; o + W <= b.data.length; o += W) next.set(b.data[o], o); }
  const labels = [];
  const unitLabels = $('unitLabels').checked || k >= UNIT_LABEL_ZOOM;
  for (let o = 0; o + W <= a.data.length; o += W) {
    const ob = objectAt(a, o, next, b, t);
    if (ob.inside) continue;
    if (ob.player === 0 && DECOR_BIRDS.has(ob.master)) continue;   // decorative birds: no effect on the game, not drawn
    const [cx, cy] = toScreen(ob.x, ob.y);
    if (cx < -3 * k || cy < -3 * k || cx > w + 3 * k || cy > h + 3 * k) continue;
    // in sight mode: the others' units only where the viewers see, their buildings where explored
    if (seen && $('fogMode').value === 'game' && !vs.includes(ob.player)) {
      const tx = Math.floor(ob.x), ty = Math.floor(ob.y), ti = ty * mw + tx;
      if (tx < 0 || ty < 0 || tx >= mw || ty >= mh) continue;
      if (ob.kind === 1 ? !seen.explored(ti) : !seen.vis[ti]) continue;
    }
    ctx.fillStyle = COLORS[ob.player] || '#fff';
    ctx.beginPath();
    let r;
    if (ob.kind === 1 && ob.rx > 0) {
      // the building's own footprint (master radius x, y): a wall is one tile, a town centre four
      const hx = Math.max(1.5, ob.rx * k), hy = Math.max(1.5, ob.ry * k); r = Math.max(hx, hy);
      ctx.rect(cx - hx, cy - hy, 2 * hx, 2 * hy);
      if (ob.cls === 49) ctx.globalAlpha = 0.45;   // a farm: its field, faint
    }
    else if (ob.kind === 1) { r = Math.max(2.5, k * 1.1); ctx.rect(cx - r, cy - r, 2 * r, 2 * r); }
    else if (ob.kind === 2) { r = Math.max(2.5, k * 0.45) * size; ctx.arc(cx, cy, r, 0, Math.PI * 2); }
    else { r = Math.max(3, k * (ob.player === 0 ? 0.5 : 0.7)) * size; ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.8); ctx.lineTo(cx - r, cy + r * 0.8); ctx.closePath(); }
    ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.stroke();
    if (ob.id === selected || ob.id === hover) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.stroke(); }
    if (ob.kind !== 0 && ob.player !== 0 && ob.hp < 0.999 && ob.hp >= 0 && k >= 4) {
      ctx.fillStyle = '#000'; ctx.fillRect(cx - r, cy - r - 5, 2 * r, 3);
      ctx.fillStyle = ob.hp > 0.5 ? '#3fb950' : '#f85149'; ctx.fillRect(cx - r, cy - r - 5, 2 * r * ob.hp, 3);
    }
    drawn.push({ ob, cx, cy, r });
    // priority: 0 the selected or hovered object (always), 1 a building of the name table
    // (always), 2 a unit (from UNIT_LABEL_ZOOM or with the box ticked); a building that is not
    // in the table (an internal name) only when selected or hovered
    const focus = ob.id === selected || ob.id === hover;
    const priority = focus ? 0
      : ob.kind === 1 ? (MASTER_NAMES[ob.master] && !UNLABELLED.has(ob.master) && ob.cls !== 27 ? 1 : -1)   // walls: no name each
      : unitLabels ? 2 : -1;
    if (priority >= 0) labels.push({ text: masterName(ob.master), x: cx, y: cy + r + 2, building: ob.kind === 1, priority });
  }
  // greedy placement: a label that would overlap one already placed is left out (but focus)
  labels.sort((p, q) => p.priority - q.priority);
  const placed = [];
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const l of labels) {
    const size = k >= 20 ? 12 : 10;
    ctx.font = (l.building ? '600 ' : '') + size + 'px system-ui, sans-serif';
    const half = ctx.measureText(l.text).width / 2 + 2, box = [l.x - half, l.y, l.x + half, l.y + size + 2];
    if (l.priority > 0 && placed.some(b => box[0] < b[2] && b[0] < box[2] && box[1] < b[3] && b[1] < box[3])) continue;
    placed.push(box);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(l.text, l.x, l.y);
    ctx.fillStyle = l.building ? '#ffffff' : '#d8dde3'; ctx.fillText(l.text, l.x, l.y);
  }
}

function tip() {
  const id = selected ?? hover;
  const d = id == null ? null : drawn.find(e => e.ob.id === id);
  if (!d) { $('tip').style.display = 'none'; return; }
  const o = d.ob, internal = st.labels && st.labels.masters[o.master];
  $('tip').textContent = masterName(o.master) + '\n'
    + playerName(o.player) + '\n'
    + '체력 ' + Math.round(Math.max(0, o.hp) * 100) + '%\n'
    + actionText(o) + '\n'
    + 'id ' + o.id + ' · 마스터 ' + o.master + (internal ? ' (' + internal + ')' : '');
  $('tip').style.display = 'block';
}

function panel() {
  const end = endMs(), last = st.frames[st.frames.length - 1];
  $('clock').textContent = fmt(st.playMs) + ' / ' + fmt(end) + (st.done ? '' : '…');
  // the verified span (site words 1, 6, 10 equal at every checkpoint so far): past it, "확인 안 됨"
  // past the span: "확인 안 됨" when a player's site words differed at a later checkpoint; when
  // none ever differed, the span ends at the last checkpoint the replay holds (the game ended
  // before the next), so there is nothing to compare: "확인 값 없음"
  const span = spanMs(), players = (st.info && st.info.players || []).slice(1);
  const checked = players.some(p => p.site_checkpoints > 0), broke = players.some(p => p.site_bad_ms != null);
  const past = checked && st.playMs > span, unverified = past && broke;
  $('unverified').style.display = unverified ? 'block' : 'none';
  $('clockMark').textContent = !checked ? '확인 전' : unverified ? '확인 안 됨' : past ? '확인 값 없음 (마지막 체크포인트 뒤)' : '확인됨';
  $('clockMark').className = !checked ? '' : unverified ? 'bad' : past ? '' : 'ok';
  $('spanDone').style.background = broke ? '' : '#555';
  if (!$('seek').matches(':active')) $('seek').value = Math.round(st.playMs / end * 1000);
  $('spanOk').style.width = (spanMs() / end * 100) + '%';
  $('spanDone').style.width = ((last ? last.ms : 0) / end * 100) + '%';
  $('zoomInfo').textContent = cam.scale.toFixed(1) + ' px/타일';
  const info = st.info || {};
  const lines = [
    '경기 ' + st.name + (info.map ? ' · 지도 ' + info.map.join('×') : ''),
    '업데이트 ' + (info.updates ?? '-') + ' / ' + (info.total ?? '-'),
    st.demo ? '엔진: 미리 계산한 출력 (게임 파일 없이 재생)' : '엔진: 실제 1초에 게임 ' + (last ? (last.ms / st.wall).toFixed(1) : '-') + '초' + (st.done ? ', 끝까지 ' + (st.wall / 1000).toFixed(1) + '초' : ''),
    '확인된 구간 ' + fmt(spanMs()) + (st.done ? ' / ' + fmt(end) : '') + (st.done && !broke && checked ? ' (리플의 마지막 체크포인트까지 전부, 그 뒤는 비교할 값이 없음)' : ''),
  ];
  (info.players || []).forEach((p, i) => { if (i) lines.push('P' + i + ': 체크포인트 ' + p.held + '개 일치' + (p.mismatch != null ? ', ' + p.mismatch + '동기화 뒤 첫 어긋남' : '') + (p.stop ? ', 엔진이 지원하지 않는 동작에서 멈춤(업데이트 ' + p.stop.update + ')' : '') + (p.site_bad_ms != null ? ', 사이트 수치가 ' + fmt(p.site_bad_ms) + '부터 다름' : '')); });
  $('info').textContent = lines.join('\n');
}

function frameOnce() { draw(); tip(); panel(); }

function loop() {
  let prev = performance.now();
  const tick = now => {
    if (st) {
      const dt = now - prev;
      if (st.playing) {
        const last = st.frames[st.frames.length - 1];
        st.playMs = Math.min(st.playMs + dt * +$('speed').value, last ? last.ms : 0);
        if (st.done && last && st.playMs >= last.ms) { st.playing = false; $('bPlay').textContent = '재생'; }
      }
      frameOnce();
    }
    prev = now; requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---- input: wheel, drag, pinch, hover, tap (pointer events: mouse, touch and pen) ----
const pointers = new Map();     // pointerId -> [x, y]
let dragFrom = null, pinchFrom = null, moved = 0;
function local(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function pick(sx, sy, slack) {
  let best = null, bestD = Infinity;
  for (const d of drawn) {
    const dist = Math.hypot(d.cx - sx, d.cy - sy) - d.r;
    if (dist < slack && dist < bestD) { best = d.ob.id; bestD = dist; }
  }
  return best;
}
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const [sx, sy] = local(e);
  zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0015));
  if (st) frameOnce();
}, { passive: false });
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  const p = local(e); pointers.set(e.pointerId, p); moved = 0;
  if (pointers.size === 1) { dragFrom = { p, cx: cam.x, cy: cam.y }; canvas.classList.add('dragging'); }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchFrom = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), scale: cam.scale, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cx: cam.x, cy: cam.y };
    dragFrom = null; moved = 99;
  }
});
canvas.addEventListener('pointermove', e => {
  const p = local(e);
  if (!pointers.has(e.pointerId)) {                       // a mouse hovering
    if (e.pointerType === 'mouse' && st) hover = pick(p[0], p[1], 8);
    return;
  }
  const old = pointers.get(e.pointerId); moved += Math.hypot(p[0] - old[0], p[1] - old[1]);
  pointers.set(e.pointerId, p);
  if (pointers.size === 2 && pinchFrom) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    cam.x = pinchFrom.cx; cam.y = pinchFrom.cy; cam.scale = pinchFrom.scale;
    zoomAt(pinchFrom.mid[0], pinchFrom.mid[1], d / Math.max(pinchFrom.d, 1));
    cam.x -= (mid[0] - pinchFrom.mid[0]) / cam.scale; cam.y -= (mid[1] - pinchFrom.mid[1]) / cam.scale;
  } else if (dragFrom) {
    cam.x = dragFrom.cx - (p[0] - dragFrom.p[0]) / cam.scale;
    cam.y = dragFrom.cy - (p[1] - dragFrom.p[1]) / cam.scale;
  }
  if (st) frameOnce();
});
function release(e) {
  if (!pointers.has(e.pointerId)) return;
  const p = local(e);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchFrom = null;
  if (pointers.size === 0) {
    canvas.classList.remove('dragging');
    if (moved < 6 && dragFrom && st) selected = pick(p[0], p[1], e.pointerType === 'mouse' ? 8 : 16);   // tap or click
    dragFrom = null;
  } else if (pointers.size === 1) {
    const [q] = [...pointers.values()]; dragFrom = { p: q, cx: cam.x, cy: cam.y };
  }
  if (st) frameOnce();
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hover = null; });
$('reset').onclick = () => { fit(); if (st) frameOnce(); };
$('full').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen(); else $('stage').requestFullscreen?.();
};
document.addEventListener('fullscreenchange', () => { $('full').textContent = document.fullscreenElement ? '작게' : '크게'; setTimeout(() => { fit(); if (st) frameOnce(); }, 50); });
window.addEventListener('resize', () => { if (st) frameOnce(); });

$('bPlay').onclick = () => { st.playing = !st.playing; $('bPlay').textContent = st.playing ? '멈춤' : '재생'; };
$('seek').oninput = e => { const last = st.frames[st.frames.length - 1]; st.playMs = Math.min(e.target.value / 1000 * endMs(), last ? last.ms : 0); frameOnce(); };

// ---- setup: the game's data folder and the replay ----
let datFiles = null, recBytes = null;
const params = new URLSearchParams(location.search);
const gameId = /^\d+$/.test(params.get('gameId') || '') ? params.get('gameId') : null;
const profileId = /^\d+$/.test(params.get('profileId') || '') ? params.get('profileId') : null;

function ready() { $('bStart').disabled = !(datFiles && recBytes); }

async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function note(el, cls, text) {
  const span = document.createElement('span'); span.className = cls; span.textContent = text; el.append(span, ' ');
}

$('fDat').onchange = async () => {
  const byName = new Map([...$('fDat').files].map(f => [f.name.toLowerCase(), f]));
  const out = $('datStatus'); out.textContent = '';
  if (!byName.get(DAT_FILES[0].toLowerCase())) { datFiles = null; note(out, 'bad', '이 폴더에 empires2_x2_p1.dat이 없어요.'); ready(); return; }
  const bufs = await Promise.all(DAT_FILES.map(n => byName.get(n.toLowerCase())).map(f => f ? f.arrayBuffer() : new ArrayBuffer(0)));
  const missing = DAT_FILES.slice(1).filter((n, i) => !bufs[i + 1].byteLength);
  const hash = await sha256(bufs[0]);
  datFiles = bufs;
  note(out, 'ok', '✓ ' + DAT_FILES[0] + ' (' + (bufs[0].byteLength / 1e6).toFixed(1) + ' MB)');
  if (missing.length) note(out, 'warn', '없음: ' + missing.join(', '));
  if (hash !== KNOWN_DAT_SHA256) note(out, 'warn', '엔진을 확인한 게임 버전(188329)의 데이터와 달라요. 결과가 다를 수 있어요.');
  ready();
};

// the first file of a zip (the replay download), stored or deflated
async function unzip(buf) {
  const v = new DataView(buf);
  let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw Error('zip 끝 레코드가 없어요');
  const cd = v.getUint32(e + 16, true);
  if (v.getUint32(cd, true) !== 0x02014b50) throw Error('zip 목록이 이상해요');
  const method = v.getUint16(cd + 10, true), size = v.getUint32(cd + 20, true), local = v.getUint32(cd + 42, true);
  const data = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
  const raw = buf.slice(data, data + size);
  if (method === 0) return raw;
  if (method !== 8) throw Error('zip 압축 방식 ' + method + '은 못 읽어요');
  return await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
}

async function takeReplay(buf, how) {
  const head = new Uint8Array(buf, 0, 2);
  recBytes = head[0] === 0x50 && head[1] === 0x4b ? await unzip(buf) : buf;
  $('recStatus').textContent = '';
  note($('recStatus'), 'ok', '✓ 리플 ' + (recBytes.byteLength / 1e6).toFixed(1) + ' MB (' + how + ')');
  ready();
}

$('fRec').onchange = async () => {
  const f = $('fRec').files[0];
  if (f) await takeReplay(await f.arrayBuffer(), '파일').catch(e => { $('recStatus').textContent = ''; note($('recStatus'), 'bad', e.message); });
};

const demoId = params.get('demo');
if (demoId && DEMOS[demoId]) {
  startDemo(demoId).catch(e => { $('status').textContent = '데모를 불러오지 못했어요: ' + e.message; });
} else if (gameId && profileId) {
  $('recAuto').textContent = '경기 #' + gameId + ' 리플을 공식 서버에서 받는 중…';
  fetch('https://api.ageofempires.com/api/GameStats/AgeII/GetMatchReplay/?gameId=' + gameId + '&profileId=' + profileId + '&matchId=' + gameId)
    .then(r => { if (!r.ok) throw Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then(buf => takeReplay(buf, '공식 서버'))
    .then(() => { $('recAuto').textContent = '경기 #' + gameId + ' 리플을 받았어요.'; })
    .catch(e => { $('recAuto').textContent = ''; note($('recAuto'), 'warn', '공식 서버에서 리플을 받지 못했어요(' + e.message + '). 리플 파일을 직접 골라 주세요.'); });
} else {
  $('recAuto').textContent = '경기 기록에서 "엔진 재생"으로 들어오면 리플을 자동으로 받아요. 아니면 파일을 골라 주세요.';
}

$('bStart').onclick = () => {
  if (!datFiles || !recBytes) return;
  // the worker takes the buffers: hand it copies, so that the button can start again
  start(datFiles.map(b => b.slice(0)), recBytes.slice(0), gameId ? '#' + gameId : '리플');
};
