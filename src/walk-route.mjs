export const NAMSAN_METRES = 20;
export const NAMSAN_TRAVEL = NAMSAN_METRES * 550 / 3;
export const YEOMGANG_METRES = 40;
export const YEOMGANG_TRAVEL = YEOMGANG_METRES * 550 / 3;
const palace = Object.freeze({ id: "deoksugung", name: "덕수궁 돌담길" });
const park = Object.freeze({ id: "namsan", name: "남산공원" });
const riverside = Object.freeze({ id: "yeomgang", name: "염강나들목" });

export function locationForDistance(distance) {
  if (!Number.isFinite(distance) || distance < NAMSAN_METRES) return palace;
  return distance >= YEOMGANG_METRES ? riverside : park;
}

export function nextDestination(distance) {
  const metres = Math.max(0, Number.isFinite(distance) ? distance : 0);
  const start = metres < NAMSAN_METRES ? 0 : NAMSAN_METRES;
  const target = start === 0 ? NAMSAN_METRES : YEOMGANG_METRES;
  const total = target - start;
  const progress = Math.min(total, Math.max(0, metres - start));
  return { progress, remaining: Math.ceil(Math.max(0, target - metres)), reached: metres >= target,
    name: start === 0 ? park.name : riverside.name, metres: target, total };
}

export function regionBlend(distance, start, reducedMotion = false) {
  if (!Number.isFinite(distance) || distance < start) return 0;
  if (reducedMotion) return 1;
  // Dissolve within the first metre, driven by distance so pause/fall freeze it.
  const t = Math.min(1, Math.max(0, (distance - start) / 0.8));
  return t * t * (3 - 2 * t);
}
export const namsanBlend = (distance, reducedMotion = false) => regionBlend(distance, NAMSAN_METRES, reducedMotion);
export const yeomgangBlend = (distance, reducedMotion = false) => regionBlend(distance, YEOMGANG_METRES, reducedMotion);
