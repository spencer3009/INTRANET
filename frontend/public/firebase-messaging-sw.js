// firebase-messaging-sw.js — DEPRECATED
// Firebase Messaging logic has been merged into /service-worker.js via importScripts.
// This file self-unregisters to free the scope for the main PWA service worker.
// Clients that cached this SW will auto-migrate on their next visit.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    const allClients = await self.clients.matchAll();
    allClients.forEach((c) => c.navigate(c.url));
  })());
});
