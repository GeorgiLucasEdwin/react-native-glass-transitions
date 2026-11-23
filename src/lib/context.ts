import { createContext, useContext, type Context } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { GlassConfig, GlassOrigin, GlassPreset } from './config';
import type { GlassEngine } from './engine/engine';

/** What the hooks get from the provider: stable for its lifetime, so their consumers never re-render. */
export type GlassApi = Pick<GlassEngine, 'transition' | 'scrub' | 'prepare'> & {
  /** Where the finger wants the glass during a scrub, 0..1. */
  target: SharedValue<number>;
};
export const GlassContext = createContext<GlassApi | null>(null);

// A second context, so only the tuner re-renders when its values change.
export type GlassTunerValue = {
  /** The look new transitions use (tuner overrides, else the provider's props). */
  config: GlassConfig;
  setConfig(config: GlassConfig): void;
  preset: GlassPreset | 'custom';
  setPreset(preset: GlassPreset): void;
  origin: GlassOrigin;
  setOrigin(origin: GlassOrigin): void;
  /** Drop the tuner's overrides: back to the provider's props. */
  reset(): void;
};
export const TunerContext = createContext<GlassTunerValue | null>(null);

export function useRequired<T>(context: Context<T | null>): T {
  const value = useContext(context);
  if (!value) throw new Error('[glass-transitions] Wrap your app in <GlassTransitionProvider>.');
  return value;
}
