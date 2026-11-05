import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.querySelector('#world');
const loading = document.querySelector('#loading');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#a8e8f0');
scene.fog = new THREE.Fog('#a8e8f0', 34, 105);
const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
scene.add(new THREE.HemisphereLight('#e9ffff', '#719c70', 2.15));
const sun = new THREE.DirectionalLight('#fff4cf', 3.1); sun.position.set(-12, 24, 11); scene.add(sun);
const fill = new THREE.DirectionalLight('#b8e4ff', 1.0); fill.position.set(12, 9, -18); scene.add(fill);
const mat = (color, roughness = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const materials = {
  grass: mat('#80c96b'), grassLight: mat('#9bd77a'), grassDark: mat('#69b45e'), soil: mat('#a96f4d'), soilDark: mat('#8d5c46'), stone: mat('#b8ae8a'),
  trunk: mat('#8a5a3d'), leaf: mat('#4caa75'), leafLight: mat('#7ac879'), flower1: mat('#fff1b1'), flower2: mat('#f6a5bd'), flower3: mat('#fffaf0'),
  bear: mat('#b87946'), bearLight: mat('#d59a61'), muzzle: mat('#f3d9b7'), innerEar: mat('#e9a1a0'), nose: mat('#583e37'), eye: mat('#302d2b', .35),
  white: mat('#fffdf3'), seed: new THREE.MeshStandardMaterial({ color: '#ffc64c', emissive: '#ffac18', emissiveIntensity: 1.6, roughness: .28 }),
  seedCore: new THREE.MeshStandardMaterial({ color: '#fff8c7', emissive: '#ffdf73', emissiveIntensity: 1.8 }),
  gate: new THREE.MeshStandardMaterial({ color: '#f5cb67', metalness: .25, roughness: .36, emissive: '#845c15', emissiveIntensity: .25 }),
  portal: new THREE.MeshBasicMaterial({ color: '#f5d875', transparent: true, opacity: .38, side: THREE.DoubleSide })
};
const platforms = [
  { x: 0, z: 13, y: 0, w: 10, d: 9, name: 'Home Patch' },
  { x: -1.6, z: 6.2, y: 1.0, w: 6, d: 6, name: 'Clover Step' },
  { x: 2, z: -2, y: 1.8, w: 5.5, d: 5.5, name: 'Fern Rise' },
  { x: -1.5, z: -9, y: 2.6, w: 5.5, d: 5.5, name: 'Puffin Perch' },
  { x: 1.5, z: -15, y: 3.4, w: 7, d: 7, name: 'Sunseed Summit' }
];
const platformMeshes = [];
const pickups = [];
const clouds = [];
const world = new THREE.Group(); scene.add(world);

function box(parent, size, position, material, radius = 0) {
  const geo = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(...position); parent.add(mesh); return mesh;
}
function sphere(parent, radius, position, material, scale = [1, 1, 1], segments = 16) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.max(8, Math.floor(segments * .65))), material);
  mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh;
}
function addPlatform(p, index) {
  const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); world.add(g);
  box(g, [p.w, .88, p.d], [0, -.49, 0], index % 2 ? materials.soil : materials.soilDark);
  box(g, [p.w + .12, .2, p.d + .12], [0, -.1, 0], materials.grass);
  // soft green patches and pebble flecks decorate the rim without blocking the route
  const rnd = (n) => Math.sin((index + 2) * 87.31 + n * 19.17) * .5 + .5;
  for (let i = 0; i < 10; i++) {
    const x = (rnd(i) - .5) * (p.w - .65), z = (rnd(i + 11) - .5) * (p.d - .65);
    sphere(g, .25 + rnd(i + 23) * .2, [x, .012, z], i % 2 ? materials.grassLight : materials.grassDark, [1.35, .045, .75], 10);
  }
  for (let i = 0; i < 7; i++) {
    const side = i % 4, u = (rnd(i + 44) - .5) * .8;
    const x = side < 2 ? (side === 0 ? -p.w / 2 : p.w / 2) : u * p.w;
    const z = side >= 2 ? (side === 2 ? -p.d / 2 : p.d / 2) : u * p.d;
    const pebble = sphere(g, .16 + rnd(i + 4) * .12, [x, -.42 + rnd(i + 8) * .35, z], i % 2 ? materials.stone : materials.soil, [1.3, .8, 1], 9);
    pebble.rotation.z = rnd(i + 16);
  }
  platformMeshes.push({ ...p, mesh: g });
}
platforms.forEach(addPlatform);

