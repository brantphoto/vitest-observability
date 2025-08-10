import { parse } from 'acorn'
import { createHash } from 'crypto'

export interface TestFunction {
  name: string
  body: string
  source: string
}

export interface FingerprintOptions {
  hashAlgorithm?: 'sha1' | 'sha256'
  preserveVariableNames?: boolean
}

export class TestFingerprinter {
  private options: Required<FingerprintOptions>

  constructor(options: FingerprintOptions = {}) {
    this.options = {
      hashAlgorithm: options.hashAlgorithm ?? 'sha1',
      preserveVariableNames: options.preserveVariableNames ?? false
    }
  }

  extractTestFunctions(source: string): TestFunction[] {
    try {
      const ast = parse(source, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true
      })

      const testFunctions: TestFunction[] = []
      
      // Walk the AST to find test function calls
      this.walkAst(ast, (node: any) => {
        if (this.isTestCall(node)) {
          const testFn = this.extractTestFunction(node, source)
          if (testFn) {
            testFunctions.push(testFn)
          }
        }
      })

      return testFunctions
    } catch (error) {
      console.warn('Failed to parse source for fingerprinting:', error)
      return []
    }
  }

  fingerprintTest(testFunction: TestFunction): string {
    const normalized = this.normalizeTestBody(testFunction.body)
    return this.hashString(normalized)
  }

  private isTestCall(node: any): boolean {
    return (
      node.type === 'CallExpression' &&
      node.callee &&
      ((node.callee.type === 'Identifier' && 
        ['test', 'it', 'describe'].includes(node.callee.name)) ||
       (node.callee.type === 'MemberExpression' &&
        node.callee.object?.name === 'test' &&
        ['skip', 'only', 'todo'].includes(node.callee.property?.name)))
    )
  }

  private extractTestFunction(node: any, source: string): TestFunction | null {
    // Get test name from first argument
    const nameArg = node.arguments?.[0]
    if (!nameArg || nameArg.type !== 'Literal' || typeof nameArg.value !== 'string') {
      return null
    }

    // Get test function from second argument
    const fnArg = node.arguments?.[1]
    if (!fnArg || !['FunctionExpression', 'ArrowFunctionExpression'].includes(fnArg.type)) {
      return null
    }

    const start = fnArg.body.start
    const end = fnArg.body.end
    
    if (typeof start !== 'number' || typeof end !== 'number') {
      return null
    }

    const body = source.slice(start, end)
    const fullSource = source.slice(node.start, node.end)

    return {
      name: nameArg.value,
      body,
      source: fullSource
    }
  }

  private normalizeTestBody(body: string): string {
    // Use simple normalization for more predictable results
    let normalized = this.simpleNormalize(body)
    
    if (!this.options.preserveVariableNames) {
      normalized = this.normalizeVariableNames(normalized)
    }
    
    return normalized
  }

  private normalizeAst(node: any): string {
    if (!node || typeof node !== 'object') {
      return String(node)
    }

    if (Array.isArray(node)) {
      return '[' + node.map(item => this.normalizeAst(item)).join(',') + ']'
    }

    const result: any = {}

    // Skip location information and other metadata
    const skipKeys = ['start', 'end', 'loc', 'range', 'leadingComments', 'trailingComments']
    
    for (const [key, value] of Object.entries(node)) {
      if (skipKeys.includes(key)) continue

      // Optionally normalize variable names
      if (!this.options.preserveVariableNames && key === 'name' && 
          node.type === 'Identifier' && typeof value === 'string') {
        // Replace variable names with normalized placeholders
        result[key] = this.normalizeIdentifier(value)
      } else {
        result[key] = this.normalizeAst(value)
      }
    }

    return JSON.stringify(result)
  }

  private normalizeIdentifier(name: string): string {
    // Keep common test keywords and built-ins
    const preservedNames = [
      'expect', 'test', 'it', 'describe', 'beforeEach', 'afterEach',
      'console', 'window', 'document', 'process', 'require', 'import',
      'true', 'false', 'null', 'undefined'
    ]

    if (preservedNames.includes(name)) {
      return name
    }

    // Create a simple hash-based placeholder
    const hash = createHash('md5').update(name).digest('hex').slice(0, 8)
    return `_var_${hash}`
  }

  private simpleNormalize(body: string): string {
    return body
      // Remove block comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove line comments
      .replace(/\/\/.*$/gm, '')
      // Normalize whitespace around operators
      .replace(/\s*([+\-*/=<>!&|]+)\s*/g, ' $1 ')
      // Normalize all whitespace to single spaces
      .replace(/\s+/g, ' ')
      .trim()
      // Remove trailing semicolons and commas
      .replace(/[;,]\s*$/, '')
  }

  private normalizeVariableNames(code: string): string {
    // Simple variable name normalization using regex
    // This is a basic approach - could be enhanced with proper AST analysis
    const identifierRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g
    const preservedNames = new Set([
      'expect', 'test', 'it', 'describe', 'beforeEach', 'afterEach',
      'console', 'window', 'document', 'process', 'require', 'import',
      'true', 'false', 'null', 'undefined', 'const', 'let', 'var',
      'function', 'return', 'if', 'else', 'for', 'while', 'do',
      'toBe', 'toEqual', 'toBeTruthy', 'toBeFalsy', 'toContain'
    ])
    
    const nameMap = new Map<string, string>()
    let counter = 0
    
    return code.replace(identifierRegex, (match) => {
      if (preservedNames.has(match)) {
        return match
      }
      
      if (!nameMap.has(match)) {
        nameMap.set(match, `_var${counter++}`)
      }
      
      return nameMap.get(match)!
    })
  }

  private hashString(input: string): string {
    return createHash(this.options.hashAlgorithm)
      .update(input)
      .digest('hex')
  }

  private walkAst(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return

    callback(node)

    if (Array.isArray(node)) {
      for (const item of node) {
        this.walkAst(item, callback)
      }
    } else {
      for (const value of Object.values(node)) {
        this.walkAst(value, callback)
      }
    }
  }
}