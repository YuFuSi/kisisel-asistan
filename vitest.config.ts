import { defineConfig } from 'vitest/config'

// Testler Electron'un Node'u ile çalışır (bkz. package.json "test" betiği),
// çünkü better-sqlite3 Electron için derlenmiştir.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})
