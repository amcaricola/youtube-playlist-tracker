# YouTube Playlist Tracker

Aplicación SPA + backend para **preservar los metadatos de tus playlists de YouTube** y **recuperar canciones eliminadas o dañadas** antes de que desaparezcan sin rastro.

YouTube oculta el título y la información de los videos eliminados o privados (los muestra como "Video eliminado"/"Video privado"). Esta app importa tu playlist, **parsea y guarda sus propios metadatos** (artista, canción, estado) en un JSON local, monitorea el estado de cada video y te permite **buscar y reemplazar** una canción caída directamente en tu playlist de YouTube.

- **Backend**: Hono JS (TypeScript) — servidor ultraligero.
- **Frontend**: Preact + Vite + Tailwind CSS (Dark mode).
- **Persistencia**: Archivos JSON en `server/data/` (sin bases de datos) con escrituras atómicas.
- **YouTube**: YouTube Data API v3 (lectura con API Key o OAuth, mutaciones con OAuth 2.0).

---

## Requisitos

- Node.js >= 20 (probado con Node 24)
- npm >= 10

## Instalación

```bash
npm install
```

## Configuración

1. Copia `.env.example` a `server/.env` y completa los valores:

```bash
cp .env.example server/.env
```

2. Variables:

| Variable | Descripción |
| :--- | :--- |
| `MASTER_PASSWORD` | Contraseña maestra del Super Usuario (se hashea con sal en el primer arranque). |
| `YOUTUBE_API_KEY` | Clave de API para lectura pública (playlists, videos, búsqueda). Opcional si usas OAuth. |
| `YOUTUBE_OAUTH_CLIENT_ID` / `YOUTUBE_OAUTH_CLIENT_SECRET` | Credenciales OAuth para modificar playlists (Google Cloud Console). |
| `YOUTUBE_OAUTH_REDIRECT_URI` | Debe coincidir con la URI autorizada en Google Cloud. |

3. En **Google Cloud Console**: habilita **YouTube Data API v3**, crea una API Key y unas credenciales **OAuth Client** (Web application) con la URI de redirección apuntando a `http://localhost:3000/api/youtube/oauth/callback`. En OAuth consentscreen usa el modo *Testing* (hasta 100 usuarios) o publica la app para más.

## Uso en desarrollo

```bash
npm run dev
```

Levanta backend (puerto 3000) y frontend (puerto 5173) con hot-reload. El frontend proxya `/api` al backend.

## Build y producción

```bash
npm run build          # compila server/ y client/
npm run start          # arranca el servidor de producción
```

El servidor sirve la web construida en `client/dist` desde la raíz `/`, además de la API (`/api/*`).

## Flujo de uso

1. Entra con la contraseña maestra → recibes un token de sesión de 30 días.
2. **Conecta YouTube (OAuth)** desde el panel: se abre la ventana de consentimiento de Google (popup) y al volver la app refresca el estado automáticamente.
3. Importa tu playlist por URL o ID → la app parsea y guarda tus propios metadatos (artista, canción, estado, thumbnail).
4. Las canciones se verifican automáticamente cada 24 h en lotes de hasta 50 (ahorro de cuota); también puedes forzar con "Verificar ahora".
5. Si una canción se daña/elimina, pulsa **"Recuperar canción"** para buscar un reemplazo y aplicarlo en tu playlist de YouTube.
6. Si agregas canciones en tu playlist directamente en YouTube, usa **"Sincronizar estructura"** para importarlas sin pisar los datos existentes.

> Con OAuth conectado no es necesaria la `YOUTUBE_API_KEY`: las lecturas usan tu token autorizado.

## Funcionalidades principales

### Gestión de datos
- **Importar playlist** por URL o ID (parsing automático de `Artista - Título` con limpieza de sufijos tipo `(Official Video)`, `[Audio]`, `feat.`, etc.).
- **Edición de datos propios** por canción (✏️): corregir artista/título cuando el parsing no sea perfecto o YouTube devuelva títulos genéricos.
- **Edición masiva de artista**: selecciona canciones (checkboxes + "Seleccionar esta página"), escribe el artista y aplica — ideal para unificar variantes del mismo artista ("Metalica", "Metallica band", etc.).
- **Detección de duplicados**: badge naranja "Duplicada" cuando hay otra canción con el mismo título normalizado (posibles covers), con filtro **"Solo duplicadas"** para revisarlas juntas.

### Monitoreo y recuperación
- Verificación de estado por lotes: `active`, `unavailable`, `private`, `deleted`, `unknown`.
- **Recuperación/reemplazo** de canciones dañadas: búsqueda en YouTube con los datos guardados (`"Artista - Título"`), selección del mejor candidato e inserción/eliminación en la playlist real vía OAuth.
- **Borrado seguro**: el botón 🗑 y la acción masiva "Eliminar N sin datos" solo aplican a canciones dañadas sin información guardada (irrecuperables); las recuperables solo muestran "Recuperar"/editar para evitar borrados accidentales.

### Filtros y UI
- Búsqueda reactiva por canción o artista; autocompletado de artistas (3 sugerencias) con botón de limpieza.
- Filtros: **"Solo dañadas"** y **"Solo duplicadas"**.
- Paginación de 100 canciones; hover en cada fila para reproducir en YouTube (▶).

### Backup y datos
- **⬇ Backup**: descarga el JSON completo con todos los metadatos preservados.
- **⬆ Restaurar**: sube un backup para recuperar los datos; antes de sobrescribir se guarda automáticamente una copia previa (`playlists.json.bak-<timestamp>`).

### Seguridad
- Una sola contraseña maestra, almacenada como hash con sal (scrypt).
- Tokens de sesión de 30 días (hash en `sessions.json`), revocables con **"Block All Sessions"**.
- **Anti fuerza bruta**: tras 5 intentos fallidos de contraseña, el login se bloquea 15 minutos (HTTP 429).
- Todos los endpoints de datos requieren `Authorization: Bearer <token>`.

## Cumplimiento de términos (YouTube API / Google APIs)

- La app **no descarga ni almacena contenido audiovisual**: solo metadatos (título, artista, thumbnail URL, IDs).
- Los datos se refrescan continuamente (verificación diaria por canción, muy por debajo del límite de 30 días que fijan las Developer Policies).
- Las escrituras en tu playlist (borrar/reemplazar) requieren tu consentimiento explícito en cada acción.
- **Desconectar OAuth** revoca el token también en Google (`POST oauth2.googleapis.com/revoke`).
- La interfaz muestra un footer con los **Términos de Servicio de YouTube**, la **Política de Privacidad de Google** y la nota de que artista/canción son **datos propios de la app**, no de YouTube.

## Estructura

```
├── server/          # Backend Hono (src/ con routes, services, middleware)
│   └── data/        # JSON de datos (config, sesiones, playlists) — no versionar
├── client/          # SPA Preact + Tailwind
└── .env.example     # Plantilla de variables de entorno
```

El detalle de fases y evolución del desarrollo está en `PLAN_DE_TRABAJO.MD`.

## Comandos útiles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Desarrollo con hot-reload (backend 3000 + Vite 5173). |
| `npm run build` | Compila server y client para producción. |
| `npm run start` | Arranca el servidor de producción. |
| `npm run typecheck` | Verificación de tipos en server y client. |