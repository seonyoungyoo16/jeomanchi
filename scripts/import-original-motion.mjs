import { copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const project = resolve(import.meta.dirname, "..");
const original = resolve(project, "../demo-intro/src/main/resources/static");
const hashes = {};
for (const [source, target] of [
  ["game-core.mjs", "src/original-walk-core.mjs"],
  ["game-audio.mjs", "src/original-game-audio.mjs"],
  ["game-sound-cues.mjs", "src/game-sound-cues.mjs"],
  ["assets/shape-117.svg", "public/assets/original-leg.svg"],
  ["assets/shape-118.svg", "public/assets/original-body.svg"],
  ["assets/shape-119.svg", "public/assets/original-head.svg"],
  ...["right.wav", "left.wav", "fall.wav"].map((name) => ["assets/" + name, "public/assets/" + name]),
]) {
  await copyFile(resolve(original, source), resolve(project, target));
  hashes[source] = createHash("sha256").update(await readFile(resolve(original, source))).digest("hex");
}
const audioPath = resolve(project, "src/original-game-audio.mjs");
const audio = await readFile(audioPath, "utf8");
await writeFile(audioPath, audio.replace(
  "const SOUNDS = ['right.wav', 'left.wav', 'fall.wav'].map(file => new URL(" + String.fromCharCode(96) + "assets/" + "$" + "{file}" + String.fromCharCode(96) + ", import.meta.url).href);",
  "const SOUNDS = ['right.wav', 'left.wav', 'fall.wav'].map(file => '/assets/' + file);",
));
const scene = JSON.parse(await readFile(resolve(original, "assets/scene.json"), "utf8"));
// Preserve both original head paths. Only extend its transparent bounds and
// place two short tapered crest feathers behind the original crown.
const originalHead = await readFile(resolve(original, "assets/shape-119.svg"), "utf8");
const crest = [
  '    <path data-part="crest-1" d="M-10.4 -13.4 Q-19.2 -14.7 -32.2 -7.8 Q-23.7 -9.4 -17.2 -10.7 Q-13.1 -11.6 -10.2 -11.7 Z" fill="#000000" />',
  '    <path data-part="crest-2" d="M-12.7 -10.2 Q-20.0 -3.3 -29.6 0.2 Q-23.3 0.0 -12.4 -7.4 Z" fill="#000000" />',
].join("\n");
const crestedHead = originalHead
  .replace('height="27.55px" width="75.65px"', 'height="32px" width="96px"')
  .replace("1.0, 15.55, 16.6)", "1.0, 35.0, 19.0)")
  .replace('    <path d=', crest + '\n    <path d=');
await writeFile(resolve(project, "public/assets/original-head-crest.svg"), crestedHead);
await writeFile(resolve(project, "public/assets/original-walk-rig.json"), JSON.stringify({
  fps: 30, frames: scene.frames.slice(0, 16),
  leg: { ...scene.assets[117], file: "original-leg.svg" },
  body: { ...scene.assets[118], file: "original-body.svg" },
  head: { file: "original-head-crest.svg", width: 96, height: 32, origin: [35, 19] },
  landingFrames: [1, 9], source: "../demo-intro/src/main/resources/static/assets/scene.json",
}, null, 2) + "\n");
await writeFile(resolve(project, "docs/original-motion-import.json"), JSON.stringify(hashes, null, 2) + "\n");
console.log("Original character, 30 Hz motion and WAV effects copied. Only two head crest paths added.");
