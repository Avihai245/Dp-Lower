import type { Kit } from './kit';
import type { Family } from './shell';
import type { Frag } from './text';

/** What a template produces: the pieces of the message, assembled into HTML + text by `renderEmail`. */
export interface Doc {
  subject: string;
  preheader: string;
  /** <tr> rows of the 600px sheet, top to bottom */
  rows: Frag[];
}

export interface TemplateDef {
  family: Family;
  build(k: Kit): Doc;
}

/** Defines a template from its copy (one object per language, same shape enforced by the type) and a builder. */
export function define<C>(family: Family, copy: { en: C; he: C }, build: (k: Kit, c: C) => Doc): TemplateDef {
  return { family, build: (k) => build(k, k.pick(copy)) };
}
