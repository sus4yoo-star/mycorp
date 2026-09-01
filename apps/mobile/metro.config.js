// Metro in a pnpm monorepo.
//
// Workspace packages ship TypeScript source rather than a build artifact, so
// Metro has to watch the repo root and resolve modules from both the app's and
// the root's node_modules. Without this, `@mycorp24/business-logic` resolves in
// tsc but fails at bundle time.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// pnpm's store is symlinked; letting Metro follow its own hierarchy walk picks
// up the wrong copy of react.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
