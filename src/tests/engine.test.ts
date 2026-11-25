/// <reference types="node" />
// The run state machine, through its interface, with fake ports: fake images with pixel data, a
// manual frame pump, and counters for images and status bar entries.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { presets } from '../lib/config';
import { createEngine, type Aim, type Frame, type Ports } from '../lib/engine/engine';

type Color = (x: number, y: number) => number[];
const WHITE: Color = () => [255, 255, 255];
const BLACK: Color = () => [0, 0, 0];
const W = 100;
const H = 200;

function harness({ enabled = true, barHeight = 20 } = {}) {
  const h = {
    screen: WHITE, // what the app currently looks like
    created: 0,
    disposed: 0,
    snapshots: 0,
    pushes: 0,
    pops: 0,
    bar: [] as string[], // the held status bar styles, bottom to top
    busy: false,
    haptics: [] as string[],
    stops: 0,
    sweeps: [] as Aim[],
    follows: [] as Aim[],
    /** The running animation's completion callback (sweep or let go). */
    animation: null as (() => void) | null,
    frames: [] as (() => void)[],
    time: 0,
    shown: null as Frame<Img> | null,
    /** Frames replaced but maybe still drawn until a frame passes. */
    fading: [] as (Frame<Img> | null)[],
  };

  const drawn = (img: Img) => [h.shown, ...h.fading].some((f) => f && (f.from === img || f.to === img));

  class Img {
    disposed = false;
    readonly color: Color;
    constructor(color: Color) {
      this.color = color;
      h.created++;
    }
    width = () => W;
    height = () => H;
    readPixels = (x = 0, y = 0) => Uint8Array.from([...this.color(x, y), 255]);
    dispose() {
      assert.ok(!this.disposed, 'image disposed twice');
      assert.ok(!drawn(this), 'image disposed while a frame may still draw it');
      this.disposed = true;
      h.disposed++;
    }
  }

  const nextFrame = () => new Promise<void>((done) => h.frames.push(done));

  const ports: Ports<Img> = {
    snapshot: async () => {
      h.snapshots++;
      return new Img(h.screen);
    },
    measureRoot: async () => ({ x: 0, y: 0, width: W, height: H }),
    statusBarHeight: async () => barHeight,
    holdBar(style) {
      h.pushes++;
      h.bar.push(style);
      let i: number | null = h.bar.length - 1;
      return {
        set: (next) => void (i !== null && (h.bar[i] = next)),
        release() {
          if (i === null) return;
          h.bar.splice(i, 1);
          h.pops++;
          i = null;
        },
      };
    },
    nextFrame,
    now: () => h.time,
    enabled: () => enabled,
    settings: () => ({ config: presets.subtle, origin: 'auto', haptics: true }),
    show(frame) {
      const before = h.shown;
      h.shown = frame;
      h.fading.push(before);
      return nextFrame().then(() => void h.fading.splice(h.fading.indexOf(before), 1));
    },
    setBusy: (busy) => void (h.busy = busy),
    haptic: (kind) => void h.haptics.push(kind),
    glass: {
      reset() {},
      sweep(aim, _duration, done) {
        h.sweeps.push(aim);
        h.animation = done;
      },
      follow: (aim) => void h.follows.push(aim),
      letGo(_commit, done) {
        h.animation = done;
      },
      stop() {
        h.stops++;
        h.animation = null;
      },
    },
  };

  const engine = createEngine(ports);

  const flush = () => new Promise<void>((done) => setImmediate(done));
  /** One frame: everything waiting on it runs, then their follow-up microtasks. */
  async function pump(n = 1) {
    for (let i = 0; i < n; i++) {
      h.time += 16;
      for (const f of h.frames.splice(0)) f();
      await flush();
    }
  }
  /** Pump frames (finishing animations when `animate`) until `p` settles. */
  async function drain<T>(p: Promise<T>, { animate = true } = {}): Promise<T> {
    let settled = false;
    p.then(
      () => (settled = true),
      () => (settled = true),
    );
    for (let i = 0; i < 100 && !settled; i++) {
      await pump();
      if (animate && h.animation) {
        const done = h.animation;
        h.animation = null;
        done();
      }
    }
    assert.ok(settled, 'run never settled');
    return p;
  }
  /** Pump until sweeping (or following), without finishing it. */
  async function untilSweeping() {
    const before = h.sweeps.length + h.follows.length;
    for (let i = 0; i < 20 && h.sweeps.length + h.follows.length === before; i++) await pump();
    assert.ok(h.sweeps.length + h.follows.length > before, 'never started sweeping');
  }
  /** After everything: no leaks, nothing held, nothing blocked. */
  async function clean() {
    await pump(3);
    assert.equal(h.disposed, h.created, 'every image disposed');
    assert.equal(h.pops, h.pushes, 'every status bar entry popped');
    assert.equal(h.busy, false, 'touches unblocked');
    assert.equal(h.shown, null, 'overlay gone');
  }

  return { h, engine, pump, drain, untilSweeping, clean };
}

