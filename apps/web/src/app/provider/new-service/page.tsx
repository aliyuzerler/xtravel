'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import { Card, PageHeader, Button, Input, ErrorState } from '@/components/admin-ui';

interface City { id: string; name: string }
interface Category { id: string; name: string; iconName: string | null }

interface ImageItem { id?: string; imageUrl: string; sortOrder: number; isMain: boolean; _new?: boolean }
interface PricingItem { id?: string; name: string; price: number; currency: string; unit: string; description: string; isActive: boolean; _new?: boolean }
interface ScheduleItem { id?: string; startAt: string; endAt: string; capacity: number; status: string; bookedCount: number; _new?: boolean; _delete?: boolean }

function NewServiceWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(editId);

  // Form state
  const [form, setForm] = useState({
    title: '', description: '', categoryId: '', cityId: '',
    meetingPoint: '', latitude: '', longitude: '', durationHours: '',
  });
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Bulk schedule state
  const [bulk, setBulk] = useState({
    startDate: '', endDate: '', startTime: '10:00', endTime: '13:00',
    capacity: 10, weekdays: [1, 2, 3, 4, 5, 6, 0],
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/cities').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([c, cat]) => {
      setCities(c.data || []);
      setCategories(cat.data || []);
    });
  }, []);

  // Edit mode: existing service'i yükle
  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    apiFetch<any>(`/api/provider/services/${editId}`).then((r) => {
      if (r.success && r.data) {
        const s = r.data;
        setForm({
          title: s.title || '',
          description: s.description || '',
          categoryId: s.categoryId || '',
          cityId: s.cityId || '',
          meetingPoint: s.meetingPoint || '',
          latitude: s.latitude?.toString() || '',
          longitude: s.longitude?.toString() || '',
          durationHours: s.durationHours?.toString() || '',
        });
        setImages(s.images?.map((i: any) => ({ ...i })) || []);
        setPricing(s.pricing?.map((p: any) => ({ ...p })) || []);
        setSchedules(s.schedules?.map((sch: any) => ({
          ...sch,
          startAt: new Date(sch.startAt).toISOString().slice(0, 16),
          endAt: new Date(sch.endAt).toISOString().slice(0, 16),
        })) || []);
      } else {
        setError(r.message || 'Hizmet yüklenemedi');
      }
    }).finally(() => setLoading(false));
  }, [editId]);

  // Step 1 save
  async function saveStep1(): Promise<string | null> {
    setError(null);
    if (!form.title || form.title.length < 3) { setError('Başlık en az 3 karakter olmalı'); return null; }
    if (!form.description || form.description.length < 10) { setError('Açıklama en az 10 karakter olmalı'); return null; }
    if (!form.categoryId) { setError('Kategori seçin'); return null; }
    if (!form.cityId) { setError('Şehir seçin'); return null; }

    setLoading(true);
    const body = {
      title: form.title,
      description: form.description,
      categoryId: form.categoryId,
      cityId: form.cityId,
      meetingPoint: form.meetingPoint || undefined,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      durationHours: form.durationHours ? parseFloat(form.durationHours) : undefined,
    };
    const r = serviceId
      ? await apiFetch(`/api/provider/services/${serviceId}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiFetch(`/api/provider/services`, { method: 'POST', body: JSON.stringify(body) });

    setLoading(false);
    if (r.success && r.data) {
      const id = (r.data as any).id;
      setServiceId(id);
      return id;
    }
    setError(r.message || 'Kayıt başarısız');
    return null;
  }

  async function goNext() {
    if (step === 1) {
      const id = await saveStep1();
      if (id) setStep(2);
    } else if (step === 2) {
      // Save images
      if (serviceId) {
        setLoading(true);
        for (const img of images.filter(i => i._new)) {
          await apiFetch(`/api/provider/services/${serviceId}/images`, {
            method: 'POST', body: JSON.stringify({ imageUrl: img.imageUrl, isMain: img.isMain, sortOrder: img.sortOrder }),
          });
        }
        setLoading(false);
      }
      setStep(3);
    } else if (step === 3) {
      if (serviceId) {
        setLoading(true);
        for (const p of pricing.filter(p => p._new)) {
          await apiFetch(`/api/provider/services/${serviceId}/pricing`, {
            method: 'POST', body: JSON.stringify({ name: p.name, price: p.price, currency: p.currency, unit: p.unit, description: p.description || undefined, isActive: p.isActive }),
          });
        }
        setLoading(false);
      }
      setStep(4);
    } else if (step === 4) {
      if (serviceId) {
        setLoading(true);
        for (const s of schedules.filter(s => s._new && !s._delete)) {
          await apiFetch(`/api/provider/services/${serviceId}/schedules`, {
            method: 'POST', body: JSON.stringify({ startAt: s.startAt, endAt: s.endAt, capacity: s.capacity }),
          });
        }
        setLoading(false);
      }
      setStep(5);
    }
  }

  async function submitForApproval() {
    if (!serviceId) return;
    setLoading(true);
    const r = await apiFetch(`/api/provider/services/${serviceId}/submit`, { method: 'POST', body: '{}' });
    setLoading(false);
    if (r.success) {
      alert('Hizmet onaya gönderildi! Yönetici onayından sonra yayına alınacaktır.');
      router.push('/provider/services');
    } else {
      setError(r.message || 'Onaya gönderilemedi');
    }
  }

  // Image upload via presigned URL
  async function handleFileUpload(files: FileList) {
    if (!serviceId) { setError('Önce temel bilgileri kaydedin'); return; }
    setLoading(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const contentType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const presign = await apiFetch<{ key: string; uploadUrl: string; publicUrl: string }>(`/api/uploads/presign`, {
        method: 'POST', body: JSON.stringify({ filename: file.name, contentType, size: file.size, folder: 'service-images' }),
      });
      if (!presign.success || !presign.data) {
        setError('Presign hatası: ' + presign.message);
        continue;
      }
      // Upload file via receive endpoint (sandbox)
      const formData = new FormData();
      formData.append('file', file);
      const recvRes = await fetch(`${presign.data.uploadUrl.replace('/../api/uploads/receive', '/api/uploads/receive')}`, {
        method: 'POST', headers: { 'Content-Type': contentType }, body: file,
      });
      if (!recvRes.ok) {
        setError('Yükleme hatası: ' + await recvRes.text());
        continue;
      }
      const recvJson = await recvRes.json();
      const publicUrl = recvJson.data?.publicUrl;
      // Add to images state + mark as _new
      setImages((prev) => {
        const isFirst = prev.length === 0;
        return [...prev, {
          imageUrl: publicUrl, sortOrder: prev.length, isMain: isFirst, _new: true,
        }];
      });
    }
    setLoading(false);
  }

  function makeMain(imgIdx: number) {
    setImages((prev) => prev.map((i, idx) => ({ ...i, isMain: idx === imgIdx })));
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  // Bulk schedule add
  async function bulkAdd() {
    if (!serviceId) { setError('Önce temel bilgileri kaydedin'); return; }
    setLoading(true);
    const r = await apiFetch(`/api/provider/services/${serviceId}/schedules/bulk`, {
      method: 'POST', body: JSON.stringify({
        startDate: bulk.startDate, endDate: bulk.endDate,
        startTime: bulk.startTime, endTime: bulk.endTime,
        capacity: bulk.capacity, weekdays: bulk.weekdays,
      }),
    });
    setLoading(false);
    if (r.success) {
      alert(`${r.data?.created} slot oluşturuldu`);
      // Reload schedules
      const sd = await apiFetch<any>(`/api/provider/services/${serviceId}`);
      if (sd.success && sd.data) {
        setSchedules(sd.data.schedules?.map((s: any) => ({
          ...s,
          startAt: new Date(s.startAt).toISOString().slice(0, 16),
          endAt: new Date(s.endAt).toISOString().slice(0, 16),
        })) || []);
      }
    } else {
      setError(r.message || 'Toplu ekleme hatası');
    }
  }

  if (loading && step === 1 && editId) return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;

  return (
    <>
      <PageHeader
        title={editId ? 'Hizmet Düzenle' : 'Yeni Hizmet'}
        subtitle={serviceId ? `Hizmet ID: ${serviceId.slice(0, 8)}...` : '5 adımlı sihirbaz'}
      />

      {/* Stepper */}
      <div style={{ display: 'flex', marginBottom: '1.5rem', background: 'white', borderRadius: 8, padding: '0.75rem', overflowX: 'auto' }}>
        {[
          { n: 1, label: 'Temel Bilgiler' },
          { n: 2, label: 'Görseller' },
          { n: 3, label: 'Fiyatlar' },
          { n: 4, label: 'Takvim' },
          { n: 5, label: 'Önizleme & Onay' },
        ].map((s) => (
          <div key={s.n} style={{ flex: 1, textAlign: 'center', padding: '0.5rem', position: 'relative' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: step === s.n ? '#0ea5e9' : step > s.n ? '#16a34a' : '#e2e8f0',
              color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.9rem',
            }}>{step > s.n ? '✓' : s.n}</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: step === s.n ? '#0ea5e9' : '#64748b', fontWeight: step === s.n ? 600 : 400 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && <ErrorState message={error} />}

      {/* STEP 1: Temel Bilgiler */}
      {step === 1 && (
        <Card title="1. Temel Bilgiler">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Başlık *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ör: Antalya Eski Şehir Yürüyüşü" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Açıklama * (en az 10 karakter)</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} style={textareaStyle} placeholder="Hizmetinizi detaylıca açıklayın..." />
            </div>
            <div>
              <label style={labelStyle}>Kategori *</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} style={selectStyle}>
                <option value="">Seçin...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Şehir *</label>
              <select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })} style={selectStyle}>
                <option value="">Seçin...</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Buluşma noktası</label>
              <Input value={form.meetingPoint} onChange={(e) => setForm({ ...form, meetingPoint: e.target.value })} placeholder="ör: Kaleiçi kapısı önü" />
            </div>
            <div>
              <label style={labelStyle}>Süre (saat)</label>
              <Input type="number" step="0.5" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })} placeholder="3" />
            </div>
            <div>
              <label style={labelStyle}>Enlem</label>
              <Input type="number" step="0.0001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="36.8841" />
            </div>
            <div>
              <label style={labelStyle}>Boylam</label>
              <Input type="number" step="0.0001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="30.7055" />
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <Button onClick={goNext} disabled={loading}>Kaydet ve Devam →</Button>
          </div>
        </Card>
      )}

      {/* STEP 2: Görseller */}
      {step === 2 && (
        <Card title="2. Görseller">
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0 }}>JPG/PNG/WebP, maksimum 5MB. İlk görsel ana görsel olarak işaretlenir.</p>

          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files); }}
            style={{ border: '2px dashed #cbd5e1', borderRadius: 8, padding: '2rem', textAlign: 'center', marginBottom: '1rem', background: '#f8fafc', cursor: 'pointer' }}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <div style={{ fontSize: '2rem' }}>📸</div>
            <p style={{ margin: '0.5rem 0 0' }}>Sürükleyip bırakın veya tıklayarak seçin</p>
            <input id="fileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
          </div>

          {images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {images.map((img, idx) => (
                <div key={idx} style={{ border: img.isMain ? '2px solid #16a34a' : '1px solid #e2e8f0', borderRadius: 4, padding: '0.25rem', position: 'relative' }}>
                  <img src={img.imageUrl} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 2 }} />
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                    <button onClick={() => makeMain(idx)} style={{ flex: 1, padding: '0.25rem', background: img.isMain ? '#16a34a' : '#e2e8f0', color: img.isMain ? 'white' : '#475569', border: 'none', borderRadius: 2, cursor: 'pointer' }}>
                      {img.isMain ? '✓ Ana' : 'Ana yap'}
                    </button>
                    <button onClick={() => removeImage(idx)} style={{ padding: '0.25rem 0.5rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 2, cursor: 'pointer' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <Button variant="ghost" onClick={() => setStep(1)}>← Geri</Button>
            <Button onClick={goNext} disabled={loading}>Kaydet ve Devam →</Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Fiyatlar */}
      {step === 3 && (
        <Card title="3. Fiyat Varyantları">
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0 }}>Kişi başı (yetişkin, çocuk) veya grup bazlı fiyat ekleyin.</p>

          {pricing.map((p, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'end' }}>
              <div><label style={labelStyle}>Varyant adı</label><Input value={p.name} onChange={(e) => { const arr = [...pricing]; arr[idx] = { ...arr[idx], name: e.target.value, _new: arr[idx]._new ?? !arr[idx].id }; setPricing(arr); }} placeholder="Yetişkin" /></div>
              <div><label style={labelStyle}>Fiyat (₺)</label><Input type="number" value={p.price} onChange={(e) => { const arr = [...pricing]; arr[idx] = { ...arr[idx], price: parseFloat(e.target.value) || 0, _new: arr[idx]._new ?? !arr[idx].id }; setPricing(arr); }} /></div>
              <div>
                <label style={labelStyle}>Birim</label>
                <select value={p.unit} onChange={(e) => { const arr = [...pricing]; arr[idx] = { ...arr[idx], unit: e.target.value, _new: arr[idx]._new ?? !arr[idx].id }; setPricing(arr); }} style={selectStyle}>
                  <option value="per_person">Kişi başı</option>
                  <option value="per_group">Grup</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Aktif</label>
                <input type="checkbox" checked={p.isActive} onChange={(e) => { const arr = [...pricing]; arr[idx] = { ...arr[idx], isActive: e.target.checked, _new: arr[idx]._new ?? !arr[idx].id }; setPricing(arr); }} />
              </div>
              <button onClick={() => setPricing(pricing.filter((_, i) => i !== idx))} style={{ padding: '0.5rem 0.75rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>×</button>
            </div>
          ))}

          <Button variant="ghost" onClick={() => setPricing([...pricing, { name: '', price: 0, currency: 'TRY', unit: 'per_person', description: '', isActive: true, _new: true }])}>+ Varyant Ekle</Button>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <Button variant="ghost" onClick={() => setStep(2)}>← Geri</Button>
            <Button onClick={goNext} disabled={loading}>Kaydet ve Devam →</Button>
          </div>
        </Card>
      )}

      {/* STEP 4: Takvim */}
      {step === 4 && (
        <Card title="4. Takvim Slotları">
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0 }}>Gelecek tarihli açık slotlar ekleyin. Toplu eklemeyi kullanarak haftalar boyunca her gün için slot oluşturabilirsiniz.</p>

          {/* Tek tek ekle */}
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 6, marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>Tek slot ekle</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div><label style={labelStyle}>Başlangıç</label><Input type="datetime-local" value={schedules.find(s => s._new)?.startAt || ''} onChange={(e) => {
                const arr = [...schedules];
                const last = arr[arr.length - 1];
                if (last && last._new) {
                  last.startAt = e.target.value;
                  setSchedules([...arr]);
                } else {
                  setSchedules([...arr, { startAt: e.target.value, endAt: '', capacity: 10, status: 'open', bookedCount: 0, _new: true }]);
                }
              }} /></div>
              <div><label style={labelStyle}>Bitiş</label><Input type="datetime-local" value={schedules.find(s => s._new)?.endAt || ''} onChange={(e) => {
                const arr = [...schedules];
                const last = arr[arr.length - 1];
                if (last && last._new) { last.endAt = e.target.value; setSchedules([...arr]); }
              }} /></div>
              <div><label style={labelStyle}>Kapasite</label><Input type="number" value={schedules.find(s => s._new)?.capacity || 10} onChange={(e) => {
                const arr = [...schedules];
                const last = arr[arr.length - 1];
                if (last && last._new) { last.capacity = parseInt(e.target.value) || 1; setSchedules([...arr]); }
              }} /></div>
              <Button variant="ghost" size="sm" onClick={() => { const arr = [...schedules]; const last = arr[arr.length - 1]; if (last && last._new) { last._new = false; setSchedules([...arr]); } }}>Ekle</Button>
            </div>
          </div>

          {/* Toplu ekle */}
          <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: 6, marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>Toplu gün ekle</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div><label style={labelStyle}>Başlangıç tarihi</label><Input type="date" value={bulk.startDate} onChange={(e) => setBulk({ ...bulk, startDate: e.target.value })} /></div>
              <div><label style={labelStyle}>Bitiş tarihi</label><Input type="date" value={bulk.endDate} onChange={(e) => setBulk({ ...bulk, endDate: e.target.value })} /></div>
              <div><label style={labelStyle}>Başlangıç saati</label><Input type="time" value={bulk.startTime} onChange={(e) => setBulk({ ...bulk, startTime: e.target.value })} /></div>
              <div><label style={labelStyle}>Bitiş saati</label><Input type="time" value={bulk.endTime} onChange={(e) => setBulk({ ...bulk, endTime: e.target.value })} /></div>
              <div><label style={labelStyle}>Kapasite</label><Input type="number" value={bulk.capacity} onChange={(e) => setBulk({ ...bulk, capacity: parseInt(e.target.value) || 1 })} /></div>
              <Button onClick={bulkAdd} disabled={loading}>Toplu Ekle</Button>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
              Haftanın günleri: {['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'].map((d, i) => (
                <label key={i} style={{ marginRight: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={bulk.weekdays.includes(i)} onChange={(e) => {
                    const wd = e.target.checked ? [...bulk.weekdays, i] : bulk.weekdays.filter((x) => x !== i);
                    setBulk({ ...bulk, weekdays: wd.sort() });
                  }} /> {d}
                </label>
              ))}
            </div>
          </div>

          {/* Mevcut slotlar */}
          {schedules.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 0.5rem' }}>Mevcut slotlar ({schedules.length})</h4>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {schedules.map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', background: '#f8fafc', marginBottom: '0.25rem', borderRadius: 4, fontSize: '0.85rem', alignItems: 'center' }}>
                    <span>📅 {new Date(s.startAt).toLocaleString('tr-TR')}</span>
                    <span style={{ color: '#64748b' }}>→ {new Date(s.endAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>👥 {s.bookedCount}/{s.capacity}</span>
                    <button onClick={() => setSchedules(schedules.filter((_, i) => i !== idx))} style={{ marginLeft: 'auto', padding: '0.25rem 0.5rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 2, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <Button variant="ghost" onClick={() => setStep(3)}>← Geri</Button>
            <Button onClick={goNext} disabled={loading}>Kaydet ve Devam →</Button>
          </div>
        </Card>
      )}

      {/* STEP 5: Önizleme */}
      {step === 5 && (
        <Card title="5. Önizleme & Onaya Gönder">
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>{form.title}</h3>
            <p style={{ color: '#334155', whiteSpace: 'pre-wrap' }}>{form.description}</p>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
              📍 {cities.find(c => c.id === form.cityId)?.name} · 🏷 {categories.find(c => c.id === form.categoryId)?.name}
              {form.durationHours && ` · ⏱ ${form.durationHours} saat`}
            </div>
          </div>

          {images.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto' }}>
              {images.map((img, idx) => (
                <img key={idx} src={img.imageUrl} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 4, border: img.isMain ? '2px solid #16a34a' : '1px solid #e2e8f0' }} />
              ))}
            </div>
          )}

          {pricing.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem' }}>Fiyatlar</h4>
              {pricing.map((p, idx) => (
                <div key={idx} style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: 4, marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                  <strong>{p.name}</strong> — {p.price}₺ ({p.unit === 'per_person' ? 'kişi başı' : 'grup'})
                </div>
              ))}
            </div>
          )}

          {schedules.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem' }}>Takvim ({schedules.length} slot)</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>İlk 5: {schedules.slice(0, 5).map(s => new Date(s.startAt).toLocaleDateString('tr-TR')).join(', ')}</p>
            </div>
          )}

          <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: 4, marginBottom: '1rem', fontSize: '0.85rem', color: '#92400e' }}>
            ⚠️ Onaya gönderdiğinizde hizmet platform yöneticisi tarafından incelenecektir. Onaylanana kadar public listede görünmeyecektir.
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="ghost" onClick={() => setStep(4)}>← Geri</Button>
            <Button variant="success" onClick={submitForApproval} disabled={loading}>✓ Onaya Gönder</Button>
          </div>
        </Card>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem', color: '#475569' };
const selectStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.9rem', background: 'white' };
const textareaStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' };

export default function NewServicePage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>}>
      <NewServiceWizard />
    </Suspense>
  );
}
