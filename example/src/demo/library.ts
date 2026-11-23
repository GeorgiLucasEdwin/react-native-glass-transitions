// "Photos" painted with layered gradients: skies, seas, fields and lights. Deterministic.
type Stop = [color: string, percent: number];
type Layer = { angle: number; stops: Stop[] } | { at: [number, number]; ellipse?: boolean; stops: Stop[] };
const L = (angle: number, ...stops: Stop[]): Layer => ({ angle, stops });
const R = (x: number, y: number, ...stops: Stop[]): Layer => ({ at: [x, y], stops });
const E = (x: number, y: number, ...stops: Stop[]): Layer => ({ at: [x, y], ellipse: true, stops });

/** Layers top-first, like CSS. */
const SCENES: Layer[][] = [
  // sunset over water
  [
    R(50, 58, ['#FFE8A3', 0], ['#FFB15C', 10], ['rgba(255,120,90,0)', 34]),
    L(180, ['#2B2D6E', 0], ['#C8507A', 45], ['#FF9A5A', 58], ['#3A2C5E', 60], ['#151432', 100]),
  ],
  // tropical sea
  [L(180, ['#7EC8F2', 0], ['#BFE6FA', 42], ['#1FB5C9', 44], ['#0E7FA6', 70], ['#F2DDAE', 72], ['#E8C98E', 100])],
  // meadow
  [
    R(25, 75, ['#FFD84D', 0], ['rgba(255,216,77,0)', 12]),
    R(70, 82, ['#FF6FA3', 0], ['rgba(255,111,163,0)', 10]),
    L(180, ['#9AD2FF', 0], ['#DDF1FF', 48], ['#7CC05A', 50], ['#3E8B3A', 100]),
  ],
  // city at night
  [
    R(30, 70, ['#FFC857', 0], ['rgba(255,200,87,0)', 8]),
    R(65, 62, ['#5AD1FF', 0], ['rgba(90,209,255,0)', 7]),
    R(80, 78, ['#FF5C8A', 0], ['rgba(255,92,138,0)', 9]),
    L(180, ['#0B0D24', 0], ['#1B1F4D', 55], ['#050510', 100]),
  ],
  // desert dunes
  [L(170, ['#F7D9A8', 0], ['#F2B880', 40], ['#D9814B', 41], ['#F0A46A', 62], ['#B95E35', 63], ['#E89A5C', 100])],
  // portrait bokeh
  [
    R(50, 42, ['#F6C7A9', 0], ['#E29C7E', 18], ['rgba(226,156,126,0)', 30]),
    R(20, 20, ['rgba(255,240,200,0.9)', 0], ['rgba(255,240,200,0)', 14]),
    R(80, 30, ['rgba(180,220,255,0.8)', 0], ['rgba(180,220,255,0)', 12]),
    L(160, ['#5A6E5A', 0], ['#2F3E35', 100]),
  ],
  // aurora
  [
    E(40, 35, ['rgba(80,255,170,0.85)', 0], ['rgba(80,255,170,0)', 45]),
    E(75, 25, ['rgba(170,90,255,0.7)', 0], ['rgba(170,90,255,0)', 40]),
    L(180, ['#050A1E', 0], ['#0E1F3C', 70], ['#0A0F16', 72], ['#04060A', 100]),
  ],
  // flowers
  [
    R(30, 35, ['#FF4F79', 0], ['#FF4F79', 14], ['rgba(255,79,121,0)', 22]),
    R(68, 55, ['#FFC145', 0], ['#FFC145', 12], ['rgba(255,193,69,0)', 20]),
    R(40, 78, ['#B65CFF', 0], ['#B65CFF', 10], ['rgba(182,92,255,0)', 18]),
    L(135, ['#2F6B2A', 0], ['#6DB04A', 100]),
  ],
  // snowy peak
  [L(160, ['#A9C9F5', 0], ['#E4EEFB', 40], ['#FFFFFF', 41], ['#C9D6E8', 60], ['#6B7D96', 61], ['#3A475A', 100])],
  // golden hour field
  [
    R(75, 30, ['#FFF1B8', 0], ['#FFC861', 14], ['rgba(255,200,97,0)', 40]),
    L(180, ['#F5A65B', 0], ['#F7C978', 50], ['#C98B2E', 52], ['#8A5A1C', 100]),
  ],
  // pool
  [L(135, ['#3FD0F0', 0], ['#1E9FE0', 30], ['#46E0F5', 52], ['#1B86D6', 75], ['#5FE3F2', 100])],
  // lavender
  [
    L(
      180,
      ['#F7B7C5', 0],
      ['#E9C6E8', 38],
      ['#7E5BC2', 40],
      ['#9A73D6', 60],
      ['#5B3E9C', 62],
      ['#8B66CF', 80],
      ['#4A2F86', 82],
      ['#7A55C4', 100],
    ),
  ],
];

const cssStops = (stops: Stop[]) => stops.map(([c, p]) => `${c} ${p}%`).join(', ');
const sceneCSS = (layers: Layer[]) =>
  layers
    .map((l) =>
      'angle' in l
        ? `linear-gradient(${l.angle}deg, ${cssStops(l.stops)})`
        : `radial-gradient(${l.ellipse ? 'ellipse' : 'circle'} at ${l.at[0]}% ${l.at[1]}%, ${cssStops(l.stops)})`,
    )
    .join(', ');

/** The library: 48 tiles (CSS backgrounds); every run of 12 shows each scene once, mirrored copies add variety. */
export const TILES = Array.from({ length: 48 }, (_, i) => ({
  css: sceneCSS(SCENES[(i * 7 + Math.floor(i / 12) * 5) % SCENES.length]),
  flip: i % 4 === 1,
  video: i % 9 === 4,
}));
