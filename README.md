# Vitest Test ID Plugin

A Vitest plugin that assigns persistent UUIDs to tests based on their content fingerprints, enabling stable test tracking across renames, moves, and refactors for robust CI analytics.

## ✨ Features

- 🔍 **Content-Based Test Identity** - UUIDs based on test content, not file paths or names
- 🏃‍♂️ **Rename & Move Proof** - Tests keep their identity when moved or renamed
- 🧠 **Fuzzy Matching** - Smart similarity detection for modified tests
- 📊 **CI Analytics Ready** - UUID-keyed test results for robust tracking
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults
- 🔧 **Highly Configurable** - Customize fingerprinting and matching behavior

## 🚀 Quick Start

### Installation

```bash
npm install --save-dev vitest-testid-plugin
```

### Basic Usage

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import testIdPlugin from 'vitest-testid-plugin'

export default defineConfig({
  plugins: [
    testIdPlugin()
  ],
  test: {
    // Your existing test configuration
  }
})
```

That's it! The plugin will now:
- Assign UUIDs to all your tests
- Track them persistently in `.test-ids.json`
- Maintain identity across code changes

### With Reporter Integration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import testIdPlugin, { createUuidReporter } from 'vitest-testid-plugin'

export default defineConfig({
  plugins: [
    testIdPlugin()
  ],
  test: {
    reporters: [
      'default',
      createUuidReporter({
        outputFile: 'test-results-with-uuids.json',
        format: 'json'
      })
    ]
  }
})
```

## 📖 How It Works

### 1. Content Fingerprinting
The plugin analyzes your test code using AST parsing to create content-based fingerprints:

```typescript
// This test gets a UUID based on its content
test('should calculate sum', () => {
  expect(add(2, 3)).toBe(5)
})

// Moving or renaming keeps the same UUID
test('should calculate addition', () => {
  expect(add(2, 3)).toBe(5) // Same content = same UUID
})
```

### 2. Smart Matching
When tests change slightly, fuzzy matching maintains identity:

```typescript
// Original test
test('should validate input', () => {
  expect(validate('hello')).toBe(true)
})

// Modified test - keeps same UUID via similarity matching
test('should validate user input', () => {
  expect(validate('hello')).toBe(true)
  expect(validate('')).toBe(false) // Added assertion
})
```

### 3. Persistent Registry
Test identities are stored in `.test-ids.json`:

```json
{
  "uuid-abc-123": {
    "hash": "content-fingerprint-hash",
    "lastNodeId": "math.test.ts::should_calculate_sum", 
    "bodyLength": 42,
    "createdAt": 1640995200000,
    "lastSeen": 1640995200000
  }
}
```

## ⚙️ Configuration

### Plugin Options

```typescript
testIdPlugin({
  // Registry file path (default: '.test-ids.json')
  registryPath: '.test-ids.json',
  
  // Auto-save registry after test runs (default: true)
  autoSave: true,
  
  // Auto-cleanup orphaned entries (default: true) 
  autoCleanup: true,
  
  // Debug logging (default: false)
  debug: false,
  
  // Fingerprinting options
  fingerprintOptions: {
    hashAlgorithm: 'sha1', // or 'sha256'
    preserveVariableNames: false
  },
  
  // Matching options
  matcherOptions: {
    similarityThreshold: 0.8, // 0-1, higher = stricter matching
    maxCandidates: 20 // Max fuzzy match candidates to consider
  }
})
```

### Reporter Options

```typescript
createUuidReporter({
  // Output file path
  outputFile: 'test-results-uuid.json',
  
  // Output format: 'json' | 'xml' | 'csv'
  format: 'json',
  
  // Include metadata in output
  includeMetadata: true,
  
  // Only include tests with UUIDs
  onlyUuidTests: false
})
```

## 🛠️ Use Cases

### CI Analytics Integration

```javascript
// Example: Parse UUID-based results for analytics
const results = JSON.parse(fs.readFileSync('test-results-uuid.json'))

results.results.forEach(test => {
  if (test.uuid) {
    // Track test by stable UUID instead of flaky name/path
    analytics.track('test_result', {
      test_id: test.uuid,
      status: test.state,
      duration: test.duration
    })
  }
})
```

### Flaky Test Detection

```javascript
// Track test stability over time using UUIDs
const testHistory = await analytics.query(`
  SELECT test_id, 
         COUNT(*) as runs,
         AVG(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as success_rate
  FROM test_results 
  WHERE test_id = '${test.uuid}'
    AND created_at > NOW() - INTERVAL 30 DAY
`)
```

## 📁 File Structure

After running the plugin, you'll see:

```
your-project/
├── .test-ids.json          # Test UUID registry (commit this!)
├── test-results-uuid.json  # Reporter output (optional)
└── vitest.config.ts        # Your config with plugin
```

**Important:** Commit `.test-ids.json` to version control to maintain test identity across environments.

## 🔧 Advanced Usage

### Custom Fingerprinting

```typescript
import { TestFingerprinter } from 'vitest-testid-plugin'

// Create custom fingerprinter
const fingerprinter = new TestFingerprinter({
  hashAlgorithm: 'sha256',
  preserveVariableNames: true // Keep variable names in fingerprint
})
```

### Manual Registry Management

```typescript
import { TestRegistry } from 'vitest-testid-plugin'

const registry = new TestRegistry('.my-test-ids.json')

// Add test manually
const uuid = registry.add('content-hash', 'test.js::my_test', 150)

// Find by UUID
const entry = registry.findByUuid(uuid)

// Cleanup orphaned entries
const removed = registry.cleanup([/* active UUIDs */])
```

### Multiple Output Formats

```typescript
// XML format for legacy systems
createUuidReporter({
  outputFile: 'test-results.xml',
  format: 'xml'
})

// CSV for spreadsheet analysis  
createUuidReporter({
  outputFile: 'test-results.csv',
  format: 'csv'
})
```

## 🚨 Troubleshooting

### Common Issues

**Plugin not assigning UUIDs?**
- Check that Vitest can read your test files
- Enable `debug: true` to see processing logs
- Verify test files match Vitest's `include` patterns

**UUIDs changing unexpectedly?**
- Large code changes may exceed similarity threshold
- Lower `similarityThreshold` for more aggressive matching
- Check `.test-ids.json` for registry corruption

**Performance issues?**
- Reduce `maxCandidates` for faster fuzzy matching
- Use `sha1` instead of `sha256` for faster hashing
- Consider `onlyUuidTests: true` in reporter for smaller output

### Debug Mode

```typescript
testIdPlugin({ debug: true })
```

This will log detailed information about:
- Test extraction and fingerprinting
- UUID assignment and matching
- Registry operations

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for [Vitest](https://vitest.dev/) testing framework
- Uses [Acorn](https://github.com/acornjs/acorn) for AST parsing
- Inspired by persistent test tracking needs in CI/CD pipelines