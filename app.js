// ==========================================
// 캔버스 및 피어 통신 기본 변수
// ==========================================
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const myCodeEl = document.getElementById('myCode');
const targetCodeInput = document.getElementById('targetCode');
const connectBtn = document.getElementById('connectBtn');
const callBtn = document.getElementById('callBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusEl = document.getElementById('status');
const colorDots = document.querySelectorAll('.color-dot');
const eraserBtn = document.getElementById('eraserBtn');
const clearBtn = document.getElementById('clearBtn');
const koreaClockEl = document.getElementById('koreaClock');

let currentColor = '#374151';
let isEraser = false;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

let peer = null;
let conn = null;
let autoReconnectTimer = null;

const STORAGE_CANVAS_KEY = 'usagi_drawing_data_final';
const STORAGE_TIME_KEY = 'usagi_drawing_time_final';
const STORAGE_SAVED_PEER_KEY = 'usagi_paired_peer_target';
const STORAGE_SHORT_ID_KEY = 'usagi_clean_short_id_v2';

// 🔔 Cloudflare 푸시 중계 및 Firebase 설정
const PUSH_RELAY_SERVER_URL = 'https://solitary-king-dcc3.swc4876.workers.dev/';
const firebaseConfig = {
  apiKey: "AIzaSyAISZZEHQSiKCjAN3ACqfgq710mOmpxX_Q",
  authDomain: "usagi-app-23849.firebaseapp.com",
  projectId: "usagi-app-23849",
  storageBucket: "usagi-app-23849.firebasestorage.app",
  messagingSenderId: "127248114864",
  appId: "1:127248114864:web:3bc9001ad7eedf54f20775"
};
const VAPID_KEY = "BKUzFZ84sWlBHGppMXPjN1GbMBZ0GJDArrdKQUCtav5zcDh8BFxThaxWbAmfOMM3ZL49Zs0_mdV7cbjD0FC_Sq4";

let myFcmToken = localStorage.getItem('usagi_my_fcm_token') || null;
let peerFcmToken = localStorage.getItem('usagi_partner_fcm_token') || null;
let swRegistration = null;

// 실시간 한국 시간 타이머
function updateKoreaTime() {
  if (!koreaClockEl) return;
  const now = new Date();
  koreaClockEl.innerText = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(now);
}
setInterval(updateKoreaTime, 1000);
updateKoreaTime();

// 사운드 엔진 (지우기: yaha.mp3 / 호출: call.mp3)
let audioCtx = null;
const yahaAudio = new Audio('./yaha.mp3');
const callAudio = new Audio('./call.mp3');
callAudio.preload = 'auto';
yahaAudio.preload = 'auto';

document.addEventListener('touchstart', () => {
  callAudio.load();
  yahaAudio.load();
}, { once: true });

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// 🔔 호출 효과음 (call.mp3)
function playCallAlarm() {
  callAudio.currentTime = 0;
  const p = callAudio.play();
  if (p !== undefined) {
    p.catch(() => {
      try {
        const c = getAudioContext();
        const notes = [659.25, 523.25, 659.25, 523.25];
        notes.forEach((freq, idx) => {
          const osc = c.createOscillator();
          const gain = c.createGain();
          const startTime = c.currentTime + idx * 0.15;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.2, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.35);
        });
      } catch (e) {}
    });
  }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
}

// 🐰 지우기 사운드 (yaha.mp3)
function playYahaSound() {
  yahaAudio.currentTime = 0;
  yahaAudio.play().catch(() => {
    try {
      const c = getAudioContext();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1450, c.currentTime + 0.12);
      gain.gain.setValueAtTime(0.22, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.28);
    } catch (e) {}
  });
}

function playPopSound() {
  try {
    const c = getAudioContext();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.08);
  } catch (e) {}
}

function playConnectSound() {
  try {
    const c = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const startTime = c.currentTime + idx * 0.07;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  } catch (e) {}
}

function playCopySound() {
  try {
    const c = getAudioContext();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, c.currentTime);
    osc.frequency.setValueAtTime(900, c.currentTime + 0.06);
    gain.gain.setValueAtTime(0.15, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.15);
  } catch (e) {}
}

// 캔버스 초기화
function initCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const savedCanvas = localStorage.getItem(STORAGE_CANVAS_KEY);
  if (savedCanvas && savedCanvas.length > 100) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = savedCanvas;
  }
}

window.addEventListener('resize', initCanvas);
setTimeout(initCanvas, 150);

// 그림 및 수정 시각 동시 저장
function saveCanvasToStorage() {
  try {
    const dataUrl = canvas.toDataURL();
    const now = Date.now();
    localStorage.setItem(STORAGE_CANVAS_KEY, dataUrl);
    localStorage.setItem(STORAGE_TIME_KEY, now.toString());
    return { dataUrl, time: now };
  } catch (e) {
    return { dataUrl: null, time: Date.now() };
  }
}

// Peer ID 생성 및 초기화
let myShortId = localStorage.getItem(STORAGE_SHORT_ID_KEY);
if (!myShortId || myShortId.length > 12) {
  myShortId = 'usagi-' + Math.random().toString(36).substring(2, 6);
  localStorage.setItem(STORAGE_SHORT_ID_KEY, myShortId);
}

