import { TunerContext, useRequired, type GlassTunerValue } from '../context';

/** Live overrides of the provider's look and origin (what the tuner edits). */
export const useGlassTuner = (): GlassTunerValue => useRequired(TunerContext);
