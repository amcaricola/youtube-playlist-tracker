# PLAN DE TRABAJO — YouTube Playlist Tracker

Este plan de trabajo detalla las fases de desarrollo, hitos técnicos, requerimientos y estado de las tareas para la implementación completa del sistema **YouTube Playlist Tracker**.

---

## 📊 Resumen del Proyecto

- **Objetivo**: Crear una solución integral que permita respaldar metadatos parseados de playlists de YouTube (artista, canción, ID, estado) en un archivo JSON local en el servidor, monitorear periódicamente la disponibilidad de los videos y permitir la recuperación/reemplazo directo de canciones eliminadas mediante OAuth 2.0.
- **Backend**: Hono JS (TypeScript) + Almacenamiento JSON seguro (sin bases de datos).
- **Frontend**: Single Page Application (SPA) con Preact + Vite + Tailwind CSS.
- **Seguridad**: Autenticación de Super Usuario único con contraseña maestra, tokens de sesión de 30 días revocables y botón "Block All Sessions".

---

## 🗺️ Fases de Desarrollo

### 🟢 Fase 1: Configuración Inicial del Entorno y Estructura
- [x] **1.1** Inicializar estructura de carpetas (`/server`, `/client`, `/data`).
- [x] **1.2** Configurar `package.json` raíz con scripts unificados para desarrollo y producción (`npm run dev`, `npm run build`, `npm run start`).
- [x] **1.3** Configurar proyecto backend con Hono JS y TypeScript.
- [x] **1.4** Configurar proyecto frontend con Preact, Vite y Tailwind CSS.
- [x] **1.5** Configurar variables de entorno (`.env.example`) para credenciales de YouTube API, OAuth y Master Password.

---

### 🟢 Fase 2: Backend — Núcleo de Seguridad y Persistencia JSON
- [x] **2.1** **Servicio de Almacenamiento JSON (`storage.service.ts`)**:
  - Implementar lectura y escritura atómica con archivos temporales y renombrado para evitar corrupción de datos.
  - Gestión de `data/config.json`, `data/sessions.json` y `data/playlists.json`.
- [x] **2.2** **Módulo de Autenticación de Super Usuario (`auth.service.ts` / `auth.routes.ts`)**:
  - Verificación de contraseña maestra con hash seguro (`bcrypt` / `argon2` / WebCrypto).
  - Emisión de tokens de sesión con 30 días de caducidad.
  - Registro de tokens activos en `sessions.json`.
  - Endpoint para "Block All Sessions" (revocación global inmediata).
- [x] **2.3** **Middleware de Seguridad (`auth.middleware.ts`)**:
  - Validación de Bearer Token en todas las rutas protegidas.

---

### 🟢 Fase 3: Backend — Integración con YouTube API y Parser de Metadatos
- [x] **3.1** **Módulo OAuth 2.0 y API Key de YouTube (`youtube.service.ts`)**:
  - Flujo de autenticación OAuth para obtener tokens de acceso y refresco del super usuario (permisos para modificar playlists: `https://www.googleapis.com/auth/youtube`).
  - Almacenamiento seguro del refresh token en `config.json`.
- [x] **3.2** **Motor de Parseo de Títulos y Artistas (`parser.service.ts`)**:
  - Algoritmo de extracción y limpieza inteligente para separar artista y canción de títulos típicos de YouTube (remoción de `[Official Video]`, `(HD)`, `feat.`, etc.).
  - Normalización de metadatos propios de la app para cumplimiento de ToS.
- [x] **3.3** **Servicio de Importación y Lectura de Playlists**:
  - Endpoint para importar playlist por URL o ID (`GET/POST /api/playlists/import`).
  - Paginación y extracción completa de items de la playlist vía YouTube Data API.

---

### 🟢 Fase 4: Backend — Monitoreo de Estado y Motor de Recuperación
- [x] **4.1** **Verificación de Estado en Lotes (`sync.service.ts`)**:
  - Comprobación de disponibilidad de videos (`videos.list`) en lotes de hasta 50 IDs para ahorro de cuota.
  - Detección de videos eliminados, privados o restringidos.
  - Marcado de estado (`active`, `unavailable`, `deleted`, `private`) y timestamp de `lastCheckedAt`.
  - Tarea periódica / endpoint de refresco diario (respetando límite de 24 horas por canción).
