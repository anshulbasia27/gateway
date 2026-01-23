import {
  createStreamingHeaders,
  STREAMING_HEADERS_TO_REMOVE,
} from '../../../src/utils';

describe('createStreamingHeaders', () => {
  it('should remove content-length header from streaming responses', () => {
    const originalHeaders = new Headers({
      'content-type': 'text/event-stream',
      'content-length': '100',
      'x-custom-header': 'value',
    });

    const result = createStreamingHeaders(originalHeaders);

    expect(result.get('content-length')).toBeNull();
    expect(result.get('content-type')).toBe('text/event-stream');
    expect(result.get('x-custom-header')).toBe('value');
  });

  it('should remove transfer-encoding header from streaming responses', () => {
    const originalHeaders = new Headers({
      'content-type': 'text/event-stream',
      'transfer-encoding': 'chunked',
      'x-custom-header': 'value',
    });

    const result = createStreamingHeaders(originalHeaders);

    expect(result.get('transfer-encoding')).toBeNull();
    expect(result.get('content-type')).toBe('text/event-stream');
    expect(result.get('x-custom-header')).toBe('value');
  });

  it('should remove content-encoding header from streaming responses', () => {
    const originalHeaders = new Headers({
      'content-type': 'text/event-stream',
      'content-encoding': 'gzip',
      'x-custom-header': 'value',
    });

    const result = createStreamingHeaders(originalHeaders);

    expect(result.get('content-encoding')).toBeNull();
    expect(result.get('content-type')).toBe('text/event-stream');
    expect(result.get('x-custom-header')).toBe('value');
  });

  it('should remove all conflicting headers together (HTTP/1.1 spec compliance)', () => {
    const originalHeaders = new Headers({
      'content-type': 'text/event-stream',
      'content-length': '100',
      'transfer-encoding': 'chunked',
      'content-encoding': 'gzip',
      'x-custom-header': 'value',
    });

    const result = createStreamingHeaders(originalHeaders);

    // According to HTTP/1.1 spec, content-length must not be present with transfer-encoding
    expect(result.get('content-length')).toBeNull();
    expect(result.get('transfer-encoding')).toBeNull();
    expect(result.get('content-encoding')).toBeNull();
    expect(result.get('content-type')).toBe('text/event-stream');
    expect(result.get('x-custom-header')).toBe('value');
  });

  it('should add additional headers to the result', () => {
    const originalHeaders = new Headers({
      'x-original-header': 'original',
    });

    const result = createStreamingHeaders(originalHeaders, {
      'content-type': 'text/event-stream',
      'x-new-header': 'new',
    });

    expect(result.get('x-original-header')).toBe('original');
    expect(result.get('content-type')).toBe('text/event-stream');
    expect(result.get('x-new-header')).toBe('new');
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

  it('should handle empty headers', () => {
    const originalHeaders = new Headers();

    const result = createStreamingHeaders(originalHeaders);

    expect([...result.entries()]).toHaveLength(0);
  });

  it('should handle headers with case-insensitive matching', () => {
    const originalHeaders = new Headers({
      'Content-Length': '100',
      'Transfer-Encoding': 'chunked',
      'Content-Encoding': 'gzip',
    });

    const result = createStreamingHeaders(originalHeaders);

    // Headers should be removed regardless of case
    expect(result.get('content-length')).toBeNull();
    expect(result.get('Content-Length')).toBeNull();
    expect(result.get('transfer-encoding')).toBeNull();
    expect(result.get('Transfer-Encoding')).toBeNull();
    expect(result.get('content-encoding')).toBeNull();
    expect(result.get('Content-Encoding')).toBeNull();
  });
});

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
