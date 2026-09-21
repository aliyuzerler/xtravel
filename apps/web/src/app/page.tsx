import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 800, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Turizm Pazaryeri</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>
        Turizm hizmetleri pazaryeri platformu — kültür turları, gemi turları, doğa yürüyüşleri ve daha fazlası.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link
          href="/login"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#0ea5e9',
            color: 'white',
            textDecoration: 'none',
            borderRadius: 6,
            fontWeight: 500,
          }}
        >
          Giriş Yap
        </Link>
        <Link
          href="/register"
          style={{
            padding: '0.75rem 1.5rem',
            background: 'white',
            color: '#0ea5e9',
            border: '1px solid #0ea5e9',
            textDecoration: 'none',
            borderRadius: 6,
            fontWeight: 500,
          }}
        >
          Kayıt Ol
        </Link>
      </div>
    </main>
  );
}
