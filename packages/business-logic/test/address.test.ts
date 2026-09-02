import { describe, expect, it } from 'vitest';
import type { FounderIdentity } from '@mycorp24/types';
import { defaultTitleFor, formatAddress, morningGreeting } from '../src/address';

const identity = (over: Partial<FounderIdentity>): FounderIdentity => ({
  ownerDisplayName: '유상철',
  preferredTitle: '회장님',
  locale: 'ko-KR',
  addressForm: 'title_only',
  ...over,
});

describe('formatAddress — LOCALIZATION.md §3', () => {
  it('puts the Korean title after the name', () => {
    expect(formatAddress(identity({ addressForm: 'name_title' }))).toBe('유상철 회장님');
  });

  it('puts the English title before the name', () => {
    expect(
      formatAddress(
        identity({
          ownerDisplayName: 'Alex',
          preferredTitle: 'Founder',
          locale: 'en-US',
          addressForm: 'name_title',
        }),
      ),
    ).toBe('Founder Alex');
  });

  it('supports title only, name only and a custom string', () => {
    expect(formatAddress(identity({}))).toBe('회장님');
    expect(formatAddress(identity({ addressForm: 'name_only' }))).toBe('유상철');
    expect(formatAddress(identity({ addressForm: 'custom', customAddress: 'Boss' }))).toBe('Boss');
  });

  it('falls back to the display name when a custom address is blank', () => {
    expect(formatAddress(identity({ addressForm: 'custom', customAddress: '   ' }))).toBe('유상철');
  });

  it('seeds a locale-appropriate default title', () => {
    expect(defaultTitleFor('ko-KR')).toBe('회장님');
    expect(defaultTitleFor('ja-JP')).toBe('社長');
    expect(defaultTitleFor('pt-BR')).toBe('Founder');
  });

  it('greets in the founder locale, not in translated English', () => {
    expect(morningGreeting(identity({}))).toBe('좋은 아침입니다, 회장님.');
    expect(
      morningGreeting(identity({ ownerDisplayName: 'Alex', preferredTitle: 'Boss', locale: 'en-US' })),
    ).toBe('Good morning, Boss.');
  });
});
