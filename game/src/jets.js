// IRONHOLD jets: the airstrike flyover. A jet screams across the firebase
// over the marked grid, and as it passes the target the strike zone erupts
// in three staggered blasts with bomb smoke.
import { playJetRoar, playExplosion } from './audio.js';
import { spawnExplosion } from './particles.js';

export function updateJet(g, dt) {
  const j = g.jet;
  if (!j) return;
  j.t += dt;
  j.x += j.vx * dt;
  // The strike lands as the jet passes over the target.
  if (!j.struck && ((j.vx > 0 && j.x >= j.tx) || (j.vx < 0 && j.x <= j.tx))) {
    j.struck = true;
    for (let i = 0; i < 3; i++) {
      g.strikes.push({
        x: j.tx + (g.rng() - 0.5) * 150,
        y: j.ty + (g.rng() - 0.5) * 150,
        t: 0.15 + i * 0.28,
        dmg: 130, radius: 130,
      });
    }
    playExplosion(1.4);
  }
  if (j.x < -260 || j.x > 1860) {
    g.jet = null;
  }
}

export function startJetSound() {
  playJetRoar();
}

export function drawJet(ctx, g) {
  const j = g.jet;
  if (!j) return;
  ctx.save();
  ctx.translate(j.x, j.y);
  // Exhaust trail.
  ctx.strokeStyle = 'rgba(255,180,80,0.7)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(j.vx > 0 ? -70 : 70, 0);
  ctx.lineTo(j.vx > 0 ? -26 : 26, 0);
  ctx.stroke();
  // Swept-wing jet silhouette.
  const dir = j.vx > 0 ? 1 : -1;
  ctx.scale(dir, 1);
  ctx.fillStyle = '#3d3d46';
  ctx.beginPath();
  ctx.moveTo(30, 0); ctx.lineTo(-18, -6); ctx.lineTo(-26, -16); ctx.lineTo(-14, -3);
  ctx.lineTo(-26, 2); ctx.lineTo(-26, 8); ctx.lineTo(-12, 5); ctx.lineTo(-18, 14);
  ctx.lineTo(-8, 6); ctx.lineTo(30, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9fc4e8';
  ctx.beginPath(); ctx.ellipse(14, -2, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Strike zone marker while the jet is inbound.
  if (!j.struck) {
    const pulse = 0.4 + Math.sin(g.time * 12) * 0.25;
    ctx.strokeStyle = 'rgba(255,120,40,' + pulse + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(j.tx, j.ty, 120, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(j.tx, j.ty, 80, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,40,' + pulse + ')';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STRIKE INBOUND', j.tx, j.ty - 132);
  }
}
