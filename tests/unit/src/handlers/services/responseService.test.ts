import { ResponseService } from '../../../../../src/handlers/services/responseService';
import { RequestContext } from '../../../../../src/handlers/services/requestContext';
import { HooksService } from '../../../../../src/handlers/services/hooksService';
import { responseHandler } from '../../../../../src/handlers/responseHandlers';
import { getRuntimeKey } from 'hono/adapter';
import {
  RESPONSE_HEADER_KEYS,
  HEADER_KEYS,
  POWERED_BY,
} from '../../../../../src/globals';

// Mock dependencies
jest.mock('../../../../../src/handlers/responseHandlers');
jest.mock('hono/adapter');

describe('ResponseService', () => {
  let mockRequestContext: RequestContext;
  let mockHooksService: HooksService;
  let responseService: ResponseService;

  beforeEach(() => {
    mockRequestContext = {
      index: 0,
      traceId: 'trace-123',
      provider: 'openai',
      isStreaming: false,
      params: { model: 'gpt-4', messages: [] },
      strictOpenAiCompliance: true,
      requestURL: 'https://api.openai.com/v1/chat/completions',
      honoContext: {
        req: { url: 'https://gateway.com/v1/chat/completions' },
      },
      providerOption: { provider: 'openai' },
    } as unknown as RequestContext;

    mockHooksService = {
      areSyncHooksAvailable: false,
      hookSpan: { id: 'hook-span-123' },
    } as unknown as HooksService;

    responseService = new ResponseService(mockRequestContext, mockHooksService);

    // Reset mocks
    jest.clearAllMocks();
    (getRuntimeKey as jest.Mock).mockReturnValue('node');
  });

  describe('create', () => {
    let mockResponse: Response;

    beforeEach(() => {
      mockResponse = new Response(
        JSON.stringify({ choices: [{ message: { content: 'Hello' } }] }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'content-encoding': 'gzip',
            'content-length': '100',
            'transfer-encoding': 'chunked',
          },
        }
      );
    });

    it('should create response for already mapped response', async () => {
      const options = {
        response: mockResponse,
        responseTransformer: undefined,
        isResponseAlreadyMapped: true,
        cache: {
          isCacheHit: false,
          cacheStatus: 'MISS',
          cacheKey: 'cache-key-123',
        },
        retryAttempt: 0,
        originalResponseJson: { choices: [{ message: { content: 'Hello' } }] },
      };

      const result = await responseService.create(options);

      // For non-streaming responses in Node.js, a new response may be created
      // to properly set content-length, so we check properties instead of identity
      expect(result.response.status).toBe(mockResponse.status);
      expect(result.originalResponseJson).toEqual({
        choices: [{ message: { content: 'Hello' } }],
      });

      // Check headers were updated on the result response
      expect(
        result.response.headers.get(RESPONSE_HEADER_KEYS.LAST_USED_OPTION_INDEX)
      ).toBe('0');
      expect(result.response.headers.get(RESPONSE_HEADER_KEYS.TRACE_ID)).toBe(
        'trace-123'
      );
      expect(
        result.response.headers.get(RESPONSE_HEADER_KEYS.RETRY_ATTEMPT_COUNT)
      ).toBe('0');
      expect(result.response.headers.get(HEADER_KEYS.PROVIDER)).toBe('openai');
    });

    it('should create response for non-mapped response', async () => {
      const mappedResponse = new Response('{"mapped": true}', { status: 200 });
      const originalJson = { original: true };
      const responseJson = { response: true };

      (responseHandler as jest.Mock).mockResolvedValue({
        response: mappedResponse,
        originalResponseJson: originalJson,
        responseJson: responseJson,
      });

      const options = {
        response: mockResponse,
        responseTransformer: 'chatComplete',
        isResponseAlreadyMapped: false,
        cache: {
          isCacheHit: false,
          cacheStatus: 'MISS',
          cacheKey: undefined,
        },
        retryAttempt: 1,
      };

      const result = await responseService.create(options);

      expect(responseHandler).toHaveBeenCalledWith(
        mockRequestContext.honoContext,
        mockResponse,
        mockRequestContext.isStreaming,
        mockRequestContext.providerOption,
        'chatComplete',
        mockRequestContext.requestURL,
        false,
        mockRequestContext.params,
        mockRequestContext.strictOpenAiCompliance,
        mockRequestContext.honoContext.req.url,
        mockHooksService.areSyncHooksAvailable,
        mockHooksService.hookSpan?.id
      );

      // Response is processed and headers are updated
      expect(result.response.status).toBe(mappedResponse.status);
      expect(result.responseJson).toBe(responseJson);
      expect(result.originalResponseJson).toBe(originalJson);
    });

    it('should handle cache hit scenario', async () => {
      const options = {
        response: mockResponse,
        responseTransformer: 'chatComplete',
        isResponseAlreadyMapped: false,
        cache: {
          isCacheHit: true,
          cacheStatus: 'HIT',
          cacheKey: 'cache-key-456',
        },
        retryAttempt: 0,
      };

      (responseHandler as jest.Mock).mockResolvedValue({
        response: mockResponse,
        originalResponseJson: null,
        responseJson: null,
      });

      const result = await responseService.create(options);

      expect(responseHandler).toHaveBeenCalledWith(
        mockRequestContext.honoContext,
        mockResponse,
        mockRequestContext.isStreaming,
        mockRequestContext.providerOption,
        'chatComplete',
        mockRequestContext.requestURL,
        true, // isCacheHit should be true
        mockRequestContext.params,
        mockRequestContext.strictOpenAiCompliance,
        mockRequestContext.honoContext.req.url,
        mockHooksService.areSyncHooksAvailable,
        mockHooksService.hookSpan?.id
      );

      expect(
        result.response.headers.get(RESPONSE_HEADER_KEYS.CACHE_STATUS)
      ).toBe('HIT');
    });

    it('should handle error response (400) correctly', async () => {
      const errorResponse = new Response('{"error": "Bad Request"}', {
        status: 400,
      });
      const options = {
        response: errorResponse,
        responseTransformer: undefined,
        isResponseAlreadyMapped: true,
        cache: {
          isCacheHit: false,
          cacheStatus: 'MISS',
          cacheKey: undefined,
        },
        retryAttempt: 0,
      };

      const result = await responseService.create(options);

      // The create method should process error responses without throwing
      expect(result.response.status).toBe(400);
    });

    it('should handle error response (500) correctly', async () => {
      const errorResponse = new Response('{"error": "Internal Server Error"}', {
        status: 500,
      });
      const options = {
        response: errorResponse,
        responseTransformer: undefined,
        isResponseAlreadyMapped: true,
        cache: {
          isCacheHit: false,
          cacheStatus: 'MISS',
          cacheKey: undefined,
        },
        retryAttempt: 0,
      };

      const result = await responseService.create(options);

      // The create method should process error responses without throwing
      expect(result.response.status).toBe(500);
    });

    it('should not add cache status header when not provided', async () => {
      const options = {
        response: mockResponse,
        responseTransformer: undefined,
        isResponseAlreadyMapped: true,
        cache: {
          isCacheHit: false,
          cacheStatus: undefined,
          cacheKey: undefined,
        },
        retryAttempt: 0,
      };

      const result = await responseService.create(options);

      expect(
        result.response.headers.get(RESPONSE_HEADER_KEYS.CACHE_STATUS)
      ).toBeNull();
    });

    it('should not add provider header when provider is POWERED_BY', async () => {
      const contextWithPortkey = {
        ...mockRequestContext,
        provider: POWERED_BY,
      } as RequestContext;

      const serviceWithPortkey = new ResponseService(
        contextWithPortkey,
        mockHooksService
      );

      const options = {
        response: mockResponse,
        responseTransformer: undefined,
        isResponseAlreadyMapped: true,
        cache: {
          isCacheHit: false,
          cacheStatus: 'MISS',
          cacheKey: undefined,
        },
        retryAttempt: 0,
      };

      const result = await serviceWithPortkey.create(options);

      expect(result.response.headers.get(HEADER_KEYS.PROVIDER)).toBeNull();
    });
  });

  describe('getResponse', () => {
    it('should call responseHandler with correct parameters', async () => {
      const mockResponse = new Response('{}');
      const expectedResult = {
        response: mockResponse,
        originalResponseJson: { test: true },
        responseJson: { response: true },
      };

      (responseHandler as jest.Mock).mockResolvedValue(expectedResult);

      const result = await responseService.getResponse(
        mockResponse,
        'chatComplete',
        false
      );

      expect(responseHandler).toHaveBeenCalledWith(
        mockRequestContext.honoContext,
        mockResponse,
        mockRequestContext.isStreaming,
        mockRequestContext.providerOption,
        'chatComplete',
        mockRequestContext.requestURL,
        false,
        mockRequestContext.params,
        mockRequestContext.strictOpenAiCompliance,
        mockRequestContext.honoContext.req.url,
        mockHooksService.areSyncHooksAvailable,
        mockHooksService.hookSpan?.id
      );

      expect(result).toBe(expectedResult);
    });

    it('should handle streaming responses', async () => {
      const streamingContext = {
        ...mockRequestContext,
        isStreaming: true,
      } as RequestContext;

      const streamingService = new ResponseService(
        streamingContext,
        mockHooksService
      );

      const mockResponse = new Response('{}');
      (responseHandler as jest.Mock).mockResolvedValue({
        response: mockResponse,
        originalResponseJson: null,
        responseJson: null,
      });

      await streamingService.getResponse(mockResponse, 'chatComplete', false);

      expect(responseHandler).toHaveBeenCalledWith(
        streamingContext.honoContext,
        mockResponse,
        true, // isStreaming should be true
        streamingContext.providerOption,
        'chatComplete',
        streamingContext.requestURL,
        false,
        streamingContext.params,
        streamingContext.strictOpenAiCompliance,
        streamingContext.honoContext.req.url,
        mockHooksService.areSyncHooksAvailable,
        mockHooksService.hookSpan?.id
      );
    });

    it('should handle cache hit scenario', async () => {
      const mockResponse = new Response('{}');
      (responseHandler as jest.Mock).mockResolvedValue({
        response: mockResponse,
        originalResponseJson: null,
        responseJson: null,
      });

      await responseService.getResponse(mockResponse, 'chatComplete', true);

      expect(responseHandler).toHaveBeenCalledWith(
        mockRequestContext.honoContext,
        mockResponse,
        mockRequestContext.isStreaming,
        mockRequestContext.providerOption,
        'chatComplete',
        mockRequestContext.requestURL,
        true, // isCacheHit should be true
        mockRequestContext.params,
        mockRequestContext.strictOpenAiCompliance,
        mockRequestContext.honoContext.req.url,
        mockHooksService.areSyncHooksAvailable,
        mockHooksService.hookSpan?.id
      );
    });
  });

  describe('updateHeaders', () => {
    let mockResponse: Response;

    beforeEach(() => {
      mockResponse = new Response('{}', {
        headers: {
          'content-encoding': 'br, gzip',
          'content-length': '100',
          'transfer-encoding': 'chunked',
        },
      });
    });

    it('should add required headers', () => {
      responseService.updateHeaders(mockResponse, 'HIT', 2);

      expect(
        mockResponse.headers.get(RESPONSE_HEADER_KEYS.LAST_USED_OPTION_INDEX)
      ).toBe('0');
      expect(mockResponse.headers.get(RESPONSE_HEADER_KEYS.TRACE_ID)).toBe(
        'trace-123'
      );
      expect(
        mockResponse.headers.get(RESPONSE_HEADER_KEYS.RETRY_ATTEMPT_COUNT)
      ).toBe('2');
      expect(mockResponse.headers.get(RESPONSE_HEADER_KEYS.CACHE_STATUS)).toBe(
        'HIT'
      );
      expect(mockResponse.headers.get(HEADER_KEYS.PROVIDER)).toBe('openai');
    });

    it('should remove problematic headers for streaming responses in node runtime', () => {
      // For streaming responses (no body string provided), delete both headers
      responseService.updateHeaders(mockResponse, undefined, 0);

      expect(mockResponse.headers.get('content-length')).toBeNull();
      expect(mockResponse.headers.get('transfer-encoding')).toBeNull();
    });

    it('should set correct content-length for non-streaming responses in node runtime', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');
      const bodyString = '{"test": "data"}';
      const response = new Response(bodyString, {
        headers: {
          'content-length': '100', // Wrong original content-length
          'transfer-encoding': 'chunked',
        },
      });

      responseService.updateHeaders(response, undefined, 0, bodyString);

      // Should set correct content-length based on actual body byte size
      const expectedLength = new TextEncoder().encode(bodyString).length;
      expect(response.headers.get('content-length')).toBe(
        expectedLength.toString()
      );
      // Should remove transfer-encoding to prevent HTTP/1.1 header conflict
      expect(response.headers.get('transfer-encoding')).toBeNull();
    });

    it('should handle unicode characters correctly in content-length calculation', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');
      // Unicode characters take more bytes than their string length
      const bodyString = '{"message": "你好世界"}';
      const response = new Response(bodyString, {
        headers: { 'content-length': '100' },
      });

      responseService.updateHeaders(response, undefined, 0, bodyString);

      // TextEncoder correctly counts bytes, not characters
      const expectedLength = new TextEncoder().encode(bodyString).length;
      expect(response.headers.get('content-length')).toBe(
        expectedLength.toString()
      );
    });

    it('should remove brotli encoding', () => {
      responseService.updateHeaders(mockResponse, undefined, 0);

      expect(mockResponse.headers.get('content-encoding')).toBeNull();
    });

    it('should remove content-encoding for node runtime', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');
      const response = new Response('{}', {
        headers: { 'content-encoding': 'gzip' },
      });

      responseService.updateHeaders(response, undefined, 0);

      expect(response.headers.get('content-encoding')).toBeNull();
    });

    it('should keep content-encoding for non-node runtime', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('workerd');
      const response = new Response('{}', {
        headers: { 'content-encoding': 'gzip' },
      });

      responseService.updateHeaders(response, undefined, 0);

      expect(response.headers.get('content-encoding')).toBe('gzip');
    });

    it('should delete content-length for non-node runtime', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('workerd');
      const bodyString = '{"test": "data"}';
      const response = new Response(bodyString, {
        headers: { 'content-length': '100' },
      });

      // Even with body string, non-node runtime should delete content-length
      responseService.updateHeaders(response, undefined, 0, bodyString);

      expect(response.headers.get('content-length')).toBeNull();
    });

    it('should not add cache status header when undefined', () => {
      responseService.updateHeaders(mockResponse, undefined, 0);

      expect(
        mockResponse.headers.get(RESPONSE_HEADER_KEYS.CACHE_STATUS)
      ).toBeNull();
    });

    it('should not add provider header when provider is POWERED_BY', () => {
      const contextWithPortkey = {
        ...mockRequestContext,
        provider: POWERED_BY,
      } as RequestContext;

      const serviceWithPortkey = new ResponseService(
        contextWithPortkey,
        mockHooksService
      );

      serviceWithPortkey.updateHeaders(mockResponse, 'MISS', 0);

      expect(mockResponse.headers.get(HEADER_KEYS.PROVIDER)).toBeNull();
    });

    it('should not add provider header when provider is empty', () => {
      const contextWithEmptyProvider = {
        ...mockRequestContext,
        provider: '',
      } as RequestContext;

      const serviceWithEmptyProvider = new ResponseService(
        contextWithEmptyProvider,
        mockHooksService
      );

      serviceWithEmptyProvider.updateHeaders(mockResponse, 'MISS', 0);

      expect(mockResponse.headers.get(HEADER_KEYS.PROVIDER)).toBeNull();
    });

    it('should return the response object', () => {
      const result = responseService.updateHeaders(mockResponse, 'MISS', 0);

      expect(result).toBe(mockResponse);
    });

    it('should delete content-length for streaming responses even with body string', () => {
      (getRuntimeKey as jest.Mock).mockReturnValue('node');
      const streamingContext = {
        ...mockRequestContext,
        isStreaming: true,
      } as RequestContext;

      const streamingService = new ResponseService(
        streamingContext,
        mockHooksService
      );

      const bodyString = '{"test": "data"}';
      const response = new Response(bodyString, {
        headers: { 'content-length': '100' },
      });

      // For streaming responses, should delete content-length
      streamingService.updateHeaders(response, undefined, 0, bodyString);

      expect(response.headers.get('content-length')).toBeNull();
    });
  });
});
