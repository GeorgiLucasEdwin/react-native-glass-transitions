import { ScrollView, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useT } from './prefs';
import { ThemeButton } from './ui';

type Icon = SymbolViewProps['name'];

// The same place, at two times of day. Weather keeps white text on both skies, like Apple's app.
const DAY = {
  sky: 'linear-gradient(180deg, #2C6FC9 0%, #4A93E4 38%, #8CC3F2 78%, #BFE0F8 100%)',
  glow: 'radial-gradient(circle at 82% 4%, rgba(255, 244, 196, 0.95) 0%, rgba(255, 222, 140, 0.35) 18%, rgba(255, 222, 140, 0) 42%)',
  card: 'rgba(255, 255, 255, 0.18)',
  temp: 72,
  condition: 'mostlySunny' as const,
  summary: 'summaryDay' as const,
  hi: 76,
  lo: 58,
  hours: [
    ['Now', 'sun.max.fill', 72],
    ['11AM', 'sun.max.fill', 73],
    ['12PM', 'cloud.sun.fill', 75],
    ['1PM', 'cloud.sun.fill', 76],
    ['2PM', 'sun.max.fill', 76],
    ['3PM', 'sun.max.fill', 75],
    ['4PM', 'sun.max.fill', 73],
    ['5PM', 'cloud.sun.fill', 70],
    ['6:48PM', 'sunset.fill', 'sunset'],
  ] as [string, Icon, number | string][],
};

const NIGHT = {
  sky: 'linear-gradient(180deg, #03050F 0%, #0A1230 40%, #1C1F4A 75%, #3A2A5C 100%)',
  glow: 'radial-gradient(circle at 14% 8.5%, rgba(214, 226, 255, 0.35) 0%, rgba(140, 160, 255, 0.10) 16%, rgba(140, 160, 255, 0) 36%)',
  card: 'rgba(120, 140, 220, 0.14)',
  temp: 61,
  condition: 'clear' as const,
  summary: 'summaryNight' as const,
  hi: 76,
  lo: 54,
  hours: [
    ['Now', 'moon.stars.fill', 61],
    ['10PM', 'moon.stars.fill', 59],
    ['11PM', 'moon.fill', 58],
    ['12AM', 'cloud.moon.fill', 57],
    ['1AM', 'cloud.moon.fill', 56],
    ['2AM', 'moon.stars.fill', 55],
    ['3AM', 'moon.stars.fill', 55],
    ['4AM', 'moon.fill', 54],
    ['6:41AM', 'sunrise.fill', 'sunrise'],
  ] as [string, Icon, number | string][],
};

// [day of week (0 = Mon; -1 = Today), icon, low, high]
const WEEK: [number, Icon, number, number][] = [
  [-1, 'sun.max.fill', 54, 76],
  [0, 'cloud.sun.fill', 55, 74],
  [1, 'cloud.fill', 53, 68],
  [2, 'cloud.drizzle.fill', 51, 63],
  [3, 'cloud.rain.fill', 50, 61],
  [4, 'cloud.sun.fill', 52, 67],
  [5, 'sun.max.fill', 55, 73],
  [6, 'sun.max.fill', 57, 78],
  [0, 'sun.max.fill', 58, 80],
  [1, 'cloud.sun.fill', 56, 75],
];
const MIN = 48;
const MAX = 82;

// Deterministic star field (same sky every launch).
const STARS = Array.from({ length: 90 }, (_, i) => {
  const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  return { x: r(1), y: Math.pow(r(2), 1.4) * 0.72, size: 1 + r(3) * (r(4) > 0.9 ? 2.2 : 1.2), opacity: 0.35 + r(5) * 0.65 };
});

