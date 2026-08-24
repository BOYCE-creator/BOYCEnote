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

// 백그라운드 푸시 수신 (아이폰/안드로이드 중복 방지 및 단 1회 표시)
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || '우사기 호출';
  const body = payload.data?.message || '친구가 부르고 있어요! (야하-!)';

  const notificationOptions = {
    body: body,
    icon: './icon.png',
    badge: './icon.png',
    tag: 'usagi-single-call',
    renotify: true,
    vibrate: [300, 150, 300, 150, 400],
    data: {
      url: self.registration.scope
    }
  };

  self.registration.showNotification(title, notificationOptions);
});

// 알림 터치 시 404 없이 앱 페이지로 바로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('BOYCEnote') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
