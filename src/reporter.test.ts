import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, unlinkSync } from 'fs'
import { UuidReporter, createUuidReporter } from './reporter'
import type { Task, TestResult } from 'vitest'

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn()
}))

describe('UuidReporter', () => {
  let reporter: UuidReporter
  const testOutputFile = 'test-uuid-results.json'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (existsSync(testOutputFile)) {
      unlinkSync(testOutputFile)
    }
  })

  describe('initialization', () => {
    it('should create reporter with default options', () => {
      reporter = new UuidReporter()
      expect(reporter).toBeInstanceOf(UuidReporter)
    })

    it('should create reporter with custom options', () => {
      reporter = new UuidReporter({
        outputFile: 'custom-results.json',
        format: 'xml',
        includeMetadata: false,
        onlyUuidTests: true
      })
      expect(reporter).toBeInstanceOf(UuidReporter)
    })

    it('should create reporter using factory function', () => {
      reporter = createUuidReporter({ format: 'csv' })
      expect(reporter).toBeInstanceOf(UuidReporter)
    })
  })

  describe('test result processing', () => {
    beforeEach(() => {
      reporter = new UuidReporter({ outputFile: testOutputFile })
      reporter.onInit()
    })

    it('should collect test results with UUIDs', () => {
      const mockTask: Task = {
        id: 'test1',
        name: 'should work',
        type: 'test',
        mode: 'run',
        testUuid: 'uuid-123',
        testFingerprint: 'fingerprint-abc'
      } as any

      // Mock the task with result data embedded (as Vitest actually does)
      const mockTaskWithResult = {
        ...mockTask,
        name: 'should work',
        state: 'pass',
        duration: 100,
        startTime: Date.now()
      }

      reporter.onTaskUpdate([['test1', mockTaskWithResult]])

      // Access private results through type casting for testing
      const results = (reporter as any).results as Map<string, any>
      expect(results.size).toBe(1)
      expect(results.get('uuid-123')).toEqual({
        name: 'should work',
        state: 'pass',
        duration: 100,
        startTime: expect.any(Number),
        errors: [],
        retryCount: 0,
        testUuid: 'uuid-123',
        testFingerprint: 'fingerprint-abc'
      })
    })

    it('should collect test results without UUIDs when onlyUuidTests is false', () => {
      reporter = new UuidReporter({ onlyUuidTests: false })
      reporter.onInit()

      const mockTask: Task = {
        id: 'test2',
        name: 'test without uuid',
        type: 'test',
        mode: 'run'
      } as any

      const mockTaskWithResult = {
        ...mockTask,
        name: 'test without uuid',
        state: 'pass',
        duration: 50
      }

      reporter.onTaskUpdate([['test2', mockTaskWithResult]])

      const results = (reporter as any).results as Map<string, any>
      expect(results.size).toBe(1)
      expect(results.get('test2')).toEqual({
        name: 'test without uuid',
        state: 'pass',
        duration: 50,
        startTime: 0,
        errors: [],
        retryCount: 0,
        testUuid: undefined,
        testFingerprint: undefined
      })
    })

    it('should skip tests without UUIDs when onlyUuidTests is true', () => {
      reporter = new UuidReporter({ onlyUuidTests: true })
      reporter.onInit()

      const mockTask: Task = {
        id: 'test3',
        name: 'test without uuid',
        type: 'test',
        mode: 'run'
      } as any

      const mockResult: TestResult = {
        name: 'test without uuid',
        state: 'pass',
        duration: 50
      } as any

      reporter.onTaskUpdate([['test3', mockTask, mockResult]])

      const results = (reporter as any).results as Map<string, any>
      expect(results.size).toBe(0)
    })

    it('should ignore non-test tasks', () => {
      const mockSuite: Task = {
        id: 'suite1',
        name: 'test suite',
        type: 'suite',
        mode: 'run'
      } as any

      const mockSuiteWithResult = {
        ...mockSuite,
        name: 'test suite',
        state: 'pass'
      }

      reporter.onTaskUpdate([['suite1', mockSuiteWithResult]])

      const results = (reporter as any).results as Map<string, any>
      expect(results.size).toBe(0)
    })
  })

  describe('output formatting', () => {
    beforeEach(() => {
      reporter = new UuidReporter({ 
        outputFile: testOutputFile,
        includeMetadata: true 
      })
      reporter.onInit()
    })

    it('should format output as JSON by default', async () => {
      const mockTask: Task = {
        id: 'test1',
        name: 'json test',
        type: 'test',
        mode: 'run',
        testUuid: 'json-uuid-123',
        testFingerprint: 'json-fingerprint'
      } as any

      const mockTaskWithResult = {
        ...mockTask,
        name: 'json test',
        state: 'pass',
        duration: 150,
        startTime: 1640995200000,
        retryCount: 0,
        errors: []
      }

      reporter.onTaskUpdate([['test1', mockTaskWithResult]])

      const output = (reporter as any).formatOutput([], [], 1000)
      const parsed = JSON.parse(output)

      expect(parsed.metadata).toBeDefined()
      expect(parsed.metadata.duration).toBe(1000)
      expect(parsed.results).toHaveLength(1)
      expect(parsed.results[0]).toMatchObject({
        uuid: 'json-uuid-123',
        fingerprint: 'json-fingerprint',
        name: 'json test',
        state: 'pass',
        duration: 150,
        retryCount: 0
      })
    })

    it('should format output as XML when specified', () => {
      reporter = new UuidReporter({ format: 'xml', includeMetadata: true })
      reporter.onInit()

      const mockTask: Task = {
        id: 'test1',
        name: 'xml test',
        type: 'test',
        mode: 'run',
        testUuid: 'xml-uuid-123'
      } as any

      const mockTaskWithResult = {
        ...mockTask,
        name: 'xml test',
        state: 'fail',
        duration: 200,
        errors: [{ message: 'Test failed', stack: 'Error stack', name: 'AssertionError' }]
      }

      reporter.onTaskUpdate([['test1', mockTaskWithResult]])

      const output = (reporter as any).formatOutput([], [], 1500)
      
      expect(output).toContain('<?xml version="1.0"')
      expect(output).toContain('<testResults')
      expect(output).toContain('uuid="xml-uuid-123"')
      expect(output).toContain('name="xml test"')
      expect(output).toContain('state="fail"')
      expect(output).toContain('<error message="Test failed">')
    })

    it('should format output as CSV when specified', () => {
      reporter = new UuidReporter({ format: 'csv' })
      reporter.onInit()

      const mockTask: Task = {
        id: 'test1',
        name: 'csv test',
        type: 'test',
        mode: 'run',
        testUuid: 'csv-uuid-123'
      } as any

      const mockTaskWithResult = {
        ...mockTask,
        name: 'csv test',
        state: 'pass',
        duration: 75,
        errors: []
      }

      reporter.onTaskUpdate([['test1', mockTaskWithResult]])

      const output = (reporter as any).formatOutput([], [], 800)
      const lines = output.split('\n')
      
      expect(lines[0]).toBe('uuid,fingerprint,taskId,name,state,duration,startTime,retryCount,errorCount')
      expect(lines[1]).toContain('"csv-uuid-123"')
      expect(lines[1]).toContain('"csv test"')
      expect(lines[1]).toContain('"pass"')
    })

    it('should exclude metadata when includeMetadata is false', () => {
      reporter = new UuidReporter({ includeMetadata: false })
      reporter.onInit()

      const output = (reporter as any).formatOutput([], [], 1000)
      const parsed = JSON.parse(output)

      expect(parsed.metadata).toBeUndefined()
      expect(parsed.results).toBeDefined()
    })
  })

  describe('XML escaping', () => {
    it('should properly escape XML special characters', () => {
      reporter = new UuidReporter()
      
      const escaped = (reporter as any).escapeXml('<test> "quoted" & \'single\'')
      expect(escaped).toBe('&lt;test&gt; &quot;quoted&quot; &amp; &#39;single&#39;')
    })
  })

  describe('error handling', () => {
    it('should handle tests with errors gracefully', () => {
      reporter = new UuidReporter({ outputFile: testOutputFile })
      reporter.onInit()

      const mockTask: Task = {
        id: 'failing-test',
        name: 'failing test',
        type: 'test',
        mode: 'run',
        testUuid: 'failing-uuid'
      } as any

      const mockTaskWithResult = {
        ...mockTask,
        name: 'failing test',
        state: 'fail',
        duration: 200,
        errors: [
          { message: 'Expected true but got false', stack: 'at test line 1', name: 'AssertionError' },
          { message: 'Timeout exceeded', stack: 'at test line 2', name: 'TimeoutError' }
        ]
      }

      reporter.onTaskUpdate([['failing-test', mockTaskWithResult]])

      const output = (reporter as any).formatOutput([], [], 1000)
      const parsed = JSON.parse(output)

      expect(parsed.results[0].errors).toHaveLength(2)
      expect(parsed.results[0].errors[0]).toMatchObject({
        message: 'Expected true but got false',
        stack: 'at test line 1',
        name: 'AssertionError'
      })
    })
  })

  describe('integration', () => {
    it('should provide complete workflow from init to finish', async () => {
      const { writeFile } = await import('fs/promises')
      const mockWriteFile = vi.mocked(writeFile)

      reporter = new UuidReporter({ 
        outputFile: testOutputFile,
        format: 'json' 
      })

      // Initialize
      reporter.onInit()

      // Add test results
      const mockTask: Task = {
        id: 'integration-test',
        name: 'integration test',
        type: 'test',
        mode: 'run',
        testUuid: 'integration-uuid',
        testFingerprint: 'integration-fingerprint'
      } as any

      const mockTaskWithResult = {
        ...mockTask,
        name: 'integration test',
        state: 'pass',
        duration: 100,
        startTime: Date.now(),
        retryCount: 0,
        errors: []
      }

      reporter.onTaskUpdate([['integration-test', mockTaskWithResult]])

      // Finish and verify file was written
      await reporter.onFinished([], [])

      expect(mockWriteFile).toHaveBeenCalledWith(
        testOutputFile,
        expect.stringContaining('"uuid": "integration-uuid"'),
        'utf8'
      )
    })
  })
})