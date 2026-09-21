/**
 * Ortak UI bileşenleri — React Native (Expo) için.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from '@/theme';

// ----- Button -----
type ButtonVariant = 'primary' | 'accent' | 'danger' | 'success' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: string;
  style?: any;
}

export function Button({
  title, onPress, variant = 'primary', size = 'md',
  disabled, loading, fullWidth, icon, style,
}: ButtonProps) {
  const bg = disabled ? '#94A3B8' : ({
    primary: COLORS.primary,
    accent: COLORS.accent,
    danger: COLORS.danger,
    success: COLORS.success,
    ghost: 'transparent',
  } as Record<ButtonVariant, string>)[variant];
  const color = disabled ? '#FFFFFF' : (variant === 'ghost' ? COLORS.primary : '#FFFFFF');
  const borderColor = variant === 'ghost' ? COLORS.primary : 'transparent';
  const padding = size === 'sm' ? SPACING.sm : size === 'lg' ? SPACING.lg : SPACING.md;
  const fontSize = size === 'sm' ? FONT_SIZE.sm : size === 'lg' ? FONT_SIZE.lg : FONT_SIZE.base;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: bg, borderColor, paddingVertical: padding, paddingHorizontal: padding * 1.5 },
        fullWidth && { width: '100%' },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          {icon && <Text style={{ marginRight: SPACING.xs, fontSize }}>{icon}</Text>}
          <Text style={{ color, fontSize, fontWeight: FONT_WEIGHT.semibold }}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ----- Card -----
export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ----- Input -----
interface InputProps {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  error?: string;
  multiline?: boolean;
}

export function Input(props: InputProps) {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      {props.label && <Text style={styles.label}>{props.label}</Text>}
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType || 'default'}
        autoCapitalize={props.autoCapitalize || 'none'}
        multiline={props.multiline}
        style={[styles.input, props.error ? { borderColor: COLORS.danger } : null]}
      />
      {props.error && <Text style={styles.errorText}>{props.error}</Text>}
    </View>
  );
}

// ----- Badge -----
export function Badge({ label, color = COLORS.info }: { label: string; color?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ----- Status Badge -----
export function StatusBadge({ status }: { status: string }) {
  return <Badge label={statusLabel(status)} color={statusColor(status)} />;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_payment: 'Ödeme Bekliyor', confirmed: 'Onaylı', completed: 'Tamamlandı',
    cancelled: 'İptal', refunded: 'İade Edildi', published: 'Yayında',
    pending_approval: 'Onay Bekliyor', rejected: 'Reddedildi', draft: 'Taslak',
    paused: 'Duraklatıldı', active: 'Aktif', banned: 'Banlı', pending: 'Beklemede',
    approved: 'Onaylı', suspended: 'Askıya Alınmış', captured: 'Tahsil Edildi',
    initiated: 'Başlatıldı', failed: 'Başarısız',
  };
  return map[status] || status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: COLORS.success, approved: COLORS.success, published: COLORS.success,
    confirmed: COLORS.success, completed: COLORS.success, captured: COLORS.success, open: COLORS.success,
    pending: COLORS.warning, pending_approval: COLORS.warning, pending_payment: COLORS.warning,
    initiated: COLORS.warning, authorized: COLORS.warning,
    banned: COLORS.danger, rejected: COLORS.danger, suspended: COLORS.danger,
    failed: COLORS.danger, cancelled: COLORS.danger, closed: COLORS.danger,
    draft: COLORS.textSubtle, refunded: COLORS.info, partially_refunded: COLORS.info,
  };
  return map[status] || COLORS.textSubtle;
}

// ----- Empty State -----
export function EmptyState({ icon = '📭', message, actionLabel, onAction }: {
  icon?: string; message: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 48, marginBottom: SPACING.sm }}>{icon}</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {actionLabel && onAction && (
        <Button title={actionLabel} variant="ghost" onPress={onAction} style={{ marginTop: SPACING.md }} />
      )}
    </View>
  );
}

// ----- Error State -----
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorState}>
      <Text style={{ fontSize: 32, marginBottom: SPACING.sm }}>⚠️</Text>
      <Text style={styles.errorStateText}>{message}</Text>
      {onRetry && <Button title="Tekrar Dene" variant="ghost" onPress={onRetry} style={{ marginTop: SPACING.md }} />}
    </View>
  );
}

// ----- Skeleton -----
export function Skeleton({ width = '100%', height = 20, style }: { width?: number | string; height?: number; style?: any }) {
  return <View style={[styles.skeleton, { width, height }, style]} />;
}

// ----- Loading Screen -----
export function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={{ marginTop: SPACING.md, color: COLORS.textMuted }}>Yükleniyor...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 44,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.base,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    minHeight: 48,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
  },
  badge: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING['4xl'],
    paddingHorizontal: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  errorState: {
    padding: SPACING.xl,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorStateText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: COLORS.skeletonBase,
    borderRadius: RADIUS.sm,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});
