import type { HostInstance } from 'react-native';
import type { GlassRect } from './types';
import { frameOf } from './window';

/**
 * A view's rect in window points; undefined when it isn't mounted. React Native's own measurement
 * places a natively presented screen (a sheet, a modal) at the window's origin, so UIKit's comes first.
 */
export const measureInWindow = async (view: HostInstance | null | undefined): Promise<GlassRect | undefined> => {
  if (!view) return undefined;
  return (await frameOf(view)) ?? new Promise((done) => view.measureInWindow((x, y, width, height) => done({ x, y, width, height })));
};
