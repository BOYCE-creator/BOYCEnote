importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAISZZEHQSiKCjAN3ACqfgq710mOmpxX_Q",
  authDomain: "usagi-app-23849.firebaseapp.com",
  projectId: "usagi-app-23849",
  storageBucket: "usagi-app-23849.firebasestorage.app",
  messagingSenderId: "127248114864",
  appId: "1:127248114864:web:3bc9001ad7eedf54f20775"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 앱이 꺼져있을 때 백그라운드 푸시 수신 처리
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || '우사기 호출';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || '친구가 부르고 있어요! (야하-!)',
    icon: './icon.png',
    badge: './icon.png',
    vibrate: [300, 150, 300, 150, 400],
    requireInteraction: true,
    data: {
      url: self.registration.scope // 정확한 현재 GitHub Pages 주소로 열기 (404 방지)
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 상단 알림 배너 터치 시 404 없이 앱 창 열기/포커스
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && client.url.includes('BOYCEnote') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
