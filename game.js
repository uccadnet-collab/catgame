'use strict';
// ═══════════════════════════════════════════════
//  유현이 고양이의 모험  –  game.js
// ═══════════════════════════════════════════════
const canvas  = document.getElementById('canvas');
const ctx     = canvas.getContext('2d');
const CW = 800, CH = 450;
canvas.width = CW; canvas.height = CH;

// ── 캔버스 반응형 스케일 ──────────────────────
function scaleCanvas() {
  const maxW = window.innerWidth  - 8;
  const maxH = window.innerHeight - 160;
  const scale = Math.min(maxW / CW, maxH / CH, 1);
  canvas.style.width  = (CW * scale) + 'px';
  canvas.style.height = (CH * scale) + 'px';
}
scaleCanvas();
window.addEventListener('resize', scaleCanvas);

// ── 상수 ──────────────────────────────────────
const GRAVITY      = 0.55;
const PLAYER_SPEED = 4.5;
const JUMP_FORCE   = -13;
const GROUND_Y     = CH - 60;
const TILE         = 40;
const MAX_LEVEL    = 20;

// ── 캐릭터 이미지 ──────────────────────────────
const catImg = new Image();
catImg.src = 'cat.png';   // cat.png 파일을 game 폴더에 넣으면 자동 적용
let catLoaded = false;
catImg.onload  = () => { catLoaded = true; };
catImg.onerror = () => { catLoaded = false; };

// ── 상태 ──────────────────────────────────────
let state     = 'menu';
let score     = 0;
let lives     = 10;
let level     = 1;
let cameraX   = 0;
let frameCount = 0;
let invincible = 0;

// ── 슈퍼 모드 ─────────────────────────────────
const SUPER_DURATION = 600; // 10초 (60fps × 10)
const SUPER_COIN_COUNT = 10; // 코인 10개마다 발동
let superTimer   = 0;   // 남은 슈퍼 프레임
let coinCounter  = 0;   // 이번 슈퍼 구간 코인 카운터

// ── 키 입력 ───────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  if (!keys[e.code]) {
    keys[e.code] = true;
    if (state === 'play') tryJump();
    if ((e.code === 'Space') || (e.code === 'ArrowUp')) e.preventDefault();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

function isLeft()  { return keys['ArrowLeft']  || keys['KeyA'] || mobileKeys.left;  }
function isRight() { return keys['ArrowRight'] || keys['KeyD'] || mobileKeys.right; }

// ── 모바일 터치 ───────────────────────────────
const mobileKeys = { left: false, right: false };

function bindMobileBtn(id, key) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const down = () => {
    if (key === 'jump') { if (state === 'play') tryJump(); }
    else mobileKeys[key] = true;
    btn.classList.add('pressed');
  };
  const up = () => {
    if (key !== 'jump') mobileKeys[key] = false;
    btn.classList.remove('pressed');
  };
  btn.addEventListener('touchstart', e => { e.preventDefault(); down(); }, { passive: false });
  btn.addEventListener('touchend',   e => { e.preventDefault(); up();   }, { passive: false });
  btn.addEventListener('mousedown', down);
  btn.addEventListener('mouseup',   up);
}
bindMobileBtn('btn-left',  'left');
bindMobileBtn('btn-right', 'right');
bindMobileBtn('btn-jump',  'jump');

// 모바일인지 감지 → 버튼 표시
function isTouchDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}
if (isTouchDevice()) {
  const mc = document.getElementById('mobile-controls');
  if (mc) mc.style.display = 'flex';
}

// ── 점프 ──────────────────────────────────────
function tryJump() {
  if (player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
    player.jumps = 1;
  } else if (player.jumps < 2) {
    player.vy = JUMP_FORCE * 0.82;
    player.jumps++;
  }
}

// ── 플레이어 ──────────────────────────────────
const player = {
  x: 80, y: GROUND_Y - 44, w: 36, h: 44,
  vx: 0, vy: 0, onGround: false, jumps: 0,
  facing: 1,
  reset() {
    this.x = 80; this.y = GROUND_Y - this.h;
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.jumps = 0;
  }
};

