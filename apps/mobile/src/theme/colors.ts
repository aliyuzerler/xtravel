/**
 * Turizm Pazaryeri — Mobil Tema
 *
 * Renk paleti: Sıcak turizm hissi veren lacivert + turuncu accent.
 * Web tarafındaki paletle uyumlu, mobil için uyarlanmış.
 */

export const COLORS = {
  // Birincil - Lacivert (deniz + gece)
  primary: '#0F2D52',
  primaryHover: '#1E3A6E',
  primaryLight: '#E8EEF7',

  // Accent - Turuncu (güneş + sıcaklık)
  accent: '#F97316',
  accentHover: '#EA580C',
  accentLight: '#FFF3E8',

  // Semantic
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  info: '#0EA5E9',
  infoLight: '#DBEAFE',

  // Nötr
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  textInverse: '#FFFFFF',

  // Özel
  overlay: 'rgba(0, 0, 0, 0.5)',
  skeletonBase: '#E2E8F0',
  skeletonHighlight: '#F1F5F9',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
} as const;

export const FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
