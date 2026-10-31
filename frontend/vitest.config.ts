import { defineConfig } from 'vitest/config'

// Minimal config for the pure-function unit tests under src/lib/*.test.ts.
// No React plugin / jsdom - none of the covered files touch the DOM, and
// keeping this separate from vite.config.ts avoids pulling the app's full
// plugin chain (Tailwind, etc.) into a test run that doesn't need it.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
