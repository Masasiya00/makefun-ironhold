// IRONHOLD containers: solid cover that blocks bullets with a metallic
// THUNK. Two loot containers outside the wire can be shot open for supplies.
// Bullet-vs-container is checked here so bullets.js stays a dumb pool.
import { circleHitsRect } from './map.js';
import { playThunk, playPickup } from './audio.js';
import { addFeed } from './state.js';
import { spawnCrate } from './radio.js';

// Does a bullet at (x,y) hit any container? Returns the container or null.
export function bulletHitsContainer(g, x, y) {
  for (const c of g.containers) {
    if (circleHitsRect(x, y, 2, c)) return c;
  }
  return null;
}

export function hitContainer(g, c, dmg) {
  playThunk();
  if (!c.loot) return; // ordinary cover: indestructible, just thunks
  c.hp -= dmg;
  if (c.hp <= 0) {
    c.loot = false;
    c.hp = 9999;
    // Loot pops out: ammo for the current weapon + a medkit crate.
    const cur = g.player.weapons[g.player.cur];
    if (cur.reserve !== Infinity) cur.reserve += 60;
    spawnCrate(g, c.x, c.y + 40, 'medkit');
    addFeed(g, 'Loot container cracked open — supplies inside', '#e8b13c');
    playPickup();
  }
}

export function drawContainers(ctx, g) {
  for (const c of g.containers) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = '#00000033';
    ctx.fillRect(-c.w / 2 + 4, -c.h / 2 + 5, c.w, c.h);
    const base = {
      containerRed: '#8e3b2f', containerGreen: '#4c5e35',
      containerNavy: '#2f4458', containerRust: '#a05a28',
    }[c.color] || '#555';
    ctx.fillStyle = base;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    // Corrugation ribs.
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    const ribs = Math.floor(c.w / 14);
    for (let i = 1; i < ribs; i++) {
      const rx = -c.w / 2 + (i * c.w) / ribs;
      ctx.beginPath(); ctx.moveTo(rx, -c.h / 2 + 3); ctx.lineTo(rx, c.h / 2 - 3); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-c.w / 2 + 1, -c.h / 2 + 1, c.w - 2, c.h - 2);
    if (c.loot) {
      // Gold corner marks: this one can be cracked open.
      ctx.fillStyle = '#e8b13c';
      ctx.fillRect(-c.w / 2, -c.h / 2, 10, 10);
      ctx.fillRect(c.w / 2 - 10, -c.h / 2, 10, 10);
      ctx.fillRect(-c.w / 2, c.h / 2 - 10, 10, 10);
      ctx.fillRect(c.w / 2 - 10, c.h / 2 - 10, 10, 10);
    }
    ctx.restore();
  }
}
