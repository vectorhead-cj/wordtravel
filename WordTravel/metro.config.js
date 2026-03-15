const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    sourceExts: [...defaultConfig.resolver.sourceExts, 'txt'],
    assetExts: defaultConfig.resolver.assetExts.filter(ext => ext !== 'txt'),
  },
  transformer: {
    babelTransformerPath: require.resolve('./metro-txt-transformer.js'),
  },
};

module.exports = mergeConfig(defaultConfig, config);
