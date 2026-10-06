import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // The demo backend has realistic latency and the flow tests mount the whole
    // app in jsdom, which gets expensive when every file runs in parallel. A
    // 30s budget failed intermittently on slow machines for no functional reason.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Most files mount the whole app in jsdom. Running them concurrently starves
    // each other badly enough that timeouts fire on healthy code, so the suite is
    // serialised. It is slower in wall-clock but deterministic.
    fileParallelism: false,
  },
})