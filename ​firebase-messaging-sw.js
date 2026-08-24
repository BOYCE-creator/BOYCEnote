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

// 시스템이 알림 배너를 1회 자동 표시하므로 백그라운드에서는 수신 대기만 수행
messaging.onBackgroundMessage((payload) => {
  // OS 시스템 푸시가 배너를 직접 띄웁니다.
});

// 알림 터치 시 앱으로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = 'https://boyce-creator.github.io/BOYCEnote/';

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
