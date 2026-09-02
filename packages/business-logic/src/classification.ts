import type { SecurityLevel } from '@mycorp24/types';

/** Content kinds the classifier recognises. Spec §182. */
export type ContentKind =
  | 'SOCIAL_CONTENT'
  | 'MEETING_SUMMARY'
  | 'REVENUE_ANALYSIS'
  | 'CUSTOMER_PII'
  | 'API_CREDENTIAL'
  | 'CONTRACT'
  | 'STRATEGY'
  | 'UNKNOWN';

/** Default classification suggested by the AI — spec §182. */
export const DEFAULT_CLASSIFICATION: Record<ContentKind, SecurityLevel> = {
  SOCIAL_CONTENT: 'PUBLIC',
  MEETING_SUMMARY: 'INTERNAL',
  REVENUE_ANALYSIS: 'CONFIDENTIAL',
  CUSTOMER_PII: 'SECRET',
  API_CREDENTIAL: 'TOP_SECRET',
  CONTRACT: 'CONFIDENTIAL',
  STRATEGY: 'CONFIDENTIAL',
  // Unknown content is not public by default. Spec §183 warns before sharing.
  UNKNOWN: 'INTERNAL',
};

export const classifyDefault = (kind: ContentKind): SecurityLevel =>
  DEFAULT_CLASSIFICATION[kind];

/**
 * Patterns that must trigger a warning before anything is shared outside the
 * company. Spec §183. Detection is deliberately noisy: a false warning costs a
 * click, a missed credential costs the company.
 */
export const SENSITIVE_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: 'API key', re: /\b(sk|pk|api[_-]?key|secret)[-_][A-Za-z0-9]{16,}\b/i },
  { name: 'Bearer token', re: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/ },
  { name: 'Email address', re: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/ },
  { name: 'Korean phone number', re: /\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/ },
  { name: 'Korean resident registration number', re: /\b\d{6}[-\s]?[1-4]\d{6}\b/ },
  { name: 'Card number', re: /\b(?:\d[ -]?){13,19}\b/ },
];

export interface SensitiveFinding {
  readonly name: string;
  readonly count: number;
}

export function detectSensitive(text: string): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  for (const p of SENSITIVE_PATTERNS) {
    const m = text.match(new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : `${p.re.flags}g`));
    if (m && m.length > 0) findings.push({ name: p.name, count: m.length });
  }
  return findings;
}
