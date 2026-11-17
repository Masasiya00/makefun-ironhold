// IRONHOLD — hold Firebase Ironhold through 7 assaults. Boot, fixed-step
// loop, assault flow, screens and camera. The sim runs at a fixed 1/60 s;
// rendering is decoupled and reads the same state. One-shot key presses
// arrive through input.pendingActions and are consumed here, never dropped.
import { createGame, addFeed, setBanner, setRadio, computeGrade, accuracy } from './state.js';
import { createInput, takeActions, moveAxis } from './input.js';
import { ASSAULTS, CONFIG } from './config.js';
import { makeSprites } from './sprites.js';
import { initAudio, toggleMute, playHorn, playStinger } from './audio.js';
import { updatePlayer } from './player.js';
import { tryFire, startReload, switchWeapon, magSize } from './weapons.js';
import { updateBullets } from './bullets.js';
import { spawnEnemy, spawnPointFor, updateEnemies, updateGrenades } from './enemies.js';
import { spawnBoss, updateBoss } from './bosses.js';
import { tryCallIn, updateRadio } from './radio.js';
import { updateHeli } from './heli.js';
import { updateJet } from './jets.js';
import { updateSmoke } from './smoke.js';
import { updateParticles } from './particles.js';
import { updateCasings } from './weapons.js';
import { rollDoctrineChoices, applyDoctrine } from './doctrines.js';
import { drawWorld, drawHUD, drawBriefing, drawResupply, drawPause, drawEndScreen } from './hud.js';
import { sandbagIntegrity } from './map.js';
import { stageShot, snapshot } from './shots.js';
import { clamp } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CONFIG.viewW;
canvas.height = CONFIG.viewH;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '0', 10) || (Date.now() % 2147483647);

let g = createGame(seed, 'veteran');
g.sprites = makeSprites();
g.selectedDiff = 'veteran';
const input = createInput(canvas);
input.mouseDownPrev = false;
input.moveX = 0;
input.moveY = 0;
input.aimX = 800;
input.aimY = 500;

// ---------------- Assault flow ----------------

export function buildSpawnQueue(g, assaultDef) {
  const q = [];
  for (const [kind, n] of Object.entries(assaultDef.mix)) {
    for (let i = 0; i < n; i++) q.push(kind);
  }
  // Shuffle with the seeded RNG.
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(g.rng() * (i + 1));
    const t = q[i]; q[i] = q[j]; q[j] = t;
  }
  return q;
}

export function startAssault(g) {
  const def = assaultDef(g);
  g.spawnQueue = buildSpawnQueue(g, def);
  g.assaultTotal = g.spawnQueue.length + (def.boss ? 1 : 0);
  g.assaultKills = 0;
  g.assaultActive = true;
  g.spawnT = 1.2;
  g.bossSpawned = false;
  g.bossT = 8;
  g.night = def.sky === 'night';
  g.flareT = 2;
  setBanner(g, 'ASSAULT ' + g.assault + ' / 7', def.intel);
  playHorn();
  addFeed(g, 'Assault ' + g.assault + ' inbound — ' + def.intel, '#ff7a5a');
}

function assaultDef(g) {
  return g.assault <= 7 ? ASSAULTS[g.assault - 1] : endlessDef(g.assault);
}

// Endless war after the seventh assault is held: the mix grows with each
// assault and the bosses cycle (truck, helicopter, tank, repeat).
function endlessDef(n) {
  const k = n - 6;
  return {
    n,
    mix: {
      grunt: 14 + k * 3, rusher: 10 + k * 2, grenadier: 6 + k,
      sniper: 5 + k, shield: 6 + k,
    },
    boss: n % 3 === 0 ? 'behemoth' : n % 3 === 1 ? 'ironhide' : 'hornet',
    sky: 'night',
    intel: 'Endless assault ' + n + '. The valley sends everything it has.',
  };
}

function assaultCleared(g) {
  g.assaultActive = false;
  g.grade = computeGrade(g);
  if (g.assault >= 7 && !g.endless) {
    endGame(g, true);
    return;
  }
  // Resupply: patch the line, top up ammo, roll three doctrines.
  for (const s of g.sandbags) {
    if (s.alive) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.5);
    else { s.alive = true; s.hp = s.maxHp * 0.5; }
  }
  g.tent.hp = Math.min(g.tent.maxHp, g.tent.hp + g.tent.maxHp * 0.25);
  for (const w of g.player.weapons) {
    if (w.unlocked && w.reserve !== Infinity) w.reserve += 60;
  }
  g.player.hp = Math.min(g.player.maxHp, g.player.hp + 20);
  rollDoctrineChoices(g);
  g.screen = 'resupply';
  playStinger(true);
}

