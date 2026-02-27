/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true,
        tsconfig: {
          module: 'ESNext',
          target: 'ESNext',
          moduleResolution: 'node',
          esModuleInterop: true,
          skipLibCheck: true,
          lib: ['esnext'],
          types: ['@cloudflare/workers-types', 'node', 'jest'],
          resolveJsonModule: true,
        },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  testTimeout: 30000, // Set default timeout to 30 seconds
};
