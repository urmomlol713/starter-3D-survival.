// Mini 3D game using Three.js
// Controls: WASD / Arrows (desktop), on-screen buttons (mobile)
// Run with a static server (recommended): python -m http.server 8000  OR  npx http-server

import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';

let scene, camera, renderer;
let player, playerRadius = 0.8;
let items = [];
let obstacles = [];
let keys = {};
let velocity = new THREE.Vector3();
let score = 0;
let started = false;
const ITEM_COUNT = 8;
const WORLD_RADIUS = 40;
const container = document.getElementById('gameContainer');
const scoreEl = document.getElementById('score');
const messageEl = document.getElementById('message');
const startBtn = document.getElementById('startBtn');

init();
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x20232a);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 8, 12);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Lights
  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid helper for visual cues
  const grid = new THREE.GridHelper(120, 60, 0x393e46, 0x1f2327);
  grid.position.y = 0.001;
  scene.add(grid);

  // Player (sphere)
  const mat = new THREE.MeshStandardMaterial({ color: 0xff8b3d, metalness: 0.2, roughness: 0.6 });
  const geo = new THREE.SphereGeometry(playerRadius, 24, 24);
  player = new THREE.Mesh(geo, mat);
  player.castShadow = true;
  player.position.set(0, playerRadius, 0);
  scene.add(player);

  // Spawn items and obstacles
  spawnItems(ITEM_COUNT);
  spawnObstacles(4);

  // Resize handling
  window.addEventListener('resize', onResize);

  // Keyboard
  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // Mobile touch buttons
  setupTouchControls();

  // Start button
  startBtn.addEventListener('click', startGame);

  // initial render
  renderer.render(scene, camera);
}

function startGame() {
  if (started) return;
  started = true;
  score = 0;
  scoreEl.textContent = 'Score: 0';
  messageEl.textContent = 'Go! Collect cubes!';
  player.position.set(0, playerRadius, 0);
  velocity.set(0, 0, 0);
  // make sure some items present
  if (items.length < ITEM_COUNT) spawnItems(ITEM_COUNT - items.length);
  lastTime = performance.now();
  animate();
}

// Helper to random point inside radius
function randomPoint(radius) {
  const r = Math.sqrt(Math.random()) * radius;
  const t = Math.random() * Math.PI * 2;
  return new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r);
}

function spawnItems(n) {
  const geom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x57cc99, emissive: 0x2a7f5b });
    const m = new THREE.Mesh(geom, mat);
    const pos = randomPoint(WORLD_RADIUS * 0.6);
    m.position.set(pos.x, 0.6, pos.z);
    scene.add(m);
    items.push(m);
  }
}

function spawnObstacles(n) {
  const geom = new THREE.BoxGeometry(2, 2, 2);
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3b3b });
    const ob = new THREE.Mesh(geom, mat);
    const pos = randomPoint(WORLD_RADIUS * 0.8);
    ob.position.set(pos.x, 1, pos.z);
    ob.userData = { phase: Math.random() * Math.PI * 2, radius: 6 + Math.random() * 10, speed: 0.6 + Math.random() * 0.8 };
    scene.add(ob);
    obstacles.push(ob);
  }
}

let lastTime = 0;
function animate(now) {
  if (!started) return;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  updatePlayer(dt);
  updateObstacles(dt);
  checkItemCollisions();
  checkObstacleCollisions();
  updateCamera();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updatePlayer(dt) {
  const turnSpeed = 10;
  const accel = 18;
  // input
  let inputX = 0, inputZ = 0;
  if (keys['KeyW'] || keys['ArrowUp']) inputZ -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) inputZ += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) inputX -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) inputX += 1;

  // apply forces in camera-relative directions (world-space forward/back relative to camera)
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), forward).normalize();

  const force = new THREE.Vector3();
  force.addScaledVector(forward, inputZ * accel);
  force.addScaledVector(right, inputX * accel);

  // simple velocity + damping
  velocity.addScaledVector(force, dt);
  velocity.multiplyScalar(Math.pow(0.8, dt*10)); // damping

  // clamp speed
  const maxSpeed = 10;
  if (velocity.length() > maxSpeed) velocity.setLength(maxSpeed);

  // move player
  player.position.addScaledVector(velocity, dt);

  // keep player above ground
  player.position.y = playerRadius;

  // keep inside world radius
  const dist = Math.sqrt(player.position.x*player.position.x + player.position.z*player.position.z);
  if (dist > WORLD_RADIUS) {
    // push player back inside
    player.position.x *= WORLD_RADIUS / dist;
    player.position.z *= WORLD_RADIUS / dist;
    velocity.multiplyScalar(0.3);
  }

  // rotate sphere for visual roll
  const travel = velocity.length() * dt;
  if (travel > 0.0001) {
    const axis = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), velocity).normalize();
    const angle = travel / playerRadius;
    player.rotateOnWorldAxis(axis, angle);
  }
}

