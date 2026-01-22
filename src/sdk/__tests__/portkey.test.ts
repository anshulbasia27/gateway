import { PortkeySDK } from '../portkey';

jest.useFakeTimers();

describe('PortkeySDK', () => {
  let sdk: PortkeySDK;

  beforeEach(() => {
    sdk = new PortkeySDK('test-api-key');
  });

  it('should respect the timeout parameter and abort the request', async () => {
    global.fetch = jest.fn(() =>
      new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => ({ success: true }) }), 1000))
    );

    const requestPromise = sdk.request('https://api.example.com/data', { timeout: 500 });

    jest.advanceTimersByTime(500);

    await expect(requestPromise).rejects.toThrow('Request timed out');
  });

  it('should complete the request if within the timeout', async () => {
    global.fetch = jest.fn(() =>
      new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => ({ success: true }) }), 500))
    );

    const response = await sdk.request('https://api.example.com/data', { timeout: 1000 });

    expect(response).toEqual({ success: true });
  });
});
