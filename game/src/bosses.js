// IRONHOLD bosses: one per assault 3, 5 and 7. IRONHIDE rams the sandbags,
// BLACK HORNET strafes from the air, STEEL BEHEMOTH shells the firebase
// from range and spawns grunts. Each has a health bar with pips in the HUD
// and a named banner when it arrives.
import { BOSSES } from './config.js';
import { resolveMapCollision, nearestSandbag } from './map.js';
import { fireEnemyBullet, damageTent } from './bullets.js';
import { damagePlayer } from './player.js';
import { spawnExplosion } from './particles.js';
import { setBanner, addFeed } from './state.js';
import { spawnEnemy } from './enemies.js';
import { range } from './random.js';

export function spawnBoss(g, kind) {
  const def = BOSSES[kind];
  const pt = kind === 'hornet'
    ? { x: 800, y: 90 }
    : kind === 'behemoth'
      ? { x: 800, y: 90 }
      : { x: 150, y: range(g.rng, 300, 900) };
  const b = {
    kind, name: def.name, isBoss: true,
    x: pt.x, y: pt.y, vx: 0, vy: 0,
    hp: def.hp, maxHp: def.hp,
    speed: def.speed, damage: def.damage,
    radius: def.radius, color: def.color,
    range: def.range, attackRate: def.attackRate,
    attackT: 2, alive: true, flashT: 0,
    t: 0, orbitA: g.rng() * Math.PI * 2,
    spawnT: 0, strafeT: 0, burstLeft: 0,
    blockedT: 0, slideT: 0, slideDir: 1,
  };
  g.boss = b;
  g.bossName = def.name;
  setBanner(g, def.name + ' INBOUND', def.intel);
  addFeed(g, 'WARNING: ' + def.name + ' on the battlefield', '#d64533');
  return b;
}

export function updateBoss(g, dt) {
  const b = g.boss;
  if (!b || !b.alive) return;
  b.t += dt;
  if (b.flashT > 0) b.flashT -= dt;
  if (b.attackT > 0) b.attackT -= dt;
  const p = g.player;

  if (b.kind === 'ironhide') {
    // Ram the tent: drive at it, chew sandbags in the way. Wall-slide around
    // containers instead of wedging on them (same fix as the grunts).
    const tx = g.tent.x, ty = g.tent.y;
    const d = Math.hypot(tx - b.x, ty - b.y);
    if (d > b.range) {
      let a = Math.atan2(ty - b.y, tx - b.x);
      if (b.slideT > 0) { b.slideT -= dt; a += (Math.PI / 2) * b.slideDir; }
      const ox = b.x, oy = b.y;
      b.x += Math.cos(a) * b.speed * dt;
      b.y += Math.sin(a) * b.speed * dt;
      const blocked = resolveMapCollision(g, b, b.radius * 0.8);
      if (blocked || Math.hypot(b.x - ox, b.y - oy) < b.speed * dt * 0.25) {
        b.blockedT += dt;
        if (b.blockedT > 1.2 && b.slideT <= 0) {
          b.slideT = 1.4;
          b.slideDir = -b.slideDir;
          b.blockedT = 0;
        }
      } else {
        b.blockedT = 0;
      }
      const bag = nearestSandbag(g, b.x, b.y, 60);
      if (bag) {
        bag.hp -= 60 * dt;
        if (bag.hp <= 0) bag.alive = false;
      }
    } else if (b.attackT <= 0) {
      damageTent(g, b.damage);
      spawnExplosion(g, b.x, b.y, 0.5, false);
      g.shake = Math.max(g.shake, 9);
      b.attackT = b.attackRate;
    }
  } else if (b.kind === 'hornet') {
    // Orbit the firebase at range and strafe in bursts.
    b.orbitA += dt * 0.45;
    const cx = 800, cy = 600, r = 380;
    const ox = cx + Math.cos(b.orbitA) * r, oy = cy + Math.sin(b.orbitA) * r;
    b.x += (ox - b.x) * dt * 2.2;
    b.y += (oy - b.y) * dt * 2.2;
    if (b.attackT <= 0 && p.alive) {
      b.burstLeft = 5;
      b.attackT = b.attackRate;
    }
    if (b.burstLeft > 0) {
      b.strafeT -= dt;
      if (b.strafeT <= 0) {
        const a = Math.atan2(p.y - b.y, p.x - b.x) + (g.rng() - 0.5) * 0.16;
        fireEnemyBullet(g, b.x, b.y, a, 700, b.damage, 700);
        b.burstLeft -= 1;
        b.strafeT = 0.09;
      }
    }
  } else if (b.kind === 'behemoth') {
    // Creep toward the firebase, shell the tent, spawn grunts.
    const tx = g.tent.x, ty = g.tent.y;
    const d = Math.hypot(tx - b.x, ty - b.y);
    if (d > b.range) {
      let a = Math.atan2(ty - b.y, tx - b.x);
      if (b.slideT > 0) { b.slideT -= dt; a += (Math.PI / 2) * b.slideDir; }
      const ox = b.x, oy = b.y;
      b.x += Math.cos(a) * b.speed * dt;
      b.y += Math.sin(a) * b.speed * dt;
      const blocked = resolveMapCollision(g, b, b.radius * 0.8);
      if (blocked || Math.hypot(b.x - ox, b.y - oy) < b.speed * dt * 0.25) {
        b.blockedT += dt;
        if (b.blockedT > 1.2 && b.slideT <= 0) {
          b.slideT = 1.4;
          b.slideDir = -b.slideDir;
          b.blockedT = 0;
        }
      } else {
        b.blockedT = 0;
      }
    } else if (b.attackT <= 0) {
      // Cannon shell: big AoE at the tent (and at the player if close).
      const aimX = p.alive && Math.hypot(p.x - b.x, p.y - b.y) < 420 ? p.x : tx;
      const aimY = p.alive && Math.hypot(p.x - b.x, p.y - b.y) < 420 ? p.y : ty;
      g.mortars.push({ x: b.x, y: b.y, tx: aimX, ty: aimY, t: 0.9, dmg: b.damage, radius: 90, fromBoss: true });
      b.attackT = b.attackRate;
    }
    b.spawnT -= dt;
    if (b.spawnT <= 0) {
      b.spawnT = 7;
      const a = g.rng() * Math.PI * 2;
      spawnEnemy(g, 'grunt', b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 70);
      spawnEnemy(g, 'rusher', b.x + Math.cos(a + 1) * 70, b.y + Math.sin(a + 1) * 70);
    }
  }
}

