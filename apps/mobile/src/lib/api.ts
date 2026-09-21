/**
 * API client — fetch wrapper + 401'de sessiz refresh + logout.
 *
 * Akış:
 *   1. apiFetch(path, opts) → access token ekle, fetch
 *   2. 401 dönerse → refresh token ile /auth/refresh → yeni access token
 *   3. Yeni token ile orijinal isteği tekrar dene
 *   4. Refresh de patlarsa → clearStoredAuth → navigate to login
 *
 * Memory'de token cache — secure-store her seferinde okumayı önler.
 */
import { API_BASE_URL } from '@/theme';
import {
  getStoredAuth,
  setStoredAuth,
  clearStoredAuth,
  type StoredUser,
} from './storage';

// Memory cache
let cachedTokens: {
  accessToken: string | null;
  refreshToken: string | null;
  user: StoredUser | null;
} = { accessToken: null, refreshToken: null, user: null };

let initPromise: Promise<void> | null = null;

/** Uygulama açılışta memory cache'i doldur. */
export async function initAuthCache(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const stored = await getStoredAuth();
    cachedTokens = stored;
  })();
  return initPromise;
}

export function getCachedUser(): StoredUser | null {
  return cachedTokens.user;
}

export function getCachedAccessToken(): string | null {
  return cachedTokens.accessToken;
}

export async function login(
  email: string,
  password: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      await setStoredAuth(
        { accessToken: json.data.accessToken, refreshToken: json.data.refreshToken },
        json.data.user,
      );
      cachedTokens = {
        accessToken: json.data.accessToken,
        refreshToken: json.data.refreshToken,
        user: json.data.user,
      };
      return { success: true };
    }
    return { success: false, message: json.message || 'Giriş başarısız' };
  } catch (e) {
    return { success: false, message: 'Ağ hatası' };
  }
}

export async function register(data: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: 'user' | 'provider';
  companyName?: string;
  taxNumber?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      await setStoredAuth(
        { accessToken: json.data.accessToken, refreshToken: json.data.refreshToken },
        json.data.user,
      );
      cachedTokens = {
        accessToken: json.data.accessToken,
        refreshToken: json.data.refreshToken,
        user: json.data.user,
      };
      return { success: true };
    }
    return { success: false, message: json.message || 'Kayıt başarısız' };
  } catch (e) {
    return { success: false, message: 'Ağ hatası' };
  }
}

export async function logout(): Promise<void> {
  try {
    if (cachedTokens.accessToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cachedTokens.accessToken}` },
      });
    }
  } catch (e) {
    // ignore
  }
  await clearStoredAuth();
  cachedTokens = { accessToken: null, refreshToken: null, user: null };
}

async function refreshTokens(): Promise<boolean> {
  if (!cachedTokens.refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: cachedTokens.refreshToken }),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      await setStoredAuth(
        { accessToken: json.data.accessToken, refreshToken: json.data.refreshToken },
        json.data.user,
      );
      cachedTokens = {
        accessToken: json.data.accessToken,
        refreshToken: json.data.refreshToken,
        user: json.data.user,
      };
      return true;
    }
  } catch (e) {
    // ignore
  }
  // Refresh patladı → logout
  await clearStoredAuth();
  cachedTokens = { accessToken: null, refreshToken: null, user: null };
  return false;
}

export interface ApiResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  statusCode?: number;
}

export async function apiFetch<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<ApiResult<T>> {
  await initAuthCache();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (cachedTokens.accessToken) {
    headers.Authorization = `Bearer ${cachedTokens.accessToken}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const res = await fetch(url, { ...opts, headers });
  let json: any = null;
  try { json = await res.json(); } catch {}

  // 401 → refresh dene → retry
  if (res.status === 401 && cachedTokens.refreshToken && !opts.headers?.toString().includes('refresh')) {
    const refreshed = await refreshTokens();
    if (refreshed && cachedTokens.accessToken) {
      headers.Authorization = `Bearer ${cachedTokens.accessToken}`;
      const retryRes = await fetch(url, { ...opts, headers });
      try { return await retryRes.json(); } catch { return { success: false, statusCode: retryRes.status }; }
    }
    // Refresh patladı → caller'a 401 dön (login'e yönlendirme navigation'da yapılır)
  }

  return json || { success: false, message: 'Ağ hatası', statusCode: res.status };
}

// On auth change handler — login ekranına yönlendirme için
let onAuthLostCallback: (() => void) | null = null;

export function setOnAuthLost(cb: () => void) {
  onAuthLostCallback = cb;
}

export function notifyAuthLost() {
  if (onAuthLostCallback) onAuthLostCallback();
}
