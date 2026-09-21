/**
 * Arama ekranı — debounced search + filtreler.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Image, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { apiFetch } from '@/lib/api';
import { EmptyState, Skeleton, Button } from '@/components/ui';
import { formatPrice } from '@/lib/helpers';

interface ServiceItem {
  id: string; title: string; slug: string; durationHours: number | null; startingPrice: number | null;
  category: { name: string; slug: string }; city: { name: string; slug: string };
  images: Array<{ imageUrl: string }>;
}
interface Paginated { items: ServiceItem[]; meta: { page: number; totalPages: number; totalItems: number } }
interface City { id: string; name: string; slug: string }
interface Category { id: string; name: string; slug: string }

const SORT_OPTIONS = [
  { label: 'En yeni', value: '' },
  { label: 'Fiyat (artan)', value: 'price_asc' },
  { label: 'Fiyat (azalan)', value: 'price_desc' },
  { label: 'Popüler', value: 'popular' },
];

export function SearchScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('');
  const [data, setData] = useState<Paginated | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<City[]>('/cities'), apiFetch<Category[]>('/categories')]).then(([c, cat]) => {
      if (c.success) setCities(c.data || []);
      if (cat.success) setCategories(cat.data || []);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (city) params.set('city', city);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    apiFetch<Paginated>(`/services?${params.toString()}`).then((r) => {
      setData(r.success && r.data ? r.data : null);
      setLoading(false);
    });
  }, [debouncedSearch, city, category, sort, page]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="🔍 Hizmet ara..."
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilterModal(true)}>
          <Text style={styles.filterBtnText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.resultCount}>{data?.meta.totalItems || 0} hizmet</Text>
        <Text style={styles.sortLabel}>Sıralama: {SORT_OPTIONS.find(s => s.value === sort)?.label}</Text>
      </View>

      {loading ? (
        <View style={{ padding: SPACING.lg }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={120} style={{ marginBottom: SPACING.md }} />)}</View>
      ) : data && data.items.length > 0 ? (
        <FlatList
          data={data.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: SPACING.md, paddingHorizontal: SPACING.lg }}
          contentContainerStyle={{ gap: SPACING.md, paddingBottom: SPACING.lg }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ServiceDetail', { slug: item.slug })}>
              {item.images?.[0]?.imageUrl ? (
                <Image source={{ uri: item.images[0].imageUrl }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: COLORS.surfaceAlt, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 24 }}>🎯</Text></View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardCatCity}>{item.category.name}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardPrice}>{item.startingPrice != null ? formatPrice(item.startingPrice) : 'Fiyat yok'}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <EmptyState icon="🔍" message="Hizmet bulunamadı" actionLabel="Filtreleri Temizle" onAction={() => { setCity(''); setCategory(''); setSort(''); setSearch(''); }} />
      )}

      {/* Filter modal */}
      <Modal visible={showFilterModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filtreler</Text>

            <Text style={styles.filterLabel}>Şehir</Text>
            <ScrollView style={styles.optionList}>
              <FilterOption label="Tüm şehirler" selected={!city} onPress={() => setCity('')} />
              {cities.map((c) => <FilterOption key={c.id} label={c.name} selected={city === c.slug} onPress={() => setCity(c.slug)} />)}
            </ScrollView>

            <Text style={styles.filterLabel}>Kategori</Text>
            <ScrollView style={styles.optionList}>
              <FilterOption label="Tüm kategoriler" selected={!category} onPress={() => setCategory('')} />
              {categories.map((c) => <FilterOption key={c.id} label={c.name} selected={category === c.slug} onPress={() => setCategory(c.slug)} />)}
            </ScrollView>

            <Text style={styles.filterLabel}>Sıralama</Text>
            <View style={styles.optionList}>
              {SORT_OPTIONS.map((s) => <FilterOption key={s.value} label={s.label} selected={sort === s.value} onPress={() => setSort(s.value)} />)}
            </View>

            <View style={styles.modalFooter}>
              <Button title="Temizle" variant="ghost" onPress={() => { setCity(''); setCategory(''); setSort(''); }} style={{ flex: 1 }} />
              <Button title="Uygula" variant="accent" onPress={() => setShowFilterModal(false)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FilterOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.option, selected && styles.optionSelected]}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
      {selected && <Text style={styles.optionCheck}>✓</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchRow: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.lg, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, backgroundColor: COLORS.background },
  filterBtn: { width: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  filterBtnText: { fontSize: 20 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.sm },
  resultCount: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text },
  sortLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  card: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, overflow: 'hidden', maxWidth: '48%', borderWidth: 1, borderColor: COLORS.border },
  cardImage: { width: '100%', height: 120 },
  cardBody: { padding: SPACING.sm },
  cardCatCity: { fontSize: 10, color: COLORS.accent, fontWeight: '600', marginBottom: 2 },
  cardTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: 4, lineHeight: 16, minHeight: 32 },
  cardPrice: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.success },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.lg, maxHeight: '80%' },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.text, marginBottom: SPACING.md },
  filterLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.xs },
  optionList: { maxHeight: 200, marginBottom: SPACING.sm },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, borderRadius: 6 },
  optionSelected: { backgroundColor: COLORS.accentLight },
  optionText: { fontSize: FONT_SIZE.md, color: COLORS.text },
  optionTextSelected: { color: COLORS.accent, fontWeight: FONT_WEIGHT.semibold },
  optionCheck: { color: COLORS.accent, fontWeight: FONT_WEIGHT.bold },
  modalFooter: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
});
