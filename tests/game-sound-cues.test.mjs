import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { StorkGame } from '../src/original-walk-core.mjs';
import { soundForPose } from '../src/game-sound-cues.mjs';

const pose = (state, frame = 1) => ({ state, frame });

test('footstep cues coincide with the leg descending into ground contact in the original artwork', async () => {
  const scene = JSON.parse(await readFile(new URL('../public/assets/original-walk-rig.json', import.meta.url), 'utf8'));
  let contacts = 0;
  for (let frame = 1; frame <= 16; frame++) {
    const before = frame === 1 ? 16 : frame - 1;
    const cue = soundForPose(pose('walking', before), pose('walking', frame));
    if (cue === null) continue;
    const footY = number => {
      const [, b, , d, , y] = scene.frames[number - 1].filter(part => part.shape === 117)[cue].matrix;
      return y + 1.3 * b + 30.2 * d;
    };
    assert.ok(footY(before) < -2, 'foot must be airborne before the sound');
    assert.ok(footY(frame) > -1, 'sound must coincide with ground contact');
    contacts++;
  }
  assert.equal(contacts, 2);
});

test('the first displayed walking pose sounds immediately; unchanged poses and the shadow add no sounds', () => {
  assert.equal(soundForPose(pose('ready'), pose('walking')), 0);
  assert.equal(soundForPose(pose('result'), pose('walking')), 0);
  assert.equal(soundForPose(pose('walking', 9), pose('walking', 9)), null);
  for (const state of ['intro', 'title', 'ready', 'result']) {
    assert.equal(soundForPose(pose(state), pose(state)), null);
  }
});

test('slow-display catch-up coalesces landing cues and falling sounds once', () => {
  assert.equal(soundForPose(pose('walking', 7), pose('walking', 10)), 1);
  assert.equal(soundForPose(pose('walking', 15), pose('walking', 2)), 0);
  assert.equal(soundForPose(pose('walking', 12), pose('falling', 12)), 2);
  assert.equal(soundForPose(pose('falling', 12), pose('falling', 12)), null);
});

test('footsteps follow the accelerating main character across original skipped animation poses', () => {
  for (const batch of [1, 3]) {
    const game = new StorkGame();
    game.space();
    for (let frame = 0; frame < 18; frame++) game.step();
    let previous = pose('ready');
    game.space();
    const sounds = [soundForPose(previous, game)];
    previous = pose(game.state, game.frame);
    let lastTick = 0;
    const intervals = [];
    for (let tick = 0; tick < 1800; tick += batch) {
      for (let step = 0; step < batch; step++) {
        const impulse = game.bs + game.angle * .1;
        game.step({ left: impulse > .55 * game.bi, right: impulse < -.55 * game.bi });
      }
      const cue = soundForPose(previous, game);
      if (cue !== null) {
        assert.ok(cue === 0 || cue === 1);
        sounds.push(cue);
        intervals.push(tick + batch - lastTick);
        lastTick = tick + batch;
      }
      previous = pose(game.state, game.frame);
    }
    assert.equal(game.state, 'walking');
    sounds.forEach((sound, index) => assert.equal(sound, index % 2));
    assert.ok(intervals.at(-1) < intervals[0], 'footstep cadence must accelerate with the walk');
  }
});
