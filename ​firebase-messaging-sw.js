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

// 앱 꺼졌을 때 백그라운드 푸시 강제 수신 및 배너 표시
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || '우사기 호출';
  const notificationBody = (payload.notification && payload.notification.body) || (payload.data && payload.data.message) || '친구가 부르고 있어요! (야하-!)';

  const notificationOptions = {
    body: notificationBody,
    icon: './icon.png',
    badge: './icon.png',
    tag: 'usagi-single-call', // 동일 태그로 중복 생성 방지
    renotify: true,
    vibrate: [300, 150, 300, 150, 400],
    data: {
      url: 'https://boyce-creator.github.io/BOYCEnote/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 터치 시 앱 페이지로 이동 (404 방지)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || 'https://boyce-creator.github.io/BOYCEnote/';

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
