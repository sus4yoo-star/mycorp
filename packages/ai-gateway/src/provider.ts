/**
 * AI provider abstraction — spec §73.1, B1 AI Model Gateway.
 *
 * Nothing in MYCORP24 imports a vendor SDK directly. Agents describe the work
 * they need done; this layer decides which provider and which settings serve
 * it. Claude is the default provider; the interface exists so a second one can
 * be added without touching a single agent.
 */

/**
 * How much thinking a task deserves.
 *
 * We do not swap to a weaker model to save money — that is the founder's
 * decision, not ours. We vary effort instead, which trades depth against spend
 * within one model and keeps a single prompt cache namespace.
 */
export type TaskTier =
  /** Routing, classification, short extraction. */
  | 'ROUTINE'
  /** Drafting, summarising, day-to-day division work. */
  | 'STANDARD'
  /** Executive analysis, strategy, audit reconciliation. */
  | 'EXECUTIVE';

export interface CompletionRequest {
  readonly system?: string;
  readonly messages: readonly { role: 'user' | 'assistant'; content: string }[];
  readonly tier?: TaskTier;
  readonly maxTokens?: number;
}

export interface CompletionResult {
  readonly text: string;
  readonly model: string;
  readonly stopReason: string | null;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
  /** Set when the provider declined the request rather than answering it. */
  readonly refusal?: { readonly category: string | null; readonly explanation?: string };
}

export interface AiProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
  /** Yields text deltas. Use for anything the founder watches in real time. */
  stream(req: CompletionRequest): AsyncIterable<string>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
