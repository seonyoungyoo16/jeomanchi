import test from "node:test";
import assert from "node:assert/strict";
import { createWeatherClient, normalizeWeather, seasonalWeather, seoulCalendar, conditionFor, previewWeather, WEATHER_CACHE_KEY, WEATHER_URL, weatherText } from "../src/weather.mjs";
import { weatherBackgroundVariant } from "../src/weather-renderer.mjs";

const clock = new Date("2026-10-19T15:00:00+09:00");
const payload = (time = clock, code = 0) => ({ current: { time: Number(time) / 1000, temperature_2m: 14.4, weather_code: code, cloud_cover: 20, precipitation: 0, wind_speed_10m: 2.4 } });
function memory() { const map = new Map(); return { getItem: (key) => map.get(key), setItem: (key, value) => map.set(key, value) }; }

test("development previews are explicitly labeled and invalid preview parameters are ignored", () => {
  const preview = previewWeather("?season=winter&weather=snow", clock);
  assert.equal(preview.season, "winter"); assert.equal(preview.condition, "snow");
  assert.equal(preview.source, "preview"); assert.match(weatherText(preview), /^미리보기/);
  assert.equal(previewWeather("", clock), null);
  assert.equal(previewWeather("?season=spring&weather=invalid", clock), null);
});

test("seasons and day boundaries follow Seoul even for a visitor in a different timezone", () => {
  assert.equal(seoulCalendar(new Date("2026-02-28T14:59:00Z")).season, "winter");
  assert.deepEqual(seoulCalendar(new Date("2026-02-28T15:00:00Z")), { date: "2026-03-01", season: "spring", seasonLabel: "봄" });
  assert.equal(seoulCalendar(new Date("2026-05-31T15:00:00Z")).season, "summer");
  assert.equal(seoulCalendar(new Date("2026-08-31T15:00:00Z")).season, "autumn");
  assert.equal(seoulCalendar(new Date("2026-11-30T15:00:00Z")).season, "winter");
});

test("WMO weather cases distinguish clear, clouds, fog, rain, snow and storms", () => {
  for (const [code, expected] of [[0, "clear"], [1, "clear"], [2, "cloudy"], [3, "cloudy"], [48, "fog"], [56, "rain"], [67, "rain"], [82, "rain"], [77, "snow"], [86, "snow"], [97, "storm"], [99, "storm"]]) assert.equal(conditionFor(code).condition, expected);
  assert.throws(() => conditionFor(999));
});

test("weather artwork retains the calendar season for unusual rain or snow", () => {
  assert.equal(weatherBackgroundVariant({ season: "spring", condition: "cloudy", cloudCover: 90 }), "spring-cloudy");
  assert.equal(weatherBackgroundVariant({ season: "spring", condition: "cloudy", cloudCover: 40 }), "spring");
  assert.equal(weatherBackgroundVariant({ season: "summer", condition: "rain" }), "summer-rain");
  assert.equal(weatherBackgroundVariant({ season: "winter", condition: "snow" }), "winter-snow");
  assert.equal(weatherBackgroundVariant({ season: "autumn", condition: "snow" }), "autumn");
  assert.equal(weatherBackgroundVariant({ season: "winter", condition: "rain" }), "winter");
});

test("invalid or yesterday's API data cannot be presented as live weather", () => {
  assert.throws(() => normalizeWeather({ current: { ...payload().current, temperature_2m: null } }, clock));
  assert.throws(() => normalizeWeather(payload(new Date("2026-10-18T15:00:00+09:00")), clock));
  assert.throws(() => normalizeWeather(payload(new Date(Number(clock) + 60 * 60 * 1000)), clock));
  const normalized = normalizeWeather(payload(clock, 73), clock);
  assert.equal(normalized.condition, "snow");
  assert.equal(normalized.season, "autumn", "weather is independent of calendar season");
  assert.equal(normalized.source, "live");
});

test("request uses only fixed Deoksugung coordinates and explicit Korean time / wind units", () => {
  const url = new URL(WEATHER_URL);
  assert.equal(url.hostname, "api.open-meteo.com");
  assert.equal(url.searchParams.get("latitude"), "37.5658");
  assert.equal(url.searchParams.get("longitude"), "126.9751");
  assert.equal(url.searchParams.get("timezone"), "Asia/Seoul");
  assert.equal(url.searchParams.get("wind_speed_unit"), "ms");
});

test("simultaneous consumers share one request and fresh cached data avoids another call", async () => {
  let calls = 0;
  const client = createWeatherClient({ now: () => clock, storage: memory(), fetchImpl: async (_, options) => {
    calls++; assert.equal(options.credentials, "omit"); return { ok: true, json: async () => payload() };
  } });
  const [a, b] = await Promise.all([client.load(), client.load()]);
  assert.equal(calls, 1); assert.equal(a.source, "live"); assert.deepEqual(a, b);
  assert.equal((await client.load()).source, "cached"); assert.equal(calls, 1);
});

test("an offline request may reuse recent same-day weather, clearly marked as recent", async () => {
  const storage = memory();
  const earlier = new Date(Number(clock) - 45 * 60 * 1000);
  storage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ payload: payload(earlier, 63), fetchedAt: Number(earlier) }));
  const client = createWeatherClient({ now: () => clock, storage, fetchImpl: async () => { throw new Error("Offline"); } });
  const result = await client.load();
  assert.equal(result.source, "stale"); assert.equal(result.condition, "rain");
  assert.match(weatherText(result), /^최근/);
});

test("yesterday's cache expires at Korean midnight, even when only ten minutes old", async () => {
  const storage = memory();
  const beforeMidnight = new Date("2026-10-19T23:55:00+09:00"), afterMidnight = new Date("2026-10-20T00:05:00+09:00");
  storage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ payload: payload(beforeMidnight, 63), fetchedAt: Number(beforeMidnight) }));
  const result = await createWeatherClient({ storage, now: () => afterMidnight, fetchImpl: async () => { throw new Error("Offline"); } }).load();
  assert.equal(result.source, "season"); assert.equal(result.condition, "unknown");
  assert.equal(result.date, "2026-10-20"); assert.equal(result.temperature, null);
});

test("slow API and broken storage fall back without blocking weather loading indefinitely", async () => {
  const badStorage = { getItem() { throw new Error("Storage blocked"); }, setItem() { throw new Error("Storage blocked"); } };
  const client = createWeatherClient({ storage: badStorage, now: () => clock, timeoutMs: 8, fetchImpl: () => new Promise(() => {}) });
  assert.deepEqual(await client.load(), seasonalWeather(clock));
  const live = createWeatherClient({ storage: badStorage, now: () => clock, fetchImpl: async () => ({ ok: true, json: async () => payload() }) });
  assert.equal((await live.load()).source, "live");
});
