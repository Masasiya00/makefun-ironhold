[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Masasiya00/makefun-ironhold/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Masasiya00/makefun-ironhold/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# IRONHOLD — hold Firebase Ironhold through 7 assaults

A 2D canvas top-down firebase-defense war game, built for make.fun's
`best-game-01` bounty ("Make the best game").

You are the commander of Firebase Ironhold. Seven assaults are coming down
the valley: grunts, rushers, grenadiers, snipers and shield-bearers, plus
three bosses — the IRONHIDE armored truck, the BLACK HORNET attack
helicopter, and the STEEL BEHEMOTH battle tank. Hold the sandbag line,
protect the command tent, and survive all seven assaults.

## The radio — the central mechanic

You fight on foot AND command the battlefield by radio. Kills earn COMMAND
points; spend them on support with visible, audible results:

- **Q — HELICOPTER SUPPLY DROP** (rotor thump → chopper flies in → crate
  lands on the helipad: ammo, medkit, or a new weapon)
- **E — JET AIRSTRIKE** (jet roar + flyover → the marked zone explodes)
- **T — MORTAR BARRAGE** (radio beep → whistling shells → explosions)
- **F — SMOKE SCREEN** (hiss → drifting smoke that blocks enemy sight)

Every call-in shows a radio order on the HUD, e.g. "COMMAND: Eagle-1,
supply drop inbound".

## Play

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Open the page and deploy:

- **WASD / arrows** — move. **Mouse** — aim. **Hold click** — fire.
- **1 / 2 / 3 / 4 / 5** — switch weapon. **R** — reload. **Shift** — sprint.
- **Q / E / T / F** — radio call-ins (see above). **P / Esc** — pause.
- **M** — mute.

Five weapons (Pistol, SMG, Rifle, Shotgun, Sniper), each with its own sound
and stats. Health + flak armor, medkits and ammo from supply drops, loot
containers to crack open, and seven doctrines to pick between assaults
(Extended Mags, Rapid Fire, Flak Plating, Field Radio, Combat Medic, Long
Barrel, Lucky Casing). Three difficulties (Recruit / Veteran / Legend) and
Endless after the seventh assault is held.

## Realism (all procedural — no assets, no network)

- **War sounds** — all procedural WebAudio: distant battle rumble + wind +
  river ambience, helicopter rotor thump, jet roar, radio static and beeps,
  explosion booms, mortar whistles, smoke hiss, metallic container thunks,
  five distinct gunshots, reload clicks, shell-casing ticks. M mutes all.
- **The firebase** — sandbag ring with four gates, command tent, helipad,
  watchtower, shipping containers as cover, a river along the west edge,
  trees, rocks and old craters. Assaults 6–7 fight at night under flares.
- **Combat feel** — muzzle flash + tracers + shell casings on every shot,
  damage numbers, hitmarkers, hit-stop on kills, screen shake, damage
  flash, low-health pulse, drifting smoke, bomb smoke on big blasts.

## Structure

- `game/src/main.js` — boot, the fixed-step loop, assault flow, screens, camera.
- `game/src/state.js` — the whole game state (pools pre-allocated).
- `game/src/config.js` — every tuning number, weapons, enemies, assaults, doctrines.
- `game/src/map.js` — the firebase: terrain pre-render, sandbags, river, cover.
- `game/src/player.js` — movement, aim, health + armor.
- `game/src/weapons.js` — the five guns: fire, reload, swap, casings.
- `game/src/bullets.js` — the bullet pools and hits.
- `game/src/enemies.js` — five enemy kinds: chase, chew sandbags, throw, snipe.
- `game/src/bosses.js` — IRONHIDE, BLACK HORNET, STEEL BEHEMOTH.
- `game/src/radio.js` — radio call-ins, mortar shells, crates.
- `game/src/heli.js` — the supply helicopter. `game/src/jets.js` — the airstrike jet.
- `game/src/smoke.js` — drifting smoke clouds that block enemy sight.
- `game/src/containers.js` — container cover, thunks, loot containers.
- `game/src/particles.js` — sparks, blood, explosions, floating damage numbers.
- `game/src/doctrines.js` — doctrine picks between assaults.
- `game/src/audio.js` — procedural WebAudio sounds (no audio files).
- `game/src/hud.js` — the world renderer, military HUD, all screens.
- `game/src/input.js` — keyboard + pointer input (one-shot queue, never dropped).
- `game/src/shots.js` — the deterministic screenshot scenes.
- `game/src/palette.js` — colours. `game/src/sprites.js` — pre-rendered glow sprites. `game/src/random.js` — seeded RNG.

## Screenshots

Deterministic captures (`?shot=start|play|support|end&seed=1`): the briefing
with radio text and difficulty select, mid-assault fighting with the full
HUD, a jet airstrike + helicopter supply drop in action, and the victory
screen ("FIREBASE HELD").
