/**
 * Sağlayıcı mini panel (v1) — Gelen rezervasyonları listele + onayla/iptal et.
 *
 * A2 spesifikasyonu: Sağlayıcı mobil app yalnızca v1 olarak rezervasyon listesi
 * ve rezervasyon detayını içerir. Hizmet oluşturma web'den yapılır.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { apiFetch } from '@/lib/api';
import { Card, StatusBadge, EmptyState, ErrorState, Skeleton, Button } from '@/components/ui';
import { formatPrice, formatDate } from '@/lib/helpers';

interface Reservation {
  id: string; reservationCode: string; status: string;
  participantCount: number; totalPrice: number;
  contactName: string; contactEmail: string; contactPhone: string;
  createdAt: string;
  user: { email: string; fullName: string | null };
  service: { id: string; title: string };
  schedule: { startAt: string };
  pricing: { name: string; unit: string };
}

export function ProviderReservationsScreen() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    const r = await apiFetch<{ items: Reservation[] }>('/provider/reservations?limit=50');
    if (showRefresh) setRefreshing(false); else setLoading(false);
    if (r.success && r.data) setItems(r.data.items || []);
    else setError(r.message || 'Yüklenemedi');
  }

  useEffect(() => { load(); }, []);

  async function confirm(id: string) {
    Alert.alert('Onayla', 'Rezervasyonu onaylamak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Onayla',
        onPress: async () => {
          const r = await apiFetch(`/provider/reservations/${id}/confirm`, { method: 'PUT' });
          if (r.success) { Alert.alert('✓', 'Rezervasyon onaylandı'); load(true); }
          else Alert.alert('Hata', r.message || 'Onaylanamadı');
        },
      },
    ]);
  }

  async function cancel() {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 3) {
      Alert.alert('Hata', 'İptal gerekçesi en az 3 karakter olmalı');
      return;
    }
    const r = await apiFetch(`/provider/reservations/${cancelTarget.id}/cancel`, {
      method: 'PUT', body: JSON.stringify({ reason: cancelReason }),
    });
    if (r.success) {
      Alert.alert('✓', 'Rezervasyon iptal edildi');
      setCancelTarget(null); setCancelReason('');
      load(true);
    } else {
      Alert.alert('Hata', r.message || 'İptal edilemedi');
    }
  }

  if (loading) return <SafeAreaView style={styles.container}><View style={{ padding: SPACING.lg }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={100} style={{ marginBottom: SPACING.md }} />)}</View></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.container}><ErrorState message={error} onRetry={() => load()} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sağlayıcı Paneli</Text>
        <Text style={styles.headerSub}>Gelen Rezervasyonlar</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.accent]} />}
        contentContainerStyle={{ padding: SPACING.lg }}
        ListEmptyComponent={<EmptyState icon="📭" message="Henüz rezervasyon yok" />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.code}>{item.reservationCode}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.serviceTitle}>{item.service.title}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Müşteri:</Text>
              <Text style={styles.detailValue}>{item.contactName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>E-posta:</Text>
              <Text style={styles.detailValue}>{item.contactEmail}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Telefon:</Text>
              <Text style={styles.detailValue}>{item.contactPhone}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tarih:</Text>
              <Text style={styles.detailValue}>{formatDate(item.schedule.startAt, true)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Kişi:</Text>
              <Text style={styles.detailValue}>{item.participantCount} kişi ({item.pricing.name})</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Toplam:</Text>
              <Text style={styles.priceValue}>{formatPrice(item.totalPrice)}</Text>
            </View>

            {(item.status === 'pending_payment' || item.status === 'confirmed') && (
              <View style={styles.actionRow}>
                {item.status === 'pending_payment' && (
                  <Button title="✓ Onayla" onPress={() => confirm(item.id)} variant="success" size="sm" style={{ flex: 1 }} />
                )}
                <Button title="✗ İptal Et" onPress={() => setCancelTarget(item)} variant="danger" size="sm" style={{ flex: 1 }} />
              </View>
            )}
          </Card>
        )}
      />

      {/* Cancel modal */}
      <Modal visible={!!cancelTarget} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rezervasyonu İptal Et</Text>
            <Text style={styles.modalSubtitle}>{cancelTarget?.reservationCode} — {cancelTarget?.service.title}</Text>
            <Text style={styles.filterLabel}>İptal gerekçesi (zorunlu)</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              style={styles.reasonInput}
              placeholder="İptal nedeni..."
              autoFocus
            />
            <View style={styles.modalFooter}>
              <Button title="Vazgeç" variant="ghost" onPress={() => { setCancelTarget(null); setCancelReason(''); }} style={{ flex: 1 }} />
              <Button title="İptal Et" variant="danger" onPress={cancel} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.lg, backgroundColor: COLORS.primary },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: '#FFFFFF' },
  headerSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  card: { marginBottom: SPACING.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  code: { fontFamily: 'monospace', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },
  serviceTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text, marginBottom: SPACING.sm },
  detailRow: { flexDirection: 'row', paddingVertical: 2 },
  detailLabel: { width: 80, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  detailValue: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  priceLabel: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text },
  priceValue: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.success },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.lg },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.text, marginBottom: 4 },
  modalSubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.md },
  filterLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text, marginBottom: SPACING.xs },
  reasonInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.md, minHeight: 80, textAlignVertical: 'top' },
  modalFooter: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
});
