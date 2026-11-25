// The scripted marketing tour (~40 s): real use cases through the glass, with captions and a visible finger.
// Not part of the reference code: screens only mark their tour targets with `useTourTarget`.
import { useEffect, useEffectEvent, useState, type Dispatch, type SetStateAction } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useGlassScrub,
  useGlassTransition,
  type GlassOrigin,
  type GlassPreset,
  type GlassSourceHandle,
} from 'react-native-glass-transitions';
import { initialPrefs, type PrefsState } from '../demo/prefs';
import { barBottom, setScheme, tabCenter, type Tab } from '../demo/ui';
import { EndCard } from './EndCard';

/** Set to true to auto-play the tour on launch (for recording the marketing video). */
export const SHOWCASE_ON_LAUNCH = false;
/** Set to false to record clean clips without captions. */
export const SHOWCASE_CAPTIONS = true;
/** 'tour': the captioned story. 'clips': each scene as a seamless round trip (there and back), for looping videos. */
export const SHOWCASE_MODE: 'tour' | 'clips' = 'tour';

type Point = { x: number; y: number };
export type TourUI = {
  caption: string | null;
  finger: Point | null;
  pressed?: boolean;
  /** Moves the finger down by `value * span` on the UI thread. */
  follow?: { value: SharedValue<number>; span: number };
};
export const idleTour: TourUI = { caption: null, finger: null };

type Target = { handle: GlassSourceHandle; run: (at: Point) => unknown };
const targets = new Map<string, Target>();

