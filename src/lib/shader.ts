import { Skia, type SkRuntimeEffect } from '@shopify/react-native-skia';

declare const __DEV__: boolean;

/**
 * Color warp, A/B switch. false: each defocus tap samples red, green and blue separately (3 picks a
 * tap). true: each tap samples one wavelength along the warp and weighs it into R/G/B (1 pick a tap,
 * 8 taps): smoother rainbow, about a third of the texture reads under the glass.
 */
const SPECTRAL = true;

// Defocus, averaged over a small golden-angle spiral. `jitter` spins it per pixel: grain, not ghosting.
const standard = `
  } else if (blur <= 0.01) {
    c = tap(p - off, ca);                 // no defocus: every tap would land on the same spot
  } else {
    int taps = blur < 4.0 ? 4 : 8;
    float jitter = noise(p) * 6.2832;
    c = float3(0.0);
    for (int i = 0; i < 8; i++) {
      if (i >= taps) break;
      float fi = float(i);
      float a = fi * 2.39996 + jitter;
      c += tap(p - off + float2(cos(a), sin(a)) * sqrt((fi + 0.5) / float(taps)) * blur * ring, ca);
    }
    c /= float(taps);
  }`;

// One pick per tap: tap i samples wavelength s (red bends least, blue most) at a spiral spot.
const spectral = `
  } else if (blur <= 0.01 && disperse <= 0.0 && fringe <= 0.0) {
    c = pick(p - off).rgb;
  } else {
    float jitter = noise(p) * 6.2832;
    float3 sum = float3(0.0);
    float3 weight = float3(0.0);
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float s = (fi + 0.5) / 4.0 - 1.0;               // -0.875 (red) .. 0.875 (blue)
      float fj = mod(fi * 3.0, 8.0);                  // spiral spot, decorrelated from wavelength
      float a = fj * 2.39996 + jitter;
      float2 q = p - off + float2(cos(a), sin(a)) * sqrt((fj + 0.5) / 8.0) * blur * ring + ca * s;
      float3 w = clamp(1.0 - abs(s - float3(-0.66, 0.0, 0.66)) * 1.5, 0.0, 1.0);
      sum += pick(q).rgb * w;
      weight += w;
    }
    c = sum / weight;
  }`;

// SkSL runs once per pixel. A glass ring grows from `center`, refracting the old screen (`from`) into
// the new one (`to`). Per-frame values that don't vary per pixel come precomputed (see native.ts).
const source = `
uniform shader from;
uniform shader to;
uniform float2 center;
uniform float radius;         // ring radius (pt); far negative before the sweep starts
uniform float4 hole;          // live control's rect (x, y, w, h); erased from both snapshots

uniform float band;           // glass thickness (pt)
uniform float refraction;     // how much the glass bends what's behind it
uniform float disperse;       // color warping: red and blue bend different amounts
uniform float fringe;         // extra red/blue split across the whole glass (pt)
uniform float blur;           // defocus under the glass (pt)
uniform float spec;           // highlight strength
uniform float fresnel;        // soft bright edge
uniform float shadow;         // soft shadow just ahead of the glass
uniform float mood;           // >0 heading darker (smoky, cool), <0 heading lighter (bright, warm)
uniform float settleNow;      // how magnified the new screen still is behind the glass
uniform float3 light;         // highlight half vector
uniform float3 tint;          // highlight color

const float BEVEL = 1.25;     // surface steepness: higher = sharper highlight

// Interleaved gradient noise: cheap, well spread per-pixel jitter.
float noise(float2 p) { return fract(52.9829189 * fract(dot(p, float2(0.06711056, 0.00583715)))); }

// The live control shows through a hole in the overlay, so its frozen copy in the snapshots
// must never appear (refraction or settle could shift it into view). Inside the hole's pill (the
// same shape the overlay cuts, plus antialiasing), sample the row background just left of it
// instead. Only the pill: whatever is around the control (its shadow) stays as it is.
float2 erase(float2 q) {
  float r = hole.w * 0.5;
  float2 k = abs(q - (hole.xy + hole.zw * 0.5)) - (hole.zw * 0.5 - r);
  float edge = length(max(k, 0.0)) + min(max(k.x, k.y), 0.0) - r;
  return edge < 1.5 ? float2(hole.x - 7.0, q.y) : q;
}

// Screen behind the glass at q, so the boundary itself is refracted.
float4 pick(float2 q) {
  float2 d = q - center;
  float k = length(d) - radius;
  if (k > 1.5) return from.eval(erase(q));
  float s = settleNow * exp(min(k, 0.0) / 200.0);
  float4 n = to.eval(erase(center + d * (1.0 - s)));
  if (k < -1.5) return n;
  return mix(n, from.eval(erase(q)), smoothstep(-1.5, 1.5, k));
}

// One defocus tap: split into red/green/blue only when there is color warping to show.
float3 tap(float2 q, float2 ca) {
  if (disperse <= 0.0 && fringe <= 0.0) return pick(q).rgb;
  return float3(pick(q - ca).r, pick(q).g, pick(q + ca).b);
}

half4 main(float2 p) {
  float2 d = p - center;
  float dist = length(d);
  float e = (dist - radius) / band;
  float ring = exp(-e * e);               // glass height profile
  // Away from the glass (and its shadow): just the screen.
  if (ring < 0.01 && (shadow == 0.0 || abs(e - 1.6) > 1.9)) return half4(pick(p).rgb, 1.0);

  float2 dir = d / max(dist, 1.0);
  float slope = -2.0 * e * ring;          // surface slope
  float2 off = dir * slope * refraction;
  float2 ca = dir * slope * refraction * disperse + dir * ring * fringe;

  float3 c;
  if (ring < 0.01) {
    c = pick(p).rgb;
${SPECTRAL ? spectral : standard}

  float3 n = normalize(float3(dir * slope * BEVEL, 1.0));
  float glint = pow(max(dot(n, light), 0.0), 90.0) * spec * ring;
  float fres = pow(max(1.0 - n.z, 0.0), 1.5) * fresnel;
  float shade = exp(-(e - 1.6) * (e - 1.6) * 2.5) * shadow;

  // Mood: the glass takes on the character of where the screen is going.
  float dusk = max(mood, 0.0) * ring;
  float dawn = max(-mood, 0.0) * ring;
  c = mix(c, c * float3(0.62, 0.66, 0.78), dusk * 0.6);            // smoky, cool tint
  c += float3(1.0, 0.86, 0.62) * dawn * 0.16;                     // warm inner light

  c = c * (1.0 - shade) + (glint + fres) * tint;
  return half4(clamp(c, 0.0, 1.0), 1.0);
}
`;

/**
 * Compiles the glass shader; call once, at provider mount. Null (with a dev warning) if it doesn't
 * compile, and the provider then applies every change instantly.
 */
export function compileGlass(): SkRuntimeEffect | null {
  let effect: SkRuntimeEffect | null = null;
  try {
    effect = Skia.RuntimeEffect.Make(source);
  } catch {}
  if (!effect && __DEV__) console.warn('[glass-transitions] The glass shader failed to compile; changes will apply without the sweep.');
  return effect;
}
