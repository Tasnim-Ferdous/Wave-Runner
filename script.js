const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverScreen = document.getElementById('game-over');
const waveProgress = document.getElementById('wave-progress');
const waveWarning = document.getElementById('waveWarning');
const bgMusic = document.getElementById('bgMusic');
const gameOverMusic = document.getElementById('gameOverMusic');
const powerUpMusic = document.getElementById('powerUpMusic');
const levelUpMusic = document.getElementById('levelUpMusic');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');
const startScreen = document.getElementById('start-screen');
const gameOverScore = document.getElementById('game-over-score');

const player = {
  x: 100,
  y: 300,
  width: 30,
  height: 30,
  color: '#facc15',
  vy: 0,
  jumpPower: -13,
  grounded: false,
  speed: 4
};

let cameraX = 0;
let platforms = generatePlatforms();
let powerUps = generatePowerUps();
let enemies = generateEnemies();
let traps = generateTraps();

let waveX = -70;
let waveSpeed = 35;
let keys = {};
let gameOver = false;
let gameOverAnimProgress = 0;
let startTime = null;
let score = 0;
let lastScoreUpdate = 0;
let level = 1;
let waveWarningPlayed = false;
let countdownOverlay;

const bgLayers = [
  { offset: 0, speed: 0.2, color: '#022c43' },
  { offset: 0, speed: 0.5, color: '#03506f' },
  { offset: 0, speed: 1.0, color: '#0388a6' }
];

function generatePlatforms() {
  const list = [];
  for (let i = 0; i < 1000; i++) {
    list.push({
      x: i * 200,
      y: 420 - Math.floor(Math.random() * 160),
      width: 160,
      height: 10
    });
  }
  list.unshift({ x: 0, y: 460, width: 800, height: 20 });
  return list;
}

function generatePowerUps() {
  return platforms.filter((_, i) => i % 7 === 0 && i !== 0).map(p => ({
    x: p.x + 40,
    y: p.y - 20,
    width: 15,
    height: 15,
    active: true
  }));
}

function generateEnemies() {
  return platforms.filter((_, i) => i % 9 === 0 && i !== 0).map(p => ({
    x: p.x + 50,
    y: p.y - 25,
    width: 20,
    height: 20
  }));
}

function generateTraps() {
  return platforms.filter((_, i) => i % 10 === 0 && i !== 0).map(p => ({
    x: p.x + 80,
    y: p.y - 5,
    width: 10,
    height: 10
  }));
}

function drawBackground() {
  for (let layer of bgLayers) {
    layer.offset = cameraX * layer.speed;
    ctx.fillStyle = layer.color;
    ctx.fillRect(-layer.offset, 0, canvas.width * 2, canvas.height);
  }
}

function drawPlayer() {
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x - cameraX, player.y, player.width, player.height);
}

function drawPlatforms() {
  ctx.fillStyle = '#334155';
  for (let p of platforms) {
    ctx.fillRect(p.x - cameraX, p.y, p.width, p.height);
  }
}

function drawPowerUps() {
  ctx.fillStyle = '#10b981';
  for (let p of powerUps) {
    if (p.active) ctx.fillRect(p.x - cameraX, p.y, p.width, p.height);
  }
}

function drawEnemies() {
  ctx.fillStyle = '#e11d48';
  for (let e of enemies) {
    ctx.fillRect(e.x - cameraX, e.y, e.width, e.height);
  }
}

function drawTraps() {
  ctx.fillStyle = '#f59e0b';
  for (let t of traps) {
    ctx.beginPath();
    ctx.moveTo(t.x - cameraX, t.y + t.height);
    ctx.lineTo(t.x - cameraX + t.width / 2, t.y);
    ctx.lineTo(t.x - cameraX + t.width, t.y + t.height);
    ctx.fill();
  }
}

function drawWave() {
  const amplitude = 10;
  const frequency = 0.03;

  ctx.fillStyle = 'rgba(14,165,233,0.7)';
  ctx.beginPath();
  ctx.moveTo(waveX - cameraX, 0);

  for (let y = 0; y <= canvas.height; y += 10) {
    const offset = Math.sin(y * frequency + Date.now() / 300) * amplitude;
    ctx.lineTo(waveX - cameraX + offset, y);
  }

  ctx.lineTo(waveX - cameraX, canvas.height);
  ctx.closePath();
  ctx.fill();
}