// ══════════════════════════════════════════════
//  레벨 생성 (20 레벨)
// ══════════════════════════════════════════════
const WORLD_W = 1600;  // 기본 월드 너비 (레벨별로 증가)

function getWorldW(lvl) { return 1600 + (lvl - 1) * 200; }

function makeFloor(lvl) {
  const ww = getWorldW(lvl);
  const tiles = [];
  // 기본 바닥 (일부 레벨에서 구멍 뚫기)
  const gapPattern = getLevelGaps(lvl);
  let x = 0;
  while (x < ww + TILE) {
    const inGap = gapPattern.some(g => x >= g[0] && x < g[1]);
    if (!inGap) {
      tiles.push({ x, y: GROUND_Y, w: TILE, h: 60, color: '#4a7c59' });
    }
    x += TILE;
  }
  return tiles;
}

// 레벨별 바닥 구멍 (x범위 쌍)
function getLevelGaps(lvl) {
  const gaps = {
    1:  [],
    2:  [[500, 540]],
    3:  [[400, 450], [700, 760]],
    4:  [[300, 360], [600, 650], [900, 960]],
    5:  [[350, 410], [650, 720], [1000, 1080]],
    6:  [[280, 340], [580, 650], [900, 980], [1200, 1270]],
    7:  [[300, 370], [600, 680], [900, 980], [1200, 1280]],
    8:  [[250, 330], [550, 640], [850, 950], [1150, 1250]],
    9:  [[240, 320], [520, 620], [820, 930], [1120, 1230], [1420, 1510]],
    10: [[220, 310], [500, 610], [800, 920], [1100, 1220], [1400, 1530]],
  };
  if (lvl <= 10) return gaps[lvl] || [];
  // 11~20: 구멍 점점 많고 넓어짐
  const count = 3 + Math.floor((lvl - 10) / 2);
  const result = [];
  const ww = getWorldW(lvl);
  for (let i = 0; i < count; i++) {
    const gx = 280 + Math.round(i * (ww - 400) / count / TILE) * TILE;
    const gw = (60 + (lvl - 10) * 4);
    result.push([gx, gx + gw]);
  }
  return result;
}

function makePlatforms(lvl) {
  const floor = makeFloor(lvl);
  const extras = getLevelPlatforms(lvl);
  return [...floor, ...extras];
}

// 레벨별 공중 플랫폼 정의
function getLevelPlatforms(lvl) {
  // 기본 세트를 레벨 난이도에 맞게 생성
  const sets = [];
  const ww = getWorldW(lvl);
  const count = 6 + Math.floor(lvl * 1.2);
  const spacing = (ww - 300) / count;
  const color = getLevelColor(lvl);

  for (let i = 0; i < count; i++) {
    const x = 200 + Math.round(i * spacing);
    // 높이는 레벨이 높을수록 더 다양하게
    const yOptions = [GROUND_Y - 100, GROUND_Y - 150, GROUND_Y - 200, GROUND_Y - 250];
    const yIdx = (i + lvl) % yOptions.length;
    const y = yOptions[yIdx];
    const w = Math.max(60, 130 - lvl * 3);  // 레벨 높을수록 플랫폼 좁아짐
    sets.push({ x, y, w, h: 18, color });
  }
  return sets;
}

function getLevelColor(lvl) {
  const colors = [
    '#5d9e6e','#6a8e7f','#7e6e9e','#9e6e6e','#6e7e9e',
    '#9e8e5e','#5e8e9e','#9e5e7e','#7e9e5e','#5e6e8e',
    '#a06040','#60a080','#8060a0','#a08060','#60a060',
    '#a06080','#6080a0','#80a060','#a08080','#8080a0',
  ];
  return colors[(lvl - 1) % colors.length];
}

