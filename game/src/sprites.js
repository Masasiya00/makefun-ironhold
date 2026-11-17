// Pre-rendered sprites for IRONHOLD: every glow is baked once into an
// offscreen canvas at boot, so the hot loop never pays for shadowBlur.
// drawImage of a baked sprite is the whole trick behind a steady 60fps.
export function makeGlowSprite(size, inner, outer) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return c;
}

export function makeSmokePuff(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const x = c.getContext('2d');
  // A lumpy puff: several overlapping soft circles, baked once.
  const blobs = [
    [0.5, 0.5, 0.42], [0.32, 0.55, 0.26], [0.68, 0.52, 0.28],
    [0.45, 0.32, 0.26], [0.58, 0.68, 0.24], [0.36, 0.38, 0.2],
  ];
  for (const [bx, by, br] of blobs) {
    const g = x.createRadialGradient(bx * size, by * size, 0, bx * size, by * size, br * size);
    g.addColorStop(0, 'rgba(168,168,158,0.55)');
    g.addColorStop(1, 'rgba(168,168,158,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(bx * size, by * size, br * size, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}

export function makeMuzzleSprite(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const x = c.getContext('2d');
  x.translate(size / 2, size / 2);
  // Four-point star flash, baked once, drawn rotated to the barrel.
  x.fillStyle = '#ffdf6e';
  x.beginPath();
  x.moveTo(0, -size / 2);
  x.lineTo(size * 0.10, -size * 0.10);
  x.lineTo(size / 2, 0);
  x.lineTo(size * 0.10, size * 0.10);
  x.lineTo(0, size / 2);
  x.lineTo(-size * 0.10, size * 0.10);
  x.lineTo(-size / 2, 0);
  x.lineTo(-size * 0.10, -size * 0.10);
  x.closePath();
  x.fill();
  x.fillStyle = '#fff6c8';
  x.beginPath();
  x.arc(0, 0, size * 0.16, 0, Math.PI * 2);
  x.fill();
  return c;
}

export function makeSprites() {
  return {
    glowYellow: makeGlowSprite(96, 'rgba(255, 215, 94, 0.9)', 'rgba(255, 150, 40, 0.35)'),
    glowOrange: makeGlowSprite(160, 'rgba(255, 150, 50, 0.95)', 'rgba(255, 80, 20, 0.4)'),
    glowRed: makeGlowSprite(96, 'rgba(255, 90, 60, 0.9)', 'rgba(200, 40, 20, 0.35)'),
    glowFlare: makeGlowSprite(220, 'rgba(255, 233, 168, 0.95)', 'rgba(255, 200, 90, 0.3)'),
    glowWhite: makeGlowSprite(64, 'rgba(255,255,240,0.9)', 'rgba(255,255,240,0.25)'),
    smokePuff: makeSmokePuff(128),
    muzzle: makeMuzzleSprite(44),
  };
}
