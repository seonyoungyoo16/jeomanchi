// The original 16-pose walk lands leg 0 at pose 1 and leg 1 at pose 9.
// Compare rendered main-character poses, never the shadow or a wall-clock timer.
export function soundForPose(previous, current) {
  if (current.state === 'falling') return previous.state === 'walking' ? 2 : null;
  if (current.state !== 'walking') return null;
  if (previous.state !== 'walking') return 0;
  const distance = (current.frame - previous.frame + 16) % 16;
  let sound = null;
  // If a slow display skips poses, play only the latest landing seen in this draw.
  for (let step = 1; step <= distance; step++) {
    const frame = (previous.frame - 1 + step) % 16 + 1;
    if (frame === 1) sound = 0;
    if (frame === 9) sound = 1;
  }
  return sound;
}
