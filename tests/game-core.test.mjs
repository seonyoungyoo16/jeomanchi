import test from "node:test";
import assert from "node:assert/strict";
import { HeronWalk } from "../src/game-core.mjs";
import { StorkGame } from "../src/original-walk-core.mjs";

test("ready and pause do not advance the walk or shadow", () => {
  const game = new HeronWalk();
  game.advance(0.1);
  assert.equal(game.distance, 0);
  game.start();
  game.advance(0.1);
  game.pause();
  const paused = game.snapshot();
  for (let i = 0; i < 20; i++) game.advance(0.1, -1);
  assert.deepEqual(game.snapshot(), paused);
  game.pause();
  game.advance(0.1);
  assert.ok(game.distance > paused.distance);
});

test("countersteering can sustain 60 seconds, shadow remains ahead", () => {
  const game = new HeronWalk();
  game.start();
  for (let frame = 0; frame < 60 * 60; frame++) {
    const impulse = game.velocity + game.angle * 0.1;
    const threshold = 0.55 * game.original.bi;
    game.advance(1 / 60, impulse > threshold ? -1 : impulse < -threshold ? 1 : 0);
  }
  assert.equal(game.mode, "walking");
  assert.ok(game.distance > 80);
  assert.ok(Math.abs(game.angle) < 10);
  assert.ok(game.shadowGap > 8.5);
  assert.ok(game.steps > 100);
});

test("gentler balance preserves original forward speed, distance and exact 16-pose cadence", () => {
  const game = new HeronWalk(), original = new StorkGame();
  game.start(); original.state = "walking";
  for (let tick = 0; tick < 1800; tick++) {
    const impulse = original.bs + original.angle * 0.1;
    const input = impulse > 0.55 * original.bi ? -1 : impulse < -0.55 * original.bi ? 1 : 0;
    const gentleImpulse = game.velocity + game.angle * 0.1;
    const gentleInput = gentleImpulse > 0.55 * game.original.bi ? -1 : gentleImpulse < -0.55 * game.original.bi ? 1 : 0;
    original.step({ left: input < 0, right: input > 0 });
    game.advance(1 / 30, gentleInput);
    assert.equal(game.mode, "walking");
    assert.equal(original.state, "walking");
    assert.equal(game.frame, original.frame);
    assert.equal(game.speed, original.xs);
    assert.equal(Math.floor(game.distance), original.metres);
  }
});

test("balance gives a little more reaction time while an unattended round still falls", () => {
  const original = new StorkGame(), game = new HeronWalk();
  original.state = "walking"; game.start();
  let originalFall = null, gentleFall = null, originalWobble = null, gentleWobble = null;
  for (let tick = 1; tick <= 90; tick++) {
    original.step(); game.advance(1 / 30);
    if (originalWobble === null && Math.abs(original.angle) >= 32) originalWobble = tick / 30;
    if (gentleWobble === null && Math.abs(game.angle) >= 32) gentleWobble = tick / 30;
    if (originalFall === null && original.state !== "walking") originalFall = tick / 30;
    if (gentleFall === null && game.mode !== "walking") gentleFall = tick / 30;
  }
  assert.ok(originalFall && gentleFall, "balancing is still required");
  assert.ok(gentleFall / originalFall >= 1.15 && gentleFall / originalFall <= 1.4,
    "ease difficulty moderately, keeping the wobbling challenge");
  assert.ok(gentleFall - gentleWobble >= originalFall - originalWobble + 0.09,
    "a large wobble gives more time to countersteer");
  assert.equal(game.mode, "result");
});

test("fixed timestep is independent of 30 / 60 / 120 Hz rendering", () => {
  const outcomes = [30, 60, 120].map((fps) => {
    const game = new HeronWalk();
    game.start();
    for (let i = 0; i < fps * 2; i++) game.advance(1 / fps);
    return game.snapshot();
  });
  for (const outcome of outcomes) {
    assert.ok(Math.abs(outcome.distance - outcomes[0].distance) < 0.03);
    assert.ok(Math.abs(outcome.lean - outcomes[0].lean) < 0.01);
  }
});

test("unbalanced walk falls, shadow continues, Space retry resets the round", () => {
  const game = new HeronWalk();
  game.start();
  for (let i = 0; i < 600 && game.mode !== "falling"; i++) game.advance(1 / 60, 1);
  assert.equal(game.mode, "falling");
  const distance = game.distance, shadow = game.shadowGait;
  for (let i = 0; i < 120; i++) game.advance(1 / 60);
  assert.equal(game.mode, "result");
  assert.ok(game.distance >= distance && game.distance - distance < 0.1, "original retains two coasting ticks");
  const finished = game.snapshot();
  game.advance(0.1);
  assert.deepEqual(game.snapshot(), finished);
  assert.ok(game.shadowGait > shadow);
  assert.equal(game.start(), true);
  assert.equal(game.mode, "walking");
  assert.equal(game.time, 0);
  assert.equal(game.distance, 0);
});

test("start cannot reset a walk in progress and reset hides the shadow", () => {
  const game = new HeronWalk();
  game.start();
  game.advance(0.1);
  assert.equal(game.start(), false);
  assert.ok(game.distance > 0);
  game.reset();
  assert.equal(game.mode, "ready");
  assert.equal(game.distance, 0);
});

test("shadow briefly looks back at a big wobble while continuing to walk, then looks forward", () => {
  const game = new HeronWalk();
  assert.equal(game.snapshot().shadowLookingBack, false);
  game.start();
  game.advance(1 / 30, -1); // A short countersteer and small wobble get no reaction.
  for (let tick = 0; tick < 15; tick++) game.advance(1 / 30);
  assert.equal(game.snapshot().shadowLookingBack, false);
  for (let tick = 0; tick < 15 && !game.snapshot().shadowLookingBack; tick++) game.advance(1 / 30, 1);
  assert.equal(game.mode, "walking");
  assert.ok(game.angle >= 32);
  assert.equal(game.snapshot().shadowLookingBack, true);
  const gait = game.shadowGait, gap = game.shadowGap;
  game.pause();
  const paused = game.snapshot();
  game.advance(0.1);
  assert.deepEqual(game.snapshot(), paused);
  game.pause();
  for (let tick = 0; tick < 45; tick++) {
    const impulse = game.velocity + game.angle * 0.1;
    const threshold = 0.55 * game.original.bi;
    game.advance(1 / 30, impulse > threshold ? -1 : impulse < -threshold ? 1 : 0);
  }
  assert.equal(game.mode, "walking");
  assert.equal(game.snapshot().shadowLookingBack, false);
  assert.ok(game.shadowGait > gait);
  assert.ok(game.shadowGap >= gap);
  game.reset();
  assert.equal(game.snapshot().shadowLookingBack, false);
});
