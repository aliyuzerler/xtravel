/**
 * Checkout sonuç ekranı — başarı veya hata.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { Button } from '@/components/ui';

export function CheckoutResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { status, reservationCode } = route.params;

  const isSuccess = status === 'success';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={[styles.icon, { color: isSuccess ? COLORS.success : COLORS.danger }]}>
          {isSuccess ? '✓' : '✗'}
        </Text>
        <Text style={[styles.title, { color: isSuccess ? COLORS.success : COLORS.danger }]}>
          {isSuccess ? 'Ödemeniz Alındı!' : 'Ödeme Başarısız'}
        </Text>
        <Text style={styles.message}>
          {isSuccess
            ? 'Rezervasyonunuz başarıyla oluşturuldu ve onaylandı.'
            : 'Ödemeniz alınamadı. 15 dakika içinde tekrar deneyebilirsiniz.'}
        </Text>

        {isSuccess && reservationCode && (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Rezervasyon Kodu:</Text>
            <Text style={styles.code}>{reservationCode}</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <Button title="Rezervasyonlarım" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }, { name: 'Reservations' }] })} variant="accent" style={{ flex: 1 }} />
          <Button title="Ana Sayfa" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })} variant="ghost" style={{ flex: 1 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, padding: SPACING.xl, justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 80, marginBottom: SPACING.md },
  title: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm, textAlign: 'center' },
  message: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.lg },
  codeBox: { backgroundColor: COLORS.successLight, padding: SPACING.lg, borderRadius: 12, marginBottom: SPACING.xl, alignItems: 'center' },
  codeLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.xs },
  code: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.success, fontFamily: 'monospace' },
  buttonRow: { flexDirection: 'row', gap: SPACING.md, width: '100%' },
});
