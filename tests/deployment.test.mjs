import test from "node:test";
import assert from "node:assert/strict";
import { assetUrl, GAME_URL, GAME_LINK_LABEL } from "../src/deployment.mjs";

test("game assets resolve at both the Sites root and a Pages repository path", () => {
  for (const file of ["season-autumn.png", "yeomgang-winter.png", "original-walk-rig.json", "right.wav"]) {
    assert.equal(assetUrl(file, "/"), `/assets/${file}`);
    assert.equal(assetUrl(file, "/jeomanchi/"), `/jeomanchi/assets/${file}`);
    assert.equal(assetUrl(file, "/jeomanchi"), `/jeomanchi/assets/${file}`);
  }
});

test("shared links and the card footer retain the Pages repository path", () => {
  assert.equal(GAME_URL, "https://seonyoungyoo16.github.io/jeomanchi/");
  assert.equal(GAME_LINK_LABEL, "seonyoungyoo16.github.io/jeomanchi");
});
