// The run state machine: pure TypeScript, no React Native / Skia / Reanimated at runtime. Everything
// it touches goes through `Ports` (the native adapter in ./native.ts, a fake in the tests).
import { presets, resolveConfig, type GlassConfig, type GlassOrigin } from '../config';
import { barStyleFor, brightness, compare, resolveOrigin, type BarStyle, type GlassImage } from '../snapshot';
import type { BarHold } from '../statusBar';
import type { GlassRect, GlassResult, GlassTransitionOptions } from '../types';

const FRESH_MS = 300; // a touch-down snapshot older than this may no longer match the screen
const TOUCH_MS = 1500; // `touch` origin: how recent the touch must be
const SETTLE_TRIES = 6; // shots of the "after" screen until it has visibly changed...
const SETTLE_MS = 600; // ...within this budget
const CONFIRM_TRIES = 2; // then more, while the glass comes in, in case it was still painting
const CHANGED = 24; // a grid sample differing by more than this (of 765) counts as a visible change


/** What the provider currently says (props, or the tuner's overrides). Read at the start of each run. */
export type Settings = { config: GlassConfig; origin: GlassOrigin; haptics: boolean };

/** What the overlay draws: `from` frozen on top, `to` revealed by the glass. Root space, points. */
export type Frame<I extends GlassImage = GlassImage> = { id: number; from: I; to: I; hole?: GlassRect; width: number; height: number };

/** Where a sweep goes, in root space. `barDistance`: radius at which the glass reaches the status bar (-1 = none). */
export type Aim = { id: number; center: { x: number; y: number }; end: number; barDistance: number; direction: number };

/** The glass's animation. Implementations run it on the UI thread; callbacks come back on JS. */
export type GlassControls = {
  /** No glass (progress 0) with this look and live-control hole: the frozen frame alone. */
  reset(look: { config: GlassConfig; hole?: GlassRect; haptics: boolean }): void;
  /** Run the sweep to its end over `duration` ms, then call `done`. */
  sweep(aim: Aim, duration: number, done: () => void): void;
  /** Move a running sweep's aim (origin, end, direction). Ignored once any of the glass shows. */
  reaim(aim: Aim): void;
  /** Scrub: from now on the glass follows the finger's target. */
  follow(aim: Aim): void;
  /** Scrub let go: animate on to the end (`commit`) or back to the start, then call `done`. */
  letGo(commit: boolean, done: () => void): void;
  /** Stop everything, hide the glass and reset the finger's target to 0 for the next scrub. */
  stop(): void;
};

export type Ports<I extends GlassImage = GlassImage> = {
  /**
   * Snapshot of the root. Resolves null on failure; never rejects. `touched`: the view under a
   * touch-down; resolves null (skipped) when it's a native control the snapshot could disturb.
   */
  snapshot(touched?: number): Promise<I | null>;
  /** The root's rect in the window. */
  measureRoot(): Promise<GlassRect | undefined>;
  /** Status bar height in window points (0 when hidden or unknown). */
  statusBarHeight(): Promise<number>;
  /** Hold a status bar style over the app's own until released. */
  holdBar(style: BarStyle): BarHold;
  nextFrame(): Promise<unknown>;
  now(): number;
  /** False: changes apply instantly (not iOS, Reduce Motion, shader unavailable). Checked when a run starts. */
  enabled(): boolean;
  settings(): Settings;
  /** Draw `frame` (null = no overlay). Resolves once the previously drawn frame can no longer be drawn. */
  show(frame: Frame<I> | null): Promise<unknown>;
  /** Block touches (true from a run's start until the last run ends). */
  setBusy(busy: boolean): void;
  glass: GlassControls;
  haptic(kind: 'light' | 'soft'): void;
};

/** A scrub in progress; `end` once, later calls resolve 'skipped'. */
export type ScrubRun = { end(commit: boolean): Promise<GlassResult> };

type Failure = { error: unknown };

/** One transition. Every await in `drive` re-checks `done`: a run cut short only cleans up its own things. */
type Run<I extends GlassImage> = {
  readonly id: number;
  readonly promise: Promise<GlassResult>;
  readonly interactive: boolean;
  readonly apply: () => void;
  readonly revert?: () => void;
  readonly options: GlassTransitionOptions;
  /** Provider settings at the run's start. */
  readonly settings: Settings;
  phase: 'preparing' | 'sweeping' | 'finishing' | 'fallback';
  applied: boolean;
  /** Scrub: how `end` was called (null = not yet). */
  ended: boolean | null;
  done: boolean;
  /** Images this run owns and hasn't disposed yet. */
  images: I[];
  bar: BarHold | null;
  bars: { from: BarStyle | null; to: BarStyle | null };
  /** The glass has reached the status bar (it shows `bars.to`). */
  barReached: boolean;
  settle(result: GlassResult, failure?: Failure): void;
};

