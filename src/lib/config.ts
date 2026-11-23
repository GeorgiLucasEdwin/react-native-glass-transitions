/**
 * How the glass looks and moves. `duration` drives the animation; everything else feeds the shader.
 * Lengths are in points (pt).
 */
export type GlassConfig = {
  /** Thickness of the glass ring, pt. Clamped to 1..300. */
  band: number;
  /** How far the glass bends what's behind it, pt at the ring's steepest point. */
  refraction: number;
  /** Defocus radius under the glass, pt. Below 4 the shader takes 4 samples per pixel, else 8. */
  blur: number;
  /** Color warp: red and blue bend this much more/less than green (multiplier of `refraction`). */
  disperse: number;
  /** Extra red/blue split across the whole glass, pt. */
  fringe: number;
  /** 0..1. Toward a darker screen the glass turns smoky and cool, toward a lighter one bright and warm. */
  mood: number;
  /** Specular highlight strength (light from the top-left). */
  spec: number;
  /** Soft bright rim on the glass's slopes. */
  fresnel: number;
  /** Darkening of a soft band just ahead of the glass, 0..1. */
  shadow: number;
  /** The new screen starts this much magnified (fraction) behind the glass, then settles. */
  settle: number;
  /** Length of a full sweep, ms. Scrubs follow the finger instead and finish in 150-600 ms. */
  duration: number;
};

const KEYS = ['band', 'refraction', 'blur', 'disperse', 'fringe', 'mood', 'spec', 'fresnel', 'shadow', 'settle', 'duration'] as const satisfies readonly (keyof GlassConfig)[];
const MAX_BAND = 300;

export const presets = Object.freeze({
  /** Barely there: a thin lens, ready for production UI. */
  subtle: Object.freeze({ band: 40, refraction: 12, blur: 2, disperse: 0.1, fringe: 1, spec: 0.3, fresnel: 0.06, shadow: 0.03, settle: 0.015, mood: 0.4, duration: 700 }),
  /** Frosted, color-warped glass with a slow, settling reveal. */
  glass: Object.freeze({ band: 100, refraction: 20, blur: 16, disperse: 1, fringe: 9, spec: 0.5, fresnel: 0.15, shadow: 0, settle: 0.2, mood: 1, duration: 2500 }),
  /** Thick, clear lens with a bright rim, in the spirit of iOS Liquid Glass. */
  liquid: Object.freeze({ band: 70, refraction: 45, blur: 3, disperse: 0.25, fringe: 1.5, spec: 1.1, fresnel: 0.3, shadow: 0.05, settle: 0.05, mood: 0.8, duration: 1200 }),
  /** Heavy prism: rainbow edges and soft focus. */
  prism: Object.freeze({ band: 80, refraction: 30, blur: 8, disperse: 1.6, fringe: 16, spec: 0.6, fresnel: 0.12, shadow: 0, settle: 0.08, mood: 0.6, duration: 1600 }),
}) satisfies Readonly<Record<string, Readonly<GlassConfig>>>;

export type GlassPreset = keyof typeof presets;

/**
 * Where the glass starts. `auto` = night falls from the top, day rises from the bottom (by how the
 * screen's brightness changes); `touch` = where the finger last touched; `source` = the control's center.
 * A point is in window coordinates.
 */
export type GlassOrigin = 'auto' | 'touch' | 'source' | 'top' | 'center' | 'bottom' | { x: number; y: number };

/**
 * Layers configs left to right (later wins), ignoring missing, `undefined` and non-finite values,
 * then clamps: every value >= 0, `band` 1..300.
 */
export function resolveConfig(base: Readonly<GlassConfig>, ...overrides: (Partial<GlassConfig> | undefined)[]): GlassConfig {
  const out: GlassConfig = { ...presets.glass };
  for (const layer of [base, ...overrides])
    for (const k of KEYS) {
      const v = layer?.[k];
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
  for (const k of KEYS) out[k] = Math.max(0, out[k]);
  out.band = Math.min(MAX_BAND, Math.max(1, out.band));
  return out;
}

/** True when `config` overrides anything (so `config={{}}` is no override). */
export const overrides = (config: Partial<GlassConfig> | undefined) => !!config && KEYS.some((k) => typeof config[k] === 'number');
