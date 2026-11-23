import type { GlassConfig } from '../config';

type Control = { label: string; min: number; max: number; step: number };

/** The tuner's slider for each glass setting. */
export const controls = {
  band: { label: 'Thickness', min: 16, max: 160, step: 1 },
  refraction: { label: 'Refraction', min: 0, max: 60, step: 1 },
  blur: { label: 'Defocus', min: 0, max: 28, step: 0.5 },
  disperse: { label: 'Color Warp', min: 0, max: 2, step: 0.01 },
  fringe: { label: 'Fringe', min: 0, max: 20, step: 0.5 },
  mood: { label: 'Mood', min: 0, max: 1, step: 0.05 },
  spec: { label: 'Highlight', min: 0, max: 1.5, step: 0.05 },
  fresnel: { label: 'Edge Glow', min: 0, max: 0.5, step: 0.01 },
  shadow: { label: 'Shadow', min: 0, max: 0.2, step: 0.005 },
  settle: { label: 'Settle', min: 0, max: 0.4, step: 0.005 },
  duration: { label: 'Duration', min: 300, max: 3500, step: 50 },
} as const satisfies Record<keyof GlassConfig, Control>;
