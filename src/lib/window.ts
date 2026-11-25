// Window-level glass: snapshots of the whole window (native sheets and modals included) and an
// overlay above them. Needs this library's Expo module (ios/) and react-native-screens'
// FullWindowOverlay; without either, the glass covers the provider's root view only.
import type { ComponentType, ReactNode } from 'react';
import { findNodeHandle, type HostInstance } from 'react-native';
import { Skia, type SkImage } from '@shopify/react-native-skia';

type GlassWindow = {
  frame(tag: number): Promise<number[] | null>;
  snapshot(skip: number | null): Promise<{ width: number; height: number; pixels: Uint8Array } | null>;
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

const RGBA = { width: 0, height: 0, colorType: 4, alphaType: 2 }; // RGBA_8888, premultiplied

/** The window as the user sees it, minus the window-level view holding `skip` (our overlay). */
export async function snapshotWindow(skip: HostInstance | null): Promise<SkImage | null> {
  const tag = skip && findNodeHandle(skip);
  const shot = await native?.snapshot(tag ?? null).catch(() => null);
  if (!shot) return null;
  const { width, height, pixels } = shot;
  return Skia.Image.MakeImage({ ...RGBA, width, height }, Skia.Data.fromBytes(pixels), width * 4);
}
