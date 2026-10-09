/** Minimal typing for the dev-only fidelity helper (jsdom ships no types and @types/jsdom is not a dependency). */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    window: { document: Document };
  }
}
