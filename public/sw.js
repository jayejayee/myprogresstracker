self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(payload.title || "Task reminder", {
      body: payload.body || "You have a reminder.",
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