test('a transition sweeps, applies once and cleans up', async () => {
  const { h, engine, drain, clean } = harness();
  let applied = 0;
  const p = engine.transition(() => {
    applied++;
    h.screen = BLACK;
  });
  assert.equal(h.busy, true);
  assert.equal(await drain(p), 'animated');
  assert.equal(applied, 1);
  assert.equal(h.sweeps.length, 1);
  assert.equal(h.sweeps[0]!.center.y, 0, '`auto`: night falls from the top');
  assert.deepEqual(h.haptics, ['light', 'soft']);
  await clean();
});

test('apply waits until the frozen frame has had two frames to draw', async () => {
  const { h, engine, pump, drain, clean } = harness();
  let applied = false;
  const p = engine.transition(() => {
    applied = true;
    h.screen = BLACK;
  });
  await pump(); // snapshots in, frame shown
  assert.ok(h.shown, 'frozen frame shown');
  assert.equal(applied, false);
  await pump();
  assert.equal(applied, false);
  await pump();
  assert.equal(applied, true);
  await drain(p);
  await clean();
});

test('a newer transition jumps the running one; each apply runs exactly once', async () => {
  const { h, engine, untilSweeping, drain, clean } = harness();
  const applied: [number, number, number] = [0, 0, 0];
  const first = engine.transition(() => {
    applied[0]++;
    h.screen = BLACK;
  });
  await untilSweeping();
  const second = engine.transition(() => {
    applied[1]++;
    h.screen = WHITE;
  });
  assert.equal(await first, 'animated', 'cut short mid-sweep: still counts as animated');
  // Cut short while still preparing: the change goes in without a sweep.
  const third = engine.transition(() => applied[2]++);
  assert.equal(await second, 'instant');
  assert.deepEqual(applied, [1, 1, 0]);
  await drain(third);
  assert.deepEqual(applied, [1, 1, 1]);
  await clean();
});

test('the finished frame is shown one frame before the glass moves (its image uploads while frozen)', async () => {
  const { h, engine, pump, drain, clean } = harness();
  const p = engine.transition(() => (h.screen = BLACK));
  for (let i = 0; i < 20 && !(h.shown && h.shown.to !== h.shown.from); i++) await pump();
  assert.ok(h.shown && h.shown.to !== h.shown.from, 'finished frame shown');
  assert.equal(h.sweeps.length, 0, 'glass not moving yet');
  await pump();
  assert.equal(h.sweeps.length, 1, 'glass moves on the next frame');
  assert.equal(await drain(p), 'animated');
  await clean();
});

test('nothing visibly changed: instant, no sweep', async () => {
  const { h, engine, drain, clean } = harness();
  assert.equal(await drain(engine.transition(() => {})), 'instant');
  assert.equal(h.sweeps.length, 0);
  await clean();
});

test('a small change (one list row) starts the sweep within two retakes', async () => {
  const { h, engine, pump, drain, clean } = harness();
  let afterApply = -1;
  const p = engine.transition(() => {
    h.screen = (x, y) => (y >= 130 && y < 140 ? [0, 122, 255] : [255, 255, 255]);
    afterApply = h.snapshots;
  });
  for (let i = 0; i < 10 && !h.sweeps.length; i++) await pump();
  assert.equal(h.sweeps.length, 1);
  assert.ok(h.snapshots - afterApply <= 2, `took ${h.snapshots - afterApply} retakes`);
  assert.equal(await drain(p), 'animated');
  await clean();
});

test('a repaint a frame later: the sweep waits for it, then reveals the finished screen in the right direction', async () => {
  const { h, engine, pump, drain, clean } = harness();
  const row: Color = (_x, y) => (y >= 130 && y < 140 ? [0, 122, 255] : [255, 255, 255]);
  let afterApply = -1;
  const p = engine.transition(() => {
    h.screen = row; // a small part of the UI updates first (a button's icon)...
    afterApply = h.snapshots;
  });
  for (let i = 0; i < 10 && (afterApply < 0 || h.snapshots === afterApply); i++) await pump();
  assert.equal(h.sweeps.length, 0, 'not started on a half-updated screen');
  h.screen = BLACK; // ...and a canvas-drawn background catches up a frame later
  for (let i = 0; i < 10 && !h.sweeps.length; i++) await pump();
  assert.equal(h.sweeps.length, 1);
  assert.equal(h.sweeps[0]!.center.y, 0, 'direction from the finished screen: night falls from the top');
  assert.equal(await drain(p), 'animated');
  await clean(); // superseded shots disposed, none while drawn
});

test('a throwing apply rejects after cleanup, touches unblocked', async () => {
  const { engine, drain, clean } = harness();
  const boom = new Error('boom');
  await assert.rejects(
    drain(
      engine.transition(() => {
        throw boom;
      }),
    ),
    boom,
  );
  await clean();
});

test('`throw undefined` still rejects', async () => {
  const { engine, drain, clean } = harness({ enabled: false });
  const p = engine.transition(() => {
    throw undefined;
  });
  await assert.rejects(drain(p), (e) => e === undefined);
  await clean();
});

