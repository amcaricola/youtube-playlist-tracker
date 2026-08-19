# AGENTS.MD — Guía Operativa y Directrices para el Modelo LLM

Este documento define la arquitectura, convenciones, reglas de desarrollo, seguridad y flujos de trabajo para cualquier modelo LLM o desarrollador que trabaje en el repositorio **YouTube Playlist Tracker**.

---

## 1. Visión General del Proyecto

**YouTube Playlist Tracker** es una aplicación SPA (Single Page Application) con backend dedicado cuyo propósito principal es:
1. **Monitorear y asegurar la permanencia de playlists de YouTube**: YouTube oculta los títulos e información de videos eliminados o privados (dejándolos simplemente como "Video eliminado" o "Video privado").
2. **Preservar metadatos propios parseados**: Al importar una playlist, el sistema parsea y almacena datos propios (Nombre de la canción, Artista, ID original, Thumbnail, Estado, Fecha de verificación) en un archivo JSON en el servidor (sin base de datos externa).
3. **Detección y Recuperación de Canciones Caídas**: Monitorear periódicamente el estado de los videos y permitir al usuario buscar y reemplazar un video caído/dañado directamente en su playlist de YouTube mediante OAuth 2.0.

---

## 2. Stack Tecnológico y Restricciones

| Capa | Tecnología | Justificación / Restricciones |
| :--- | :--- | :--- |
| **Backend** | **Hono JS** (Node.js runtime con `@hono/node-server` o Bun) | Servidor ultraligero, rápido, modular y con tipado estricto en TypeScript. |
| **Frontend** | **Preact + Tailwind CSS** (con Vite) | SPA ultraligera, reactiva, bundle mínimo y estilos modernos con utilidades Tailwind. |
| **Almacenamiento** | **Archivos JSON en servidor** (`/data/*.json`) | **NO utilizar bases de datos SQL/NoSQL**. Todo el estado se persiste en JSON con escrituras atómicas (`fs.promises.writeFile` seguro / locks si aplica). |
| **Integración Externa** | **YouTube Data API v3 + OAuth 2.0** | Usado para lectura de playlists, verificación de estado y mutación (reemplazo/eliminación/adición de videos). |

---

## 3. Arquitectura del Repositorio y Estructura de Archivos

```text
youtube-playlist-tracker/
├── AGENTS.MD                      # Instrucciones y directrices para agentes LLM
├── PLAN_DE_TRABAJO.MD             # Plan de trabajo, fases y estados de tareas
├── primeras instrucciones.MD      # Requerimientos originales del usuario
├── package.json                   # Scripts y dependencias raíz (Monorepo o scripts unificados)
├── /server                        # Backend Hono JS
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts               # Punto de entrada de Hono
│   │   ├── config.ts              # Variables de entorno y configuración
│   │   ├── middleware/
│   │   │   └── auth.ts            # Middleware de validación de Token / Super User
│   │   ├── routes/
│   │   │   ├── auth.routes.ts     # Login, logout, revocar todas las sesiones
│   │   │   ├── playlist.routes.ts # CRUD playlists locales, importación, sincronización
│   │   │   ├── youtube.routes.ts  # OAuth flow, búsqueda y reemplazo de videos
│   │   │   └── health.routes.ts
│   │   ├── services/
│   │   │   ├── storage.service.ts # Manejo de lectura/escritura atómica de JSON
│   │   │   ├── youtube.service.ts # Cliente API YouTube (lectura, batch check, reemplazo)
│   │   │   ├── parser.service.ts  # Heurística de extracción de Artista y Título
│   │   │   └── sync.service.ts    # Cron / comprobación diaria en lotes
│   │   └── types/
│   │       └── index.ts           # Interfaces y tipos TS del sistema
│   └── data/                      # Almacenamiento JSON (ignorado en git o con plantilla)
│       ├── .gitkeep
│       ├── config.json            # Hash de contraseña master, tokens de sesión
│       ├── sessions.json          # Registro de tokens activos y expiraciones
│       └── playlists.json         # Datos de playlists y tracks parseados
├── /client                        # Frontend Preact + Tailwind CSS
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.tsx               # Montaje de la app Preact
│       ├── app.tsx                # Enrutador/Layout principal
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── PlaylistCard.tsx
│       │   ├── TrackList.tsx
│       │   ├── TrackItem.tsx      # Item con hover de reproducción y botón de recuperación
│       │   ├── SearchAndFilters.tsx # Filtro de texto y desplegable de artistas
│       │   ├── RecoveryModal.tsx  # Modal de búsqueda y reemplazo de canción dañada
│       │   └── SessionManager.tsx # Opciones de seguridad y "Cerrar todas las sesiones"
│       ├── pages/
│       │   ├── Login.tsx          # Pantalla de contraseña única
│       │   └── Dashboard.tsx      # Panel principal de gestión
│       ├── services/
│       │   └── api.ts             # Cliente HTTP (adjunta token de localStorage)
│       └── types/
│           └── index.ts
```

---

## 4. Estándares de Seguridad y Autenticación

1. **Modelo de Super Usuario Único**:
   - No hay registro de múltiples usuarios. Existe una única contraseña maestra.
   - En la primera ejecución o vía `.env`, se define/hashea la contraseña maestra (usando `bcrypt` o `argon2` / Web Crypto API).
2. **Tokens de Acceso (30 días)**:
   - Al autenticarse correctamente con la contraseña, el servidor genera un token criptográfico seguro (UUIDv4 o JWT) con validez de 30 días.
   - El token se almacena en `localStorage` del cliente.
   - El servidor guarda el token en `data/sessions.json` con su timestamp de expiración y metadatos (fecha de creación, IP/UserAgent opcional).
