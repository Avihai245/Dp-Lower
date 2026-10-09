import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 40, textAlign: 'center' }}>
      <div>
        <h1 style={{ fontSize: 48 }}>404</h1>
        <p>This page could not be found.</p>
        <Link href="/">Back to the start</Link>
      </div>
    </main>
  );
}
