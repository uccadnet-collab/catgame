'use strict';
// ═══════════════════════════════════════════════
//  유현이 고양이의 모험  –  game.js  v4.0  (B안: 고정높이+가변너비)
// ═══════════════════════════════════════════════
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// ── 동적 해상도 (B안: 고정 높이 450, 너비는 화면 비율에 따라 가변) ──
// index.html resizeGame()이 canvas.width/height를 먼저 설정하므로
// 여기서는 현재 값을 읽어서 사용
// 기본값: 16:9 기준 800×450
let CW = canvas.width  || 800;
let CH = canvas.height || 450;

// 해상도 변경 시 재계산이 필요한 값들
function getGroundY() { return CH - Math.round(CH * 0.133); } // 화면 아래 13%

// ── 상수 ──────────────────────────────────────
const GRAVITY      = 0.55;
const PLAYER_SPEED = 4.5;
const JUMP_FORCE   = -13;
let   GROUND_Y     = getGroundY();
const TILE         = 40;
const MAX_LEVEL    = 20;
const SUPER_DURATION   = 600;
const SUPER_COIN_COUNT = 10;

// index.html에서 화면 크기 바뀔 때 호출
window._onGameResize = (newW, newH) => {
  CW = newW; CH = newH;
  canvas.width = CW; canvas.height = CH;
  GROUND_Y = getGroundY();
  // 플레이어 위치도 바닥 기준으로 재조정
  if (player) player.y = GROUND_Y - player.h;
  // 플레이 중이면 레벨 구성 요소(플랫폼·코인·적) 재생성 (GROUND_Y 변경에 대응)
  if (typeof state !== 'undefined' && state === 'play' && typeof initLevel === 'function') {
    const savedScore = score;
    const savedLives = lives;
    const savedLevel = level;
    initLevel();
    score = savedScore; lives = savedLives; level = savedLevel;
    updateUI();
  }
};

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
    // 귀여운 멜로디: 도미솔도↑ + 여운
    const melody = [
      [523,0.00,0.13],[659,0.11,0.13],[784,0.22,0.13],
      [1047,0.33,0.22],[1319,0.50,0.13],[1047,0.60,0.10],
      [1319,0.68,0.35]
    ];
    melody.forEach(([freq,offset,dur]) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine';
      const t = ac.currentTime + offset;
      o.frequency.setValueAtTime(freq, t);
      // 귀여운 비브라토 느낌
      o.frequency.linearRampToValueAtTime(freq * 1.02, t + dur * 0.5);
      o.frequency.linearRampToValueAtTime(freq, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + dur - 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
      o.start(t); o.stop(t + dur + 0.08);
    });
    // 반짝이는 고음 장식음
    [2093,2637].forEach((freq,i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine';
      const t = ac.currentTime + 0.55 + i * 0.1;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.18);
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

// ── 배경음악: 케데헌 골든 MIDI 실제 데이터 (Web Audio API) ──
// MIDI 파일에서 추출한 실제 음표 데이터 [시작시간(s), 주파수(Hz), 길이(s)]
const BGM_MELODY = [
  [0.0000,440.0,0.1622],[0.1622,440.0,0.1622],[0.3243,493.88,0.3243],[0.6486,493.88,0.3243],
  [0.9730,523.25,0.1622],[1.1351,493.88,0.3243],[1.4595,440.0,0.1622],[1.6216,392.0,0.3243],
  [1.9459,440.0,0.1622],[2.1081,440.0,0.1622],[2.2703,493.88,0.3243],[2.5946,493.88,0.3243],
  [2.9189,523.25,0.1622],[3.0811,493.88,0.3243],[3.4054,440.0,0.1622],[3.5676,392.0,0.3243],
  [3.8919,440.0,0.1622],[4.0541,440.0,0.1622],[4.2162,493.88,0.3243],[4.5405,493.88,0.3243],
  [4.8649,523.25,0.1622],[5.0270,493.88,0.3243],[5.3513,440.0,0.1622],[5.5135,392.0,0.3243],
  [5.8378,440.0,0.1622],[6.0000,440.0,0.1622],[6.1622,493.88,0.3243],[6.4865,493.88,0.3243],
  [6.8108,523.25,0.1622],[6.9730,493.88,0.3243],[7.2973,440.0,0.1622],[7.4595,392.0,0.3243],
  [7.7838,440.0,0.1622],[7.9459,440.0,0.1622],[8.1081,493.88,0.3243],[8.4324,493.88,0.3243],
  [8.7567,523.25,0.1622],[8.9189,493.88,0.3243],[9.2432,440.0,0.1622],[9.4054,392.0,0.3243],
  [9.7297,440.0,0.1622],[9.8919,440.0,0.1622],[10.0540,493.88,0.3243],[10.3784,493.88,0.3243],
  [10.7027,523.25,0.1622],[10.8649,493.88,0.3243],[11.1892,440.0,0.1622],[11.3513,392.0,0.3243],
  [11.6757,440.0,0.1622],[11.8378,440.0,0.1622],[12.0000,493.88,0.3243],[12.3243,493.88,0.3243],
  [12.6486,523.25,0.1622],[12.8108,493.88,0.3243],[13.1351,440.0,0.1622],[13.2973,392.0,0.3243],
  [13.6216,329.63,0.9730]
];
// 루프 길이 (마지막 음표 끝까지)
const BGM_LOOP_DUR = 14.5946;

// 베이스 [시작시간(s), 주파수(Hz), 길이(s)]
const BGM_BASS = [
  [0.0000,98.0,0.1622],[0.1622,130.81,0.1622],[0.3243,164.81,0.1622],[0.4865,130.81,0.1622],
  [0.6486,164.81,0.1622],[0.8108,130.81,0.1622],[0.9730,164.81,0.1622],[1.1351,130.81,0.1622],
  [1.2973,164.81,0.1622],[1.4595,130.81,0.1622],[1.6216,164.81,0.1622],[1.7838,130.81,0.1622],
  [1.9459,98.0,0.1622],[2.1081,123.47,0.1622],[2.2703,146.83,0.1622],[2.4324,123.47,0.1622],
  [2.5946,146.83,0.1622],[2.7568,123.47,0.1622],[2.9189,146.83,0.1622],[3.0811,123.47,0.1622],
  [3.2432,146.83,0.1622],[3.4054,123.47,0.1622],[3.5676,146.83,0.1622],[3.7297,123.47,0.1622],
  [3.8919,110.0,0.1622],[4.0541,146.83,0.1622],[4.2162,185.0,0.1622],[4.3784,146.83,0.1622],
  [4.5405,185.0,0.1622],[4.7027,146.83,0.1622],[4.8649,185.0,0.1622],[5.0270,146.83,0.1622],
  [5.1892,185.0,0.1622],[5.3513,146.83,0.1622],[5.5135,185.0,0.1622],[5.6757,146.83,0.1622],
  [5.8378,123.47,0.1622],[6.0000,164.81,0.1622],[6.1622,196.0,0.1622],[6.3243,164.81,0.1622],
  [6.4865,196.0,0.1622],[6.6486,164.81,0.1622],[6.8108,196.0,0.1622],[6.9730,164.81,0.1622],
  [7.1351,196.0,0.1622],[7.2973,164.81,0.1622],[7.4595,196.0,0.1622],[7.6216,164.81,0.1622],
  [7.7838,98.0,0.1622],[7.9459,130.81,0.1622],[8.1081,164.81,0.1622],[8.2703,130.81,0.1622],
  [8.4324,164.81,0.1622],[8.5946,130.81,0.1622],[8.7567,164.81,0.1622],[8.9189,130.81,0.1622],
  [9.0811,164.81,0.1622],[9.2432,130.81,0.1622],[9.4054,164.81,0.1622],[9.5676,130.81,0.1622],
  [9.7297,98.0,0.1622],[9.8919,123.47,0.1622],[10.0540,146.83,0.1622],[10.2162,123.47,0.1622],
  [10.3784,146.83,0.1622],[10.5405,123.47,0.1622],[10.7027,146.83,0.1622],[10.8649,123.47,0.1622],
  [11.0270,146.83,0.1622],[11.1892,123.47,0.1622],[11.3513,146.83,0.1622],[11.5135,123.47,0.1622],
  [11.6757,110.0,0.1622],[11.8378,146.83,0.1622],[12.0000,185.0,0.1622],[12.1622,146.83,0.1622],
  [12.3243,185.0,0.1622],[12.4865,146.83,0.1622],[12.6486,185.0,0.1622],[12.8108,146.83,0.1622],
  [13.0270,185.0,0.1622],[13.1892,146.83,0.1622],[13.3513,185.0,0.1622],[13.5135,146.83,0.1622]
];

let bgmScheduled = false;
let bgmLoop = null;
let bgmMasterGain = null; // 전역 마스터 게인 (fade out 제어용)
let bgmGeneration = 0;    // 세대 번호: stopBGM 시 증가 → 이전 루프 자동 무효화

function startBGM() {
  if (!musicOn) return;
  try {
    const ac = getAudioCtx();
    stopBGM();                  // 이전 루프·타이머 완전 정리
    bgmScheduled = true;
    bgmGeneration++;            // 새 세대 시작
    scheduleBGM(ac, bgmGeneration);
  } catch(e) {}
}

function scheduleBGM(ac, gen) {
  // 세대가 다르면(=stopBGM 후 남은 콜백) 즉시 종료
  if (!musicOn || !bgmScheduled || gen !== bgmGeneration) return;

  const base = ac.currentTime + 0.05;

  // 마스터 게인 (전역 참조 유지 → stopBGM에서 fade out 가능)
  const masterGain = ac.createGain();
  masterGain.gain.value = 0.12;
  masterGain.connect(ac.destination);
  bgmMasterGain = masterGain;

  // 멜로디 – triangle 파형
  BGM_MELODY.forEach(([startSec, freq, dur]) => {
    const t = base + startSec;
    const d = Math.max(dur * 0.85, 0.05);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(masterGain);
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.75, t + 0.015);
    g.gain.setValueAtTime(0.75, t + d - 0.03);
    g.gain.linearRampToValueAtTime(0, t + d);
    o.start(t); o.stop(t + d + 0.01);
  });

  // 베이스 – sine 파형
  BGM_BASS.forEach(([startSec, freq, dur]) => {
    const t = base + startSec;
    const d = Math.max(dur * 0.8, 0.04);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(masterGain);
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.35, t);
    g.gain.linearRampToValueAtTime(0, t + d);
    o.start(t); o.stop(t + d + 0.01);
  });

  // 루프: 이 세대가 유효한 경우에만 재스케줄
  bgmLoop = setTimeout(() => {
    scheduleBGM(ac, gen);
  }, BGM_LOOP_DUR * 1000 - 150);
}

