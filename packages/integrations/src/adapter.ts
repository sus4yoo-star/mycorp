import type { ConnectionTier, IntegrationStatus } from '@mycorp24/types';

/**
 * Integration adapter contract — spec §78.
 *
 * Provider specifics never leak past this interface. Nothing in the product
 * imports a vendor SDK directly; it goes through an adapter, and the adapter
 * is only ever reached through the tool gateway (§131).
 */

export const CAPABILITIES = [
  'READ_REVIEWS',
  'RESPOND_REVIEW',
  'READ_PLACE_INFO',
  'UPDATE_PLACE_INFO',
  'READ_STATS',
  'READ_RESERVATIONS',
  'WRITE_RESERVATION_CANCEL',
  'READ_ADS',
  'WRITE_ADS_BUDGET',
  'READ_MAIL',
  'SEND_MAIL',
  'READ_CALENDAR',
  'WRITE_CALENDAR',
  'READ_SOCIAL',
  'PUBLISH_SOCIAL',
  'READ_ORDERS',
  'READ_PRODUCTS',
  'WRITE_PRODUCTS',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export interface CapabilityDeclaration {
  readonly capability: Capability;
  readonly supported: boolean;
  /** How this capability is actually reached. Spec §79 ordering. */
  readonly tier: ConnectionTier;
  /** Why it is unsupported, shown to the founder verbatim. Spec §104, §151. */
  readonly note?: string;
}

export interface ReadRequest {
  readonly capability: Capability;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface WriteRequest extends ReadRequest {
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface AdapterResult<T = unknown> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: string;
}

export interface IntegrationAdapter {
  readonly provider: string;
  readonly status: IntegrationStatus;

  connect(): Promise<AdapterResult>;
  disconnect(): Promise<AdapterResult>;
  healthCheck(): Promise<AdapterResult<{ healthy: boolean }>>;
  getCapabilities(): readonly CapabilityDeclaration[];
  read(req: ReadRequest): Promise<AdapterResult>;
  write(req: WriteRequest): Promise<AdapterResult>;
  refreshToken?(): Promise<AdapterResult>;
}

export const supports = (a: IntegrationAdapter, c: Capability): boolean =>
  a.getCapabilities().some((d) => d.capability === c && d.supported);
