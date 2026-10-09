import { legalMetadata, renderLegal } from '@/components/legal/legal-route';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  return legalMetadata('privacy', (await params).locale);
}

export default async function PrivacyPage({ params }: Props) {
  return renderLegal('privacy', (await params).locale);
}
