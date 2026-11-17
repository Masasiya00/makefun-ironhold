// IRONHOLD doctrines: relics picked between assaults. One of three random
// choices per resupply; each changes the run in a visible way and shows in
// the right HUD panel for the rest of the game.
import { DOCTRINES } from './config.js';
import { addFeed } from './state.js';
import { healPlayer, repairArmor } from './player.js';

export function rollDoctrineChoices(g) {
  const pool = DOCTRINES.filter((d) => !g.doctrines.includes(d.id));
  const choices = [];
  while (choices.length < 3 && pool.length > 0) {
    const i = Math.floor(g.rng() * pool.length);
    choices.push(pool.splice(i, 1)[0]);
  }
  g.doctrineChoices = choices;
  g.doctrinePick = 0;
}

export function applyDoctrine(g, id) {
  const def = DOCTRINES.find((d) => d.id === id);
  if (!def) return;
  g.doctrines.push(id);
  if (id === 'flak') {
    g.player.maxArmor += 50;
    repairArmor(g, 999);
  }
  if (id === 'medic') {
    g.player.regen = 1.5;
  }
  if (id === 'mags') {
    // Top up magazines to the new size immediately.
    for (const w of g.player.weapons) {
      const base = { pistol: 12, smg: 32, rifle: 30, shotgun: 6, sniper: 5 }[w.id];
      w.mag = Math.round(base * 1.5);
    }
  }
  addFeed(g, 'Doctrine adopted: ' + def.name, '#e8b13c');
  healPlayer(g, 10);
}

export function doctrineName(id) {
  const d = DOCTRINES.find((x) => x.id === id);
  return d ? d.name : id;
}
