module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/validate-skills.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'cjs', 'json'],
};
