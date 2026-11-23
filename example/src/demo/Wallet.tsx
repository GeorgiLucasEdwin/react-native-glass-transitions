import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useGlassSource } from 'react-native-glass-transitions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTourTarget } from '../tour/Tour';
import { TINT, usePrefs, useT } from './prefs';
import { Glass, ThemeButton, c } from './ui';

type Icon = SymbolViewProps['name'];
type Cat = keyof ReturnType<typeof useT>['cat'];

// [merchant, category, icon, icon background, amount, day (0 today, 1 yesterday, else "Nov n")]
const TRANSACTIONS: [string, Cat, Icon, string, number, number][] = [
  ['Blue Bottle Coffee', 'food', 'cup.and.saucer.fill', 'systemBrown', -6.5, 0],
  ['Market Hall', 'groceries', 'cart.fill', 'systemGreen', -84.12, 0],
  ['Acme Studio', 'income', 'building.2.fill', 'systemIndigo', 4250, 1],
  ['Caltrain', 'transport', 'tram.fill', 'systemBlue', -7.75, 1],
  ['Lumen Music', 'subscriptions', 'music.note', 'systemPink', -10.99, 20],
  ['Outdoor Supply', 'refund', 'arrow.uturn.backward', 'systemGray', 24, 19],
];

const money = (v: number, sign = false) =>
  `${sign ? (v < 0 ? '−' : '+') : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const DOTS = '••••';

export function Wallet() {
  const { hidden, set } = usePrefs();
  const t = useT();
  const { top } = useSafeAreaInsets();
  const eye = useGlassSource();
  const toggle = () => eye.transition(() => set({ hidden: !hidden }), { preset: 'subtle', origin: 'source' });
  useTourTarget('eye', eye.handle, toggle);
  const amount = (v: number, sign = false) => (hidden ? (sign && v > 0 ? `+$${DOTS}` : `$${DOTS}`) : money(v, sign));
  const day = (d: number) => (d === 0 ? t.today : d === 1 ? t.yesterday : `Nov ${d}`);

  return (
    <View style={styles.fill}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text style={styles.largeTitle}>{t.wallet}</Text>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardBrand}>Lumen</Text>
            <SymbolView name="wave.3.right" size={20} tintColor="rgba(255,255,255,0.9)" />
          </View>
          <View style={styles.cardChip} />
          <View style={styles.cardBottom}>
            <Text style={styles.cardNumber}>{hidden ? '•••• •••• •••• ••••' : '•••• 4821'}</Text>
            <Text style={styles.cardKind}>DEBIT</Text>
          </View>
        </View>

        <View style={styles.balance}>
          <Text style={styles.balanceLabel}>{t.totalBalance}</Text>
          <Text style={styles.balanceValue}>{hidden ? `$${DOTS}${DOTS}` : money(12480.56)}</Text>
          <Text style={[styles.change, hidden && { color: c('secondaryLabel') }]}>{t.todayChange(amount(320.18, true))}</Text>
        </View>

        <View style={styles.actions}>
          {(
            [
              ['arrow.up', t.send],
              ['arrow.down', t.request],
              ['plus', t.topUp],
              ['ellipsis', t.more],
            ] as [Icon, string][]
          ).map(([icon, label]) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.5 }]}
            >
              <View style={[styles.actionCircle, { backgroundColor: TINT }]}>
                <SymbolView name={icon} size={20} weight="semibold" tintColor="white" />
              </View>
              <Text style={styles.actionLabel} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.recent}</Text>
          <Text style={[styles.seeAll, { color: TINT }]}>{t.seeAll}</Text>
        </View>
        <View style={styles.group}>
          {TRANSACTIONS.map(([name, cat, icon, bg, value, d], i) => (
            <View key={name} style={styles.row}>
              <View style={[styles.txIcon, { backgroundColor: c(bg) }]}>
                <SymbolView name={icon} size={17} tintColor="white" />
              </View>
              <View style={[styles.rowContent, i < TRANSACTIONS.length - 1 && styles.separator]}>
                <View style={styles.flex}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {t.cat[cat]} · {day(d)}
                  </Text>
                </View>
                <Text style={[styles.amount, value > 0 && !hidden && { color: c('systemGreen') }]}>{amount(value, value > 0)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Eye: hides/shows every amount, swept from here. Sits left of the theme button. */}
      <View {...eye.props} style={[styles.eye, { top: top + 2 }]}>
        <Glass shape="circle" />
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={hidden ? t.showBalance : t.hideBalance}
          style={styles.hit}
        >
          <SymbolView name={hidden ? 'eye.slash' : 'eye'} size={19} tintColor={c('label')} />
        </Pressable>
      </View>
      <ThemeButton />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c('systemGroupedBackground') },
  flex: { flex: 1 },
  content: { paddingBottom: 120 },
  largeTitle: { fontSize: 34, fontWeight: '700', color: c('label'), marginHorizontal: 16, marginTop: 8, marginBottom: 16 },
  card: {
    marginHorizontal: 16,
    aspectRatio: 1.586,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 20,
    justifyContent: 'space-between',
    experimental_backgroundImage:
      'radial-gradient(circle at 85% 15%, rgba(255,214,170,0.55) 0%, rgba(255,214,170,0) 45%), linear-gradient(135deg, #1B2A6B 0%, #4B2C8F 45%, #B5487E 80%, #F08A6B 100%)',
    boxShadow: '0 12px 28px rgba(40, 30, 90, 0.28)',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { fontSize: 22, fontWeight: '700', color: 'white', letterSpacing: -0.3 },
  cardChip: {
    width: 44,
    height: 32,
    borderRadius: 6,
    experimental_backgroundImage: 'linear-gradient(135deg, #F3DFA2 0%, #C9A54E 50%, #F0D890 100%)',
  },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardNumber: { fontSize: 17, fontWeight: '600', color: 'white', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  cardKind: { fontSize: 15, fontWeight: '800', fontStyle: 'italic', color: 'rgba(255,255,255,0.9)', letterSpacing: 1 },
  balance: { alignItems: 'center', marginTop: 24, gap: 2 },
  balanceLabel: { fontSize: 15, color: c('secondaryLabel') },
  balanceValue: { fontSize: 40, fontWeight: '700', color: c('label'), fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  change: { fontSize: 15, fontWeight: '600', color: c('systemGreen') },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 28, marginTop: 24 },
  action: { width: 72, alignItems: 'center', gap: 6 },
  actionCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13, fontWeight: '500', color: c('label') },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginHorizontal: 32,
    marginTop: 28,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: c('label') },
  seeAll: { fontSize: 15 },
  group: {
    marginHorizontal: 16,
    borderRadius: 26,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: c('secondarySystemGroupedBackground'),
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, minHeight: 60 },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginLeft: 12, paddingRight: 16, gap: 8 },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c('separator') },
  merchant: { fontSize: 17, color: c('label') },
  meta: { fontSize: 13, color: c('secondaryLabel'), marginTop: 1 },
  amount: { fontSize: 17, fontWeight: '500', color: c('label'), fontVariant: ['tabular-nums'] },
  eye: { position: 'absolute', right: 68, width: 44, height: 44, borderRadius: 22 },
  hit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
