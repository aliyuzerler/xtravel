/**
 * Root Navigator — uygulamanın tüm navigation ağacı.
 *
 * 3 ana stack:
 *   1. OnboardingStack — ilk açılışta 3 slayt
 *   2. AuthStack — login/register (token yoksa)
 *   3. MainTabs — kullanıcı giriş yaptıysa (Ana Sayfa, Rezervasyonlar, Profil)
 *   4. ProviderStack — sağlayıcılar için mini panel
 *
 * Role-based switch:
 *   - role === 'provider' → MainTabs (provider modunda)
 *   - role === 'user' → MainTabs
 *   - role === 'super_admin' → MainTabs (admin mobilde yok, web kullanılır)
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { StoredUser } from '@/lib/storage';

import { COLORS } from '@/theme';
import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { HomeScreen } from '@/screens/main/HomeScreen';
import { SearchScreen } from '@/screens/main/SearchScreen';
import { ServiceDetailScreen } from '@/screens/main/ServiceDetailScreen';
import { ReservationsScreen } from '@/screens/main/ReservationsScreen';
import { ProfileScreen } from '@/screens/main/ProfileScreen';
import { NotificationsScreen } from '@/screens/main/NotificationsScreen';
import { CheckoutScreen } from '@/screens/checkout/CheckoutScreen';
import { CheckoutResultScreen } from '@/screens/checkout/CheckoutResultScreen';
import { ProviderReservationsScreen } from '@/screens/provider/ProviderReservationsScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
  ServiceDetail: { slug: string; scheduleId?: string; pricingId?: string; participants?: number };
  Checkout: { slug: string; scheduleId: string; pricingId: string; participants: number };
  CheckoutResult: { status: 'success' | 'failure'; reservationCode?: string };
  Notifications: undefined;
  ProviderReservations: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border },
        headerShown: false,
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Keşfet', tabBarIcon: ({ color }) => <TabIcon emoji="🔍" color={color} /> }} />
      <Tab.Screen name="ReservationsTab" component={ReservationsScreen} options={{ title: 'Rezervasyonlar', tabBarIcon: ({ color }) => <TabIcon emoji="📅" color={color} /> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profil', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }} />
    </Tab.Navigator>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  // Emoji rendering için basit Text component
  return null; // Gerçek uygulamada VectorIcons kullanılır
}

export function RootNavigator({ initialUser }: { initialUser: StoredUser | null }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      {!initialUser ? (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Giriş Yap' }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Kayıt Ol' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} options={{ title: 'Hizmet Detayı' }} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Ödeme' }} />
          <Stack.Screen name="CheckoutResult" component={CheckoutResultScreen} options={{ title: 'Sonuç', headerBackVisible: false }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Bildirimler' }} />
          <Stack.Screen name="ProviderReservations" component={ProviderReservationsScreen} options={{ title: 'Gelen Rezervasyonlar' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
