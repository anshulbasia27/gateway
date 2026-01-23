import { createStreamingHeaders } from '../../../../src/utils';

describe('streamHandler HTTP header compliance', () => {
  describe('streaming response header sanitization', () => {
    it('should not include content-length with transfer-encoding (HTTP/1.1 compliance)', () => {
      // Simulate headers from an upstream provider that includes content-length
      const upstreamHeaders = new Headers({
        'content-type': 'text/event-stream',
        'content-length': '1024',
        'transfer-encoding': 'chunked',
        'x-request-id': '12345',
      });

      // Apply streaming header sanitization
      const sanitizedHeaders = createStreamingHeaders(upstreamHeaders);

      // According to HTTP/1.1 spec (RFC 7230), content-length must not be
      // present alongside transfer-encoding
      expect(sanitizedHeaders.get('content-length')).toBeNull();
      expect(sanitizedHeaders.get('transfer-encoding')).toBeNull();

      // Other headers should be preserved
      expect(sanitizedHeaders.get('content-type')).toBe('text/event-stream');
      expect(sanitizedHeaders.get('x-request-id')).toBe('12345');
    });

    it('should handle streaming responses without conflicting headers', () => {
      const upstreamHeaders = new Headers({
        'content-type': 'text/event-stream',
        'x-request-id': '12345',
      });

      const sanitizedHeaders = createStreamingHeaders(upstreamHeaders);

      expect(sanitizedHeaders.get('content-type')).toBe('text/event-stream');
      expect(sanitizedHeaders.get('x-request-id')).toBe('12345');
    });

    it('should allow overriding content-type for streaming responses', () => {
      const upstreamHeaders = new Headers({
        'content-type': 'application/json',
        'x-request-id': '12345',
      });

      const sanitizedHeaders = createStreamingHeaders(upstreamHeaders, {
        'content-type': 'text/event-stream',
      });

      expect(sanitizedHeaders.get('content-type')).toBe('text/event-stream');
    });
  });

  describe('Node.js HTTP/1.1 spec compliance', () => {
    it('should prevent client-side errors from HTTP response structure violation', () => {
      // This test verifies the fix for the issue where Node.js enriches
      // HTTP responses with both content-length and transfer-encoding: chunked
      const problematicHeaders = new Headers({
        'content-type': 'text/event-stream',
        'content-length': '100',
        'content-encoding': 'gzip',
      });

      const fixedHeaders = createStreamingHeaders(problematicHeaders);

      // The fix removes content-length to prevent HTTP/1.1 spec violation
      // when Node.js automatically adds transfer-encoding: chunked
      expect(fixedHeaders.get('content-length')).toBeNull();
      expect(fixedHeaders.get('content-encoding')).toBeNull();
      expect(fixedHeaders.get('content-type')).toBe('text/event-stream');
    });
  });
});
