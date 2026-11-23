import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { BlurMask, Canvas, Circle, Group, LinearGradient, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { useGlassSource } from 'react-native-glass-transitions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTourTarget } from '../tour/Tour';
import { usePrefs, useT } from './prefs';
import { ThemeButton } from './ui';

// Background and text follow the artwork: a pastel wash by day, the record's deep violet by night.
const LIGHT = {
  bg: 'linear-gradient(180deg, #F9DCE6 0%, #EAD9F6 45%, #D8E2FA 100%)',
  text: '#1C1030',
  dim: 'rgba(28, 16, 48, 0.55)',
  track: 'rgba(28, 16, 48, 0.16)',
  fill: '#1C1030',
};
const DARK = {
  bg: 'linear-gradient(180deg, #3B0F3F 0%, #1E0B33 50%, #0A0718 100%)',
  text: '#FFFFFF',
  dim: 'rgba(255, 255, 255, 0.55)',
  track: 'rgba(255, 255, 255, 0.18)',
  fill: '#FFFFFF',
};
// Glass Pro: the same screen, re-skinned in champagne gold (light) and black gold (dark).
const PRO_LIGHT = {
  bg: 'radial-gradient(circle at 50% 30%, #FFF6DC 0%, rgba(255,246,220,0) 60%), linear-gradient(180deg, #F6E7C1 0%, #EBD49E 55%, #D9B978 100%)',
  text: '#2A1D05',
  dim: 'rgba(42, 29, 5, 0.58)',
  track: 'rgba(42, 29, 5, 0.16)',
  fill: '#9A6B12',
};
const PRO_DARK = {
  bg: 'radial-gradient(circle at 50% 30%, rgba(232,196,106,0.28) 0%, rgba(232,196,106,0) 55%), linear-gradient(180deg, #2A1F0A 0%, #141008 55%, #050403 100%)',
  text: '#FFF6E3',
  dim: 'rgba(255, 246, 227, 0.58)',
  track: 'rgba(255, 246, 227, 0.18)',
  fill: '#E8C46A',
};
const GOLD_BUTTON = 'linear-gradient(135deg, #F9E3A1 0%, #E8BC5A 50%, #C8902E 100%)';

/** Generated cover art: a sunset sun behind drifting color, no images. */
function Artwork({ size }: { size: number }) {
  return (
    <Canvas style={{ width: size, height: size }}>
      <Rect x={0} y={0} width={size} height={size}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(size, size)}
          colors={['#2A0B4F', '#8A1E6E', '#F0566A', '#FFB55E']}
          positions={[0, 0.4, 0.75, 1]}
        />
      </Rect>
      <Group>
        <BlurMask blur={38} style="normal" />
        <Circle cx={size * 0.2} cy={size * 0.25} r={size * 0.32} color="#3F5BFF" opacity={0.75} />
        <Circle cx={size * 0.9} cy={size * 0.85} r={size * 0.3} color="#FFD36E" opacity={0.8} />
      </Group>
      <Circle cx={size * 0.55} cy={size * 0.5} r={size * 0.24}>
        <RadialGradient c={vec(size * 0.5, size * 0.42)} r={size * 0.3} colors={['#FFF6D8', '#FFB36B', '#FF5F7E']} />
      </Circle>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Rect key={i} x={0} y={size * (0.56 + i * 0.05)} width={size} height={size * (0.012 + i * 0.004)} color="#2A0B4F" opacity={0.85} />
      ))}
      <Circle cx={size * 0.55} cy={size * 0.5} r={size * 0.36} style="stroke" strokeWidth={1.5} color="rgba(255,255,255,0.35)" />
    </Canvas>
  );
}

