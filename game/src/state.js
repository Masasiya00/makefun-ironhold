// IRONHOLD state: one plain object holds the whole game. Pools are
// pre-allocated (bullets, particles, casings, texts) so the hot loop never
// allocates. createGame builds a fresh run; resetRun reuses it for restart.
import { makeRng } from './random.js';
import { CONFIG, WEAPONS, WEAPON_ORDER, DIFFICULTY } from './config.js';
import { buildFirebase } from './map.js';

export function createGame(seed, difficultyId) {
  const rng = makeRng(seed);
  const diff = DIFFICULTY[difficultyId] || DIFFICULTY.veteran;
  const g = {
    seed,
    rng,
    time: 0,
    stepCount: 0,
    screen: 'briefing', // briefing | play | resupply | pause | victory | defeat
    prevScreen: 'play',
    difficultyId,
    diff,
    assault: 1,
    phase: 'fight', // fight | resupply
    assaultActive: false,
    assaultKills: 0,
    assaultTotal: 0,
    spawnQueue: [],
    spawnT: 0,
    spawnBurstT: 0,
    bossSpawned: false,
    boss: null,
    bossName: '',
    score: 0,
    command: 10,
    commandBonus: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageDealt: 0,
    integrity: 100,
    result: null, // {win, grade, kills, time, accuracy}
    grade: '—',
    // Player
    player: {
      x: 800, y: 720, vx: 0, vy: 0, angle: -Math.PI / 2,
      hp: CONFIG.playerHp, maxHp: CONFIG.playerHp,
      armor: CONFIG.playerArmor, maxArmor: CONFIG.playerArmor,
      speed: CONFIG.playerSpeed,
      weapons: [],
      cur: 0,
      reloading: false, reloadT: 0,
      fireT: 0, muzzleT: 0, recoil: 0,
      sprintT: 0, alive: true, regen: 0, hurtT: 0, hidden: 0,
    },
    // Firebase
    tent: { x: 800, y: 600, hp: CONFIG.tentHp, maxHp: CONFIG.tentHp, radius: 46 },
    helipad: { x: 1010, y: 800, radius: 62 },
    tower: { x: 600, y: 380, radius: 26 },
    containers: [],
    sandbags: [],
    trees: [],
    rocks: [],
    craters: [],
    // Entities (pools)
    enemies: [],
    bullets: [],
    ebullets: [],
    grenades: [],
    particles: [],
    texts: [],
    casings: [],
    smokes: [],
    mortars: [],
    strikes: [],
    crates: [],
    flares: [],
    // Radio / air support
    heli: null,
    jet: null,
    callCooldowns: { supply: 0, strike: 0, mortar: 0, smoke: 0 },
    radioText: '',
    radioT: 0,
    feed: [],
    // Doctrines
    doctrines: [],
    doctrineChoices: [],
    doctrinePick: 0,
    // Feel
    shake: 0,
    hitStop: 0,
    flash: 0,
    flashColor: '255,60,40',
    banner: '',
    bannerT: 0,
    bannerSub: '',
    // Camera + render
    camera: { x: 800, y: 600 },
    terrain: null,
    sprites: null,
    night: false,
    flareT: 0,
    // Stats
    startTime: 0,
    elapsed: 0,
    fps: { avg: 0, p95: 0, samples: [] },
  };

  // Weapon loadout: pistol + SMG owned, the rest arrive in supply crates.
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id];
    g.player.weapons.push({
      id, mag: w.mag, reserve: w.startAmmo,
      unlocked: id === 'pistol' || id === 'smg',
    });
  }

  // Pre-allocate pools.
  for (let i = 0; i < 256; i++) g.bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, crit: false, kind: 'pistol', range: 0, traveled: 0 });
  for (let i = 0; i < 160; i++) g.ebullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, range: 0, traveled: 0 });
  for (let i = 0; i < 320; i++) g.particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '', glow: false, grav: 0 });
  for (let i = 0; i < 48; i++) g.texts.push({ active: false, x: 0, y: 0, vy: 0, life: 0, text: '', color: '', size: 14 });
  for (let i = 0; i < 64; i++) g.casings.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, life: 0 });

  buildFirebase(g);
  return g;
}

export function weaponState(g, id) {
  return g.player.weapons.find((w) => w.id === id);
}

export function currentWeapon(g) {
  return g.player.weapons[g.player.cur];
}

export function currentWeaponDef(g) {
  return WEAPONS[currentWeapon(g).id];
}

export function addFeed(g, text, color) {
  g.feed.unshift({ text, color: color || '#e8dfc0', t: 0 });
  if (g.feed.length > 6) g.feed.pop();
}

export function setRadio(g, text) {
  g.radioText = text;
  g.radioT = 3.2;
  addFeed(g, 'RADIO: ' + text, '#9fc4e8');
}

export function setBanner(g, text, sub) {
  g.banner = text;
  g.bannerSub = sub || '';
  g.bannerT = 2.6;
}

export function addScore(g, n) {
  g.score += n;
}

export function addCommand(g, n) {
  g.command += n;
}

export function computeGrade(g) {
  const acc = g.shotsFired > 0 ? g.shotsHit / g.shotsFired : 0;
  const integ = g.integrity;
  const s = acc * 50 + integ * 0.5;
  if (s >= 82) return 'S';
  if (s >= 68) return 'A';
  if (s >= 52) return 'B';
  return 'C';
}

export function accuracy(g) {
  return g.shotsFired > 0 ? Math.round((g.shotsHit / g.shotsFired) * 100) : 0;
}
