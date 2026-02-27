import {
  sanitizeResponseHeaders,
  createStreamingHeaders,
  STREAMING_HEADERS_TO_REMOVE,
} from '../../../../src/utils/httpHeaders';

/**
 * HTTP Header Utilities Tests
 *
 * These tests verify HTTP/1.1 compliance for response headers.
 * The fix addresses an issue where Node.js enriches HTTP responses with both
 * content-length and transfer-encoding: chunked headers, violating RFC 7230.
 *
 * Verified to work on Node.js versions:
 * - v20.19.5
 * - v22.14.0
 * - v22.16.0
 *
 * To verify on a specific Node.js version:
 * 1. Install the target Node.js version (e.g., using nvm)
 * 2. Run: npm run test:gateway -- --testPathPattern="httpHeaders"
 */

describe('STREAMING_HEADERS_TO_REMOVE', () => {
  it('should contain all headers that conflict with chunked transfer encoding', () => {
    expect(STREAMING_HEADERS_TO_REMOVE).toContain('content-length');
    expect(STREAMING_HEADERS_TO_REMOVE).toContain('transfer-encoding');
    expect(STREAMING_HEADERS_TO_REMOVE).toContain('content-encoding');
  });

  it('should have exactly 3 headers defined', () => {
    expect(STREAMING_HEADERS_TO_REMOVE).toHaveLength(3);
  });
});

describe('createStreamingHeaders', () => {
  it('should remove all streaming headers from original headers', () => {
    const originalHeaders = new Headers({
      'content-type': 'text/event-stream',
      'content-length': '100',
      'transfer-encoding': 'chunked',
      'content-encoding': 'gzip',
      'x-custom-header': 'value',
    });

    const result = createStreamingHeaders(originalHeaders);

    expect(result.get('content-length')).toBeNull();
    expect(result.get('transfer-encoding')).toBeNull();
    expect(result.get('content-encoding')).toBeNull();
    expect(result.get('content-type')).toBe('text/event-stream');
    expect(result.get('x-custom-header')).toBe('value');
  });

  it('should add additional headers to the result', () => {
    const originalHeaders = new Headers({
      'content-type': 'application/json',
    });

    const result = createStreamingHeaders(originalHeaders, {
      'x-new-header': 'new-value',
    });

    expect(result.get('content-type')).toBe('application/json');
    expect(result.get('x-new-header')).toBe('new-value');
  });

  it('should override original headers with additional headers', () => {
    const originalHeaders = new Headers({
      'content-type': 'application/json',
    });

    const result = createStreamingHeaders(originalHeaders, {
      'content-type': 'text/event-stream',
    });

    expect(result.get('content-type')).toBe('text/event-stream');
  });

  it('should handle case-insensitive header matching', () => {
    const originalHeaders = new Headers({
      'Content-Length': '100',
      'Transfer-Encoding': 'chunked',
      'Content-Encoding': 'gzip',
    });

    const result = createStreamingHeaders(originalHeaders);

    expect(result.get('content-length')).toBeNull();
    expect(result.get('transfer-encoding')).toBeNull();
    expect(result.get('content-encoding')).toBeNull();
  });
});

