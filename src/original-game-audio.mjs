import { assetUrl } from './deployment.mjs';

const SOUNDS = ['right.wav', 'left.wav', 'fall.wav'].map(file => assetUrl(file));

export class GameAudio {
  constructor(elements, onFailure = () => {}) {
    this.elements = elements;
    this.onFailure = onFailure;
    this.enabled = false;
    this.ready = false;
    this.failed = false;
    this.generation = 0;
    this.requests = [0, 0, 0];
    elements.forEach((element, index) => {
      element.preload = 'auto';
      element.volume = .7;
      element.src = SOUNDS[index];
      element.load();
    });
  }

  enable({ preview = true } = {}) {
    this.stop();
    const generation = this.generation;
    this.enabled = true;
    this.ready = false;
    this.failed = false;
    // Authorize all preloaded elements in this click gesture. No source changes
    // or reloads are needed at a landing; each foot reuses its prepared player.
    const unlocks = this.elements.map((element, index) => {
      if (generation !== this.generation) return Promise.resolve(false);
      const audible = preview && index === 0;
      element.muted = !audible;
      return this.playElement(index, generation).then(played => {
        if (generation !== this.generation) return false;
        if (!audible) { element.pause(); element.currentTime = 0; }
        element.muted = false;
        return played;
      });
    });
    return Promise.all(unlocks).then(played => {
      if (generation !== this.generation) return false;
      this.ready = this.enabled && played.every(Boolean);
      if (!this.ready && this.enabled) this.fail(new Error('Sound preparation interrupted'));
      return this.ready;
    });
  }

  stop() {
    this.generation++;
    if (!this.ready) this.enabled = false;
    for (const element of this.elements) {
      element.pause();
      element.muted = false;
      try { element.currentTime = 0; } catch { /* No media loaded yet. */ }
    }
  }

  disable() {
    this.enabled = false;
    this.ready = false;
    this.failed = false;
    this.stop();
  }

  fail(error) {
    this.enabled = false;
    this.ready = false;
    this.failed = true;
    this.stop();
    this.onFailure(error);
  }

  playElement(index, generation = this.generation) {
    const request = ++this.requests[index];
    const failed = error => {
      if (generation === this.generation && request === this.requests[index]
          && this.enabled && error.name !== 'AbortError') this.fail(error);
      return false;
    };
    try {
      return Promise.resolve(this.elements[index].play()).then(
        () => generation === this.generation && this.enabled, failed);
    } catch (error) {
      return Promise.resolve(failed(error));
    }
  }

  play(index) {
    if (!this.enabled || !this.ready) return Promise.resolve(false);
    if (index === 2) {
      // A fall replaces any remaining footstep tails.
      for (const element of this.elements.slice(0, 2)) element.pause();
    }
    try { this.elements[index].currentTime = 0; }
    catch (error) { this.fail(error); return Promise.resolve(false); }
    return this.playElement(index);
  }
}
