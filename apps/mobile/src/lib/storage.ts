/**
 * Secure token storage — expo-secure-store ile şifrelenmiş.
 *
 * iOS: Keychain
 * Android: Keystore (encrypted SharedPreferences)
 *
 * Token'lar 3 anahtar altında saklanır:
 *   - access_token  (15 dk TTL)
 *   - refresh_token (30 gün TTL)
 *   - user_profile  (JSON stringify)
 *
 * Uygulama kapatılıp açıldığında oturum korunur.
 */
import * as SecureStore from 'expo-secure-store';
import { UserRole } from '@turizm-pazaryeri/shared';

const KEY_ACCESS = 'tp_access_token';
const KEY_REFRESH = 'tp_refresh_token';
const KEY_USER = 'tp_user_profile';

export interface StoredUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  providerId: string | null;
}

export async function getStoredAuth(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  user: StoredUser | null;
}> {
  try {
    const [accessToken, refreshToken, userJson] = await Promise.all([
      SecureStore.getItemAsync(KEY_ACCESS),
      SecureStore.getItemAsync(KEY_REFRESH),
      SecureStore.getItemAsync(KEY_USER),
    ]);
    return {
      accessToken,
      refreshToken,
      user: userJson ? JSON.parse(userJson) : null,
    };
  } catch (e) {
    console.warn('getStoredAuth failed:', e);
    return { accessToken: null, refreshToken: null, user: null };
  }
}

export async function setStoredAuth(
  tokens: { accessToken: string; refreshToken: string },
  user: StoredUser,
): Promise<void> {
  try {
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS, tokens.accessToken),
      SecureStore.setItemAsync(KEY_REFRESH, tokens.refreshToken),
      SecureStore.setItemAsync(KEY_USER, JSON.stringify(user)),
    ]);
  } catch (e) {
    console.error('setStoredAuth failed:', e);
  }
}

export async function clearStoredAuth(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_ACCESS),
      SecureStore.deleteItemAsync(KEY_REFRESH),
      SecureStore.deleteItemAsync(KEY_USER),
    ]);
  } catch (e) {
    console.warn('clearStoredAuth failed:', e);
  }
}