function endGame(g, win) {
  g.screen = win ? 'victory' : 'defeat';
  g.result = {
    win,
    grade: computeGrade(g),
    kills: g.kills,
    time: g.elapsed,
    accuracy: accuracy(g),
    assault: g.assault,
  };
  playStinger(win);
  if (!win) setBanner(g, 'FIREBASE OVERRUN', '');
}

function continueEndless(g) {
  g.endless = true;
  g.assault = 8;
  g.screen = 'play';
  g.player.hp = Math.min(g.player.maxHp, g.player.hp + 30);
  setBanner(g, 'ENDLESS WAR', 'The firebase holds — and the valley keeps coming.');
  startAssault(g);
  return g;
}

function restartRun(g) {
  const diff = g.selectedDiff || 'veteran';
  const ng = createGame((Date.now() % 2147483647) || 1, diff);
  ng.sprites = g.sprites;
  ng.selectedDiff = diff;
  return ng;
}

// ---------------- One fixed step ----------------

function stepGame(g, input) {
  g.time += CONFIG.step;
  g.stepCount += 1;

  // Timers that run on every screen.
  if (g.bannerT > 0) g.bannerT -= CONFIG.step;
  for (const f of g.feed) f.t += CONFIG.step;
  if (g.shake > 0) g.shake = Math.max(0, g.shake - CONFIG.step * 26);
  if (g.flash > 0) g.flash = Math.max(0, g.flash - CONFIG.step * 2.2);

  const actions = takeActions(input);

  if (g.screen === 'briefing') {
    let next = g;
    for (const a of actions) {
      if (a === 'diff-prev') cycleDiff(g, -1);
      else if (a === 'diff-next') cycleDiff(g, 1);
      else if (a === 'confirm') next = beginPlay(g);
      else if (a === 'mute') toggleMute();
    }
    if (next === g && input.mouseDown && !input.mouseDownPrev) next = beginPlay(g);
    input.mouseDownPrev = input.mouseDown;
    return next;
  } else if (g.screen === 'play') {
    stepPlay(g, input, actions);
  } else if (g.screen === 'resupply') {
    for (const a of actions) {
      if (a === 'diff-prev') g.doctrinePick = (g.doctrinePick + g.doctrineChoices.length - 1) % g.doctrineChoices.length;
      else if (a === 'diff-next') g.doctrinePick = (g.doctrinePick + 1) % g.doctrineChoices.length;
      else if (a === 'weapon-1' || a === 'weapon-2' || a === 'weapon-3') {
        const i = parseInt(a.slice(-1), 10) - 1;
        if (i < g.doctrineChoices.length) g.doctrinePick = i;
      } else if (a === 'confirm') confirmDoctrine(g);
      else if (a === 'mute') toggleMute();
    }
  } else if (g.screen === 'pause') {
    for (const a of actions) {
      if (a === 'pause') g.screen = 'play';
      else if (a === 'mute') toggleMute();
    }
  } else if (g.screen === 'victory' || g.screen === 'defeat') {
    for (const a of actions) {
      if (a === 'call-strike' && g.screen === 'victory' && g.result && g.result.win) {
        g = continueEndless(g); replaceGame(g); return g;
      }
      if (a === 'reload' || a === 'confirm') { g = restartRun(g); replaceGame(g); return g; }
    }
    if (input.mouseDown && !input.mouseDownPrev) { g = restartRun(g); replaceGame(g); return g; }
  }

  input.mouseDownPrev = input.mouseDown;
  return g;
}

function cycleDiff(g, dir) {
  const order = ['recruit', 'veteran', 'legend'];
  let i = order.indexOf(g.selectedDiff || 'veteran');
  i = (i + dir + order.length) % order.length;
  g.selectedDiff = order[i];
  g.difficultyId = order[i];
}

function beginPlay(g) {
  initAudio();
  const diff = g.selectedDiff || 'veteran';
  const ng = createGame(g.seed, diff);
  ng.sprites = g.sprites;
  ng.selectedDiff = diff;
  replaceGame(ng);
  ng.screen = 'play';
  ng.elapsed = 0;
  setRadio(ng, 'COMMAND: Ironhold Actual, hold the line. HQ out.');
  startAssault(ng);
  return ng;
}

