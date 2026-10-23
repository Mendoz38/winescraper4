import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // Lus au chargement des modules : délais à zéro pour des tests rapides
    env: {
      SCRAPE_CONCURRENCY: '3',
      SCRAPE_PAGE_DELAY_MS: '0',
      SCRAPE_PAGE_RETRY_ATTEMPTS: '3',
      SCRAPE_PAGE_RETRY_DELAY_MS: '0',
      SCRAPE_RATE_LIMIT_MAX_DELAY_MS: '50',
    },
    testTimeout: 10000,
  },
});
