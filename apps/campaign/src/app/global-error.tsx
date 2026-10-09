'use client';

/**
 * The last resort: even the root layout failed, so nothing (fonts, providers, styles) is available. Plain markup,
 * both languages on the page because the visitor's language is not known any more.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f8f5f0', color: '#14202b', fontFamily: 'system-ui, -apple-system, Segoe UI, Arial, sans-serif' }}>
        <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: 520 }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 38, margin: '0 0 12px' }}>Something went wrong.</h1>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: '#55606b', margin: '0 0 24px' }}>This page could not be loaded. Please try again in a moment.</p>
            <p lang="he" dir="rtl" style={{ fontSize: 16, lineHeight: 1.6, color: '#55606b', margin: '0 0 28px' }}>
              לא הצלחנו לטעון את העמוד. נסו שוב בעוד רגע.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ background: '#14202b', color: '#f8f5f0', border: 0, padding: '15px 28px', fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Try again · נסו שוב
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
