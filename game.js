const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

const missionTextEl = document.getElementById('missionText');
const cashValueEl = document.getElementById('cashValue');
const healthValueEl = document.getElementById('healthValue');
const heatValueEl = document.getElementById('heatValue');
const speedValueEl = document.getElementById('speedValue');
const messageTitleEl = document.getElementById('messageTitle');
const messageTextEl = document.getElementById('messageText');

const WORLD = { width: 2400, height: 2400 };
const keys = {};
const touched = {};

const state = {
  time: 0,
  cash: 0,
  health: 100,
  heat: 0,
  mission: 'pickup',
  cashBonus: 0,
  level: 1,
  message: { title: 'Open City', text: 'Steal the package, dodge the cops, and make it out clean.' },
  won: false,
  lost: false,
  flashes: []
};

const player = {
  x: 160,
  y: 160,
  radius: 22,
  angle: 0,
  vx: 0,
  vy: 0,
  speed: 0,
  maxSpeed: 400,
  acceleration: 900,
  friction: 700,
  color: '#71d9ff',
  boostActive: false
};

const roadRects = [
  { x: 0, y: 310, w: WORLD.width, h: 180 },
  { x: 0, y: 980, w: WORLD.width, h: 180 },
  { x: 0, y: 1650, w: WORLD.width, h: 180 },
  { x: 310, y: 0, w: 180, h: WORLD.height },
  { x: 980, y: 0, w: 180, h: WORLD.height },
  { x: 1650, y: 0, w: 180, h: WORLD.height },
  { x: 0, y: 2100, w: WORLD.width, h: 180 },
  { x: 2100, y: 0, w: 180, h: WORLD.height }
];

const buildings = [
  { x: 520, y: 520, w: 330, h: 250, color: '#1c3447' },
  { x: 1100, y: 520, w: 460, h: 260, color: '#1b2b39' },
  { x: 1720, y: 540, w: 350, h: 240, color: '#213d4d' },
  { x: 520, y: 1180, w: 330, h: 340, color: '#12273a' },
  { x: 1100, y: 1180, w: 470, h: 360, color: '#182f40' },
  { x: 1710, y: 1180, w: 330, h: 300, color: '#16364a' },
  { x: 520, y: 1840, w: 340, h: 300, color: '#1a2d43' },
  { x: 1100, y: 1840, w: 440, h: 260, color: '#132f3a' },
  { x: 1710, y: 1840, w: 360, h: 300, color: '#153845' }
];

const pickupSpots = [
  { x: 340, y: 170, reward: 300 },
  { x: 2140, y: 420, reward: 500 },
  { x: 420, y: 2140, reward: 650 },
  { x: 2130, y: 2120, reward: 550 }
];

const dropoffSpots = [
  { x: 2160, y: 2140 },
  { x: 180, y: 160 },
  { x: 2140, y: 180 },
  { x: 210, y: 2120 }
];

const policeCars = [];
const pickupGlow = [];
let viewWidth = window.innerWidth;
let viewHeight = window.innerHeight;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setMessage(title, text) {
  state.message.title = title;
  state.message.text = text;
  messageTitleEl.textContent = title;
  messageTextEl.textContent = text;
}

function updateHud() {
  cashValueEl.textContent = Math.floor(state.cash);
  healthValueEl.textContent = Math.max(0, Math.floor(state.health));
  heatValueEl.textContent = Math.floor(state.heat);
  speedValueEl.textContent = Math.floor(player.speed);
  missionTextEl.textContent = state.mission === 'pickup'
    ? 'Reach the pickup point.'
    : state.mission === 'deliver'
      ? 'Deliver the package to a safehouse.'
      : 'Escape the city.';
}

function resetMission() {
  state.mission = 'pickup';
  state.cashBonus = 0;
  setMessage('Open City', 'Drive: WASD / arrows • Boost: Shift • Grab gold, reach a safehouse.');
  updateHud();
}

function spawnPolice(count = 3) {
  policeCars.length = 0;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const spawn = {
      x: 700 + (i * 250) % 1500,
      y: 600 + (i * 430) % 1500,
      radius: 20,
      vx: 0,
      vy: 0,
      speed: 180 + i * 25,
      color: i % 2 === 0 ? '#f65d5d' : '#f0b26b',
      angle,
      patrol: { x: 800 + (i * 410) % 1500, y: 700 + (i * 600) % 1500 }
    };
    policeCars.push(spawn);
  }
}

