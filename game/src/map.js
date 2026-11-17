// IRONHOLD map: Firebase Ironhold, a 1600x1200 compound. A river runs down
// the west edge, a sandbag ring with four gates is the line to hold, and the
// command tent, helipad and watchtower sit inside. Containers are cover.
// Terrain is pre-rendered once to an offscreen canvas — the loop just draws
// one image per frame.
import { PALETTE as P } from './palette.js';
import { range } from './random.js';

const MAP_W = 1600, MAP_H = 1200;

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function buildFirebase(g) {
  const rng = g.rng;
  g.containers = [];
  g.sandbags = [];
  g.trees = [];
  g.rocks = [];
  g.craters = [];

  // --- Craters from old strikes (terrain dressing) ---
  const craterSpots = [[420, 210], [1180, 320], [350, 980], [1290, 900], [950, 180], [620, 1060], [1450, 560], [230, 540]];
  for (const [x, y] of craterSpots) {
    g.craters.push({ x: x + range(rng, -30, 30), y: y + range(rng, -30, 30), r: range(rng, 22, 42) });
  }

  // --- Trees and rocks outside the wire ---
  for (let i = 0; i < 26; i++) {
    const x = range(rng, 140, 1560), y = range(rng, 60, 1160);
    if (x > 430 && x < 1170 && y > 230 && y < 970) continue; // keep the compound clear
    g.trees.push({ x, y, r: range(rng, 14, 22), sway: rng() * Math.PI * 2 });
  }
  for (let i = 0; i < 18; i++) {
    const x = range(rng, 140, 1560), y = range(rng, 60, 1160);
    if (x > 440 && x < 1160 && y > 240 && y < 960) continue;
    g.rocks.push({ x, y, r: range(rng, 8, 16) });
  }

  // --- Sandbag ring: rectangle (470,270)-(1130,930), 46px segments, gates
  // in the middle of each side. Each segment has HP; enemies chew through.
  const x0 = 470, y0 = 270, x1 = 1130, y1 = 930, seg = 46;
  const gateW = 110;
  function addBag(x, y, angle) {
    g.sandbags.push({ x, y, hp: 120, maxHp: 120, w: seg, h: 20, angle, alive: true });
  }
  for (let x = x0; x <= x1; x += seg) {
    const midTop = Math.abs(x + seg / 2 - (x0 + x1) / 2) < gateW / 2;
    if (!midTop) addBag(x + seg / 2, y0, 0);
    const midBot = Math.abs(x + seg / 2 - (x0 + x1) / 2) < gateW / 2;
    if (!midBot) addBag(x + seg / 2, y1, 0);
  }
  for (let y = y0; y <= y1; y += seg) {
    const midLeft = Math.abs(y + seg / 2 - (y0 + y1) / 2) < gateW / 2;
    if (!midLeft) addBag(x0, y + seg / 2, Math.PI / 2);
    const midRight = Math.abs(y + seg / 2 - (y0 + y1) / 2) < gateW / 2;
    if (!midRight) addBag(x1, y + seg / 2, Math.PI / 2);
  }

  // --- Shipping containers: cover inside and outside the wire ---
  const contDefs = [
    { x: 560, y: 420, w: 110, h: 44, angle: 0, color: 'containerRed' },
    { x: 1020, y: 420, w: 110, h: 44, angle: 0, color: 'containerGreen' },
    { x: 560, y: 820, w: 110, h: 44, angle: 0, color: 'containerNavy' },
    { x: 1180, y: 640, w: 44, h: 110, angle: 0, color: 'containerRust' },
    { x: 380, y: 600, w: 110, h: 44, angle: 0, color: 'containerGreen' },
    { x: 1240, y: 300, w: 44, h: 110, angle: 0, color: 'containerRed' },
    { x: 700, y: 1080, w: 110, h: 44, angle: 0, color: 'containerRust' },
    { x: 1420, y: 980, w: 110, h: 44, angle: 0, color: 'containerNavy' },
  ];
  for (const c of contDefs) {
    g.containers.push({ ...c, hp: 9999, loot: false });
  }
  // Two loot containers outside the wire hold supplies.
  g.containers.push({ x: 300, y: 180, w: 110, h: 44, angle: 0, color: 'containerRust', hp: 40, loot: true });
  g.containers.push({ x: 1330, y: 150, w: 110, h: 44, angle: 0, color: 'containerGreen', hp: 40, loot: true });

  renderTerrain(g);
}

