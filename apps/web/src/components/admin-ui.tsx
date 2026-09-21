/** Shared admin UI components and helpers */
import React from 'react';

export function Card({ children, title, action }: { children: React.ReactNode; title?: string; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          {title && <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>{title}</h2>}
          {action}
        </div>
      )}
      <div style={{ padding: '1.5rem' }}>{children}</div>
    </div>
  );
}

export function StatCard({ label, value, hint, color = '#0ea5e9' }: { label: string; value: string | number; hint?: string; color?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: '1.25rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem', color: '#0f172a' }}>{value}</div>
      {hint && <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>{hint}</div>}
    </div>
  );
}

export function Table({ columns, rows }: { columns: Array<{ key: string; label: string; width?: string }>; rows: Array<Record<string, React.ReactNode>> }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                Kayıt bulunamadı
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                {columns.map((c) => (
                  <td key={c.key} style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'yellow' | 'red' | 'blue' | 'gray' }) {
  const colors = {
    green: { bg: '#dcfce7', text: '#166534' },
    yellow: { bg: '#fef3c7', text: '#92400e' },
    red: { bg: '#fee2e2', text: '#991b1b' },
    blue: { bg: '#dbeafe', text: '#1e40af' },
    gray: { bg: '#f1f5f9', text: '#475569' },
  };
  const c = colors[color];
  return (
    <span style={{ background: c.bg, color: c.text, padding: '0.25rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' }}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'gray'> = {
    active: 'green', approved: 'green', published: 'green', confirmed: 'green', completed: 'green', captured: 'green', open: 'green',
    pending: 'yellow', pending_approval: 'yellow', pending_payment: 'yellow', initiated: 'yellow', authorized: 'yellow',
    banned: 'red', rejected: 'red', suspended: 'red', failed: 'red', cancelled: 'red', closed: 'red',
    draft: 'gray', refunded: 'blue', partially_refunded: 'blue',
  };
  return <Badge color={map[status] || 'gray'}>{status}</Badge>;
}

export function Button({ children, onClick, variant = 'primary', disabled, size = 'md' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'danger' | 'ghost' | 'success'; disabled?: boolean; size?: 'sm' | 'md' }) {
  const variants = {
    primary: { background: '#0ea5e9', color: 'white', border: 'none' },
    danger: { background: '#dc2626', color: 'white', border: 'none' },
    success: { background: '#16a34a', color: 'white', border: 'none' },
    ghost: { background: 'transparent', color: '#0ea5e9', border: '1px solid #0ea5e9' },
  };
  const sizes = {
    sm: { padding: '0.375rem 0.75rem', fontSize: '0.8rem' },
    md: { padding: '0.5rem 1rem', fontSize: '0.9rem' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant],
        ...sizes[size],
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0.25rem 0 0' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '0.5rem 0.75rem',
        border: '1px solid #e2e8f0',
        borderRadius: 4,
        fontSize: '0.9rem',
        ...(props.style || {}),
      }}
    />
  );
}

export function SearchBar({ value, onChange, placeholder = 'Ara...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '300px',
        padding: '0.5rem 0.75rem',
        border: '1px solid #e2e8f0',
        borderRadius: 4,
        fontSize: '0.9rem',
      }}
    />
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 400, maxWidth: 600, maxHeight: '85vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
      <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Önceki</Button>
      <span style={{ padding: '0.375rem 0.75rem', fontSize: '0.85rem', color: '#475569' }}>Sayfa {page} / {totalPages}</span>
      <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Sonraki →</Button>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📭</div>
      {message}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem', background: '#fef2f2', color: '#dc2626', borderRadius: 8, border: '1px solid #fecaca' }}>
      <strong>Hata:</strong> {message}
    </div>
  );
}

export function formatPrice(amount: number, currency = 'TRY'): string {
  const symbols: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' };
  return `${symbols[currency] || currency} ${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
