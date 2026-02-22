'use strict';
// ═══════════════════════════════════════════════
//  유현이 고양이의 모험  –  game.js  v3.0
// ═══════════════════════════════════════════════
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// 내부 해상도
const CW = 800, CH = 450;
canvas.width = CW; canvas.height = CH;

// ── 상수 ──────────────────────────────────────
const GRAVITY      = 0.55;
const PLAYER_SPEED = 4.5;
const JUMP_FORCE   = -13;
const GROUND_Y     = CH - 60;
const TILE         = 40;
const MAX_LEVEL    = 20;
const SUPER_DURATION   = 600;  // 10초
const SUPER_COIN_COUNT = 10;

// ── 이미지 로드 ───────────────────────────────
const catImg = new Image();
catImg.src = 'cat.png';
let catLoaded = false;
catImg.onload  = () => { catLoaded = true; };
catImg.onerror = () => { catLoaded = false; };

// ════════════════════════════════════════════
//  사운드 시스템 (Web Audio API)
// ════════════════════════════════════════════
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let musicOn  = true;
let bgmNode  = null;   // 배경음악 oscillator 그룹
let bgmGain  = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ── 효과음 생성기 ─────────────────────────────
function playShoot() {
  try {
    const ac = getAudioCtx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = 'square';
    o.frequency.setValueAtTime(880, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(220, ac.currentTime + 0.08);
    g.gain.setValueAtTime(0.18, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.09);
    o.start(ac.currentTime); o.stop(ac.currentTime + 0.09);
  } catch(e) {}
}

function playJump() {
  try {
    const ac = getAudioCtx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(300, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(700, ac.currentTime + 0.12);
    g.gain.setValueAtTime(0.22, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.14);
    o.start(ac.currentTime); o.stop(ac.currentTime + 0.15);
  } catch(e) {}
}

function playCoin() {
  try {
    const ac = getAudioCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine';
      const t = ac.currentTime + i * 0.05;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.start(t); o.stop(t + 0.12);
    });
  } catch(e) {}
}

function playDead() {
  try {
    const ac = getAudioCtx();
    [440, 330, 220, 110].forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sawtooth';
      const t = ac.currentTime + i * 0.12;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.start(t); o.stop(t + 0.15);
    });
  } catch(e) {}
}

function playHit() {
  try {
    const ac = getAudioCtx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    const distortion = ac.createWaveShaper();
    function makeDistortion(amount) {
      const curve = new Float32Array(256);
      for (let i=0; i<256; i++) {
        const x = (i*2)/256-1;
        curve[i] = (Math.PI+amount)*x/(Math.PI+amount*Math.abs(x));
      }
      return curve;
    }
    distortion.curve = makeDistortion(200);
    o.connect(distortion); distortion.connect(g); g.connect(ac.destination);
    o.type = 'square';
    o.frequency.setValueAtTime(150, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.2);
    g.gain.setValueAtTime(0.3, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
    o.start(ac.currentTime); o.stop(ac.currentTime + 0.23);
  } catch(e) {}
}

function playStamp() {
  try {
    const ac = getAudioCtx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(200, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.1);
    g.gain.setValueAtTime(0.25, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
    o.start(ac.currentTime); o.stop(ac.currentTime + 0.13);
  } catch(e) {}
}

function playLevelClear() {
  try {
    const ac = getAudioCtx();
    [523,659,784,1047,1319].forEach((freq,i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'triangle';
      const t = ac.currentTime + i * 0.09;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.start(t); o.stop(t + 0.22);
    });
  } catch(e) {}
}

function playSuperMode() {
  try {
    const ac = getAudioCtx();
    [262,330,392,523,659,784].forEach((freq,i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'square';
      const t = ac.currentTime + i * 0.06;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.start(t); o.stop(t + 0.14);
    });
  } catch(e) {}
}

// ── 배경음악: 케데헌 골든 스타일 (Web Audio API로 합성) ──
// 케데헌 골든 midi 스타일 멜로디 시퀀스 (간소화)
const BGM_NOTES = [
  // 멜로디 (Hz, 박자길이, 옥타브 오프셋)
  [392,0.25],[440,0.25],[494,0.25],[523,0.5],[494,0.25],
  [440,0.25],[392,0.5],[330,0.25],[370,0.25],[392,0.5],
  [392,0.25],[440,0.25],[494,0.25],[523,0.5],[587,0.25],
  [659,0.25],[784,0.5],[698,0.25],[659,0.25],[587,0.5],
  [523,0.25],[494,0.25],[440,0.25],[392,0.5],[330,0.25],
  [294,0.25],[330,0.5],[370,0.25],[392,0.25],[440,0.5],
  [392,0.25],[370,0.25],[330,0.25],[294,0.5],[262,0.25],
  [294,0.25],[330,0.5],[392,0.25],[440,0.25],[494,0.5],
];
const BGM_BASS = [
  [196,1],[165,1],[196,1],[147,1],
  [196,1],[165,1],[175,1],[196,1],
];
let bgmScheduled = false;
let bgmStartTime = 0;
let bgmLoop = null;

function startBGM() {
  if (!musicOn) return;
  try {
    const ac = getAudioCtx();
    stopBGM();
    bgmScheduled = true;
    scheduleBGM(ac);
  } catch(e) {}
}

function scheduleBGM(ac) {
  if (!musicOn || !bgmScheduled) return;

  const masterGain = ac.createGain();
  masterGain.gain.value = 0.13;
  masterGain.connect(ac.destination);

  let t = ac.currentTime + 0.05;
  const totalDur = BGM_NOTES.reduce((s,n)=>s+n[1]*0.45,0);

  // 멜로디
  BGM_NOTES.forEach(([freq, dur]) => {
    const d = dur * 0.45;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(masterGain);
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.02);
    g.gain.setValueAtTime(0.7, t + d - 0.04);
    g.gain.linearRampToValueAtTime(0, t + d);
    o.start(t); o.stop(t + d + 0.01);
    t += d;
  });

  // 베이스
  let bt = ac.currentTime + 0.05;
  BGM_BASS.forEach(([freq, dur]) => {
    const d = dur * 0.45 * (BGM_NOTES.length / BGM_BASS.length);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(masterGain);
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.4, bt);
    g.gain.linearRampToValueAtTime(0, bt + d);
    o.start(bt); o.stop(bt + d + 0.01);
    bt += d;
  });

  // 루프
  bgmLoop = setTimeout(() => {
    if (musicOn && bgmScheduled) scheduleBGM(ac);
  }, totalDur * 1000 - 200);
}

function stopBGM() {
  bgmScheduled = false;
  if (bgmLoop) { clearTimeout(bgmLoop); bgmLoop = null; }
}

// 음악 토글 버튼 - DOMContentLoaded 후 등록해서 중복 방지
function initMusicBtn() {
  const btn = document.getElementById('music-btn');
  if (!btn) return;
  btn.onclick = () => {
    musicOn = !musicOn;
    btn.textContent = musicOn ? '🔊' : '🔇';
    if (musicOn) startBGM(); else stopBGM();
  };
}
// game.js는 body 끝에서 로드되므로 DOM이 이미 준비된 상태
initMusicBtn();