test('a throwing revert rejects the scrub after cleanup', async () => {
  const { h, engine, untilSweeping, drain, clean } = harness();
  const boom = new Error('revert');
  const scrub = engine.scrub(
    () => (h.screen = BLACK),
    () => {
      throw boom;
    },
  );
  await untilSweeping();
  await assert.rejects(drain(scrub.end(false)), boom);
  await clean();
});

test('scrub: follows, commits on end(true)', async () => {
  const { h, engine, untilSweeping, drain, clean } = harness();
  const scrub = engine.scrub(
    () => (h.screen = BLACK),
    () => (h.screen = WHITE),
  );
  await untilSweeping();
  assert.equal(h.follows.length, 1);
  assert.equal(await drain(scrub.end(true)), 'animated');
  assert.equal(h.screen, BLACK);
  await clean();
});

test('scrub: end(false) after the sweep started reverts', async () => {
  const { h, engine, untilSweeping, drain, clean } = harness();
  let reverts = 0;
  const scrub = engine.scrub(
    () => (h.screen = BLACK),
    () => {
      reverts++;
      h.screen = WHITE;
    },
  );
  await untilSweeping();
  assert.equal(await drain(scrub.end(false)), 'skipped');
  assert.equal(reverts, 1);
  assert.equal(h.screen, WHITE);
  await clean();
});

test('scrub: end before the snapshots are ready', async () => {
  for (const commit of [true, false]) {
    const { h, engine, drain, clean } = harness();
    let applies = 0;
    let reverts = 0;
    const scrub = engine.scrub(
      () => {
        applies++;
        h.screen = BLACK;
      },
      () => {
        reverts++;
        h.screen = WHITE;
      },
    );
    const result = await drain(scrub.end(commit));
    if (commit) {
      assert.equal(result, 'animated');
      assert.equal(h.screen, BLACK);
    } else {
      assert.equal(result, 'skipped');
      assert.equal(applies, reverts, 'the app ends up as it was');
      assert.equal(h.screen, WHITE);
    }
    await clean();
  }
});

test('scrub: a second end resolves skipped', async () => {
  const { h, engine, untilSweeping, drain, clean } = harness();
  const scrub = engine.scrub(
    () => (h.screen = BLACK),
    () => (h.screen = WHITE),
  );
  await untilSweeping();
  const first = scrub.end(true);
  assert.equal(await scrub.end(false), 'skipped');
  assert.equal(await drain(first), 'animated');
  await clean();
});

test('scrub: one still held when a transition starts is reverted; its end resolves skipped', async () => {
  const { h, engine, untilSweeping, drain, clean } = harness();
  let reverts = 0;
  const scrub = engine.scrub(
    () => (h.screen = BLACK),
    () => {
      reverts++;
      h.screen = WHITE;
    },
  );
  await untilSweeping();
  const next = engine.transition(() => {});
  assert.equal(reverts, 1);
  assert.equal(await scrub.end(true), 'skipped');
  await drain(next);
  await clean();
});

test('resize mid-run jumps to the end', async () => {
  const { h, engine, untilSweeping, clean } = harness();
  engine.resize(W, H);
  const p = engine.transition(() => (h.screen = BLACK));
  await untilSweeping();
  engine.resize(H, W);
  assert.equal(await p, 'animated');
  assert.equal(h.screen, BLACK);
  await clean();
});

test('dispose (unmount) mid-run settles the promise and frees everything', async () => {
  for (const frames of [0, 1, 3, 6]) {
    const { h, engine, pump, clean } = harness();
    let applied = 0;
    const p = engine.transition(() => {
      applied++;
      h.screen = BLACK;
    });
    await pump(frames);
    engine.dispose();
    const shots = h.snapshots;
    assert.ok(['animated', 'instant'].includes(await p));
    assert.equal(applied, 1);
    await clean();
    assert.equal(h.snapshots, shots, 'no snapshot after the run is over');
  }
});

test('not enabled: instant, synchronously', async () => {
  const { h, engine, clean } = harness({ enabled: false });
  let applied = 0;
  const p = engine.transition(() => applied++);
  assert.equal(applied, 1);
  assert.equal(h.busy, false);
  assert.equal(await p, 'instant');
  await clean();
});

test('status bar: old style held until the glass reaches it; a stale flip does nothing', async () => {
  const { h, engine, untilSweeping, drain, clean } = harness();
  const p = engine.transition(() => (h.screen = BLACK));
  await untilSweeping();
  assert.deepEqual(h.bar, ['dark-content'], 'old (light screen) style held');
  const id = h.sweeps[0]!.id;
  engine.flip(id - 1, true);
  assert.deepEqual(h.bar, ['dark-content']);
  engine.flip(id, true);
  assert.deepEqual(h.bar, ['light-content'], 'new (dark screen) style once the glass is there');
  engine.flip(id, false);
  assert.deepEqual(h.bar, ['dark-content']);
  await drain(p);
  assert.deepEqual(h.bar, []);
  await clean();
});

test('status bar: no hold when the root starts below it', async () => {
  const { h, engine, drain, clean } = harness({ barHeight: 0 });
  await drain(engine.transition(() => (h.screen = BLACK)));
  assert.equal(h.pushes, 0);
  await clean();
});
