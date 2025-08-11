import type { File, Reporter, TaskResultPack } from 'vitest'

export interface UuidTestResult {
  name?: string
  state?: string
  errors?: Array<{ message: string; stack?: string; name?: string }>
  duration?: number
  startTime?: number
  retryCount?: number
  testUuid?: string
  testFingerprint?: string
}

export interface UuidReporterOptions {
  outputFile?: string
  format?: 'json' | 'xml' | 'csv'
  includeMetadata?: boolean
  onlyUuidTests?: boolean // Only include tests that have UUIDs assigned
}

export class UuidReporter implements Reporter {
  private options: Required<UuidReporterOptions>
  private results: Map<string, UuidTestResult> = new Map()
  private startTime: number = 0

  constructor(options: Partial<UuidReporterOptions> = {}) {
    this.options = {
      outputFile: options.outputFile ?? 'test-results-uuid.json',
      format: options.format ?? 'json',
      includeMetadata: options.includeMetadata ?? true,
      onlyUuidTests: options.onlyUuidTests ?? false
    }
  }

  onInit() {
    this.startTime = Date.now()
    this.results.clear()
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    for (const [taskId, taskResult] of packs) {
      const task = taskResult as any
      if (task && task.type === 'test') {
        const testUuid = task.testUuid
        const testFingerprint = task.testFingerprint
        
        // Skip tests without UUIDs if onlyUuidTests is enabled
        if (this.options.onlyUuidTests && !testUuid) {
          continue
        }

        const uuidResult: UuidTestResult = {
          name: task.name || 'Unknown Test',
          state: task.state || 'unknown',
          errors: task.errors || [],
          duration: task.duration || 0,
          startTime: task.startTime || 0,
          retryCount: task.retryCount || 0,
          testUuid,
          testFingerprint
        }

        // Use UUID as key if available, otherwise fall back to task id
        const key = testUuid || taskId
        this.results.set(key, uuidResult)
      }
    }
  }

  async onFinished(files?: File[], errors?: unknown[]) {
    const endTime = Date.now()
    const duration = endTime - this.startTime

    const output = this.formatOutput(files || [], errors || [], duration)
    
    if (this.options.outputFile) {
      await this.writeOutputFile(output)
    }

    // Also log summary to console
    this.logSummary(files || [], errors || [], duration)
  }

  private formatOutput(files: File[], errors: unknown[], duration: number) {
    const metadata = this.options.includeMetadata ? {
      timestamp: new Date().toISOString(),
      duration,
      totalFiles: files.length,
      totalErrors: errors.length,
      reporterOptions: this.options
    } : undefined

    const testResults = Array.from(this.results.entries()).map(([key, result]) => ({
      uuid: result.testUuid || null,
      fingerprint: result.testFingerprint || null,
      taskId: key,
      name: result.name || 'Unknown Test',
      state: result.state,
      errors: result.errors?.map((err: any) => ({
        message: err.message,
        stack: err.stack,
        name: err.name
      })) || [],
      duration: result.duration || 0,
      startTime: result.startTime || 0,
      retryCount: result.retryCount || 0
    }))

    switch (this.options.format) {
      case 'json':
        return JSON.stringify({
          metadata,
          results: testResults
        }, null, 2)
      
      case 'xml':
        return this.formatAsXml(testResults, metadata)
      
      case 'csv':
        return this.formatAsCsv(testResults)
      
      default:
        return JSON.stringify({ metadata, results: testResults }, null, 2)
    }
  }

  private formatAsXml(results: any[], metadata?: any): string {
    const xmlResults = results.map(result => {
      const errors = result.errors.map((err: any) => 
        `      <error message="${this.escapeXml(err.message)}">${this.escapeXml(err.stack || '')}</error>`
      ).join('\n')

      return `    <testcase 
      uuid="${result.uuid || ''}" 
      fingerprint="${result.fingerprint || ''}" 
      taskId="${result.taskId}" 
      name="${this.escapeXml(result.name)}" 
      state="${result.state}" 
      duration="${result.duration}"
      startTime="${result.startTime}"
      retryCount="${result.retryCount}">
${errors ? `\n${errors}\n    ` : ''}    </testcase>`
    }).join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<testResults${metadata ? ` timestamp="${metadata.timestamp}" duration="${metadata.duration}" totalFiles="${metadata.totalFiles}" totalErrors="${metadata.totalErrors}"` : ''}>
  <tests>
${xmlResults}
  </tests>
</testResults>`
  }

  private formatAsCsv(results: any[]): string {
    const headers = ['uuid', 'fingerprint', 'taskId', 'name', 'state', 'duration', 'startTime', 'retryCount', 'errorCount']
    const rows = results.map(result => [
      result.uuid || '',
      result.fingerprint || '',
      result.taskId,
      result.name,
      result.state,
      result.duration,
      result.startTime,
      result.retryCount,
      result.errors.length
    ])

    return [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  private async writeOutputFile(content: string) {
    const fs = await import('fs/promises')
    
    try {
      await fs.writeFile(this.options.outputFile, content, 'utf8')
      console.log(`✅ UUID test results written to: ${this.options.outputFile}`)
    } catch (error) {
      console.error(`❌ Failed to write UUID test results to ${this.options.outputFile}:`, error)
    }
  }

  private logSummary(_files: File[], _errors: unknown[], duration: number) {
    const totalTests = this.results.size
    const testsWithUuids = Array.from(this.results.values()).filter(r => r.testUuid).length
    const passedTests = Array.from(this.results.values()).filter(r => r.state === 'pass').length
    const failedTests = Array.from(this.results.values()).filter(r => r.state === 'fail').length

    console.log('\n📊 UUID Reporter Summary:')
    console.log(`   Total tests: ${totalTests}`)
    console.log(`   Tests with UUIDs: ${testsWithUuids}`)
    console.log(`   Passed: ${passedTests}`)
    console.log(`   Failed: ${failedTests}`)
    console.log(`   Duration: ${duration}ms`)
    console.log(`   Output format: ${this.options.format}`)
    
    if (this.options.outputFile) {
      console.log(`   Results file: ${this.options.outputFile}`)
    }
  }
}

// Export factory function for easier Vitest configuration
export function createUuidReporter(options: Partial<UuidReporterOptions> = {}) {
  return new UuidReporter(options)
}