// ── 상태 ──────────────────────────────────────
let state      = 'menu';
let score      = 0;
let lives      = 10;
let level      = 1;
let cameraX    = 0;
let frameCount = 0;
let invincible = 0;
let superTimer = 0;
let coinCounter = 0;
let bullets    = [];   // 플레이어 총알
let bossBullets = [];  // 보스 총알
let bossState  = null; // 20레벨 보스 객체
let bossDefeated = false;
let shootCooldown = 0;
let lastScore  = 0;

// ── 보스 레벨 판별 ────────────────────────────
// 5, 10, 15, 20 레벨이 보스
function isBossLevel(lvl) { return lvl % 5 === 0; }

// ── 배경/시간대 (레벨별) ─────────────────────
// 5판 단위로 아침/밤 교차 (1~5 아침, 6~10 밤, 11~15 아침, 16~20 밤)
const TIME_OF_DAY = (lvl) => {
  const cycle = Math.floor((lvl - 1) / 5); // 0,1,2,3
  return cycle % 2 === 0 ? 'morning' : 'night';
};

const SKY_GRADIENT = {
  morning: ['#ffb347','#ffcc70','#87ceeb'],
  day:     ['#87ceeb','#b0e0ff','#e0f7ff'],
  evening: ['#ff6b35','#ff4500','#1a0a2e'],
  night:   ['#0a0a1a','#1a1a3a','#0d0d2a'],
};

// 한국 전통 배경 요소들 (레벨별)
const BG_THEMES = {
  morning: { mountColor:'#b5c99a', groundColor:'#5a8a3a', accent:'#d4a017' },
  day:     { mountColor:'#78a86a', groundColor:'#4a7c2a', accent:'#e8c547' },
  evening: { mountColor:'#8b4513', groundColor:'#3d2b1f', accent:'#ff6347' },
  night:   { mountColor:'#1a1a4a', groundColor:'#0d1a0d', accent:'#fffacd' },
};

// ── 키 입력 ───────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  if (!keys[e.code]) {
    keys[e.code] = true;
    if (state === 'play') {
      if (['Space','ArrowUp','KeyW'].includes(e.code)) tryJump();
      if (['KeyZ','ControlLeft','ControlRight'].includes(e.code)) tryShoot();
    }
    if (['Space','ArrowUp'].includes(e.code)) e.preventDefault();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

function isLeft()  { return keys['ArrowLeft']  || keys['KeyA'] || mobileKeys.left;  }
function isRight() { return keys['ArrowRight'] || keys['KeyD'] || mobileKeys.right; }

// ── 모바일 버튼 ───────────────────────────────
const mobileKeys = { left:false, right:false };

function bindMobileBtn(id, key) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const down = () => {
    if (key === 'jump')  { if (state === 'play') tryJump(); }
    else if (key === 'shoot') { if (state === 'play') tryShoot(); }
    else mobileKeys[key] = true;
    btn.classList.add('pressed');
  };
  const up = () => {
    if (key !== 'jump' && key !== 'shoot') mobileKeys[key] = false;
    btn.classList.remove('pressed');
  };
  btn.addEventListener('touchstart', e => { e.preventDefault(); down(); }, { passive:false });
  btn.addEventListener('touchend',   e => { e.preventDefault(); up();   }, { passive:false });
  btn.addEventListener('mousedown', down);
  btn.addEventListener('mouseup',   up);
}
bindMobileBtn('btn-left',  'left');
bindMobileBtn('btn-right', 'right');
bindMobileBtn('btn-jump',  'jump');
bindMobileBtn('btn-shoot', 'shoot');

// ── 점프 & 발사 ───────────────────────────────
// 총알 최대 사거리: 화면 너비의 1/3
const BULLET_MAX_DIST = CW / 3;

function tryJump() {
  if (player.onGround) {
    player.vy = JUMP_FORCE; player.onGround = false; player.jumps = 1;
    playJump();
  } else if (player.jumps < 2) {
    player.vy = JUMP_FORCE * 0.82; player.jumps++;
    playJump();
  }
}

function tryShoot() {
  if (shootCooldown > 0) return;
  const bx = player.facing === 1 ? player.x + player.w : player.x;
  bullets.push({
    x: bx, y: player.y + player.h * 0.4,
    vx: 10 * player.facing,
    startX: bx,   // 발사 시작 위치 (사거리 계산용)
    alive: true
  });
  shootCooldown = 18;
  playShoot();
}

// ── 플레이어 ──────────────────────────────────
const player = {
  x:80, y:GROUND_Y-44, w:36, h:44,
  vx:0, vy:0, onGround:false, jumps:0, facing:1,
  reset() {
    this.x=80; this.y=GROUND_Y-this.h;
    this.vx=0; this.vy=0; this.onGround=false; this.jumps=0;
  }
};

// ════════════════════════════════════════════
//  레벨 생성
// ════════════════════════════════════════════
function getWorldW(lvl) { return isBossLevel(lvl) ? CW * 1.5 : 1600 + (lvl-1)*200; }

function getLevelGaps(lvl) {
  if (isBossLevel(lvl)) return []; // 보스방 구멍 없음
  const gaps = {
    1:[], 2:[[500,540]], 3:[[400,450],[700,760]],
    4:[[300,360],[600,650],[900,960]],
    5:[[350,410],[650,720],[1000,1080]],
    6:[[280,340],[580,650],[900,980],[1200,1270]],
    7:[[300,370],[600,680],[900,980],[1200,1280]],
    8:[[250,330],[550,640],[850,950],[1150,1250]],
    9:[[240,320],[520,620],[820,930],[1120,1230],[1420,1510]],
    10:[[220,310],[500,610],[800,920],[1100,1220],[1400,1530]],
  };
  if (lvl <= 10) return gaps[lvl]||[];
  const count = 3 + Math.floor((lvl-10)/2);
  const result = [];
  const ww = getWorldW(lvl);
  for (let i=0; i<count; i++) {
    const gx = 280 + Math.round(i*(ww-400)/count/TILE)*TILE;
    const gw = 60+(lvl-10)*4;
    result.push([gx, gx+gw]);
  }
  return result;
}

function makeFloor(lvl) {
  const ww = getWorldW(lvl);
  const tiles = [];
  const gapPattern = getLevelGaps(lvl);
  let x = 0;
  while (x < ww+TILE) {
    const inGap = gapPattern.some(g => x>=g[0] && x<g[1]);
    if (!inGap) tiles.push({ x, y:GROUND_Y, w:TILE, h:60, color:'#4a7c59' });
    x += TILE;
  }
  return tiles;
}

function getLevelColor(lvl) {
  const colors=['#5d9e6e','#6a8e7f','#7e6e9e','#9e6e6e','#6e7e9e','#9e8e5e','#5e8e9e','#9e5e7e','#7e9e5e','#5e6e8e','#a06040','#60a080','#8060a0','#a08060','#60a060','#a06080','#6080a0','#80a060','#a08080','#8080a0'];
  return colors[(lvl-1)%colors.length];
}

