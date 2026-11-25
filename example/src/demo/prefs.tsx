import { createContext, useContext } from 'react';
import { DynamicColorIOS } from 'react-native';

export type Lang = 'en' | 'ja' | 'es';

/** App-wide demo state. Every scenario is one `set(...)` inside a glass transition. */
export type PrefsState = {
  lang: Lang;
  /** Bought "Glass Pro" on Now Playing. */
  pro: boolean;
  /** Wallet amounts masked. */
  hidden: boolean;
  /** Photo open in the viewer (index into the library), or null. */
  photo: number | null;
};
export const initialPrefs: PrefsState = { lang: 'en', pro: false, hidden: false, photo: null };

export const Prefs = createContext<PrefsState & { set: (p: Partial<PrefsState>) => void }>({ ...initialPrefs, set: () => {} });
export const usePrefs = () => useContext(Prefs);

// The app tint. Blue is a touch brighter in dark so it holds up on colorful backgrounds (tab bar over Weather).
export const TINT = DynamicColorIOS({ light: '#0A7AFF', dark: '#4BA8FF' });

/** Premium gold, for everything Pro. */
export const GOLD = DynamicColorIOS({ light: '#A87A1F', dark: '#E8C46A' });

export const languages: { code: Lang; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'es', name: 'Español' },
];

// A tiny string table: no i18n library, just one object per language.
const en = {
  tabs: { weather: 'Weather', music: 'Music', photos: 'Photos', wallet: 'Wallet', settings: 'Settings' },
  // Weather
  myLocation: 'MY LOCATION',
  city: 'Cupertino',
  mostlySunny: 'Mostly Sunny',
  clear: 'Clear',
  hiLo: (hi: number, lo: number) => `H:${hi}°  L:${lo}°`,
  forecast: '10-DAY FORECAST',
  summaryDay: 'Sunny conditions will continue all day. Wind gusts are up to 9 mph.',
  summaryNight: 'Clear conditions tonight, continuing through the morning.',
  now: 'Now',
  today: 'Today',
  sunset: 'Sunset',
  sunrise: 'Sunrise',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  // Music
  nowPlaying: 'Now Playing',
  upgrade: 'Upgrade to Lossless',
  upgradeSub: 'Glass Pro · 1 month free',
  unlocked: 'Lossless Unlocked',
  unlockedSub: 'Glass Pro · Active',
  lossless: 'Lossless',
  // Photos
  library: 'Library',
  libraryCount: '1,284 Photos, 96 Videos',
  photoDate: 'Today',
  close: 'Close',
  // Wallet
  wallet: 'Wallet',
  totalBalance: 'Total Balance',
  todayChange: (v: string) => `${v} today`,
  send: 'Send',
  request: 'Request',
  topUp: 'Top Up',
  more: 'More',
  recent: 'Recent Transactions',
  seeAll: 'See All',
  yesterday: 'Yesterday',
  cat: {
    food: 'Food & Drink',
    groceries: 'Groceries',
    income: 'Income',
    transport: 'Transport',
    subscriptions: 'Subscriptions',
    refund: 'Refund',
  },
  showBalance: 'Show balances',
  hideBalance: 'Hide balances',
  // Settings
  settings: 'Settings',
  account: 'Account, Pro & Purchases',
  appearance: 'Appearance',
  darkMode: 'Dark Mode',
  appearanceFooter: 'Flip the switch: the app changes appearance through the glass, and the switch stays live.',
  language: 'Language',
  languageFooter: 'Every screen switches language through the glass.',
  glassLab: 'Glass Lab',
  tuner: 'Glass Tuner',
  snapshot: 'Snapshot',
  renderer: 'Renderer',
  driver: 'Driver',
  labFooter: 'Pull down anywhere on this screen to drag the glass in yourself.',
};
type Strings = typeof en;

