importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAISZZEHQSiKCjAN3ACqfg1Y5y8Z3M3e_w",
  authDomain: "usagi-app-23849.firebaseapp.com",
  projectId: "usagi-app-23849",
  storageBucket: "usagi-app-23849.firebasestorage.app",
  messagingSenderId: "127248114864",
  appId: "1:127248114864:web:3bc9001acc39ec1d87e074"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 앱을 닫았거나 화면이 꺼져 있을 때 시스템 상단 푸시 알림 발생
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || '우사기 호출';
  const notificationOptions = {
    body: payload.notification?.body || '친구가 부르고 있어요! (야하-!)',
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
