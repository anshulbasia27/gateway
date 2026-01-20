/**
 * MCP Registry - minimal service for managing authentication and governance
 * for MCP servers. This file provides:
 * - Types for auth configs and registry entries
 * - A Store abstraction and an in-memory implementation
 * - RegistryService exposing create/update/get/list/delete operations
 *
 * The implementation is intentionally small and focused so it can be
 * swapped to persistent storage later by implementing RegistryStore.
 */

export type AuthType = 'apiKey' | 'basic' | 'oauth';

export interface ApiKeyAuth {
  type: 'apiKey';
  keyName: string; // logical key name (for display)
  keyValue: string; // secret value
}

export interface BasicAuth {
  type: 'basic';
  username: string;
  password: string;
}

export interface OAuthAuth {
  type: 'oauth';
  provider: string; // e.g., 'google', 'github'
  token: string; // access token
  refreshToken?: string;
  expiresAt?: number; // epoch ms
}

export type AuthConfig = ApiKeyAuth | BasicAuth | OAuthAuth;

export interface MpcRegistryEntry {
  id: string;
  name: string; // unique human-friendly name
  description?: string;
  auth: AuthConfig;
  policies?: string[]; // governance tags or small policy identifiers
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface RegistryCreateInput {
  name: string;
  description?: string;
  auth: AuthConfig;
  policies?: string[];
}

export interface RegistryUpdateInput {
  name?: string;
  description?: string | null;
  auth?: AuthConfig;
  policies?: string[] | null;
}

/** Abstraction for storage to allow swapping persistence later. */
export interface RegistryStore {
  getAll(): Promise<MpcRegistryEntry[]>;
  getById(id: string): Promise<MpcRegistryEntry | undefined>;
  getByName(name: string): Promise<MpcRegistryEntry | undefined>;
  put(entry: MpcRegistryEntry): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * Simple in-memory store used by default and tests. Not shared between instances.
 */
export class MemoryRegistryStore implements RegistryStore {
  private items: Map<string, MpcRegistryEntry>;

  constructor() {
    this.items = new Map();
  }

  async getAll(): Promise<MpcRegistryEntry[]> {
    return Array.from(this.items.values());
  }

  async getById(id: string): Promise<MpcRegistryEntry | undefined> {
    return this.items.get(id);
  }

  async getByName(name: string): Promise<MpcRegistryEntry | undefined> {
    for (const v of this.items.values()) {
      if (v.name === name) return v;
    }
    return undefined;
  }

  async put(entry: MpcRegistryEntry): Promise<void> {
    this.items.set(entry.id, entry);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

const nowIso = (): string => new Date().toISOString();

const makeId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Validate an AuthConfig object. Throws Error with message on invalid input.
 * @param auth AuthConfig to validate
 */
export const validateAuthConfig = (auth: AuthConfig): void => {
  if (!auth || typeof auth !== 'object' || !('type' in auth)) {
    throw new Error('auth config must be an object with a type field');
  }

  switch (auth.type) {
    case 'apiKey': {
      const a = auth as ApiKeyAuth;
      if (!a.keyName || typeof a.keyName !== 'string') {
        throw new Error('apiKey auth requires non-empty keyName');
      }
      if (!a.keyValue || typeof a.keyValue !== 'string') {
        throw new Error('apiKey auth requires non-empty keyValue');
      }
      return;
    }
    case 'basic': {
      const a = auth as BasicAuth;
      if (!a.username || typeof a.username !== 'string') {
        throw new Error('basic auth requires non-empty username');
      }
      if (!a.password || typeof a.password !== 'string') {
        throw new Error('basic auth requires non-empty password');
      }
      return;
    }
    case 'oauth': {
      const a = auth as OAuthAuth;
      if (!a.provider || typeof a.provider !== 'string') {
        throw new Error('oauth auth requires non-empty provider');
      }
      if (!a.token || typeof a.token !== 'string') {
        throw new Error('oauth auth requires non-empty token');
      }
      return;
    }
    default:
      throw new Error(`unsupported auth type: ${(auth as any).type}`);
  }
};

/**
 * Service for MCP Registry operations. Keeps logic and validation separate from store.
 */
export class RegistryService {
  private store: RegistryStore;

  constructor(store?: RegistryStore) {
    this.store = store || new MemoryRegistryStore();
  }

  /**
   * Create a new registry entry. Throws on validation failure or duplicate name.
   */
  async create(input: RegistryCreateInput): Promise<MpcRegistryEntry> {
    if (!input || typeof input !== 'object') {
      throw new Error('input is required');
    }
    const name = (input.name || '').trim();
    if (!name) {
      throw new Error('name is required');
    }

    // Prevent duplicate names
    const existing = await this.store.getByName(name);
    if (existing) {
      throw new Error(`registry with name '${name}' already exists`);
    }

    // Validate auth
    validateAuthConfig(input.auth);

    // Validate policies if provided
    if (input.policies) {
      if (!Array.isArray(input.policies)) {
        throw new Error('policies must be an array of strings');
      }
      for (const p of input.policies) {
        if (!p || typeof p !== 'string') {
          throw new Error('policies must be non-empty strings');
        }
      }
    }

    const entry: MpcRegistryEntry = {
      id: makeId(),
      name,
      description: input.description || undefined,
      auth: input.auth,
      policies: input.policies || undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await this.store.put(entry);
    return entry;
  }

  /**
   * Update an existing registry entry by id. Partial updates allowed.
   */
  async update(id: string, input: RegistryUpdateInput): Promise<MpcRegistryEntry> {
    if (!id) throw new Error('id is required');
    const existing = await this.store.getById(id);
    if (!existing) throw new Error(`registry with id '${id}' not found`);

    if (input.name) {
      const newName = input.name.trim();
      if (!newName) throw new Error('name cannot be empty');
      // if changing name, ensure uniqueness
      if (newName !== existing.name) {
        const byName = await this.store.getByName(newName);
        if (byName) throw new Error(`registry with name '${newName}' already exists`);
        existing.name = newName;
      }
    }

    if (input.description !== undefined) {
      // allow null to clear description
      existing.description = input.description || undefined;
    }

    if (input.auth) {
      validateAuthConfig(input.auth);
      existing.auth = input.auth;
    }

    if (input.policies !== undefined) {
      // allow null to clear policies
      if (input.policies === null) {
        existing.policies = undefined;
      } else {
        if (!Array.isArray(input.policies)) {
          throw new Error('policies must be an array of strings');
        }
        for (const p of input.policies) {
          if (!p || typeof p !== 'string') {
            throw new Error('policies must be non-empty strings');
          }
        }
        existing.policies = input.policies.length ? input.policies : undefined;
      }
    }

    existing.updatedAt = nowIso();
    await this.store.put(existing);
    return existing;
  }

  /**
   * Delete a registry entry by id. No-op if not found.
   */
  async delete(id: string): Promise<void> {
    if (!id) throw new Error('id is required');
    const existing = await this.store.getById(id);
    if (!existing) throw new Error(`registry with id '${id}' not found`);
    await this.store.delete(id);
  }

  async get(id: string): Promise<MpcRegistryEntry> {
    if (!id) throw new Error('id is required');
    const existing = await this.store.getById(id);
    if (!existing) throw new Error(`registry with id '${id}' not found`);
    return existing;
  }

  async list(): Promise<MpcRegistryEntry[]> {
    return this.store.getAll();
  }
}
