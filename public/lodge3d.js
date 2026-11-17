/* Hollowmere — the 3D lodge.
   A candlelit room where every member of the lodge stands around the table and
   acts out the game: leaning over quests, pointing at council votes, walking out
   when exiled, vanishing in the night. It only reads the same view the page
   already has, so it never knows more than the player does. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.getElementById('scene3d');
const view = host.querySelector('.view');
const layer = host.querySelector('.labels');
const coarse = matchMedia('(pointer: coarse)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- renderer, camera ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
view.appendChild(renderer.domElement);
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', 'The lodge in 3D. Drag to look around, double-tap the floor to walk, arrow keys to move.');
const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080a);
scene.fog = new THREE.FogExp2(0x0b0f12, 0.028);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
camera.position.set(0, 3.4, 6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2.2;
controls.maxDistance = 7.2;
controls.minPolarAngle = 0.3;
controls.maxPolarAngle = 1.45;
controls.rotateSpeed = 0.6;

const resize = () => {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.9 ? 62 : 50;
  camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(host);
resize();

/* ---------------- painted textures ---------------- */
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}
function speckle(g, w, h, a, n) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() * 255 | 0;
    g.fillStyle = `rgba(${v},${v},${v},${a})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
function planks(g, w, h, rows, hue, light) {
  for (let r = 0; r < rows; r++) {
    const y = r * h / rows, ph = h / rows;
    let x = -Math.random() * 200;
    while (x < w) {
      const len = 160 + Math.random() * 240;
      g.fillStyle = `hsl(${hue + Math.random() * 8},${34 + Math.random() * 14}%,${light + Math.random() * 9}%)`;
      g.fillRect(x, y, len, ph);
      g.lineWidth = 0.7;
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = `rgba(25,12,4,${0.12 + Math.random() * 0.25})`;
        g.beginPath();
        const y0 = y + Math.random() * ph;
        g.moveTo(x, y0);
        for (let xx = 0; xx <= len; xx += 16) g.lineTo(x + xx, y0 + Math.sin(xx * 0.025 + k * 1.7) * 2.2);
        g.stroke();
      }
      g.fillStyle = 'rgba(8,4,2,.75)'; g.fillRect(x, y, 2, ph);
      x += len;
    }
    g.fillStyle = 'rgba(8,4,2,.85)'; g.fillRect(0, y, w, 2);
  }
  speckle(g, w, h, 0.05, 5000);
}
const floorTex = canvasTex(512, 512, (g, w, h) => planks(g, w, h, 8, 24, 20), 4, 3.5);
const tableTex = canvasTex(512, 512, (g, w, h) => planks(g, w, h, 5, 16, 15));
const stoneTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#242322'; g.fillRect(0, 0, w, h);
  let y = 0;
  while (y < h) {
    const rh = 24 + Math.random() * 18; let x = -Math.random() * 40;
    while (x < w) { const rw = 34 + Math.random() * 40; g.fillStyle = `hsl(30,6%,${26 + Math.random() * 16}%)`; g.fillRect(x + 2, y + 2, rw - 4, rh - 4); x += rw; }
    y += rh;
  }
  speckle(g, w, h, 0.12, 4000);
}, 1.6, 1.4);
const wallTex = canvasTex(512, 538, (g, w, h) => {
  const split = h * (1 - 1.35 / 4.2);
  g.fillStyle = '#46534c'; g.fillRect(0, 0, w, split);
  for (let x = 0; x < w; x += 32) { g.fillStyle = x % 64 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.06)'; g.fillRect(x, 0, 16, split); }
  g.fillStyle = 'rgba(214,190,140,.08)';
  for (let y = 20, r = 0; y < split; y += 48, r++) for (let x = (r % 2) * 32; x < w; x += 64) { g.beginPath(); g.ellipse(x + 16, y, 6, 11, 0, 0, TAU); g.fill(); }
  speckle(g, w, split, 0.05, 6000);
  g.fillStyle = '#2a1a10'; g.fillRect(0, split - 6, w, 12);
  g.fillStyle = '#3a2516'; g.fillRect(0, split + 6, w, h - split);
  for (let x = 8; x < w; x += 128) {
    g.fillStyle = '#31200f'; g.fillRect(x, split + 22, 112, h - split - 44);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.strokeRect(x, split + 22, 112, h - split - 44);
    g.strokeStyle = 'rgba(255,220,180,.07)'; g.lineWidth = 1; g.strokeRect(x + 3, split + 25, 106, h - split - 50);
  }
  g.fillStyle = '#1c120a'; g.fillRect(0, h - 14, w, 14);
  speckle(g, w, h, 0.04, 3000);
});
const rugTex = canvasTex(512, 512, (g, w) => {
  const c = w / 2;
  const ring = (r, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); };
  g.fillStyle = '#4f1a1c'; g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
  ring(246, '#22141f', 18); ring(230, '#a8834a', 6); ring(212, '#2a1620', 10);
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.fillStyle = i % 2 ? '#8a6a3a' : '#2c2230'; g.beginPath(); g.ellipse(c + Math.cos(a) * 180, c + Math.sin(a) * 180, 9, 20, a, 0, TAU); g.fill(); }
  ring(150, '#6e2622', 30); ring(118, '#a8834a', 4);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.fillStyle = '#2c2230'; g.beginPath(); g.ellipse(c + Math.cos(a) * 70, c + Math.sin(a) * 70, 16, 40, a + Math.PI / 2, 0, TAU); g.fill(); }
  g.fillStyle = '#a8834a'; g.beginPath(); g.arc(c, c, 26, 0, TAU); g.fill();
  speckle(g, w, w, 0.08, 9000);
});
const nightTex = canvasTex(512, 384, (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#060c18'); sky.addColorStop(0.65, '#1a2b40'); sky.addColorStop(1, '#2a3d4c');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.6})`; g.fillRect(Math.random() * w, Math.random() * h * 0.55, 1, 1); }
  const mg = g.createRadialGradient(370, 90, 6, 370, 90, 90);
  mg.addColorStop(0, 'rgba(230,236,255,1)'); mg.addColorStop(0.18, 'rgba(210,220,250,.9)'); mg.addColorStop(0.22, 'rgba(160,180,230,.25)'); mg.addColorStop(1, 'rgba(120,140,200,0)');
  g.fillStyle = mg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#05080c';
  for (let x = 0; x < w; x += 3) { const hh = 40 + Math.sin(x * 0.05) * 10 + Math.random() * 30; g.fillRect(x, h - hh, 2, hh); }
  g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 16) g.lineTo(x, h - 70 - Math.sin(x * 0.012) * 26 - Math.random() * 8); g.lineTo(w, h); g.fill();
  const mist = g.createLinearGradient(0, h - 110, 0, h);
  mist.addColorStop(0, 'rgba(150,170,190,0)'); mist.addColorStop(1, 'rgba(150,170,190,.35)');
  g.fillStyle = mist; g.fillRect(0, h - 110, w, 110);
});
nightTex.wrapS = nightTex.wrapT = THREE.ClampToEdgeWrapping;
const paintingTex = canvasTex(256, 160, (g, w, h) => {
  const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#3b3324'); s.addColorStop(0.6, '#7a5a34'); s.addColorStop(1, '#2a2a1e');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(240,200,120,.55)'; g.beginPath(); g.arc(190, 70, 16, 0, TAU); g.fill();
  g.fillStyle = '#1d1a12'; g.beginPath(); g.moveTo(0, 120); for (let x = 0; x <= w; x += 8) g.lineTo(x, 110 + Math.sin(x * 0.04) * 8); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.fillStyle = '#2b2a1f'; g.fillRect(60, 80, 26, 36); g.beginPath(); g.moveTo(54, 82); g.lineTo(73, 62); g.lineTo(92, 82); g.fill();
  speckle(g, w, h, 0.1, 2500);
});
const glowTex = canvasTex(64, 64, (g, w) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping;

/* ---------------- materials and helpers ---------------- */
const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra));
const M = {
  floor: std(0xffffff, 0.75, { map: floorTex }),
  wall: std(0xffffff, 0.92, { map: wallTex }),
  ceiling: std(0x1c130c, 0.95),
  beam: std(0x24170d, 0.9),
  darkWood: std(0x2e1d11, 0.7),
  table: std(0xffffff, 0.45, { map: tableTex }),
  stone: std(0xffffff, 0.95, { map: stoneTex }),
  soot: std(0x050403, 1),
  brass: std(0xb08a45, 0.35, { metalness: 0.85 }),
  iron: std(0x2a2a2c, 0.5, { metalness: 0.7 }),
  wax: std(0xf1e6cc, 0.6),
  parchment: std(0xd9c49a, 0.9),
  cloth: std(0x5a5246, 0.95, { side: THREE.DoubleSide }),
  curtain: std(0x5a1e24, 0.95, { side: THREE.DoubleSide }),
  rug: std(0xffffff, 0.98, { map: rugTex }),
  glass: std(0x9fb8d0, 0.1, { transparent: true, opacity: 0.12, metalness: 0.2 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
};
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);

/* ---------------- the room ---------------- */
const H = 4.2;
const floor = mesh(new THREE.PlaneGeometry(16, 14), M.floor, 0, 0, 0, scene, false);
floor.rotation.x = -Math.PI / 2;
const rug = mesh(new THREE.CircleGeometry(3.6, 64), M.rug, 0, 0.006, 0, scene, false);
rug.rotation.x = -Math.PI / 2;
const ceiling = mesh(new THREE.PlaneGeometry(16, 14), M.ceiling, 0, H, 0, scene, false);
ceiling.rotation.x = Math.PI / 2;
for (let z = -5; z <= 5; z += 2.5) mesh(box(16, 0.26, 0.3), M.beam, 0, H - 0.13, z, scene, false);

function wall(w, h, along, cy, x, z, ry) {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv, p = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + along) / 4, (p.getY(i) + cy) / H);
  const m = mesh(geo, M.wall, x, cy, z, scene, false);
  m.rotation.y = ry;
}
wall(16, H, 0, H / 2, 0, -7, 0);                       // north, fireplace
wall(14, H, 0, H / 2, -8, 0, Math.PI / 2);             // west, bookshelves
wall(7.35, H, -4.325, H / 2, -4.325, 7, Math.PI);      // south, door gap in the middle
wall(7.35, H, 4.325, H / 2, 4.325, 7, Math.PI);
wall(1.3, H - 2.35, 0, 2.35 + (H - 2.35) / 2, 0, 7, Math.PI);
wall(5.8, H, -4.1, H / 2, 8, -4.1, -Math.PI / 2);      // east, window gap
wall(5.8, H, 4.1, H / 2, 8, 4.1, -Math.PI / 2);
wall(2.4, 1, 0, 0.5, 8, 0, -Math.PI / 2);
wall(2.4, H - 2.8, 0, 2.8 + (H - 2.8) / 2, 8, 0, -Math.PI / 2);