function renderTerrain(g) {
  const rng = g.rng;
  const c = document.createElement('canvas');
  c.width = MAP_W; c.height = MAP_H;
  const x = c.getContext('2d');

  // Base khaki ground.
  x.fillStyle = P.terrain;
  x.fillRect(0, 0, MAP_W, MAP_H);
  // Mottled patches.
  for (let i = 0; i < 900; i++) {
    const px = rng() * MAP_W, py = rng() * MAP_H, pr = 8 + rng() * 34;
    x.fillStyle = rng() < 0.5 ? 'rgba(119,105,63,0.25)' : 'rgba(160,142,92,0.22)';
    x.beginPath(); x.arc(px, py, pr, 0, Math.PI * 2); x.fill();
  }
  // Grass tufts outside the compound.
  for (let i = 0; i < 260; i++) {
    const px = 130 + rng() * (MAP_W - 260), py = 50 + rng() * (MAP_H - 100);
    if (px > 430 && px < 1170 && py > 230 && py < 970) continue;
    x.strokeStyle = 'rgba(111,122,61,0.7)';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(px, py); x.lineTo(px - 3, py - 7);
    x.moveTo(px + 3, py); x.lineTo(px + 5, py - 8);
    x.moveTo(px, py); x.lineTo(px + 1, py - 10);
    x.stroke();
  }
  // Dirt paths: gate to tent, helipad to tent, tower to tent.
  x.strokeStyle = 'rgba(156,138,94,0.85)';
  x.lineCap = 'round';
  const paths = [
    [[800, 270], [800, 600]], [[800, 930], [800, 600]],
    [[470, 600], [800, 600]], [[1130, 600], [800, 600]],
    [[1010, 800], [800, 600]], [[600, 380], [800, 600]],
  ];
  for (const pts of paths) {
    x.lineWidth = 26;
    x.beginPath();
    x.moveTo(pts[0][0], pts[0][1]);
    x.lineTo(pts[1][0], pts[1][1]);
    x.stroke();
  }
  // River down the west edge: wavy blue band with a sandy bank.
  x.fillStyle = P.riverBank;
  x.fillRect(0, 0, 132, MAP_H);
  x.fillStyle = P.river;
  x.beginPath();
  x.moveTo(0, 0);
  for (let y = 0; y <= MAP_H; y += 40) x.lineTo(78 + Math.sin(y * 0.012) * 22, y);
  x.lineTo(0, MAP_H);
  x.closePath();
  x.fill();
  x.fillStyle = P.riverDeep;
  x.beginPath();
  x.moveTo(0, 0);
  for (let y = 0; y <= MAP_H; y += 40) x.lineTo(34 + Math.sin(y * 0.012 + 1) * 12, y);
  x.lineTo(0, MAP_H);
  x.closePath();
  x.fill();
  // River sparkle lines.
  x.strokeStyle = 'rgba(190,230,230,0.35)';
  x.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const py = rng() * MAP_H, px = 12 + rng() * 70;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + 14, py + 3); x.stroke();
  }
  // Craters.
  for (const cr of g.craters) {
    x.fillStyle = 'rgba(60,50,30,0.5)';
    x.beginPath(); x.arc(cr.x, cr.y, cr.r, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(40,34,20,0.55)';
    x.beginPath(); x.arc(cr.x, cr.y, cr.r * 0.6, 0, Math.PI * 2); x.fill();
  }
  // Helipad: dark circle + H marking + amber ring.
  const hp = g.helipad;
  x.fillStyle = P.helipad;
  x.beginPath(); x.arc(hp.x, hp.y, hp.radius, 0, Math.PI * 2); x.fill();
  x.strokeStyle = P.helipadMark;
  x.lineWidth = 4;
  x.beginPath(); x.arc(hp.x, hp.y, hp.radius - 6, 0, Math.PI * 2); x.stroke();
  x.fillStyle = P.helipadMark;
  x.font = 'bold 44px monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('H', hp.x, hp.y + 2);

  g.terrain = c;
}

// Circle vs axis-aligned rect (containers are axis-aligned; sandbags are
// rotated 0 or 90 degrees, so their w/h swap handles it).
export function circleHitsRect(px, py, r, rect) {
  const hw = rect.w / 2, hh = rect.h / 2;
  const dx = Math.abs(px - rect.x), dy = Math.abs(py - rect.y);
  if (dx > hw + r || dy > hh + r) return false;
  if (dx <= hw || dy <= hh) return true;
  const cx = dx - hw, cy = dy - hh;
  return cx * cx + cy * cy <= r * r;
}

// Push a moving circle out of solid map objects. Returns true if blocked.
// Solids: containers, live sandbags, tent, tower, trees. River is wadeable
// (slows you) but not solid.
export function resolveMapCollision(g, e, r) {
  let blocked = false;
  const solids = [];
  for (const c of g.containers) solids.push(c);
  for (const s of g.sandbags) if (s.alive) solids.push(s);
  solids.push({ x: g.tent.x, y: g.tent.y, w: 92, h: 76 });
  solids.push({ x: g.tower.x, y: g.tower.y, w: 44, h: 44 });
  for (const t of g.trees) solids.push({ x: t.x, y: t.y, w: t.r * 1.2, h: t.r * 1.2 });
  for (const s of solids) {
    if (!circleHitsRect(e.x, e.y, r, s)) continue;
    blocked = true;
    const hw = s.w / 2, hh = s.h / 2;
    const dx = e.x - s.x, dy = e.y - s.y;
    const ox = hw + r - Math.abs(dx), oy = hh + r - Math.abs(dy);
    if (ox < oy) e.x += dx >= 0 ? ox : -ox;
    else e.y += dy >= 0 ? oy : -oy;
  }
  // Map bounds.
  e.x = Math.max(24, Math.min(MAP_W - 24, e.x));
  e.y = Math.max(24, Math.min(MAP_H - 24, e.y));
  return blocked;
}

export function inRiver(x) {
  return x < 108;
}

// Nearest live sandbag within d of a point (for enemies chewing the line).
export function nearestSandbag(g, x, y, d) {
  let best = null, bestD = d * d;
  for (const s of g.sandbags) {
    if (!s.alive) continue;
    const dx = s.x - x, dy = s.y - y, dd = dx * dx + dy * dy;
    if (dd < bestD) { bestD = dd; best = s; }
  }
  return best;
}

export function sandbagIntegrity(g) {
  let alive = 0, total = 0;
  for (const s of g.sandbags) { total++; if (s.alive) alive += s.hp / s.maxHp; }
  return total ? alive / total : 0;
}
