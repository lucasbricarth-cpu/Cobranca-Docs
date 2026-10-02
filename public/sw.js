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
/* Sincronização em segundo plano (Android/Chrome): sobe os envios guardados
   no aparelho que já têm pedido (o resto pede a confirmação do cliente no app). */
self.addEventListener('sync', (e) => {
  if (e.tag === 'envios-pendentes') e.waitUntil(sincronizarEnvios());
});

function abrirIdb() {
  return new Promise((ok, falha) => {
    const r = indexedDB.open('pd-envios', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pendentes', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });
}
function idb(db, modo, fn) {
  return new Promise((ok, falha) => {
    const req = fn(db.transaction('pendentes', modo).objectStore('pendentes'));
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}
async function chamar(url, corpo, token) {
  const h = { 'content-type': 'application/json' };
  if (token) h['x-envio-token'] = token;
  const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(corpo), credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || 'erro');
  return j;
}
async function sincronizarEnvios() {
  const db = await abrirIdb();
  const lista = await idb(db, 'readonly', (s) => s.getAll());
  let enviados = 0;
  for (const p of lista) {
    if (!p.itemId || !p.empresaId || !p.tipoId) continue;
    try {
      const ini = await chamar('/api/envios/iniciar', { nomeOriginal: p.nome, mime: p.mime, itemId: p.itemId }, p.token);
      const put = await fetch(ini.url, { method: 'PUT', headers: ini.cabecalhos, body: p.arquivo });
      if (!put.ok) throw new Error('upload');
      await chamar('/api/envios/' + ini.uploadId + '/analisar', { sensivel: p.sensivel }, p.token);
      await chamar('/api/envios/' + ini.uploadId + '/confirmar', { empresaId: p.empresaId, tipoId: p.tipoId, subtipoId: p.subtipoId, competencia: null }, p.token);
      await idb(db, 'readwrite', (s) => s.delete(p.id));
      enviados++;
    } catch (err) {
      if (!navigator.onLine) throw err; // sem rede: o navegador tenta de novo depois
    }
  }
  const janelas = await self.clients.matchAll({ type: 'window' });
  janelas.forEach((c) => c.postMessage({ tipo: 'envios-sincronizados', enviados }));
}
