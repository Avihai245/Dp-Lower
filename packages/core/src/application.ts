import { z } from 'zod';

export interface ApplicationField {
  id: string;
  /** Optional fields do not block a section from counting as done. */
  optional?: boolean;
}
export interface ApplicationSection {
  id: 'about' | 'ancestor' | 'line' | 'contact' | 'review';
  fields: readonly ApplicationField[];
}

/** The five sections of the online application. Labels, hints and placeholders live in i18n (namespace "portal"). */
export const APPLICATION_SECTIONS: readonly ApplicationSection[] = [
  {
    id: 'about',
    fields: [{ id: 'fullName' }, { id: 'dob' }, { id: 'birthPlace' }, { id: 'citizenship' }],
  },
  {
    id: 'ancestor',
    fields: [{ id: 'anName' }, { id: 'anRel' }, { id: 'anDob' }, { id: 'anBirthPlace' }, { id: 'anLeft' }],
  },
  {
    // "Leave blank if they are your parent" / "if any": only the name-change note is required (type "None").
    id: 'line',
    fields: [{ id: 'line1', optional: true }, { id: 'line2', optional: true }, { id: 'nameChanges' }],
  },
  {
    id: 'contact',
    fields: [{ id: 'email' }, { id: 'phone' }, { id: 'address' }],
  },
  { id: 'review', fields: [] },
];

export const APPLICATION_FIELD_IDS = APPLICATION_SECTIONS.flatMap((s) => s.fields.map((f) => f.id));
/** Sections that collect answers (the review section only summarises them). */
export const APPLICATION_INPUT_SECTIONS = APPLICATION_SECTIONS.length - 1;

export type ApplicationData = Partial<Record<string, string>>;

export const applicationDataSchema = z
  .record(z.string(), z.string().max(2000))
  .refine((o) => Object.keys(o).every((k) => APPLICATION_FIELD_IDS.includes(k)), 'unknown field');

export function sectionDone(data: ApplicationData, index: number): boolean {
  const section = APPLICATION_SECTIONS[index];
  if (!section || section.fields.length === 0) return false;
  return section.fields.filter((f) => !f.optional).every((f) => (data[f.id] ?? '').trim().length > 0);
}

export const sectionsDone = (data: ApplicationData): number =>
  APPLICATION_SECTIONS.reduce((n, _s, i) => n + (sectionDone(data, i) ? 1 : 0), 0);

export const isApplicationComplete = (data: ApplicationData): boolean => sectionsDone(data) >= APPLICATION_INPUT_SECTIONS;
