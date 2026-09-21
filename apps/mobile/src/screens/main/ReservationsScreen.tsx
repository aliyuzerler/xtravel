/**
 * Rezervasyonlarım — sekmeli (gelecek / geçmiş / iptal).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { apiFetch } from '@/lib/api';
import { Card, StatusBadge, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { formatPrice, formatDate, statusLabel } from '@/lib/helpers';

interface Reservation {
  id: string; reservationCode: string; status: string;
  participantCount: number; totalPrice: number; contactName: string;
  createdAt: string;
  service: { id: string; title: string; slug: string; images: Array<{ imageUrl: string }> };
  schedule: { startAt: string };
  pricing: { name: string; unit: string };
}

const TABS = [
  { key: 'upcoming', label: 'Gelecek', statuses: ['pending_payment', 'confirmed'] },
  { key: 'past', label: 'Geçmiş', statuses: ['completed'] },
  { key: 'cancelled', label: 'İptal', statuses: ['cancelled', 'refunded'] },
];

export function ReservationsScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [data, setData] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError(null);

    // Tüm rezervasyonları çek + client-side filter (status gruplarına göre)
    const r = await apiFetch<{ items: Reservation[] }>('/user/reservations?limit=100');
    if (showRefresh) setRefreshing(false); else setLoading(false);
    if (r.success && r.data) {
      setData(r.data.items || []);
    } else {
      setError(r.message || 'Yüklenemedi');
    }
  }

  useEffect(() => { load(); }, []);

  const tabConfig = TABS.find((t) => t.key === activeTab)!;
  const filtered = data.filter((r) => tabConfig.statuses.includes(r.status));

  function openService(slug: string) {
    navigation.navigate('ServiceDetail', { slug });
  }

  if (loading) {
    return <SafeAreaView style={styles.container}><View style={{ padding: SPACING.lg }}><Skeleton height={80} /><Skeleton height={80} style={{ marginTop: SPACING.md }} /></View></SafeAreaView>;
  }

  if (error) {
    return <SafeAreaView style={styles.container}><ErrorState message={error} onRetry={() => load()} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.accent]} />}
        contentContainerStyle={{ padding: SPACING.lg }}
        ListEmptyComponent={<EmptyState icon="📅" message="Bu sekmede rezervasyon yok" />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openService(item.service.slug)}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.code}>{item.reservationCode}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.serviceTitle} numberOfLines={2}>{item.service.title}</Text>
              <View style={styles.row}>
                <Text style={styles.meta}>📅 {formatDate(item.schedule.startAt, true)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.meta}>👥 {item.participantCount} kişi · {item.pricing.name}</Text>
                <Text style={styles.price}>{formatPrice(item.totalPrice)}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.accent },
  tabText: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, fontWeight: FONT_WEIGHT.medium },
  tabTextActive: { color: COLORS.accent, fontWeight: FONT_WEIGHT.semibold },
  card: { marginBottom: SPACING.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  code: { fontFamily: 'monospace', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },
  serviceTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text, marginBottom: SPACING.xs, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.xs },
  meta: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  price: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.success },
});
