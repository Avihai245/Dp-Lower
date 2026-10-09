export type ServiceGroup = 'passports' | 'israel' | 'other';

export interface Faq {
  q: string;
  a: string;
}

export interface Service {
  slug: string;
  group: ServiceGroup;
  name: string;
  short: string;
  kicker: string;
  note: string;
  /** true for the two services with an online eligibility check (German, Austrian) */
  online: boolean;
  dept: string;
  headline: string;
  overview: string[];
  who: string[];
  eligibility: string[];
  documents: string[];
  process: string[];
  help: string;
  faq: Faq[];
  /** article slugs */
  related: string[];
  /** team member slugs, lead first */
  team: string[];
}

export type TeamKind = 'partner' | 'attorney' | 'staff';

export interface TeamMember {
  slug: string;
  name: string;
  role: string;
  dept: string;
  kind: TeamKind;
  photo?: string;
  linkedin?: string;
  bio: string;
}

export interface Article {
  slug: string;
  title: string;
  /** display date as written in the source, e.g. "15 Jun 2026" */
  date: string;
  cat: string;
  author: string;
  /** service slugs */
  services: string[];
  excerpt: string;
  body: string[];
}

export interface Testimonial {
  quote: string;
  name: string;
  date: string;
}

export interface Office {
  city: string;
  address: string;
  tel: string;
  telHref: string;
  tel2: string;
  map: string;
}
