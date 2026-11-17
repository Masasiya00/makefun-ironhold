// IRONHOLD audio: every sound is synthesized with WebAudio — oscillators
// plus filtered noise, no audio files, no network. Each sound is tied to a
// visible in-game event. The context starts on the first user gesture
// (browser autoplay policy); M mutes the master gain.
let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
let ambienceOn = false;
let rotorNodes = null;

export function audioMuted() { return muted; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.42;
  master.connect(ctx.destination);
  // One shared 2s white-noise buffer; every noise sound filters it.
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  startAmbience();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.42;
  return muted;
}

function noiseSrc() {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}

function env(gainNode, t0, peak, decay) {
  gainNode.gain.setValueAtTime(0.0001, t0);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
}

function tone(freq0, freq1, dur, type, peak) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq0, t0);
  if (freq1 !== freq0) o.frequency.exponentialRampToValueAtTime(Math.max(freq1, 1), t0 + dur);
  env(g, t0, peak, dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noiseHit(dur, filterType, freq, peak, q = 1) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const s = noiseSrc();
  const f = ctx.createBiquadFilter();
  f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t0, peak, dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0); s.stop(t0 + dur + 0.05);
}

// War ambience: low distant rumble + wind, always on once the context exists.
function startAmbience() {
  if (!ctx || ambienceOn) return;
  ambienceOn = true;
  // Distant battle rumble: very lowpassed noise, barely audible.
  const rumble = noiseSrc();
  const rf = ctx.createBiquadFilter();
  rf.type = 'lowpass'; rf.frequency.value = 90;
  const rg = ctx.createGain(); rg.gain.value = 0.05;
  rumble.connect(rf); rf.connect(rg); rg.connect(master);
  rumble.start();
  // Wind: band-passed noise with a slow wandering gain.
  const wind = noiseSrc();
  const wf = ctx.createBiquadFilter();
  wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.6;
  const wg = ctx.createGain(); wg.gain.value = 0.035;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.11;
  const lg = ctx.createGain(); lg.gain.value = 0.02;
  lfo.connect(lg); lg.connect(wg.gain);
  wind.connect(wf); wf.connect(wg); wg.connect(master);
  wind.start(); lfo.start();
}

// Five distinct gunshots — the player can tell the weapon by ear alone.
export function playShot(kind) {
  if (!ctx) return;
  switch (kind) {
    case 'pistol': // semi-auto pop: short square blip + click
      tone(210, 70, 0.09, 'square', 0.32);
      noiseHit(0.06, 'highpass', 1800, 0.18);
      break;
    case 'smg': // rapid pops, higher and thinner
      tone(320, 110, 0.06, 'square', 0.22);
      noiseHit(0.045, 'bandpass', 2400, 0.14, 2);
      break;
    case 'rifle': // sharp crack: sawtooth snap + noise burst
      tone(160, 55, 0.11, 'sawtooth', 0.34);
      noiseHit(0.09, 'bandpass', 1500, 0.24, 1.4);
      break;
    case 'shotgun': // deep boom: low sine drop + wide noise
      tone(130, 38, 0.28, 'sine', 0.55);
      noiseHit(0.22, 'lowpass', 700, 0.4);
      break;
    case 'sniper': // crack plus a delayed echo
      tone(420, 90, 0.14, 'sawtooth', 0.4);
      noiseHit(0.12, 'highpass', 1200, 0.28);
      setTimeout(() => { if (ctx) tone(300, 80, 0.16, 'sawtooth', 0.12); }, 90);
      break;
    default:
      tone(200, 80, 0.08, 'square', 0.25);
  }
}

export function playExplosion(size = 1) {
  if (!ctx) return;
  tone(120, 28, 0.5 * size, 'sine', 0.6 * Math.min(size, 1.4));
  noiseHit(0.45 * size, 'lowpass', 500, 0.5);
  noiseHit(0.2, 'bandpass', 900, 0.2);
}

