// Hero 3D scene: a cluster of floating UI components (cards, buttons, toggles,
// sliders, charts) that follows the pointer and spreads apart on scroll.
import * as THREE from "../vendor/three.module.min.js";

const canvas = document.querySelector(".hero-canvas");
const hero = document.querySelector(".hero");
const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) {
    return false;
  }
}

if (!canvas || !hero || !webglAvailable()) {
  root.classList.add("no-webgl");
} else {
  init();
}

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1d33, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-6, 8, 10);
  scene.add(key);
  const rim = new THREE.PointLight(0x5b76ff, 90, 0, 2);
  rim.position.set(3, -1, -5);
  scene.add(rim);
  const fill = new THREE.PointLight(0x9fb0ff, 30, 0, 2);
  fill.position.set(6, 4, 6);
  scene.add(fill);

  // Palette per theme
  const palettes = {
    dark: { base: 0x1a1c27, raised: 0x262a3b, light: 0xe7e9f2, detail: 0x3b4058, detailOnLight: 0xb9bdd0, accent: 0x5b76ff, particle: 0x8fa0ff, hemiGround: 0x1a1d33 },
    light: { base: 0xffffff, raised: 0xe3e7f3, light: 0x1c1f2c, detail: 0xd3d7e6, detailOnLight: 0x3a3f55, accent: 0x2447e6, particle: 0x2447e6, hemiGround: 0xc9cfe6 },
  };

  const mats = {
    base: new THREE.MeshPhysicalMaterial({ roughness: 0.38, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.25 }),
    raised: new THREE.MeshPhysicalMaterial({ roughness: 0.45, metalness: 0.1, clearcoat: 0.6 }),
    light: new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.05, clearcoat: 1 }),
    accent: new THREE.MeshPhysicalMaterial({ roughness: 0.25, metalness: 0.2, clearcoat: 1, emissiveIntensity: 0.35 }),
    detail: new THREE.MeshBasicMaterial(),
    detailOnLight: new THREE.MeshBasicMaterial(),
    detailAccent: new THREE.MeshBasicMaterial(),
  };

  function currentTheme() {
    const t = root.getAttribute("data-theme");
    return t === "light" ? "light" : "dark";
  }

  function applyTheme() {
    const p = palettes[currentTheme()];
    mats.base.color.setHex(p.base);
    mats.raised.color.setHex(p.raised);
    mats.light.color.setHex(p.light);
    mats.accent.color.setHex(p.accent);
    mats.accent.emissive.setHex(p.accent);
    mats.detail.color.setHex(p.detail);
    mats.detailOnLight.color.setHex(p.detailOnLight);
    mats.detailAccent.color.setHex(p.accent);
    particles.material.color.setHex(p.particle);
    ring.material.color.setHex(p.accent);
    rim.color.setHex(p.accent);
    hemi.groundColor.setHex(p.hemiGround);
    if (reduceMotion.matches) render();
  }

  // Geometry helpers
  function roundedShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
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
  function slab(w, h, r, depth, mat) {
    const geo = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
      depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 12,
    });
    geo.center();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.front = depth / 2 + 0.035;
    return mesh;
  }
  // Flat detail drawn on the front face of a slab
  function face(parent, w, h, r, x, y, mat, lift = 0) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(w, h, r), 10), mat);
    m.position.set(x, y, parent.userData.front + 0.002 + lift);
    parent.add(m);
    return m;
  }
  function disc(parent, radius, x, y, mat, lift = 0) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), mat);
    m.position.set(x, y, parent.userData.front + 0.004 + lift);
    parent.add(m);
    return m;
  }

  // Components
  const cluster = new THREE.Group();
  scene.add(cluster);
  const items = [];
  function add(obj, pos, rot, float = 1) {
    obj.position.set(...pos);
    obj.rotation.set(...rot);
    obj.userData.base = new THREE.Vector3(...pos);
    obj.userData.rot = new THREE.Euler(...rot);
    obj.userData.phase = Math.random() * Math.PI * 2;
    obj.userData.float = float;
    cluster.add(obj);
    items.push(obj);
    return obj;
  }

  // Product card with image, text lines and a button
  const card = slab(3.2, 2.3, 0.22, 0.12, mats.base);
  face(card, 2.9, 1.05, 0.14, 0, 0.47, mats.detailAccent);
  face(card, 1.9, 0.12, 0.06, -0.5, -0.3, mats.detail);
  face(card, 1.3, 0.1, 0.05, -0.8, -0.52, mats.detail);
  face(card, 0.9, 0.32, 0.16, 0.95, -0.82, mats.detailAccent);
  add(card, [-0.4, 0.5, 0.4], [-0.12, 0.35, 0.04]);

  // Profile card
  const profile = slab(2.3, 1.15, 0.2, 0.1, mats.base);
  disc(profile, 0.3, -0.72, 0, mats.detailAccent);
  face(profile, 1.1, 0.12, 0.06, 0.28, 0.15, mats.detail);
  face(profile, 0.8, 0.1, 0.05, 0.13, -0.1, mats.detail);
  add(profile, [2.3, 2.2, -1.2], [0.15, -0.35, -0.06]);

  // Primary button
  const button = slab(1.7, 0.56, 0.28, 0.16, mats.accent);
  face(button, 0.8, 0.1, 0.05, 0, 0, mats.detailOnLight);
  button.children[0].material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(button, [1.9, -1.2, 1.4], [0.2, -0.45, 0.08]);

  // Toggle
  const toggle = slab(1.05, 0.54, 0.27, 0.14, mats.raised);
  disc(toggle, 0.2, 0.24, 0, mats.detailAccent);
  add(toggle, [-2.6, -1.6, 0.9], [0.1, 0.5, -0.1]);

  // Slider
  const slider = slab(2.2, 0.5, 0.25, 0.1, mats.base);
  face(slider, 1.8, 0.07, 0.035, 0, 0, mats.detail);
  face(slider, 1.0, 0.07, 0.035, -0.4, 0, mats.detailAccent, 0.001);
  disc(slider, 0.13, 0.1, 0, mats.detailOnLight, 0.002);
  slider.children[2].material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(slider, [-1.9, 2.6, -0.6], [0.3, 0.3, 0.05]);

  // Chart card with 3D bars
  const chart = slab(2.1, 1.6, 0.2, 0.1, mats.base);
  [0.45, 0.8, 0.6, 1.05, 0.75].forEach((h, i) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, 0.14), i === 3 ? mats.accent : mats.raised);
    bar.position.set(-0.7 + i * 0.35, -0.6 + h / 2, chart.userData.front + 0.07);
    chart.add(bar);
  });
  add(chart, [2.9, 0.4, -2.2], [0.05, -0.55, 0.02]);

  // Icon tiles
  const tileA = slab(0.78, 0.78, 0.2, 0.18, mats.light);
  disc(tileA, 0.16, 0, 0, mats.detailAccent);
  add(tileA, [0.6, -2.4, -0.4], [0.4, 0.2, 0.3]);
  const tileB = slab(0.7, 0.7, 0.18, 0.16, mats.raised);
  face(tileB, 0.34, 0.08, 0.04, 0, 0.08, mats.detailAccent);
  face(tileB, 0.34, 0.08, 0.04, 0, -0.08, mats.detail);
  add(tileB, [-2.7, 0.9, -1.6], [-0.2, 0.6, -0.2]);

  // Colour swatches
  const swatch = slab(1.8, 0.62, 0.31, 0.1, mats.base);
  disc(swatch, 0.17, -0.5, 0, mats.detailAccent);
  disc(swatch, 0.17, 0, 0, mats.detailOnLight);
  disc(swatch, 0.17, 0.5, 0, mats.detail);
  add(swatch, [-0.9, -2.9, 1.8], [0.35, 0.15, -0.05]);

  // Glossy spheres
  const sphereGeo = new THREE.SphereGeometry(1, 48, 48);
  [[3.6, 2.8, 0.6, 0.26, mats.accent], [-2.4, 3.4, 1.4, 0.18, mats.light], [1.2, 3.2, 1.2, 0.14, mats.light], [-1.3, -1.1, -2.6, 0.32, mats.accent]]
    .forEach(([x, y, z, s, m]) => {
      const sp = new THREE.Mesh(sphereGeo, m);
      sp.scale.setScalar(s);
      sp.userData.front = 0;
      add(sp, [x, y, z], [0, 0, 0], 1.6);
    });

  // Orbit ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.012, 8, 200), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45 }));
  ring.rotation.set(1.2, 0.2, 0);
  cluster.add(ring);

  // Particles
  const count = 380;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 5 + Math.random() * 9;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
    positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.6;
    positions[i * 3 + 2] = r * Math.cos(ph) - 4;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.7, sizeAttenuation: true }));
  scene.add(particles);

  // Layout: cluster sits right of the copy on wide screens, above it on narrow ones
  let layout = { x: 4.3, y: 0, scale: 0.95 };
  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const aspect = w / h;
    if (aspect < 0.9) layout = { x: 0, y: 2.0, scale: 0.46 };
    else if (aspect < 1.35) layout = { x: 2.6, y: 0.3, scale: 0.78 };
    else layout = { x: 4.3, y: 0, scale: 0.95 };
    cluster.scale.setScalar(layout.scale);
    if (reduceMotion.matches) render();
  }

  // Pointer parallax
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // Only render while the hero is on screen
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 }).observe(hero);

  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();

  function update(t) {
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    // Scroll progress through the hero, 0 at top, 1 when it has scrolled away
    const rect = hero.getBoundingClientRect();
    const p = Math.min(Math.max(-rect.top / rect.height, 0), 1);
    const spread = 1 + p * 0.9;

    cluster.position.set(layout.x, layout.y + p * 1.5, 0);
    cluster.rotation.y = -0.25 + pointer.x * 0.35 + Math.sin(t * 0.15) * 0.12 + p * 0.9;
    cluster.rotation.x = 0.05 + pointer.y * 0.22 + p * 0.35;

    items.forEach((o) => {
      const d = o.userData;
      tmp.copy(d.base).multiplyScalar(spread);
      tmp.y += Math.sin(t * 0.8 + d.phase) * 0.12 * d.float;
      o.position.copy(tmp);
      o.rotation.x = d.rot.x + Math.sin(t * 0.5 + d.phase) * 0.06;
      o.rotation.y = d.rot.y + Math.cos(t * 0.4 + d.phase) * 0.08;
    });

    ring.rotation.z = t * 0.06;
    particles.rotation.y = t * 0.015 + pointer.x * 0.05;
    camera.position.z = 16 + p * 5;
    canvas.style.opacity = String(1 - p * 0.85);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!visible || reduceMotion.matches) return;
    update(clock.getElapsedTime());
    render();
  }

  // Theme changes from the toggle
  new MutationObserver(applyTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  window.addEventListener("resize", resize);
  resize();
  applyTheme();
  update(0);
  render();
  loop();
  reduceMotion.addEventListener("change", () => { update(clock.getElapsedTime()); render(); });
  canvas.classList.add("ready");
}
