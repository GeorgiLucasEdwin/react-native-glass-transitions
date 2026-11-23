import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type ColorValue, type HostInstance } from 'react-native';
import { Canvas, Fill, Group, ImageShader, Shader, rect, rrect, type SkImage, type SkRuntimeEffect } from '@shopify/react-native-skia';
import { overrides, presets, resolveConfig, type GlassConfig, type GlassOrigin, type GlassPreset } from './config';
import { GlassContext, TunerContext, type GlassApi, type GlassTunerValue } from './context';
import type { Frame, Settings } from './engine/engine';
import { useGlassEngine } from './engine/native';
import { compileGlass } from './shader';

export type GlassTransitionProviderProps = {
  children: ReactNode;
  /** Starting look. Default `glass`. */
  preset?: GlassPreset;
  /** Overrides on top of the preset, e.g. pasted from the tuner's "Copy config". */
  config?: Partial<GlassConfig>;
  /** Default origin for every transition. Default `auto` (night falls, day rises). */
  origin?: GlassOrigin;
  /** Haptic taps at the start and end of a sweep. Default `true`. No-op without expo-haptics. Read when a transition starts. */
  haptics?: boolean;
  /**
   * Painted behind your app, inside the snapshots. Set it when your root has see-through areas (a
   * transparent root showing the window behind it): snapshots don't include the window, so those
   * areas would otherwise turn black under the glass. Default: none.
   */
  backgroundColor?: ColorValue;
};

/**
 * Wrap your app (or any subtree) once. Any state change you route through `useGlassTransition`,
 * `useGlassSource` or `useGlassScrub` is revealed by a glass lens sweeping across this subtree.
 * iOS only for now: elsewhere, with Reduce Motion on (checked when each transition starts), or if
 * the shader can't compile, changes apply instantly.
 */
export function GlassTransitionProvider({ children, preset = 'glass', config, origin = 'auto', haptics = true, backgroundColor }: GlassTransitionProviderProps) {
  const root = useRef<HostInstance>(null);
  // Compiling at mount keeps a shader failure out of rendering, and the first sweep from paying for it.
  const [effect] = useState(compileGlass);

  // The tuner can override what the props say, live; `reset` drops the overrides.
  const [tuned, setTuned] = useState<{ preset: GlassPreset | 'custom'; config: GlassConfig } | null>(null);
  const [tunedOrigin, setTunedOrigin] = useState<GlassOrigin | null>(null);
  const configKey = JSON.stringify(config ?? {});
  const fromProps = useMemo(() => resolveConfig(presets[preset], config), [preset, configKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = tuned?.config ?? fromProps;
  const activeOrigin = tunedOrigin ?? origin;
  const activePreset = tuned?.preset ?? (overrides(config) ? 'custom' : preset);

  // Runs read this at their start, so callers holding an old `transition` still get the current look.
  const settings = useRef<Settings>({ config: active, origin: activeOrigin, haptics });
  useLayoutEffect(() => {
    settings.current = { config: active, origin: activeOrigin, haptics };
  }, [active, activeOrigin, haptics]);

  const { engine, frame, busy, uniforms, target } = useGlassEngine(root, settings, effect !== null);
  const [glass] = useState<GlassApi>(() => ({ transition: engine.transition, scrub: engine.scrub, prepare: engine.prepare, target }));

  const tuner = useMemo<GlassTunerValue>(
    () => ({
      config: active,
      setConfig: (c) => setTuned({ preset: 'custom', config: resolveConfig(c) }),
      preset: activePreset,
      setPreset: (p) => setTuned({ preset: p, config: presets[p] }),
      origin: activeOrigin,
      setOrigin: setTunedOrigin,
      reset: () => {
        setTuned(null);
        setTunedOrigin(null);
      },
    }),
    [active, activePreset, activeOrigin],
  );

  return (
    <GlassContext.Provider value={glass}>
      <TunerContext.Provider value={tuner}>
        <View style={styles.fill}>
          <View
            ref={root}
            collapsable={false}
            style={[styles.fill, backgroundColor != null && { backgroundColor }]}
            onTouchStart={(e) => engine.touch(e.nativeEvent.pageX, e.nativeEvent.pageY)}
            onLayout={(e) => engine.resize(e.nativeEvent.layout.width, e.nativeEvent.layout.height)}
          >
            {children}
          </View>
          {frame && effect && <GlassOverlay frame={frame} effect={effect} uniforms={uniforms} />}
          {/* While any transition runs (from the first snapshot to the last frame, drags included), nothing
              underneath can be touched: no scrolling under the frozen frame. A drag already in progress keeps
              its touch, since touches stay with the view they began on. */}
          {busy && <View style={StyleSheet.absoluteFill} pointerEvents="auto" accessible={false} />}
        </View>
      </TunerContext.Provider>
    </GlassContext.Provider>
  );
}

type Uniforms = ReturnType<typeof useGlassEngine>['uniforms'];

/** The frozen snapshots and the glass, covering exactly the root. */
function GlassOverlay({ frame, effect, uniforms }: { frame: Frame<SkImage>; effect: SkRuntimeEffect; uniforms: Uniforms }) {
  const area = { x: 0, y: 0, width: frame.width, height: frame.height };
  const h = frame.hole;
  const glass = (
    <Fill>
      <Shader source={effect} uniforms={uniforms}>
        <ImageShader image={frame.from} fit="cover" rect={area} tx="mirror" ty="mirror" />
        <ImageShader image={frame.to} fit="cover" rect={area} tx="mirror" ty="mirror" />
      </Shader>
    </Fill>
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {h ? (
          // A pill-shaped hole keeps the live control (e.g. a Switch) animating on top.
          <Group clip={rrect(rect(h.x, h.y, h.width, h.height), h.height / 2, h.height / 2)} invertClip>
            {glass}
          </Group>
        ) : (
          glass
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
