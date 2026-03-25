const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const distanceEl = document.getElementById('distance');
const speedEl = document.getElementById('speed');
const stateEl = document.getElementById('state');

const WORLD_WIDTH = canvas.width;
const WORLD_HEIGHT = canvas.height;
const GROUND_Y = 575;

const input = {
  jump: false,
  dash: false,
};

const state = {
  elapsed: 0,
  distance: 0,
  gameOver: false,
};

const player = {
  x: 210,
  y: GROUND_Y,
  w: 52,
  h: 78,
  vy: 0,
  gravity: 1850,
  jumpPower: -820,
  onGround: true,
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
  { color: '#0f1f4d', speedFactor: 0.12, y: 460, h: 220, points: [] },
  { color: '#12316f', speedFactor: 0.28, y: 500, h: 180, points: [] },
  { color: '#18448f', speedFactor: 0.45, y: 535, h: 145, points: [] },
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
      height: seededRange(18, 95),
      width: seededRange(80, 180),
    });
    x += seededRange(85, 170);
  }
}

layers.forEach(initLayerPoints);

function spawnObstacle() {
  const type = Math.random() > 0.65 ? 'tall' : 'small';
  obstacles.push({
    x: WORLD_WIDTH + seededRange(40, 240),
    y: type === 'tall' ? GROUND_Y - 90 : GROUND_Y - 55,
    w: type === 'tall' ? 42 : 65,
    h: type === 'tall' ? 90 : 55,
    type,
  });
}

function resetGame() {
  state.elapsed = 0;
  state.distance = 0;
  state.gameOver = false;

  player.y = GROUND_Y;
  player.vy = 0;
  player.onGround = true;

  speedControl.current = speedControl.base;
  obstacles.length = 0;
  obstacleTimer = 0;
  layers.forEach(initLayerPoints);
}

function updatePlayer(dt) {
  if (state.gameOver) return;

  if (input.jump && player.onGround) {
    player.vy = player.jumpPower;
    player.onGround = false;
  }

  player.vy += player.gravity * dt;
  player.y += player.vy * dt;

  if (player.y >= GROUND_Y) {
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
  }
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
    if (last && last.x < WORLD_WIDTH) {
      layer.points.push({
        x: last.x + seededRange(90, 160),
        height: seededRange(18, 100),
        width: seededRange(80, 180),
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
    obstacleTimer = seededRange(0.75, 1.5) - (speedControl.current / 3000);
    obstacleTimer = Math.max(0.42, obstacleTimer);
  }

  for (const obs of obstacles) {
    obs.x -= speedControl.current * dt;
  }

  while (obstacles[0] && obstacles[0].x + obstacles[0].w < -120) {
    obstacles.shift();
  }

  for (const obs of obstacles) {
    if (
      player.x < obs.x + obs.w &&
      player.x + player.w > obs.x &&
      player.y < obs.y + obs.h &&
      player.y + player.h > obs.y
    ) {
      state.gameOver = true;
      break;
    }
  }
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, '#1f2f74');
  gradient.addColorStop(0.45, '#15275c');
  gradient.addColorStop(1, '#081024');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (let i = 0; i < 26; i++) {
    const x = (i * 89 + state.elapsed * 15) % (WORLD_WIDTH + 60) - 30;
    const y = 80 + Math.sin((i * 0.4) + state.elapsed * 0.5) * 20;
    ctx.fillStyle = `rgba(255,255,255,${0.12 + (i % 3) * 0.07})`;
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLayer(layer) {
  ctx.fillStyle = layer.color;
  for (const p of layer.points) {
    ctx.fillRect(p.x, layer.y - p.height, p.width, p.height + layer.h);
  }
}

function drawGround() {
  ctx.fillStyle = '#1f4d4f';
  ctx.fillRect(0, GROUND_Y + player.h - 12, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);

  const stripeSpeed = speedControl.current * 0.6;
  const offset = -((state.elapsed * stripeSpeed) % 95);
  for (let x = offset; x < WORLD_WIDTH + 120; x += 95) {
    ctx.fillStyle = '#2a7b74';
    ctx.fillRect(x, GROUND_Y + 74, 55, 8);
  }
}

function drawPlayer() {
  const px = player.x;
  const py = player.y;

  ctx.save();
  ctx.translate(px, py);

  const squish = player.onGround ? 1 : 0.95;
  ctx.scale(1.03, squish);

  ctx.fillStyle = player.color;
  ctx.fillRect(0, 0, player.w, player.h);

  ctx.fillStyle = '#d2f7ff';
  ctx.fillRect(33, 18, 12, 12);

  ctx.fillStyle = '#041016';
  ctx.fillRect(38, 22, 5, 5);

  // boost trail
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
  stateEl.textContent = state.gameOver ? 'DOWN' : input.dash ? 'BOOST' : 'RUN';
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
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    input.jump = true;
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    input.dash = true;
  }
  if (e.code === 'KeyR' && state.gameOver) {
    resetGame();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    input.jump = false;
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    input.dash = false;
  }
});

resetGame();
requestAnimationFrame(loop);
