self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const logoUrl = new URL('logo.png', self.registration.scope).toString();
      const options = {
        body: data.body,
        icon: data.icon || logoUrl,
        badge: data.badge || logoUrl,
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: '2',
          url: data.url || '/dashboard'
        },
        actions: data.actions || []
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    } catch (e) {
      // Fallback for simple text
      event.waitUntil(
        self.registration.showNotification('Fluently', {
          body: event.data.text()
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : new URL('dashboard', self.registration.scope).toString();
  event.waitUntil(
    clients.openWindow(targetUrl)
  );
});
