// Typed RPC client over shared/api.ts: POST /api/<op>, WS /ws?projectId=… push, GET /health.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  DEFAULT_PORT,
  type ApiResponse,
  type OpArgs,
  type OpName,
  type OpResult,
  type ServerPush,
} from '@shared/api';

const OVERRIDE_KEY = 'nr.serverUrl';

/** Where the server most likely is when the user hasn't set an address. */
export function defaultServerUrl(): string {
  // A hosted build (e.g. on Vercel) names its server at build time; the server can't run beside a static site.
  if (process.env.EXPO_PUBLIC_SERVER_URL) return normalizeServerUrl(process.env.EXPO_PUBLIC_SERVER_URL);
  if (Platform.OS === 'web' && typeof location !== 'undefined' && location.hostname) {
    return `${location.protocol}//${location.hostname}:${DEFAULT_PORT}`;
  }
  // The Metro dev machine's LAN address — the server runs next to it. A tunnel host (*.exp.direct) doesn't
  // forward the server's port, and "localhost" inside the Android emulator is the emulator itself.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  const loopback = host === 'localhost' || host === '127.0.0.1';
  if (host && !host.endsWith('.exp.direct') && !(loopback && Platform.OS === 'android')) {
    return `http://${host}:${DEFAULT_PORT}`;
  }
  if (Platform.OS === 'android') return `http://10.0.2.2:${DEFAULT_PORT}`;
  return `http://localhost:${DEFAULT_PORT}`;
}

/** Trims, adds http:// when no scheme is given, drops trailing slashes. */
export function normalizeServerUrl(input: string): string {
  const url = input.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

let base: string | null = null;

/** The server URL in use (saved override, else the default). */
export const serverUrl = (): string => (base ??= defaultServerUrl());

/** Loads the saved override (if any) and makes it current. */
export async function loadServerUrl(): Promise<string> {
  const saved = await AsyncStorage.getItem(OVERRIDE_KEY).catch(() => null);
  base = saved ?? defaultServerUrl();
  return base;
}

/** Saves an override (normalized) or clears it with null; returns the URL now in use. */
export async function saveServerUrl(url: string | null): Promise<string> {
  if (url) {
    base = normalizeServerUrl(url);
    await AsyncStorage.setItem(OVERRIDE_KEY, base);
  } else {
    base = defaultServerUrl();
    await AsyncStorage.removeItem(OVERRIDE_KEY);
  }
  return base;
}

/** Calls one RPC op. Throws Error(message) on transport failure or `{ ok: false }`. */
export async function call<K extends OpName>(op: K, args: OpArgs<K>): Promise<OpResult<K>> {
  const url = serverUrl();
  let res: Response;
  try {
    res = await fetch(`${url}/api/${op}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    throw new Error(`Can’t reach the rehearsal server at ${url}.`);
  }
  let body: ApiResponse<OpResult<K>>;
  try {
    body = await res.json();
  } catch {
    throw new Error(`The server answered ${res.status} without a readable response.`);
  }
  if (!body.ok) throw new Error(body.error);
  return body.result;
}

/** True when a rehearsal server answers GET /health at `url` within the timeout. */
export async function health(url: string = serverUrl(), timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Listens for `changed` pushes for one project; reconnects with exponential backoff (1s → 15s).
 * `onChanged(version)` on each push; `onChanged(undefined)` whenever the socket (re)opens, since pushes may have been missed.
 * Returns an unsubscribe function.
 */
export function subscribe(projectId: string, onChanged: (version?: number) => void): () => void {
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let stopped = false;

  const connect = () => {
    socket = new WebSocket(`${serverUrl().replace(/^http/i, 'ws')}/ws?projectId=${encodeURIComponent(projectId)}`);
    socket.onopen = () => {
      // Always refetch once connected: a change can land between the first load and the socket opening.
      onChanged(undefined);
      failures = 0;
    };
    socket.onmessage = (event) => {
      try {
        const push = JSON.parse(String(event.data)) as ServerPush;
        if (push.type === 'changed' && push.projectId === projectId) onChanged(push.version);
      } catch {
        // Not a push we understand; ignore.
      }
    };
    socket.onclose = () => {
      if (stopped) return;
      const delay = Math.min(15_000, 1_000 * 2 ** failures++) * (0.8 + Math.random() * 0.4);
      timer = setTimeout(connect, delay);
    };
  };

  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket?.close();
  };
}
