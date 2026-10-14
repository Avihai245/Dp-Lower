import { Fragment } from 'react';

/** Always isolated: web addresses, e-mail addresses and Israeli telephone numbers. */
const FIXED = String.raw`https?:\/\/[^\s,;)]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}|\b0\d{1,2}-\d{3}-\d{4}\b`;
/** Inside Hebrew text also isolated: a figure with a plus sign ("380+" would otherwise read "+380"). */
const PLUS_NUMBER = String.raw`\d+\+`;
/** Inside Hebrew text also isolated: runs of Latin words ("Google Analytics 4", "PCI DSS", "IP"). */
const LATIN_RUN = String.raw`[A-Za-z][A-Za-z0-9._%+\-:/@#&]*(?:[ \xa0]+[A-Za-z0-9][A-Za-z0-9._%+\-:/@#&]*)*`;
/** the Hebrew block, U+0590 to U+05FF */
const HEBREW = new RegExp(`[${String.fromCharCode(0x590)}-${String.fromCharCode(0x5ff)}]`);

export interface TextPart {
  text: string;
  /** a token that reads left to right whatever the language of the sentence around it */
  ltr: boolean;
}

/**
 * Splits a sentence so that phone numbers, e-mail addresses, web addresses (and, in Hebrew text, Latin names) can be
 * isolated; sentence punctuation stays outside the token.
 */
export function splitLtr(input: string): TextPart[] {
  const re = new RegExp(HEBREW.test(input) ? `${FIXED}|${PLUS_NUMBER}|${LATIN_RUN}` : FIXED, 'g');
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of input.matchAll(re)) {
    const start = m.index ?? 0;
    const trailing = /[.,;:!?\-]+$/.exec(m[0])?.[0] ?? '';
    const token = trailing ? m[0].slice(0, -trailing.length) : m[0];
    if (!token) continue;
    if (start > last) parts.push({ text: input.slice(last, start), ltr: false });
    parts.push({ text: token, ltr: true });
    last = start + token.length;
  }
  if (last < input.length) parts.push({ text: input.slice(last), ltr: false });
  return parts;
}

/**
 * Text with its phone numbers, e-mail addresses, URLs and (in Hebrew) Latin names wrapped in <bdi dir="ltr">, so that
 * the digits, dashes and dots of those tokens never reorder around the punctuation next to them and a name such as
 * "Google Analytics 4" never breaks across two lines.
 */
export function Isolated({ text }: { text: string }) {
  return (
    <>
      {splitLtr(text).map((p, i) =>
        p.ltr ? (
          <bdi key={i} dir="ltr" style={{ whiteSpace: 'nowrap' }}>
            {p.text}
          </bdi>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}
