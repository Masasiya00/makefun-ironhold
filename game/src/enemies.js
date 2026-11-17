// IRONHOLD enemies: five kinds with distinct silhouettes, speeds and
// behaviour. They spawn at the map edges, push toward the firebase, chew
// through sandbags when blocked, and attack the player or the command tent.
// Time-based motion (wobble, bob) uses each entity's own accumulated time,
// never performance.now() — screenshots must be deterministic.
import { ENEMIES, CONFIG } from './config.js';
import { resolveMapCollision, nearestSandbag, circleHitsRect } from './map.js';
import { fireEnemyBullet, damageTent } from './bullets.js';
import { damagePlayer } from './player.js';
import { spawnExplosion } from './particles.js';
import { playGrenadePop } from './audio.js';
import { pick, range } from './random.js';
import { losBlockedBySmoke, pointInSmoke } from './smoke.js';

export function spawnEnemy(g, kind, x, y) {
  const def = ENEMIES[kind];
  const e = {
    kind, name: def.name,
    x, y, vx: 0, vy: 0,
    hp: def.hp * g.diff.enemyHp,
    maxHp: def.hp * g.diff.enemyHp,
    speed: def.speed * g.diff.enemySpeed,
    damage: def.damage * g.diff.enemyDmg,
    radius: def.radius,
    color: def.color,
    range: def.range,
    attackRate: def.attackRate,
    attackT: range(g.rng, 0.4, 1.2),
    alive: true,
    flashT: 0,
    wobble: g.rng() * Math.PI * 2,
    t: 0,
    blockedT: 0,
    slideT: 0,
    slideDir: 1,
    target: 'tent',
    telegraph: 0,
    isBoss: false,
  };
  g.enemies.push(e);
  return e;
}

export function spawnPointFor(g) {
  // Spawn just inside a random map edge, outside the wire.
  const side = Math.floor(g.rng() * 4);
  const m = 60;
  if (side === 0) return { x: range(g.rng, m, 1600 - m), y: m };
  if (side === 1) return { x: range(g.rng, m, 1600 - m), y: 1200 - m };
  if (side === 2) return { x: m, y: range(g.rng, m, 1200 - m) };
  return { x: 1600 - m, y: range(g.rng, m, 1200 - m) };
}

