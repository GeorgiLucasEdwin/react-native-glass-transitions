This repo is the npm package `react-native-glass-transitions` (iOS-only React Native library) plus an Expo example app and a marketing site.

## Layout

- `src/` — the library (published, along with the built `lib/`). Public entry points: `src/index.ts` (`react-native-glass-transitions`) and `src/tuner.ts` (`react-native-glass-transitions/tuner`, dev-only tuner on `@expo/ui`). Everything under `src/lib/**` is private implementation; export new public API only through the two entry points. No runtime dependencies, peers only (`expo-haptics`, `@expo/ui`, `expo-clipboard` are optional).
- `scripts/test.mjs` — test runner: runs `src/tests/*.test.ts` with `node:test` and Node's built-in TypeScript stripping (no jest, no native modules). The run state machine (`src/lib/engine/engine.ts`) is pure and tested through fake ports; the native adapter (`src/lib/engine/native.ts`) needs a device.
- `example/` — the Expo demo app (`App.tsx`; reference screens in `src/demo/`, with `Settings.tsx` as the canonical usage of every hook and the tuner; the scripted marketing tour in `src/tour/`), with its own `package.json` and `node_modules`. It does not install the package: `example/metro.config.js` resolves `react-native-glass-transitions` to `../src` (`source` export condition) and block-lists the root `node_modules`, so peers come only from `example/node_modules`. `example/tsconfig.json` maps the imports to `../src` too.
- `marketing/site/` — static landing page (not published). `media/` and `marketing/site/media/` hold large, git-ignored recordings.
- `.github/` — README assets, CI (`workflows/ci.yml`) and npm release (`workflows/release.yml`, trusted publishing on GitHub release).

## Commands

Root (library), Node 22 (`.nvmrc`):

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint .
npm run format        # prettier --write .   (format:check to verify)
npm test              # scripts/test.mjs
npm run build         # react-native-builder-bob -> lib/
npm run check         # all of the above; run before declaring a task done
npx publint --strict && npx attw --pack . --profile esm-only   # package shape (CI runs these)
```

Example (`cd example`):

```bash
npx expo run:ios          # build and launch the dev client (needed after native changes)
npm start                 # Metro only
npm run typecheck         # tsc --noEmit
npm run doctor            # expo-doctor
npx expo install <pkg>    # ALWAYS use instead of npm install for the example — resolves SDK-compatible versions
```

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo or React Native API (in `example/` or in the library's optional Expo peers):

1. Read the major version of the `expo` package in `example/package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Rules

- `example/ios/` is generated (Continuous Native Generation) and git-ignored. Never edit it by hand — configure native behavior in `example/app.json` and config plugins, then `npx expo run:ios` (or `npx expo prebuild --clean`).
- Expo Go can't run the example (Skia, Reanimated and Worklets need a development build).
- Keep `peerDependencies` floors in sync with the tested matrix in `CONTRIBUTING.md`.
