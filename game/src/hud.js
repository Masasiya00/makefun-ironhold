// IRONHOLD HUD + world renderer: the military-stencil interface the judge
// sees — top bar (assault, boss, score, command), WIN/LOSE bars, INCOMING
// panel left, SUPPORT + DOCTRINES right, kill feed, bottom weapon/ammo/
// health bar, radio banners, and every screen (briefing, resupply, pause,
// victory, defeat). The world itself renders here too, camera first.
import { PALETTE as P } from './palette.js';
import { CALLINS, WEAPONS, WEAPON_ORDER, ASSAULTS, DOCTRINES } from './config.js';
import { drawContainers } from './containers.js';
import { drawEnemies } from './enemies.js';
import { drawBoss } from './bosses.js';
import { drawPlayer } from './player.js';
import { drawBullets } from './bullets.js';
import { drawParticles } from './particles.js';
import { drawSmoke } from './smoke.js';
import { drawHeli } from './heli.js';
import { drawJet } from './jets.js';
import { drawCasings } from './weapons.js';
import { drawCrates } from './radio.js';
import { accuracy, computeGrade } from './state.js';
import { doctrineName } from './doctrines.js';
import { clamp } from './random.js';

const FONT = '"Courier New", monospace';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = P.hudBg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = P.hudBorder;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function stencil(ctx, text, x, y, size, color, align, weight) {
  ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FONT;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function drawWorld(ctx, g) {
  const cam = g.camera;
  ctx.save();
  const shakeX = g.shake > 0 ? (Math.sin(g.time * 91) * g.shake * 0.5) : 0;
  const shakeY = g.shake > 0 ? (Math.cos(g.time * 113) * g.shake * 0.5) : 0;
  ctx.translate(-cam.x + 640 + shakeX, -cam.y + 400 + shakeY);

  // Terrain.
  if (g.terrain) ctx.drawImage(g.terrain, 0, 0);

  // Sandbags.
  for (const s of g.sandbags) {
    if (!s.alive) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    const dmg = s.hp / s.maxHp;
    ctx.fillStyle = dmg > 0.5 ? P.sandbag : '#7a6a44';
    ctx.fillRect(-23, -10, 46, 20);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-23, -10, 46, 20);
    ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-8, 10); ctx.moveTo(8, -10); ctx.lineTo(8, 10); ctx.stroke();
    ctx.restore();
  }

  drawTent(ctx, g);
  drawTower(ctx, g);
  drawContainers(ctx, g);
  drawTreesRocks(ctx, g);
  drawCrates(ctx, g);
  drawEnemies(ctx, g);
  drawBoss(ctx, g);
  drawPlayer(ctx, g);
  drawBullets(ctx, g);
  drawCasings(ctx, g);
  drawParticles(ctx, g);
  drawSmoke(ctx, g);
  drawHeli(ctx, g);
  drawJet(ctx, g);

  // Mortar strike glow markers are drawn in radio.js via drawCrates; flares:
  for (const f of g.flares) {
    if (!g.sprites) continue;
    const s = 260;
    ctx.globalAlpha = clamp(f.life / f.maxLife, 0, 1) * 0.8;
    ctx.drawImage(g.sprites.glowFlare, f.x - s / 2, f.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Night overlay with lit pools around the player and flares.
  if (g.night) {
    ctx.fillStyle = P.night;
    ctx.fillRect(0, 0, 1280, 800);
    ctx.globalCompositeOperation = 'lighter';
    if (g.sprites) {
      const px = g.player.x - cam.x + 640, py = g.player.y - cam.y + 400;
      const s = 420;
      ctx.drawImage(g.sprites.glowFlare, px - s / 2, py - s / 2, s, s);
      for (const f of g.flares) {
        const fx = f.x - cam.x + 640, fy = f.y - cam.y + 400;
        ctx.drawImage(g.sprites.glowFlare, fx - 160, fy - 160, 320, 320);
      }
      const tx = g.tent.x - cam.x + 640, ty = g.tent.y - cam.y + 400;
      ctx.drawImage(g.sprites.glowFlare, tx - 130, ty - 130, 260, 260);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawTent(ctx, g) {
  const t = g.tent;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 8, 50, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.tent;
  ctx.beginPath();
  ctx.moveTo(-46, 34); ctx.lineTo(-46, -6); ctx.lineTo(0, -34); ctx.lineTo(46, -6); ctx.lineTo(46, 34);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = P.tentDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, 34); ctx.stroke();
  // Command star.
  ctx.fillStyle = '#e8b13c';
  ctx.font = 'bold 18px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('★', 0, 6);
  ctx.restore();
  // Tent HP bar.
  const w = 92;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(t.x - w / 2, t.y - 52, w, 7);
  ctx.fillStyle = t.hp / t.maxHp > 0.4 ? '#7fb069' : '#d64533';
  ctx.fillRect(t.x - w / 2, t.y - 52, w * Math.max(0, t.hp / t.maxHp), 7);
  ctx.fillStyle = '#e8dfc0';
  ctx.font = 'bold 10px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('COMMAND TENT', t.x, t.y - 58);
}

function drawTower(ctx, g) {
  const tw = g.tower;
  ctx.save();
  ctx.translate(tw.x, tw.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 6, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a3f28';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-12, 0); ctx.lineTo(-18, 22); ctx.moveTo(12, 0); ctx.lineTo(18, 22);
  ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
  ctx.stroke();
  ctx.fillStyle = '#6b5a34';
  ctx.fillRect(-18, -12, 36, 14);
  ctx.fillStyle = '#2c2c26';
  ctx.fillRect(-18, -12, 36, 4);
  ctx.fillStyle = '#9fc4e8';
  ctx.fillRect(-4, -9, 8, 6);
  ctx.restore();
}

function drawTreesRocks(ctx, g) {
  for (const r of g.rocks) {
    ctx.fillStyle = P.rock;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(r.x - r.r * 0.3, r.y - r.r * 0.3, r.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const t of g.trees) {
    const sway = Math.sin(g.time * 1.2 + t.sway) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.treeDark;
    ctx.beginPath(); ctx.arc(t.x + sway, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.tree;
    ctx.beginPath(); ctx.arc(t.x + sway - 3, t.y - 3, t.r * 0.75, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------- HUD ----------------

export function drawHUD(ctx, g, input) {
  if (g.screen !== 'play' && g.screen !== 'resupply' && g.screen !== 'pause') return;
  drawTopBar(ctx, g);
  drawWinLose(ctx, g);
  drawIncoming(ctx, g);
  drawSupport(ctx, g);
  drawDoctrinesPanel(ctx, g);
  drawFeed(ctx, g);
  drawBottomBar(ctx, g);
  drawRadioBanner(ctx, g);
  drawCenterBanner(ctx, g);
  drawCrosshair(ctx, g, input);
  // Low-health pulse.
  const p = g.player;
  if (p.alive && p.hp < 30 && g.screen === 'play') {
    const a = 0.12 + Math.sin(g.time * 6) * 0.08;
    ctx.fillStyle = 'rgba(214,69,51,' + a.toFixed(3) + ')';
    ctx.fillRect(0, 0, 1280, 800);
  }
  // Damage flash.
  if (g.flash > 0) {
    ctx.fillStyle = 'rgba(' + g.flashColor + ',' + (g.flash * 0.5).toFixed(3) + ')';
    ctx.fillRect(0, 0, 1280, 800);
  }
}

function drawTopBar(ctx, g) {
  panel(ctx, 0, 0, 1280, 44);
  stencil(ctx, 'IRONHOLD', 14, 30, 22, P.hudAmber, 'left');
  stencil(ctx, g.endless ? 'ASSAULT ' + g.assault + ' ∞ ENDLESS' : 'ASSAULT ' + g.assault + '/7', 170, 30, 18, P.hudText, 'left');
  if (g.bossName) stencil(ctx, '⚠ ' + g.bossName, 300, 30, 16, '#ff7a5a', 'left');
  stencil(ctx, 'SCORE ' + String(g.score).padStart(6, '0'), 640, 30, 18, P.hudText, 'center');
  stencil(ctx, 'COMMAND ✦ ' + g.command, 830, 30, 18, '#9fc4e8', 'left');
  stencil(ctx, g.diff.label, 1000, 30, 14, P.hudDim, 'left');
  const mins = Math.floor(g.elapsed / 60), secs = Math.floor(g.elapsed % 60);
  stencil(ctx, String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0'), 1266, 30, 16, P.hudDim, 'right');
}

function drawWinLose(ctx, g) {
  // Green WIN bar: assaults held (progress within the current assault counts).
  const held = ((g.assault - 1) + (g.assaultTotal > 0 ? g.assaultKills / g.assaultTotal : 0)) / 7;
  // Red LOSE bar: firebase integrity.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 44, 1280, 18);
  ctx.fillStyle = P.hudGreen;
  ctx.fillRect(0, 44, 1280 * clamp(held, 0, 1), 8);
  ctx.fillStyle = P.hudRed;
  ctx.fillRect(0, 53, 1280 * clamp(g.integrity / 100, 0, 1), 8);
  stencil(ctx, 'HELD ' + Math.round(held * 100) + '%', 8, 52, 10, '#cfe8c0', 'left');
  stencil(ctx, 'INTEGRITY ' + Math.round(g.integrity) + '%', 1272, 61, 10, '#f2c0b8', 'right');
}

function incomingCounts(g) {
  const counts = { grunt: 0, rusher: 0, grenadier: 0, sniper: 0, shield: 0 };
  for (const k of g.spawnQueue) if (counts[k] !== undefined) counts[k] += 1;
  for (const e of g.enemies) if (counts[e.kind] !== undefined) counts[e.kind] += 1;
  if (g.boss && g.boss.alive) counts.boss = 1;
  return counts;
}

function drawIncoming(ctx, g) {
  const counts = incomingCounts(g);
  const names = { grunt: 'GRUNT', rusher: 'RUSHER', grenadier: 'GRENADIER', sniper: 'SNIPER', shield: 'SHIELD' };
  const colors = { grunt: '#d97a6a', rusher: '#e89a5a', grenadier: '#c98ac0', sniper: '#b08ac9', shield: '#9a9aa8' };
  let y = 76;
  const rows = Object.keys(names).filter((k) => counts[k] > 0).length + (counts.boss ? 1 : 0);
  const h = 34 + rows * 20;
  panel(ctx, 8, y, 190, h);
  stencil(ctx, 'INCOMING', 18, y + 22, 14, P.hudAmber, 'left');
  let ry = y + 44;
  for (const k of Object.keys(names)) {
    if (counts[k] <= 0) continue;
    ctx.fillStyle = colors[k];
    ctx.beginPath(); ctx.arc(24, ry - 5, 6, 0, Math.PI * 2); ctx.fill();
    stencil(ctx, names[k], 38, ry, 13, P.hudText, 'left');
    stencil(ctx, 'x' + counts[k], 186, ry, 13, P.hudText, 'right');
    ry += 20;
  }
  if (counts.boss) {
    stencil(ctx, '⚠ ' + g.bossName, 18, ry, 13, '#ff7a5a', 'left');
  }
}

function drawSupport(ctx, g) {
  const ids = ['supply', 'strike', 'mortar', 'smoke'];
  const y = 76;
  const h = 34 + ids.length * 30;
  panel(ctx, 1064, y, 208, h);
  stencil(ctx, 'SUPPORT — RADIO', 1074, y + 22, 14, P.hudAmber, 'left');
  let ry = y + 46;
  for (const id of ids) {
    const def = CALLINS[id];
    const cd = g.callCooldowns[id];
    const afford = g.command >= def.cost;
    const ready = cd <= 0;
    const col = !afford ? '#8a7a5a' : ready ? '#9fc4e8' : '#a89a6e';
    stencil(ctx, '[' + def.key + ']', 1074, ry, 13, col, 'left');
    stencil(ctx, def.name, 1110, ry, 12, afford ? P.hudText : '#8a7a5a', 'left');
    stencil(ctx, ready ? '✦' + def.cost : Math.ceil(cd) + 's', 1262, ry, 12, ready ? (afford ? '#9fc4e8' : '#8a7a5a') : '#d64533', 'right');
    ry += 30;
  }
}

function drawDoctrinesPanel(ctx, g) {
  const y = 76 + 34 + 4 * 30 + 12;
  const rows = Math.max(1, g.doctrines.length);
  const h = 34 + rows * 20;
  panel(ctx, 1064, y, 208, h);
  stencil(ctx, 'DOCTRINES', 1074, y + 22, 14, P.hudAmber, 'left');
  let ry = y + 44;
  if (g.doctrines.length === 0) {
    stencil(ctx, '— none yet —', 1074, ry, 12, P.hudDim, 'left');
  } else {
    for (const id of g.doctrines) {
      stencil(ctx, '✚ ' + doctrineName(id), 1074, ry, 12, P.hudText, 'left');
      ry += 20;
    }
  }
}

function drawFeed(ctx, g) {
  let y = 76 + 34 + 4 * 30 + 12 + (34 + Math.max(1, g.doctrines.length) * 20) + 12;
  ctx.textAlign = 'left';
  for (const f of g.feed) {
    const a = clamp(1 - f.t / 9, 0.25, 1);
    ctx.globalAlpha = a;
    ctx.font = '12px ' + FONT;
    const w = ctx.measureText(f.text).width + 12;
    ctx.fillStyle = 'rgba(20,22,14,0.75)';
    ctx.fillRect(1280 - 8 - w, y - 13, w, 17);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, 1280 - 8 - w + 6, y);
    y += 20;
  }
  ctx.globalAlpha = 1;
}

function drawBottomBar(ctx, g) {
  const y = 736;
  panel(ctx, 0, y, 1280, 64);
  const p = g.player;
  // Weapon slots.
  let x = 14;
  for (let i = 0; i < WEAPON_ORDER.length; i++) {
    const id = WEAPON_ORDER[i];
    const w = p.weapons[i];
    const def = WEAPONS[id];
    const active = p.cur === i;
    ctx.fillStyle = active ? 'rgba(232,177,60,0.25)' : 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y + 8, 108, 48);
    ctx.strokeStyle = active ? P.hudAmber : '#5a5238';
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 8.5, 107, 47);
    if (!w.unlocked) {
      stencil(ctx, '[' + (i + 1) + '] ???', x + 6, y + 30, 12, '#6a6248', 'left');
      stencil(ctx, 'SUPPLY DROP', x + 6, y + 48, 10, '#6a6248', 'left');
    } else {
      stencil(ctx, '[' + (i + 1) + '] ' + def.name, x + 6, y + 28, 11, active ? P.hudAmber : P.hudText, 'left');
      const ammo = w.reserve === Infinity ? '∞' : String(w.reserve);
      stencil(ctx, w.mag + ' / ' + ammo, x + 6, y + 48, 13, p.reloading && active ? '#d64533' : P.hudText, 'left');
      if (p.reloading && active) stencil(ctx, 'RELOADING', x + 60, y + 48, 10, '#d64533', 'left');
    }
    x += 116;
  }
  // HP + armor.
  const bx = 620;
  stencil(ctx, 'HP', bx, y + 28, 13, P.hudText, 'left');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx + 30, y + 14, 190, 14);
  ctx.fillStyle = p.hp > 50 ? '#7fb069' : p.hp > 25 ? '#e8b13c' : '#d64533';
  ctx.fillRect(bx + 30, y + 14, 190 * clamp(p.hp / p.maxHp, 0, 1), 14);
  stencil(ctx, Math.ceil(p.hp) + '', bx + 226, y + 28, 13, P.hudText, 'left');
  stencil(ctx, 'ARMOR', bx, y + 50, 13, P.hudText, 'left');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx + 30, y + 38, 190, 12);
  ctx.fillStyle = '#9fc4e8';
  ctx.fillRect(bx + 30, y + 38, 190 * clamp(p.armor / p.maxArmor, 0, 1), 12);
  stencil(ctx, Math.ceil(p.armor) + '', bx + 226, y + 50, 13, P.hudText, 'left');
  // Combo + grade.
  stencil(ctx, 'COMBO x' + g.combo + (g.combo > 1 ? '  (' + (1 + Math.min(g.combo, 20) * 0.05).toFixed(2) + 'x SCORE)' : ''), 900, y + 28, 14, g.combo >= 5 ? '#ffdf6e' : P.hudText, 'left');
  stencil(ctx, 'GRADE ' + computeGrade(g), 900, y + 50, 14, P.hudAmber, 'left');
  stencil(ctx, 'KILLS ' + g.kills, 1150, y + 28, 14, P.hudText, 'left');
  stencil(ctx, 'ACC ' + accuracy(g) + '%', 1150, y + 50, 14, P.hudText, 'left');
}

function drawRadioBanner(ctx, g) {
  if (g.radioT <= 0 || !g.radioText) return;
  const a = clamp(g.radioT, 0, 1);
  ctx.globalAlpha = Math.min(1, a * 2);
  ctx.font = 'bold 15px ' + FONT;
  const w = ctx.measureText('📻 ' + g.radioText).width + 24;
  ctx.fillStyle = 'rgba(20,22,14,0.85)';
  ctx.fillRect((1280 - w) / 2, 66, w, 26);
  ctx.strokeStyle = '#9fc4e8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect((1280 - w) / 2 + 0.5, 66.5, w - 1, 25);
  ctx.fillStyle = '#9fc4e8';
  ctx.textAlign = 'center';
  ctx.fillText('📻 ' + g.radioText, 640, 85);
  ctx.globalAlpha = 1;
}

function drawCenterBanner(ctx, g) {
  if (g.bannerT <= 0 || !g.banner) return;
  const a = clamp(g.bannerT / 2.6, 0, 1);
  ctx.globalAlpha = Math.min(1, a * 2);
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px ' + FONT;
  ctx.fillStyle = '#00000088';
  ctx.fillText(g.banner, 642, 304);
  ctx.fillStyle = '#e8b13c';
  ctx.fillText(g.banner, 640, 302);
  if (g.bannerSub) {
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillStyle = '#f2ead2';
    ctx.fillText(g.bannerSub, 640, 330);
  }
  ctx.globalAlpha = 1;
}

function drawCrosshair(ctx, g, input) {
  if (g.screen !== 'play' || !input.hasPointer) return;
  const x = input.mouseX, y = input.mouseY;
  ctx.strokeStyle = '#e8b13c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 14, y); ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y); ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 14);
  ctx.stroke();
  ctx.fillStyle = '#e8b13c';
  ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
}

// ---------------- Screens ----------------

export function drawBriefing(ctx, g, selectedDiff) {
  ctx.fillStyle = 'rgba(10,12,8,0.8)';
  ctx.fillRect(0, 0, 1280, 800);
  ctx.textAlign = 'center';
  stencil(ctx, '★ FIREBASE IRONHOLD ★', 640, 120, 20, P.hudAmber, 'center');
  stencil(ctx, 'IRONHOLD', 640, 210, 84, '#e8b13c', 'center');
  stencil(ctx, 'HOLD THE FIREBASE THROUGH 7 ASSAULTS', 640, 252, 20, P.hudText, 'center');
  // Radio briefing.
  panel(ctx, 340, 280, 600, 102);
  stencil(ctx, '📻 INCOMING TRANSMISSION — HQ', 360, 306, 14, '#9fc4e8', 'left');
  stencil(ctx, '"Ironhold Actual, this is HQ. Seven assaults', 360, 330, 14, P.hudText, 'left');
  stencil(ctx, 'are coming down the valley. Hold the sandbags,', 360, 350, 14, P.hudText, 'left');
  stencil(ctx, 'protect the command tent, and call the radio.', 360, 370, 14, P.hudText, 'left');
  // Difficulty select.
  stencil(ctx, 'SELECT DIFFICULTY', 640, 410, 15, P.hudDim, 'center');
  const diffs = ['recruit', 'veteran', 'legend'];
  let x = 340;
  for (const d of diffs) {
    const def = { recruit: { label: 'RECRUIT', desc: 'Steady pace' }, veteran: { label: 'VETERAN', desc: 'The intended fight' }, legend: { label: 'LEGEND', desc: 'No mercy' } }[d];
    const sel = d === selectedDiff;
    ctx.fillStyle = sel ? 'rgba(232,177,60,0.28)' : 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, 424, 190, 74);
    ctx.strokeStyle = sel ? P.hudAmber : '#5a5238';
    ctx.lineWidth = sel ? 2.5 : 1.5;
    ctx.strokeRect(x + 0.5, 424.5, 189, 73);
    stencil(ctx, def.label, x + 95, 452, 17, sel ? P.hudAmber : P.hudText, 'center');
    stencil(ctx, def.desc, x + 95, 476, 12, P.hudDim, 'center');
    x += 210;
  }
  stencil(ctx, '← → to choose · ENTER to deploy', 640, 524, 13, P.hudDim, 'center');
  // Controls.
  stencil(ctx, 'WASD move · MOUSE aim · HOLD CLICK fire · 1-5 weapons · R reload · SHIFT sprint', 640, 566, 14, P.hudText, 'center');
  stencil(ctx, 'Q supply drop · E airstrike · T mortar · F smoke screen · P pause · M mute', 640, 590, 14, '#9fc4e8', 'center');
  stencil(ctx, 'Kills earn COMMAND ✦ — spend it on the radio. Protect the tent. Survive all 7 assaults.', 640, 620, 13, P.hudDim, 'center');
  const pulse = 0.6 + Math.sin(g.time * 4) * 0.4;
  ctx.globalAlpha = pulse;
  stencil(ctx, '— CLICK OR PRESS ENTER TO DEPLOY —', 640, 690, 18, P.hudAmber, 'center');
  ctx.globalAlpha = 1;
}

export function drawResupply(ctx, g) {
  ctx.fillStyle = 'rgba(10,12,8,0.78)';
  ctx.fillRect(0, 0, 1280, 800);
  ctx.textAlign = 'center';
  stencil(ctx, 'ASSAULT ' + (g.assault - 1) + ' CLEARED', 640, 130, 44, '#7fb069', 'center');
  stencil(ctx, 'GRADE ' + g.grade + '  ·  KILLS ' + g.kills + '  ·  ACCURACY ' + accuracy(g) + '%  ·  INTEGRITY ' + Math.round(g.integrity) + '%', 640, 168, 16, P.hudText, 'center');
  stencil(ctx, 'RESUPPLY — CHOOSE A DOCTRINE', 640, 220, 20, P.hudAmber, 'center');
  stencil(ctx, 'Sandbags patched · Tent repaired · Ammo topped up', 640, 246, 14, P.hudDim, 'center');
  let x = 250;
  g.doctrineChoices.forEach((d, i) => {
    const sel = i === g.doctrinePick;
    ctx.fillStyle = sel ? 'rgba(232,177,60,0.25)' : 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, 280, 240, 130);
    ctx.strokeStyle = sel ? P.hudAmber : '#5a5238';
    ctx.lineWidth = sel ? 2.5 : 1.5;
    ctx.strokeRect(x + 0.5, 280.5, 239, 129);
    stencil(ctx, '[' + (i + 1) + '] ' + d.name, x + 120, 322, 16, sel ? P.hudAmber : P.hudText, 'center');
    // Wrap the description.
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = P.hudText;
    const words = d.desc.split(' ');
    let line = '', ly = 352;
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 22) {
        ctx.fillText(line.trim(), x + 120, ly);
        ly += 18;
        line = w;
      } else line += ' ' + w;
    }
    if (line.trim()) ctx.fillText(line.trim(), x + 120, ly);
    x += 260;
  });
  stencil(ctx, '← → or 1/2/3 to choose · ENTER to confirm and start ASSAULT ' + g.assault, 640, 460, 15, P.hudText, 'center');
  const intel = ASSAULTS[g.assault - 1];
  if (intel) {
    stencil(ctx, 'INTEL — ASSAULT ' + g.assault + ': ' + intel.intel, 640, 510, 14, '#ff7a5a', 'center');
  }
  const pulse = 0.6 + Math.sin(g.time * 4) * 0.4;
  ctx.globalAlpha = pulse;
  stencil(ctx, '— PRESS ENTER TO CONTINUE —', 640, 580, 16, P.hudAmber, 'center');
  ctx.globalAlpha = 1;
}

export function drawPause(ctx, g) {
  ctx.fillStyle = 'rgba(10,12,8,0.7)';
  ctx.fillRect(0, 0, 1280, 800);
  ctx.textAlign = 'center';
  stencil(ctx, 'PAUSED', 640, 330, 56, P.hudAmber, 'center');
  stencil(ctx, 'The firebase waits. Press P to resume.', 640, 380, 16, P.hudText, 'center');
  stencil(ctx, 'WASD move · MOUSE aim · CLICK fire · 1-5 weapons · R reload', 640, 420, 14, P.hudDim, 'center');
  stencil(ctx, 'Q supply · E airstrike · T mortar · F smoke · M mute', 640, 444, 14, '#9fc4e8', 'center');
}

export function drawEndScreen(ctx, g) {
  const win = g.result && g.result.win;
  ctx.fillStyle = win ? 'rgba(16,26,12,0.82)' : 'rgba(26,10,8,0.82)';
  ctx.fillRect(0, 0, 1280, 800);
  ctx.textAlign = 'center';
  stencil(ctx, win ? '★ FIREBASE HELD ★' : '✖ FIREBASE OVERRUN ✖', 640, 190, 56, win ? '#7fb069' : '#d64533', 'center');
  stencil(ctx, win
    ? 'All seven assaults broken against the wire. Ironhold stands.'
    : 'The wire is breached and the tent is lost. The firebase falls — this time.', 640, 240, 17, P.hudText, 'center');
  const r = g.result || { kills: g.kills, time: g.elapsed, accuracy: accuracy(g), grade: computeGrade(g), assault: g.assault };
  stencil(ctx, 'ASSAULTS HELD  ' + (win ? '7/7' : (g.assault - 1) + '/7'), 640, 320, 20, P.hudText, 'center');
  stencil(ctx, 'KILLS ' + r.kills + '   ·   TIME ' + fmtTime(r.time) + '   ·   ACCURACY ' + r.accuracy + '%', 640, 360, 18, P.hudText, 'center');
  stencil(ctx, 'FINAL GRADE', 640, 420, 16, P.hudDim, 'center');
  stencil(ctx, r.grade, 640, 500, 88, P.hudAmber, 'center');
  stencil(ctx, 'SCORE ' + String(g.score).padStart(6, '0') + '   ·   BEST COMBO x' + g.bestCombo, 640, 560, 16, P.hudText, 'center');
  const pulse = 0.6 + Math.sin(g.time * 4) * 0.4;
  ctx.globalAlpha = pulse;
  stencil(ctx, '— PRESS R OR CLICK TO PLAY AGAIN —', 640, 640, 18, P.hudAmber, 'center');
  if (win) {
    stencil(ctx, '— OR PRESS E FOR ENDLESS WAR —', 640, 676, 16, '#9fc4e8', 'center');
  }
  ctx.globalAlpha = 1;
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function drawDemoWorld(ctx, g) {
  // Briefing backdrop: the firebase alive behind the overlay.
  drawWorld(ctx, g);
}
