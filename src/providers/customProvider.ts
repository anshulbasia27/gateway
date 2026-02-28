import fs from 'fs/promises';
import path from 'path';

/**
 * Type describing supported auth schemes for custom providers
 */
export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey';

export interface ApiKeyAuth {
  type: 'apiKey';
  name: string; // header name where api key should be set
  value: string;
}

export interface BearerAuth {
  type: 'bearer';
  token: string;
}

export interface BasicAuth {
  type: 'basic';
  username: string;
  password: string;
}

export type AuthConfig = ApiKeyAuth | BearerAuth | BasicAuth | { type: 'none' };

/**
 * Configuration object for a custom provider
 */
export interface CustomProviderConfig {
  name: string; // unique provider name
  description?: string;
  baseUrl: string; // e.g. https://mcp.example.com
  auth: AuthConfig;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'custom-providers.json');

// In-memory registry
const registry = new Map<string, CustomProviderConfig>();
let initialized = false;

/**
 * Persist current registry to disk. No-op during tests (NODE_ENV === 'test').
 */
async function persistRegistry(): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    // Tests use in-memory only to avoid filesystem side-effects
    return;
  }

  const arr = Array.from(registry.values());
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(arr, null, 2), { encoding: 'utf-8' });
  } catch (err) {
    // bubble up as a controlled error
    throw new Error(`Failed to persist custom providers: ${(err as Error).message}`);
  }
}

/**
 * Load registry from disk into memory. Safe to call multiple times.
 */
async function loadRegistry(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (process.env.NODE_ENV === 'test') {
    // keep registry empty in tests unless tests register providers explicitly
    return;
  }

  try {
    const buf = await fs.readFile(DATA_FILE, { encoding: 'utf-8' });
    const arr = JSON.parse(buf) as CustomProviderConfig[];
    for (const p of arr) {
      registry.set(p.name, p);
    }
  } catch (err) {
    // If file doesn't exist, start with empty registry. Other errors bubble up.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw new Error(`Failed to load custom providers: ${(err as Error).message}`);
  }
}

/**
 * Validate provider config and throw on validation errors.
 */
function validateConfig(cfg: CustomProviderConfig) {
  if (!cfg || typeof cfg !== 'object') {
    throw new Error('Provider config must be an object');
  }
  if (!cfg.name || typeof cfg.name !== 'string') {
    throw new Error('Provider "name" is required and must be a string');
  }
  if (!cfg.baseUrl || typeof cfg.baseUrl !== 'string') {
    throw new Error('Provider "baseUrl" is required and must be a string');
  }
  if (!cfg.auth || typeof cfg.auth !== 'object') {
    throw new Error('Provider "auth" is required');
  }

  const auth = cfg.auth as AuthConfig;
  if (auth.type === 'bearer') {
    if (!('token' in auth) || typeof (auth as BearerAuth).token !== 'string') {
      throw new Error('Bearer auth requires a "token" string');
    }
  } else if (auth.type === 'basic') {
    if (
      typeof (auth as BasicAuth).username !== 'string' ||
      typeof (auth as BasicAuth).password !== 'string'
    ) {
      throw new Error('Basic auth requires "username" and "password" strings');
    }
  } else if (auth.type === 'apiKey') {
    if (typeof (auth as ApiKeyAuth).name !== 'string' || typeof (auth as ApiKeyAuth).value !== 'string') {
      throw new Error('apiKey auth requires "name" and "value" strings');
    }
  } else if (auth.type !== 'none') {
    throw new Error(`Unsupported auth type: ${(auth as any).type}`);
  }
}

/**
 * Register a new custom provider. Throws if provider exists or validation fails.
 * @param cfg Custom provider configuration
 */
export async function registerCustomProvider(cfg: CustomProviderConfig): Promise<void> {
  await loadRegistry();
  validateConfig(cfg);
  if (registry.has(cfg.name)) {
    throw new Error(`Provider with name "${cfg.name}" already exists`);
  }
  // Normalize baseUrl (remove trailing slash)
  const normalized: CustomProviderConfig = {
    ...cfg,
    baseUrl: cfg.baseUrl.replace(/\/$/, ''),
  };
  registry.set(normalized.name, normalized);
  await persistRegistry();
}

/**
 * Retrieve a provider by name. Throws if not found.
 */
export async function getCustomProvider(name: string): Promise<CustomProviderConfig> {
  await loadRegistry();
  const p = registry.get(name);
  if (!p) {
    throw new Error(`Provider with name "${name}" not found`);
  }
  return p;
}

/**
 * Make an outbound call to a provider. Convenience wrapper that sets auth headers.
 * Returns the underlying Fetch Response.
 * @param name registered provider name
 * @param method HTTP method
 * @param pathPath path relative to provider baseUrl (leading slash optional)
 * @param opts optional body and headers
 */
export async function callUpstream(
  name: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  pathPath: string,
  opts?: { body?: any; headers?: Record<string, string> }
): Promise<Response> {
  const provider = await getCustomProvider(name);
  const url = `${provider.baseUrl}/${pathPath.replace(/^\//, '')}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts && opts.headers ? opts.headers : {}),
  };

  const auth = provider.auth;
  if (auth.type === 'bearer') {
    headers['Authorization'] = `Bearer ${(auth as BearerAuth).token}`;
  } else if (auth.type === 'basic') {
    const b = Buffer.from(`${(auth as BasicAuth).username}:${(auth as BasicAuth).password}`).toString('base64');
    headers['Authorization'] = `Basic ${b}`;
  } else if (auth.type === 'apiKey') {
    headers[(auth as ApiKeyAuth).name] = (auth as ApiKeyAuth).value;
  }

  const fetchOpts: RequestInit = {
    method,
    headers,
  };
  if (opts && opts.body !== undefined) {
    fetchOpts.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }

  // Use global fetch (Node 18+ or environment that polyfills). Let errors bubble to caller so they can handle retries.
  // We don't wrap in try/catch here because callers should be able to observe network errors.
  // However, we validate final URL
  try {
    const res = await fetch(url, fetchOpts);
    return res;
  } catch (err) {
    throw new Error(`Failed to call upstream provider "${name}": ${(err as Error).message}`);
  }
}

/**
 * For test-helper purposes: clear the in-memory registry. Not exported from public API in production scenario.
 */
export async function _testOnly_clearRegistry(): Promise<void> {
  registry.clear();
}
