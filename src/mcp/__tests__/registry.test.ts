import {
  RegistryService,
  MemoryRegistryStore,
  RegistryCreateInput,
  validateAuthConfig,
  AuthConfig,
} from '../registry';

describe('MCP RegistryService', () => {
  let service: RegistryService;

  beforeEach(() => {
    service = new RegistryService(new MemoryRegistryStore());
  });

  it('creates a registry with apiKey auth', async () => {
    const input: RegistryCreateInput = {
      name: 'mcp-1',
      description: 'Test MCP',
      auth: { type: 'apiKey', keyName: 'x-api-key', keyValue: 'secret' },
      policies: ['policy-a'],
    };

    const entry = await service.create(input);
    expect(entry.id).toBeDefined();
    expect(entry.name).toBe('mcp-1');
    expect(entry.auth.type).toBe('apiKey');
    expect(entry.policies).toEqual(['policy-a']);
  });

  it('creates registries with basic and oauth auth', async () => {
    const basic = await service.create({
      name: 'mcp-basic',
      auth: { type: 'basic', username: 'u', password: 'p' },
    });
    expect(basic.auth.type).toBe('basic');

    const oauth = await service.create({
      name: 'mcp-oauth',
      auth: { type: 'oauth', provider: 'github', token: 't' },
    });
    expect(oauth.auth.type).toBe('oauth');
  });

  it('prevents creating duplicate names', async () => {
    await service.create({ name: 'dup', auth: { type: 'apiKey', keyName: 'k', keyValue: 'v' } });
    await expect(
      service.create({ name: 'dup', auth: { type: 'apiKey', keyName: 'k2', keyValue: 'v2' } })
    ).rejects.toThrow("registry with name 'dup' already exists");
  });

  it('validates auth config and rejects invalid entries', async () => {
    const badAuths: any[] = [
      { type: 'apiKey', keyName: '', keyValue: 'v' },
      { type: 'apiKey', keyName: 'k' },
      { type: 'basic', username: '', password: 'p' },
      { type: 'basic', username: 'u' },
      { type: 'oauth', provider: '', token: 't' },
      { type: 'oauth', provider: 'g' },
      { type: 'unknown', foo: 'bar' },
    ];

    for (const a of badAuths) {
      await expect(service.create({ name: `bad-${Math.random()}`, auth: a as AuthConfig })).rejects.toThrow();
    }
  });

  it('lists and gets registries', async () => {
    const a = await service.create({ name: 'one', auth: { type: 'apiKey', keyName: 'k', keyValue: 'v' } });
    const b = await service.create({ name: 'two', auth: { type: 'basic', username: 'u', password: 'p' } });

    const list = await service.list();
    expect(list.length).toBeGreaterThanOrEqual(2);

    const fetched = await service.get(a.id);
    expect(fetched.name).toBe('one');

    await expect(service.get('non-existent')).rejects.toThrow("registry with id 'non-existent' not found");
  });

  it('updates registry fields and enforces unique names', async () => {
    const first = await service.create({ name: 'first', auth: { type: 'apiKey', keyName: 'k', keyValue: 'v' } });
    const second = await service.create({ name: 'second', auth: { type: 'basic', username: 'u', password: 'p' } });

    // attempt to rename second to first should fail
    await expect(
      service.update(second.id, { name: 'first' })
    ).rejects.toThrow("registry with name 'first' already exists");

    const updated = await service.update(first.id, { description: 'updated', policies: ['p1', 'p2'] });
    expect(updated.description).toBe('updated');
    expect(updated.policies).toEqual(['p1', 'p2']);
  });

  it('delete removes registry and subsequent get fails', async () => {
    const entry = await service.create({ name: 'todelete', auth: { type: 'apiKey', keyName: 'k', keyValue: 'v' } });
    await service.delete(entry.id);
    await expect(service.get(entry.id)).rejects.toThrow();
  });

  it('validateAuthConfig throws for invalid shapes', () => {
    expect(() => validateAuthConfig({} as any)).toThrow();
  });
});
