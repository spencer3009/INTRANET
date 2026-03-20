/* eslint-disable no-restricted-globals */

// Wrap importScripts in try-catch to prevent SW registration failures
try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "AIzaSyCGG2RZtz7PbdJw5QewBl15qKDyibHIAVc",
    authDomain: "edunet-b38ce.firebaseapp.com",
    projectId: "edunet-b38ce",
    storageBucket: "edunet-b38ce.firebasestorage.app",
    messagingSenderId: "608156581464",
    appId: "1:608156581464:web:9746b5e1761bdf6185942d",
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const notification = payload.notification || {};
    const title = notification.title || "EduNet";
    const body = notification.body || "Tienes una nueva notificacion";

    self.registration.showNotification(title, {
      body: body,
      icon: "/logo192.png",
      badge: "/logo192.png",
      tag: `attendance-${data.student_id}-${data.type}`,
      data: {
        student_id: data.student_id,
        type: data.type,
        notification_id: data.notification_id,
        url: data.student_id ? `/parent/dashboard?student=${data.student_id}` : "/parent/dashboard",
      },
    });
  });
} catch (e) {
  console.warn("[Firebase SW] Failed to initialize:", e.message);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlPath = event.notification.data?.url || "/parent/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(urlPath);
          return;
        }
      }
      return clients.openWindow(urlPath);
    })
  );
});
