import type { Locale } from '@dpl/core';
import type { Service } from '@dpl/i18n';
import { s } from '@dpl/ui';
import { FADE_IN } from './parts';
import { ServiceBody } from './ServiceBody';
import { ServiceHero } from './ServiceHero';

/** /services/[slug]: dark hero with the calls to action, then the explanation and the sticky side column. */
export function ServiceDetail({ service, locale }: { service: Service; locale: Locale }) {
  return (
    <div style={s(FADE_IN)}>
      <ServiceHero service={service} locale={locale} />
      <ServiceBody service={service} locale={locale} />
    </div>
  );
}
