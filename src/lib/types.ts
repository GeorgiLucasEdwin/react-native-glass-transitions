import type { GlassConfig, GlassOrigin, GlassPreset } from './config';

/** A rectangle in points. */
export type GlassRect = { x: number; y: number; width: number; height: number };

/** A control registered with `useGlassSource`; pass it as `live` to keep it animating through a sweep. */
export type GlassSourceHandle = { measure(): Promise<GlassRect | undefined> };

/** Per-call overrides. They win over the tuner, which wins over the provider's props. */
export type GlassTransitionOptions = {
  /** Where the glass starts. Point origins (`{ x, y }`) are in window coordinates, like a touch's pageX/pageY. */
  origin?: GlassOrigin;
  /** A control that stays live (not frozen in the snapshots) during the sweep. */
  live?: GlassSourceHandle;
  /** Look for this call only: replaces the provider's (and the tuner's) look, it doesn't layer on it. */
  preset?: GlassPreset;
  /** Overrides for this call only, on top of `preset` (or of the current look when there's no `preset`). */
  config?: Partial<GlassConfig>;
};

/**
 * How a transition ended, once the overlay is gone:
 * - `animated`: the glass swept and the change is in.
 * - `instant`: the change is in, without a sweep (Reduce Motion, not iOS, nothing visibly changed,
 *   snapshot failed, or a newer transition cut this one short before it started sweeping).
 * - `skipped`: no change: a scrub was cancelled (and reverted), or `end` came without `begin`.
 */
export type GlassResult = 'animated' | 'instant' | 'skipped';