- [x] **4.2** **Búsqueda de Reemplazos (`GET /api/youtube/search`)**:
  - Búsqueda en YouTube API utilizando los metadatos conservados (`[Artista] - [Canción]`).
- [x] **4.3** **Reemplazo y Mutación de la Playlist (`POST /api/playlists/replace-track`)**:
  - Inserción del nuevo video seleccionado en la playlist del usuario vía YouTube API.
  - Eliminación del item dañado de la playlist en YouTube.
  - Actualización del registro local en `playlists.json`.

---

### 🟢 Fase 5: Frontend — Interfaz SPA con Preact y Tailwind CSS
- [x] **5.1** **Arquitectura Base y Enrutamiento**:
  - Configuración de estado global / Context para autenticación y estado de sesión.
  - Cliente API con interceptor para adjuntar token de `localStorage`.
- [x] **5.2** **Vista de Login (Super Usuario)**:
  - Formulario de acceso por contraseña maestra.
  - Manejo de token, expiración y redirección.
- [x] **5.3** **Panel Principal (Dashboard)**:
  - Cabecera con estado de conexión, estado de OAuth de YouTube y botón de "Cerrar todas las sesiones".
  - Barra de importación de playlist mediante URL o ID.
  - Selector / resumen de playlists gestionadas.
- [x] **5.4** **Lista de Canciones y Componentes de Item**:
  - Visualización en modo lista/tarjeta con thumbnail, título, artista, estado y fecha de revisión.
  - **Acción Hover**: Botón directo "Reproducir" que abre el enlace en YouTube.
  - Indicador visual claro (badge rojo/alerta) para items dañados o eliminados.
- [x] **5.5** **Sistema de Filtros y Búsqueda**:
  - Buscador reactivo por texto (nombre de canción o artista).
  - Selector desplegable (Dropdown) de Artistas dinámico con la lista única de artistas para filtrar la vista.
- [x] **5.6** **Modal de Recuperación / Reemplazo de Canción**:
  - Modal interactivo que se activa con el botón "Recuperar canción dañada".
  - Búsqueda automática y lista de resultados con opciones de previsualización.
  - Confirmación de reemplazo con retroalimentación instantánea.

---

### 🟢 Fase 6: Pruebas, Optimización y Pulido
- [x] **6.1** Pruebas de borde: playlists grandes (+200 canciones), títulos atípicos, videos eliminados sin metadatos en YouTube. (Parser validado con títulos atípicos; verificación por lotes de 50.)
- [x] **6.2** Verificación de revocación y expiración de tokens (30 días). (Flujo probado: login → token válido → block-all → token rechazado.)
- [x] **6.3** Modo Oscuro / Pulido visual con Tailwind CSS y accesibilidad. (Dark mode por defecto.)
- [x] **6.4** Documentación de despliegue y puesta en marcha en `README.md`.

---

## 📌 Pendientes para siguiente sesión
- Probar integración real con una playlist (API key + OAuth) en `server/.env`.
- Opcional: "Verificar" manual por canción (desde el badge `unknown`) reutilizando el RecoveryModal para búsqueda sin reemplazo.
- Opcional: estado "restringido/embebible" diferenciado de "no disponible".

---

