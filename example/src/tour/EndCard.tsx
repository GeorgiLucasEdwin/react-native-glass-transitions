import { useEffect } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c } from '../demo/ui';

const mono = 'Menlo';

// One code line, colored in Xcode's default palette (semantic colors flip with the theme).
const Line = ({ parts }: { parts: [string, string?][] }) => (
  <Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
    {parts.map(([text, color], i) => (
      <Text key={i} style={color && { color: c(color) }}>
        {text}
      </Text>
    ))}
  </Text>
);

/** Closing screen of the tour. Tap to dismiss. */
export function EndCard({ onClose }: { onClose: () => void }) {
  const { top, bottom } = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  // Workaround: when the sweep ends the glass hands the bar back as 'default', which here
  // resolves against the system appearance, not the app's. Re-assert it once the glass is done.
  useEffect(() => {
    const t = setTimeout(() => StatusBar.setBarStyle(dark ? 'light-content' : 'dark-content', true), 3200);
    return () => clearTimeout(t);
  }, [dark]);
  return (
    <Pressable style={[styles.fill, { paddingTop: top, paddingBottom: bottom + 16 }]} onPress={onClose} accessibilityLabel="Close">
      <View style={styles.center}>
        <View style={styles.icon}>
          <SymbolView name="circle.lefthalf.filled" size={46} tintColor="white" />
        </View>
        <Text style={styles.wordmark}>Glass Transitions</Text>
        <Text style={styles.tagline}>Any state change, through glass.</Text>

        <View style={[styles.block, styles.install]}>
          <Text style={styles.prompt}>$</Text>
          <Text style={[styles.code, styles.flex]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            npx expo install react-native-glass-transitions
          </Text>
        </View>

        <View style={styles.block}>
          <Line parts={[['<'], ['GlassTransitionProvider', 'systemTeal'], ['>']]} />
          <Line parts={[['const ', 'systemPink'], ['{ transition } = '], ['useGlassTransition', 'systemTeal'], ['()']]} />
          <Line
            parts={[['transition', 'systemTeal'], ['(() => '], ['setTheme', 'systemTeal'], ['('], ["'dark'", 'systemOrange'], ['))']]}
          />
        </View>
      </View>
      <Text style={styles.footer}>iOS · Expo · Skia</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, backgroundColor: c('systemBackground'), paddingHorizontal: 24 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    experimental_backgroundImage: 'linear-gradient(135deg, #5AC8FA 0%, #5856D6 50%, #AF52DE 100%)',
    boxShadow: '0 10px 30px rgba(88, 86, 214, 0.35)',
  },
  wordmark: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6, color: c('label') },
  tagline: { fontSize: 17, color: c('secondaryLabel'), textAlign: 'center', marginTop: 6, marginBottom: 32 },
  block: {
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: c('secondarySystemBackground'),
    gap: 6,
    marginTop: 12,
  },
  install: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prompt: { fontFamily: mono, fontSize: 14, color: c('tertiaryLabel') },
  code: { fontFamily: mono, fontSize: 14, color: c('label') },
  footer: { fontSize: 13, fontWeight: '500', color: c('secondaryLabel'), textAlign: 'center' },
});