/* fireplace */
mesh(box(2.9, 2.3, 0.5), M.stone, 0, 1.15, -6.75);
mesh(box(1.45, 1.15, 0.54), M.soot, 0, 0.6, -6.75, scene, false);
mesh(box(3.3, 0.12, 0.95), M.stone, 0, 0.06, -6.45);
mesh(box(3.3, 0.13, 0.7), M.darkWood, 0, 2.36, -6.62);
for (const x of [-0.2, 0.18]) { const l = mesh(cyl(0.07, 0.08, 0.8, 10), std(0x3a2414, 0.9), x, 0.2, -6.55); l.rotation.z = Math.PI / 2; l.rotation.y = x * 2; }
const flames = [];
for (let i = 0; i < 6; i++) {
  const f = mesh(new THREE.ConeGeometry(0.11 + Math.random() * 0.05, 0.5, 8, 1, true), M.flame, -0.3 + i * 0.12, 0.45, -6.5 + Math.random() * 0.06, scene, false);
  f.userData.seed = Math.random() * 10; flames.push(f);
}
const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7a28, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
fireGlow.position.set(0, 0.55, -6.35); fireGlow.scale.set(2.2, 1.6, 1); scene.add(fireGlow);
const painting = mesh(new THREE.PlaneGeometry(1.5, 0.94), std(0xffffff, 0.85, { map: paintingTex }), 0, 3.2, -6.94, scene, false);
mesh(box(1.66, 1.1, 0.05), M.brass, 0, 3.2, -6.97, scene, false);
painting.position.z = -6.93;

/* bookshelves on the west wall */
const bookColors = [0x5a1e1e, 0x1f3a2a, 0x22324a, 0x6a4a22, 0x3a2a3a, 0x7a6a4a, 0x2a2a2a, 0x4a2a12];
for (const zc of [-3.7, 3.7]) {
  const g = new THREE.Group(); g.position.set(-7.72, 0, zc); scene.add(g);
  mesh(box(0.5, 2.9, 2.3), M.darkWood, 0, 1.45, 0, g);
  const books = new THREE.InstancedMesh(box(1, 1, 1), std(0xffffff, 0.8), 120);
  books.castShadow = true; books.receiveShadow = true;
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  let k = 0;
  for (let s = 0; s < 5; s++) {
    const y = 0.25 + s * 0.55;
    mesh(box(0.46, 0.04, 2.2), M.darkWood, 0.04, y - 0.02, 0, g, false);
    let z = -1.05;
    while (z < 1.02 && k < 120) {
      const bw = 0.04 + Math.random() * 0.05, bh = 0.3 + Math.random() * 0.15;
      m4.compose(V(0.06, y + bh / 2, z + bw / 2), new THREE.Quaternion(), V(0.3, bh, bw));
      books.setMatrixAt(k, m4); books.setColorAt(k, col.setHex(bookColors[k % bookColors.length]).multiplyScalar(0.7 + Math.random() * 0.5));
      z += bw + 0.005; k++;
    }
  }
  books.count = k; books.position.x = 0.12; g.add(books);
}

/* grandfather clock and an armchair */
mesh(box(0.55, 2.3, 0.4), M.darkWood, 7.4, 1.15, -6.4);
const clockFace = mesh(new THREE.CircleGeometry(0.19, 32), std(0xe9dfc4, 0.6), 7.4, 1.85, -6.19, scene, false);
const clockHand = mesh(box(0.012, 0.15, 0.005), M.iron, 7.4, 1.85, -6.18, scene, false);
clockHand.geometry.translate(0, 0.06, 0);
const pendulum = new THREE.Group(); pendulum.position.set(7.4, 1.55, -6.18); scene.add(pendulum);
mesh(box(0.012, 0.6, 0.01), M.brass, 0, -0.3, 0, pendulum, false);
mesh(cyl(0.06, 0.06, 0.015, 20), M.brass, 0, -0.62, 0, pendulum, false).rotation.x = Math.PI / 2;
clockFace.rotation.y = 0;
const chair = new THREE.Group(); chair.position.set(-2.6, 0, -5.3); chair.rotation.y = 0.7; scene.add(chair);
const leather = std(0x4a1e14, 0.55);
mesh(box(0.9, 0.42, 0.85), leather, 0, 0.32, 0, chair); mesh(box(0.9, 0.85, 0.2), leather, 0, 0.82, -0.36, chair);
mesh(box(0.16, 0.6, 0.85), leather, -0.45, 0.5, 0, chair); mesh(box(0.16, 0.6, 0.85), leather, 0.45, 0.5, 0, chair);

/* the round table, candles, chandelier */
mesh(cyl(1.5, 1.5, 0.08, 64), M.table, 0, 0.8, 0);
mesh(cyl(1.52, 1.48, 0.05, 64), M.darkWood, 0, 0.74, 0);
mesh(cyl(0.16, 0.22, 0.7, 20), M.darkWood, 0, 0.38, 0);
mesh(cyl(0.6, 0.7, 0.07, 32), M.darkWood, 0, 0.035, 0);
const candleFlames = [];
function candle(x, z, h, parent = scene, y0 = 0.84) {
  mesh(cyl(0.06, 0.07, 0.03, 16), M.brass, x, y0 + 0.015, z, parent);
  mesh(cyl(0.025, 0.025, h, 12), M.wax, x, y0 + 0.03 + h / 2, z, parent);
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb455, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  f.position.set(x, y0 + 0.07 + h, z); f.scale.set(0.09, 0.16, 1); f.userData.seed = Math.random() * 10; parent.add(f);
  candleFlames.push(f);
}
candle(-0.35, 0.2, 0.22); candle(0.3, 0.28, 0.16); candle(0.05, -0.38, 0.28);
const chand = new THREE.Group(); chand.position.set(0, 3.35, 0); scene.add(chand);
mesh(cyl(0.012, 0.012, 0.85, 6), M.iron, 0, 0.42, 0, chand, false);
const ring = mesh(new THREE.TorusGeometry(0.7, 0.025, 8, 48), M.brass, 0, 0, 0, chand, false);
ring.rotation.x = Math.PI / 2;
for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; candle(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.12, chand, 0.0); }

