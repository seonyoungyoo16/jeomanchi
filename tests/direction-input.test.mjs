import test from "node:test";
import assert from "node:assert/strict";
import { DirectionInput } from "../src/direction-input.mjs";
import { HeronWalk } from "../src/game-core.mjs";

test("a tap shorter than one original frame is applied once, not lost or held", () => {
  const input = new DirectionInput(), game = new HeronWalk(), reference = new HeronWalk();
  game.start(); reference.start();
  input.pointerDown(1, "left");
  input.pointers.delete(1);
  game.advance(1 / 120, () => input.read());
  assert.equal(game.frame, 1);
  game.advance(1 / 40, () => input.read());
  assert.equal(game.frame, 2);
  reference.advance(1 / 30, -1);
  assert.deepEqual(game.snapshot(), reference.snapshot());
  assert.equal(input.read(), 0);
});

test("a slow render consumes one queued tap but retains a real hold", () => {
  const input = new DirectionInput(), game = new HeronWalk(), reference = new HeronWalk();
  game.start(); reference.start(); input.pointerDown(9, "left"); input.pointers.delete(9);
  game.advance(1 / 15, () => input.read());
  assert.equal(game.frame, 3);
  reference.advance(1 / 30, -1); reference.advance(1 / 30, 0);
  assert.deepEqual(game.snapshot(), reference.snapshot());
  input.pointerDown(10, "right");
  assert.equal(input.read(), 1); assert.equal(input.read(), 1);
  input.clear(); assert.equal(input.read(), 0);
});

test("two fingers cancel, autorepeat does not enqueue extra keyboard taps", () => {
  const input = new DirectionInput();
  input.pointerDown(1, "left"); input.pointerDown(2, "right");
  assert.equal(input.read(), 0);
  input.clear(); input.keyDown("left"); input.keyDown("left");
  input.keys.delete("left");
  assert.equal(input.read(), -1);
  assert.equal(input.read(), 0);
});