3. **Revocación Global ("Block All Sessions")**:
   - El super usuario tiene la opción de revocar todas las sesiones activas en cualquier momento.
   - Al ejecutar "Block All Sessions", el servidor invalida/elimina todos los tokens en `sessions.json`, forzando el reingreso con contraseña en todos los clientes.
4. **Protección de Endpoints**:
   - Todo endpoint de datos requiere el header `Authorization: Bearer <TOKEN>`.
   - El middleware `auth.ts` rechaza cualquier petición sin token válido o con token revocado/expirado.

---

## 5. Gestión de Datos y YouTube API ToS

1. **Snapshots Propios vs. ToS de YouTube**:
   - Los datos extraídos se normalizan y parsean inmediatamente como metadatos de nuestra aplicación:
     - `title`: Título limpio de la canción.
     - `artist`: Nombre del artista o canal deduplicado.
     - `originalYoutubeTitle`: Título original en el momento de importación.
     - `youtubeVideoId`: ID del video en YouTube.
     - `status`: `'active' | 'unavailable' | 'private' | 'deleted' | 'unknown'`.
     - `lastCheckedAt`: Timestamp ISO de la última verificación.
     - `customNotes`: Notas opcionales del usuario.
2. **Refresco Diario y Cuotas de API**:
   - La verificación de estado de las canciones debe realizarse en lotes pequeños (`videos.list` con múltiples IDs separados por coma, hasta 50 por llamada) para optimizar la cuota de la API de YouTube.
   - Cada track tiene un campo `lastCheckedAt`. Solo se verifica si han pasado más de 24 horas desde la última revisión o si el usuario solicita un chequeo forzado manual.

---

## 6. Flujo de Recuperación de Canción Dañada (Recovery Flow)

Cuando un video de la playlist se marca como no disponible o eliminado:
1. El item en la interfaz muestra una alerta visual destacada (ej: badge rojo "Dañado / Eliminado").
2. El usuario hace clic en el botón **"Recuperar / Reemplazar canción"**.
3. El frontend abre el `RecoveryModal`, disparando una búsqueda automática en YouTube API usando los datos guardados: `"${track.artist} - ${track.title}"`.
4. La interfaz muestra los resultados activos encontrados con miniatura, canal y duración.
5. El usuario selecciona la mejor opción de reemplazo.
6. El backend ejecuta la llamada autenticada con OAuth 2.0:
   - Inserta el nuevo video en la playlist de YouTube (en la misma posición relativa o al final según configuración).
   - Elimina el video caído de la playlist de YouTube.
   - Actualiza el registro local en `playlists.json` con el nuevo `youtubeVideoId` y estado `'active'`.

---

## 7. Heurística del Parser de Títulos y Artistas

El servicio `parser.service.ts` debe aplicar expresiones regulares y sanitización inteligente para separar artista y canción de títulos típicos de YouTube:
- `Artista - Título (Official Music Video)` $\rightarrow$ Artista: `Artista`, Título: `Título`
- `Artista - Título [Audio]` $\rightarrow$ Artista: `Artista`, Título: `Título`
- `Artista feat. Colab - Título (Lyric Video)` $\rightarrow$ Artista: `Artista feat. Colab`, Título: `Título`
- Limpieza de sufijos comunes: `(Official Video)`, `[HD]`, `(Lyrics)`, `[Official Audio]`, `(Visualizer)`, `HQ`, `4K`.

---

## 8. Filtros y Experiencia de Usuario (UI/UX)

1. **Acción Hover**: Cada tarjeta o fila de canción debe mostrar al pasar el ratón (hover) un botón directo para reproducir (`https://www.youtube.com/watch?v={youtubeVideoId}`).
2. **Buscador Dinámico**: Input de texto reactivo que filtra instantáneamente por nombre de canción o artista.
3. **Filtro de Artistas (Dropdown)**:
   - El sistema recopila la lista única y ordenada de todos los artistas en la playlist actual.
   - Un selector desplegable permite seleccionar un artista específico para aislar y analizar todas sus canciones en la playlist.
4. **Diseño Responsive & Minimalista**:
   - Paleta de colores moderna (Dark Mode por defecto preferido con Tailwind CSS).
   - Retroalimentación clara con toasts / alertas en acciones de sincronización, reemplazo o revocación.

---

## 9. Reglas y Directivas para el Modelo LLM

Cuando trabajes en este repositorio, debes cumplir rigurosamente las siguientes directivas:

- **No inventes dependencias de bases de datos**: El almacenamiento debe ser exclusivamente basado en archivos JSON en `/server/data/`.
- **Garantizar Atomicidad de Escritura**: Toda escritura en disco JSON debe prevenir condiciones de carrera y corrupción de datos (escribir a archivo temporal y renombrar, o serializar operaciones mediante cola/promesas).
- **TypeScript Estricto**: Todo el código backend y frontend debe contar con interfaces claras y tipos explícitos (`strict: true`).
- **Respeto a las Cuotas de API**: Al implementar llamadas a YouTube, siempre priorizar consultas en lote (`batching`) y caché de metadatos.
- **Rutas y Enlaces Clickables**: Siempre que menciones archivos o símbolos en tus respuestas, utiliza enlaces markdown compatibles con la sintaxis `[archivo](file:///D:/youtube-playlist-tracker/...)`.
- **Manejo de Errores Limpio**: En Hono JS, utiliza `c.json({ success: false, error: message }, statusCode)` para respuestas de error uniformes.
- **Preservar el Contexto**: Consulta siempre `PLAN_DE_TRABAJO.MD` y actualiza el estado de las tareas conforme se avance en el desarrollo.