function resetGame() {
  state.cash = 0;
  state.health = 100;
  state.heat = 0;
  state.level = 1;
  state.won = false;
  state.lost = false;
  player.x = 160;
  player.y = 160;
  player.vx = 0;
  player.vy = 0;
  player.speed = 0;
  state.flashes = [];
  spawnPolice(3 + state.level);
  resetMission();
}

function addFlash(x, y, color, duration = 0.35) {
  state.flashes.push({ x, y, color, life: duration, maxLife: duration });
}

function applyInput(dt) {
  const moveX = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const moveY = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  if (moveX !== 0 || moveY !== 0) {
    const len = Math.hypot(moveX, moveY) || 1;
    const dirX = moveX / len;
    const dirY = moveY / len;
    const accel = player.acceleration * (keys.Shift ? 1.35 : 1);
    player.vx += dirX * accel * dt;
    player.vy += dirY * accel * dt;
    player.angle = Math.atan2(dirY, dirX);
  }

  const currentSpeed = Math.hypot(player.vx, player.vy);
  if (currentSpeed > 0) {
    const reducedSpeed = Math.max(0, currentSpeed - player.friction * dt);
    player.vx *= reducedSpeed / currentSpeed;
    player.vy *= reducedSpeed / currentSpeed;
  }

  const maxSpeed = player.maxSpeed * (keys.Shift ? 1.2 : 1);
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > maxSpeed) {
    const factor = maxSpeed / speed;
    player.vx *= factor;
    player.vy *= factor;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.speed = Math.hypot(player.vx, player.vy);
}

function collidesCircleRect(x, y, r, rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.w);
  const closestY = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy < r * r;
}

function handleWorldCollisions() {
  const nextX = player.x;
  const nextY = player.y;

  for (const rect of buildings) {
    if (collidesCircleRect(nextX, player.y, player.radius, rect) || collidesCircleRect(player.x, nextY, player.radius, rect)) {
      if (Math.abs(player.x - (rect.x + rect.w / 2)) > Math.abs(player.y - (rect.y + rect.h / 2))) {
        player.x = clamp(player.x, rect.x - player.radius, rect.x + rect.w + player.radius);
      } else {
        player.y = clamp(player.y, rect.y - player.radius, rect.y + rect.h + player.radius);
      }
      player.vx *= -0.2;
      player.vy *= -0.2;
      break;
    }
  }

  player.x = clamp(player.x, player.radius, WORLD.width - player.radius);
  player.y = clamp(player.y, player.radius, WORLD.height - player.radius);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function updatePickupState() {
  if (state.mission === 'pickup') {
    const target = pickupSpots[0];
    if (distance(player, target) < 65) {
      state.mission = 'deliver';
      state.heat = 25;
      state.cashBonus = target.reward;
      setMessage('Package Stolen', 'The deal is live. Deliver it to a safehouse before the police close in.');
      addFlash(target.x, target.y, '#ffd166', 0.9);
      pickupSpots.shift();
      if (pickupSpots.length === 0) {
        pickupSpots.push({ x: 210, y: 150, reward: 400 });
      }
    }
  }

  if (state.mission === 'deliver') {
    const target = dropoffSpots[(state.level - 1) % dropoffSpots.length];
    if (distance(player, target) < 90) {
      state.cash += state.cashBonus + (state.level * 200);
      state.heat = Math.max(0, state.heat - 18);
      state.level += 1;
      state.mission = 'pickup';
      setMessage('Mission Complete', `Cash secured: $${Math.floor(state.cash)}. Another pickup is waiting.`);
      addFlash(target.x, target.y, '#44e095', 0.9);
      spawnPolice(3 + state.level);
    }
  }
}

function updateHeatAndDamage(dt) {
  if (state.mission === 'pickup') {
    state.heat = Math.max(0, state.heat - dt * 6);
  } else {
    state.heat = Math.min(100, state.heat + dt * 14 + player.speed * 0.015);
  }

  let damage = 0;
  for (const cop of policeCars) {
    const near = distance(player, cop) < 90;
    if (near) {
      damage += dt * 14;
    }
  }

  if (damage > 0) {
    state.health -= damage;
    if (state.health <= 0) {
      state.lost = true;
      setMessage('Busted', 'The heat was too high. Press R to restart the run.');
    }
  }
}

function updatePolice(dt) {
  for (const cop of policeCars) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const chase = dist < 550 || state.heat > 30;
    let targetX;
    let targetY;
    let speedCap;

    if (chase) {
      targetX = dx / dist;
      targetY = dy / dist;
      speedCap = 260;
    } else {
      const mx = cop.patrol.x - cop.x;
      const my = cop.patrol.y - cop.y;
      const patrolDistance = Math.hypot(mx, my) || 1;
      targetX = mx / patrolDistance;
      targetY = my / patrolDistance;
      speedCap = 140;
      if (patrolDistance < 40) {
        cop.patrol.x = 220 + Math.random() * (WORLD.width - 440);
        cop.patrol.y = 220 + Math.random() * (WORLD.height - 440);
      }
    }

    const turn = Math.min(1, dt * 2.5);
    cop.vx += (targetX * speedCap - cop.vx) * turn;
    cop.vy += (targetY * speedCap - cop.vy) * turn;
    cop.angle = Math.atan2(cop.vy, cop.vx);
    cop.x += cop.vx * dt;
    cop.y += cop.vy * dt;
    cop.x = clamp(cop.x, 20, WORLD.width - 20);
    cop.y = clamp(cop.y, 20, WORLD.height - 20);
  }
}

