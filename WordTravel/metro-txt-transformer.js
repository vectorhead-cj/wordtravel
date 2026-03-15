const upstreamTransformer = require('@react-native/metro-babel-transformer');
const crypto = require('crypto');
const fs = require('fs');

const cacheKeyParts = [fs.readFileSync(__filename)];

module.exports = {
  transform({src, filename, options}) {
    if (filename.endsWith('.txt')) {
      return upstreamTransformer.transform({
        src: `export default ${JSON.stringify(src)};`,
        filename,
        options,
      });
    }
    return upstreamTransformer.transform({src, filename, options});
  },

  getCacheKey() {
    const key = crypto.createHash('md5');
    cacheKeyParts.forEach(part => key.update(part));
    key.update(upstreamTransformer.getCacheKey());
    return key.digest('hex');
  },
};