function makeCoins(lvl) {
  const coins = [];
  const platList = getLevelPlatforms(lvl);
  // 플랫폼마다 코인 배치
  for (const p of platList) {
    const cnt = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < cnt; i++) {
      coins.push({ x: p.x + 20 + i * 24, y: p.y - 20, r: 9, collected: false });
    }
  }
  // 바닥 코인
  const ww = getWorldW(lvl);
  for (let x = 300; x < ww - 200; x += 180) {
    coins.push({ x, y: GROUND_Y - 20, r: 9, collected: false });
  }
  return coins;
}

function makeEnemies(lvl) {
  const speed = 1.0 + lvl * 0.15;
  const enemies = [];
  const ww = getWorldW(lvl);
  const count = 3 + Math.floor(lvl * 0.8);

  for (let i = 0; i < count; i++) {
    const x = 350 + Math.round(i * (ww - 500) / count);
    enemies.push({
      x, y: GROUND_Y - 28, w: 32, h: 28,
      vx: (i % 2 === 0 ? 1 : -1) * speed,
      patrolMin: x - 120, patrolMax: x + 120,
      alive: true
    });
  }

  // 레벨 5 이후 플랫폼 위 적 추가
  if (lvl >= 5) {
    const platList = getLevelPlatforms(lvl);
    const pickEvery = Math.max(1, Math.floor(platList.length / 3));
    for (let i = 0; i < platList.length; i += pickEvery) {
      const p = platList[i];
      if (p.w < 70) continue;
      enemies.push({
        x: p.x + 10, y: p.y - 28, w: 28, h: 28,
        vx: speed * 0.7,
        patrolMin: p.x, patrolMax: p.x + p.w - 28,
        alive: true
      });
    }
  }
  return enemies;
}

// 골 깃발
let goal = {};

function initLevel() {
  const ww = getWorldW(level);
  goal = { x: ww - 80, y: GROUND_Y - 110, w: 20, h: 110 };
  platforms = makePlatforms(level);
  coins     = makeCoins(level);
  enemies   = makeEnemies(level);
  player.reset();
  cameraX   = 0;
  invincible = 0;
  superTimer = 0;
  frameCount = 0;
}

let platforms = [];
let coins     = [];
let enemies   = [];

// ── 충돌 ──────────────────────────────────────
function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolvePlayerPlatform(p, plat) {
  const ox = Math.min(p.x + p.w, plat.x + plat.w) - Math.max(p.x, plat.x);
  const oy = Math.min(p.y + p.h, plat.y + plat.h) - Math.max(p.y, plat.y);
  if (ox <= 0 || oy <= 0) return;
  if (oy < ox) {
    if (p.y + p.h / 2 < plat.y + plat.h / 2) {
      p.y = plat.y - p.h; p.vy = 0;
      p.onGround = true; p.jumps = 0;
    } else {
      p.y = plat.y + plat.h; p.vy = 2;
    }
  } else {
    p.x = (p.x + p.w / 2 < plat.x + plat.w / 2)
          ? plat.x - p.w
          : plat.x + plat.w;
    p.vx = 0;
  }
}