// Rebind the module-level game reference after a restart/begin. The
// window.__ironhold.state getter reads this same variable, so it follows
// automatically — never assign to it (it is a getter-only property).
function replaceGame(ng) {
  g = ng;
}

function stepPlay(g, input, actions) {
  const dt = CONFIG.step;
  const p = g.player;

  // Hit-stop: freeze the world briefly on a kill (set by damageEnemy path).
  if (g.hitStop > 0) {
    g.hitStop -= dt;
    return;
  }

  for (const a of actions) {
    if (a === 'reload') startReload(g);
    else if (a === 'pause') { g.prevScreen = 'play'; g.screen = 'pause'; return; }
    else if (a === 'mute') toggleMute();
    else if (a === 'call-supply') tryCallIn(g, 'supply', p.x, p.y);
    else if (a === 'call-strike') tryCallIn(g, 'strike', input.aimX, input.aimY);
    else if (a === 'call-mortar') tryCallIn(g, 'mortar', input.aimX, input.aimY);
    else if (a === 'call-smoke') tryCallIn(g, 'smoke', input.aimX, input.aimY);
    else if (a.startsWith('weapon-')) switchWeapon(g, parseInt(a.slice(-1), 10) - 1);
  }

  // Movement + aim from the live input.
  const mv = moveAxis(input);
  input.moveX = mv.x;
  input.moveY = mv.y;
  input.aimX = g.camera.x - 640 + input.mouseX;
  input.aimY = g.camera.y - 400 + input.mouseY;

  g.elapsed += dt;
  updatePlayer(g, input, dt);
  tryFire(g, input);
  updateEnemies(g, dt);
  updateBoss(g, dt);
  updateBullets(g, dt);
  updateGrenades(g, dt);
  updateRadio(g, dt);
  updateHeli(g, dt);
  updateJet(g, dt);
  updateSmoke(g, dt);
  updateParticles(g, dt);
  updateCasings(g, dt);

  // Combo window.
  if (g.comboTimer > 0) {
    g.comboTimer -= dt;
    if (g.comboTimer <= 0) g.combo = 0;
  }

  // Spawning.
  if (g.assaultActive) {
    if (g.spawnQueue.length > 0) {
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        const kind = g.spawnQueue.shift();
        const pt = spawnPointFor(g);
        spawnEnemy(g, kind, pt.x, pt.y);
        g.spawnT = 0.55 * g.diff.spawnGap * (0.7 + g.rng() * 0.6);
      }
    }
    const def = assaultDef(g);
    if (def.boss && !g.bossSpawned) {
      g.bossT -= dt;
      if (g.bossT <= 0) {
        spawnBoss(g, def.boss);
        g.bossSpawned = true;
      }
    }
    // Assault ends when the queue is dry, the field is clear, and the boss
    // (if any) is dead.
    if (g.spawnQueue.length === 0 && g.enemies.length === 0 && (!g.boss || !g.boss.alive) && g.bossSpawned === (def.boss !== null)) {
      assaultCleared(g);
    }
  }

  // Night flares.
  if (g.night) {
    g.flareT -= dt;
    if (g.flareT <= 0) {
      g.flareT = 6 + g.rng() * 3;
      g.flares.push({
        x: 500 + g.rng() * 600, y: 300 + g.rng() * 600,
        life: 5, maxLife: 5,
      });
    }
    for (let i = g.flares.length - 1; i >= 0; i--) {
      g.flares[i].life -= dt;
      if (g.flares[i].life <= 0) g.flares.splice(i, 1);
    }
  }

  // Integrity: tent 60% + sandbags 40%.
  g.integrity = Math.round((g.tent.hp / g.tent.maxHp) * 60 + sandbagIntegrity(g) * 40);

  // Camera follows the player, clamped to the map.
  const tx = clamp(p.x, 640, 1600 - 640);
  const ty = clamp(p.y, 400, 1200 - 400);
  g.camera.x += (tx - g.camera.x) * 0.12;
  g.camera.y += (ty - g.camera.y) * 0.12;

  // Defeat.
  if (!p.alive || g.tent.hp <= 0) {
    endGame(g, false);
  }
}