/** Screens: let the tour tap this control. `run` does what a tap does; `at` is the control's center. */
export function useTourTarget(name: string, handle: GlassSourceHandle, run: (at: Point) => unknown) {
  // No deps: re-registered every render, so `run` is never stale.
  useEffect(() => {
    const target = { handle, run };
    targets.set(name, target);
    return () => {
      if (targets.get(name) === target) targets.delete(name);
    };
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Log scene boundaries (wall clock ms) so clips can be cut from a screen recording. */
const mark = (scene: string, edge: 'start' | 'end') => console.log(`CLIP ${scene} ${edge} ${Date.now()}`);

type Controls = { setTab: (tab: Tab) => void; setPrefs: (prefs: Partial<PrefsState>) => void };

/** Returns `play`, and the end card to render in place of the app (inside the provider) once the tour reaches it. */
export function useTour(setUI: Dispatch<SetStateAction<TourUI>>, { setTab, setPrefs }: Controls) {
  const glass = useGlassTransition();
  const scrub = useGlassScrub();
  const { width, height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const [end, setEnd] = useState(false);

  const show = (next: Partial<TourUI>) => setUI((ui) => ({ ...ui, ...next }));

  // Drag the glass down from the top. The glass takes its snapshots before the finger shows up,
  // and the drag runs on the UI thread, so neither the finger nor the glass waits on React.
  const dragDown = async () => {
    scrub.begin(
      () => setScheme(true),
      () => setScheme(false),
      { origin: 'top', preset: 'glass' },
    );
    await wait(1600);
    show({ finger: { x: width / 2, y: 140 }, pressed: true, follow: { value: scrub.target, span: height * 0.75 } });
    await wait(400);
    scrub.target.set(withTiming(0.62, { duration: 1400, easing: Easing.out(Easing.quad) })); // a hand slowing down
    await wait(1400);
    show({ finger: null, pressed: false, follow: undefined });
    await scrub.end(true);
  };
  const say = (caption: string | null) => show({ caption });

  // A visible finger: appear, press, lift. The glass then starts from that point.
  const tap = async (at: Point) => {
    show({ finger: at, pressed: false });
    await wait(450);
    show({ pressed: true });
    await wait(140);
    show({ pressed: false });
    return at;
  };
  const tapTarget = async (name: string) => {
    const target = targets.get(name);
    const r = await target?.handle.measure();
    if (!target || !r) return console.warn(`tour: target '${name}' isn't mounted`);
    const at = await tap({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    show({ finger: null });
    await target.run(at);
  };
  // Per-call preset; resolves once the sweep has finished, then a short hold.
  const sweep = async (preset: GlassPreset, apply: () => void, origin: GlassOrigin, hold: number) => {
    const done = glass.transition(apply, { origin, preset });
    show({ finger: null });
    await done;
    await wait(hold);
  };
  const tapTab = (t: Tab) => tap(tabCenter(t, width, height, bottom));
  const hop = async (t: Tab) => sweep('liquid', () => setTab(t), await tapTab(t), 250);
  // A captioned scene with clip markers around it.
  const scene = async (name: string, caption: string, run: () => Promise<unknown>, hold = 900) => {
    say(caption);
    mark(name, 'start');
    await run();
    await wait(hold);
    mark(name, 'end');
  };

  const play = async () => {
    // Deterministic start: Weather, light, English, not Pro.
    setEnd(false);
    setPrefs(initialPrefs);
    setTab('weather');
    setScheme(false);
    setUI(idleTour);
    await wait(800);

    await scene('night', 'Night falls.', () => sweep('glass', () => setScheme(true), 'auto', 0), 500);
    await scene('day', 'Day rises.', () => sweep('glass', () => setScheme(false), 'auto', 0), 500);

    say(null);
    mark('tabs', 'start');
    await hop('music');
    await wait(500);
    mark('tabs', 'end');
    await scene('purchase', 'Unlock Pro.', () => tapTarget('buy'));

    // The balance starts hidden (set during the tab switch), then the eye reveals it.
    say(null);
    await sweep('liquid', () => (setTab('wallet'), setPrefs({ hidden: true })), await tapTab('wallet'), 450);
    await scene('privacy', 'Reveal a balance.', () => tapTarget('eye'));

    say(null);
    await hop('settings');
    await scene('language', 'Switch language.', () => tapTarget('lang:ja'));

    say(null);
    await hop('weather');
    await scene(
      'drag',
      'Drag it.',
      async () => {
        await dragDown();
      },
      500,
    );

    say(null);
    mark('end', 'start');
    await sweep('glass', () => setEnd(true), 'auto', 2500);
    mark('end', 'end');
  };

  // Clips: every scene goes there and back, with the same rest before and after, so the first and
  // last frames match and the video loops without a jump. Setup between scenes uses no glass.
  const runTarget = async (name: string) => {
    const target = targets.get(name);
    const r = await target?.handle.measure();
    if (!target || !r) return console.warn(`tour: target '${name}' isn't mounted`);
    await target.run({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  };
  const REST = 600;
  const HOLD = 1100;
  const clip = async (name: string, there: () => Promise<unknown>, back: () => Promise<unknown>) => {
    await wait(700); // settle after setup
    mark(name, 'start');
    await wait(REST);
    await there();
    await wait(HOLD);
    await back();
    await wait(REST);
    mark(name, 'end');
  };
  const setup = async (prefs: Partial<PrefsState>, tab: Tab, dark = false) => {
    setPrefs({ ...initialPrefs, ...prefs });
    setTab(tab);
    setScheme(dark);
    await wait(900);
  };

  const playClips = async () => {
    setEnd(false);
    setUI(idleTour);

    await setup({}, 'weather');
    await clip(
      'night',
      () => glass.transition(() => setScheme(true), { origin: 'auto', preset: 'glass' }),
      () => glass.transition(() => setScheme(false), { origin: 'auto', preset: 'glass' }),
    );

    await setup({}, 'weather');
    await clip(
      'tabs',
      () => glass.transition(() => setTab('music'), { origin: tabCenter('music', width, height, bottom), preset: 'liquid' }),
      () => glass.transition(() => setTab('weather'), { origin: tabCenter('weather', width, height, bottom), preset: 'liquid' }),
    );

    await setup({}, 'music');
    await clip(
      'purchase',
      () => runTarget('buy'),
      () => runTarget('buy'),
    );

    await setup({ hidden: true }, 'wallet');
    await clip(
      'privacy',
      () => runTarget('eye'),
      () => runTarget('eye'),
    );

    await setup({}, 'settings');
    await clip(
      'language',
      () => runTarget('lang:ja'),
      () => runTarget('lang:en'),
    );

    await setup({}, 'weather');
    await clip(
      'drag',
      async () => {
        await dragDown();
      },
      () => glass.transition(() => setScheme(false), { origin: 'auto', preset: 'glass' }),
    );
    console.log('CLIPS done');
  };

  const onLaunch = useEffectEvent(() => void (SHOWCASE_MODE === 'clips' ? playClips() : play()));
  useEffect(() => {
    if (!SHOWCASE_ON_LAUNCH) return;
    const t = setTimeout(onLaunch, 1500);
    return () => clearTimeout(t);
  }, []);

  return { play, endCard: end ? <EndCard onClose={() => setEnd(false)} /> : null };
}

/** Captions and the fake finger. Render it outside the provider so it never ends up in a snapshot. */
export function TourOverlay({ ui }: { ui: TourUI }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {SHOWCASE_CAPTIONS && ui.caption && (
        <Animated.View
          key={ui.caption}
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(200)}
          style={[styles.caption, { bottom: barBottom(bottom) + 62 + 20 }]}
        >
          <Text style={styles.captionText}>{ui.caption}</Text>
        </Animated.View>
      )}
      {ui.finger && <Finger at={ui.finger} pressed={ui.pressed} follow={ui.follow} />}
    </View>
  );
}

function Finger({ at, pressed, follow }: { at: Point; pressed?: boolean; follow?: TourUI['follow'] }) {
  const moved = useAnimatedStyle(() => ({ transform: [{ translateY: follow ? follow.value.value * follow.span : 0 }] }));
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(200)}
      style={[styles.spot, { left: at.x - 22, top: at.y - 22 }, moved]}
    >
      <View style={[styles.finger, pressed && styles.pressed]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // A dark material pill, legible over any screen in either theme.
  caption: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 100,
    backgroundColor: 'rgba(28, 28, 30, 0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
  },
  captionText: { color: 'white', fontSize: 20, fontWeight: '600', letterSpacing: -0.4, textAlign: 'center' },
  spot: { position: 'absolute', width: 44, height: 44 },
  finger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
  },
  pressed: { transform: [{ scale: 0.82 }], backgroundColor: 'rgba(255, 255, 255, 0.7)' },
});