/* the south door, with the night beyond */
const doorPivot = new THREE.Group(); doorPivot.position.set(-0.64, 0, 6.97); scene.add(doorPivot);
const doorWood = std(0x3a2212, 0.7);
mesh(box(1.26, 2.33, 0.07), doorWood, 0.63, 1.165, 0, doorPivot);
for (const y of [0.6, 1.65]) mesh(box(0.95, 0.75, 0.03), std(0x301a0d, 0.75), 0.63, y, -0.045, doorPivot);
mesh(new THREE.SphereGeometry(0.04, 12, 8), M.brass, 1.12, 1.05, -0.07, doorPivot);
mesh(box(0.12, 2.45, 0.2), M.darkWood, -0.71, 1.22, 6.95); mesh(box(0.12, 2.45, 0.2), M.darkWood, 0.71, 1.22, 6.95);
mesh(box(1.54, 0.12, 0.2), M.darkWood, 0, 2.42, 6.95);
const yard = mesh(new THREE.PlaneGeometry(6, 4), std(0x1b1d1f, 1), 0, 0.001, 9, scene, false); yard.rotation.x = -Math.PI / 2;
const doorSky = mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshBasicMaterial({ map: nightTex, fog: false }), 0, 2.2, 10.6, scene, false);
doorSky.rotation.y = Math.PI;

/* the east window: casements, curtains, rain */
const winSky = mesh(new THREE.PlaneGeometry(7, 5.2), new THREE.MeshBasicMaterial({ map: nightTex, fog: false }), 10.5, 2, 0, scene, false);
winSky.rotation.y = -Math.PI / 2;
for (const [w, h, y, z] of [[0.14, 1.95, 1.9, -1.25], [0.14, 1.95, 1.9, 1.25], [2.64, 0.14, 0.95, 0], [2.64, 0.14, 2.85, 0]]) mesh(box(0.22, h, w > 1 ? w : 0.14), M.darkWood, 7.95, y, z);
mesh(box(0.4, 0.06, 2.7), M.darkWood, 7.85, 0.9, 0);
const sashes = [-1, 1].map(s => {
  const pivot = new THREE.Group(); pivot.position.set(8.02, 1.9, 1.2 * s); scene.add(pivot);
  const g = new THREE.Group(); g.position.z = -0.6 * s; pivot.add(g);
  for (const [w, h, y, z] of [[0.05, 1.8, 0, -0.57], [0.05, 1.8, 0, 0.57], [1.2, 0.05, 0.88, 0], [1.2, 0.05, -0.88, 0], [1.2, 0.03, 0, 0], [0.03, 1.8, 0, 0]]) mesh(box(0.04, h, w > 0.1 ? w : 0.05), M.darkWood, 0, y, z, g, false);
  mesh(new THREE.PlaneGeometry(1.14, 1.76), M.glass, 0, 0, 0, g, false).rotation.y = -Math.PI / 2;
  return { pivot, s, open: 0 };
});
const rainCanvas = document.createElement('canvas'); rainCanvas.width = 256; rainCanvas.height = 256;
const rainTex = new THREE.CanvasTexture(rainCanvas);
const rainMat = new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, opacity: 0, depthWrite: false, fog: false });
mesh(new THREE.PlaneGeometry(3, 2.6), rainMat, 8.6, 1.9, 0, scene, false).rotation.y = -Math.PI / 2;
const drops = Array.from({ length: 70 }, () => ({ x: Math.random() * 256, y: Math.random() * 256, v: 300 + Math.random() * 200, l: 8 + Math.random() * 14 }));
function drawRain(dt) {
  const g = rainCanvas.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(190,210,235,.55)'; g.lineWidth = 1;
  g.beginPath();
  for (const d of drops) { d.y += d.v * dt; d.x -= d.v * dt * 0.15; if (d.y > 270) { d.y = -20; d.x = Math.random() * 290; } g.moveTo(d.x, d.y); g.lineTo(d.x - d.l * 0.15, d.y + d.l); }
  g.stroke();
  rainTex.needsUpdate = true;
}
const curtains = [-1, 1].map(s => {
  const geo = new THREE.PlaneGeometry(0.9, 2.4, 8, 12);
  const m = mesh(geo, M.curtain, 7.78, 2.05, 1.75 * s, scene, true);
  m.rotation.y = -Math.PI / 2;
  m.userData.base = geo.attributes.position.array.slice();
  return m;
});
mesh(cyl(0.025, 0.025, 4.2, 8), M.brass, 7.75, 3.28, 0).rotation.x = Math.PI / 2;

/* drifting dust in the lamplight */
const dustGeo = new THREE.BufferGeometry();
const dustN = coarse ? 160 : 320;
const dustPos = new Float32Array(dustN * 3);
for (let i = 0; i < dustN; i++) dustPos.set([rand(-5, 5), rand(0.3, 3.6), rand(-5, 5)], i * 3);
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xffd9a0, size: 0.04, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(dust);

/* ---------------- lights ---------------- */
const hemi = new THREE.HemisphereLight(0x6f86a3, 0x2a1a0e, 0.55);
scene.add(hemi);
const chandLight = new THREE.PointLight(0xffc68a, 38, 16, 2);
chandLight.position.set(0, 3.1, 0); scene.add(chandLight);
const tableSpot = new THREE.SpotLight(0xffd29c, 70, 14, 1.05, 0.7, 2);
tableSpot.position.set(0, 3.3, 0.01); tableSpot.target.position.set(0, 0, 0);
tableSpot.castShadow = true;
tableSpot.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
tableSpot.shadow.bias = -0.0004; tableSpot.shadow.normalBias = 0.03;
tableSpot.shadow.camera.near = 0.5; tableSpot.shadow.camera.far = 9;
scene.add(tableSpot, tableSpot.target);
const fireLight = new THREE.PointLight(0xff7b30, 22, 11, 2);
fireLight.position.set(0, 0.8, -6); scene.add(fireLight);
const candleLight = new THREE.PointLight(0xffaa55, 3, 5, 2);
candleLight.position.set(0, 1.15, 0); scene.add(candleLight);
const moon = new THREE.DirectionalLight(0x8fb0ff, 0.25);
moon.position.set(12, 5, 0); scene.add(moon);
/* wall lamps either side of the door, so the way out is never lost in the dark */
const sconceLights = [-2.2, 2.2].map(x => {
  mesh(box(0.14, 0.24, 0.08), M.brass, x, 2.1, 6.95, scene, false);
  candle(x, 6.86, 0.14, scene, 2.2);
  const l = new THREE.PointLight(0xffb868, 9, 7, 2);
  l.position.set(x, 2.45, 6.6); scene.add(l);
  return l;
});
const heroSpot = new THREE.SpotLight(0xfff0d0, 0, 9, 0.3, 0.55, 2);
heroSpot.position.set(0, 4.1, 0); scene.add(heroSpot, heroSpot.target);

/* ---------------- characters ---------------- */
const SKIN = [0xf0c8a4, 0xd9a273, 0xb57c4c, 0x7d4b2a, 0xf6d6bb, 0xc9946a, 0x5e3b22, 0xe8bc94];
const HAIR = [0x2a1a10, 0x5a391d, 0x8a5a2a, 0xc8a46c, 0x151515, 0x8e8e8e, 0x6a2a12, 0xd6c6a2];
const COAT = [0x2f3e55, 0x5b2430, 0x4a5a32, 0x38383f, 0x6b4a2e, 0x86662a, 0x2e4a3d, 0x52385d, 0x7a3b22, 0x34495e, 0x5e5040, 0x2c2c38, 0x6a2f2f, 0x3d5a6b, 0x77603a];
const KIT = ['scarf', 'apron', 'glove', 'tophat', 'glasses', 'apron', 'scarf', 'cap', 'shawl', 'cap', 'glasses', 'apron', 'cap', 'tophat', 'brimhat'];

