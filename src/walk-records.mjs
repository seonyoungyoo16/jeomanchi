import { locationForDistance } from "./walk-route.mjs";

export const RECORDS_KEY = "jeomanchi.walk-records.v1";
const validScore = (value) => Number.isSafeInteger(value) && value >= 0;
function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }
function readSaved(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(RECORDS_KEY) || "null");
    return saved?.version === 1 && validScore(saved.best) && validScore(saved.last) && saved.last <= saved.best ? saved : null;
  } catch { return null; }
}

export function createWalkRecords(storage = browserStorage()) {
  let current = { best: 0, last: null }, persistent = Boolean(storage);
  const saved = readSaved(storage);
  if (saved) current = { best: saved.best, last: saved.last };
  return {
    read: () => ({ ...current, persistent }),
    finish(distance) {
      if (!Number.isFinite(distance) || distance < 0 || !validScore(Math.floor(distance))) throw new RangeError("Invalid walk distance");
      // Another tab may have completed a longer walk since this one opened.
      current.best = Math.max(current.best, readSaved(storage)?.best || 0);
      const score = Math.floor(distance), isNewBest = score > current.best;
      current = { best: Math.max(current.best, score), last: score };
      try {
        if (storage) storage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, ...current }));
        persistent = Boolean(storage);
      } catch { persistent = false; }
      return { ...current, persistent, score, isNewBest, location: locationForDistance(score) };
    },
  };
}
