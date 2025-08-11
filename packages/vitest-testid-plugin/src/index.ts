// Main plugin export
export { default as testIdPlugin } from './plugin'
export type { TestIdPluginOptions as PluginOptions } from '@vitest-testid/types'

// Core components for advanced usage
export { TestFingerprinter } from './fingerprint'
export { TestRegistry } from './registry'
export { TestMatcher } from './matcher'
export type { 
  TestFunction, 
  FingerprintOptions,
  TestEntry, 
  Registry,
  MatchResult, 
  MatcherOptions 
} from '@vitest-testid/types'