import type { TestIdPluginOptions } from './types'

export function createTestIdPlugin(_options: TestIdPluginOptions = {}) {
  return {
    name: 'vitest-testid-plugin',
    configureServer() {
      // Plugin implementation will go here
    }
  }
}