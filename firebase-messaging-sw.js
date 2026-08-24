self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// 백그라운드 푸시 수신 시 상단 배너 알림 표출
self.addEventListener('push', (e) => {
  let title = '우사기 호출';
  let message = '친구가 부르고 있어요! (야하-!)';

  if (e.data) {
    try {
      const json = e.data.json();
      title = json.title || title;
      message = json.message || json.body || message;
    } catch (err) {
      message = e.data.text() || message;
    }
  }

  const options = {
    body: message,
    icon: './icon.png',
    badge: './icon.png',
    vibrate: [300, 150, 300, 150, 400],
    requireInteraction: true,
    data: { url: './index.html' }
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// 상단 알림 터치 시 앱 화면으로 이동
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