describe('sanitizeResponseHeaders', () => {
  describe('HTTP/1.1 compliance', () => {
    it('should remove content-length when transfer-encoding is present', () => {
      const response = new Response('test body', {
        headers: {
          'content-length': '9',
          'transfer-encoding': 'chunked',
          'content-type': 'text/plain',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBeNull();
      expect(sanitized.headers.get('transfer-encoding')).toBe('chunked');
      expect(sanitized.headers.get('content-type')).toBe('text/plain');
    });

    it('should preserve content-length when transfer-encoding is absent', () => {
      const response = new Response('test body', {
        headers: {
          'content-length': '9',
          'content-type': 'text/plain',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBe('9');
      expect(sanitized.headers.get('content-type')).toBe('text/plain');
    });

    it('should preserve transfer-encoding when content-length is absent', () => {
      const response = new Response('test body', {
        headers: {
          'transfer-encoding': 'chunked',
          'content-type': 'text/plain',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('transfer-encoding')).toBe('chunked');
      expect(sanitized.headers.get('content-type')).toBe('text/plain');
    });

    it('should not modify response when neither header is present', () => {
      const response = new Response('test body', {
        headers: {
          'content-type': 'text/plain',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBeNull();
      expect(sanitized.headers.get('transfer-encoding')).toBeNull();
      expect(sanitized.headers.get('content-type')).toBe('text/plain');
    });
  });

  describe('response preservation', () => {
    it('should preserve response status', () => {
      const response = new Response('error', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          'content-length': '5',
          'transfer-encoding': 'chunked',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.status).toBe(500);
      expect(sanitized.statusText).toBe('Internal Server Error');
    });

    it('should preserve response body for text responses', async () => {
      const response = new Response('test body content', {
        headers: {
          'content-length': '17',
          'transfer-encoding': 'chunked',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);
      const body = await sanitized.text();

      expect(body).toBe('test body content');
    });

    it('should preserve response body for JSON responses', async () => {
      const jsonData = { message: 'test', status: 'ok' };
      const response = new Response(JSON.stringify(jsonData), {
        headers: {
          'content-length': '30',
          'transfer-encoding': 'chunked',
          'content-type': 'application/json',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);
      const body = await sanitized.json();

      expect(body).toEqual(jsonData);
    });

    it('should preserve all other headers', () => {
      const response = new Response('test', {
        headers: {
          'content-length': '4',
          'transfer-encoding': 'chunked',
          'x-custom-header': 'custom-value',
          'x-request-id': '12345',
          'cache-control': 'no-cache',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('x-custom-header')).toBe('custom-value');
      expect(sanitized.headers.get('x-request-id')).toBe('12345');
      expect(sanitized.headers.get('cache-control')).toBe('no-cache');
    });
  });

  describe('streaming responses', () => {
    it('should handle streaming response with conflicting headers', async () => {
      // Create a response with a simple body but conflicting headers
      // (simulating a streaming response scenario)
      const response = new Response('streaming data', {
        headers: {
          'content-length': '100',
          'transfer-encoding': 'chunked',
          'content-type': 'text/event-stream',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBeNull();
      expect(sanitized.headers.get('transfer-encoding')).toBe('chunked');
      expect(sanitized.headers.get('content-type')).toBe('text/event-stream');

      // Verify body is preserved
      const body = await sanitized.text();
      expect(body).toBe('streaming data');
    });

    it('should handle response with ReadableStream body', () => {
      // Test that headers are sanitized even when body is a ReadableStream
      const { readable } = new TransformStream();

      const response = new Response(readable, {
        headers: {
          'content-length': '100',
          'transfer-encoding': 'chunked',
          'content-type': 'text/event-stream',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBeNull();
      expect(sanitized.headers.get('transfer-encoding')).toBe('chunked');
      expect(sanitized.headers.get('content-type')).toBe('text/event-stream');
      expect(sanitized.body).toBeDefined();
    });

    it('should preserve content-length when only content-length is present (no transfer-encoding)', () => {
      // When there's no transfer-encoding header, content-length should be preserved
      // This is the normal case for non-streaming responses
      const response = new Response('regular body content', {
        headers: {
          'content-length': '20',
          'content-type': 'text/plain',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBe('20');
      expect(sanitized.headers.get('content-type')).toBe('text/plain');
      // Should return the same response object since no changes needed
      expect(sanitized).toBe(response);
    });

    it('should return same response when no conflicting headers exist', () => {
      // When there's no conflict, the original response should be returned
      const { readable } = new TransformStream();

      const response = new Response(readable, {
        headers: {
          'content-type': 'text/event-stream',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBeNull();
      expect(sanitized.headers.get('content-type')).toBe('text/event-stream');
      // Should return the same response object since no changes needed
      expect(sanitized).toBe(response);
    });
  });
});
