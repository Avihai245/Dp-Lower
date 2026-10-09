import { legalMetadata, renderLegal } from '@/components/legal/legal-route';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  return legalMetadata('accessibility', (await params).locale);
}

export default async function AccessibilityPage({ params }: Props) {
  return renderLegal('accessibility', (await params).locale);
}
