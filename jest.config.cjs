module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/validate-skills.ts', '<rootDir>/tests/validate-scheme.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'cjs', 'json'],
};
