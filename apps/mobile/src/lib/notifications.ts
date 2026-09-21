/**
 * Push bildirim altyapısı (expo-notifications).
 *
 * Akış:
 *   1. İzin iste (iOS için critical)
 *   2. Expo push token al
 *   3. Backend'e token kaydet (Faz 7'de: POST /api/user/device-token)
 *   4. Gelen notification'ları işle (foreground + background)
 *
 * Sandbox notu: Gerçek push göndermek için Expo push sunucusuna
 * POST https://exp.host/--/api/v2/push/send gerekir. Bu modül
 * yalnızca client tarafını hazırlar; backend push gönderimi Faz 7+.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from './api';

// Foreground notification handler — uygulama açıkken gelen bildirim
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function initPushNotifications(): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Push bildirim izni reddedildi');
      return null;
    }

    // Push token al
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'turizm-pazaryeri',
    })).data;

    console.log('📱 Push token:', token);

    // Android için channel oluştur
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Turizm Pazaryeri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F97316',
      });
    }

    // Backend'e kaydet (opsiyonel — endpoint yoksa sessiz geç)
    try {
      await apiFetch('/user/device-token', {
        method: 'POST',
        body: JSON.stringify({ token, platform: Platform.OS }),
      });
    } catch (e) {
      // Endpoint yoksa sessiz geç
    }

    return token;
  } catch (e) {
    console.warn('initPushNotifications failed:', e);
    return null;
  }
}

/**
 * Bildirim tıklama listener'ı — uygulama ön plandayken veya
 * arka planda açıldığında bildirime tıklamayı yakalar.
 *
 * Kullanımı: navigation'a bağlanmalı
 *   Notifications.addNotificationResponseReceivedListener(response => {
 *     const data = response.notification.request.content.data;
 *     if (data.type === 'reservation_confirmed' && data.reservationId) {
 *       navigation.navigate('Reservations', { id: data.reservationId });
 *     }
 *   });
 */
export function setupNotificationHandler(navigate: (route: string, params?: any) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    console.log('📱 Notification tapped:', data);

    if (data?.type === 'reservation_confirmed' || data?.type === 'reservation_cancelled') {
      navigate('Reservations', {});
    }
  });
  return () => sub.remove();
}