export function playGrenadePop() {
  if (!ctx) return;
  tone(160, 50, 0.2, 'sine', 0.35);
  noiseHit(0.16, 'lowpass', 900, 0.3);
}

export function playMortarWhistle() {
  if (!ctx) return;
  tone(1350, 280, 0.85, 'sine', 0.10);
}

export function playRadioBeep() {
  if (!ctx) return;
  tone(880, 880, 0.07, 'square', 0.12);
  setTimeout(() => { if (ctx) tone(1180, 1180, 0.06, 'square', 0.1); }, 90);
}

export function playRadioStatic() {
  if (!ctx) return;
  noiseHit(0.22, 'bandpass', 1800, 0.12, 3);
  setTimeout(() => { if (ctx) noiseHit(0.14, 'bandpass', 2200, 0.08, 3); }, 160);
}

export function playReload() {
  if (!ctx) return;
  tone(950, 700, 0.05, 'square', 0.14);
  setTimeout(() => { if (ctx) tone(700, 500, 0.05, 'square', 0.14); }, 140);
  setTimeout(() => { if (ctx) tone(1200, 900, 0.05, 'square', 0.16); }, 320);
}

export function playCasing() {
  if (!ctx) return;
  tone(2400, 1800, 0.03, 'square', 0.05);
}

export function playHit() {
  if (!ctx) return;
  tone(1500, 1100, 0.05, 'square', 0.12);
}

export function playKill() {
  if (!ctx) return;
  tone(620, 620, 0.07, 'square', 0.16);
  setTimeout(() => { if (ctx) tone(930, 930, 0.09, 'square', 0.16); }, 70);
}

export function playPickup() {
  if (!ctx) return;
  tone(520, 520, 0.08, 'sine', 0.18);
  setTimeout(() => { if (ctx) tone(780, 780, 0.1, 'sine', 0.18); }, 80);
}

export function playHorn() {
  if (!ctx) return;
  tone(98, 98, 0.7, 'sawtooth', 0.22);
  tone(147, 147, 0.7, 'sawtooth', 0.16);
}

export function playSmokeHiss() {
  if (!ctx) return;
  noiseHit(0.9, 'highpass', 3200, 0.14);
}

export function playThunk() {
  if (!ctx) return;
  tone(180, 90, 0.08, 'triangle', 0.2);
  noiseHit(0.05, 'bandpass', 600, 0.12);
}

export function playJetRoar() {
  if (!ctx) return;
  noiseHit(1.8, 'bandpass', 700, 0.3, 0.8);
  tone(72, 46, 1.8, 'sawtooth', 0.18);
}

export function playStinger(win) {
  if (!ctx) return;
  const seq = win ? [392, 523, 659, 784] : [330, 262, 196, 131];
  seq.forEach((f, i) => setTimeout(() => { if (ctx) tone(f, f, 0.35, 'triangle', 0.2); }, i * 170));
}

// Helicopter rotor: a 13 Hz pulsing low thump, gain follows heli distance.
export function startRotor() {
  if (!ctx || rotorNodes) return;
  const src = noiseSrc();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 240;
  const g = ctx.createGain(); g.gain.value = 0.0;
  const lfo = ctx.createOscillator();
  lfo.type = 'square'; lfo.frequency.value = 13;
  const lg = ctx.createGain(); lg.gain.value = 0.09;
  lfo.connect(lg); lg.connect(g.gain);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(); lfo.start();
  rotorNodes = { src, lfo, g };
}

export function setRotorLevel(level) {
  if (rotorNodes) rotorNodes.g.gain.value = Math.max(0, Math.min(0.22, level));
}

export function stopRotor() {
  if (!rotorNodes) return;
  try { rotorNodes.src.stop(); rotorNodes.lfo.stop(); } catch (e) { /* already stopped */ }
  rotorNodes = null;
}
