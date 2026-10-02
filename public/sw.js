/* Service worker do Portal de Documentos.
   - Cache de casca (app shell) para abrir sem sinal.
   - Push: mostra o aviso genérico (o texto nunca traz o conteúdo do documento).
   - Background Sync (Android): quando volta o sinal, avisa as abas abertas para
     terminarem os envios guardados no IndexedDB. No iPhone não existe; o app
     mostra "Abra o app para terminar o envio". */
const VERSAO = 'pd-v1';
const CASCA = ['/instalar', '/manifest.webmanifest', '/icone-192.png', '/icone-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // API, downloads e páginas: rede primeiro; cai no cache da casca se offline.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/arquivo/')) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok && (url.pathname.startsWith('/_next/static/') || CASCA.includes(url.pathname) || url.pathname.startsWith('/opencv/'))) {
        const copia = r.clone();
        caches.open(VERSAO).then((c) => c.put(e.request, copia));
      }
      return r;
    }).catch(() => caches.match(e.request).then((c) => c || caches.match('/instalar')))
  );
});
self.addEventListener('push', (e) => {
  let dados = {};
  try { dados = e.data ? e.data.json() : {}; } catch { dados = { body: e.data && e.data.text() }; }
  const titulo = dados.title || 'Portal de Documentos';
  const opcoes = {
    body: dados.body || 'Você tem uma novidade do escritório.',
    icon: '/icone-192.png',
    badge: '/icone-192.png',
    data: { url: dados.url || '/' },
    tag: dados.tag,
  };
  e.waitUntil(self.registration.showNotification(titulo, opcoes));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    for (const c of lista) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
self.addEventListener('sync', (e) => {
  if (e.tag === 'envios-pendentes') {
    e.waitUntil(self.clients.matchAll({ type: 'window' }).then((lista) => {
      lista.forEach((c) => c.postMessage({ tipo: 'sincronizar-envios' }));
    }));
  }
});
