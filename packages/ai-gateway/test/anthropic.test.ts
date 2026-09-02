import { describe, expect, it } from 'vitest';
import { AnthropicProvider, DEFAULT_MODEL } from '../src/anthropic';

/**
 * The request we actually send. These are the settings that decide whether a
 * reply arrives at all, and none of them are visible from a passing build.
 */
function capture() {
  const seen: Record<string, unknown>[] = [];
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        seen.push(params);
        return {
          content: [{ type: 'text', text: '네, 회장님.' }],
          model: DEFAULT_MODEL,
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        };
      },
    },
  };
  // The fake stands in for the SDK client; only the call shape matters here.
  const provider = new AnthropicProvider({ client: client as never });
  return { provider, seen };
}

describe('the request sent to Claude', () => {
  it('runs on the model the product chose', async () => {
    const { provider, seen } = capture();
    await provider.complete({ messages: [{ role: 'user', content: 'x' }] });
    expect(seen[0]!['model']).toBe('claude-opus-5');
  });

  it('leaves adaptive thinking on', async () => {
    const { provider, seen } = capture();
    await provider.complete({ messages: [{ role: 'user', content: 'x' }] });
    expect(seen[0]!['thinking']).toEqual({ type: 'adaptive' });
  });

  it('varies effort by tier instead of swapping the model down', async () => {
    const { provider, seen } = capture();
    await provider.complete({ messages: [{ role: 'user', content: 'x' }], tier: 'ROUTINE' });
    await provider.complete({ messages: [{ role: 'user', content: 'x' }], tier: 'EXECUTIVE' });
    expect(seen[0]!['output_config']).toEqual({ effort: 'low' });
    expect(seen[1]!['output_config']).toEqual({ effort: 'xhigh' });
    expect(seen[0]!['model']).toBe(seen[1]!['model']);
  });

  // Thinking is spent from max_tokens. A ceiling sized for the visible answer
  // can be gone before a word is written, and the reply comes back with no text
  // block at all — which reads as the model being unavailable.
  it('does not ship a budget too small to think and answer in', async () => {
    const { provider, seen } = capture();
    await provider.complete({ messages: [{ role: 'user', content: 'x' }] });
    expect(seen[0]!['max_tokens']).toBeGreaterThanOrEqual(4000);
  });

  it('still honours an explicit budget when a caller has a reason for one', async () => {
    const { provider, seen } = capture();
    await provider.complete({ messages: [{ role: 'user', content: 'x' }], maxTokens: 512 });
    expect(seen[0]!['max_tokens']).toBe(512);
  });
});
