import { useEffect, useRef, useState, type RefObject } from 'react';
import { AppState, type GestureResponderEvent, type HostInstance } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { GlassContext, useRequired } from './context';
import type { ScrubRun } from './engine/engine';
import { measureInWindow } from './measure';
import type { GlassResult, GlassSourceHandle, GlassTransitionOptions } from './types';

export type GlassTransition = {
  /**
   * Run any state change behind a glass sweep: `await transition(() => setTheme('dark'))`.
   * `apply` runs once, a couple of frames later (after the old screen is frozen), not synchronously.
   * Resolves once the sweep has finished and the overlay is gone. A call while another sweep runs
   * makes that one jump to its end first. Rejects (after cleanup) if `apply` throws.
   */
  transition(apply: () => void, options?: GlassTransitionOptions): Promise<GlassResult>;
};

export function useGlassTransition(): GlassTransition {
  const glass = useRequired(GlassContext);
  const [api] = useState<GlassTransition>(() => ({ transition: glass.transition }));
  return api;
}

export type GlassSource = {
  /**
   * Spread on a dedicated View wrapping the control (it sets that View's `ref`, `collapsable` and
   * `onTouchStart`): keeps the control live through the sweep, and snapshots on touch-down.
   */
  props: { ref: RefObject<HostInstance | null>; collapsable: false; onTouchStart: (e: GestureResponderEvent) => void };
  handle: GlassSourceHandle;
  /** Like `useGlassTransition().transition`, with `live` defaulting to this source. */
  transition(apply: () => void, options?: GlassTransitionOptions): Promise<GlassResult>;
};

/**
 * For the control that triggers the change (a Switch, a button). Spread `props` on a View
 * wrapping it: the control stays live through the sweep, and the snapshot starts on touch-down.
 *
 * Controlled controls (RN's `Switch`): `apply` runs a couple of frames late, so keep the control's
 * value in local state and flip it at once: `setOn(v); source.transition(() => setDark(v))`.
 */
export function useGlassSource(): GlassSource {
  const glass = useRequired(GlassContext);
  const ref = useRef<HostInstance>(null);
  const [api] = useState<GlassSource>(() => {
    const handle: GlassSourceHandle = { measure: () => measureInWindow(ref.current) };
    return {
      props: { ref, collapsable: false, onTouchStart: (e) => glass.prepare(e.nativeEvent.target as unknown as number) },
      handle,
      transition: (apply, options) => glass.transition(apply, { ...options, live: options?.live ?? handle }),
    };
  });
  return api;
}

export type GlassScrub = {
  /**
   * A gesture started: snapshot, apply, and let the glass follow `target`. `revert` undoes `apply`
   * if the scrub is cancelled, or cut short before `end` (a newer transition, rotation, unmount,
   * the app going to the background).
   */
  begin(apply: () => void, revert: () => void, options?: GlassTransitionOptions): void;
  /** Where the finger wants the glass, 0..1. Write it from UI-thread worklets. */
  target: SharedValue<number>;
  /** JS convenience for `target.set(target)`. */
  update(target: number): void;
  /**
   * Let go: finish (`true`) or cancel and revert (`false`). Resolves once the overlay is gone.
   * May come before the snapshots are ready; it's applied as soon as they are. Without a matching
   * `begin`, a second time, or after the scrub was cut short, it resolves `'skipped'`.
   */
  end(commit: boolean): Promise<GlassResult>;
};

/**
 * Drive the glass with a gesture: `begin(apply, revert)` when it starts, then set `target` (`target.set(p)`)
 * (0..1) from a UI-thread worklet or call `update(t)` from JS, and `end(commit)`.
 * A scrub that never gets its `end` is cancelled when this component unmounts or the app goes
 * to the background, so the provider's touch blocker can't stay up.
 */
export function useGlassScrub(): GlassScrub {
  const glass = useRequired(GlassContext);
  const [api] = useState<GlassScrub>(() => {
    let run: ScrubRun | null = null;
    return {
      begin(apply, revert, options) {
        run = glass.scrub(apply, revert, options);
      },
      target: glass.target,
      update(target) {
        glass.target.set(target);
      },
      end(commit) {
        const r = run;
        run = null;
        return r ? r.end(commit) : Promise.resolve('skipped');
      },
    };
  });
  useEffect(() => {
    const cancel = () => void api.end(false).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => state === 'background' && cancel());
    return () => {
      sub.remove();
      cancel();
    };
  }, [api]);
  return api;
}
