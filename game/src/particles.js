// IRONHOLD particles: pooled sparks, blood, smoke puffs, explosions and
// floating damage numbers. Everything draws from the pre-allocated pools in
// state.js; spawn functions grab the first inactive slot and return.
import { clamp } from './random.js';

export function spawnHitSparks(g, x, y, color) {
  let n = 0;
  for (const p of g.particles) {
    if (p.active) continue;
    p.active = true;
    const a = g.rng() * Math.PI * 2, sp = 60 + g.rng() * 160;
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.life = p.maxLife = 0.22 + g.rng() * 0.18;
    p.size = 2 + g.rng() * 2.5;
    p.color = color;
    p.glow = true; p.grav = 0;
    if (++n >= 6) return;
  }
}

export function spawnBlood(g, x, y, color) {
  let n = 0;
  for (const p of g.particles) {
    if (p.active) continue;
    p.active = true;
    const a = g.rng() * Math.PI * 2, sp = 40 + g.rng() * 140;
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.life = p.maxLife = 0.35 + g.rng() * 0.3;
    p.size = 2.5 + g.rng() * 3.5;
    p.color = color;
    p.glow = false; p.grav = 60;
    if (++n >= 12) return;
  }
}

export function spawnExplosion(g, x, y, size, withSmoke) {
  // Flash + fireball + debris + an expanding smoke ring.
  for (const p of g.particles) {
    if (p.active) continue;
    p.active = true;
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0;
    p.life = p.maxLife = 0.28;
    p.size = 60 * size;
    p.color = '#ffcf4d';
    p.glow = true; p.grav = 0;
    break;
  }
  let n = 0;
  for (const p of g.particles) {
    if (p.active) continue;
    p.active = true;
    const a = g.rng() * Math.PI * 2, sp = 80 + g.rng() * 260 * size;
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.life = p.maxLife = 0.4 + g.rng() * 0.5;
    p.size = 3 + g.rng() * 5;
    p.color = g.rng() < 0.5 ? '#ff7a1a' : '#ffcf4d';
    p.glow = true; p.grav = 0;
    if (++n >= 16) break;
  }
  if (withSmoke) {
    g.smokes.push({ x, y, radius: 26 * size, maxRadius: 90 * size, life: 3.2, maxLife: 3.2, driftX: 12, driftY: -6, fromBlast: true });
  }
  g.shake = Math.max(g.shake, 10 * size);
}

export function spawnMuzzleSmoke(g, x, y) {
  for (const p of g.particles) {
    if (p.active) continue;
    p.active = true;
    p.x = x; p.y = y;
    p.vx = (g.rng() - 0.5) * 20; p.vy = -14 - g.rng() * 20;
    p.life = p.maxLife = 0.5;
    p.size = 5 + g.rng() * 4;
    p.color = 'rgba(160,160,150,0.4)';
    p.glow = false; p.grav = -20;
    return;
  }
}

export function addFloatText(g, x, y, text, color, size) {
  for (const t of g.texts) {
    if (t.active) continue;
    t.active = true;
    t.x = x + (g.rng() - 0.5) * 14; t.y = y;
    t.vy = -46;
    t.life = 0.85;
    t.text = text;
    t.color = color;
    t.size = size || 13;
    return;
  }
}

export function updateParticles(g, dt) {
  for (const p of g.particles) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.vx *= 0.985; p.vy *= 0.985;
  }
  for (const t of g.texts) {
    if (!t.active) continue;
    t.life -= dt;
    if (t.life <= 0) { t.active = false; continue; }
    t.y += t.vy * dt;
    t.vy *= 0.96;
  }
}

export function drawParticles(ctx, g) {
  // Glow particles use the baked sprite (no shadowBlur in the hot loop).
  for (const p of g.particles) {
    if (!p.active) continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    if (p.glow && g.sprites) {
      const s = p.size * 3.2;
      ctx.globalAlpha = a;
      ctx.drawImage(g.sprites.glowOrange, p.x - s / 2, p.y - s / 2, s, s);
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Floating damage numbers.
  ctx.textAlign = 'center';
  for (const t of g.texts) {
    if (!t.active) continue;
    ctx.globalAlpha = clamp(t.life / 0.85, 0, 1);
    ctx.font = 'bold ' + t.size + 'px "Courier New", monospace';
    ctx.fillStyle = '#00000088';
    ctx.fillText(t.text, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
