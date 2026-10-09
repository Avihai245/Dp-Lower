import { s } from '@dpl/ui';

/** A "forward" arrow: points right in English and is mirrored to point left in the Hebrew edition. */
export function Arrow({ css }: { css?: string }) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-block', transform: 'scaleX(var(--dir, 1))', ...s(css) }}>
      →
    </span>
  );
}
