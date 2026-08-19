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
- [ ] **1.1** Inicializar estructura de carpetas (`/server`, `/client`, `/data`).
- [ ] **1.2** Configurar `package.json` raíz con scripts unificados para desarrollo y producción (`npm run dev`, `npm run build`, `npm run start`).
- [ ] **1.3** Configurar proyecto backend con Hono JS y TypeScript.
- [ ] **1.4** Configurar proyecto frontend con Preact, Vite y Tailwind CSS.
- [ ] **1.5** Configurar variables de entorno (`.env.example`) para credenciales de YouTube API, OAuth y Master Password.

---

### 🟢 Fase 2: Backend — Núcleo de Seguridad y Persistencia JSON
- [ ] **2.1** **Servicio de Almacenamiento JSON (`storage.service.ts`)**:
  - Implementar lectura y escritura atómica con archivos temporales y renombrado para evitar corrupción de datos.
  - Gestión de `data/config.json`, `data/sessions.json` y `data/playlists.json`.
- [ ] **2.2** **Módulo de Autenticación de Super Usuario (`auth.service.ts` / `auth.routes.ts`)**:
  - Verificación de contraseña maestra con hash seguro (`bcrypt` / `argon2` / WebCrypto).
  - Emisión de tokens de sesión con 30 días de caducidad.
  - Registro de tokens activos en `sessions.json`.
  - Endpoint para "Block All Sessions" (revocación global inmediata).
- [ ] **2.3** **Middleware de Seguridad (`auth.middleware.ts`)**:
  - Validación de Bearer Token en todas las rutas protegidas.

---

### 🟢 Fase 3: Backend — Integración con YouTube API y Parser de Metadatos
- [ ] **3.1** **Módulo OAuth 2.0 y API Key de YouTube (`youtube.service.ts`)**:
  - Flujo de autenticación OAuth para obtener tokens de acceso y refresco del super usuario (permisos para modificar playlists: `https://www.googleapis.com/auth/youtube`).
  - Almacenamiento seguro del refresh token en `config.json`.
- [ ] **3.2** **Motor de Parseo de Títulos y Artistas (`parser.service.ts`)**:
  - Algoritmo de extracción y limpieza inteligente para separar artista y canción de títulos típicos de YouTube (remoción de `[Official Video]`, `(HD)`, `feat.`, etc.).
  - Normalización de metadatos propios de la app para cumplimiento de ToS.
- [ ] **3.3** **Servicio de Importación y Lectura de Playlists**:
  - Endpoint para importar playlist por URL o ID (`GET/POST /api/playlists/import`).
  - Paginación y extracción completa de items de la playlist vía YouTube Data API.

---

### 🟢 Fase 4: Backend — Monitoreo de Estado y Motor de Recuperación
- [ ] **4.1** **Verificación de Estado en Lotes (`sync.service.ts`)**:
  - Comprobación de disponibilidad de videos (`videos.list`) en lotes de hasta 50 IDs para ahorro de cuota.
  - Detección de videos eliminados, privados o restringidos.
  - Marcado de estado (`active`, `unavailable`, `deleted`, `private`) y timestamp de `lastCheckedAt`.
  - Tarea periódica / endpoint de refresco diario (respetando límite de 24 horas por canción).
- [ ] **4.2** **Búsqueda de Reemplazos (`GET /api/youtube/search`)**:
  - Búsqueda en YouTube API utilizando los metadatos conservados (`[Artista] - [Canción]`).
- [ ] **4.3** **Reemplazo y Mutación de la Playlist (`POST /api/playlists/replace-track`)**:
  - Inserción del nuevo video seleccionado en la playlist del usuario vía YouTube API.
  - Eliminación del item dañado de la playlist en YouTube.
  - Actualización del registro local en `playlists.json`.

---

### 🟢 Fase 5: Frontend — Interfaz SPA con Preact y Tailwind CSS
- [ ] **5.1** **Arquitectura Base y Enrutamiento**:
  - Configuración de estado global / Context para autenticación y estado de sesión.
  - Cliente API con interceptor para adjuntar token de `localStorage`.
- [ ] **5.2** **Vista de Login (Super Usuario)**:
  - Formulario de acceso por contraseña maestra.
  - Manejo de token, expiración y redirección.
- [ ] **5.3** **Panel Principal (Dashboard)**:
  - Cabecera con estado de conexión, estado de OAuth de YouTube y botón de "Cerrar todas las sesiones".
  - Barra de importación de playlist mediante URL o ID.
  - Selector / resumen de playlists gestionadas.
- [ ] **5.4** **Lista de Canciones y Componentes de Item**:
  - Visualización en modo lista/tarjeta con thumbnail, título, artista, estado y fecha de revisión.
  - **Acción Hover**: Botón directo "Reproducir" que abre el enlace en YouTube.
  - Indicador visual claro (badge rojo/alerta) para items dañados o eliminados.
- [ ] **5.5** **Sistema de Filtros y Búsqueda**:
  - Buscador reactivo por texto (nombre de canción o artista).
  - Selector desplegable (Dropdown) de Artistas dinámico con la lista única de artistas para filtrar la vista.
- [ ] **5.6** **Modal de Recuperación / Reemplazo de Canción**:
  - Modal interactivo que se activa con el botón "Recuperar canción dañada".
  - Búsqueda automática y lista de resultados con opciones de previsualización.
  - Confirmación de reemplazo con retroalimentación instantánea.

---

### 🟢 Fase 6: Pruebas, Optimización y Pulido
- [ ] **6.1** Pruebas de borde: playlists grandes (+200 canciones), títulos atípicos, videos eliminados sin metadatos en YouTube.
- [ ] **6.2** Verificación de revocación y expiración de tokens (30 días).
- [ ] **6.3** Modo Oscuro / Pulido visual con Tailwind CSS y accesibilidad.
- [ ] **6.4** Documentación de despliegue y puesta en marcha en `README.md`.
