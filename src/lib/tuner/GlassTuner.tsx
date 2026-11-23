import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { BottomSheet, Button, Form, Group, HStack, Host, Picker, Section, Slider, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  labelStyle,
  monospacedDigit,
  pickerStyle,
  presentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import * as Clipboard from 'expo-clipboard';
import { presets, type GlassConfig, type GlassOrigin, type GlassPreset } from '../config';
import { hapticSuccess } from '../haptics';
import { controls } from './controls';
import { useGlassTuner } from './useGlassTuner';

type Key = keyof GlassConfig;

// At most three rows per tab, so the sheet never has to grow or scroll.
const tabs: Record<string, Key[]> = {
  Preset: [],
  Glass: ['band', 'refraction', 'blur'],
  Color: ['disperse', 'fringe', 'mood'],
  Light: ['spec', 'fresnel', 'shadow'],
  Motion: ['duration', 'settle'],
};
const origins = ['auto', 'touch', 'source', 'top', 'center', 'bottom'] as const;
const SHEET = { fraction: 0.5 } as const; // half height: the screen above stays visible and usable

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const format = (k: Key, v: number) => {
  if (k === 'duration') return `${Math.round(v)} ms`;
  const step = controls[k].step;
  return v.toFixed(step < 0.05 ? 3 : step < 1 ? 2 : 0);
};
const round = (v: number) => Math.round(v * 1000) / 1000;

/** The props to paste into <GlassTransitionProvider> to ship the current look. */
function snippet(preset: string, config: GlassConfig, origin: GlassOrigin) {
  const base = preset !== 'custom' ? presets[preset as GlassPreset] : null;
  const changed = Object.entries(config).filter(([k, v]) => !base || round(base[k as Key]) !== round(v));
  const lines = [
    base ? `preset="${preset}"` : null,
    changed.length ? `config={{ ${changed.map(([k, v]) => `${k}: ${round(v)}`).join(', ')} }}` : null,
    origin !== 'auto' && typeof origin === 'string' ? `origin="${origin}"` : null,
  ].filter(Boolean);
  return `<GlassTransitionProvider ${lines.join(' ')}>`;
}

export type GlassTunerProps = {
  /** Whether the sheet is presented. */
  open: boolean;
  /** The sheet was dismissed (or presented) by the user. */
  onOpenChange: (open: boolean) => void;
};

/**
 * Dev tool: a native sheet with live sliders for every glass setting.
 * Tune in your own app, tap Copy, paste the props into your provider.
 */
export function GlassTuner({ open, onOpenChange }: GlassTunerProps) {
  const glass = useGlassTuner();
  const [tab, setTab] = useState('Glass');

  const copy = () =>
    Clipboard.setStringAsync(snippet(glass.preset, glass.config, glass.origin)).then(hapticSuccess, () => {});

  return (
    <Host style={styles.host}>
      <BottomSheet isPresented={open} onIsPresentedChange={onOpenChange}>
        <Group
          modifiers={[
            presentationDetents([SHEET]),
            presentationBackgroundInteraction({ type: 'enabledUpThrough', detent: SHEET }),
            presentationDragIndicator('visible'),
          ]}
        >
          <Form>
            <Section footer={<Text>Changes apply live. Copy puts the provider props on your clipboard.</Text>}>
              <HStack spacing={12}>
                <Picker selection={tab} onSelectionChange={setTab} modifiers={[pickerStyle('segmented')]}>
                  {Object.keys(tabs).map((t) => (
                    <Text key={t} modifiers={[tag(t)]}>
                      {t}
                    </Text>
                  ))}
                </Picker>
                <Button systemImage="doc.on.doc" label="Copy Config" onPress={copy} modifiers={[labelStyle('iconOnly')]} />
              </HStack>

              {tab === 'Preset' && (
                <Picker
                  selection={glass.preset}
                  onSelectionChange={(p: string) => p !== 'custom' && glass.setPreset(p as GlassPreset)}
                  modifiers={[pickerStyle('inline')]}
                >
                  {[...Object.keys(presets), ...(glass.preset === 'custom' ? ['custom'] : [])].map((p) => (
                    <Text key={p} modifiers={[tag(p)]}>
                      {title(p)}
                    </Text>
                  ))}
                </Picker>
              )}

              {tab === 'Motion' && (
                <Picker
                  label="Origin"
                  selection={typeof glass.origin === 'string' ? glass.origin : 'auto'}
                  onSelectionChange={(o: string) => glass.setOrigin(o as GlassOrigin)}
                >
                  {origins.map((o) => (
                    <Text key={o} modifiers={[tag(o)]}>
                      {title(o)}
                    </Text>
                  ))}
                </Picker>
              )}

              {(tabs[tab] ?? []).map((k) => {
                const c = controls[k];
                return (
                  <VStack key={k} alignment="leading" spacing={6}>
                    <HStack>
                      <Text>{c.label}</Text>
                      <Spacer />
                      <Text modifiers={[monospacedDigit(), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                        {format(k, glass.config[k])}
                      </Text>
                    </HStack>
                    <Slider
                      value={glass.config[k]}
                      min={c.min}
                      max={c.max}
                      step={c.step}
                      onValueChange={(v) => glass.setConfig({ ...glass.config, [k]: v })}
                    />
                  </VStack>
                );
              })}
            </Section>
          </Form>
        </Group>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', width: 0, height: 0 },
});
