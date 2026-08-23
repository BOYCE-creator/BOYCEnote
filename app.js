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

// 캔버스 초기화
function initCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (canvas.width === rect.width && canvas.height === rect.height) return;

  const tempImg = canvas.toDataURL();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = tempImg;
}

window.addEventListener('resize', initCanvas);
setTimeout(initCanvas, 100);

// PeerJS 초기화 (모바일 방화벽 우회 STUN 서버 포함)
function initPeer() {
  if (typeof Peer === 'undefined') {
    setTimeout(initPeer, 300);
    return;
  }

  // 충돌 방지를 위한 랜덤 4자리 ID 생성
  const randomId = 'usagi-' + Math.random().toString(36).substring(2, 6);

  peer = new Peer(randomId, {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  peer.on('open', (id) => {
    myCodeEl.innerText = id;
  });

  // 상대방이 나에게 연결을 걸어왔을 때 (수신 측)
  peer.on('connection', (c) => {
    setupConnection(c);
  });

  peer.on('error', (err) => {
    console.error('Peer error:', err);
    statusEl.className = 'status-off';
    alert('연결 오류가 발생했습니다: ' + err.type);
  });
}

initPeer();

// 내가 상대방에게 연결을 걸 때 (발신 측)
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

  const c = peer.connect(targetId, { reliable: true });
  setupConnection(c);
}

// 연결 이벤트 바인딩
function setupConnection(c) {
  conn = c;

  conn.on('open', () => {
    statusEl.className = 'status-on';
    statusEl.title = '치이카와 친구와 연결됨!';

    // 연결되자마자 내 현재 캔버스 상태 전송
    conn.send({
      type: 'sync',
      image: canvas.toDataURL()
    });
  });

  conn.on('data', (data) => {
    if (data.type === 'draw') {
      drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.isEraser, false);
    } else if (data.type === 'clear') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else if (data.type === 'sync') {
      if (data.image) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

// 터치 이벤트 (모바일)
function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
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
  if (isDrawing) isDrawing = false;
});

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
  if (isDrawing) isDrawing = false;
});

// 도구 모음
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
