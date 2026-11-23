import { Platform, StatusBar, TurboModuleRegistry, type TurboModule } from 'react-native';
import type { BarStyle } from './snapshot';

type StatusBarManager = TurboModule & { getHeight(callback: (result: { height: number }) => void): void };

/**
 * Height of the iOS status bar in window points; 0 when hidden, unknown or not iOS. Asks the same
 * native module RN's own <StatusBar> uses, so it is right on every device and orientation without a
 * safe-area dependency.
 */
export function statusBarHeight(): Promise<number> {
  if (Platform.OS !== 'ios') return Promise.resolve(0);
  return new Promise((done) => {
    const timer = setTimeout(() => done(0), 250); // never hold a sweep hostage to it
    try {
      const manager = TurboModuleRegistry.get<StatusBarManager>('StatusBarManager');
      if (!manager) return done(0);
      manager.getHeight((r) => {
        clearTimeout(timer);
        done(r?.height ?? 0);
      });
    } catch {
      done(0);
    }
  });
}

export type BarHold = { set(style: BarStyle): void; release(): void };

/**
 * Holds a status bar style on top of the app's own <StatusBar> entries until released, then the
 * app's style comes back (instead of clobbering it with 'default').
 */
export function holdBarStyle(style: BarStyle): BarHold {
  let entry: ReturnType<typeof StatusBar.pushStackEntry> | null = StatusBar.pushStackEntry({ barStyle: style, animated: true });
  return {
    set(next) {
      if (entry) entry = StatusBar.replaceStackEntry(entry, { barStyle: next, animated: true });
    },
    release() {
      if (entry) StatusBar.popStackEntry(entry);
      entry = null;
    },
  };
}