function getLevelPlatforms(lvl) {
  if (isBossLevel(lvl)) return []; // 보스방은 플랫폼 없음
  const sets=[];
  const ww=getWorldW(lvl);
  const count=6+Math.floor(lvl*1.2);
  const spacing=(ww-300)/count;
  const color=getLevelColor(lvl);
  for (let i=0; i<count; i++) {
    const x=200+Math.round(i*spacing);
    const yOptions=[GROUND_Y-100,GROUND_Y-150,GROUND_Y-200,GROUND_Y-250];
    const y=yOptions[(i+lvl)%yOptions.length];
    const w=Math.max(60,130-lvl*3);
    sets.push({x,y,w,h:18,color});
  }
  return sets;
}

function makePlatforms(lvl) {
  return [...makeFloor(lvl), ...getLevelPlatforms(lvl)];
}

function makeCoins(lvl) {
  if (isBossLevel(lvl)) return [];
  const coins=[];
  for (const p of getLevelPlatforms(lvl)) {
    const cnt=2+Math.floor(Math.random()*2);
    for (let i=0; i<cnt; i++) coins.push({x:p.x+20+i*24,y:p.y-20,r:9,collected:false});
  }
  const ww=getWorldW(lvl);
  for (let x=300; x<ww-200; x+=180) coins.push({x,y:GROUND_Y-20,r:9,collected:false});
  return coins;
}

function makeEnemies(lvl) {
  if (isBossLevel(lvl)) return []; // 보스 레벨엔 일반 적 없음
  const speed = 1.0 + lvl * 0.15;
  const enemies = [];
  const ww = getWorldW(lvl);

  // 지상 몬스터 (수량 대폭 증가)
  const groundCount = 5 + Math.floor(lvl * 1.2);
  for (let i = 0; i < groundCount; i++) {
    const x = 300 + Math.round(i * (ww - 400) / groundCount);
    enemies.push({
      x, y: GROUND_Y - 28, w: 32, h: 28,
      vx: (i % 2 === 0 ? 1 : -1) * speed,
      patrolMin: x - 150, patrolMax: x + 150,
      alive: true, type: 'ground'
    });
  }

  // 날아다니는 몬스터 (레벨 2부터, 수량 대폭 증가)
  if (lvl >= 2) {
    const flyCount = 3 + Math.floor(lvl * 0.8); // 대폭 증가
    for (let i = 0; i < flyCount; i++) {
      const x = 250 + Math.round(i * (ww - 400) / flyCount);
      // 높이 다양하게 - 낮게도, 높게도
      const heightOptions = [
        GROUND_Y - 100,
        GROUND_Y - 150,
        GROUND_Y - 200,
        GROUND_Y - 250,
        GROUND_Y - 300,
      ];
      const baseY = heightOptions[i % heightOptions.length];
      enemies.push({
        x, y: baseY, w: 30, h: 24,
        vx: (i % 2 === 0 ? 1 : -1) * (speed * 0.8),
        vy: 0,
        patrolMin: x - 200, patrolMax: x + 200,
        baseY, flyPhase: (i * 1.3) % (Math.PI * 2),
        alive: true, type: 'fly'
      });
    }
  }

  // 플랫폼 위 적 (레벨 4부터, 더 자주 배치)
  if (lvl >= 4) {
    const platList = getLevelPlatforms(lvl);
    const pickEvery = Math.max(1, Math.floor(platList.length / 5));
    for (let i = 0; i < platList.length; i += pickEvery) {
      const p = platList[i];
      if (p.w < 60) continue;
      enemies.push({
        x: p.x + 10, y: p.y - 28, w: 28, h: 28,
        vx: speed * 0.8,
        patrolMin: p.x, patrolMax: p.x + p.w - 28,
        alive: true, type: 'ground'
      });
    }
  }
  return enemies;
}

// ── 골 깃발 ───────────────────────────────────
let goal={};

function initLevel() {
  const ww = getWorldW(level);
  goal = { x: ww - 80, y: GROUND_Y - 110, w: 20, h: 110 };
  platforms   = makePlatforms(level);
  coins       = makeCoins(level);
  enemies     = makeEnemies(level);
  bullets     = [];
  bossBullets = [];
  // 5의 배수 레벨 = 보스 레벨
  bossState    = isBossLevel(level) ? initBoss(level) : null;
  bossDefeated = false;
  player.reset();
  cameraX = 0; invincible = 0; superTimer = 0;
  frameCount = 0; shootCooldown = 0;
}

let platforms=[], coins=[], enemies=[];

// ════════════════════════════════════════════
//  보스 (5, 10, 15, 20 레벨)
// ════════════════════════════════════════════
function initBoss(lvl) {
  // 레벨에 따라 보스 강도 증가
  const tier = lvl / 5; // 1=미니, 2=중간, 3=강함, 4=최종
  const scale = 0.6 + tier * 0.1; // 크기도 조금씩 커짐
  const w = Math.round(70 * scale);
  const h = Math.round(100 * scale);
  const hp = 10 + tier * 10; // 20, 30, 40, 50
  const speed = 1.0 + tier * 0.4;
  const shootInterval = Math.max(80, 150 - tier * 15); // 더 빠르게
  const pawInterval   = Math.max(100, 180 - tier * 20);
  return {
    x: CW * 0.55, y: GROUND_Y - h,
    w, h, hp, maxHp: hp,
    vx: -speed, vy: 0,
    tier,
    shootTimer: 0, shootInterval,
    phaseTimer: 0, pawInterval,
    eyeGlow: 0,
    pawAttack: false, pawTimer: 0, pawSide: 1,
    alive: true,
  };
}

