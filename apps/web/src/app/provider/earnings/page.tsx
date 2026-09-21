'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, StatCard, PageHeader, ErrorState, formatPrice } from '@/components/admin-ui';

interface Earnings {
  thisMonth: { reservationCount: number; grossRevenue: number; commission: number; netEarnings: number; byService: Array<{ serviceId: string; serviceTitle: string; count: number; revenue: number }> };
  lastMonth: { reservationCount: number; grossRevenue: number; commission: number; netEarnings: number; byService: Array<{ serviceId: string; serviceTitle: string; count: number; revenue: number }> };
  total: { reservationCount: number; grossRevenue: number; commission: number; netEarnings: number; byService: Array<{ serviceId: string; serviceTitle: string; count: number; revenue: number }> };
  commissionRate: number;
}

export default function ProviderEarningsPage() {
  const [data, setData] = useState<Earnings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Earnings>('/api/provider/earnings').then((r) => {
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;

  const now = new Date();
  const thisMonthName = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthName = lastMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <>
      <PageHeader title="Kazançlar" subtitle={`Komisyon oranı: %${(data.commissionRate * 100).toFixed(1)}`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label={thisMonthName} value={formatPrice(data.thisMonth.netEarnings)} hint={`${data.thisMonth.reservationCount} rezervasyon · brüt ${formatPrice(data.thisMonth.grossRevenue)}`} color="#16a34a" />
        <StatCard label={lastMonthName} value={formatPrice(data.lastMonth.netEarnings)} hint={`${data.lastMonth.reservationCount} rezervasyon · brüt ${formatPrice(data.lastMonth.grossRevenue)}`} color="#0ea5e9" />
        <StatCard label="Tüm zamanlar (net)" value={formatPrice(data.total.netEarnings)} hint={`${data.total.reservationCount} rezervasyon`} color="#8b5cf6" />
      </div>

      <Card title="Bu Ay Hizmet Başına">
        {data.thisMonth.byService.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Bu ay tamamlanan rezervasyon yok</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>Hizmet</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 1rem', fontWeight: 600 }}>Rezervasyon</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 1rem', fontWeight: 600 }}>Brüt</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 1rem', fontWeight: 600 }}>Komisyon</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 1rem', fontWeight: 600 }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {data.thisMonth.byService.map((s) => (
                <tr key={s.serviceId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{s.serviceTitle}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem 1rem' }}>{s.count}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem 1rem' }}>{formatPrice(s.revenue)}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem 1rem', color: '#dc2626' }}>−{formatPrice(s.revenue * data.commissionRate)}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem 1rem', fontWeight: 600, color: '#16a34a' }}>{formatPrice(s.revenue * (1 - data.commissionRate))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
