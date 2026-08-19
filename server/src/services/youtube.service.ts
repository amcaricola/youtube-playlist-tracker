import { config } from '../config.js';
import { storage } from './storage.service.js';
import type { SearchResult, TrackStatus } from '../types/index.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/youtube';

export class YouTubeError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'YouTubeError';
    this.statusCode = statusCode;
  }
}

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') usp.set(key, String(value));
  }
  return usp.toString();
}

async function getAccessToken(): Promise<string> {
  const cfg = await storage.readConfig();
  const oauth = cfg.oauth;
  if (!oauth.connected || !oauth.refreshToken) {
    throw new YouTubeError('OAuth de YouTube no conectado. Vincula tu cuenta primero.', 401);
  }
  if (oauth.accessToken && oauth.expiresAt && new Date(oauth.expiresAt).getTime() > Date.now() + 60_000) {
    return oauth.accessToken;
  }

  const body = new URLSearchParams({
    client_id: config.oauth.clientId,
    client_secret: config.oauth.clientSecret,
    refresh_token: oauth.refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await res.json()) as OAuthTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new YouTubeError(`No se pudo refrescar el token de YouTube: ${data.error_description ?? data.error ?? res.status}`, 401);
  }

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await storage.writeConfig({
    ...cfg,
    oauth: {
      ...oauth,
      accessToken: data.access_token,
      expiresAt,
    },
  });
  return data.access_token;
}

interface ApiResponseJson {
  items?: unknown[];
  nextPageToken?: string;
  error?: { code?: number; message?: string; errors?: Array<{ reason?: string; location?: string }> };
}

async function getReadHeaders(): Promise<Record<string, string>> {
  const cfg = await storage.readConfig();
  if (cfg.oauth.connected && cfg.oauth.refreshToken) {
    try {
      const token = await getAccessToken();
      return { Authorization: `Bearer ${token}` };
    } catch (err) {
      console.warn('[youtube] OAuth no disponible para lectura, se intenta con API key:', (err as Error).message);
    }
  }
  if (config.youtubeApiKey) {
    return { 'X-goog-api-key': config.youtubeApiKey };
  }
  throw new YouTubeError(
    'Sin credenciales de YouTube: configura YOUTUBE_API_KEY o conecta tu cuenta con OAuth desde la web.',
    500,
  );
}

async function apiFetch(
  path: string,
  params: Record<string, string | number | undefined>,
  useOAuth: boolean,
): Promise<ApiResponseJson & Record<string, unknown>> {
  const query = buildQuery(params);
  const url = `${API_BASE}/${path}?${query}`;
  const headers: Record<string, string> = {};
  if (useOAuth) {
    headers.Authorization = `Bearer ${await getAccessToken()}`;
  } else {
    Object.assign(headers, await getReadHeaders());
  }
  const res = await fetch(url, { headers });
  const json = (await res.json()) as ApiResponseJson & Record<string, unknown>;
  if (!res.ok && !json.items) {
    const msg = json.error?.message ?? `Error de la API de YouTube (${res.status})`;
    throw new YouTubeError(msg, res.status);
  }
  return json;
}

/* ------------------------------------------------------------------ */
/* OAuth                                                               */
/* ------------------------------------------------------------------ */

