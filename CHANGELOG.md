# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

Initial release.

### Added

- `GlassTransitionProvider`: reveals any state change with a refracting glass lens sweeping across the subtree (Skia runtime shader over before/after snapshots).
- `useGlassTransition`, `useGlassSource` (keeps the triggering control live and snapshots on touch-down) and `useGlassScrub` (gesture-driven, commit or cancel).
- Presets `subtle`, `glass`, `liquid`, `prism`; per-call `origin`, `preset`, `config` overrides; origins `auto`, `touch`, `source`, `top`, `center`, `bottom` or a window point.
- Touches are blocked app-wide while any transition runs (from the first snapshot to the last frame, drags included), so nothing scrolls under the frozen frame.
- Status bar style follows the glass; Reduce Motion and non-iOS platforms apply changes instantly.
- Optional haptics via `expo-haptics`.
- Dev tuner (`react-native-glass-transitions/tuner`) built on `@expo/ui`, with "Copy config".

[0.1.0]: https://github.com/GeorgiLucasEdwin/react-native-glass-transitions/releases/tag/v0.1.0
