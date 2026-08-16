/* ============================================================
   STRIX HOOD — WebGL layer
   Four scenes, no build step, no post-processing:
     Strix3D.core(canvas, opts)     -> hero "Agent Core"
     Strix3D.passport(canvas, opts) -> rotating Agent NFT card
     Strix3D.wordmark(canvas, opts) -> extruded "STRIX HOOD" lettering
     Strix3D.ambient(canvas, opts)  -> full-page background lattice
   Three.js is pulled in with a dynamic import() at call time, so
   the page costs nothing until a scene is actually requested and
   keeps working (CSS fallback) if the CDN is blocked.

   Host requirements:
   - The <canvas> must have a CSS size (e.g. width:100%;height:100%
     inside a positioned box). The drawing buffer is derived from
     getBoundingClientRect, so an unsized canvas simply never draws.
   - Set window.STRIX3D_URL before this file runs to point at a
     self-hosted copy of three.module.js.
   - Both scenes render on a transparent background; put the page
     gradient behind the canvas, not on it.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------------- constants ---------------- */

  var THREE_URL = 'https://unpkg.com/three@0.169.0/build/three.module.js';

  var NEON = 0xCCFF00;   /* --neon   Robin Neon */
  var NEON2 = 0xE4FF4D;  /* --neon-2 */
  var TEAL = 0x00E5A0;   /* --teal   */
  var DARK = 0x0E1305;   /* near --olive, used for solid bodies */

  /* ---------------- tiny helpers ---------------- */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* Frame-rate independent damping: t is "fraction per 1/60s". */
  function damp(a, b, t, dt) { return lerp(a, b, 1 - Math.pow(1 - clamp(t, 0, 1), dt * 60)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function noop() { }

  /* Accepts '#CCFF00', 'CCFF00' or 0xCCFF00. Returns an int, or null. */
  function toHex(v) {
    if (typeof v === 'number' && isFinite(v)) return v | 0;
    if (typeof v === 'string') {
      var m = v.trim().replace(/^#/, '');
      if (/^[0-9a-fA-F]{6}$/.test(m)) return parseInt(m, 16);
      if (/^[0-9a-fA-F]{3}$/.test(m)) {
        return parseInt(m[0] + m[0] + m[1] + m[1] + m[2] + m[2], 16);
      }
    }
    return null;
  }

  function reducedMotion() {
    if (global.Strix && typeof global.Strix.reduced === 'boolean') return global.Strix.reduced;
    try { return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  /* ---------------- capability probe ---------------- */

  var _available = null;
  function available() {
    if (_available !== null) return _available;
    _available = false;
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') ||
        c.getContext('webgl') ||
        c.getContext('experimental-webgl');
      _available = !!(gl && typeof gl.getParameter === 'function');
      /* Release the probe context immediately. */
      if (gl) {
        var lose = gl.getExtension && gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) { _available = false; }
    return _available;
  }

  /* ---------------- three.js loader (cached, single flight) ---------------- */

  var threePromise = null;
  function loadThree() {
    if (threePromise) return threePromise;
    /* window.STRIX3D_URL lets the host page pin a self-hosted copy of
       three.module.js (offline builds, CSP, local testing). */
    var url = (typeof global.STRIX3D_URL === 'string' && global.STRIX3D_URL) || THREE_URL;
    threePromise = (function () {
      try { return import(/* webpackIgnore: true */ url); }
      catch (e) { return Promise.reject(e); }
    })().catch(function () {
      threePromise = null;        /* let a later call retry if the network recovers */
      return null;
    });
    return threePromise;
  }

  /* ---------------- wordmark artwork loader ----------------
     The lettering is supplied art, not code: assets/wordmark-geo.json holds
     the finished contours. It is fetched once — relative to this script's own
     URL, so the file moves with the bundle — and shared by every wordmark on
     the page. window.STRIX_WORDMARK_URL overrides the location, the same way
     window.STRIX3D_URL overrides three.js. Any failure resolves to null: the
     caller then keeps its own DOM headline. This never throws. */

  var SCRIPT_DIR = (function () {
    try {
      var s = document.currentScript;
      if (!s) {
        var all = document.getElementsByTagName('script');
        for (var i = all.length - 1; i >= 0; i--) {
          if (/strix-3d[^/]*\.js/.test(all[i].src || '')) { s = all[i]; break; }
        }
      }
      var src = (s && s.src) || '';
      return src ? src.replace(/[?#].*$/, '').replace(/[^/]*$/, '') : '';
    } catch (e) { return ''; }
  })();

  function wordmarkURL() {
    var u = global.STRIX_WORDMARK_URL;
    return (typeof u === 'string' && u) ? u : (SCRIPT_DIR + 'wordmark-geo.json');
  }

  /* Cheap shape check — anything malformed counts as "no artwork". */
  function validGeo(g) {
    if (!g || typeof g !== 'object' || !Array.isArray(g.glyphs) || !g.glyphs.length) return false;
    if (!(g.cap > 0) || !(g.right > g.left) || !isFinite(g.top) || !isFinite(g.baseline)) return false;
    for (var i = 0; i < g.glyphs.length; i++) {
      var o = g.glyphs[i] && g.glyphs[i].outer;
      if (!Array.isArray(o) || !o.length) return false;
      for (var j = 0; j < o.length; j++) {
        if (!Array.isArray(o[j]) || o[j].length < 3) return false;
      }
    }
    return true;
  }

  var geoPromise = null;
  function loadWordmarkGeo() {
    if (geoPromise) return geoPromise;
    geoPromise = new Promise(function (resolve) {
      if (typeof fetch !== 'function') { resolve(null); return; }
      fetch(wordmarkURL(), { credentials: 'same-origin' })
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (j) { resolve(validGeo(j) ? j : null); })
        .catch(function () { resolve(null); });
    }).then(function (g) {
      if (!g) geoPromise = null;      /* let a later mount retry */
      return g;
    });
    return geoPromise;
  }

  /* ---------------- runtime-generated soft glow sprite ----------------
     A 128px radial-gradient texture shared by every additive halo inside
     one scene. Cheap stand-in for a bloom pass. One per scene so that
     disposing a scene can never pull the texture out from under another. */

  function glowTexture(THREE) {
    var s = 128;
    var cv = document.createElement('canvas');
    cv.width = cv.height = s;
    var ctx = cv.getContext('2d');
    if (ctx) {
      var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0.00, 'rgba(255,255,255,1)');
      g.addColorStop(0.18, 'rgba(255,255,255,0.72)');
      g.addColorStop(0.42, 'rgba(255,255,255,0.20)');
      g.addColorStop(0.72, 'rgba(255,255,255,0.045)');
      g.addColorStop(1.00, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    var t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }

  /* ============================================================
     Shared stage: renderer + camera + observers + loop + dispose.
     Both scenes are built on top of this.
     ============================================================ */

  function createStage(THREE, canvas, opts, cfg) {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
    } catch (e) { return null; }

    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);           /* page gradient shows through */

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(cfg.fov || 42, 1, cfg.near || 0.1, cfg.far || 120);
    camera.position.set(0, 0, cfg.dist || 6);

    var clock = new THREE.Clock();
    var trash = [];                                 /* geometries/materials/textures to dispose */
    var raf = 0;
    var dead = false;
    var reduced = reducedMotion();

    var state = {
      onScreen: true,
      hidden: (typeof document !== 'undefined' && document.hidden) || false,
      paused: false,
      w: 0, h: 0,
      /* pointer, normalised to [-1,1] over the canvas box */
      px: 0, py: 0, inside: false
    };

    var frameFns = [];                              /* fn(dt, elapsed) */
    var resizeFns = [];                             /* fn(w, h) */
    var visibleFns = [];                            /* fn() — first time on screen */
    var sawVisible = false;

    function measure() {
      var r = canvas.getBoundingClientRect();
      var w = Math.floor(r.width || canvas.clientWidth || 0);
      var h = Math.floor(r.height || canvas.clientHeight || 0);
      return { w: w, h: h };
    }

    function applySize() {
      var m = measure();
      if (m.w < 2 || m.h < 2) { state.w = m.w; state.h = m.h; return false; }  /* zero-size: skip */
      if (m.w === state.w && m.h === state.h) return true;
      state.w = m.w; state.h = m.h;
      camera.aspect = m.w / m.h;
      camera.updateProjectionMatrix();
      renderer.setSize(m.w, m.h, false);
      for (var i = 0; i < resizeFns.length; i++) resizeFns[i](m.w, m.h);
      return true;
    }

    function renderOnce() {
      if (dead) return;
      if (!applySize()) return;
      try { renderer.render(scene, camera); } catch (e) { /* context lost — stay silent */ }
    }

    /* Single frame: advance, then draw. */
    function tick() {
      raf = 0;
      if (dead) return;
      var dt = Math.min(clock.getDelta(), 0.05);    /* clamp after tab wake */
      var t = clock.elapsedTime;
      for (var i = 0; i < frameFns.length; i++) frameFns[i](dt, t);
      renderOnce();
      if (running()) raf = global.requestAnimationFrame(tick);
    }

    function running() {
      return !dead && !reduced && state.onScreen && !state.hidden && !state.paused && state.w >= 2;
    }

    function start() {
      if (dead || reduced || raf) return;
      if (!running()) return;
      clock.getDelta();                              /* drop the idle gap */
      raf = global.requestAnimationFrame(tick);
    }

    function stop() {
      if (raf) { global.cancelAnimationFrame(raf); raf = 0; }
    }

    function sync() { if (running()) start(); else stop(); }

    /* --- observers --------------------------------------------------- */

    /* One-shot "the user can actually see this" signal — scroll-triggered
       entrances hang off it so they never play to an empty viewport. */
    function fireVisible() {
      if (sawVisible || dead) return;
      sawVisible = true;
      var list = visibleFns; visibleFns = [];
      for (var i = 0; i < list.length; i++) { try { list[i](); } catch (e) { } }
    }

    var io = null;
    if (global.IntersectionObserver) {
      io = new global.IntersectionObserver(function (entries) {
        var seen = false;
        for (var i = 0; i < entries.length; i++) {
          state.onScreen = entries[i].isIntersecting;
          if (entries[i].isIntersecting) seen = true;
        }
        sync();
        if (seen) fireVisible();
      }, { rootMargin: '120px' });
      try { io.observe(canvas); } catch (e) { io = null; }
    }

    var ro = null;
    if (global.ResizeObserver) {
      ro = new global.ResizeObserver(function () {
        if (dead) return;
        /* Redraw immediately so a resize while paused/reduced isn't stretched. */
        if (!running()) { renderOnce(); sync(); } else applySize();
      });
      try { ro.observe(canvas); } catch (e) { ro = null; }
    }

    function onVis() { state.hidden = !!document.hidden; sync(); }
    document.addEventListener('visibilitychange', onVis);

    function onWinResize() { if (!running()) { renderOnce(); sync(); } else applySize(); }
    global.addEventListener('resize', onWinResize);

    function onPointer(e) {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      state.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      state.px = clamp(x * 2 - 1, -2, 2);
      state.py = clamp(-(y * 2 - 1), -2, 2);
    }
    function onPointerOut() { state.inside = false; state.px = 0; state.py = 0; }

    if (!reduced) {
      global.addEventListener('pointermove', onPointer, { passive: true });
      global.addEventListener('pointerdown', onPointer, { passive: true });
      global.addEventListener('blur', onPointerOut);
      canvas.addEventListener('pointerleave', onPointerOut);
    }

    /* WebGL context loss: never throw, just idle until restored. */
    function onLost(e) { if (e && e.preventDefault) e.preventDefault(); stop(); }
    function onRestored() { sync(); }
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    function track(obj) { if (obj) trash.push(obj); return obj; }

    function disposeAll() {
      if (dead) return;
      dead = true;
      stop();
      if (io) { try { io.disconnect(); } catch (e) { } }
      if (ro) { try { ro.disconnect(); } catch (e) { } }
      document.removeEventListener('visibilitychange', onVis);
      global.removeEventListener('resize', onWinResize);
      global.removeEventListener('pointermove', onPointer);
      global.removeEventListener('pointerdown', onPointer);
      global.removeEventListener('blur', onPointerOut);
      canvas.removeEventListener('pointerleave', onPointerOut);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);

      frameFns.length = 0; resizeFns.length = 0; visibleFns.length = 0;

      /* Explicit list first (covers regenerated geometry), then the graph. */
      for (var i = 0; i < trash.length; i++) {
        try { if (trash[i] && trash[i].dispose) trash[i].dispose(); } catch (e) { }
      }
      trash.length = 0;
      scene.traverse(function (o) {
        try {
          if (o.geometry && o.geometry.dispose) o.geometry.dispose();
          var m = o.material;
          if (m) {
            var list = Array.isArray(m) ? m : [m];
            for (var j = 0; j < list.length; j++) {
              if (list[j].map && list[j].map.dispose) list[j].map.dispose();
              if (list[j].dispose) list[j].dispose();
            }
          }
        } catch (e) { }
      });
      scene.clear();
      try { renderer.dispose(); } catch (e) { }
    }

    return {
      THREE: THREE, renderer: renderer, scene: scene, camera: camera,
      state: state, reduced: reduced, track: track,
      onFrame: function (fn) { frameFns.push(fn); },
      /* Run the frame logic once with dt=0 so every object is laid out before
         the first paint — matters for the reduced-motion static frame. */
      warm: function () { for (var i = 0; i < frameFns.length; i++) frameFns[i](0, 0); },
      onResize: function (fn) { resizeFns.push(fn); },
      /* Without an IntersectionObserver we cannot know, so assume visible. */
      onVisible: function (fn) {
        if (typeof fn !== 'function') return;
        if (sawVisible || !io) { try { fn(); } catch (e) { } return; }
        visibleFns.push(fn);
      },
      start: start, stop: stop, sync: sync, renderOnce: renderOnce,
      setPaused: function (v) { state.paused = !!v; sync(); },
      dispose: disposeAll,
      isDead: function () { return dead; }
    };
  }

  /* Shared boot path for both scenes: probe, import, build, return handle. */
  function boot(canvas, opts, build) {
    opts = opts || {};
    var fail = typeof opts.onFail === 'function' ? opts.onFail : noop;

    if (!canvas || !canvas.getContext || !available()) {
      try { fail(); } catch (e) { }
      return Promise.resolve(null);
    }

    return loadThree().then(function (THREE) {
      if (!THREE || !THREE.WebGLRenderer) { try { fail(); } catch (e) { } return null; }
      var handle = null;
      try { handle = build(THREE, canvas, opts); } catch (e) { handle = null; }
      /* a scene may need one more async hop (the wordmark fetches its art) */
      if (handle && typeof handle.then === 'function') {
        return handle.then(function (h) {
          if (!h) { try { fail(); } catch (e) { } return null; }
          return h;
        }, function () { try { fail(); } catch (e) { } return null; });
      }
      if (!handle) { try { fail(); } catch (e) { } return null; }
      return handle;
    }).catch(function () {
      try { fail(); } catch (e) { }
      return null;
    });
  }

  /* ============================================================
     SCENE 1 — Agent Core
     ============================================================ */

  function buildCore(THREE, canvas, opts) {
    var stage = createStage(THREE, canvas, opts, { fov: 42, dist: 6.4 });
    if (!stage) return null;

    var scene = stage.scene, camera = stage.camera, S = stage.state;
    var accent = new THREE.Color(toHex(opts.accent) === null ? NEON : toHex(opts.accent));

    /* Everything hangs off `root` so setProgress can rotate the whole rig. */
    var root = new THREE.Group();
    scene.add(root);

    var tex = stage.track(glowTexture(THREE));

    /* ---- 1. shell: wireframe icosahedron + dark solid + fresnel rim ---- */

    var icoGeo = stage.track(new THREE.IcosahedronGeometry(1.15, 1));
    var wireGeo = stage.track(new THREE.WireframeGeometry(icoGeo));
    var wireMat = stage.track(new THREE.LineBasicMaterial({
      color: NEON, transparent: true, opacity: 0.92, depthWrite: false
    }));
    var wire = new THREE.LineSegments(wireGeo, wireMat);
    root.add(wire);

    /* Vertex pips make the wireframe read as a lattice, not a doodle. */
    var pipGeo = stage.track(new THREE.BufferGeometry());
    pipGeo.setAttribute('position', icoGeo.getAttribute('position').clone());
    var pipMat = stage.track(new THREE.PointsMaterial({
      color: NEON2, size: 0.055, map: tex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    wire.add(new THREE.Points(pipGeo, pipMat));

    var solidGeo = stage.track(new THREE.IcosahedronGeometry(1.03, 1));
    var solidMat = stage.track(new THREE.MeshBasicMaterial({ color: DARK }));
    var solid = new THREE.Mesh(solidGeo, solidMat);
    root.add(solid);

    /* Fresnel shell — fakes an emissive rim without lights or post FX. */
    var fresnelMat = stage.track(new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(NEON) },
        uPower: { value: 2.2 },
        uStrength: { value: 1.05 }
      },
      vertexShader: [
        'varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position,1.0);',
        '  vN = normalize(mat3(modelMatrix) * normal);',
        '  vV = normalize(cameraPosition - wp.xyz);',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uPower; uniform float uStrength;',
        'varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), uPower);',
        '  f *= uStrength;',
        '  gl_FragColor = vec4(uColor * f, f);',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    var fresnelGeo = stage.track(new THREE.IcosahedronGeometry(1.09, 3));
    root.add(new THREE.Mesh(fresnelGeo, fresnelMat));

    /* ---- 2. glowing core ---- */

    var coreGrp = new THREE.Group();
    coreGrp.renderOrder = 20;                          /* drawn last */
    root.add(coreGrp);

    var coreGeo = stage.track(new THREE.SphereGeometry(0.17, 24, 18));
    /* depthTest off so the core bleeds through the dark inner shell —
       an energy source contained by the lattice, not a ball behind a wall. */
    var coreMat = stage.track(new THREE.MeshBasicMaterial({ color: NEON2, depthTest: false }));
    var coreBall = new THREE.Mesh(coreGeo, coreMat);
    coreGrp.add(coreBall);

    var haloMat = stage.track(new THREE.SpriteMaterial({
      map: tex, color: NEON2, transparent: true, depthTest: false,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55
    }));
    var halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(1.4);
    coreGrp.add(halo);

    /* tight white-hot centre keeps the core from reading as a flat disc */
    var hotMat = stage.track(new THREE.SpriteMaterial({
      map: tex, color: 0xFFFFF2, transparent: true, depthTest: false,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85
    }));
    var hot = new THREE.Sprite(hotMat);
    hot.scale.setScalar(0.62);
    coreGrp.add(hot);

    var halo2Mat = stage.track(new THREE.SpriteMaterial({
      map: tex, color: TEAL, transparent: true, depthTest: false,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22
    }));
    var halo2 = new THREE.Sprite(halo2Mat);
    halo2.scale.setScalar(2.8);
    coreGrp.add(halo2);

    /* ---- 3. orbit rings + 4. orbiting fragments ---- */

    var ringSpecs = [
      { r: 1.70, tube: 0.006, color: NEON, tilt: [1.15, 0.0, 0.35], spin: [0.00, 0.16, 0.05] },
      { r: 2.10, tube: 0.005, color: TEAL, tilt: [0.35, 0.9, -0.4], spin: [0.09, -0.11, 0.0] },
      { r: 2.50, tube: 0.005, color: NEON, tilt: [-0.55, 0.35, 0.95], spin: [0.05, 0.06, -0.09] }
    ];

    var fragGeoA = stage.track(new THREE.OctahedronGeometry(0.058, 0));
    var fragGeoB = stage.track(new THREE.TetrahedronGeometry(0.07, 0));
    var fragMatA = stage.track(new THREE.MeshBasicMaterial({ color: NEON, wireframe: true }));
    var fragMatB = stage.track(new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true }));
    var fragMatC = stage.track(new THREE.MeshBasicMaterial({
      color: NEON2, transparent: true, opacity: 0.85
    }));
    var fragMats = [fragMatA, fragMatB, fragMatC];

    var rings = [];
    var frags = [];
    var FRAG_COUNT = 14;

    ringSpecs.forEach(function (spec, i) {
      var grp = new THREE.Group();
      grp.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
      root.add(grp);

      var g = stage.track(new THREE.TorusGeometry(spec.r, spec.tube, 6, 180));
      var m = stage.track(new THREE.MeshBasicMaterial({
        color: spec.color, transparent: true, opacity: i === 1 ? 0.55 : 0.7, depthWrite: false
      }));
      grp.add(new THREE.Mesh(g, m));

      /* A faint glow disc behind each ring so it doesn't look like hairline CAD. */
      var sMat = stage.track(new THREE.SpriteMaterial({
        map: tex, color: spec.color, transparent: true, opacity: 0.1,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      rings.push({ grp: grp, spec: spec, sprite: sMat });

      /* fragments riding this ring */
      var n = i === 0 ? 5 : (i === 1 ? 4 : 5);
      for (var k = 0; k < n && frags.length < FRAG_COUNT; k++) {
        var mesh = new THREE.Mesh(
          Math.random() < 0.55 ? fragGeoA : fragGeoB,
          fragMats[frags.length % fragMats.length]
        );
        grp.add(mesh);
        var fHalo = new THREE.Sprite(stage.track(new THREE.SpriteMaterial({
          map: tex, color: k % 2 ? TEAL : NEON, transparent: true, opacity: 0.42,
          blending: THREE.AdditiveBlending, depthWrite: false
        })));
        fHalo.scale.setScalar(0.34);                   /* world units — keep it a spark, not a cloud */
        mesh.add(fHalo);
        frags.push({
          mesh: mesh,
          r: spec.r,
          phase: rand(0, Math.PI * 2),
          speed: rand(0.18, 0.42) * (Math.random() < 0.3 ? -1 : 1),
          bob: rand(0.02, 0.09),
          tumble: new THREE.Vector3(rand(0.3, 1.1), rand(0.3, 1.1), rand(0.3, 1.1)),
          scale: rand(0.75, 1.35)
        });
        mesh.scale.setScalar(frags[frags.length - 1].scale);
      }
    });

    /* ---- 5. particle field (spherical shell, mouse-reactive) ---- */

    var P_COUNT = 1100;
    var pPos = new Float32Array(P_COUNT * 3);
    var pCol = new Float32Array(P_COUNT * 3);
    var pSeed = new Float32Array(P_COUNT);
    var cA = new THREE.Color(NEON), cB = new THREE.Color(TEAL), tmpC = new THREE.Color();

    for (var i = 0; i < P_COUNT; i++) {
      /* even-ish shell distribution */
      var u = Math.random() * 2 - 1;
      var th = Math.random() * Math.PI * 2;
      var sr = Math.sqrt(1 - u * u);
      var rad = 2.75 + Math.pow(Math.random(), 0.65) * 2.45;
      pPos[i * 3] = sr * Math.cos(th) * rad;
      pPos[i * 3 + 1] = u * rad * 0.82;              /* slightly oblate — reads as a system, not a ball */
      pPos[i * 3 + 2] = sr * Math.sin(th) * rad;
      tmpC.copy(cA).lerp(cB, Math.pow(Math.random(), 1.6));
      pCol[i * 3] = tmpC.r; pCol[i * 3 + 1] = tmpC.g; pCol[i * 3 + 2] = tmpC.b;
      pSeed[i] = Math.random();
    }

    var ptGeo = stage.track(new THREE.BufferGeometry());
    ptGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    ptGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
    ptGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1));

    var ptMat = stage.track(new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 0.055 },
        uScale: { value: 300 },                       /* px height * dpr * 0.5 */
        uRayO: { value: new THREE.Vector3(0, 0, 50) },
        uRayD: { value: new THREE.Vector3(0, 0, -1) },
        uKick: { value: 0 }
      },
      vertexShader: [
        'uniform float uTime; uniform float uSize; uniform float uScale;',
        'uniform vec3 uRayO; uniform vec3 uRayD; uniform float uKick;',
        'attribute vec3 aColor; attribute float aSeed;',
        'varying vec3 vColor; varying float vGlow;',
        'void main(){',
        '  vec3 wp = (modelMatrix * vec4(position,1.0)).xyz;',
        /* drift so the field never looks frozen */
        '  wp += vec3(sin(uTime*0.32 + aSeed*22.0), cos(uTime*0.27 + aSeed*17.0), sin(uTime*0.23 + aSeed*13.0)) * 0.05;',
        /* distance from the mouse ray -> local brighten + push */
        '  vec3 rel = wp - uRayO;',
        '  float tt = max(dot(rel, uRayD), 0.0);',
        '  vec3 closest = uRayO + uRayD * tt;',
        '  vec3 away = wp - closest;',
        '  float d = length(away);',
        '  float glow = 1.0 - smoothstep(0.0, 1.25, d);',
        '  wp += normalize(away + vec3(1e-4)) * glow * 0.28;',
        '  wp *= 1.0 + uKick * 0.05;',
        '  vec4 mv = viewMatrix * vec4(wp, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  float tw = 0.55 + 0.45 * sin(uTime * 1.5 + aSeed * 40.0);',
        '  vGlow = glow;',
        '  vColor = aColor * (0.30 + tw * 0.30 + glow * 1.7 + uKick * 0.55);',
        '  gl_PointSize = uSize * (0.85 + glow * 1.4) * (uScale / max(-mv.z, 0.05));',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor; varying float vGlow;',
        'void main(){',
        '  vec2 c = gl_PointCoord - 0.5;',
        '  float d = dot(c, c);',
        '  if (d > 0.25) discard;',
        '  float a = smoothstep(0.25, 0.0, d);',
        '  gl_FragColor = vec4(vColor, a * (0.42 + vGlow * 0.58));',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));

    var field = new THREE.Points(ptGeo, ptMat);
    root.add(field);

    stage.onResize(function (w, h) {
      ptMat.uniforms.uScale.value = h * 0.5 * Math.min(global.devicePixelRatio || 1, 2);
      fitCamera(w / h);
      applyCamera();
    });

    /* ---- 6. data arcs — "agents transacting" ---- */

    var ARCS = 4;
    var arcs = [];
    var arcMat = stage.track(new THREE.MeshBasicMaterial({
      color: NEON, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    var arcMatTeal = stage.track(new THREE.MeshBasicMaterial({
      color: TEAL, transparent: true, opacity: 0.46,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    var packetGeo = stage.track(new THREE.SphereGeometry(0.038, 10, 8));
    var packetMat = stage.track(new THREE.MeshBasicMaterial({ color: 0xF6FFD6 }));

    function shellPoint(r) {
      var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      return new THREE.Vector3(s * Math.cos(th) * r, u * r * 0.9, s * Math.sin(th) * r);
    }

    function makeCurve() {
      var a = shellPoint(rand(2.3, 3.0));
      var b = shellPoint(rand(2.3, 3.0));
      /* keep endpoints far enough apart that the arc reads as travel */
      if (a.distanceTo(b) < 3.0) b.negate();
      var mid = a.clone().add(b).multiplyScalar(0.5);
      if (mid.lengthSq() < 0.02) mid.set(0, 0.6, 0);
      mid.normalize().multiplyScalar(rand(3.4, 4.6));
      return new THREE.QuadraticBezierCurve3(a, mid, b);
    }

    function arcGeometry(curve) {
      return new THREE.TubeGeometry(curve, 46, 0.009, 5, false);
    }

    for (var ai = 0; ai < ARCS; ai++) {
      var curve = makeCurve();
      var geo = arcGeometry(curve);
      var mesh = new THREE.Mesh(geo, ai % 3 === 1 ? arcMatTeal : arcMat);
      root.add(mesh);

      var packet = new THREE.Mesh(packetGeo, packetMat);
      root.add(packet);

      var pHalo = new THREE.Sprite(stage.track(new THREE.SpriteMaterial({
        map: tex, color: ai % 3 === 1 ? TEAL : NEON2, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95
      })));
      pHalo.scale.setScalar(0.5);
      packet.add(pHalo);

      arcs.push({
        curve: curve, mesh: mesh, packet: packet,
        t: Math.random(), speed: rand(0.12, 0.26)
      });
    }

    /* Reroute an arc once its packet lands — the topology keeps changing,
       which is the whole point of the motif. */
    function reroute(arc) {
      arc.curve = makeCurve();
      var old = arc.mesh.geometry;
      arc.mesh.geometry = arcGeometry(arc.curve);
      if (old && old.dispose) old.dispose();
      arc.speed = rand(0.12, 0.26);
    }

    /* ---- 7. shockwave pool for pulse() ---- */

    var waveGeo = stage.track(new THREE.RingGeometry(0.945, 1.0, 128));
    var waves = [];
    for (var wi = 0; wi < 3; wi++) {
      var wm = stage.track(new THREE.MeshBasicMaterial({
        color: wi === 1 ? 0xBBFFE6 : 0xEEFFB4, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide
      }));
      var wmesh = new THREE.Mesh(waveGeo, wm);
      wmesh.visible = false;
      scene.add(wmesh);                                /* billboarded in scene space */
      waves.push({ mesh: wmesh, mat: wm, t: 1, life: 1, power: 1 });
    }

    /* ---- animation state ---- */

    var baseDist = 6.4;
    var FIT_R = 2.85;                                  /* radius that must stay in frame */
    var progress = 0, progressT = 0;
    var kick = 0;                                      /* core brightness/scale kick */
    var camX = 0, camY = 0;
    var ray = new THREE.Raycaster();
    var ndc = new THREE.Vector2();

    /* Pull the camera back far enough that the outermost ring always fits,
       whatever box the host page gives us. */
    function fitCamera(aspect) {
      if (!isFinite(aspect) || aspect <= 0) return;
      var half = Math.tan((camera.fov * Math.PI / 180) / 2);
      baseDist = Math.max(FIT_R / half, FIT_R / (half * aspect)) * 1.02;
    }

    function applyCamera() {
      var dist = baseDist * (1 - progress * 0.20);
      camera.position.set(camX, camY + progress * 0.55, dist);
      camera.lookAt(0, progress * 0.12, 0);
    }

    function applyProgress() {
      root.rotation.y = progress * 1.25;
      root.rotation.x = progress * 0.32;
      root.position.y = -progress * 0.25;
    }

    stage.onFrame(function (dt, t) {
      progress = damp(progress, progressT, 0.08, dt);
      kick = Math.max(0, kick - dt * 2.1);

      /* mouse parallax, capped ~0.25 rad worth of camera travel */
      var tx = clamp(S.px, -1, 1) * 1.55;
      var ty = clamp(S.py, -1, 1) * 1.0;
      camX = damp(camX, tx, 0.05, dt);
      camY = damp(camY, ty, 0.05, dt);
      applyCamera();
      applyProgress();

      /* shell + core */
      wire.rotation.y += dt * 0.14;
      wire.rotation.x += dt * 0.05;
      solid.rotation.copy(wire.rotation);
      var breathe = 1 + Math.sin(t * 1.25) * 0.06 + kick * 0.55;
      coreBall.scale.setScalar(breathe);
      hot.scale.setScalar((0.6 + Math.sin(t * 1.25) * 0.05) * (1 + kick * 0.9));
      halo.scale.setScalar((1.35 + Math.sin(t * 1.25) * 0.14) * (1 + kick * 0.7));
      halo2.scale.setScalar((2.8 + Math.sin(t * 0.85 + 1.0) * 0.25) * (1 + kick * 0.5));
      haloMat.opacity = 0.44 + Math.sin(t * 1.25) * 0.12 + kick * 0.35;
      halo2Mat.opacity = 0.17 + Math.sin(t * 0.85 + 1.0) * 0.05 + kick * 0.25;
      fresnelMat.uniforms.uStrength.value = 1.0 + Math.sin(t * 1.1) * 0.14 + kick * 0.9;

      /* rings */
      for (var i = 0; i < rings.length; i++) {
        var r = rings[i];
        r.grp.rotation.x += r.spec.spin[0] * dt;
        r.grp.rotation.y += r.spec.spin[1] * dt;
        r.grp.rotation.z += r.spec.spin[2] * dt;
      }

      /* fragments */
      for (var f = 0; f < frags.length; f++) {
        var fr = frags[f];
        fr.phase += fr.speed * dt;
        var wobble = Math.sin(t * 0.8 + fr.phase * 2.0) * fr.bob;
        fr.mesh.position.set(
          Math.cos(fr.phase) * (fr.r + wobble),
          Math.sin(t * 0.6 + fr.phase) * fr.bob * 1.6,
          Math.sin(fr.phase) * (fr.r + wobble)
        );
        fr.mesh.rotation.x += fr.tumble.x * dt;
        fr.mesh.rotation.y += fr.tumble.y * dt;
        fr.mesh.rotation.z += fr.tumble.z * dt;
        fr.mesh.scale.setScalar(fr.scale * (1 + kick * 0.5));
      }

      /* particle field */
      field.rotation.y += dt * 0.035;
      field.rotation.x = Math.sin(t * 0.1) * 0.08;
      ptMat.uniforms.uTime.value = t;
      ptMat.uniforms.uKick.value = kick;
      ndc.set(clamp(S.px, -1, 1), clamp(S.py, -1, 1));
      ray.setFromCamera(ndc, camera);
      ptMat.uniforms.uRayO.value.copy(ray.ray.origin);
      ptMat.uniforms.uRayD.value.copy(ray.ray.direction);

      /* arcs */
      for (var a = 0; a < arcs.length; a++) {
        var arc = arcs[a];
        arc.t += arc.speed * dt;
        if (arc.t >= 1) { arc.t = 0; reroute(arc); }
        var pt = arc.curve.getPointAt(clamp(arc.t, 0, 1));
        arc.packet.position.copy(pt);
        /* fade in/out at the ends so packets don't pop */
        var e = Math.sin(clamp(arc.t, 0, 1) * Math.PI);
        arc.packet.scale.setScalar(0.6 + e * 0.8 + kick * 0.6);
      }
      arcMat.opacity = 0.44 + Math.sin(t * 0.9) * 0.10 + kick * 0.3;
      arcMatTeal.opacity = 0.40 + Math.sin(t * 0.9 + 2.0) * 0.10 + kick * 0.3;

      /* shockwaves */
      for (var w = 0; w < waves.length; w++) {
        var wv = waves[w];
        if (wv.t >= 1) continue;
        wv.t = Math.min(1, wv.t + dt / wv.life);
        var e2 = 1 - Math.pow(1 - wv.t, 3);
        wv.mesh.scale.setScalar(0.95 + e2 * 1.55 * wv.power);
        wv.mat.opacity = Math.min(1, Math.pow(1 - wv.t, 0.7) * 1.15 * wv.power);
        wv.mesh.quaternion.copy(camera.quaternion);    /* billboard */
        if (wv.t >= 1) wv.mesh.visible = false;
      }
    });

    /* first paint (also the only paint under reduced motion) */
    stage.warm();
    stage.renderOnce();
    stage.start();

    var handle = {
      dispose: function () { stage.dispose(); },
      setProgress: function (p) {
        p = clamp(Number(p) || 0, 0, 1);
        progressT = p;
        if (stage.reduced) { progress = p; applyCamera(); applyProgress(); stage.renderOnce(); }
      },
      pulse: function (strength) {
        var s = clamp(strength === undefined ? 1 : Number(strength) || 0, 0, 3);
        if (s <= 0) return;
        kick = Math.min(1.6, kick + s);
        for (var i = 0; i < waves.length; i++) {
          if (waves[i].t >= 1) {
            waves[i].t = 0; waves[i].life = 0.9 + s * 0.15;
            waves[i].power = clamp(s, 0.35, 1.25);
            waves[i].mesh.visible = true;
            waves[i].mesh.position.set(0, 0, 0);
            break;
          }
        }
        if (stage.reduced) stage.renderOnce();
      },
      setPaused: function (v) { stage.setPaused(v); },
      setAccent: function (hex) {
        var h = toHex(hex);
        if (h === null) return;
        accent.setHex(h);
        wireMat.color.copy(accent);
        fresnelMat.uniforms.uColor.value.copy(accent);
        fragMatA.color.copy(accent);
        arcMat.color.copy(accent);
        if (stage.reduced) stage.renderOnce();
      }
    };
    if (toHex(opts.accent) !== null) handle.setAccent(opts.accent);
    if (typeof opts.progress === 'number') handle.setProgress(opts.progress);
    return handle;
  }

  /* ============================================================
     SCENE 2 — Agent Passport (NFT card)
     ============================================================ */

  function roundedRectShape(THREE, w, h, r) {
    var s = new THREE.Shape();
    var x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function buildPassport(THREE, canvas, opts) {
    var stage = createStage(THREE, canvas, opts, { fov: 38, dist: 4.6 });
    if (!stage) return null;

    var scene = stage.scene, camera = stage.camera, S = stage.state;
    var tex = stage.track(glowTexture(THREE));

    var root = new THREE.Group();
    scene.add(root);
    var card = new THREE.Group();
    root.add(card);

    var CARD_H = 2.0, CARD_W = CARD_H / 1.55, DEPTH = 0.05;

    /* ---- body: extruded rounded rect with a small bevel ---- */
    var shape = roundedRectShape(THREE, CARD_W, CARD_H, 0.13);
    var bodyGeo = stage.track(new THREE.ExtrudeGeometry(shape, {
      depth: DEPTH, bevelEnabled: true, bevelThickness: 0.014,
      bevelSize: 0.014, bevelOffset: 0, bevelSegments: 2, curveSegments: 14
    }));
    bodyGeo.center();

    var sheenMat = stage.track(new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAccent: { value: new THREE.Color(NEON) },
        uAlt: { value: new THREE.Color(TEAL) },
        uBase: { value: new THREE.Color(0x080B03) },
        uW: { value: CARD_W },
        uH: { value: CARD_H }
      },
      vertexShader: [
        'varying vec3 vN; varying vec3 vV; varying vec3 vP;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position,1.0);',
        '  vN = normalize(mat3(modelMatrix) * normal);',
        '  vV = normalize(cameraPosition - wp.xyz);',
        '  vP = position;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime; uniform vec3 uAccent; uniform vec3 uAlt; uniform vec3 uBase;',
        'uniform float uW; uniform float uH;',
        'varying vec3 vN; varying vec3 vV; varying vec3 vP;',
        'void main(){',
        '  vec3 n = normalize(vN); vec3 v = normalize(vV);',
        '  float facing = clamp(dot(n, v), 0.0, 1.0);',
        '  float fres = pow(1.0 - facing, 2.4);',
        /* view-angle dependent hue travel: the sheen moves when you move */
        '  float axis = (vP.x / uW) * 1.7 + (vP.y / uH) * 1.0;',
        '  float wave = sin(axis * 2.1 + uTime * 0.55 + fres * 4.5 + v.x * 3.0 + v.y * 1.8);',
        '  float ripple = sin(axis * 17.0 - uTime * 0.9) * 0.12;',
        '  float mixv = clamp(0.5 + 0.5 * wave + ripple, 0.0, 1.0);',
        '  vec3 col = mix(uAccent, uAlt, mixv);',
        /* fine machine grid + scanlines */
        '  vec2 g = fract(vec2(vP.x * 9.0, vP.y * 15.0));',
        '  float grid = step(0.94, g.x) + step(0.955, g.y) * 0.6;',
        '  float scan = 0.5 + 0.5 * sin(vP.y * 150.0);',
        /* a bright diagonal sweep crossing the card */
        '  float sweepPos = fract(axis * 0.26 - uTime * 0.11);',
        '  float sweep = pow(1.0 - abs(sweepPos - 0.5) * 2.0, 7.0);',
        '  sweep *= 0.55 + 0.45 * fres;',
        '  vec3 outc = uBase;',
        '  outc += col * (0.05 + 0.26 * mixv * mixv);',     /* body tint stays dark */
        '  outc += col * fres * 1.9;',                       /* edges/bevel catch the light */
        '  outc += col * grid * 0.10;',
        '  outc += vec3(0.88, 1.0, 0.70) * sweep * 0.85;',   /* the sweep is the hero */
        '  outc *= (0.88 + 0.12 * scan);',
        '  gl_FragColor = vec4(outc, 0.97);',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n'),
      transparent: true
    }));
    var body = new THREE.Mesh(bodyGeo, sheenMat);
    card.add(body);

    /* ---- hairline frame that follows the rounded silhouette ----
       Two offset outlines (front + back) read as a milled metal edge. */
    var outlinePts = roundedRectShape(THREE, CARD_W + 0.018, CARD_H + 0.018, 0.138)
      .getPoints(72);
    var edgeMat = stage.track(new THREE.LineBasicMaterial({
      color: NEON, transparent: true, opacity: 0.85
    }));
    var edgeMatBack = stage.track(new THREE.LineBasicMaterial({
      color: NEON, transparent: true, opacity: 0.28
    }));
    [[DEPTH / 2 + 0.026, edgeMat], [-DEPTH / 2 - 0.026, edgeMatBack]].forEach(function (o) {
      var pts = outlinePts.map(function (p) { return new THREE.Vector3(p.x, p.y, o[0]); });
      var g = stage.track(new THREE.BufferGeometry().setFromPoints(pts));
      card.add(new THREE.LineLoop(g, o[1]));
    });

    /* inset hairline rectangle — reads as a print frame on the artifact */
    var insetPts = [];
    var iw = CARD_W / 2 - 0.10, ih = CARD_H / 2 - 0.10;
    [[-iw, -ih], [iw, -ih], [iw, ih], [-iw, ih], [-iw, -ih]].forEach(function (p) {
      insetPts.push(new THREE.Vector3(p[0], p[1], DEPTH / 2 + 0.022));
    });
    var insetGeo = stage.track(new THREE.BufferGeometry().setFromPoints(insetPts));
    var insetMat = stage.track(new THREE.LineBasicMaterial({
      color: NEON2, transparent: true, opacity: 0.45
    }));
    card.add(new THREE.Line(insetGeo, insetMat));

    /* ---- surface furniture: data bars + a sigil, so it reads as an ID ---- */
    var barGeo = stage.track(new THREE.PlaneGeometry(1, 1));
    var barMat = stage.track(new THREE.MeshBasicMaterial({
      color: NEON2, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    var barMat2 = stage.track(new THREE.MeshBasicMaterial({
      color: TEAL, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    var barSpecs = [
      [0.62, 0.022, -0.14, -0.52], [0.40, 0.022, -0.25, -0.60],
      [0.50, 0.022, -0.20, -0.68], [0.26, 0.030, -0.32, 0.72]
    ];
    barSpecs.forEach(function (b, i) {
      var m = new THREE.Mesh(barGeo, i === 3 ? barMat2 : barMat);
      m.scale.set(b[0], b[1], 1);
      m.position.set(b[2] + b[0] / 2 - 0.02, b[3], DEPTH / 2 + 0.03);
      card.add(m);
    });

    var sigilGeo = stage.track(new THREE.TorusGeometry(0.15, 0.012, 6, 48));
    var sigilMat = stage.track(new THREE.MeshBasicMaterial({
      color: NEON, transparent: true, opacity: 0.9
    }));
    var sigil = new THREE.Mesh(sigilGeo, sigilMat);
    sigil.position.set(0, 0.24, DEPTH / 2 + 0.04);
    card.add(sigil);

    var sigilCoreGeo = stage.track(new THREE.OctahedronGeometry(0.075, 0));
    var sigilCore = new THREE.Mesh(sigilCoreGeo, stage.track(
      new THREE.MeshBasicMaterial({ color: NEON2, wireframe: true })
    ));
    sigilCore.position.copy(sigil.position);
    card.add(sigilCore);

    var cardHalo = new THREE.Sprite(stage.track(new THREE.SpriteMaterial({
      map: tex, color: NEON, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false
    })));
    cardHalo.scale.set(4.2, 4.6, 1);
    cardHalo.position.z = -0.4;
    root.add(cardHalo);

    /* ---- orbiting glyphs ---- */
    var glyphRing = stage.track(new THREE.TorusGeometry(0.075, 0.009, 6, 26));
    var glyphDia = stage.track(new THREE.OctahedronGeometry(0.065, 0));
    var glyphMatA = stage.track(new THREE.MeshBasicMaterial({ color: NEON }));
    var glyphMatB = stage.track(new THREE.MeshBasicMaterial({ color: TEAL }));
    var glyphs = [];
    for (var gi = 0; gi < 5; gi++) {
      var gm = new THREE.Mesh(gi % 2 ? glyphRing : glyphDia, gi % 3 ? glyphMatA : glyphMatB);
      var gHalo = new THREE.Sprite(stage.track(new THREE.SpriteMaterial({
        map: tex, color: gi % 3 ? NEON : TEAL, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false
      })));
      gHalo.scale.setScalar(0.36);
      gm.add(gHalo);
      root.add(gm);
      glyphs.push({
        mesh: gm,
        r: rand(0.92, 1.22),
        y: rand(-0.85, 0.85),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.25, 0.55) * (gi % 2 ? 1 : -1),
        spin: rand(0.5, 1.4)
      });
    }

    /* ---- animation state ---- */
    var baseDist = 4.6;
    var progress = 0, progressT = 0;
    var kick = 0;
    var rotX = 0, rotY = 0;

    /* Keep the card plus its orbiting glyphs inside whatever box we get. */
    function fitCamera(aspect) {
      if (!isFinite(aspect) || aspect <= 0) return;
      var half = Math.tan((camera.fov * Math.PI / 180) / 2);
      baseDist = Math.max(1.16 / half, 1.30 / (half * aspect)) * 1.04;
    }
    stage.onResize(function (w, h) { fitCamera(w / h); applyStatic(); });

    function applyStatic() {
      camera.position.set(0, progress * 0.35, baseDist * (1 - progress * 0.18));
      camera.lookAt(0, 0, 0);
      card.rotation.set(rotX, rotY, 0);
      root.rotation.z = progress * 0.12;
    }

    stage.onFrame(function (dt, t) {
      progress = damp(progress, progressT, 0.08, dt);
      kick = Math.max(0, kick - dt * 2.0);

      /* rest state: slow Y spin with a gentle wobble.
         pointer state: rotate toward the cursor, lerped; releases on leave. */
      var idleY = Math.sin(t * 0.32) * 0.62;
      var idleX = Math.sin(t * 0.47 + 1.1) * 0.10;
      var targetY = idleY, targetX = idleX;
      if (S.inside) {
        targetY = clamp(S.px, -1, 1) * 0.85 + idleY * 0.25;
        targetX = clamp(-S.py, -1, 1) * 0.45 + idleX * 0.25;
      }
      rotY = damp(rotY, targetY, 0.05, dt);
      rotX = damp(rotX, targetX, 0.05, dt);

      card.position.y = Math.sin(t * 0.7) * 0.045;
      applyStatic();

      sheenMat.uniforms.uTime.value = t;
      sigil.rotation.z += dt * 0.55;
      sigilCore.rotation.y += dt * 0.9;
      sigilCore.rotation.x += dt * 0.4;
      sigilCore.scale.setScalar(1 + kick * 0.6);
      cardHalo.material.opacity = 0.24 + Math.sin(t * 1.1) * 0.06 + kick * 0.35;

      for (var i = 0; i < glyphs.length; i++) {
        var g = glyphs[i];
        g.phase += g.speed * dt;
        g.mesh.position.set(
          Math.cos(g.phase) * g.r,
          g.y + Math.sin(t * 0.6 + g.phase) * 0.12,
          Math.sin(g.phase) * g.r * 0.55
        );
        g.mesh.rotation.x += g.spin * dt;
        g.mesh.rotation.y += g.spin * 0.7 * dt;
        g.mesh.scale.setScalar(1 + kick * 0.7);
      }
    });

    /* first paint */
    rotY = 0.5; rotX = 0.08;
    stage.warm();
    sheenMat.uniforms.uTime.value = 1.6;               /* nice static sheen position */
    stage.renderOnce();
    stage.start();

    var handle = {
      dispose: function () { stage.dispose(); },
      setProgress: function (p) {
        p = clamp(Number(p) || 0, 0, 1);
        progressT = p;
        if (stage.reduced) { progress = p; applyStatic(); stage.renderOnce(); }
      },
      pulse: function (strength) {
        var s = clamp(strength === undefined ? 1 : Number(strength) || 0, 0, 3);
        kick = Math.min(1.6, kick + s);
        if (stage.reduced) stage.renderOnce();
      },
      setPaused: function (v) { stage.setPaused(v); },
      setAccent: function (hex) {
        var h = toHex(hex);
        if (h === null) return;
        sheenMat.uniforms.uAccent.value.setHex(h);
        edgeMat.color.setHex(h);
        glyphMatA.color.setHex(h);
        sigilMat.color.setHex(h);
        cardHalo.material.color.setHex(h);
        if (stage.reduced) stage.renderOnce();
      }
    };
    if (toHex(opts.accent) !== null) handle.setAccent(opts.accent);
    if (typeof opts.progress === 'number') handle.setProgress(opts.progress);
    return handle;
  }

  /* ============================================================
     SCENE 3 — "STRIX HOOD" wordmark
     ------------------------------------------------------------
     The letterforms are not drawn in code: assets/wordmark-geo.json
     carries the supplied artwork as flattened contours (SVG space,
     y down) and each one is extruded with a shallow chamfer. The
     word IS the artwork — milled out of near-white metal, rimmed in
     neon, with the one neon diamond over the I.

     A "solid" glyph arrives as a union of overlapping convex pieces
     (bars and stems). Every piece is extruded on its own — no boolean
     geometry anywhere — and one detail makes the union read as a
     single letter instead of a stack of plates. ExtrudeGeometry with
     bevelOffset:0 puts the flat cap exactly on the supplied outline
     and grows the chamfer *outward* from it, so a chamfer that lands
     inside a sibling can be hidden by a flat cover cap cut on that
     sibling's own outline and floated a hair in front of the letter.
     What survives is the chamfer around the outside of the union —
     exactly the edge the drawing has.
     ============================================================ */

  /* --- contour helpers: SVG space (y down) in, glyph-local y-up out --- */

  function ringInto(dst, ring, ox, oy, k) {
    dst.moveTo((ring[0][0] - ox) * k, (oy - ring[0][1]) * k);
    for (var i = 1; i < ring.length; i++) {
      dst.lineTo((ring[i][0] - ox) * k, (oy - ring[i][1]) * k);
    }
    dst.closePath();
    return dst;
  }

  function ringHas(ring, x, y) {          /* even-odd point in polygon */
    var inside = false, n = ring.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function ringMid(ring) {
    var x = 0, y = 0;
    for (var i = 0; i < ring.length; i++) { x += ring[i][0]; y += ring[i][1]; }
    return [x / ring.length, y / ring.length];
  }

  /* One glyph -> a THREE.Shape per outer ring, every hole parented to the
     ring that contains it (so H's three bars and O's counter both work). */
  function glyphShapes(THREE, gl, ox, oy, k) {
    var outer = gl.outer, holes = gl.holes || [], shapes = [], i, j;
    for (i = 0; i < outer.length; i++) {
      shapes.push(ringInto(new THREE.Shape(), outer[i], ox, oy, k));
    }
    for (j = 0; j < holes.length; j++) {
      if (!holes[j] || holes[j].length < 3) continue;
      var c = ringMid(holes[j]), target = 0;
      for (i = 0; i < outer.length; i++) {
        if (ringHas(outer[i], c[0], c[1])) { target = i; break; }
      }
      shapes[target].holes.push(ringInto(new THREE.Path(), holes[j], ox, oy, k));
    }
    return shapes;
  }

  var WORD_VERT = [
    'uniform mat4 uWordInv;',
    'varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vNL; varying float vX;',
    'void main(){',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vN = normalize(mat3(modelMatrix) * normal);',
    '  vV = normalize(cameraPosition - wp.xyz);',
    '  vP = position;',
    '  vNL = normal;',
    /* x in the wordmark's own space, so the light sweep tracks the letters
       and not the camera, whatever the word is doing */
    '  vX = (uWordInv * wp).x;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  /* Near-white machined metal.

     uEdge is 0 on the flat caps and 1 on the extruded skirt; inside the
     skirt the object-space normal separates the chamfer (|nz| ~ 0.4-0.9)
     from the straight wall (nz == 0), so only the chamfer takes the neon.

     The chamfer is white metal as well — what makes it read neon is a
     coloured light raking it, and that light only reaches part of the
     perimeter at a time. So the rim is a glint that runs round the letter
     as it turns, not a green keyline traced round every glyph. Faces stay
     #F5F5F7. That is the difference between "machined white metal with a
     neon rim" and "glowing green letters". */
  var WORD_FRAG = [
    'uniform vec3 uAccent; uniform vec3 uBase;',
    'uniform float uEdge; uniform float uNeon; uniform float uTone; uniform float uDepth;',
    'uniform float uSweep; uniform float uSpan; uniform float uKick;',
    'varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vNL; varying float vX;',
    'float lobe(vec3 r, vec3 d, float p){ return pow(max(dot(r, normalize(d)), 0.0), p); }',
    'void main(){',
    '  vec3 n = normalize(vN); vec3 v = normalize(vV);',
    '  float ndv = clamp(dot(n, v), 0.0, 1.0);',
    '  vec3 r = reflect(-v, n);',
    '  float fres = pow(1.0 - ndv, 4.0);',
    '  float bev  = uEdge * smoothstep(0.12, 0.50, abs(vNL.z));',
    '  float wall = uEdge * (1.0 - bev);',
    /* stand-in for a studio: one hard white key high on the left, a broad
       soft box near the camera, a dim floor bounce */
    '  float key  = lobe(r, vec3(-0.40, 0.74, 0.54), 110.0);',
    '  float key2 = lobe(r, vec3(-0.40, 0.74, 0.54),  11.0);',
    '  float soft = lobe(r, vec3(-0.20, 0.40, 0.90),   2.6);',
    '  float bnc  = lobe(r, vec3( 0.66,-0.60, 0.45),   3.2);',
    '  float lam  = max(dot(n, normalize(vec3(-0.34, 0.60, 0.72))), 0.0);',
    /* --- the flat faces: near-white, lightly polished ------------------ */
    '  vec3 col = uBase * (0.50 + 0.40 * lam);',
    '  col += uBase * soft * 0.24;',
    '  col += vec3(1.0) * key * 0.40 + vec3(1.0) * key2 * 0.07;',
    '  col += uBase * bnc * 0.08;',
    '  col += vec3(1.0) * fres * 0.05;',
    /* fine milling grain — low enough to read as surface, not as stripes */
    '  col *= 0.995 + 0.005 * sin(vP.y * 240.0);',
    /* The straight walls sit in their own shade so the extrusion reads as
       thickness rather than as a fatter letter, and they carry the neon back
       from the chamfer: at hero size the chamfer itself is barely a pixel
       wide, and this is what actually makes the colour read as a rim rather
       than as a tint on an antialiased edge. vP.z runs 0 at the front face to
       -uDepth at the back. */
    '  float back = clamp(-vP.z / max(uDepth, 0.001), 0.0, 1.0);',
    '  col *= mix(1.0, 0.40, wall);',
    '  col += uAccent * wall * (0.05 + 0.42 * (1.0 - back) * (1.0 - back)) * uNeon;',
    /* --- the chamfer: white metal under a neon rake -------------------- */
    '  float g = lobe(r, vec3(-0.62, 0.44, 0.65), 3.5)',
    '          + lobe(r, vec3( 0.60,-0.52, 0.61), 2.8) * 0.85;',
    '  vec3 rim = uBase * (0.10 + 0.16 * lam)',
    '           + uAccent * (0.62 + 1.95 * clamp(g, 0.0, 1.2)) * uNeon',
    '           + vec3(1.0, 1.0, 0.94) * key * 0.85;',
    '  col = mix(col, rim, bev);',
    /* --- specular sweep travelling left -> right along the word --------- */
    '  float s = 1.0 - clamp(abs(vX - uSweep) / uSpan, 0.0, 1.0);',
    '  s = s * s * s;',
    '  col += mix(vec3(1.0, 1.0, 0.97), uAccent, bev * 0.75) * s * (0.09 + bev * 0.55);',
    '  col += uAccent * uKick * (0.04 + bev * 0.40);',
    '  gl_FragColor = vec4(col * uTone, 1.0);',
    '  #include <colorspace_fragment>',
    '}'
  ].join('\n');

  /* The accent diamond is the one lit object in the frame: its body stays on
     the brand colour and only a tight glint goes white, so it reads as
     #CCFF00 rather than as a yellow blob. */
  var ACCENT_FRAG = [
    'uniform vec3 uAccent; uniform float uKick;',
    'varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vNL; varying float vX;',
    'float lobe(vec3 r, vec3 d, float p){ return pow(max(dot(r, normalize(d)), 0.0), p); }',
    'void main(){',
    '  vec3 n = normalize(vN); vec3 v = normalize(vV);',
    '  float ndv = clamp(dot(n, v), 0.0, 1.0);',
    '  vec3 r = reflect(-v, n);',
    '  float fres = pow(1.0 - ndv, 2.4);',
    '  float key = lobe(r, vec3(-0.40, 0.75, 0.50), 44.0);',
    '  vec3 col = uAccent * (0.94 + 0.30 * fres + 0.14 * abs(vNL.z));',
    '  col += vec3(1.0, 1.0, 0.88) * key * 0.70;',
    '  col += uAccent * uKick * 0.55;',
    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <colorspace_fragment>',
    '}'
  ].join('\n');

  function buildWordmark(THREE, canvas, opts) {
    /* Artwork first. If it cannot be fetched the caller gets null, the page
       keeps its own headline — nothing is built and nothing throws. */
    return loadWordmarkGeo().then(function (geo) {
      if (!geo) return null;
      var handle = null;
      try { handle = wordmarkScene(THREE, canvas, opts, geo); } catch (e) { handle = null; }
      return handle;
    });
  }

  function wordmarkScene(THREE, canvas, opts, geo) {
    /* A long lens on purpose: at hero proportions the word is ~9 cap heights
       wide, and a wide angle throws the near end several per cent larger than
       the far end — which reads as a mistake, not as depth. */
    var stage = createStage(THREE, canvas, opts, { fov: 10, dist: 16, near: 0.8, far: 200 });
    if (!stage) return null;

    var scene = stage.scene, camera = stage.camera, S = stage.state;

    /* artwork units -> world units, one cap height = 1 */
    var CAPU = geo.cap, K = 1 / CAPU;
    var MID = (geo.top + geo.baseline) / 2;

    var root = new THREE.Group();
    scene.add(root);
    var word = new THREE.Group();       /* letters live here; sweep space */
    root.add(word);

    /* ---- shared uniforms: one object per value, referenced by every
       material, so setAccent/pulse touch a single place ---- */
    var uAccent = { value: new THREE.Color(NEON) };
    var uBase = { value: new THREE.Color(0xF5F5F7) };
    var uSweep = { value: -999 };
    var uSpan = { value: 0.9 };
    var uKick = { value: 0 };
    var uWordInv = { value: new THREE.Matrix4() };

    function metalMat(edge, neon, tone, depth, cover) {
      var m = new THREE.ShaderMaterial({
        uniforms: {
          uAccent: uAccent, uBase: uBase, uSweep: uSweep, uSpan: uSpan,
          uKick: uKick, uWordInv: uWordInv, uEdge: { value: edge },
          uNeon: { value: neon }, uTone: { value: tone },
          uDepth: { value: depth }
        },
        vertexShader: WORD_VERT, fragmentShader: WORD_FRAG
      });
      /* A backstop for the cover caps. COVER already lifts them clear in
         world units, but how much depth-buffer room that buys depends on the
         precision the browser hands out; polygonOffset states the same nudge
         in whatever precision the device actually has. */
      if (cover) {
        m.polygonOffset = true;
        m.polygonOffsetFactor = -2;
        m.polygonOffsetUnits = -16;
      }
      return stage.track(m);
    }
    /* ExtrudeGeometry group 0 = the two flat caps, group 1 = chamfer + walls.
       "HOOD" runs a brighter face and a much cooler rim so the monoline stays
       white and reads lighter than the heavy "STRIX" — the contrast between
       the two halves is the point of the drawing. */
    var MAT = {
      solid: [metalMat(0.0, 1.00, 1.00, 0.200), metalMat(1.0, 1.00, 1.00, 0.200)],
      outline: [metalMat(0.0, 0.50, 1.13, 0.105), metalMat(1.0, 0.50, 1.13, 0.105)]
    };
    var COVERMAT = {
      solid: metalMat(0.0, 1.00, 1.00, 0.200, true),
      outline: metalMat(0.0, 0.50, 1.13, 0.105, true)
    };
    /* The skirt is pushed the other way, and by *slope*: an interior wall
       seen almost edge-on has an enormous depth gradient, so half a pixel of
       multisample extrapolation is worth far more z than any fixed offset.
       polygonOffsetFactor scales with exactly that gradient, which is what
       keeps such a wall from stabbing through the cap in front of it. */
    MAT.solid[1].polygonOffset = MAT.outline[1].polygonOffset = true;
    MAT.solid[1].polygonOffsetFactor = MAT.outline[1].polygonOffsetFactor = 2.5;
    MAT.solid[1].polygonOffsetUnits = MAT.outline[1].polygonOffsetUnits = 4;
    var accentMat = stage.track(new THREE.ShaderMaterial({
      uniforms: { uAccent: uAccent, uKick: uKick, uWordInv: uWordInv },
      vertexShader: WORD_VERT, fragmentShader: ACCENT_FRAG
    }));
    var accentCoverMat = stage.track(new THREE.ShaderMaterial({
      uniforms: { uAccent: uAccent, uKick: uKick, uWordInv: uWordInv },
      vertexShader: WORD_VERT, fragmentShader: ACCENT_FRAG,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -16
    }));

    /* Stand-in for a bloom pass: a single soft card *behind* the lettering.
       depthTest stays on and it sits well back, so it lifts the background
       around the word and never tints the letters themselves. */
    var glowTex = stage.track(glowTexture(THREE));
    var glowMat = stage.track(new THREE.SpriteMaterial({
      map: glowTex, color: NEON, transparent: true, opacity: 0.06,
      depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending
    }));
    var glow = new THREE.Sprite(glowMat);
    glow.position.z = -1.4;
    root.add(glow);

    var SOLID = { depth: 0.200, bevel: 0.0090 };
    var THIN = { depth: 0.105, bevel: 0.0050 };
    var GEM = { depth: 0.075, bevel: 0.0075 };

    /* bevelOffset:0 keeps the whole chamfer outside the supplied outline, so
       a piece's flat face reaches its outline exactly and the chamfer is the
       only thing that grows the silhouette — 0.009 * 170 = 1.5 artwork units
       on a 44-unit stem, about a pixel at hero size. It is also what makes
       the cover caps below work: they are cut on the same outline, so they
       stop precisely where their own chamfer starts.

       The chamfer is also wider than it is deep. Partly that is the look — a
       crisp machined arris rather than a rounded-over edge — and partly it is
       what lets the cover caps sit close: a multisampled edge resolves its
       depth from the pixel centre, so a chamfer that drops steeply can
       extrapolate half a pixel's worth of z straight through a cover floating
       in front of it and reappear as a hairline. */
    function extrudeCfg(d) {
      return {
        depth: d.depth, bevelEnabled: true, bevelThickness: d.bevel * 0.55,
        bevelSize: d.bevel, bevelOffset: 0, bevelSegments: 2,
        curveSegments: 4, steps: 1
      };
    }

    /* ---- build the glyphs ---------------------------------------------- */
    var letters = [];

    /* SEAM steps the pieces of one letter apart so no two chamfers land on
       the same plane; COVER then floats the cover caps clear of the lot. Both
       stay small — 0.011 of a cap height is under half a pixel of parallax at
       the far end of a hero — because a cover floating well in front of the
       letter shears off its own outline and starts eating the neon rim. */
    var SEAM = 0.0006, COVER = 0.0110;

    /* One piece: the extrusion itself, plus (for a letter built out of more
       than one) a flat cap on the artwork outline sitting on the letter's
       cover plane. Anything a cap overlaps is a chamfer buried inside a
       sibling — the seam that would otherwise cut the letter into plates.

       Every piece is pushed back so its *front* face lands on z = 0. The word
       therefore extrudes away from the plane the camera was fitted to, and
       the face the viewer reads sits at exactly the scale the flat artwork
       would have had; centring the solid on z = 0 instead throws the whole
       word ~1% large. */
    function addPiece(group, shape, cfg, mats, capMat, i, n) {
      var front = -(cfg.depth + cfg.bevelThickness);
      var g = stage.track(new THREE.ExtrudeGeometry(shape, cfg));
      g.translate(0, 0, front + (i - (n - 1) / 2) * SEAM);
      group.add(new THREE.Mesh(g, mats));
      if (n < 2) return;
      var c = stage.track(new THREE.ShapeGeometry(shape, cfg.curveSegments));
      /* Every cover of one glyph lands on exactly the same plane. Stepping
         them apart instead — even by a thousandth — makes each shared edge a
         depth discontinuity, and multisampling then resolves that edge from
         samples the near cover owns and the far cover is depth-rejected on:
         a one-pixel hairline tracing every internal piece boundary. */
      c.translate(0, 0, (n - 1) / 2 * SEAM + COVER);
      group.add(new THREE.Mesh(c, capMat));
    }

    function addGlyph(gl, isAccent) {
      var outline = gl.style === 'outline';
      var d = isAccent ? GEM : (outline ? THIN : SOLID);
      var cfg = extrudeCfg(d);
      var box = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }, i, j, r;
      for (i = 0; i < gl.outer.length; i++) {
        r = gl.outer[i];
        for (j = 0; j < r.length; j++) {
          if (r[j][0] < box.x0) box.x0 = r[j][0];
          if (r[j][0] > box.x1) box.x1 = r[j][0];
          if (r[j][1] < box.y0) box.y0 = r[j][1];
          if (r[j][1] > box.y1) box.y1 = r[j][1];
        }
      }
      var ox = (box.x0 + box.x1) / 2, oy = (box.y0 + box.y1) / 2;
      var shapes = glyphShapes(THREE, gl, ox, oy, K);
      var mats = isAccent ? accentMat : (outline ? MAT.outline : MAT.solid);
      var capMat = isAccent ? accentCoverMat
        : (outline ? COVERMAT.outline : COVERMAT.solid);
      var group = new THREE.Group();
      for (i = 0; i < shapes.length; i++) {
        addPiece(group, shapes[i], cfg, mats, capMat, i, shapes.length);
      }
      word.add(group);

      var n = letters.length;
      letters.push({
        obj: group,
        grp: gl.x >= geo.hoodStart ? 1 : 0,
        cx: ox, cy: oy,
        halfH: (box.y1 - box.y0) / 2 * K,
        spin: !!isAccent,
        ord: isAccent ? 3 : n,
        delay: (isAccent ? 3.4 : n) * 0.078,
        phase: n * 0.83 + (n % 3) * 0.4,
        hx: 0, hy: 0,
        fx: (n % 2 ? 1 : -1) * (0.25 + (n % 3) * 0.14),
        rx: -0.85 + (n % 3) * 0.2,
        ry: (n % 2 ? 1 : -1) * (1.15 + (n % 4) * 0.12),
        rz: (n % 2 ? -1 : 1) * 0.28
      });
      return group;
    }

    for (var gi = 0; gi < geo.glyphs.length; gi++) addGlyph(geo.glyphs[gi], false);

    var accentObj = null;
    if (geo.accent && geo.accent.outer && geo.accent.outer.length) {
      accentObj = addGlyph(geo.accent, true);
      /* depth-tested and set just behind the diamond, so the bloom spills
         around it instead of washing #CCFF00 out to yellow across its face */
      var haloMat = stage.track(new THREE.SpriteMaterial({
        map: glowTex, color: NEON, transparent: true, opacity: 0.34,
        depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending
      }));
      var halo = new THREE.Sprite(haloMat);
      halo.scale.set(0.8, 0.8, 1);
      halo.position.z = -0.03;
      accentObj.add(halo);
      accentObj.userData.halo = haloMat;
    }

    /* ---- layout --------------------------------------------------------- */
    var LINE_H = 1.45, PADX = 1.22, PADY = 1.30;
    var boxW = 1, fitW = 1, fitH = 1, twoLine = false, baseDist = 10;
    /* the split into two lines is the artwork's own: STRIX ends at strixEnd,
       HOOD starts at hoodStart. Artwork without that split never stacks. */
    var canStack = isFinite(geo.strixEnd) && isFinite(geo.hoodStart) &&
      geo.hoodStart > geo.strixEnd && geo.strixEnd > geo.left && geo.right > geo.hoodStart;

    function layout(two) {
      twoLine = two;
      var top = -1e9, bot = 1e9, i, L, mid;
      for (i = 0; i < letters.length; i++) {
        L = letters[i];
        mid = !two ? (geo.left + geo.right) / 2
          : (L.grp === 1 ? (geo.hoodStart + geo.right) / 2 : (geo.left + geo.strixEnd) / 2);
        L.hx = (L.cx - mid) * K;
        L.hy = (MID - L.cy) * K + (two ? (L.grp === 1 ? -LINE_H / 2 : LINE_H / 2) : 0);
        if (L.hy + L.halfH > top) top = L.hy + L.halfH;
        if (L.hy - L.halfH < bot) bot = L.hy - L.halfH;
      }
      boxW = (two ? Math.max(geo.strixEnd - geo.left, geo.right - geo.hoodStart)
        : (geo.right - geo.left)) * K;
      fitW = boxW / 2;
      fitH = (top - bot) / 2;
      /* the diamond overhangs the cap line, so the word is centred on the
         artwork's own box rather than on the baseline-to-cap band */
      word.position.y = -(top + bot) / 2;
      uSpan.value = Math.max(0.42, boxW * 0.075);
      glow.scale.set(boxW * 1.05, fitH * (two ? 2.6 : 4.6), 1);
    }

    function fitCamera(w, h) {
      var aspect = (w > 0 && h > 0) ? w / h : 1.6;
      var halfV = Math.tan(camera.fov * Math.PI / 360);
      baseDist = Math.max(fitH * PADY / halfV, fitW * PADX / (halfV * aspect));
      /* The clip planes are pinned to the fitted distance instead of to fixed
         numbers. The word is a stack of near-coplanar caps a few thousandths
         apart, so it wants every bit of depth precision it can get, and the
         fitted distance swings by an order of magnitude between a wide hero
         and a narrow column. The far plane still clears the entrance, which
         starts the letters at 0.72 of the distance behind the word. */
      camera.near = Math.max(0.2, baseDist * 0.34);
      camera.far = baseDist * 3.4 + 24;
      camera.updateProjectionMatrix();
    }

    layout(false);
    fitCamera(0, 0);

    stage.onResize(function (w, h) {
      var two = canStack && w > 0 && w < 520;
      if (two !== twoLine) layout(two);
      fitCamera(w, h);
      if (stage.reduced) frame(0, STATIC_T);
    });

    /* ---- animation state ------------------------------------------------ */
    var ordMid = (geo.glyphs.length - 1) / 2;
    var DUR = 1.0, STAGGER = 0.078;
    var FULL = DUR + STAGGER * letters.length;
    var eT = stage.reduced ? FULL : 0;
    var playing = false, started = false;
    var progress = 0, progressT = 0, kick = 0;
    var rotX = 0, rotY = 0;

    /* t = 1.7 puts the static (reduced-motion) frame on a hair of yaw with
       the sweep across the left third, instead of dead flat-on. */
    var STATIC_T = 1.7;

    function frame(dt, t) {
      progress = damp(progress, progressT, 0.08, dt);
      kick = Math.max(0, kick - dt * 2.2);
      if (playing) { eT += dt; if (eT >= FULL) { eT = FULL; playing = false; } }

      /* The whole word leans toward the cursor over a slow drift that never
         stops — without it a long lens flattens the extrusion out of
         existence. Both stay small: the word is nine cap heights wide, so
         every extra degree of yaw scales the near end against the far one
         and the letters stop matching the drawing. */
      rotY = damp(rotY, clamp(S.px, -1, 1) * 0.15, 0.05, dt);
      rotX = damp(rotX, clamp(-S.py, -1, 1) * 0.10, 0.05, dt);
      root.rotation.set(
        rotX + Math.sin(t * 0.23) * 0.020 - progress * 0.26,
        rotY + Math.sin(t * 0.29) * 0.042 + progress * 0.55,
        Math.sin(t * 0.17) * 0.006 + progress * 0.05
      );
      root.position.y = -progress * 0.30;

      camera.position.set(0, 0, baseDist * (1 + progress * 0.20));
      camera.lookAt(0, 0, 0);

      var n = letters.length;
      for (var i = 0; i < n; i++) {
        var L = letters[i];
        var u = clamp((eT - L.delay) / DUR, 0, 1);
        var e = u >= 1 ? 1 : 1 - Math.pow(2, -9 * u);      /* expo out */
        var k = 1 - e;
        var sep = (L.ord - ordMid) * progress * 0.62;
        L.obj.position.set(
          L.hx + k * L.fx,
          L.hy + Math.sin(t * 0.85 + L.phase) * 0.020 * e,
          k * -baseDist * 0.72 + sep
        );
        if (L.spin) {
          /* The diamond keeps turning on its own axis, entrance or not, and
             the phase is tied to STATIC_T so the still frame catches it face
             on. The turn is not linear: subtracting sin(2th) makes it dwell
             where it reads as a diamond and whip through the edge-on quarter,
             which a constant spin parks it in for a third of every cycle. */
          var th = (t - STATIC_T) * 0.95;
          L.obj.rotation.set(
            k * L.rx + Math.sin((t - STATIC_T) * 0.63) * 0.26,
            k * L.ry + th - Math.sin(th * 2) * 0.45,
            k * L.rz
          );
        } else {
          /* a degree or two each, no more: past that the baseline reads as
             wobbly rather than as alive */
          L.obj.rotation.set(
            k * L.rx + Math.sin(t * 0.72 + L.phase * 1.7) * 0.022 * e,
            k * L.ry + Math.sin(t * 0.61 + L.phase) * 0.030 * e,
            k * L.rz + Math.sin(t * 0.53 + L.phase * 1.3) * 0.010 * e
          );
        }
        L.obj.scale.setScalar((0.58 + 0.42 * e) * (1 + kick * 0.09));
      }

      /* light sweep: travels across the word, then rests off the right edge */
      var travel = boxW + 3.4;
      uSweep.value = -boxW / 2 - 1.4 + (t * 0.20 % 1) * travel;
      uKick.value = kick;
      var lit = clamp(eT / FULL, 0, 1);
      glowMat.opacity = (0.055 + Math.sin(t * 0.9) * 0.012 + kick * 0.16) * lit;
      if (accentObj) {
        /* enough halo to make the diamond the liveliest thing in the frame,
           not so much that its own colour blows out to yellow */
        accentObj.userData.halo.opacity =
          (0.26 + Math.sin(t * 1.7) * 0.06 + kick * 0.45) * lit;
      }

      word.updateWorldMatrix(true, false);
      uWordInv.value.copy(word.matrixWorld).invert();
    }
    stage.onFrame(frame);

    function still() { frame(0, STATIC_T); stage.renderOnce(); }

    function play() {
      started = true;                    /* a manual play disarms the auto one */
      word.visible = true; glow.visible = true;
      if (stage.reduced) {
        eT = FULL; playing = false;
        still();
        return;
      }
      eT = 0; playing = true;
      stage.start();
    }

    if (stage.reduced) {
      /* Reduced motion: the finished word, one frame, no loop, ever. */
      started = true;
      still();
    } else {
      /* Hidden until the entrance is armed. A canvas still below the fold
         never runs a frame, so without this it would sit on whatever the
         first paint happened to catch — letters frozen halfway through the
         fly-in, which looks broken rather than pending. */
      word.visible = false;
      glow.visible = false;
      stage.onVisible(function () { if (!started) play(); });
      still();
      stage.start();
    }

    var handle = {
      dispose: function () { stage.dispose(); },
      play: play,
      setProgress: function (p) {
        p = clamp(Number(p) || 0, 0, 1);
        progressT = p;
        if (stage.reduced) { progress = p; still(); }
      },
      pulse: function (strength) {
        var s = clamp(strength === undefined ? 1 : Number(strength) || 0, 0, 3);
        kick = Math.min(1.6, kick + s);
        if (stage.reduced) { uKick.value = kick; stage.renderOnce(); }
      },
      setPaused: function (v) { stage.setPaused(v); },
      setAccent: function (hex) {
        var h = toHex(hex);
        if (h === null) return;
        uAccent.value.setHex(h);
        glowMat.color.setHex(h);
        if (accentObj) accentObj.userData.halo.color.setHex(h);
        if (stage.reduced) stage.renderOnce();
      }
    };
    if (toHex(opts.accent) !== null) handle.setAccent(opts.accent);
    if (typeof opts.progress === 'number') handle.setProgress(opts.progress);
    return handle;
  }

  /* ============================================================
     SCENE 4 — Ambient lattice (full-page background)
     ------------------------------------------------------------
     Two draw calls, a few hundred vertices, everything static in
     buffers: the whole point is that this can sit behind every page
     without costing anything. It self-throttles if it is wrong.
     ============================================================ */

  function buildAmbient(THREE, canvas, opts) {
    var stage = createStage(THREE, canvas, opts, { fov: 58, dist: 6, far: 240 });
    if (!stage) return null;

    var scene = stage.scene, camera = stage.camera, S = stage.state;
    var tex = stage.track(glowTexture(THREE));

    var grid = new THREE.Group();
    scene.add(grid);

    /* Lattice extents. The near cells sit almost on the camera plane and the
       far ones fall short of the frustum edges, so the graph reads as a slice
       of something much larger rather than a box floating in the middle. */
    var GX = 8, GY = 6, GZ = 10;
    var SPX = 120, SPY = 76, SPZ = 90, Z0 = 3;
    var CELLX = SPX / (GX - 1), CELLY = SPY / (GY - 1), CELLZ = SPZ / (GZ - 1);

    function fade(z) {
      var d = camera.position.z - z;
      return clamp((d - 5) / 13, 0, 1) * (1 - clamp((d - 46) / 42, 0, 1));
    }

    var nodes = [], ix, iy, iz;
    for (ix = 0; ix < GX; ix++) {
      for (iy = 0; iy < GY; iy++) {
        for (iz = 0; iz < GZ; iz++) {
          nodes.push([
            -SPX / 2 + ix * CELLX + rand(-0.36, 0.36) * CELLX,
            -SPY / 2 + iy * CELLY + rand(-0.36, 0.36) * CELLY,
            Z0 - iz * CELLZ + rand(-0.36, 0.36) * CELLZ
          ]);
        }
      }
    }
    function nodeAt(a, b, c) { return (a * GY + b) * GZ + c; }

    var segs = [];
    for (ix = 0; ix < GX; ix++) {
      for (iy = 0; iy < GY; iy++) {
        for (iz = 0; iz < GZ; iz++) {
          var i0 = nodeAt(ix, iy, iz);
          if (ix + 1 < GX && Math.random() < 0.46) segs.push([i0, nodeAt(ix + 1, iy, iz)]);
          if (iy + 1 < GY && Math.random() < 0.40) segs.push([i0, nodeAt(ix, iy + 1, iz)]);
          if (iz + 1 < GZ && Math.random() < 0.42) segs.push([i0, nodeAt(ix, iy, iz + 1)]);
        }
      }
    }

    /* Both buffers get shuffled so that drawing only a prefix (the density
       control and the self-throttle both do exactly that) thins the lattice
       evenly instead of chopping off one side of it. Note `segs` holds indices
       into `nodes`, so the node array itself must not be reordered — the point
       cloud is shuffled through a separate index list. */
    function shuffle(a) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    shuffle(segs);

    var NODE_N = nodes.length, SEG_N = segs.length;
    var nPos = new Float32Array(NODE_N * 3), nCol = new Float32Array(NODE_N * 3);
    var i, f, order = [];
    for (i = 0; i < NODE_N; i++) order.push(i);
    shuffle(order);
    for (i = 0; i < NODE_N; i++) {
      var np = nodes[order[i]];
      nPos[i * 3] = np[0]; nPos[i * 3 + 1] = np[1]; nPos[i * 3 + 2] = np[2];
      f = fade(np[2]);
      nCol[i * 3] = nCol[i * 3 + 1] = nCol[i * 3 + 2] = f;
    }

    var sPos = new Float32Array(SEG_N * 6), sCol = new Float32Array(SEG_N * 6);
    for (i = 0; i < SEG_N; i++) {
      for (var e = 0; e < 2; e++) {
        var p = nodes[segs[i][e]], o = i * 6 + e * 3;
        sPos[o] = p[0]; sPos[o + 1] = p[1]; sPos[o + 2] = p[2];
        f = fade(p[2]);
        sCol[o] = sCol[o + 1] = sCol[o + 2] = f;
      }
    }

    var lineGeo = stage.track(new THREE.BufferGeometry());
    lineGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    var lineMat = stage.track(new THREE.LineBasicMaterial({
      color: NEON, vertexColors: true, transparent: true, opacity: 0.038,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    var lines = new THREE.LineSegments(lineGeo, lineMat);
    lines.frustumCulled = false;
    grid.add(lines);

    var nodeGeo = stage.track(new THREE.BufferGeometry());
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
    nodeGeo.setAttribute('color', new THREE.BufferAttribute(nCol, 3));
    var nodeMat = stage.track(new THREE.PointsMaterial({
      color: NEON, map: tex, size: 0.70, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.085, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    var points = new THREE.Points(nodeGeo, nodeMat);
    points.frustumCulled = false;
    grid.add(points);

    /* ---- density: user knob x self-throttle ---- */
    var densityUser = 1, densityAuto = 1;
    function applyDensity() {
      var d = clamp(densityUser * densityAuto, 0, 1);
      nodeGeo.setDrawRange(0, Math.max(8, Math.round(NODE_N * d)));
      lineGeo.setDrawRange(0, Math.max(8, Math.round(SEG_N * d)) * 2);
    }
    applyDensity();

    /* ---- self-throttle ----
       Two signals, because either can be the thing that hurts:
         cpu — a microtask queued at the top of the frame runs after the render
               call returns, so it times the frame's whole main-thread cost;
         dt  — the rAF cadence, which is what catches a GPU that cannot keep up
               (there the render call returns instantly and cpu looks fine).
       Median of 60 real frames, warm-up skipped. One node-count cut, then a
       freeze if that was not enough. Medians over ~60 frames, twice in a row,
       so a one-off hitch elsewhere on the page cannot trip it. */
    var perf = global.performance && global.performance.now ? global.performance : null;
    var probeStage = perf && global.Promise ? 0 : 2;
    var probeSkip = 0, cpuBuf = [], dtBuf = [];
    var frozen = false;

    function median(a) {
      a.sort(function (x, y) { return x - y; });
      return a[a.length >> 1];
    }

    function judge(ms) {
      if (probeStage > 1) return;
      if (probeSkip < 10) { probeSkip++; return; }
      cpuBuf.push(ms);
      if (cpuBuf.length < 60 || dtBuf.length < 60) return;
      var cpu = median(cpuBuf), lag = median(dtBuf);
      cpuBuf = []; dtBuf = []; probeSkip = 0;
      if (probeStage === 0) {
        if (cpu > 5.5 || lag > 38) { densityAuto = 0.5; applyDensity(); probeStage = 1; }
        else probeStage = 2;
      } else {
        if (cpu > 9 || lag > 46) { frozen = true; stage.setPaused(true); }
        probeStage = 2;
      }
    }

    var progress = 0, progressT = 0, mx = 0, my = 0, kick = 0, lastT = 0;

    function frame(dt, t) {
      lastT = t;
      if (probeStage < 2) {
        var t0 = perf.now();
        if (dt > 0) dtBuf.push(dt * 1000);
        global.Promise.resolve().then(function () { judge(perf.now() - t0); });
      }

      progress = damp(progress, progressT, 0.07, dt);
      kick = Math.max(0, kick - dt * 1.6);
      mx = damp(mx, clamp(S.px, -1, 1) * 3.4, 0.02, dt);
      my = damp(my, clamp(S.py, -1, 1) * 2.2, 0.02, dt);

      grid.position.set(
        mx + Math.sin(t * 0.017) * 3.0,
        my + progress * 17 + Math.cos(t * 0.013) * 2.2,
        Math.sin(t * 0.021) * 4.0 + progress * 5
      );
      grid.rotation.set(
        Math.cos(t * 0.009) * 0.05,
        Math.sin(t * 0.011) * 0.10 + progress * 0.06,
        Math.sin(t * 0.007) * 0.03
      );
      lineMat.opacity = 0.038 * (1 + kick * 1.6);
      nodeMat.opacity = 0.085 * (1 + kick * 1.6);
    }
    stage.onFrame(frame);

    /* Re-runs the frame at the time it last saw, so redrawing a frozen or
       reduced-motion scene never snaps the drift back to t = 0. */
    function still() { frame(0, lastT); stage.renderOnce(); }

    still();
    stage.start();

    var handle = {
      dispose: function () { stage.dispose(); },
      setProgress: function (p) {
        p = clamp(Number(p) || 0, 0, 1);
        progressT = p;
        if (stage.reduced || frozen) { progress = p; still(); }
      },
      pulse: function (strength) {
        var s = clamp(strength === undefined ? 1 : Number(strength) || 0, 0, 3);
        kick = Math.min(1.4, kick + s);
        if (stage.reduced || frozen) still();
      },
      setPaused: function (v) {
        if (frozen && !v) return;          /* a frozen scene stays frozen */
        stage.setPaused(v);
      },
      setAccent: function (hex) {
        var h = toHex(hex);
        if (h === null) return;
        lineMat.color.setHex(h);
        nodeMat.color.setHex(h);
        if (stage.reduced || frozen) stage.renderOnce();
      },
      setDensity: function (d) {
        densityUser = clamp(Number(d), 0, 1) || 0;
        applyDensity();
        if (stage.reduced || frozen) stage.renderOnce();
      }
    };
    if (toHex(opts.accent) !== null) handle.setAccent(opts.accent);
    if (typeof opts.progress === 'number') handle.setProgress(opts.progress);
    if (typeof opts.density === 'number') handle.setDensity(opts.density);
    return handle;
  }

  /* ============================================================
     Public API
     ============================================================ */

  global.Strix3D = {
    available: available,
    core: function (canvas, opts) { return boot(canvas, opts, buildCore); },
    passport: function (canvas, opts) { return boot(canvas, opts, buildPassport); },
    wordmark: function (canvas, opts) {
      /* warm the artwork alongside the three.js import instead of after it */
      if (canvas && canvas.getContext && available()) loadWordmarkGeo();
      return boot(canvas, opts, buildWordmark);
    },
    ambient: function (canvas, opts) { return boot(canvas, opts, buildAmbient); }
  };

})(window);
