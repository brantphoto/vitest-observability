export interface FingerprintOptions {
  /**
   * Hash algorithm to use for fingerprinting
   * @default 'sha1'
   */
  hashAlgorithm?: 'sha1' | 'sha256'

  /**
   * Whether to preserve variable names in the fingerprint
   * @default false
   */
  preserveVariableNames?: boolean
}

export interface TestFunction {
  name: string
  body: string
  source: string
}

export interface MatchResult {
  uuid: string
  confidence: number
  existingHash: string
  newHash: string
  isExactMatch: boolean
}

export interface MatcherOptions {
  /**
   * Threshold for fuzzy matching (0-1)
   * @default 0.8
   */
  similarityThreshold: number

  /**
   * Maximum number of candidates to consider for matching
   * @default 20
   */
  maxCandidates: number
}

export interface TestEntry {
  uuid: string
  nodeId: string
  hash: string
  bodyLength: number
  timestamp: number
  lastNodeId?: string
  lastSeen?: number
}

export interface Registry {
  [uuid: string]: TestEntry
}

export interface TestIdPluginOptions {
  /**
   * Path to the test registry file
   * @default '.test-ids.json'
   */
  registryPath?: string

  /**
   * Options for test fingerprinting
   */
  fingerprintOptions?: FingerprintOptions

  /**
   * Options for test matching
   */
  matcherOptions?: Partial<MatcherOptions>

  /**
   * Whether to save the registry after each test run
   * @default true
   */
  autoSave?: boolean

  /**
   * Whether to cleanup orphaned UUIDs after test runs
   * @default true
   */
  autoCleanup?: boolean

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}
