// ═══════════════════════════════════════════════════════
//  SW.JS — Service worker de NuveBosque
//
//  Estrategia deliberadamente asimétrica:
//
//   · CÓDIGO (html, css, js) → red primero, caché de respaldo.
//     El juego se sigue arreglando seguido. Si el código fuera cache-first,
//     las mellis podrían quedarse pegadas a una versión vieja y sin forma
//     obvia de salir. Online siempre traen lo último; offline juegan igual.
//
//   · MEDIOS (img, audio) → caché primero, red de respaldo.
//     Son 19 MB que no cambian casi nunca. Se guardan a medida que se usan,
//     así la instalación no se come 19 MB de una y a la segunda partida el
//     juego entra sin internet.
//
//  Subir VERSION invalida todo lo viejo en la próxima visita.
// ═══════════════════════════════════════════════════════

const VERSION      = 'nuvebosque-v2';
const CACHE_CODIGO = VERSION + '-codigo';
const CACHE_MEDIOS = VERSION + '-medios';

// Lo mínimo para que el juego arranque sin red
const SHELL = ['./', './index.html', './styles.css', './manifest.json',
               './img/pwa/icono-192.png', './img/pwa/icono-512.png'];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE_CODIGO)
      .then(c => c.addAll(SHELL))
      .catch(() => {})          // si algo falla, no bloquear la instalación
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const esMedio = url =>
  /\.(png|jpe?g|svg|gif|webp|m4a|mp3|ogg|woff2?)$/i.test(url.pathname) ||
  url.pathname.startsWith('/img/') || url.pathname.startsWith('/audio/');

// cache.put() lanza con respuestas parciales (206) y con las opacas.
// Encapsulado en un solo lugar para no repetir la guardia.
function _guardar(nombre, req, res) {
  if (!res || !res.ok || res.status === 206 || res.type === 'opaque') return;
  const copia = res.clone();
  caches.open(nombre).then(c => c.put(req, copia)).catch(() => {});
}

// Trae el archivo ENTERO (sin Range) y lo guarda, para que la proxima vez
// caches.match() pueda responder aunque el navegador pida por tramos.
function _guardarCompleto(href) {
  return fetch(href).then(res => {
    if (res && res.ok && res.status !== 206) {
      return caches.open(CACHE_MEDIOS).then(c => c.put(href, res));
    }
  }).catch(() => {});
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Sólo lo nuestro. Las fuentes de Google y demás van directo a la red.
  if (url.origin !== self.location.origin) return;

  if (esMedio(url)) {
    // ── Medios: caché primero ──
    //
    // Ojo con el audio: los <audio> piden por tramos (cabecera Range) y el
    // servidor contesta 206. La Cache API RECHAZA guardar un 206, asi que
    // con el camino ingenuo la musica no se cacheaba nunca y el juego
    // quedaba mudo sin internet. Para esos pedidos calentamos la cache
    // aparte, con una peticion completa sin Range.
    ev.respondWith(
      caches.match(req).then(hit => {
        if (hit) return hit;
        if (req.headers.get('range')) {
          ev.waitUntil(_guardarCompleto(url.href));
          return fetch(req);
        }
        return fetch(req).then(res => {
          _guardar(CACHE_MEDIOS, req, res);
          return res;
        });
      })
    );
    return;
  }

  // ── Código: red primero ──
  ev.respondWith(
    fetch(req)
      .then(res => {
        _guardar(CACHE_CODIGO, req, res);
        return res;
      })
      .catch(() => caches.match(req).then(hit =>
        // Sin red y sin caché: si pedían una página, devolver el index
        hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
      ))
  );
});
