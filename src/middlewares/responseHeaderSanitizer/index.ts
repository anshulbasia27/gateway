/**
 * Response Header Sanitizer Middleware
 *
 * This middleware ensures HTTP response headers comply with HTTP/1.1 specification.
 * Specifically, it addresses the issue where Node.js may include both `content-length`
 * and `transfer-encoding: chunked` headers, which violates RFC 7230 Section 3.3.3.
 *
 * According to HTTP/1.1 spec:
 * "A sender MUST NOT send a Content-Length header field in any message that
 * contains a Transfer-Encoding header field."
 *
 * @module responseHeaderSanitizer
 */

import { Context, MiddlewareHandler } from 'hono';
import { getRuntimeKey } from 'hono/adapter';
import { STREAMING_HEADERS_TO_REMOVE } from '../../utils';

/**
 * Sanitizes response headers to ensure HTTP/1.1 compliance.
 * Removes headers that conflict with chunked transfer encoding when
 * running on Node.js, which automatically adds transfer-encoding: chunked
 * for streaming responses.
 *
 * @returns {MiddlewareHandler} Hono middleware handler
 */
export const responseHeaderSanitizer = (): MiddlewareHandler => {
  return async (c: Context, next) => {
    await next();

    // Only apply sanitization for Node.js runtime where this issue occurs
    const runtime = getRuntimeKey();
    if (runtime !== 'node') {
      return;
    }

    sanitizeResponseHeaders(c.res);
  };
};

/**
 * Sanitizes headers on a Response object to ensure HTTP/1.1 compliance.
 * Removes content-length, transfer-encoding, and content-encoding headers
 * that may conflict when Node.js adds its own transfer-encoding header.
 *
 * According to RFC 7230 Section 3.3.3:
 * "A sender MUST NOT send a Content-Length header field in any message that
 * contains a Transfer-Encoding header field."
 *
 * @param {Response} response - The response object to sanitize
 */
export function sanitizeResponseHeaders(response: Response): void {
  STREAMING_HEADERS_TO_REMOVE.forEach((header) => {
    response.headers.delete(header);
  });
}

export default responseHeaderSanitizer;
