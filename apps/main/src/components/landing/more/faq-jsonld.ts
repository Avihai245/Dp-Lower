export interface FaqItem {
  q: string;
  a: string;
}

/** schema.org FAQPage for the questions shown on the page, in the language of the page. */
export function faqJsonLd(items: readonly FaqItem[], opts: { url: string; locale: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${opts.url}#faq`,
    inLanguage: opts.locale,
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

/** The accordion shows the questions in two columns; the first column takes the larger half. */
export function splitColumns<T>(items: readonly T[]): [T[], T[]] {
  const half = Math.ceil(items.length / 2);
  return [items.slice(0, half), items.slice(half)];
}
