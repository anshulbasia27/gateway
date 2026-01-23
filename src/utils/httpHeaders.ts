/**
 * HTTP Header Utilities
 *
 * This module provides utilities for handling HTTP headers,
 * particularly for ensuring HTTP/1.1 compliance.
 *
 * Verified to work on Node.js versions:
 * - v20.19.5
 * - v22.14.0
 * - v22.16.0
 *
 * The issue addressed: Node.js can enrich HTTP responses with both
 * content-length and transfer-encoding: chunked headers, which violates
 * RFC 7230 Section 3.3.3 and causes client-side errors.
 */

/**
 * Headers that should be removed from streaming responses in Node.js.
 * According to HTTP/1.1 spec (RFC 7230), a message MUST NOT contain both
 * Content-Length header and Transfer-Encoding header. When Node.js serves
 * a streaming response, it automatically adds Transfer-Encoding: chunked,
 * so we must remove Content-Length to avoid violating the spec.
 *
 * Note: content-encoding is also removed for Node.js because the gateway
 * doesn't re-compress the response and keeping it would cause decoding errors.
 */
export const STREAMING_HEADERS_TO_REMOVE = [
  'content-length',
  'transfer-encoding',
  'content-encoding',
] as const;

/**
 * Creates sanitized headers for streaming responses by removing headers
 * that conflict with chunked transfer encoding.
 *
 * This prevents HTTP/1.1 spec violations when Node.js automatically adds
 * transfer-encoding: chunked for streaming responses. According to RFC 7230,
 * content-length must not be present alongside transfer-encoding.
 *
 * @param originalHeaders - The original response headers
 * @param additionalHeaders - Optional additional headers to add
 * @returns New Headers object with conflicting headers removed
 */
export function createStreamingHeaders(
  originalHeaders: Headers,
  additionalHeaders?: Record<string, string>
): Headers {
  const headers = new Headers();

  originalHeaders.forEach((value, key) => {
    if (
      !STREAMING_HEADERS_TO_REMOVE.includes(
        key.toLowerCase() as (typeof STREAMING_HEADERS_TO_REMOVE)[number]
      )
    ) {
      headers.set(key, value);
    }
  });

  if (additionalHeaders) {
    Object.entries(additionalHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  return headers;
}

/**
 * Sanitizes HTTP response headers to ensure HTTP/1.1 compliance.
 *
 * According to RFC 7230 Section 3.3.3, a message MUST NOT contain
 * both a Content-Length header field and a Transfer-Encoding header field.
 * When Transfer-Encoding is present, Content-Length MUST be removed.
 *
 * This is the final safety net that runs at the Node.js server level,
 * after all other header processing. It catches any cases where both
 * headers might still be present.
 *
 * @param response - The Response object to sanitize
 * @returns A new Response with sanitized headers, or the original if no changes needed
 */
export function sanitizeResponseHeaders(response: Response): Response {
  const transferEncoding = response.headers.get('transfer-encoding');
  const contentLength = response.headers.get('content-length');

  // If both headers are present, we need to remove content-length
  // as per HTTP/1.1 spec (RFC 7230)
  if (transferEncoding && contentLength) {
    const newHeaders = new Headers(response.headers);
    newHeaders.delete('content-length');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  return response;
}
