import { setRequestLocale } from 'next-intl/server';

// Placeholder: replaced by the home page port.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <main style={{ padding: 40 }}>Decker Pex Levi — main site ({locale})</main>;
}
