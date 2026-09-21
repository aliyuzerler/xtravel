/**
 * Profil ekranı — kullanıcı bilgileri, hızlı erişim, çıkış.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { Button, Input } from '@/components/ui';
import { apiFetch, logout, getCachedUser } from '@/lib/api';

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState(getCachedUser());
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveProfile() {
    setLoading(true);
    setMsg(null);
    const r = await apiFetch('/auth/me', { method: 'PUT', body: JSON.stringify({ fullName, phone }) });
    setLoading(false);
    if (r.success) {
      setMsg('Profil güncellendi');
    } else {
      setMsg(r.message || 'Güncellenemedi');
    }
  }

  async function handleLogout() {
    Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  }

  const menuItems = [
    { label: '🔔 Bildirimler', action: () => navigation.navigate('Notifications') },
    ...(user?.role === 'provider' ? [{ label: '📋 Sağlayıcı Paneli', action: () => navigation.navigate('ProviderReservations') }] : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.fullName || user?.email || '?')[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.fullName || 'Kullanıcı'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role === 'provider' ? 'Sağlayıcı' : user?.role === 'super_admin' ? 'Admin' : 'Kullanıcı'}</Text>
          </View>
        </View>

        {msg && <View style={styles.msgBox}><Text style={styles.msgText}>{msg}</Text></View>}

        <Text style={styles.sectionTitle}>Bilgilerim</Text>
        <Input label="Ad Soyad" value={fullName} onChangeText={setFullName} placeholder="Adınız soyadınız" />
        <Input label="Telefon" value={phone} onChangeText={setPhone} placeholder="+90 5XX XXX XX XX" keyboardType="phone-pad" />
        <Input label="E-posta (değiştirilemez)" value={user?.email || ''} onChangeText={() => {}} />

        <Button title={loading ? 'Kaydediliyor...' : 'Bilgileri Kaydet'} onPress={saveProfile} loading={loading} fullWidth />

        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>Hızlı Erişim</Text>
        {menuItems.map((item, idx) => (
          <TouchableOpacity key={idx} style={styles.menuItem} onPress={item.action}>
            <Text style={styles.menuText}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}

        <View style={{ marginTop: SPACING.xl }}>
          <Button title="Çıkış Yap" onPress={handleLogout} variant="danger" fullWidth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { alignItems: 'center', paddingVertical: SPACING.xl, backgroundColor: COLORS.surface, borderRadius: 12, marginBottom: SPACING.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  avatarText: { fontSize: 36, fontWeight: FONT_WEIGHT.bold, color: '#FFFFFF' },
  name: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.text },
  email: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, marginTop: 2 },
  roleBadge: { marginTop: SPACING.sm, backgroundColor: COLORS.accentLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: 12 },
  roleText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, color: COLORS.accent },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text, marginBottom: SPACING.md },
  msgBox: { backgroundColor: COLORS.successLight, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#BBF7D0' },
  msgText: { color: COLORS.success, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, backgroundColor: COLORS.surface, borderRadius: 8, marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  menuText: { fontSize: FONT_SIZE.md, color: COLORS.text },
  menuArrow: { fontSize: 24, color: COLORS.textMuted },
});
