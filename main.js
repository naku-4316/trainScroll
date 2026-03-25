const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const distanceEl = document.getElementById('distance');
const speedEl = document.getElementById('speed');
const stateEl = document.getElementById('state');

const WORLD_WIDTH = canvas.width;
const WORLD_HEIGHT = canvas.height;

// 斜め上から見下ろした雰囲気を出すため、奥ほど上・手前ほど下に配置
const LANE_Y = [425, 505, 585];
const GROUND_BASE_Y = 630;

const input = {
  dash: false,
};

const state = {
  elapsed: 0,
  distance: 0,
  gameOver: false,
};

const player = {
  x: 230,
  y: LANE_Y[1],
  targetY: LANE_Y[1],
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
  // far -> near
  { color: '#0d1f4f', speedFactor: 0.12, y: 330, h: 220, points: [] },
  { color: '#12306f', speedFactor: 0.26, y: 405, h: 260, points: [] },
  { color: '#1a4c97', speedFactor: 0.44, y: 495, h: 280, points: [] },
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
  const lane = Math.floor(seededRange(0, 3));
  const type = Math.random() > 0.55 ? 'tall' : 'small';
  const h = type === 'tall' ? 90 : 58;
  const w = type === 'tall' ? 44 : 68;

  obstacles.push({
    x: WORLD_WIDTH + seededRange(60, 260),
    y: LANE_Y[lane] + player.h - h,
    w,
    h,
    lane,
    type,
  });
}

function resetGame() {
  state.elapsed = 0;
  state.distance = 0;
  state.gameOver = false;

  player.lane = 1;
  player.y = LANE_Y[player.lane];
  player.targetY = LANE_Y[player.lane];

  speedControl.current = speedControl.base;
  obstacles.length = 0;
  obstacleTimer = 0;
  layers.forEach(initLayerPoints);
}

function moveLane(direction) {
  const next = Math.max(0, Math.min(2, player.lane + direction));
  player.lane = next;
  player.targetY = LANE_Y[next];
}

function updatePlayer(dt) {
  const diff = player.targetY - player.y;
  player.y += diff * Math.min(1, 12 * dt);
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
  if (state.gameOver) return;

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

  // 要望により障害物の当たり判定は一旦オフ
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
  const topY = 500;

  // 斜め上から見下ろす遠近感を持つ台形地面
  ctx.fillStyle = '#173c3f';
  ctx.beginPath();
  ctx.moveTo(0, topY);
  ctx.lineTo(WORLD_WIDTH, topY);
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.lineTo(0, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#2d8e85';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, topY);
  ctx.lineTo(WORLD_WIDTH, topY);
  ctx.stroke();

  // 3レーン
  ctx.strokeStyle = 'rgba(166, 247, 226, 0.45)';
  ctx.lineWidth = 3;
  for (const laneY of LANE_Y) {
    const y = laneY + player.h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y);
    ctx.stroke();
  }

  // 走行線
  const stripeSpeed = speedControl.current * 0.7;
  const offset = -((state.elapsed * stripeSpeed) % 100);
  for (let x = offset; x < WORLD_WIDTH + 120; x += 100) {
    ctx.fillStyle = '#2b8b80';
    ctx.fillRect(x, GROUND_BASE_Y + 40, 64, 8);
  }
}

function drawPlayer() {
  const px = player.x;
  const py = player.y;

  ctx.save();
  ctx.translate(px, py);

  ctx.fillStyle = player.color;
  ctx.fillRect(0, 0, player.w, player.h);

  ctx.fillStyle = '#d2f7ff';
  ctx.fillRect(33, 18, 12, 12);

  ctx.fillStyle = '#041016';
  ctx.fillRect(38, 22, 5, 5);

  if (input.dash && !state.gameOver) {
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

function drawGameOver() {
  if (!state.gameOver) return;

  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Segoe UI';
  ctx.fillText('GAME OVER', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 20);
  ctx.font = '28px Segoe UI';
  ctx.fillText('Rキーでリスタート', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 38);
}

function updateHud() {
  distanceEl.textContent = Math.floor(state.distance).toLocaleString('ja-JP');
  speedEl.textContent = Math.round(speedControl.current * 0.08).toLocaleString('ja-JP');
  stateEl.textContent = state.gameOver ? 'DOWN' : input.dash ? 'BOOST' : `LANE ${player.lane + 1}`;
}

let lastTime = performance.now();
function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  if (!state.gameOver) {
    state.elapsed += dt;
    state.distance += (speedControl.current * dt) / 8;
  }

  updateSpeed(dt);
  updateBackground(dt);
  updatePlayer(dt);
  updateObstacles(dt);

  drawSky();
  for (const layer of layers) drawLayer(layer);
  drawGround();
  drawObstacles();
  drawPlayer();
  drawGameOver();
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
  if (e.code === 'KeyR' && state.gameOver) {
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
