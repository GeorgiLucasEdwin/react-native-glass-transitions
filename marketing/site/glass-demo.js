/*
 * glass-demo.js: WebGL port of the React Native Skia glass transition (src/glass-transition/shader.ts).
 * A glass lens sweeps across a phone screenshot, refracting the light theme into the dark one or back.
 * Tap / Enter / Space toggles; a vertical drag scrubs the glass (spring follow, commit past 1/3 or on a flick).
 * Dependency-free. Usage:
 *   var demo = GlassDemo.mount(canvas, { light: 'app-light.png', dark: 'app-dark.png', preset: 'glass',
 *                                        startDark: false, onThemeChange: function (isDark) {} });
 *   demo.toggle(); demo.setPreset('prism'); demo.isDark(); demo.destroy();
 * All geometry is in points of a 402 pt wide phone screen, so the look matches the app at any canvas size.
 */
(function () {
  'use strict';

  // Copied from src/glass-transition/config.ts. duration in ms.
  var presets = {
    subtle: { band: 40, refraction: 12, blur: 2, disperse: 0.1, fringe: 1, spec: 0.3, fresnel: 0.06, shadow: 0.03, settle: 0.015, mood: 0.4, duration: 700 },
    glass: { band: 100, refraction: 20, blur: 16, disperse: 1, fringe: 9, spec: 0.5, fresnel: 0.15, shadow: 0, settle: 0.2, mood: 1, duration: 2500 },
    liquid: { band: 70, refraction: 45, blur: 3, disperse: 0.25, fringe: 1.5, spec: 1.1, fresnel: 0.3, shadow: 0.05, settle: 0.05, mood: 0.8, duration: 1200 },
    prism: { band: 80, refraction: 30, blur: 8, disperse: 1.6, fringe: 16, spec: 0.6, fresnel: 0.12, shadow: 0, settle: 0.08, mood: 0.6, duration: 1600 },
  };
  var SHADER_KEYS = ['band', 'refraction', 'blur', 'disperse', 'fringe', 'spec', 'fresnel', 'shadow', 'settle', 'mood'];
  var SCREEN_PT = 402; // phone width in points

  var VS = 'attribute vec2 a;\nvoid main() { gl_Position = vec4(a, 0.0, 1.0); }\n';

  // Faithful port of the SkSL (minus the live-control hole). Coordinates are points, y down.
  var FS = [
    'precision highp float;',
    'uniform sampler2D from;',
    'uniform sampler2D to;',
    'uniform vec2 res;        // drawing buffer (px)',
    'uniform float scale;     // px per point',
    'uniform vec2 size;       // canvas (pt)',
    'uniform vec2 center;',
    'uniform float end;',
    'uniform float progress;',
    'uniform float band;',
    'uniform float refraction;',
    'uniform float disperse;',
    'uniform float fringe;',
    'uniform float blur;',
    'uniform float spec;',
    'uniform float fresnel;',
    'uniform float shadow;',
    'uniform float mood;',
    'uniform float settle;',
    'uniform float fade;      // 1 = plain crossfade (reduced motion)',
    '',
    'const float BEVEL = 1.25;',
    'const int TAPS = 8;',
    '',
    '// Textures are pre-fitted to the canvas; mirror outside like the app\'s ImageShader (tx/ty mirror).',
    'vec2 uv(vec2 q) { return abs(mod(q / size + 1.0, 2.0) - 1.0); }',
    'vec3 fromAt(vec2 q) { return texture2D(from, uv(q)).rgb; }',
    'vec3 toAt(vec2 q) { return texture2D(to, uv(q)).rgb; }',
    '',
    'float rad() { return progress <= 0.0 ? -1000.0 : progress * (end + 2.5 * band); }',
    '',
    'vec3 pick(vec2 q) {',
    '  vec2 d = q - center;',
    '  float k = length(d) - rad();',
    '  if (k > 1.5) return fromAt(q);',
    '  float s = settle * (1.0 - smoothstep(0.5, 1.0, progress)) * exp(min(k, 0.0) / 200.0);',
    '  vec3 n = toAt(center + d * (1.0 - s));',
    '  if (k < -1.5) return n;',
    '  return mix(n, fromAt(q), smoothstep(-1.5, 1.5, k));',
    '}',
    '',
    'void main() {',
    '  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / scale;',
    '  if (fade > 0.5) {',
    '    gl_FragColor = vec4(mix(fromAt(p), toAt(p), clamp(progress, 0.0, 1.0)), 1.0);',
    '    return;',
    '  }',
    '  vec2 d = p - center;',
    '  float dist = length(d);',
    '  vec2 dir = d / max(dist, 1.0);',
    '  float e = (dist - rad()) / band;',
    '  float ring = exp(-e * e);',
    '  float slope = -2.0 * e * ring;',
    '  vec2 off = dir * slope * refraction;',
    '',
    '  vec3 c;',
    '  if (ring < 0.01) {',
    '    c = pick(p);',
    '  } else {',
    '    vec2 ca = dir * slope * refraction * disperse + dir * ring * fringe;',
    '    c = vec3(0.0);',
    '    float jitter = fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;',
    '    for (int i = 0; i < TAPS; i++) {',
    '      float fi = float(i);',
    '      float a = fi * 2.39996 + jitter;',
    '      vec2 q = p - off + vec2(cos(a), sin(a)) * sqrt((fi + 0.5) / float(TAPS)) * blur * ring;',
    '      c += vec3(pick(q - ca).r, pick(q).g, pick(q + ca).b);',
    '    }',
    '    c /= float(TAPS);',
    '  }',
    '',
    '  float la = mix(-2.4, -1.6, progress);',
    '  vec3 n = normalize(vec3(dir * slope * BEVEL, 1.0));',
    '  vec3 h = normalize(normalize(vec3(cos(la), sin(la), 0.7)) + vec3(0.0, 0.0, 1.0));',
    '  float glint = pow(max(dot(n, h), 0.0), 90.0) * spec * ring;',
    '  float fres = pow(max(1.0 - n.z, 0.0), 1.5) * fresnel;',
    '  float shade = exp(-(e - 1.6) * (e - 1.6) * 2.5) * shadow;',
    '',
    '  float dusk = max(mood, 0.0) * ring;',
    '  float dawn = max(-mood, 0.0) * ring;',
    '  c = mix(c, c * vec3(0.62, 0.66, 0.78), dusk * 0.6);',
    '  c += vec3(1.0, 0.86, 0.62) * dawn * 0.16;',
    '  vec3 tint = mix(vec3(1.0), mood > 0.0 ? vec3(0.8, 0.9, 1.0) : vec3(1.0, 0.9, 0.75), abs(mood));',
    '',
    '  c = c * (1.0 - shade) + (glint + fres) * tint;',
    '  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);',
    '}',
  ].join('\n');

  // cubic-bezier(x1, y1, x2, y2) as an easing function (bisection on x).
  function bezier(x1, y1, x2, y2) {
    function b(t, a, c) { var u = 1 - t; return 3 * u * u * t * a + 3 * u * t * t * c + t * t * t; }
    return function (x) {
      var lo = 0, hi = 1, t = x;
      for (var i = 0; i < 24; i++) { t = (lo + hi) / 2; if (b(t, x1, x2) < x) lo = t; else hi = t; }
      return b(t, y1, y2);
    };
  }
  var easeSweep = bezier(0.2, 0, 0, 1);
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // Draw img into a w×h 2D context, "cover" fit (the app's fit="cover").
  function drawCover(ctx, img, w, h) {
    var s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function mount(canvas, opts) {
    opts = opts || {};
    var preset = presets[opts.preset] || presets.glass;
    var dark = !!opts.startDark;
    var onThemeChange = opts.onThemeChange || function () {};
    var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    // Accessibility + touch.
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    canvas.setAttribute('role', 'button');
    if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', 'Toggle dark mode');
    canvas.setAttribute('aria-pressed', String(dark));
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = canvas.style.webkitUserSelect = 'none';

    var gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false });
    var ctx2d = gl ? null : canvas.getContext('2d'); // static fallback: crossfades only
    var prog, uni = {}, tex = {}, lost = false;
    var imgs = {}, loaded = 0;
    var T = null; // running transition
    var raf = 0, last = 0, destroyed = false;
    var W = SCREEN_PT, H = 874; // canvas size in points

    function initGL() {
      function sh(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error('GlassDemo shader: ' + gl.getShaderInfoLog(s));
        return s;
      }
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.bindAttribLocation(prog, 0, 'a');
      gl.linkProgram(prog);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one big triangle
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      ['from', 'to', 'res', 'scale', 'size', 'center', 'end', 'progress', 'fade'].concat(SHADER_KEYS).forEach(function (k) {
        uni[k] = gl.getUniformLocation(prog, k);
      });
      gl.uniform1i(uni.from, 0);
      gl.uniform1i(uni.to, 1);
      tex = {};
    }

    // Upload both screenshots pre-scaled to the drawing buffer (browser resampling beats bilinear minification).
    function upload() {
      if (!gl || lost || loaded < 2) return;
      var c = document.createElement('canvas');
      c.width = canvas.width; c.height = canvas.height;
      var x = c.getContext('2d');
      ['light', 'dark'].forEach(function (k) {
        drawCover(x, imgs[k], c.width, c.height);
        if (!tex[k]) tex[k] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex[k]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      });
    }

    function render() {
      if (destroyed || loaded < 2 || lost) return;
      var toDark = T ? T.toDark : dark;
      var fromKey = T ? (toDark ? 'light' : 'dark') : (dark ? 'dark' : 'light');
      var toKey = toDark ? 'dark' : 'light';
      var p = T ? T.p : 0;
      if (!gl) {
        if (!ctx2d) return;
        drawCover(ctx2d, imgs[fromKey], canvas.width, canvas.height);
        ctx2d.globalAlpha = clamp01(p);
        drawCover(ctx2d, imgs[toKey], canvas.width, canvas.height);
        ctx2d.globalAlpha = 1;
        return;
      }
      // Auto origin: night falls from the top, day rises from the bottom.
      var cx = W / 2, cy = T && !T.toDark ? H : 0;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[fromKey]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[toKey]);
      gl.uniform2f(uni.res, canvas.width, canvas.height);
      gl.uniform1f(uni.scale, canvas.width / SCREEN_PT);
      gl.uniform2f(uni.size, W, H);
      gl.uniform2f(uni.center, cx, cy);
      gl.uniform1f(uni.end, Math.sqrt(Math.pow(Math.max(cx, W - cx), 2) + Math.pow(Math.max(cy, H - cy), 2)));
      gl.uniform1f(uni.progress, p);
      gl.uniform1f(uni.fade, T && T.fade ? 1 : 0);
      SHADER_KEYS.forEach(function (k) { gl.uniform1f(uni[k], preset[k]); });
      gl.uniform1f(uni.mood, preset.mood * (toDark ? 1 : -1));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function kick() {
      if (!raf && !destroyed) { last = 0; raf = requestAnimationFrame(frame); }
    }

    function frame(now) {
      raf = 0;
      var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      var more = false;
      if (T) {
        if (T.mode === 'drag') {
          // Spring follow: stiffness 700, damping 55, mass 1 (semi-implicit Euler, 1 ms substeps).
          for (var s = dt; s > 0; s -= 0.001) {
            var h = Math.min(0.001, s);
            T.v += (-700 * (T.p - T.target) - 55 * T.v) * h;
            T.p += T.v * h;
          }
          if (Math.abs(T.p - T.target) < 1e-4 && Math.abs(T.v) < 1e-3) { T.p = T.target; T.v = 0; } else more = true;
        } else {
          var k = clamp01((now - (T.start || (T.start = now))) / T.dur);
          T.p = T.p0 + (T.goal - T.p0) * T.ease(k);
          if (k >= 1) return finish(T.goal === 1);
          more = true;
        }
      }
      render();
      if (more) raf = requestAnimationFrame(frame);
    }

    function finish(commit) {
      var t = T;
      T = null;
      if (commit) {
        dark = t.toDark;
        canvas.setAttribute('aria-pressed', String(dark));
      }
      render();
      if (commit) onThemeChange(dark);
    }

    function begin(mode) {
      var fade = !gl || reduceMQ.matches;
      T = { toDark: !dark, fade: fade, mode: mode, p: 0, v: 0, target: 0, p0: 0, goal: 1, start: 0,
            dur: fade ? 250 : preset.duration, ease: fade ? function (x) { return x; } : easeSweep };
    }

    function toggle() {
      if (T || destroyed) return; // ignore while a transition runs
      if (lost || loaded < 2) { dark = !dark; canvas.setAttribute('aria-pressed', String(dark)); onThemeChange(dark); return; }
      begin('auto');
      kick();
    }

    // ---- pointer: tap toggles, vertical drag scrubs ----
    var ptr = null; // { id, x, y, dragging, lastY, lastT, vy }
    function ptPerPx() { var r = canvas.getBoundingClientRect(); return SCREEN_PT / (r.width || 1); } // pt per CSS px
    function onDown(e) {
      if (ptr || T || (e.pointerType === 'mouse' && e.button !== 0)) return;
      ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, k: ptPerPx(), dragging: false, lastY: 0, lastT: e.timeStamp, vy: 0 };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    function onMove(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      var dx = (e.clientX - ptr.x) * ptr.k, dy = (e.clientY - ptr.y) * ptr.k;
      var sign = dark ? -1 : 1; // light: pull down from the top; dark: push up from the bottom
      if (!ptr.dragging) {
        if (ptr.dead) return;
        if (Math.abs(dx) > 20) { ptr.dead = true; return; }
        if (Math.abs(dy) < 15) return;
        if (dy * sign < 0 || T || loaded < 2 || lost) { ptr.dead = true; return; } // wrong way: nothing
        ptr.dragging = true;
        begin('drag');
      }
      var y = dy * sign, dtS = Math.max((e.timeStamp - ptr.lastT) / 1000, 0.001);
      ptr.vy = 0.7 * ((y - ptr.lastY) / dtS) + 0.3 * ptr.vy; // pt/s, smoothed
      ptr.lastY = y; ptr.lastT = e.timeStamp;
      T.target = clamp01(y / (H * 0.75));
      kick();
    }
    function onUp(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      var p = ptr;
      ptr = null;
      if (p.dragging && T) {
        if (e.timeStamp - p.lastT > 100) p.vy = 0; // finger rested before lifting: no flick
        var commit = e.type === 'pointerup' && (p.lastY > H / 3 || p.vy > 1000);
        T.mode = 'release';
        T.p0 = T.p; T.goal = commit ? 1 : 0; T.start = 0;
        T.dur = 150 + (commit ? 1 - T.p : T.p) * 450;
        T.ease = easeOutCubic;
        kick();
      } else if (e.type === 'pointerup' && !p.dead && Math.hypot(e.clientX - p.x, e.clientY - p.y) * p.k < 10) {
        toggle();
      }
    }
    function onKey(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); if (!e.repeat) toggle(); }
    }

    // ---- sizing ----
    function resize() {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var maxTex = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096 : 4096;
      var dpr = Math.min(window.devicePixelRatio || 1, 2, maxTex / r.width, maxTex / r.height);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      W = SCREEN_PT;
      H = canvas.height / (canvas.width / SCREEN_PT);
      upload();
      render();
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);

    // ---- context loss ----
    function onLost(e) { e.preventDefault(); lost = true; if (raf) cancelAnimationFrame(raf); raf = 0; }
    function onRestored() {
      lost = false;
      initGL();
      upload();
      render();
      if (T) kick();
    }

    var listeners = [
      ['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp],
      ['keydown', onKey], ['webglcontextlost', onLost], ['webglcontextrestored', onRestored],
    ];
    listeners.forEach(function (l) { canvas.addEventListener(l[0], l[1]); });

    if (gl) {
      try { initGL(); } catch (err) { console.error(err); } // eslint-disable-line no-console
    }
    ['light', 'dark'].forEach(function (k) {
      var img = new Image();
      img.onload = function () { imgs[k] = img; if (++loaded === 2) { resize(); } };
      img.onerror = function () { console.error('GlassDemo: could not load ' + opts[k]); }; // eslint-disable-line no-console
      img.decoding = 'async';
      img.src = opts[k] || ('app-' + k + '.png');
    });

    return {
      toggle: toggle,
      setPreset: function (name) {
        if (!presets[name]) throw new Error('GlassDemo: unknown preset ' + name);
        preset = presets[name];
        if (!T) render();
      },
      isDark: function () { return dark; },
      destroy: function () {
        destroyed = true;
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        listeners.forEach(function (l) { canvas.removeEventListener(l[0], l[1]); });
        if (gl && !lost) { gl.deleteTexture(tex.light); gl.deleteTexture(tex.dark); gl.deleteProgram(prog); }
      },
    };
  }

  window.GlassDemo = { mount: mount, presets: presets };
})();
