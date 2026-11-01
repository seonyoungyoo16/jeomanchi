import { GameAudio } from "./original-game-audio.mjs";
export class Footsteps extends GameAudio {
  constructor(onFailure) {
    super([new Audio(), new Audio(), new Audio()], onFailure);
    this.lastCue = null;
    this.cues = 0;
  }
  step(index) {
    this.lastCue = index;
    this.cues++;
    return this.play(index);
  }
  close() { this.disable(); }
}
