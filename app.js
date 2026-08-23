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

const STORAGE_PEER_KEY = 'usagi_fixed_my_peer_id';
const STORAGE_LAST_TARGET_KEY = 'usagi_last_target_id';
const STORAGE_CANVAS_KEY = 'usagi_drawing_data';

// 1. 개인 고유 코드 유지
let savedMyId = localStorage.getItem(STORAGE_PEER_KEY);
if (!savedMyId) {
  savedMyId = 'usagi-' + Math.random().toString(36).substring(2, 7);
  localStorage.setItem(STORAGE_PEER_KEY, savedMyId);
}

// 2. 캔버스 초기화 및 저장된 낙서 복원
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
  } catch (e) {
    console.warn('저장 용량 초과', e);
  }
}

// 3. 아이폰 통신사 방화벽 완벽 우회 다중 STUN 서버 설정
function initPeer() {
  if (typeof Peer === 'undefined') {
    setTimeout(initPeer, 300);
    return;
  }

  peer = new Peer(savedMyId, {
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

    const lastTarget = localStorage.getItem(STORAGE_LAST_TARGET_KEY);
    if (lastTarget && lastTarget !== id) {
      targetCodeInput.value = lastTarget;
    }
  });

  peer.on('connection', (c) => {
    setupConnection(c);
  });

  peer.on('error', (err) => {
    console.warn('Peer error:', err);
    statusEl.className = 'status-off';
  });
}

initPeer();

function connectToPeer(targetId) {
  if (!peer || !targetId) {
    alert('친구 코드를 입력해주세요!');
    return;
  }
  if (targetId === peer.id) {
    alert('내 코드가 아닌 친구의 코드를 입력해주세요!');
    return;
  }
  if (conn && conn.open) {
    conn.close();
  }

  localStorage.setItem(STORAGE_LAST_TARGET_KEY, targetId);
  const c = peer.connect(targetId, { reliable: true });
  setupConnection(c);
}

function setupConnection(c) {
  conn = c;

  conn.on('open', () => {
    statusEl.className = 'status-on';
    statusEl.title = '친구와 연결됨!';

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

// 터치 좌표 보정 (아이폰 Safari 전용)
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

window.addEventListener('touchend', (e) => {
  if (isDrawing) {
    isDrawing = false;
    saveCanvasToStorage();
  }
}, { passive: false });

// 마우스 이벤트 (PC)
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

// 팔레트 및 도구
colorDots.forEach(dot => {
  dot.addEventListener('click', () => {
    colorDots.forEach(d => d.classList.remove('active'));
    eraserBtn.classList.remove('active');
    dot.classList.add('active');
    currentColor = dot.dataset.color;
    isEraser = false;
  });
});

eraserBtn.addEventListener('click', () => {
  isEraser = !isEraser;
  eraserBtn.classList.toggle('active', isEraser);
});

clearBtn.addEventListener('click', () => {
  if (confirm('그림을 전부 지울까요? (야하-!)')) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveCanvasToStorage();
    if (conn && conn.open) conn.send({ type: 'clear' });
  }
});

connectBtn.addEventListener('click', () => {
  const target = targetCodeInput.value.trim();
  connectToPeer(target);
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(myCodeEl.innerText);
  alert('친구 코드가 복사되었습니다! (이하-!)');
});
