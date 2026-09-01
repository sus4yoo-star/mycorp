import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  AiProviderError,
  type AiProvider,
  type CompletionRequest,
  type CompletionResult,
  type StructuredRequest,
  type StructuredResult,
  type TaskTier,
} from './provider';

/** The model MYCORP24 runs on. Changing this is a product decision. */
export const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Effort per task tier — the cost lever we do use. See `TaskTier`: we tune
 * effort rather than dropping to a weaker model.
 */
const EFFORT: Record<TaskTier, 'low' | 'medium' | 'high' | 'xhigh'> = {
  ROUTINE: 'low',
  STANDARD: 'high',
  EXECUTIVE: 'xhigh',
};

/** Non-streaming stays well under the SDK HTTP timeout; streaming can be generous. */
const MAX_TOKENS_BLOCKING = 16_000;
const MAX_TOKENS_STREAMING = 64_000;

export interface AnthropicProviderOptions {
  readonly client?: Anthropic;
  readonly model?: string;
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(opts: AnthropicProviderOptions = {}) {
    // Zero-arg construction resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN,
    // or an `ant auth login` profile. Never hardcode a key here.
    this.client = opts.client ?? new Anthropic();
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  private params(req: CompletionRequest, maxTokens: number) {
    const tier = req.tier ?? 'STANDARD';
    return {
      model: this.model,
      max_tokens: req.maxTokens ?? maxTokens,
      ...(req.system ? { system: req.system } : {}),
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      thinking: { type: 'adaptive' as const },
      output_config: { effort: EFFORT[tier] },
    };
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    try {
      const res = await this.client.messages.create(
        this.params(req, MAX_TOKENS_BLOCKING),
      );

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      const result: CompletionResult = {
        text,
        model: res.model,
        stopReason: res.stop_reason,
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
        },
        ...(res.stop_reason === 'refusal' && res.stop_details
          ? {
              refusal: {
                category: res.stop_details.category ?? null,
                ...(res.stop_details.explanation
                  ? { explanation: res.stop_details.explanation }
                  : {}),
              },
            }
          : {}),
      };
      return result;
    } catch (err) {
      throw toProviderError(err);
    }
  }

  async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    try {
      const { model, max_tokens, system, messages, thinking, output_config } = this.params(
        req,
        MAX_TOKENS_BLOCKING,
      );

      const res = await this.client.messages.parse({
        model,
        max_tokens,
        ...(system ? { system } : {}),
        messages,
        thinking,
        output_config: {
          ...output_config,
          format: zodOutputFormat(req.schema),
        },
      });

      // `parsed_output` is null when the answer did not satisfy the schema.
      // Failing here is the point: a half-parsed proposal must never reach the
      // database as if the model had produced it.
      if (res.parsed_output == null) {
        throw new AiProviderError('the model did not return a valid structured answer', false);
      }

      return {
        value: res.parsed_output as T,
        model: res.model,
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
        },
      };
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      throw toProviderError(err);
    }
  }

  async *stream(req: CompletionRequest): AsyncIterable<string> {
    let stream: ReturnType<Anthropic['messages']['stream']>;
    try {
      stream = this.client.messages.stream(this.params(req, MAX_TOKENS_STREAMING));
    } catch (err) {
      throw toProviderError(err);
    }

    try {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    } catch (err) {
      throw toProviderError(err);
    }
  }
}

/**
 * Collapse SDK errors into something the chief of staff can report honestly.
 * Retryable and permanent failures are distinguished so a retry loop does not
 * hammer a 400 forever.
 */
function toProviderError(err: unknown): AiProviderError {
  if (err instanceof Anthropic.RateLimitError) {
    return new AiProviderError('rate limited by the AI provider', true, err.status);
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new AiProviderError('AI provider credentials are invalid', false, err.status);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new AiProviderError(err.message, false, err.status);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiProviderError('could not reach the AI provider', true);
  }
  if (err instanceof Anthropic.APIError) {
    const retryable = typeof err.status === 'number' && err.status >= 500;
    return new AiProviderError(err.message, retryable, err.status);
  }
  return new AiProviderError(
    err instanceof Error ? err.message : 'unknown AI provider failure',
    false,
  );
}
