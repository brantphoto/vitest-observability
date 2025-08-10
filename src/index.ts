// Main plugin export
export { default as testIdPlugin } from './plugin'
export type { PluginOptions } from './plugin'

// Core components for advanced usage
export { TestFingerprinter } from './fingerprint'
export { TestRegistry } from './registry'
export { TestMatcher } from './matcher'
export type { 
  TestFunction, 
  FingerprintOptions 
} from './fingerprint'
export type { 
  TestEntry, 
  Registry 
} from './registry'
export type { 
  MatchResult, 
  MatcherOptions 
} from './matcher'