function addTree(parent, x, z, s = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.11 * s, .16 * s, .82 * s, 7), materials.trunk);
  trunk.position.set(x, .41 * s, z); parent.add(trunk);
  sphere(parent, .52 * s, [x, .96 * s, z], materials.leaf, [1, 1.08, .95], 12);
  sphere(parent, .36 * s, [x - .27 * s, 1.08 * s, z + .08 * s], materials.leafLight, [1, 1, .9], 10);
}
function addFlower(parent, x, z, color) {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.025, .035, .25, 5), materials.leaf);
  stem.position.set(x, .13, z); parent.add(stem);
  sphere(parent, .11, [x, .29, z], color, [1, .7, 1], 10);
}
platformMeshes.forEach((p, index) => {
  const g = p.mesh;
  if (index === 0) { addTree(g, -3.6, -2.7, .9); addTree(g, 3.7, 2.5, .82); }
  if (index === 1) addTree(g, 1.75, -1.5, .58);
  if (index === 2) addTree(g, -1.8, 1.65, .56);
  if (index === 3) addTree(g, 1.8, -1.6, .56);
  if (index === 4) { addTree(g, -2.65, 2.45, .68); addTree(g, 2.7, -2.45, .62); }
  const colors = [materials.flower1, materials.flower2, materials.flower3];
  for (let f = 0; f < (index === 0 ? 8 : 4); f++) {
    const a = (f * 2.399 + index) % (Math.PI * 2), r = .75 + (f % 2) * .65;
    addFlower(g, Math.cos(a) * r, Math.sin(a) * r, colors[f % 3]);
  }
});

// A soft valley sky, distant cloud puffs, and a luminous summit arch.
for (let i = 0; i < 13; i++) {
  const group = new THREE.Group();
  group.position.set(Math.sin(i * 8.3) * 29, 5 + (i % 4) * 2.8, -24 - i * 5.3);
  for (let j = 0; j < 5; j++) sphere(group, 1.35 + (j % 3) * .28, [(j - 2) * 1.15, Math.sin(j * 7) * .35, 0], materials.white, [1.35, .72, .9], 12);
  world.add(group); clouds.push(group);
}
const summit = platformMeshes[4].mesh;
box(summit, [.32, 2.45, .34], [-1.22, 1.15, -2.45], materials.gate);
box(summit, [.32, 2.45, .34], [1.22, 1.15, -2.45], materials.gate);
box(summit, [2.78, .35, .36], [0, 2.35, -2.45], materials.gate);
const portal = new THREE.Mesh(new THREE.TorusGeometry(.91, .095, 12, 40), materials.gate);
portal.position.set(0, 1.18, -2.25); summit.add(portal);
const portalGlow = new THREE.Mesh(new THREE.CircleGeometry(.82, 32), materials.portal);
portalGlow.position.set(0, 1.18, -2.3); summit.add(portalGlow);
const archLights = [];
for (const x of [-1.22, 1.22]) {
  const orb = new THREE.PointLight('#ffd66a', .9, 5); orb.position.set(x, 2.55, -2.1); summit.add(orb); archLights.push(orb);
}

