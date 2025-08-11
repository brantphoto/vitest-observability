import { describe, it, expect } from 'vitest'
import { TestFingerprinter } from './fingerprint'

describe('TestFingerprinter', () => {
  const fingerprinter = new TestFingerprinter()

  describe('extractTestFunctions', () => {
    it('should extract basic test function', () => {
      const source = `
        test('should work', () => {
          expect(1 + 1).toBe(2)
        })
      `
      
      const functions = fingerprinter.extractTestFunctions(source)
      
      expect(functions).toHaveLength(1)
      expect(functions[0].name).toBe('should work')
      expect(functions[0].body).toContain('expect(1 + 1).toBe(2)')
    })

    it('should extract it() function', () => {
      const source = `
        it('does something', function() {
          const result = doSomething()
          expect(result).toBeTruthy()
        })
      `
      
      const functions = fingerprinter.extractTestFunctions(source)
      
      expect(functions).toHaveLength(1)
      expect(functions[0].name).toBe('does something')
    })

    it('should extract test.skip and test.only', () => {
      const source = `
        test.skip('skipped test', () => {
          expect(false).toBe(true)
        })
        
        test.only('only test', () => {
          expect(true).toBe(true)
        })
      `
      
      const functions = fingerprinter.extractTestFunctions(source)
      
      expect(functions).toHaveLength(2)
      expect(functions[0].name).toBe('skipped test')
      expect(functions[1].name).toBe('only test')
    })

    it('should handle describe blocks', () => {
      const source = `
        describe('test suite', () => {
          test('nested test', () => {
            expect(true).toBe(true)
          })
        })
      `
      
      const functions = fingerprinter.extractTestFunctions(source)
      
      expect(functions).toHaveLength(2) // describe + test
      expect(functions.map(f => f.name)).toContain('test suite')
      expect(functions.map(f => f.name)).toContain('nested test')
    })

    it('should handle malformed code gracefully', () => {
      const source = 'invalid javascript code {'
      
      const functions = fingerprinter.extractTestFunctions(source)
      
      expect(functions).toHaveLength(0)
    })
  })

  describe('fingerprintTest', () => {
    it('should generate consistent fingerprints for identical tests', () => {
      const testFn1 = {
        name: 'test',
        body: '{ expect(1 + 1).toBe(2) }',
        source: 'test("test", () => { expect(1 + 1).toBe(2) })'
      }
      
      const testFn2 = {
        name: 'test',
        body: '{ expect(1 + 1).toBe(2) }',
        source: 'test("test", () => { expect(1 + 1).toBe(2) })'
      }
      
      const hash1 = fingerprinter.fingerprintTest(testFn1)
      const hash2 = fingerprinter.fingerprintTest(testFn2)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{40}$/) // SHA1 hash format
    })

    it('should ignore whitespace differences', () => {
      const testFn1 = {
        name: 'test',
        body: '{ expect(1+1).toBe(2) }',
        source: ''
      }
      
      const testFn2 = {
        name: 'test', 
        body: '{\n  expect(1 + 1).toBe(2)\n}',
        source: ''
      }
      
      const hash1 = fingerprinter.fingerprintTest(testFn1)
      const hash2 = fingerprinter.fingerprintTest(testFn2)
      
      expect(hash1).toBe(hash2)
    })

    it('should ignore comments', () => {
      const testFn1 = {
        name: 'test',
        body: '{ expect(1 + 1).toBe(2) }',
        source: ''
      }
      
      const testFn2 = {
        name: 'test',
        body: '{ /* comment */ expect(1 + 1).toBe(2) /* another comment */ }',
        source: ''
      }
      
      const hash1 = fingerprinter.fingerprintTest(testFn1)
      const hash2 = fingerprinter.fingerprintTest(testFn2)
      
      expect(hash1).toBe(hash2)
    })

    it('should detect meaningful changes', () => {
      const testFn1 = {
        name: 'test',
        body: '{ expect(1 + 1).toBe(2) }',
        source: ''
      }
      
      const testFn2 = {
        name: 'test',
        body: '{ expect(1 + 1).toBe(3) }',
        source: ''
      }
      
      const hash1 = fingerprinter.fingerprintTest(testFn1)
      const hash2 = fingerprinter.fingerprintTest(testFn2)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('variable name normalization', () => {
    it('should normalize variable names when preserveVariableNames is false', () => {
      const fingerpriniterNoPreserve = new TestFingerprinter({ preserveVariableNames: false })
      
      const testFn1 = {
        name: 'test',
        body: '{ const result = getValue(); expect(result).toBe(5) }',
        source: ''
      }
      
      const testFn2 = {
        name: 'test', 
        body: '{ const data = getValue(); expect(data).toBe(5) }',
        source: ''
      }
      
      const hash1 = fingerpriniterNoPreserve.fingerprintTest(testFn1)
      const hash2 = fingerpriniterNoPreserve.fingerprintTest(testFn2)
      
      expect(hash1).toBe(hash2)
    })

    it('should preserve variable names when preserveVariableNames is true', () => {
      const fingerprinterPreserve = new TestFingerprinter({ preserveVariableNames: true })
      
      const testFn1 = {
        name: 'test',
        body: '{ const result = getValue(); expect(result).toBe(5) }',
        source: ''
      }
      
      const testFn2 = {
        name: 'test',
        body: '{ const data = getValue(); expect(data).toBe(5) }', 
        source: ''
      }
      
      const hash1 = fingerprinterPreserve.fingerprintTest(testFn1)
      const hash2 = fingerprinterPreserve.fingerprintTest(testFn2)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('hash algorithms', () => {
    it('should use SHA1 by default', () => {
      const testFn = {
        name: 'test',
        body: '{ expect(true).toBe(true) }',
        source: ''
      }
      
      const hash = fingerprinter.fingerprintTest(testFn)
      expect(hash).toMatch(/^[a-f0-9]{40}$/) // SHA1 is 40 chars
    })

    it('should support SHA256', () => {
      const sha256Fingerprinter = new TestFingerprinter({ hashAlgorithm: 'sha256' })
      
      const testFn = {
        name: 'test',
        body: '{ expect(true).toBe(true) }',
        source: ''
      }
      
      const hash = sha256Fingerprinter.fingerprintTest(testFn)
      expect(hash).toMatch(/^[a-f0-9]{64}$/) // SHA256 is 64 chars
    })
  })

  describe('additional edge cases', () => {
    it('should handle tests with non-string names', () => {
      const source = `
        test(123, () => { expect(true).toBe(true) })
      `
      
      const tests = fingerprinter.extractTestFunctions(source)
      expect(tests).toHaveLength(0) // Should skip non-string names
    })

    it('should handle tests without function arguments', () => {
      const source = `
        test('no function')
      `
      
      const tests = fingerprinter.extractTestFunctions(source)
      expect(tests).toHaveLength(0) // Should skip tests without function
    })

    it('should handle tests with non-function second argument', () => {
      const source = `
        test('not a function', 'this is a string')
      `
      
      const tests = fingerprinter.extractTestFunctions(source)
      expect(tests).toHaveLength(0) // Should skip tests with non-function
    })

    it('should handle edge cases in test extraction', () => {
      // Test with various edge cases that would cause null returns
      const source = `
        // This should not be extracted
        test(null, () => {})
        // Neither should this  
        test('valid', null)
      `
      
      const tests = fingerprinter.extractTestFunctions(source)
      expect(tests).toHaveLength(0) // Should skip invalid tests
    })

    it('should handle AST normalization with preserveVariableNames option', () => {
      const fingerprinter = new TestFingerprinter({ preserveVariableNames: true })
      const source = `
        test('preserve variables', () => {
          const myVariable = 'value'
          expect(myVariable).toBe('value')
        })
      `
      
      const tests = fingerprinter.extractTestFunctions(source)
      expect(tests).toHaveLength(1)
      
      const hash1 = fingerprinter.fingerprintTest(tests[0])
      
      // Same test with different variable name - should produce different hash when preserving names
      const source2 = `
        test('preserve variables', () => {
          const differentVariable = 'value'
          expect(differentVariable).toBe('value')
        })
      `
      
      const tests2 = fingerprinter.extractTestFunctions(source2)
      const hash2 = fingerprinter.fingerprintTest(tests2[0])
      
      expect(hash1).not.toBe(hash2) // Should be different when preserving variable names
    })

    it('should handle normalizeIdentifier with preserved names', () => {
      const fingerprinter = new TestFingerprinter({ preserveVariableNames: false })
      
      // Test the private method through reflection
      const normalizeIdentifier = (fingerprinter as any).normalizeIdentifier.bind(fingerprinter)
      
      // Preserved names should stay the same
      expect(normalizeIdentifier('expect')).toBe('expect')
      expect(normalizeIdentifier('test')).toBe('test')
      expect(normalizeIdentifier('console')).toBe('console')
      
      // Non-preserved names should be normalized to hash format
      const normalized1 = normalizeIdentifier('myVariable')
      const normalized2 = normalizeIdentifier('anotherVar')
      
      expect(normalized1).toMatch(/^_var_[a-f0-9]{8}$/)
      expect(normalized2).toMatch(/^_var_[a-f0-9]{8}$/)
      expect(normalized1).not.toBe(normalized2) // Different variables get different hashes
      expect(normalizeIdentifier('myVariable')).toBe(normalized1) // Should be consistent
    })
  })
})