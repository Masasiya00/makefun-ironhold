// IRONHOLD weapons: five guns, each with its own stats, sound and feel.
// Firing is driven from the fixed step: hold click for autos, click per
// shot for semi-autos. Reloads, casings, muzzle flash, recoil and tracers
// all happen here; the bullet pool lives in bullets.js.
import { WEAPONS } from './config.js';
import { currentWeapon, currentWeaponDef, weaponState } from './state.js';
import { fireBullet } from './bullets.js';
import { playShot, playReload, playCasing } from './audio.js';

export function magSize(g, id) {
  const base = WEAPONS[id].mag;
  return Math.round(base * (g.doctrines.includes('mags') ? 1.5 : 1));
}

export function fireRate(g, id) {
  const base = WEAPONS[id].rate;
  return base * (g.doctrines.includes('rapid') ? 0.85 : 1);
}

export function weaponRange(g, id) {
  const base = WEAPONS[id].range;
  return base * (g.doctrines.includes('barrel') ? 1.25 : 1);
}

export function tryFire(g, input) {
  const p = g.player;
  if (!p.alive || p.reloading || p.fireT > 0) return;
  const cur = currentWeapon(g);
  const def = currentWeaponDef(g);
  const wantFire = def.auto ? input.mouseDown : input.mouseDown && !input.mouseDownPrev;
  if (!wantFire) return;
  if (cur.mag <= 0) {
    startReload(g);
    return;
  }
  // Fire!
  cur.mag -= 1;
  p.fireT = fireRate(g, cur.id);
  p.muzzleT = 0.06;
  p.recoil = def.kick;
  g.shotsFired += def.pellets;
  const spread = def.spread;
  const critChance = 0.05 + (g.doctrines.includes('lucky') ? 0.12 : 0);
  for (let i = 0; i < def.pellets; i++) {
    const a = p.angle + (g.rng() - 0.5) * 2 * spread + (def.pellets > 1 ? (i - (def.pellets - 1) / 2) * spread * 0.9 : 0);
    const crit = g.rng() < critChance;
    fireBullet(g, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, a,
      def.speed, def.damage * (crit ? 2 : 1), weaponRange(g, cur.id), cur.id, crit);
  }
  playShot(def.sound);
  spawnCasing(g, p.x, p.y, p.angle);
  // Recoil pushes the player back a touch.
  p.x -= Math.cos(p.angle) * def.kick * 0.4;
  p.y -= Math.sin(p.angle) * def.kick * 0.4;
  if (cur.mag === 0) startReload(g);
}

export function startReload(g) {
  const p = g.player;
  const cur = currentWeapon(g);
  const def = currentWeaponDef(g);
  if (p.reloading) return;
  if (cur.mag >= magSize(g, cur.id)) return;
  if (cur.reserve === 0) return; // dry, nothing to load
  p.reloading = true;
  p.reloadT = def.reload;
  playReload();
}

export function switchWeapon(g, index) {
  const p = g.player;
  if (index < 0 || index >= p.weapons.length) return;
  if (!p.weapons[index].unlocked) return;
  if (p.cur === index) return;
  p.cur = index;
  p.reloading = false;
  p.fireT = Math.max(p.fireT, 0.12);
}

export function unlockWeapon(g, id) {
  const w = weaponState(g, id);
  if (!w || w.unlocked) return false;
  w.unlocked = true;
  w.reserve = WEAPONS[id].startAmmo;
  w.mag = WEAPONS[id].mag;
  return true;
}

export function nextLockedWeapon(g) {
  for (const id of ['rifle', 'shotgun', 'sniper']) {
    if (!weaponState(g, id).unlocked) return id;
  }
  return null;
}

export function giveAmmo(g, amount) {
  // Spread ammo across owned weapons that take it.
  for (const w of g.player.weapons) {
    if (!w.unlocked || w.reserve === Infinity) continue;
    w.reserve += amount;
  }
}

function spawnCasing(g, x, y, angle) {
  for (const c of g.casings) {
    if (c.active) continue;
    c.active = true;
    const a = angle + Math.PI / 2 + (g.rng() - 0.5) * 0.8;
    c.x = x; c.y = y;
    c.vx = Math.cos(a) * (60 + g.rng() * 60);
    c.vy = Math.sin(a) * (60 + g.rng() * 60);
    c.rot = g.rng() * Math.PI * 2;
    c.vr = (g.rng() - 0.5) * 18;
    c.life = 0.9;
    playCasing();
    return;
  }
}

export function updateCasings(g, dt) {
  for (const c of g.casings) {
    if (!c.active) continue;
    c.life -= dt;
    if (c.life <= 0) { c.active = false; continue; }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.vx *= 0.92; c.vy *= 0.92;
    c.rot += c.vr * dt;
  }
}

export function drawCasings(ctx, g) {
  ctx.fillStyle = '#d8b45a';
  for (const c of g.casings) {
    if (!c.active) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.globalAlpha = Math.min(1, c.life * 2);
    ctx.fillRect(-3, -1.5, 6, 3);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