function updateBoss() {
  const b = bossState;
  if (!b || !b.alive) return;

  b.phaseTimer++;
  b.shootTimer++;
  b.eyeGlow = 0.5 + 0.5*Math.sin(frameCount*0.1);

  // 좌우 순찰
  b.x += b.vx;
  if (b.x < CW*0.3 || b.x + b.w > CW*0.95) b.vx *= -1;
  b.facing = b.vx > 0 ? 1 : -1;

  // 발 공격 (tier에 따라 주기 변화)
  if (b.phaseTimer % b.pawInterval === 0) {
    b.pawAttack = true; b.pawTimer = 40;
    b.pawSide = b.vx > 0 ? 1 : -1;
  }
  if (b.pawAttack) {
    b.pawTimer--;
    if (b.pawTimer <= 0) b.pawAttack = false;
  }

  // 앞발 공격 히트 판정
  if (b.pawAttack && b.pawTimer > 10 && b.pawTimer < 35) {
    const pawX = b.pawSide === 1 ? b.x + b.w : b.x - 40;
    const pawY = b.y + b.h * 0.6;
    const pawHit = { x: pawX, y: pawY, w: 40, h: 30 };
    if (invincible === 0 && rectOverlap(player, pawHit)) { loseLife(); return; }
  }

  // 총알 발사 (tier에 따라 발수 & 속도 증가)
  if (b.shootTimer % b.shootInterval === 0) {
    const dx = player.x - b.x;
    const dy = player.y - b.y;
    const bulletCount = 1 + b.tier; // 2~5발
    const spreadAngle = 0.25;
    for (let a = -(bulletCount-1)/2; a <= (bulletCount-1)/2; a++) {
      const angle = Math.atan2(dy, dx) + a * spreadAngle;
      const spd = 4 + b.tier * 0.8;
      bossBullets.push({
        x: b.x + b.w / 2, y: b.y + b.h * 0.3,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        alive: true
      });
    }
  }

  // 보스 총알 이동 & 히트
  for (const bb of bossBullets) {
    if (!bb.alive) continue;
    bb.x += bb.vx; bb.y += bb.vy;
    if (bb.x<0||bb.x>CW||bb.y<0||bb.y>CH+50) { bb.alive=false; continue; }
    if (invincible===0 && rectOverlap(player,{x:bb.x-6,y:bb.y-6,w:12,h:12})) {
      bb.alive=false; playHit(); loseLife(); return;
    }
  }
  bossBullets = bossBullets.filter(bb=>bb.alive);

  // 플레이어 총알이 보스에 맞는지
  for (const bull of bullets) {
    if (!bull.alive) continue;
    if (rectOverlap({x:bull.x-4,y:bull.y-4,w:8,h:8}, b)) {
      bull.alive=false;
      b.hp--;
      score+=50;
      if (b.hp<=0) {
        b.alive=false;
        bossDefeated=true;
        score+=5000;
      }
    }
  }
}

// ── 충돌 ──────────────────────────────────────
function rectOverlap(a,b) {
  return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
}
function resolvePlayerPlatform(p,plat) {
  const ox=Math.min(p.x+p.w,plat.x+plat.w)-Math.max(p.x,plat.x);
  const oy=Math.min(p.y+p.h,plat.y+plat.h)-Math.max(p.y,plat.y);
  if (ox<=0||oy<=0) return;
  if (oy<ox) {
    if (p.y+p.h/2<plat.y+plat.h/2) {
      p.y=plat.y-p.h; p.vy=0; p.onGround=true; p.jumps=0;
    } else { p.y=plat.y+plat.h; p.vy=2; }
  } else {
    p.x=(p.x+p.w/2<plat.x+plat.w/2) ? plat.x-p.w : plat.x+plat.w;
    p.vx=0;
  }
}

// ── 업데이트 ──────────────────────────────────
function update() {
  if (state !== 'play') return;
  frameCount++;
  if (invincible>0) invincible--;
  if (shootCooldown>0) shootCooldown--;

  // 플레이어 이동
  player.vx=0;
  if (isLeft())  { player.vx=-PLAYER_SPEED; player.facing=-1; }
  if (isRight()) { player.vx= PLAYER_SPEED; player.facing= 1; }
  player.vy+=GRAVITY;
  player.x+=player.vx; player.y+=player.vy;
  player.onGround=false;
  for (const plat of platforms) {
    if (rectOverlap(player,plat)) resolvePlayerPlatform(player,plat);
  }
  if (player.x<0) player.x=0;

  const ww=getWorldW(level);
  const camTarget=player.x-CW*0.35;
  cameraX=Math.max(0,Math.min(camTarget,ww-CW));

  if (player.y>CH+120) { loseLife(); return; }

  // 플레이어 총알 이동 (사거리: 화면 1/3)
  for (const bull of bullets) {
    if (!bull.alive) continue;
    bull.x += bull.vx;
    const dist = Math.abs(bull.x - bull.startX);
    if (dist > BULLET_MAX_DIST || bull.x < -20 || bull.x > ww + 20) bull.alive = false;
  }
  bullets = bullets.filter(b => b.alive);

  // 보스 레벨 (5, 10, 15, 20)
  if (isBossLevel(level)) {
    updateBoss();
    if (bossDefeated) {
      score += 500 + level * 100;
      playLevelClear();
      if (level < MAX_LEVEL) {
        level++; initLevel(); bannerTimer = BANNER_DURATION;
      } else {
        state = 'win'; showRankOverlay();
      }
    }
    updateUI(); return;
  }

  // 일반 적 이동 & 충돌
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.type==='fly') {
      // 비행 몬스터: 사인파 상하 + 좌우 순찰
      e.flyPhase+=0.05;
      e.x+=e.vx;
      e.y=e.baseY+Math.sin(e.flyPhase)*30;
      if (e.x<=e.patrolMin||e.x+e.w>=e.patrolMax) e.vx*=-1;
    } else {
      e.x+=e.vx;
      if (e.x<=e.patrolMin||e.x+e.w>=e.patrolMax) e.vx*=-1;
    }

    if (rectOverlap(player,e)) {
      const stomping=player.vy>0&&player.y+player.h<e.y+e.h*0.55;
      if (stomping||superTimer>0) {
        e.alive=false;
        if (stomping) { player.vy=JUMP_FORCE*0.55; playStamp(); }
        score+=superTimer>0?200:100;
      } else if (invincible===0) { loseLife(); return; }
    }

    // 플레이어 총알 맞기
    for (const bull of bullets) {
      if (!bull.alive) continue;
      if (rectOverlap({x:bull.x-4,y:bull.y-4,w:8,h:8},e)) {
        bull.alive=false; e.alive=false; score+=150;
        playStamp();
      }
    }
  }

  // 슈퍼 타이머
  if (superTimer>0) { superTimer--; if (superTimer===0) coinCounter=0; }

  // 코인
  for (const c of coins) {
    if (c.collected) continue;
    if (Math.hypot(player.x+player.w/2-c.x,player.y+player.h/2-c.y)<c.r+18) {
      c.collected=true; score+=10; coinCounter++;
      playCoin();
      if (coinCounter>=SUPER_COIN_COUNT) {
        superTimer=SUPER_DURATION; coinCounter=0; invincible=SUPER_DURATION;
        playSuperMode();
      }
    }
  }

  // 골
  if (player.x + player.w > goal.x && player.y + player.h > goal.y) {
    score += 300 + level * 50;
    playLevelClear();
    if (level < MAX_LEVEL) { level++; initLevel(); bannerTimer = BANNER_DURATION; }
    else { state = 'win'; showRankOverlay(); }
  }

  updateUI();
}

function loseLife() {
  lives--;
  playHit();
  updateUI();
  if (lives<=0) { playDead(); state='dead'; lastScore=score; showRankOverlay(); }
  else { player.reset(); cameraX=0; invincible=120; }
}

function updateUI() {
  document.getElementById('scoreDisplay').textContent=score;
  document.getElementById('levelDisplay').textContent=level;
  const l=Math.max(0,lives);
  document.getElementById('livesDisplay').textContent=l<=5?'❤️'.repeat(l):`❤️×${l}`;
  const ui=document.getElementById('ui');
  if (superTimer>0) {
    ui.style.color=`hsl(${(frameCount*4)%360},100%,70%)`;
    ui.style.textShadow='0 0 12px currentColor';
  } else { ui.style.color=''; ui.style.textShadow=''; }
}

