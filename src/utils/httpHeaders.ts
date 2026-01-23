/**
 * HTTP Header Utilities
 *
 * This module provides utilities for handling HTTP headers,
 * particularly for ensuring HTTP/1.1 compliance.
 */

/**
 * Sanitizes HTTP response headers to ensure HTTP/1.1 compliance.
 *
 * According to RFC 7230 Section 3.3.3, a message MUST NOT contain
 * both a Content-Length header field and a Transfer-Encoding header field.
 * When Transfer-Encoding is present, Content-Length MUST be removed.
 *
 * This is particularly important for Node.js environments where the HTTP
 * server might automatically add these headers, causing client-side errors.
 *
 * @param response - The Response object to sanitize
 * @returns A new Response with sanitized headers
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
