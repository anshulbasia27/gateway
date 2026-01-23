// responseService.ts

import { getRuntimeKey } from 'hono/adapter';
import { HEADER_KEYS, POWERED_BY, RESPONSE_HEADER_KEYS } from '../../globals';
import { responseHandler } from '../responseHandlers';
import { HooksService } from './hooksService';
import { RequestContext } from './requestContext';

interface CreateResponseOptions {
  response: Response;
  responseTransformer: string | undefined;
  isResponseAlreadyMapped: boolean;
  fetchOptions?: RequestInit;
  originalResponseJson?: Record<string, any> | null;
  cache: {
    isCacheHit: boolean;
    cacheStatus: string | undefined;
    cacheKey: string | undefined;
  };
  retryAttempt: number;
  createdAt?: Date;
  executionTime?: number;
}

export class ResponseService {
  constructor(
    private context: RequestContext,
    private hooksService: HooksService
  ) {}

  async create(options: CreateResponseOptions): Promise<{
    response: Response;
    responseJson?: Record<string, any> | null;
    originalResponseJson?: Record<string, any> | null;
  }> {
    const {
      response,
      responseTransformer,
      isResponseAlreadyMapped,
      cache,
      retryAttempt,
      originalResponseJson,
    } = options;

    let finalMappedResponse: Response;
    let originalResponseJSON: Record<string, any> | null | undefined;
    let responseJson: Record<string, any> | null | undefined;

    if (isResponseAlreadyMapped) {
      finalMappedResponse = response;
      originalResponseJSON = originalResponseJson;
    } else {
      ({
        response: finalMappedResponse,
        originalResponseJson: originalResponseJSON,
        responseJson: responseJson,
      } = await this.getResponse(
        response,
        responseTransformer,
        cache.isCacheHit
      ));
    }

    this.updateHeaders(finalMappedResponse, cache.cacheStatus, retryAttempt);

    return {
      response: finalMappedResponse,
      responseJson,
      originalResponseJson: originalResponseJSON,
    };
  }

  async getResponse(
    response: Response,
    responseTransformer: string | undefined,
    isCacheHit: boolean
  ): Promise<{
    response: Response;
    originalResponseJson?: Record<string, any> | null;
    responseJson?: Record<string, any> | null;
  }> {
    const url = this.context.requestURL;
    return await responseHandler(
      this.context.honoContext,
      response,
      this.context.isStreaming,
      this.context.providerOption,
      responseTransformer,
      url,
      isCacheHit,
      this.context.params,
      this.context.strictOpenAiCompliance,
      this.context.honoContext.req.url,
      this.hooksService.areSyncHooksAvailable,
      this.hooksService.hookSpan?.id as string
    );
  }

  updateHeaders(
    response: Response,
    cacheStatus: string | undefined,
    retryAttempt: number
  ) {
    // Append custom gateway headers
    response.headers.append(
      RESPONSE_HEADER_KEYS.LAST_USED_OPTION_INDEX,
      this.context.index.toString()
    );
    response.headers.append(
      RESPONSE_HEADER_KEYS.TRACE_ID,
      this.context.traceId
    );
    response.headers.append(
      RESPONSE_HEADER_KEYS.RETRY_ATTEMPT_COUNT,
      retryAttempt.toString()
    );

    if (cacheStatus) {
      response.headers.append(RESPONSE_HEADER_KEYS.CACHE_STATUS, cacheStatus);
    }

    if (this.context.provider && this.context.provider !== POWERED_BY) {
      response.headers.append(HEADER_KEYS.PROVIDER, this.context.provider);
    }

    // Remove headers to ensure HTTP/1.1 compliance.
    // According to HTTP/1.1 RFC 7230 Section 3.3.2:
    // "A sender MUST NOT send a Content-Length header field in any message
    // that contains a Transfer-Encoding header field."
    //
    // For Node.js runtime, we handle streaming and non-streaming responses
    // differently to ensure proper HTTP compliance:
    // - Streaming: remove content-length, allow transfer-encoding for chunked responses
    // - Non-streaming: remove transfer-encoding, allow content-length to be set by HTTP layer
    if (getRuntimeKey() === 'node') {
      response.headers.delete('content-encoding');

      if (this.context.isStreaming) {
        // Streaming responses: remove content-length, allow transfer-encoding
        response.headers.delete('content-length');
      } else {
        // Non-streaming responses: remove transfer-encoding and content-length
        // The HTTP layer will set the correct content-length based on body size
        response.headers.delete('transfer-encoding');
        response.headers.delete('content-length');
      }
    } else {
      response.headers.delete('content-length');
    }

    return response;
  }
}
