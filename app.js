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

let currentColor = '#ffffff';
let isEraser = false;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

let peer = null;
let conn = null;

// 캔버스 크기 맞춤 (선명도 유지)
function initCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
window.addEventListener('resize', initCanvas);
setTimeout(initCanvas, 100);

// P2P 초기화
const myId = Math.random().toString(36).substring(2, 7);
peer = new Peer(myId);

peer.on('open', (id) => {
  myCodeEl.innerText = id;
});

peer.on('connection', (c) => {
  setupConnection(c);
});

function setupConnection(c) {
  conn = c;
  conn.on('open', () => {
    statusEl.className = 'status-on';
  });
  conn.on('data', (data) => {
    if (data.type === 'draw') {
      drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.isEraser, false);
    } else if (data.type === 'clear') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });
  conn.on('close', () => {
    statusEl.className = 'status-off';
    conn = null;
  });
}

// 그리기 로직 (비율 기반 상대 좌표 전송으로 폰 화면 크기 달라도 일치)
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

  // 로컬 픽셀 좌표로 변환
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

// 터치 이벤트 핸들러
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

window.addEventListener('touchend', () => { isDrawing = false; });

// 마우스 지원 (PC 테스트용)
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

window.addEventListener('mouseup', () => { isDrawing = false; });

// 팔레트 컨트롤
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (conn && conn.open) conn.send({ type: 'clear' });
});

connectBtn.addEventListener('click', () => {
  const target = targetCodeInput.value.trim();
  if (!target || target === peer.id) return;
  const c = peer.connect(target);
  setupConnection(c);
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(myCodeEl.innerText);
  alert('내 코드가 복사되었습니다.');
});
