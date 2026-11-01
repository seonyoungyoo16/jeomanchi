import { clamp } from "./game-core.mjs";
import { assetUrl } from "./deployment.mjs";
import { seasonalWeather } from "./weather.mjs";
import { drawWeather, prepareWeatherBackground, weatherBackgroundVariant } from "./weather-renderer.mjs";
import { locationForDistance, regionBlend, NAMSAN_METRES, NAMSAN_TRAVEL, YEOMGANG_METRES, YEOMGANG_TRAVEL } from "./walk-route.mjs";
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("그림을 불러오지 못했어요. 새로고침해 주세요."));
    image.src = src;
  });
}
function surface(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  return canvas;
}
const point = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
export class HeronRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.stats = {};
    this.weather = seasonalWeather();
    this.seasonImages = new Map();
    this.weatherRequest = 0; this.climateClock = 0;
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
    this.rigCanvas = surface(1792, 1280);
    this.rigCtx = this.rigCanvas.getContext("2d");
  }
  async load() {
    const season = this.weather.season;
    const [background, body, head, leg, response, leaf] = await Promise.all([
      loadImage(assetUrl("season-" + season + ".png")).catch(() => loadImage(assetUrl("deoksugung-lane.png"))), loadImage(assetUrl("original-body.svg")),
      loadImage(assetUrl("original-head-crest.svg")),
      loadImage(assetUrl("original-leg.svg")), fetch(assetUrl("original-walk-rig.json")),
      loadImage(assetUrl("ginkgo-leaf.png")).catch(() => null),
    ]);
    if (!response.ok) throw new Error("걷기 동작을 불러오지 못했어요.");
    this.background = background; this.body = body; this.head = head; this.leg = leg; this.leaf = leaf;
    this.rig = await response.json();
    this.seasonImages.set(season, background);
    await this.setWeather(this.weather);
  }
  async setWeather(weather) {
    this.weather = weather;
    if (!this.rig) return;
    const request = ++this.weatherRequest;
    let variant = weatherBackgroundVariant(weather);
    let image = this.seasonImages.get(variant);
    if (!image) {
      try {
        image = await loadImage(assetUrl("season-" + variant + ".png"));
        this.seasonImages.set(variant, image);
      } catch {
        // Keep playing with the same season if a specialized weather image fails.
        variant = weather.season;
        image = this.seasonImages.get(variant);
        if (!image) {
          try {
            image = await loadImage(assetUrl("season-" + variant + ".png"));
            this.seasonImages.set(variant, image);
          } catch { return; }
        }
      }
    }
    if (request !== this.weatherRequest) return;
    this.background = variant === weather.season ? prepareWeatherBackground(image, weather) : image;
    this.backgroundSeason = weather.season;
    this.backgroundVariant = variant;
    // Prefetch the next region from the start, without delaying the first walk.
    void this.prepareNamsan(weather, request);
    void this.prepareYeomgang(weather, request);
  }
  prepareNamsan(weather, request) { return this.prepareRouteRegion("namsan", weather, request); }
  prepareYeomgang(weather, request) { return this.prepareRouteRegion("yeomgang", weather, request); }
  async prepareRouteRegion(region, weather, request) {
    const key = region + "-" + weather.season;
    let image = this.seasonImages.get(key);
    if (!image) {
      try {
        image = await loadImage(assetUrl(key + ".png"));
        this.seasonImages.set(key, image);
      } catch { return; } // Keep the current scene playable on an asset outage.
    }
    if (request !== this.weatherRequest) return;
    this[region + "Background"] = prepareWeatherBackground(image, weather);
    this[region + "Season"] = weather.season;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }
    this.width = rect.width; this.height = rect.height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  captureScene(snapshot) {
    // Reframe this round's last walking pose as a landscape postcard on phones too.
    // Reuse loaded artwork and weather; leave the live canvas/camera untouched.
    const canvas = surface(1200, 750);
    const postcard = Object.assign(Object.create(HeronRenderer.prototype), this, {
      canvas, ctx: canvas.getContext("2d", { alpha: false }), stats: {},
      resize() { this.width = 1200; this.height = 750; this.ctx.setTransform(1, 0, 0, 1, 0, 0); },
    });
    postcard.render({ ...snapshot, fallDirection: 1, shadowLookTime: snapshot.shadowLookingBack ? 0.75 : 0, snapshot: () => snapshot }, 0);
    return canvas;
  }
  drawEnvironment(travel, characterScale, bg = this.background) {
    const { ctx, width: w, height: h } = this;
    const scale = Math.max(w / bg.width, h / bg.height);
    const tileW = bg.width * scale, tileH = bg.height * scale;
    // Travel is the original rig's pixel displacement, not the metre score.
    // Match the ground to the character's scale so its steps move the scene.
    const scroll = travel * characterScale;
    const origin = -(tileW - w) * (w < h ? 0.42 : 0) - scroll;
    const first = Math.floor(-origin / tileW);
    for (let index = first - 1; index <= first + 2; index++) {
      ctx.save();
      ctx.translate(origin + index * tileW + (index % 2 !== 0 ? tileW : 0), 0);
      if (index % 2 !== 0) ctx.scale(-1, 1);
      ctx.drawImage(bg, 0, 0, tileW, tileH);
      ctx.restore();
    }
    return { scroll, origin };
  }
  drawFramedEnvironment(travel, characterScale, bg) {
    const { ctx, width: w, height: h } = this;
    const scale = Math.max(w / bg.width, h / bg.height);
    const tileW = bg.width * scale, tileH = bg.height * scale;
    const frameOrigin = -(tileW - w) * (w < h ? 0.42 : 0);
    // Keep the photographed portal readable; only the flat foreground moves.
    // Separate clips also keep the dissolve's opacity consistent on the ground.
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h * 0.77); ctx.clip();
    ctx.drawImage(bg, frameOrigin, 0, tileW, tileH); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, h * 0.77, w, h * 0.23); ctx.clip();
    const ground = this.drawEnvironment(travel, characterScale, bg); ctx.restore();
    return { ...ground, frameOrigin, framed: true,
      weatherWindow: { x: frameOrigin + tileW * 0.177, y: tileH * 0.116, width: tileW * 0.646, height: tileH * 0.53 } };
  }
  composeBird(frame, angle, shadow, lookingBack) {
    const paint = this.rigCtx;
    paint.setTransform(1, 0, 0, 1, 0, 0);
    paint.clearRect(0, 0, 1792, 1280);
    paint.setTransform(4, 0, 0, 4, 768, 1040);
    const pose = this.rig.frames[frame - 1];
    const radians = angle * Math.PI / 180;
    const contacts = [];
    const drawAsset = (image, asset) => {
      paint.drawImage(image, -asset.origin[0], -asset.origin[1], asset.width, asset.height);
    };
    // Restore the original complete character rig; no raster upperbody,
    // leg retargeting or reinterpretation of its proportions.
    for (const part of pose) {
      paint.save();
      paint.transform(...part.matrix);
      if (part.shape === 121) {
        paint.rotate(radians);
        drawAsset(this.body, this.rig.body);
        paint.translate(29.4, -87.75);
        paint.rotate(-radians);
        if (shadow && lookingBack) paint.scale(-1, 1);
        drawAsset(this.head, this.rig.head);
        if (shadow) {
          // Close the source eye cutout before tinting the faceless silhouette.
          paint.fillStyle = "#000000";
          paint.beginPath();
          paint.arc(0.7, -5.6, 2.5, 0, Math.PI * 2);
          paint.fill();
        }
      } else {
        drawAsset(this.leg, this.rig.leg);
        contacts.push({
          foot: point(part.matrix, -0.5, 29.75),
          hip: point(part.matrix, -1.3, -30.2),
        });
      }
      paint.restore();
    }
    if (shadow) {
      paint.setTransform(1, 0, 0, 1, 0, 0);
      paint.globalCompositeOperation = "source-in";
      paint.fillStyle = "#50535b";
      paint.fillRect(0, 0, 1792, 1280);
      paint.globalCompositeOperation = "source-over";
    }
    return contacts;
  }
  drawBird({ x, y, height, frame, angle = 0, rotation = 0, shadow = false, opacity = 1, lookingBack = false }) {
    const contacts = this.composeBird(frame, angle, shadow, lookingBack);
    const scale = height / 180;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.globalAlpha = opacity;
    ctx.drawImage(this.rigCanvas, -192 * scale, -260 * scale, 448 * scale, 320 * scale);
    ctx.restore();
    return { frame, x, y, height, angle, rotation, contacts, lookingBack };
  }
  render(game, seconds = 0) {
    if (!this.rig) return;
    this.resize();
    const { width: w, height: h } = this;
    const portrait = w / h < 0.85;
    const height = Math.min(h * 0.345, w * (portrait ? 0.49 : 0.48));
    const location = locationForDistance(game.distance);
    const scenes = [{ image: this.background, start: 0, travel: 0, variant: this.backgroundVariant }];
    if (this.namsanBackground && game.distance >= NAMSAN_METRES) scenes.push({
      image: this.namsanBackground, start: NAMSAN_METRES, travel: NAMSAN_TRAVEL, variant: "namsan-" + this.namsanSeason,
    });
    if (this.yeomgangBackground && game.distance >= YEOMGANG_METRES) scenes.push({
      image: this.yeomgangBackground, start: YEOMGANG_METRES, travel: YEOMGANG_TRAVEL, variant: "yeomgang-" + this.yeomgangSeason,
    });
    const current = scenes.at(-1), previous = scenes.at(-2);
    const blend = current.start ? regionBlend(game.distance, current.start, this.reducedMotion) : 0;
    const drawScene = (scene) => scene.start === YEOMGANG_METRES
      ? this.drawFramedEnvironment(Math.max(0, game.travel - scene.travel), height / 180, scene.image)
      : this.drawEnvironment(Math.max(0, game.travel - scene.travel), height / 180, scene.image);
    let environment;
    if (previous && blend < 1) environment = drawScene(previous);
    if (!previous || blend > 0) {
      this.ctx.save(); this.ctx.globalAlpha = previous ? blend : 1;
      environment = drawScene(current);
      this.ctx.restore();
    }
    const visibleVariant = previous && blend === 0 ? previous.variant : current.variant;
    if (!["paused", "result"].includes(game.mode)) this.climateClock = (this.climateClock || 0) + seconds;
    this.ctx.save();
    if (blend === 1 && environment.weatherWindow) {
      const opening = environment.weatherWindow;
      this.ctx.beginPath(); this.ctx.rect(opening.x, opening.y, opening.width, opening.height); this.ctx.clip();
    }
    drawWeather(this.ctx, this.weather, this.climateClock || 0, w, h, this.reducedMotion, this.leaf);
    this.ctx.restore();
    const ground = h * 0.833;
    const falling = ["falling", "result"].includes(game.mode);
    const fall = falling ? smooth(game.fallTime / 0.5) : 0;
    const main = this.drawBird({
      x: w * (portrait ? 0.29 : 0.35) + fall * game.fallDirection * height * 0.12,
      y: ground, height, frame: game.frame,
      angle: falling ? game.angle * (1 - fall) : game.angle,
      rotation: falling ? game.fallDirection * fall * 78 : game.rotation,
    });
    let shadow = null;
    if (game.mode !== "ready") {
      shadow = this.drawBird({
        x: w * (0.875 + Math.min((game.shadowGap - 8.5) * 0.003, 0.035))
          + (falling ? game.fallTime * w * 0.15 : 0),
        y: ground, height: height * (portrait ? 0.79 : 0.91),
        frame: Math.floor((game.shadowGait % 1) * 16) + 1,
        angle: 1.8, rotation: 0.5, shadow: true, opacity: 0.66,
        lookingBack: game.shadowLookTime > 0,
      });
    }
    this.stats = { main, shadow, environment, ground, width: w, height: h, loaded: true, character: "original-with-crest", backgroundSeason: this.backgroundSeason, backgroundVariant: visibleVariant, location: location.id, locationName: location.name, sceneBlend: blend, namsanReady: Boolean(this.namsanBackground), yeomgangReady: Boolean(this.yeomgangBackground) };
    this.canvas.dataset.game = JSON.stringify(game.snapshot());
    this.canvas.dataset.render = JSON.stringify(this.stats);
    if (this.weather) this.canvas.dataset.weather = JSON.stringify(this.weather);
  }
}
