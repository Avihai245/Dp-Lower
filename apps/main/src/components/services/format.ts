import { initialsOf, type Locale } from '@dpl/core';

/** "Attorney · Head of the Austria and Germany Department" -> "Head of the Austria and Germany Department" (the lead chip drops the title). */
export function stripAttorneyTitle(role: string, locale: Locale): string {
  return role.replace(locale === 'he' ? /^עורכ(?:ת)? דין · / : /^Attorney · /, '');
}

/** Initials for a photo-less avatar: the first letters of the first two words, skipping the Hebrew title עו"ד. */
export function avatarInitials(name: string): string {
  return initialsOf(name.replace(/^עו(?:"|״)ד\s+/, ''));
}
