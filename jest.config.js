module.exports = {
  transform: {
    '^.+\\.(j|t)sx?$': 'ts-jest',
  },
  testPathIgnorePatterns:['/esm/'],
  globals: {
    'ts-jest': {
      tsConfig: './tsconfig.test.json',
    },
  },
}
