self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// 백그라운드 푸시 알림 표시 이벤트
self.addEventListener('push', (e) => {
  let title = '우사기 호출';
  let body = '친구가 부르고 있어요! (야하-!)';

  if (e.data) {
    try {
      const data = e.data.json();
      title = data.title || title;
      body = data.body || body;
    } catch (err) {
      body = e.data.text();
    }
  }

  const options = {
    body: body,
    icon: './icon.png',
    badge: './icon.png',
    vibrate: [300, 150, 300, 150, 400],
    requireInteraction: true,
    data: { url: './index.html' }
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// 알림창 클릭 시 앱으로 이동
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
