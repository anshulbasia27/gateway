import { sanitizeResponseHeaders } from '../../../../src/utils/httpHeaders';

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
  });
});
