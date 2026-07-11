import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/crypto-lab-hybrid-pqc/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
