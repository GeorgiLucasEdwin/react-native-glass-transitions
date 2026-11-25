// Native adapter for the engine: Skia snapshots, Reanimated shared values and reactions, RN status
// bar, haptics. Owns every shared value the glass needs; the engine only sees `Ports`.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Dimensions, Platform, type HostInstance } from 'react-native';
import { makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import { Easing, cancelAnimation, useAnimatedReaction, useDerivedValue, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { presets, type GlassConfig } from '../config';
import { hapticLight, hapticSoft, hapticTick } from '../haptics';
import { measureInWindow } from '../measure';
import { holdBarStyle, statusBarHeight } from '../statusBar';
import { snapshotWindow } from '../window';
import { createEngine, type Aim, type Frame, type Ports, type Settings } from './engine';

const NO_HOLE = [-9999, -9999, 0, 0];
const OFF = -1e4; // ring radius before the sweep starts: far off screen

const nextFrame = () => new Promise<number>(requestAnimationFrame);

/**
 * Shared values, reactions and the run state machine behind <GlassTransitionProvider>.
 * `enabled` false (shader unavailable) makes every change instant. `windowed` true: the glass covers
 * the whole window (native sheets included), and `top` is the view holding its overlay, left out of
 * the snapshots.
 */
export function useGlassEngine(
  root: RefObject<HostInstance | null>,
  top: RefObject<HostInstance | null>,
  windowed: RefObject<boolean>,
  settings: RefObject<Settings>,
  enabled: boolean,
) {
  const [frame, setFrame] = useState<Frame<SkImage> | null>(null);
  const [busy, setBusy] = useState(false);
  const progress = useSharedValue(0);
  const end = useSharedValue(1);
  const center = useSharedValue([0, 0]);
  const hole = useSharedValue(NO_HOLE);
  const barDistance = useSharedValue(-1); // radius at which the glass reaches the status bar; -1 = off
  const runId = useSharedValue(0);
  const target = useSharedValue(0); // where the finger wants the glass, 0..1
  const ready = useSharedValue(false); // a scrub's snapshots are in; the glass follows the finger
  const direction = useSharedValue(0); // +1 toward a darker screen, -1 toward lighter
  const look = useSharedValue<GlassConfig>(presets.glass);
  const hapticsOn = useSharedValue(true);

  // `show` resolves once the frame it replaced can't be drawn any more: after React committed the
  // new one (the effect below) plus a frame for the canvas to redraw.
  const drawn = useRef<{ frame: Frame<SkImage> | null; waiters: (() => void)[]; alive: boolean }>({ frame: null, waiters: [], alive: true });
  const flush = () => {
    const waiters = drawn.current.waiters.splice(0);
    if (waiters.length) nextFrame().then(() => waiters.forEach((w) => w()));
  };
  const reduceMotion = useRef(false);

  const [engine] = useState(() => {
    const aimAt = (aim: Aim) => {
      runId.set(aim.id);
      center.set([aim.center.x, aim.center.y]);
      end.set(aim.end);
      barDistance.set(aim.barDistance);
      direction.set(aim.direction);
    };
    const ports: Ports<SkImage> = {
      snapshot() {
        if (windowed.current) return snapshotWindow(top.current);
        // makeImageFromView rejects (not just returns null) on failure: treat both as "no snapshot".
        try {
          return makeImageFromView(root as never).catch(() => null);
        } catch {
          return Promise.resolve(null);
        }
      },
      measureRoot: () => (windowed.current ? Promise.resolve({ x: 0, y: 0, ...Dimensions.get('window') }) : measureInWindow(root.current)),
      statusBarHeight,
      holdBar: holdBarStyle,
      nextFrame,
      now: Date.now,
      enabled: () => enabled && Platform.OS === 'ios' && !reduceMotion.current,
      settings: () => settings.current,
      show(next) {
        const d = drawn.current;
        const same = d.frame === next || !d.alive;
        d.frame = next;
        if (same) return nextFrame();
        return new Promise<void>((done) => {
          d.waiters.push(done);
          setFrame(next);
        });
      },
      setBusy,
      haptic: (kind) => (kind === 'light' ? hapticLight() : hapticSoft()),
      glass: {
        reset(l) {
          cancelAnimation(progress);
          progress.set(0);
          ready.set(false);
          barDistance.set(-1);
          direction.set(0);
          look.set(l.config);
          hapticsOn.set(l.haptics);
          hole.set(l.hole ? [l.hole.x, l.hole.y, l.hole.width, l.hole.height] : NO_HOLE);
        },
        sweep(aim, duration, done) {
          aimAt(aim);
          progress.set(
            withTiming(1, { duration, easing: Easing.bezier(0.2, 0, 0, 1) }, (finished) => {
              'worklet';
              if (finished) scheduleOnRN(done);
            }),
          );
        },
        follow(aim) {
          aimAt(aim);
          ready.set(true);
        },
        letGo(commit, done) {
          // Read and animate progress on the UI thread: reading it from JS would block mid-animation.
          scheduleOnUI(() => {
            'worklet';
            ready.set(false);
            const remaining = commit ? 1 - progress.value : progress.value;
            progress.value = withTiming(commit ? 1 : 0, { duration: 150 + remaining * 450, easing: Easing.out(Easing.cubic) }, (finished) => {
              'worklet';
              if (finished) scheduleOnRN(done);
            });
          });
        },
        stop() {
          cancelAnimation(progress);
          ready.set(false);
          barDistance.set(-1);
          target.set(0); // here, not in `begin`: a write from JS then could clobber the finger's first one
        },
      },
    };
    return createEngine(ports);
  });

  useEffect(flush, [frame]);

  // Everything per-frame that doesn't vary per pixel is worked out here, once, not in the shader.
  const uniforms = useDerivedValue(() => {
    const l = look.value;
    const p = progress.value;
    const mood = l.mood * direction.value;
    // Light from the top-left, drifting a little as the ring grows: the half vector toward the eye.
    const la = -2.4 + 0.8 * p;
    const lx = Math.cos(la);
    const ly = Math.sin(la);
    const ln = Math.hypot(lx, ly, 0.7);
    const hx = lx / ln;
    const hy = ly / ln;
    const hz = 0.7 / ln + 1;
    const hn = Math.hypot(hx, hy, hz);
    const t: readonly [number, number, number] = mood > 0 ? [0.8, 0.9, 1] : [1, 0.9, 0.75];
    const a = Math.abs(mood);
    const s = Math.min(1, Math.max(0, (p - 0.5) / 0.5));
    return {
      center: center.value,
      radius: radiusAt(p, end.value, l.band),
      hole: hole.value,
      band: l.band,
      refraction: l.refraction,
      disperse: l.disperse,
      fringe: l.fringe,
      blur: l.blur,
      spec: l.spec,
      fresnel: l.fresnel,
      shadow: l.shadow,
      mood,
      settleNow: l.settle * (1 - s * s * (3 - 2 * s)),
      light: [hx / hn, hy / hn, hz / hn],
      tint: [1 + (t[0] - 1) * a, 1 + (t[1] - 1) * a, 1 + (t[2] - 1) * a],
    };
  });

  // The status bar is drawn by iOS on top of everything, so flip its style when the glass reaches it.
  const flip = engine.flip;
  useAnimatedReaction(
    () => barDistance.value >= 0 && progress.value > 0 && radiusAt(progress.value, end.value, look.value.band) >= barDistance.value,
    (reached, before) => {
      if (before !== null && reached !== before) scheduleOnRN(flip, runId.value, reached);
    },
  );
  // During a drag the glass follows the finger through a stiff spring: smooth even when touch
  // updates arrive unevenly, and no jump when the snapshots land mid-drag.
  useAnimatedReaction(
    () => (ready.value ? Math.min(1, Math.max(0, target.value)) : -1),
    (to) => {
      if (to >= 0) progress.set(withSpring(to, { stiffness: 700, damping: 55, mass: 1 }));
    },
  );
  // A tick when a drag crosses the point where letting go would commit (not when it's let go).
  useAnimatedReaction(
    () => (ready.value ? progress.value > 0.5 : null),
    (past, before) => {
      if (hapticsOn.value && past !== null && before != null && past !== before) scheduleOnRN(hapticTick);
    },
  );

  // Reduce Motion, kept current; each run checks it once, at its start.
  useEffect(() => {
    let alive = true;
    const set = (on: boolean) => (reduceMotion.current = on);
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && set(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', set);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const d = drawn.current;
    d.alive = true;
    return () => {
      d.alive = false;
      engine.dispose();
      flush();
    };
  }, [engine]);

  return { engine, frame, busy, uniforms, target };
}

/**
 * Radius of the ring's center: it starts 2.5 bands inside the origin and ends 2.5 bands past the
 * farthest corner, so the glass fades in and out off screen.
 */
function radiusAt(progress: number, end: number, band: number) {
  'worklet';
  return progress <= 0 ? OFF : progress * (end + 5 * band) - 2.5 * band;
}