// ════════════════════════════════════════════
//  그리기
// ════════════════════════════════════════════
function draw() {
  ctx.clearRect(0,0,CW,CH);
  drawBackground();
  if (state==='play') {
    drawPlatforms();
    if (!isBossLevel(level)) drawGoal();
    drawCoins();
    drawEnemies();
    drawBullets();
    drawPlayer();
    drawBoss();
    drawLevelBanner();
    drawSuperModeHUD();
  }
}

// ── 배경 ──────────────────────────────────────
function drawBackground() {
  const tod=TIME_OF_DAY(level);
  const sky=SKY_GRADIENT[tod];
  const theme=BG_THEMES[tod];

  // 하늘 그라데이션
  const grad=ctx.createLinearGradient(0,0,0,CH);
  grad.addColorStop(0,sky[0]);
  grad.addColorStop(0.5,sky[1]);
  grad.addColorStop(1,sky[2]||sky[1]);
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,CW,CH);

  if (tod==='morning') drawMorningBg(theme);
  else if (tod==='day') drawDayBg(theme);
  else if (tod==='evening') drawEveningBg(theme);
  else drawNightBg(theme);
}

// 아침 배경 – 한국 전통 마을 실루엣
function drawMorningBg(t) {
  // 태양
  const sunX=CW*0.8, sunY=CH*0.18;
  const sunGrad=ctx.createRadialGradient(sunX,sunY,5,sunX,sunY,50);
  sunGrad.addColorStop(0,'rgba(255,230,100,1)');
  sunGrad.addColorStop(1,'rgba(255,180,60,0)');
  ctx.fillStyle=sunGrad; ctx.beginPath(); ctx.arc(sunX,sunY,50,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,220,80,0.9)'; ctx.beginPath(); ctx.arc(sunX,sunY,22,0,Math.PI*2); ctx.fill();

  // 산 (원경)
  drawKoreanMountains(t.mountColor, 0.7, cameraX*0.08);
  // 기와집 실루엣
  drawKoreanHouses(t.groundColor, cameraX*0.2);
  // 전경 나무
  drawKoreanPines(cameraX*0.35);
}

function drawDayBg(t) {
  // 구름
  ctx.fillStyle='rgba(255,255,255,0.7)';
  const clouds=[{x:100,y:55,w:130,h:45},{x:360,y:40,w:100,h:36},{x:620,y:70,w:150,h:50}];
  for (const c of clouds) {
    const cx=((c.x-cameraX*0.2)%(CW+c.w+20)+CW+c.w+20)%(CW+c.w+20)-c.w;
    ctx.beginPath(); ctx.ellipse(cx,c.y,c.w/2,c.h/2,0,0,Math.PI*2); ctx.fill();
  }
  drawKoreanMountains(t.mountColor, 0.65, cameraX*0.08);
  drawKoreanHouses(t.groundColor, cameraX*0.2);
  drawKoreanPines(cameraX*0.35);
}

function drawEveningBg(t) {
  // 낙조
  const sunX=CW*0.15, sunY=CH*0.55;
  const sg=ctx.createRadialGradient(sunX,sunY,2,sunX,sunY,80);
  sg.addColorStop(0,'rgba(255,100,0,0.9)'); sg.addColorStop(1,'rgba(255,50,0,0)');
  ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(sunX,sunY,80,0,Math.PI*2); ctx.fill();
  // 반짝이는 별 조금
  drawStars(8);
  drawKoreanMountains(t.mountColor, 0.75, cameraX*0.08);
  drawKoreanHouses(t.groundColor, cameraX*0.2);
  // 등불 효과
  drawLanterns(cameraX*0.3);
}

