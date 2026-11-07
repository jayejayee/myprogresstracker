self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Task reminder", {
      body: payload.body || "You have a reminder.",
      icon: "/opengraph-image.png",
      badge: "/opengraph-image.png",
      data: { url: payload.url || "/protected" },
      tag: payload.tag || "task-reminder",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/protected", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === target);
      return existing ? existing.focus() : self.clients.openWindow(target);
    }),
  );
});