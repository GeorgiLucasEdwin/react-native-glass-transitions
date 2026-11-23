// expo-haptics is optional: without it (or without its native module) haptics are a no-op.
type Haptics = {
  selectionAsync(): Promise<void>;
  impactAsync(style: unknown): Promise<void>;
  notificationAsync(type: unknown): Promise<void>;
  ImpactFeedbackStyle: { Light: unknown; Soft: unknown };
  NotificationFeedbackType: { Success: unknown };
};

let mod: Haptics | null | undefined;

function play(fn: (h: Haptics) => Promise<void>) {
  if (mod === undefined) {
    try {
      mod = require('expo-haptics') as Haptics;
    } catch {
      mod = null;
    }
  }
  if (!mod) return;
  try {
    fn(mod).catch(() => {});
  } catch {}
}

// Plain module functions so worklets can schedule them on the JS thread.
export const hapticLight = () => play((h) => h.impactAsync(h.ImpactFeedbackStyle.Light));
export const hapticSoft = () => play((h) => h.impactAsync(h.ImpactFeedbackStyle.Soft));
export const hapticTick = () => play((h) => h.selectionAsync());
export const hapticSuccess = () => play((h) => h.notificationAsync(h.NotificationFeedbackType.Success));
