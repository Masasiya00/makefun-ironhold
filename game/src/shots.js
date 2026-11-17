// IRONHOLD screenshot scenes: deterministic captures for ?shot=start|play|
// support|end&seed=1. Each scene builds a real game state and runs the real
// fixed-step sim with scripted input, so the screenshots are the game itself,
// not a mock. The parent playtest reads window.__shotReady and
// window.__ironhold.snapshot().
import { ASSAULTS } from './config.js';
import { startAssault, buildSpawnQueue } from './main.js';
import { spawnEnemy } from './enemies.js';
import { spawnBoss } from './bosses.js';
import { tryCallIn, startSupplyHeli } from './radio.js';
import { setRadio, setBanner, computeGrade } from './state.js';
import { unlockWeapon } from './weapons.js';

export function stageShot(g, name, step, input) {
  if (name === 'start') {
    stageStart(g);
  } else if (name === 'play') {
    stagePlay(g, step, input);
  } else if (name === 'support') {
    stageSupport(g, step, input);
  } else if (name === 'end') {
    stageEnd(g);
  } else {
    stageStart(g);
  }
}

function stageStart(g) {
  g.screen = 'briefing';
  g.selectedDiff = 'veteran';
  g.time = 4.2;
  // Backdrop: a few enemies milling outside the wire.
  const spots = [[300, 200], [1400, 300], [200, 900], [1500, 1000], [500, 1100], [1200, 150]];
  for (const [x, y] of spots) spawnEnemy(g, 'grunt', x, y);
  spawnEnemy(g, 'grenadier', 1350, 700);
  spawnEnemy(g, 'shield', 260, 560);
  g.camera.x = 800; g.camera.y = 600;
}

