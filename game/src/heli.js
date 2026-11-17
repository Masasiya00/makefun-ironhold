// IRONHOLD helicopter: the supply-drop chopper. It flies in from the map
// edge with a rotor thump that gets louder as it nears, hovers over the
// helipad, drops a supply crate on a parachute, and flies away.
import { startRotor, setRotorLevel, stopRotor, playPickup } from './audio.js';
import { spawnCrate } from './radio.js';
import { addFeed } from './state.js';

export function updateHeli(g, dt) {
  const h = g.heli;
  if (!h) { setRotorLevel(0); return; }
  h.t += dt;
  const p = g.player;

  if (h.state === 'in') {
    startRotor();
    const dx = h.tx - h.x, dy = h.ty - h.y;
    const d = Math.hypot(dx, dy);
    const sp = 260;
    if (d < 12) {
      h.state = 'hover';
      h.t = 0;
    } else {
      h.x += (dx / d) * sp * dt;
      h.y += (dy / d) * sp * dt;
    }
  } else if (h.state === 'hover') {
    if (h.t > 1.4 && !h.dropped) {
      h.dropped = true;
      spawnCrate(g, h.tx, h.ty, h.crateKind);
      addFeed(g, 'Supply crate on the helipad — grab it', '#e8b13c');
      playPickup();
    }
    if (h.t > 2.2) {
      h.state = 'out';
      h.t = 0;
    }
  } else if (h.state === 'out') {
    h.x += 300 * dt;
    h.y -= 120 * dt;
    if (h.x > 1750 || h.y < -120) {
      g.heli = null;
      stopRotor();
      return;
    }
  }
  // Rotor volume follows distance to the player.
  const d = Math.hypot(p.x - h.x, p.y - h.y);
  setRotorLevel(Math.max(0, 0.22 - d / 4000));
}

export function drawHeli(ctx, g) {
  const h = g.heli;
  if (!h) return;
  // Ground shadow tracks the chopper.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(h.x + 14, h.y + 34, 44, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(h.x, h.y);
  // Rotor blur (spinning line).
  ctx.strokeStyle = 'rgba(220,220,210,0.75)';
  ctx.lineWidth = 3;
  const rot = h.t * 26;
  ctx.beginPath();
  ctx.moveTo(Math.cos(rot) * 58, Math.sin(rot) * 8);
  ctx.lineTo(-Math.cos(rot) * 58, -Math.sin(rot) * 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(Math.cos(rot + Math.PI / 2) * 58, Math.sin(rot + Math.PI / 2) * 8);
  ctx.lineTo(-Math.cos(rot + Math.PI / 2) * 58, -Math.sin(rot + Math.PI / 2) * 8);
  ctx.stroke();
  // Body: olive fuselage, tail, skids, amber stripe.
  ctx.fillStyle = '#4c5e35';
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-58, -4, 30, 7);
  ctx.fillStyle = '#2c2c26';
  ctx.fillRect(-62, -14, 5, 12);
  ctx.fillStyle = '#e8b13c';
  ctx.fillRect(-20, -5, 26, 4);
  ctx.fillStyle = '#9fc4e8';
  ctx.beginPath(); ctx.ellipse(24, -3, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2c2c26';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-20, 12); ctx.lineTo(-12, 20); ctx.moveTo(20, 12); ctx.lineTo(12, 20); ctx.stroke();
  ctx.restore();
}
