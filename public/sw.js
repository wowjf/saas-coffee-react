// Bancho Cafe Web Push & Background Service Worker

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: 'Bancho Cafe',
      body: event.data.text(),
    };
  }

  const title = payload.title || 'Bancho Cafe';
  const options = {
    body: payload.body || 'Sipariş durumunuz güncellendi.',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || 'bancho-order-notification',
    vibrate: [200, 100, 200, 100, 200],
    data: payload.data || { url: '/?tab=orders' },
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/?tab=orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
