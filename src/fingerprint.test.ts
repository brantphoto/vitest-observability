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
})