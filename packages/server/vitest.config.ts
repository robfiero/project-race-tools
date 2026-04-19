import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/index.ts',
        // Route handlers — HTTP integration layer, not unit-testable in isolation
        'src/routes/**',
        // Session stores — S3 and in-memory infrastructure
        'src/session/**',
        // Sample data generators — deterministic but not business logic
        'src/sample/**',
        // External API clients — require network mocking
        'src/weather/**',
        // Geocoding helpers — require network or ZIP DB loading
        'src/geo/geocode.ts',
        'src/geo/zipLoader.ts',
      ],
    },
  },
});