function updateObstacles(dt) {
  const t = performance.now() / 1000;
  for (let ob of obstacles) {
    const ud = ob.userData;
    // orbit around center (0,0)
    const x = Math.cos(t * ud.speed + ud.phase) * ud.radius;
    const z = Math.sin(t * ud.speed + ud.phase) * ud.radius;
    ob.position.set(x, 1, z);
    // small bobbing
    ob.position.y = 1 + Math.sin(t * ud.speed + ud.phase*0.3) * 0.5;
    ob.rotation.y = t * ud.speed;
  }
}

function checkItemCollisions() {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const d2 = player.position.distanceToSquared(it.position);
    const r = playerRadius + 0.9;
    if (d2 < r*r) {
      // collect
      scene.remove(it);
      items.splice(i, 1);
      score += 10;
      scoreEl.textContent = `Score: ${score}`;
      // spawn a new item after a short delay
      setTimeout(() => spawnItems(1), 800);
      // small feedback
      flashMessage('+10!', 700);
    }
  }
}

function checkObstacleCollisions() {
  for (let ob of obstacles) {
    const d2 = player.position.distanceToSquared(ob.position);
    const r = playerRadius + 1.2;
    if (d2 < r*r) {
      // collision penalty: teleport to center and reduce score
      player.position.set(0, playerRadius, 0);
      velocity.set(0,0,0);
      score = Math.max(0, score - 20);
      scoreEl.textContent = `Score: ${score}`;
      flashMessage('Ouch! -20', 900);
      // small camera shake
      shakeCamera(0.35, 350);
    }
  }
}

function updateCamera() {
  // smooth follow
  const desired = new THREE.Vector3(player.position.x, player.position.y + 6.5, player.position.z + 11);
  camera.position.lerp(desired, 0.08);
  camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);
}

// simple UI helpers
function flashMessage(text, ms=800) {
  const prev = messageEl.textContent;
  messageEl.textContent = text;
  setTimeout(() => { messageEl.textContent = prev; }, ms);
}

let shakeTimeout = 0;
function shakeCamera(amount=0.3, ms=300) {
  const start = performance.now();
  const orig = camera.position.clone();
  cancelAnimationFrame(shakeTimeout);
  function tick() {
    const t = (performance.now() - start) / ms;
    if (t >= 1) {
      camera.position.copy(orig);
      return;
    }
    const f = (1 - t);
    camera.position.x = orig.x + (Math.random() - 0.5) * amount * f;
    camera.position.y = orig.y + (Math.random() - 0.5) * amount * f;
    camera.position.z = orig.z + (Math.random() - 0.5) * amount * f;
    shakeTimeout = requestAnimationFrame(tick);
  }
  tick();
}

// resize handler
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// touch controls wiring
function setupTouchControls() {
  const btnUp = document.getElementById('btn-up');
  const btnDown = document.getElementById('btn-down');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');

  function bind(btn, code) {
    let active = false;
    const start = (e) => { e.preventDefault(); keys[code] = true; active = true; };
    const end = (e) => { if (active) keys[code] = false; active = false; };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchend', end);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  }
  bind(btnUp, 'ArrowUp');
  bind(btnDown, 'ArrowDown');
  bind(btnLeft, 'ArrowLeft');
  bind(btnRight, 'ArrowRight');
}

// small helper to keep items visible in UI on load
function ensureUI() {
  scoreEl.textContent = `Score: ${score}`;
}

ensureUI();
