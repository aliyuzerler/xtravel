/**
 * Hizmet detay ekranı — galeri + takvim + varyant + kişi + alt fiyat çubuğu.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { apiFetch } from '@/lib/api';
import { Button, StatusBadge, EmptyState, ErrorState } from '@/components/ui';
import { formatPrice, formatDate } from '@/lib/helpers';

interface ServiceDetail {
  id: string; title: string; description: string | null;
  meetingPoint: string | null; latitude: number | null; longitude: number | null;
  durationHours: number | null;
  provider: { id: string; companyName: string; phone: string | null; description: string | null };
  category: { id: string; name: string; slug: string };
  city: { id: string; name: string; slug: string };
  images: Array<{ id: string; imageUrl: string; isMain: boolean }>;
  pricing: Array<{ id: string; name: string; price: number; currency: string; unit: string }>;
  schedules: Array<{ id: string; startAt: string; endAt: string; capacity: number; bookedCount: number }>;
}

export function ServiceDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const slug = route.params?.slug;
  const preSchedule = route.params?.scheduleId;
  const prePricing = route.params?.pricingId;
  const preParticipants = route.params?.participants || 1;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPricing, setSelectedPricing] = useState<string>(prePricing || '');
  const [selectedSchedule, setSelectedSchedule] = useState<string>(preSchedule || '');
  const [participants, setParticipants] = useState(preParticipants);

  useEffect(() => {
    if (!slug) { setError('Hizmet slug eksik'); setLoading(false); return; }
    (async () => {
      const r = await apiFetch<ServiceDetail>(`/services/${slug}`);
      setLoading(false);
      if (r.success && r.data) {
        setService(r.data);
        if (r.data.pricing?.length > 0 && !selectedPricing) {
          setSelectedPricing(r.data.pricing[0].id);
        }
      } else {
        setError(r.message || 'Hizmet bulunamadı');
      }
    })();
  }, [slug]);

  if (loading) {
    return <SafeAreaView style={styles.container}><View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>;
  }
  if (error || !service) {
    return <SafeAreaView style={styles.container}>{error ? <ErrorState message={error} onRetry={() => navigation.goBack()} /> : <EmptyState message="Hizmet bulunamadı" />}</SafeAreaView>;
  }

  const mainImage = service.images.find((i) => i.isMain) || service.images[0];
  const selectedPricingObj = service.pricing.find((p) => p.id === selectedPricing);
  const selectedScheduleObj = service.schedules.find((s) => s.id === selectedSchedule);

  let totalPrice = 0;
  let canCalculate = false;
  if (selectedPricingObj && selectedScheduleObj) {
    canCalculate = true;
    totalPrice = selectedPricingObj.unit === 'per_person' ? selectedPricingObj.price * participants : selectedPricingObj.price;
  }

  function checkout() {
    if (!canCalculate) return;
    navigation.navigate('Checkout', {
      slug, scheduleId: selectedSchedule, pricingId: selectedPricing, participants,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Görsel galeri */}
        {mainImage && (
          <Image source={{ uri: mainImage.imageUrl }} style={styles.mainImage} />
        )}
        {service.images.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm }}>
            {service.images.map((img) => (
              <Image key={img.id} source={{ uri: img.imageUrl }} style={[styles.thumb, img.isMain && styles.thumbMain]} />
            ))}
          </ScrollView>
        )}

        {/* Başlık */}
        <View style={styles.header}>
          <Text style={styles.title}>{service.title}</Text>
          <View style={styles.metaRow}>
            {service.durationHours && <Text style={styles.meta}>⏱ {service.durationHours}s</Text>}
            <Text style={styles.meta}>📍 {service.city.name}</Text>
            <Text style={styles.meta}>🏢 {service.provider.companyName}</Text>
          </View>
        </View>

        {/* Açıklama */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Açıklama</Text>
          <Text style={styles.description}>{service.description || 'Açıklama yok'}</Text>
        </View>

        {/* Buluşma noktası */}
        {service.meetingPoint && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Buluşma Noktası</Text>
            <Text style={styles.description}>{service.meetingPoint}</Text>
            {service.latitude && service.longitude && (
              <Text style={styles.coords}>📌 {service.latitude.toFixed(4)}, {service.longitude.toFixed(4)}</Text>
            )}
          </View>
        )}

        {/* Fiyat varyantı seçimi */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fiyat Varyantı</Text>
          {service.pricing.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.optionCard, selectedPricing === p.id && styles.optionCardActive]}
              onPress={() => setSelectedPricing(p.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{p.name}</Text>
                <Text style={styles.optionDesc}>{p.unit === 'per_person' ? 'Kişi başı' : 'Grup'}</Text>
              </View>
              <Text style={styles.optionPrice}>{formatPrice(p.price, p.currency)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Takvim slotu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tarih / Saat</Text>
          {service.schedules.length === 0 ? (
            <Text style={styles.noSlot}>Müsait tarih bulunamadı.</Text>
          ) : (
            service.schedules.map((s) => {
              const remaining = s.capacity - s.bookedCount;
              const isFull = remaining <= 0;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.optionCard, selectedSchedule === s.id && styles.optionCardActive, isFull && styles.optionCardDisabled]}
                  disabled={isFull}
                  onPress={() => setSelectedSchedule(s.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{formatDate(s.startAt, true)}</Text>
                    <Text style={styles.optionDesc}>{isFull ? 'DOLU' : `${remaining} yer kaldı`}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Kişi sayısı (per_person ise) */}
        {selectedPricingObj?.unit === 'per_person' && selectedSchedule && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kişi Sayısı</Text>
            <View style={styles.participantRow}>
              <TouchableOpacity onPress={() => setParticipants(Math.max(1, participants - 1))} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.qtyInput}
                value={String(participants)}
                onChangeText={(v) => setParticipants(Math.max(1, Math.min(20, parseInt(v) || 1)))}
                keyboardType="numeric"
              />
              <TouchableOpacity onPress={() => setParticipants(Math.min(20, participants + 1))} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
              {selectedScheduleObj && (
                <Text style={styles.capacityHint}>Kapasite: {selectedScheduleObj.capacity - selectedScheduleObj.bookedCount} yer</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Alt sabit fiyat çubuğu */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || SPACING.md }]}>
        <View style={{ flex: 1 }}>
          {canCalculate ? (
            <>
              <Text style={styles.bottomLabel}>Toplam</Text>
              <Text style={styles.bottomPrice}>{formatPrice(totalPrice)}</Text>
            </>
          ) : (
            <Text style={styles.bottomHint}>Varyant ve tarih seçin</Text>
          )}
        </View>
        <Button
          title="Rezerve Et"
          onPress={checkout}
          disabled={!canCalculate}
          variant="accent"
          style={{ minWidth: 140 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mainImage: { width: '100%', height: 280 },
  thumb: { width: 64, height: 48, borderRadius: 6, marginRight: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  thumbMain: { borderColor: COLORS.success, borderWidth: 2 },
  header: { padding: SPACING.lg, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.text, marginBottom: SPACING.xs },
  metaRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  meta: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  section: { padding: SPACING.lg, backgroundColor: COLORS.surface, marginTop: SPACING.sm },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text, marginBottom: SPACING.md },
  description: { fontSize: FONT_SIZE.md, color: COLORS.text, lineHeight: 22 },
  coords: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.xs },
  optionCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, marginBottom: SPACING.xs },
  optionCardActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  optionCardDisabled: { opacity: 0.5, backgroundColor: COLORS.surfaceAlt },
  optionTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text },
  optionDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  optionPrice: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.success },
  noSlot: { fontSize: FONT_SIZE.md, color: COLORS.danger, padding: SPACING.md, backgroundColor: COLORS.dangerLight, borderRadius: 8 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  qtyBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.surfaceAlt, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  qtyBtnText: { fontSize: 24, color: COLORS.text, fontWeight: FONT_WEIGHT.bold },
  qtyInput: { width: 60, height: 40, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, textAlign: 'center', fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold },
  capacityHint: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginLeft: SPACING.xs },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md, ...({ shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 } as any) },
  bottomLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', fontWeight: FONT_WEIGHT.semibold },
  bottomPrice: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.bold, color: COLORS.success },
  bottomHint: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});
