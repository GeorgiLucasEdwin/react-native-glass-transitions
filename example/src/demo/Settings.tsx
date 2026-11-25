import { useState, type ReactNode } from 'react';
import {
  Appearance,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useGlassScrub, useGlassSource, useGlassTransition, type GlassOrigin, type GlassSource } from 'react-native-glass-transitions';
import { GlassTuner, useGlassTuner } from 'react-native-glass-transitions/tuner';
import { useTourTarget } from '../tour/Tour';
import { GOLD, TINT, languages, usePrefs, useT, type Lang } from './prefs';
import { c, setScheme } from './ui';

/**
 * The reference screen, one library feature per section:
 * - Dark Mode: `useGlassSource` on a controlled Switch.
 * - Language: `useGlassTransition` from the touch point.
 * - Pull down anywhere: `useGlassScrub` driven by a pan gesture.
 * - Glass Lab: the dev-only `GlassTuner` and `useGlassTuner`.
 */
export function Settings() {
  const { height } = useWindowDimensions();
  const { lang, pro } = usePrefs();
  const t = useT();
  const darkSwitch = useGlassSource();
  const scrub = useGlassScrub();
  const tuner = useGlassTuner();
  const [tunerOpen, setTunerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const display = useGlassSource();
  useTourTarget('display', display.handle, () => setSheetOpen(true));

  // Pull down to drag the glass in from the top; let go past a third (or flick) to commit.
  // The finger drives `target` on the UI thread; only begin and end hop to JS.
  const beginPull = () => {
    const next = Appearance.getColorScheme() !== 'dark';
    scrub.begin(
      () => setScheme(next),
      () => setScheme(!next),
      { origin: 'top', live: darkSwitch.handle },
    );
  };
  const pull = usePanGesture({
    activeOffsetY: 15,
    failOffsetX: [-20, 20],
    onActivate: () => {
      'worklet';
      scheduleOnRN(beginPull);
    },
    onUpdate: (e) => {
      'worklet';
      scrub.target.set(e.translationY / (height * 0.75));
    },
    onDeactivate: (e) => {
      'worklet';
      scheduleOnRN(scrub.end, e.translationY > height / 3 || e.velocityY > 1000);
    },
  });

  return (
    <GestureDetector gesture={pull}>
      <View style={styles.fill}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
          <Text style={styles.largeTitle}>{t.settings}</Text>

          <View style={[styles.group, styles.account]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AM</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>Alex Morgan</Text>
              <Text style={styles.subtitle}>{t.account}</Text>
            </View>
            {pro && (
              <View style={[styles.proBadge, { borderColor: GOLD }]}>
                <Text style={[styles.proText, { color: GOLD }]}>PRO</Text>
              </View>
            )}
            <SymbolView name="chevron.right" size={14} weight="semibold" tintColor={c('tertiaryLabel')} />
          </View>

          <Section header={t.appearance} footer={t.appearanceFooter}>
            <Row icon="moon.fill" tint="systemIndigo" label={t.darkMode}>
              <View {...darkSwitch.props}>
                <DarkSwitch source={darkSwitch} />
              </View>
            </Row>
            <Pressable {...display.props} onPress={() => setSheetOpen(true)} accessibilityRole="button">
              {({ pressed }) => (
                <View style={pressed && styles.pressed}>
                  <Row icon="circle.lefthalf.filled" tint="systemGray" label={t.display} chevron last />
                </View>
              )}
            </Pressable>
          </Section>

          <Section header={t.language} footer={t.languageFooter}>
            {languages.map((l, i) => (
              <LanguageRow key={l.code} code={l.code} name={l.name} selected={l.code === lang} last={i === languages.length - 1} />
            ))}
          </Section>

          <Section header={t.glassLab} footer={t.labFooter}>
            <Pressable onPress={() => setTunerOpen(true)} accessibilityRole="button">
              {({ pressed }) => (
                <View style={pressed && styles.pressed}>
                  <Row icon="slider.horizontal.3" tint="systemBlue" label={t.tuner} value={tuner.preset} chevron />
                </View>
              )}
            </Pressable>
            <Row icon="camera.viewfinder" tint="systemTeal" label={t.snapshot} value="makeImageFromView" />
            <Row icon="cpu" tint="systemGreen" label={t.renderer} value="Skia · Metal" />
            <Row icon="waveform.path" tint="systemPink" label={t.driver} value="Reanimated" last />
          </Section>
        </ScrollView>
        <Modal visible={sheetOpen} presentationStyle="formSheet" animationType="slide" onRequestClose={() => setSheetOpen(false)}>
          <DisplaySheet onClose={() => setSheetOpen(false)} />
        </Modal>
        {__DEV__ && <GlassTuner open={tunerOpen} onOpenChange={setTunerOpen} />}
      </View>
    </GestureDetector>
  );
}

/**
 * `apply` runs a couple of frames after the tap, so the Switch keeps an optimistic local value
 * (a controlled Switch would snap back in between) and follows the scheme when it changes elsewhere.
 */
function DarkSwitch({ source }: { source: GlassSource }) {
  const dark = useColorScheme() === 'dark';
  const [on, setOn] = useState(dark);
  const [seen, setSeen] = useState(dark);
  if (seen !== dark) {
    setSeen(dark);
    setOn(dark);
  }
  return (
    <Switch
      value={on}
      trackColor={{ true: TINT }}
      onValueChange={(v) => {
        setOn(v);
        void source.transition(() => setScheme(v));
      }}
    />
  );
}

/** A native sheet: the glass sweeps it and the screen behind it as one, from the option tapped. */
function DisplaySheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  // The sheet's own copy: a presented sheet can hear about the new scheme a beat late.
  const [dark, setDark] = useState(useColorScheme() === 'dark');
  const pick = (next: boolean) => {
    setDark(next);
    setScheme(next);
  };
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetBar}>
        <Text style={styles.sheetTitle}>{t.display}</Text>
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.done}>{t.done}</Text>
        </Pressable>
      </View>
      <Section header={t.appearance}>
        <SchemeRow label={t.light} selected={!dark} pick={() => pick(false)} target="scheme:light" />
        <SchemeRow label={t.dark} selected={dark} pick={() => pick(true)} target="scheme:dark" last />
      </Section>
    </View>
  );
}

