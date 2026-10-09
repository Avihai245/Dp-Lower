/**
 * The count-up figures of the reputation section. The numbers are marketing placeholders ("To verify"), identical in
 * every language; only the tag and the label are translated. `progress` runs 0..1 from `useCountProgress` (@dpl/ui).
 */
export interface FigureSpec {
  /** final value */
  n: number;
  suffix: '+' | '%';
}

export const FIGURES: readonly FigureSpec[] = [
  { n: 1200, suffix: '+' },
  { n: 15, suffix: '+' },
  { n: 94, suffix: '%' },
  { n: 30, suffix: '+' },
] as const;

/** The value shown while counting: rounds `n * progress` (like the prototype), grouped for the locale, with its suffix. */
export function figureValue(spec: FigureSpec, progress: number, locale: string): string {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return `${Math.round(spec.n * p).toLocaleString(locale)}${spec.suffix}`;
}
