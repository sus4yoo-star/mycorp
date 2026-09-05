import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source, not a build artifact.
  transpilePackages: [
    '@mycorp24/types',
    '@mycorp24/agent-types',
    '@mycorp24/business-logic',
    '@mycorp24/chat',
    '@mycorp24/db',
    '@mycorp24/integrations',
    '@mycorp24/vault',
    '@mycorp24/tool-gateway',
    '@mycorp24/intelligence',
    '@mycorp24/ai-gateway',
    '@mycorp24/auth',
    '@mycorp24/work',
  ],
};

export default config;
