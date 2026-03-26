import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: { warnOnly: true },
    }],
  },
  setupFiles: ['<rootDir>/tests/jest.setup.ts'],
  // Map bare "src/..." imports (used in jest.mock() inside src/tests/mocks.ts) to actual paths
  moduleDirectories: ['node_modules', '<rootDir>'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/**/*.types.ts',
    '!src/tests/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
  verbose: true,
  testTimeout: 15000,
  forceExit: true,
};

export default config;
