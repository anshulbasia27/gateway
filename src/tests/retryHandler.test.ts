import { retryRequest } from '../handlers/retryHandler';

describe('retryHandler timeout functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass signal to custom request handler for timeout', async () => {
    const receivedSignal: (AbortSignal | undefined)[] = [];

    const mockRequestHandler = jest.fn(
      async (signal?: AbortSignal): Promise<Response> => {
        receivedSignal.push(signal);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    );

    const result = await retryRequest(
      'https://example.com/api',
      { method: 'POST' },
      0, // retryCount
      [], // statusCodesToRetry
      5000, // timeout in milliseconds
      mockRequestHandler // request handler should receive signal
    );

    expect(mockRequestHandler).toHaveBeenCalledTimes(1);
    expect(receivedSignal[0]).toBeInstanceOf(AbortSignal);
    expect(result.response.status).toBe(200);
  });

  it('should handle timeout when request handler does not abort', async () => {
    const mockRequestHandler = jest.fn(
      async (signal?: AbortSignal): Promise<Response> => {
        // Simulate a request that takes too long
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 2000);
          signal?.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    );

    const result = await retryRequest(
      'https://example.com/api',
      { method: 'POST' },
      0, // retryCount
      [], // statusCodesToRetry
      100, // short timeout of 100ms
      mockRequestHandler
    );

    expect(mockRequestHandler).toHaveBeenCalledTimes(1);
    expect(result.response.status).toBe(408);
    const body = (await result.response.json()) as {
      error: { type: string; message: string };
    };
    expect(body.error.type).toBe('timeout_error');
    expect(body.error.message).toContain('100ms');
  });

  it('should not pass signal when timeout is null', async () => {
    const receivedSignal: (AbortSignal | undefined)[] = [];

    const mockRequestHandler = jest.fn(
      async (signal?: AbortSignal): Promise<Response> => {
        receivedSignal.push(signal);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    );

    const result = await retryRequest(
      'https://example.com/api',
      { method: 'POST' },
      0, // retryCount
      [], // statusCodesToRetry
      null, // no timeout
      mockRequestHandler
    );

    expect(mockRequestHandler).toHaveBeenCalledTimes(1);
    expect(receivedSignal[0]).toBeUndefined();
    expect(result.response.status).toBe(200);
  });
});
