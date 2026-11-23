/// <reference types="node" />
// The pure snapshot helpers and config sanitizing, with fake images.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overrides, presets, resolveConfig } from '../lib/config';
import { barStyleFor, brightness, compare, resolveOrigin, type PixelSource } from '../lib/snapshot';

/** A w×h fake image whose pixel color comes from `color(x, y)` (RGB, or RGBA). */
const fake = (w: number, h: number, color: (x: number, y: number) => number[]): PixelSource => ({
  width: () => w,
  height: () => h,
  readPixels: (x = 0, y = 0) => Uint8Array.from([...color(x, y), 255].slice(0, 4)),
});
const white = fake(100, 200, () => [255, 255, 255]);
const black = fake(100, 200, () => [0, 0, 0]);

test('compare: identical images do not differ, opposite ones do', () => {
  assert.deepEqual(compare(white, white), { mean: 0, max: 0 });
  assert.equal(compare(white, black).max, 765);
});

test('compare: an ignored region (live control) does not count', () => {
  const dot = fake(100, 200, (x, y) => (x >= 40 && x < 60 && y >= 80 && y < 120 ? [0, 0, 0] : [255, 255, 255]));
  assert.ok(compare(white, dot).max > 0);
  assert.equal(compare(white, dot, { ignore: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 } }).max, 0);
});

test('compare: a single list row (5% of the height) lands on the default grid', () => {
  const row = fake(100, 200, (_, y) => (y >= 130 && y < 140 ? [0, 0, 0] : [255, 255, 255]));
  assert.equal(compare(white, row).max, 765);
});

test('brightness and status bar style', () => {
  assert.equal(brightness(white), 255);
  assert.equal(brightness(black), 0);
  assert.equal(barStyleFor(white, 0.02), 'dark-content');
  assert.equal(barStyleFor(black, 0.02), 'light-content');
  // Sampled at 15% from the left, not under the (black) Dynamic Island in the middle.
  const island = fake(100, 200, (x) => (x > 30 && x < 70 ? [0, 0, 0] : [255, 255, 255]));
  assert.equal(barStyleFor(island, 0.02), 'dark-content');
});

test('status bar style: a see-through pixel is unknown, not black', () => {
  assert.equal(
    barStyleFor(
      fake(100, 200, () => [0, 0, 0, 0]),
      0.02,
    ),
    null,
  );
});

test('resolveOrigin: window coordinates map into root space', () => {
  const size = { width: 400, height: 800 };
  const offset = { x: 10, y: 100 };
  assert.deepEqual(resolveOrigin({ x: 110, y: 300 }, size, { offset }), { x: 100, y: 200 });
  assert.deepEqual(resolveOrigin('touch', size, { offset, touch: { x: 10, y: 100 } }), { x: 0, y: 0 });
  assert.deepEqual(resolveOrigin('touch', size, {}), { x: 200, y: 400 });
  assert.deepEqual(resolveOrigin('source', size, { hole: { x: 0, y: 0, width: 50, height: 30 } }), { x: 25, y: 15 });
  assert.deepEqual(resolveOrigin('auto', size, { dir: 1 }), { x: 200, y: 0 });
  assert.deepEqual(resolveOrigin('auto', size, { dir: -1 }), { x: 200, y: 800 });
  assert.deepEqual(resolveOrigin('bottom', size, {}), { x: 200, y: 800 });
  assert.deepEqual(resolveOrigin({ x: NaN, y: 3 }, size, {}), { x: 200, y: 400 });
});

test('resolveConfig: drops undefined, later layers win, clamps', () => {
  const c = resolveConfig(presets.subtle, { band: undefined, blur: 5 }, { band: -3, duration: -1, spec: NaN });
  assert.equal(c.blur, 5);
  assert.equal(c.band, 1);
  assert.equal(c.duration, 0);
  assert.equal(c.spec, presets.subtle.spec);
  assert.equal(resolveConfig(presets.glass, { band: 1e6 }).band, 300);
});

test('presets are frozen; an empty config is no override', () => {
  assert.ok(Object.isFrozen(presets) && Object.isFrozen(presets.glass));
  assert.equal(overrides({}), false);
  assert.equal(overrides({ band: undefined }), false);
  assert.equal(overrides({ band: 3 }), true);
});