export function updateEnemies(g, dt) {
  const p = g.player;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    e.t += dt;
    if (e.flashT > 0) e.flashT -= dt;
    if (e.attackT > 0) e.attackT -= dt;

    // Target: the player if close, else the command tent.
    const dp = Math.hypot(p.x - e.x, p.y - e.y);
    const dtent = Math.hypot(g.tent.x - e.x, g.tent.y - e.y);
    const targetPlayer = p.alive && dp < 340;
    const tx = targetPlayer ? p.x : g.tent.x;
    const ty = targetPlayer ? p.y : g.tent.y;
    const dist = targetPlayer ? dp : dtent;

    const wob = Math.sin(e.t * 3 + e.wobble) * 0.35;
    let mx = 0, my = 0;

    if (e.kind === 'grenadier') {
      // Hold at throwing range and lob grenades — unless smoke hides the target.
      if (dist > e.range) {
        mx = (tx - e.x) / dist; my = (ty - e.y) / dist;
      } else if (e.attackT <= 0 && !losBlockedBySmoke(g, e.x, e.y, tx, ty) && !pointInSmoke(g, tx, ty)) {
        throwGrenade(g, e, tx, ty);
        e.attackT = e.attackRate;
      }
    } else if (e.kind === 'sniper') {
      // Hold at long range, telegraph with a laser, then shoot — unless smoke hides the target.
      if (dist > e.range) {
        mx = (tx - e.x) / dist; my = (ty - e.y) / dist;
      } else {
        e.telegraph += dt;
        if (e.telegraph > 0.7 && e.attackT <= 0 && !losBlockedBySmoke(g, e.x, e.y, tx, ty) && !pointInSmoke(g, tx, ty)) {
          fireEnemyBullet(g, e.x, e.y, Math.atan2(ty - e.y, tx - e.x), 620, e.damage, 560);
          e.attackT = e.attackRate;
          e.telegraph = 0;
        }
      }
    } else {
      // Melee kinds: close in and hit.
      if (dist > e.range) {
        mx = (tx - e.x) / dist; my = (ty - e.y) / dist;
        // Wobble perpendicular so the horde does not march in a straight line.
        const px = -my * wob, py = mx * wob;
        mx += px; my += py;
        const len = Math.hypot(mx, my) || 1;
        mx /= len; my /= len;
      } else if (e.attackT <= 0) {
        if (targetPlayer) damagePlayer(g, e.damage, e.x, e.y);
        else damageTent(g, e.damage);
        e.attackT = e.attackRate;
      }
    }

    if (mx !== 0 || my !== 0) {
      // Wall-slide: an enemy pressed against an obstacle for a while steers
      // around it instead of marching into it forever (a stuck grunt used to
      // soft-lock an assault behind a container). The slide side alternates
      // each time so either way around an obstacle eventually clears it.
      if (e.slideT > 0) {
        e.slideT -= dt;
        const px = -my * e.slideDir, py = mx * e.slideDir;
        mx = px; my = py;
      }
      const ox = e.x, oy = e.y;
      e.x += mx * e.speed * dt;
      e.y += my * e.speed * dt;
      const blocked = resolveMapCollision(g, e, e.radius);
      if (blocked) {
        e.blockedT += dt;
        // Chew through a sandbag if one is right in front of us.
        const bag = nearestSandbag(g, e.x, e.y, 46);
        if (bag && e.blockedT > 0.8) {
          bag.hp -= e.damage * 2.4 * dt;
          if (bag.hp <= 0) { bag.alive = false; e.blockedT = 0; }
          if (g.stepCount % 30 === 0) spawnHitDust(g, bag.x, bag.y);
        } else if (e.blockedT > 1.2 && e.slideT <= 0) {
          e.slideT = 1.4;
          e.slideDir = -e.slideDir;
          e.blockedT = 0;
        }
      } else {
        e.blockedT = 0;
      }
      // If we barely moved while trying, we are stuck on something solid.
      if (Math.hypot(e.x - ox, e.y - oy) < e.speed * dt * 0.25) e.blockedT += dt;
    }
    e.vx = mx * e.speed; e.vy = my * e.speed;
  }
  // Sweep the dead (their death anim is the blood burst + float text).
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    if (!g.enemies[i].alive) g.enemies.splice(i, 1);
  }
}

function spawnHitDust(g, x, y) {
  for (const pt of g.particles) {
    if (pt.active) continue;
    pt.active = true;
    pt.x = x; pt.y = y;
    pt.vx = (g.rng() - 0.5) * 40; pt.vy = -20 - g.rng() * 30;
    pt.life = pt.maxLife = 0.4;
    pt.size = 3 + g.rng() * 3;
    pt.color = 'rgba(181,154,104,0.7)';
    pt.glow = false; pt.grav = 0;
    return;
  }
}

function throwGrenade(g, e, tx, ty) {
  // Arcing grenade: travels, then explodes where it lands.
  const a = Math.atan2(ty - e.y, tx - e.x);
  const d = Math.hypot(tx - e.x, ty - e.y);
  const flight = Math.min(1.1, 0.4 + d / 520);
  g.grenades.push({
    x: e.x, y: e.y,
    vx: Math.cos(a) * (d / flight), vy: Math.sin(a) * (d / flight),
    t: flight, dmg: e.damage, radius: 70,
  });
  playGrenadePop();
}

