import { useState, type Dispatch, type SetStateAction } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlassTransitionProvider } from 'react-native-glass-transitions';
import { NowPlaying } from './src/demo/NowPlaying';
import { Photos } from './src/demo/Photos';
import { Settings } from './src/demo/Settings';
import { Wallet } from './src/demo/Wallet';
import { Weather } from './src/demo/Weather';
import { Prefs, initialPrefs, type PrefsState } from './src/demo/prefs';
import { TabBar, c, type Tab } from './src/demo/ui';
import { TourOverlay, idleTour, useTour, type TourUI } from './src/tour/Tour';

export default function App() {
  const [tour, setTour] = useState<TourUI>(idleTour);
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <GlassTransitionProvider backgroundColor={c('systemBackground')}>
          <Main setTour={setTour} />
        </GlassTransitionProvider>
        <TourOverlay ui={tour} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Main({ setTour }: { setTour: Dispatch<SetStateAction<TourUI>> }) {
  const [tab, setTab] = useState<Tab>('weather');
  const [prefs, setPrefs] = useState<PrefsState>(initialPrefs);
  const set = (p: Partial<PrefsState>) => setPrefs((s) => ({ ...s, ...p }));
  // Long-press any tab to play the tour.
  const tour = useTour(setTour, { setTab, setPrefs: set });

  if (tour.endCard) return tour.endCard;
  return (
    <Prefs.Provider value={{ ...prefs, set }}>
      <View style={styles.fill}>
        {tab === 'weather' && <Weather />}
        {tab === 'music' && <NowPlaying />}
        {tab === 'photos' && <Photos />}
        {tab === 'wallet' && <Wallet />}
        {tab === 'settings' && <Settings />}
        {/* The photo viewer is full screen, like Photos: no tab bar. */}
        {!(tab === 'photos' && prefs.photo !== null) && <TabBar tab={tab} onChange={setTab} onLongPress={tour.play} />}
      </View>
    </Prefs.Provider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
