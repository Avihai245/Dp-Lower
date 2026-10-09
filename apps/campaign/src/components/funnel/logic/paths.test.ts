import { describe, expect, it } from 'vitest';
import { localeOfPath, localizePath, stripLocale } from './paths';

describe('paths', () => {
  it('strips the Hebrew prefix only', () => {
    expect(stripLocale('/he/portal')).toBe('/portal');
    expect(stripLocale('/he')).toBe('/');
    expect(stripLocale('/he?x=1')).toBe('/?x=1');
    expect(stripLocale('/portal')).toBe('/portal');
    expect(stripLocale('/help')).toBe('/help');
    expect(stripLocale('/hebrew')).toBe('/hebrew');
  });

  it('knows which language a path already carries', () => {
    expect(localeOfPath('/he/portal')).toBe('he');
    expect(localeOfPath('/he')).toBe('he');
    expect(localeOfPath('/portal')).toBeNull();
    // two-letter route names are not languages
    expect(localeOfPath('/go/abc')).toBeNull();
    expect(localeOfPath('/en/portal')).toBeNull();
  });

  it('adds the language prefix for Hebrew and none for English', () => {
    expect(localizePath('/portal', 'en')).toBe('/portal');
    expect(localizePath('/portal', 'he')).toBe('/he/portal');
    expect(localizePath('/', 'he')).toBe('/he');
    expect(localizePath('/sign-in?error=link', 'he')).toBe('/he/sign-in?error=link');
    expect(localizePath('/create-password?mode=reset', 'he')).toBe('/he/create-password?mode=reset');
  });

  it('leaves an already prefixed path alone (the middleware puts /he/portal into ?next=)', () => {
    expect(localizePath('/he/portal', 'he')).toBe('/he/portal');
    expect(localizePath('/he/portal', 'en')).toBe('/he/portal');
  });
});