function nearestEnemyScreen(g, input) {
  let best = null, bestD = Infinity;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const d = (e.x - g.player.x) ** 2 + (e.y - g.player.y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  // The boss joins the candidates only when it is in range of the weapon
  // in hand — a shotgun aimed at a 385 px-distant truck wastes pellets.
  if (g.boss && g.boss.alive) {
    const bd = (g.boss.x - g.player.x) ** 2 + (g.boss.y - g.player.y) ** 2;
    const range = { pistol: 540, smg: 430, rifle: 660, shotgun: 350, sniper: 920 }[g.player.weapons[g.player.cur].id] || 500;
    if (bd < range * range && bd < bestD) { bestD = bd; best = g.boss; }
  }
  if (!best) return false;
  input.mouseX = best.x - g.camera.x + 640;
  input.mouseY = best.y - g.camera.y + 400;
  return true;
}

function stagePlay(g, step, input) {
  g.screen = 'play';
  g.assault = 2;
  g.diff = { label: 'VETERAN', enemyHp: 1, enemyDmg: 1, enemySpeed: 1, spawnGap: 1 };
  g.player.x = 800; g.player.y = 640;
  g.player.hp = 82; g.player.armor = 34;
  g.command = 42;
  g.score = 3650;
  g.kills = 31;
  g.combo = 6; g.comboTimer = 2.5;
  g.doctrines = ['mags', 'medic'];
  g.player.regen = 1.5;
  unlockWeapon(g, 'rifle');
  g.player.cur = 2; // rifle in hand
  g.player.weapons[2].mag = 24;
  g.elapsed = 214;
  startAssault(g);
  // Pre-place a visible fight: enemies closing from three sides, one grenade
  // mid-flight, a smoke cloud drifting, a crate by the helipad.
  const pack = [
    ['grunt', 620, 420], ['grunt', 660, 470], ['rusher', 980, 430],
    ['rusher', 1020, 500], ['grenadier', 560, 700], ['sniper', 1150, 760],
    ['shield', 700, 900], ['grunt', 900, 880], ['grunt', 760, 380],
  ];
  for (const [kind, x, y] of pack) spawnEnemy(g, kind, x, y);
  g.spawnQueue = buildSpawnQueue(g, ASSAULTS[1]);
  g.smokes.push({ x: 900, y: 520, radius: 90, maxRadius: 130, life: 6, maxLife: 8, driftX: 12, driftY: -4, fromBlast: false });
  g.crates.push({ x: 1010, y: 800, kind: 'medkit', t: 0, bob: 0 });
  // Run the real sim with scripted fire so tracers, casings and muzzle
  // flash are genuinely in flight when the shutter falls.
  input.mouseDown = true;
  for (let i = 0; i < 70; i++) {
    nearestEnemyScreen(g, input);
    step(g, input);
  }
  input.mouseDown = false;
  setRadio(g, 'COMMAND: Mortar section, fire for effect grid 5-3');
}

function stageSupport(g, step, input) {
  g.screen = 'play';
  g.assault = 3;
  g.diff = { label: 'VETERAN', enemyHp: 1, enemyDmg: 1, enemySpeed: 1, spawnGap: 1 };
  g.player.x = 760; g.player.y = 700;
  g.player.hp = 74; g.player.armor = 40;
  g.command = 45;
  g.score = 7400;
  g.kills = 58;
  g.combo = 9; g.comboTimer = 2.8;
  g.doctrines = ['mags', 'flak'];
  g.player.maxArmor = 100;
  unlockWeapon(g, 'rifle');
  unlockWeapon(g, 'shotgun');
  g.player.cur = 3; // shotgun in hand
  g.elapsed = 428;
  startAssault(g);
  // A cluster of enemies on the strike grid, the boss truck rolling in.
  const pack = [
    ['grunt', 880, 480], ['grunt', 930, 520], ['rusher', 860, 540],
    ['grenadier', 980, 470], ['shield', 910, 560], ['grunt', 950, 600],
    ['rusher', 840, 500], ['sniper', 1180, 700],
  ];
  for (const [kind, x, y] of pack) spawnEnemy(g, kind, x, y);
  spawnBoss(g, 'ironhide');
  g.boss.x = 420; g.boss.y = 520;
  g.spawnQueue = buildSpawnQueue(g, ASSAULTS[2]);
  // Call the airstrike on the cluster and send the supply heli in, then run
  // the sim until the jet is over the target and the blasts are going off.
  tryCallIn(g, 'strike', 920, 520);
  startSupplyHeli(g);
  g.command = 18;
  input.mouseDown = true;
  for (let i = 0; i < 105; i++) {
    nearestEnemyScreen(g, input);
    // The shotgun is semi-auto: release the trigger one step per cycle so
    // it keeps firing aimed blasts through the whole scene (real hits, real
    // accuracy on the HUD).
    input.mouseDown = (i % 14) !== 13;
    step(g, input);
    if (g.strikes.length === 0 && i > 95) break;
  }
  input.mouseDown = false;
  setRadio(g, 'COMMAND: Viper flight, strike grid 5-3');
  g.smokes.push({ x: 920, y: 520, radius: 70, maxRadius: 120, life: 3, maxLife: 3.2, driftX: 12, driftY: -6, fromBlast: true });
}

function stageEnd(g) {
  g.screen = 'victory';
  g.assault = 7;
  g.score = 18400;
  g.kills = 147;
  g.bestCombo = 14;
  g.elapsed = 742;
  g.shotsFired = 812;
  g.shotsHit = 552;
  g.integrity = 78;
  g.doctrines = ['mags', 'rapid', 'flak', 'medic'];
  g.result = { win: true, grade: 'S', kills: 147, time: 742, accuracy: 68, assault: 7 };
  g.time = 6.0;
  g.camera.x = 800; g.camera.y = 600;
}

export function snapshot(g) {
  return {
    screen: g.screen,
    assault: g.assault,
    hp: Math.round(g.player.hp),
    armor: Math.round(g.player.armor),
    score: g.score,
    command: g.command,
    kills: g.kills,
    combo: g.combo,
    integrity: Math.round(g.integrity),
    enemiesAlive: g.enemies.filter((e) => e.alive).length + (g.boss && g.boss.alive ? 1 : 0),
    spawnQueued: g.spawnQueue.length,
    boss: g.bossName,
    weapons: g.player.weapons.filter((w) => w.unlocked).map((w) => w.id),
    currentWeapon: g.player.weapons[g.player.cur].id,
    doctrines: g.doctrines.slice(),
    grade: g.result ? g.result.grade : computeGrade(g),
    accuracy: g.shotsFired ? Math.round((g.shotsHit / g.shotsFired) * 100) : 0,
  };
}