export function createEngine<I extends GlassImage>(ports: Ports<I>) {
  let seq = 0;
  let active: Run<I> | null = null;
  let shown: Frame<I> | null = null;
  let busy = false;
  let early: { at: number; image: Promise<I | null> } | null = null;
  let lastTouch: { x: number; y: number; at: number } | null = null;
  let size: { width: number; height: number } | null = null;

  const setBusy = (on: boolean) => {
    if (busy !== on) ports.setBusy((busy = on));
  };

  /** Draw `frame`; resolves once whatever was drawn before can no longer be. */
  const show = (frame: Frame<I> | null) => {
    shown = frame;
    return ports.show(frame);
  };

  const disposeLater = (image: Promise<I | null>) => image.then((i) => i?.dispose());

  function dropEarly() {
    const e = early;
    early = null;
    if (e) disposeLater(e.image);
  }

  function takeEarly() {
    const e = early;
    early = null;
    if (e && ports.now() - e.at < FRESH_MS) return e.image;
    if (e) disposeLater(e.image);
    return null;
  }

  /** Track an image as the run's, or dispose it right away if the run is already over. */
  function own(r: Run<I>, image: I | null) {
    if (r.done) {
      image?.dispose();
      return false;
    }
    if (image) r.images.push(image);
    return true;
  }

  /** Dispose one of the run's images once no frame can draw it. */
  function drop(r: Run<I>, image: I, afterShown?: Promise<unknown>) {
    r.images = r.images.filter((i) => i !== image);
    if (afterShown) afterShown.then(() => image.dispose());
    else image.dispose();
  }

  function holdBar(r: Run<I>, style: BarStyle | null) {
    if (!style) {
      r.bar?.release();
      r.bar = null;
    } else if (r.bar) r.bar.set(style);
    else r.bar = ports.holdBar(style);
  }

  /** Drop the overlay, glass, status bar hold and images of `r` (and only of `r`). */
  function clearVisuals(r: Run<I>) {
    if (active === r) ports.glass.stop();
    holdBar(r, null);
    const images = r.images;
    r.images = [];
    const gone = shown?.id === r.id ? show(null) : Promise.resolve();
    if (images.length) gone.then(() => images.forEach((i) => i.dispose()));
  }

  function finalize(r: Run<I>, result: GlassResult, failure?: Failure) {
    if (r.done) return;
    r.done = true;
    clearVisuals(r);
    if (active === r) {
      active = null;
      setBusy(false);
    }
    r.settle(result, failure);
  }

  /** Make the app state match `commit` (apply or revert as needed). False if the user's code threw (run finalized). */
  function reconcile(r: Run<I>, commit: boolean) {
    try {
      if (commit && !r.applied) {
        r.applied = true;
        r.apply();
      } else if (!commit && r.applied) {
        r.applied = false;
        r.revert?.();
      }
      return true;
    } catch (error) {
      finalize(r, 'instant', { error });
      return false;
    }
  }

  /**
   * Finish `r` right now: overlay lifted, promise settled. A transition keeps its change; a scrub
   * keeps what `end` said, and one still held (no `end` yet) is reverted.
   */
  function jump(r: Run<I>) {
    if (r.done) return;
    const commit = r.interactive ? r.ended === true : true;
    if (reconcile(r, commit)) finalize(r, !commit ? 'skipped' : r.phase === 'sweeping' || r.phase === 'finishing' ? 'animated' : 'instant');
  }

  /** The run can't animate (no snapshot, nothing changed). A scrub without an end yet waits for it. */
  function fallback(r: Run<I>) {
    if (!r.interactive || r.ended !== null) return jump(r);
    clearVisuals(r);
    r.phase = 'fallback';
  }

  /** Our own bug, not the user's: never drop their change because of it. */
  function fail(r: Run<I>, error: unknown) {
    console.warn('[glass-transitions] sweep failed, applying without it:', error);
    jump(r);
  }

  /** The glass's animation reached its end. */
  function swept(r: Run<I>, commit: boolean) {
    if (active !== r || r.phase !== 'sweeping') return;
    if (!reconcile(r, commit)) return;
    if (commit && r.settings.haptics) ports.haptic('soft');
    r.phase = 'finishing';
    // Let the reverted/new UI render before lifting the overlay.
    ports.nextFrame().then(() => finalize(r, commit ? 'animated' : 'skipped'));
  }

  function letGo(r: Run<I>, commit: boolean) {
    ports.glass.letGo(commit, () => swept(r, commit));
  }

  async function drive(r: Run<I>) {
    const s = r.settings;
    const o = r.options;
    const config = resolveConfig(o.preset ? presets[o.preset] : s.config, o.config);
    const [holeInWindow, box, barHeight, first] = await Promise.all([
      Promise.resolve(o.live?.measure()).catch(() => undefined),
      ports.measureRoot(),
      ports.statusBarHeight(),
      // A touch-down shot can come back empty (skipped on a native control): take one now instead.
      Promise.resolve(takeEarly()).then((image) => image ?? ports.snapshot()),
    ]);
    const from = first;
    if (!own(r, from)) return;
    if (r.ended === false) return finalize(r, 'skipped'); // a scrub cancelled before it showed anything
    if (!from || !box || !box.width || !box.height) return fallback(r);

    // Everything below is in root space: the provider need not fill the window.
    const { width, height } = box;
    const hole = holeInWindow && { ...holeInWindow, x: holeInWindow.x - box.x, y: holeInWindow.y - box.y };
    const band = barHeight - box.y; // status bar's bottom edge; <= 0 when the root starts below it
    const barAt = band > 0 ? band / 2 / height : -1;
    const frame: Frame<I> = { id: r.id, from, to: from, hole, width, height };
    ports.glass.reset({ config, hole, haptics: s.haptics });
    show(frame); // freeze the old look on top
    r.bars.from = barAt >= 0 ? barStyleFor(from, barAt) : null;
    holdBar(r, r.bars.from); // the app's bar may follow the new state at once: keep the old one until the glass gets there
    // Two frames: the frozen frame is on screen (not just committed) before the app changes underneath.
    await ports.nextFrame();
    await ports.nextFrame();
    if (r.done) return;
    if (!reconcile(r, true)) return;

    // The sweep starts on the first shot that differs: a full snapshot is the slowest step, and
    // waiting for another to confirm the screen held still would put it between the tap and the glass.
    const ignore = hole && { x: (hole.x - 4) / width, y: (hole.y - 4) / height, width: (hole.width + 8) / width, height: (hole.height + 8) / height };
    const deadline = ports.now() + SETTLE_MS;
    let to: I | null = null;
    for (let i = 0; !to && i < SETTLE_TRIES && ports.now() < deadline; i++) {
      const shot = await changed(r, from, ignore);
      if (shot === 'stop') break;
      to = shot;
    }
    if (r.done) return;
    if (!to) return fallback(r); // nothing visibly changed
    r.bars.to = barAt >= 0 ? barStyleFor(to, barAt) : null;
    let current: Frame<I> = { ...frame, to };
    let aim = aimFor(r, current, box, hole, band);
    await begin(r, current, config, aim);

    // The screen may still be painting (a heavy screen renders over several frames, a canvas-drawn
    // sky a frame behind). While the glass comes in from off screen, swap in the newer look, and
    // re-aim if it changes which way the screen is going (night falls, day rises).
    for (let i = 0; i < CONFIRM_TRIES && r.phase === 'sweeping'; i++) {
      const shot = await changed(r, current.to, ignore);
      if (!shot || shot === 'stop') return;
      if (r.phase !== 'sweeping') return drop(r, shot);
      const before = current.to;
      current = { ...current, to: shot };
      drop(r, before, show(current));
      r.bars.to = barAt >= 0 ? barStyleFor(shot, barAt) : null;
      if (r.barReached) holdBar(r, r.bars.to);
      const next = aimFor(r, current, box, hole, band);
      if (!r.interactive && next.direction !== aim.direction) ports.glass.reaim((aim = next));
    }
  }

  /** The next frame's shot if it visibly differs from `than`, null if not; 'stop' if there's none or the run is over. */
  async function changed(r: Run<I>, than: I, ignore: GlassRect | undefined): Promise<I | null | 'stop'> {
    await ports.nextFrame();
    if (r.done) return 'stop';
    const shot = await ports.snapshot();
    if (!own(r, shot) || !shot) return 'stop';
    if (compare(than, shot, { ignore }).max > CHANGED) return shot;
    drop(r, shot); // never shown
    return null;
  }

  /** Where the glass goes for `frame`: which way the screen is going drives `auto` and the mood. */
  function aimFor(r: Run<I>, frame: Frame<I>, box: GlassRect, hole: GlassRect | undefined, band: number): Aim {
    const { width, height } = box;
    const delta = brightness(frame.from) - brightness(frame.to);
    const direction = delta > 12 ? 1 : delta < -12 ? -1 : 0;
    const touch = lastTouch && ports.now() - lastTouch.at < TOUCH_MS ? lastTouch : undefined;
    const center = resolveOrigin(r.options.origin ?? r.settings.origin, box, { hole, touch, offset: box, dir: direction });
    return {
      id: r.id,
      center,
      end: Math.hypot(Math.max(center.x, width - center.x), Math.max(center.y, height - center.y)),
      barDistance: band > 0 ? Math.max(0, center.y - band) : -1,
      direction,
    };
  }

  /** The first changed shot is in: aim the glass and start it. */
  async function begin(r: Run<I>, frame: Frame<I>, config: GlassConfig, aim: Aim) {
    // Show the finished frame one frame before the glass moves: its image is uploaded to the GPU
    // while the screen is still frozen, not on the sweep's first frame (which would stutter).
    show(frame);
    await ports.nextFrame();
    if (r.done) return;
    if (r.settings.haptics) ports.haptic('light');
    r.phase = 'sweeping';
    if (!r.interactive) ports.glass.sweep(aim, config.duration, () => swept(r, true));
    else {
      ports.glass.follow(aim);
      if (r.ended !== null) letGo(r, r.ended);
    }
  }

  /** A running one jumps to its end first (its promise resolves), so no change is ever dropped. */
  function start(apply: () => void, revert: (() => void) | undefined, interactive: boolean, options: GlassTransitionOptions = {}): Run<I> {
    if (active) jump(active);
    let settle!: Run<I>['settle'];
    const promise = new Promise<GlassResult>((resolve, reject) => {
      settle = (result, failure) => (failure ? reject(failure.error) : resolve(result));
    });
    const r: Run<I> = {
      id: ++seq,
      promise,
      interactive,
      apply,
      revert,
      options,
      settings: ports.settings(),
      phase: 'preparing',
      applied: false,
      ended: null,
      done: false,
      images: [],
      bar: null,
      bars: { from: null, to: null },
      barReached: false,
      settle,
    };
    active = r;
    if (!ports.enabled()) {
      fallback(r); // plain change, synchronously (a scrub's on `end`)
      return r;
    }
    setBusy(true);
    drive(r).catch((e) => fail(r, e));
    return r;
  }

  function end(r: Run<I>, commit: boolean) {
    if (r.done || r.ended !== null) return;
    r.ended = commit;
    if (r.phase === 'sweeping') letGo(r, commit);
    else if (r.phase === 'fallback') jump(r);
    // 'preparing': drive picks it up once the snapshots are in.
  }

  return {
    /**
     * Run `apply` behind a sweep. Never throws: if `apply` throws, the promise rejects with that
     * error, after cleanup.
     */
    transition(apply: () => void, options?: GlassTransitionOptions): Promise<GlassResult> {
      return start(apply, undefined, false, options).promise;
    },
    /** Start a scrub: `apply` now, the glass follows the target; `end` lets go. */
    scrub(apply: () => void, revert: () => void, options?: GlassTransitionOptions): ScrubRun {
      const r = start(apply, revert, true, options);
      r.promise.catch(() => {}); // surfaced through `end`; don't double-report
      let ended = false;
      return {
        end(commit) {
          if (ended) return Promise.resolve('skipped');
          ended = true;
          end(r, commit);
          return r.promise;
        },
      };
    },
    /** Touch-down on a source (`touched`: the view's tag): snapshotting takes ~60 ms, starting it now usually hides that. */
    prepare(touched?: number) {
      if (!ports.enabled() || active) return;
      dropEarly();
      const e = { at: ports.now(), image: ports.snapshot(touched) };
      early = e;
      setTimeout(() => early === e && dropEarly(), FRESH_MS);
    },
    /** Remember the latest touch (window coordinates), for the `touch` origin. */
    touch(x: number, y: number) {
      lastTouch = { x, y, at: ports.now() };
    },
    /** The root's size. A resize (rotation) mid-run would misalign the snapshots: jump to the end instead. */
    resize(width: number, height: number) {
      const resized = size && (size.width !== width || size.height !== height);
      size = { width, height };
      if (resized && active) jump(active);
    },
    /** The glass reached (or left) the status bar, for run `id`: flip its style to match what's under it. */
    flip(id: number, reached: boolean) {
      const r = active;
      if (!r || r.id !== id || r.phase !== 'sweeping') return;
      r.barReached = reached;
      holdBar(r, reached ? r.bars.to : r.bars.from);
    },
    /** Unmount: finish whatever runs, free every image. Reusable (StrictMode remounts). */
    dispose() {
      if (active) jump(active);
      dropEarly();
    },
  };
}

export type GlassEngine = ReturnType<typeof createEngine>;
