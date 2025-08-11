import { describe, it, expect } from 'vitest'

describe('Index exports', () => {
  it('should export main plugin', async () => {
    const { testIdPlugin } = await import('./index')
    expect(testIdPlugin).toBeDefined()
    expect(typeof testIdPlugin).toBe('function')
  })


  it('should export core components', async () => {
    const { TestFingerprinter, TestRegistry, TestMatcher } = await import('./index')
    expect(TestFingerprinter).toBeDefined()
    expect(TestRegistry).toBeDefined()
    expect(TestMatcher).toBeDefined()
    expect(typeof TestFingerprinter).toBe('function')
    expect(typeof TestRegistry).toBe('function')
    expect(typeof TestMatcher).toBe('function')
  })

  it('should have proper TypeScript types', async () => {
    const module = await import('./index')
    
    // Check that we can import types (they exist at compile time)
    const exportedNames = Object.keys(module)
    expect(exportedNames).toContain('testIdPlugin')
    expect(exportedNames).toContain('TestFingerprinter')
    expect(exportedNames).toContain('TestRegistry')
    expect(exportedNames).toContain('TestMatcher')
  })

  it('should allow plugin instantiation', async () => {
    const { testIdPlugin } = await import('./index')
    const plugin = testIdPlugin()
    
    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('vitest-test-id')
    expect(plugin.configResolved).toBeDefined()
    expect(plugin.onTaskUpdate).toBeDefined()
    expect(plugin.onFinished).toBeDefined()
  })


  it('should allow core component instantiation', async () => {
    const { TestFingerprinter, TestRegistry, TestMatcher } = await import('./index')
    
    const fingerprinter = new TestFingerprinter()
    const registry = new TestRegistry('.test-exports.json')
    const matcher = new TestMatcher(fingerprinter, registry)
    
    expect(fingerprinter).toBeInstanceOf(TestFingerprinter)
    expect(registry).toBeInstanceOf(TestRegistry)
    expect(matcher).toBeInstanceOf(TestMatcher)
    
    // Clean up
    if (require('fs').existsSync('.test-exports.json')) {
      require('fs').unlinkSync('.test-exports.json')
    }
  })
})