function makeFigure(ci) {
  const fem = ci % 2 === 0;
  const mats = [];
  const mk = (c, r, extra) => { const m = std(c, r, extra); mats.push(m); return m; };
  const skin = mk(SKIN[(ci * 5) % SKIN.length], 0.55);
  const hair = mk(HAIR[(ci * 3 + 1) % HAIR.length], 0.85);
  const coat = mk(COAT[ci % COAT.length], 0.82);
  const shirt = mk(fem ? 0xe6dac6 : 0xd8d0c0, 0.85);
  const legsM = mk(fem ? new THREE.Color(COAT[ci % COAT.length]).multiplyScalar(0.7).getHex() : 0x2a2521, 0.85);
  const shoe = mk(0x1b130e, 0.45);
  const dark = mk(0x0d0a08, 0.4);
  const white = mk(0xf2efe8, 0.3);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const sc = (fem ? 0.95 : 1.03) * (0.97 + ((ci * 37) % 7) / 100);
  body.scale.setScalar(sc);
  const pelvis = new THREE.Group(); pelvis.position.y = 0.92; body.add(pelvis);
  const hips = mesh(cap(0.15, 0.08), legsM, 0, 0, 0, pelvis); hips.scale.set(1.15, 1, 0.78);
  const legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(0.092 * s, 0, 0); pelvis.add(hip);
    mesh(cap(0.068, 0.36), legsM, 0, -0.22, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    mesh(cap(0.056, 0.36), legsM, 0, -0.21, 0, knee);
    mesh(box(0.1, 0.07, 0.25), shoe, 0, -0.44, 0.05, knee);
    return { hip, knee };
  });
  const skirt = mesh(new THREE.CylinderGeometry(0.2, fem ? 0.36 : 0.27, fem ? 0.66 : 0.42, 20, 1, true), coat, 0, fem ? -0.28 : -0.17, 0, pelvis);
  skirt.material = coat;
  const spine = new THREE.Group(); spine.position.y = 0.03; pelvis.add(spine);
  const torso = mesh(cap(0.16, 0.34), coat, 0, 0.3, 0, spine); torso.scale.set(1.2, 1, 0.72);
  mesh(cyl(0.07, 0.085, 0.07, 14), shirt, 0, 0.64, 0, spine);
  mesh(box(0.1, 0.22, 0.02), shirt, 0, 0.5, 0.112, spine);
  mesh(cyl(0.048, 0.055, 0.12, 12), skin, 0, 0.69, 0, spine);
  const head = new THREE.Group(); head.position.y = 0.8; spine.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.112, 28, 20), skin, 0, 0, 0, head); skull.scale.set(0.9, 1.1, 0.98);
  mesh(new THREE.SphereGeometry(0.07, 16, 12), skin, 0, -0.06, 0.035, head).scale.set(1, 0.8, 1);
  const nose = mesh(new THREE.ConeGeometry(0.017, 0.05, 8), skin, 0, -0.01, 0.112, head); nose.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.016, 12, 8), white, 0.037 * s, 0.022, 0.092, head, false);
    mesh(new THREE.SphereGeometry(0.009, 10, 8), dark, 0.037 * s, 0.022, 0.105, head, false);
    mesh(box(0.042, 0.008, 0.012), hair, 0.038 * s, 0.05, 0.1, head, false).rotation.z = -0.12 * s;
    mesh(new THREE.SphereGeometry(0.024, 10, 8), skin, 0.1 * s, 0, 0, head).scale.set(0.5, 1, 0.8);
  }
  mesh(box(0.042, 0.007, 0.01), mk(0x7a3a34, 0.6), 0, -0.058, 0.098, head, false);
  const hairCap = mesh(new THREE.SphereGeometry(0.123, 28, 16, 0, TAU, 0, Math.PI * 0.55), hair, 0, 0.012, -0.006, head);
  hairCap.scale.set(0.94, 1.1, 1.04); hairCap.rotation.x = -0.28;
  if (fem) { const back = mesh(cap(0.095, 0.2), hair, 0, -0.1, -0.06, head); back.scale.set(1.15, 1, 0.65); }
  const arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(0.215 * s, 0.56, 0); spine.add(sh);
    mesh(new THREE.SphereGeometry(0.07, 14, 10), coat, 0, 0, 0, sh);
    mesh(cap(0.052, 0.22), coat, 0, -0.15, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    mesh(cap(0.045, 0.2), coat, 0, -0.13, 0, el);
    mesh(cyl(0.05, 0.05, 0.03, 12), shirt, 0, -0.25, 0, el);
    const hand = mesh(new THREE.SphereGeometry(0.045, 12, 10), skin, 0, -0.3, 0, el); hand.scale.set(0.8, 1.15, 0.6);
    return { sh, el, s };
  });
  const kit = KIT[ci % KIT.length];
  if (kit === 'tophat') { mesh(cyl(0.095, 0.1, 0.2, 20), dark, 0, 0.2, 0, head); mesh(cyl(0.16, 0.16, 0.012, 24), dark, 0, 0.1, 0, head); }
  if (kit === 'brimhat') { mesh(cyl(0.2, 0.2, 0.012, 28), mk(0xcaa96a, 0.9), 0, 0.09, 0, head); mesh(cyl(0.1, 0.11, 0.1, 20), mk(0xcaa96a, 0.9), 0, 0.14, 0, head); }
  if (kit === 'cap') { const c = mesh(new THREE.SphereGeometry(0.128, 20, 10, 0, TAU, 0, Math.PI * 0.4), mk(0x4a4038, 0.95), 0, 0.03, 0.005, head); c.scale.set(1, 0.85, 1.12); mesh(box(0.17, 0.012, 0.08), mk(0x4a4038, 0.95), 0, 0.055, 0.12, head); }
  if (kit === 'glasses') for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.022, 0.0035, 6, 16), M.brass, 0.037 * s, 0.022, 0.113, head, false);
  if (kit === 'apron') mesh(box(0.3, 0.62, 0.012), mk(0xcfc3a8, 0.9), 0, 0.14, 0.118, spine);
  if (kit === 'scarf') { const sf = mesh(new THREE.TorusGeometry(0.07, 0.032, 8, 18), mk(0x8a2a22, 0.95), 0, 0.64, 0, spine); sf.rotation.x = Math.PI / 2; mesh(box(0.06, 0.28, 0.03), mk(0x8a2a22, 0.95), 0.05, 0.47, 0.12, spine); }
  if (kit === 'shawl') mesh(new THREE.CylinderGeometry(0.17, 0.31, 0.28, 20, 1, true), mk(0x7a6a8a, 0.95, { side: THREE.DoubleSide }), 0, 0.5, 0, spine);
  if (kit === 'glove') arms[0].el.children[0].material = mk(0x5a3a1a, 0.7);
  root.traverse(o => { if (o.isMesh) o.userData.fig = true; });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.012; root.add(halo);
  return { root, body, pelvis, spine, head, legs, arms, halo, mats, height: 1.8 * sc };
}

/* poses: target joint angles. Positive spine/head x leans forward; negative shoulder x lifts the arm forward. */
function poseTargets(pose, t, c) {
  const T = { spine: 0.02 + 0.012 * Math.sin(t * 1.7), head: 0, shx: [0.05, 0.05], shz: [-0.08, 0.08], elx: [-0.15, -0.15], hip: [0, 0], knee: [0, 0], bob: 0 };
  const sway = Math.sin(t * 0.6) * 0.03;
  T.hip = [sway, -sway]; T.knee = [Math.max(0, sway) * 2, Math.max(0, -sway) * 2];
  switch (pose) {
    case 'think': T.shx = [-0.4, -1.05]; T.shz = [0.32, -0.32]; T.elx = [-1.55, -2.15]; T.head = 0.1; break;
    case 'lean': T.spine = 0.42; T.head = -0.25; T.shx = [-1.0, -1.0]; T.shz = [0.12, -0.12]; T.elx = [-0.35, -0.35]; T.knee = [0.18, 0.18]; T.hip = [-0.1, -0.1]; break;
    case 'talk': T.shx = [-0.25 + 0.15 * Math.sin(t * 3.3 + 1), -0.55 + 0.25 * Math.sin(t * 4.7)]; T.shz = [0.1, -0.15]; T.elx = [-0.7, -1.2 + 0.35 * Math.sin(t * 3.9)]; T.head = 0.05 * Math.sin(t * 3); break;
    case 'point': T.shx = [0.05, -1.5]; T.shz = [-0.08, 0]; T.elx = [-0.15, -0.05]; T.head = -0.05; T.spine = 0.06; break;
    case 'fold': T.shx = [-0.5, -0.5]; T.shz = [0.42, -0.42]; T.elx = [-1.95, -1.95]; T.spine = -0.03; break;
    case 'sleep': T.spine = 0.12; T.head = 0.5; T.shx = [0.1, 0.1]; T.shz = [-0.04, 0.04]; T.elx = [-0.1, -0.1]; break;
    case 'cheer': T.shz = [-2.6, 2.6]; T.shx = [-0.2, -0.2]; T.elx = [-0.35, -0.35]; T.spine = -0.08; T.head = -0.25; T.bob = Math.max(0, Math.sin(t * 7)) * 0.07; break;
    case 'slump': T.spine = 0.3; T.head = 0.45; T.shx = [-0.15, -0.15]; T.shz = [-0.02, 0.02]; T.elx = [-0.2, -0.2]; T.knee = [0.1, 0.1]; break;
    case 'wave': T.shz = [-0.08, 2.7]; T.elx = [-0.15, -0.6 + 0.5 * Math.sin(t * 8)]; break;
  }
  return T;
}

