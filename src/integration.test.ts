import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { unlinkSync, existsSync } from 'fs'
import testIdPlugin from './plugin'
import { UuidReporter } from './reporter'
import type { File, Test } from 'vitest'

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs')
  return {
    ...actual,
    readFileSync: vi.fn()
  }
})

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn()
}))

const mockReadFileSync = vi.mocked(await import('fs')).readFileSync

describe('Plugin + Reporter Integration', () => {
  const testRegistryPath = '.test-integration.json'
  const reporterOutputPath = 'integration-test-results.json'
  
  beforeEach(() => {
    // Clean up any existing files
    if (existsSync(testRegistryPath)) {
      unlinkSync(testRegistryPath)
    }
    if (existsSync(reporterOutputPath)) {
      unlinkSync(reporterOutputPath)
    }
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up test files
    if (existsSync(testRegistryPath)) {
      unlinkSync(testRegistryPath)
    }
    if (existsSync(reporterOutputPath)) {
      unlinkSync(reporterOutputPath)
    }
  })

  it('should work end-to-end: plugin assigns UUIDs, reporter captures them', async () => {
    const sourceCode = `
      import { test, expect } from 'vitest'
      
      test('should calculate sum correctly', () => {
        expect(1 + 1).toBe(2)
      })
      
      test('should handle string operations', () => {
        expect('hello' + ' world').toBe('hello world')
      })
    `

    mockReadFileSync.mockReturnValue(sourceCode)

    // Initialize plugin
    const plugin = testIdPlugin({ 
      registryPath: testRegistryPath,
      debug: false 
    })
    plugin.configResolved?.()

    // Initialize reporter
    const reporter = new UuidReporter({ 
      outputFile: reporterOutputPath,
      format: 'json',
      onlyUuidTests: false 
    })
    reporter.onInit()

    // Create mock test tasks
    const mockTest1: Test = {
      id: 'test1',
      name: 'should calculate sum correctly',
      type: 'test',
      mode: 'run',
      tasks: [],
      suite: undefined as any,
      file: undefined as any,
      meta: {},
      each: undefined,
      fails: false,
      retry: 0,
      repeats: 0
    }

    const mockTest2: Test = {
      id: 'test2',
      name: 'should handle string operations',
      type: 'test',
      mode: 'run',
      tasks: [],
      suite: undefined as any,
      file: undefined as any,
      meta: {},
      each: undefined,
      fails: false,
      retry: 0,
      repeats: 0
    }

    const mockFile: File = {
      id: 'file1',
      name: 'integration.test.ts',
      type: 'suite',
      mode: 'run',
      filepath: '/test/integration.test.ts',
      tasks: [mockTest1, mockTest2],
      suite: undefined as any,
      file: undefined as any,
      meta: {},
      each: undefined,
      fails: false,
      retry: 0,
      repeats: 0
    }

    // Set up parent relationships
    mockTest1.suite = mockFile
    mockTest2.suite = mockFile
    mockTest1.file = mockFile
    mockTest2.file = mockFile

    // Step 1: Plugin processes tests and assigns UUIDs
    const taskUpdates: [string, any, any][] = [
      ['file1', mockFile, { type: 'file' }]
    ]
    
    await plugin.onTaskUpdate?.(taskUpdates)

    // Verify UUIDs were assigned by plugin
    expect((mockTest1 as any).testUuid).toMatch(/^[0-9a-f-]{36}$/)
    expect((mockTest2 as any).testUuid).toMatch(/^[0-9a-f-]{36}$/)
    expect((mockTest1 as any).testFingerprint).toBeTruthy()
    expect((mockTest2 as any).testFingerprint).toBeTruthy()

    // Step 2: Create test results for reporter (simulate test completion)
    const mockTest1WithResult = {
      ...mockTest1,
      state: 'pass',
      duration: 50,
      startTime: Date.now(),
      retryCount: 0,
      errors: []
    }

    const mockTest2WithResult = {
      ...mockTest2,  
      state: 'pass',
      duration: 75,
      startTime: Date.now(),
      retryCount: 0,
      errors: []
    }

    // Step 3: Reporter processes results with UUIDs
    const reporterUpdates: [string, any][] = [
      ['test1', mockTest1WithResult],
      ['test2', mockTest2WithResult]
    ]
    
    reporter.onTaskUpdate(reporterUpdates)

    // Step 4: Finish both plugin and reporter
    await plugin.onFinished?.([mockFile])
    await reporter.onFinished([mockFile], [])

    // Verify reporter captured UUID information
    const { writeFile } = await import('fs/promises')
    const mockWriteFile = vi.mocked(writeFile)
    
    expect(mockWriteFile).toHaveBeenCalledWith(
      reporterOutputPath,
      expect.stringContaining('"uuid"'),
      'utf8'
    )

    // Parse the written content to verify structure
    const [[, writtenContent]] = mockWriteFile.mock.calls
    const reportData = JSON.parse(writtenContent as string)
    
    expect(reportData.metadata).toBeDefined()
    expect(reportData.results).toHaveLength(2)
    
    // Verify first test result
    const test1Result = reportData.results.find((r: any) => r.name === 'should calculate sum correctly')
    expect(test1Result).toMatchObject({
      uuid: (mockTest1 as any).testUuid,
      fingerprint: (mockTest1 as any).testFingerprint,
      name: 'should calculate sum correctly',
      state: 'pass',
      duration: 50
    })

    // Verify second test result  
    const test2Result = reportData.results.find((r: any) => r.name === 'should handle string operations')
    expect(test2Result).toMatchObject({
      uuid: (mockTest2 as any).testUuid,
      fingerprint: (mockTest2 as any).testFingerprint,
      name: 'should handle string operations',
      state: 'pass',
      duration: 75
    })
  })

  it('should demonstrate plugin can assign UUIDs to tests', async () => {
    const sourceCode = `
      import { test, expect } from 'vitest'
      
      test('demo test', () => {
        expect(true).toBe(true)
      })
    `

    mockReadFileSync.mockReturnValue(sourceCode)

    const plugin = testIdPlugin({ registryPath: testRegistryPath })
    plugin.configResolved?.()

    const mockTest: Test = {
      id: 'demo-test',
      name: 'demo test',
      type: 'test',
      mode: 'run',
      tasks: [],
      suite: undefined as any,
      file: undefined as any,
      meta: {},
      each: undefined,
      fails: false,
      retry: 0,
      repeats: 0
    }

    const mockFile: File = {
      id: 'file1',
      name: 'demo.test.ts',
      type: 'suite',
      mode: 'run',
      filepath: '/test/demo.test.ts',
      tasks: [mockTest],
      suite: undefined as any,
      file: undefined as any,
      meta: {},
      each: undefined,
      fails: false,
      retry: 0,
      repeats: 0
    }

    mockTest.suite = mockFile
    mockTest.file = mockFile

    await plugin.onTaskUpdate?.([['file1', mockFile, { type: 'file' }]])

    // Verify UUID was assigned
    expect((mockTest as any).testUuid).toMatch(/^[0-9a-f-]{36}$/)
    expect((mockTest as any).testFingerprint).toBeTruthy()

    await plugin.onFinished?.([mockFile])

    // Verify registry file was created  
    expect(existsSync(testRegistryPath)).toBe(true)
  })

  it('should handle reporter with only UUID tests', async () => {
    const reporter = new UuidReporter({ 
      outputFile: reporterOutputPath,
      onlyUuidTests: true 
    })
    reporter.onInit()

    // Test with UUID
    const testWithUuid: Test = {
      id: 'test-with-uuid',
      name: 'test with uuid',
      type: 'test',
      mode: 'run',
      testUuid: 'uuid-123'
    } as any

    // Test without UUID
    const testWithoutUuid: Test = {
      id: 'test-without-uuid',
      name: 'test without uuid',
      type: 'test',
      mode: 'run'
    } as any

    const testWithUuidAndResult = { ...testWithUuid, name: 'test with uuid', state: 'pass' }
    const testWithoutUuidAndResult = { ...testWithoutUuid, name: 'test without uuid', state: 'pass' }

    reporter.onTaskUpdate([
      ['test-with-uuid', testWithUuidAndResult],
      ['test-without-uuid', testWithoutUuidAndResult]
    ])

    await reporter.onFinished([], [])

    const { writeFile } = await import('fs/promises')
    const mockWriteFile = vi.mocked(writeFile)
    
    const [[, writtenContent]] = mockWriteFile.mock.calls
    const reportData = JSON.parse(writtenContent as string)
    
    // Should only include the test with UUID
    expect(reportData.results).toHaveLength(1)
    expect(reportData.results[0].uuid).toBe('uuid-123')
  })
})