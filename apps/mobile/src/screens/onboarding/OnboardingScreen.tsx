/**
 * Onboarding — 3 slayt, uygulama ilk açılışta gösterilir.
 * Bitince "Başla" butonu → Login ekranına yönlendirir.
 * AsyncStorage'a onboarding_done=true kaydedilir.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '@/theme';
import { Button } from '@/components/ui';

const ONBOARDING_KEY = 'tp_onboarding_done';

const SLIDES = [
  {
    icon: '🌍',
    title: 'Türkiye\'nin her şehrinde',
    desc: 'Kültür turları, gemi gezileri, doğa yürüyüşleri ve daha fazlası — tek uygulamada.',
    color: COLORS.primary,
  },
  {
    icon: '💳',
    title: 'Güvenle rezerve et',
    desc: 'iyzico güvencesiyle ödeme, 24 saat öncesine kadar ücretsiz iptal.',
    color: COLORS.accent,
  },
  {
    icon: '🔔',
    title: 'Bildirimlerle takip et',
    desc: 'Rezervasyon onayı, hatırlatmalar ve anlık durum güncellemeleri cebinde.',
    color: COLORS.info,
  },
];

export function OnboardingScreen() {
  const [idx, setIdx] = useState(0);
  const navigation = useNavigation<any>();
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  async function next() {
    if (!isLast) {
      setIdx(idx + 1);
    } else {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      navigation.replace('Login');
    }
  }

  async function skip() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.replace('Login');
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: slide.color }]}>
      <View style={styles.skipRow}>
        <TouchableOpacity onPress={skip}>
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>{slide.icon}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>
      </ScrollView>

      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: i === idx ? '#FFFFFF' : 'rgba(255,255,255,0.3)' }]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          title={isLast ? 'Başla' : 'Devam'}
          onPress={next}
          variant="ghost"
          fullWidth
          style={{ backgroundColor: '#FFFFFF' }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: SPACING.lg },
  skipText: { color: '#FFFFFF', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['2xl'] },
  icon: { fontSize: 80, marginBottom: SPACING['2xl'] },
  title: {
    color: '#FFFFFF', fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center', marginBottom: SPACING.md,
  },
  desc: {
    color: 'rgba(255,255,255,0.9)', fontSize: FONT_SIZE.lg, textAlign: 'center',
    lineHeight: 26,
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', padding: SPACING.lg },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
  footer: { padding: SPACING.lg },
});