/* ---------------- the cast ---------------- */
const chars = new Map();
const R = 2.35;
const TABLE = V(0, 0.95, 0);
const DOOR_STEP = V(0, 0, 5.4), DOOR_OUT = V(0, 0, 8.6);
const SPOTS = [V(-5.4, 0, -5.2), V(5.2, 0, -5.2), V(-6.5, 0, 0), V(6.4, 0, 3.8), V(-5.2, 0, 5.3)];
let S = null, me = null, phaseKey = '', phaseT = 0, lastChat = undefined, speaker = null, speakT = 0, firstView = true, camHome = null;

function label(c) {
  const el = document.createElement('div');
  el.className = 'lbl';
  el.innerHTML = '<span class="bub" hidden></span><b></b><i hidden></i>';
  layer.appendChild(el);
  return el;
}
function createChar(p, at) {
  const fig = makeFigure(p.char);
  scene.add(fig.root);
  const c = { id: p.id, ci: p.char, p, fig, pos: at.clone(), yaw: 0, path: [], goal: at.clone(), walkT: 0, walkAmt: 0, fade: 1, gone: false, seq: null,
    lbl: label(), seed: Math.random() * 100, glance: null, glanceT: 0, cur: null, bubbleUntil: 0, talkUntil: 0, greetUntil: 0, focusUntil: 0 };
  fig.root.position.copy(c.pos);
  fig.root.traverse(o => { if (o.isMesh) o.userData.char = c; });
  return c;
}
function disposeChar(c) {
  scene.remove(c.fig.root);
  c.fig.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  c.fig.mats.forEach(m => m.dispose());
  c.lbl.remove();
}
function setFade(c, a) {
  c.fade = a;
  for (const m of c.fig.mats) {
    const t = a < 0.999;
    if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
    m.opacity = a; m.depthWrite = a > 0.5;
  }
  c.fig.root.visible = a > 0.01;
}
function hide(c) { c.gone = true; setFade(c, 0); c.lbl.hidden = true; c.path = []; }

/* paths go around the table rather than through it */
function route(from, to) {
  const ab = to.clone().sub(from); ab.y = 0;
  const len2 = ab.lengthSq();
  const t = len2 ? clamp(-(from.x * ab.x + from.z * ab.z) / len2, 0, 1) : 0;
  const near = V(from.x + ab.x * t, 0, from.z + ab.z * t).length();
  if (near > 1.95) return [to.clone()];
  const a0 = Math.atan2(from.x, from.z), a1 = Math.atan2(to.x, to.z), d = wrap(a1 - a0), steps = Math.max(1, Math.ceil(Math.abs(d) / 0.45));
  const pts = [];
  for (let i = 0; i <= steps; i++) { const a = a0 + d * i / steps; pts.push(V(Math.sin(a) * 3.3, 0, Math.cos(a) * 3.3)); }
  pts.push(to.clone());
  return pts;
}
function goTo(c, dest) {
  if (dest.distanceTo(c.goal) < 0.05) return;
  c.goal = dest.clone();
  c.path = route(c.pos, dest);
}
function spotPos(idx, k, n) {
  const base = SPOTS[idx % SPOTS.length], inward = base.clone().multiplyScalar(-1).setY(0).normalize(), side = V(inward.z, 0, -inward.x);
  return base.clone().addScaledVector(side, (k % 5 - (Math.min(n, 5) - 1) / 2) * 0.6).addScaledVector(inward, 0.7 + Math.floor(k / 5) * 0.6);
}
const doorSpot = (k, n) => V((k - (n - 1) / 2) * 0.62, 0, 5.3);
const posOf = id => { const c = chars.get(id); return c ? c.pos.clone().setY(1.5) : null; };

/* ---------------- props on the table ---------------- */
const props = new THREE.Group(); scene.add(props);
let spotLabels = [];
function clearProps() {
  for (const o of [...props.children]) { props.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
  spotLabels.forEach(l => l.el.remove()); spotLabels = [];
}
function paperTex(lines, big) {
  return canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = '#dcc79d'; g.fillRect(0, 0, w, h);
    const e = g.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, 190); e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(90,50,10,.45)');
    g.fillStyle = e; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a2412'; g.textAlign = 'center';
    if (big) { g.font = 'bold 34px Georgia, serif'; g.fillText(big, w / 2, 150); }
    g.font = 'italic 18px Georgia, serif';
    lines.forEach((l, i) => g.fillText(l, w / 2, (big ? 200 : 60) + i * 30));
    speckle(g, w, h, 0.08, 1800);
  });
}
function paper(tex, x, z, rot, w = 0.42, h = 0.52) {
  const m = mesh(new THREE.PlaneGeometry(w, h), std(0xffffff, 0.9, { map: tex, side: THREE.DoubleSide }), x, 0.846, z, props, false);
  m.rotation.set(-Math.PI / 2, 0, rot);
  return m;
}
const ITEM_SHAPES = {
  key: [cyl(0.012, 0.012, 0.14, 8), M.brass], ink: [cyl(0.035, 0.04, 0.07, 12), std(0x101828, 0.2)], watch: [cyl(0.045, 0.045, 0.015, 20), M.brass],
  map: [box(0.16, 0.004, 0.12), M.parchment], seal: [cyl(0.03, 0.03, 0.02, 14), std(0x8a1a1a, 0.4)], spoon: [cap(0.012, 0.12), std(0xd8d8e0, 0.25, { metalness: 0.9 })],
  glasses: [new THREE.TorusGeometry(0.03, 0.005, 6, 16), M.brass], candle: [cyl(0.02, 0.02, 0.1, 10), M.wax], ticket: [box(0.1, 0.003, 0.05), std(0xc9b48a, 0.9)],
  thistle: [new THREE.ConeGeometry(0.03, 0.09, 10), std(0x6a4a8a, 0.9)], chess: [cyl(0.02, 0.03, 0.08, 12), std(0x151515, 0.3)], letter: [box(0.16, 0.008, 0.02), std(0xc8c8d0, 0.3, { metalness: 0.9 })],
  tin: [cyl(0.012, 0.012, 0.13, 10), std(0xb8b8b0, 0.35, { metalness: 0.8 })], magnifying: [new THREE.TorusGeometry(0.04, 0.007, 8, 20), M.brass], glove: [box(0.07, 0.025, 0.12), std(0x5a3a1a, 0.7)],
  matchbox: [box(0.06, 0.02, 0.04), std(0xa83a22, 0.8)], compass: [cyl(0.04, 0.04, 0.02, 20), M.brass], hip: [box(0.07, 0.11, 0.025), std(0xc0c0c8, 0.3, { metalness: 0.9 })],
  playing: [box(0.06, 0.002, 0.09), std(0xf4f0e6, 0.6)], feather: [new THREE.ConeGeometry(0.015, 0.16, 6), std(0xf2f0ea, 0.8)],
};
function lantern(x, z, glow) {
  const g = new THREE.Group(); g.position.set(x, 0, z); props.add(g);
  mesh(box(0.2, 0.04, 0.2), M.iron, 0, 0.02, 0, g);
  mesh(cyl(0.07, 0.07, 0.22, 12), new THREE.MeshBasicMaterial({ color: glow ? 0xffd27a : 0xc9a050 }), 0, 0.15, 0, g, false);
  mesh(new THREE.ConeGeometry(0.12, 0.1, 4), M.iron, 0, 0.31, 0, g).rotation.y = Math.PI / 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb455, transparent: true, opacity: glow ? 0.9 : 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.y = 0.16; s.scale.setScalar(glow ? 1.4 : 0.7); g.add(s);
  return g;
}
function spotLabel(text, pos, hot) {
  const el = document.createElement('div');
  el.className = 'spotlbl' + (hot ? ' hot' : '');
  el.textContent = text;
  layer.appendChild(el);
  spotLabels.push({ el, pos: pos.clone().setY(1.0) });
}
function setProps(v) {
  clearProps();
  const q = v.quest;
  if (v.phase === 'quest' && q) {
    if (q.kind === 'cipher') { const m = /“(.+?)”/.exec(q.prompt || ''); paper(paperTex(['A sealed note', '', 'cipher wheel set'], m ? m[1] : '· · ·'), 0.45, 0.35, 0.3); mesh(cyl(0.035, 0.035, 0.012, 16), std(0x8a1a1a, 0.4), 0.55, 0.85, 0.12, props); }
    if (q.kind === 'sequence') { const m = /lists (.+?) and then/.exec(q.prompt || ''); const nums = m ? m[1].split(',').map(s => s.trim()) : []; paper(paperTex(['The vault ledger', ...nums, '· torn ·']), 0.25, 0.4, -0.2); paper(paperTex(['', 'deposits', 'withdrawals']), -0.22, 0.42, -0.2); }
    if (q.kind === 'observe') {
      if (q.stage === 'study' && q.study) q.study.forEach((name, i) => {
        const a = i / q.study.length * TAU + 0.3, key = Object.keys(ITEM_SHAPES).find(k => name.includes(k)) || 'matchbox';
        const [geo, mat] = ITEM_SHAPES[key];
        const m = mesh(geo.clone(), mat, Math.cos(a) * 0.95, 0.88, Math.sin(a) * 0.95, props);
        if (geo.type === 'TorusGeometry') m.rotation.x = Math.PI / 2;
        if (geo.type === 'CapsuleGeometry' || key === 'key' || key === 'tin' || key === 'feather') m.rotation.z = Math.PI / 2;
        m.rotation.y = Math.random() * TAU;
      });
      else { const cover = mesh(new THREE.SphereGeometry(1.05, 40, 16, 0, TAU, 0, Math.PI / 2), M.cloth, 0, 0.84, 0, props); cover.scale.y = 0.13; }
    }
    if (q.kind === 'expedition') {
      paper(paperTex(['The Night Crossing', 'lodge ~~~~ ferry', '~~~ marsh ~~~', 'x  far bank']), 0, 0.45, 0, 0.6, 0.45);
      for (const [x, z, r] of [[-1.3, 6.2, 0.2], [-0.8, 6.3, -0.1], [1.2, 6.2, 0.3]]) { const cr = mesh(box(0.45, 0.4, 0.45), std(0x6a4a2a, 0.85, { map: tableTex }), x, 0.2, z, props); cr.rotation.y = r; }
      lantern(1.6, 5.9, false);
    }
    if (q.kind === 'search') q.rooms.forEach((name, i) => { lantern(SPOTS[i].x, SPOTS[i].z, false); spotLabel(name, SPOTS[i], q.hot === i); });
  }
  if (v.phase === 'qresult' && v.last && v.last.kind === 'search') v.last.rooms.forEach((name, i) => { lantern(SPOTS[i].x, SPOTS[i].z, i === v.last.hot); spotLabel(i === v.last.hot ? `${name} · evidence` : name, SPOTS[i], i === v.last.hot); });
}

