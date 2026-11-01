import test from "node:test";
import assert from "node:assert/strict";
import { HeronWalk } from "../src/game-core.mjs";
import { HeronRenderer } from "../src/game-renderer.mjs";
import { locationForDistance, namsanBlend, yeomgangBlend, NAMSAN_TRAVEL, YEOMGANG_TRAVEL } from "../src/walk-route.mjs";

function advanceTo(game, metres) {
  while (game.distance < metres && game.mode === "walking") {
    const impulse = game.velocity + game.angle * 0.1;
    const threshold = 0.55 * game.original.bi;
    game.advance(1 / 30, impulse > threshold ? -1 : impulse < -threshold ? 1 : 0);
  }
  assert.equal(game.mode, "walking");
}

function scene() {
  const painted = [], alpha = [];
  const renderer = Object.assign(Object.create(HeronRenderer.prototype), {
    width: 1586, height: 992, rig: {}, reducedMotion: false,
    background: { id: "palace", width: 1586, height: 992 },
    namsanBackground: { id: "park", width: 1586, height: 992 },
    yeomgangBackground: { id: "river", width: 1586, height: 992 }, yeomgangSeason: "autumn",
    namsanSeason: "autumn", backgroundSeason: "autumn", backgroundVariant: "autumn",
    canvas: { dataset: {} },
    ctx: {
      globalAlpha: 1,
      save() { alpha.push(this.globalAlpha); }, restore() { this.globalAlpha = alpha.pop(); },
      scale() {}, translate() {}, beginPath() {}, rect() {}, clip() {}, drawImage(image) { painted.push({ id: image.id, opacity: this.globalAlpha }); },
    },
    resize() {}, drawBird(pose) { return pose; },
  });
  return { renderer, painted };
}

test("Namsan starts at20m and the dissolve finishes while the score still reads20", () => {
  assert.equal(locationForDistance(19.999).id, "deoksugung");
  assert.equal(locationForDistance(20).id, "namsan");
  assert.equal(locationForDistance(39.999).id, "namsan");
  assert.equal(locationForDistance(40).id, "yeomgang");
  assert.equal(locationForDistance(120).id, "yeomgang");
  assert.equal(locationForDistance(NaN).id, "deoksugung");
  assert.equal(namsanBlend(19.99), 0);
  assert.ok(namsanBlend(20.4) > 0 && namsanBlend(20.4) < 1);
  assert.equal(namsanBlend(20.8), 1);
  assert.equal(namsanBlend(20, true), 1, "reduced motion switches without a dissolve");
});

test("Yeomgang begins at40m and blends from Namsan without changing physics, feet or pause behavior", () => {
  assert.equal(yeomgangBlend(39.999), 0);
  assert.ok(yeomgangBlend(40.4) > 0 && yeomgangBlend(40.4) < 1);
  assert.equal(yeomgangBlend(40.8), 1);
  assert.equal(yeomgangBlend(40, true), 1);
  const game = new HeronWalk(); game.start();
  const { renderer, painted } = scene();
  advanceTo(game, 39.8); renderer.render(game);
  assert.equal(renderer.stats.location, "namsan");
  assert.deepEqual([...new Set(painted.map(p => p.id))], ["park"]);
  painted.length = 0; advanceTo(game, 40.4);
  const before = game.snapshot(); renderer.render(game);
  assert.deepEqual(game.snapshot(), before);
  assert.deepEqual([...new Set(painted.map(p => p.id))], ["park", "river"]);
  assert.ok(painted.some(p => p.id === "river" && p.opacity > 0 && p.opacity < 1));
  painted.length = 0; advanceTo(game, 41); renderer.render(game);
  assert.equal(renderer.stats.location, "yeomgang");
  assert.equal(renderer.stats.backgroundVariant, "yeomgang-autumn");
  assert.equal(renderer.stats.main.frame, game.frame);
  assert.equal(renderer.stats.ground, 992 * 0.833);
  assert.equal(renderer.stats.environment.framed, true);
  assert.deepEqual([...new Set(painted.map(p => p.id))], ["river"]);
  assert.ok(Math.abs(renderer.stats.environment.scroll - (game.travel - YEOMGANG_TRAVEL) * renderer.stats.main.height / 180) < 1e-8);
  game.pause(); const scroll = renderer.stats.environment.scroll;
  game.advance(0.1, 1); renderer.render(game);
  assert.equal(renderer.stats.environment.scroll, scroll);
  game.pause(); while (["walking", "falling"].includes(game.mode)) game.advance(1 / 30, 1);
  renderer.render(game); assert.equal(renderer.stats.location, "yeomgang");
  assert.ok(game.start()); painted.length = 0; renderer.render(game);
  assert.equal(renderer.stats.location, "deoksugung"); assert.equal(renderer.stats.environment.scroll, 0);
  assert.deepEqual([...new Set(painted.map(p => p.id))], ["palace"]);
});

