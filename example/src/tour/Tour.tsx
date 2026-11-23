// The scripted marketing tour (~40 s): real use cases through the glass, with captions and a visible finger.
// Not part of the reference code: screens only mark their tour targets with `useTourTarget`.
import { useEffect, useEffectEvent, useState, type Dispatch, type SetStateAction } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
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

type Point = { x: number; y: number };
export type TourUI = { caption: string | null; finger: Point | null; pressed?: boolean };
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
        scrub.begin(
          () => setScheme(true),
          () => setScheme(false),
          { origin: 'top', preset: 'glass' },
        );
        const start = Date.now();
        await new Promise<void>((done) => {
          const step = () => {
            const t = Math.min(1, (Date.now() - start) / 1400);
            const p = 0.62 * (1 - Math.pow(1 - t, 2)); // ease out, like a hand slowing down
            scrub.update(p);
            show({ finger: { x: width / 2, y: 140 + p * height * 0.75 }, pressed: true });
            if (t < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        });
        show({ finger: null, pressed: false });
        await scrub.end(true);
      },
      500,
    );

    say(null);
    mark('end', 'start');
    await sweep('glass', () => setEnd(true), 'auto', 2500);
    mark('end', 'end');
  };

  const onLaunch = useEffectEvent(() => void play());
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
      {ui.finger && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(200)}
          style={[styles.finger, { left: ui.finger.x - 22, top: ui.finger.y - 22 }, ui.pressed && styles.pressed]}
        />
      )}
    </View>
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
  finger: {
    position: 'absolute',
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
