// IRONHOLD tuning: every number the game balances on lives here so a
// difficulty tweak is one edit, never a hunt through the sim.
export const CONFIG = {
  viewW: 1280,
  viewH: 800,
  mapW: 1600,
  mapH: 1200,
  step: 1 / 60,
  playerRadius: 15,
  playerSpeed: 235,
  playerSprint: 330,
  playerHp: 100,
  playerArmor: 50,
  maxArmor: 100,
  tentHp: 600,
  sandbagHp: 120,
  comboWindow: 3.5,
  critBase: 0.05,
  critMult: 2,
  // Command points earned per kill, by enemy kind.
  commandPerKill: { grunt: 2, rusher: 2, grenadier: 4, sniper: 4, shield: 5, boss: 30 },
  scorePerKill: { grunt: 100, rusher: 120, grenadier: 200, sniper: 220, shield: 250, boss: 1500 },
};

export const DIFFICULTY = {
  recruit: { label: 'RECRUIT', enemyHp: 0.8, enemyDmg: 0.8, enemySpeed: 0.9, spawnGap: 1.15, desc: 'Steady pace. Learn the radio.' },
  veteran: { label: 'VETERAN', enemyHp: 1.0, enemyDmg: 1.0, enemySpeed: 1.0, spawnGap: 1.0, desc: 'The intended fight. Hold the line.' },
  legend: { label: 'LEGEND', enemyHp: 1.35, enemyDmg: 1.3, enemySpeed: 1.1, spawnGap: 0.8, desc: 'No mercy. For commanders only.' },
};

// Five weapons, each with its own sound, stats and feel. Pistol is infinite
// reserve; the rest eat reserve ammo. SMG is unlocked from the start with
// the pistol; rifle, shotgun and sniper arrive in supply crates.
export const WEAPONS = {
  pistol: {
    name: 'M9 PISTOL', key: '1', damage: 24, rate: 0.26, mag: 12, reload: 0.95,
    spread: 0.025, speed: 950, range: 540, pellets: 1, auto: false,
    reserve: Infinity, startAmmo: Infinity, sound: 'pistol', kick: 2.5, tracer: '#ffd75e',
  },
  smg: {
    name: 'MP5 SMG', key: '2', damage: 12, rate: 0.075, mag: 32, reload: 1.25,
    spread: 0.085, speed: 880, range: 430, pellets: 1, auto: true,
    reserve: 192, startAmmo: 192, sound: 'smg', kick: 1.2, tracer: '#ffe9a8',
  },
  rifle: {
    name: 'M4 RIFLE', key: '3', damage: 19, rate: 0.11, mag: 30, reload: 1.45,
    spread: 0.04, speed: 1080, range: 660, pellets: 1, auto: true,
    reserve: 180, startAmmo: 120, sound: 'rifle', kick: 2.0, tracer: '#ffd75e',
  },
  shotgun: {
    name: 'M870 SHOTGUN', key: '4', damage: 10, rate: 0.8, mag: 6, reload: 2.1,
    spread: 0.21, speed: 780, range: 350, pellets: 6, auto: false,
    reserve: 48, startAmmo: 36, sound: 'shotgun', kick: 6.0, tracer: '#ffb347',
  },
  sniper: {
    name: 'M24 SNIPER', key: '5', damage: 105, rate: 1.35, mag: 5, reload: 2.3,
    spread: 0.0, speed: 1700, range: 920, pellets: 1, auto: false,
    reserve: 30, startAmmo: 20, sound: 'sniper', kick: 7.0, tracer: '#fff3c4',
  },
};

export const WEAPON_ORDER = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper'];

// Enemy kinds: speed, hp, damage, radius, colour key, behaviour.
export const ENEMIES = {
  grunt: { name: 'Grunt', hp: 46, speed: 62, damage: 9, radius: 14, color: 'grunt', range: 26, attackRate: 0.9, score: 100 },
  rusher: { name: 'Rusher', hp: 28, speed: 118, damage: 7, radius: 12, color: 'rusher', range: 24, attackRate: 0.7, score: 120 },
  grenadier: { name: 'Grenadier', hp: 60, speed: 52, damage: 26, radius: 15, color: 'grenadier', range: 300, attackRate: 2.6, score: 200 },
  sniper: { name: 'Sniper', hp: 40, speed: 46, damage: 18, radius: 13, color: 'sniper', range: 430, attackRate: 2.2, score: 220 },
  shield: { name: 'Shield-bearer', hp: 150, speed: 38, damage: 12, radius: 18, color: 'shield', range: 30, attackRate: 1.1, score: 250 },
};

