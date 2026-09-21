'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, Table, PageHeader, StatusBadge, Button, EmptyState, ErrorState, Modal, Input } from '@/components/admin-ui';

interface City {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  _count?: { services: number };
}

export default function AdminCitiesPage() {
  const [items, setItems] = useState<City[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<City | null>(null);

  function load() {
    apiFetch<City[]>('/api/admin/cities').then((r) => {
      if (r.success && r.data) setItems(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }

  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        title="Şehirler"
        subtitle="Tüm Türkiye illeri"
        action={<Button onClick={() => setShowCreate(true)}>+ Yeni Şehir</Button>}
      />

      <Card>
        {error ? <ErrorState message={error} /> :
          items.length === 0 ? <EmptyState message="Şehir yok" /> :
          <Table
            columns={[
              { key: 'name', label: 'Ad' },
              { key: 'slug', label: 'Slug', width: '180px' },
              { key: 'isActive', label: 'Aktif', width: '80px' },
              { key: 'services', label: 'Hizmet', width: '80px' },
              { key: 'actions', label: '', width: '120px' },
            ]}
            rows={items.map((c) => ({
              name: <strong>{c.name}</strong>,
              slug: <code style={{ fontSize: '0.8rem' }}>{c.slug}</code>,
              isActive: <StatusBadge status={c.isActive ? 'active' : 'closed'} />,
              services: <span style={{ color: '#64748b' }}>{c._count?.services ?? 0}</span>,
              actions: <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Düzenle</Button>,
            }))}
          />
        }
      </Card>

      {showCreate && <CreateCityModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
      {editing && <EditCityModal city={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </>
  );
}

function CreateCityModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (name.trim().length < 2) { alert('En az 2 karakter'); return; }
    setLoading(true);
    const r = await apiFetch('/api/admin/cities', { method: 'POST', body: JSON.stringify({ name }) });
    setLoading(false);
    if (r.success) onDone();
    else alert('Hata: ' + (r.message || 'Bilinmeyen'));
  }

  return (
    <Modal title="Yeni Şehir" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div><label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Ad</label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <Button onClick={submit} disabled={loading}>Kaydet</Button>
          <Button variant="ghost" onClick={onClose} disabled={loading}>İptal</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditCityModal({ city, onClose, onDone }: { city: City; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(city.name);
  const [isActive, setIsActive] = useState(city.isActive);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const r = await apiFetch(`/api/admin/cities/${city.id}`, { method: 'PUT', body: JSON.stringify({ name, isActive }) });
    setLoading(false);
    if (r.success) onDone();
    else alert('Hata: ' + (r.message || 'Bilinmeyen'));
  }

  async function del() {
    if (!confirm(`"${city.name}" şehrini silmek istediğinizden emin misiniz?`)) return;
    setLoading(true);
    const r = await apiFetch(`/api/admin/cities/${city.id}`, { method: 'DELETE' });
    setLoading(false);
    if (r.success) onDone();
    else alert('Hata: ' + (r.message || 'Bilinmeyen'));
  }

  return (
    <Modal title={`Düzenle: ${city.name}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div><label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Ad</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Aktif
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <Button onClick={submit} disabled={loading}>Kaydet</Button>
          <Button variant="danger" onClick={del} disabled={loading}>Sil</Button>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Kapat</Button>
        </div>
      </div>
    </Modal>
  );
}
