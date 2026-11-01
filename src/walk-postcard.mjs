import { locationForDistance } from "./walk-route.mjs";
import { seoulCalendar, weatherText } from "./weather.mjs";
import { GAME_LINK_LABEL } from "./deployment.mjs";

export { GAME_URL } from "./deployment.mjs";

export function postcardDetails(round, weather, now = new Date()) {
  const location = locationForDistance(round.score);
  return Object.freeze({
    score: round.score, best: round.best, location: location.name,
    date: seoulCalendar(now).date, climate: weatherText(weather),
    caption: location.id === "yeomgang" ? "오늘은 한강까지 걸었다." : location.id === "namsan" ? "오늘 남산까지 걸었다." : `오늘은 ${round.score}m를 걸었다.`,
    afterword: "그림자는 여전히 저만치.",
  });
}

export async function createPostcard(scene, details, brandImage) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Card canvas unavailable");
  ctx.fillStyle = "#fbf9f3"; ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = "#414348";
  // Reuse the already-loaded header symbol, so branding cannot delay a new walk.
  if (brandImage?.complete && brandImage.naturalWidth > 0) ctx.drawImage(brandImage, 48, 14, 60, 73.2);
  ctx.textAlign = "right"; ctx.font = '400 21px "Noto Sans KR", sans-serif';
  ctx.fillText(details.date.replaceAll("-", "."), 1032, 70);
  ctx.drawImage(scene, 36, 108, 1008, 630);
  ctx.textAlign = "left";
  ctx.font = '500 22px "Noto Sans KR", sans-serif'; ctx.fillText(details.location, 48, 794);
  ctx.textAlign = "right";
  ctx.font = '700 43px "Noto Sans KR", sans-serif'; ctx.fillText(`${details.score} m`, 1032, 797);
  ctx.textAlign = "left";
  ctx.font = '400 27px "Noto Sans KR", sans-serif';
  ctx.fillText(details.caption, 48, 859); ctx.fillText(details.afterword, 48, 902);
  ctx.fillStyle = "#70716b"; ctx.font = '400 19px "Noto Sans KR", sans-serif';
  ctx.fillText(`서울 · ${details.climate}   /   최고 ${details.best} m`, 48, 969);
  ctx.font = '400 16px "Noto Sans KR", sans-serif';
  ctx.fillText(GAME_LINK_LABEL, 48, 1033);
  ctx.textAlign = "right"; ctx.fillText("날씨 Open-Meteo", 1032, 1033);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Card image unavailable");
  const imageUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Card image unavailable"));
    reader.readAsDataURL(blob);
  });
  return { blob, imageUrl, details, filename: `저만치-${details.date}-${details.score}m.png` };
}

// The file is prepared before the click, so iOS keeps the user gesture for share().
export async function sharePostcard(card, { navigatorImpl = globalThis.navigator, save } = {}) {
  const file = new File([card.blob], card.filename, { type: "image/png" });
  let canShare = false;
  try { canShare = Boolean(navigatorImpl?.canShare?.({ files: [file] })); } catch { /* Use download instead. */ }
  if (!navigatorImpl?.share || !canShare) { save(card); return "saved"; }
  try {
    // Share the PNG alone so image targets can treat the card as a photo.
    // The public game URL has its own copy control.
    await navigatorImpl.share({ files: [file] });
    return "shared";
  } catch (error) {
    if (error?.name === "AbortError") return "cancelled";
    save(card);
    return "saved";
  }
}

export function downloadPostcard(card) {
  const link = document.createElement("a");
  link.href = card.imageUrl; link.download = card.filename; link.type = "image/png";
  document.body.append(link); link.click(); link.remove();
}