// Assault compositions: how many of each kind, and the boss (if any).
// Assault n fields n*6+10 enemies; mixes get meaner as the war goes on.
export const ASSAULTS = [
  { n: 1, mix: { grunt: 12, rusher: 4 }, boss: null, sky: 'day', intel: 'Light infantry probing the wire. Hold the sandbags.' },
  { n: 2, mix: { grunt: 14, rusher: 8, grenadier: 2 }, boss: null, sky: 'day', intel: 'Grenadiers in the treeline. Watch for arcs.' },
  { n: 3, mix: { grunt: 12, rusher: 8, grenadier: 4, sniper: 2 }, boss: 'ironhide', sky: 'dusk', intel: 'IRONHIDE — an armored truck is ramming the line.' },
  { n: 4, mix: { grunt: 12, rusher: 10, grenadier: 6, sniper: 4, shield: 4 }, boss: null, sky: 'dusk', intel: 'Shield-bearers lead the push. Flank them.' },
  { n: 5, mix: { grunt: 14, rusher: 10, grenadier: 6, sniper: 6, shield: 4 }, boss: 'hornet', sky: 'dusk', intel: 'BLACK HORNET — attack helicopter strafing the firebase.' },
  { n: 6, mix: { grunt: 16, rusher: 12, grenadier: 8, sniper: 6, shield: 8 }, boss: null, sky: 'night', intel: 'Night assault. Flares up — trust your tracers.' },
  { n: 7, mix: { grunt: 18, rusher: 14, grenadier: 10, sniper: 8, shield: 10 }, boss: 'behemoth', sky: 'night', intel: 'STEEL BEHEMOTH — battle tank. All-out assault. Hold or fall.' },
];

export const BOSSES = {
  ironhide: {
    name: 'IRONHIDE', kind: 'ironhide', hp: 950, speed: 74, damage: 30, radius: 34,
    color: 'boss', range: 44, attackRate: 1.2, intel: 'Armored truck. It rams the sandbags — stop it in the open.',
  },
  hornet: {
    name: 'BLACK HORNET', kind: 'hornet', hp: 1250, speed: 150, damage: 16, radius: 30,
    color: 'boss', range: 420, attackRate: 1.6, intel: 'Attack helicopter. It strafes in bursts — keep moving.',
  },
  behemoth: {
    name: 'STEEL BEHEMOTH', kind: 'behemoth', hp: 2100, speed: 34, damage: 55, radius: 40,
    color: 'boss', range: 460, attackRate: 3.4, intel: 'Battle tank. Cannon shells, heavy armor. Aim for the turret ring.',
  },
};

// Radio call-ins: cost in command points, cooldown, and the radio order text.
export const CALLINS = {
  supply: { key: 'Q', name: 'SUPPLY DROP', cost: 15, cooldown: 25, order: 'Eagle-1, supply drop inbound' },
  strike: { key: 'E', name: 'AIRSTRIKE', cost: 25, cooldown: 35, order: 'Viper flight, strike' },
  mortar: { key: 'T', name: 'MORTAR BARRAGE', cost: 20, cooldown: 20, order: 'Mortar section, fire for effect' },
  smoke: { key: 'F', name: 'SMOKE SCREEN', cost: 10, cooldown: 12, order: 'Smoke out, cover the line' },
};

// Doctrines (relics): pick one between assaults. id, name, blurb, apply(g).
export const DOCTRINES = [
  { id: 'mags', name: 'EXTENDED MAGS', desc: '+50% magazine size, all weapons' },
  { id: 'rapid', name: 'RAPID FIRE', desc: '+15% fire rate, all weapons' },
  { id: 'flak', name: 'FLAK PLATING', desc: '+50 max armor, repair armor to full' },
  { id: 'radio', name: 'FIELD RADIO', desc: 'Call-in cooldowns -30%, +1 command per kill' },
  { id: 'medic', name: 'COMBAT MEDIC', desc: 'Regenerate 1.5 HP per second' },
  { id: 'barrel', name: 'LONG BARREL', desc: '+25% weapon range' },
  { id: 'lucky', name: 'LUCKY CASING', desc: '+12% critical hit chance' },
];
