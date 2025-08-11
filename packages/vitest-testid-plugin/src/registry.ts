import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'

import type { TestEntry, Registry } from '@vitest-testid/types'

export class TestRegistry {
  private registry: Registry = {}
  private readonly filePath: string

  constructor(registryPath: string = '.test-ids.json') {
    this.filePath = resolve(process.cwd(), registryPath)
    this.load()
  }

  private load(): void {
    if (existsSync(this.filePath)) {
      try {
        const content = readFileSync(this.filePath, 'utf-8')
        this.registry = JSON.parse(content)
      } catch (error) {
        console.warn(`Failed to load test registry from ${this.filePath}:`, error)
        this.registry = {}
      }
    }
  }

  save(): void {
    try {
      const content = JSON.stringify(this.registry, null, 2)
      writeFileSync(this.filePath, content, 'utf-8')
    } catch (error) {
      console.error(`Failed to save test registry to ${this.filePath}:`, error)
    }
  }

  findByHash(hash: string): TestEntry | undefined {
    for (const entry of Object.values(this.registry)) {
      if (entry.hash === hash) {
        return entry
      }
    }
    return undefined
  }

  findByUuid(uuid: string): TestEntry | undefined {
    return this.registry[uuid]
  }

  add(hash: string, nodeId: string, bodyLength: number): string {
    const uuid = randomUUID()
    const now = Date.now()
    
    const entry: TestEntry = {
      uuid,
      nodeId,
      hash,
      bodyLength,
      timestamp: now,
      lastNodeId: nodeId,
      lastSeen: now
    }
    
    this.registry[uuid] = entry
    return uuid
  }

  update(uuid: string, hash: string, nodeId: string, bodyLength: number): void {
    const entry = this.registry[uuid]
    if (entry) {
      entry.hash = hash
      entry.nodeId = nodeId
      entry.bodyLength = bodyLength
      entry.lastNodeId = nodeId
      entry.lastSeen = Date.now()
      entry.timestamp = Date.now()
    }
  }

  getAllEntries(): TestEntry[] {
    return Object.entries(this.registry).map(([_, entry]) => entry)
  }

  getAllHashes(): string[] {
    return Object.values(this.registry).map(entry => entry.hash)
  }

  cleanup(activeUuids: string[]): number {
    const activeSet = new Set(activeUuids)
    const toRemove: string[] = []
    
    for (const uuid of Object.keys(this.registry)) {
      if (!activeSet.has(uuid)) {
        toRemove.push(uuid)
      }
    }
    
    for (const uuid of toRemove) {
      delete this.registry[uuid]
    }
    
    return toRemove.length
  }

  size(): number {
    return Object.keys(this.registry).length
  }
}