## 📌 Notas de evolución (sesiones posteriores)
- Servidor sirve la web construida en `/` (SPA fallback) además de la API.
- OAuth se inicia desde la web (popup) y notifica al padre vía `postMessage`; con OAuth conectado la API key es opcional.
- Edición de "nuestros datos" (artista/título) por canción: `PATCH /api/playlists/:id/tracks/:trackId`.
- Eliminación de canciones dañadas de la playlist real (OAuth) y del registro local: `DELETE /api/playlists/:id/tracks/:trackId` y bulk `POST /api/playlists/:id/remove-damaged`.
- Paginación de 100 en la lista; filtros con limpieza (X); filtro "Solo dañadas"; filtro de artista con autocompletado (3 sugerencias).
- Videos eliminados antes de la importación llegan como "Deleted video" (YouTube no devuelve título original): el usuario los edita (✏️) o los borra.
- **Anti fuerza bruta en login**: tras 5 intentos fallidos el cliente queda bloqueado 15 minutos (HTTP 429).
- **Sincronizar estructura** (`POST /api/playlists/:id/sync-structure`): importa canciones nuevas añadidas directamente en YouTube sin pisar datos existentes y actualiza posiciones.
- **Backup/restauración**: `GET /api/playlists/export` descarga el JSON completo (botón "⬇ Backup"); `POST /api/playlists/import-backup` restaura desde un archivo guardando copia previa (`playlists.json.bak-<ts>`) (botón "⬆ Restaurar").
- **Edición masiva de artista**: selección por checkboxes + barra "Aplicar artista" (`POST /api/playlists/:id/tracks/bulk`) para unificar variantes del mismo artista.
- **Detección de duplicados**: badge "Duplicada" por título normalizado (posibles covers) + filtro "Solo duplicadas". El usuario decide editar el artista o borrar.
- **Cumplimiento de ToS (YouTube API / Developer Policies / Google APIs)**: footer con enlace a los Términos de YouTube y Política de Privacidad de Google + declaración de que artista/canción son datos propios; "Desconectar OAuth" ahora revoca el token en Google (`POST oauth2.googleapis.com/revoke`) con confirmación del usuario.
- **UI v2**: lista en filas con encabezado sticky (columnas fijas → sin corrimiento de artistas), check y edición solo en hover (espacio reservado), color de resaltado azul (rojo solo en acciones destructivas/estado dañado), sort por título/artista (asc/desc/none), duplicados por título+artista (evita marcar covers de distintos artistas) + botón "Verificar duplicados", importación vía modal, y menú de usuario (👤) con sesiones/block-all/backup/restaurar.
- **Estado "Fuera de playlist"** (`out_of_playlist`): `sync-structure` ahora compara la estructura local con los items reales de YouTube; los tracks cuyo item ya no existe se marcan como `out_of_playlist` (y los re-agregados vuelven a `active`). El usuario puede borrarlos del registro local (sin requerir OAuth) o recuperarlos/reemplazarlos.
- **"Privada" y "Fuera de playlist" se tratan como dañadas**: `isDamaged` (server + cliente) incluye `private` y `out_of_playlist`; entran al filtro "Solo dañadas", muestran botón Recuperar y se borran de `removeDamagedTracks` (los `out_of_playlist` no necesitan OAuth).
- **Tarjeta de playlist**: botón "reproducir playlist en YouTube" (ícono de compartir, siempre visible) + tuerca de "Gestión de playlist" (visible en hover) que abre modal con "Sincronizar playlist", "Verificar estados" y "Eliminar playlist" (con confirmación). Esos dos botones se quitaron de la barra superior.
- **Modal de edición de canción**: ya no cierra al hacer clic fuera, funciona como formulario (Enter guarda), orden de inputs Título → Artista, y si la canción es duplicada ofrece botón "Eliminar de la playlist".
- **Tarjeta de playlist (refinamiento)**: se eliminó la "✕" de eliminar de la tarjeta (el borrado vive solo en el modal de gestión); el botón "Ir a playlist en YouTube" ahora es azul resaltante (bg-blue-600) con ícono de play dentro de círculo.
- **Red dots en filtros**: los botones "Solo dañadas" y "Solo duplicadas" muestran un punto rojo (estilo notificación) cuando hay canciones dañadas o duplicadas en la playlist seleccionada.
- **Refinamiento filtros UI v3**: se eliminó el botón "Verificar duplicados" (la detección es reactiva por `useMemo`, el botón solo mostraba un toast). Los toggles "Solo dañadas" y "Solo duplicadas" se movieron a la cabecera de la playlist (zona del antiguo botón) y solo se muestran cuando existen items dañados/duplicados.
- **Auditoría de robustez**: se corrigieron escrituras concurrentes de JSON mediante actualizaciones serializadas, validación y backup atómico, preservación de IDs de items dañados durante la importación, respeto del intervalo configurado y exclusión de items fuera de playlist de las verificaciones. También se corrigieron el popup OAuth bloqueado por el navegador, el origen del `postMessage`, los estados HTTP de búsqueda y el filtro de artista al editarlo.