// Eight Sunseeds sit along the island trail.
const seedSpots = [
  [-2.9, 1.06, 5.25], [-.65, 1.06, 4.1],
  [.5, 1.86, -1.6], [3.15, 1.86, -2.7],
  [-2.8, 2.66, -8.7], [-.1, 2.66, -9.8],
  [.25, 3.46, -14.1], [2.45, 3.46, -15.4]
];
for (let i = 0; i < seedSpots.length; i++) {
  const group = new THREE.Group(); group.position.set(...seedSpots[i]); world.add(group);
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(.34, 0), materials.seed); group.add(body);
  const core = sphere(group, .13, [0, 0, 0], materials.seedCore, [1, 1, 1], 12);
  const sparkle = new THREE.Mesh(new THREE.TorusGeometry(.45, .025, 6, 24), materials.seedCore);
  sparkle.rotation.x = Math.PI / 2; group.add(sparkle);
  pickups.push({ group, body, sparkle, collected: false, phase: i * .8, x: seedSpots[i][0], y: seedSpots[i][1], z: seedSpots[i][2] });
}

// Our own little bear hero, built from friendly low-poly shapes.
const bear = new THREE.Group(); world.add(bear);
const bearVisual = new THREE.Group(); bear.add(bearVisual);
sphere(bearVisual, .43, [0, .78, 0], materials.bear, [1.05, 1.13, .86], 20);
sphere(bearVisual, .36, [0, 1.36, .035], materials.bearLight, [1, 1.02, .94], 20);
for (const x of [-.265, .265]) {
  sphere(bearVisual, .145, [x, 1.66, -.005], materials.bear, [1, 1.1, .75], 14);
  sphere(bearVisual, .082, [x, 1.67, .047], materials.innerEar, [1, 1.05, .6], 12);
  sphere(bearVisual, .049, [x * 1.18, 1.39, .355], materials.white, [1, 1.25, .65], 12);
  sphere(bearVisual, .025, [x * 1.18, 1.39, .386], materials.eye, [1, 1.3, .7], 10);
}
sphere(bearVisual, .2, [0, 1.22, .34], materials.muzzle, [1.28, .82, .72], 16);
sphere(bearVisual, .07, [0, 1.27, .397], materials.nose, [1.2, .8, .75], 12);
sphere(bearVisual, .15, [0, .45, -.4], materials.bearLight, [1, 1, .9], 12);
const legs = [];
for (const x of [-.24, .24]) {
  const leg = new THREE.Group(); leg.position.set(x, .35, 0); bearVisual.add(leg);
  sphere(leg, .19, [0, -.12, .045], materials.bear, [1, 1.35, 1.05], 12);
  sphere(leg, .19, [0, -.22, .13], materials.bearLight, [1.18, .72, 1.35], 12);
  legs.push(leg);
}
const bearShadow = new THREE.Mesh(new THREE.CircleGeometry(.65, 24), new THREE.MeshBasicMaterial({ color: '#315f54', transparent: true, opacity: .2, depthWrite: false }));
bearShadow.rotation.x = -Math.PI / 2; bearShadow.position.y = .018; world.add(bearShadow);

const $ = (sel) => document.querySelector(sel);
const countLabel = $('#seed-count'), stageFill = $('#stage-fill'), missionText = $('#mission-text');
const welcome = $('#welcome'), pauseScreen = $('#pause-screen'), winScreen = $('#win-screen');
const toast = $('#toast');
let toastTimer = 0;
function announce(text) {
  toast.textContent = text; toast.classList.add('show'); toastTimer = 1.8;
}
let seeds = 0, active = false, paused = true, won = false;
let footY = 0, verticalSpeed = 0, grounded = true, checkpoint = 0;
let moveX = 0, moveZ = 0, walkTime = 0;
const velocity = new THREE.Vector3();
const keys = new Set();
function resetBear(toStart = false) {
  const p = toStart ? platforms[0] : platforms[checkpoint];
  bear.position.set(p.x, p.y, p.z + 1.15); footY = p.y; verticalSpeed = 0; velocity.set(0, 0, 0); grounded = true;
  bear.rotation.y = Math.PI; bearVisual.position.y = 0;
}
function startGame(restart = false) {
  if (restart) {
    seeds = 0; checkpoint = 0; pickups.forEach(p => { p.collected = false; p.group.visible = true; });
  }
  resetBear(true); active = true; paused = false; won = false;
  welcome.classList.add('hidden'); pauseScreen.classList.add('hidden'); winScreen.classList.add('hidden');
  countLabel.textContent = seeds; missionText.textContent = 'Gather the Sunseeds';
}
function pauseGame() { if (!active || won) return; paused = true; pauseScreen.classList.remove('hidden'); }
function resumeGame() { paused = false; pauseScreen.classList.add('hidden'); }
function winGame() { won = true; paused = true; winScreen.classList.remove('hidden'); missionText.textContent = 'Summit reached!'; }
function jump() { if (active && !paused && grounded) { verticalSpeed = 11.3; grounded = false; } }

