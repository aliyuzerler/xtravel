/**
 * Checkout ekranı — özet → ödeme → sonuç akışı.
 * Sandbox: iyzico webview yerine mock success/failure butonları.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { Button, Input, ErrorState } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/helpers';

interface ServiceDetail {
  id: string; title: string; slug: string;
  provider: { companyName: string };
  category: { name: string };
  city: { name: string };
  images: Array<{ imageUrl: string; isMain: boolean }>;
  pricing: Array<{ id: string; name: string; price: number; currency: string; unit: string }>;
  schedules: Array<{ id: string; startAt: string; endAt: string; capacity: number; bookedCount: number }>;
}

export function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { slug, scheduleId, pricingId, participants } = route.params;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [step, setStep] = useState<'summary' | 'payment' | 'processing'>('summary');
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [reservation, setReservation] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const r = await apiFetch<ServiceDetail>(`/services/${slug}`);
      if (r.success && r.data) setService(r.data);
    })();
    // User bilgisi ile contact form doldur
    import('@/lib/storage').then(async ({ getStoredAuth }) => {
      const auth = await getStoredAuth();
      if (auth.user) {
        setContact({
          name: auth.user.fullName || '',
          email: auth.user.email || '',
          phone: auth.user.phone || '',
        });
      }
    });
  }, [slug]);

  if (!service) {
    return <SafeAreaView style={styles.container}><View style={{ flex: 1, justifyContent: 'center' }}><Text style={{ textAlign: 'center', color: COLORS.textMuted }}>Yükleniyor...</Text></View></SafeAreaView>;
  }

  const pricing = service.pricing.find((p) => p.id === pricingId);
  const schedule = service.schedules.find((s) => s.id === scheduleId);
  const total = pricing?.unit === 'per_person' ? (pricing?.price || 0) * participants : (pricing?.price || 0);

  async function proceedToPayment() {
    setFormError(null);
    if (!contact.name || contact.name.length < 2) { setFormError('Ad soyad gerekli'); return; }
    if (!contact.email || !/.+@.+\..+/.test(contact.email)) { setFormError('Geçerli bir e-posta girin'); return; }
    if (!contact.phone || contact.phone.length < 7) { setFormError('Geçerli bir telefon numarası girin'); return; }

    setProcessing(true);
    const resResult = await apiFetch('/reservations', {
      method: 'POST',
      body: JSON.stringify({
        serviceId: service!.id, scheduleId, pricingId, participantCount: participants,
        contactName: contact.name, contactEmail: contact.email, contactPhone: contact.phone,
      }),
    });
    setProcessing(false);

    if (!resResult.success || !resResult.data) {
      setFormError(resResult.message || 'Rezervasyon oluşturulamadı');
      return;
    }
    setReservation(resResult.data);
    setStep('payment');
  }

  async function startPayment() {
    if (!reservation) return;
    setProcessing(true);
    const payResult = await apiFetch('/payments/init', {
      method: 'POST', body: JSON.stringify({ reservationId: reservation.id }),
    });
    setProcessing(false);
    if (!payResult.success || !payResult.data) {
      setFormError(payResult.message || 'Ödeme başlatılamadı');
      return;
    }
    setPayment(payResult.data);
  }

  async function completePayment(status: 'success' | 'failure') {
    if (!payment) return;
    setProcessing(true);
    const cbResult = await apiFetch(`/payments/mock-callback?paymentId=${payment.paymentId}&status=${status}`);
    setProcessing(false);
    navigation.navigate('CheckoutResult', {
      status,
      reservationCode: reservation?.reservationCode,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 100 }}>
        {/* Stepper */}
        <View style={styles.stepper}>
          <View style={[styles.step, step === 'summary' && styles.stepActive]}>
            <Text style={styles.stepNum}>1</Text>
            <Text style={styles.stepLabel}>Özet</Text>
          </View>
          <View style={[styles.step, step === 'payment' && styles.stepActive]}>
            <Text style={styles.stepNum}>2</Text>
            <Text style={styles.stepLabel}>Ödeme</Text>
          </View>
        </View>

        {formError && <View style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View>}

        {step === 'summary' && (
          <>
            <Text style={styles.sectionTitle}>İletişim Bilgileri</Text>
            <Input label="Ad Soyad" value={contact.name} onChangeText={(v) => setContact({ ...contact, name: v })} placeholder="Adınız soyadınız" />
            <Input label="E-posta" value={contact.email} onChangeText={(v) => setContact({ ...contact, email: v })} placeholder="ornek@email.com" keyboardType="email-address" />
            <Input label="Telefon" value={contact.phone} onChangeText={(v) => setContact({ ...contact, phone: v })} placeholder="+90 5XX XXX XX XX" keyboardType="phone-pad" />

            <Text style={styles.sectionTitle}>Sipariş Özeti</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{service.title}</Text>
              <Row label="Varyant" value={pricing?.name || '-'} />
              {pricing?.unit === 'per_person' && <Row label="Kişi" value={`${participants} kişi`} />}
              <Row label="Tarih" value={schedule ? formatDate(schedule.startAt, true) : '-'} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Toplam</Text>
                <Text style={styles.totalPrice}>{formatPrice(total)}</Text>
              </View>
            </View>

            <Button title={processing ? 'İşleniyor...' : 'Ödemeye Devam Et'} onPress={proceedToPayment} loading={processing} fullWidth variant="accent" />
          </>
        )}

        {step === 'payment' && (
          <>
            <Text style={styles.sectionTitle}>Ödeme</Text>
            {!payment ? (
              <>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>Rezervasyon kodunuz: <Text style={styles.code}>{reservation?.reservationCode}</Text></Text>
                  <Text style={styles.warning}>⏰ 15 dakika içinde ödeme yapmazsanız rezervasyonunuz otomatik iptal edilecek.</Text>
                </View>
                <Button title="Ödeme Başlat" onPress={startPayment} loading={processing} fullWidth variant="accent" />
              </>
            ) : (
              <>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>Payment ID: <Text style={styles.code}>{payment.paymentId?.slice(0, 8)}</Text></Text>
                  <Text style={styles.infoText}>Sandbox test modu. Aşağıdaki butonlardan birini seçin.</Text>
                </View>
                <View style={styles.mockButtons}>
                  <Button title="✓ Başarılı" onPress={() => completePayment('success')} variant="success" style={{ flex: 1 }} />
                  <Button title="✗ Başarısız" onPress={() => completePayment('failure')} variant="danger" style={{ flex: 1 }} />
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  stepper: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg, justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: SPACING.xs },
  stepActive: {},
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, color: '#FFFFFF', textAlign: 'center', textAlignVertical: 'center', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold } as any,
  stepLabel: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  errorBox: { backgroundColor: COLORS.dangerLight, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { color: COLORS.danger, fontSize: FONT_SIZE.sm },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text, marginBottom: SPACING.md, marginTop: SPACING.md },
  summaryCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  summaryTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text, marginBottom: SPACING.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs },
  rowLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  rowValue: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: FONT_WEIGHT.medium },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  totalLabel: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text },
  totalPrice: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.success },
  infoBox: { backgroundColor: COLORS.infoLight, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.md },
  infoText: { fontSize: FONT_SIZE.sm, color: COLORS.text, marginBottom: SPACING.xs },
  warning: { fontSize: FONT_SIZE.sm, color: COLORS.warning, marginTop: SPACING.xs },
  code: { fontFamily: 'monospace', fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },
  mockButtons: { flexDirection: 'row', gap: SPACING.md },
});
