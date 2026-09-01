import { AnthropicProvider } from './anthropic';
import type { AiProvider } from './provider';

export * from './provider';
export * from './anthropic';

/**
 * Resolve the configured provider. `MYCORP24_AI_PROVIDER` selects it; Claude is
 * the default. Adding a provider means adding a case here and a class beside
 * `AnthropicProvider` — no agent code changes.
 */
export function createAiProvider(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AiProvider {
  const name = (env['MYCORP24_AI_PROVIDER'] ?? 'anthropic').toLowerCase();
  switch (name) {
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new Error(
        `Unknown MYCORP24_AI_PROVIDER "${name}". Supported providers: anthropic.`,
      );
  }
}
