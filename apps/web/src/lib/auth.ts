/**
 * Auth token storage — localStorage üzerinde tutulur.
 * SSR'da erişilemez, bu yüzden client-side hook'lar kullanılır.
 */
import { UserRole } from '@turizm-pazaryeri/shared';

const ACCESS_TOKEN_KEY = 'tp_access_token';
const REFRESH_TOKEN_KEY = 'tp_refresh_token';
const USER_KEY = 'tp_user';

export interface StoredUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  providerId: string | null;
}

export function getStoredAuth(): {
  accessToken: string | null;
  refreshToken: string | null;
  user: StoredUser | null;
} {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null, user: null };
  }
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  };
}

export function setStoredAuth(tokens: { accessToken: string; refreshToken: string }, user: StoredUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Backend API'sine giden fetch wrapper.
 * - Authorization header'ı otomatik ekler
 * - 401 alırsa refresh token ile tek dene, hâlâ 401 ise logout
 */
export async function apiFetch<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<{ success: boolean; data?: T; message?: string; statusCode?: number }> {
  const auth = getStoredAuth();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (auth.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  const res = await fetch(path, { ...opts, headers });
  let json: any = null;
  try { json = await res.json(); } catch {}

  if (res.status === 401 && auth.refreshToken && !opts.headers?.toString().includes('refresh')) {
    // Refresh denemesi
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    });
    if (refreshRes.ok) {
      const refreshJson = await refreshRes.json();
      const data = refreshJson.data || refreshJson;
      if (data?.accessToken) {
        setStoredAuth(
          { accessToken: data.accessToken, refreshToken: data.refreshToken },
          auth.user as StoredUser,
        );
        // Retry original
        headers.Authorization = `Bearer ${data.accessToken}`;
        const retryRes = await fetch(path, { ...opts, headers });
        try { return await retryRes.json(); } catch { return { success: false }; }
      }
    }
    clearStoredAuth();
  }

  return json || { success: false, message: 'Network error', statusCode: res.status };
}