function initPeer() {
  if (typeof Peer === 'undefined') {
    setTimeout(initPeer, 300);
    return;
  }

  peer = new Peer(myShortId, {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  });

  peer.on('open', (id) => {
    myCodeEl.innerText = id;
    const savedTarget = localStorage.getItem(STORAGE_SAVED_PEER_KEY);
    if (savedTarget && savedTarget !== id) {
      targetCodeInput.value = savedTarget;
      tryAutoConnect(savedTarget);
    }
  });

  peer.on('connection', (c) => {
    localStorage.setItem(STORAGE_SAVED_PEER_KEY, c.peer);
    targetCodeInput.value = c.peer;
    bindConnectionEvents(c);
  });

  peer.on('error', (err) => {
    console.warn('Peer error:', err.type);
    statusEl.className = 'status-off';
  });

  peer.on('disconnected', () => {
    peer.reconnect();
  });
}

initPeer();

function tryAutoConnect(targetId) {
  if (conn && conn.open) return;
  connectToPeer(targetId, true);

  clearInterval(autoReconnectTimer);
  autoReconnectTimer = setInterval(() => {
    const savedTarget = localStorage.getItem(STORAGE_SAVED_PEER_KEY);
    if (!savedTarget) {
      clearInterval(autoReconnectTimer);
      return;
    }
    if (!conn || !conn.open) {
      connectToPeer(savedTarget, true);
    }
  }, 4000);
}

function connectToPeer(targetId, isAuto = false) {
  if (!peer || !peer.id) return;
  if (!targetId) {
    if (!isAuto) alert('친구 코드를 입력해주세요!');
    return;
  }
  if (targetId === peer.id) {
    if (!isAuto) alert('본인 코드가 아닌 친구 코드를 입력해주세요!');
    return;
  }

  localStorage.setItem(STORAGE_SAVED_PEER_KEY, targetId);
  if (conn && conn.open) return;

  const c = peer.connect(targetId, { reliable: true });
  bindConnectionEvents(c);
}

function bindConnectionEvents(c) {
  conn = c;

  conn.on('open', () => {
    statusEl.className = 'status-on';
    statusEl.title = '친구와 연결됨!';
    playConnectSound();

    const currentDrawing = localStorage.getItem(STORAGE_CANVAS_KEY);
    const myLastTime = parseInt(localStorage.getItem(STORAGE_TIME_KEY) || '0', 10);

    // 연결 시 내 그림과 최종 수정 시각을 함께 전송
    conn.send({
      type: 'sync_init',
      image: currentDrawing,
      updatedAt: myLastTime,
      fcmToken: myFcmToken
    });
  });

  conn.on('data', (data) => {
    if (data.type === 'draw') {
      drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.isEraser, false);
      saveCanvasToStorage();
    } else if (data.type === 'sync_init' || data.type === 'sync_full') {
      if (data.fcmToken) {
        peerFcmToken = data.fcmToken;
        localStorage.setItem('usagi_partner_fcm_token', peerFcmToken);
      }

      const myLastTime = parseInt(localStorage.getItem(STORAGE_TIME_KEY) || '0', 10);
      const peerTime = data.updatedAt || 0;

      // 상대방이 더 최근에 작업했거나 내가 그린 게 없으면 상대방 그림으로 덮어씀
      if (peerTime >= myLastTime) {
        if (data.image) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            localStorage.setItem(STORAGE_CANVAS_KEY, data.image);
            localStorage.setItem(STORAGE_TIME_KEY, peerTime.toString());
          };
          img.src = data.image;
        }
      } else {
        // 내가 더 최근에 그렸다면(혼자 지우고 새로 그림), 내 그림을 상대방에게 강제 덮어쓰기 요청
        const myDrawing = localStorage.getItem(STORAGE_CANVAS_KEY);
        conn.send({
          type: 'sync_full',
          image: myDrawing,
          updatedAt: myLastTime
        });
      }
    } else if (data.type === 'clear') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveCanvasToStorage();
      playYahaSound();
    } else if (data.type === 'call') {
      playCallAlarm();
    }
  });

  conn.on('close', () => {
    statusEl.className = 'status-off';
    statusEl.title = '연결 대기 중';
    conn = null;
  });

  conn.on('error', () => {
    statusEl.className = 'status-off';
  });
}

function drawLine(x0, y0, x1, y1, color, size, eraser, emit = true) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size;

  if (eraser) {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
  }

  const startX = x0 * canvas.width;
  const startY = y0 * canvas.height;
  const endX = x1 * canvas.width;
  const endY = y1 * canvas.height;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();

  if (emit && conn && conn.open) {
    conn.send({
      type: 'draw',
      x0, y0, x1, y1,
      color,
      size,
      isEraser: eraser
    });
  }
}