/* ---------------- mist for vanishings ---------------- */
const mists = [];
function mistBurst(at) {
  const n = 70, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) { pos.set([at.x + rand(-0.3, 0.3), rand(0.1, 1.8), at.z + rand(-0.3, 0.3)], i * 3); vel.push(V(rand(-0.4, 0.4), rand(0.2, 0.7), rand(-0.4, 0.4))); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, color: 0xb9c8dc, size: 0.5, transparent: true, opacity: 0.6, depthWrite: false }));
  scene.add(pts);
  mists.push({ pts, vel, t: 0 });
}

/* ---------------- following the game ---------------- */
function update(v) {
  if (!v || !v.players) return;
  S = v; me = v.you.id;
  const now = performance.now();
  const ids = new Set(v.players.map(p => p.id));
  for (const [id, c] of chars) if (!ids.has(id)) { disposeChar(c); chars.delete(id); }
  const n = v.players.length, myIdx = Math.max(0, v.players.findIndex(p => p.id === me));
  v.players.forEach((p, i) => {
    const a = ((i - myIdx) / n) * TAU, home = V(Math.sin(a) * R, 0, Math.cos(a) * R);
    let c = chars.get(p.id);
    if (c && c.ci !== p.char) { const keep = c.pos.clone(); disposeChar(c); c = createChar(p, keep); chars.set(p.id, c); }
    if (!c) {
      c = createChar(p, firstView ? home : DOOR_OUT);
      chars.set(p.id, c);
      if (!firstView) { c.path = route(DOOR_OUT, DOOR_STEP).concat(route(DOOR_STEP, home)); c.goal = home.clone(); c.greetUntil = now + 6000; }
      else c.goal = home.clone();
      c.yaw = Math.atan2(-home.x, -home.z);
    }
    c.p = p; c.home = home;
    c.lbl.querySelector('b').textContent = p.name;
    c.lbl.classList.toggle('me', p.id === me);
    if (p.alive && c.gone && !c.seq) { c.gone = false; setFade(c, 1); c.lbl.hidden = false; c.pos.copy(DOOR_OUT); c.goal = DOOR_OUT.clone(); goTo(c, home); }
    if (!p.alive && !c.gone && !c.seq) {
      if (v.phase === 'verdict' && v.verdict && v.verdict.exiled === p.id && !firstView) c.seq = { type: 'exile', t0: now };
      else if (v.phase === 'dawn' && v.dawn && v.dawn.victim === p.id && !firstView) { c.seq = { type: 'vanish', t0: now }; mistBurst(c.pos); }
      else hide(c);
    }
  });
  const key = `${v.round}-${v.phase}-${v.quest ? v.quest.stage : ''}`;
  if (key !== phaseKey) { phaseKey = key; phaseT = now; setProps(v); }
  if (lastChat === undefined || firstView) lastChat = v.chat.length ? v.chat[v.chat.length - 1].id : null;
  else {
    const start = lastChat ? v.chat.findIndex(m => m.id === lastChat) + 1 : 0;
    for (const m of v.chat.slice(start)) {
      const c = chars.get(m.from);
      if (c && !c.gone) { const b = c.lbl.querySelector('.bub'); b.textContent = m.text.length > 90 ? m.text.slice(0, 88) + '…' : m.text; c.bubbleUntil = now + 6000; c.talkUntil = now + 3200; speaker = c; speakT = now; }
    }
    if (v.chat.length) lastChat = v.chat[v.chat.length - 1].id;
  }
  if (firstView) {
    const mine = chars.get(me);
    const narrow = host.clientWidth < host.clientHeight * 1.2;
    if (mine) { camHome = { pos: mine.home.clone().multiplyScalar(narrow ? 2.85 : 2.5).setY(narrow ? 3.9 : 3.3), target: V(0, 0.9, 0) }; camera.position.copy(camHome.pos); controls.target.copy(camHome.target); }
    host.classList.add('ready');
    firstView = false;
  }
}

/* what each living member does right now */
function direct(c, el, now) {
  const p = c.p, ph = S.phase, waiting = S.waiting.includes(p.id);
  let pose = 'idle', dest = c.home, look = null, point = null;
  const q = S.quest;
  switch (ph) {
    case 'lobby': pose = c.greetUntil > now && !c.path.length ? 'wave' : 'idle'; break;
    case 'roles': pose = 'idle'; if (p.id !== me) look = posOf(me); break;
    case 'quest':
      if (q.kind === 'expedition') {
        if (q.stage === 'team') { pose = p.id === q.leader ? 'think' : 'idle'; if (p.id !== q.leader) look = posOf(q.leader); }
        else { const k = q.team.indexOf(p.id); if (k >= 0) { dest = doorSpot(k, q.team.length); pose = waiting ? 'think' : 'fold'; } else look = V(0, 1.4, 5.5); }
      } else if (q.kind === 'search') {
        if (p.id === me && q.picked !== undefined) dest = spotPos(q.picked, 0, 1);
        pose = waiting ? 'think' : 'idle';
      } else { pose = q.stage === 'study' ? 'lean' : waiting ? (c.ci % 2 ? 'think' : 'lean') : 'fold'; look = TABLE; }
      break;
    case 'qresult': {
      const r = S.last;
      if (r.kind === 'search') {
        const idx = r.picks[p.id];
        if (idx !== undefined) { const grp = Object.keys(r.picks).filter(id => r.picks[id] === idx); dest = spotPos(idx, grp.indexOf(p.id), grp.length); }
        pose = el < 3000 && !c.path.length ? (idx === r.hot ? 'cheer' : r.found ? 'idle' : 'slump') : 'idle';
        if (r.found && idx !== r.hot) look = SPOTS[r.hot].clone().setY(1.4);
      } else pose = el < 2800 ? (r.success ? 'cheer' : 'slump') : 'idle';
      break;
    }
    case 'discuss': pose = c.talkUntil > now ? 'talk' : 'idle'; break;
    case 'vote': pose = waiting ? 'think' : 'fold'; break;
    case 'verdict': {
      const tgt = S.verdict.votes[p.id];
      if (tgt && tgt !== 'none' && el < 5200) { point = posOf(tgt); pose = 'point'; }
      if (S.verdict.exiled) look = posOf(S.verdict.exiled);
      break;
    }
    case 'night': pose = 'sleep'; break;
    case 'dawn': if (S.dawn) { const vc = chars.get(S.dawn.victim); look = vc ? vc.home.clone().setY(1.2) : null; } break;
    case 'over': pose = (p.role === 'traitor') === (S.winner.side === 'traitor') ? 'cheer' : 'slump'; break;
  }
  if (ph === 'lobby' || ph === 'discuss') if (speaker && speaker !== c && now - speakT < 4500 && !speaker.gone) look = speaker.pos.clone().setY(1.6);
  return { pose, dest, look, point };
}

