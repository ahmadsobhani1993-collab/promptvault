self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? { title: 'PromptsFA', body: 'خبر جدید!' }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.url ?? '/',
      dir: 'rtl',
      lang: 'fa',
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      for (const c of list) if (c.url.includes(url) && 'focus' in c) return c.focus()
      return self.clients.openWindow(url)
    })
  )
})
