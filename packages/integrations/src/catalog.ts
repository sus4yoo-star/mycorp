import type { IntegrationStatus } from '@mycorp24/types';
import type { Capability } from './adapter';

/** integrations_catalog row — spec §80. */
export interface CatalogEntry {
  readonly id: string;
  readonly provider: string;
  readonly category:
    | 'COMMUNICATION'
    | 'MARKETING'
    | 'SOCIAL'
    | 'SEARCH'
    | 'COMMERCE'
    | 'RESERVATION'
    | 'HOSPITALITY'
    | 'ANALYTICS'
    | 'FINANCE'
    | 'DOCUMENTS'
    | 'PRODUCTIVITY';
  readonly displayName: string;
  readonly authType: 'OAUTH2' | 'API_KEY' | 'EMAIL' | 'BROWSER_SESSION' | 'MANUAL';
  readonly capabilities: readonly Capability[];
  readonly approvalRequired: boolean;
  readonly webhookSupported: boolean;
  readonly mobileSupported: boolean;
  readonly status: IntegrationStatus;
  readonly notes?: string;
}

/**
 * MVP connection order — spec §149. The catalog is seeded with what the MVP
 * actually targets; everything else is added as its adapter lands. An entry
 * here is a promise to the founder, so nothing goes in before it works.
 */
export const MVP_CATALOG: readonly CatalogEntry[] = [
  {
    id: 'gmail',
    provider: 'GMAIL',
    category: 'COMMUNICATION',
    displayName: 'Gmail',
    authType: 'OAUTH2',
    capabilities: ['READ_MAIL', 'SEND_MAIL'],
    approvalRequired: true,
    webhookSupported: true,
    mobileSupported: true,
    status: 'READ_WRITE',
  },
  {
    id: 'google-calendar',
    provider: 'GOOGLE_CALENDAR',
    category: 'PRODUCTIVITY',
    displayName: 'Google Calendar',
    authType: 'OAUTH2',
    capabilities: ['READ_CALENDAR', 'WRITE_CALENDAR'],
    approvalRequired: false,
    webhookSupported: true,
    mobileSupported: true,
    status: 'READ_WRITE',
  },
  {
    id: 'youtube',
    provider: 'YOUTUBE',
    category: 'SOCIAL',
    displayName: 'YouTube',
    authType: 'OAUTH2',
    capabilities: ['READ_SOCIAL', 'READ_STATS'],
    approvalRequired: false,
    webhookSupported: false,
    mobileSupported: true,
    status: 'READ_ONLY',
  },
  {
    id: 'meta-instagram',
    provider: 'INSTAGRAM',
    category: 'SOCIAL',
    displayName: 'Instagram / Meta',
    authType: 'OAUTH2',
    capabilities: ['READ_SOCIAL', 'PUBLISH_SOCIAL', 'READ_ADS', 'WRITE_ADS_BUDGET'],
    approvalRequired: true,
    webhookSupported: true,
    mobileSupported: true,
    status: 'READ_WRITE',
  },
  {
    id: 'naver-place',
    provider: 'NAVER_PLACE',
    category: 'SEARCH',
    displayName: '네이버 플레이스',
    authType: 'OAUTH2',
    capabilities: ['READ_REVIEWS', 'READ_PLACE_INFO', 'READ_STATS'],
    approvalRequired: false,
    webhookSupported: false,
    mobileSupported: true,
    status: 'READ_ONLY',
    notes: '리뷰 응답은 공식 API 범위에 따라 제한될 수 있다. 지원 여부를 가장하지 않는다 (§104).',
  },
  {
    id: 'csv-upload',
    provider: 'CSV',
    category: 'DOCUMENTS',
    displayName: 'CSV / Excel 업로드',
    authType: 'MANUAL',
    capabilities: ['READ_ORDERS', 'READ_STATS'],
    approvalRequired: false,
    webhookSupported: false,
    mobileSupported: true,
    status: 'MANUAL',
  },
];

/**
 * The name a founder recognises, for a provider key.
 *
 * Falls back to the key itself, which is not pretty but is at least not a lie.
 * Nothing the founder reads should say GMAIL when it means Gmail.
 */
export const providerDisplayName = (provider: string): string =>
  MVP_CATALOG.find((e) => e.provider === provider)?.displayName ?? provider;

/**
 * Every spelling a stored connection may carry for this entry.
 *
 * There are two identifiers for the same thing and they do not agree. The
 * OAuth callback stores `provider.id.toLowerCase().replace(/_/g,'-')`, so
 * Instagram lands in the database as `instagram`, while this catalog calls the
 * same entry `meta-instagram`. Anything comparing a stored connection against a
 * catalog id therefore missed it and concluded the company had not connected —
 * silently, and only for Meta.
 *
 * Rather than migrate rows that already exist, both spellings are accepted and
 * this is the one place that knows there are two.
 */
export const connectionIdsFor = (entry: CatalogEntry): readonly string[] => {
  const fromProvider = entry.provider.toLowerCase().replace(/_/g, '-');
  return fromProvider === entry.id ? [entry.id] : [entry.id, fromProvider];
};

/** The provider key a stored connection belongs to, or null if unknown to us. */
export const providerForCatalogId = (catalogId: string): string | null =>
  MVP_CATALOG.find((e) => connectionIdsFor(e).includes(catalogId))?.provider ?? null;
