// Pure helpers on snapshots. They only need width/height/readPixels, so tests can pass fake images.
import type { SkImage } from '@shopify/react-native-skia';
import type { GlassOrigin } from './config';
import type { GlassRect } from './types';

export type PixelSource = Pick<SkImage, 'width' | 'height' | 'readPixels'>;
export type BarStyle = 'dark-content' | 'light-content';
type Point = { x: number; y: number };

const RGBA_1PX = { width: 1, height: 1, colorType: 4, alphaType: 2 }; // RGBA_8888, premultiplied

/** RGBA at (fx, fy), given as fractions of the image size. */
function rgb(image: PixelSource, fx: number, fy: number) {
  const x = Math.min(image.width() - 1, Math.max(0, Math.floor(image.width() * fx)));
  const y = Math.min(image.height() - 1, Math.max(0, Math.floor(image.height() * fy)));
  return image.readPixels(x, y, RGBA_1PX);
}

/** A pixel's channels; missing ones read as 0. */
const px = (p: ArrayLike<number>) => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 255] as const;
const luma = (p: ArrayLike<number> | null) => {
  if (!p) return 255;
  const [r, g, b] = px(p);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};
/** A see-through pixel: what's behind the root (not in the snapshot) decides how it looks. */
const clear = (p: ArrayLike<number> | null) => !!p && p.length > 3 && px(p)[3] < 128;

/**
 * Per-pixel RGB difference (0-765) between two snapshots over a grid (12x24 by default, ~30 pt apart
 * on a phone, so a list row or a toggle always lands on a sample): its mean and max.
 * `ignore` (fractions of the image) is skipped, e.g. a live control that animates by itself.
 */
export function compare(a: PixelSource, b: PixelSource, { cols = 12, rows = 24, ignore }: { cols?: number; rows?: number; ignore?: GlassRect } = {}) {
  let sum = 0;
  let max = 0;
  let n = 0;
  for (let i = 1; i <= cols; i++)
    for (let j = 1; j <= rows; j++) {
      const fx = i / (cols + 1);
      const fy = j / (rows + 1);
      if (ignore && fx >= ignore.x && fy >= ignore.y && fx <= ignore.x + ignore.width && fy <= ignore.y + ignore.height) continue;
      const p = rgb(a, fx, fy);
      const q = rgb(b, fx, fy);
      if (!p || !q) continue;
      const [pr, pg, pb] = px(p);
      const [qr, qg, qb] = px(q);
      const d = Math.abs(pr - qr) + Math.abs(pg - qg) + Math.abs(pb - qb);
      sum += d;
      max = Math.max(max, d);
      n++;
    }
  return { mean: n ? sum / n : 0, max };
}

/** Average brightness (0-255) of an image, from a sparse grid of pixels. */
export function brightness(image: PixelSource) {
  let sum = 0;
  for (let i = 1; i <= 4; i++) for (let j = 1; j <= 6; j++) sum += luma(rgb(image, i / 5, j / 7));
  return sum / 24;
}

/**
 * Status bar style that reads on top of an image, sampled at height `fy` (fraction of the image).
 * Samples at 15% from the left, under the clock: the middle is under the Dynamic Island.
 * Null when that pixel is see-through: we can't tell, so the app's own style should stay.
 */
export function barStyleFor(image: PixelSource, fy: number): BarStyle | null {
  const p = rgb(image, 0.15, fy);
  if (clear(p)) return null;
  return luma(p) > 140 ? 'dark-content' : 'light-content';
}

/**
 * Where the glass starts, in root space. `touch` and point origins come in window space and are
 * shifted by `offset` (the root's position in the window); `hole` is already in root space.
 * `dir`: +1 the screen gets darker, -1 lighter, 0 about the same.
 */
export function resolveOrigin(
  origin: GlassOrigin,
  { width, height }: { width: number; height: number },
  { hole, touch, offset = { x: 0, y: 0 }, dir = 0 }: { hole?: GlassRect; touch?: Point; offset?: Point; dir?: number },
): Point {
  const mid = { x: width / 2, y: height / 2 };
  const toRoot = (p: Point) => ({ x: p.x - offset.x, y: p.y - offset.y });
  const holeCenter = hole && { x: hole.x + hole.width / 2, y: hole.y + hole.height / 2 };
  if (typeof origin === 'object') return Number.isFinite(origin.x) && Number.isFinite(origin.y) ? toRoot(origin) : mid;
  switch (origin) {
    case 'touch':
      return touch ? toRoot(touch) : (holeCenter ?? mid);
    case 'source':
      return holeCenter ?? mid;
    case 'auto': // night falls from the top, day rises from the bottom
      return { x: mid.x, y: dir > 0 ? 0 : dir < 0 ? height : mid.y };
    case 'top':
      return { x: mid.x, y: 0 };
    case 'bottom':
      return { x: mid.x, y: height };
    default:
      return mid;
  }
}
