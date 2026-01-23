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

    it('should proactively remove content-length for streaming content-type without transfer-encoding', () => {
      // This is the key fix for Node.js: when the content-type is text/event-stream,
      // Node.js HTTP server will automatically add transfer-encoding: chunked.
      // We need to remove content-length proactively to prevent HTTP/1.1 violation.
      const { readable } = new TransformStream();

      const response = new Response(readable, {
        headers: {
          'content-length': '100',
          'content-type': 'text/event-stream',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      // content-length should be removed because the content-type is streaming
      expect(sanitized.headers.get('content-length')).toBeNull();
      expect(sanitized.headers.get('content-type')).toBe('text/event-stream');
      expect(sanitized.body).toBeDefined();
    });

    it('should proactively remove content-length for ndjson streaming content-type', () => {
      // application/x-ndjson is another streaming content type
      const { readable } = new TransformStream();

      const response = new Response(readable, {
        headers: {
          'content-length': '100',
          'content-type': 'application/x-ndjson',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBeNull();
      expect(sanitized.headers.get('content-type')).toBe(
        'application/x-ndjson'
      );
    });

    it('should proactively remove content-length for stream+json content-type', () => {
      // application/stream+json is another streaming content type
      const { readable } = new TransformStream();

      const response = new Response(readable, {
        headers: {
          'content-length': '100',
          'content-type': 'application/stream+json',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBeNull();
      expect(sanitized.headers.get('content-type')).toBe(
        'application/stream+json'
      );
    });

    it('should handle content-type with charset parameter', () => {
      // Content-type might include charset parameter
      const { readable } = new TransformStream();

      const response = new Response(readable, {
        headers: {
          'content-length': '100',
          'content-type': 'text/event-stream; charset=utf-8',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBeNull();
      expect(sanitized.headers.get('content-type')).toBe(
        'text/event-stream; charset=utf-8'
      );
    });

    it('should preserve content-length for non-streaming content-type', () => {
      // For non-streaming content types, content-length should be preserved
      const response = new Response('regular body content', {
        headers: {
          'content-length': '20',
          'content-type': 'text/plain',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBe('20');
      expect(sanitized.headers.get('content-type')).toBe('text/plain');
    });

    it('should preserve content-length for application/json', () => {
      // JSON responses should preserve content-length
      const response = new Response('{"key": "value"}', {
        headers: {
          'content-length': '16',
          'content-type': 'application/json',
        },
      });

      const sanitized = sanitizeResponseHeaders(response);

      expect(sanitized.headers.get('content-length')).toBe('16');
      expect(sanitized.headers.get('content-type')).toBe('application/json');
    });

    it('should handle streaming content-type without content-length', () => {
      // When there's no content-length, no modification needed
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
