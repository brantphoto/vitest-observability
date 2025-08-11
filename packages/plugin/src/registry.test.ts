import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync } from 'fs'
import { TestRegistry } from './registry'

describe('TestRegistry', () => {
  const testRegistryPath = '.test-registry-test.json'
  let registry: TestRegistry

  beforeEach(() => {
    // Clean up any existing test file
    if (existsSync(testRegistryPath)) {
      unlinkSync(testRegistryPath)
    }
    registry = new TestRegistry(testRegistryPath)
  })

  afterEach(() => {
    // Clean up test file
    if (existsSync(testRegistryPath)) {
      unlinkSync(testRegistryPath)
    }
  })

  describe('add and find', () => {
    it('should add new test entry and find it by hash', () => {
      const hash = 'abc123'
      const nodeId = 'test.js::my_test'
      const bodyLength = 42
      
      const uuid = registry.add(hash, nodeId, bodyLength)
      
      expect(uuid).toMatch(/^[0-9a-f-]{36}$/) // UUID format
      
      const entry = registry.findByHash(hash)
      expect(entry).toEqual({
        uuid,
        hash,
        nodeId,
        lastNodeId: nodeId,
        bodyLength,
        timestamp: expect.any(Number),
        lastSeen: expect.any(Number)
      })
    })

    it('should find entry by UUID', () => {
      const hash = 'def456'
      const nodeId = 'test.js::another_test'
      const bodyLength = 100
      
      const uuid = registry.add(hash, nodeId, bodyLength)
      const entry = registry.findByUuid(uuid)
      
      expect(entry?.hash).toBe(hash)
      expect(entry?.lastNodeId).toBe(nodeId)
      expect(entry?.bodyLength).toBe(bodyLength)
    })

    it('should return undefined for non-existent hash', () => {
      const entry = registry.findByHash('nonexistent')
      expect(entry).toBeUndefined()
    })

    it('should return undefined for non-existent UUID', () => {
      const entry = registry.findByUuid('non-existent-uuid')
      expect(entry).toBeUndefined()
    })
  })

  describe('update', () => {
    it('should update existing entry', () => {
      const originalHash = 'hash1'
      const updatedHash = 'hash2'
      const originalNodeId = 'test1.js::test'
      const updatedNodeId = 'test2.js::test'
      const originalBodyLength = 50
      const updatedBodyLength = 75
      
      const uuid = registry.add(originalHash, originalNodeId, originalBodyLength)
      const originalTime = registry.findByUuid(uuid)?.lastSeen
      
      registry.update(uuid, updatedHash, updatedNodeId, updatedBodyLength)
      
      const entry = registry.findByUuid(uuid)
      expect(entry?.hash).toBe(updatedHash)
      expect(entry?.lastNodeId).toBe(updatedNodeId)
      expect(entry?.bodyLength).toBe(updatedBodyLength)
      expect(entry?.lastSeen).toBeGreaterThanOrEqual(originalTime!)
    })

    it('should not crash when updating non-existent UUID', () => {
      expect(() => {
        registry.update('non-existent', 'hash', 'nodeId', 50)
      }).not.toThrow()
    })
  })

  describe('persistence', () => {
    it('should persist and load registry data', () => {
      const hash = 'persistent-hash'
      const nodeId = 'persistent.test.js::test'
      const bodyLength = 200
      
      const uuid = registry.add(hash, nodeId, bodyLength)
      registry.save()
      
      // Create new registry instance to test loading
      const newRegistry = new TestRegistry(testRegistryPath)
      const entry = newRegistry.findByHash(hash)
      
      expect(entry?.uuid).toBe(uuid)
      expect(entry?.hash).toBe(hash)
      expect(entry?.lastNodeId).toBe(nodeId)
      expect(entry?.bodyLength).toBe(bodyLength)
    })
  })

  describe('error handling and edge cases', () => {
    it('should handle corrupted registry file gracefully', () => {
      const corruptRegistryPath = '.test-corrupt-registry.json'
      
      // Write corrupted JSON to file
      require('fs').writeFileSync(corruptRegistryPath, '{ invalid json content')
      
      // Should not crash on loading corrupted file
      const corruptRegistry = new TestRegistry(corruptRegistryPath)
      expect(corruptRegistry.size()).toBe(0)
      
      // Cleanup
      if (existsSync(corruptRegistryPath)) {
        unlinkSync(corruptRegistryPath)
      }
    })

    it('should handle missing registry file gracefully', () => {
      const missingPath = '.test-missing-registry.json'
      
      // Ensure file doesn't exist
      if (existsSync(missingPath)) {
        unlinkSync(missingPath)
      }
      
      // Should not crash on loading missing file
      const missingRegistry = new TestRegistry(missingPath)
      expect(missingRegistry.size()).toBe(0)
      
      // Should be able to add entries
      const uuid = missingRegistry.add('test-hash', 'test-node', 42)
      expect(uuid).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('should handle save error gracefully', () => {
      // Try to save to an invalid path (directory doesn't exist)
      const invalidPath = '/nonexistent/directory/registry.json'
      const errorRegistry = new TestRegistry(invalidPath)
      
      errorRegistry.add('test-hash', 'test-node', 42)
      
      // Should not crash when trying to save to invalid path
      expect(() => errorRegistry.save()).not.toThrow()
    })
  })

  describe('utility methods', () => {
    it('should return all entries', () => {
      registry.add('hash1', 'test1', 10)
      registry.add('hash2', 'test2', 20)
      
      const entries = registry.getAllEntries()
      expect(entries).toHaveLength(2)
      expect(entries.every(e => e.uuid && e.hash && e.lastNodeId && typeof e.bodyLength === 'number')).toBe(true)
    })

    it('should return all hashes', () => {
      registry.add('hash1', 'test1', 10)
      registry.add('hash2', 'test2', 20)
      
      const hashes = registry.getAllHashes()
      expect(hashes).toEqual(['hash1', 'hash2'])
    })

    it('should return correct size', () => {
      expect(registry.size()).toBe(0)
      
      registry.add('hash1', 'test1', 10)
      expect(registry.size()).toBe(1)
      
      registry.add('hash2', 'test2', 20)
      expect(registry.size()).toBe(2)
    })

    it('should cleanup inactive UUIDs', () => {
      const uuid1 = registry.add('hash1', 'test1', 10)
      const uuid2 = registry.add('hash2', 'test2', 20)
      const uuid3 = registry.add('hash3', 'test3', 30)
      
      expect(registry.size()).toBe(3)
      
      // Keep only uuid1 and uuid3
      const removed = registry.cleanup([uuid1, uuid3])
      
      expect(removed).toBe(1)
      expect(registry.size()).toBe(2)
      expect(registry.findByUuid(uuid1)).toBeDefined()
      expect(registry.findByUuid(uuid2)).toBeUndefined()
      expect(registry.findByUuid(uuid3)).toBeDefined()
    })
  })
})