$('#start-button').addEventListener('click', () => startGame());
$('#resume-button').addEventListener('click', resumeGame);
$('#restart-button').addEventListener('click', () => startGame(true));
$('#play-again-button').addEventListener('click', () => startGame(true));
$('#pause-button').addEventListener('click', () => paused ? resumeGame() : pauseGame());
$('#jump-button').addEventListener('pointerdown', (event) => { event.preventDefault(); jump(); });
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key)) event.preventDefault();
  keys.add(key);
  if (key === ' ' || key === 'arrowup') jump();
  if (key === 'escape' || key === 'p') paused ? resumeGame() : pauseGame();
  if (key === 'r' && active) startGame(true);
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// A responsive virtual analog stick for touchscreens.
const joystick = $('#joystick'), knob = $('#joy-knob');
let joyPointer = null;
function moveStick(event) {
  const rect = joystick.getBoundingClientRect();
  const max = rect.width * .31;
  let dx = event.clientX - (rect.left + rect.width / 2), dy = event.clientY - (rect.top + rect.height / 2);
  const length = Math.hypot(dx, dy), scale = length > max ? max / length : 1;
  dx *= scale; dy *= scale;
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  moveX = dx / max; moveZ = dy / max;
}
joystick.addEventListener('pointerdown', (event) => {
  event.preventDefault(); joyPointer = event.pointerId; joystick.setPointerCapture(joyPointer); moveStick(event);
});
joystick.addEventListener('pointermove', (event) => { if (event.pointerId === joyPointer) moveStick(event); });
function releaseStick(event) {
  if (event.pointerId !== joyPointer) return;
  joyPointer = null; moveX = 0; moveZ = 0; knob.style.transform = 'translate(0px, 0px)';
}
joystick.addEventListener('pointerup', releaseStick);
joystick.addEventListener('pointercancel', releaseStick);