export function getOAuthUrl(state: string): string {
  if (!config.oauth.clientId || !config.oauth.clientSecret) {
    throw new YouTubeError(
      'OAuth no configurado: define YOUTUBE_OAUTH_CLIENT_ID y YOUTUBE_OAUTH_CLIENT_SECRET en server/.env',
      500,
    );
  }
  const params = new URLSearchParams({
    client_id: config.oauth.clientId,
    redirect_uri: config.oauth.redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{ channelId: string | null; channelTitle: string | null }> {
  const body = new URLSearchParams({
    client_id: config.oauth.clientId,
    client_secret: config.oauth.clientSecret,
    code,
    redirect_uri: config.oauth.redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await res.json()) as OAuthTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new YouTubeError(`Error en OAuth: ${data.error_description ?? data.error ?? res.status}`);
  }

  const channel = await fetchChannelInfo(data.access_token);
  const cfg = await storage.readConfig();
  await storage.writeConfig({
    ...cfg,
    oauth: {
      connected: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? cfg.oauth.refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
    },
  });
  return channel;
}

async function fetchChannelInfo(accessToken: string): Promise<{ channelId: string | null; channelTitle: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/channels?part=snippet&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { channelId: null, channelTitle: null };
    const json = (await res.json()) as { items?: Array<{ id?: string; snippet?: { title?: string } }> };
    const item = json.items?.[0];
    return { channelId: item?.id ?? null, channelTitle: item?.snippet?.title ?? null };
  } catch {
    return { channelId: null, channelTitle: null };
  }
}

export async function getOAuthStatus(): Promise<{
  connected: boolean;
  channelId: string | null;
  channelTitle: string | null;
}> {
  const cfg = await storage.readConfig();
  return {
    connected: cfg.oauth.connected,
    channelId: cfg.oauth.channelId,
    channelTitle: cfg.oauth.channelTitle,
  };
}

export async function disconnectOAuth(): Promise<void> {
  const cfg = await storage.readConfig();

  if (cfg.oauth.refreshToken) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: cfg.oauth.refreshToken }),
      });
      if (!res.ok) {
        console.warn('[disconnectOAuth] No se pudo revocar el token en Google (HTTP', res.status, ').');
      }
    } catch (err) {
      console.warn('[disconnectOAuth] Error al revocar el token en Google:', (err as Error).message);
    }
  }

  await storage.writeConfig({
    ...cfg,
    oauth: {
      connected: false,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      channelId: null,
      channelTitle: null,
    },
  });
}

export async function ensureOAuthConnected(): Promise<void> {
  const cfg = await storage.readConfig();
  if (!cfg.oauth.connected || !cfg.oauth.refreshToken) {
    throw new YouTubeError('OAuth de YouTube no conectado. Conecta tu cuenta para modificar la playlist.', 401);
  }
}

/* ------------------------------------------------------------------ */
/* Lectura pública (API key)                                           */
/* ------------------------------------------------------------------ */

export async function fetchPlaylistMeta(playlistId: string): Promise<{
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  itemCount: number;
}> {
  const json = await apiFetch('playlists', { part: 'snippet,contentDetails', id: playlistId }, false);
  const item = json.items?.[0] as
    | {
        id?: string;
        snippet?: {
          title?: string;
          description?: string;
          channelId?: string;
          channelTitle?: string;
          thumbnails?: { high?: { url?: string }; default?: { url?: string } };
        };
        contentDetails?: { itemCount?: number };
      }
    | undefined;
  if (!item?.id) {
    throw new YouTubeError('Playlist no encontrada. Verifica la URL o el ID.', 404);
  }
  return {
    id: item.id,
    title: item.snippet?.title ?? 'Sin título',
    description: item.snippet?.description ?? '',
    channelId: item.snippet?.channelId ?? '',
    channelTitle: item.snippet?.channelTitle ?? '',
    thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
    itemCount: item.contentDetails?.itemCount ?? 0,
  };
}

export async function fetchPlaylistItems(playlistId: string): Promise<
  Array<{
    playlistItemId: string;
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
    position: number;
  }>