function stopBGM() {
  bgmScheduled = false;
  bgmGeneration++;            // 기존 세대 무효화 → setTimeout 콜백 자동 차단
  if (bgmLoop) { clearTimeout(bgmLoop); bgmLoop = null; }
  // 현재 재생 중인 masterGain을 빠르게 fade out (0.2초)
  if (bgmMasterGain) {
    try {
      const ac = bgmMasterGain.context;
      bgmMasterGain.gain.setValueAtTime(bgmMasterGain.gain.value, ac.currentTime);
      bgmMasterGain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.2);
    } catch(e) {}
    bgmMasterGain = null;
  }
}

// 음악 토글 버튼
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
// 총알 사거리: 항상 현재 CW의 1/3 (동적)
function getBulletMaxDist() { return CW / 3; }

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

// 보스방 발판 목록 (platforms와 coins가 공유)
function getBossPlats(lvl) {
  if (!isBossLevel(lvl)) return [];
  const tier = lvl / 5;
  const platCount = 4 + tier;
  const roomW = CW * 1.5;
  const colors = ['#c0392b','#8e44ad','#2980b9','#27ae60'];
  const color = colors[tier-1] || '#888';
  const plats = [];
  for (let i=0; i<platCount; i++) {
    const px = 160 + Math.round(i * (roomW-280) / platCount);
    const pyOptions = [GROUND_Y-90, GROUND_Y-145, GROUND_Y-195];
    const py = pyOptions[i % pyOptions.length];
    plats.push({x:px, y:py, w:110, h:18, color});
  }
  return plats;
}

