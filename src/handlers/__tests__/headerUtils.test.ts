/**
 * Tests for HTTP/1.1 compliant header handling.
 *
 * These tests verify that content-length and transfer-encoding headers
 * are properly removed from responses to prevent HTTP/1.1 violations.
 */

import {
  handleNonStreamingMode,
  handleTextResponse,
  handleAudioResponse,
  handleOctetStreamResponse,
  handleImageResponse,
  handleStreamingMode,
} from '../streamHandler';
import { Params } from '../../types/requestBody';
import { HookSpan } from '../../middlewares/hooks';

describe('HTTP/1.1 Header Compliance', () => {
  describe('createCleanResponseHeaders', () => {
    it('should remove content-length header from response', async () => {
      const mockResponse = new Response(JSON.stringify({ test: 'data' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-length': '123',
          'x-custom-header': 'value',
        },
      });

      const result = await handleNonStreamingMode(
        mockResponse,
        undefined, // no transformer
        true, // strictOpenAiCompliance
        'http://gateway.test/v1/chat/completions',
        {} as Params,
        false // no sync hooks
      );

      expect(result.response.headers.get('content-length')).toBeNull();
      expect(result.response.headers.get('x-custom-header')).toBe('value');
      expect(result.response.headers.get('content-type')).toBe(
        'application/json'
      );
    });

    it('should remove transfer-encoding header from response', async () => {
      const mockResponse = new Response(JSON.stringify({ test: 'data' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
          'x-custom-header': 'value',
        },
      });

      const result = await handleNonStreamingMode(
        mockResponse,
        undefined,
        true,
        'http://gateway.test/v1/chat/completions',
        {} as Params,
        false
      );

      expect(result.response.headers.get('transfer-encoding')).toBeNull();
      expect(result.response.headers.get('x-custom-header')).toBe('value');
    });

    it('should remove both content-length and transfer-encoding headers', async () => {
      const mockResponse = new Response(JSON.stringify({ test: 'data' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-length': '123',
          'transfer-encoding': 'chunked',
        },
      });

      const result = await handleNonStreamingMode(
        mockResponse,
        undefined,
        true,
        'http://gateway.test/v1/chat/completions',
        {} as Params,
        false
      );

      expect(result.response.headers.get('content-length')).toBeNull();
      expect(result.response.headers.get('transfer-encoding')).toBeNull();
    });
  });

  describe('handleTextResponse', () => {
    it('should remove content-length and transfer-encoding from text responses', async () => {
      const mockResponse = new Response('Hello, World!', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'content-length': '13',
          'transfer-encoding': 'chunked',
        },
      });

      const result = await handleTextResponse(mockResponse, undefined);

      expect(result.headers.get('content-length')).toBeNull();
      expect(result.headers.get('transfer-encoding')).toBeNull();
      expect(result.headers.get('content-type')).toBe('text/plain');
    });
  });

  describe('handleAudioResponse', () => {
    it('should remove content-length and transfer-encoding from audio responses', () => {
      const mockBody = new ReadableStream();
      const mockResponse = new Response(mockBody, {
        status: 200,
        headers: {
          'content-type': 'audio/mpeg',
          'content-length': '1000',
          'transfer-encoding': 'chunked',
        },
      });

      const result = handleAudioResponse(mockResponse);

      expect(result.headers.get('content-length')).toBeNull();
      expect(result.headers.get('transfer-encoding')).toBeNull();
      expect(result.headers.get('content-type')).toBe('audio/mpeg');
    });
  });

  describe('handleOctetStreamResponse', () => {
    it('should remove content-length and transfer-encoding from octet-stream responses', () => {
      const mockBody = new ReadableStream();
      const mockResponse = new Response(mockBody, {
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': '5000',
          'transfer-encoding': 'chunked',
        },
      });

      const result = handleOctetStreamResponse(mockResponse);

      expect(result.headers.get('content-length')).toBeNull();
      expect(result.headers.get('transfer-encoding')).toBeNull();
    });
  });

  describe('handleImageResponse', () => {
    it('should remove content-length and transfer-encoding from image responses', () => {
      const mockBody = new ReadableStream();
      const mockResponse = new Response(mockBody, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': '2000',
          'transfer-encoding': 'chunked',
        },
      });

      const result = handleImageResponse(mockResponse);

      expect(result.headers.get('content-length')).toBeNull();
      expect(result.headers.get('transfer-encoding')).toBeNull();
    });
  });

  describe('handleStreamingMode', () => {
    it('should remove content-length from streaming responses', () => {
      // Create a mock streaming response
      const encoder = new TextEncoder();
      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: test\n\n'));
          controller.close();
        },
      });

      const mockResponse = new Response(mockBody, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'content-length': '13',
        },
      });

      const mockHooksResult: HookSpan['hooksResult'] = {
        beforeRequestHooksResult: [],
        afterRequestHooksResult: [],
      };

      const result = handleStreamingMode(
        mockResponse,
        'openai',
        undefined,
        'https://api.openai.com/v1/chat/completions',
        true,
        {} as Params,
        'chatComplete',
        mockHooksResult
      );

      expect(result.headers.get('content-length')).toBeNull();
      expect(result.headers.get('transfer-encoding')).toBeNull();
    });
  });
});
