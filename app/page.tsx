// src/app/page.tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
        Code Fighter Z
      </h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
        Battle your friends with algorithms.
      </p>
      <div>
        <Link href="/auth">
          <button
            style={{
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Start Fighting
          </button>
        </Link>
      </div>
    </div>
  );
}