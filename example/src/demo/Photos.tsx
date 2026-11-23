import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlassSource, useGlassTransition } from 'react-native-glass-transitions';
import { TILES } from './library';
import { usePrefs, useT } from './prefs';
import { Glass, ThemeButton, c } from './ui';

const COLUMNS = 3;
const GAP = 2;

/** Navigation through the glass: open a photo from the tile you touched, close it from the close button. */
export function Photos() {
  const { width } = useWindowDimensions();
  const { photo, set } = usePrefs();
  const t = useT();
  const glass = useGlassTransition();
  const tile = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  if (photo !== null) return <Viewer index={photo} />;
  return (
    <View style={styles.fill}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} style={styles.fill}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.library}</Text>
          <Text style={styles.subtitle}>{t.libraryCount}</Text>
        </View>
        <View style={styles.grid}>
          {TILES.map((p, i) => (
            <Pressable
              key={i}
              onPress={() => glass.transition(() => set({ photo: i }), { preset: 'liquid', origin: 'touch' })}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${i + 1}`}
              style={{ width: tile, height: tile, experimental_backgroundImage: p.css, transform: p.flip ? [{ scaleX: -1 }] : undefined }}
            >
              {p.video && <Text style={[styles.duration, p.flip && styles.unflip]}>0:{(12 + i).toString().padStart(2, '0')}</Text>}
              {i === 2 && <SymbolView name="heart.fill" size={13} tintColor="white" style={styles.heart} />}
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <ThemeButton />
    </View>
  );
}

function Viewer({ index }: { index: number }) {
  const { width, height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const { set } = usePrefs();
  const t = useT();
  const close = useGlassSource();
  const p = TILES[index];
  const photoW = width - 32;
  // Keep a 4:5 portrait where it fits under the top bar.
  const photoH = Math.min(photoW * 1.25, height - top - bottom - 120);

  return (
    <View style={[styles.fill, { paddingTop: top, paddingBottom: bottom }]}>
      <View style={styles.topBar}>
        <View {...close.props} style={styles.circle}>
          <Glass shape="circle" />
          <Pressable
            onPress={() => close.transition(() => set({ photo: null }), { preset: 'liquid', origin: 'source' })}
            accessibilityRole="button"
            accessibilityLabel={t.close}
            style={styles.hit}
          >
            <SymbolView name="xmark" size={18} weight="semibold" tintColor={c('label')} />
          </Pressable>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.barTitle}>{t.photoDate}</Text>
          <Text style={styles.barSubtitle}>9:41 AM</Text>
        </View>
        <View style={styles.circle} />
      </View>

      <View style={styles.photoArea}>
        <View
          style={[
            styles.photo,
            { width: photoW, height: photoH, experimental_backgroundImage: p.css, transform: p.flip ? [{ scaleX: -1 }] : undefined },
          ]}
        />
      </View>
      <ThemeButton />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c('systemBackground') },
  content: { paddingBottom: 120 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 34, fontWeight: '700', color: c('label') },
  subtitle: { fontSize: 15, color: c('secondaryLabel'), marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  duration: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 3,
  },
  unflip: { transform: [{ scaleX: -1 }] },
  heart: { position: 'absolute', left: 6, bottom: 6, width: 14, height: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 48 },
  circle: { width: 44, height: 44, borderRadius: 22 },
  hit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { alignItems: 'center' },
  barTitle: { fontSize: 17, fontWeight: '600', color: c('label') },
  barSubtitle: { fontSize: 12, color: c('secondaryLabel') },
  photoArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photo: { borderRadius: 4, overflow: 'hidden' },
});
