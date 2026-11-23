import {
  Appearance,
  DynamicColorIOS,
  PlatformColor,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type ColorValue,
} from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host, Spacer } from '@expo/ui/swift-ui';
import { background, frame, glassEffect, shapes } from '@expo/ui/swift-ui/modifiers';
import { useGlassSource, useGlassTransition } from 'react-native-glass-transitions';
import { TINT, useT } from './prefs';

export const c = (name: string) => PlatformColor(name);
export const setScheme = (dark: boolean) => Appearance.setColorScheme(dark ? 'dark' : 'light');

/**
 * iOS 26 Liquid Glass behind RN content, drawn by SwiftUI: a thin blur material (so text behind
 * doesn't read through sharply) under the glass rim and highlights.
 */
export function Glass({ shape = 'capsule' }: { shape?: 'capsule' | 'circle' }) {
  return (
    <Host style={StyleSheet.absoluteFill} pointerEvents="none" ignoreSafeArea="all">
      <Spacer
        modifiers={[
          frame({ maxWidth: 10000, maxHeight: 10000 }),
          background({ type: 'material', material: 'ultraThin' }, shape === 'circle' ? shapes.circle() : shapes.capsule()),
          glassEffect({ glass: { variant: 'regular' }, shape }),
        ]}
      />
    </Host>
  );
}

/** 44pt glass circle in the top-right corner: flips light/dark, and stays live through the sweep. */
export function ThemeButton({ tint }: { tint?: ColorValue }) {
  const dark = useColorScheme() === 'dark';
  const source = useGlassSource();
  const { top } = useSafeAreaInsets();
  return (
    <View {...source.props} style={[styles.themeButton, { top: top + 2 }]}>
      <Glass shape="circle" />
      <Pressable
        onPress={() => source.transition(() => setScheme(!dark))}
        accessibilityRole="button"
        accessibilityLabel={dark ? 'Switch to light appearance' : 'Switch to dark appearance'}
        style={styles.themeHit}
      >
        <SymbolView name={dark ? 'sun.max.fill' : 'moon.fill'} size={20} tintColor={tint ?? c('label')} />
      </Pressable>
    </View>
  );
}

export const tabs: { key: Tab; icon: SymbolViewProps['name'] }[] = [
  { key: 'weather', icon: 'cloud.sun.fill' },
  { key: 'music', icon: 'music.note' },
  { key: 'photos', icon: 'photo.on.rectangle' },
  { key: 'wallet', icon: 'wallet.bifold.fill' },
  { key: 'settings', icon: 'gearshape.fill' },
];
export type Tab = 'weather' | 'music' | 'photos' | 'wallet' | 'settings';

// iOS 26 floating tab bar metrics (402pt-wide iPhone): 62pt capsule, 20pt from the sides,
// floating clear of the home indicator.
const BAR = { side: 20, height: 62, pad: 4 };
export const barBottom = (bottom: number) => Math.max(bottom - 8, 16);

/** Center of a tab item in window coordinates (for the tour's finger). */
export function tabCenter(tab: Tab, width: number, height: number, bottom: number) {
  const i = tabs.findIndex((t) => t.key === tab);
  const item = (width - 2 * BAR.side - 2 * BAR.pad) / tabs.length;
  return { x: BAR.side + BAR.pad + item * (i + 0.5), y: height - barBottom(bottom) - BAR.height / 2 };
}

/** Floating Liquid Glass tab bar. Switching tabs runs through the glass, like any other state change. */
export function TabBar({ tab, onChange, onLongPress }: { tab: Tab; onChange: (tab: Tab) => void; onLongPress?: () => void }) {
  const { bottom } = useSafeAreaInsets();
  const glass = useGlassTransition();
  const t = useT();
  return (
    <View style={[styles.bar, { bottom: barBottom(bottom) }]} accessibilityRole="tabbar">
      <Glass />
      {tabs.map((item) => {
        const on = item.key === tab;
        return (
          <Pressable
            key={item.key}
            onPress={() => !on && glass.transition(() => onChange(item.key), { origin: 'touch' })}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.tabs[item.key]}
            style={[styles.tab, on && styles.tabOn]}
          >
            <SymbolView name={item.icon} size={22} tintColor={on ? TINT : c('label')} style={styles.tabIcon} />
            <Text style={[styles.tabLabel, { color: on ? TINT : c('label') }]} numberOfLines={1} adjustsFontSizeToFit>
              {t.tabs[item.key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  themeButton: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22 },
  themeHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: {
    position: 'absolute',
    left: BAR.side,
    right: BAR.side,
    height: BAR.height,
    padding: BAR.pad,
    flexDirection: 'row',
    borderRadius: BAR.height / 2,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: (BAR.height - 2 * BAR.pad) / 2 },
  tabOn: { backgroundColor: DynamicColorIOS({ light: 'rgba(0, 0, 0, 0.07)', dark: 'rgba(255, 255, 255, 0.14)' }) },
  tabIcon: { width: 28, height: 26 },
  tabLabel: { fontSize: 10, lineHeight: 12, fontWeight: '600' },
});
