import type { ReactNode } from 'react';
import { isNumberLike } from '@/lib/shell/ltr';

/**
 * A left-to-right run inside running text: a phone number, an email address, a count. It is isolated so that the
 * surrounding Hebrew cannot reorder its punctuation, and a phone number never breaks across lines.
 */
export function Ltr({ children }: { children?: ReactNode }) {
  const text = typeof children === 'string' ? children : Array.isArray(children) ? children.filter((c) => typeof c === 'string').join('') : '';
  return (
    <bdi dir="ltr" style={isNumberLike(text) ? { whiteSpace: 'nowrap' } : undefined}>
      {children}
    </bdi>
  );
}
