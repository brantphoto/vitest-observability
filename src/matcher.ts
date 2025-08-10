import { TestFunction, TestFingerprinter } from './fingerprint'
import { TestRegistry, TestEntry } from './registry'

export interface MatchResult {
  uuid: string
  confidence: number
  existingHash: string
  newHash: string
  isExactMatch: boolean
}

export interface MatcherOptions {
  similarityThreshold: number // 0-1, minimum similarity score for fuzzy matching
  maxCandidates: number // Maximum number of candidates to consider for fuzzy matching
}

export class TestMatcher {
  private fingerprinter: TestFingerprinter
  private registry: TestRegistry
  private options: Required<MatcherOptions>

  constructor(
    fingerprinter: TestFingerprinter,
    registry: TestRegistry,
    options: Partial<MatcherOptions> = {}
  ) {
    this.fingerprinter = fingerprinter
    this.registry = registry
    this.options = {
      similarityThreshold: options.similarityThreshold ?? 0.8,
      maxCandidates: options.maxCandidates ?? 20
    }
  }

  /**
   * Find the best match for a test function, either exact or fuzzy
   */
  findMatch(testFunction: TestFunction, nodeId: string): MatchResult | null {
    const newHash = this.fingerprinter.fingerprintTest(testFunction)
    
    // First try exact match
    const exactMatch = this.registry.findByHash(newHash)
    if (exactMatch) {
      return {
        uuid: exactMatch.uuid,
        confidence: 1.0,
        existingHash: exactMatch.hash,
        newHash,
        isExactMatch: true
      }
    }

    // Try fuzzy matching if no exact match
    return this.findFuzzyMatch(testFunction, newHash, nodeId)
  }

  /**
   * Find fuzzy matches using similarity comparison
   */
  private findFuzzyMatch(testFunction: TestFunction, newHash: string, nodeId: string): MatchResult | null {
    const normalizedNewCode = this.fingerprinter['normalizeTestBody'](testFunction.body)
    const allEntries = this.registry.getAllEntries()
    
    if (allEntries.length === 0) {
      return null
    }

    // Calculate similarities with existing tests
    const candidates: Array<{ entry: TestEntry; similarity: number }> = []
    
    for (const entry of allEntries) {
      // Skip if we already have an exact match for this hash
      if (entry.hash === newHash) {
        continue
      }

      // For fuzzy matching, we need to reconstruct the normalized code from the entry
      // This is a limitation of our current approach - we'd need to store normalized code
      // or original test functions to do proper fuzzy matching
      // For now, we'll use a simpler approach based on node ID similarity and test name matching
      
      const similarity = this.calculateSimilarity(testFunction, entry, nodeId)
      
      if (similarity >= this.options.similarityThreshold) {
        candidates.push({ entry, similarity })
      }
    }

    if (candidates.length === 0) {
      return null
    }

    // Sort by similarity and take the best match
    candidates.sort((a, b) => b.similarity - a.similarity)
    const bestMatch = candidates[0]

    return {
      uuid: bestMatch.entry.uuid,
      confidence: bestMatch.similarity,
      existingHash: bestMatch.entry.hash,
      newHash,
      isExactMatch: false
    }
  }

  /**
   * Calculate similarity between a test function and an existing registry entry
   * This uses heuristics like node ID similarity and test name matching
   */
  private calculateSimilarity(testFunction: TestFunction, entry: TestEntry, nodeId: string): number {
    let similarity = 0
    let totalWeight = 0

    // Factor 1: Node ID similarity (file path + test name structure)
    const nodeIdSimilarity = this.calculateLevenshteinSimilarity(nodeId, entry.lastNodeId)
    similarity += nodeIdSimilarity * 0.5
    totalWeight += 0.5

    // Factor 2: Test name similarity - extract names and compare
    const testName = testFunction.name
    const existingTestName = this.extractTestNameFromNodeId(entry.lastNodeId) || testName
    const nameSimilarity = this.calculateLevenshteinSimilarity(testName, existingTestName)
    similarity += nameSimilarity * 0.5
    totalWeight += 0.5

    return totalWeight > 0 ? similarity / totalWeight : 0
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0
    if (str1.length === 0 || str2.length === 0) return 0.0

    const distance = this.levenshteinDistance(str1, str2)
    const maxLength = Math.max(str1.length, str2.length)
    
    return (maxLength - distance) / maxLength
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Calculate similarity based on numeric values (like string lengths)
   */
  private calculateLengthSimilarity(val1: number, val2: number): number {
    if (val1 === val2) return 1.0
    if (val1 === 0 && val2 === 0) return 1.0
    
    const diff = Math.abs(val1 - val2)
    const max = Math.max(val1, val2)
    
    return max > 0 ? Math.max(0, (max - diff) / max) : 0
  }

  /**
   * Extract test name from node ID (simple heuristic)
   */
  private extractTestNameFromNodeId(nodeId: string): string | null {
    // Node IDs typically follow patterns like "file.test.js > describe block > test name"
    // or "file.test.js::test_name"
    
    const parts = nodeId.split('::')
    if (parts.length > 1) {
      // Convert snake_case/camelCase back to readable form
      const testId = parts[parts.length - 1]
      return testId.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
    }

    const matches = nodeId.match(/>\s*([^>]+)\s*$/)
    return matches ? matches[1].trim() : null
  }

  /**
   * Create or update a test entry based on matching results
   */
  assignUuid(testFunction: TestFunction, nodeId: string): string {
    const matchResult = this.findMatch(testFunction, nodeId)
    
    if (matchResult) {
      // Update existing entry with new hash and node ID
      this.registry.update(matchResult.uuid, matchResult.newHash, nodeId)
      return matchResult.uuid
    } else {
      // Create new entry
      const newHash = this.fingerprinter.fingerprintTest(testFunction)
      return this.registry.add(newHash, nodeId)
    }
  }

  /**
   * Get detailed matching information for debugging
   */
  getMatchDetails(testFunction: TestFunction, nodeId: string): {
    match: MatchResult | null
    candidates: Array<{ entry: TestEntry; similarity: number }>
  } {
    const newHash = this.fingerprinter.fingerprintTest(testFunction)
    
    // Check exact match first
    const exactMatch = this.registry.findByHash(newHash)
    if (exactMatch) {
      return {
        match: {
          uuid: exactMatch.uuid,
          confidence: 1.0,
          existingHash: exactMatch.hash,
          newHash,
          isExactMatch: true
        },
        candidates: []
      }
    }

    // Get fuzzy match candidates
    const normalizedNewCode = this.fingerprinter['normalizeTestBody'](testFunction.body)
    const allEntries = this.registry.getAllEntries()
    
    const candidates: Array<{ entry: TestEntry; similarity: number }> = []
    
    for (const entry of allEntries) {
      if (entry.hash === newHash) continue
      
      const similarity = this.calculateSimilarity(testFunction, entry, nodeId)
      candidates.push({ entry, similarity })
    }

    // Sort candidates by similarity
    candidates.sort((a, b) => b.similarity - a.similarity)
    
    const bestMatch = candidates.find(c => c.similarity >= this.options.similarityThreshold)
    
    return {
      match: bestMatch ? {
        uuid: bestMatch.entry.uuid,
        confidence: bestMatch.similarity,
        existingHash: bestMatch.entry.hash,
        newHash,
        isExactMatch: false
      } : null,
      candidates: candidates.slice(0, this.options.maxCandidates)
    }
  }
}