function animateChar(c, dt, now, t) {
  const f = c.fig;
  let pose = 'idle', look = null, point = null;
  if (c.seq) {
    const el = now - c.seq.t0;
    if (c.seq.type === 'exile') {
      pose = el < 4500 ? 'slump' : 'idle';
      if (el > 4500 && !c.seq.walking) { c.seq.walking = true; c.path = route(c.pos, DOOR_STEP).concat([DOOR_OUT.clone()]); c.goal = DOOR_OUT.clone(); }
      if (c.seq.walking && !c.path.length) { setFade(c, Math.max(0, c.fade - dt * 1.5)); if (c.fade <= 0) { c.seq = null; hide(c); return; } }
    } else {
      pose = 'sleep';
      setFade(c, Math.max(0, 1 - el / 1800));
      if (el > 1800) { c.seq = null; hide(c); return; }
    }
  } else if (!c.gone && S) {
    const d = direct(c, now - phaseT, now);
    pose = d.pose; look = d.look; point = d.point;
    goTo(c, d.dest);
  }
  if (c.gone) return;

  /* walking */
  let moving = false, wantYaw = Math.atan2(-c.pos.x, -c.pos.z);
  if (c.path.length) {
    const tgt = c.path[0], dx = tgt.x - c.pos.x, dz = tgt.z - c.pos.z, dist = Math.hypot(dx, dz);
    if (dist < 0.06) c.path.shift();
    else { const step = Math.min(dist, 1.35 * dt); c.pos.x += dx / dist * step; c.pos.z += dz / dist * step; c.walkT += step * 5.4; wantYaw = Math.atan2(dx, dz); moving = true; }
  } else {
    const atHome = c.pos.distanceTo(c.home) < 0.2;
    if (point) wantYaw = yawTo(c.pos, point);
    else if (!atHome) wantYaw = look ? yawTo(c.pos, look) : yawTo(c.pos, TABLE);
  }
  if (!moving && !point && look) {
    const rel = wrap(yawTo(c.pos, look) - wantYaw);
    if (Math.abs(rel) > 1.1) wantYaw += rel - Math.sign(rel) * 0.9;
  }
  c.yaw += wrap(wantYaw - c.yaw) * (1 - Math.exp(-7 * dt));
  c.walkAmt = damp(c.walkAmt, moving ? 1 : 0, 9, dt);

  /* idle glances at neighbours */
  if (!look && !moving && now > c.glanceT) {
    c.glanceT = now + rand(2500, 6000);
    const others = [...chars.values()].filter(o => o !== c && !o.gone);
    c.glance = Math.random() < 0.55 && others.length ? others[Math.random() * others.length | 0] : null;
  }
  if (!look && c.glance && !c.glance.gone) look = c.glance.pos.clone().setY(1.6);

  /* joints */
  const T = poseTargets(pose, t + c.seed, c);
  const w = c.walkAmt;
  for (let i = 0; i < 2; i++) {
    const lp = c.walkT + i * Math.PI;
    T.hip[i] += -Math.sin(lp) * 0.5 * w;
    T.knee[i] += Math.max(0, Math.cos(lp)) * 0.85 * w;
    T.shx[i] = T.shx[i] * (1 - w) + (Math.sin(lp) * 0.42 + 0.05) * w;
    T.elx[i] = T.elx[i] * (1 - w) + -0.3 * w;
  }
  const k = 1 - Math.exp(-11 * dt);
  const lerp = (o, prop, val) => { o[prop] += (val - o[prop]) * k; };
  lerp(f.spine.rotation, 'x', T.spine);
  lerp(f.head.rotation, 'x', T.head);
  const headY = look ? clamp(wrap(yawTo(c.pos, look) - c.yaw), -1.1, 1.1) : 0;
  lerp(f.head.rotation, 'y', headY);
  f.arms.forEach((a, i) => { lerp(a.sh.rotation, 'x', T.shx[i]); lerp(a.sh.rotation, 'z', T.shz[i]); lerp(a.el.rotation, 'x', T.elx[i]); });
  f.legs.forEach((l, i) => { lerp(l.hip.rotation, 'x', T.hip[i]); lerp(l.knee.rotation, 'x', T.knee[i]); });
  f.body.position.y = Math.abs(Math.sin(c.walkT)) * 0.035 * w + T.bob;
  f.root.position.copy(c.pos);
  f.root.rotation.y = c.yaw;

  /* halo: gold for you, red for traitors you know of, green for revealed loyal */
  const p = c.p;
  let col = null;
  if (p.id === me) col = 0xe9b44c;
  if (p.role === 'traitor') col = 0xe0473a;
  else if (p.role === 'loyal' && (S.phase === 'over' || p.fate)) col = 0x6fd18a;
  if (c.seq && c.seq.type === 'exile') col = p.role === 'traitor' ? 0xe0473a : 0x6fd18a;
  const hm = f.halo.material;
  if (col !== null) hm.color.setHex(col);
  hm.opacity = damp(hm.opacity, col === null ? 0 : (S.phase === 'night' ? 0.25 : 0.55 + 0.15 * Math.sin(t * 2.4)), 4, dt);
}

/* ---------------- interaction: tap, double-tap to walk, keys ---------------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null, lastTap = 0;
const walkTo = { active: false, target: V(0, 1, 0) };
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 350) return;
  const now = performance.now();
  pick(e);
  const figs = [...chars.values()].filter(c => !c.gone).map(c => c.fig.root);
  const hit = ray.intersectObjects(figs, true).find(h => h.object.userData.char);
  if (hit) { const c = hit.object.userData.char; c.focusUntil = now + 3500; lastTap = 0; return; }
  if (now - lastTap < 380) {
    const f = ray.intersectObject(floor)[0];
    if (f) { walkTo.active = true; walkTo.target.set(clamp(f.point.x, -5.8, 5.8), 1, clamp(f.point.z, -4.8, 4.8)); }
    lastTap = 0;
  } else lastTap = now;
});
const keys = new Set();
renderer.domElement.addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) { keys.add(e.key); e.preventDefault(); } });
renderer.domElement.addEventListener('keyup', e => keys.delete(e.key));
renderer.domElement.addEventListener('blur', () => keys.clear());
host.querySelector('.recenter').addEventListener('click', () => {
  if (!camHome) return;
  walkTo.active = true; walkTo.target.copy(camHome.target);
  camera.position.lerp(camHome.pos, 1);
});

/* ---------------- the loop ---------------- */
let visible = true, last = performance.now();
new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
const lightTargets = {
  lobby: [1, 1, 0.25], roles: [0.4, 0.7, 0.25], quest: [1, 1, 0.25], qresult: [1, 1, 0.25], discuss: [0.85, 1, 0.25], vote: [0.6, 0.9, 0.3],
  verdict: [0.55, 0.9, 0.3], night: [0.06, 0.32, 1.1], dawn: [0.3, 0.4, 0.85], over: [1, 1, 0.25],
};
const lit = { chand: 1, fire: 1, moon: 0.25, rain: 0, hero: 0 };
const fwd = new THREE.Vector3(), rightV = new THREE.Vector3(), headPos = new THREE.Vector3(), tmp = new THREE.Vector3();

