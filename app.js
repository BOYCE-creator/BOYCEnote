const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const myCodeEl = document.getElementById('myCode');
const targetCodeInput = document.getElementById('targetCode');
const connectBtn = document.getElementById('connectBtn');
const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');
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

// ==========================================
// 🎵 효과음 & 보이스 엔진
// ==========================================
let audioCtx = null;
const yahaAudio = new Audio('yaha.mp3');

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
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

// ==========================================
// 캔버스 초기화 및 로컬 저장소 복원
// ==========================================
const STORAGE_CANVAS_KEY = 'usagi_drawing_data';
const STORAGE_LAST_TARGET_KEY = 'usagi_last_target_id';

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

// ==========================================
// 🚀 충돌 방지 및 연결 복구 PeerJS 코어
// ==========================================
function initPeer() {
  if (typeof Peer === 'undefined') {
    setTimeout(initPeer, 300);
    return;
  }

  // 매 접속 시 서버 충돌(ID 중복 잠김)을 막기 위해 신규 고유 ID 자동 발급
  peer = new Peer({
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

    // 이전에 연결했던 친구 코드가 있다면 입력창에 자동 입력
    const lastTarget = localStorage.getItem(STORAGE_LAST_TARGET_KEY);
    if (lastTarget && lastTarget !== id) {
      targetCodeInput.value = lastTarget;
    }
  });

  // 상대방이 나에게 연결을 걸었을 때 (수신)
  peer.on('connection', (c) => {
    bindConnectionEvents(c);
  });

  peer.on('error', (err) => {
    console.warn('Peer error:', err.type);
    statusEl.className = 'status-off';
  });

  // 서버 연결이 끊겼을 때 자동 재접속
  peer.on('disconnected', () => {
    peer.reconnect();
  });
}

initPeer();

// 연결 버튼 클릭 시 (발신)
function connectToPeer(targetId) {
  if (!peer || !peer.id) {
    alert('내 코드를 아직 불러오는 중입니다. 1초 뒤 다시 시도해주세요.');
    return;
  }
  if (!targetId) {
    alert('친구 코드를 입력해주세요!');
    return;
  }
  if (targetId === peer.id) {
    alert('본인 코드가 아닌 친구의 코드를 입력해주세요!');
    return;
  }

  localStorage.setItem(STORAGE_LAST_TARGET_KEY, targetId);

  // 기존 연결 정리 후 신규 연결
  if (conn) {
    conn.close();
  }

  const c = peer.connect(targetId, { reliable: true });
  bindConnectionEvents(c);
}

// 양방향 데이터 핸들러
function bindConnectionEvents(c) {
  conn = c;

  conn.on('open', () => {
    statusEl.className = 'status-on';
    statusEl.title = '친구와 연결됨!';
    playConnectSound();

    // 연결 직후 내 화면의 그림을 상대방에게 동기화 전송
    conn.send({
      type: 'sync',
      image: canvas.toDataURL()
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
    } else if (data.type === 'sync') {
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
    statusEl.title = '연결 끊김';
    conn = null;
  });

  conn.on('error', (e) => {
    console.warn('Conn error:', e);
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

// ==========================================
// 터치 및 마우스 이벤트 (iOS Safari 최적화)
// ==========================================
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

// 도구 모음 이벤트 바인딩
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
  connectToPeer(target);
});

copyBtn.addEventListener('click', () => {
  playCopySound();
  navigator.clipboard.writeText(myCodeEl.innerText);
  alert('친구 코드가 복사되었습니다! (이하-!)');
});