function confirmDoctrine(g) {
  const d = g.doctrineChoices[g.doctrinePick];
  if (d) applyDoctrine(g, d.id);
  g.assault += 1;
  g.screen = 'play';
  startAssault(g);
}

// ---------------- Render ----------------

function render(g) {
  ctx.clearRect(0, 0, 1280, 800);
  if (g.screen === 'briefing') {
    drawWorld(ctx, g);
    drawBriefing(ctx, g, g.selectedDiff || 'veteran');
  } else if (g.screen === 'play' || g.screen === 'pause') {
    drawWorld(ctx, g);
    drawHUD(ctx, g, input);
    if (g.screen === 'pause') drawPause(ctx, g);
  } else if (g.screen === 'resupply') {
    drawWorld(ctx, g);
    drawHUD(ctx, g, input);
    drawResupply(ctx, g);
  } else {
    drawWorld(ctx, g);
    drawEndScreen(ctx, g);
  }
}

// ---------------- Main loop ----------------

const frameTimes = [];
const workTimes = [];
let lastT = performance.now();
let acc = 0;
let shotReadySet = false;

function frame(now) {
  const workStart = performance.now();
  const dtMs = now - lastT;
  lastT = now;
  if (dtMs > 0 && dtMs < 1000) frameTimes.push(dtMs);
  if (frameTimes.length > 240) frameTimes.shift();

  // Fixed-step accumulator (1/60 s), capped so a hitch cannot spiral. The
  // remainder carries across frames, so the sim keeps real time on both
  // 60 Hz displays and uncapped headless runs.
  acc += Math.min(dtMs / 1000, 0.1);
  while (acc >= CONFIG.step) {
    g = stepGame(g, input) || g;
    acc -= CONFIG.step;
  }
  render(g);
  workTimes.push(performance.now() - workStart);
  if (workTimes.length > 240) workTimes.shift();

  if (shotName && !shotReadySet) {
    shotReadySet = true;
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

// FPS readout for the playtest harness. Load hitches (>100 ms gaps) are
// dropped so one stall at startup cannot skew the average. workMs is the
// JS time one frame costs (sim + render) — the number that decides whether
// 60fps is sustainable on a vsync display (budget 16.7 ms).
function fpsStats() {
  const clean = frameTimes.filter((t) => t <= 100);
  const sorted = clean.slice().sort((a, b) => a - b);
  const avg = clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0;
  const p95 = clean.length ? sorted[Math.floor(clean.length * 0.95)] : 0;
  const wsorted = workTimes.slice().sort((a, b) => a - b);
  const wavg = workTimes.length ? workTimes.reduce((a, b) => a + b, 0) / workTimes.length : 0;
  const wp95 = workTimes.length ? wsorted[Math.floor(workTimes.length * 0.95)] : 0;
  return {
    avgFps: avg ? 1000 / avg : 0, avgMs: avg, p95Ms: p95, samples: clean.length,
    avgWorkMs: wavg, p95WorkMs: wp95, workSamples: workTimes.length,
  };
}

window.__ironhold = {
  get state() { return g; },
  snapshot: () => snapshot(g),
  fps: fpsStats,
  giveAllWeapons: () => {
    for (const w of g.player.weapons) {
      w.unlocked = true;
      if (w.reserve !== Infinity) w.reserve = 999;
      w.mag = magSize(g, w.id);
    }
  },
  startAssault: () => startAssault(g),
  // Test hook: advance the fixed-step sim synchronously (headless Chrome
  // throttles rAF, so the playtest drives time this way instead of waiting).
  advance: (secs) => {
    const n = Math.round(secs * 60);
    for (let i = 0; i < n; i++) {
      const ng = stepGame(g, input);
      if (ng && ng !== g) g = ng;
    }
    return snapshot(g);
  },
};

// First gesture unlocks audio (autoplay policy).
window.addEventListener('pointerdown', () => initAudio(), { once: true });
window.addEventListener('keydown', () => initAudio(), { once: true });

// Deterministic screenshot mode: stage the scene, then run the loop.
if (shotName) {
  const stepFn = (gg, inp) => { const ng = stepGame(gg, inp); if (ng && ng !== gg) g = ng; };
  stageShot(g, shotName, stepFn, input);
  // Keep the sim still enough for the shutter: pause assault spawning in
  // the start/end scenes by leaving assaultActive false there.
  window.__shotReady = false;
}

requestAnimationFrame(frame);