function frame(tms) {
  requestAnimationFrame(frame);
  if (!visible || document.hidden) { last = tms; return; }
  const dt = Math.min(0.05, (tms - last) / 1000); last = tms;
  const t = tms / 1000, now = performance.now();
  const ph = S ? S.phase : 'lobby';

  /* light and weather by phase */
  const [lc, lf, lm] = lightTargets[ph] || lightTargets.lobby;
  lit.chand = damp(lit.chand, lc, 1.6, dt); lit.fire = damp(lit.fire, lf, 1.6, dt); lit.moon = damp(lit.moon, lm, 1.6, dt);
  lit.rain = damp(lit.rain, ph === 'night' || ph === 'dawn' ? 0.8 : 0.12, 1, dt);
  const flick = reduced ? 1 : 0.9 + 0.06 * Math.sin(t * 11) + 0.04 * Math.sin(t * 23.7);
  chandLight.intensity = 38 * lit.chand * flick;
  tableSpot.intensity = 70 * lit.chand;
  candleLight.intensity = 3 * flick * (0.4 + lit.chand * 0.6);
  for (const l of sconceLights) l.intensity = 9 * flick * (0.35 + 0.65 * lit.chand);
  fireLight.intensity = 22 * lit.fire * (0.82 + 0.18 * Math.sin(t * 7.3) * Math.sin(t * 3.1));
  fireGlow.material.opacity = 0.35 + 0.25 * lit.fire;
  moon.intensity = lit.moon; hemi.intensity = 0.25 + 0.35 * lit.chand + 0.15 * lit.moon;
  scene.fog.density = 0.022 + (1 - lit.chand) * 0.02;
  for (const f of flames) { const s = f.userData.seed; f.scale.set(1, 0.6 + 0.5 * Math.abs(Math.sin(t * 6 + s)) * lit.fire + 0.2, 1); f.position.x += Math.sin(t * 9 + s) * 0.0008; }
  for (const f of candleFlames) { const s = f.userData.seed; f.scale.y = 0.14 + 0.03 * Math.sin(t * 13 + s); f.material.opacity = 0.75 + 0.25 * Math.sin(t * 17 + s); }
  if (lit.rain > 0.05) drawRain(dt);
  rainMat.opacity = lit.rain;

  /* hero spotlight: you at the role reveal, the exiled at the verdict */
  let heroAt = null;
  if (ph === 'roles') heroAt = chars.get(me);
  if (ph === 'verdict' && S.verdict && S.verdict.exiled) heroAt = chars.get(S.verdict.exiled);
  lit.hero = damp(lit.hero, heroAt && !heroAt.gone ? 1 : 0, 3, dt);
  heroSpot.intensity = 45 * lit.hero;
  if (heroAt) { heroSpot.position.set(heroAt.pos.x * 0.6, 4.1, heroAt.pos.z * 0.6); heroSpot.target.position.copy(heroAt.pos); }

  /* window and door */
  const winOpen = ph === 'dawn' ? 1 : 0;
  for (const sh of sashes) { sh.open = damp(sh.open, winOpen, 2.5, dt); sh.pivot.rotation.y = -sh.s * sh.open * 1.3; }
  const wind = (ph === 'dawn' ? 1 : ph === 'night' ? 0.25 : 0.05);
  for (const cu of curtains) {
    const a = cu.geometry.attributes.position, b = cu.userData.base;
    for (let i = 0; i < a.count; i++) { const x = b[i * 3], y = b[i * 3 + 1], drop = (1.2 - y) / 2.4; a.setZ(i, (Math.sin(t * 2.2 + x * 4 + y * 1.5) * 0.06 + Math.sin(t * 1.3 + y) * 0.12) * wind * drop + Math.sin(x * 9) * 0.03); }
    a.needsUpdate = true; cu.geometry.computeVertexNormals();
  }
  let doorWant = 0;
  for (const c of chars.values()) if (!c.gone && c.pos.z > 4.6 && Math.abs(c.pos.x) < 1.6 && (c.path.length || c.seq)) doorWant = 1;
  if (S && S.phase === 'quest' && S.quest && S.quest.kind === 'expedition' && S.quest.stage === 'mission') doorWant = 1;
  doorPivot.rotation.y = damp(doorPivot.rotation.y, doorWant * 1.75, 2.2, dt);
  pendulum.rotation.z = Math.sin(t * 2.6) * 0.18;
  clockHand.rotation.z = -t * 0.05;

  /* dust */
  if (!reduced) { const a = dustGeo.attributes.position; for (let i = 0; i < dustN; i++) { let y = a.getY(i) + dt * 0.03; if (y > 3.8) y = 0.3; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.02); } a.needsUpdate = true; }

  for (let i = mists.length - 1; i >= 0; i--) {
    const m = mists[i]; m.t += dt;
    const a = m.pts.geometry.attributes.position;
    m.vel.forEach((v, k) => { a.setXYZ(k, a.getX(k) + v.x * dt, a.getY(k) + v.y * dt, a.getZ(k) + v.z * dt); });
    a.needsUpdate = true; m.pts.material.opacity = Math.max(0, 0.6 - m.t * 0.25);
    if (m.t > 2.6) { scene.remove(m.pts); m.pts.geometry.dispose(); mists.splice(i, 1); }
  }

  for (const c of chars.values()) animateChar(c, dt, now, t);

  /* walking the view: double-tap target, arrow keys */
  if (keys.size) {
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); rightV.set(-fwd.z, 0, fwd.x);
    const mv = new THREE.Vector3();
    if (keys.has('ArrowUp') || keys.has('w')) mv.add(fwd);
    if (keys.has('ArrowDown') || keys.has('s')) mv.sub(fwd);
    if (keys.has('ArrowRight') || keys.has('d')) mv.add(rightV);
    if (keys.has('ArrowLeft') || keys.has('a')) mv.sub(rightV);
    mv.multiplyScalar(2.4 * dt);
    walkTo.active = false;
    const nt = controls.target.clone().add(mv); nt.x = clamp(nt.x, -5.8, 5.8); nt.z = clamp(nt.z, -4.8, 4.8);
    camera.position.add(nt.clone().sub(controls.target)); controls.target.copy(nt);
  }
  if (walkTo.active) {
    tmp.copy(walkTo.target).sub(controls.target).multiplyScalar(1 - Math.exp(-3 * dt));
    controls.target.add(tmp); camera.position.add(tmp);
    if (controls.target.distanceTo(walkTo.target) < 0.02) walkTo.active = false;
  }
  controls.update();
  camera.position.x = clamp(camera.position.x, -7.6, 7.6);
  camera.position.z = clamp(camera.position.z, -6.6, 6.7);
  camera.position.y = clamp(camera.position.y, 0.5, 4.0);

  renderer.render(scene, camera);

  /* name tags and speech bubbles */
  const w = host.clientWidth, h = host.clientHeight;
  for (const c of chars.values()) {
    if (c.gone || c.fade < 0.3) { c.lbl.hidden = true; continue; }
    headPos.set(c.pos.x, c.fig.height + 0.22, c.pos.z).project(camera);
    if (headPos.z > 1) { c.lbl.hidden = true; continue; }
    c.lbl.hidden = false;
    c.lbl.style.transform = `translate(${(headPos.x * 0.5 + 0.5) * w}px,${(-headPos.y * 0.5 + 0.5) * h}px) translate(-50%,-100%)`;
    c.lbl.style.zIndex = String(1000 - Math.round(headPos.z * 1000));
    c.lbl.querySelector('.bub').hidden = c.bubbleUntil < now;
    const info = c.lbl.querySelector('i'), focused = c.focusUntil > now;
    if (focused && S) info.textContent = `the ${S.characters[c.p.char]}${c.p.bot ? ' · resident' : ''}${c.p.role === 'traitor' ? ' · traitor' : ''}`;
    info.hidden = !focused;
    c.lbl.classList.toggle('dim', ph === 'night' && !focused);
  }
  for (const s of spotLabels) {
    headPos.copy(s.pos).project(camera);
    s.el.hidden = headPos.z > 1;
    s.el.style.transform = `translate(${(headPos.x * 0.5 + 0.5) * w}px,${(-headPos.y * 0.5 + 0.5) * h}px) translate(-50%,-100%)`;
  }
}
requestAnimationFrame(frame);

window.Lodge = { update, debug: { chars, props, camera, controls, renderer, scene, get phaseKey() { return phaseKey; } } };
if (window.__S) update(window.__S);
