// Pages can host the game below /<repository>/; Sites serves it at /.
export function assetUrl(file, base = import.meta.env?.BASE_URL ?? "/") {
  return `${base.replace(/\/?$/, "/")}assets/${file}`;
}

export const GAME_URL = new URL(
  (import.meta.env?.VITE_GAME_URL || "https://seonyoungyoo16.github.io/jeomanchi/").replace(/\/?$/, "/"),
).href;

export const GAME_LINK_LABEL = GAME_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
