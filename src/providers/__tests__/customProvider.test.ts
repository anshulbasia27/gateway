import { registerCustomProvider, getCustomProvider, callUpstream, _testOnly_clearRegistry } from '../customProvider';

describe('CustomProvider registry', () => {
  beforeEach(async () => {
    // Ensure in-memory only and clean between tests
    process.env.NODE_ENV = 'test';
    await _testOnly_clearRegistry();
    // reset global.fetch mock
    (global as any).fetch = undefined;
  });

  it('registers and retrieves a provider', async () => {
    const cfg = {
      name: 'sample',
      baseUrl: 'https://example.com/api/',
      auth: { type: 'none' } as const,
    };

    await registerCustomProvider(cfg);
    const p = await getCustomProvider('sample');
    expect(p.name).toBe('sample');
    expect(p.baseUrl).toBe('https://example.com/api'); // trailing slash trimmed
    expect(p.auth.type).toBe('none');
  });

  it('throws on duplicate registration', async () => {
    const cfg = {
      name: 'dup',
      baseUrl: 'https://dup.example',
      auth: { type: 'none' } as const,
    };
    await registerCustomProvider(cfg);
    await expect(registerCustomProvider(cfg)).rejects.toThrow(/already exists/);
  });

  it('callUpstream adds bearer Authorization header', async () => {
    const cfg = {
      name: 'bearer-provider',
      baseUrl: 'https://bearer.example',
      auth: { type: 'bearer', token: 'SECRET_TOKEN' } as const,
    };
    await registerCustomProvider(cfg);

    const mockResponse = { ok: true, status: 200, json: async () => ({ success: true }) } as any;
    const fetchMock = jest.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = fetchMock;

    const res = await callUpstream('bearer-provider', 'POST', '/path', { body: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://bearer.example/path');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Authorization']).toBe('Bearer SECRET_TOKEN');
    expect(opts.body).toBe(JSON.stringify({ a: 1 }));
    expect(res).toBe(mockResponse);
  });

  it('callUpstream adds basic Authorization header', async () => {
    const cfg = {
      name: 'basic-provider',
      baseUrl: 'https://basic.example',
      auth: { type: 'basic', username: 'u', password: 'p' } as const,
    };
    await registerCustomProvider(cfg);

    const mockResponse = { ok: true, status: 200 } as any;
    const fetchMock = jest.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = fetchMock;

    await callUpstream('basic-provider', 'GET', 'endpoint');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['Authorization']).toBeTruthy();
    // Verify header starts with Basic and decodes to username:password
    const header = opts.headers['Authorization'] as string;
    expect(header.startsWith('Basic ')).toBe(true);
    const payload = header.replace(/^Basic /, '');
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    expect(decoded).toBe('u:p');
  });

  it('callUpstream adds apiKey header', async () => {
    const cfg = {
      name: 'apikey-provider',
      baseUrl: 'https://apikey.example',
      auth: { type: 'apiKey', name: 'x-api-key', value: 'KEY123' } as const,
    };
    await registerCustomProvider(cfg);

    const mockResponse = { ok: true, status: 200 } as any;
    const fetchMock = jest.fn().mockResolvedValue(mockResponse);
    (global as any).fetch = fetchMock;

    await callUpstream('apikey-provider', 'DELETE', '/res');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['x-api-key']).toBe('KEY123');
  });

  it('throws if provider missing required fields', async () => {
    // @ts-ignore: test invalid shapes
    await expect(registerCustomProvider({})).rejects.toThrow();
  });
});
