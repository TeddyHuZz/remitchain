const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and monorepo roots
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro look for packages in both local and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Force Metro to map Node core imports to their mobile polyfills
config.resolver.extraNodeModules = {
  events: path.resolve(projectRoot, 'node_modules/events'),
  buffer: path.resolve(projectRoot, 'node_modules/buffer'),
  url: path.resolve(projectRoot, 'node_modules/url'),
  stream: path.resolve(projectRoot, 'node_modules/stream-browserify'),
  path: path.resolve(projectRoot, 'node_modules/path-browserify'),
};

module.exports = config;
