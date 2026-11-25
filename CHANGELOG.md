# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-25

### Added

- Native sheets and modals join the sweep, with nothing to wrap: when the provider fills the window, the glass covers the whole window (a presented `formSheet` or `Modal` and the screen behind it, as one sweep from a control tapped in the sheet). Needs `react-native-screens` (a new optional peer) and the library's small iOS native module (Expo autolinking; rebuild the app after updating). Without them, the glass covers the provider's view, as before.

### Fixed

- Origins inside a native sheet (`source`, `touch`, `live`): React Native measures a presented sheet from its own top, so the glass started in the wrong place. Views are now measured where UIKit shows them.

## [0.1.3] - 2026-11-25

### Fixed

- The sweep's first frame no longer stutters: the finished screen's image is uploaded before the glass moves.
- A live control's shadow (and anything else just around it) is no longer cut off in the frozen frames.

## [0.1.2] - 2026-11-25

### Changed

- README: API table headers.

## [0.1.1] - 2026-11-25

### Changed

- Published from GitHub Actions through npm trusted publishing, with provenance.
- README: what the library does, at a glance, with a link to the site.

## [0.1.0] - 2026-11-25

Initial release.

### Added

- `GlassTransitionProvider`: reveals any state change with a refracting glass lens sweeping across the subtree (Skia runtime shader over before/after snapshots).
- `useGlassTransition`, `useGlassSource` (keeps the triggering control live and snapshots on touch-down) and `useGlassScrub` (gesture-driven, commit or cancel).
- Presets `subtle`, `glass`, `liquid`, `prism`; per-call `origin`, `preset`, `config` overrides; origins `auto`, `touch`, `source`, `top`, `center`, `bottom` or a window point.
- Touches are blocked app-wide while any transition runs (from the first snapshot to the last frame, drags included), so nothing scrolls under the frozen frame.
- Status bar style follows the glass; Reduce Motion and non-iOS platforms apply changes instantly.
- Optional haptics via `expo-haptics`.
- Dev tuner (`react-native-glass-transitions/tuner`) built on `@expo/ui`, with "Copy config".

[0.2.0]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/releases/tag/v0.1.0
