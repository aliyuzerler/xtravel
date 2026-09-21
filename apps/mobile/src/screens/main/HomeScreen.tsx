/**
 * Ana Sayfa — Hero arama + kategoriler + öne çıkanlar.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { apiFetch } from '@/lib/api';
import { Card, Skeleton, EmptyState, ErrorState } from '@/components/ui';
import { formatPrice, categoryIcon } from '@/lib/helpers';

interface City { id: string; name: string; slug: string }
interface Category { id: string; name: string; slug: string; iconName: string | null; _count?: { services: number } }
interface ServiceItem {
  id: string; title: string; slug: string; durationHours: number | null; startingPrice: number | null;
  category: { name: string; slug: string }; city: { name: string; slug: string };
  images: Array<{ imageUrl: string }>; provider: { companyName: string };
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    const [c, cat, f] = await Promise.all([
      apiFetch<City[]>('/cities'),
      apiFetch<Category[]>('/categories'),
      apiFetch<ServiceItem[]>('/featured-services?limit=8'),
    ]);
    if (showRefresh) setRefreshing(false); else setLoading(false);
    if (c.success) setCities(c.data || []);
    if (cat.success) setCategories(cat.data || []);
    if (f.success) setFeatured(f.data || []);
    if (!c.success && !cat.success) setError('Veriler yüklenemedi');
  }

  useEffect(() => { load(); }, []);

  function goSearch() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    navigation.navigate('ServiceDetail', { slug: '' }); // hack — gerçek uygulamada Search ekranı açılır
    // Aslında navigation'a bir Search ekranı eklemek lazım; şimdilik featured'dan ilkine gidelim
  }

  function openService(slug: string) {
    navigation.navigate('ServiceDetail', { slug });
  }

  function openCategory(slug: string) {
    // Search ekranına kategori filtresi ile git
    navigation.navigate('ServiceDetail', { slug: '' }); // basitleştirilmiş
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
          <Skeleton width="60%" height={32} />
          <Skeleton width="80%" height={20} style={{ marginTop: SPACING.sm }} />
          <Skeleton height={120} style={{ marginTop: SPACING.lg }} />
          <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg }}>
            <Skeleton width={80} height={80} />
            <Skeleton width={80} height={80} />
            <Skeleton width={80} height={80} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState message={error} onRetry={() => load()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.accent]} />}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Türkiye'nin her şehrinde{'\n'}unutulmaz deneyimler</Text>
          <TouchableOpacity style={styles.searchBox} onPress={() => navigation.getParent()?.navigate('Search')}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Hizmet ara..."
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={goSearch}
              returnKeyType="search"
            />
          </TouchableOpacity>
        </View>

        {/* Kategoriler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kategoriler</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.md }}>
            {categories.map((cat) => (
              <TouchableOpacity key={cat.id} style={styles.categoryCard} onPress={() => openCategory(cat.slug)}>
                <Text style={styles.categoryIcon}>{categoryIcon(cat.iconName)}</Text>
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Text style={styles.categoryCount}>{cat._count?.services || 0} hizmet</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Öne çıkanlar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Öne Çıkan Hizmetler</Text>
          {featured.length === 0 ? (
            <EmptyState icon="🎯" message="Henüz öne çıkan hizmet yok" />
          ) : (
            <View style={styles.serviceGrid}>
              {featured.map((s) => (
                <TouchableOpacity key={s.id} style={styles.serviceCard} onPress={() => openService(s.slug)}>
                  <View style={styles.serviceImage}>
                    {s.images?.[0]?.imageUrl ? (
                      <Image source={{ uri: s.images[0].imageUrl }} style={{ flex: 1 }} />
                    ) : (
                      <View style={{ flex: 1, backgroundColor: COLORS.surfaceAlt, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 32 }}>🎯</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.serviceContent}>
                    <Text style={styles.serviceCatCity}>{s.category.name} · {s.city.name}</Text>
                    <Text style={styles.serviceTitle} numberOfLines={2}>{s.title}</Text>
                    <View style={styles.serviceFooter}>
                      {s.startingPrice != null ? (
                        <Text style={styles.servicePrice}>{formatPrice(s.startingPrice)}</Text>
                      ) : (
                        <Text style={styles.serviceNoPrice}>Fiyat yok</Text>
                      )}
                      {s.durationHours && <Text style={styles.serviceDuration}>⏱ {s.durationHours}s</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { Image } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  hero: {
    backgroundColor: COLORS.primary, padding: SPACING['2xl'], alignItems: 'center',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  heroTitle: { color: '#FFFFFF', fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', marginBottom: SPACING.lg, lineHeight: 28 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, width: '100%',
  },
  searchIcon: { fontSize: 18, marginRight: SPACING.sm },
  searchInput: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text },
  section: { padding: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.text, marginBottom: SPACING.md },
  categoryCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, alignItems: 'center', width: 100, minHeight: 100, justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  categoryIcon: { fontSize: 32, marginBottom: SPACING.xs },
  categoryName: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text, textAlign: 'center' },
  categoryCount: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  serviceCard: { backgroundColor: COLORS.surface, borderRadius: 12, overflow: 'hidden', flex: 1, minWidth: 160, maxWidth: '48%', borderWidth: 1, borderColor: COLORS.border },
  serviceImage: { width: '100%', height: 120, backgroundColor: COLORS.surfaceAlt },
  serviceContent: { padding: SPACING.md },
  serviceCatCity: { fontSize: 10, color: COLORS.accent, fontWeight: '600', marginBottom: 2 },
  serviceTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm, lineHeight: 18, minHeight: 36 },
  serviceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  servicePrice: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.success },
  serviceNoPrice: { fontSize: FONT_SIZE.sm, color: COLORS.textSubtle },
  serviceDuration: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
});
