'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { Card, Table, PageHeader, StatusBadge, Button, EmptyState, ErrorState, Modal, Input } from '@/components/admin-ui';

interface Category {
  id: string;
  name: string;
  slug: string;
  iconName: string | null;
  isActive: boolean;
  sortOrder: number;
  _count?: { services: number };
}

export default function AdminCategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  function load() {
    apiFetch<Category[]>('/api/admin/categories').then((r) => {
      if (r.success && r.data) setItems(r.data);
      else setError(r.message || 'Yüklenemedi');
    });
  }

  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        title="Kategoriler"
        subtitle="Hizmet kategorilerini yönet"
        action={<Button onClick={() => setShowCreate(true)}>+ Yeni Kategori</Button>}
      />

      <Card>
        {error ? <ErrorState message={error} /> :
          items.length === 0 ? <EmptyState message="Kategori yok" /> :
          <Table
            columns={[
              { key: 'name', label: 'Ad' },
              { key: 'slug', label: 'Slug', width: '180px' },
              { key: 'iconName', label: 'İkon', width: '120px' },
              { key: 'sortOrder', label: 'Sıra', width: '80px' },
              { key: 'isActive', label: 'Aktif', width: '80px' },
              { key: 'services', label: 'Hizmet', width: '80px' },
              { key: 'actions', label: '', width: '120px' },
            ]}
            rows={items.map((c) => ({
              name: <strong>{c.name}</strong>,
              slug: <code style={{ fontSize: '0.8rem' }}>{c.slug}</code>,
              iconName: c.iconName || '-',
              sortOrder: c.sortOrder,
              isActive: <StatusBadge status={c.isActive ? 'active' : 'closed'} />,
              services: <span style={{ color: '#64748b' }}>{c._count?.services ?? 0}</span>,
              actions: <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Düzenle</Button>,
            }))}
          />
        }
      </Card>

      {showCreate && <CreateCategoryModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
      {editing && <EditCategoryModal category={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </>
  );
}

function CreateCategoryModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [iconName, setIconName] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (name.trim().length < 2) { alert('En az 2 karakter'); return; }
    setLoading(true);
    const r = await apiFetch('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name, iconName: iconName || undefined, sortOrder }),
    });
    setLoading(false);
    if (r.success) onDone();
    else alert('Hata: ' + (r.message || 'Bilinmeyen'));
  }

  return (
    <Modal title="Yeni Kategori" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div><label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Ad</label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div><label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>İkon adı (opsiyonel)</label><Input value={iconName} onChange={(e) => setIconName(e.target.value)} placeholder="landmark / ship / mountain..." /></div>
        <div><label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Sıralama</label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} /></div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <Button onClick={submit} disabled={loading}>Kaydet</Button>
          <Button variant="ghost" onClick={onClose} disabled={loading}>İptal</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditCategoryModal({ category, onClose, onDone }: { category: Category; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(category.name);
  const [iconName, setIconName] = useState(category.iconName || '');
  const [sortOrder, setSortOrder] = useState(category.sortOrder);
  const [isActive, setIsActive] = useState(category.isActive);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const r = await apiFetch(`/api/admin/categories/${category.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        iconName: iconName || undefined,
        sortOrder,
        isActive,
      }),
    });
    setLoading(false);
    if (r.success) onDone();
    else alert('Hata: ' + (r.message || 'Bilinmeyen'));
  }

  async function del() {
    if (!confirm(`"${category.name}" kategorisini silmek istediğinizden emin misiniz?`)) return;
    setLoading(true);
    const r = await apiFetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
    setLoading(false);
    if (r.success) onDone();
    else alert('Hata: ' + (r.message || 'Bilinmeyen'));
  }

  return (
    <Modal title={`Düzenle: ${category.name}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div><label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Ad</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>İkon adı</label><Input value={iconName} onChange={(e) => setIconName(e.target.value)} /></div>
        <div><label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Sıralama</label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} /></div>
        <div>
          <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Aktif
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <Button onClick={submit} disabled={loading}>Kaydet</Button>
          <Button variant="danger" onClick={del} disabled={loading}>Sil</Button>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Kapat</Button>
        </div>
        {(category._count?.services ?? 0) > 0 && (
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
            ⚠️ Bu kategoriye ait {category._count?.services} hizmet var. Aktif hizmet varsa pasife alınamaz veya silinemez.
          </p>
        )}
      </div>
    </Modal>
  );
}
