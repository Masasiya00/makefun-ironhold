// IRONHOLD input: held keys + mouse state, and a pendingActions queue for
// one-shot presses. A one-shot press is queued the moment it happens and a
// fixed step consumes it — it can never be dropped between frames, which is
// what made earlier builds eat reloads and call-ins under load.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 640,
    mouseY: 400,
    mouseDown: false,
    pendingActions: [],
    hasPointer: false,
  };

  const KEY_ACTIONS = {
    KeyR: 'reload',
    KeyQ: 'call-supply',
    KeyE: 'call-strike',
    KeyT: 'call-mortar',
    KeyF: 'call-smoke',
    Digit1: 'weapon-1',
    Digit2: 'weapon-2',
    Digit3: 'weapon-3',
    Digit4: 'weapon-4',
    Digit5: 'weapon-5',
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    Enter: 'confirm',
    Space: 'confirm',
    ArrowLeft: 'diff-prev',
    ArrowRight: 'diff-next',
  };

  function queue(action) {
    // Coalesce repeats of the same one-shot within one frame.
    if (!input.pendingActions.includes(action)) input.pendingActions.push(action);
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    const a = KEY_ACTIONS[e.code];
    if (a) { queue(a); e.preventDefault(); }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; });

  function trackMouse(e) {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    input.hasPointer = true;
  }
  canvas.addEventListener('mousemove', trackMouse);
  canvas.addEventListener('mousedown', (e) => {
    trackMouse(e);
    if (e.button === 0) input.mouseDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}

export function takeActions(input) {
  const out = input.pendingActions;
  input.pendingActions = [];
  return out;
}

export function moveAxis(input) {
  let x = 0, y = 0;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}
