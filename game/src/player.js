// IRONHOLD player: WASD movement with sprint, mouse aim, health + flak
// armor (armor absorbs first), regen doctrine, river slowdown, and the
// damage path (armor first, then HP, with flash + shake).
import { CONFIG } from './config.js';
import { resolveMapCollision, inRiver } from './map.js';
import { clamp } from './random.js';

export function updatePlayer(g, input, dt) {
  const p = g.player;
  if (!p.alive) return;

  // Aim follows the mouse (world coordinates come from main.js).
  p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);

  const sprinting = (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')) && p.sprintT <= 0;
  let speed = p.speed * (sprinting ? CONFIG.playerSprint / CONFIG.playerSpeed : 1);
  if (inRiver(p.x)) speed *= 0.62; // wading the river is slow
  if (p.hidden > 0) speed *= 0.9;

  const mx = input.moveX, my = input.moveY;
  p.vx = mx * speed;
  p.vy = my * speed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  resolveMapCollision(g, p, 15);

  // Footstep dust while moving.
  if ((mx !== 0 || my !== 0) && g.stepCount % 14 === 0) {
    spawnDust(g, p.x - mx * 12, p.y - my * 12);
  }

  if (p.reloading) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      p.reloading = false;
      finishReload(g);
    }
  }
  if (p.fireT > 0) p.fireT -= dt;
  if (p.muzzleT > 0) p.muzzleT -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.hidden > 0) p.hidden -= dt;
  if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 30);

  // Combat Medic doctrine: slow regen.
  if (p.regen > 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  }
}

function spawnDust(g, x, y) {
  for (const pt of g.particles) {
    if (pt.active) continue;
    pt.active = true;
    pt.x = x; pt.y = y;
    pt.vx = (g.rng() - 0.5) * 24; pt.vy = -12 - g.rng() * 18;
    pt.life = pt.maxLife = 0.5;
    pt.size = 4 + g.rng() * 4;
    pt.color = 'rgba(200,185,140,0.5)';
    pt.glow = false; pt.grav = 0;
    return;
  }
}

export function finishReload(g) {
  const p = g.player;
  const cur = p.weapons[p.cur];
  const def = { pistol: 12, smg: 32, rifle: 30, shotgun: 6, sniper: 5 }[cur.id];
  const magSize = Math.round(def * (g.doctrines.includes('mags') ? 1.5 : 1));
  if (cur.reserve === Infinity) {
    cur.mag = magSize;
    return;
  }
  const need = magSize - cur.mag;
  const take = Math.min(need, cur.reserve);
  cur.mag += take;
  cur.reserve -= take;
}

export function damagePlayer(g, dmg, fromX, fromY) {
  const p = g.player;
  if (!p.alive || g.screen !== 'play') return;
  let remaining = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, remaining);
    p.armor -= absorbed;
    remaining -= absorbed;
  }
  p.hp -= remaining;
  p.hurtT = 0.35;
  g.flash = 0.35;
  g.flashColor = '255,60,40';
  g.shake = Math.max(g.shake, 7);
  if (fromX !== undefined) {
    // Knockback away from the hit.
    const a = Math.atan2(p.y - fromY, p.x - fromX);
    p.x += Math.cos(a) * 6;
    p.y += Math.sin(a) * 6;
  }
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
  }
}

export function healPlayer(g, amount) {
  const p = g.player;
  p.hp = clamp(p.hp + amount, 0, p.maxHp);
}

export function repairArmor(g, amount) {
  const p = g.player;
  p.armor = clamp(p.armor + amount, 0, p.maxArmor);
}

export function drawPlayer(ctx, g) {
  const p = g.player;
  if (!p.alive) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 6, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
  // Body: olive circle with amber ring (the commander).
  ctx.rotate(p.angle);
  // Gun barrel.
  ctx.fillStyle = '#2c2c26';
  ctx.fillRect(10, -3, 22, 6);
  // Muzzle flash sprite while firing.
  if (p.muzzleT > 0 && g.sprites) {
    ctx.drawImage(g.sprites.muzzle, 26, -22, 44, 44);
  }
  ctx.rotate(-p.angle);
  ctx.fillStyle = '#4c5e35';
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b13c';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  // Helmet + face direction wedge.
  ctx.fillStyle = '#3d4a2a';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b13c';
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(6, -6); ctx.lineTo(6, 6);
  ctx.closePath(); ctx.fill();
  // Hurt flash ring.
  if (p.hurtT > 0) {
    ctx.strokeStyle = 'rgba(255,60,40,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