const ja: Strings = {
  tabs: { weather: '天気', music: 'ミュージック', photos: '写真', wallet: 'ウォレット', settings: '設定' },
  myLocation: '現在地',
  city: 'クパチーノ',
  mostlySunny: 'おおむね晴れ',
  clear: '快晴',
  hiLo: (hi, lo) => `最高:${hi}°  最低:${lo}°`,
  forecast: '10日間天気予報',
  summaryDay: '一日中晴れが続くでしょう。最大瞬間風速は 9 mph です。',
  summaryNight: '今夜は晴れ、朝まで続く見込みです。',
  now: '今',
  today: '今日',
  sunset: '日の入',
  sunrise: '日の出',
  days: ['月', '火', '水', '木', '金', '土', '日'],
  nowPlaying: '再生中',
  upgrade: 'ロスレスにアップグレード',
  upgradeSub: 'Glass Pro · 1か月無料',
  unlocked: 'ロスレス有効',
  unlockedSub: 'Glass Pro · 有効',
  lossless: 'ロスレス',
  library: 'ライブラリ',
  libraryCount: '写真 1,284 枚、ビデオ 96 本',
  photoDate: '今日',
  close: '閉じる',
  wallet: 'ウォレット',
  totalBalance: '残高合計',
  todayChange: (v) => `今日 ${v}`,
  send: '送金',
  request: '請求',
  topUp: '入金',
  more: 'その他',
  recent: '最近の取引',
  seeAll: 'すべて表示',
  yesterday: '昨日',
  cat: { food: '飲食', groceries: '食料品', income: '収入', transport: '交通', subscriptions: 'サブスクリプション', refund: '返金' },
  showBalance: '残高を表示',
  hideBalance: '残高を隠す',
  settings: '設定',
  account: 'アカウント、Pro、購入',
  appearance: '外観',
  darkMode: 'ダークモード',
  appearanceFooter: 'スイッチを切り替えると、ガラス越しに外観が変わります。スイッチはそのまま動き続けます。',
  language: '言語',
  languageFooter: 'すべての画面がガラス越しに切り替わります。',
  glassLab: 'Glass Lab',
  tuner: 'ガラスチューナー',
  snapshot: 'スナップショット',
  renderer: 'レンダラ',
  driver: 'ドライバ',
  labFooter: 'この画面のどこでも下に引くと、ガラスを自分で動かせます。',
};

const es: Strings = {
  tabs: { weather: 'Tiempo', music: 'Música', photos: 'Fotos', wallet: 'Cartera', settings: 'Ajustes' },
  myLocation: 'MI UBICACIÓN',
  city: 'Cupertino',
  mostlySunny: 'Mayormente soleado',
  clear: 'Despejado',
  hiLo: (hi, lo) => `Máx.:${hi}°  Mín.:${lo}°`,
  forecast: 'PRONÓSTICO DE 10 DÍAS',
  summaryDay: 'Seguirá soleado todo el día. Rachas de viento de hasta 9 mph.',
  summaryNight: 'Cielo despejado esta noche, hasta la mañana.',
  now: 'Ahora',
  today: 'Hoy',
  sunset: 'Atardecer',
  sunrise: 'Amanecer',
  days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  nowPlaying: 'Reproduciendo',
  upgrade: 'Mejorar a Lossless',
  upgradeSub: 'Glass Pro · 1 mes gratis',
  unlocked: 'Lossless activado',
  unlockedSub: 'Glass Pro · Activo',
  lossless: 'Lossless',
  library: 'Biblioteca',
  libraryCount: '1284 fotos, 96 vídeos',
  photoDate: 'Hoy',
  close: 'Cerrar',
  wallet: 'Cartera',
  totalBalance: 'Saldo total',
  todayChange: (v) => `${v} hoy`,
  send: 'Enviar',
  request: 'Solicitar',
  topUp: 'Recargar',
  more: 'Más',
  recent: 'Transacciones recientes',
  seeAll: 'Ver todo',
  yesterday: 'Ayer',
  cat: {
    food: 'Comida y bebida',
    groceries: 'Supermercado',
    income: 'Ingresos',
    transport: 'Transporte',
    subscriptions: 'Suscripciones',
    refund: 'Reembolso',
  },
  showBalance: 'Mostrar saldos',
  hideBalance: 'Ocultar saldos',
  settings: 'Ajustes',
  account: 'Cuenta, Pro y compras',
  appearance: 'Apariencia',
  darkMode: 'Modo oscuro',
  appearanceFooter: 'Activa el interruptor: la app cambia de apariencia a través del cristal, y el interruptor sigue activo.',
  language: 'Idioma',
  languageFooter: 'Todas las pantallas cambian de idioma a través del cristal.',
  glassLab: 'Glass Lab',
  tuner: 'Ajuste del cristal',
  snapshot: 'Captura',
  renderer: 'Renderizado',
  driver: 'Motor',
  labFooter: 'Desliza hacia abajo en esta pantalla para arrastrar el cristal tú mismo.',
};

const strings = { en, ja, es };
export const useT = () => strings[usePrefs().lang];
