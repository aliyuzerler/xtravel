'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, StatCard, PageHeader, ErrorState, formatPrice } from '@/components/admin-ui';

interface Stats {
  totalUsers: number;
  totalProviders: number;
  totalServices: number;
  publishedServices: number;
  pendingProviders: number;
  pendingServices: number;
  totalReservations: number;
  activeReservations: number;
  totalRevenue: number;
  monthly: Array<{ label: string; year: number; month: number; reservations: number; revenue: number }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Stats>('/api/admin/dashboard/stats').then((r) => {
      if (r.success && r.data) setStats(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!stats) return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;

  const maxReservations = Math.max(...stats.monthly.map(m => m.reservations), 1);
  const maxRevenue = Math.max(...stats.monthly.map(m => m.revenue), 1);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Platform genel durumu" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Toplam Kullanıcı" value={stats.totalUsers} color="#0ea5e9" />
        <StatCard label="Sağlayıcı" value={stats.totalProviders} hint={`${stats.pendingProviders} onay bekliyor`} color="#8b5cf6" />
        <StatCard label="Hizmet (yayında)" value={stats.publishedServices} hint={`Toplam ${stats.totalServices}, ${stats.pendingServices} onay bekliyor`} color="#16a34a" />
        <StatCard label="Rezervasyon" value={stats.totalReservations} hint={`${stats.activeReservations} aktif`} color="#f59e0b" />
        <StatCard label="Toplam Ciro" value={formatPrice(stats.totalRevenue)} hint="Captured ödemeler" color="#dc2626" />
      </div>

      <Card title="Son 6 Ay — Rezervasyon & Ciro">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: 240, padding: '0 1rem' }}>
          {stats.monthly.map((m) => (
            <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 600 }}>
                {m.reservations}
              </div>
              <div
                style={{
                  width: '100%',
                  background: 'linear-gradient(180deg, #0ea5e9, #0284c7)',
                  borderRadius: '4px 4px 0 0',
                  height: `${(m.reservations / maxReservations) * 180}px`,
                  minHeight: m.reservations > 0 ? '4px' : '0',
                  position: 'relative',
                }}
                title={`${m.reservations} rezervasyon, ${formatPrice(m.revenue)}`}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: m.revenue > 0 ? 'linear-gradient(180deg, transparent 50%, rgba(220, 38, 38, 0.6) 50%)' : undefined,
                  borderRadius: '4px 4px 0 0',
                }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{m.label}</div>
              <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>
                {formatPrice(m.revenue)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: 4, fontSize: '0.8rem', color: '#475569', display: 'flex', gap: '1.5rem' }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#0ea5e9', borderRadius: 2, verticalAlign: 'middle' }}></span> Rezervasyon sayısı</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(220, 38, 38, 0.6)', borderRadius: 2, verticalAlign: 'middle' }}></span> Ciro (TRY)</span>
        </div>
      </Card>

      <Card title="Bekleyen İşlemler">
        <div style={{ display: 'flex', gap: '1rem' }}>
          <PendingCard label="Sağlayıcı başvurusu" count={stats.pendingProviders} href="/admin/providers?status=pending" color="#8b5cf6" />
          <PendingCard label="Hizmet onayı" count={stats.pendingServices} href="/admin/services?status=pending_approval" color="#f59e0b" />
        </div>
      </Card>
    </>
  );
}

function PendingCard({ label, count, href, color }: { label: string; count: number; href: string; color: string }) {
  return (
    <a href={href} style={{
      flex: 1,
      display: 'block',
      padding: '1rem 1.25rem',
      background: '#f8fafc',
      borderRadius: 6,
      textDecoration: 'none',
      border: `1px solid ${color}33`,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{count} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 400 }}>bekleyen</span></div>
    </a>
  );
}
