# Contributing

Issues and pull requests are welcome. For anything larger than a small fix, open an issue first so we can agree on the approach.

## Setup

You need Node 22 (see `.nvmrc`), and Xcode with an iOS 26 simulator to run the example app.

```sh
git clone https://github.com/GeorgiLucasEdwin/react-native-glass-transitions.git
cd react-native-glass-transitions
npm install                 # library devDependencies; also builds lib/ via `prepare`

cd example
npm install
npx expo run:ios            # builds and launches the dev client
```

After the first native build, `npm start` in `example/` (or `npm run example` at the root) starts Metro on its own.

## How the example uses the library

The example app does not install the package. `example/metro.config.js` maps `react-native-glass-transitions` to the repo root and resolves it with the `source` export condition, so imports land in `../src` and edits hot-reload without a build. The root `node_modules` is block-listed, so `react`, `react-native`, Reanimated, Worklets and Skia come from `example/node_modules` only and are bundled once. `example/tsconfig.json` maps the same imports to `../src` for type checking.

## Checks

```sh
npm run check               # typecheck, lint, format:check, test, build
npm run format              # prettier --write
cd example && npm run typecheck && npm run doctor
```

CI runs the same, plus `npx publint --strict` and `npx attw --pack . --profile esm-only`.

There are no native-module tests. Before a PR that changes rendering, snapshotting or gestures, run the example on a simulator or a device and try the demos it touches.

## Tested matrix

Releases are tested against:

| Package                    | Version |
| -------------------------- | ------- |
| iOS                        | 26      |
| React Native               | 0.88    |
| Expo SDK                   | 58      |
| react-native-reanimated    | 4.7     |
| react-native-worklets      | 0.13    |
| @shopify/react-native-skia | 2.14    |

The peer dependency floors in `package.json` match this matrix. Raise them when the matrix moves.

## Releasing

Publishing runs in GitHub Actions (`.github/workflows/release.yml`) through npm trusted publishing, so no npm token is stored and every release carries provenance.

One-time setup: on npmjs.com, add a trusted publisher for this package with repository `GeorgiLucasEdwin/react-native-glass-transitions` and workflow `release.yml`.

For each release:

1. Bump `version` in `package.json` (`npm version <patch|minor|major> --no-git-tag-version`).
2. In `CHANGELOG.md`, move the `Unreleased` entries under the new version with today's date and update the compare links.
3. Commit, push to `main` and wait for CI to pass.
4. Create a GitHub release with tag `v<version>` (e.g. `v0.1.0`). Publishing it triggers the workflow, which checks that the tag matches `package.json`, runs `npm run check` and publishes.
