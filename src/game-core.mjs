import { StorkGame, STEP_MS } from "./original-walk-core.mjs";
export const TAU = Math.PI * 2;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const BALANCE_RATE = 0.8;
export class HeronWalk {
  constructor() { this.reset(); }
  reset() {
    this.original = new StorkGame();
    Object.assign(this, {
      mode: "ready", time: 0, distance: 0, travel: 0, lean: 0, velocity: 1,
      frame: 1, angle: 0, rotation: 0, neck: 0, gait: 0,
      shadowGait: 0.23, shadowGap: 8.5, fallTime: 0,
      shadowLookTime: 0, shadowLookArmed: true,
      fallDirection: 1, steps: 0, accumulator: 0, speed: 0,
    });
  }
  start() {
    if (!["ready", "result"].includes(this.mode)) return false;
    this.reset();
    this.original.state = "walking";
    this.mode = "walking";
    return true;
  }
  pause() {
    if (this.mode === "walking") this.mode = "paused";
    else if (this.mode === "paused") this.mode = "walking";
  }
  advance(seconds, input = 0) {
    if (["ready", "paused", "result"].includes(this.mode)) return;
    this.accumulator += clamp(seconds, 0, 0.1);
    const dt = STEP_MS / 1000;
    while (this.accumulator + 1e-10 >= dt) {
      if (!["walking", "falling"].includes(this.mode)) break;
      const before = this.original.frame;
      const previousAngle = this.original.angle, previousVelocity = this.original.bs;
      const direction = typeof input === "function" ? input() : input;
      this.original.step({ left: direction < -0.01, right: direction > 0.01 });
      if (this.original.state === "walking") {
        // Slow balance progression and steering by 20%, without slowing the original
        // 30 Hz footsteps, forward travel, animation poses or fall sequence.
        this.original.bs = previousVelocity + (this.original.bs - previousVelocity) * BALANCE_RATE;
        this.original.angle = previousAngle + this.original.bs * BALANCE_RATE;
        this.original.rotation = this.original.angle / 3;
      }
      this.time += dt;
      this.shadowGait += dt * 30 / 16;
      this.travel = this.original.xx;
      this.distance = this.original.xx / 550 * 3;
      this.frame = this.original.frame;
      this.gait = (this.frame - 1) / 16;
      this.angle = this.original.angle;
      this.rotation = this.original.rotation;
      this.lean = this.angle * Math.PI / 180;
      this.velocity = this.original.bs;
      this.speed = this.original.xs;
      this.shadowGap += dt * (0.05 + Math.abs(this.lean) * 0.26);
      this.mode = this.original.state;
      this.shadowLookTime = Math.max(0, this.shadowLookTime - dt);
      if (Math.abs(this.angle) < 18) this.shadowLookArmed = true;
      if (this.mode === "walking" && Math.abs(this.angle) >= 32 && this.shadowLookArmed) {
        this.shadowLookTime = 0.75;
        this.shadowLookArmed = false;
      }
      if (this.mode === "walking" && this.frame !== before) {
        const distance = (this.frame - before + 16) % 16;
        for (let step = 1; step <= distance; step++) {
          if ([1, 9].includes((before - 1 + step) % 16 + 1)) this.steps++;
        }
      }
      if (this.mode === "falling" || this.mode === "result") {
        this.fallDirection = this.original.fallFrame === 23 ? -1 : 1;
        this.fallTime = this.original.fallTicks / 30;
        this.shadowGap += dt * 3;
      }
      this.accumulator -= dt;
    }
  }
  snapshot() {
    return {
      mode: this.mode, time: this.time, distance: this.distance, travel: this.travel,
      lean: this.lean, velocity: this.velocity, neck: this.neck,
      angle: this.angle, rotation: this.rotation, frame: this.frame,
      gait: this.gait, shadowGait: this.shadowGait,
      shadowGap: this.shadowGap, steps: this.steps, fallTime: this.fallTime,
      shadowLookingBack: this.shadowLookTime > 0,
    };
  }
}
