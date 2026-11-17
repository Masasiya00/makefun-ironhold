// IRONHOLD smoke: drifting clouds from smoke grenades and bomb blasts.
// Smoke expands, drifts with the wind and fades. Enemies cannot see through
// it — a player inside smoke takes half damage, and snipers and grenadiers
// will not fire at a target they cannot see.
import { clamp } from './random.js';

export function updateSmoke(g, dt) {
  for (let i = g.smokes.length - 1; i >= 0; i--) {
    const s = g.smokes[i];
    s.life -= dt;
    if (s.life <= 0) { g.smokes.splice(i, 1); continue; }
    s.radius += (s.maxRadius - s.radius) * dt * 0.9;
    s.x += s.driftX * dt;
    s.y += s.driftY * dt;
  }
}

export function pointInSmoke(g, x, y) {
  for (const s of g.smokes) {
    const dx = s.x - x, dy = s.y - y;
    if (dx * dx + dy * dy < s.radius * s.radius) return true;
  }
  return false;
}

// Line-of-sight test: does the segment from (x1,y1) to (x2,y2) pass through
// any smoke cloud? Sampled every 24 px — cheap and good enough.
export function losBlockedBySmoke(g, x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.floor(d / 24));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInSmoke(g, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return true;
  }
  return false;
}

export function drawSmoke(ctx, g) {
  for (const s of g.smokes) {
    if (!g.sprites) continue;
    const lifeA = clamp(s.life / s.maxLife, 0, 1);
    const a = Math.min(0.85, lifeA * 1.4) * (s.fromBlast ? 0.9 : 0.75);
    const r = s.radius * 2;
    // Three overlapping baked puffs per cloud, offset by fixed fractions so
    // the cloud reads as one lumpy mass, not a circle.
    ctx.globalAlpha = a;
    ctx.drawImage(g.sprites.smokePuff, s.x - r / 2 - r * 0.18, s.y - r / 2, r, r);
    ctx.drawImage(g.sprites.smokePuff, s.x - r / 2 + r * 0.18, s.y - r / 2 - r * 0.1, r * 0.9, r * 0.9);
    ctx.drawImage(g.sprites.smokePuff, s.x - r / 2, s.y - r / 2 + r * 0.14, r * 0.85, r * 0.85);
  }
  ctx.globalAlpha = 1;
}