// ── 업데이트 ──────────────────────────────────
function update() {
  if (state !== 'play') return;
  frameCount++;
  if (invincible > 0) invincible--;

  player.vx = 0;
  if (isLeft())  { player.vx = -PLAYER_SPEED; player.facing = -1; }
  if (isRight()) { player.vx =  PLAYER_SPEED; player.facing =  1; }

  player.vy += GRAVITY;
  player.x  += player.vx;
  player.y  += player.vy;
  player.onGround = false;

  for (const plat of platforms) {
    if (rectOverlap(player, plat)) resolvePlayerPlatform(player, plat);
  }

  if (player.x < 0) player.x = 0;

  // 카메라 (월드 끝 넘지 않게)
  const ww = getWorldW(level);
  const camTarget = player.x - CW * 0.35;
  cameraX = Math.max(0, Math.min(camTarget, ww - CW));

  // 낙하 사망
  if (player.y > CH + 120) { loseLife(); return; }

  // 적 이동 & 충돌
  for (const e of enemies) {
    if (!e.alive) continue;
    e.x += e.vx;
    if (e.x <= e.patrolMin || e.x + e.w >= e.patrolMax) e.vx *= -1;

    if (rectOverlap(player, e)) {
      const stomping = player.vy > 0 && player.y + player.h < e.y + e.h * 0.55;
      if (stomping || superTimer > 0) {
        // 슈퍼 모드 중이거나 밟기 → 처치
        e.alive = false;
        if (stomping) player.vy = JUMP_FORCE * 0.55;
        score += superTimer > 0 ? 200 : 100; // 슈퍼 중 2배 점수
      } else if (invincible === 0) {
        loseLife(); return;
      }
    }
  }

  // 슈퍼 타이머
  if (superTimer > 0) {
    superTimer--;
    if (superTimer === 0) coinCounter = 0; // 슈퍼 끝나면 카운터 리셋
  }

  // 코인
  for (const c of coins) {
    if (c.collected) continue;
    if (Math.hypot(player.x + player.w / 2 - c.x, player.y + player.h / 2 - c.y) < c.r + 18) {
      c.collected = true; score += 10;
      coinCounter++;
      if (coinCounter >= SUPER_COIN_COUNT) {
        superTimer = SUPER_DURATION;
        coinCounter = 0;
        invincible = SUPER_DURATION; // 슈퍼 중 무적
      }
    }
  }

  // 골
  if (player.x + player.w > goal.x && player.y + player.h > goal.y) {
    score += 300 + level * 50;
    if (level < MAX_LEVEL) {
      level++;
      initLevel();
    } else {
      state = 'win';
    }
  }

  updateUI();
}

function loseLife() {
  lives--;
  updateUI();
  if (lives <= 0) {
    state = 'dead';
  } else {
    player.reset(); cameraX = 0; invincible = 120;
  }
}

function updateUI() {
  document.getElementById('scoreDisplay').textContent = score;
  document.getElementById('levelDisplay').textContent = level;
  // 생명 5개 이하면 하트로, 초과면 ❤️×숫자 표시
  const l = Math.max(0, lives);
  document.getElementById('livesDisplay').textContent =
    l <= 5 ? '❤️'.repeat(l) : `❤️×${l}`;
  // 슈퍼 모드 중엔 UI 강조
  const ui = document.getElementById('ui');
  if (superTimer > 0) {
    ui.style.color = `hsl(${(frameCount * 4) % 360}, 100%, 70%)`;
    ui.style.textShadow = `0 0 12px currentColor`;
  } else {
    ui.style.color = '';
    ui.style.textShadow = '';
  }
}

// ── 배경 (레벨별 색 변경) ──────────────────────
const SKY_COLORS = [
  ['#0f3460','#16213e'], ['#1a2a4a','#0d1b2a'], ['#2a1a4a','#1a0d2a'],
  ['#1a3a1a','#0d2a0d'], ['#3a2a1a','#2a1a0d'], ['#1a1a4a','#0d0d2a'],
  ['#3a1a1a','#2a0d0d'], ['#1a3a3a','#0d2a2a'], ['#3a3a1a','#2a2a0d'],
  ['#2a1a3a','#1a0d2a'], ['#0a2040','#050f20'], ['#200a30','#100520'],
  ['#0a2010','#051008'], ['#201000','#100800'], ['#001020','#000810'],
  ['#200010','#100008'], ['#102000','#081000'], ['#002020','#001010'],
  ['#200020','#100010'], ['#101020','#080810'],
];