test("the Yeomgang portal stays framed while the foreground scrolls at the unchanged walking speed", () => {
  const game = new HeronWalk(); game.start(); advanceTo(game, 41);
  const { renderer } = scene(); renderer.render(game);
  const initial = { ...renderer.stats.environment };
  advanceTo(game, 42); renderer.render(game);
  assert.equal(renderer.stats.environment.frameOrigin, initial.frameOrigin);
  assert.ok(renderer.stats.environment.scroll > initial.scroll);
  assert.ok(renderer.stats.environment.weatherWindow.height < renderer.stats.height * 0.77);
});

test("a missing final-region asset leaves the previous scenery playable", () => {
  const game = new HeronWalk(); game.start(); advanceTo(game, 41);
  const { renderer, painted } = scene(); renderer.yeomgangBackground = null;
  renderer.render(game);
  assert.equal(renderer.stats.yeomgangReady, false);
  assert.deepEqual([...new Set(painted.map(p => p.id))], ["park"]);
  assert.equal(renderer.stats.main.frame, game.frame);
});

test("a real20m walk paints Namsan with its own camera origin without changing the bird", () => {
  const game = new HeronWalk(); game.start();
  const { renderer, painted } = scene();
  advanceTo(game, 19.8); renderer.render(game);
  assert.equal(renderer.stats.location, "deoksugung");
  assert.deepEqual([...new Set(painted.map(p => p.id))], ["palace"]);
  painted.length = 0;
  advanceTo(game, 20.4);
  const before = game.snapshot(); renderer.render(game);
  assert.deepEqual(game.snapshot(), before, "scenery does not advance physics or gait");
  assert.deepEqual([...new Set(painted.map(p => p.id))], ["palace", "park"]);
  assert.ok(painted.some(p => p.id === "park" && p.opacity > 0 && p.opacity < 1));
  painted.length = 0;
  advanceTo(game, 21); renderer.render(game);
  assert.deepEqual([...new Set(painted.map(p => p.id))], ["park"]);
  assert.equal(renderer.stats.backgroundVariant, "namsan-autumn");
  assert.equal(renderer.stats.main.frame, game.frame);
  assert.ok(Math.abs(renderer.stats.environment.scroll - (game.travel - NAMSAN_TRAVEL) * renderer.stats.main.height / 180) < 1e-8);
  game.pause(); const paused = renderer.stats.environment.scroll;
  game.advance(0.1, 1); renderer.render(game);
  assert.equal(renderer.stats.environment.scroll, paused);
});

test("fall/retry and reset return from Namsan to the original start", () => {
  const game = new HeronWalk(); game.start(); advanceTo(game, 21);
  const { renderer, painted } = scene();
  while (game.mode === "walking" || game.mode === "falling") game.advance(1 / 30, 1);
  renderer.render(game); assert.equal(renderer.stats.location, "namsan");
  assert.equal(game.start(), true); painted.length = 0; renderer.render(game);
  assert.equal(renderer.stats.location, "deoksugung");
  assert.equal(renderer.stats.environment.scroll, 0);
  assert.deepEqual([...new Set(painted.map(p => p.id))], ["palace"]);
  game.reset(); renderer.render(game);
  assert.equal(renderer.stats.shadow, null);
});

test("a late seasonal asset cannot overwrite the latest weather and outages retain a playable scene", async () => {
  const originalImage = globalThis.Image;
  const requests = [];
  globalThis.Image = class { set src(src) { this.url = src; requests.push(this); } };
  try {
    const renderer = Object.assign(Object.create(HeronRenderer.prototype), { seasonImages: new Map(), weatherRequest: 1 });
    const old = renderer.prepareNamsan({ season: "spring", condition: "clear" }, 1);
    renderer.weatherRequest = 2;
    const recent = renderer.prepareNamsan({ season: "summer", condition: "clear" }, 2);
    requests[1].onload(); await recent;
    requests[0].onload(); await old;
    assert.equal(renderer.namsanSeason, "summer");
    assert.equal(renderer.namsanBackground, requests[1]);
    const failed = renderer.prepareNamsan({ season: "winter", condition: "clear" }, 2);
    requests[2].onerror(); await failed;
    assert.equal(renderer.namsanBackground, requests[1]);
  } finally { globalThis.Image = originalImage; }
});

test("Yeomgang seasonal loads ignore stale weather responses and keep a previous image on failure", async () => {
  const originalImage = globalThis.Image, requests = [];
  globalThis.Image = class { set src(src) { this.url = src; requests.push(this); } };
  try {
    const renderer = Object.assign(Object.create(HeronRenderer.prototype), { seasonImages: new Map(), weatherRequest: 1 });
    const old = renderer.prepareYeomgang({ season: "spring", condition: "clear" }, 1);
    renderer.weatherRequest = 2;
    const recent = renderer.prepareYeomgang({ season: "autumn", condition: "clear" }, 2);
    assert.match(requests[1].url, /yeomgang-autumn\.png$/);
    requests[1].onload(); await recent; requests[0].onload(); await old;
    assert.equal(renderer.yeomgangSeason, "autumn");
    const failed = renderer.prepareYeomgang({ season: "winter", condition: "clear" }, 2);
    requests[2].onerror(); await failed;
    assert.equal(renderer.yeomgangBackground, requests[1]);
  } finally { globalThis.Image = originalImage; }
});
