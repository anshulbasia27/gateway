import { createNonStreamingResponseHeaders } from '../../../../src/handlers/streamHandler';
import { getRuntimeKey } from 'hono/adapter';

jest.mock('hono/adapter');

describe('streamHandler', () => {
  describe('createNonStreamingResponseHeaders', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should remove transfer-encoding, content-encoding, and content-length for Node.js runtime', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');

      const originalHeaders = new Headers({
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        'content-length': '100',
        'transfer-encoding': 'chunked',
        'x-custom-header': 'custom-value',
      });

      const result = createNonStreamingResponseHeaders(originalHeaders);

      // Should remove problematic headers
      expect(result.get('transfer-encoding')).toBeNull();
      expect(result.get('content-encoding')).toBeNull();
      expect(result.get('content-length')).toBeNull();

      // Should keep other headers
      expect(result.get('content-type')).toBe('application/json');
      expect(result.get('x-custom-header')).toBe('custom-value');
    });

    it('should only remove content-length for non-Node.js runtimes', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('workerd');

      const originalHeaders = new Headers({
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        'content-length': '100',
        'transfer-encoding': 'chunked',
        'x-custom-header': 'custom-value',
      });

      const result = createNonStreamingResponseHeaders(originalHeaders);

      // Should only remove content-length
      expect(result.get('content-length')).toBeNull();

      // Should keep other headers including transfer-encoding and content-encoding
      expect(result.get('transfer-encoding')).toBe('chunked');
      expect(result.get('content-encoding')).toBe('gzip');
      expect(result.get('content-type')).toBe('application/json');
      expect(result.get('x-custom-header')).toBe('custom-value');
    });

    it('should handle headers with various casing', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');

      const originalHeaders = new Headers({
        'Content-Type': 'application/json',
        'TRANSFER-ENCODING': 'chunked',
        'Content-Length': '100',
      });

      const result = createNonStreamingResponseHeaders(originalHeaders);

      // Headers are case-insensitive, so these should be removed
      expect(result.get('transfer-encoding')).toBeNull();
      expect(result.get('content-length')).toBeNull();

      // Content-type should be preserved
      expect(result.get('content-type')).toBe('application/json');
    });

    it('should handle empty headers', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');

      const originalHeaders = new Headers();

      const result = createNonStreamingResponseHeaders(originalHeaders);

      expect(Array.from(result.keys())).toHaveLength(0);
    });

    it('should preserve all Portkey custom headers', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');

      const originalHeaders = new Headers({
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
        'x-portkey-trace-id': 'trace-123',
        'x-portkey-provider': 'anthropic',
        'x-portkey-cache-status': 'HIT',
      });

      const result = createNonStreamingResponseHeaders(originalHeaders);

      // Portkey headers should be preserved
      expect(result.get('x-portkey-trace-id')).toBe('trace-123');
      expect(result.get('x-portkey-provider')).toBe('anthropic');
      expect(result.get('x-portkey-cache-status')).toBe('HIT');

      // Problematic headers should be removed
      expect(result.get('transfer-encoding')).toBeNull();
    });

    it('should ensure HTTP/1.1 compliance by removing transfer-encoding for JSON responses', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');

      // Simulating headers from a provider that uses chunked encoding
      // even for non-streaming responses
      const originalHeaders = new Headers({
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
        'x-request-id': 'req-123',
      });

      const result = createNonStreamingResponseHeaders(originalHeaders);

      // For non-streaming JSON responses, transfer-encoding should be removed
      // to allow the HTTP layer to set content-length appropriately
      expect(result.get('transfer-encoding')).toBeNull();
      expect(result.get('content-type')).toBe('application/json');
      expect(result.get('x-request-id')).toBe('req-123');
    });
  });
});
