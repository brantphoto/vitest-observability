import type { Test, Suite, File, Task } from 'vitest'
import { readFileSync } from 'fs'
import { TestFingerprinter } from './fingerprint'
import { TestRegistry } from './registry'
import { TestMatcher } from './matcher'
import type { TestIdPluginOptions } from '@vitest-testid/types'

type PluginOptions = TestIdPluginOptions

interface ExtendedTest extends Test {
  testUuid?: string
  testFingerprint?: string
}

interface ExtendedSuite extends Suite {
  testUuid?: string
  testFingerprint?: string
}

export default function testIdPlugin(options: PluginOptions = {}) {
  const config = {
    registryPath: options.registryPath ?? '.test-ids.json',
    fingerprintOptions: options.fingerprintOptions ?? {},
    matcherOptions: {
      similarityThreshold: 0.8,
      maxCandidates: 20,
      ...options.matcherOptions
    },
    autoSave: options.autoSave ?? true,
    autoCleanup: options.autoCleanup ?? true,
    debug: options.debug ?? false
  }

  let fingerprinter: TestFingerprinter
  let registry: TestRegistry
  let matcher: TestMatcher
  let assignedUuids: string[] = []

  const log = (...args: any[]) => {
    if (config.debug) {
      console.log('[test-id-plugin]', ...args)
    }
  }

  return {
    name: 'vitest-test-id',
    configResolved() {
      // Initialize components when config is resolved
      fingerprinter = new TestFingerprinter(config.fingerprintOptions)
      registry = new TestRegistry(config.registryPath)
      matcher = new TestMatcher(fingerprinter, registry, config.matcherOptions)
      
      log('Plugin initialized with registry:', config.registryPath)
      log('Current registry size:', registry.size())
    },

    async onTaskUpdate(packs: any[]) {
      // This hook is called when tasks are collected/updated
      for (const [, result, meta] of packs) {
        if (result?.type === 'suite' && meta?.type === 'file') {
          const file = result as File
          await processFile(file)
        }
      }
    },

    async onFinished(_files: any[]) {
      if (config.autoCleanup) {
        const removedCount = registry.cleanup(assignedUuids)
        if (removedCount > 0) {
          log(`Cleaned up ${removedCount} orphaned UUIDs`)
        }
      }

      if (config.autoSave) {
        registry.save()
        log('Registry saved with', registry.size(), 'entries')
      }

      // Reset for next run
      assignedUuids = []
    }
  }

  async function processFile(file: File): Promise<void> {
    if (!file.filepath) {
      log('Skipping file without filepath')
      return
    }

    try {
      // Read the source file
      const sourceCode = readFileSync(file.filepath, 'utf-8')
      
      // Extract test functions from source
      const testFunctions = fingerprinter.extractTestFunctions(sourceCode)
      log(`Extracted ${testFunctions.length} test functions from ${file.filepath}`)

      // Process all tasks in the file
      await processTasksRecursively(file, testFunctions, file.filepath)
      
    } catch (error) {
      log('Error processing file:', file.filepath, error)
    }
  }

  async function processTasksRecursively(
    task: Task, 
    testFunctions: any[], 
    filepath: string
  ): Promise<void> {
    if (task.type === 'test') {
      await assignTestUuid(task as ExtendedTest, testFunctions, filepath)
    } else if (task.type === 'suite') {
      await assignSuiteUuid(task as ExtendedSuite, testFunctions, filepath)
    }

    // Process children recursively  
    if ('tasks' in task && task.tasks) {
      for (const child of task.tasks) {
        await processTasksRecursively(child, testFunctions, filepath)
      }
    }
  }

  async function assignTestUuid(
    test: ExtendedTest, 
    testFunctions: any[], 
    filepath: string
  ): Promise<void> {
    if (test.testUuid) {
      return // Already processed
    }

    // Find matching test function by name
    const matchingFunction = testFunctions.find(fn => fn.name === test.name)
    
    if (!matchingFunction) {
      log('No matching function found for test:', test.name)
      return
    }

    // Generate node ID
    const nodeId = generateNodeId(filepath, test)
    
    // Assign UUID using matcher
    const uuid = matcher.assignUuid(matchingFunction, nodeId)
    
    // Store UUID and fingerprint on test
    test.testUuid = uuid
    test.testFingerprint = fingerprinter.fingerprintTest(matchingFunction)
    
    assignedUuids.push(uuid)
    
    log(`Assigned UUID ${uuid} to test: ${test.name}`)
  }

  async function assignSuiteUuid(
    suite: ExtendedSuite, 
    testFunctions: any[], 
    filepath: string
  ): Promise<void> {
    if (suite.testUuid) {
      return // Already processed
    }

    // Find matching test function for describe blocks
    const matchingFunction = testFunctions.find(fn => fn.name === suite.name)
    
    if (matchingFunction) {
      // Generate node ID
      const nodeId = generateNodeId(filepath, suite)
      
      // Assign UUID using matcher  
      const uuid = matcher.assignUuid(matchingFunction, nodeId)
      
      // Store UUID and fingerprint on suite
      suite.testUuid = uuid
      suite.testFingerprint = fingerprinter.fingerprintTest(matchingFunction)
      
      assignedUuids.push(uuid)
      
      log(`Assigned UUID ${uuid} to suite: ${suite.name}`)
    }
  }

  function generateNodeId(filepath: string, task: Task): string {
    // Convert filepath to relative path from cwd
    const relativePath = filepath.replace(process.cwd() + '/', '')
    
    // Build task path by walking up the parent chain
    const taskPath: string[] = []
    let current: Task | undefined = task
    
    while (current) {
      if (current.name) {
        taskPath.unshift(current.name)
      }
      current = current.suite
    }
    
    // Create node ID in format: file.test.js::suite::test
    const testPath = taskPath.join('::')
    return `${relativePath}::${testPath}`
  }
}