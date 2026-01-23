import {
  ANTHROPIC,
  COHERE,
  GOOGLE,
  GOOGLE_VERTEX_AI,
  PERPLEXITY_AI,
  DEEPINFRA,
  SAMBANOVA,
  BEDROCK,
  BYTEZ,
} from './globals';
import { Params } from './types/requestBody';

/**
 * Headers that should be removed from streaming responses.
 * According to HTTP/1.1 spec (RFC 7230), a message MUST NOT contain both
 * Content-Length header and Transfer-Encoding header. When Node.js serves
 * a streaming response, it automatically adds Transfer-Encoding: chunked,
 * so we must remove Content-Length to avoid violating the spec.
 */
export const STREAMING_HEADERS_TO_REMOVE = [
  'content-length',
  'transfer-encoding',
  'content-encoding',
];

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
    if (!STREAMING_HEADERS_TO_REMOVE.includes(key.toLowerCase())) {
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

export const getStreamModeSplitPattern = (
  proxyProvider: string,
  requestURL: string
) => {
  let splitPattern: SplitPatternType = '\n\n';

  if (proxyProvider === ANTHROPIC && requestURL.endsWith('/complete')) {
    splitPattern = '\r\n\r\n';
  }

  if (proxyProvider === COHERE) {
    splitPattern = requestURL.includes('/chat') ? '\n\n' : '\n';
  }

  if (proxyProvider === GOOGLE) {
    splitPattern = '\r\n';
  }

  // In Vertex Anthropic and LLama have \n\n as the pattern only Gemini has \r\n\r\n
  if (
    proxyProvider === GOOGLE_VERTEX_AI &&
    requestURL.includes('/publishers/google')
  ) {
    splitPattern = '\r\n\r\n';
  }

  if (proxyProvider === PERPLEXITY_AI) {
    splitPattern = '\r\n\r\n';
  }

  if (proxyProvider === DEEPINFRA) {
    splitPattern = '\n';
  }

  if (proxyProvider === SAMBANOVA) {
    splitPattern = '\n';
  }

  if (proxyProvider === BYTEZ) {
    splitPattern = ' ';
  }

  return splitPattern;
};
export type SplitPatternType = '\n\n' | '\r\n\r\n' | '\n' | '\r\n' | ' ';

export const getStreamingMode = (
  reqBody: Params,
  provider: string,
  requestUrl: string
) => {
  if (
    [GOOGLE, GOOGLE_VERTEX_AI].includes(provider) &&
    requestUrl.indexOf('stream') > -1
  ) {
    return true;
  }
  if (
    provider === BEDROCK &&
    (requestUrl.indexOf('invoke-with-response-stream') > -1 ||
      requestUrl.indexOf('converse-stream') > -1)
  ) {
    return true;
  }
  return reqBody.stream;
};

export function convertKeysToCamelCase(
  obj: Record<string, any>,
  parentKeysToPreserve: string[] = []
): Record<string, any> {
  if (typeof obj !== 'object' || obj === null) {
    return obj; // Return unchanged for non-objects or null
  }

  if (Array.isArray(obj)) {
    // If it's an array, recursively convert each element
    return obj.map((item) =>
      convertKeysToCamelCase(item, parentKeysToPreserve)
    );
  }

  return Object.keys(obj).reduce((result: any, key: string) => {
    const value = obj[key];
    const camelCaseKey = toCamelCase(key);
    const isParentKeyToPreserve = parentKeysToPreserve.includes(key);
    if (typeof value === 'object' && !isParentKeyToPreserve) {
      // Recursively convert child objects
      result[camelCaseKey] = convertKeysToCamelCase(
        value,
        parentKeysToPreserve
      );
    } else {
      // Add key in camelCase to the result
      result[camelCaseKey] = value;
    }

    return result;
  }, {});

  function toCamelCase(snakeCase: string): string {
    return snakeCase.replace(/(_\w)/g, (match) => match[1].toUpperCase());
  }
}
