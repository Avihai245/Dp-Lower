import { describe, expect, it } from 'vitest';
import { s, x } from './style';

describe('s()', () => {
  it('converts kebab-case to camelCase and keeps custom properties', () => {
    expect(s('display: flex; align-items: center; --dx: 12px')).toEqual({ display: 'flex', alignItems: 'center', '--dx': '12px' });
  });
  it('does not split on semicolons or commas inside functions and quotes', () => {
    const r = s(`background: url("data:image/svg+xml;utf8,<svg/>"); font-weight: 600`);
    expect(r.background).toBe('url("data:image/svg+xml;utf8,<svg/>")');
    expect(r.fontWeight).toBe('600');
  });
  it('maps physical horizontal properties to logical ones', () => {
    expect(s('margin-left: auto; padding-right: 8px; text-align: left; border-left: 1px solid red; left: 12px')).toEqual({
      marginInlineStart: 'auto',
      paddingInlineEnd: '8px',
      textAlign: 'start',
      borderInlineStart: '1px solid red',
      insetInlineStart: '12px',
    });
    expect(s('right: 0; text-align: right; float: left')).toEqual({ insetInlineEnd: '0', textAlign: 'end', float: 'inline-start' });
  });
  it('expands asymmetric 4-value margin/padding, keeps symmetric shorthands', () => {
    expect(s('margin: 0 0 0 auto')).toEqual({ marginBlockStart: '0', marginInlineEnd: '0', marginBlockEnd: '0', marginInlineStart: 'auto' });
    expect(s('padding: 1px 2px 3px 4px')).toMatchObject({ paddingInlineEnd: '2px', paddingInlineStart: '4px' });
    expect(s('padding: 18px clamp(20px, 4.6vw, 160px)')).toEqual({ padding: '18px clamp(20px, 4.6vw, 160px)' });
    expect(s('margin: 0 auto')).toEqual({ margin: '0 auto' });
  });
  it('maps asymmetric border-radius corners', () => {
    expect(s('border-radius: 12px 12px 0 0')).toEqual({ borderRadius: '12px 12px 0 0' }); // symmetrical top/bottom pairs stay
    expect(s('border-radius: 0 12px 12px 0')).toMatchObject({ borderStartEndRadius: '12px', borderEndStartRadius: '0' });
    expect(s('border-top-left-radius: 4px')).toEqual({ borderStartStartRadius: '4px' });
    expect(s('border-radius: 999px')).toEqual({ borderRadius: '999px' });
  });
  it('flips gradient directions through --dir', () => {
    expect(s('background: linear-gradient(to right, #000, transparent)').background).toBe(
      'linear-gradient(calc(90deg * var(--dir, 1)), #000, transparent)',
    );
    expect(s('background: linear-gradient(135deg, #000, #fff)').background).toBe('linear-gradient(calc(135deg * var(--dir, 1)), #000, #fff)');
    expect(s('background: linear-gradient(to bottom, #000, #fff)').background).toBe('linear-gradient(to bottom, #000, #fff)');
  });
  it('maps the prototype font families to the Hebrew-aware variables', () => {
    expect(s("font-family: 'Newsreader', Georgia, serif").fontFamily).toBe('var(--font-serif)');
    expect(s("font-family: 'Manrope', system-ui, sans-serif").fontFamily).toBe('var(--font-sans)');
    expect(s('font-family: monospace').fontFamily).toBe('monospace');
  });
  it('keeps everything physical with /*noflip*/', () => {
    expect(s('/*noflip*/ position: absolute; left: 50%; text-align: left')).toEqual({ position: 'absolute', left: '50%', textAlign: 'left' });
  });
  it('handles empty input', () => {
    expect(s('')).toEqual({});
    expect(s(undefined)).toEqual({});
    expect(s(false)).toEqual({});
  });
});

describe('x()', () => {
  it('adds hover and focus classes with variables', () => {
    const r = x('color: red', { hover: 'border-color: #14202b; color: #a07a3c', focus: 'outline: 2px solid #a07a3c' });
    expect(r.style).toMatchObject({ color: 'red', '--hv-bc': '#14202b', '--hv-c': '#a07a3c', '--fv-ol': '2px solid #a07a3c' });
    expect(r.className?.split(' ').sort()).toEqual(['fv-ol', 'hv-bc', 'hv-c']);
  });
  it('throws on unsupported hover properties so they are noticed', () => {
    expect(() => x('', { hover: 'width: 10px' })).toThrow(/unsupported hover property/);
  });
  it('merges an extra class name', () => {
    expect(x('', { className: 'btn', hover: 'background: #fff' }).className).toBe('btn hv-bg');
  });
});