type SchemeRowProps = { label: string; selected: boolean; pick: () => void; target: string; last?: boolean };

/** Like a language row: the glass starts where the finger touched (or the tour's finger). */
function SchemeRow({ label, selected, pick, target, last }: SchemeRowProps) {
  const source = useGlassSource();
  const glass = useGlassTransition();
  const run = (at?: { x: number; y: number }) => !selected && glass.transition(pick, { origin: at ?? 'touch' });
  useTourTarget(target, source.handle, run);
  return (
    <Pressable {...source.props} onPress={() => run()} accessibilityRole="button" accessibilityState={{ selected }}>
      {({ pressed }) => (
        <View style={[styles.langRow, pressed && styles.pressed]}>
          <View style={[styles.rowContent, styles.langContent, !last && styles.separator]}>
            <Text style={styles.label}>{label}</Text>
            {selected && <SymbolView name="checkmark" size={17} weight="semibold" tintColor={TINT} />}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** The glass starts where the finger touched. The row is a source only for its touch-down snapshot (and the tour's finger). */
function LanguageRow({ code, name, selected, last }: { code: Lang; name: string; selected: boolean; last: boolean }) {
  const { set } = usePrefs();
  const glass = useGlassTransition();
  const source = useGlassSource();
  const pick = (origin: GlassOrigin = 'touch') => glass.transition(() => set({ lang: code }), { preset: 'glass', origin });
  useTourTarget(`lang:${code}`, source.handle, pick);
  return (
    <Pressable {...source.props} onPress={() => !selected && pick()} accessibilityRole="button" accessibilityState={{ selected }}>
      {({ pressed }) => (
        <View style={[styles.langRow, pressed && styles.pressed]}>
          <View style={[styles.rowContent, styles.langContent, !last && styles.separator]}>
            <Text style={styles.label}>{name}</Text>
            {selected && <SymbolView name="checkmark" size={17} weight="semibold" tintColor={TINT} />}
          </View>
        </View>
      )}
    </Pressable>
  );
}

function Section({ header, footer, children }: { header: string; footer?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{header.toUpperCase()}</Text>
      <View style={styles.group}>{children}</View>
      {footer && <Text style={styles.sectionFooter}>{footer}</Text>}
    </View>
  );
}

type RowProps = {
  icon: SymbolViewProps['name'];
  tint: string;
  label: string;
  value?: string;
  last?: boolean;
  chevron?: boolean;
  children?: ReactNode;
};

function Row({ icon, tint, label, value, last, chevron, children }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconBox, { backgroundColor: c(tint) }]}>
        <SymbolView name={icon} size={17} tintColor="white" />
      </View>
      <View style={[styles.rowContent, !last && styles.separator]}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {value && <Text style={styles.value}>{value}</Text>}
        {children}
        {chevron && <SymbolView name="chevron.right" size={14} weight="semibold" tintColor={c('tertiaryLabel')} />}
      </View>
    </View>
  );
}

// Sizes follow HIG defaults: 34pt large title, 17pt body, 13pt footnote, 44pt+ rows, 16pt insets.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: c('systemGroupedBackground') },
  content: { paddingBottom: 120 },
  largeTitle: { fontSize: 34, fontWeight: '700', color: c('label'), marginHorizontal: 16, marginTop: 8, marginBottom: 12 },
  account: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingRight: 16 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(135deg, #8E9EFF 0%, #6C5CE7 50%, #C86DD7 100%)',
  },
  avatarText: { fontSize: 24, fontWeight: '600', color: 'white' },
  name: { fontSize: 22, fontWeight: '600', color: c('label') },
  subtitle: { fontSize: 13, color: c('secondaryLabel'), marginTop: 2 },
  proBadge: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  proText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  section: { marginTop: 28, marginHorizontal: 16 },
  sectionHeader: { fontSize: 13, color: c('secondaryLabel'), marginHorizontal: 16, marginBottom: 6 },
  sectionFooter: { fontSize: 13, color: c('secondaryLabel'), marginHorizontal: 16, marginTop: 6 },
  group: { borderRadius: 26, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: c('secondarySystemGroupedBackground') },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, minHeight: 52 },
  langRow: { paddingLeft: 16, minHeight: 52, flexDirection: 'row' },
  langContent: { marginLeft: 0 },
  pressed: { backgroundColor: c('systemFill') },
  iconBox: { width: 30, height: 30, borderRadius: 8, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginLeft: 12, paddingRight: 16, gap: 8 },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c('separator') },
  label: { flex: 1, fontSize: 17, color: c('label') },
  value: { fontSize: 17, color: c('secondaryLabel') },
  sheet: { flex: 1, backgroundColor: c('systemGroupedBackground') },
  sheetBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20 },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: c('label') },
  done: { fontSize: 17, fontWeight: '600', color: TINT },
});