export function Weather() {
  const dark = useColorScheme() === 'dark';
  const { width, height } = useWindowDimensions();
  const d = dark ? NIGHT : DAY;
  const t = useT();
  return (
    <View style={styles.fill}>
      <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: d.sky }]} />
      {dark &&
        STARS.map((s, i) => (
          <View
            key={i}
            style={[
              styles.star,
              { left: s.x * width, top: s.y * height, width: s.size, height: s.size, borderRadius: s.size, opacity: s.opacity },
            ]}
          />
        ))}
      <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: d.glow }]} />
      {dark && <View style={[styles.moon, { left: width * 0.14 - 22, top: height * 0.085 - 22 }]} />}

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.myLocation}>{t.myLocation}</Text>
          <Text style={styles.city}>{t.city}</Text>
          <Text style={styles.temp}>{d.temp}°</Text>
          <Text style={styles.condition}>{t[d.condition]}</Text>
          <Text style={styles.condition}>{t.hiLo(d.hi, d.lo)}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: d.card }]}>
          <Text style={styles.summary}>{t[d.summary]}</Text>
          <View style={styles.rule} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hours}>
            {d.hours.map(([time, icon, temp], i) => (
              <View key={time} style={styles.hour}>
                <Text style={styles.hourTime}>{i === 0 ? t.now : time}</Text>
                <SymbolView name={icon} type="multicolor" size={26} style={styles.hourIcon} />
                <Text style={[styles.hourTemp, typeof temp === 'string' && styles.hourWord, i === 0 && styles.bold]}>
                  {typeof temp === 'number' ? `${temp}°` : t[temp as 'sunset' | 'sunrise']}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.card, { backgroundColor: d.card }]}>
          <View style={styles.cardHeader}>
            <SymbolView name="calendar" size={13} tintColor="rgba(255,255,255,0.6)" />
            <Text style={styles.cardTitle}>{t.forecast}</Text>
          </View>
          {WEEK.map(([day, icon, lo, hi], i) => (
            <View key={i} style={[styles.dayRow, i > 0 && styles.dayRule]}>
              <Text style={styles.dayName} numberOfLines={1} adjustsFontSizeToFit>
                {day < 0 ? t.today : t.days[day]}
              </Text>
              <SymbolView name={icon} type="multicolor" size={24} style={styles.dayIcon} />
              <Text style={styles.dayLo}>{lo}°</Text>
              <View style={styles.track}>
                <View
                  style={[styles.range, { left: `${((lo - MIN) / (MAX - MIN)) * 100}%`, right: `${((MAX - hi) / (MAX - MIN)) * 100}%` }]}
                />
                {i === 0 && <View style={[styles.now, { left: `${((d.temp - MIN) / (MAX - MIN)) * 100}%` }]} />}
              </View>
              <Text style={styles.dayHi}>{hi}°</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <ThemeButton />
    </View>
  );
}

const white = 'white';
const dim = 'rgba(255, 255, 255, 0.62)';
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0A1230' },
  star: { position: 'absolute', backgroundColor: white },
  moon: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    experimental_backgroundImage: 'radial-gradient(circle at 35% 35%, #FFFFFF 0%, #E6ECFF 45%, #B8C2E8 100%)',
    boxShadow: '0 0 30px 6px rgba(200, 215, 255, 0.45)',
  },
  content: { paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
  header: { alignItems: 'center', paddingTop: 28, paddingBottom: 36 },
  myLocation: { fontSize: 13, fontWeight: '600', color: white, letterSpacing: 0.4 },
  city: { fontSize: 34, color: white, marginTop: 2 },
  temp: { fontSize: 96, fontWeight: '200', color: white, lineHeight: 104, marginLeft: 24 },
  condition: { fontSize: 20, fontWeight: '500', color: white },
  card: { borderRadius: 22, borderCurve: 'continuous', paddingVertical: 12 },
  summary: { fontSize: 15, color: white, paddingHorizontal: 16 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 16, marginVertical: 10 },
  hours: { paddingHorizontal: 8 },
  hour: { width: 60, alignItems: 'center', gap: 10, paddingVertical: 2 },
  hourTime: { fontSize: 15, fontWeight: '600', color: white },
  hourIcon: { width: 30, height: 28 },
  hourTemp: { fontSize: 20, fontWeight: '500', color: white },
  hourWord: { fontSize: 13, textAlign: 'center', fontWeight: '600', marginTop: 5 },
  bold: { fontWeight: '600' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: dim },
  dayRow: { flexDirection: 'row', alignItems: 'center', height: 48, marginHorizontal: 16 },
  dayRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.3)' },
  dayName: { width: 64, fontSize: 20, fontWeight: '500', color: white },
  dayIcon: { width: 32, height: 26 },
  dayLo: { width: 48, textAlign: 'right', fontSize: 20, fontWeight: '500', color: dim },
  track: { flex: 1, height: 5, borderRadius: 3, marginHorizontal: 12, backgroundColor: 'rgba(0,0,0,0.18)' },
  range: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 3,
    experimental_backgroundImage: 'linear-gradient(90deg, #8EDCF0 0%, #C9E36A 45%, #F7C948 75%, #F79A3E 100%)',
  },
  now: {
    position: 'absolute',
    top: -1.5,
    width: 8,
    height: 8,
    marginLeft: -4,
    borderRadius: 4,
    backgroundColor: white,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  dayHi: { width: 40, textAlign: 'right', fontSize: 20, fontWeight: '500', color: white },
});
