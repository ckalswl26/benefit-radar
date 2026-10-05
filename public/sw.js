// 혜택 레이더 서비스워커: 알림 표시/클릭 처리
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients[0]
      if (client) return client.focus()
      return self.clients.openWindow(self.registration.scope)
    }),
  )
})