export function updateGrenades(g, dt) {
  for (let i = g.grenades.length - 1; i >= 0; i--) {
    const gr = g.grenades[i];
    gr.t -= dt;
    gr.x += gr.vx * dt;
    gr.y += gr.vy * dt;
    if (gr.t <= 0) {
      spawnExplosion(g, gr.x, gr.y, 0.7, true);
      const p = g.player;
      const dp = Math.hypot(p.x - gr.x, p.y - gr.y);
      if (p.alive && dp < gr.radius) damagePlayer(g, gr.dmg * (1 - dp / gr.radius / 2), gr.x, gr.y);
      const dtent = Math.hypot(g.tent.x - gr.x, g.tent.y - gr.y);
      if (dtent < gr.radius + 30) damageTent(g, gr.dmg * 0.6);
      g.grenades.splice(i, 1);
    }
  }
}

export function drawEnemies(ctx, g) {
  for (const e of g.enemies) {
    if (!e.alive) continue;
    drawEnemyBody(ctx, g, e);
  }
  // Sniper laser telegraphs (drawn after bodies so the line reads).
  for (const e of g.enemies) {
    if (!e.alive || e.kind !== 'sniper' || e.telegraph <= 0.25) continue;
    const p = g.player;
    const targetPlayer = p.alive && Math.hypot(p.x - e.x, p.y - e.y) < 340;
    const tx = targetPlayer ? p.x : g.tent.x;
    const ty = targetPlayer ? p.y : g.tent.y;
    ctx.strokeStyle = 'rgba(255,60,60,' + (0.25 + e.telegraph * 0.5) + ')';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Grenades in flight.
  for (const gr of g.grenades) {
    ctx.fillStyle = '#2c2c26';
    ctx.beginPath(); ctx.arc(gr.x, gr.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath(); ctx.arc(gr.x, gr.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawEnemyBody(ctx, g, e) {
  const colors = {
    grunt: '#a33327', rusher: '#c95a2e', grenadier: '#7a2e6e',
    sniper: '#5a2e6e', shield: '#3d3d46', boss: '#1f1f24',
  };
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 5, e.radius, e.radius * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  const body = e.flashT > 0 ? '#ffffff' : (colors[e.color] || '#a33327');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.stroke();
  // Kind silhouette: rusher = chevron, grenadier = pack, sniper = scope dot,
  // shield = front plate, grunt = plain with eyes.
  if (e.kind === 'rusher') {
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(e.radius * 0.6, 0); ctx.lineTo(-e.radius * 0.4, -e.radius * 0.5); ctx.lineTo(-e.radius * 0.4, e.radius * 0.5);
    ctx.closePath(); ctx.fill();
  } else if (e.kind === 'grenadier') {
    ctx.fillStyle = '#2c2c26';
    ctx.fillRect(-e.radius * 0.5, -e.radius * 0.4, e.radius, e.radius * 0.8);
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath(); ctx.arc(e.radius * 0.4, 0, 4, 0, Math.PI * 2); ctx.fill();
  } else if (e.kind === 'sniper') {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-e.radius, -2, e.radius * 2, 4);
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  } else if (e.kind === 'shield') {
    ctx.fillStyle = '#8a8a96';
    ctx.fillRect(-e.radius * 0.7, -e.radius * 0.8, e.radius * 0.5, e.radius * 1.6);
    ctx.fillStyle = '#e8b13c';
    ctx.fillRect(e.radius * 0.3, -3, e.radius * 0.5, 6);
  } else {
    // Grunt eyes: two dots facing the movement direction.
    const a = Math.atan2(e.vy, e.vx);
    ctx.fillStyle = '#f2ead2';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 6 - Math.sin(a) * 4, Math.sin(a) * 6 + Math.cos(a) * 4, 2.5, 0, Math.PI * 2);
    ctx.arc(Math.cos(a) * 6 + Math.sin(a) * 4, Math.sin(a) * 6 - Math.cos(a) * 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Health bar above the head.
  if (e.hp < e.maxHp) {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 5);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#7fb069' : e.hp / e.maxHp > 0.25 ? '#e8b13c' : '#d64533';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * Math.max(0, e.hp / e.maxHp), 5);
  }
}
