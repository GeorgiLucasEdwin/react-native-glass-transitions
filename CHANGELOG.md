# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-11-26

The native module changed: rebuild the app after updating.

### Changed

- Faster presets: `liquid` 700 (1200), `prism` 900 (1600), `glass` 1100 (2500).
- The glass aims a little past the farthest corner and leaves the screen at speed; the transition finishes (touches come back, the closing haptic plays) the moment it's gone, not after the easing's invisible tail.
- The sweep starts on the first snapshot that shows the change, so it starts about one snapshot sooner (tap to glass ~85–140 ms on an iPhone 15 Pro). A screen still painting is swapped in, and the glass re-aimed, while the glass is still coming in from off screen.
- No touch-down snapshot on a native control (a `Switch`, a slider) when the glass covers the window: it blocked the main thread while the control tracked the finger, and a quick tap could be dropped. Other sources (buttons, rows) keep the head start.
- Window snapshots go to the GPU with no copies (a shared pixel buffer Skia uses as a texture), and don't force pending screen updates, which could make running animations (a switch's knob) jump.

### Fixed

- Touches weren't blocked while a transition ran: the blocking view was flattened away.
- A hairline around a live control (e.g. a Switch) during the sweep.

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

[0.2.1]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/releases/tag/v0.1.0
