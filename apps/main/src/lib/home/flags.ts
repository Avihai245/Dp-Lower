/**
 * National flags of the home page's country grid, drawn as layered CSS gradients (no image requests, crisp at 34px).
 * Copied from the prototype. A flag is a physical object: the style strings carry the noflip marker so `s()` keeps
 * every stripe where it is in the right-to-left edition (Portugal's green hoist stays on the left, and so on).
 */
const FRAME = 'display: block; width: 34px; height: 23px; flex: none; box-shadow: 0 0 0 1px rgba(248,245,240,0.28); /* noflip */ ';

const FLAGS: Record<string, string> = {
  'german-citizenship': 'background: linear-gradient(#111 0 33.3%, #c8102e 33.3% 66.6%, #e8b90b 66.6%)',
  'austrian-citizenship': 'background: linear-gradient(#c8102e 0 33.3%, #fff 33.3% 66.6%, #c8102e 66.6%)',
  'polish-citizenship': 'background: linear-gradient(#fff 0 50%, #c8102e 50%)',
  'portuguese-citizenship':
    'background: radial-gradient(circle at 40% 50%, #e8b90b 0 4.5px, transparent 4.6px), linear-gradient(90deg, #046a38 0 40%, #c8102e 40%)',
  'romanian-citizenship': 'background: linear-gradient(90deg, #0d3b8c 0 33.3%, #e8b90b 33.3% 66.6%, #c8102e 66.6%)',
  'french-citizenship': 'background: linear-gradient(90deg, #0d3b8c 0 33.3%, #fff 33.3% 66.6%, #c8102e 66.6%)',
  'bulgarian-citizenship': 'background: linear-gradient(#fff 0 33.3%, #046a38 33.3% 66.6%, #c8102e 66.6%)',
  'usa-immigration':
    'background-image: linear-gradient(#1b2c5e, #1b2c5e), repeating-linear-gradient(#c8102e 0 1.77px, #fff 1.77px 3.54px); background-size: 40% 54%, 100% 100%; background-position: left top, left top; background-repeat: no-repeat, repeat',
  'canada-immigration':
    'background: radial-gradient(circle at 50% 50%, #c8102e 0 5px, transparent 5.1px), linear-gradient(90deg, #c8102e 0 25%, #fff 25% 75%, #c8102e 75%)',
};

/** The nine countries of the grid, in display order. Their names and notes come from the services content. */
export const COUNTRY_SLUGS = [
  'german-citizenship',
  'austrian-citizenship',
  'polish-citizenship',
  'portuguese-citizenship',
  'romanian-citizenship',
  'french-citizenship',
  'bulgarian-citizenship',
  'usa-immigration',
  'canada-immigration',
] as const;

export const flagStyle = (slug: string): string => FRAME + (FLAGS[slug] ?? '');
