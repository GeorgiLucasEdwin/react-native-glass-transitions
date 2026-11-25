<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.svg">
    <img src=".github/assets/banner-light.svg" alt="Glass Transitions" width="840">
  </picture>
</p>

<p align="center"><b>Any state change, through a lens of glass.</b><br>A React Native library for iOS.</p>

<p align="center"><a href="https://georgilucasedwin.github.io/react-native-glass-transitions/">See it in action →</a></p>

## What it does

Flip a switch, and instead of the screen just changing, a lens of glass sweeps across it. The old screen bends, blurs and splits into color at the edge of the glass, and the new one settles in behind it.

It works for any state change, not just dark mode: unlocking Pro, switching language, revealing a balance, changing tabs. Wrap the change in `transition()` and the library does the rest: it snapshots the screen, applies your change, and draws the glass between the two with a Skia shader on the UI thread.

- **Night falls, day rises.** Going dark, the glass comes from the top; going light, from the bottom.
- **The control stays live.** The switch you tapped keeps animating through the sweep.
- **Drag it.** Let a gesture pull the glass across the screen, then commit or let go.
- **Four looks.** `subtle`, `glass`, `liquid`, `prism`, plus a tuner to dial in your own.
- **Native details.** Haptics, Reduce Motion, status bar handling, touches blocked mid-sweep.

## Install

```sh
npx expo install react-native-glass-transitions @shopify/react-native-skia react-native-reanimated react-native-worklets expo-haptics
```

iOS only for now. Needs an Expo dev build or bare React Native (not Expo Go) on the New Architecture.

## Use

Wrap your app once:

```tsx
import { GlassTransitionProvider } from 'react-native-glass-transitions';

export default function App() {
  return (
    <GlassTransitionProvider>
      <Root />
    </GlassTransitionProvider>
  );
}
```

Then route a change through the glass. Here, a dark mode switch:

```tsx
import { useGlassSource } from 'react-native-glass-transitions';

function DarkModeSwitch({ dark, setDark }: { dark: boolean; setDark: (v: boolean) => void }) {
  const [on, setOn] = useState(dark);
  const source = useGlassSource(); // keeps the switch live and starts from it
  return (
    <View {...source.props}>
      <Switch
        value={on}
        onValueChange={(v) => {
          setOn(v); // flip the switch now; the screen follows through the glass
          source.transition(() => setDark(v));
        }}
      />
    </View>
  );
}
```

Anything else works the same way:

```tsx
const { transition } = useGlassTransition();
transition(() => setTab('music'), { origin: 'touch' });
```

## API

| API                         | What it is                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `<GlassTransitionProvider>` | `preset`, `config`, `origin`, `haptics`, `backgroundColor`                                              |
| `useGlassTransition()`      | `transition(apply, { origin, live, preset, config })` resolves `'animated'`, `'instant'` or `'skipped'` |
| `useGlassSource()`          | `{ props, handle, transition }` for the control that triggers the change                                |
| `useGlassScrub()`           | `{ begin(apply, revert), target, update, end(commit) }` to drive the glass with a gesture               |
| `presets`                   | `subtle`, `glass` (default), `liquid`, `prism`                                                          |
| Origins                     | `auto`, `touch`, `source`, `top`, `center`, `bottom`, `{ x, y }`                                        |
| Tuner                       | `import { GlassTuner } from 'react-native-glass-transitions/tuner'` (dev builds)                        |

The [example app](example) shows every feature in a real app. See [CONTRIBUTING.md](CONTRIBUTING.md) to work on the library.

## License

MIT