function resize() {
  const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
  renderer.setSize(width, height, false); camera.aspect = width / height;
  camera.fov = width < 600 ? 59 : 54; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();
resetBear(true);
loading.classList.add('done');

const clock = new THREE.Clock();
const cameraTarget = new THREE.Vector3();
function update(dt, time) {
  for (const p of pickups) {
    if (!p.collected) {
      p.group.position.y = p.y + Math.sin(time * 2.5 + p.phase) * .13;
      p.body.rotation.y = time * 1.3 + p.phase; p.sparkle.rotation.z = time * .7 + p.phase;
    }
  }
  clouds.forEach((cloud, i) => { cloud.position.x += Math.sin(time * .12 + i) * dt * .12; });
  archLights.forEach((light, i) => { light.intensity = .7 + Math.sin(time * 3 + i) * .18; });
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toast.classList.remove('show'); }

  const keyboardX = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const keyboardZ = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  let ix = keyboardX || moveX, iz = keyboardZ || moveZ;
  const inputLength = Math.hypot(ix, iz);
  if (inputLength > 1) { ix /= inputLength; iz /= inputLength; }
  if (active && !paused) {
    const speed = 7.1;
    velocity.x = THREE.MathUtils.damp(velocity.x, ix * speed, ix ? 13 : 9, dt);
    velocity.z = THREE.MathUtils.damp(velocity.z, iz * speed, iz ? 13 : 9, dt);
    const oldY = footY;
    bear.position.x += velocity.x * dt; bear.position.z += velocity.z * dt;
    verticalSpeed -= 22 * dt;
    footY += verticalSpeed * dt;
    if (verticalSpeed <= 0) {
      let landing = null;
      for (let i = 0; i < platformMeshes.length; i++) {
        const p = platformMeshes[i];
        // Let the bear's body overlap a platform edge slightly; collision checks use its center.
        const inBounds = Math.abs(bear.position.x - p.x) <= p.w / 2 + .3 && Math.abs(bear.position.z - p.z) <= p.d / 2 + .3;
        if (inBounds && oldY >= p.y - .06 && footY <= p.y + .04 && (!landing || p.y > landing.y)) landing = p;
      }
      if (landing) {
        footY = landing.y; verticalSpeed = 0; grounded = true;
        const index = platformMeshes.indexOf(landing);
        if (index > checkpoint) { checkpoint = index; announce(`${landing.name} reached!`); }
      } else grounded = false;
    } else grounded = false;
    bear.position.y = footY;
    if (Math.abs(ix) + Math.abs(iz) > .05) {
      bear.rotation.y = THREE.MathUtils.damp(bear.rotation.y, Math.atan2(ix, iz), 12, dt);
      walkTime += dt * (grounded ? 10 : 4);
    }
    legs[0].rotation.x = grounded ? Math.sin(walkTime) * .62 * Math.min(1, inputLength) : -.25;
    legs[1].rotation.x = grounded ? -Math.sin(walkTime) * .62 * Math.min(1, inputLength) : .25;
    bearVisual.position.y = grounded ? Math.abs(Math.sin(walkTime * 2)) * .045 * Math.min(1, inputLength) : 0;
    bearVisual.rotation.z = grounded ? -ix * .06 : -ix * .1;
    bearShadow.position.set(bear.position.x, .018, bear.position.z);
    bearShadow.scale.setScalar(Math.max(.55, 1 - Math.max(0, footY - .1) * .06));

    for (const p of pickups) {
      if (p.collected) continue;
      const dx = bear.position.x - p.x, dz = bear.position.z - p.z, dy = footY + 1 - p.y;
      if (dx * dx + dz * dz < 1.15 * 1.15 && Math.abs(dy) < 1.25) {
        p.collected = true; p.group.visible = false; seeds++; countLabel.textContent = seeds;
        announce(seeds === 8 ? 'All 8 Sunseeds! Wake the summit gate!' : 'Sunseed found!');
        if (seeds >= 8) missionText.textContent = 'The gate is awake!';
      }
    }
    const gateZ = platforms[4].z - 2.45;
    if (seeds >= 8 && Math.abs(bear.position.x - platforms[4].x) < 1.2 && Math.abs(bear.position.z - gateZ) < 1.45 && Math.abs(footY - platforms[4].y) < .6) winGame();
    if (footY < -8) { announce('Whoops! Back to the last island.'); resetBear(); }
    const progress = THREE.MathUtils.clamp((13 - bear.position.z) / 30, 0, 1);
    stageFill.style.width = `${Math.max(progress * 100, seeds / 8 * 12)}%`;
  }
  const distance = window.innerWidth < 700 ? 11.8 : 9.7;
  cameraTarget.set(bear.position.x, bear.position.y + 1.1, bear.position.z);
  const desired = new THREE.Vector3(bear.position.x + .3, bear.position.y + distance * .54, bear.position.z + distance);
  camera.position.lerp(desired, 1 - Math.exp(-4.3 * dt)); camera.lookAt(cameraTarget);
}
function frame() {
  requestAnimationFrame(frame);
  // Simulate elapsed time in small steps so low-FPS devices don't make the bear move in slow motion.
  const elapsed = Math.min(clock.getDelta(), .5);
  const steps = Math.max(1, Math.ceil(elapsed / .04));
  const step = elapsed / steps, startTime = clock.elapsedTime - elapsed;
  for (let i = 0; i < steps; i++) update(step, startTime + step * (i + 1));
  renderer.render(scene, camera);
}
frame();
