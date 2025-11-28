module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.txt$': '<rootDir>/jest-text-transformer.js',
  },
};