export function NowPlaying() {
  const dark = useColorScheme() === 'dark';
  const { pro, set } = usePrefs();
  const t = useT();
  const p = pro ? (dark ? PRO_DARK : PRO_LIGHT) : dark ? DARK : LIGHT;
  const buy = useGlassSource();
  const buyPro = () => buy.transition(() => set({ pro: true }), { preset: 'liquid', origin: 'source' });
  useTourTarget('buy', buy.handle, buyPro);
  const { width } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const [playing, setPlaying] = useState(true);
  const art = width - 96;

  const control = (name: SymbolViewProps['name'], size: number, label: string, onPress?: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.control, pressed && { opacity: 0.5 }]}
    >
      <SymbolView name={name} size={size} tintColor={p.text} />
    </Pressable>
  );

  return (
    <View style={[styles.fill, { experimental_backgroundImage: p.bg, paddingTop: top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: p.text }]}>{t.nowPlaying}</Text>
        {pro && (
          <View style={[styles.proPill, { borderColor: p.fill }]}>
            <Text style={[styles.proText, { color: p.fill }]}>PRO</Text>
          </View>
        )}
      </View>

      <View style={[styles.art, { width: art, height: art }, dark && styles.artDark, pro && styles.artPro]}>
        <Artwork size={art} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.fill}>
            <Text style={[styles.title, { color: p.text }]}>Night Falls Slowly</Text>
            <Text style={[styles.artist, { color: p.dim }]}>Lumen Arcade — Refraction</Text>
          </View>
          <View style={[styles.more, { backgroundColor: p.track }]}>
            <SymbolView name="ellipsis" size={17} tintColor={p.text} />
          </View>
        </View>

        <View>
          <View style={[styles.scrub, { backgroundColor: p.track }]}>
            <View style={[styles.scrubFill, { backgroundColor: p.fill }]} />
          </View>
          <View style={styles.times}>
            <Text style={[styles.time, { color: p.dim }]}>1:24</Text>
            {pro && (
              <View style={[styles.badge, { backgroundColor: p.track }]}>
                <SymbolView name="waveform" size={11} tintColor={p.fill} />
                <Text style={[styles.badgeText, { color: p.fill }]}>{t.lossless}</Text>
              </View>
            )}
            <Text style={[styles.time, { color: p.dim }]}>−2:13</Text>
          </View>
        </View>

        <View style={styles.transport}>
          {control('backward.fill', 32, 'Previous')}
          {control(playing ? 'pause.fill' : 'play.fill', 44, playing ? 'Pause' : 'Play', () => setPlaying(!playing))}
          {control('forward.fill', 32, 'Next')}
        </View>

        <View style={styles.volume}>
          <SymbolView name="speaker.fill" size={13} tintColor={p.dim} />
          <View style={[styles.scrub, styles.fill, { backgroundColor: p.track }]}>
            <View style={[styles.scrubFill, { width: '62%', backgroundColor: p.dim }]} />
          </View>
          <SymbolView name="speaker.wave.3.fill" size={13} tintColor={p.dim} />
        </View>

        {pro ? (
          // Unlocked: synced lyrics, current line bright.
          <View style={[styles.lyrics, { backgroundColor: p.track }]}>
            <Text style={[styles.lyricNow, { color: p.text }]} numberOfLines={1}>
              And the light bends gold
            </Text>
            <Text style={[styles.lyricNext, { color: p.dim }]} numberOfLines={1}>
              through the glass tonight
            </Text>
          </View>
        ) : (
          <View {...buy.props} style={styles.buy}>
            <Pressable
              onPress={buyPro}
              accessibilityRole="button"
              accessibilityLabel={t.upgrade}
              style={({ pressed }) => [styles.buyButton, pressed && { opacity: 0.8 }]}
            >
              <SymbolView name="crown.fill" size={18} tintColor="#3A2604" />
              <View>
                <Text style={styles.buyTitle}>{t.upgrade}</Text>
                <Text style={styles.buySub}>{t.upgradeSub}</Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>
      <ThemeButton tint={p.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  proPill: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  proText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  art: {
    alignSelf: 'center',
    marginTop: 12,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: '0 18px 36px rgba(60, 20, 80, 0.35)',
  },
  artDark: { boxShadow: '0 18px 40px rgba(0, 0, 0, 0.6)' },
  artPro: { borderWidth: 1.5, borderColor: '#E8C46A', boxShadow: '0 16px 44px rgba(214, 160, 60, 0.55)' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  lyrics: {
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 58,
    justifyContent: 'center',
  },
  lyricNow: { fontSize: 17, fontWeight: '700' },
  lyricNext: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  buy: { borderRadius: 29 },
  buyButton: {
    minHeight: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    experimental_backgroundImage: GOLD_BUTTON,
    boxShadow: '0 8px 20px rgba(200, 144, 46, 0.35)',
  },
  buyTitle: { fontSize: 17, fontWeight: '700', color: '#3A2604' },
  buySub: { fontSize: 12, fontWeight: '600', color: 'rgba(58, 38, 4, 0.7)' },
  body: { paddingHorizontal: 32, paddingTop: 24, gap: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  artist: { fontSize: 20, marginTop: 2 },
  more: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  scrub: { height: 6, borderRadius: 3, overflow: 'hidden' },
  scrubFill: { width: '39%', height: '100%', borderRadius: 3 },
  times: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, height: 18 },
  time: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  transport: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  control: { minWidth: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  volume: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
