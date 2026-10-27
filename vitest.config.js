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
    // CI has no .env; src/lib/supabase.js creates its client at import time
    // and throws without a URL. Tests never reach the network.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
