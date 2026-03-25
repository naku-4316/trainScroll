const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const distanceEl = document.getElementById('distance');
const speedEl = document.getElementById('speed');
const stateEl = document.getElementById('state');

const WORLD_WIDTH = canvas.width;
const WORLD_HEIGHT = canvas.height;

// 斜め上から見下ろした構図: 奥レーンほど上、手前レーンほど下
const LANE_Y = [410, 500, 590];
const LANE_COUNT = 3;
const TRACK_TOP_Y = 470;
const TRACK_BOTTOM_Y = WORLD_HEIGHT;

const input = {
  dash: false,
};

const state = {
  elapsed: 0,
  distance: 0,
};

const player = {
  x: 230,
  y: LANE_Y[1],
  lane: 1,
  w: 52,
  h: 78,
  color: '#58d9ff',
};

const speedControl = {
  base: 520,
  max: 1100,
  accel: 15,
  dashBonus: 420,
  current: 520,
};

const layers = [
  { color: '#0d1f4f', speedFactor: 0.12, y: 300, h: 220, points: [] }, // far
  { color: '#12306f', speedFactor: 0.26, y: 390, h: 260, points: [] },
  { color: '#1a4c97', speedFactor: 0.44, y: 500, h: 280, points: [] }, // near
];

const obstacles = [];
let obstacleTimer = 0;

function seededRange(min, max) {
  return min + Math.random() * (max - min);
}

function initLayerPoints(layer) {
  layer.points = [];
  let x = -100;
  while (x < WORLD_WIDTH + 220) {
    layer.points.push({
      x,
      height: seededRange(55, 180),
      width: seededRange(70, 170),
    });
    x += seededRange(75, 150);
  }
}

layers.forEach(initLayerPoints);

function spawnObstacle() {
  const lane = Math.floor(seededRange(0, LANE_COUNT));
  const type = Math.random() > 0.55 ? 'tall' : 'small';
  const h = type === 'tall' ? 90 : 58;
  const w = type === 'tall' ? 44 : 68;

  obstacles.push({
    x: WORLD_WIDTH + seededRange(60, 260),
    y: LANE_Y[lane] + player.h - h,
    w,
    h,
    lane,
  });
}

function resetGame() {
  state.elapsed = 0;
  state.distance = 0;

  player.lane = 1;
  player.y = LANE_Y[player.lane];

  speedControl.current = speedControl.base;
  obstacles.length = 0;
  obstacleTimer = 0;
  layers.forEach(initLayerPoints);
}

function moveLane(direction) {
  player.lane = Math.max(0, Math.min(LANE_COUNT - 1, player.lane + direction));
  player.y = LANE_Y[player.lane];
}

function updateSpeed(dt) {
  const target = Math.min(
    speedControl.base + state.elapsed * speedControl.accel,
    speedControl.max,
  ) + (input.dash ? speedControl.dashBonus : 0);

  speedControl.current += (target - speedControl.current) * Math.min(1, 8 * dt);
}

function updateBackground(dt) {
  for (const layer of layers) {
    const velocity = speedControl.current * layer.speedFactor;

    for (const p of layer.points) {
      p.x -= velocity * dt;
    }

    const last = layer.points[layer.points.length - 1];
    if (last && last.x < WORLD_WIDTH + 80) {
      layer.points.push({
        x: last.x + seededRange(80, 150),
        height: seededRange(55, 180),
        width: seededRange(70, 170),
      });
    }

    while (layer.points[0] && layer.points[0].x + layer.points[0].width < -160) {
      layer.points.shift();
    }
  }
}

function updateObstacles(dt) {
  obstacleTimer -= dt;
  if (obstacleTimer <= 0) {
    spawnObstacle();
    obstacleTimer = seededRange(0.8, 1.45) - (speedControl.current / 3100);
    obstacleTimer = Math.max(0.46, obstacleTimer);
  }

  for (const obs of obstacles) {
    obs.x -= speedControl.current * dt;
  }

  while (obstacles[0] && obstacles[0].x + obstacles[0].w < -120) {
    obstacles.shift();
  }

  // 障害物の当たり判定は完全に無効
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, '#1f2f74');
  gradient.addColorStop(0.45, '#14275a');
  gradient.addColorStop(1, '#081024');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawLayer(layer) {
  ctx.fillStyle = layer.color;
  for (const p of layer.points) {
    ctx.fillRect(p.x, layer.y - p.height, p.width, p.height + layer.h);
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.fillRect(p.x + 8, layer.y - p.height + 12, Math.max(4, p.width * 0.16), 6);
    ctx.fillStyle = layer.color;
  }
}

function drawGround() {
  ctx.fillStyle = '#173c3f';
  ctx.beginPath();
  ctx.moveTo(0, TRACK_TOP_Y);
  ctx.lineTo(WORLD_WIDTH, TRACK_TOP_Y);
  ctx.lineTo(WORLD_WIDTH, TRACK_BOTTOM_Y);
  ctx.lineTo(0, TRACK_BOTTOM_Y);
  ctx.closePath();
  ctx.fill();

  // 3レーンを視覚的に明確化
  ctx.strokeStyle = '#7de6ce';
  ctx.lineWidth = 3;
  for (let i = 0; i < LANE_COUNT; i++) {
    const y = LANE_Y[i] + player.h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y);
    ctx.stroke();
  }

  const stripeSpeed = speedControl.current * 0.7;
  const offset = -((state.elapsed * stripeSpeed) % 100);
  for (let x = offset; x < WORLD_WIDTH + 120; x += 100) {
    ctx.fillStyle = '#2b8b80';
    ctx.fillRect(x, 670, 64, 8);
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = player.color;
  ctx.fillRect(0, 0, player.w, player.h);

  ctx.fillStyle = '#d2f7ff';
  ctx.fillRect(33, 18, 12, 12);

  ctx.fillStyle = '#041016';
  ctx.fillRect(38, 22, 5, 5);

  if (input.dash) {
    ctx.fillStyle = 'rgba(88,217,255,.35)';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(-10 - i * 14, 20 + i * 4, 14, 6);
    }
  }

  ctx.restore();
}

function drawObstacles() {
  for (const obs of obstacles) {
    const gradient = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.h);
    gradient.addColorStop(0, '#ff92a6');
    gradient.addColorStop(1, '#9a2341');
    ctx.fillStyle = gradient;
    ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(obs.x + 7, obs.y + 8, obs.w - 14, 6);
  }
}

function updateHud() {
  distanceEl.textContent = Math.floor(state.distance).toLocaleString('ja-JP');
  speedEl.textContent = Math.round(speedControl.current * 0.08).toLocaleString('ja-JP');
  stateEl.textContent = `LANE ${player.lane + 1}`;
}

let lastTime = performance.now();
function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  state.elapsed += dt;
  state.distance += (speedControl.current * dt) / 8;

  updateSpeed(dt);
  updateBackground(dt);
  updateObstacles(dt);

  drawSky();
  for (const layer of layers) drawLayer(layer);
  drawGround();
  drawObstacles();
  drawPlayer();
  updateHud();

  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp') {
    e.preventDefault();
    moveLane(-1);
  }
  if (e.code === 'ArrowDown') {
    e.preventDefault();
    moveLane(1);
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    input.dash = true;
  }
  if (e.code === 'KeyR') {
    resetGame();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    input.dash = false;
  }
});

resetGame();
requestAnimationFrame(loop);
