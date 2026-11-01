import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../src/original-game-audio.mjs';

function player(play = () => Promise.resolve()) {
  const elements = Array.from({ length: 3 }, (_, index) => ({ src: '', currentTime: 0, calls: [], load() { this.calls.push('load'); }, pause() { this.calls.push('pause'); }, play() { this.calls.push({ src: this.src, muted: this.muted }); return play(index); } }));
  const failures = [];
  return { elements, element: elements[0], failures, sound: new GameAudio(elements, error => failures.push(error)) };
}

test('enabling sound calls media playback synchronously in the user gesture and previews a footstep', async () => {
  const { sound, element, elements } = player();
  const playing = sound.enable();
  assert.ok(elements.every(element => element.calls.at(-1).src));
  assert.deepEqual(elements.map(element => element.muted), [false, true, true]);
  assert.ok(element.src.endsWith('/assets/right.wav'));
  assert.equal(await playing, true);
});

test('landing sounds reuse preloaded sources without source changes or reloads', async () => {
  const { sound, elements } = player();
  await sound.enable();
  const sources = elements.map(element => element.src);
  elements.forEach(element => {
    Object.defineProperty(element, 'src', { get: () => sources[elements.indexOf(element)], set() { assert.fail('Landing must not reload a source'); } });
    element.load = () => assert.fail('Landing must not reload media');
  });
  await sound.play(1);
  assert.ok(elements[1].src.endsWith('/assets/left.wav'));
  await sound.play(2);
  assert.ok(elements[2].src.endsWith('/assets/fall.wav'));
  elements[2].currentTime = .5;
  await sound.play(2);
  assert.equal(elements[2].currentTime, 0);
  assert.equal(elements[0].calls.at(-1), 'pause');
  assert.equal(elements[1].calls.at(-1), 'pause');
});

test('muting stops a current effect and prevents further footsteps', async () => {
  const { sound, element } = player();
  await sound.enable();
  sound.disable();
  const calls = element.calls.length;
  assert.equal(await sound.play(1), false);
  assert.equal(element.calls.length, calls);
  assert.equal(element.calls.at(-1), 'pause');
  assert.equal(sound.enabled, false);
});

test('rejected playback clears enabled state and allows an explicit retry', async () => {
  let blocked = true;
  const error = Object.assign(new Error('Playback blocked'), { name: 'NotAllowedError' });
  const { sound, failures } = player(() => blocked ? Promise.reject(error) : Promise.resolve());
  assert.equal(await sound.enable(), false);
  assert.equal(sound.enabled, false);
  assert.equal(sound.failed, true);
  assert.deepEqual(failures, [error]);
  blocked = false;
  assert.equal(await sound.enable(), true);
  assert.equal(sound.failed, false);
});

test('an interrupted preview cannot turn off newer playback or a later enable', async () => {
  let rejectPreview;
  const { sound, elements, failures } = player(index => index === 0 ? new Promise((_, reject) => { rejectPreview = reject; }) : Promise.resolve());
  const preview = sound.enable();
  sound.disable();
  elements.forEach(element => { element.play = () => Promise.resolve(); });
  await sound.enable();
  rejectPreview(Object.assign(new Error('Previous request cancelled'), { name: 'NotAllowedError' }));
  await preview;
  assert.equal(sound.enabled, true);
  assert.equal(sound.failed, false);
  assert.deepEqual(failures, []);
});

test('enabling during walking unlocks silently so the next landing owns the next audible step', async () => {
  const { sound, elements } = player();
  const enabling = sound.enable({ preview: false });
  assert.ok(elements.every(element => element.muted));
  await enabling;
  assert.ok(elements.every(element => !element.muted && element.currentTime === 0));
  await sound.play(1);
  assert.equal(elements[1].calls.at(-1).muted, false);
});
