/**
 * Intent taxonomy — spec §76, §77, §103.
 *
 * Every major UI action has a conversational equivalent (§143). The set below
 * is therefore not open-ended: each intent maps to something the product can
 * actually do. An utterance we cannot serve becomes `UNKNOWN`, and the chief of
 * staff says so rather than inventing a capability (§151).
 */

export const INTENTS = [
  'CONNECT_INTEGRATION',
  'LIST_APPROVALS',
  'DECIDE_APPROVAL',
  'SHOW_METRIC',
  'ANALYZE_REVIEWS',
  'AGENT_STATUS',
  'SHOW_REPORT',
  'UPDATE_APPROVAL_POLICY',
  'UPDATE_PREFERENCE',
  'CREATE_AUTOMATION',
  'OPEN_ROUTE',
  'DELEGATE',
  'UNKNOWN',
] as const;

export type Intent = (typeof INTENTS)[number];

export type Metric = 'REVENUE' | 'AD_SPEND' | 'RESERVATIONS' | 'REVIEWS' | 'FOLLOWERS';

export type Period = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'RECENT';

export interface Entities {
  readonly provider?: string;
  readonly metric?: Metric;
  readonly period?: Period;
  /** 1-based, from "첫 번째" / "2번". */
  readonly ordinal?: number;
  readonly decision?: 'APPROVE' | 'REJECT';
  readonly amount?: number;
  readonly currency?: string;
  readonly route?: string;
  readonly schedule?: string;
}

export interface Classification {
  readonly intent: Intent;
  readonly entities: Entities;
  /** 1 for a deterministic rule match, lower when a model had to guess. */
  readonly confidence: number;
  /**
   * Whether the founder was giving an order or asking about one. Read from the
   * utterance separately (see `mood.ts`), because the same verb carries both:
   * acting on a question takes the decision away from the founder.
   */
  readonly mood?: import('./mood').Mood;
}

/**
 * Fallback classifier for utterances the rules miss.
 *
 * Kept as an interface so the deterministic layer stays testable without a
 * model in the loop, and so a model failure degrades to `UNKNOWN` rather than
 * to a wrong action.
 */
export interface IntentClassifier {
  classify(utterance: string): Promise<Classification>;
}
