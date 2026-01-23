/**
 * Tests for HTTP response header sanitization.
 *
 * These tests verify that the gateway properly handles HTTP headers to avoid
 * HTTP/1.1 specification violations, specifically ensuring that:
 * - transfer-encoding: chunked is not present alongside content-length
 * - Headers are properly sanitized when creating non-streaming responses
 *
 * This addresses the issue where making requests to providers (like Anthropic)
 * with streaming disabled would result in responses containing both
 * content-length and transfer-encoding: chunked headers, which violates
 * HTTP/1.1 RFC 7230 and causes client-side errors in Node.js environments.
 */

import {
  handleNonStreamingMode,
  handleTextResponse,
  createNonStreamingResponseHeaders,
} from '../streamHandler';
import { getRuntimeKey } from 'hono/adapter';

// Mock hono/adapter to simulate Node.js environment
jest.mock('hono/adapter', () => ({
  getRuntimeKey: jest.fn().mockReturnValue('node'),
}));

describe('HTTP Header Sanitization for Non-Streaming Responses', () => {
  describe('createNonStreamingResponseHeaders', () => {
    beforeEach(() => {
      // Default to Node.js runtime
      (getRuntimeKey as jest.Mock).mockReturnValue('node');
    });

    it('should remove transfer-encoding header in Node.js', () => {
      const originalHeaders = new Headers({
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
        'x-custom-header': 'custom-value',
      });

      const sanitized = createNonStreamingResponseHeaders(originalHeaders);

      expect(sanitized.get('transfer-encoding')).toBeNull();
      expect(sanitized.get('content-type')).toBe('application/json');
      expect(sanitized.get('x-custom-header')).toBe('custom-value');
    });

    it('should remove content-length header in Node.js', () => {
      const originalHeaders = new Headers({
        'content-type': 'application/json',
        'content-length': '100',
      });

      const sanitized = createNonStreamingResponseHeaders(originalHeaders);

      expect(sanitized.get('content-length')).toBeNull();
      expect(sanitized.get('content-type')).toBe('application/json');
    });

    it('should remove content-encoding header in Node.js', () => {
      const originalHeaders = new Headers({
        'content-type': 'application/json',
        'content-encoding': 'gzip',
      });

      const sanitized = createNonStreamingResponseHeaders(originalHeaders);

      expect(sanitized.get('content-encoding')).toBeNull();
      expect(sanitized.get('content-type')).toBe('application/json');
    });

    it('should remove all problematic headers in Node.js', () => {
      const originalHeaders = new Headers({
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
        'content-length': '50',
        'content-encoding': 'br',
        'x-request-id': 'abc123',
      });

      const sanitized = createNonStreamingResponseHeaders(originalHeaders);

      expect(sanitized.get('transfer-encoding')).toBeNull();
      expect(sanitized.get('content-length')).toBeNull();
      expect(sanitized.get('content-encoding')).toBeNull();
      expect(sanitized.get('content-type')).toBe('application/json');
      expect(sanitized.get('x-request-id')).toBe('abc123');
    });

    it('should only remove content-length in non-Node.js environments', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('workerd');

      const originalHeaders = new Headers({
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
        'content-length': '50',
        'content-encoding': 'gzip',
      });

      const sanitized = createNonStreamingResponseHeaders(originalHeaders);

      // Only content-length should be removed in workerd
      expect(sanitized.get('content-length')).toBeNull();
      // Other headers should be preserved
      expect(sanitized.get('transfer-encoding')).toBe('chunked');
      expect(sanitized.get('content-encoding')).toBe('gzip');
      expect(sanitized.get('content-type')).toBe('application/json');
    });

    it('should handle headers with different cases', () => {
      const originalHeaders = new Headers({
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
        'Content-Length': '100',
      });

      const sanitized = createNonStreamingResponseHeaders(originalHeaders);

      // Headers API normalizes keys to lowercase
      expect(sanitized.get('transfer-encoding')).toBeNull();
      expect(sanitized.get('content-length')).toBeNull();
      expect(sanitized.get('content-type')).toBe('application/json');
    });

    it('should preserve all non-problematic headers', () => {
      const originalHeaders = new Headers({
        'content-type': 'application/json',
        'x-request-id': 'abc123',
        'x-ratelimit-remaining': '99',
        'cache-control': 'no-cache',
        date: 'Thu, 23 Jan 2026 00:00:00 GMT',
        server: 'nginx',
      });

      const sanitized = createNonStreamingResponseHeaders(originalHeaders);

      expect(sanitized.get('content-type')).toBe('application/json');
      expect(sanitized.get('x-request-id')).toBe('abc123');
      expect(sanitized.get('x-ratelimit-remaining')).toBe('99');
      expect(sanitized.get('cache-control')).toBe('no-cache');
      expect(sanitized.get('date')).toBe('Thu, 23 Jan 2026 00:00:00 GMT');
      expect(sanitized.get('server')).toBe('nginx');
    });

    it('should handle empty headers', () => {
      const originalHeaders = new Headers();

      const sanitized = createNonStreamingResponseHeaders(originalHeaders);

      // Should return empty headers without error
      expect(Array.from(sanitized.keys())).toHaveLength(0);
    });
  });

  describe('handleNonStreamingMode', () => {
    beforeEach(() => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');
    });

    it('should remove transfer-encoding header when creating JSON response', async () => {
      const originalResponse = new Response(JSON.stringify({ test: 'data' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
          'x-custom-header': 'custom-value',
        },
      });

      const result = await handleNonStreamingMode(
        originalResponse,
        undefined, // responseTransformer
        true, // strictOpenAiCompliance
        'https://gateway.com/v1/chat/completions',
        { model: 'gpt-4', messages: [] },
        true // areSyncHooksAvailable
      );

      // transfer-encoding should be removed
      expect(result.response.headers.get('transfer-encoding')).toBeNull();
      // content-length should be removed (will be recalculated by HTTP layer)
      expect(result.response.headers.get('content-length')).toBeNull();
      // custom headers should be preserved
      expect(result.response.headers.get('x-custom-header')).toBe(
        'custom-value'
      );
    });

    it('should remove content-encoding header when creating JSON response', async () => {
      const originalResponse = new Response(JSON.stringify({ test: 'data' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-encoding': 'gzip',
          'content-length': '100',
        },
      });

      const result = await handleNonStreamingMode(
        originalResponse,
        undefined,
        true,
        'https://gateway.com/v1/chat/completions',
        { model: 'gpt-4', messages: [] },
        true
      );

      // content-encoding should be removed
      expect(result.response.headers.get('content-encoding')).toBeNull();
      // content-length should be removed
      expect(result.response.headers.get('content-length')).toBeNull();
    });

    it('should preserve non-problematic headers', async () => {
      const originalResponse = new Response(JSON.stringify({ test: 'data' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'abc123',
          'x-ratelimit-remaining': '99',
          'cache-control': 'no-cache',
        },
      });

      const result = await handleNonStreamingMode(
        originalResponse,
        undefined,
        true,
        'https://gateway.com/v1/chat/completions',
        { model: 'gpt-4', messages: [] },
        true
      );

      expect(result.response.headers.get('x-request-id')).toBe('abc123');
      expect(result.response.headers.get('x-ratelimit-remaining')).toBe('99');
      expect(result.response.headers.get('cache-control')).toBe('no-cache');
    });

    it('should handle response with all problematic headers', async () => {
      const originalResponse = new Response(JSON.stringify({ test: 'data' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
          'content-length': '50',
          'content-encoding': 'br',
        },
      });

      const result = await handleNonStreamingMode(
        originalResponse,
        undefined,
        true,
        'https://gateway.com/v1/chat/completions',
        { model: 'gpt-4', messages: [] },
        true
      );

      // All problematic headers should be removed
      expect(result.response.headers.get('transfer-encoding')).toBeNull();
      expect(result.response.headers.get('content-length')).toBeNull();
      expect(result.response.headers.get('content-encoding')).toBeNull();
      // content-type should be preserved
      expect(result.response.headers.get('content-type')).toBe(
        'application/json'
      );
    });

    it('should handle response when areSyncHooksAvailable is false', async () => {
      const originalResponse = new Response(JSON.stringify({ test: 'data' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
          'content-length': '50',
        },
      });

      const result = await handleNonStreamingMode(
        originalResponse,
        undefined,
        true,
        'https://gateway.com/v1/chat/completions',
        { model: 'gpt-4', messages: [] },
        false // areSyncHooksAvailable = false
      );

      // Headers should still be sanitized
      expect(result.response.headers.get('transfer-encoding')).toBeNull();
      expect(result.response.headers.get('content-length')).toBeNull();
    });
  });

  describe('handleTextResponse', () => {
    beforeEach(() => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');
    });

    it('should remove problematic headers when transforming text to JSON', async () => {
      const originalResponse = new Response('Hello, World!', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'transfer-encoding': 'chunked',
          'content-length': '13',
        },
      });

      const transformer = (data: any, status: number) => ({ message: data });

      const result = await handleTextResponse(originalResponse, transformer);

      // Problematic headers should be removed
      expect(result.headers.get('transfer-encoding')).toBeNull();
      expect(result.headers.get('content-length')).toBeNull();
      // content-type should be updated to application/json
      expect(result.headers.get('content-type')).toBe('application/json');
    });

    it('should pass through response unchanged when no transformer provided', async () => {
      const originalResponse = new Response('Hello, World!', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'transfer-encoding': 'chunked',
        },
      });

      const result = await handleTextResponse(originalResponse, undefined);

      // When no transformer, original response is returned with same headers
      expect(result.headers.get('content-type')).toBe('text/plain');
    });
  });

  describe('Response creation with sanitized headers', () => {
    beforeEach(() => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');
    });

    it('should create response without conflicting headers', () => {
      const originalResponse = new Response(JSON.stringify({ test: 'data' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
          'content-length': '50',
        },
      });

      const sanitizedHeaders = createNonStreamingResponseHeaders(
        originalResponse.headers
      );

      const newResponse = new Response(JSON.stringify({ modified: 'data' }), {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers: sanitizedHeaders,
      });

      // Verify the new response has sanitized headers
      expect(newResponse.headers.get('transfer-encoding')).toBeNull();
      expect(newResponse.headers.get('content-length')).toBeNull();
      expect(newResponse.headers.get('content-type')).toBe('application/json');
    });
  });
});
