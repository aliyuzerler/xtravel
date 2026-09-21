'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

const LOCALES = [
  { code: 'tr', label: '🇹🇷 TR', name: 'Türkçe' },
  { code: 'en', label: '🇬🇧 EN', name: 'English' },
];

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function changeLocale(newLocale: string) {
    if (newLocale === locale) {
      setOpen(false);
      return;
    }
    // URL'den mevcut dil segmentini çıkar, yenisini koy
    const segments = pathname.split('/').filter(Boolean);
    // İlk segment locale olabilir ('tr' veya 'en')
    if (segments[0] === 'tr' || segments[0] === 'en') {
      segments[0] = newLocale;
    } else {
      segments.unshift(newLocale);
    }
    const newPath = '/' + segments.join('/');
    router.push(newPath);
    setOpen(false);
  }

  const current = LOCALES.find((l) => l.code === locale) || LOCALES[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 4,
          padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
          color: '#475569', display: 'flex', alignItems: 'center', gap: '0.25rem',
        }}
      >
        {current.label} <span style={{ fontSize: '0.75rem' }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem',
          background: 'white', borderRadius: 6, boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0', zIndex: 50, minWidth: 140, overflow: 'hidden',
        }}>
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLocale(l.code)}
              style={{
                display: 'block', width: '100%', padding: '0.6rem 1rem',
                background: l.code === locale ? '#f0f9ff' : 'transparent',
                border: 'none', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left',
                color: l.code === locale ? '#0ea5e9' : '#475569', fontWeight: l.code === locale ? 600 : 400,
              }}
            >
              {l.label} — {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
