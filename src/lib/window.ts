// Window-level glass: snapshots of the whole window (native sheets and modals included) and an
// overlay above them. Needs this library's Expo module (ios/) and react-native-screens'
// FullWindowOverlay; without either, the glass covers the provider's root view only.
import type { ComponentType, ReactNode } from 'react';
import { findNodeHandle, type HostInstance } from 'react-native';
import { Skia } from '@shopify/react-native-skia';
import { runOnUIAsync } from 'react-native-worklets';
import type { PixelSource, Shot } from './snapshot';

type GlassWindow = {
  frame(tag: number): Promise<number[] | null>;
  snapshot(skip: number | null, touched: number | null): Promise<{ id: number; address: number; width: number; height: number; pixels: Uint8Array } | null>;
  release(id: number): Promise<void>;
};
const native = (globalThis as { expo?: { modules?: { GlassWindow?: GlassWindow } } }).expo?.modules?.GlassWindow;

/** react-native-screens' overlay above native sheets, when the app has it. */
export const FullWindowOverlay: ComponentType<{ children: ReactNode }> | null = (() => {
  if (!native) return null;
  try {
    return (require('react-native-screens') as { FullWindowOverlay?: ComponentType<{ children: ReactNode }> }).FullWindowOverlay ?? null;
  } catch {
    return null;
  }
})();

/** A view's rect in the window, from UIKit; null when unknown (no native module, not mounted). */
export async function frameOf(view: HostInstance | number | null | undefined) {
  const tag = typeof view === 'number' ? view : view && findNodeHandle(view);
  const r = native && tag != null ? await native.frame(tag).catch(() => null) : null;
  return r ? { x: r[0]!, y: r[1]!, width: r[2]!, height: r[3]! } : null;
}

/**
 * The window as the user sees it, minus the window-level view holding `skip` (our overlay). The image
 * is a texture over the native pixel buffer, made on the UI thread (where the overlay draws): no copy,
 * no upload. Comparisons and colors read a small sample of it instead.
 */
export async function snapshotWindow(skip: HostInstance | null, touched?: number): Promise<Shot | null> {
  const shot = await native?.snapshot((skip && findNodeHandle(skip)) ?? null, touched ?? null).catch(() => null);
  if (!shot) return null;
  const release = () => void native?.release(shot.id).catch(() => {});
  const image = await runOnUIAsync((address: number) => {
    'worklet';
    return Skia.Image.MakeImageFromNativeBuffer(BigInt(address));
  }, shot.address).catch(() => null);
  if (!image) {
    release();
    return null;
  }
  const { width, height, pixels } = shot;
  return {
    image,
    width: () => width,
    height: () => height,
    readPixels: ((x = 0, y = 0) => {
      const i = (y * width + x) * 4;
      return pixels.subarray(i, i + 4);
    }) as PixelSource['readPixels'],
    dispose() {
      // Freed on the UI thread, where it was made; the buffer only after.
      runOnUIAsync(() => {
        'worklet';
        image.dispose();
      }).then(release, release);
    },
  };
}
