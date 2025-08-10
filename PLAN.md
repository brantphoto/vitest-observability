# Vitest Test Identity Plugin - Implementation Plan

## Overview

This plugin implements a Test Identity Manager for Vitest that assigns persistent UUIDs to tests based on their content fingerprints rather than file paths or test names. This enables stable test tracking across renames, moves, and refactors.

## 🎯 Current Status: **CORE PLUGIN COMPLETE** ✅

**Completed:** 6 out of 9 major tasks ✅  
**Test Coverage:** 42 tests passing (100% core functionality) 🧪  
**Build Status:** All TypeScript compilation and builds successful 🏗️  
**Ready for:** Production use with reporter integration pending 🚀

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
- ✅ **Storage**: JSON file (`.test-ids.json`) with atomic save operations
- ✅ **Enhanced Schema**: 
  ```json
  {
    "uuid": {
      "hash": "content-fingerprint",
      "lastNodeId": "src/tests/example.test.js::test_name",
      "bodyLength": 150,
      "createdAt": 1640995200000,
      "lastSeen": 1640995200000
    }
  }
  ```
- ✅ **Operations**: load, save, add, find by hash/UUID, update, cleanup orphaned entries

### 3. AST-Based Fingerprinting ✅ COMPLETED
- ✅ **Parser**: Use Acorn/Babel to parse test source code
- ✅ **Extraction**: Identify and extract test function bodies
- ✅ **Normalization**: Remove comments, whitespace, non-semantic changes
- ✅ **Hashing**: Generate SHA1/SHA256 of normalized AST structure
- ✅ **Stability**: Ensure fingerprints survive cosmetic code changes

### 4. Test Matching System ✅ COMPLETED
- ✅ **Exact matching**: Direct hash lookup for unchanged tests (O(1) performance)
- ✅ **Fuzzy matching**: Multi-factor similarity scoring with Levenshtein distance
- ✅ **3-Factor Similarity**: Node ID structure (50%) + Test names (30%) + Body length (20%)
- ✅ **Content complexity detection**: Body length similarity catches significant test expansions
- ✅ **UUID assignment**: Reuse existing UUID or generate new one
- ✅ **Registry updates**: Update lastNodeId and bodyLength for matched tests

### 5. Vitest Plugin Integration ✅ COMPLETED
- ✅ **Hook Integration**: Uses `onTaskUpdate` and `onFinished` to intercept Vitest lifecycle
- ✅ **Processing**: Assigns UUIDs to all collected tests and suites
- ✅ **Metadata**: Extends test objects with `testUuid` and `testFingerprint` properties
- ✅ **Configuration**: Comprehensive plugin options (registry path, similarity threshold, debug mode, auto-save/cleanup)
- ✅ **Error Handling**: Graceful handling of file read errors and malformed code
- ✅ **Node ID Generation**: Creates consistent identifiers like `file.test.ts::suite::test`

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

### 8. Testing Strategy ✅ COMPLETED
- ✅ **Unit Tests**: Core fingerprinting and matching logic (42 tests passing)
- ✅ **Integration Tests**: Full plugin workflow with Vitest integration
- ✅ **Edge Cases**: Duplicate tests, malformed code, error handling
- ✅ **Body Length Similarity**: Enhanced matching with content complexity factors
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