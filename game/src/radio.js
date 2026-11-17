// IRONHOLD radio: the RADIO COMMAND mechanic. Kills earn command points;
// Q/E/R/F spend them on support with a radio order, a beep, and a visible,
// audible result on the battlefield. Crates (medkit / ammo / weapon) and
// falling mortar shells live here too.
import { CALLINS, WEAPONS } from './config.js';
import { setRadio, addFeed, weaponState } from './state.js';
import { playRadioBeep, playRadioStatic, playMortarWhistle, playExplosion, playPickup, playSmokeHiss } from './audio.js';
import { spawnExplosion, addFloatText } from './particles.js';
import { unlockWeapon, nextLockedWeapon, giveAmmo } from './weapons.js';
import { healPlayer, repairArmor, damagePlayer } from './player.js';
import { damageEnemy, damageTent } from './bullets.js';
import { startJetSound } from './jets.js';

export function tryCallIn(g, id, tx, ty) {
  const def = CALLINS[id];
  if (!def) return false;
  if (g.callCooldowns[id] > 0) {
    addFeed(g, def.name + ' recharging (' + Math.ceil(g.callCooldowns[id]) + 's)', '#a89a6e');
    return false;
  }
  if (g.command < def.cost) {
    addFeed(g, 'Not enough COMMAND for ' + def.name + ' (' + def.cost + ')', '#d64533');
    playRadioStatic();
    return false;
  }
  g.command -= def.cost;
  const cd = def.cooldown * (g.doctrines.includes('radio') ? 0.7 : 1);
  g.callCooldowns[id] = cd;
  playRadioBeep();
  playRadioStatic();

  if (id === 'supply') {
    setRadio(g, 'COMMAND: ' + def.order);
    startSupplyHeli(g);
  } else if (id === 'strike') {
    setRadio(g, 'COMMAND: ' + def.order + ' ' + gridRef(tx, ty));
    startJetStrike(g, tx, ty);
  } else if (id === 'mortar') {
    setRadio(g, 'COMMAND: ' + def.order + ' ' + gridRef(tx, ty));
    startMortar(g, tx, ty, false);
  } else if (id === 'smoke') {
    setRadio(g, 'COMMAND: ' + def.order);
    deploySmoke(g, tx, ty);
  }
  return true;
}

export function gridRef(x, y) {
  const col = Math.max(1, Math.min(8, Math.floor(x / 200) + 1));
  const row = Math.max(1, Math.min(6, Math.floor(y / 200) + 1));
  return 'grid ' + col + '-' + row;
}

export function startSupplyHeli(g) {
  if (g.heli) return;
  g.heli = { x: -80, y: 180, state: 'in', t: 0, tx: g.helipad.x, ty: g.helipad.y, crateKind: 'supply' };
}

export function startJetStrike(g, tx, ty) {
  if (g.jet) return;
  // Jet enters from the left edge and crosses over the target.
  const fromLeft = g.rng() < 0.5;
  g.jet = {
    x: fromLeft ? -100 : 1700, y: ty - 160,
    vx: (fromLeft ? 1 : -1) * 640, vy: 0,
    tx, ty, state: 'fly', struck: false, t: 0,
  };
  startJetSound();
}

export function startMortar(g, tx, ty, fromBoss) {
  // Six shells whistle in over ~2.5 s around the target point.
  for (let i = 0; i < 6; i++) {
    g.mortars.push({
      x: tx + (g.rng() - 0.5) * 170,
      y: ty + (g.rng() - 0.5) * 170,
      tx: tx + (g.rng() - 0.5) * 60,
      ty: ty + (g.rng() - 0.5) * 60,
      t: 0.55 + i * 0.42 + g.rng() * 0.2,
      dmg: 70, radius: 95, fromBoss: !!fromBoss,
    });
  }
  playMortarWhistle();
}

export function deploySmoke(g, tx, ty) {
  g.smokes.push({
    x: tx, y: ty, radius: 30, maxRadius: 130,
    life: 8, maxLife: 8, driftX: 14, driftY: -4, fromBlast: false,
  });
  playSmokeHiss();
  addFeed(g, 'Smoke screen deployed — enemy fire blocked', '#9a9a92');
}

export function spawnCrate(g, x, y, kind) {
  g.crates.push({ x, y, kind, t: 0, bob: g.rng() * Math.PI * 2 });
}

