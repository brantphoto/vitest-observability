import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'

export interface TestEntry {
  uuid: string
  hash: string
  lastNodeId: string
  bodyLength: number
  createdAt: number
  lastSeen: number
}

export interface Registry {
  [uuid: string]: Omit<TestEntry, 'uuid'>
}

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
    for (const [uuid, entry] of Object.entries(this.registry)) {
      if (entry.hash === hash) {
        return { uuid, ...entry }
      }
    }
    return undefined
  }

  findByUuid(uuid: string): TestEntry | undefined {
    const entry = this.registry[uuid]
    return entry ? { uuid, ...entry } : undefined
  }

  add(hash: string, nodeId: string, bodyLength: number): string {
    const uuid = randomUUID()
    const now = Date.now()
    
    this.registry[uuid] = {
      hash,
      lastNodeId: nodeId,
      bodyLength,
      createdAt: now,
      lastSeen: now
    }
    
    return uuid
  }

  update(uuid: string, hash: string, nodeId: string, bodyLength: number): void {
    const entry = this.registry[uuid]
    if (entry) {
      entry.hash = hash
      entry.lastNodeId = nodeId
      entry.bodyLength = bodyLength
      entry.lastSeen = Date.now()
    }
  }

  getAllEntries(): TestEntry[] {
    return Object.entries(this.registry).map(([uuid, entry]) => ({
      uuid,
      ...entry
    }))
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