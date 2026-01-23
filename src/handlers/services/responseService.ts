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
  /** The response body as a string, used to calculate correct content-length */
  responseBodyString?: string;
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
      responseBodyString,
    } = options;

    let finalMappedResponse: Response;
    let originalResponseJSON: Record<string, any> | null | undefined;
    let responseJson: Record<string, any> | null | undefined;
    let bodyString: string | undefined = responseBodyString;

    if (isResponseAlreadyMapped) {
      finalMappedResponse = response;
      originalResponseJSON = originalResponseJson;
      // For non-streaming responses that are already mapped (e.g., from hooks),
      // we need to read the body to get the correct content-length
      if (
        !this.context.isStreaming &&
        bodyString === undefined &&
        getRuntimeKey() === 'node'
      ) {
        try {
          // Clone the response to read its body without consuming the original
          const clonedResponse = response.clone();
          bodyString = await clonedResponse.text();
          // Create a new response with the body string to ensure it can be read again
          finalMappedResponse = new Response(bodyString, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch {
          // If cloning fails, continue without setting content-length
          bodyString = undefined;
        }
      }
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
      // For non-streaming responses where we have the JSON, calculate the body string
      if (responseJson && !this.context.isStreaming) {
        bodyString = JSON.stringify(responseJson);
      }
    }

    this.updateHeaders(
      finalMappedResponse,
      cache.cacheStatus,
      retryAttempt,
      bodyString
    );

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
    retryAttempt: number,
    responseBodyString?: string
  ) {
    // Append headers directly
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

    // Handle content-length and transfer-encoding headers.
    // According to HTTP/1.1 spec (RFC 7230), content-length and transfer-encoding
    // should not be present together. For Node.js runtime:
    // - For non-streaming responses with known body: set correct content-length
    // - For streaming responses: delete both headers to allow chunked encoding
    if (getRuntimeKey() == 'node') {
      response.headers.delete('content-encoding');
      response.headers.delete('transfer-encoding');

      // For non-streaming responses where we have the body string,
      // set the correct content-length to prevent Node.js from using chunked encoding
      if (!this.context.isStreaming && responseBodyString !== undefined) {
        const bodyByteLength = new TextEncoder().encode(
          responseBodyString
        ).length;
        response.headers.set('content-length', bodyByteLength.toString());
      } else {
        // For streaming responses or when body is unknown, delete content-length
        // to allow proper chunked transfer encoding
        response.headers.delete('content-length');
      }
    } else {
      // For non-Node.js runtimes (e.g., Cloudflare Workers), delete content-length
      // as the runtime will handle it appropriately
      response.headers.delete('content-length');
    }

    return response;
  }
}