function drawBackground() {
  const c = SKY_COLORS[(level - 1) % SKY_COLORS.length];
  const grad = ctx.createLinearGradient(0, 0, 0, CH);
  grad.addColorStop(0, c[0]);
  grad.addColorStop(1, c[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CW, CH);

  // 별 (레벨 높을수록 더 많이)
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  const starCount = 20 + level * 3;
  for (let i = 0; i < starCount; i++) {
    const sx = ((i * 137 + 50 - cameraX * 0.1) % (CW + 20) + CW + 20) % (CW + 20) - 10;
    const sy = (i * 73 + 30) % (CH * 0.6);
    const r  = 0.5 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 구름
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  const cloudDefs = [
    {x:100,y:60,w:120,h:40},{x:350,y:45,w:90,h:30},
    {x:600,y:80,w:150,h:45},{x:900,y:50,w:100,h:35},
    {x:1200,y:70,w:130,h:40},{x:1500,y:55,w:110,h:38},
  ];
  for (const c of cloudDefs) {
    const cx = ((c.x - cameraX * 0.25) % (CW + c.w + 10) + CW + c.w + 10) % (CW + c.w + 10) - c.w;
    ctx.beginPath();
    ctx.ellipse(cx, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlatforms() {
  for (const p of platforms) {
    const sx = p.x - cameraX;
    if (sx + p.w < 0 || sx > CW) continue;
    if (p.y === GROUND_Y) {
      ctx.fillStyle = '#4a7c59';
      ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = '#6abf77';
      ctx.fillRect(sx, p.y, p.w, 8);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(sx, p.y, p.w, 4);
    }
  }
}

function drawCoins() {
  for (const c of coins) {
    if (c.collected) continue;
    const sx = c.x - cameraX;
    if (sx < -20 || sx > CW + 20) continue;
    const bob = Math.sin(frameCount * 0.08 + c.x * 0.1) * 3;
    ctx.save();
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(sx, c.y + bob, c.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(sx - 2, c.y + bob - 2, c.r * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx = e.x - cameraX;
    if (sx + e.w < 0 || sx > CW) continue;

    ctx.fillStyle = '#e94560';
    ctx.fillRect(sx, e.y, e.w, e.h);
    // 눈
    const eyeX = e.vx > 0 ? sx + e.w - 12 : sx + 4;
    ctx.fillStyle = '#fff';
    ctx.fillRect(eyeX, e.y + 5, 8, 8);
    ctx.fillStyle = '#000';
    ctx.fillRect(eyeX + 2, e.y + 7, 4, 4);
    // 발
    ctx.fillStyle = '#c73652';
    const leg = Math.sin(frameCount * 0.18) * 4;
    ctx.fillRect(sx + 3, e.y + e.h - 8 + leg, 10, 8);
    ctx.fillRect(sx + e.w - 13, e.y + e.h - 8 - leg, 10, 8);
    // 레벨 높으면 뿔
    if (level >= 10) {
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.moveTo(sx + 8, e.y); ctx.lineTo(sx + 12, e.y - 10); ctx.lineTo(sx + 16, e.y);
      ctx.fill();
    }
  }
}

function drawPlayer() {
  const sx = player.x - cameraX;
  // 일반 무적(데미지 후) 깜빡임 – 슈퍼 중엔 깜빡이지 않음
  if (invincible > 0 && superTimer <= 0 && Math.floor(frameCount / 5) % 2 === 0) return;

  ctx.save();
  ctx.translate(sx + player.w / 2, player.y + player.h / 2);
  ctx.scale(player.facing, 1);

  if (superTimer > 0) {
    // ── 슈퍼 모드 이펙트 ──────────────────────
    // 1) 무지개 오라 (회전하는 큰 원)
    const t = frameCount * 0.08;
    const auraR = player.w * 1.1;
    const grad = ctx.createRadialGradient(0, 0, auraR * 0.3, 0, 0, auraR);
    const hue = (frameCount * 4) % 360;
    grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.9)`);
    grad.addColorStop(0.6, `hsla(${(hue + 120) % 360}, 100%, 60%, 0.5)`);
    grad.addColorStop(1,   `hsla(${(hue + 240) % 360}, 100%, 50%, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.fill();

    // 2) 회전하는 별 파티클
    for (let i = 0; i < 6; i++) {
      const angle = t + (i / 6) * Math.PI * 2;
      const dist  = auraR * 0.85;
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;
      ctx.fillStyle = `hsl(${(hue + i * 60) % 360}, 100%, 80%)`;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3) 캐릭터 자체에 색상 필터 (황금빛 glow)
    ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
    ctx.shadowBlur = 18;

    // 4) 살짝 크게 (1.15배 스케일)
    ctx.scale(1.15, 1.15);
  }

  if (catLoaded) {
    ctx.drawImage(catImg, -player.w / 2, -player.h / 2, player.w, player.h);
  } else {
    drawDefaultCat();
  }
  ctx.restore();

  // 슈퍼 모드 남은 시간 바
  if (superTimer > 0) {
    const bw = player.w + 16;
    const bx = sx - 8;
    const by = player.y - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx, by, bw, 5);
    const ratio = superTimer / SUPER_DURATION;
    const barHue = (frameCount * 4) % 360;
    ctx.fillStyle = `hsl(${barHue}, 100%, 55%)`;
    ctx.fillRect(bx, by, bw * ratio, 5);
  }
}

function drawDefaultCat() {
  const hw = player.w / 2, hh = player.h / 2;
  // 몸통
  ctx.fillStyle = '#f0c040';
  ctx.fillRect(-hw, -hh + 8, player.w, player.h - 8);
  // 머리
  ctx.fillStyle = '#f0c040';
  ctx.beginPath();
  ctx.arc(0, -hh + 6, 16, 0, Math.PI * 2);
  ctx.fill();
  // 귀
  ctx.fillStyle = '#f0c040';
  ctx.beginPath(); ctx.moveTo(-14, -hh + 2); ctx.lineTo(-10, -hh - 10); ctx.lineTo(-4, -hh + 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4,  -hh + 2); ctx.lineTo(10,  -hh - 10); ctx.lineTo(14, -hh + 2);  ctx.closePath(); ctx.fill();
  // 귀 안
  ctx.fillStyle = '#e8a0a0';
  ctx.beginPath(); ctx.moveTo(-12, -hh + 2); ctx.lineTo(-10, -hh - 7); ctx.lineTo(-5, -hh + 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5,   -hh + 2); ctx.lineTo(10,  -hh - 7); ctx.lineTo(12, -hh + 2); ctx.closePath(); ctx.fill();
  // 눈
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(-6, -hh + 5, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 6, -hh + 5, 3.5, 0, Math.PI * 2); ctx.fill();
  // 눈 반짝임
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-5, -hh + 4, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 7, -hh + 4, 1.2, 0, Math.PI * 2); ctx.fill();
  // 코
  ctx.fillStyle = '#ff8080';
  ctx.beginPath(); ctx.arc(0, -hh + 10, 2, 0, Math.PI * 2); ctx.fill();
  // 수염
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-2, -hh + 10); ctx.lineTo(-14, -hh + 9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2, -hh + 11); ctx.lineTo(-14, -hh + 13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2,  -hh + 10); ctx.lineTo(14,  -hh + 9);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2,  -hh + 11); ctx.lineTo(14,  -hh + 13); ctx.stroke();
  // 꼬리
  ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hw - 2, hh - 8);
  ctx.bezierCurveTo(hw + 14, hh - 20, hw + 18, -4, hw + 8, -10);
  ctx.stroke();
  // 다리
  ctx.fillStyle = '#d4a030';
  const leg = player.onGround ? Math.sin(frameCount * 0.25 * Math.min(Math.abs(player.vx) / PLAYER_SPEED, 1)) * 5 : 0;
  ctx.fillRect(-hw + 2, hh - 14 + leg, 10, 14);
  ctx.fillRect(hw - 12, hh - 14 - leg, 10, 14);
}

function drawGoal() {
  const sx = goal.x - cameraX;
  if (sx < -30 || sx > CW + 30) return;
  // 깃대
  ctx.fillStyle = '#ccc';
  ctx.fillRect(sx, goal.y, 6, goal.h);
  // 깃발 (펄럭)
  const wave = Math.sin(frameCount * 0.12) * 5;
  ctx.fillStyle = '#e94560';
  ctx.beginPath();
  ctx.moveTo(sx + 6, goal.y);
  ctx.quadraticCurveTo(sx + 30 + wave, goal.y + 18, sx + 6, goal.y + 36);
  ctx.fill();
  // GOAL
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 15px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('GOAL', sx + 3, goal.y - 8);
  ctx.textAlign = 'left';
}

// 레벨 배너 (레벨 시작 시 잠깐 표시)
let bannerTimer = 0;
const BANNER_DURATION = 90;

function drawLevelBanner() {
  if (bannerTimer <= 0) return;
  const alpha = Math.min(1, bannerTimer / 20);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(CW / 2 - 160, CH / 2 - 40, 320, 80);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`레벨 ${level} / ${MAX_LEVEL}`, CW / 2, CH / 2 + 12);
  ctx.restore();
  bannerTimer--;
}

function draw() {
  ctx.clearRect(0, 0, CW, CH);
  drawBackground();
  if (state === 'play') {
    drawPlatforms();
    drawGoal();
    drawCoins();
    drawEnemies();
    drawPlayer();
    drawLevelBanner();
    drawSuperModeHUD();
  }
}

function drawSuperModeHUD() {
  if (superTimer <= 0) return;
  // 진입 순간 화면 플래시 (마지막 20프레임 이후 사라짐)
  const flashAlpha = Math.max(0, (superTimer - (SUPER_DURATION - 12)) / 12);
  if (flashAlpha > 0) {
    const hue = (frameCount * 4) % 360;
    ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${flashAlpha * 0.4})`;
    ctx.fillRect(0, 0, CW, CH);
  }
  // 화면 가장자리 글로우
  const edgeAlpha = 0.18 + Math.sin(frameCount * 0.15) * 0.07;
  const hue = (frameCount * 4) % 360;
  const edgeGrad = ctx.createRadialGradient(CW/2, CH/2, CH * 0.3, CW/2, CH/2, CH * 0.85);
  edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(1, `hsla(${hue}, 100%, 55%, ${edgeAlpha})`);
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, CW, CH);

  // "SUPER MODE!" 텍스트
  if (superTimer > SUPER_DURATION - 90) {
    const t = SUPER_DURATION - superTimer;
    const alpha = Math.min(1, t / 15) * Math.min(1, (SUPER_DURATION - 90 - t + 90) / 15);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = `bold ${Math.round(36 + Math.sin(frameCount * 0.3) * 3)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
    ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
    ctx.shadowBlur = 20;
    ctx.fillText('⚡ SUPER MODE! ⚡', CW / 2, CH / 2 - 60);
    ctx.restore();
  }
}

// ── 오버레이 ──────────────────────────────────
const overlay = document.getElementById('overlay');

function showOverlay(title, desc, btnText) {
  overlay.innerHTML = `
    <h1>${title}</h1>
    <p>${desc}</p>
    <p class="sub">← → 이동 &nbsp;|&nbsp; Space / ↑ 점프 (2단 가능)</p>
    <button id="startBtn">${btnText}</button>
  `;
  overlay.style.display = 'flex';
  document.getElementById('startBtn').addEventListener('click', startGame);
}

function startGame() {
  score = 0; lives = 10; level = 1;
  coinCounter = 0; superTimer = 0;
  initLevel();
  bannerTimer = BANNER_DURATION;
  updateUI();
  overlay.style.display = 'none';
  state = 'play';
}

document.getElementById('startBtn').addEventListener('click', startGame);

// ── 게임 루프 ─────────────────────────────────
function loop() {
  update();
  draw();

  if (state === 'win') {
    showOverlay('🎉 전체 클리어!', `최종 점수: ${score}점 | 모든 레벨 완료!`, '다시 하기');
    state = 'menu';
  }
  if (state === 'dead') {
    showOverlay('💀 게임 오버', `최종 점수: ${score}점`, '다시 시작');
    state = 'menu';
  }

  requestAnimationFrame(loop);
}

loop();
