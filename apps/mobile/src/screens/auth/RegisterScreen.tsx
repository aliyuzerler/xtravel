/**
 * Register ekranı — kullanıcı veya sağlayıcı kaydı.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { UserRole } from '@turizm-pazaryeri/shared';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { Button, Input } from '@/components/ui';
import { register } from '@/lib/api';

export function RegisterScreen() {
  const navigation = useNavigation<any>();
  const [form, setForm] = useState({
    email: '', password: '', fullName: '', phone: '',
    role: UserRole.USER as 'user' | 'provider',
    companyName: '', taxNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProvider = form.role === 'provider';

  async function handleRegister() {
    if (form.password.length < 8) { setError('Şifre en az 8 karakter olmalı'); return; }
    if (isProvider && !form.companyName) { setError('Sağlayıcı için şirket adı gerekli'); return; }
    setLoading(true);
    setError(null);
    const result = await register({
      email: form.email, password: form.password, fullName: form.fullName,
      phone: form.phone || undefined, role: form.role,
      ...(isProvider ? { companyName: form.companyName, taxNumber: form.taxNumber || undefined } : {}),
    });
    setLoading(false);
    if (result.success) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } else {
      setError(result.message || 'Kayıt başarısız');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Kayıt Ol</Text>
        <Text style={styles.subtitle}>Turizm Pazaryeri'ne katıl</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Rol seçimi */}
        <Text style={styles.label}>Hesap Tipi</Text>
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleBtn, !isProvider && styles.roleBtnActive]}
            onPress={() => setForm({ ...form, role: 'user' })}
          >
            <Text style={[styles.roleText, !isProvider && styles.roleTextActive]}>Kullanıcı</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, isProvider && styles.roleBtnActive]}
            onPress={() => setForm({ ...form, role: 'provider' })}
          >
            <Text style={[styles.roleText, isProvider && styles.roleTextActive]}>Sağlayıcı</Text>
          </TouchableOpacity>
        </View>

        <Input label="Ad Soyad" value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} placeholder="Adınız soyadınız" />
        <Input label="E-posta" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} placeholder="ornek@email.com" keyboardType="email-address" />
        <Input label="Şifre" value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} placeholder="En az 8 karakter" secureTextEntry />
        <Input label="Telefon (opsiyonel)" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="+90 5XX XXX XX XX" keyboardType="phone-pad" />

        {isProvider && (
          <>
            <Input label="Şirket Adı" value={form.companyName} onChangeText={(v) => setForm({ ...form, companyName: v })} placeholder="Şirketinizin adı" />
            <Input label="Vergi / TCKN No (opsiyonel)" value={form.taxNumber} onChangeText={(v) => setForm({ ...form, taxNumber: v })} placeholder="10-11 hane" keyboardType="numeric" />
          </>
        )}

        <Button title={loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'} onPress={handleRegister} loading={loading} fullWidth />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Hesabın var mı?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}> Giriş yap</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },
  title: { fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.bold, color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, marginBottom: SPACING.xl },
  errorBox: { backgroundColor: COLORS.dangerLight, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { color: COLORS.danger, fontSize: FONT_SIZE.sm },
  label: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, color: COLORS.text, marginBottom: SPACING.xs },
  roleRow: { flexDirection: 'row', marginBottom: SPACING.md, gap: SPACING.sm },
  roleBtn: { flex: 1, paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, alignItems: 'center' },
  roleBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  roleText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium },
  roleTextActive: { color: COLORS.accent, fontWeight: FONT_WEIGHT.semibold },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  loginText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },
  loginLink: { color: COLORS.accent, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
});
