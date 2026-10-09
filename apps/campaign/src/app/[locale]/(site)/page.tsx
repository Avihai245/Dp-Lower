import { setRequestLocale } from 'next-intl/server';

// Placeholder: replaced by the landing page port.
export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <main style={{ padding: 40 }}>Decker Pex Levi — campaign ({locale})</main>;
}
