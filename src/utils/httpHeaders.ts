/**
 * HTTP Header Utilities
 *
 * This module provides utilities for handling HTTP headers,
 * particularly for ensuring HTTP/1.1 compliance.
 */

/**
 * Content types that indicate streaming responses.
 * These responses will use chunked transfer encoding in Node.js,
 * so content-length should be removed when present.
 */
const STREAMING_CONTENT_TYPES = [
  'text/event-stream',
  'application/x-ndjson',
  'application/stream+json',
];

/**
 * Checks if the response content type indicates a streaming response.
 *
 * @param contentType - The content-type header value
 * @returns true if the content type indicates streaming
 */
function isStreamingContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  // Extract the media type (ignore parameters like charset)
  const mediaType = contentType.split(';')[0].trim().toLowerCase();
  return STREAMING_CONTENT_TYPES.includes(mediaType);
}

/**
 * Sanitizes HTTP response headers to ensure HTTP/1.1 compliance.
 *
 * According to RFC 7230 Section 3.3.3, a message MUST NOT contain
 * both a Content-Length header field and a Transfer-Encoding header field.
 * When Transfer-Encoding is present, Content-Length MUST be removed.
 *
 * This is particularly important for Node.js environments where the HTTP
 * server automatically adds `transfer-encoding: chunked` for streaming
 * responses. If the upstream response includes a `content-length` header,
 * both headers would be present in the final response, violating HTTP/1.1.
 *
 * This function handles two scenarios:
 * 1. Both headers are already present - removes content-length
 * 2. Content-type indicates streaming (e.g., text/event-stream) and
 *    content-length is present - proactively removes content-length
 *    since Node.js will add transfer-encoding: chunked
 *
 * @param response - The Response object to sanitize
 * @returns A new Response with sanitized headers, or the original if no changes needed
 */
export function sanitizeResponseHeaders(response: Response): Response {
  const transferEncoding = response.headers.get('transfer-encoding');
  const contentLength = response.headers.get('content-length');
  const contentType = response.headers.get('content-type');

  // Remove content-length if:
  // 1. transfer-encoding is already present (per RFC 7230), OR
  // 2. Content type indicates streaming and content-length is present
  //    (Node.js will add transfer-encoding: chunked for streaming responses)
  const shouldRemoveContentLength =
    (transferEncoding && contentLength) ||
    (isStreamingContentType(contentType) && contentLength);

  if (shouldRemoveContentLength) {
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
