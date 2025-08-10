# Vitest Test Identity Plugin - Implementation Plan

## Overview

This plugin implements a Test Identity Manager for Vitest that assigns persistent UUIDs to tests based on their content fingerprints rather than file paths or test names. This enables stable test tracking across renames, moves, and refactors.

## Architecture

The plugin integrates into Vitest's test collection phase to:
1. Collect tests into memory
2. Generate content-based fingerprints (not path/name based)
3. Match fingerprints against persistent registry
4. Assign persistent UUIDs to each test
5. Emit results keyed by UUID for CI analytics

## Implementation Tasks

### 1. Project Setup ✅ COMPLETED
- ✅ Initialize npm package with TypeScript configuration
- ✅ Set up Vitest plugin architecture and dependencies
- ✅ Configure build and development tooling

### 2. Test Identity Registry ✅ COMPLETED
- ✅ **Storage**: JSON file (`.test-ids.json`) or SQLite DB in repo root
- ✅ **Schema**: 
  ```json
  {
    "uuid": {
      "hash": "content-fingerprint",
      "lastNodeId": "src/tests/example.test.js::test_name"
    }
  }
  ```
- ✅ **Operations**: load, save, add, find by hash, update

### 3. AST-Based Fingerprinting ✅ COMPLETED
- ✅ **Parser**: Use Acorn/Babel to parse test source code
- ✅ **Extraction**: Identify and extract test function bodies
- ✅ **Normalization**: Remove comments, whitespace, non-semantic changes
- ✅ **Hashing**: Generate SHA1/SHA256 of normalized AST structure
- ✅ **Stability**: Ensure fingerprints survive cosmetic code changes

### 4. Test Matching System ✅ COMPLETED
- ✅ **Exact matching**: Direct hash lookup for unchanged tests
- ✅ **Fuzzy matching**: Levenshtein similarity comparison with configurable threshold (default 80%)
- ✅ **UUID assignment**: Reuse existing UUID or generate new one
- ✅ **Registry updates**: Update lastNodeId for matched tests

### 5. Vitest Plugin Integration 🚧 IN PROGRESS
- **Hook**: `onCollected` to intercept test collection
- **Processing**: Assign UUIDs to all collected tests
- **Metadata**: Extend test objects with persistent identifiers
- **Configuration**: Plugin options for registry path, similarity threshold

### 6. Reporter Integration 📋 PENDING
- **Custom Reporter**: Emit test results keyed by UUID
- **CI Integration**: Format for analytics systems
- **Backward Compatibility**: Maintain existing reporter functionality
- **Output Formats**: JSON, XML, custom formats

### 7. CLI Interface 📋 PENDING
- **Debug Commands**:
  - `test-id status <uuid>` - Show test history and status
  - `test-id registry` - List all registered tests
  - `test-id cleanup` - Remove orphaned entries
- **Maintenance**: Registry inspection and management tools

### 8. Testing Strategy 🚧 IN PROGRESS
- ✅ **Unit Tests**: Core fingerprinting and matching logic (34 tests passing)
- 📋 **Integration Tests**: Full plugin workflow with sample projects
- 📋 **Edge Cases**: Duplicate tests, malformed code, large codebases
- 📋 **Performance**: Benchmarking with various project sizes

### 9. Documentation 📋 PENDING
- **API Reference**: Plugin configuration and methods
- **Usage Examples**: Integration with existing Vitest projects
- **Migration Guide**: Moving from traditional test identification
- **Troubleshooting**: Common issues and solutions

## Benefits

- **Rename-proof**: Test name changes don't break history tracking
- **Move-proof**: File relocations preserve test identity
- **Analytics-ready**: Stable UUIDs enable robust CI metrics
- **Debuggable**: Human-readable node IDs for troubleshooting
- **Flakiness Detection**: Track test stability over time

## Optional Enhancements

- Branch-aware UUID tracking
- Version history in registry for significant changes
- Web dashboard for test analytics
- Integration with popular CI platforms
- Performance optimizations for large codebases