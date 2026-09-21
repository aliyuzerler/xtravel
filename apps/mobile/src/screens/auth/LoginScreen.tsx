/**
 * Login ekranı — e-posta + şifre, demo giriş bilgileri gösterimi.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { Button, Input } from '@/components/ui';
import { login } from '@/lib/api';

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) { setError('E-posta ve şifre gerekli'); return; }
    setLoading(true);
    setError(null);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      // App.tsx'in cached user'ı güncellemesi için state'in yenilenmesi lazım.
      // Pratik çözüm: navigation reset ile Main'e git.
      // App.tsx'in auth listener'ı auth lost durumunda zaten login'e döner.
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } else {
      setError(result.message || 'Giriş başarısız');
    }
  }

  function fillDemo(type: 'user' | 'provider' | 'admin') {
    if (type === 'user') {
      setEmail('customer@demo.local'); setPassword('Customer123!');
    } else if (type === 'provider') {
      setEmail('provider1@demo.local'); setPassword('Provider123!');
    } else {
      setEmail('admin@turizm-pazaryeri.local'); setPassword('Admin123!');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Giriş Yap</Text>
        <Text style={styles.subtitle}>Hesabınıza giriş yapın</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Input
          label="E-posta"
          value={email}
          onChangeText={setEmail}
          placeholder="ornek@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Şifre"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        <Button title={loading ? 'Giriş yapılıyor...' : 'Giriş Yap'} onPress={handleLogin} loading={loading} fullWidth />

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>Hesabın yok mu?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}> Kayıt ol</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>Demo Giriş:</Text>
          <View style={styles.demoButtons}>
            <Button title="Kullanıcı" size="sm" variant="ghost" onPress={() => fillDemo('user')} />
            <Button title="Sağlayıcı" size="sm" variant="ghost" onPress={() => fillDemo('provider')} />
            <Button title="Admin" size="sm" variant="ghost" onPress={() => fillDemo('admin')} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { TouchableOpacity } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },
  title: { fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.bold, color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, marginBottom: SPACING.xl },
  errorBox: { backgroundColor: COLORS.dangerLight, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { color: COLORS.danger, fontSize: FONT_SIZE.sm },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  registerText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },
  registerLink: { color: COLORS.accent, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  demoSection: { marginTop: SPACING['3xl'], padding: SPACING.md, backgroundColor: COLORS.surfaceAlt, borderRadius: 8 },
  demoTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textMuted, marginBottom: SPACING.sm },
  demoButtons: { flexDirection: 'row', justifyContent: 'space-around' },
});
