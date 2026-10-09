import type { Kit } from './kit';
import { esc } from './text';

/** Which of the two source designs a template is built on. */
export type Family = 'welcome' | 'lead';

/** Invisible padding after the preheader so that inbox previews do not continue into the first lines of the body. */
const PREHEADER_FILLER = '&nbsp;&zwnj;'.repeat(60);

/**
 * <style> of the Welcome 1-15 sources (the superset: Welcome 3-15 add .stack, .bignum and .display).
 * The animated brass frame around the buttons falls back to solid brass where animation is not supported.
 */
const WELCOME_CSS = `
  :root { color-scheme: light only; supported-color-schemes: light only; }
  a { color: #7a5c2c; }

  /* ── mobile ─────────────────────────────────────────────── */
  @media only screen and (max-width: 600px) {
    .wrap { width: 100% !important; max-width: 100% !important; }
    .px { padding-left: 22px !important; padding-right: 22px !important; }
    .pt { padding-top: 32px !important; }
    .pb { padding-bottom: 32px !important; }
    .h1 { font-size: 20px !important; line-height: 27px !important; white-space: normal !important; }
    .h2 { font-size: 20px !important; line-height: 27px !important; }
    .lede { font-size: 16px !important; line-height: 26px !important; }
    .body { font-size: 15.5px !important; line-height: 25px !important; }
    .quote { font-size: 16px !important; line-height: 26px !important; }
    .num { font-size: 50px !important; }
    .cta, .cta table { width: 100% !important; }
    .cta .btn-brass, .cta .btn-ink { width: 100% !important; }
    .btn-brass td, .btn-ink td { padding: 17px 18px !important; text-align: center !important; }
    .cta td.frame { padding: 3px !important; }
    .cta a { font-size: 15px !important; display: block !important; }
    .hide-sm { display: none !important; }
    .logo { width: 124px !important; max-width: 124px !important; }
    .stack { display: block !important; width: 100% !important; padding: 0 0 14px 0 !important; }
    .bignum { font-size: 34px !important; }
    .display { font-size: 26px !important; line-height: 32px !important; }
  }

  /* ── animated brass frame around the CTA (solid brass where unsupported) ── */
  .frame {
    background-color: #a07a3c;
    background-image: linear-gradient(110deg,
      #8c6529 0%, #a07a3c 12%, #c9a45c 24%, #f0dcae 33%, #c9a45c 42%,
      #8c6529 54%, #a07a3c 66%, #f0dcae 80%, #c9a45c 90%, #8c6529 100%);
    background-size: 200% 100%;
    -webkit-animation: brassflow 6s linear infinite;
    animation: brassflow 6s linear infinite;
  }
  @-webkit-keyframes brassflow { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }
  @keyframes brassflow { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }
  @media (prefers-reduced-motion: reduce) { .frame { -webkit-animation: none; animation: none; } }
`;

/** Hebrew: the frame gradient and its flow run the other way. */
const WELCOME_CSS_RTL = `
  /* ── mirrored for right-to-left ── */
  .frame {
    background-image: linear-gradient(250deg,
      #8c6529 0%, #a07a3c 12%, #c9a45c 24%, #f0dcae 33%, #c9a45c 42%,
      #8c6529 54%, #a07a3c 66%, #f0dcae 80%, #c9a45c 90%, #8c6529 100%);
    -webkit-animation-name: brassflow-rtl;
    animation-name: brassflow-rtl;
  }
  @-webkit-keyframes brassflow-rtl { from { background-position: 200% 50%; } to { background-position: 0% 50%; } }
  @keyframes brassflow-rtl { from { background-position: 200% 50%; } to { background-position: 0% 50%; } }
`;

/** <style> of the Lead Email source. */
const LEAD_CSS = `
  @media only screen and (max-width: 600px) {
    .wrap { width: 100% !important; max-width: 100% !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .h1 { font-size: 32px !important; line-height: 38px !important; }
    .h2 { font-size: 24px !important; line-height: 30px !important; }
    .quote { font-size: 20px !important; line-height: 30px !important; }
    .stack { display: block !important; width: 100% !important; padding: 0 0 22px 0 !important; }
    .cta a { font-size: 15px !important; }
  }
  a { color: #7a5c2c; }
`;

export interface ShellInput {
  family: Family;
  subject: string;
  preheader: string;
  rows: string;
}

/** The complete HTML document around the rows of a template. */
export function shell(k: Kit, s: ShellInput): string {
  const lead = s.family === 'lead';
  const head = lead
    ? `<meta name="color-scheme" content="light dark">`
    : `<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">`;
  const css = lead ? LEAD_CSS : WELCOME_CSS + (k.rtl ? WELCOME_CSS_RTL : '');
  const bodyCls = lead ? '' : ' class="outer"';
  const spanCls = lead ? '' : ' class="preview"';
  const tableCls = lead ? '' : ' class="outer"';
  const cellCls = lead ? '' : ' class="outer-td"';
  const cellPad = lead ? '30px 12px 48px 12px' : '24px 10px 40px 10px';
  const sheetCls = lead ? 'wrap' : 'wrap sheet';
  const dir = k.rtl ? ' dir="rtl"' : '';
  return `<!DOCTYPE html>
<html lang="${k.locale}"${dir}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
${head}
<title>${esc(s.subject)}</title>
<style>${css}</style>
</head>
<body${bodyCls}${dir} style="margin:0; padding:0; background-color:#e7e0d5;">
<span${spanCls} style="display:none; font-size:1px; color:#e7e0d5; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${esc(s.preheader)}${PREHEADER_FILLER}</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${tableCls}${dir} style="background-color:#e7e0d5;">
<tr><td align="center"${cellCls}${dir} style="padding:${cellPad};">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="${sheetCls}"${dir} style="width:100%; max-width:600px; background-color:#f8f5f0;">
${s.rows}
</table>

</td></tr>
</table>
</body>
</html>
`;
}