function makePlatforms(lvl) {
  if (isBossLevel(lvl)) {
    // 보스방: 바닥 + 발판
    return [...makeFloor(lvl), ...getBossPlats(lvl)];
  }
  return [...makeFloor(lvl), ...getLevelPlatforms(lvl)];
}

function makeCoins(lvl) {
  const coins=[];

  if (!isBossLevel(lvl)) {
    // 일반 레벨: 플랫폼 위 + 지상
    for (const p of getLevelPlatforms(lvl)) {
      const cnt=2+Math.floor(Math.random()*2);
      for (let i=0; i<cnt; i++) coins.push({x:p.x+20+i*24,y:p.y-20,r:9,collected:false});
    }
    const ww=getWorldW(lvl);
    for (let x=300; x<ww-200; x+=180) coins.push({x,y:GROUND_Y-20,r:9,collected:false});
  } else {
    // 보스 레벨: 발판 위에 코인 3개씩 + 지상 코인
    const bossPlats = getBossPlats(lvl);
    for (const p of bossPlats) {
      for (let c=0; c<3; c++) {
        coins.push({x: p.x+15+c*32, y: p.y-18, r:9, collected:false});
      }
    }
    const roomW = CW * 1.5;
    for (let x=150; x<roomW-100; x+=210) {
      coins.push({x, y:GROUND_Y-20, r:9, collected:false});
    }
  }
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

function updateBoss(dt=1) {
  const b = bossState;
  if (!b || !b.alive) return;

  b.phaseTimer += dt;
  b.shootTimer  += dt;
  b.eyeGlow = 0.5 + 0.5*Math.sin(frameCount*0.1);

  // 좌우 순찰
  b.x += b.vx * dt;
  if (b.x < CW*0.3 || b.x + b.w > CW*0.95) b.vx *= -1;
  b.facing = b.vx > 0 ? 1 : -1;

  // 발 공격
  if (b.phaseTimer >= b.pawInterval) {
    b.phaseTimer = 0;
    b.pawAttack = true; b.pawTimer = 40;
    b.pawSide = b.vx > 0 ? 1 : -1;
  }
  if (b.pawAttack) {
    b.pawTimer -= dt;
    if (b.pawTimer <= 0) b.pawAttack = false;
  }

  // 앞발 공격 히트 판정
  if (b.pawAttack && b.pawTimer > 10 && b.pawTimer < 35) {
    const pawX = b.pawSide === 1 ? b.x + b.w : b.x - 40;
    const pawY = b.y + b.h * 0.6;
    const pawHit = { x: pawX, y: pawY, w: 40, h: 30 };
    if (invincible <= 0 && rectOverlap(player, pawHit)) { loseLife(); return; }
  }

  // 총알 발사
  if (b.shootTimer >= b.shootInterval) {
    b.shootTimer = 0;
    const dx = player.x - b.x;
    const dy = player.y - b.y;
    const bulletCount = 1 + b.tier;
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
    bb.x += bb.vx * dt; bb.y += bb.vy * dt;
    if (bb.x<0||bb.x>CW||bb.y<0||bb.y>CH+50) { bb.alive=false; continue; }
    if (invincible<=0 && rectOverlap(player,{x:bb.x-6,y:bb.y-6,w:12,h:12})) {
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

// ── 업데이트 (dt: delta time, 60fps=1.0 기준) ──
function update(dt=1) {
  if (state === 'levelclear') { updateLevelClear(dt); return; }
  if (state !== 'play') return;
  frameCount += dt;
  if (invincible>0) invincible -= dt;
  if (shootCooldown>0) shootCooldown -= dt;

  // 플레이어 이동
  player.vx=0;
  if (isLeft())  { player.vx=-PLAYER_SPEED; player.facing=-1; }
  if (isRight()) { player.vx= PLAYER_SPEED; player.facing= 1; }
  player.vy += GRAVITY * dt;
  player.x  += player.vx * dt;
  player.y  += player.vy * dt;
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
    bull.x += bull.vx * dt;
    const dist = Math.abs(bull.x - bull.startX);
    if (dist > getBulletMaxDist() || bull.x < -20 || bull.x > ww + 20) bull.alive = false;
  }
  bullets = bullets.filter(b => b.alive);

  // 보스 레벨 (5, 10, 15, 20)
  if (isBossLevel(level)) {
    updateBoss(dt);
    if (bossDefeated) {
      const addScore = 500 + level * 100;
      playLevelClear();
      if (level < MAX_LEVEL) {
        startLevelClearAnim(level + 1, addScore);
      } else {
        score += addScore;
        state = 'win'; showRankOverlay();
      }
    }
    updateUI(); return;
  }

  // 일반 적 이동 & 충돌
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.type==='fly') {
      e.flyPhase += 0.05 * dt;
      e.x += e.vx * dt;
      e.y = e.baseY + Math.sin(e.flyPhase) * 30;
      if (e.x<=e.patrolMin||e.x+e.w>=e.patrolMax) e.vx*=-1;
    } else {
      e.x += e.vx * dt;
      if (e.x<=e.patrolMin||e.x+e.w>=e.patrolMax) e.vx*=-1;
    }

    if (rectOverlap(player,e)) {
      const stomping=player.vy>0&&player.y+player.h<e.y+e.h*0.55;
      if (stomping||superTimer>0) {
        e.alive=false;
        if (stomping) { player.vy=JUMP_FORCE*0.55; playStamp(); }
        score+=superTimer>0?200:100;
      } else if (invincible<=0) { loseLife(); return; }
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
  if (superTimer>0) {
    superTimer -= dt;
    if (superTimer<=0) { superTimer=0; coinCounter=0; }
  }

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

  // 골 – 깃발 x 범위에 플레이어가 닿으면 클리어
  if (player.x + player.w > goal.x && player.x < goal.x + goal.w + 20) {
    const addScore = 300 + level * 50;
    playLevelClear();
    if (level < MAX_LEVEL) {
      startLevelClearAnim(level + 1, addScore);
    } else {
      score += addScore;
      state = 'win'; showRankOverlay();
    }
  }

  updateUI();
}

function loseLife() {
  lives--;
  playHit();
  updateUI();
  if (lives<=0) {
    playDead();
    state='dead';
    lastScore=score;
    // 이어하기 횟수 차감 없이 바로 이어하기 화면 표시
    showContinueOverlay();
  } else {
    player.reset(); cameraX=0; invincible=120;
  }
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
  if (state==='play' || state==='levelclear') {
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
  // 레벨클리어 연출은 게임 위에 오버레이
  if (state==='levelclear') {
    drawLevelClearAnim();
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
  // 태양 – CW/CH 비율
  const sunX=CW*0.8, sunY=CH*0.18;
  const sunR=Math.min(CW,CH)*0.065;
  const sunGrad=ctx.createRadialGradient(sunX,sunY,sunR*0.1,sunX,sunY,sunR*1.2);
  sunGrad.addColorStop(0,'rgba(255,230,100,1)');
  sunGrad.addColorStop(1,'rgba(255,180,60,0)');
  ctx.fillStyle=sunGrad; ctx.beginPath(); ctx.arc(sunX,sunY,sunR*1.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,220,80,0.9)'; ctx.beginPath(); ctx.arc(sunX,sunY,sunR*0.55,0,Math.PI*2); ctx.fill();

  drawKoreanMountains(t.mountColor, 0.7, cameraX*0.08);
  drawKoreanHouses(t.groundColor, cameraX*0.2);
  drawKoreanPines(cameraX*0.35);
}

function drawDayBg(t) {
  // 구름 – CW/CH 비율
  ctx.fillStyle='rgba(255,255,255,0.7)';
  const clouds=[
    {x:0.125,y:0.12,w:0.162,h:0.10},
    {x:0.45, y:0.09,w:0.125,h:0.08},
    {x:0.775,y:0.15,w:0.188,h:0.11}
  ];
  for (const c of clouds) {
    const cw=c.w*CW, ch=c.h*CH, cy=c.y*CH;
    const cx=((c.x*CW-cameraX*0.2)%(CW+cw+20)+CW+cw+20)%(CW+cw+20)-cw;
    ctx.beginPath(); ctx.ellipse(cx,cy,cw/2,ch/2,0,0,Math.PI*2); ctx.fill();
  }
  drawKoreanMountains(t.mountColor, 0.65, cameraX*0.08);
  drawKoreanHouses(t.groundColor, cameraX*0.2);
  drawKoreanPines(cameraX*0.35);
}

function drawEveningBg(t) {
  // 낙조 – CW/CH 비율
  const sunX=CW*0.15, sunY=CH*0.55;
  const sunR=Math.min(CW,CH)*0.11;
  const sg=ctx.createRadialGradient(sunX,sunY,2,sunX,sunY,sunR);
  sg.addColorStop(0,'rgba(255,100,0,0.9)'); sg.addColorStop(1,'rgba(255,50,0,0)');
  ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(sunX,sunY,sunR,0,Math.PI*2); ctx.fill();
  // 반짝이는 별 조금
  drawStars(8);
  drawKoreanMountains(t.mountColor, 0.75, cameraX*0.08);
  drawKoreanHouses(t.groundColor, cameraX*0.2);
  // 등불 효과
  drawLanterns(cameraX*0.3);
}

function drawNightBg(t) {
  // 달 – CW/CH 비율
  const moonX=CW*0.82, moonY=CH*0.15;
  const moonR=Math.min(CW,CH)*0.055;
  ctx.fillStyle='rgba(255,250,200,0.95)';
  ctx.beginPath(); ctx.arc(moonX,moonY,moonR,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(200,210,180,0.4)';
  ctx.beginPath(); ctx.arc(moonX-moonR*0.28,moonY-moonR*0.2,moonR*0.82,0,Math.PI*2); ctx.fill();
  drawStars(40);
  drawKoreanMountains(t.mountColor, 0.8, cameraX*0.08);
  drawKoreanHouses(t.groundColor, cameraX*0.2);
  drawLanterns(cameraX*0.3);
}

function drawStars(count) {
  ctx.fillStyle='rgba(255,255,255,0.8)';
  for (let i=0; i<count; i++) {
    const sx=((i*137+50)%(CW+20));
    const sy=(i*73+10)%(CH*0.48);
    const r=Math.min(CW,CH)*0.002*(1+(i%3)*0.5);
    ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
  }
}

// 한국 전통 산 (겹겹이) – CW/CH 비율 기반
function drawKoreanMountains(color, opacity, scrollX) {
  ctx.save(); ctx.globalAlpha=opacity;
  // 좌표를 0~1 비율로 정의해서 CW/CH에 맞게 스케일
  const defs=[
    {pts:[[0,0.71],[0.10,0.44],[0.20,0.58],[0.325,0.38],[0.46,0.51],[0.575,0.34],[0.70,0.49],[0.825,0.36],[0.95,0.51],[1,0.67],[1,1],[0,1]]},
    {pts:[[0,0.78],[0.075,0.58],[0.175,0.67],[0.275,0.51],[0.39,0.62],[0.50,0.47],[0.625,0.60],[0.74,0.44],[0.85,0.58],[1,0.71],[1,1],[0,1]]},
  ];
  for (let d=0; d<defs.length; d++) {
    const off=scrollX*(0.4-d*0.15);
    ctx.fillStyle=color;
    ctx.beginPath();
    for (let i=0; i<defs[d].pts.length; i++) {
      const [rx0,ry0]=defs[d].pts[i];
      const rx=((rx0*CW-off)%CW+CW)%CW;
      const ry=ry0*CH;
      i===0 ? ctx.moveTo(rx,ry) : ctx.lineTo(rx,ry);
    }
    ctx.fill();
    // 기와지붕 힌트 (산 위에 작은 삼각)
    if (d===0) {
      ctx.fillStyle='rgba(0,0,0,0.15)';
      for (let tx=0.05*CW; tx<CW; tx+=CW*0.25) {
        const rx=((tx-off*0.5)%CW+CW)%CW;
        const ty=CH*0.58;
        ctx.beginPath(); ctx.moveTo(rx,ty); ctx.lineTo(rx+CW*0.037,ty-CH*0.067); ctx.lineTo(rx+CW*0.075,ty); ctx.fill();
      }
    }
  }
  ctx.restore();
}

// 한국 기와집 실루엣 – CW/CH 비율 기반
function drawKoreanHouses(color, scrollX) {
  ctx.save(); ctx.globalAlpha=0.55;
  ctx.fillStyle=color;
  // x좌표를 CW 비율로 정의
  const houseSpacing = CW * 0.25;
  const houseCount = 6;
  const hw = CW * 0.09;   // 집 너비
  const hh = CH * 0.11;   // 집 높이 (벽)
  const roofH = CH * 0.08; // 지붕 높이
  for (let i=0; i<houseCount; i++) {
    const baseX = i * houseSpacing;
    const rx = ((baseX - scrollX*0.5) % (houseSpacing*houseCount + hw) + houseSpacing*houseCount + hw) % (houseSpacing*houseCount + hw) - hw*0.5;
    const by = GROUND_Y;
    // 기둥/벽
    ctx.fillStyle=color;
    ctx.fillRect(rx, by-hh, hw, hh);
    // 기와지붕
    ctx.beginPath();
    ctx.moveTo(rx-hw*0.15, by-hh);
    ctx.lineTo(rx+hw*0.5, by-hh-roofH);
    ctx.lineTo(rx+hw*1.15, by-hh);
    ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.moveTo(rx-hw*0.2, by-hh);
    ctx.lineTo(rx+hw*0.5, by-hh-roofH*1.08);
    ctx.lineTo(rx+hw*1.2, by-hh);
    ctx.fill();
  }
  ctx.restore();
}

// 소나무 – CW/CH 비율 기반
function drawKoreanPines(scrollX) {
  ctx.save(); ctx.globalAlpha=0.45;
  const pineSpacing = CW * 0.22;
  const pineCount = 5;
  const pw = CW * 0.025;   // 나무 너비 절반
  const trunkH = CH * 0.055;
  const layerH = CH * 0.05;
  for (let i=0; i<pineCount; i++) {
    const baseX = i * pineSpacing + CW*0.05;
    const rx = ((baseX - scrollX*0.6) % (pineSpacing*pineCount+pw*4) + pineSpacing*pineCount+pw*4) % (pineSpacing*pineCount+pw*4) - pw*2;
    const by = GROUND_Y;
    ctx.fillStyle='#2d5a1b';
    // 줄기
    ctx.fillRect(rx+pw*0.6, by-trunkH, pw*0.5, trunkH);
    // 세 층 삼각형
    for (let l=0; l<3; l++) {
      ctx.beginPath();
      ctx.moveTo(rx, by-layerH*0.7-l*layerH);
      ctx.lineTo(rx+pw, by-layerH*2-l*layerH);
      ctx.lineTo(rx+pw*2, by-layerH*0.7-l*layerH);
      ctx.fill();
    }
  }
  ctx.restore();
}

// 등불 – CW/CH 비율 기반
function drawLanterns(scrollX) {
  const glow=0.5+0.5*Math.sin(frameCount*0.06);
  const lanSpacing = CW * 0.25;
  const lanCount = 4;
  const lw = CW * 0.02;  // 등불 너비 절반
  const lh = CH * 0.048; // 등불 높이
  const ropeH = CH * 0.044;
  for (let i=0; i<lanCount; i++) {
    const baseX = i * lanSpacing + CW*0.15;
    const rx = ((baseX - scrollX*0.4) % (lanSpacing*lanCount+lw*4) + lanSpacing*lanCount+lw*4) % (lanSpacing*lanCount+lw*4) - lw*2;
    const ly = GROUND_Y - CH * 0.2;
    // 줄
    ctx.strokeStyle='rgba(180,120,0,0.7)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(rx, ly-ropeH); ctx.lineTo(rx, ly); ctx.stroke();
    // 등불 glow
    ctx.save();
    ctx.shadowColor=`rgba(255,160,0,${glow})`;
    ctx.shadowBlur=18;
    ctx.fillStyle=`rgba(255,${120+Math.round(glow*80)},0,0.85)`;
    ctx.fillRect(rx-lw, ly, lw*2, lh);
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

// ── 레벨클리어 연출 ────────────────────────────
let clearAnim = null; // { timer, nextLevel, addScore }
const CLEAR_DURATION = 150; // 약 2.5초 (60fps 기준)

function startLevelClearAnim(nextLevel, addScore) {
  clearAnim = { timer: CLEAR_DURATION, nextLevel, addScore };
  state = 'levelclear';
  stopBGM();
}

function updateLevelClear(dt) {
  if (!clearAnim) return;
  clearAnim.timer -= dt;
  if (clearAnim.timer <= 0) {
    // 연출 끝 → 다음 레벨로
    score += clearAnim.addScore;
    if (clearAnim.nextLevel <= MAX_LEVEL) {
      level = clearAnim.nextLevel;
      initLevel();
      bannerTimer = BANNER_DURATION;
      state = 'play';
      startBGM();
    } else {
      state = 'win';
      showRankOverlay();
    }
    clearAnim = null;
  }
}

function drawLevelClearAnim() {
  if (!clearAnim) return;
  const t = clearAnim.timer;
  const total = CLEAR_DURATION;
  // 페이드인(처음 20프레임) / 페이드아웃(마지막 30프레임)
  let alpha = 1;
  if (t > total - 20) alpha = (total - t) / 20;
  else if (t < 30)    alpha = t / 30;
  alpha = Math.max(0, Math.min(1, alpha));

  ctx.save();
  ctx.globalAlpha = alpha;

  // 배경 오버레이 (별이 빛나는 느낌)
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, CW, CH);

  // 반짝이는 별 파티클
  const starCount = 18;
  for (let i = 0; i < starCount; i++) {
    const angle = (i / starCount) * Math.PI * 2 + (total - t) * 0.04;
    const dist  = CH * 0.28 + Math.sin((total-t)*0.08 + i) * CH * 0.06;
    const sx    = CW/2 + Math.cos(angle) * dist;
    const sy    = CH/2 + Math.sin(angle) * dist * 0.55;
    const sr    = (2 + (i%3)) * (0.7 + 0.3*Math.sin((total-t)*0.15+i));
    ctx.fillStyle = `hsl(${(i*25+(total-t)*3)%360},100%,80%)`;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill();
  }

  // 고양이 얼굴 (크게, 중앙 위쪽)
  const cx = CW / 2;
  const cy = CH * 0.38;
  const bounce = Math.sin((total - t) * 0.18) * CH * 0.018;
  const faceR  = Math.min(CW, CH) * 0.13;
  ctx.translate(cx, cy + bounce);

  // 얼굴 바탕
  ctx.fillStyle = '#f5a623';
  ctx.beginPath(); ctx.arc(0, 0, faceR, 0, Math.PI*2); ctx.fill();

  // 귀
  ctx.fillStyle = '#f5a623';
  [[-1,1],[1,1]].forEach(([dx]) => {
    ctx.beginPath();
    ctx.moveTo(dx * faceR*0.45, -faceR*0.75);
    ctx.lineTo(dx * faceR*0.88, -faceR*1.25);
    ctx.lineTo(dx * faceR*0.88, -faceR*0.55);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ffb7c5';
    ctx.beginPath();
    ctx.moveTo(dx * faceR*0.50, -faceR*0.78);
    ctx.lineTo(dx * faceR*0.82, -faceR*1.15);
    ctx.lineTo(dx * faceR*0.82, -faceR*0.60);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f5a623';
  });

  // 빨간 목도리
  ctx.fillStyle = '#e94560';
  ctx.beginPath();
  ctx.ellipse(0, faceR*0.82, faceR*0.72, faceR*0.22, 0, 0, Math.PI*2);
  ctx.fill();

  // 눈 (ㅅ 모양 귀여운 눈)
  ctx.strokeStyle = '#333'; ctx.lineWidth = faceR * 0.08;
  ctx.lineCap = 'round';
  [[-1,1],[1,1]].forEach(([dx]) => {
    ctx.beginPath();
    ctx.moveTo(dx * faceR*0.42, -faceR*0.12);
    ctx.quadraticCurveTo(dx * faceR*0.22, -faceR*0.32, dx * faceR*0.05, -faceR*0.12);
    ctx.stroke();
  });

  // 코
  ctx.fillStyle = '#ff8fa3';
  ctx.beginPath(); ctx.ellipse(0, faceR*0.12, faceR*0.1, faceR*0.07, 0, 0, Math.PI*2); ctx.fill();

  // 입 (웃는 표정)
  ctx.strokeStyle = '#c0606a'; ctx.lineWidth = faceR*0.06;
  ctx.beginPath();
  ctx.moveTo(-faceR*0.18, faceR*0.28);
  ctx.quadraticCurveTo(0, faceR*0.44, faceR*0.18, faceR*0.28);
  ctx.stroke();

  // 수염
  ctx.strokeStyle='rgba(150,100,80,0.6)'; ctx.lineWidth=faceR*0.04;
  [[-1],[1]].forEach(([dx])=>{
    ctx.beginPath(); ctx.moveTo(dx*faceR*0.12,-faceR*0.02); ctx.lineTo(dx*faceR*0.72,-faceR*0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx*faceR*0.12, faceR*0.12); ctx.lineTo(dx*faceR*0.72, faceR*0.18); ctx.stroke();
  });

  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;

  // LEVEL CLEAR 텍스트
  const pulse = 1 + 0.06 * Math.sin((total-t) * 0.2);
  ctx.textAlign = 'center';

  ctx.font = `bold ${Math.round(CH*0.072*pulse)}px Arial`;
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 18;
  ctx.fillText('🎉 LEVEL CLEAR! 🎉', CW/2, CH*0.64);

  ctx.shadowBlur = 0;
  ctx.font = `bold ${Math.round(CH*0.048)}px Arial`;
  ctx.fillStyle = '#fff';
  ctx.fillText('유현이 고양이의 모험', CW/2, CH*0.74);

  ctx.font = `${Math.round(CH*0.036)}px Arial`;
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`레벨 ${clearAnim.nextLevel - 1}  →  레벨 ${clearAnim.nextLevel}`, CW/2, CH*0.84);

  ctx.textAlign = 'left';
  ctx.restore();
}

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
  bannerTimer -= (typeof _lastDt !== 'undefined' ? _lastDt : 1);
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

// ── 이어하기 오버레이 ─────────────────────────
function showContinueOverlay() {
  overlay.innerHTML=`
    <h1 style="color:#ffd700;text-shadow:0 0 20px #ffd700;">💀 게임 오버!</h1>
    <p style="font-size:clamp(13px,2vw,18px);">
      레벨 <b style="color:#e94560">${level}</b> &nbsp;|&nbsp; 점수 <b style="color:#ffd700">${score.toLocaleString()}</b>
    </p>
    <p style="font-size:clamp(11px,1.6vw,14px);color:#aaa;margin-top:2px;">
      이어하기: 현재 레벨(${level})부터 생명 10개로 재시작
    </p>
    <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;justify-content:center;">
      <button id="continueBtn" style="padding:10px 26px;font-size:clamp(13px,2vw,17px);background:#e94560;color:#fff;border:none;border-radius:8px;cursor:pointer;">
        ▶ 이어하기 (레벨 ${level})
      </button>
      <button id="restartBtn" style="padding:10px 26px;font-size:clamp(13px,2vw,17px);background:#555;color:#fff;border:none;border-radius:8px;cursor:pointer;">
        🔄 레벨 1부터
      </button>
    </div>
    <button id="rankBtn" style="padding:6px 18px;font-size:12px;background:transparent;color:#aaa;border:1px solid #555;border-radius:8px;cursor:pointer;margin-top:8px;">
      🏆 점수 저장 & 랭킹 보기
    </button>
  `;
  overlay.style.display='flex';

  // 이어하기: 현재 레벨 유지, 점수 유지, 생명만 10개로 충전
  document.getElementById('continueBtn').addEventListener('click', () => {
    lives = 10;
    coinCounter = 0; superTimer = 0;
    initLevel();          // 현재 level 그대로 재초기화
    bannerTimer = BANNER_DURATION;
    updateUI();
    overlay.style.display='none';
    lastTimestamp = null; // dt 리셋 (속도 튐 방지)
    state='play';
    startBGM();
  });

  // 레벨1부터 완전 리셋
  document.getElementById('restartBtn').addEventListener('click', startGame);

  // 점수 저장 & 랭킹
  document.getElementById('rankBtn').addEventListener('click', () => {
    overlay.style.display='none';
    showRankOverlay();
  });
}

function startGame() {
  score=0; lives=10; level=1;
  coinCounter=0; superTimer=0;
  clearAnim=null;
  initLevel();
  bannerTimer=BANNER_DURATION;
  updateUI();
  overlay.style.display='none';
  document.getElementById('rank-overlay').style.display='none';
  lastTimestamp = null; // dt 리셋 (속도 튐 방지)
  state='play';
  startBGM();
}

document.getElementById('startBtn').addEventListener('click',startGame);

// ── 게임 루프 (Delta Time 기반 – 60Hz/90Hz/120Hz 모두 동일 속도) ──
let lastTimestamp = null; // null = 아직 첫 프레임 전
let _lastDt = 1; // bannerTimer 등 draw에서 참조

function loop(timestamp) {
  // 첫 프레임은 dt=1로 시작 (이상한 큰 값 방지)
  let dt = 1;
  if (lastTimestamp !== null) {
    const raw = timestamp - lastTimestamp;
    // 16ms~50ms 사이만 정상 dt, 벗어나면 1.0으로 고정
    dt = (raw >= 8 && raw <= 100) ? raw / (1000 / 60) : 1;
    dt = Math.min(dt, 2.5); // 최대 2.5배로 제한
  }
  lastTimestamp = timestamp;
  _lastDt = dt;

  update(dt);
  draw();
  if (state==='win')  { state='menu'; }
  if (state==='dead') { state='menu'; }
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