function drawNightBg(t) {
  // 달
  const moonX=CW*0.82, moonY=CH*0.15;
  ctx.fillStyle='rgba(255,250,200,0.95)';
  ctx.beginPath(); ctx.arc(moonX,moonY,24,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(200,210,180,0.4)';
  ctx.beginPath(); ctx.arc(moonX-7,moonY-5,20,0,Math.PI*2); ctx.fill();
  drawStars(40);
  drawKoreanMountains(t.mountColor, 0.8, cameraX*0.08);
  drawKoreanHouses(t.groundColor, cameraX*0.2);
  drawLanterns(cameraX*0.3);
}

function drawStars(count) {
  ctx.fillStyle='rgba(255,255,255,0.8)';
  for (let i=0; i<count; i++) {
    const sx=((i*137+50)%(CW+20));
    const sy=(i*73+10)%(CH*0.5);
    const r=0.5+(i%3)*0.5;
    ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
  }
}

// 한국 전통 산 (겹겹이)
function drawKoreanMountains(color, opacity, scrollX) {
  ctx.save(); ctx.globalAlpha=opacity;
  const defs=[
    {pts:[[0,320],[80,200],[160,260],[260,170],[370,230],[460,155],[560,220],[660,160],[760,230],[800,300],[800,450],[0,450]]},
    {pts:[[0,350],[60,260],[140,300],[220,230],[310,280],[400,210],[500,270],[590,200],[680,260],[800,320],[800,450],[0,450]]},
  ];
  for (let d=0; d<defs.length; d++) {
    const off=scrollX*(0.4-d*0.15);
    ctx.fillStyle=color;
    ctx.beginPath();
    for (let i=0; i<defs[d].pts.length; i++) {
      const [x,y]=defs[d].pts[i];
      const rx=((x-off)%CW+CW)%CW;
      i===0 ? ctx.moveTo(rx,y) : ctx.lineTo(rx,y);
    }
    ctx.fill();
    // 기와지붕 힌트 (산 위에 작은 삼각)
    if (d===0) {
      ctx.fillStyle='rgba(0,0,0,0.15)';
      for (let tx=40; tx<800; tx+=200) {
        const rx=((tx-off*0.5)%CW+CW)%CW;
        ctx.beginPath(); ctx.moveTo(rx,260); ctx.lineTo(rx+30,230); ctx.lineTo(rx+60,260); ctx.fill();
      }
    }
  }
  ctx.restore();
}

// 한국 기와집 실루엣
function drawKoreanHouses(color, scrollX) {
  ctx.save(); ctx.globalAlpha=0.55;
  ctx.fillStyle=color;
  const houses=[{x:80},{x:280},{x:480},{x:680},{x:880},{x:1080}];
  for (const h of houses) {
    const rx=((h.x-scrollX*0.5)%(CW+140)+CW+140)%(CW+140)-70;
    const by=GROUND_Y;
    // 기둥/벽
    ctx.fillRect(rx+10,by-50,60,50);
    // 기와지붕 (이중 처마)
    ctx.beginPath();
    ctx.moveTo(rx-10,by-50);
    ctx.lineTo(rx+40,by-85); ctx.lineTo(rx+90,by-50);
    ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.moveTo(rx-14,by-50);
    ctx.lineTo(rx+40,by-90); ctx.lineTo(rx+94,by-50);
    ctx.fill();
    ctx.fillStyle=color;
  }
  ctx.restore();
}

// 소나무
function drawKoreanPines(scrollX) {
  ctx.save(); ctx.globalAlpha=0.45;
  const pines=[{x:150},{x:380},{x:600},{x:820},{x:1050}];
  for (const p of pines) {
    const rx=((p.x-scrollX*0.6)%(CW+60)+CW+60)%(CW+60)-30;
    const by=GROUND_Y;
    ctx.fillStyle='#2d5a1b';
    // 줄기
    ctx.fillRect(rx+7,by-55,6,25);
    // 세 층 삼각형
    for (let l=0; l<3; l++) {
      ctx.beginPath();
      ctx.moveTo(rx,by-35-l*22); ctx.lineTo(rx+10,by-58-l*22); ctx.lineTo(rx+20,by-35-l*22);
      ctx.fill();
    }
  }
  ctx.restore();
}

// 등불
function drawLanterns(scrollX) {
  const glow=0.5+0.5*Math.sin(frameCount*0.06);
  const lans=[{x:120},{x:320},{x:520},{x:720}];
  for (const l of lans) {
    const rx=((l.x-scrollX*0.4)%(CW+80)+CW+80)%(CW+80)-40;
    const ly=GROUND_Y-90;
    // 줄
    ctx.strokeStyle='rgba(180,120,0,0.7)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(rx,ly-20); ctx.lineTo(rx,ly); ctx.stroke();
    // 등불 glow
    ctx.save();
    ctx.shadowColor=`rgba(255,160,0,${glow})`;
    ctx.shadowBlur=18;
    ctx.fillStyle=`rgba(255,${120+Math.round(glow*80)},0,0.85)`;
    ctx.fillRect(rx-8,ly,16,22);
    ctx.restore();
  }
}

function drawPlatforms() {
  for (const p of platforms) {
    const sx=p.x-cameraX;
    if (sx+p.w<0||sx>CW) continue;
    if (p.y===GROUND_Y) {
      ctx.fillStyle='#4a7c59'; ctx.fillRect(sx,p.y,p.w,p.h);
      ctx.fillStyle='#6abf77'; ctx.fillRect(sx,p.y,p.w,8);
    } else {
      ctx.fillStyle=p.color; ctx.fillRect(sx,p.y,p.w,p.h);
      ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(sx,p.y,p.w,4);
    }
  }
}

function drawCoins() {
  for (const c of coins) {
    if (c.collected) continue;
    const sx=c.x-cameraX;
    if (sx<-20||sx>CW+20) continue;
    const bob=Math.sin(frameCount*0.08+c.x*0.1)*3;
    ctx.save();
    ctx.shadowColor='#ffd700'; ctx.shadowBlur=10;
    ctx.fillStyle='#ffd700';
    ctx.beginPath(); ctx.arc(sx,c.y+bob,c.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(sx-2,c.y+bob-2,c.r*0.4,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx=e.x-cameraX;
    if (sx+e.w<0||sx>CW) continue;

    if (e.type==='fly') {
      // 비행 몬스터: 박쥐/새 스타일
      ctx.save();
      ctx.fillStyle='#9b59b6';
      // 날개
      const wf=Math.sin(frameCount*0.25)*12;
      ctx.beginPath();
      ctx.ellipse(sx-16,e.y+wf,14,7,Math.PI*0.3,0,Math.PI*2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(sx+e.w+10,e.y-wf,14,7,-Math.PI*0.3,0,Math.PI*2); ctx.fill();
      // 몸통
      ctx.fillStyle='#8e44ad';
      ctx.beginPath(); ctx.ellipse(sx+e.w/2,e.y+e.h/2,e.w/2,e.h/2,0,0,Math.PI*2); ctx.fill();
      // 눈
      ctx.fillStyle='#ff0'; ctx.beginPath(); ctx.arc(sx+e.w/2-5,e.y+8,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff0'; ctx.beginPath(); ctx.arc(sx+e.w/2+5,e.y+8,3,0,Math.PI*2); ctx.fill();
      ctx.restore();
    } else {
      // 지상 몬스터
      ctx.fillStyle='#e94560';
      ctx.fillRect(sx,e.y,e.w,e.h);
      const eyeX=e.vx>0?sx+e.w-12:sx+4;
      ctx.fillStyle='#fff'; ctx.fillRect(eyeX,e.y+5,8,8);
      ctx.fillStyle='#000'; ctx.fillRect(eyeX+2,e.y+7,4,4);
      ctx.fillStyle='#c73652';
      const leg=Math.sin(frameCount*0.18)*4;
      ctx.fillRect(sx+3,e.y+e.h-8+leg,10,8);
      ctx.fillRect(sx+e.w-13,e.y+e.h-8-leg,10,8);
      if (level>=10) {
        ctx.fillStyle='#ff0';
        ctx.beginPath();
        ctx.moveTo(sx+8,e.y); ctx.lineTo(sx+12,e.y-10); ctx.lineTo(sx+16,e.y);
        ctx.fill();
      }
    }
  }
}

function drawBullets() {
  // 플레이어 총알
  for (const b of bullets) {
    if (!b.alive) continue;
    const sx=b.x-cameraX;
    ctx.save();
    ctx.fillStyle='#ffd700';
    ctx.shadowColor='#ffd700'; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(sx,b.y,5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // 보스 총알
  for (const bb of bossBullets) {
    if (!bb.alive) continue;
    const sx=bb.x-cameraX;
    ctx.save();
    ctx.fillStyle='#ff0040';
    ctx.shadowColor='#ff0040'; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(sx,bb.y,7,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ── 보스 그리기 ───────────────────────────────
function drawBoss() {
  if (!bossState||!bossState.alive) return;
  const b=bossState;
  const sx=b.x-cameraX;

  ctx.save();
  ctx.translate(sx+b.w/2, b.y+b.h/2);
  if (b.facing===-1) ctx.scale(-1,1);

  // 몸통 (검정 길고양이)
  // 꼬리
  ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=8;
  ctx.beginPath();
  ctx.moveTo(b.w/2-5,b.h/2-10);
  ctx.bezierCurveTo(b.w/2+25,b.h/2-30,b.w/2+40,b.h/2-10,b.w/2+25,-b.h/2+20);
  ctx.stroke();

  // 몸통
  ctx.fillStyle='#111';
  ctx.beginPath(); ctx.ellipse(0,b.h*0.15,b.w/2,b.h*0.38,0,0,Math.PI*2); ctx.fill();

  // 머리
  ctx.beginPath(); ctx.arc(0,-b.h*0.3,b.w*0.42,0,Math.PI*2); ctx.fill();

  // 귀
  ctx.fillStyle='#111';
  ctx.beginPath(); ctx.moveTo(-16,-b.h*0.3-22); ctx.lineTo(-22,-b.h*0.3-5); ctx.lineTo(-5,-b.h*0.3-8); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(16,-b.h*0.3-22); ctx.lineTo(22,-b.h*0.3-5); ctx.lineTo(5,-b.h*0.3-8); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#3a0a0a';
  ctx.beginPath(); ctx.moveTo(-14,-b.h*0.3-20); ctx.lineTo(-19,-b.h*0.3-7); ctx.lineTo(-7,-b.h*0.3-9); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14,-b.h*0.3-20); ctx.lineTo(19,-b.h*0.3-7); ctx.lineTo(7,-b.h*0.3-9); ctx.closePath(); ctx.fill();

  // 눈 (빛나는)
  const eg=b.eyeGlow;
  ctx.save();
  ctx.shadowColor=`rgba(255,50,0,${eg})`; ctx.shadowBlur=20*eg;
  ctx.fillStyle=`rgba(255,${Math.round(80*eg)},0,1)`;
  ctx.beginPath(); ctx.ellipse(-10,-b.h*0.3,7,5,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10,-b.h*0.3,7,5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(-10,-b.h*0.3,3,5,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10,-b.h*0.3,3,5,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // 수염
  ctx.strokeStyle='rgba(200,200,200,0.7)'; ctx.lineWidth=1.5;
  for (let s=-1; s<=1; s+=2) {
    ctx.beginPath(); ctx.moveTo(s*4,-b.h*0.3+10); ctx.lineTo(s*26,-b.h*0.3+8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s*4,-b.h*0.3+14); ctx.lineTo(s*26,-b.h*0.3+18); ctx.stroke();
  }

  // 앞발 공격
  if (b.pawAttack) {
    const pawProgress=1-(b.pawTimer/40);
    const pawX=b.w/2*b.pawSide + Math.sin(pawProgress*Math.PI)*30*b.pawSide;
    const pawY=b.h*0.25 + Math.sin(pawProgress*Math.PI)*20;
    ctx.fillStyle='#111';
    ctx.beginPath(); ctx.ellipse(pawX,pawY,18,12,-0.3*b.pawSide,0,Math.PI*2); ctx.fill();
    // 발톱
    ctx.strokeStyle='#888'; ctx.lineWidth=2;
    for (let ci=-1; ci<=1; ci++) {
      ctx.beginPath();
      ctx.moveTo(pawX+ci*5,pawY+8);
      ctx.lineTo(pawX+ci*7,pawY+18);
      ctx.stroke();
    }
  } else {
    // 기본 발
    ctx.fillStyle='#111';
    ctx.beginPath(); ctx.ellipse(-b.w*0.3,b.h*0.4,14,9,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(b.w*0.3,b.h*0.4,14,9,0,0,Math.PI*2); ctx.fill();
  }

  ctx.restore();

  // HP 바
  const barW=100, barX=sx+b.w/2-barW/2, barY=b.y-22;
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(barX,barY,barW,10);
  const hpRatio=b.hp/b.maxHp;
  ctx.fillStyle=hpRatio>0.5?'#2ecc71':hpRatio>0.25?'#f39c12':'#e74c3c';
  ctx.fillRect(barX,barY,barW*hpRatio,10);
  ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(barX,barY,barW,10);
  ctx.fillStyle='#fff'; ctx.font='bold 10px Arial'; ctx.textAlign='center';
  ctx.fillText(`👾 BOSS ${b.hp}/${b.maxHp}`,sx+b.w/2,barY-4);
  ctx.textAlign='left';
}

// ── 플레이어 그리기 ───────────────────────────
function drawPlayer() {
  const sx=player.x-cameraX;
  if (invincible>0&&superTimer<=0&&Math.floor(frameCount/5)%2===0) return;

  ctx.save();
  ctx.translate(sx+player.w/2,player.y+player.h/2);
  ctx.scale(player.facing,1);

  if (superTimer>0) {
    const t=frameCount*0.08;
    const auraR=player.w*1.1;
    const grad=ctx.createRadialGradient(0,0,auraR*0.3,0,0,auraR);
    const hue=(frameCount*4)%360;
    grad.addColorStop(0,`hsla(${hue},100%,70%,0.9)`);
    grad.addColorStop(0.6,`hsla(${(hue+120)%360},100%,60%,0.5)`);
    grad.addColorStop(1,`hsla(${(hue+240)%360},100%,50%,0)`);
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.arc(0,0,auraR,0,Math.PI*2); ctx.fill();
    for (let i=0; i<6; i++) {
      const angle=t+(i/6)*Math.PI*2;
      const dist=auraR*0.85;
      ctx.fillStyle=`hsl(${(hue+i*60)%360},100%,80%)`;
      ctx.beginPath(); ctx.arc(Math.cos(angle)*dist,Math.sin(angle)*dist,4,0,Math.PI*2); ctx.fill();
    }
    ctx.shadowColor=`hsl(${hue},100%,70%)`; ctx.shadowBlur=18;
    ctx.scale(1.15,1.15);
  }

  if (catLoaded) {
    ctx.drawImage(catImg,-player.w/2,-player.h/2,player.w,player.h);
  } else {
    drawDefaultCat();
  }

  // 총 (항상 표시)
  drawGun();

  ctx.restore();

  // 슈퍼 타이머 바
  if (superTimer>0) {
    const bw=player.w+16, bx=sx-8, by=player.y-10;
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(bx,by,bw,5);
    ctx.fillStyle=`hsl(${(frameCount*4)%360},100%,55%)`;
    ctx.fillRect(bx,by,bw*(superTimer/SUPER_DURATION),5);
  }
}

function drawGun() {
  const hw=player.w/2, hh=player.h/2;
  // 총신
  ctx.fillStyle='#555';
  ctx.fillRect(hw-4,hh*0.1,18,7);
  // 총구 플래시 (발사 직후)
  if (shootCooldown>12) {
    ctx.fillStyle='rgba(255,220,0,0.8)';
    ctx.beginPath(); ctx.arc(hw+14,hh*0.1+3.5,5,0,Math.PI*2); ctx.fill();
  }
  // 손잡이
  ctx.fillStyle='#8B4513';
  ctx.fillRect(hw-2,hh*0.18,7,10);
}

function drawDefaultCat() {
  const hw=player.w/2, hh=player.h/2;
  ctx.fillStyle='#f0c040';
  ctx.fillRect(-hw,-hh+8,player.w,player.h-8);
  ctx.beginPath(); ctx.arc(0,-hh+6,16,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14,-hh+2); ctx.lineTo(-10,-hh-10); ctx.lineTo(-4,-hh+2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4,-hh+2); ctx.lineTo(10,-hh-10); ctx.lineTo(14,-hh+2); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#e8a0a0';
  ctx.beginPath(); ctx.moveTo(-12,-hh+2); ctx.lineTo(-10,-hh-7); ctx.lineTo(-5,-hh+2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5,-hh+2); ctx.lineTo(10,-hh-7); ctx.lineTo(12,-hh+2); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#222';
  ctx.beginPath(); ctx.arc(-6,-hh+5,3.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(6,-hh+5,3.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.arc(-5,-hh+4,1.2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(7,-hh+4,1.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ff8080';
  ctx.beginPath(); ctx.arc(0,-hh+10,2,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#888'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-2,-hh+10); ctx.lineTo(-14,-hh+9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2,-hh+11); ctx.lineTo(-14,-hh+13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2,-hh+10); ctx.lineTo(14,-hh+9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2,-hh+11); ctx.lineTo(14,-hh+13); ctx.stroke();
  ctx.strokeStyle='#f0c040'; ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(hw-2,hh-8);
  ctx.bezierCurveTo(hw+14,hh-20,hw+18,-4,hw+8,-10);
  ctx.stroke();
  ctx.fillStyle='#d4a030';
  const leg=player.onGround?Math.sin(frameCount*0.25*Math.min(Math.abs(player.vx)/PLAYER_SPEED,1))*5:0;
  ctx.fillRect(-hw+2,hh-14+leg,10,14);
  ctx.fillRect(hw-12,hh-14-leg,10,14);
}

function drawGoal() {
  const sx=goal.x-cameraX;
  if (sx<-30||sx>CW+30) return;
  ctx.fillStyle='#ccc'; ctx.fillRect(sx,goal.y,6,goal.h);
  const wave=Math.sin(frameCount*0.12)*5;
  ctx.fillStyle='#e94560';
  ctx.beginPath();
  ctx.moveTo(sx+6,goal.y);
  ctx.quadraticCurveTo(sx+30+wave,goal.y+18,sx+6,goal.y+36);
  ctx.fill();
  ctx.fillStyle='#ffd700'; ctx.font='bold 15px Arial'; ctx.textAlign='center';
  ctx.fillText('GOAL',sx+3,goal.y-8); ctx.textAlign='left';
}

let bannerTimer=0;
const BANNER_DURATION=90;

function drawLevelBanner() {
  if (bannerTimer<=0) return;
  const alpha=Math.min(1,bannerTimer/20);
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.fillRect(CW/2-180,CH/2-48,360,90);
  ctx.fillStyle='#ffd700'; ctx.font='bold 32px Arial'; ctx.textAlign='center';
  if (isBossLevel(level)) {
    const bossNames = { 5:'미니 보스 등장!', 10:'중간 보스 등장!', 15:'강력한 보스 등장!', 20:'⚠️ 최종 보스 등장!' };
    ctx.fillStyle = level===MAX_LEVEL ? '#ff2020' : '#ff8800';
    ctx.fillText(bossNames[level]||'보스 등장!', CW/2, CH/2-5);
    ctx.font='15px Arial'; ctx.fillStyle='#fff';
    ctx.fillText('Z/Ctrl 또는 🔫 버튼으로 공격!', CW/2, CH/2+22);
  } else {
    const tod = TIME_OF_DAY(level);
    const todName = { morning:'🌅 아침', night:'🌙 밤' }[tod] || '🌅 아침';
    ctx.fillText(`레벨 ${level} / ${MAX_LEVEL}  ${todName}`, CW/2, CH/2+5);
  }
  ctx.textAlign='left'; ctx.restore();
  bannerTimer--;
}

function drawSuperModeHUD() {
  if (superTimer<=0) return;
  const flashAlpha=Math.max(0,(superTimer-(SUPER_DURATION-12))/12);
  if (flashAlpha>0) {
    const hue=(frameCount*4)%360;
    ctx.fillStyle=`hsla(${hue},100%,70%,${flashAlpha*0.4})`;
    ctx.fillRect(0,0,CW,CH);
  }
  const edgeAlpha=0.18+Math.sin(frameCount*0.15)*0.07;
  const hue=(frameCount*4)%360;
  const edgeGrad=ctx.createRadialGradient(CW/2,CH/2,CH*0.3,CW/2,CH/2,CH*0.85);
  edgeGrad.addColorStop(0,'rgba(0,0,0,0)');
  edgeGrad.addColorStop(1,`hsla(${hue},100%,55%,${edgeAlpha})`);
  ctx.fillStyle=edgeGrad; ctx.fillRect(0,0,CW,CH);
  if (superTimer>SUPER_DURATION-90) {
    const t=SUPER_DURATION-superTimer;
    const alpha=Math.min(1,t/15)*Math.min(1,(SUPER_DURATION-90-t+90)/15);
    ctx.save(); ctx.globalAlpha=Math.max(0,alpha);
    ctx.font=`bold ${Math.round(36+Math.sin(frameCount*0.3)*3)}px Arial`;
    ctx.textAlign='center';
    ctx.fillStyle=`hsl(${hue},100%,70%)`;
    ctx.shadowColor=`hsl(${hue},100%,50%)`; ctx.shadowBlur=20;
    ctx.fillText('⚡ SUPER MODE! ⚡',CW/2,CH/2-60);
    ctx.restore();
  }
}

// ════════════════════════════════════════════
//  랭킹 시스템 (Firebase 온라인 연동)
// ════════════════════════════════════════════
function showRankOverlay() {
  const ro  = document.getElementById('rank-overlay');
  const txt = document.getElementById('rank-score-text');
  txt.textContent = `최종 점수: ${score.toLocaleString()}점`;
  // Firebase 모듈이 준비됐으면 실시간 랭킹 구독 시작
  if (window.firebaseRanking) window.firebaseRanking.subscribe();
  ro.style.display = 'flex';
  // 현재 점수를 전역으로 노출 (Firebase 저장 버튼에서 사용)
  window._gameScore = score;
}

// 다시하기 함수를 window에 노출 (Firebase 모듈에서 호출)
window._gameShowMenu = () => {
  showOverlay('🐱 유현이 고양이의 모험','적을 피하고 코인을 모아라!','다시 하기');
};

// ── 오버레이 ──────────────────────────────────
const overlay=document.getElementById('overlay');

function showOverlay(title,desc,btnText) {
  overlay.innerHTML=`
    <h1>${title}</h1>
    <p>${desc}</p>
    <p class="sub">코인 10개 = ⚡슈퍼 모드 10초!</p>
    <p class="sub">← → 이동 &nbsp;|&nbsp; ↑/Space 점프 &nbsp;|&nbsp; Z/Ctrl 발사</p>
    <button id="startBtn">${btnText}</button>
  `;
  overlay.style.display='flex';
  document.getElementById('startBtn').addEventListener('click',startGame);
}

function startGame() {
  score=0; lives=10; level=1;
  coinCounter=0; superTimer=0;
  initLevel();
  bannerTimer=BANNER_DURATION;
  updateUI();
  overlay.style.display='none';
  document.getElementById('rank-overlay').style.display='none';
  state='play';
  startBGM(); // 배경음악 시작 (첫 클릭으로 AudioContext 활성화)
}

document.getElementById('startBtn').addEventListener('click',startGame);

// ── 게임 루프 ─────────────────────────────────
function loop() {
  update();
  draw();
  if (state==='win') { state='menu'; }
  if (state==='dead') { state='menu'; }
  requestAnimationFrame(loop);
}

loop();
