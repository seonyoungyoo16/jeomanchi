const fraction = (value) => value - Math.floor(value);
const scatter = (seed) => fraction(Math.sin(seed * 12.9898) * 43758.5453);

export function weatherBackgroundVariant(weather) {
  if (weather.season === "spring" && weather.condition === "cloudy" && weather.cloudCover >= 75) return "spring-cloudy";
  if (weather.season === "summer" && ["rain", "storm"].includes(weather.condition)) return "summer-rain";
  if (weather.season === "winter" && weather.condition === "snow") return "winter-snow";
  return weather.season;
}

export function prepareWeatherBackground(image, weather) {
  if (["clear", "unknown"].includes(weather.condition)) return image;
  const canvas = document.createElement("canvas");
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const rain = ["rain", "storm"].includes(weather.condition);
  const fog = weather.condition === "fog";
  // Regions without a dedicated overcast raster still lose the clear blue sky.
  // Recolor only blue sky pixels once per weather update, retaining the real art.
  if (rain || weather.condition === "snow" || (weather.condition === "cloudy" && weather.cloudCover >= 75)) {
    const sky = ctx.getImageData(0, 0, canvas.width, Math.ceil(canvas.height * 0.415));
    const target = rain ? [133, 151, 165] : [197, 207, 214];
    for (let pixel = 0; pixel < sky.data.length; pixel += 4) {
      const red = sky.data[pixel], green = sky.data[pixel + 1], blue = sky.data[pixel + 2];
      if (green - red < 12) continue;
      const amount = Math.min(1, Math.max(0, (blue - red - 20) / 40)) * 0.85;
      for (let channel = 0; channel < 3; channel++) sky.data[pixel + channel] += (target[channel] - sky.data[pixel + channel]) * amount;
    }
    ctx.putImageData(sky, 0, 0);
  }
  // Baked only when weather changes, never a per-frame image filter.
  ctx.globalCompositeOperation = "saturation";
  ctx.globalAlpha = fog ? 0.5 : rain ? 0.48 : 0.3;
  ctx.fillStyle = "#91999e"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = fog ? 0.42 : rain ? 0.24 : weather.condition === "snow" ? 0.2 : weather.cloudCover / 100 * 0.22;
  ctx.fillStyle = fog ? "#eef0eb" : rain ? "#9faeba" : "#d6e1e7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (rain) {
    ctx.globalAlpha = 0.16; ctx.fillStyle = "#617b8c";
    ctx.fillRect(0, canvas.height * 0.773, canvas.width, canvas.height * 0.12);
  }
  return canvas;
}

export function drawWeather(ctx, weather, time, width, height, reducedMotion = false, leafImage = null) {
  if (!weather || weather.condition === "unknown") return;
  const t = reducedMotion ? 0 : time;
  const rain = ["rain", "storm"].includes(weather.condition);
  const snow = weather.condition === "snow";
  ctx.save();
  if (rain) {
    const count = Math.min(110, 50 + Math.round(weather.precipitation * 12));
    ctx.strokeStyle = "#8ca8bd"; ctx.lineWidth = Math.max(1.2, height / 700); ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = fraction(scatter(i + 1) - t * (0.04 + weather.windSpeed * 0.004)) * width;
      const y = fraction(scatter(i + 101) + t * 0.72) * height;
      ctx.moveTo(x, y); ctx.lineTo(x - height * 0.008, y + height * 0.03);
    }
    ctx.stroke();
    // Sparse ripples provide a wet-surface cue without hiding the feet.
    ctx.globalAlpha = 0.22; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const phase = fraction(t * 1.1 + i * 0.37);
      ctx.beginPath();
      ctx.ellipse(scatter(i + 301) * width, height * (0.8 + scatter(i + 401) * 0.08), 3 + phase * 9, 1 + phase * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (snow) {
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#acbbc6"; ctx.lineWidth = 0.4; ctx.globalAlpha = 0.88;
    for (let i = 0; i < 75; i++) {
      const x = fraction(scatter(i + 1) + t * 0.012 + Math.sin(t + i) * 0.012) * width;
      const y = fraction(scatter(i + 101) + t * (0.06 + (i % 3) * 0.015)) * height;
      ctx.beginPath(); ctx.arc(x, y, Math.max(1.6, height / 300) + i % 3 * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  if (leafImage && weather.season === "autumn" && weather.windSpeed >= 1.5 && !snow) {
    // A few real ginkgo sprites drift with the wind, behind both birds.
    const count = Math.min(8, 3 + Math.floor(weather.windSpeed));
    ctx.globalAlpha = 0.88;
    for (let i = 0; i < count; i++) {
      const x = fraction(scatter(i + 1) + t * (0.012 + Math.min(weather.windSpeed, 12) * 0.004)) * width;
      const y = height * (0.18 + fraction(scatter(i + 101) + t * 0.035) * 0.65);
      const size = Math.max(14, height * 0.026) * (0.8 + i % 3 * 0.15);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.7 + i) * 0.9 + i);
      ctx.drawImage(leafImage, -size / 2, -size / 2, size, size); ctx.restore();
    }
  }
  ctx.restore();
}
