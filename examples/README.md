# Examples

This directory contains usage examples for the Vitest Test ID Plugin.

## 📁 Available Examples

### Basic Configuration
- **`vitest.config.with-reporter.ts`** - Complete setup with plugin and reporter integration

## 🚀 Running Examples

### 1. Basic Plugin Usage

Create a `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import testIdPlugin from 'vitest-testid-plugin'

export default defineConfig({
  plugins: [testIdPlugin()],
  test: {
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}']
  }
})
```

### 2. With Custom Configuration

```typescript
import { defineConfig } from 'vitest/config'
import testIdPlugin from 'vitest-testid-plugin'

export default defineConfig({
  plugins: [
    testIdPlugin({
      registryPath: '.custom-test-ids.json',
      debug: true,
      fingerprintOptions: {
        hashAlgorithm: 'sha256',
        preserveVariableNames: true
      },
      matcherOptions: {
        similarityThreshold: 0.7,
        maxCandidates: 10
      }
    })
  ]
})
```

### 3. Multiple Reporter Formats

```typescript
import { defineConfig } from 'vitest/config'
import testIdPlugin, { createUuidReporter } from 'vitest-testid-plugin'

export default defineConfig({
  plugins: [testIdPlugin()],
  test: {
    reporters: [
      'default',
      // JSON output for APIs
      createUuidReporter({
        outputFile: 'results/test-results.json',
        format: 'json',
        includeMetadata: true
      }),
      // CSV for spreadsheets
      createUuidReporter({
        outputFile: 'results/test-results.csv', 
        format: 'csv',
        onlyUuidTests: true
      }),
      // XML for legacy systems
      createUuidReporter({
        outputFile: 'results/test-results.xml',
        format: 'xml'
      })
    ]
  }
})
```

### 4. CI/CD Integration Example

```typescript
// ci-config.ts
import { defineConfig } from 'vitest/config'
import testIdPlugin, { createUuidReporter } from 'vitest-testid-plugin'

const isCi = process.env.CI === 'true'

export default defineConfig({
  plugins: [
    testIdPlugin({
      registryPath: '.test-ids.json',
      debug: !isCi, // Only debug locally
      autoCleanup: isCi // Clean up in CI
    })
  ],
  test: {
    reporters: isCi ? [
      'default',
      createUuidReporter({
        outputFile: `test-results-${process.env.GITHUB_RUN_ID || Date.now()}.json`,
        format: 'json',
        includeMetadata: true
      })
    ] : ['default']
  }
})
```

### 5. Monorepo Setup

```typescript
// packages/web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import testIdPlugin from 'vitest-testid-plugin'

export default defineConfig({
  plugins: [
    testIdPlugin({
      registryPath: '../../.test-ids-web.json', // Shared registry location
      debug: false
    })
  ]
})

// packages/api/vitest.config.ts
import { defineConfig } from 'vitest/config'
import testIdPlugin from 'vitest-testid-plugin'

export default defineConfig({
  plugins: [
    testIdPlugin({
      registryPath: '../../.test-ids-api.json', // Separate registry
      debug: false
    })
  ]
})
```

## 📊 Sample Test Results

### JSON Output Format
```json
{
  "metadata": {
    "timestamp": "2025-01-15T10:30:00.000Z",
    "duration": 1250,
    "totalFiles": 5,
    "totalErrors": 0
  },
  "results": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "fingerprint": "abc123def456",
      "taskId": "test1",
      "name": "should calculate sum",
      "state": "pass",
      "errors": [],
      "duration": 10,
      "startTime": 1642234567890,
      "retryCount": 0
    }
  ]
}
```

### CSV Output Format
```csv
uuid,fingerprint,taskId,name,state,duration,startTime,retryCount,errorCount
"550e8400-e29b-41d4-a716-446655440000","abc123def456","test1","should calculate sum","pass",10,1642234567890,0,0
```

### XML Output Format
```xml
<?xml version="1.0" encoding="UTF-8"?>
<testResults timestamp="2025-01-15T10:30:00.000Z" duration="1250">
  <tests>
    <testcase 
      uuid="550e8400-e29b-41d4-a716-446655440000" 
      fingerprint="abc123def456"
      name="should calculate sum" 
      state="pass" 
      duration="10">
    </testcase>
  </tests>
</testResults>
```

## 🧪 Sample Test Files

### Basic Test Structure
```typescript
// math.test.ts
import { describe, test, expect } from 'vitest'
import { add, multiply } from './math'

describe('Math utilities', () => {
  test('should add two numbers', () => {
    expect(add(2, 3)).toBe(5)
  })

  test('should multiply two numbers', () => {
    expect(multiply(2, 3)).toBe(6)
  })
})
```

After running tests with the plugin, each test will have a persistent UUID that survives:
- Renaming the test description
- Moving the test to a different file
- Restructuring the test suite
- Minor code modifications

### Advanced Test Patterns
```typescript
// user.test.ts - Tests that benefit from persistent identity
import { describe, test, expect, beforeEach } from 'vitest'
import { UserService } from './user-service'

describe('User Service', () => {
  let userService: UserService
  
  beforeEach(() => {
    userService = new UserService()
  })

  // This test keeps its UUID even if renamed or moved
  test('should create user with valid data', () => {
    const user = userService.create({
      name: 'John Doe',
      email: 'john@example.com'
    })
    
    expect(user.id).toBeTruthy()
    expect(user.name).toBe('John Doe')
  })

  // UUID survives even if test logic changes slightly
  test('should validate email format', () => {
    expect(() => {
      userService.create({
        name: 'Jane Doe', 
        email: 'invalid-email'
      })
    }).toThrow('Invalid email format')
  })
})
```

## 🔗 Integration Examples

### GitHub Actions
```yaml
# .github/workflows/test.yml
name: Test with UUID Tracking

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests with UUID tracking
        run: npm test
        
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ github.run_id }}
          path: test-results-*.json
```

### Analytics Integration
```javascript
// scripts/analyze-tests.js
const fs = require('fs')

// Read UUID-based test results
const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'))

// Track by stable UUID
results.results.forEach(test => {
  if (test.uuid && test.state === 'fail') {
    console.log(`Flaky test detected: ${test.uuid} (${test.name})`)
    
    // Send to analytics service
    analytics.track('test_failure', {
      test_id: test.uuid,
      test_name: test.name,
      duration: test.duration,
      build_id: process.env.GITHUB_RUN_ID
    })
  }
})
```