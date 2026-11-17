// IRONHOLD bullets: two fixed pools (player + enemy). A bullet is a fast
// tracer with a travelled distance; it dies on range, on a container
// (metallic thunk), on a sandbag, on the tent, or on a body. Damage numbers
// and hitmarkers come from here.
import { CONFIG } from './config.js';
import { bulletHitsContainer, hitContainer } from './containers.js';
import { circleHitsRect, nearestSandbag } from './map.js';
import { playHit, playKill } from './audio.js';
import { spawnHitSparks, spawnBlood, addFloatText } from './particles.js';
import { damagePlayer } from './player.js';
import { addFeed } from './state.js';

export function fireBullet(g, x, y, angle, speed, dmg, range, kind, crit) {
  for (const b of g.bullets) {
    if (b.active) continue;
    b.active = true;
    b.x = x; b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.life = range / speed + 0.05;
    b.dmg = dmg;
    b.crit = !!crit;
    b.kind = kind;
    b.range = range;
    b.traveled = 0;
    return;
  }
}

export function fireEnemyBullet(g, x, y, angle, speed, dmg, range) {
  for (const b of g.ebullets) {
    if (b.active) continue;
    b.active = true;
    b.x = x; b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.life = range / speed + 0.05;
    b.dmg = dmg;
    b.range = range;
    b.traveled = 0;
    return;
  }
}

function killBullet(b) { b.active = false; }

export function updateBullets(g, dt) {
  // --- Player bullets ---
  for (const b of g.bullets) {
    if (!b.active) continue;
    const step = dt;
    b.x += b.vx * step;
    b.y += b.vy * step;
    b.traveled += Math.hypot(b.vx, b.vy) * step;
    b.life -= step;
    if (b.life <= 0 || b.traveled > b.range) { killBullet(b); continue; }
    // Containers stop bullets with a thunk.
    const cont = bulletHitsContainer(g, b.x, b.y);
    if (cont) { hitContainer(g, cont, b.dmg); spawnHitSparks(g, b.x, b.y, '#c8c8c8'); killBullet(b); continue; }
    // NOTE: player bullets fly OVER the sandbags — the commander shoots from
    // behind the line. Only enemy bullets are stopped by the bags (cover).
    // Enemies.
    let hitSomething = false;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const dx = e.x - b.x, dy = e.y - b.y;
      const rr = e.radius + 3;
      if (dx * dx + dy * dy < rr * rr) {
        damageEnemy(g, e, b.dmg, b.crit, b.kind);
        spawnHitSparks(g, b.x, b.y, '#ffd75e');
        killBullet(b);
        hitSomething = true;
        break;
      }
    }
    if (hitSomething) continue;
    // Boss.
    if (g.boss && g.boss.alive) {
      const e = g.boss;
      const dx = e.x - b.x, dy = e.y - b.y;
      const rr = e.radius + 3;
      if (dx * dx + dy * dy < rr * rr) {
        damageEnemy(g, e, b.dmg, b.crit, b.kind);
        spawnHitSparks(g, b.x, b.y, '#ffd75e');
        killBullet(b);
        continue;
      }
    }
    // NOTE: player bullets fly over the low command tent (it is your own
    // firebase — you shoot over its roof). Enemy bullets still hit it.
  }

  // --- Enemy bullets ---
  for (const b of g.ebullets) {
    if (!b.active) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.traveled += Math.hypot(b.vx, b.vy) * dt;
    b.life -= dt;
    if (b.life <= 0 || b.traveled > b.range) { killBullet(b); continue; }
    if (bulletHitsContainer(g, b.x, b.y)) { spawnHitSparks(g, b.x, b.y, '#c8c8c8'); killBullet(b); continue; }
    if (nearestSandbag(g, b.x, b.y, 24)) { spawnHitSparks(g, b.x, b.y, '#b59a68'); killBullet(b); continue; }
    // Player.
    const p = g.player;
    if (p.alive) {
      const dx = p.x - b.x, dy = p.y - b.y;
      if (dx * dx + dy * dy < 18 * 18) {
        damagePlayerFromBullet(g, b);
        killBullet(b);
        continue;
      }
    }
    // Tent.
    if (circleHitsRect(b.x, b.y, 2, { x: g.tent.x, y: g.tent.y, w: 92, h: 76 })) {
      damageTent(g, b.dmg);
      spawnHitSparks(g, b.x, b.y, '#e8b13c');
      killBullet(b);
    }
  }
}

