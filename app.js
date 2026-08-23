// ==========================================
// 🔔 Firebase 웹 푸시(FCM) 초기화 및 토큰 교환
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAISZZEHQSiKCjAN3ACqfg1Y5y8Z3M3e_w",
  authDomain: "usagi-app-23849.firebaseapp.com",
  projectId: "usagi-app-23849",
  storageBucket: "usagi-app-23849.firebasestorage.app",
  messagingSenderId: "127248114864",
  appId: "1:127248114864:web:3bc9001acc39ec1d87e074"
};

const VAPID_KEY = "BKUzFZ84sWlBHGppMXPjN1GbMBZ0GJDArrdKQUCtav5zcDh8BFxThaxWbAmfOMM3ZL49Zs0_mdV7cbjD0FC_Sq4";

firebase.initializeApp(firebaseConfig);
let messaging = null;
let myFcmToken = null;
let peerFcmToken = localStorage.getItem('usagi_partner_fcm_token') || null;

if ('serviceWorker' in navigator && 'PushManager' in window) {
  navigator.serviceWorker.register('firebase-messaging-sw.js').then((registration) => {
    messaging = firebase.messaging();
    
    // 알림 권한 팝업 요청
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
          .then((token) => {
            myFcmToken = token;
          }).catch(console.warn);
      }
    });

    // 화면이 켜져 있을 때 호출 수신 처리
    messaging.onMessage((payload) => {
      playCallAlarm();
      alert('🔔 ' + (payload.notification?.body || '친구가 부르고 있어요! (야하-!)'));
    });
  }).catch(console.warn);
}

// ==========================================
// 캔버스 및 기본 변수
// ==========================================
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const myCodeEl = document.getElementById('myCode');
const targetCodeInput = document.getElementById('targetCode');
const connectBtn = document.getElementById('connectBtn');
const callBtn = document.getElementById('callBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusEl = document.getElementById('status');
const koreaClockEl = document.getElementById('koreaClock');
const colorDots = document.querySelectorAll('.color-dot');
const eraserBtn = document.getElementById('eraserBtn');
const clearBtn = document.getElementById('clearBtn');

let currentColor = '#374151';
let isEraser = false;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

let peer = null;
let conn = null;
let autoReconnectTimer = null;

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

// 사운드 엔진
let audioCtx = null;
const yahaAudio = new Audio('yaha.mp3');

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playCallAlarm() {
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
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (e) {}
}

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
      osc.frequency.setValueAtTime(1200, c.currentTime + 0.13);
      osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.28);
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

const STORAGE_CANVAS_KEY = 'usagi_drawing_data';
const STORAGE_SAVED_PEER_KEY = 'usagi_paired_peer_target';
const STORAGE_SHORT_ID_KEY = 'usagi_clean_short_id_v2';

let myShortId = localStorage.getItem(STORAGE_SHORT_ID_KEY);
if (!myShortId || myShortId.length > 12) {
  myShortId = 'usagi-' + Math.random().toString(36).substring(2, 6);
  localStorage.setItem(STORAGE_SHORT_ID_KEY, myShortId);
}

function initCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (canvas.width === rect.width && canvas.height === rect.height) return;

  const tempImg = canvas.toDataURL();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const savedCanvas = localStorage.getItem(STORAGE_CANVAS_KEY) || tempImg;
  if (savedCanvas && savedCanvas.length > 50) {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = savedCanvas;
  }
}

window.addEventListener('resize', initCanvas);
setTimeout(initCanvas, 100);

function saveCanvasToStorage() {
  try {
    localStorage.setItem(STORAGE_CANVAS_KEY, canvas.toDataURL());
  } catch (e) {}
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

    // 연결 시 내 그림 및 푸시 토큰 전송
    conn.send({
      type: 'sync',
      image: canvas.toDataURL(),
      fcmToken: myFcmToken
    });
  });

  conn.on('data', (data) => {
    if (data.type === 'draw') {
      drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.isEraser, false);
      saveCanvasToStorage();
    } else if (data.type === 'clear') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveCanvasToStorage();
      playYahaSound();
    } else if (data.type === 'call') {
      playCallAlarm();
      alert('🔔 친구가 부르고 있어요! (야하-!)');
    } else if (data.type === 'sync') {
      if (data.fcmToken) {
        peerFcmToken = data.fcmToken;
        localStorage.setItem('usagi_partner_fcm_token', peerFcmToken);
      }
      if (data.image) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          saveCanvasToStorage();
        };
        img.src = data.image;
      }
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
    saveCanvasToStorage();
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
    saveCanvasToStorage();
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
    saveCanvasToStorage();
    if (conn && conn.open) conn.send({ type: 'clear' });
  }
});

connectBtn.addEventListener('click', () => {
  playPopSound();
  const target = targetCodeInput.value.trim();
  connectToPeer(target, false);
});

// 🔔 호출 버튼
callBtn.addEventListener('click', () => {
  playPopSound();
  if (conn && conn.open) {
    conn.send({ type: 'call' });
  }
  alert('친구에게 호출 알림을 보냈어요! (야하-!)');
});

// 내 코드 터치 시 즉시 클립보드 복사
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
