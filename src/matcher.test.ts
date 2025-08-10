import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestMatcher } from './matcher'
import { TestFingerprinter } from './fingerprint'
import { TestRegistry } from './registry'
import { unlinkSync, existsSync } from 'fs'

describe('TestMatcher', () => {
  let matcher: TestMatcher
  let fingerprinter: TestFingerprinter
  let registry: TestRegistry
  const testRegistryPath = '.test-matcher.json'

  beforeEach(() => {
    // Clean up any existing test file
    if (existsSync(testRegistryPath)) {
      unlinkSync(testRegistryPath)
    }
    
    fingerprinter = new TestFingerprinter()
    registry = new TestRegistry(testRegistryPath)
    matcher = new TestMatcher(fingerprinter, registry, {
      similarityThreshold: 0.6, // Lower threshold for better matching
      maxCandidates: 10
    })
  })

  afterEach(() => {
    // Clean up test file
    if (existsSync(testRegistryPath)) {
      unlinkSync(testRegistryPath)
    }
  })

  describe('findMatch', () => {
    it('should find exact matches', () => {
      const testFn = {
        name: 'should work',
        body: '{ expect(1 + 1).toBe(2) }',
        source: 'test("should work", () => { expect(1 + 1).toBe(2) })'
      }

      // Add test to registry first
      const originalUuid = matcher.assignUuid(testFn, 'test.js::should_work')
      
      // Find match for same test
      const match = matcher.findMatch(testFn, 'test.js::should_work')
      
      expect(match).toBeDefined()
      expect(match?.uuid).toBe(originalUuid)
      expect(match?.confidence).toBe(1.0)
      expect(match?.isExactMatch).toBe(true)
    })

    it('should find fuzzy matches for similar node IDs', () => {
      const originalTestFn = {
        name: 'should work correctly',
        body: '{ expect(getValue()).toBe(42) }',
        source: 'test("should work correctly", () => { expect(getValue()).toBe(42) })'
      }

      const modifiedTestFn = {
        name: 'should work correctly',
        body: '{ expect(getValue()).toBe(43) }', // Changed expected value
        source: 'test("should work correctly", () => { expect(getValue()).toBe(43) })'
      }

      // Add original test
      const originalUuid = matcher.assignUuid(originalTestFn, 'math.test.js::should_work_correctly')
      
      // Try to match modified test with same node ID structure
      const match = matcher.findMatch(modifiedTestFn, 'math.test.js::should_work_correctly')
      
      expect(match).toBeDefined()
      expect(match?.uuid).toBe(originalUuid)
      expect(match?.confidence).toBeGreaterThan(0.6)
      expect(match?.isExactMatch).toBe(false)
    })

    it('should find fuzzy matches for renamed tests', () => {
      const originalTestFn = {
        name: 'should calculate sum',
        body: '{ expect(add(2, 3)).toBe(5) }',
        source: 'test("should calculate sum", () => { expect(add(2, 3)).toBe(5) })'
      }

      const renamedTestFn = {
        name: 'should calculate addition',
        body: '{ expect(add(2, 3)).toBe(5) }',
        source: 'test("should calculate addition", () => { expect(add(2, 3)).toBe(5) })'
      }

      // Add original test
      const originalUuid = matcher.assignUuid(originalTestFn, 'calc.test.js::should_calculate_sum')
      
      // Try to match renamed test (same file, similar name)
      const match = matcher.findMatch(renamedTestFn, 'calc.test.js::should_calculate_addition')
      
      expect(match).toBeDefined()
      expect(match?.uuid).toBe(originalUuid)
      expect(match?.confidence).toBeGreaterThan(0.5) // Lower threshold for name changes
    })

    it('should return null when no good matches exist', () => {
      const testFn1 = {
        name: 'completely different test',
        body: '{ expect(true).toBe(true) }',
        source: 'test("completely different test", () => { expect(true).toBe(true) })'
      }

      const testFn2 = {
        name: 'another unrelated test',
        body: '{ expect(false).toBe(false) }',
        source: 'test("another unrelated test", () => { expect(false).toBe(false) })'
      }

      // Add first test
      matcher.assignUuid(testFn1, 'file1.test.js::test1')
      
      // Try to match completely different test
      const match = matcher.findMatch(testFn2, 'file2.test.js::test2')
      
      expect(match).toBeNull()
    })
  })

  describe('assignUuid', () => {
    it('should create new UUID for new tests', () => {
      const testFn = {
        name: 'new test',
        body: '{ expect(1).toBe(1) }',
        source: 'test("new test", () => { expect(1).toBe(1) })'
      }

      const uuid = matcher.assignUuid(testFn, 'test.js::new_test')
      
      expect(uuid).toMatch(/^[0-9a-f-]{36}$/) // UUID format
      
      const entry = registry.findByUuid(uuid)
      expect(entry?.lastNodeId).toBe('test.js::new_test')
    })

    it('should reuse UUID for matching tests', () => {
      const testFn1 = {
        name: 'test',
        body: '{ expect(2 + 2).toBe(4) }',
        source: 'test("test", () => { expect(2 + 2).toBe(4) })'
      }

      const testFn2 = {
        name: 'test',
        body: '{ expect(2 + 2).toBe(4) }',
        source: 'test("test", () => { expect(2 + 2).toBe(4) })'
      }

      const uuid1 = matcher.assignUuid(testFn1, 'test.js::test')
      const uuid2 = matcher.assignUuid(testFn2, 'test.js::test')
      
      expect(uuid1).toBe(uuid2)
    })

    it('should update node ID when test moves', () => {
      const testFn = {
        name: 'moveable test',
        body: '{ expect("hello").toBeTruthy() }',
        source: 'test("moveable test", () => { expect("hello").toBeTruthy() })'
      }

      // First assignment
      const uuid = matcher.assignUuid(testFn, 'old-file.test.js::moveable_test')
      
      // Second assignment with new location
      const uuid2 = matcher.assignUuid(testFn, 'new-file.test.js::moveable_test')
      
      expect(uuid).toBe(uuid2)
      
      const entry = registry.findByUuid(uuid)
      expect(entry?.lastNodeId).toBe('new-file.test.js::moveable_test')
    })
  })

  describe('getMatchDetails', () => {
    it('should provide detailed matching information', () => {
      const testFn1 = {
        name: 'first test',
        body: '{ expect(1).toBe(1) }',
        source: 'test("first test", () => { expect(1).toBe(1) })'
      }

      const testFn2 = {
        name: 'second test', 
        body: '{ expect(2).toBe(2) }',
        source: 'test("second test", () => { expect(2).toBe(2) })'
      }

      const queryTestFn = {
        name: 'first test modified',
        body: '{ expect(1).toBe(10) }', // Different expected value to ensure different fingerprint
        source: 'test("first test modified", () => { expect(1).toBe(10) })'
      }

      // Add some tests
      matcher.assignUuid(testFn1, 'test.js::first_test')
      matcher.assignUuid(testFn2, 'test.js::second_test')
      
      // Get match details for similar test
      const details = matcher.getMatchDetails(queryTestFn, 'test.js::first_test_modified')
      
      expect(details.match).toBeDefined()
      expect(details.candidates).toHaveLength(2)
      expect(details.candidates[0].similarity).toBeGreaterThan(details.candidates[1].similarity)
    })
  })

  describe('similarity calculation', () => {
    it('should calculate high similarity for identical node IDs', () => {
      const testFn1 = {
        name: 'test',
        body: '{ expect(true).toBe(true) }',
        source: ''
      }

      const testFn2 = {
        name: 'test',
        body: '{ expect(false).toBe(false) }',
        source: ''
      }

      // Add first test
      const uuid1 = matcher.assignUuid(testFn1, 'same.test.js::same_test')
      
      // Check similarity with identical node ID
      const details = matcher.getMatchDetails(testFn2, 'same.test.js::same_test')
      
      expect(details.candidates[0]?.similarity).toBeGreaterThan(0.6)
    })

    it('should calculate moderate similarity for similar node IDs', () => {
      const testFn1 = {
        name: 'original test name',
        body: '{ expect(true).toBe(true) }',
        source: ''
      }

      const testFn2 = {
        name: 'modified test name',
        body: '{ expect(false).toBe(false) }',
        source: ''
      }

      // Add first test
      matcher.assignUuid(testFn1, 'test.js::original_test_name')
      
      // Check similarity with similar node ID
      const details = matcher.getMatchDetails(testFn2, 'test.js::modified_test_name')
      
      expect(details.candidates).toHaveLength(1)
      expect(details.candidates[0].similarity).toBeGreaterThan(0.5)
      expect(details.candidates[0].similarity).toBeLessThan(0.9)
    })
  })
})