function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0] || e.changedTouches[0];
  return {
    x: (touch.clientX - rect.left) / canvas.width,
    y: (touch.clientY - rect.top) / canvas.height
  };
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isDrawing = true;
  const pos = getTouchPos(e);
  lastX = pos.x;
  lastY = pos.y;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!isDrawing) return;
  const pos = getTouchPos(e);
  const size = isEraser ? 24 : 4;
  drawLine(lastX, lastY, pos.x, pos.y, currentColor, size, isEraser, true);
  lastX = pos.x;
  lastY = pos.y;
}, { passive: false });

window.addEventListener('touchend', () => {
  if (isDrawing) {
    isDrawing = false;
    const { dataUrl, time } = saveCanvasToStorage();
    if (conn && conn.open && dataUrl) {
      conn.send({ type: 'sync_full', image: dataUrl, updatedAt: time });
    }
  }
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  lastX = (e.clientX - rect.left) / canvas.width;
  lastY = (e.clientY - rect.top) / canvas.height;
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const curX = (e.clientX - rect.left) / canvas.width;
  const curY = (e.clientY - rect.top) / canvas.height;
  const size = isEraser ? 24 : 4;
  drawLine(lastX, lastY, curX, curY, currentColor, size, isEraser, true);
  lastX = curX;
  lastY = curY;
});

window.addEventListener('mouseup', () => {
  if (isDrawing) {
    isDrawing = false;
    const { dataUrl, time } = saveCanvasToStorage();
    if (conn && conn.open && dataUrl) {
      conn.send({ type: 'sync_full', image: dataUrl, updatedAt: time });
    }
  }
});

colorDots.forEach(dot => {
  dot.addEventListener('click', () => {
    playPopSound();
    colorDots.forEach(d => d.classList.remove('active'));
    eraserBtn.classList.remove('active');
    dot.classList.add('active');
    currentColor = dot.dataset.color;
    isEraser = false;
  });
});

eraserBtn.addEventListener('click', () => {
  playPopSound();
  isEraser = !isEraser;
  eraserBtn.classList.toggle('active', isEraser);
});

clearBtn.addEventListener('click', () => {
  if (confirm('그림을 전부 지울까요? (야하-!)')) {
    playYahaSound();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { dataUrl, time } = saveCanvasToStorage();
    if (conn && conn.open) conn.send({ type: 'clear', updatedAt: time });
  }
});

connectBtn.addEventListener('click', () => {
  playPopSound();
  const target = targetCodeInput.value.trim();
  connectToPeer(target, false);
});

// 🔔 호출 버튼 (P2P + 백그라운드 푸시)
callBtn.addEventListener('click', async () => {
  playPopSound();

  if (conn && conn.open) {
    conn.send({ type: 'call' });
  }

  const targetToken = peerFcmToken || localStorage.getItem('usagi_partner_fcm_token');
  if (targetToken) {
    try {
      fetch(PUSH_RELAY_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetToken: targetToken,
          title: '우사기 호출',
          message: '친구가 부르고 있어요! (야하-!)'
        })
      });
    } catch (e) {}
  }

  alert('친구에게 호출 알림을 보냈어요! (야하-!)');
});

myCodeEl.addEventListener('click', () => {
  playCopySound();
  navigator.clipboard.writeText(myCodeEl.innerText);
  alert('내 코드가 복사되었습니다! (이하-!)');
});

disconnectBtn.addEventListener('click', () => {
  playPopSound();
  if (confirm('친구와의 연결을 끊을까요?')) {
    localStorage.removeItem(STORAGE_SAVED_PEER_KEY);
    localStorage.removeItem('usagi_partner_fcm_token');
    clearInterval(autoReconnectTimer);
    if (conn) {
      conn.close();
      conn = null;
    }
    statusEl.className = 'status-off';
    targetCodeInput.value = '';
    alert('연결이 해제되었습니다.');
  }
});

// Firebase 초기화
try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    firebase.initializeApp(firebaseConfig);
  }
} catch (e) {}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' })
    .then((reg) => {
      swRegistration = reg;
    }).catch(console.warn);
}

// 시계 터치 시 알림 권한 획득 & 고유 토큰 발급
if (koreaClockEl) {
  koreaClockEl.addEventListener('click', async () => {
    playPopSound();

    if (!('Notification' in window)) {
      alert('이 브라우저는 알림을 지원하지 않습니다.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        if (typeof firebase !== 'undefined' && firebase.messaging) {
          const reg = await navigator.serviceWorker.ready;
          const messaging = firebase.messaging();
          const token = await messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: reg
          });
          if (token) {
            myFcmToken = token;
            localStorage.setItem('usagi_my_fcm_token', myFcmToken);
            if (conn && conn.open) {
              const myLastTime = parseInt(localStorage.getItem(STORAGE_TIME_KEY) || '0', 10);
              conn.send({ type: 'sync_full', image: localStorage.getItem(STORAGE_CANVAS_KEY), updatedAt: myLastTime, fcmToken: myFcmToken });
            }
          }
        }
        alert('🔔 알림이 정상적으로 켜졌습니다!');
      } else {
        alert('알림 권한이 거부되었습니다. 브라우저/기기 설정에서 허용해 주세요.');
      }
    } catch (err) {
      alert('알림 등록 완료');
    }
  });
}
