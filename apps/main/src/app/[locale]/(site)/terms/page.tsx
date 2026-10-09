import { legalMetadata, renderLegal } from '@/components/legal/legal-route';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  return legalMetadata('terms', (await params).locale);
}

export default async function TermsPage({ params }: Props) {
  return renderLegal('terms', (await params).locale);
}
