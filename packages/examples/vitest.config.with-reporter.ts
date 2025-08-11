import { defineConfig } from 'vitest/config'
import testIdPlugin from '../vitest-testid-plugin/src/index'
import { createUuidReporter } from '../vitest-uuid-reporter/src/index'

export default defineConfig({
  plugins: [
    // Add the test ID plugin to assign UUIDs to tests
    testIdPlugin({
      registryPath: '.test-ids.json',
      debug: false,
      autoSave: true,
      autoCleanup: true,
      fingerprintOptions: {
        hashAlgorithm: 'sha1',
        preserveVariableNames: false
      },
      matcherOptions: {
        similarityThreshold: 0.8,
        maxCandidates: 20
      }
    })
  ],
  test: {
    // Add the UUID reporter alongside built-in reporters
    reporters: [
      'default', // Keep the default console reporter
      createUuidReporter({
        outputFile: 'test-results-uuid.json',
        format: 'json',
        includeMetadata: true,
        onlyUuidTests: false // Include all tests, even those without UUIDs
      })
    ],
    
    // Optional: Configure test environment
    environment: 'node',
    
    // Optional: Test file patterns
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    
    // Optional: Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})