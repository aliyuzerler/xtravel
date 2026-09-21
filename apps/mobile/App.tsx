/**
 * Turizm Pazaryeri — Mobil uygulama ana giriş.
 *
 * Bu dosya Expo Root'udur. İlk açılışta:
 *   1. Secure-storage'dan token kontrolü (initAuthCache)
 *   2. Push notification permission + token register
 *   3. Derin link handler (turizmpazaryeri://hizmet/[slug])
 *   4. Navigation container — kullanıcının durumuna göre:
 *      - Onboarding görülmediyse → OnboardingStack
 *      - Token yoksa → AuthStack
 *      - Token varsa → MainStack (kullanıcı) veya ProviderStack
 */
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import { COLORS } from '@/theme';
import { initAuthCache, getCachedUser, setOnAuthLost } from '@/lib/api';
import { initPushNotifications } from '@/lib/notifications';
import { RootNavigator } from '@/navigation/RootNavigator';
import { LoadingScreen } from '@/components/ui';

export default function App() {
  const [ready, setReady] = useState(false);
  const [initialUser, setInitialUser] = useState(getCachedUser());

  useEffect(() => {
    let mounted = true;

    (async () => {
      await initAuthCache();
      if (!mounted) return;
      setInitialUser(getCachedUser());

      // Push notification altyapısı
      try {
        await initPushNotifications();
      } catch (e) {
        console.warn('Push notifications init failed:', e);
      }

      setReady(true);
    })();

    // Auth lost callback — logout olunca login'e dön
    setOnAuthLost(() => {
      setInitialUser(null);
    });

    return () => { mounted = false; };
  }, []);

  // Derin link prefix
  const prefix = Linking.createURL('/');
  const linking = {
    prefixes: [prefix, 'https://turizmpazaryeri.com'],
    config: {
      screens: {
        ServiceDetail: 'hizmet/:slug',
        Login: 'login',
      },
    },
  };

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <RootNavigator initialUser={initialUser} />
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
