import type { HostInstance } from 'react-native';
import type { GlassRect } from './types';

/** A view's rect in window points; undefined when it isn't mounted. */
export const measureInWindow = (view: HostInstance | null | undefined) =>
  new Promise<GlassRect | undefined>((done) => {
    if (!view) return done(undefined);
    view.measureInWindow((x, y, width, height) => done({ x, y, width, height }));
  });
