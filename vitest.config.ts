import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/**/*.renderer.test.ts'],
    restoreMocks: true,
  },
});
