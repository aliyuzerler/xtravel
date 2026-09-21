'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, StatCard, PageHeader, ErrorState } from '@/components/admin-ui';

interface ProviderStats {
  services: { draft: number; pending: number; published: number; rejected: number; paused: number; total: number };
  activeReservations: number;
}

export default function ProviderDashboardPage() {
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ProviderStats>('/api/provider/dashboard/stats').then((r) => {
      if (r.success && r.data) setStats(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!stats) return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Hizmetlerinizin özeti" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Yayında" value={stats.services.published} color="#16a34a" />
        <StatCard label="Taslak" value={stats.services.draft} color="#64748b" />
        <StatCard label="Onay bekleyen" value={stats.services.pending} color="#f59e0b" />
        <StatCard label="Reddedilen" value={stats.services.rejected} color="#dc2626" />
        <StatCard label="Aktif rezervasyon" value={stats.activeReservations} color="#0ea5e9" />
      </div>

      <Card title="Hızlı İşlemler">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a href="/provider/new-service" style={actionBtn('#16a34a')}>➕ Yeni Hizmet Oluştur</a>
          <a href="/provider/services" style={actionBtn('#0ea5e9')}>🎯 Hizmetlerimi Yönet</a>
          <a href="/provider/reservations" style={actionBtn('#f59e0b')}>📅 Gelen Rezervasyonlar</a>
        </div>
      </Card>
    </>
  );
}

function actionBtn(bg: string): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '0.75rem 1.25rem',
    background: bg,
    color: 'white',
    textDecoration: 'none',
    borderRadius: 6,
    fontWeight: 500,
  };
}