> {
  const items: Array<{
    playlistItemId: string;
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
    position: number;
  }> = [];
  let pageToken: string | undefined;

  do {
    const json = await apiFetch(
      'playlistItems',
      {
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: 50,
        pageToken,
      },
      false,
    );
    for (const raw of (json.items as Array<{
      id?: string;
      snippet?: {
        title?: string;
        position?: number;
        thumbnails?: { high?: { url?: string }; default?: { url?: string } };
        channelTitle?: string;
        resourceId?: { videoId?: string };
      };
    }>) ?? []) {
      const videoId = raw.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      items.push({
        playlistItemId: raw.id ?? '',
        videoId,
        title: raw.snippet?.title ?? '',
        channelTitle: raw.snippet?.channelTitle ?? '',
        thumbnailUrl: raw.snippet?.thumbnails?.high?.url ?? raw.snippet?.thumbnails?.default?.url ?? '',
        position: raw.snippet?.position ?? 0,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return items;
}

/* ------------------------------------------------------------------ */
/* Verificación de estado (API key, en lotes)                          */
/* ------------------------------------------------------------------ */

interface VideoCheckEntry {
  id?: string;
  status?: { privacyStatus?: string };
  contentDetails?: { duration?: string; definition?: string };
}

export async function checkVideosStatus(
  videoIds: string[],
): Promise<Map<string, { status: TrackStatus; duration: string | null }>> {
  const result = new Map<string, { status: TrackStatus; duration: string | null }>();
  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += config.batchSize) {
    chunks.push(videoIds.slice(i, i + config.batchSize));
  }

  for (const chunk of chunks) {
    const json = await apiFetch('videos', { part: 'status,contentDetails', id: chunk.join(',') }, false);

    const found = new Set<string>();
    for (const item of (json.items as VideoCheckEntry[] | undefined) ?? []) {
      if (!item.id) continue;
      found.add(item.id);
      const privacy = item.status?.privacyStatus;
      const status: TrackStatus = privacy === 'private' ? 'private' : 'active';
      result.set(item.id, { status, duration: item.contentDetails?.duration ?? null });
    }

    const errorEntries = (json.error?.errors as Array<{ location?: string; reason?: string }> | undefined) ?? [];
    for (const err of errorEntries) {
      const id = err.location ?? '';
      if (!id || found.has(id)) continue;
      const reason = err.reason ?? '';
      const status: TrackStatus = reason === 'videoNotFound' ? 'deleted' : 'unavailable';
      result.set(id, { status, duration: null });
    }

    for (const id of chunk) {
      if (!result.has(id)) {
        result.set(id, { status: 'unavailable', duration: null });
      }
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Búsqueda de reemplazos (API key)                                    */
/* ------------------------------------------------------------------ */

export async function searchTracks(query: string, maxResults = 10): Promise<SearchResult[]> {
  const json = await apiFetch(
    'search',
    {
      part: 'snippet',
      type: 'video',
      q: query,
      maxResults,
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
    },
    false,
  );
  const results: SearchResult[] = [];
  for (const raw of (json.items as Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: { high?: { url?: string }; default?: { url?: string } };
    };
  }>) ?? []) {
    const videoId = raw.id?.videoId;
    if (!videoId) continue;
    results.push({
      videoId,
      title: raw.snippet?.title ?? '',
      channelTitle: raw.snippet?.channelTitle ?? '',
      thumbnailUrl: raw.snippet?.thumbnails?.high?.url ?? raw.snippet?.thumbnails?.default?.url ?? '',
      publishedAt: raw.snippet?.publishedAt ?? '',
    });
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Mutaciones (OAuth)                                                  */
/* ------------------------------------------------------------------ */

export async function insertPlaylistItem(
  playlistId: string,
  videoId: string,
  position?: number,
): Promise<string> {
  const body: Record<string, unknown> = {
    snippet: {
      playlistId,
      resourceId: { kind: 'youtube#video', videoId },
    },
  };
  if (position !== undefined && position >= 0) {
    (body.snippet as Record<string, unknown>).position = position;
  }

  const res = await fetch(`${API_BASE}/playlistItems?part=snippet`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new YouTubeError(`Error al insertar el video: ${data.error?.message ?? res.status}`, res.status);
  }
  return data.id;
}

export async function deletePlaylistItem(playlistItemId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/playlistItems?id=${encodeURIComponent(playlistItemId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  });
  if (!res.ok && res.status !== 204) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new YouTubeError(`Error al eliminar el item: ${data.error?.message ?? res.status}`, res.status);
  }
}