'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, PageHeader, Button, ErrorState } from '@/components/admin-ui';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Record<string, any>>('/api/admin/settings').then((r) => {
      if (r.success && r.data) setSettings(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }, []);

  async function save(key: string, value: any) {
    setSaving(key);
    const r = await apiFetch(`/api/admin/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
    setSaving(null);
    if (r.success) {
      setSettings({ ...settings, [key]: value });
      alert(`'${key}' kaydedildi`);
    } else {
      alert('Hata: ' + (r.message || 'Bilinmeyen'));
    }
  }

  if (error) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="Ayarlar" subtitle="Platform genel ayarları" />

      <Card title="Komisyon Oranı">
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0 }}>
          Her rezervasyondan kesilen platform komisyonu oranı (0-1 arası, örn: 0.10 = %10).
        </p>
        <CommissionEditor
          value={typeof settings.commission_rate === 'number' ? settings.commission_rate : 0.10}
          saving={saving === 'commission_rate'}
          onSave={(v) => save('commission_rate', v)}
        />
      </Card>

      <Card title="İptal Politikası">
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0 }}>
          Ücretsiz iptal için rezervasyon başlangıcı öncesi minimum saat sayısı.
        </p>
        <CancelHoursEditor
          value={typeof settings.cancel_policy_hours === 'number' ? settings.cancel_policy_hours : 24}
          saving={saving === 'cancel_policy_hours'}
          onSave={(v) => save('cancel_policy_hours', v)}
        />
      </Card>

      <Card title="İptal Politikası Metni">
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0 }}>
          Kullanıcılara gösterilen iptal politikası metni.
        </p>
        <CancelTextEditor
          value={typeof settings.cancel_policy_text === 'string' ? settings.cancel_policy_text : ''}
          saving={saving === 'cancel_policy_text'}
          onSave={(v) => save('cancel_policy_text', v)}
        />
      </Card>
    </>
  );
}

function CommissionEditor({ value, saving, onSave }: { value: number; saving: boolean; onSave: (v: number) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <input
        type="number" step="0.01" min="0" max="1" value={v}
        onChange={(e) => setV(parseFloat(e.target.value) || 0)}
        style={{ width: 120, padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}
      />
      <span style={{ fontSize: '0.9rem', color: '#475569' }}>= {(v * 100).toFixed(1)}%</span>
      <Button onClick={() => onSave(v)} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
    </div>
  );
}

function CancelHoursEditor({ value, saving, onSave }: { value: number; saving: boolean; onSave: (v: number) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <input
        type="number" min="0" max="168" value={v}
        onChange={(e) => setV(parseInt(e.target.value) || 0)}
        style={{ width: 120, padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4 }}
      />
      <span style={{ fontSize: '0.9rem', color: '#475569' }}>saat</span>
      <Button onClick={() => onSave(v)} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
    </div>
  );
}

function CancelTextEditor({ value, saving, onSave }: { value: string; saving: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        rows={4}
        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.9rem', resize: 'vertical' }}
      />
      <div style={{ marginTop: '0.5rem' }}>
        <Button onClick={() => onSave(v)} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
      </div>
    </div>
  );
}