function updatePlayer() {
  player.vy += 0.5;
  player.y += player.vy;
  player.grounded = false;

  for (let p of platforms) {
    const withinX = player.x + player.width > p.x && player.x < p.x + p.width;
    const fallingOnPlatform = player.y + player.height <= p.y + 5 && player.y + player.height + player.vy >= p.y;
    if (withinX && fallingOnPlatform) {
      player.y = p.y - player.height;
      player.vy = 0;
      player.grounded = true;
    }
  }

  for (let pu of powerUps) {
    if (pu.active && player.x + player.width > pu.x && player.x < pu.x + pu.width && player.y + player.height > pu.y && player.y < pu.y + pu.height) {
      pu.active = false;
      player.speed += 1;
      setTimeout(() => player.speed = 4, 5000);
      powerUpMusic.play();
    }
  }

  for (let e of enemies) {
    if (player.x + player.width > e.x && player.x < e.x + e.width && player.y + player.height > e.y && player.y < e.y + e.height) {
      triggerGameOver();
    }
  }

  for (let t of traps) {
    if (player.x + player.width > t.x && player.x < t.x + t.width && player.y + player.height > t.y && player.y < t.y + t.height) {
      triggerGameOver();
    }
  }

  if (keys['ArrowLeft'] || keys['a']) player.x -= player.speed;
  if (keys['ArrowRight'] || keys['d']) player.x += player.speed;
  if ((keys[' '] || keys['w'] || keys['ArrowUp']) && player.grounded) player.vy = player.jumpPower;

  cameraX = player.x - 100;
  if (player.y > canvas.height) triggerGameOver();
}

function checkWaveCollision() {
  if (player.x < waveX + 20) triggerGameOver();
}

function updateWave(timestamp) {
  if (!startTime) startTime = timestamp;
  const elapsed = (timestamp - startTime) / 1000;
  waveSpeed = 3 + score / 250;
  waveX += waveSpeed;

  const dist = player.x - waveX;
  const maxDist = 500;
  const progress = Math.max(0, Math.min(1, 1 - dist / maxDist));
  waveProgress.style.width = `${progress * 100}%`;

  if (progress > 0.75 && !waveWarningPlayed) {
    waveWarning.play();
    waveWarningPlayed = true;
  } else if (progress < 0.6) {
    waveWarning.pause();
    waveWarningPlayed = false;
  }
}

function drawScore() {
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px Arial';
  ctx.fillText(`Score: ${score}`, 10, 25);
  ctx.fillText(`Level: ${level}`, 10, 45);
  gameOverScore.innerText = score;
}

function updateScore(timestamp) {
  if (timestamp - lastScoreUpdate > 500) {
    score++;
    lastScoreUpdate = timestamp;
  }
  if (score > level * 30) { 
    level++;
    levelUpMusic.play();
  }
}

function triggerGameOver() {
  gameOver = true;
  bgMusic.pause();
  waveWarning.pause();
  gameOverMusic.play();
  animateGameOver();
}

function animateGameOver() {
  const anim = () => {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(gameOverAnimProgress / 30, 0.8)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(gameOverAnimProgress / 30, 1)})`;
    gameOverAnimProgress++;
    if (gameOverAnimProgress < 5) requestAnimationFrame(anim);
    else gameOverScreen.classList.add('visible');
  };
  anim();
}

function gameLoop(timestamp) {
  if (gameOver) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawWave();
  drawPlatforms();
  drawPowerUps();
  drawEnemies();
  drawTraps();
  updatePlayer();
  drawPlayer();
  updateWave(timestamp);
  checkWaveCollision();
  updateScore(timestamp);
  drawScore();

  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

function startWithCountdown() {
  let countdown = 3;
  countdownOverlay = document.createElement('div');
  countdownOverlay.style.position = 'absolute';
  countdownOverlay.style.top = '50%';
  countdownOverlay.style.left = '50%';
  countdownOverlay.style.transform = 'translate(-50%, -50%)';
  countdownOverlay.style.fontSize = '48px';
  countdownOverlay.style.color = '#fff';
  countdownOverlay.style.background = 'rgba(0,0,0,0.5)';
  countdownOverlay.style.padding = '20px 40px';
  countdownOverlay.style.borderRadius = '10px';
  countdownOverlay.style.zIndex = '100';
  document.body.appendChild(countdownOverlay);

  const countdownInterval = setInterval(() => {
    if (countdown > 0) {
      countdownOverlay.innerText = countdown--;
    } else {
      clearInterval(countdownInterval);
      document.body.removeChild(countdownOverlay);
      requestAnimationFrame(gameLoop);
      countdownOverlay.style.display = 'none';
    }
  }, 1000);
}

function restartGame() {
  Object.assign(player, { x: 100, y: 300, vy: 0, speed: 4 });
  platforms = generatePlatforms();
  powerUps = generatePowerUps();
  enemies = generateEnemies();
  traps = generateTraps();
  waveX = -70;
  score = 0;
  level = 1;
  waveSpeed = 35;
  gameOverAnimProgress = 0;
  startTime = null;
  gameOver = false;
  waveWarningPlayed = false;
  bgMusic.currentTime = 0; 
  bgMusic.play();
  gameOverScreen.classList.remove('visible');
  startWithCountdown();
}

startBtn.addEventListener('click', () => {
  startScreen.classList.remove('visible');
  startScreen.classList.add('hidden');
  bgMusic.play();
  startWithCountdown();
});

restartBtn.addEventListener('click', restartGame);