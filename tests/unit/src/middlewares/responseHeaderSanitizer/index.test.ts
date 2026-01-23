import {
  sanitizeResponseHeaders,
  responseHeaderSanitizer,
} from '../../../../../src/middlewares/responseHeaderSanitizer';
import { STREAMING_HEADERS_TO_REMOVE } from '../../../../../src/utils';
import { getRuntimeKey } from 'hono/adapter';
import { Context } from 'hono';

jest.mock('hono/adapter');

describe('responseHeaderSanitizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitizeResponseHeaders', () => {
    it('should remove content-length header', () => {
      const response = new Response('{}', {
        headers: {
          'content-length': '100',
          'content-type': 'application/json',
        },
      });

      sanitizeResponseHeaders(response);

      expect(response.headers.get('content-length')).toBeNull();
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should remove transfer-encoding header', () => {
      const response = new Response('{}', {
        headers: {
          'transfer-encoding': 'chunked',
          'content-type': 'application/json',
        },
      });

      sanitizeResponseHeaders(response);

      expect(response.headers.get('transfer-encoding')).toBeNull();
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should remove content-encoding header', () => {
      const response = new Response('{}', {
        headers: {
          'content-encoding': 'gzip',
          'content-type': 'application/json',
        },
      });

      sanitizeResponseHeaders(response);

      expect(response.headers.get('content-encoding')).toBeNull();
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should remove all problematic headers at once', () => {
      const response = new Response('{}', {
        headers: {
          'content-length': '100',
          'transfer-encoding': 'chunked',
          'content-encoding': 'gzip',
          'content-type': 'application/json',
        },
      });

      sanitizeResponseHeaders(response);

      expect(response.headers.get('content-length')).toBeNull();
      expect(response.headers.get('transfer-encoding')).toBeNull();
      expect(response.headers.get('content-encoding')).toBeNull();
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should not fail when headers are not present', () => {
      const response = new Response('{}', {
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(() => sanitizeResponseHeaders(response)).not.toThrow();
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should remove headers matching STREAMING_HEADERS_TO_REMOVE', () => {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };

      STREAMING_HEADERS_TO_REMOVE.forEach((header) => {
        headers[header] = 'test-value';
      });

      const response = new Response('{}', { headers });

      sanitizeResponseHeaders(response);

      STREAMING_HEADERS_TO_REMOVE.forEach((header) => {
        expect(response.headers.get(header)).toBeNull();
      });
      expect(response.headers.get('content-type')).toBe('application/json');
    });
  });

  describe('responseHeaderSanitizer middleware', () => {
    it('should sanitize headers for node runtime', async () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');

      const response = new Response('{}', {
        headers: {
          'content-length': '100',
          'transfer-encoding': 'chunked',
          'content-type': 'application/json',
        },
      });

      const mockContext = {
        res: response,
      } as unknown as Context;

      const next = jest.fn().mockResolvedValue(undefined);

      const middleware = responseHeaderSanitizer();
      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
      expect(response.headers.get('content-length')).toBeNull();
      expect(response.headers.get('transfer-encoding')).toBeNull();
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should not sanitize headers for non-node runtime', async () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('workerd');

      const response = new Response('{}', {
        headers: {
          'content-length': '100',
          'transfer-encoding': 'chunked',
          'content-type': 'application/json',
        },
      });

      const mockContext = {
        res: response,
      } as unknown as Context;

      const next = jest.fn().mockResolvedValue(undefined);

      const middleware = responseHeaderSanitizer();
      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
      expect(response.headers.get('content-length')).toBe('100');
      expect(response.headers.get('transfer-encoding')).toBe('chunked');
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should call next middleware before sanitizing headers', async () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');

      let nextWasCalled = false;

      const response = new Response('{}', {
        headers: {
          'content-length': '100',
        },
      });

      const mockContext = {
        res: response,
      } as unknown as Context;

      const next = jest.fn().mockImplementation(async () => {
        nextWasCalled = true;
        // Verify header still exists when next is called
        expect(response.headers.get('content-length')).toBe('100');
      });

      const middleware = responseHeaderSanitizer();
      await middleware(mockContext, next);

      expect(nextWasCalled).toBe(true);
      // After middleware completes, header should be removed
      expect(response.headers.get('content-length')).toBeNull();
    });
  });
});
