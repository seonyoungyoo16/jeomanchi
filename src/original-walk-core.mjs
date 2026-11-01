// The original 30 Hz ActionScript balance equations, expressed in JavaScript.
// See docs/original-mechanics.md for source mapping and intentional differences.
export const FPS = 30;
export const STEP_MS = 1000 / FPS;

export class StorkGame {
  constructor() {
    this.state = 'title';
    this.resetRound();
  }

  resetRound() {
    this.angle = 0;      // body._rotation
    this.rotation = 0;   // stork._rotation
    this.bs = 1;         // angular velocity
    this.bi = 1;         // balance impulse, increases each frame
    this.xs = 0;         // forward speed
    this.xx = 0;         // travelled pixels
    this.metres = 0;
    this.frame = 1;
    this.ticks = 0;
    this.fallFrame = 19;
    this.fallTicks = 0;
  }

  space() {
    if (this.state === 'title' || this.state === 'result') {
      this.resetRound();
      this.state = 'entering';
    } else if (this.state === 'ready') {
      this.state = 'walking';
    }
  }

  quit() {
    this.resetRound();
    this.state = 'title';
  }

  retry() {
    if (this.state !== 'result') return;
    this.resetRound();
    this.state = 'walking';
  }

  step({ left = false, right = false } = {}) {
    if (this.state === 'entering') {
      this.ticks++;
      if (this.ticks >= 18) this.state = 'ready';
      return;
    }
    if (this.state !== 'walking' && this.state !== 'falling') return;

    // Preserve original evaluation order: score uses the previous frame's xs.
    this.xx += this.xs;
    this.metres = Math.floor(this.xx / 550 * 3);
    if (this.state === 'falling') {
      this.fallTicks++;
      if (this.fallTicks >= 2) this.xs = 0;
      if (this.fallTicks >= 20) this.state = 'result';
      return;
    }

    this.xs = this.bi * 3;
    this.bi += 0.002;
    if (left) this.bs -= this.bi;
    if (right) this.bs += this.bi;

    if (this.angle < -110 || this.angle > 80) {
      this.fallFrame = this.angle < -110 ? 23 : 19;
      this.rotation = 0;
      this.bs = 0;
      this.state = 'falling';
      return;
    }
    this.bs += this.rotation * this.bi / 100;
    this.angle += this.bs;
    this.rotation = this.angle / 3;
    let next = this.frame + 1;
    // ActionScript's gotoAndPlay executes on these frames, shortening the
    // walking cycle as the forward speed crosses the original thresholds.
    if (([2, 10].includes(next) && this.xs > 5)
        || ([5, 13].includes(next) && this.xs > 9)
        || ([8, 16].includes(next) && this.xs > 7)) next++;
    this.frame = next >= 17 ? 1 : next;
    this.ticks++;
  }
}

export function readBest(storage) {
  try {
    const value = Number(storage.getItem('walk-the-stork.best'));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveBest(storage, score, best) {
  const next = Math.max(score, best);
  try { storage.setItem('walk-the-stork.best', String(next)); } catch { /* storage is optional */ }
  return next;
}
