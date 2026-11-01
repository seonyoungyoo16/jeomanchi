import test from "node:test";
import assert from "node:assert/strict";
import { postcardDetails, sharePostcard } from "../src/walk-postcard.mjs";
import { seasonalWeather } from "../src/weather.mjs";

const climate = { ...seasonalWeather(new Date("2026-10-24T14:59:00Z")), condition: "clear", label: "맑음", temperature: 16.4, source: "live" };
const card = { blob: new Blob(["card"], { type: "image/png" }), filename: "저만치-2026-10-25-21m.png", details: postcardDetails({ score: 21, best: 25 }, climate, new Date("2026-10-24T15:01:00Z")) };

test("postcards freeze the completed score, Seoul date, destination and honestly labelled weather", () => {
  assert.equal(card.details.date, "2026-10-25"); assert.equal(card.details.location, "남산공원");
  assert.equal(card.details.caption, "오늘 남산까지 걸었다."); assert.equal(card.details.best, 25);
  assert.equal(card.details.climate, "가을 · 맑음 · 16°");
  const before = postcardDetails({ score: 19, best: 21 }, { ...climate, source: "stale" });
  assert.equal(before.location, "덕수궁 돌담길"); assert.match(before.caption, /19m/);
  assert.match(before.climate, /^최근/);
  const unavailable = postcardDetails({ score: 0, best: 0 }, seasonalWeather());
  assert.doesNotMatch(unavailable.climate, /°/);
  assert.equal(Object.isFrozen(before), true);
  const riverside = postcardDetails({ score: 41, best: 45 }, climate);
  assert.equal(riverside.location, "염강나들목"); assert.equal(riverside.caption, "오늘은 한강까지 걸었다.");
});

test("supported image sharing sends only the PNG without mixed text or links", async () => {
  let shared;
  const outcome = await sharePostcard(card, {
    navigatorImpl: { canShare({ files }) { return files[0].type === "image/png"; }, async share(data) { shared = data; } },
    save() { assert.fail("Must not download a shared file"); },
  });
  assert.equal(outcome, "shared"); assert.equal(shared.files[0].name, card.filename);
  assert.equal(await shared.files[0].text(), "card");
  assert.equal(shared.files[0].type, "image/png");
  assert.deepEqual(Object.keys(shared), ["files"]);
});

test("browsers without file sharing fall back to a PNG download", async () => {
  for (const navigatorImpl of [{}, { canShare: () => false, share() { assert.fail(); } }, { canShare() { throw new Error("unsupported"); } }]) {
    let saved = 0;
    assert.equal(await sharePostcard(card, { navigatorImpl, save(value) { assert.equal(value, card); saved++; } }), "saved");
    assert.equal(saved, 1);
  }
});

test("cancelling share is quiet while blocked image sharing falls back to a PNG download", async () => {
  let saved = 0;
  const save = (value) => { assert.equal(value, card); saved++; };
  const navigatorImpl = { canShare: () => true, async share() { throw new DOMException("Cancelled", "AbortError"); } };
  assert.equal(await sharePostcard(card, { navigatorImpl, save }), "cancelled");
  assert.equal(saved, 0);
  navigatorImpl.share = async () => { throw new DOMException("Denied", "NotAllowedError"); };
  assert.equal(await sharePostcard(card, { navigatorImpl, save }), "saved");
  assert.equal(saved, 1);
});
