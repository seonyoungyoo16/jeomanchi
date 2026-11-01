/** A quick tap must survive until the next original 30 Hz physics frame. */
export class DirectionInput {
  constructor() { this.keys = new Set(); this.pointers = new Map(); this.taps = { left: 0, right: 0 }; }
  keyDown(direction) {
    if (!this.keys.has(direction)) this.taps[direction]++;
    this.keys.add(direction);
  }
  pointerDown(id, direction) {
    this.pointers.set(id, direction);
    this.taps[direction]++;
  }
  read() {
    const pointers = [...this.pointers.values()];
    const left = this.keys.has("left") || pointers.includes("left") || this.taps.left > 0;
    const right = this.keys.has("right") || pointers.includes("right") || this.taps.right > 0;
    this.taps.left = Math.max(0, this.taps.left - 1);
    this.taps.right = Math.max(0, this.taps.right - 1);
    return Number(right) - Number(left);
  }
  clear() {
    this.keys.clear(); this.pointers.clear();
    this.taps.left = 0; this.taps.right = 0;
  }
}
