import type { FounderIdentity } from '@mycorp24/types';

/**
 * How the chief of staff addresses the founder.
 * Spec §167, docs/brand/LOCALIZATION.md.
 *
 * The app name is MYCORP24 in every locale. Only the form of address is
 * localized. Never build the string by concatenation in a component — Korean
 * puts the title after the name, some locales put it before, and Japanese
 * needs different honorific handling.
 */

export type AddressTemplate = (name: string, title: string) => string;

const TEMPLATES: Record<string, { nameTitle: AddressTemplate; titleOnly: AddressTemplate }> = {
  ko: {
    nameTitle: (name, title) => `${name} ${title}`,
    titleOnly: (_name, title) => title,
  },
  ja: {
    nameTitle: (name, title) => `${name}${title}`,
    titleOnly: (_name, title) => title,
  },
  en: {
    nameTitle: (name, title) => `${title} ${name}`,
    titleOnly: (_name, title) => title,
  },
};

const DEFAULT_TITLE: Record<string, string> = {
  ko: '회장님',
  ja: '社長',
  zh: '董事長',
  en: 'Founder',
};

const language = (locale: string): string => (locale.split('-')[0] ?? 'en').toLowerCase();

/** The locale's default title, used to seed onboarding. */
export const defaultTitleFor = (locale: string): string =>
  DEFAULT_TITLE[language(locale)] ?? DEFAULT_TITLE['en']!;

export function formatAddress(identity: FounderIdentity): string {
  const lang = language(identity.locale);
  const t = TEMPLATES[lang] ?? TEMPLATES['en']!;

  switch (identity.addressForm) {
    case 'custom':
      return identity.customAddress?.trim() || identity.ownerDisplayName;
    case 'name_only':
      return identity.ownerDisplayName;
    case 'name_title':
      return t.nameTitle(identity.ownerDisplayName, identity.preferredTitle);
    case 'title_only':
    default:
      return t.titleOnly(identity.ownerDisplayName, identity.preferredTitle);
  }
}

const GREETING: Record<string, (addr: string) => string> = {
  ko: (a) => `좋은 아침입니다, ${a}.`,
  ja: (a) => `おはようございます、${a}。`,
  en: (a) => `Good morning, ${a}.`,
};

/** Morning briefing opener — spec §194. */
export function morningGreeting(identity: FounderIdentity): string {
  const g = GREETING[language(identity.locale)] ?? GREETING['en']!;
  return g(formatAddress(identity));
}