function drawBackground() {
  ctx.fillStyle = '#102a2a';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const cameraX = clamp(player.x - viewWidth / 2, 0, WORLD.width - viewWidth);
  const cameraY = clamp(player.y - viewHeight / 2, 0, WORLD.height - viewHeight);

  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  ctx.fillStyle = '#183c2d';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  for (const rect of roadRects) {
    ctx.fillStyle = '#2b2d35';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.23)';
    ctx.lineWidth = 4;
    ctx.setLineDash([22, 28]);
    if (rect.w > rect.h) {
      ctx.beginPath();
      ctx.moveTo(rect.x + 40, rect.y + rect.h / 2);
      ctx.lineTo(rect.x + rect.w - 40, rect.y + rect.h / 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(rect.x + rect.w / 2, rect.y + 40);
      ctx.lineTo(rect.x + rect.w / 2, rect.y + rect.h - 40);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  for (const building of buildings) {
    ctx.fillStyle = building.color;
    ctx.fillRect(building.x, building.y, building.w, building.h);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(building.x + 12, building.y + 12, building.w - 24, building.h - 24);
    ctx.strokeStyle = 'rgba(130,170,210,0.2)';
    ctx.strokeRect(building.x + 2, building.y + 2, building.w - 4, building.h - 4);
  }

  const pickupTarget = state.mission === 'pickup' ? pickupSpots[0] : null;
  if (pickupTarget) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(pickupTarget.x, pickupTarget.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  const dropTarget = state.mission === 'deliver' ? dropoffSpots[(state.level - 1) % dropoffSpots.length] : null;
  if (dropTarget) {
    ctx.strokeStyle = '#57ef9b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(dropTarget.x, dropTarget.y, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(87,239,155,0.2)';
    ctx.fill();
  }

  for (const cop of policeCars) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = cop.color;
    ctx.fillRect(-18, -12, 36, 24);
    ctx.fillStyle = '#1d273d';
    ctx.fillRect(-9, -8, 18, 16);
    ctx.fillStyle = '#ffe5a3';
    ctx.fillRect(14, -6, 7, 4);
    ctx.fillRect(14, 2, 7, 4);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.color;
  ctx.fillRect(-17, -12, 34, 24);
  ctx.fillStyle = '#163247';
  ctx.fillRect(-9, -8, 18, 16);
  ctx.fillStyle = '#f2e8d0';
  ctx.fillRect(15, -6, 7, 4);
  ctx.fillRect(15, 2, 7, 4);
  ctx.restore();

  for (const flash of state.flashes) {
    const alpha = flash.life / flash.maxLife;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.fillStyle = flash.color;
    ctx.arc(flash.x, flash.y, 30 + (1 - alpha) * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawMinimap() {
  const { width, height } = minimapCanvas;
  minimapCtx.clearRect(0, 0, width, height);
  minimapCtx.fillStyle = '#071b20';
  minimapCtx.fillRect(0, 0, width, height);

  const scaleX = width / WORLD.width;
  const scaleY = height / WORLD.height;

  minimapCtx.fillStyle = '#204f3d';
  minimapCtx.fillRect(0, 0, width, height);

  minimapCtx.fillStyle = '#3d4657';
  for (const rect of roadRects) {
    minimapCtx.fillRect(rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY);
  }

  minimapCtx.fillStyle = '#1d314a';
  for (const building of buildings) {
    minimapCtx.fillRect(building.x * scaleX, building.y * scaleY, building.w * scaleX, building.h * scaleY);
  }

  const target = state.mission === 'pickup' ? pickupSpots[0] : dropoffSpots[(state.level - 1) % dropoffSpots.length];
  if (target) {
    minimapCtx.fillStyle = state.mission === 'pickup' ? '#ffd166' : '#57ef9b';
    minimapCtx.beginPath();
    minimapCtx.arc(target.x * scaleX, target.y * scaleY, 6, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  minimapCtx.fillStyle = '#f76666';
  for (const cop of policeCars) {
    minimapCtx.fillRect(cop.x * scaleX - 3, cop.y * scaleY - 3, 6, 6);
  }

  minimapCtx.fillStyle = '#71d9ff';
  minimapCtx.fillRect(player.x * scaleX - 4, player.y * scaleY - 4, 8, 8);
}

function update(dt) {
  if (state.lost || state.won) {
    updateHud();
    return;
  }

  applyInput(dt);
  handleWorldCollisions();
  updatePickupState();
  updatePolice(dt);
  updateHeatAndDamage(dt);

  for (const flash of state.flashes) {
    flash.life -= dt;
  }
  state.flashes = state.flashes.filter(flash => flash.life > 0);

  if (state.health <= 0) {
    state.lost = true;
    setMessage('Busted', 'The heat was too high. Press R to restart the run.');
  }

  updateHud();
}

function render() {
  drawBackground();
  drawMinimap();
}

let lastTime = 0;
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.032);
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function setTouchButtonState(key, active) {
  const button = document.querySelector(`[data-key="${key}"]`);
  if (!button) return;
  button.classList.toggle('active', active);
}

function bindInput() {
  document.addEventListener('keydown', event => {
    keys[event.code] = true;
    if (event.code === 'KeyR' && (state.lost || state.won)) resetGame();
    if (event.code === 'Escape') {
      keys.ArrowLeft = false;
      keys.ArrowRight = false;
      keys.ArrowUp = false;
      keys.ArrowDown = false;
      keys.KeyA = false;
      keys.KeyD = false;
      keys.KeyW = false;
      keys.KeyS = false;
    }
    if (event.code === 'KeyM') {
      const prev = state.message.title;
      setMessage(prev === 'Open City' ? 'Mission Brief' : 'Open City', prev === 'Open City' ? 'Cash, heat, and health are all at the top of the screen.' : 'Drive: WASD / arrows • Boost: Shift • Grab gold, reach a safehouse.');
    }
  });

  document.addEventListener('keyup', event => {
    keys[event.code] = false;
    setTouchButtonState(event.code, false);
  });

  document.querySelectorAll('[data-key]').forEach(button => {
    const key = button.dataset.key;
    const hold = event => {
      event.preventDefault();
      const active = true;
      keys[key] = true;
      setTouchButtonState(key, active);
    };
    const release = event => {
      event.preventDefault();
      keys[key] = false;
      setTouchButtonState(key, false);
    };
    button.addEventListener('pointerdown', hold);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', release);
  });
}

function fitCanvas() {
  const ratio = window.devicePixelRatio || 1;
  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;
  canvas.width = viewWidth * ratio;
  canvas.height = viewHeight * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

window.addEventListener('resize', fitCanvas);
fitCanvas();
resetGame();
bindInput();
requestAnimationFrame(gameLoop);
