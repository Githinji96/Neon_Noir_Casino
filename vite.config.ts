import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    // Raise warning threshold
    chunkSizeWarningLimit: 800,
    // Target modern browsers — smaller output, better tree-shaking
    target: 'es2020',
    // Disable source maps in production — smaller bundles, faster CI
    sourcemap: false,
    // esbuild minifier (default): fastest and produces smallest output
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — loaded on every page
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Animation library — used across most pages
          'vendor-motion': ['framer-motion'],
          // Charts — only admin pages (already lazy loaded)
          'vendor-charts': ['recharts'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Form handling
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // State management
          'vendor-state': ['zustand'],
        },
      },
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    // Exclude Playwright e2e specs — those are run by `npm run test:e2e`, not vitest
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
});