function damagePlayerFromBullet(g, b) {
  // Smoke hides the player: bullets that cross smoke lose half their damage.
  let dmg = b.dmg;
  if (playerInSmoke(g)) dmg *= 0.5;
  damagePlayer(g, dmg, b.x - b.vx * 0.02, b.y - b.vy * 0.02);
}

function playerInSmoke(g) {
  const p = g.player;
  for (const s of g.smokes) {
    const dx = s.x - p.x, dy = s.y - p.y;
    if (dx * dx + dy * dy < s.radius * s.radius) return true;
  }
  return false;
}

export function damageTent(g, dmg) {
  g.tent.hp -= dmg;
  if (g.tent.hp <= 0) {
    g.tent.hp = 0;
    g.integrity = 0;
  }
}

export function damageEnemy(g, e, dmg, crit, kind) {
  if (!e.alive) return;
  // Shield-bearers shrug off half the damage from the front.
  let finalDmg = dmg;
  if (e.kind === 'shield') finalDmg = dmg * 0.55;
  if (e.kind === 'behemoth') finalDmg = dmg * 0.8; // tank armor
  e.hp -= finalDmg;
  e.flashT = 0.09;
  // Accuracy counts bullet hits only: mortar and airstrike damage is not
  // aimed fire, and counting it pushed accuracy past 100%.
  if (kind !== 'mortar' && kind !== 'strike') g.shotsHit += 1;
  g.damageDealt += finalDmg;
  playHit();
  addFloatText(g, e.x, e.y - e.radius - 6, String(Math.round(finalDmg)), crit ? '#ffdf6e' : '#f2ead2', crit ? 18 : 13);
  if (e.hp <= 0) {
    e.alive = false;
    e.deathT = 0;
    onEnemyKilled(g, e);
  }
}

export function onEnemyKilled(g, e) {
  const isBoss = e.isBoss === true;
  const kindKey = isBoss ? 'boss' : e.kind;
  g.kills += 1;
  g.assaultKills += 1;
  g.combo += 1;
  g.comboTimer = 3.5;
  if (g.combo > g.bestCombo) g.bestCombo = g.combo;
  const cmd = (CONFIG.commandPerKill[kindKey] || 2) + (g.doctrines.includes('radio') ? 1 : 0);
  g.command += cmd;
  const sc = (CONFIG.scorePerKill[kindKey] || 100) * (1 + Math.min(g.combo, 20) * 0.05);
  g.score += Math.round(sc);
  spawnBlood(g, e.x, e.y, e.color || '#a33327');
  playKill();
  if (isBoss) {
    g.boss = null;
    g.bossName = '';
    addFloatText(g, e.x, e.y - 40, e.name + ' DOWN!', '#e8b13c', 24);
  }
  // Kill feed line.
  addFeed(g, 'You eliminated ' + (e.name || e.kind), isBoss ? '#e8b13c' : '#e8dfc0');
}

export function drawBullets(ctx, g) {
  ctx.lineCap = 'round';
  for (const b of g.bullets) {
    if (!b.active) continue;
    const len = 16;
    const nx = b.vx / Math.hypot(b.vx, b.vy), ny = b.vy / Math.hypot(b.vx, b.vy);
    ctx.strokeStyle = b.crit ? '#fff3c4' : '#ffd75e';
    ctx.lineWidth = b.crit ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(b.x - nx * len, b.y - ny * len);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const b of g.ebullets) {
    if (!b.active) continue;
    const len = 12;
    const nx = b.vx / Math.hypot(b.vx, b.vy), ny = b.vy / Math.hypot(b.vx, b.vy);
    ctx.strokeStyle = '#ff5a3c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - nx * len, b.y - ny * len);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
