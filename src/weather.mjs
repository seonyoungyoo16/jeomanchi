export const WEATHER_CACHE_KEY = "jeomanchi.seoul-weather.v1";
export const WEATHER_TTL = 15 * 60 * 1000;
const STALE_LIMIT = 2 * 60 * 60 * 1000;
export const SEASONS = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };
export const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=37.5658&longitude=126.9751&current=temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m&wind_speed_unit=ms&timezone=Asia%2FSeoul&timeformat=unixtime&forecast_days=1";

export function seoulCalendar(now = new Date()) {
  const local = new Date(Number(now) + 9 * 60 * 60 * 1000);
  const month = local.getUTCMonth() + 1;
  const season = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
  return { date: local.toISOString().slice(0, 10), season, seasonLabel: SEASONS[season] };
}

export function conditionFor(code) {
  if ([0, 1].includes(code)) return { condition: "clear", label: code === 0 ? "맑음" : "대체로 맑음" };
  if ([2, 3].includes(code)) return { condition: "cloudy", label: code === 2 ? "구름 조금" : "흐림" };
  if ([45, 48].includes(code)) return { condition: "fog", label: "안개" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { condition: "rain", label: code < 60 ? "이슬비" : "비" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { condition: "snow", label: "눈" };
  if ([95, 96, 97, 99].includes(code)) return { condition: "storm", label: "뇌우" };
  throw new Error("Unknown weather code");
}

export function seasonalWeather(now = new Date(), source = "season") {
  return { ...seoulCalendar(now), condition: "unknown", label: "계절 풍경", temperature: null,
    cloudCover: 0, precipitation: 0, windSpeed: 0, observedAt: null, source };
}

export function normalizeWeather(payload, now = new Date()) {
  const current = payload?.current;
  if (!current || !Number.isFinite(current.time) || !Number.isFinite(current.temperature_2m)
    || current.temperature_2m < -80 || current.temperature_2m > 65 || !Number.isInteger(current.weather_code)) throw new Error("Invalid weather response");
  const observedAt = current.time * 1000;
  if (Number(now) - observedAt > STALE_LIMIT || observedAt - Number(now) > 30 * 60 * 1000
    || seoulCalendar(observedAt).date !== seoulCalendar(now).date) throw new Error("Outdated weather response");
  const finite = (value, max) => Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;
  return { ...seoulCalendar(now), ...conditionFor(current.weather_code),
    temperature: current.temperature_2m, cloudCover: finite(current.cloud_cover, 100),
    precipitation: finite(current.precipitation, 100), windSpeed: finite(current.wind_speed_10m, 50),
    observedAt, source: "live" };
}

function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }

export function createWeatherClient({ fetchImpl = globalThis.fetch, storage = browserStorage(), now = () => new Date(), timeoutMs = 4500 } = {}) {
  let pending;
  function cached() {
    try {
      const entry = JSON.parse(storage?.getItem(WEATHER_CACHE_KEY) || "null");
      const age = Number(now()) - entry?.fetchedAt;
      if (!Number.isFinite(age) || age < 0 || age > STALE_LIMIT) return null;
      return { weather: normalizeWeather(entry.payload, now()), age };
    } catch { return null; }
  }
  async function request() {
    let timer;
    const controller = new AbortController();
    try {
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("Weather timeout")); }, timeoutMs);
      });
      const payload = await Promise.race([
        Promise.resolve().then(async () => {
          const response = await fetchImpl(WEATHER_URL, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
          if (!response.ok) throw new Error("Weather unavailable");
          return response.json();
        }), deadline,
      ]);
      const weather = normalizeWeather(payload, now());
      try { storage?.setItem(WEATHER_CACHE_KEY, JSON.stringify({ payload, fetchedAt: Number(now()) })); } catch { /* Private mode can still use live weather. */ }
      return weather;
    } catch {
      const previous = cached();
      return previous ? { ...previous.weather, source: "stale" } : seasonalWeather(now());
    } finally { clearTimeout(timer); }
  }
  return {
    load() {
      const previous = cached();
      if (previous?.age < WEATHER_TTL) return Promise.resolve({ ...previous.weather, source: "cached" });
      if (!pending) pending = request().finally(() => { pending = null; });
      return pending;
    },
  };
}

// Called only by the development build; never used to replace production API data.
export function previewWeather(search, now = new Date()) {
  const params = new URLSearchParams(search);
  if (!SEASONS[params.get("season")]) return null;
  const codes = { clear: 0, cloudy: 3, rain: 63, snow: 73, fog: 45, storm: 95 };
  const code = codes[params.get("weather") || "clear"];
  if (code === undefined) return null;
  return { ...seasonalWeather(now), ...conditionFor(code), season: params.get("season"), seasonLabel: SEASONS[params.get("season")],
    temperature: null, cloudCover: code === 0 ? 0 : 90, precipitation: [63, 73, 95].includes(code) ? 1.5 : 0,
    windSpeed: 2, source: "preview" };
}

export function weatherText(weather) {
  const prefix = weather.source === "preview" ? "미리보기 · " : weather.source === "stale" ? "최근 · " : "";
  return prefix + weather.seasonLabel + " · " + weather.label
    + (Number.isFinite(weather.temperature) ? " · " + Math.round(weather.temperature) + "°" : "");
}
