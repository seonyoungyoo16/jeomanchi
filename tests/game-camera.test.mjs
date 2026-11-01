import test from "node:test";
import assert from "node:assert/strict";
import { HeronWalk } from "../src/game-core.mjs";
import { HeronRenderer } from "../src/game-renderer.mjs";

function scene(width, height) {
  const translations = [];
  const renderer = Object.assign(Object.create(HeronRenderer.prototype), {
    width, height, rig: {}, background: { width: 1586, height: 992 },
    canvas: { dataset: {} },
    ctx: {
      save() {}, restore() {}, scale() {}, drawImage() {},
      translate(x) { translations.push(x); },
    },
    resize() {}, drawBird(pose) { return pose; },
  });
  return { renderer, translations };
}

test("a postcard reframes a real snapshot with finite bird coordinates without moving the live camera", () => {
  const { renderer } = scene(390, 844);
  renderer.stats = { original: true };
  const game = new HeronWalk(); game.start();
  game.advance(0.1, -1);
  const originalDocument = globalThis.document;
  globalThis.document = { createElement() { return { dataset: {}, getContext: () => ({ ...renderer.ctx, setTransform() {} }) }; } };
  try {
    const postcard = renderer.captureScene(game.snapshot());
    const stats = JSON.parse(postcard.dataset.render);
    assert.equal(postcard.width, 1200); assert.equal(postcard.height, 750);
    assert.ok(Number.isFinite(stats.main.x), "snapshots omit fallDirection; the walking bird must still have a valid position");
    assert.equal(stats.main.frame, game.frame);
    assert.deepEqual(renderer.stats, { original: true });
    assert.equal(renderer.width, 390); assert.equal(renderer.height, 844);
    assert.equal(game.mode, "walking");
  } finally { globalThis.document = originalDocument; }
});

test("walking moves the actual backdrop with original pixel travel at the bird's scale", () => {
  const game = new HeronWalk();
  game.start();
  for (let tick = 0; tick < 30; tick++) {
    const impulse = game.velocity + game.angle * 0.1;
    const threshold = 0.55 * game.original.bi;
    game.advance(1 / 30, impulse > threshold ? -1 : impulse < -threshold ? 1 : 0);
  }
  assert.equal(game.mode, "walking");
  assert.ok(game.distance < 1, "the metre score still reads zero during the first second");

  for (const [width, height] of [[937, 585.625], [390, 844]]) {
    const { renderer, translations } = scene(width, height);
    renderer.render(game);
    const walkedOrigin = translations[1]; // Repeated tile zero, before mirroring.
    const birdScale = renderer.stats.main.height / 180;
    const { renderer: initial, translations: initialTranslations } = scene(width, height);
    initial.render(new HeronWalk());
    const movement = initialTranslations[1] - walkedOrigin;
    assert.ok(movement > 85, "first-second movement must be visible even while score reads 0m");
    assert.ok(Math.abs(movement / birdScale - game.original.xx) < 1e-8);

    game.pause();
    game.advance(0.1, 1);
    translations.length = 0;
    renderer.render(game);
    assert.equal(translations[1], walkedOrigin, "paused ground stays still");
    game.pause();
  }

  game.reset();
  const { renderer } = scene(937, 585.625);
  renderer.render(game);
  assert.equal(renderer.stats.environment.scroll, 0, "reset returns the camera to the start");
});
