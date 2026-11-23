// Resolves `react-native-glass-transitions` to the library's source in ../src, with no symlink and no
// workspace. The repo root's node_modules (the library's devDependencies, for build/typecheck) is
// blocked, so ../src's imports fall through to example/node_modules: react, react-native,
// reanimated, worklets and skia are bundled once.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const config = getDefaultConfig(__dirname);

config.watchFolders = [root]; // ../src and ../package.json (its `exports`)
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${escape(root)}/(node_modules|lib|media|marketing)/`),
];
config.resolver.extraNodeModules = { [pkg.name]: root };

// Only for this package: prefer its `source` export condition (src/) over the built lib/.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const ours = moduleName === pkg.name || moduleName.startsWith(`${pkg.name}/`);
  const ctx = ours ? { ...context, unstable_conditionNames: ['source', ...context.unstable_conditionNames] } : context;
  return ctx.resolveRequest(ctx, moduleName, platform);
};

module.exports = config;
