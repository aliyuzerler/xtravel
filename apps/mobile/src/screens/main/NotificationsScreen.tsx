/**
 * Bildirimler ekranı.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { apiFetch } from '@/lib/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { timeAgo, notificationIcon } from '@/lib/helpers';

interface NotificationItem {
  id: string; type: string; title: string; message: string;
  isRead: boolean; createdAt: string;
}

export function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    const r = await apiFetch<{ items: NotificationItem[] }>('/user/notifications?limit=50');
    if (showRefresh) setRefreshing(false); else setLoading(false);
    if (r.success && r.data) setItems(r.data.items || []);
    else setError(r.message || 'Yüklenemedi');
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    await apiFetch(`/user/notifications/${id}/read`, { method: 'POST' });
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  }

  if (loading) return <SafeAreaView style={styles.container}><View style={{ padding: SPACING.lg }}><Skeleton height={80} /><Skeleton height={80} style={{ marginTop: SPACING.md }} /></View></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.container}><ErrorState message={error} onRetry={() => load()} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.accent]} />}
        contentContainerStyle={{ padding: SPACING.lg }}
        ListEmptyComponent={<EmptyState icon="🔔" message="Henüz bildirim yok" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => !item.isRead && markRead(item.id)}
            style={[styles.card, !item.isRead && styles.cardUnread]}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.icon}>{notificationIcon(item.type)}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Text style={styles.message}>{item.message}</Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  cardUnread: { backgroundColor: COLORS.infoLight, borderColor: COLORS.info, borderLeftWidth: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  icon: { fontSize: 20, marginRight: SPACING.sm },
  title: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text },
  time: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  message: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, lineHeight: 18 },
  unreadDot: { position: 'absolute', top: SPACING.md, right: SPACING.md, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
});