export function updateRadio(g, dt) {
  for (const id of Object.keys(g.callCooldowns)) {
    if (g.callCooldowns[id] > 0) g.callCooldowns[id] -= dt;
  }
  if (g.radioT > 0) g.radioT -= dt;

  // Mortar shells fall and explode.
  for (let i = g.mortars.length - 1; i >= 0; i--) {
    const m = g.mortars[i];
    m.t -= dt;
    if (m.t <= 0) {
      spawnExplosion(g, m.tx, m.ty, 1.0, true);
      playExplosion(1);
      if (m.fromBoss) {
        // Boss shells hurt the player and the tent.
        const p = g.player;
        const dp = Math.hypot(p.x - m.tx, p.y - m.ty);
        if (p.alive && dp < m.radius) damagePlayer(g, m.dmg * (1 - dp / m.radius / 2), m.tx, m.ty);
        const dtent = Math.hypot(g.tent.x - m.tx, g.tent.y - m.ty);
        if (dtent < m.radius + 30) damageTent(g, m.dmg * 0.5);
      } else {
        // Friendly mortars shred enemies in the blast.
        for (const e of g.enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(e.x - m.tx, e.y - m.ty);
          if (d < m.radius) damageEnemy(g, e, m.dmg * (1 - d / m.radius / 2), false, 'mortar');
        }
        if (g.boss && g.boss.alive) {
          const d = Math.hypot(g.boss.x - m.tx, g.boss.y - m.ty);
          if (d < m.radius + 20) damageEnemy(g, g.boss, m.dmg * 0.7, false, 'mortar');
        }
      }
      g.mortars.splice(i, 1);
    }
  }

  // Airstrike blasts (staggered).
  for (let i = g.strikes.length - 1; i >= 0; i--) {
    const s = g.strikes[i];
    s.t -= dt;
    if (s.t <= 0) {
      spawnExplosion(g, s.x, s.y, 1.3, true);
      playExplosion(1.3);
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < s.radius) damageEnemy(g, e, s.dmg * (1 - d / s.radius / 2), false, 'strike');
      }
      if (g.boss && g.boss.alive) {
        const d = Math.hypot(g.boss.x - s.x, g.boss.y - s.y);
        if (d < s.radius + 20) damageEnemy(g, g.boss, s.dmg * 0.7, false, 'strike');
      }
      g.strikes.splice(i, 1);
    }
  }

  // Crates: bob, and get picked up by walking over them.
  const p = g.player;
  for (let i = g.crates.length - 1; i >= 0; i--) {
    const c = g.crates[i];
    c.t += dt;
    if (!p.alive) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < 34) {
      applyCrate(g, c);
      g.crates.splice(i, 1);
    }
  }
}

function applyCrate(g, c) {
  playPickup();
  if (c.kind === 'medkit') {
    healPlayer(g, 45);
    addFeed(g, 'Medkit picked up (+45 HP)', '#7fb069');
    addFloatText(g, g.player.x, g.player.y - 26, '+45 HP', '#7fb069', 16);
  } else if (c.kind === 'ammo') {
    giveAmmo(g, 60);
    addFeed(g, 'Ammo resupply (+60 all weapons)', '#e8b13c');
  } else if (c.kind === 'weapon') {
    const next = nextLockedWeapon(g);
    if (next) {
      unlockWeapon(g, next);
      addFeed(g, 'New weapon unlocked: ' + WEAPONS[next].name, '#e8b13c');
      addFloatText(g, g.player.x, g.player.y - 26, WEAPONS[next].name + '!', '#e8b13c', 18);
    } else {
      giveAmmo(g, 90);
      addFeed(g, 'Ammo resupply (+90 all weapons)', '#e8b13c');
    }
  } else if (c.kind === 'supply') {
    healPlayer(g, 25);
    repairArmor(g, 25);
    giveAmmo(g, 60);
    const next = nextLockedWeapon(g);
    if (next) {
      unlockWeapon(g, next);
      addFeed(g, 'Supply drop received: ' + WEAPONS[next].name + ' unlocked', '#e8b13c');
    } else {
      addFeed(g, 'Supply drop received: +25 HP, +25 armor, +60 ammo', '#e8b13c');
    }
  }
}

export function drawCrates(ctx, g) {
  for (const c of g.crates) {
    const bob = Math.sin(c.t * 3 + c.bob) * 2;
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 12, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    const color = c.kind === 'medkit' ? '#7fb069' : c.kind === 'weapon' ? '#e8b13c' : c.kind === 'supply' ? '#d8c25a' : '#9fc4e8';
    ctx.fillStyle = '#5a4a28';
    ctx.fillRect(-14, -12, 28, 24);
    ctx.fillStyle = color;
    ctx.fillRect(-14, -12, 28, 6);
    ctx.strokeStyle = '#2c2c26';
    ctx.lineWidth = 2;
    ctx.strokeRect(-14, -12, 28, 24);
    ctx.fillStyle = '#f2ead2';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(c.kind === 'medkit' ? '+' : c.kind === 'weapon' ? 'W' : c.kind === 'supply' ? 'S' : 'A', 0, 6);
    ctx.restore();
  }
  // Mortar target markers (incoming whistles).
  for (const m of g.mortars) {
    const pulse = 0.5 + Math.sin(g.time * 14) * 0.3;
    ctx.strokeStyle = 'rgba(255,90,60,' + pulse + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.tx, m.ty, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m.tx - 8, m.ty); ctx.lineTo(m.tx + 8, m.ty);
    ctx.moveTo(m.tx, m.ty - 8); ctx.lineTo(m.tx, m.ty + 8);
    ctx.stroke();
  }
}