export function drawBoss(ctx, g) {
  const b = g.boss;
  if (!b || !b.alive) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.kind === 'hornet') {
    // Air unit: shadow on the ground, body above with rotor blur.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(10, 26, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, -14);
    ctx.strokeStyle = 'rgba(200,200,200,0.7)';
    ctx.lineWidth = 3;
    const rot = b.t * 22;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rot) * 46, Math.sin(rot) * 6);
    ctx.lineTo(-Math.cos(rot) * 46, -Math.sin(rot) * 6);
    ctx.stroke();
    ctx.fillStyle = b.flashT > 0 ? '#ffffff' : '#23232a';
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c95a2e';
    ctx.fillRect(-8, -4, 16, 8);
    ctx.fillStyle = '#d64533';
    ctx.beginPath(); ctx.arc(30, 0, 4, 0, Math.PI * 2); ctx.fill();
  } else if (b.kind === 'ironhide') {
    const a = Math.atan2(g.tent.y - b.y, g.tent.x - b.x);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-36, -20, 76, 46);
    ctx.fillStyle = b.flashT > 0 ? '#ffffff' : '#3a3a40';
    ctx.fillRect(-36, -22, 72, 44);
    ctx.fillStyle = '#5a5a62';
    ctx.fillRect(8, -22, 28, 44); // cab
    ctx.fillStyle = '#c95a2e';
    ctx.fillRect(-36, -22, 8, 44); // ram plate
    ctx.fillStyle = '#111';
    for (const wy of [-24, 24]) {
      ctx.beginPath(); ctx.arc(-20, wy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(16, wy, 8, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // Behemoth tank.
    const a = Math.atan2(g.tent.y - b.y, g.tent.x - b.x);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-42, -26, 88, 56);
    ctx.fillStyle = b.flashT > 0 ? '#ffffff' : '#2e2e33';
    ctx.fillRect(-42, -28, 84, 56);
    ctx.fillStyle = '#1a1a1e';
    ctx.fillRect(-46, -30, 92, 10);
    ctx.fillRect(-46, 20, 92, 10);
    ctx.fillStyle = '#3d3d46';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(14, -4, 44, 8); // cannon
    ctx.fillStyle = '#d64533';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Boss health bar with pips.
  const w = 200;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(b.x - w / 2, b.y - b.radius - 26, w, 10);
  ctx.fillStyle = '#d64533';
  ctx.fillRect(b.x - w / 2, b.y - b.radius - 26, w * Math.max(0, b.hp / b.maxHp), 10);
  ctx.strokeStyle = '#e8b13c';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(b.x - w / 2, b.y - b.radius - 26, w, 10);
  ctx.fillStyle = '#e8b13c';
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(b.name, b.x, b.y - b.radius - 32);
}
