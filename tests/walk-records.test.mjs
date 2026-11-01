import test from "node:test";
import assert from "node:assert/strict";
import { createWalkRecords, RECORDS_KEY } from "../src/walk-records.mjs";
import { nextDestination } from "../src/walk-route.mjs";
import { HeronWalk } from "../src/game-core.mjs";

function storage(initial = null) {
  let value = initial;
  return { getItem(key) { assert.equal(key, RECORDS_KEY); return value; }, setItem(key, saved) { assert.equal(key, RECORDS_KEY); value = saved; } };
}

test("completed walks survive reload; shorter retries update last without erasing the best or arrived region", () => {
  const disk = storage(), first = createWalkRecords(disk);
  assert.deepEqual(first.read(), { best: 0, last: null, persistent: true });
  assert.equal(first.finish(21.8).isNewBest, true);
  const reloaded = createWalkRecords(disk);
  assert.deepEqual(reloaded.read(), { best: 21, last: 21, persistent: true });
  const retry = reloaded.finish(2.1);
  assert.equal(retry.best, 21); assert.equal(retry.score, 2); assert.equal(retry.location.id, "deoksugung");
  assert.equal(retry.isNewBest, false);
  assert.equal(createWalkRecords(disk).read().last, 2);
  assert.equal(reloaded.finish(21.9).isNewBest, false, "equal displayed scores are not a new record");
});

test("zero metre falls, corrupt records, and disabled/quota-limited storage remain playable", () => {
  for (const corrupt of ["{", '{"version":1,"best":-1,"last":0}', '{"version":1,"best":2,"last":3}', '{"version":1,"best":"20","last":1}', '{"version":2,"best":30,"last":20}']) {
    assert.equal(createWalkRecords(storage(corrupt)).read().best, 0);
  }
  for (const disk of [null, { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } }]) {
    const records = createWalkRecords(disk);
    assert.equal(records.finish(0).isNewBest, false);
    assert.equal(records.finish(20).location.id, "namsan");
    assert.equal(records.read().best, 20); assert.equal(records.read().persistent, false);
  }
  const records = createWalkRecords(storage());
  for (const distance of [NaN, Infinity, -1, Number.MAX_VALUE]) assert.throws(() => records.finish(distance), RangeError);
});

test("a shorter walk in an already-open tab cannot overwrite a newer best from another tab", () => {
  const disk = storage(), first = createWalkRecords(disk), second = createWalkRecords(disk);
  first.finish(30);
  assert.equal(second.finish(21).best, 30);
  assert.equal(createWalkRecords(disk).read().best, 30);
});

test("destination progress advances from Namsan20m to Yeomgang40m and resets on retry", () => {
  assert.deepEqual(nextDestination(19.999), { progress: 19.999, remaining: 1, reached: false, name: "남산공원", metres: 20, total: 20 });
  assert.deepEqual(nextDestination(20), { progress: 0, remaining: 20, reached: false, name: "염강나들목", metres: 40, total: 20 });
  assert.equal(nextDestination(39.999).remaining, 1);
  assert.equal(nextDestination(40).reached, true);
  assert.equal(nextDestination(40).name, "염강나들목");
  assert.equal(nextDestination(1000).progress, 20);
  const game = new HeronWalk(); game.start();
  for (let tick = 0; tick < 1500 && game.distance < 20; tick++) {
    const impulse = game.velocity + game.angle * 0.1, threshold = 0.55 * game.original.bi;
    game.advance(1 / 30, impulse > threshold ? -1 : impulse < -threshold ? 1 : 0);
  }
  assert.equal(nextDestination(game.distance).name, "염강나들목");
  assert.equal(nextDestination(game.distance).reached, false);
  game.reset(); game.start();
  assert.deepEqual(nextDestination(game.distance), { progress: 0, remaining: 20, reached: false, name: "남산공원", metres: 20, total: 20 });
});

test("Yeomgang results persist without changing the stored record format", () => {
  const disk = storage(), records = createWalkRecords(disk);
  const result = records.finish(41.9);
  assert.equal(result.location.name, "염강나들목"); assert.equal(result.score, 41);
  assert.deepEqual(createWalkRecords(disk).read(), { best: 41, last: 41, persistent: true });
});
