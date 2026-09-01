import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.js (build/dev server) so component tests
// don't pull in the API dev-server middleware or PWA plugin.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/components/setupTests.js'],
    include: ['test/components/**/*.test.{jsx,js}'],
  },
});
